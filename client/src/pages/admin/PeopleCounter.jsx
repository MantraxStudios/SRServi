import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faVideo, faSatelliteDish, faChartColumn, faDownload, faArrowUp, faArrowDown,
  faCircle, faStop, faPlay, faCircleCheck, faRulerHorizontal, faRotate,
  faHourglassHalf, faTriangleExclamation, faGear, faLightbulb, faInbox, faCheck,
} from '@fortawesome/free-solid-svg-icons';
import { faWindows, faAndroid } from '@fortawesome/free-brands-svg-icons';

const API = 'https://srservi2.srautomatic.com';
const getToday = () => new Date().toISOString().slice(0, 10);
const DEFAULT_LINE = { x1: 0.15, y1: 0.5, x2: 0.85, y2: 0.5 };

// Downsampled grid for motion detection (fast pixel math, no ML)
const GRID_W = 80;
const GRID_H = 60;
const MIN_BLOB_CELLS = 12; // min grid cells to count as a blob
const CROSSING_COOLDOWN = 2500; // ms before same track can cross again

function getSide(px, py, x1, y1, x2, y2) {
  return (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
}

// Motion detection: compare two RGBA pixel arrays (downsampled), return motion mask
function buildMotionMask(curr, prev, threshold) {
  const mask = new Uint8Array(GRID_W * GRID_H);
  for (let i = 0; i < GRID_W * GRID_H; i++) {
    const p = i * 4;
    if (Math.abs(curr[p] - prev[p]) + Math.abs(curr[p + 1] - prev[p + 1]) + Math.abs(curr[p + 2] - prev[p + 2]) > threshold) {
      mask[i] = 1;
    }
  }
  // Single-pass dilation to merge nearby pixels
  const dilated = new Uint8Array(GRID_W * GRID_H);
  for (let y = 1; y < GRID_H - 1; y++) {
    for (let x = 1; x < GRID_W - 1; x++) {
      const i = y * GRID_W + x;
      if (mask[i] || mask[i - 1] || mask[i + 1] || mask[i - GRID_W] || mask[i + GRID_W]) dilated[i] = 1;
    }
  }
  return dilated;
}

// Connected-component labeling → blob centroids (normalized 0-1)
function findBlobs(mask) {
  const visited = new Uint8Array(GRID_W * GRID_H);
  const blobs = [];
  for (let start = 0; start < GRID_W * GRID_H; start++) {
    if (!mask[start] || visited[start]) continue;
    const stack = [start];
    const cells = [];
    visited[start] = 1;
    while (stack.length) {
      const cur = stack.pop();
      cells.push(cur);
      const x = cur % GRID_W, y = (cur / GRID_W) | 0;
      if (x > 0 && mask[cur - 1] && !visited[cur - 1]) { visited[cur - 1] = 1; stack.push(cur - 1); }
      if (x < GRID_W - 1 && mask[cur + 1] && !visited[cur + 1]) { visited[cur + 1] = 1; stack.push(cur + 1); }
      if (y > 0 && mask[cur - GRID_W] && !visited[cur - GRID_W]) { visited[cur - GRID_W] = 1; stack.push(cur - GRID_W); }
      if (y < GRID_H - 1 && mask[cur + GRID_W] && !visited[cur + GRID_W]) { visited[cur + GRID_W] = 1; stack.push(cur + GRID_W); }
    }
    if (cells.length < MIN_BLOB_CELLS) continue;
    const cx = cells.reduce((s, c) => s + (c % GRID_W), 0) / cells.length / GRID_W;
    const cy = cells.reduce((s, c) => s + ((c / GRID_W) | 0), 0) / cells.length / GRID_H;
    blobs.push({ cx, cy, size: cells.length });
  }
  return blobs;
}

export default function PeopleCounter() {
  const { token } = useAuth();
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;

  const [tab, setTab] = useState('live');
  const [isRunning, setIsRunning] = useState(false);
  const [isEditingLine, setIsEditingLine] = useState(false);
  const [lineConfig, setLineConfig] = useState(DEFAULT_LINE);
  const [flipDir, setFlipDir] = useState(false);
  const [counter, setCounter] = useState({ in: 0, out: 0 });
  const [cameras, setCameras] = useState([]);
  const [camId, setCamId] = useState('');
  const [sensitivity, setSensitivity] = useState(45); // motion threshold 20-80
  const [statsDate, setStatsDate] = useState(getToday);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // RTSP state
  const [rtspIp, setRtspIp] = useState('');
  const [rtspPort, setRtspPort] = useState('554');
  const [rtspUser, setRtspUser] = useState('');
  const [rtspPass, setRtspPass] = useState('');
  const [rtspPath, setRtspPath] = useState('stream1');
  const [rtspEnabled, setRtspEnabled] = useState(false);
  const [rtspSensitivity, setRtspSensitivity] = useState(30);
  const [rtspStatus, setRtspStatus] = useState({ running: false });
  const [rtspSaving, setRtspSaving] = useState(false);
  const [rtspMsg, setRtspMsg] = useState('');
  const rtspPollRef = useRef(null);
  const snapIntervalRef = useRef(null);
  const [snapTs, setSnapTs] = useState(0);
  const [agentStatus, setAgentStatus] = useState({ active: false, hasSnapshot: false });

  const rtspUrl = rtspIp
    ? `rtsp://${rtspUser ? encodeURIComponent(rtspUser) + (rtspPass ? ':' + encodeURIComponent(rtspPass) : '') + '@' : ''}${rtspIp}${rtspPort && rtspPort !== '554' ? ':' + rtspPort : ''}/${rtspPath}`
    : '';

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  // ── NUEVO: ref para el <img> MJPEG y canvas superpuesto al stream RTSP ──
  const mjpegImgRef = useRef(null);
  const rtspCanvasRef = useRef(null);
  // ────────────────────────────────────────────────────────────────────────────
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const tracksRef = useRef([]);
  const lineRef = useRef(DEFAULT_LINE);
  const flipRef = useRef(false);
  const isRunningRef = useRef(false);
  const animRef = useRef(null);
  // ── NUEVO: loop independiente para RTSP ──
  const rtspAnimRef = useRef(null);
  const rtspTracksRef = useRef([]);
  const rtspPrevFrameRef = useRef(null);
  const rtspOffscreenRef = useRef(null);
  const rtspNextIdRef = useRef(0);
  const rtspRunningRef = useRef(false);
  // ────────────────────────────────────────
  const nextIdRef = useRef(0);
  const counterResetRef = useRef({ in: 0, out: 0 });
  const dragRef = useRef(null);
  const storeIdRef = useRef(storeId);
  const tokenRef = useRef(token);
  const prevFrameRef = useRef(null);
  const offscreenRef = useRef(null);
  const sensitivityRef = useRef(sensitivity);
  const rtspSensitivityRef = useRef(rtspSensitivity);
  const mjpegLastFrameRef = useRef(Date.now());
  const mjpegReconnectRef = useRef(null);

  useEffect(() => { lineRef.current = lineConfig; }, [lineConfig]);
  useEffect(() => { flipRef.current = flipDir; }, [flipDir]);
  useEffect(() => { storeIdRef.current = storeId; }, [storeId]);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { sensitivityRef.current = sensitivity; }, [sensitivity]);
  useEffect(() => { rtspSensitivityRef.current = rtspSensitivity; }, [rtspSensitivity]);

  // Camera enumeration
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices()
      .then(d => {
        const cams = d.filter(x => x.kind === 'videoinput');
        setCameras(cams);
        if (cams.length) setCamId(cams[0].deviceId);
      }).catch(() => {});
    return () => {
      isRunningRef.current = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      stopRtspLoop();
    };
  }, []);

  // Load config from server
  useEffect(() => {
    if (!storeId || !token) return;
    fetch(`${API}/api/stores/${storeId}/people-counter/config`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return;
      if (d.line) {
        const safe = {
          x1: isFinite(d.line.x1) ? d.line.x1 : DEFAULT_LINE.x1,
          y1: isFinite(d.line.y1) ? d.line.y1 : DEFAULT_LINE.y1,
          x2: isFinite(d.line.x2) ? d.line.x2 : DEFAULT_LINE.x2,
          y2: isFinite(d.line.y2) ? d.line.y2 : DEFAULT_LINE.y2,
        };
        setLineConfig(safe); lineRef.current = safe;
      }
      if (d.flip !== undefined) { setFlipDir(d.flip); flipRef.current = d.flip; }
    }).catch(() => {});
  }, [storeId, token]);

  // Load today's running total on mount
  useEffect(() => {
    if (!storeId || !token) return;
    fetch(`${API}/api/stores/${storeId}/people-counter/stats?date=${getToday()}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.ok ? r.json() : null).then(d => {
      if (d) setCounter({ in: d.total?.in || 0, out: d.total?.out || 0 });
    }).catch(() => {});
  }, [storeId, token]);

  const loadStats = useCallback(async (date) => {
    if (!storeId || !token) return;
    setStatsLoading(true);
    try {
      const r = await fetch(`${API}/api/stores/${storeId}/people-counter/stats?date=${date || statsDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) setStats(await r.json());
    } finally { setStatsLoading(false); }
  }, [storeId, token, statsDate]);

  useEffect(() => { if (tab === 'stats') loadStats(statsDate); }, [tab]);

  // Cargar config RTSP y parsear URL guardada a campos
  useEffect(() => {
    if (!storeId || !token) return;
    fetch(`${API}/api/stores/${storeId}/people-counter/rtsp`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setRtspEnabled(!!d.rtsp_enabled);
        setRtspSensitivity(d.rtsp_sensitivity || 30);
        setRtspStatus({ running: d.running, in: d.in, out: d.out, error: d.error });
        if (d.rtsp_url) {
          try {
            const u = new URL(d.rtsp_url);
            setRtspIp(u.hostname);
            setRtspPort(u.port || '554');
            setRtspUser(decodeURIComponent(u.username || ''));
            setRtspPass(decodeURIComponent(u.password || ''));
            const p = u.pathname.replace(/^\//, '') + (u.search || '');
            setRtspPath(p || 'stream1');
          } catch { /* URL inválida */ }
        }
      }).catch(() => {});
  }, [storeId, token]);

  // Polling de estado RTSP + agente local
  useEffect(() => {
    if ((tab !== 'rtsp' && tab !== 'live') || !storeId || !token) {
      clearInterval(rtspPollRef.current);
      return;
    }
    const poll = () => {
      fetch(`${API}/api/stores/${storeId}/people-counter/rtsp/status`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setRtspStatus(d); })
        .catch(() => {});
      fetch(`${API}/api/stores/${storeId}/people-counter/agent-status`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setAgentStatus(d); })
        .catch(() => {});
    };
    poll();
    rtspPollRef.current = setInterval(poll, 5000);
    return () => clearInterval(rtspPollRef.current);
  }, [tab, storeId, token]);

  const rtspActive = rtspStatus.running || agentStatus.active;
  const mjpegUrl = rtspActive
    ? `${API}/api/stores/${storeId}/people-counter/mjpeg?token=${encodeURIComponent(token)}`
    : null;

  // ── NUEVO: arrancar/parar el loop de detección RTSP cuando cambia rtspActive ──
  useEffect(() => {
    if (rtspActive && mjpegUrl) {
      const t = setTimeout(() => startRtspLoop(), 800);
      return () => { clearTimeout(t); stopRtspLoop(); };
    } else {
      stopRtspLoop();
    }
  }, [rtspActive, mjpegUrl]);

  // MJPEG stall detection: if no new frame is drawn for 30s, reconnect the img
  useEffect(() => {
    if (!rtspActive || !mjpegUrl) {
      clearInterval(mjpegReconnectRef.current);
      return;
    }
    mjpegLastFrameRef.current = Date.now();
    const check = setInterval(() => {
      const elapsed = Date.now() - mjpegLastFrameRef.current;
      if (elapsed > 30000 && mjpegImgRef.current) {
        const sep = mjpegUrl.includes('?') ? '&' : '?';
        mjpegImgRef.current.src = mjpegUrl + sep + '_r=' + Date.now();
        mjpegLastFrameRef.current = Date.now();
        rtspPrevFrameRef.current = null;
      }
    }, 10000);
    mjpegReconnectRef.current = check;
    return () => clearInterval(check);
  }, [rtspActive, mjpegUrl]);

  // Cuando RTSP está activo, refrescar contador desde DB cada 5s
  useEffect(() => {
    if (!rtspActive || !storeId || !token) return;
    const refresh = () => {
      fetch(`${API}/api/stores/${storeId}/people-counter/stats?date=${getToday()}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.ok ? r.json() : null)
        .then(d => {
        if (d) {
          const base = counterResetRef.current;
          setCounter({
            in: Math.max(0, (d.total?.in || 0) - base.in),
            out: Math.max(0, (d.total?.out || 0) - base.out),
          });
        }
      })
        .catch(() => {});
    };
    refresh();
    const iv = setInterval(refresh, 5000);
    return () => clearInterval(iv);
  }, [rtspActive, storeId, token]);

  async function saveRTSP() {
    if (!storeId || !token) return;
    setRtspSaving(true); setRtspMsg('');
    try {
      const res = await fetch(`${API}/api/stores/${storeId}/people-counter/rtsp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rtsp_url: rtspUrl, rtsp_enabled: rtspEnabled, rtsp_sensitivity: rtspSensitivity }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error');
      setRtspMsg(rtspEnabled ? 'Stream iniciado en segundo plano' : 'Stream detenido');
      setTimeout(() => setRtspMsg(''), 3000);
    } catch (e) {
      setRtspMsg('Error: ' + e.message);
    } finally {
      setRtspSaving(false);
    }
  }

  // ── Camera (webcam) ───────────────────────────────────────────────────────────

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: camId ? { exact: camId } : undefined, width: { ideal: 640 }, height: { ideal: 480 } }
      });
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play();
        prevFrameRef.current = null;
        isRunningRef.current = true;
        setIsRunning(true);
        animRef.current = requestAnimationFrame(detectLoop);
      };
    } catch (e) {
      alert('No se pudo acceder a la cámara: ' + e.message);
    }
  };

  const stopCamera = () => {
    isRunningRef.current = false;
    setIsRunning(false);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    tracksRef.current = [];
    prevFrameRef.current = null;
    const c = canvasRef.current;
    if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  };

  // ── Motion detection loop — WEBCAM ───────────────────────────────────────────

  const detectLoop = () => {
    if (!isRunningRef.current) return;
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const W = video.videoWidth || 640, H = video.videoHeight || 360;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

    if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas');
    const off = offscreenRef.current;
    off.width = GRID_W; off.height = GRID_H;
    const offCtx = off.getContext('2d', { willReadFrequently: true });
    offCtx.drawImage(video, 0, 0, GRID_W, GRID_H);
    const currFrame = offCtx.getImageData(0, 0, GRID_W, GRID_H).data;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    if (prevFrameRef.current) {
      const mask = buildMotionMask(currFrame, prevFrameRef.current, sensitivityRef.current);
      const blobs = findBlobs(mask);

      const line = lineRef.current;
      const now = Date.now();
      const maxD = 0.18;
      const used = new Set();
      const next = [];

      for (const blob of blobs) {
        let best = null, bestD = maxD;
        for (const tr of tracksRef.current) {
          if (used.has(tr.id)) continue;
          const d = Math.hypot(blob.cx - tr.cx, blob.cy - tr.cy);
          if (d < bestD) { bestD = d; best = tr; }
        }

        const rawSide = getSide(blob.cx, blob.cy, line.x1, line.y1, line.x2, line.y2) > 0 ? 1 : -1;
        const side = flipRef.current ? -rawSide : rawSide;

        if (best) {
          used.add(best.id);
          const canCount = best.side !== null && best.side !== side && (now - (best.lastCross || 0) > CROSSING_COOLDOWN);
          if (canCount) handleCrossing(side === 1 ? 'in' : 'out');
          next.push({ ...best, cx: blob.cx, cy: blob.cy, side, lastSeen: now, blob,
            lastCross: canCount ? now : best.lastCross });
        } else {
          next.push({ id: nextIdRef.current++, cx: blob.cx, cy: blob.cy, side, lastSeen: now, blob, lastCross: 0 });
        }
      }

      tracksRef.current = [...next, ...tracksRef.current.filter(t => !used.has(t.id) && now - t.lastSeen < 1200)];

      // Dibujar círculos sobre blobs detectados
      for (const tr of tracksRef.current) {
        const bx = tr.cx * W, by = tr.cy * H;
        const r = Math.sqrt(tr.blob.size / (GRID_W * GRID_H)) * Math.min(W, H) * 0.7;
        ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(bx, by, Math.max(r, 14), 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(34,197,94,0.12)';
        ctx.beginPath(); ctx.arc(bx, by, Math.max(r, 14), 0, Math.PI * 2); ctx.fill();
      }
    }

    prevFrameRef.current = currFrame;
    animRef.current = requestAnimationFrame(detectLoop);
  };

  // ── Motion detection loop — RTSP/MJPEG ───────────────────────────────────────
  // Captura frames del <img> MJPEG usando un canvas oculto y aplica el mismo
  // algoritmo de detección que la webcam, dibujando los blobs sobre rtspCanvasRef.

  const startRtspLoop = () => {
    if (rtspRunningRef.current) return;
    rtspRunningRef.current = true;
    rtspPrevFrameRef.current = null;
    rtspTracksRef.current = [];
    scheduleRtspFrame();
  };

  const stopRtspLoop = () => {
    rtspRunningRef.current = false;
    if (rtspAnimRef.current) {
      cancelAnimationFrame(rtspAnimRef.current);
      clearTimeout(rtspAnimRef.current);
      rtspAnimRef.current = null;
    }
    rtspPrevFrameRef.current = null;
    rtspTracksRef.current = [];
    const c = rtspCanvasRef.current;
    if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  };

  const scheduleRtspFrame = () => {
    if (!rtspRunningRef.current) return;
    rtspAnimRef.current = requestAnimationFrame(() => {
      rtspDetectFrame();
    });
  };

  const rtspDetectFrame = () => {
    if (!rtspRunningRef.current) return;
    const img = mjpegImgRef.current;
    const canvas = rtspCanvasRef.current;

    // NOTA: NO usamos `img.complete` aquí. Para streams MJPEG
    // (multipart/x-mixed-replace) Chrome/Firefox no marcan `complete = true`
    // de forma confiable tras el primer frame, aunque la imagen se esté
    // actualizando y `naturalWidth/naturalHeight` ya tengan valores válidos.
    // Si dependemos de `img.complete`, este loop nunca avanza más allá del
    // primer frame y el conteo RTSP nunca corre (aunque el video se vea bien).
    if (!img || !canvas || !img.naturalWidth || !img.naturalHeight) {
      // imagen aún no lista, reintenta
      rtspAnimRef.current = setTimeout(scheduleRtspFrame, 100);
      return;
    }

    const W = img.naturalWidth || img.clientWidth || 640;
    const H = img.naturalHeight || img.clientHeight || 360;

    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }

    // Captura frame downsampled en offscreen
    if (!rtspOffscreenRef.current) rtspOffscreenRef.current = document.createElement('canvas');
    const off = rtspOffscreenRef.current;
    off.width = GRID_W; off.height = GRID_H;
    let offCtx;
    try {
      offCtx = off.getContext('2d', { willReadFrequently: true });
      offCtx.drawImage(img, 0, 0, GRID_W, GRID_H);
    } catch {
      // CORS u otro error al leer el frame — reintentar
      rtspAnimRef.current = setTimeout(scheduleRtspFrame, 200);
      return;
    }

    let currFrame;
    try {
      currFrame = offCtx.getImageData(0, 0, GRID_W, GRID_H).data;
    } catch {
      rtspAnimRef.current = setTimeout(scheduleRtspFrame, 200);
      return;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    if (rtspPrevFrameRef.current) {
      const mask = buildMotionMask(currFrame, rtspPrevFrameRef.current, rtspSensitivityRef.current);
      const blobs = findBlobs(mask);

      const line = lineRef.current;
      const now = Date.now();
      const maxD = 0.18;
      const used = new Set();
      const next = [];

      for (const blob of blobs) {
        let best = null, bestD = maxD;
        for (const tr of rtspTracksRef.current) {
          if (used.has(tr.id)) continue;
          const d = Math.hypot(blob.cx - tr.cx, blob.cy - tr.cy);
          if (d < bestD) { bestD = d; best = tr; }
        }

        const rawSide = getSide(blob.cx, blob.cy, line.x1, line.y1, line.x2, line.y2) > 0 ? 1 : -1;
        const side = flipRef.current ? -rawSide : rawSide;

        if (best) {
          used.add(best.id);
          const crossed = best.side !== null && best.side !== side && (now - (best.lastCross || 0) > CROSSING_COOLDOWN);
          if (crossed) handleCrossing(side === 1 ? 'in' : 'out');
          next.push({ ...best, cx: blob.cx, cy: blob.cy, side, lastSeen: now, blob,
            lastCross: crossed ? now : best.lastCross });
        } else {
          next.push({ id: rtspNextIdRef.current++, cx: blob.cx, cy: blob.cy, side, lastSeen: now, blob, lastCross: 0 });
        }
      }

      rtspTracksRef.current = [...next, ...rtspTracksRef.current.filter(t => !used.has(t.id) && now - t.lastSeen < 1200)];

      // Dibujar círculos sobre blobs en el canvas RTSP
      for (const tr of rtspTracksRef.current) {
        const bx = tr.cx * W, by = tr.cy * H;
        const r = Math.sqrt(tr.blob.size / (GRID_W * GRID_H)) * Math.min(W, H) * 0.7;
        ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(bx, by, Math.max(r, 14), 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(34,197,94,0.12)';
        ctx.beginPath(); ctx.arc(bx, by, Math.max(r, 14), 0, Math.PI * 2); ctx.fill();
      }
    }

    rtspPrevFrameRef.current = currFrame;
    mjpegLastFrameRef.current = Date.now();
    // ~10 fps
    rtspAnimRef.current = setTimeout(scheduleRtspFrame, 100);
  };

  // ─────────────────────────────────────────────────────────────────────────────

  const handleCrossing = (dir) => {
    setCounter(prev => ({ ...prev, [dir]: prev[dir] + 1 }));
    const sid = storeIdRef.current, tok = tokenRef.current;
    if (sid && tok) {
      fetch(`${API}/api/stores/${sid}/people-counter/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ direction: dir, crossed_at: new Date().toISOString() })
      }).catch(() => {});
    }
  };

  const autoSaveConfig = useCallback(async (line, flip) => {
    if (!storeIdRef.current || !tokenRef.current) return;
    try {
      await fetch(`${API}/api/stores/${storeIdRef.current}/people-counter/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ line, flip })
      });
    } catch (_) {}
  }, []);

  // ── Line drag (zero React re-renders during drag) ────────────────────────────

  const getRelPos = (e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: Math.max(0, Math.min(1, (src.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (src.clientY - rect.top) / rect.height))
    };
  };

  const onDown = (e) => {
    if (!isEditingLine) return;
    e.preventDefault();
    const { x, y } = getRelPos(e);
    const l = lineRef.current;
    if (Math.hypot(x - l.x1, y - l.y1) < 0.07) dragRef.current = 'p1';
    else if (Math.hypot(x - l.x2, y - l.y2) < 0.07) dragRef.current = 'p2';
  };

  const onMove = (e) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const { x, y } = getRelPos(e);
    const next = dragRef.current === 'p1'
      ? { ...lineRef.current, x1: x, y1: y }
      : { ...lineRef.current, x2: x, y2: y };
    lineRef.current = next;
    setLineConfig(next);
  };

  const onUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    autoSaveConfig(lineRef.current, flipRef.current);
  };

  // ── Stats ────────────────────────────────────────────────────────────────────

  const maxHourly = stats ? Math.max(1, ...stats.hourly.map(h => h.in + h.out)) : 1;

  // SVG de línea — compartido entre webcam y RTSP
  const renderCountingLine = () => {
    const raw = lineConfig;
    const x1 = isFinite(raw.x1) ? raw.x1 : DEFAULT_LINE.x1;
    const y1 = isFinite(raw.y1) ? raw.y1 : DEFAULT_LINE.y1;
    const x2 = isFinite(raw.x2) ? raw.x2 : DEFAULT_LINE.x2;
    const y2 = isFinite(raw.y2) ? raw.y2 : DEFAULT_LINE.y2;
    const mx = (x1 + x2) / 2 * 100, my = (y1 + y2) / 2 * 100;
    const dx = x2 - x1, dy = y2 - y1;
    const dl = Math.hypot(dx, dy) || 1;
    const off = 30;
    const tx = -dy / dl * off, ty = dx / dl * off;
    const labelStyle = { paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.55)', strokeWidth: 3 };
    return (
      <>
        <line x1={`${x1 * 100}%`} y1={`${y1 * 100}%`} x2={`${x2 * 100}%`} y2={`${y2 * 100}%`}
          stroke="#D4AF37" strokeWidth={3} strokeDasharray="12 5" />
        {[[x1, y1], [x2, y2]].map(([x, y], i) => (
          <circle key={i} cx={`${x * 100}%`} cy={`${y * 100}%`} r={isEditingLine ? 11 : 9}
            fill="#D4AF37" stroke="rgba(0,0,0,0.5)" strokeWidth={1.5} />
        ))}
        <text x={`${mx}%`} y={`${my}%`} transform={`translate(${tx}, ${ty + 5})`} textAnchor="middle"
          fontSize={13} fontWeight="bold" fill="#22c55e" style={labelStyle}>{flipDir ? 'SALIDA' : 'ENTRADA'}</text>
        <text x={`${mx}%`} y={`${my}%`} transform={`translate(${-tx}, ${-ty + 5})`} textAnchor="middle"
          fontSize={13} fontWeight="bold" fill="#ef4444" style={labelStyle}>{flipDir ? 'ENTRADA' : 'SALIDA'}</text>
      </>
    );
  };

  return (
    <div className="pc-wrap" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111' }}>Contador de Aforo</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Detección por movimiento en tiempo real — sin descarga de modelos</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['live', faVideo, 'En Vivo'], ['rtsp', faSatelliteDish, 'Cámara RTSP'], ['stats', faChartColumn, 'Estadísticas']].map(([t, icon, lbl]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                background: tab === t ? '#D4AF37' : '#f3f4f6', color: tab === t ? '#000' : '#374151' }}>
              <FontAwesomeIcon icon={icon} /> {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Descargas AforoBridge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#111', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ color: '#D4AF37', fontWeight: 800, fontSize: 14 }}><FontAwesomeIcon icon={faDownload} /> App AforoBridge</div>
          <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>
            Instálala en el PC o celular del local para conectar tu cámara IP y contar en segundo plano.
          </div>
        </div>
        <a href={`${API}/api/download/aforo-windows`} download="AforoBridge-Windows.zip"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#D4AF37', color: '#000', fontWeight: 800, fontSize: 13, padding: '10px 16px', borderRadius: 9, textDecoration: 'none' }}>
          <FontAwesomeIcon icon={faWindows} /> Windows (.zip)
        </a>
        <a href={`${API}/api/download/aforo-android`} download="AforoBridge-Android.apk"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: '#111', fontWeight: 800, fontSize: 13, padding: '10px 16px', borderRadius: 9, textDecoration: 'none' }}>
          <FontAwesomeIcon icon={faAndroid} /> Android (.apk)
        </a>
      </div>

      {/* ── LIVE TAB ── */}
      {tab === 'live' && (
        <>
          {/* Counter cards */}
          <div className="pc-counter-cards">
            {[
              { label: 'Entradas hoy', value: counter.in, color: '#22c55e', bg: '#f0fdf4' },
              { label: 'Salidas hoy', value: counter.out, color: '#ef4444', bg: '#fef2f2' },
              { label: 'Total visitas', value: counter.in, color: '#D4AF37', bg: '#fffbeb' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 12, padding: '16px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Línea de conteo */}
          <div style={{ background: '#f9fafb', borderRadius: 12, padding: 16, border: '2px solid #D4AF37', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#374151', whiteSpace: 'nowrap' }}>
                <FontAwesomeIcon icon={faRulerHorizontal} style={{ marginRight: 7, color: '#D4AF37' }} />
                Línea de conteo
              </span>
              <button onClick={() => setIsEditingLine(e => !e)}
                style={{ flex: '1 1 auto', minWidth: 180, padding: '10px 14px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  background: isEditingLine ? '#fffbeb' : '#fff',
                  border: `1.5px solid ${isEditingLine ? '#D4AF37' : '#d1d5db'}`,
                  color: isEditingLine ? '#92400e' : '#374151' }}>
                {isEditingLine
                  ? <><FontAwesomeIcon icon={faCircleCheck} /> Listo — guardado automático</>
                  : <><FontAwesomeIcon icon={faRulerHorizontal} /> Ajustar línea en el video</>}
              </button>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={flipDir}
                  onChange={e => { const v = e.target.checked; setFlipDir(v); flipRef.current = v; autoSaveConfig(lineRef.current, v); }}
                  style={{ width: 16, height: 16, accentColor: '#D4AF37' }} />
                <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Invertir entrada / salida</span>
              </label>
            </div>
            {isEditingLine && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12, color: '#92400e', fontWeight: 600 }}>
                <FontAwesomeIcon icon={faRulerHorizontal} /> Arrastra los puntos dorados sobre el video para reposicionar la línea
              </div>
            )}
          </div>

          <div className="pc-live-grid">
            {/* Camera view — RTSP o webcam */}
            <div style={{ background: '#111', borderRadius: 14, overflow: 'hidden' }}>
              <div ref={containerRef} style={{ position: 'relative', width: '100%', minHeight: 340 }}>

                {/* Badge fuente de video */}
                <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: rtspActive ? 'rgba(34,197,94,0.9)' : 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, pointerEvents: 'none' }}>
                  <FontAwesomeIcon icon={rtspActive ? faSatelliteDish : faVideo} /> {rtspActive ? 'RTSP' : 'Webcam'}
                </div>

                {/* ── Video RTSP (MJPEG) — con canvas de blobs superpuesto ── */}
                {rtspActive && mjpegUrl ? (
                  <>
                    <img
                      ref={mjpegImgRef}
                      key={mjpegUrl}
                      src={mjpegUrl}
                      crossOrigin="anonymous"
                      style={{ width: '100%', display: 'block', minHeight: 340, background: '#000', objectFit: 'cover' }}
                      alt="rtsp"
                      onError={() => {
                        setTimeout(() => {
                          if (mjpegImgRef.current && mjpegUrl) {
                            const sep = mjpegUrl.includes('?') ? '&' : '?';
                            mjpegImgRef.current.src = mjpegUrl + sep + '_r=' + Date.now();
                          }
                        }, 3000);
                      }}
                    />
                    {/* Canvas para blobs RTSP — superpuesto sobre el <img> */}
                    <canvas ref={rtspCanvasRef}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 4, pointerEvents: 'none' }}
                    />
                  </>
                ) : (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted
                      style={{ width: '100%', display: 'block', minHeight: 340, background: '#000', objectFit: 'cover' }} />
                    {/* Canvas para blobs webcam */}
                    <canvas ref={canvasRef}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 4, pointerEvents: 'none' }}
                    />
                  </>
                )}

                {/* SVG línea de conteo — siempre visible sobre cualquier fuente */}
                <svg ref={svgRef}
                  preserveAspectRatio="none"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 5,
                    cursor: isEditingLine ? 'crosshair' : 'default', touchAction: 'none', overflow: 'visible' }}
                  onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
                  onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
                >
                  {renderCountingLine()}
                </svg>

                {/* Contadores en vivo */}
                {(isRunning || rtspActive) && (
                  <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 6, display: 'flex', gap: 8, pointerEvents: 'none' }}>
                    <span style={{ background: 'rgba(34,197,94,0.9)', color: '#fff', fontSize: 14, fontWeight: 800, padding: '5px 12px', borderRadius: 20 }}><FontAwesomeIcon icon={faArrowUp} /> {counter.in}</span>
                    <span style={{ background: 'rgba(239,68,68,0.9)', color: '#fff', fontSize: 14, fontWeight: 800, padding: '5px 12px', borderRadius: 20 }}><FontAwesomeIcon icon={faArrowDown} /> {counter.out}</span>
                  </div>
                )}

                {isEditingLine && (
                  <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 6,
                    background: 'rgba(0,0,0,0.75)', color: '#D4AF37', fontSize: 12, fontWeight: 700,
                    padding: '7px 16px', borderRadius: 20, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                    Arrastra los puntos dorados para posicionar la línea
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rtspActive ? (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: '#f0fdf4', border: '1.5px solid #86efac', fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 2 }}><FontAwesomeIcon icon={faCircle} style={{ color: '#ef4444', fontSize: 10 }} /> Cámara RTSP activa</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Detección activa en cliente y servidor. Ajusta la línea abajo y se aplica automáticamente.</div>
                </div>
              ) : (
                <>
                  {cameras.length > 1 && (
                    <div>
                      <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, display: 'block', marginBottom: 5 }}>Cámara del dispositivo</label>
                      <select value={camId} onChange={e => setCamId(e.target.value)} disabled={isRunning}
                        style={{ width: '100%', padding: '9px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}>
                        {cameras.map((c, i) => <option key={c.deviceId} value={c.deviceId}>{c.label || `Cámara ${i + 1}`}</option>)}
                      </select>
                    </div>
                  )}
                  <button onClick={isRunning ? stopCamera : startCamera}
                    style={{ padding: '13px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 15, cursor: 'pointer',
                      background: isRunning ? '#fee2e2' : '#D4AF37', color: isRunning ? '#dc2626' : '#000' }}>
                    {isRunning ? <><FontAwesomeIcon icon={faStop} /> Detener</> : <><FontAwesomeIcon icon={faPlay} /> Iniciar detección (webcam)</>}
                  </button>
                </>
              )}

              {/* Sensitivity */}
              <div style={{ background: '#f9fafb', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Sensibilidad de movimiento</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#D4AF37' }}>
                    {(rtspActive ? rtspSensitivity : sensitivity) > 60 ? 'Baja' : (rtspActive ? rtspSensitivity : sensitivity) > 35 ? 'Media' : 'Alta'}
                  </span>
                </div>
                <input type="range" min="15" max="80"
                  value={rtspActive ? rtspSensitivity : sensitivity}
                  onChange={e => rtspActive ? setRtspSensitivity(Number(e.target.value)) : setSensitivity(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#D4AF37' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                  <span>Alta (detecta todo)</span><span>Baja (solo grandes)</span>
                </div>
              </div>

              <button onClick={() => {
                counterResetRef.current = {
                  in: counter.in + counterResetRef.current.in,
                  out: counter.out + counterResetRef.current.out,
                };
                setCounter({ in: 0, out: 0 });
              }}
                style={{ padding: '9px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                <FontAwesomeIcon icon={faRotate} /> Reiniciar conteo
              </button>

              <div style={{ background: '#fffbeb', borderRadius: 10, padding: '12px 14px', border: '1px solid #fde68a', fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
                <strong>Consejos:</strong><br />
                • Cámara fija mirando perpendicular al paso<br />
                • La línea debe cruzar todo el ancho de la entrada<br />
                • Si hay falsos conteos, baja la sensibilidad
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── RTSP TAB ── */}
      {tab === 'rtsp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {(() => {
            const connected = rtspStatus.running && rtspStatus.hasSnapshot;
            const connecting = rtspStatus.running && !rtspStatus.hasSnapshot && !rtspStatus.error;
            const agentOk = agentStatus.active;

            if (connected || agentOk) {
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 12, background: '#f0fdf4', border: '1.5px solid #86efac' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 3px #bbf7d0', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: '#15803d', fontSize: 14 }}><FontAwesomeIcon icon={faCircle} style={{ color: '#ef4444', fontSize: 10 }} /> Conectado — grabando en tiempo real</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      Entradas: {rtspStatus.in ?? 0} · Salidas: {rtspStatus.out ?? 0} · La vista previa aparece abajo <FontAwesomeIcon icon={faArrowDown} />
                    </div>
                  </div>
                </div>
              );
            }

            if (connecting) {
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 12, background: '#fffbeb', border: '1.5px solid #fde68a' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                  <div style={{ fontWeight: 600, color: '#92400e', fontSize: 14 }}><FontAwesomeIcon icon={faHourglassHalf} /> Conectado — esperando primer frame…</div>
                </div>
              );
            }

            if (!rtspEnabled) {
              return (
                <div style={{ padding: '14px 18px', borderRadius: 12, background: '#f9fafb', border: '1.5px solid #e5e7eb', fontSize: 13, color: '#6b7280' }}>
                  Stream inactivo. Completa los datos y activa el toggle para iniciar.
                </div>
              );
            }

            return null;
          })()}

          {rtspStatus.error && (
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1.5px solid #fca5a5' }}>
              <div style={{ background: '#fef2f2', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 16, color: '#dc2626' }} />
                <span style={{ fontWeight: 700, color: '#dc2626', fontSize: 14 }}>
                  {rtspStatus.error.includes('401') ? 'Credenciales incorrectas (usuario/contraseña)' :
                   rtspStatus.error.includes('406') ? 'Canal de stream incorrecto' :
                   rtspStatus.error.includes('refused') ? 'Cámara no responde en esa IP/puerto' :
                   rtspStatus.error.includes('timeout') ? 'Tiempo agotado — verifica la IP' :
                   'Error de conexión'}
                </span>
              </div>
              <div style={{ background: '#fff', padding: '12px 16px', fontSize: 13 }}>
                {rtspStatus.error.includes('401') ? (
                  <div>
                    <p style={{ margin: '0 0 8px', color: '#374151' }}>El usuario/contraseña RTSP son distintos a tu cuenta TP-Link:</p>
                    <ol style={{ margin: 0, paddingLeft: 20, color: '#6b7280', lineHeight: 1.8 }}>
                      <li>App Tapo → selecciona la cámara → <FontAwesomeIcon icon={faGear} /> Ajustes</li>
                      <li><strong>"Cuenta de cámara"</strong> → Activar RTSP → crear usuario y contraseña</li>
                      <li>Usa <em>esos datos</em> en el formulario, no tu email TP-Link</li>
                    </ol>
                  </div>
                ) : rtspStatus.error.includes('406') ? (
                  <div>
                    <p style={{ margin: '0 0 8px', color: '#374151' }}>El canal indicado no existe en esta cámara. Prueba:</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {['stream1', 'stream2', 'h264Preview_01_main', 'Streaming/Channels/101'].map(s => (
                        <button key={s} onClick={() => setRtspPath(s)}
                          style={{ padding: '5px 12px', background: rtspPath === s ? '#111' : '#f3f4f6', color: rtspPath === s ? '#fff' : '#374151', border: 'none', borderRadius: 6, fontFamily: 'monospace', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9ca3af' }}>Toca una opción y vuelve a guardar</p>
                  </div>
                ) : (
                  <code style={{ fontSize: 11, color: '#6b7280', wordBreak: 'break-all' }}>{rtspStatus.error}</code>
                )}
              </div>
            </div>
          )}

          {/* Formulario */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 22, border: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700, color: '#374151' }}><FontAwesomeIcon icon={faSatelliteDish} /> Datos de la cámara</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>IP de la cámara</label>
                <input value={rtspIp} onChange={e => setRtspIp(e.target.value)} placeholder="192.168.1.10"
                  style={{ width: '100%', padding: '11px 12px', border: '1.5px solid #d1d5db', borderRadius: 9, fontSize: 15, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Puerto</label>
                <input value={rtspPort} onChange={e => setRtspPort(e.target.value)} placeholder="554"
                  style={{ width: '100%', padding: '11px 10px', border: '1.5px solid #d1d5db', borderRadius: 9, fontSize: 15, boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Usuario</label>
                <input value={rtspUser} onChange={e => setRtspUser(e.target.value)} placeholder="admin"
                  style={{ width: '100%', padding: '11px 12px', border: '1.5px solid #d1d5db', borderRadius: 9, fontSize: 15, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Contraseña</label>
                <input type="password" value={rtspPass} onChange={e => setRtspPass(e.target.value)} placeholder="••••••"
                  style={{ width: '100%', padding: '11px 12px', border: '1.5px solid #d1d5db', borderRadius: 9, fontSize: 15, boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                Canal / Stream <span style={{ fontWeight: 400, color: '#9ca3af' }}>(ej: stream1, stream2, Streaming/Channels/101)</span>
              </label>
              <input value={rtspPath} onChange={e => setRtspPath(e.target.value)} placeholder="stream1"
                style={{ width: '100%', padding: '11px 12px', border: '1.5px solid #d1d5db', borderRadius: 9, fontSize: 15, boxSizing: 'border-box', fontFamily: 'monospace' }} />
            </div>

            {rtspUrl && (
              <div style={{ padding: '9px 13px', background: '#f1f5f9', borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#64748b', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {rtspUrl.replace(/:([^@]+)@/, ':••••@')}
              </div>
            )}

            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              Sensibilidad: <strong>{rtspSensitivity}</strong>
            </label>
            <input type="range" min={10} max={80} value={rtspSensitivity} onChange={e => setRtspSensitivity(Number(e.target.value))}
              style={{ width: '100%', marginBottom: 4 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginBottom: 18 }}>
              <span>Menos sensible</span><span>Más sensible</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Conteo automático en segundo plano</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Sigue contando aunque cierres esta página</div>
              </div>
              <button onClick={() => setRtspEnabled(p => !p)}
                style={{ width: 52, height: 28, borderRadius: 99, border: 'none', cursor: 'pointer', padding: 0, background: rtspEnabled ? '#22c55e' : '#d1d5db', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: rtspEnabled ? 27 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
            </div>

            {rtspMsg && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 9, background: rtspMsg.startsWith('Error') ? '#fef2f2' : '#f0fdf4', color: rtspMsg.startsWith('Error') ? '#ef4444' : '#16a34a', fontSize: 13, marginBottom: 12, fontWeight: 600 }}>
                <FontAwesomeIcon icon={rtspMsg.startsWith('Error') ? faTriangleExclamation : faCheck} />
                {rtspMsg}
              </div>
            )}

            <button onClick={saveRTSP} disabled={rtspSaving || !rtspIp.trim()}
              style={{ width: '100%', padding: '13px', background: rtspSaving || !rtspIp.trim() ? '#9ca3af' : rtspEnabled ? '#16a34a' : '#374151', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: rtspSaving || !rtspIp.trim() ? 'not-allowed' : 'pointer' }}>
              {rtspSaving ? 'Guardando...' : rtspEnabled ? <><FontAwesomeIcon icon={faPlay} /> Activar cámara</> : <><FontAwesomeIcon icon={faStop} /> Guardar y desactivar</>}
            </button>
          </div>

          {/* Preview MJPEG */}
          {mjpegUrl && (
            <div style={{ background: '#fff', borderRadius: 14, padding: 18, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#374151' }}>Vista previa en vivo</h3>
                <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}><FontAwesomeIcon icon={faCircle} style={{ fontSize: 8 }} /> en vivo</span>
              </div>
              <div style={{ borderRadius: 10, overflow: 'hidden', background: '#111', aspectRatio: '16/9' }}>
                <img
                  key={mjpegUrl}
                  src={mjpegUrl}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  alt="preview"
                  onError={(e) => {
                    setTimeout(() => {
                      if (mjpegUrl) {
                        const sep = mjpegUrl.includes('?') ? '&' : '?';
                        e.target.src = mjpegUrl + sep + '_r=' + Date.now();
                      }
                    }, 3000);
                  }}
                />
              </div>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '8px 0 0' }}>
                Stream MJPEG directo — hasta 15fps según la cámara
              </p>
            </div>
          )}

          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 13, color: '#92400e' }}>
            <FontAwesomeIcon icon={faLightbulb} /> La línea de detección configurada en <em>En Vivo</em> también aplica al conteo RTSP.
          </div>
        </div>
      )}

      {/* ── STATS TAB ── */}
      {tab === 'stats' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <input type="date" value={statsDate} onChange={e => setStatsDate(e.target.value)} max={getToday()}
              style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
            <button onClick={() => loadStats(statsDate)} disabled={statsLoading}
              style={{ padding: '9px 20px', background: '#D4AF37', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {statsLoading ? '...' : 'Ver datos'}
            </button>
          </div>

          {stats && (
            <>
              <div className="pc-stats-grid">
                {[
                  { label: 'Entradas', value: stats.total?.in || 0, color: '#22c55e', bg: '#f0fdf4' },
                  { label: 'Salidas', value: stats.total?.out || 0, color: '#ef4444', bg: '#fef2f2' },
                  { label: 'Pico de hora', value: Math.max(0, ...(stats.hourly || []).map(h => h.in + h.out)), color: '#D4AF37', bg: '#fffbeb' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 12, padding: 20, textAlign: 'center' }}>
                    <div style={{ fontSize: 36, fontWeight: 900, color }}>{value}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6, fontWeight: 600 }}>{label}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 24, marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 20, color: '#111' }}>Tráfico por hora — {statsDate}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160, padding: '0 4px' }}>
                  {Array.from({ length: 24 }, (_, h) => {
                    const hd = stats.hourly?.find(x => x.hour === h) || { in: 0, out: 0 };
                    const total = hd.in + hd.out;
                    const barH = Math.max(total > 0 ? 10 : 2, (total / maxHourly) * 130);
                    return (
                      <div key={h} title={`${h}:00 — Entradas: ${hd.in}, Salidas: ${hd.out}`}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        {total > 0 && <div style={{ fontSize: 9, fontWeight: 800, color: '#374151' }}>{total}</div>}
                        <div style={{ width: '100%', borderRadius: '3px 3px 0 0', background: total > 0 ? '#D4AF37' : '#f3f4f6', height: barH, transition: 'height 0.3s' }} />
                        <div style={{ fontSize: 8, color: '#9ca3af', fontWeight: 600 }}>{h}h</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {stats.hourly?.filter(h => h.in + h.out > 0).length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 24 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16 }}>Detalle por hora</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                        {['Hora', 'Entradas', 'Salidas', 'Total'].map((h, i) => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : 'right', color: '#6b7280', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.hourly.filter(h => h.in + h.out > 0).map(h => (
                        <tr key={h.hour} style={{ borderBottom: '1px solid #f9fafb' }}>
                          <td style={{ padding: '9px 12px', fontWeight: 700, color: '#374151' }}>{String(h.hour).padStart(2, '0')}:00 – {String(h.hour + 1).padStart(2, '0')}:00</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', color: '#22c55e', fontWeight: 800 }}>{h.in}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 800 }}>{h.out}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 900 }}>{h.in + h.out}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {stats.hourly?.filter(h => h.in + h.out > 0).length === 0 && (
                <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}><FontAwesomeIcon icon={faInbox} /></div>
                  <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>Sin registros para esta fecha</div>
                  <div style={{ fontSize: 13 }}>No se detectaron cruces el {statsDate}</div>
                </div>
              )}
            </>
          )}

          {!stats && !statsLoading && (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}><FontAwesomeIcon icon={faChartColumn} /></div>
              <div>Selecciona una fecha y presiona <strong>Ver datos</strong></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
