using System;
using System.Drawing;
using System.Drawing.Printing;
using System.IO.Ports;
using System.Windows.Forms;

namespace FullscreenBrowser
{
    public sealed class ConfigForm : Form
    {
        private readonly AppConfig      _config;
        private readonly ThermalPrinter _printer;

        // Controles
        private TextBox  _txtStoreCode  = null!;
        private TextBox  _txtUrl        = null!;
        private ComboBox _cboType       = null!;
        private ComboBox _cboCom        = null!;
        private ComboBox _cboBaud       = null!;
        private ComboBox _cboPaper      = null!;
        private ComboBox _cboPrinterWin = null!;
        private CheckBox _chkAuto       = null!;
        private Label    _lblStatus     = null!;
        private Panel    _panelCom      = null!;
        private Panel    _panelWin      = null!;

        // Anchos de papel: [índice] → chars por línea
        private static readonly int[] PaperWidths = { 32, 48, 26, 64 };

        public ConfigForm(AppConfig config, ThermalPrinter printer)
        {
            _config  = config;
            _printer = printer;
            BuildUi();
            LoadValues();
            _printer.StatusChanged += s => SafeInvoke(() => RefreshStatus(s));
            RefreshStatus(_printer.Status);
        }

        // ── Construcción del UI ──────────────────────────────────────────────────

