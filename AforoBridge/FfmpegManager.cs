using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Threading.Tasks;

namespace AforoBridge
{
    /// <summary>
    /// Garantiza que ffmpeg.exe esté disponible. Orden de búsqueda:
    /// 1) Junto al ejecutable de AforoBridge
    /// 2) En %AppData%\AforoBridge\ffmpeg.exe
    /// 3) En el PATH del sistema
    /// 4) Descarga automática del build de BtbN (igual que el agente Node)
    /// </summary>
    public static class FfmpegManager
    {
        private const string DownloadUrl =
            "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";

        public static string? Path { get; private set; }

        public static bool IsReady => !string.IsNullOrEmpty(Path) && File.Exists(Path);

        /// <summary>Localiza o descarga ffmpeg. Reporta progreso textual vía callback.</summary>
        public static async Task<bool> EnsureAsync(Action<string>? log = null)
        {
            log ??= _ => { };

            // 1) Junto al exe
            var local = System.IO.Path.Combine(AppContext.BaseDirectory, "ffmpeg.exe");
            if (File.Exists(local)) { Path = local; return true; }

            // 2) En AppData
            var appData = System.IO.Path.Combine(AppSettings.Dir, "ffmpeg.exe");
            if (File.Exists(appData)) { Path = appData; return true; }

            // 3) En PATH
            if (ExistsInPath()) { Path = "ffmpeg"; return true; }

            // 4) Descargar
            try
            {
                log("Descargando FFmpeg (~80 MB, una sola vez)…");
                Directory.CreateDirectory(AppSettings.Dir);
                var zipPath = System.IO.Path.Combine(AppSettings.Dir, "ffmpeg-dl.zip");

                using (var http = new HttpClient { Timeout = TimeSpan.FromMinutes(10) })
                using (var resp = await http.GetAsync(DownloadUrl, HttpCompletionOption.ResponseHeadersRead))
                {
                    resp.EnsureSuccessStatusCode();
                    await using var fs = new FileStream(zipPath, FileMode.Create, FileAccess.Write, FileShare.None);
                    await resp.Content.CopyToAsync(fs);
                }

                log("Extrayendo FFmpeg…");
                using (var zip = ZipFile.OpenRead(zipPath))
                {
                    foreach (var entry in zip.Entries)
                    {
                        if (entry.Name.Equals("ffmpeg.exe", StringComparison.OrdinalIgnoreCase))
                        {
                            entry.ExtractToFile(appData, overwrite: true);
                            break;
                        }
                    }
                }
                try { File.Delete(zipPath); } catch { }

                if (File.Exists(appData)) { Path = appData; log("FFmpeg listo."); return true; }
            }
            catch (Exception e)
            {
                log("No se pudo descargar FFmpeg: " + e.Message);
            }

            return false;
        }

        private static bool ExistsInPath()
        {
            try
            {
                var psi = new ProcessStartInfo("ffmpeg", "-version")
                {
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };
                using var p = Process.Start(psi);
                if (p == null) return false;
                p.WaitForExit(5000);
                return p.HasExited && p.ExitCode == 0;
            }
            catch { return false; }
        }
    }
}
