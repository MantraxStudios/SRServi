using System;
using System.IO;
using System.Text.Json;

namespace FullscreenBrowser
{
    public sealed class AppConfig
    {
        public string Url        { get; set; } = "https://srservi2.srautomatic.com/";
        public string StoreCode  { get; set; } = "";
        public string PrinterType { get; set; } = "com";   // "com" | "windows"
        public string PrinterPort { get; set; } = "";       // COM3, COM4 ...
        public string PrinterName { get; set; } = "";       // nombre impresora Windows
        public int    BaudRate   { get; set; } = 9600;
        public int    PaperWidth { get; set; } = 32;        // chars por línea
        public bool   AutoPrint  { get; set; } = true;

        private static readonly string _path =
            Path.Combine(AppContext.BaseDirectory, "config.json");

        public static AppConfig Load()
        {
            try
            {
                if (File.Exists(_path))
                {
                    var cfg = JsonSerializer.Deserialize<AppConfig>(File.ReadAllText(_path));
                    if (cfg != null) return cfg;
                }
            }
            catch { }
            return new AppConfig();
        }

        public void Save()
        {
            try
            {
                var opts = new JsonSerializerOptions { WriteIndented = true };
                File.WriteAllText(_path, JsonSerializer.Serialize(this, opts));
            }
            catch { }
        }
    }
}
