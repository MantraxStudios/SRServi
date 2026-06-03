using System;
using System.Threading;
using System.Windows.Forms;

namespace AforoBridge
{
    static class Program
    {
        private static Mutex? _mutex;

        [STAThread]
        static void Main(string[] args)
        {
            // Modo de diagnóstico: construye ConfigForm y reporta cualquier excepción
            if (Array.Exists(args, a => a == "--selftest-config"))
            {
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                try
                {
                    var s = AppSettings.Load();
                    var api = new ApiClient(s.ServerUrl);
                    var f = new ConfigForm(s, api);
                    f.Show();
                    Application.DoEvents();
                    f.Close();
                    Console.Error.WriteLine("SELFTEST OK");
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("SELFTEST FAIL: " + ex);
                }
                return;
            }

            // Instancia única
            _mutex = new Mutex(true, "AforoBridge_SingleInstance", out bool isNew);
            if (!isNew)
            {
                MessageBox.Show("AforoBridge ya se está ejecutando (revisa la bandeja del sistema).",
                    "AforoBridge", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            bool startInTray = Array.Exists(args, a =>
                a.Equals("--tray", StringComparison.OrdinalIgnoreCase));

            var settings = AppSettings.Load();

            // Asegurar registro de arranque conforme a la preferencia guardada
            AutoStart.Apply(settings.RunAtStartup);

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm(settings, startInTray));
        }
    }
}
