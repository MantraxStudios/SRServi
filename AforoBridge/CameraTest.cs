using System;
using System.Diagnostics;
using System.Text;
using System.Threading.Tasks;

namespace AforoBridge
{
    public record CameraTestResult(bool Ok, string Message, string FullOutput);

    /// <summary>Prueba de conexión RTSP única: abre el stream 2s y reporta el error exacto.</summary>
    public static class CameraTest
    {
        /// <summary>Construye la URL RTSP a partir de campos sueltos.</summary>
        public static string BuildUrl(string ip, string port, string user, string pass, string channel)
        {
            if (string.IsNullOrWhiteSpace(ip)) return "";
            var auth = "";
            if (!string.IsNullOrEmpty(user))
            {
                auth = Uri.EscapeDataString(user);
                if (!string.IsNullOrEmpty(pass)) auth += ":" + Uri.EscapeDataString(pass);
                auth += "@";
            }
            var p = string.IsNullOrWhiteSpace(port) ? "554" : port.Trim();
            var portPart = p != "554" ? ":" + p : "";
            var ch = (string.IsNullOrWhiteSpace(channel) ? "stream1" : channel).TrimStart('/');
            return $"rtsp://{auth}{ip.Trim()}{portPart}/{ch}";
        }

        private static readonly string[] CommonChannels =
        {
            "stream1", "stream2", "h264Preview_01_main", "Streaming/Channels/101",
            "cam/realmonitor?channel=1&subtype=0", "live", "live/ch0", "11", "video1", "1"
        };

        /// <summary>
        /// Prueba la cámara probando automáticamente los canales más comunes.
        /// Devuelve el canal que funcionó (para guardarlo sin que el usuario lo sepa).
        /// </summary>
        public static async Task<(bool ok, string channel, string message)> AutoDetectAsync(
            string ip, string port, string user, string pass, string? preferred)
        {
            if (string.IsNullOrWhiteSpace(ip))
                return (false, "", "Elige o escribe la IP de la cámara primero.");

            if (!await FfmpegManager.EnsureAsync())
                return (false, "", "FFmpeg no disponible.");

            // Probar primero el canal preferido si el usuario escribió uno
            var list = new System.Collections.Generic.List<string>();
            if (!string.IsNullOrWhiteSpace(preferred)) list.Add(preferred!);
            foreach (var c in CommonChannels) if (!list.Contains(c)) list.Add(c);

            string lastMsg = "No se encontró el canal de video.";
            foreach (var ch in list)
            {
                var url = BuildUrl(ip, port, user, pass, ch);
                var r = await RunAsync(url);
                if (r.Ok) return (true, ch, "✓ ¡Cámara conectada correctamente!");

                var o = (r.FullOutput ?? "").ToLowerInvariant();
                // Si es error de credenciales, no tiene sentido seguir probando canales
                if (o.Contains("401") || o.Contains("unauthorized"))
                    return (false, "", Interpret(r.FullOutput));
                if (o.Contains("refused") || o.Contains("timed out") || o.Contains("timeout") || o.Contains("no route"))
                    return (false, "", Interpret(r.FullOutput));
                lastMsg = r.Message;
            }
            return (false, "", lastMsg + " Revisa usuario y contraseña de la cámara.");
        }

        public static async Task<CameraTestResult> RunAsync(string rtspUrl)
        {
            if (string.IsNullOrWhiteSpace(rtspUrl))
                return new CameraTestResult(false, "Falta la IP de la cámara.", "");

            if (!await FfmpegManager.EnsureAsync())
                return new CameraTestResult(false, "FFmpeg no disponible.", "");

            var psi = new ProcessStartInfo
            {
                FileName = FfmpegManager.Path ?? "ffmpeg",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };
            foreach (var a in new[] {
                "-rtsp_transport", "tcp",
                "-i", rtspUrl,
                "-t", "2", "-f", "null", "-"
            }) psi.ArgumentList.Add(a);

            var sb = new StringBuilder();
            try
            {
                using var p = new Process { StartInfo = psi };
                p.ErrorDataReceived += (_, e) => { if (e.Data != null) sb.AppendLine(e.Data); };
                p.OutputDataReceived += (_, __) => { };
                p.Start();
                p.BeginErrorReadLine();
                p.BeginOutputReadLine();

                var exited = await Task.Run(() => p.WaitForExit(20000));
                if (!exited) { try { p.Kill(true); } catch { } return new CameraTestResult(false, "Tiempo agotado — verifica la IP y el puerto.", sb.ToString()); }

                string full = sb.ToString();
                if (p.ExitCode == 0)
                    return new CameraTestResult(true, "✓ Conexión correcta. La cámara responde.", full);

                return new CameraTestResult(false, Interpret(full), full);
            }
            catch (Exception e)
            {
                return new CameraTestResult(false, "No se pudo ejecutar FFmpeg: " + e.Message, sb.ToString());
            }
        }

        /// <summary>Traduce el error crudo de FFmpeg a un diagnóstico claro.</summary>
        public static string Interpret(string? output)
        {
            var o = (output ?? "").ToLowerInvariant();
            if (o.Contains("401") || o.Contains("unauthorized"))
                return "Usuario o contraseña incorrectos (401). En cámaras Tapo: activa la 'Cuenta de cámara' RTSP en la app y usa ESOS datos, no tu email TP-Link.";
            if (o.Contains("404") || o.Contains("not found") || o.Contains("406"))
                return "Canal/ruta incorrecta. Prueba otro: stream1, stream2, h264Preview_01_main, Streaming/Channels/101, cam/realmonitor?channel=1&subtype=0";
            if (o.Contains("connection refused"))
                return "La cámara no responde en esa IP/puerto. Verifica la IP, que el puerto 554 esté abierto y que RTSP esté activado.";
            if (o.Contains("timed out") || o.Contains("timeout"))
                return "Tiempo agotado. IP equivocada o la cámara no está en la misma red que este PC.";
            if (o.Contains("no route to host") || o.Contains("network is unreachable"))
                return "No hay ruta a esa IP. El PC no está en la misma red que la cámara.";
            return "No se pudo abrir el stream. Revisa IP, puerto, usuario, contraseña y canal.";
        }
    }
}
