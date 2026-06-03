using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AforoBridge
{
    /// <summary>
    /// Configuración persistente de AforoBridge.
    /// Se guarda en %AppData%\AforoBridge\config.json.
    /// Las contraseñas se cifran con DPAPI (atadas al usuario de Windows).
    /// </summary>
    public class AppSettings
    {
        public string ServerUrl { get; set; } = "https://srservi2.srautomatic.com";
        public string Email { get; set; } = "";
        // Contraseña de la cuenta web, cifrada (DPAPI base64)
        public string EncPassword { get; set; } = "";

        public int StoreId { get; set; } = 0;
        public string StoreName { get; set; } = "";

        // Datos de la cámara IP
        public string CamIp { get; set; } = "";
        public string CamPort { get; set; } = "554";
        public string CamUser { get; set; } = "";
        public string EncCamPass { get; set; } = "";
        public string CamChannel { get; set; } = "stream1";

        public int Sensitivity { get; set; } = 30;

        // Arrancar el conteo automáticamente al abrir la app
        public bool AutoStartCounting { get; set; } = true;
        // Registrarse para arrancar junto con Windows
        public bool RunAtStartup { get; set; } = true;

        // ── Propiedades no serializadas (contraseñas en claro en memoria) ──
        [JsonIgnore] public string Password
        {
            get => Unprotect(EncPassword);
            set => EncPassword = Protect(value);
        }

        [JsonIgnore] public string CamPass
        {
            get => Unprotect(EncCamPass);
            set => EncCamPass = Protect(value);
        }

        /// <summary>Construye la URL RTSP a partir de los campos individuales.</summary>
        [JsonIgnore] public string RtspUrl
        {
            get
            {
                if (string.IsNullOrWhiteSpace(CamIp)) return "";
                var auth = "";
                if (!string.IsNullOrEmpty(CamUser))
                {
                    auth = Uri.EscapeDataString(CamUser);
                    var p = CamPass;
                    if (!string.IsNullOrEmpty(p)) auth += ":" + Uri.EscapeDataString(p);
                    auth += "@";
                }
                var portPart = (!string.IsNullOrEmpty(CamPort) && CamPort != "554") ? ":" + CamPort : "";
                var channel = (CamChannel ?? "").TrimStart('/');
                return $"rtsp://{auth}{CamIp}{portPart}/{channel}";
            }
        }

        [JsonIgnore] public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(Email) &&
            !string.IsNullOrWhiteSpace(EncPassword) &&
            StoreId > 0 &&
            !string.IsNullOrWhiteSpace(CamIp);

        // ── DPAPI ─────────────────────────────────────────────────────────────
        private static string Protect(string? plain)
        {
            if (string.IsNullOrEmpty(plain)) return "";
            try
            {
                var bytes = Encoding.UTF8.GetBytes(plain);
                var enc = ProtectedData.Protect(bytes, null, DataProtectionScope.CurrentUser);
                return Convert.ToBase64String(enc);
            }
            catch { return ""; }
        }

        private static string Unprotect(string? enc)
        {
            if (string.IsNullOrEmpty(enc)) return "";
            try
            {
                var bytes = Convert.FromBase64String(enc);
                var dec = ProtectedData.Unprotect(bytes, null, DataProtectionScope.CurrentUser);
                return Encoding.UTF8.GetString(dec);
            }
            catch { return ""; }
        }

        // ── Carga / Guardado ──────────────────────────────────────────────────
        private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = true };

        public static string Dir =>
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "AforoBridge");

        public static string FilePath => Path.Combine(Dir, "config.json");

        public static AppSettings Load()
        {
            try
            {
                if (File.Exists(FilePath))
                {
                    var json = File.ReadAllText(FilePath);
                    var s = JsonSerializer.Deserialize<AppSettings>(json);
                    if (s != null) return s;
                }
            }
            catch { /* config corrupta → empezar limpio */ }
            return new AppSettings();
        }

        public void Save()
        {
            try
            {
                Directory.CreateDirectory(Dir);
                File.WriteAllText(FilePath, JsonSerializer.Serialize(this, JsonOpts));
            }
            catch { /* no romper si falla el guardado */ }
        }
    }
}
