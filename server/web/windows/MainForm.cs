using System;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace FullscreenBrowser
{
    public class MainForm : Form
    {
        private WebView2 webView = null!;
        private readonly AppConfig           _config;
        private readonly ThermalPrinter      _printer;
        private readonly PrintPollingService _polling;

        public MainForm(AppConfig config, ThermalPrinter printer, PrintPollingService polling)
        {
            _config  = config;
            _printer = printer;
            _polling = polling;

            InitializeComponents();
            InitializeWebView();
        }

        private void InitializeComponents()
        {
            FormBorderStyle = FormBorderStyle.None;
            WindowState     = FormWindowState.Maximized;
            Bounds          = System.Windows.Forms.Screen.PrimaryScreen!.Bounds;
            TopMost         = true;
            Text            = "SR Automatica — Venta";

            KeyPreview = true;
            KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.Escape) Close();   // vuelve al menú
                if (e.KeyCode == Keys.F5)    webView?.Reload();
            };
        }

        private async void InitializeWebView()
        {
            webView = new WebView2 { Dock = DockStyle.Fill };
            Controls.Add(webView);

            await webView.EnsureCoreWebView2Async(null);

            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            webView.CoreWebView2.Settings.AreDevToolsEnabled            = false;
            webView.CoreWebView2.Settings.IsStatusBarEnabled            = false;
            webView.CoreWebView2.Settings.IsZoomControlEnabled          = false;

            // Construir URL: si hay código de tienda ir directo al punto de venta
            string url = _config.Url.TrimEnd('/');
            if (!string.IsNullOrWhiteSpace(_config.StoreCode))
                url += $"/store/{_config.StoreCode}";

            webView.CoreWebView2.Navigate(url);
        }

        // El polling corre de forma continua gestionado por MenuForm/Program;
        // MainForm no lo toca para no interrumpirlo al ir y volver del menú.
    }
}