        private void BuildUi()
        {
            Text            = "Configuración — SR Automatica";
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox     = false;
            MinimizeBox     = false;
            StartPosition   = FormStartPosition.CenterScreen;
            ClientSize      = new Size(500, 670);
            BackColor       = Color.FromArgb(18, 18, 24);
            ForeColor       = Color.FromArgb(220, 220, 230);

            // Scroll container para que quepa en pantallas pequeñas
            var scroll = new Panel { Dock = DockStyle.Fill, AutoScroll = true };
            Controls.Add(scroll);

            int y    = 18;
            int xL   = 20;
            int wide = 460;

            // ── Título ───────────────────────────────────────────────────────────
            scroll.Controls.Add(Lbl("Configuración", 20, FontStyle.Bold,
                xL, y, wide, 38, Color.FromArgb(212, 175, 55)));
            y += 44;

            // ── TIENDA ───────────────────────────────────────────────────────────
            scroll.Controls.Add(SectionBar("TIENDA", xL, y, wide));
            y += 30;

            scroll.Controls.Add(Lbl("Código de tienda:", 11, FontStyle.Regular, xL, y, wide, 18));
            y += 20;
            _txtStoreCode = Txt(xL, y, wide);
            scroll.Controls.Add(_txtStoreCode);
            y += 32;

            scroll.Controls.Add(Lbl("URL del sistema:", 11, FontStyle.Regular, xL, y, wide, 18));
            y += 20;
            _txtUrl = Txt(xL, y, wide);
            scroll.Controls.Add(_txtUrl);
            y += 42;

            // ── IMPRESORA ────────────────────────────────────────────────────────
            scroll.Controls.Add(SectionBar("IMPRESORA", xL, y, wide));
            y += 30;

            scroll.Controls.Add(Lbl("Tipo de conexión:", 11, FontStyle.Regular, xL, y, wide, 18));
            y += 20;
            _cboType = Cbo(xL, y, 260);
            _cboType.Items.AddRange(["Puerto COM  (USB o Bluetooth emparejado)", "Impresora de Windows  (driver instalado)"]);
            _cboType.SelectedIndexChanged += (_, _) => UpdateTypePanel();
            scroll.Controls.Add(_cboType);
            y += 38;

            // Panel COM ─────────────────────────────────────────────────────────
            _panelCom = new Panel { Location = new Point(xL, y), Size = new Size(wide, 120), BackColor = Color.Transparent };
            scroll.Controls.Add(_panelCom);

            _panelCom.Controls.Add(Lbl("Puerto COM:", 11, FontStyle.Regular, 0, 0, 120, 18));
            _cboCom = Cbo(0, 18, 170);
            _panelCom.Controls.Add(_cboCom);

            var btnRefresh = BtnSmall("⟳ Actualizar", new Point(178, 17));
            btnRefresh.Click += (_, _) => RefreshPorts();
            _panelCom.Controls.Add(btnRefresh);

            _panelCom.Controls.Add(Lbl("Velocidad (baud rate):", 11, FontStyle.Regular, 0, 52, 200, 18));
            _cboBaud = Cbo(0, 70, 130);
            _cboBaud.Items.AddRange(["9600", "19200", "38400", "57600", "115200"]);
            _panelCom.Controls.Add(_cboBaud);

            _panelCom.Controls.Add(Lbl(
                "Bluetooth: empareja la impresora en Configuración Windows → Bluetooth,\n" +
                "luego aparece como puerto COM en la lista.",
                9, FontStyle.Regular, 0, 100, wide, 36, Color.FromArgb(100, 100, 120)));

            _panelCom.Height = 138;

            // Panel Windows Printer ─────────────────────────────────────────────
            _panelWin = new Panel { Location = new Point(xL, y), Size = new Size(wide, 50), BackColor = Color.Transparent };
            scroll.Controls.Add(_panelWin);

            _panelWin.Controls.Add(Lbl("Impresora instalada:", 11, FontStyle.Regular, 0, 0, 200, 18));
            _cboPrinterWin = Cbo(0, 18, wide);
            foreach (string p in PrinterSettings.InstalledPrinters)
                _cboPrinterWin.Items.Add(p);
            _panelWin.Controls.Add(_cboPrinterWin);

            y += 148; // altura máxima del panel COM (el más alto)

            // Ancho de papel
            scroll.Controls.Add(Lbl("Ancho de papel:", 11, FontStyle.Regular, xL, y, wide, 18));
            y += 20;
            _cboPaper = Cbo(xL, y, 280);
            _cboPaper.Items.AddRange([
                "58mm — 32 caracteres  (más común)",
                "80mm — 48 caracteres",
                "48mm — 26 caracteres",
                "110mm — 64 caracteres",
            ]);
            scroll.Controls.Add(_cboPaper);
            y += 42;

            // Botones conectar / prueba
            var btnConect = BtnPrimary("Conectar impresora", new Point(xL, y), new Size(180, 38),
                Color.FromArgb(34, 197, 94), Color.Black);
            btnConect.Click += (_, _) => Connect();
            scroll.Controls.Add(btnConect);

            var btnTest = BtnPrimary("Prueba de impresión", new Point(xL + 190, y), new Size(200, 38),
                Color.FromArgb(212, 175, 55), Color.Black);
            btnTest.Click += (_, _) =>
            {
                if (_printer.IsConnected) _printer.PrintTestPage();
                else MessageBox.Show("Primero conecta la impresora.", "Aviso", MessageBoxButtons.OK, MessageBoxIcon.Information);
            };
            scroll.Controls.Add(btnTest);
            y += 48;

            // Estado impresora
            _lblStatus = new Label
            {
                Text      = "",
                Font      = new Font("Segoe UI", 10),
                ForeColor = Color.FromArgb(80, 80, 95),
                Location  = new Point(xL, y),
                Size      = new Size(wide, 22),
            };
            scroll.Controls.Add(_lblStatus);
            y += 32;

            // ── AUTO-IMPRIMIR ────────────────────────────────────────────────────
            scroll.Controls.Add(SectionBar("COMPORTAMIENTO", xL, y, wide));
            y += 30;

            _chkAuto = new CheckBox
            {
                Text      = "Imprimir automáticamente los pedidos nuevos cada 3 segundos",
                Font      = new Font("Segoe UI", 11),
                ForeColor = Color.FromArgb(200, 200, 215),
                Location  = new Point(xL, y),
                Size      = new Size(wide, 26),
                BackColor = Color.Transparent,
            };
            scroll.Controls.Add(_chkAuto);
            y += 40;

            // ── GUARDAR ──────────────────────────────────────────────────────────
            var btnSave = BtnPrimary("Guardar y cerrar", new Point(xL, y), new Size(wide, 46),
                Color.FromArgb(212, 175, 55), Color.Black, 14);
            btnSave.Click += (_, _) => SaveAndClose();
            scroll.Controls.Add(btnSave);
            y += 56;

            scroll.AutoScrollMinSize = new Size(0, y);

            RefreshPorts();
        }

