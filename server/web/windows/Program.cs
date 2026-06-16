using System.Windows.Forms;
using Microsoft.Win32;

namespace FullscreenBrowser
{
    static class Program
    {
        private const string APP_NAME = "SRAutomatica";
        private const string RUN_KEY  = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";

        [STAThread]
        static void Main()
        {
            RegisterAutoStart();

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            // Crear los objetos compartidos de la sesión
            var config  = AppConfig.Load();
            var printer = new ThermalPrinter();
            var polling = new PrintPollingService(printer, config);

            printer.SetPaperWidth(config.PaperWidth);

            // Reconectar impresora si había una configurada
            if (!string.IsNullOrEmpty(config.PrinterPort) && config.PrinterType == "com")
                printer.ConnectCom(config.PrinterPort, config.BaudRate);
            else if (!string.IsNullOrEmpty(config.PrinterName) && config.PrinterType == "windows")
                printer.ConnectWindowsPrinter(config.PrinterName);

            // Iniciar polling al arrancar para no perder pedidos mientras se está en el menú
            if (config.AutoPrint && !string.IsNullOrWhiteSpace(config.StoreCode))
                polling.Start();

            Application.Run(new MenuForm(config, printer, polling));
        }

        private static void RegisterAutoStart()
        {
            try
            {
                string exePath = Application.ExecutablePath;
                using RegistryKey? key = Registry.CurrentUser.OpenSubKey(RUN_KEY, writable: true);
                if (key == null) return;
                string? current = key.GetValue(APP_NAME) as string;
                if (!string.Equals(current, exePath, System.StringComparison.OrdinalIgnoreCase))
                    key.SetValue(APP_NAME, exePath);
            }
            catch { }
        }
    }
}
