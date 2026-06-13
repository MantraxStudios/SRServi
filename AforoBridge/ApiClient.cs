using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace AforoBridge
{
    public record StoreInfo(int Id, string Name);
    public record LoginResult(string Token, string UserJson, string UserName);
    public record LineConfig(double X1, double Y1, double X2, double Y2, bool Flip);

    /// <summary>Cliente HTTP contra la API de SRServi (mismos endpoints que el panel web).</summary>
    public class ApiClient
    {
        private readonly HttpClient _http;
        private string _baseUrl;
        public string? Token { get; private set; }

        public ApiClient(string baseUrl)
        {
            _baseUrl = baseUrl.TrimEnd('/');
            _http = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
        }

        public void SetBaseUrl(string baseUrl) => _baseUrl = baseUrl.TrimEnd('/');
        public void SetToken(string token) => Token = token;

        private HttpRequestMessage Req(HttpMethod m, string path)
        {
            var r = new HttpRequestMessage(m, _baseUrl + path);
            if (!string.IsNullOrEmpty(Token))
                r.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Token);
            return r;
        }

        /// <summary>Login con email/contraseña. Devuelve token + usuario (JSON crudo para inyectar en la web).</summary>
        public async Task<LoginResult> LoginAsync(string email, string password)
        {
            var body = JsonSerializer.Serialize(new { email, password });
            var req = Req(HttpMethod.Post, "/api/auth/login");
            req.Content = new StringContent(body, Encoding.UTF8, "application/json");
            var res = await _http.SendAsync(req);
            var text = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode)
            {
                string msg = text;
                try { msg = JsonDocument.Parse(text).RootElement.GetProperty("error").GetString() ?? text; } catch { }
                throw new Exception(msg);
            }
            using var doc = JsonDocument.Parse(text);
            var root = doc.RootElement;
            var token = root.GetProperty("token").GetString() ?? throw new Exception("Respuesta sin token");
            var userEl = root.GetProperty("user");
            var userJson = userEl.GetRawText();
            var userName = userEl.TryGetProperty("name", out var n) ? (n.GetString() ?? email) : email;
            Token = token;
            return new LoginResult(token, userJson, userName);
        }

        /// <summary>Lista las tiendas del usuario autenticado.</summary>
        public async Task<List<StoreInfo>> GetStoresAsync()
        {
            var res = await _http.SendAsync(Req(HttpMethod.Get, "/api/stores"));
            res.EnsureSuccessStatusCode();
            var text = await res.Content.ReadAsStringAsync();
            var list = new List<StoreInfo>();
            using var doc = JsonDocument.Parse(text);
            foreach (var el in doc.RootElement.EnumerateArray())
            {
                var id = el.TryGetProperty("id", out var i) ? i.GetInt32() : 0;
                var name = el.TryGetProperty("name", out var nm) ? (nm.GetString() ?? $"Tienda {id}") : $"Tienda {id}";
                if (id > 0) list.Add(new StoreInfo(id, name));
            }
            return list;
        }

        /// <summary>Obtiene la línea de conteo + flip configurada en el panel (o null si no hay).</summary>
        public async Task<LineConfig?> GetLineConfigAsync(int storeId)
        {
            try
            {
                var res = await _http.SendAsync(Req(HttpMethod.Get, $"/api/stores/{storeId}/people-counter/config"));
                if (!res.IsSuccessStatusCode) return null;
                var text = await res.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(text);
                var root = doc.RootElement;
                if (!root.TryGetProperty("line", out var line) || line.ValueKind != JsonValueKind.Object)
                    return null;
                double G(string k) => line.TryGetProperty(k, out var v) ? v.GetDouble() : 0;
                bool flip = root.TryGetProperty("flip", out var f) && (f.ValueKind == JsonValueKind.True ||
                            (f.ValueKind == JsonValueKind.Number && f.GetInt32() != 0));
                return new LineConfig(G("x1"), G("y1"), G("x2"), G("y2"), flip);
            }
            catch { return null; }
        }

        /// <summary>Reporta un cruce de línea (entrada/salida).</summary>
        public async Task PostEventAsync(int storeId, string direction)
        {
            try
            {
                var body = JsonSerializer.Serialize(new { direction, crossed_at = DateTime.UtcNow.ToString("o") });
                var req = Req(HttpMethod.Post, $"/api/stores/{storeId}/people-counter/event");
                req.Content = new StringContent(body, Encoding.UTF8, "application/json");
                await _http.SendAsync(req);
            }
            catch { /* reintentará en el próximo cruce */ }
        }

        /// <summary>Sube un snapshot JPEG → activa el indicador "agente activo" y la vista previa en la web.
        /// Timeout corto: si un frame se atasca se descarta y se envía el siguiente (vista previa fluida).</summary>
        public async Task UploadSnapshotAsync(int storeId, byte[] jpeg, System.Threading.CancellationToken ct = default)
        {
            try
            {
                using var cts = System.Threading.CancellationTokenSource.CreateLinkedTokenSource(ct);
                cts.CancelAfter(TimeSpan.FromSeconds(4));
                var req = Req(HttpMethod.Post, $"/api/stores/{storeId}/people-counter/snapshot-upload");
                var content = new ByteArrayContent(jpeg);
                content.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
                req.Content = content;
                await _http.SendAsync(req, cts.Token);
            }
            catch { /* silencioso */ }
        }

        /// <summary>Guarda los datos de la cámara en el panel (enabled=false: el conteo lo hace AforoBridge localmente).</summary>
        public async Task SaveRtspInfoAsync(int storeId, string rtspUrl, int sensitivity)
        {
            try
            {
                var body = JsonSerializer.Serialize(new
                {
                    rtsp_url = rtspUrl,
                    rtsp_enabled = false,
                    rtsp_sensitivity = sensitivity
                });
                var req = Req(HttpMethod.Post, $"/api/stores/{storeId}/people-counter/rtsp");
                req.Content = new StringContent(body, Encoding.UTF8, "application/json");
                await _http.SendAsync(req);
            }
            catch { /* opcional */ }
        }
    }
}
