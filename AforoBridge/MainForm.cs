using System;
using System.Drawing;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace AforoBridge
{
    public class MainForm : Form
    {
        private readonly AppSettings _settings;
        private readonly BridgeService _bridge;
        private readonly bool _startInTray;

        private WebView2 _web = null!;
        private NotifyIcon _tray = null!;
        private Label _status = null!;
        private Label _counts = null!;
        private Button _startStopBtn = null!;

        private string? _authScriptId;
        private bool _webReady;
        private bool _allowClose;

        private static readonly Color Gold = Color.FromArgb(212, 175, 55);

        public MainForm(AppSettings settings, bool startInTray)
        {
            _settings = settings;
            _startInTray = startInTray;
            _bridge = new BridgeService(settings);
            _bridge.Status += msg => SafeStatus(msg);
            _bridge.CountsChanged += () => SafeCounts();

            BuildUi();
            BuildTray();
        }

        private string PanelUrl => _settings.ServerUrl.TrimEnd('/') + "/admin/people-counter";

        // ── UI ─────────────────────────────────────────────────────────────────
        private void BuildUi()
        {
            Text = "AforoBridge — Contador de Aforo";
            Width = 1100; Height = 740;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.Black;
            try { Icon = SystemIcons.Application; } catch { }

            var bar = new Panel { Dock = DockStyle.Top, Height = 52, BackColor = Color.Black };
            Controls.Add(bar);

            var title = new Label
            {
                Text = "AforoBridge", ForeColor = Gold, Font = new Font("Segoe UI", 13f, FontStyle.Bold),
                Left = 16, Top = 12, Width = 140, Height = 28
            };
            bar.Controls.Add(title);

            _status = new Label
            {
                Text = "Iniciando…", ForeColor = Color.White, Left = 160, Top = 17, Width = 360, Height = 20,
                Font = new Font("Segoe UI", 9.5f)
            };
            bar.Controls.Add(_status);

            _counts = new Label
            {
                Text = "↑ 0   ↓ 0", ForeColor = Gold, Left = 520, Top = 14, Width = 160, Height = 24,
                Font = new Font("Segoe UI", 11f, FontStyle.Bold)
            };
            bar.Controls.Add(_counts);

            _startStopBtn = MakeBtn("Detener", 700);
            _startStopBtn.Click += async (_, __) => await ToggleCountingAsync();
            bar.Controls.Add(_startStopBtn);

            var cfgBtn = MakeBtn("Configuración", 812);
            cfgBtn.Click += (_, __) => OpenConfig();
            bar.Controls.Add(cfgBtn);

            var reloadBtn = MakeBtn("Recargar", 924);
            reloadBtn.Click += (_, __) => _web?.Reload();
            bar.Controls.Add(reloadBtn);

            _web = new WebView2 { Dock = DockStyle.Fill };
            Controls.Add(_web);
            _web.BringToFront();

            Load += async (_, __) => await OnLoadedAsync();
            Resize += (_, __) => { if (WindowState == FormWindowState.Minimized) HideToTray(); };
            FormClosing += OnClosing;
        }

        private Button MakeBtn(string text, int left)
        {
            return new Button
            {
                Text = text, Left = left, Top = 11, Width = 104, Height = 30,
                FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(30, 30, 30), ForeColor = Color.White,
                Font = new Font("Segoe UI", 9f)
            };
        }

        private void BuildTray()
        {
            var menu = new ContextMenuStrip();
            menu.Items.Add("Abrir panel", null, (_, __) => ShowFromTray());
            menu.Items.Add("Iniciar/Detener conteo", null, async (_, __) => await ToggleCountingAsync());
            menu.Items.Add("Configuración", null, (_, __) => { ShowFromTray(); OpenConfig(); });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Salir", null, (_, __) => { _allowClose = true; Close(); });

            _tray = new NotifyIcon
            {
                Icon = SystemIcons.Application,
                Visible = true,
                Text = "AforoBridge",
                ContextMenuStrip = menu
            };
            _tray.DoubleClick += (_, __) => ShowFromTray();
        }

        // ── Ciclo de vida ────────────────────────────────────────────────────────
        private async Task OnLoadedAsync()
        {
            // 1) Login para obtener el token (si hay credenciales)
            if (_settings.IsConfigured)
            {
                try
                {
                    SafeStatus("Iniciando sesión…");
                    await _bridge.LoginAsync();
                }
                catch (Exception e) { SafeStatus("Login falló: " + e.Message); }
            }

            // 2) Inicializar WebView e inyectar auto-login
            try
            {
                var env = await CoreWebView2Environment.CreateAsync(null,
                    System.IO.Path.Combine(AppSettings.Dir, "WebView2"));
                await _web.EnsureCoreWebView2Async(env);
                _web.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                _web.CoreWebView2.Settings.IsStatusBarEnabled = false;
                _webReady = true;
                await ApplyAuthAndNavigateAsync();
            }
            catch (Exception e)
            {
                SafeStatus("WebView2 no disponible: " + e.Message);
            }

            // 3) Arrancar el conteo en segundo plano
            if (_settings.IsConfigured && _settings.AutoStartCounting)
                await _bridge.StartCountingAsync();
            else if (!_settings.IsConfigured)
                OpenConfig();

            UpdateStartStopBtn();
            SafeCounts();

            // 4) Si arrancó en bandeja (inicio de Windows), esconder ventana
            if (_startInTray) HideToTray();
        }

        /// <summary>Inyecta token+usuario en localStorage del WebView y navega al panel (auto-logueado).</summary>
        private async Task ApplyAuthAndNavigateAsync()
        {
            if (!_webReady) return;
            var login = _bridge.Login;
            if (login != null)
            {
                // Nota: el script se ejecuta en cada documento creado. Si el token
                // cambia, el último añadido corre al final y prevalece.
                string tokenLit = JsonSerializer.Serialize(login.Token);
                string userLit = JsonSerializer.Serialize(login.UserJson);
                string script =
                    "try{" +
                    $"localStorage.setItem('token',{tokenLit});" +
                    $"localStorage.setItem('user',{userLit});" +
                    "}catch(e){}";
                _authScriptId = await _web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(script);
            }
            _web.CoreWebView2.Navigate(PanelUrl);
        }

        private async Task ToggleCountingAsync()
        {
            if (_bridge.IsCounting) _bridge.StopCounting();
            else await _bridge.StartCountingAsync();
            UpdateStartStopBtn();
        }

        private void OpenConfig()
        {
            using var dlg = new ConfigForm(_settings, _bridge.Api);
            if (dlg.ShowDialog(this) == DialogResult.OK && dlg.Saved)
            {
                // Reaplicar todo con la nueva configuración
                _ = ReapplyAsync();
            }
        }

        private async Task ReapplyAsync()
        {
            _bridge.StopCounting();
            try { await _bridge.LoginAsync(); SafeStatus("Sesión actualizada."); }
            catch (Exception e) { SafeStatus("Login falló: " + e.Message); }
            await ApplyAuthAndNavigateAsync();
            if (_settings.AutoStartCounting) await _bridge.StartCountingAsync();
            UpdateStartStopBtn();
        }

        // ── Bandeja ────────────────────────────────────────────────────────────
        private void HideToTray()
        {
            Hide();
            ShowInTaskbar = false;
            _tray.BalloonTipTitle = "AforoBridge";
            _tray.BalloonTipText = "Sigue contando en segundo plano.";
            _tray.ShowBalloonTip(2000);
        }

        private void ShowFromTray()
        {
            Show();
            ShowInTaskbar = true;
            WindowState = FormWindowState.Normal;
            Activate();
        }

        private void OnClosing(object? sender, FormClosingEventArgs e)
        {
            if (_allowClose) { _bridge.StopCounting(); _tray.Visible = false; return; }
            // Cerrar = esconder en bandeja (sigue contando)
            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                HideToTray();
            }
        }

        // ── Helpers de UI thread-safe ─────────────────────────────────────────────
        private void SafeStatus(string msg)
        {
            if (IsDisposed) return;
            if (InvokeRequired) { BeginInvoke(() => SafeStatus(msg)); return; }
            _status.Text = msg;
            _tray.Text = ("AforoBridge — " + msg).Length > 63
                ? "AforoBridge"
                : "AforoBridge — " + msg;
        }

        private void SafeCounts()
        {
            if (IsDisposed) return;
            if (InvokeRequired) { BeginInvoke(SafeCounts); return; }
            _counts.Text = $"↑ {_bridge.Counter.CountIn}   ↓ {_bridge.Counter.CountOut}";
        }

        private void UpdateStartStopBtn()
        {
            if (IsDisposed) return;
            if (InvokeRequired) { BeginInvoke(UpdateStartStopBtn); return; }
            _startStopBtn.Text = _bridge.IsCounting ? "Detener" : "Iniciar";
            _startStopBtn.BackColor = _bridge.IsCounting ? Color.FromArgb(120, 30, 30) : Color.FromArgb(30, 90, 40);
        }
    }
}