        // ── Helpers de controles ─────────────────────────────────────────────────

        private static Label Lbl(string text, float size, FontStyle style,
            int x, int y, int w, int h,
            Color? color = null)
        {
            return new Label
            {
                Text      = text,
                Font      = new Font("Segoe UI", size, style),
                ForeColor = color ?? Color.FromArgb(200, 200, 215),
                Location  = new Point(x, y),
                Size      = new Size(w, h),
                BackColor = Color.Transparent,
            };
        }

        private static Label SectionBar(string text, int x, int y, int w)
        {
            return new Label
            {
                Text      = text,
                Font      = new Font("Segoe UI", 9, FontStyle.Bold),
                ForeColor = Color.FromArgb(120, 120, 140),
                Location  = new Point(x, y),
                Size      = new Size(w, 24),
                BackColor = Color.FromArgb(26, 26, 34),
                TextAlign = ContentAlignment.MiddleLeft,
                Padding   = new Padding(4, 0, 0, 0),
            };
        }

        private static TextBox Txt(int x, int y, int w)
        {
            return new TextBox
            {
                Location  = new Point(x, y),
                Size      = new Size(w, 26),
                BackColor = Color.FromArgb(28, 28, 38),
                ForeColor = Color.FromArgb(220, 220, 230),
                BorderStyle = BorderStyle.FixedSingle,
                Font      = new Font("Segoe UI", 11),
            };
        }

        private static ComboBox Cbo(int x, int y, int w)
        {
            return new ComboBox
            {
                Location       = new Point(x, y),
                Size           = new Size(w, 26),
                DropDownStyle  = ComboBoxStyle.DropDownList,
                BackColor      = Color.FromArgb(28, 28, 38),
                ForeColor      = Color.FromArgb(220, 220, 230),
                FlatStyle      = FlatStyle.Flat,
                Font           = new Font("Segoe UI", 10),
            };
        }

        private static Button BtnSmall(string text, Point loc)
        {
            var b = new Button
            {
                Text      = text,
                Location  = loc,
                Size      = new Size(105, 28),
                BackColor = Color.FromArgb(38, 38, 52),
                ForeColor = Color.FromArgb(200, 200, 215),
                FlatStyle = FlatStyle.Flat,
                Font      = new Font("Segoe UI", 9),
                Cursor    = Cursors.Hand,
            };
            b.FlatAppearance.BorderSize  = 1;
            b.FlatAppearance.BorderColor = Color.FromArgb(55, 55, 75);
            return b;
        }

        private static Button BtnPrimary(string text, Point loc, Size size, Color bg, Color fg, float fs = 11)
        {
            var b = new Button
            {
                Text      = text,
                Location  = loc,
                Size      = size,
                BackColor = bg,
                ForeColor = fg,
                FlatStyle = FlatStyle.Flat,
                Font      = new Font("Segoe UI", fs, FontStyle.Bold),
                Cursor    = Cursors.Hand,
            };
            b.FlatAppearance.BorderSize = 0;
            return b;
        }

        // ── Lógica ──────────────────────────────────────────────────────────────

        private void LoadValues()
        {
            _txtStoreCode.Text = _config.StoreCode;
            _txtUrl.Text       = _config.Url;
            _cboType.SelectedIndex = _config.PrinterType == "windows" ? 1 : 0;

            // Baud rate
            _cboBaud.SelectedItem = _config.BaudRate.ToString();
            if (_cboBaud.SelectedIndex < 0) _cboBaud.SelectedIndex = 0;

            // Ancho papel
            _cboPaper.SelectedIndex = _config.PaperWidth switch
            {
                48 => 1, 26 => 2, 64 => 3, _ => 0,
            };

            // Puerto COM
            if (!string.IsNullOrEmpty(_config.PrinterPort))
            {
                int idx = _cboCom.Items.IndexOf(_config.PrinterPort);
                if (idx >= 0) _cboCom.SelectedIndex = idx;
            }

            // Impresora Windows
            if (!string.IsNullOrEmpty(_config.PrinterName))
            {
                int idx = _cboPrinterWin.Items.IndexOf(_config.PrinterName);
                if (idx >= 0) _cboPrinterWin.SelectedIndex = idx;
            }

            _chkAuto.Checked = _config.AutoPrint;
            UpdateTypePanel();
        }

