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
                if (Settings.StoreId > 0) _ = Api.UploadSnapshotAsync(Settings.StoreId, jpeg);
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

            // Refrescar línea/config cada 60s
            _configTimer?.Dispose();
            _configTimer = new System.Threading.Timer(async _ => await RefreshLineAsync(), null,
                TimeSpan.FromSeconds(60), TimeSpan.FromSeconds(60));
        }

        public void StopCounting()
        {
            _configTimer?.Dispose();
            _configTimer = null;
            Counter.Stop();
            Log("Conteo detenido.");
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
