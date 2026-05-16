using System;
using System.Windows.Forms;
using Microsoft.Win32;

namespace FullscreenBrowser
{
    static class Program
    {
        private const string APP_NAME = "SRAutomatica";
        private const string RUN_KEY = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";

        [STAThread]
        static void Main()
        {
            RegisterAutoStart();

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }

        private static void RegisterAutoStart()
        {
            try
            {
                // Ruta absoluta del ejecutable actual
                string exePath = Application.ExecutablePath;

                using RegistryKey? key = Registry.CurrentUser.OpenSubKey(RUN_KEY, writable: true);
                if (key == null) return;

                string? current = key.GetValue(APP_NAME) as string;

                // Solo escribe si no existe o si la ruta cambió (ej: moviste el exe)
                if (!string.Equals(current, exePath, StringComparison.OrdinalIgnoreCase))
                {
                    key.SetValue(APP_NAME, exePath);
                }
            }
            catch
            {
                // Si falla el registro no interrumpir la app
            }
        }
    }
}
