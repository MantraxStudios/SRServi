using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace AforoBridge
{
    /// <summary>
    /// Orquesta el puente cámara → servidor:
    ///  - Inicia sesión y guarda el token
    ///  - Arranca el motor de conteo local
    ///  - Reporta cruces y sube snapshots al servidor
    ///  - Refresca la línea de conteo desde el panel cada 60s
    /// </summary>
    public class BridgeService
    {
        public AppSettings Settings { get; }
        public ApiClient Api { get; }
        public PeopleCounter Counter { get; } = new();

        public LoginResult? Login { get; private set; }
        public bool IsCounting => Counter.Running;

        public event Action<string>? Status;          // mensajes de estado
        public event Action? CountsChanged;            // entradas/salidas cambiaron

        private System.Threading.Timer? _configTimer;
        private readonly object _gate = new();

        // Subida de snapshots: una sola petición en vuelo, siempre el frame más reciente.
        // Si la red no alcanza para todos los frames se descartan los viejos (no se acumula lag).
        private byte[]? _pendingSnap;
        private readonly SemaphoreSlim _snapSignal = new(0, 1);
        private CancellationTokenSource? _snapCts;

        // Línea actual (por defecto: horizontal en el centro)
        private double _x1 = 0.15, _y1 = 0.5, _x2 = 0.85, _y2 = 0.5;
        private bool _flip;

        public BridgeService(AppSettings settings)
        {
            Settings = settings;
            Api = new ApiClient(settings.ServerUrl);

            Counter.OnCross += dir =>
            {
                if (Settings.StoreId > 0) _ = Api.PostEventAsync(Settings.StoreId, dir);
                CountsChanged?.Invoke();
            };
            Counter.OnSnapshot += jpeg =>
            {
                Interlocked.Exchange(ref _pendingSnap, jpeg);
                try { if (_snapSignal.CurrentCount == 0) _snapSignal.Release(); }
                catch (SemaphoreFullException) { }
            };
            Counter.OnStatus += msg => Status?.Invoke(msg);
        }

        private void Log(string m) => Status?.Invoke(m);

        /// <summary>Inicia sesión con las credenciales guardadas. Devuelve el resultado para inyectar en la web.</summary>
        public async Task<LoginResult> LoginAsync()
        {
            Api.SetBaseUrl(Settings.ServerUrl);
            Login = await Api.LoginAsync(Settings.Email, Settings.Password);
            return Login;
        }

        /// <summary>Arranca el conteo en segundo plano (asegura FFmpeg, login, línea, procesos).</summary>
        public async Task StartCountingAsync()
        {
            if (!Settings.IsConfigured)
            {
                Log("Configuración incompleta.");
                return;
            }

            Log("Verificando FFmpeg…");
            if (!await FfmpegManager.EnsureAsync(Log))
            {
                Log("FFmpeg no disponible. No se puede contar.");
                return;
            }

            if (Login == null)
            {
                Log("Iniciando sesión…");
                try { await LoginAsync(); }
                catch (Exception e) { Log("Error de login: " + e.Message); return; }
            }

            // Guarda los datos de la cámara en el panel (informativo) y obtiene la línea
            _ = Api.SaveRtspInfoAsync(Settings.StoreId, Settings.RtspUrl, Settings.Sensitivity);
            await RefreshLineAsync();

            Log("Iniciando conteo…");
            Counter.Start(FfmpegManager.Path ?? "ffmpeg", Settings.RtspUrl, Settings.Sensitivity,
                          _x1, _y1, _x2, _y2, _flip);

            // Bucle de subida de snapshots (frame más reciente, una petición a la vez)
            _snapCts?.Cancel();
            _snapCts = new CancellationTokenSource();
            _ = Task.Run(() => SnapshotUploadLoop(_snapCts.Token));

            // Refrescar línea/config cada 60s
            _configTimer?.Dispose();
            _configTimer = new System.Threading.Timer(async _ => await RefreshLineAsync(), null,
                TimeSpan.FromSeconds(60), TimeSpan.FromSeconds(60));
        }

        public void StopCounting()
        {
            _configTimer?.Dispose();
            _configTimer = null;
            _snapCts?.Cancel();
            _snapCts = null;
            Counter.Stop();
            Log("Conteo detenido.");
        }

        private async Task SnapshotUploadLoop(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                try { await _snapSignal.WaitAsync(ct); }
                catch (OperationCanceledException) { break; }

                var jpeg = Interlocked.Exchange(ref _pendingSnap, null);
                if (jpeg == null || Settings.StoreId <= 0) continue;
                await Api.UploadSnapshotAsync(Settings.StoreId, jpeg, ct);
            }
        }

        private async Task RefreshLineAsync()
        {
            try
            {
                var cfg = await Api.GetLineConfigAsync(Settings.StoreId);
                if (cfg != null)
                {
                    _x1 = cfg.X1; _y1 = cfg.Y1; _x2 = cfg.X2; _y2 = cfg.Y2; _flip = cfg.Flip;
                    Counter.UpdateLine(_x1, _y1, _x2, _y2, _flip);
                }
            }
            catch { /* mantener línea anterior */ }
        }
    }
}
