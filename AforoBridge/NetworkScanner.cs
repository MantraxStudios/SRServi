using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;

namespace AforoBridge
{
    /// <summary>Escanea la red local buscando dispositivos con el puerto RTSP abierto.</summary>
    public static class NetworkScanner
    {
        /// <summary>IPv4 local de este PC (la que tiene salida a la red).</summary>
        public static string? GetLocalIPv4()
        {
            try
            {
                using var s = new Socket(AddressFamily.InterNetwork, SocketType.Dgram, ProtocolType.Udp);
                s.Connect("8.8.8.8", 65530);
                return (s.LocalEndPoint as IPEndPoint)?.Address.ToString();
            }
            catch { return null; }
        }

        /// <summary>
        /// Escanea x.x.x.1-254 buscando el puerto dado (554 RTSP).
        /// progress: (revisados, total). Devuelve las IPs que respondieron.
        /// </summary>
        public static async Task<List<string>> ScanAsync(int port, Action<int, int>? progress, CancellationToken ct)
        {
            var found = new List<string>();
            var local = GetLocalIPv4();
            if (local == null) return found;

            var parts = local.Split('.');
            if (parts.Length != 4) return found;
            string prefix = $"{parts[0]}.{parts[1]}.{parts[2]}.";

            using var sem = new SemaphoreSlim(80);
            var tasks = new List<Task>();
            int done = 0;
            const int total = 254;

            for (int i = 1; i <= 254; i++)
            {
                string ip = prefix + i;
                await sem.WaitAsync(ct);
                tasks.Add(Task.Run(async () =>
                {
                    try
                    {
                        if (await IsPortOpenAsync(ip, port, 400, ct))
                            lock (found) found.Add(ip);
                    }
                    catch { }
                    finally
                    {
                        sem.Release();
                        progress?.Invoke(Interlocked.Increment(ref done), total);
                    }
                }, ct));
            }

            try { await Task.WhenAll(tasks); } catch { }

            return found
                .OrderBy(ip => int.TryParse(ip.Split('.').Last(), out var n) ? n : 999)
                .ToList();
        }

        private static async Task<bool> IsPortOpenAsync(string ip, int port, int timeoutMs, CancellationToken ct)
        {
            using var client = new TcpClient();
            try
            {
                var connect = client.ConnectAsync(ip, port);
                var done = await Task.WhenAny(connect, Task.Delay(timeoutMs, ct));
                return done == connect && !connect.IsFaulted && client.Connected;
            }
            catch { return false; }
        }
    }
}
