using System;
using System.IO;
using System.Text.Json;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace FullscreenBrowser
{
    public class MainForm : Form
    {
        private WebView2 webView;
        private static readonly string TARGET_URL = LoadTargetUrl();

        private static string LoadTargetUrl()
        {
            try
            {
                string configPath = Path.Combine(AppContext.BaseDirectory, "config.json");
                if (File.Exists(configPath))
                {
                    using var stream = File.OpenRead(configPath);
                    var doc = JsonDocument.Parse(stream);
                    if (doc.RootElement.TryGetProperty("url", out var urlProp))
                    {
                        var url = urlProp.GetString();
                        if (!string.IsNullOrWhiteSpace(url)) return url;
                    }
                }
            }
            catch { }
            return "https://srservi2.srautomatic.com/";
        }

        public MainForm()
        {
            InitializeComponents();
            InitializeWebView();
        }

        private void InitializeComponents()
        {
            this.FormBorderStyle = FormBorderStyle.None;
            this.WindowState = FormWindowState.Normal;
            this.Bounds = Screen.PrimaryScreen.Bounds;
            this.TopMost = true;
            this.Text = "SR Automatica";

            // Escape para salir
            this.KeyPreview = true;
            this.KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.Escape)
                    Application.Exit();
                // F5 para recargar
                if (e.KeyCode == Keys.F5)
                    webView?.Reload();
            };
        }

        private async void InitializeWebView()
        {
            webView = new WebView2
            {
                Dock = DockStyle.Fill
            };

            this.Controls.Add(webView);

            await webView.EnsureCoreWebView2Async(null);

            // Deshabilitar menú contextual y barra de desarrollo
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.Settings.IsZoomControlEnabled = false;

            // Navegar a la URL
            webView.CoreWebView2.Navigate(TARGET_URL);
        }
    }
}
