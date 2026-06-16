using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO.Ports;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace FullscreenBrowser
{
    public enum PrinterStatus { Disconnected, Connected, Printing, Error }

    // ── Impresora térmica ESC/POS ────────────────────────────────────────────────
    // Funciona con cualquier impresora que aparezca como puerto COM en Windows:
    //   • USB-Serial (adaptador o driver USB genérico)
    //   • Bluetooth emparejado (Windows crea COM automáticamente al emparejar)
    // También soporta impresoras instaladas con driver de Windows vía raw print.

    public sealed class ThermalPrinter : IDisposable
    {
        private SerialPort? _port;
        private bool        _windowsMode;
        private string      _windowsPrinterName = "";
        private int         _paperWidth = 32;
        private int         _draining;

        private readonly ConcurrentQueue<byte[]> _queue = new();

        public PrinterStatus Status    { get; private set; } = PrinterStatus.Disconnected;
        public string        LastError { get; private set; } = "";

        public event Action<PrinterStatus>? StatusChanged;

        // ── Conexión COM ────────────────────────────────────────────────────────

        public bool ConnectCom(string portName, int baudRate = 9600)
        {
            Disconnect();
            try
            {
                _port = new SerialPort(portName, baudRate, Parity.None, 8, StopBits.One)
                {
                    WriteTimeout = 5000,
                    ReadTimeout  = 500,
                };
                _port.Open();
                _windowsMode = false;
                SetStatus(PrinterStatus.Connected);
                return true;
            }
            catch (Exception ex)
            {
                LastError = ex.Message;
                _port?.Dispose();
                _port = null;
                SetStatus(PrinterStatus.Error);
                return false;
            }
        }

        // ── Conexión via driver de Windows ──────────────────────────────────────

        public bool ConnectWindowsPrinter(string printerName)
        {
            Disconnect();
            _windowsPrinterName = printerName;
            _windowsMode = true;
            SetStatus(PrinterStatus.Connected);
            return true;
        }

        public void Disconnect()
        {
            try { _port?.Close(); _port?.Dispose(); } catch { }
            _port        = null;
            _windowsMode = false;
            if (Status != PrinterStatus.Disconnected)
                SetStatus(PrinterStatus.Disconnected);
        }

        public bool IsConnected => (_port?.IsOpen == true) || _windowsMode;

        public void SetPaperWidth(int chars) => _paperWidth = chars;

        // ── Cola de impresión ───────────────────────────────────────────────────

        public void Enqueue(byte[] data)
        {
            _queue.Enqueue(data);
            StartDrain();
        }

        private void StartDrain()
        {
            if (Interlocked.Exchange(ref _draining, 1) == 1) return;
            ThreadPool.QueueUserWorkItem(_ =>
            {
                try
                {
                    while (_queue.TryDequeue(out var job))
                    {
                        SetStatus(PrinterStatus.Printing);
                        try
                        {
                            if (_windowsMode)
                                RawPrintWindows(_windowsPrinterName, job);
                            else if (_port?.IsOpen == true)
                                _port.Write(job, 0, job.Length);

                            Thread.Sleep(150); // pausa entre trabajos
                        }
                        catch (Exception ex)
                        {
                            LastError = ex.Message;
                            SetStatus(PrinterStatus.Error);
                        }
                    }
                }
                finally
                {
                    Interlocked.Exchange(ref _draining, 0);
                    if (IsConnected && Status == PrinterStatus.Printing)
                        SetStatus(PrinterStatus.Connected);
                }
            });
        }

        // ── Páginas de impresión ────────────────────────────────────────────────

        public void PrintTestPage()
        {
            var r = new ReceiptBuilder(_paperWidth);
            r.Initialize()
             .SetDoubleSize(true).AlignCenter().AddText("SR AUTOMATICA\n").SetDoubleSize(false)
             .AddSeparator()
             .AlignLeft()
             .AddText("Prueba de impresion\n")
             .AddText($"Fecha: {DateTime.Now:dd/MM/yyyy HH:mm:ss}\n")
             .AddText($"Ancho papel: {_paperWidth} caracteres\n")
             .AddSeparator()
             .AlignCenter().AddText("Impresora lista!\n")
             .AddNewLines(4).Cut();
            Enqueue(r.Build());
        }

        public void PrintOrder(OrderData order)
        {
            var r = new ReceiptBuilder(_paperWidth);
            r.Initialize()
             .SetDoubleSize(true).AlignCenter().AddText("SRServi\n").SetDoubleSize(false)
             .AddSeparator()
             .AlignLeft()
             .SetBold(true).AddText($"Pedido #{order.OrderNumber}\n").SetBold(false)
             .AddText($"{DateTime.Now:dd/MM/yyyy HH:mm}\n")
             .AddSeparator();

            foreach (var item in order.Items)
            {
                int maxName = Math.Max(4, _paperWidth - 10);
                string name = item.Name.Length > maxName ? item.Name[..maxName] : item.Name;
                r.AddLeftRight($"{item.Quantity}x {name}", $"${item.Price:F0}");
                foreach (var mod in item.Modifiers)
                    r.AddText($"  + {mod}\n");
            }

            r.AddSeparator()
             .SetBold(true).AddLeftRight("TOTAL", $"${order.Total:F0}").SetBold(false)
             .AddText($"Pago: {order.PaymentMethod}\n");

            if (!string.IsNullOrEmpty(order.ServiceType))
                r.AddText(order.ServiceType == "llevar" ? "PARA LLEVAR\n" : "PARA SERVIR\n");

            if (order.TableNumber.HasValue)
                r.AddText($"Mesa: {order.TableNumber}\n");

            r.AddNewLines(4).Cut();
            Enqueue(r.Build());
        }

        private void SetStatus(PrinterStatus s)
        {
            Status = s;
            StatusChanged?.Invoke(s);
        }

        public void Dispose() => Disconnect();

        // ── Raw print via winspool.Drv (para impresoras Windows) ────────────────

        private static void RawPrintWindows(string printerName, byte[] data)
        {
            IntPtr hPrinter = IntPtr.Zero;
            var doc = new DOCINFOA { pDocName = "ESC/POS Receipt", pDataType = "RAW" };

            if (!OpenPrinter(printerName, ref hPrinter, IntPtr.Zero))
                throw new InvalidOperationException("No se pudo abrir la impresora");
            try
            {
                StartDocPrinter(hPrinter, 1, ref doc);
                try
                {
                    StartPagePrinter(hPrinter);
                    try { WritePrinter(hPrinter, data, data.Length, out _); }
                    finally { EndPagePrinter(hPrinter); }
                }
                finally { EndDocPrinter(hPrinter); }
            }
            finally { ClosePrinter(hPrinter); }
        }

        [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", CharSet = CharSet.Ansi, SetLastError = true)]
        private static extern bool OpenPrinter(string pPrinterName, ref IntPtr hPrinter, IntPtr pDefault);

        [DllImport("winspool.Drv", SetLastError = true)]
        private static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true)]
        private static extern int StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFOA pDocInfo);

        [DllImport("winspool.Drv", SetLastError = true)]
        private static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", SetLastError = true)]
        private static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", SetLastError = true)]
        private static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", SetLastError = true)]
        private static extern bool WritePrinter(IntPtr hPrinter, byte[] pBuf, int cbBuf, out int pcWritten);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
        private struct DOCINFOA
        {
            [MarshalAs(UnmanagedType.LPStr)] public string  pDocName;
            [MarshalAs(UnmanagedType.LPStr)] public string? pOutputFile;
            [MarshalAs(UnmanagedType.LPStr)] public string  pDataType;
        }
    }

    // ── Comandos ESC/POS ────────────────────────────────────────────────────────

    internal sealed class ReceiptBuilder
    {
        private readonly List<byte> _buf = new();
        private readonly int _w;

        public ReceiptBuilder(int paperWidth) => _w = paperWidth;

        public ReceiptBuilder Initialize()           { Cmd(0x1B, 0x40); return this; }
        public ReceiptBuilder AlignLeft()            { Cmd(0x1B, 0x61, 0x00); return this; }
        public ReceiptBuilder AlignCenter()          { Cmd(0x1B, 0x61, 0x01); return this; }
        public ReceiptBuilder AlignRight()           { Cmd(0x1B, 0x61, 0x02); return this; }
        public ReceiptBuilder SetBold(bool on)       { Cmd(0x1B, 0x45, (byte)(on ? 1 : 0)); return this; }
        public ReceiptBuilder SetDoubleSize(bool on) { Cmd(0x1D, 0x21, (byte)(on ? 0x11 : 0x00)); return this; }
        public ReceiptBuilder AddText(string t)      { _buf.AddRange(Encoding.UTF8.GetBytes(t)); return this; }
        public ReceiptBuilder AddNewLine()           { _buf.Add(0x0A); return this; }
        public ReceiptBuilder Cut()                  { Cmd(0x1D, 0x56, 0x00); return this; }

        public ReceiptBuilder AddNewLines(int n)
        {
            for (int i = 0; i < n; i++) _buf.Add(0x0A);
            return this;
        }

        public ReceiptBuilder AddSeparator()
        {
            _buf.AddRange(Encoding.UTF8.GetBytes(new string('-', _w) + "\n"));
            return this;
        }

        public ReceiptBuilder AddLeftRight(string left, string right)
        {
            int spaces = Math.Max(1, _w - left.Length - right.Length);
            _buf.AddRange(Encoding.UTF8.GetBytes(left + new string(' ', spaces) + right + "\n"));
            return this;
        }

        public byte[] Build() => _buf.ToArray();

        private void Cmd(params byte[] bytes) => _buf.AddRange(bytes);
    }

    // ── Modelos de pedidos ──────────────────────────────────────────────────────

    public sealed class OrderData
    {
        public string            OrderNumber   { get; set; } = "";
        public double            Total         { get; set; }
        public string            PaymentMethod { get; set; } = "";
        public string?           ServiceType   { get; set; }
        public int?              TableNumber   { get; set; }
        public List<OrderItemData> Items       { get; set; } = new();
    }

    public sealed class OrderItemData
    {
        public int          Quantity  { get; set; } = 1;
        public string       Name      { get; set; } = "";
        public double       Price     { get; set; }
        public List<string> Modifiers { get; set; } = new();
    }
}