        private void RefreshPorts()
        {
            string? prev = _cboCom.SelectedItem?.ToString();
            _cboCom.Items.Clear();
            foreach (var p in SerialPort.GetPortNames())
                _cboCom.Items.Add(p);
            if (prev != null)
            {
                int idx = _cboCom.Items.IndexOf(prev);
                _cboCom.SelectedIndex = idx >= 0 ? idx : (_cboCom.Items.Count > 0 ? 0 : -1);
            }
            else if (_cboCom.Items.Count > 0)
                _cboCom.SelectedIndex = 0;
        }

        private void UpdateTypePanel()
        {
            bool isCom = _cboType.SelectedIndex != 1;
            _panelCom.Visible = isCom;
            _panelWin.Visible = !isCom;
        }

        private void Connect()
        {
            if (_cboType.SelectedIndex == 1)
            {
                // Windows printer
                string? name = _cboPrinterWin.SelectedItem?.ToString();
                if (string.IsNullOrEmpty(name))
                {
                    MessageBox.Show("Selecciona una impresora de Windows.", "Aviso",
                        MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }
                _printer.ConnectWindowsPrinter(name);
            }
            else
            {
                // COM port
                string? port = _cboCom.SelectedItem?.ToString();
                if (string.IsNullOrEmpty(port))
                {
                    MessageBox.Show(
                        "No se encontró ningún puerto COM.\n\n" +
                        "• USB: conecta la impresora y espera que Windows instale el driver.\n" +
                        "• Bluetooth: empareja la impresora en Configuración → Bluetooth y dispositivos.\n" +
                        "  Luego haz clic en Actualizar.",
                        "Sin puertos COM",
                        MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }
                int baud = int.TryParse(_cboBaud.SelectedItem?.ToString(), out int b) ? b : 9600;
                _printer.SetPaperWidth(PaperWidths[Math.Max(0, _cboPaper.SelectedIndex)]);
                bool ok = _printer.ConnectCom(port, baud);
                if (!ok)
                    MessageBox.Show($"No se pudo conectar a {port}:\n{_printer.LastError}",
                        "Error de conexión", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void SaveAndClose()
        {
            _config.StoreCode   = _txtStoreCode.Text.Trim();
            _config.Url         = string.IsNullOrWhiteSpace(_txtUrl.Text)
                                    ? "https://srservi3.srautomatic.com/"
                                    : _txtUrl.Text.Trim();
            _config.AutoPrint   = _chkAuto.Checked;
            _config.PaperWidth  = PaperWidths[Math.Max(0, _cboPaper.SelectedIndex)];

            if (_cboType.SelectedIndex == 1)
            {
                _config.PrinterType = "windows";
                _config.PrinterName = _cboPrinterWin.SelectedItem?.ToString() ?? "";
            }
            else
            {
                _config.PrinterType = "com";
                _config.PrinterPort = _cboCom.SelectedItem?.ToString() ?? "";
                _config.BaudRate    = int.TryParse(_cboBaud.SelectedItem?.ToString(), out int b) ? b : 9600;
            }

            _config.Save();
            _printer.SetPaperWidth(_config.PaperWidth);
            Close();
        }

        private void RefreshStatus(PrinterStatus s)
        {
            if (_lblStatus == null || IsDisposed) return;
            (_lblStatus.Text, _lblStatus.ForeColor) = s switch
            {
                PrinterStatus.Connected => ("● Impresora conectada", Color.FromArgb(34, 197, 94)),
                PrinterStatus.Printing  => ("● Imprimiendo...",       Color.FromArgb(212, 175, 55)),
                PrinterStatus.Error     => ($"● Error: {_printer.LastError}", Color.FromArgb(239, 68, 68)),
                _                       => ("● Desconectada",         Color.FromArgb(80, 80, 95)),
            };
        }

        private void SafeInvoke(Action a)
        {
            if (IsDisposed) return;
            try { if (InvokeRequired) BeginInvoke(a); else a(); }
            catch { }
        }
    }
}
