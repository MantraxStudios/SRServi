using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace AforoBridge
{
    /// <summary>
    /// Motor de conteo de aforo. Mismo algoritmo que el panel web y el agente Node:
    /// FFmpeg extrae frames 80×60 RGB a 2fps → diff de píxeles → blobs → cruce de línea.
    /// Un segundo proceso FFmpeg genera snapshots JPEG para la vista previa en la web.
    /// </summary>
    public class PeopleCounter
    {
        // Constantes idénticas al frontend / servidor
        private const int W = 80, H = 60;
        private const int FRAME_SIZE = W * H * 3;   // RGB24
        private const int MIN_BLOB = 12;
        private const double MAX_DIST = 0.18;
        private const long COOLDOWN_MS = 2500;

        private Process? _ffCount;
        private Process? _ffSnap;
        private CancellationTokenSource? _cts;

        private readonly List<Track> _tracks = new();
        private byte[]? _prevFrame;

        // Configuración activa
        private double _x1, _y1, _x2, _y2;
        private bool _flip;
        private int _sensitivity = 30;
        private string _ffmpegPath = "ffmpeg";

        public int CountIn { get; private set; }
        public int CountOut { get; private set; }
        public bool Running => _ffCount is { HasExited: false };
        public string? LastError { get; private set; }

        /// <summary>Se dispara en cada cruce. Argumento: "in" o "out".</summary>
        public event Action<string>? OnCross;
        /// <summary>Se dispara con cada snapshot JPEG.</summary>
        public event Action<byte[]>? OnSnapshot;
        /// <summary>Mensajes de estado para la UI.</summary>
        public event Action<string>? OnStatus;

        private sealed class Track
        {
            public double Cx, Cy;
            public int Missed;
            public long LastCross;
        }

        public void UpdateLine(double x1, double y1, double x2, double y2, bool flip)
        {
            _x1 = x1; _y1 = y1; _x2 = x2; _y2 = y2; _flip = flip;
        }

        public void Start(string ffmpegPath, string rtspUrl, int sensitivity,
                          double x1, double y1, double x2, double y2, bool flip)
        {
            Stop();
            _ffmpegPath = ffmpegPath;
            _sensitivity = sensitivity;
            UpdateLine(x1, y1, x2, y2, flip);
            _prevFrame = null;
            _tracks.Clear();
            LastError = null;
            _cts = new CancellationTokenSource();
            var ct = _cts.Token;

            StartCountProcess(rtspUrl, ct);
            StartSnapshotProcess(rtspUrl, ct);
            OnStatus?.Invoke("Conectando a la cámara…");
        }

        public void Stop()
        {
            try { _cts?.Cancel(); } catch { }
            KillProcess(ref _ffCount);
            KillProcess(ref _ffSnap);
            _cts = null;
        }

        public void ResetCounts() { CountIn = 0; CountOut = 0; }

        private static void KillProcess(ref Process? p)
        {
            try { if (p is { HasExited: false }) p.Kill(true); } catch { }
            try { p?.Dispose(); } catch { }
            p = null;
        }

        // ── Proceso de conteo: frames 80×60 RGB crudos ──────────────────────────
        private void StartCountProcess(string rtspUrl, CancellationToken ct)
        {
            var psi = new ProcessStartInfo
            {
                FileName = _ffmpegPath,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };
            foreach (var a in new[] {
                "-rtsp_transport", "tcp",
                "-fflags", "+genpts+discardcorrupt",
                "-i", rtspUrl,
                "-vf", $"fps=2,scale={W}:{H}",
                "-f", "rawvideo", "-pix_fmt", "rgb24",
                "-loglevel", "error", "pipe:1"
            }) psi.ArgumentList.Add(a);

            _ffCount = new Process { StartInfo = psi, EnableRaisingEvents = true };
            var stderr = new System.Text.StringBuilder();
            _ffCount.ErrorDataReceived += (_, e) =>
            {
                if (string.IsNullOrWhiteSpace(e.Data)) return;
                stderr.AppendLine(e.Data);
                var l = e.Data.ToLowerInvariant();
                if (l.Contains("server returned") || l.Contains("unauthorized") || l.Contains("refused") ||
                    l.Contains("timed out") || l.Contains("timeout") || l.Contains("not found") ||
                    l.Contains("401") || l.Contains("404") || l.Contains("406") || l.Contains("no route"))
                {
                    LastError = CameraTest.Interpret(stderr.ToString());
                    OnStatus?.Invoke("⚠ " + LastError);
                }
            };
            _ffCount.Start();
            _ffCount.BeginErrorReadLine();

            Task.Run(() => ReadFrames(_ffCount, ct), ct);
        }

        private void ReadFrames(Process proc, CancellationToken ct)
        {
            var stream = proc.StandardOutput.BaseStream;
            var frame = new byte[FRAME_SIZE];
            bool announced = false;
            try
            {
                while (!ct.IsCancellationRequested)
                {
                    if (!ReadFull(stream, frame, ct)) break;
                    if (!announced) { announced = true; OnStatus?.Invoke("Cámara conectada — contando."); }
                    ProcessFrame(frame);
                }
            }
            catch (Exception e) when (!ct.IsCancellationRequested)
            {
                LastError = e.Message;
            }
        }

        private static bool ReadFull(Stream s, byte[] buf, CancellationToken ct)
        {
            int off = 0;
            while (off < buf.Length)
            {
                if (ct.IsCancellationRequested) return false;
                int n = s.Read(buf, off, buf.Length - off);
                if (n <= 0) return false;
                off += n;
            }
            return true;
        }

        private void ProcessFrame(byte[] frame)
        {
            if (_prevFrame == null) { _prevFrame = (byte[])frame.Clone(); return; }

            var blobs = DetectBlobs(_prevFrame, frame, _sensitivity);
            UpdateTracks(blobs);
            Array.Copy(frame, _prevFrame, FRAME_SIZE);
        }

        // ── Algoritmo de detección ──────────────────────────────────────────────
        private static List<(double cx, double cy)> DetectBlobs(byte[] prev, byte[] curr, int threshold)
        {
            var motion = new byte[W * H];
            for (int i = 0; i < W * H; i++)
            {
                int p = i * 3;
                int dr = Math.Abs(curr[p] - prev[p]);
                int dg = Math.Abs(curr[p + 1] - prev[p + 1]);
                int db = Math.Abs(curr[p + 2] - prev[p + 2]);
                if ((dr + dg + db) / 3.0 > threshold) motion[i] = 1;
            }

            // Dilatación 1px
            var dil = new byte[W * H];
            for (int y = 1; y < H - 1; y++)
                for (int x = 1; x < W - 1; x++)
                {
                    int i = y * W + x;
                    if (motion[i] == 1 || motion[i - 1] == 1 || motion[i + 1] == 1 ||
                        motion[i - W] == 1 || motion[i + W] == 1) dil[i] = 1;
                }

            // Etiquetado de componentes conexas (BFS)
            var labels = new int[W * H];
            Array.Fill(labels, -1);
            var blobs = new List<(double, double)>();
            int nl = 0;
            var queue = new Queue<int>();
            var neighbors = new int[4];
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    int idx = y * W + x;
                    if (dil[idx] == 0 || labels[idx] >= 0) continue;
                    queue.Clear();
                    queue.Enqueue(idx);
                    labels[idx] = nl;
                    int cnt = 0; long sx = 0, sy = 0;
                    while (queue.Count > 0)
                    {
                        int c = queue.Dequeue();
                        cnt++; sx += c % W; sy += c / W;
                        neighbors[0] = c - 1; neighbors[1] = c + 1; neighbors[2] = c - W; neighbors[3] = c + W;
                        foreach (var n in neighbors)
                            if (n >= 0 && n < W * H && dil[n] == 1 && labels[n] < 0)
                            {
                                labels[n] = nl;
                                queue.Enqueue(n);
                            }
                    }
                    if (cnt >= MIN_BLOB)
                        blobs.Add(((double)sx / cnt / W, (double)sy / cnt / H));
                    nl++;
                }
            return blobs;
        }

        private double GetSide(double px, double py) =>
            (_x2 - _x1) * (py - _y1) - (_y2 - _y1) * (px - _x1);

        private void UpdateTracks(List<(double cx, double cy)> blobs)
        {
            var used = new HashSet<int>();
            foreach (var t in _tracks)
            {
                int best = -1; double bd = double.PositiveInfinity;
                for (int i = 0; i < blobs.Count; i++)
                {
                    if (used.Contains(i)) continue;
                    double d = Math.Sqrt(Math.Pow(blobs[i].cx - t.Cx, 2) + Math.Pow(blobs[i].cy - t.Cy, 2));
                    if (d < bd) { bd = d; best = i; }
                }
                if (best >= 0 && bd < MAX_DIST)
                {
                    var b = blobs[best];
                    used.Add(best);
                    double ps = GetSide(t.Cx, t.Cy);
                    double cs = GetSide(b.cx, b.cy);
                    if (ps != 0 && cs != 0 && Math.Sign(ps) != Math.Sign(cs))
                    {
                        long now = NowMs();
                        if (t.LastCross == 0 || now - t.LastCross > COOLDOWN_MS)
                        {
                            t.LastCross = now;
                            string dir = cs < 0 ? "in" : "out";
                            if (_flip) dir = dir == "in" ? "out" : "in";
                            if (dir == "in") CountIn++; else CountOut++;
                            OnCross?.Invoke(dir);
                        }
                    }
                    t.Cx = b.cx; t.Cy = b.cy; t.Missed = 0;
                }
                else t.Missed++;
            }
            for (int i = 0; i < blobs.Count; i++)
                if (!used.Contains(i))
                    _tracks.Add(new Track { Cx = blobs[i].cx, Cy = blobs[i].cy, Missed = 0, LastCross = 0 });

            _tracks.RemoveAll(t => t.Missed >= 5);
        }

        private static long NowMs() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        // ── Proceso de snapshot: JPEG 640×360 a 1fps ────────────────────────────
        private void StartSnapshotProcess(string rtspUrl, CancellationToken ct)
        {
            var psi = new ProcessStartInfo
            {
                FileName = _ffmpegPath,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };
            foreach (var a in new[] {
                "-rtsp_transport", "tcp",
                "-i", rtspUrl,
                "-vf", "fps=1,scale=640:360",
                "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "5",
                "-loglevel", "error", "pipe:1"
            }) psi.ArgumentList.Add(a);

            _ffSnap = new Process { StartInfo = psi, EnableRaisingEvents = true };
            _ffSnap.Start();
            _ffSnap.BeginErrorReadLine();
            _ffSnap.ErrorDataReceived += (_, __) => { };

            Task.Run(() => ReadSnapshots(_ffSnap, ct), ct);
        }

        private void ReadSnapshots(Process proc, CancellationToken ct)
        {
            var stream = proc.StandardOutput.BaseStream;
            var buf = new List<byte>(128 * 1024);
            var chunk = new byte[64 * 1024];
            try
            {
                while (!ct.IsCancellationRequested)
                {
                    int n = stream.Read(chunk, 0, chunk.Length);
                    if (n <= 0) break;
                    for (int k = 0; k < n; k++) buf.Add(chunk[k]);

                    // Extraer JPEGs completos (SOI FFD8 … EOI FFD9)
                    int i = 0;
                    while (i < buf.Count - 1)
                    {
                        if (buf[i] == 0xFF && buf[i + 1] == 0xD8)
                        {
                            int end = IndexOfEoi(buf, i + 2);
                            if (end == -1) break;
                            int len = end + 2 - i;
                            var jpeg = new byte[len];
                            buf.CopyTo(i, jpeg, 0, len);
                            OnSnapshot?.Invoke(jpeg);
                            i = end + 2;
                        }
                        else i++;
                    }
                    if (i > 0) buf.RemoveRange(0, i);
                    if (buf.Count > 4 * 1024 * 1024) buf.Clear(); // salvaguarda
                }
            }
            catch { /* terminó el stream */ }
        }

        private static int IndexOfEoi(List<byte> buf, int from)
        {
            for (int i = from; i < buf.Count - 1; i++)
                if (buf[i] == 0xFF && buf[i + 1] == 0xD9) return i;
            return -1;
        }
    }
}
