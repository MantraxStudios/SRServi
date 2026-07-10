using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace FullscreenBrowser
{
    // Hace polling al servidor cada 3 segundos e imprime pedidos nuevos.
    // En el PRIMER ciclo marca todos los pedidos actuales como "vistos" sin imprimir
    // (evita reimprimir pedidos históricos al arrancar).
    // Persiste los IDs impresos en printer_state.json para sobrevivir reinicios.

    public sealed class PrintPollingService : IDisposable
    {
        private readonly ThermalPrinter _printer;
        private readonly AppConfig      _config;

        private System.Threading.Timer? _timer;
        private readonly HashSet<int>   _printedIds = new();
        private bool _initialized;
        private int  _fetching;

        private const string BASE_URL   = "https://mantraxtools.store";
        private const int    POLL_MS    = 3000;

        private static readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(10) };

        public event Action<string>? OnMessage;

        public PrintPollingService(ThermalPrinter printer, AppConfig config)
        {
            _printer = printer;
            _config  = config;
            LoadState();
        }

        public void Start()
        {
            Stop();
            _timer = new System.Threading.Timer(_ => _ = PollAsync(), null, 0, POLL_MS);
        }

        public void Stop()
        {
            _timer?.Dispose();
            _timer = null;
        }

        // ── Ciclo de polling ────────────────────────────────────────────────────

        private async Task PollAsync()
        {
            if (!_config.AutoPrint) return;
            if (string.IsNullOrWhiteSpace(_config.StoreCode)) return;
            if (Interlocked.Exchange(ref _fetching, 1) == 1) return;

            try
            {
                var url  = $"{BASE_URL}/api/store/{_config.StoreCode}/orders";
                var json = await _http.GetStringAsync(url);
                var doc  = JsonDocument.Parse(json);

                if (!doc.RootElement.TryGetProperty("orders", out var ordersEl)) return;

                var all = new List<(int id, JsonElement el)>();
                foreach (var o in ordersEl.EnumerateArray())
                    if (o.TryGetProperty("id", out var idEl))
                        all.Add((idEl.GetInt32(), o));

                // Primer ciclo: marcar como vistos sin imprimir
                if (!_initialized)
                {
                    _initialized = true;
                    foreach (var (id, _) in all)
                        _printedIds.Add(id);
                    SaveState();
                    OnMessage?.Invoke($"Listo — monitoreando {all.Count} pedidos existentes");
                    return;
                }

                // Ciclos normales: imprimir nuevos con cashApproved = 1
                foreach (var (id, o) in all)
                {
                    if (_printedIds.Contains(id)) continue;

                    int approved = o.TryGetProperty("cashApproved", out var ca)
                        && ca.ValueKind == JsonValueKind.Number ? ca.GetInt32() : 0;
                    if (approved != 1) continue;

                    if (!_printer.IsConnected)
                    {
                        // No marcar como impreso — reintentar cuando conecte
                        continue;
                    }

                    _printedIds.Add(id);
                    SaveState();

                    _printer.PrintOrder(ParseOrder(o));
                    OnMessage?.Invoke($"Imprimiendo #{GetStr(o, "orderNumber")}");
                }
            }
            catch { }
            finally { Interlocked.Exchange(ref _fetching, 0); }
        }

        // ── Parsear JSON → OrderData ────────────────────────────────────────────

        private static OrderData ParseOrder(JsonElement o)
        {
            var order = new OrderData
            {
                OrderNumber   = GetStr(o, "orderNumber"),
                Total         = GetDbl(o, "total"),
                PaymentMethod = GetStr(o, "paymentMethod"),
                ServiceType   = TryStr(o, "serviceType"),
                TableNumber   = o.TryGetProperty("tableNumber", out var tn)
                                && tn.ValueKind != JsonValueKind.Null
                                ? tn.GetInt32() : null,
            };

            if (o.TryGetProperty("items", out var items))
                foreach (var item in items.EnumerateArray())
                    order.Items.Add(new OrderItemData
                    {
                        Quantity = (int)GetDbl(item, "quantity"),
                        Name     = GetStr(item, "name"),
                        Price    = GetDbl(item, "price"),
                    });

            return order;
        }

        private static string  GetStr(JsonElement e, string k) =>
            e.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String
                ? v.GetString() ?? "" : "";

        private static string? TryStr(JsonElement e, string k) =>
            e.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String
                ? v.GetString() : null;

        private static double GetDbl(JsonElement e, string k) =>
            e.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.Number
                ? v.GetDouble() : 0;

        // ── Persistencia ────────────────────────────────────────────────────────

        private static string StatePath =>
            Path.Combine(AppContext.BaseDirectory, "printer_state.json");

        private void LoadState()
        {
            try
            {
                if (!File.Exists(StatePath)) return;
                var ids = JsonSerializer.Deserialize<HashSet<int>>(File.ReadAllText(StatePath));
                if (ids == null) return;
                foreach (var id in ids) _printedIds.Add(id);
                _initialized = true; // ya tenemos historial → no hacer primer ciclo
            }
            catch { }
        }

        private void SaveState()
        {
            try { File.WriteAllText(StatePath, JsonSerializer.Serialize(_printedIds)); }
            catch { }
        }

        public void Dispose() => Stop();
    }
}
