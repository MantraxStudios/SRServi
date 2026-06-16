using System;
using System.Drawing;
using System.Windows.Forms;

namespace FullscreenBrowser
{
    public sealed class MenuForm : Form
    {
        private readonly AppConfig            _config;
        private readonly ThermalPrinter       _printer;
        private readonly PrintPollingService  _polling;
        private Label?                        _statusLabel;

        public MenuForm(AppConfig config, ThermalPrinter printer, PrintPollingService polling)
        {
            _config  = config;
            _printer = printer;
            _polling = polling;

            BuildUi();

            _printer.StatusChanged += s => SafeInvoke(() => RefreshStatus(s));
            RefreshStatus(_printer.Status);

            // Si no hay código de tienda configurado abrir configuración al inicio
            Shown += (_, _) =>
            {
                if (string.IsNullOrWhiteSpace(_config.StoreCode))
                    OpenConfig();
            };
        }

        // ── UI ───────────────────────────────────────────────────────────────────

        private void BuildUi()
        {
            Text            = "SR Automatica";
            FormBorderStyle = FormBorderStyle.None;
            WindowState     = FormWindowState.Maximized;
            TopMost         = true;
            BackColor       = Color.FromArgb(15, 15, 18);
            KeyPreview      = true;

            KeyDown += (_, e) =>
            {
                if (e.KeyCode == Keys.F12 || e.KeyCode == Keys.Escape)
                    OpenConfig();
            };

            // ── Panel central ─────────────────────────────────────────────────────
            var center = new Panel
            {
                BackColor = Color.Transparent,
                Width     = 460,
                Height    = 300,
            };

            // Logo / título
            var logo = new Label
            {
                Text      = "SR Automatica",
                Font      = new Font("Segoe UI", 38, FontStyle.Bold),
                ForeColor = Color.FromArgb(212, 175, 55),
                AutoSize  = false,
                TextAlign = ContentAlignment.MiddleCenter,
                BackColor = Color.Transparent,
                Location  = new Point(0, 0),
                Size      = new Size(460, 76),
            };
            center.Controls.Add(logo);

            // Subtítulo
            var sub = new Label
            {
                Text      = "Sistema de punto de venta",
                Font      = new Font("Segoe UI", 13),
                ForeColor = Color.FromArgb(100, 100, 115),
                AutoSize  = false,
                TextAlign = ContentAlignment.MiddleCenter,
                BackColor = Color.Transparent,
                Location  = new Point(0, 76),
                Size      = new Size(460, 28),
            };
            center.Controls.Add(sub);

            // Botón: Comenzar a vender
            var btnVender = MakeButton(
                "▶   Comenzar a vender",
                new Point(0, 124),
                new Size(460, 76),
                Color.FromArgb(212, 175, 55),
                Color.Black,
                18
            );
            btnVender.Click += (_, _) => StartSelling();
            center.Controls.Add(btnVender);

            // Botón: Configuración
            var btnConfig = MakeButton(
                "⚙   Configuración  (F12)",
                new Point(0, 212),
                new Size(460, 52),
                Color.FromArgb(28, 28, 36),
                Color.FromArgb(180, 180, 200),
                13
            );
            btnConfig.FlatAppearance.BorderSize  = 1;
            btnConfig.FlatAppearance.BorderColor = Color.FromArgb(55, 55, 70);
            btnConfig.Click += (_, _) => OpenConfig();
            center.Controls.Add(btnConfig);

            Controls.Add(center);

            // Centrar panel al redimensionar
            Resize += (_, _) => CenterPanel(center);
            Shown  += (_, _) => CenterPanel(center);

            // Barra de estado impresora (fondo)
            _statusLabel = new Label
            {
                Text      = "",
                Font      = new Font("Segoe UI", 10),
                ForeColor = Color.FromArgb(80, 80, 95),
                TextAlign = ContentAlignment.MiddleCenter,
                BackColor = Color.Transparent,
                Dock      = DockStyle.Bottom,
                Height    = 36,
            };
            Controls.Add(_statusLabel);
            _statusLabel.BringToFront();
        }

        private static Button MakeButton(string text, Point loc, Size size, Color bg, Color fg, int fontSize)
        {
            var b = new Button
            {
                Text      = text,
                Font      = new Font("Segoe UI", fontSize, FontStyle.Bold),
                BackColor = bg,
                ForeColor = fg,
                FlatStyle = FlatStyle.Flat,
                Cursor    = Cursors.Hand,
                Location  = loc,
                Size      = size,
            };
            b.FlatAppearance.BorderSize = 0;
            return b;
        }

        private void CenterPanel(Panel p)
        {
            p.Location = new Point(
                (ClientSize.Width  - p.Width)  / 2,
                (ClientSize.Height - p.Height) / 2
            );
        }

        // ── Acciones ─────────────────────────────────────────────────────────────

        private void StartSelling()
        {
            var main = new MainForm(_config, _printer, _polling);
            main.FormClosed += (_, _) =>
            {
                Show();
                RefreshStatus(_printer.Status);
            };
            Hide();
            main.Show();
        }

        private void OpenConfig()
        {
            using var cfg = new ConfigForm(_config, _printer);
            cfg.ShowDialog(this);
            // Reiniciar polling si cambió el código de tienda
            if (_config.AutoPrint)
            {
                _polling.Stop();
                _polling.Start();
            }
        }

        // ── Estado impresora ──────────────────────────────────────────────────────

        private void RefreshStatus(PrinterStatus s)
        {
            if (_statusLabel == null || IsDisposed) return;
            (_statusLabel.Text, _statusLabel.ForeColor) = s switch
            {
                PrinterStatus.Connected => ("🖨  Impresora conectada — lista para imprimir", Color.FromArgb(34, 197, 94)),
                PrinterStatus.Printing  => ("🖨  Imprimiendo...", Color.FromArgb(212, 175, 55)),
                PrinterStatus.Error     => ($"🖨  Error de impresora: {_printer.LastError}", Color.FromArgb(239, 68, 68)),
                _                       => ("🖨  Impresora no configurada  —  presiona ⚙ Configuración", Color.FromArgb(80, 80, 95)),
            };
        }

        private void SafeInvoke(Action a)
        {
            if (IsDisposed) return;
            try
            {
                if (InvokeRequired) BeginInvoke(a);
                else a();
            }
            catch { }
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            _printer.Dispose();
            _polling.Dispose();
            base.OnFormClosed(e);
        }
    }
}
