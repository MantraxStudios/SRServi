using System;
using System.Windows.Forms;
using Microsoft.Win32;

namespace AforoBridge
{
    /// <summary>Registra/quita AforoBridge del arranque de Windows (clave Run del usuario).</summary>
    public static class AutoStart
    {
        private const string AppName = "AforoBridge";
        private const string RunKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";

        public static void Apply(bool enabled)
        {
            try
            {
                using var key = Registry.CurrentUser.OpenSubKey(RunKey, writable: true);
                if (key == null) return;

                if (enabled)
                {
                    // Arranca minimizado en la bandeja al iniciar Windows
                    string cmd = $"\"{Application.ExecutablePath}\" --tray";
                    if (!string.Equals(key.GetValue(AppName) as string, cmd, StringComparison.OrdinalIgnoreCase))
                        key.SetValue(AppName, cmd);
                }
                else if (key.GetValue(AppName) != null)
                {
                    key.DeleteValue(AppName, throwOnMissingValue: false);
                }
            }
            catch { /* no romper si falla el registro */ }
        }
    }
}
