using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace AforoBridge
{
    /// <summary>Configuración simple y amigable: 2 pasos, sin tecnicismos.</summary>
    public class ConfigForm : Form
    {
        private readonly AppSettings _s;
        private readonly ApiClient _api;

        // Paso 1 · Cuenta
        private readonly InputBox _email = new(false, "tu@email.com");
        private readonly InputBox _password = new(true, "contraseña");
        private readonly PillButton _loginBtn = new();
        private readonly Label _loginStatus = Lbl(Theme.Muted, 9.5f);
        private Label _storeCap = null!;
        private Card _storeHost = null!;
        private readonly DarkCombo _store = new();

        // Paso 2 · Cámara
        private readonly PillButton _scanBtn = new();
        private readonly Label _scanStatus = Lbl(Theme.Muted, 9.5f);
        private Label _ipCap = null!;
        private Card _ipHost = null!;
        private readonly DarkCombo _ipCombo = new(editable: true);
        private readonly InputBox _camUser = new(false, "usuario de la cámara");
        private readonly InputBox _camPass = new(true, "contraseña de la cámara");
        private readonly PillButton _testBtn = new();
        private readonly Label _testStatus = Lbl(Theme.Muted, 9.5f);

        // Encendido automático
        private readonly ToggleSwitch _autoToggle = new() { Text = "Encender solo al prender el PC", Checked = true };

        // Avanzado (oculto)
        private LinkLabel _advLink = null!;
        private FlowLayoutPanel _advPanel = null!;
        private readonly InputBox _server = new(false, "https://mantraxtools.store");
        private readonly InputBox _port = new(false, "554");
        private readonly DarkCombo _channel = new(editable: true);
        private readonly TrackBar _sens = new() { Minimum = 10, Maximum = 80, TickFrequency = 10 };
        private readonly Label _sensLbl = Lbl(Theme.Gold, 11f, FontStyle.Bold);

        private readonly PillButton _saveBtn = new();

        private List<StoreInfo> _stores = new();
        private CancellationTokenSource? _scanCts;
        private string _detectedChannel = "";
        public bool Saved { get; private set; }

        public ConfigForm(AppSettings settings, ApiClient api)
        {
            _s = settings;
            _api = api;
            BuildUi();
            LoadFromSettings();
        }

        private static Label Lbl(Color c, float size, FontStyle st = FontStyle.Regular) =>
            new() { ForeColor = c, AutoSize = false, Font = new Font("Segoe UI", size, st), BackColor = Color.Transparent };

        private const int W = 404;

        // ── Construcción de la UI ─────────────────────────────────────────────
        private void BuildUi()
        {
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Theme.Bg;
            Font = new Font("Segoe UI", 9.5f);
            ClientSize = new Size(460, 720);

            // Header arrastrable
            var header = new Panel { Dock = DockStyle.Top, Height = 50, BackColor = Color.Transparent };
            var hTitle = new Label
            {
                Text = "AforoBridge", ForeColor = Theme.Gold, BackColor = Color.Transparent,
                Font = new Font("Segoe UI", 12f, FontStyle.Bold), Left = 24, Top = 14, AutoSize = true
            };
            var closeBtn = new PillButton { Text = "✕", Width = 34, Height = 28, Top = 11, Left = ClientSize.Width - 46, Radius = 8, BackColor = Color.Transparent, HoverColor = Color.FromArgb(120, 40, 40), Anchor = AnchorStyles.Top | AnchorStyles.Right };
            closeBtn.Click += (_, __) => { DialogResult = DialogResult.Cancel; Close(); };
            header.Controls.Add(hTitle); header.Controls.Add(closeBtn);
            header.MouseDown += DragStart; hTitle.MouseDown += DragStart;
            Controls.Add(header);

            var flow = new FlowLayoutPanel
            {
                Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false,
                AutoScroll = true, BackColor = Theme.Bg, Padding = new Padding(24, 0, 8, 22)
            };
            Controls.Add(flow); flow.BringToFront();

            void Add(Control c) => flow.Controls.Add(c);
            void Title(string t) => Add(new Label { Text = t, AutoSize = true, ForeColor = Theme.Text, BackColor = Color.Transparent, Font = new Font("Segoe UI", 15f, FontStyle.Bold), Margin = new Padding(0, 4, 0, 2) });
            void Sub(string t) => Add(new Label { Text = t, AutoSize = true, ForeColor = Theme.Muted, BackColor = Color.Transparent, Font = new Font("Segoe UI", 9.5f), Margin = new Padding(0, 0, 0, 14) });
            Label Step(string t) { var l = new Label { Text = t, AutoSize = true, ForeColor = Theme.Gold, BackColor = Color.Transparent, Font = new Font("Segoe UI", 11f, FontStyle.Bold), Margin = new Padding(0, 14, 0, 8) }; Add(l); return l; }
            Label Cap(string t) { var l = new Label { Text = t, AutoSize = true, ForeColor = Theme.Muted, BackColor = Color.Transparent, Font = new Font("Segoe UI", 8.5f), Margin = new Padding(2, 0, 0, 3) }; Add(l); return l; }
            void Field(Control c, int w = W, int h = -1, int gap = 9) { c.Width = w; if (h > 0) c.Height = h; c.Margin = new Padding(0, 0, 0, gap); Add(c); }

            Card ComboHost(ComboBox combo, int w)
            {
                var card = new Card { Width = w, Height = 42, Radius = 10, BackColor = Theme.Input };
                combo.BackColor = Theme.Input; combo.ForeColor = Theme.Text; combo.FlatStyle = FlatStyle.Flat;
                card.Controls.Add(combo);
                void Place() { combo.Left = 12; combo.Width = card.Width - 24; combo.Top = Math.Max(0, (card.Height - combo.Height) / 2); }
                card.Resize += (_, __) => Place(); card.HandleCreated += (_, __) => Place(); Place();
                return card;
            }

            // ── Encabezado ──
            Title("Configura tu contador");
            Sub("Solo 2 pasos para empezar a contar el aforo.");

            // ── Paso 1 ──
            Step("Paso 1 · Inicia sesión");
            Cap("Email"); Field(_email);
            Cap("Contraseña"); Field(_password);
            _loginBtn.Text = "Entrar";
            _loginBtn.BackColor = Color.FromArgb(48, 48, 52);
            _loginBtn.Click += async (_, __) => await DoLoginAsync();
            Field(_loginBtn, W, 42, 5);
            _loginStatus.AutoSize = false; Field(_loginStatus, W, 20, 4);
            _storeCap = Cap("¿Qué local?"); _storeHost = ComboHost(_store, W); Field(_storeHost, W, 42);
            _storeCap.Visible = false; _storeHost.Visible = false;

            // ── Paso 2 ──
            Step("Paso 2 · Conecta tu cámara");
            _scanBtn.Text = "🔍  Buscar mi cámara en la red";
            _scanBtn.BackColor = Color.FromArgb(48, 48, 52);
            _scanBtn.Click += async (_, __) => await DoScanAsync();
            Field(_scanBtn, W, 44, 5);
            _scanStatus.AutoSize = false; Field(_scanStatus, W, 20, 8);
            _ipCap = Cap("Tu cámara"); _ipHost = ComboHost(_ipCombo, W); Field(_ipHost, W, 42);
            Cap("Usuario de la cámara"); Field(_camUser);
            Cap("Contraseña de la cámara"); Field(_camPass);
            _testBtn.Text = "Probar conexión";
            _testBtn.BackColor = Color.FromArgb(48, 48, 52);
            _testBtn.Click += async (_, __) => await DoTestAsync();
            Field(_testBtn, W, 42, 5);
            _testStatus.AutoSize = false; Field(_testStatus, W, 36, 10);

            // ── Encendido automático ──
            var toggleCard = new Card { Width = W, Height = 56, Radius = 12, BackColor = Theme.Card };
            _autoToggle.Left = 14; _autoToggle.Top = 11; _autoToggle.Width = W - 28;
            toggleCard.Controls.Add(_autoToggle);
            Field(toggleCard, W, 56, 10);

            // ── Avanzado (oculto) ──
            _advLink = new LinkLabel { Text = "⚙  Opciones avanzadas", AutoSize = true, LinkColor = Theme.Muted, ActiveLinkColor = Theme.Gold, BackColor = Color.Transparent, Font = new Font("Segoe UI", 9f), Margin = new Padding(2, 0, 0, 8) };
            _advLink.LinkBehavior = LinkBehavior.NeverUnderline;
            _advLink.Click += (_, __) => { _advPanel.Visible = !_advPanel.Visible; };
            Add(_advLink);

            _advPanel = new FlowLayoutPanel { FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink, Width = W, BackColor = Color.Transparent, Margin = new Padding(0, 0, 0, 8), Visible = false };
            void ACap(string t) => _advPanel.Controls.Add(new Label { Text = t, AutoSize = true, ForeColor = Theme.Muted, BackColor = Color.Transparent, Font = new Font("Segoe UI", 8.5f), Margin = new Padding(2, 4, 0, 3) });
            void AField(Control c, int w = W, int h = -1) { c.Width = w; if (h > 0) c.Height = h; c.Margin = new Padding(0, 0, 0, 8); _advPanel.Controls.Add(c); }
            ACap("Servidor"); AField(_server);
            ACap("Puerto de la cámara"); AField(_port, 120);
            ACap("Tipo de stream (si lo conoces)");
            foreach (var p in new[] { "stream1", "stream2", "h264Preview_01_main", "Streaming/Channels/101", "cam/realmonitor?channel=1&subtype=0", "live" }) _channel.Items.Add(p);
            var chHost = ComboHost(_channel, W); AField(chHost, W, 42);
            ACap("Sensibilidad");
            var sensCard = new Card { Width = W, Height = 50, Radius = 10, BackColor = Theme.Input };
            _sens.Left = 12; _sens.Top = 9; _sens.Width = W - 70; _sens.BackColor = Theme.Input;
            _sens.ValueChanged += (_, __) => _sensLbl.Text = _sens.Value.ToString();
            _sensLbl.AutoSize = false; _sensLbl.Left = W - 52; _sensLbl.Top = 14; _sensLbl.Width = 44; _sensLbl.Height = 22;
            sensCard.Controls.Add(_sens); sensCard.Controls.Add(_sensLbl);
            AField(sensCard, W, 50);
            Add(_advPanel);

            // ── Guardar ──
            _saveBtn.Text = "Guardar y empezar";
            _saveBtn.BackColor = Theme.Gold; _saveBtn.ForeColor = Color.Black;
            _saveBtn.HoverColor = Color.FromArgb(230, 195, 80);
            _saveBtn.Font = new Font("Segoe UI", 11.5f, FontStyle.Bold);
            _saveBtn.Click += (_, __) => DoSave();
            Field(_saveBtn, W, 50, 4);

            FormClosing += (_, __) => { try { _scanCts?.Cancel(); } catch { } };
            KeyPreview = true;
            KeyDown += (_, e) => { if (e.KeyCode == Keys.Escape) { DialogResult = DialogResult.Cancel; Close(); } };
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var pen = new Pen(Theme.Border);
            using var path = Theme.RoundedRect(new Rectangle(0, 0, Width - 1, Height - 1), 16);
            e.Graphics.DrawPath(pen, path);
        }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            Region = new Region(Theme.RoundedRect(new Rectangle(0, 0, Width, Height), 16));
        }

        [DllImport("user32.dll")] private static extern bool ReleaseCapture();
        [DllImport("user32.dll")] private static extern int SendMessage(IntPtr hWnd, int msg, int wParam, int lParam);
        private void DragStart(object? s, MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left) return;
            ReleaseCapture(); SendMessage(Handle, 0xA1, 0x2, 0);
        }

        // ── Carga inicial ──────────────────────────────────────────────────────
        private void LoadFromSettings()
        {
            _server.Value = _s.ServerUrl;
            _email.Value = _s.Email;
            _password.Value = _s.Password;
            _ipCombo.Text = _s.CamIp;
            _port.Value = string.IsNullOrEmpty(_s.CamPort) ? "554" : _s.CamPort;
            _channel.Text = string.IsNullOrEmpty(_s.CamChannel) ? "stream1" : _s.CamChannel;
            _detectedChannel = _s.CamChannel;
            _camUser.Value = _s.CamUser;
            _camPass.Value = _s.CamPass;
            _sens.Value = Math.Clamp(_s.Sensitivity, 10, 80);
            _sensLbl.Text = _sens.Value.ToString();
            _autoToggle.Checked = _s.AutoStartCounting || _s.RunAtStartup;

            if (_s.StoreId > 0)
            {
                _store.Items.Add($"{_s.StoreName}");
                _store.SelectedIndex = 0;
                _stores = new List<StoreInfo> { new(_s.StoreId, _s.StoreName) };
                _storeCap.Visible = true; _storeHost.Visible = true;
            }
        }

        // ── Acciones ───────────────────────────────────────────────────────────
        private async Task DoLoginAsync()
        {
            _loginBtn.Enabled = false;
            _loginStatus.ForeColor = Theme.Muted;
            _loginStatus.Text = "Conectando…";
            try
            {
                _api.SetBaseUrl(_server.Value.Trim());
                var res = await _api.LoginAsync(_email.Value.Trim(), _password.Value);
                _stores = await _api.GetStoresAsync();
                _store.Items.Clear();
                foreach (var st in _stores) _store.Items.Add(st.Name);
                if (_store.Items.Count > 0)
                {
                    int idx = _stores.FindIndex(x => x.Id == _s.StoreId);
                    _store.SelectedIndex = idx >= 0 ? idx : 0;
                }
                _storeCap.Visible = true; _storeHost.Visible = true;
                _loginStatus.ForeColor = Color.FromArgb(80, 220, 120);
                _loginStatus.Text = $"✓ ¡Hola, {res.UserName}!";
            }
            catch (Exception e)
            {
                _loginStatus.ForeColor = Color.FromArgb(240, 100, 100);
                _loginStatus.Text = "✗ " + e.Message;
            }
            finally { _loginBtn.Enabled = true; }
        }

        private async Task DoScanAsync()
        {
            _scanCts?.Cancel();
            _scanCts = new CancellationTokenSource();
            _scanBtn.Enabled = false;
            _scanStatus.ForeColor = Theme.Muted;
            int port = int.TryParse(_port.Value.Trim(), out var p) ? p : 554;
            _scanStatus.Text = "Buscando cámaras en tu red…";
            try
            {
                var found = await NetworkScanner.ScanAsync(port,
                    (done, total) => { if (done % 20 == 0 || done == total) BeginInvoke(() => _scanStatus.Text = $"Buscando… {done * 100 / total}%"); },
                    _scanCts.Token);

                string current = _ipCombo.Text;
                _ipCombo.Items.Clear();
                foreach (var ip in found) _ipCombo.Items.Add(ip);
                if (found.Count > 0)
                {
                    _ipCombo.SelectedIndex = found.Contains(current) ? found.IndexOf(current) : 0;
                    _scanStatus.ForeColor = Color.FromArgb(80, 220, 120);
                    _scanStatus.Text = found.Count == 1 ? "✓ 1 cámara encontrada" : $"✓ {found.Count} cámaras encontradas — elige la tuya";
                }
                else
                {
                    _scanStatus.ForeColor = Color.FromArgb(240, 180, 90);
                    _scanStatus.Text = "No encontré cámaras. Escribe la IP a mano arriba.";
                }
            }
            catch (Exception e)
            {
                _scanStatus.ForeColor = Color.FromArgb(240, 100, 100);
                _scanStatus.Text = "Error al buscar: " + e.Message;
            }
            finally { _scanBtn.Enabled = true; }
        }

        private async Task DoTestAsync()
        {
            if (string.IsNullOrWhiteSpace(_ipCombo.Text))
            {
                _testStatus.ForeColor = Color.FromArgb(240, 180, 90);
                _testStatus.Text = "Primero elige o escribe la IP de la cámara.";
                return;
            }
            _testBtn.Enabled = false;
            _testStatus.ForeColor = Theme.Muted;
            _testStatus.Text = "Probando… (unos segundos)";
            try
            {
                var (ok, channel, message) = await CameraTest.AutoDetectAsync(
                    _ipCombo.Text.Trim(), _port.Value, _camUser.Value.Trim(), _camPass.Value,
                    string.IsNullOrWhiteSpace(_channel.Text) ? null : _channel.Text.Trim());

                if (ok)
                {
                    _detectedChannel = channel;
                    _channel.Text = channel;
                    _testStatus.ForeColor = Color.FromArgb(80, 220, 120);
                    _testStatus.Text = message;
                }
                else
                {
                    _testStatus.ForeColor = Color.FromArgb(240, 100, 100);
                    _testStatus.Text = message;
                }
            }
            catch (Exception e)
            {
                _testStatus.ForeColor = Color.FromArgb(240, 100, 100);
                _testStatus.Text = "Error: " + e.Message;
            }
            finally { _testBtn.Enabled = true; }
        }

        private void DoSave()
        {
            if (_store.SelectedIndex < 0 || _store.SelectedIndex >= _stores.Count)
            {
                MessageBox.Show("Inicia sesión (Paso 1) y elige tu local.", "AforoBridge", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            if (string.IsNullOrWhiteSpace(_ipCombo.Text))
            {
                MessageBox.Show("Elige tu cámara en el Paso 2 (usa el botón Buscar).", "AforoBridge", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            _s.ServerUrl = string.IsNullOrWhiteSpace(_server.Value) ? "https://mantraxtools.store" : _server.Value.Trim();
            _s.Email = _email.Value.Trim();
            _s.Password = _password.Value;
            var store = _stores[_store.SelectedIndex];
            _s.StoreId = store.Id;
            _s.StoreName = store.Name;
            _s.CamIp = _ipCombo.Text.Trim();
            _s.CamPort = string.IsNullOrWhiteSpace(_port.Value) ? "554" : _port.Value.Trim();
            _s.CamUser = _camUser.Value.Trim();
            _s.CamPass = _camPass.Value;
            _s.CamChannel = !string.IsNullOrWhiteSpace(_detectedChannel) ? _detectedChannel
                            : string.IsNullOrWhiteSpace(_channel.Text) ? "stream1" : _channel.Text.Trim();
            _s.Sensitivity = _sens.Value;
            _s.AutoStartCounting = _autoToggle.Checked;
            _s.RunAtStartup = _autoToggle.Checked;
            _s.Save();

            AutoStart.Apply(_s.RunAtStartup);

            Saved = true;
            DialogResult = DialogResult.OK;
            Close();
        }
    }
}
