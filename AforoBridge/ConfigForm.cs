using System;
using System.Collections.Generic;
using System.Drawing;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace AforoBridge
{
    /// <summary>Diálogo para configurar credenciales web + datos de la cámara IP.</summary>
    public class ConfigForm : Form
    {
        private readonly AppSettings _s;
        private readonly ApiClient _api;

        private readonly TextBox _server = new();
        private readonly TextBox _email = new();
        private readonly TextBox _password = new() { UseSystemPasswordChar = true };
        private readonly Button _loginBtn = new();
        private readonly ComboBox _store = new() { DropDownStyle = ComboBoxStyle.DropDownList };
        private readonly Label _loginStatus = new();

        private readonly TextBox _camIp = new();
        private readonly TextBox _camPort = new();
        private readonly TextBox _camUser = new();
        private readonly TextBox _camPass = new() { UseSystemPasswordChar = true };
        private readonly TextBox _camChannel = new();
        private readonly TrackBar _sens = new() { Minimum = 10, Maximum = 80, TickFrequency = 10 };
        private readonly Label _sensLbl = new();
        private readonly CheckBox _autoStart = new() { Text = "Iniciar conteo automáticamente al abrir" };
        private readonly CheckBox _runStartup = new() { Text = "Arrancar junto con Windows" };
        private readonly Button _saveBtn = new();

        private List<StoreInfo> _stores = new();
        public bool Saved { get; private set; }

        public ConfigForm(AppSettings settings, ApiClient api)
        {
            _s = settings;
            _api = api;
            BuildUi();
            LoadFromSettings();
        }

        private static readonly Color Gold = Color.FromArgb(212, 175, 55);

        private void BuildUi()
        {
            Text = "AforoBridge — Configuración";
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false; MinimizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.White;
            Font = new Font("Segoe UI", 9.5f);
            ClientSize = new Size(440, 720);
            AutoScroll = true;

            int y = 16;
            void Section(string title)
            {
                var l = new Label { Text = title, Left = 18, Top = y, Width = 400, Font = new Font("Segoe UI", 11f, FontStyle.Bold), ForeColor = Color.Black };
                Controls.Add(l); y += 28;
            }
            Label Field(string label)
            {
                var l = new Label { Text = label, Left = 18, Top = y, Width = 400, ForeColor = Color.FromArgb(80, 80, 80) };
                Controls.Add(l); y += 20; return l;
            }
            void Place(Control c, int width = 404)
            {
                c.Left = 18; c.Top = y; c.Width = width; Controls.Add(c); y += c.Height + 10;
            }

            // ── Cuenta web ──
            Section("1 · Cuenta SRServi");
            Field("Servidor");
            Place(_server);
            Field("Email");
            Place(_email);
            Field("Contraseña");
            Place(_password);

            _loginBtn.Text = "Iniciar sesión y cargar tiendas";
            _loginBtn.Top = y; _loginBtn.Left = 18; _loginBtn.Width = 404; _loginBtn.Height = 34;
            _loginBtn.FlatStyle = FlatStyle.Flat; _loginBtn.BackColor = Color.Black; _loginBtn.ForeColor = Color.White;
            _loginBtn.Click += async (_, __) => await DoLoginAsync();
            Controls.Add(_loginBtn); y += 44;

            _loginStatus.Left = 18; _loginStatus.Top = y; _loginStatus.Width = 404; _loginStatus.Height = 20;
            _loginStatus.ForeColor = Color.Gray; Controls.Add(_loginStatus); y += 26;

            Field("Tienda");
            Place(_store);

            y += 6;
            // ── Cámara ──
            Section("2 · Cámara IP");
            Field("IP de la cámara");
            Place(_camIp);
            Field("Puerto (RTSP)");
            Place(_camPort, 120);
            Field("Usuario de la cámara");
            Place(_camUser);
            Field("Contraseña de la cámara");
            Place(_camPass);
            Field("Canal / Stream (ej: stream1, Streaming/Channels/101)");
            Place(_camChannel);

            Field("Sensibilidad");
            _sens.Left = 18; _sens.Top = y; _sens.Width = 340;
            _sens.ValueChanged += (_, __) => _sensLbl.Text = _sens.Value.ToString();
            Controls.Add(_sens);
            _sensLbl.Left = 366; _sensLbl.Top = y + 6; _sensLbl.Width = 50; _sensLbl.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
            Controls.Add(_sensLbl); y += 56;

            // ── Opciones ──
            _autoStart.Left = 18; _autoStart.Top = y; _autoStart.Width = 404; Controls.Add(_autoStart); y += 26;
            _runStartup.Left = 18; _runStartup.Top = y; _runStartup.Width = 404; Controls.Add(_runStartup); y += 34;

            _saveBtn.Text = "Guardar y aplicar";
            _saveBtn.Left = 18; _saveBtn.Top = y; _saveBtn.Width = 404; _saveBtn.Height = 40;
            _saveBtn.FlatStyle = FlatStyle.Flat; _saveBtn.BackColor = Gold; _saveBtn.ForeColor = Color.Black;
            _saveBtn.Font = new Font("Segoe UI", 11f, FontStyle.Bold);
            _saveBtn.Click += (_, __) => DoSave();
            Controls.Add(_saveBtn); y += 50;
        }

        private void LoadFromSettings()
        {
            _server.Text = _s.ServerUrl;
            _email.Text = _s.Email;
            _password.Text = _s.Password;
            _camIp.Text = _s.CamIp;
            _camPort.Text = _s.CamPort;
            _camUser.Text = _s.CamUser;
            _camPass.Text = _s.CamPass;
            _camChannel.Text = _s.CamChannel;
            _sens.Value = Math.Clamp(_s.Sensitivity, 10, 80);
            _sensLbl.Text = _sens.Value.ToString();
            _autoStart.Checked = _s.AutoStartCounting;
            _runStartup.Checked = _s.RunAtStartup;

            if (_s.StoreId > 0)
            {
                _store.Items.Add($"{_s.StoreName} (#{_s.StoreId})");
                _store.SelectedIndex = 0;
                _stores = new List<StoreInfo> { new(_s.StoreId, _s.StoreName) };
            }
        }

        private async Task DoLoginAsync()
        {
            _loginBtn.Enabled = false;
            _loginStatus.ForeColor = Color.Gray;
            _loginStatus.Text = "Conectando…";
            try
            {
                _api.SetBaseUrl(_server.Text.Trim());
                await _api.LoginAsync(_email.Text.Trim(), _password.Text);
                _stores = await _api.GetStoresAsync();
                _store.Items.Clear();
                foreach (var st in _stores) _store.Items.Add($"{st.Name} (#{st.Id})");
                if (_store.Items.Count > 0)
                {
                    int idx = _stores.FindIndex(x => x.Id == _s.StoreId);
                    _store.SelectedIndex = idx >= 0 ? idx : 0;
                }
                _loginStatus.ForeColor = Color.Green;
                _loginStatus.Text = $"✓ Sesión iniciada — {_stores.Count} tienda(s)";
            }
            catch (Exception e)
            {
                _loginStatus.ForeColor = Color.Red;
                _loginStatus.Text = "✗ " + e.Message;
            }
            finally { _loginBtn.Enabled = true; }
        }

        private void DoSave()
        {
            if (string.IsNullOrWhiteSpace(_camIp.Text))
            {
                MessageBox.Show("Ingresa la IP de la cámara.", "AforoBridge", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            if (_store.SelectedIndex < 0 || _store.SelectedIndex >= _stores.Count)
            {
                MessageBox.Show("Inicia sesión y selecciona una tienda.", "AforoBridge", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            _s.ServerUrl = _server.Text.Trim();
            _s.Email = _email.Text.Trim();
            _s.Password = _password.Text;
            var store = _stores[_store.SelectedIndex];
            _s.StoreId = store.Id;
            _s.StoreName = store.Name;
            _s.CamIp = _camIp.Text.Trim();
            _s.CamPort = string.IsNullOrWhiteSpace(_camPort.Text) ? "554" : _camPort.Text.Trim();
            _s.CamUser = _camUser.Text.Trim();
            _s.CamPass = _camPass.Text;
            _s.CamChannel = string.IsNullOrWhiteSpace(_camChannel.Text) ? "stream1" : _camChannel.Text.Trim();
            _s.Sensitivity = _sens.Value;
            _s.AutoStartCounting = _autoStart.Checked;
            _s.RunAtStartup = _runStartup.Checked;
            _s.Save();

            AutoStart.Apply(_s.RunAtStartup);

            Saved = true;
            DialogResult = DialogResult.OK;
            Close();
        }
    }
}
