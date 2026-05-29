import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../components/Layout';

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
  const [sensitivity, setSensitivity] = useState(45); // motion threshold 20–80
  const [statsDate, setStatsDate] = useState(getToday);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const tracksRef = useRef([]);
  const lineRef = useRef(DEFAULT_LINE);
  const flipRef = useRef(false);
  const isRunningRef = useRef(false);
  const animRef = useRef(null);
  const nextIdRef = useRef(0);
  const dragRef = useRef(null);
  const dragAnimRef = useRef(null);
  const storeIdRef = useRef(storeId);
  const tokenRef = useRef(token);
  const prevFrameRef = useRef(null);
  const offscreenRef = useRef(null);
  const sensitivityRef = useRef(sensitivity);

  useEffect(() => { lineRef.current = lineConfig; }, [lineConfig]);
  useEffect(() => { flipRef.current = flipDir; }, [flipDir]);
  useEffect(() => { storeIdRef.current = storeId; }, [storeId]);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { sensitivityRef.current = sensitivity; }, [sensitivity]);

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
    };
  }, []);

  // Load config from server
  useEffect(() => {
    if (!storeId || !token) return;
    fetch(`${API}/api/stores/${storeId}/people-counter/config`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return;
      if (d.line) { setLineConfig(d.line); lineRef.current = d.line; }
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

  // ── Drawing ──────────────────────────────────────────────────────────────────

  const drawLine = useCallback((ctx, W, H) => {
    const line = lineRef.current;
    const lx1 = line.x1 * W, ly1 = line.y1 * H;
    const lx2 = line.x2 * W, ly2 = line.y2 * H;

    ctx.strokeStyle = '#D4AF37'; ctx.lineWidth = 3; ctx.setLineDash([12, 5]);
    ctx.beginPath(); ctx.moveTo(lx1, ly1); ctx.lineTo(lx2, ly2); ctx.stroke();
    ctx.setLineDash([]);

    [[lx1, ly1], [lx2, ly2]].forEach(([x, y]) => {
      ctx.fillStyle = '#D4AF37';
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    });

    const mx = (lx1 + lx2) / 2, my = (ly1 + ly2) / 2;
    const dLen = Math.hypot(lx2 - lx1, ly2 - ly1) || 1;
    const nx = -(ly2 - ly1) / dLen * 38, ny = (lx2 - lx1) / dLen * 38;
    const flip = flipRef.current;

    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(flip ? 'SALIDA' : 'ENTRADA', mx + nx + 1, my + ny + 6);
    ctx.fillText(flip ? 'ENTRADA' : 'SALIDA', mx - nx + 1, my - ny + 6);
    ctx.fillStyle = '#22c55e'; ctx.fillText(flip ? 'SALIDA' : 'ENTRADA', mx + nx, my + ny + 5);
    ctx.fillStyle = '#ef4444'; ctx.fillText(flip ? 'ENTRADA' : 'SALIDA', mx - nx, my - ny + 5);
    ctx.textAlign = 'start';
  }, []);

  const drawStaticLine = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawLine(ctx, canvas.width, canvas.height);
  }, [drawLine]);

  useEffect(() => {
    if (!isRunning) {
      const t = setTimeout(drawStaticLine, 50);
      return () => clearTimeout(t);
    }
  }, [lineConfig, isRunning, flipDir, drawStaticLine]);

  // ── Camera ───────────────────────────────────────────────────────────────────

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
    setTimeout(drawStaticLine, 80);
  };

  // ── Motion detection loop (pure pixel math, runs at full 30fps) ──────────────

  const detectLoop = () => {
    if (!isRunningRef.current) return;
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const W = video.videoWidth || 640, H = video.videoHeight || 360;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

    // Capture downsampled frame (80×60) into offscreen canvas
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
      const lx1 = line.x1 * W, ly1 = line.y1 * H;
      const lx2 = line.x2 * W, ly2 = line.y2 * H;
      const now = Date.now();
      const maxD = 0.18; // max normalized distance to match a track
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

      // Draw blob indicators
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
    drawLine(ctx, W, H);
    animRef.current = requestAnimationFrame(detectLoop);
  };

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
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
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
    lineRef.current = dragRef.current === 'p1'
      ? { ...lineRef.current, x1: x, y1: y }
      : { ...lineRef.current, x2: x, y2: y };
    if (!dragAnimRef.current) {
      dragAnimRef.current = requestAnimationFrame(() => {
        if (!isRunning) drawStaticLine();
        dragAnimRef.current = null;
      });
    }
  };

  const onUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (dragAnimRef.current) { cancelAnimationFrame(dragAnimRef.current); dragAnimRef.current = null; }
    const newLine = { ...lineRef.current };
    setLineConfig(newLine);
    autoSaveConfig(newLine, flipRef.current);
  };

  // ── Stats ────────────────────────────────────────────────────────────────────

  const maxHourly = stats ? Math.max(1, ...stats.hourly.map(h => h.in + h.out)) : 1;

  return (
    <div className="pc-wrap" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111' }}>Contador de Aforo</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Detección por movimiento en tiempo real — sin descarga de modelos</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['live', '📷 En Vivo'], ['stats', '📊 Estadísticas']].map(([t, lbl]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '9px 18px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                background: tab === t ? '#D4AF37' : '#f3f4f6', color: tab === t ? '#000' : '#374151' }}>
              {lbl}
            </button>
          ))}
        </div>
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

          <div className="pc-live-grid">
            {/* Camera view */}
            <div style={{ background: '#111', borderRadius: 14, overflow: 'hidden' }}>
              <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
                <video ref={videoRef} autoPlay playsInline muted
                  style={{ width: '100%', display: 'block', minHeight: 340, background: '#000', objectFit: 'cover' }} />
                <canvas ref={canvasRef}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                    cursor: isEditingLine ? 'crosshair' : 'default', touchAction: 'none' }}
                  onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
                  onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
                />
                {isRunning && (
                  <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 8, pointerEvents: 'none' }}>
                    <span style={{ background: 'rgba(34,197,94,0.9)', color: '#fff', fontSize: 14, fontWeight: 800, padding: '5px 12px', borderRadius: 20 }}>↑ {counter.in}</span>
                    <span style={{ background: 'rgba(239,68,68,0.9)', color: '#fff', fontSize: 14, fontWeight: 800, padding: '5px 12px', borderRadius: 20 }}>↓ {counter.out}</span>
                  </div>
                )}
                {isEditingLine && (
                  <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.75)', color: '#D4AF37', fontSize: 12, fontWeight: 700,
                    padding: '7px 16px', borderRadius: 20, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                    Arrastra los puntos dorados para posicionar la línea
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {cameras.length > 1 && (
                <div>
                  <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, display: 'block', marginBottom: 5 }}>Cámara</label>
                  <select value={camId} onChange={e => setCamId(e.target.value)} disabled={isRunning}
                    style={{ width: '100%', padding: '9px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}>
                    {cameras.map((c, i) => <option key={c.deviceId} value={c.deviceId}>{c.label || `Cámara ${i + 1}`}</option>)}
                  </select>
                </div>
              )}

              <button onClick={isRunning ? stopCamera : startCamera}
                style={{ padding: '13px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 15, cursor: 'pointer',
                  background: isRunning ? '#fee2e2' : '#D4AF37', color: isRunning ? '#dc2626' : '#000' }}>
                {isRunning ? '⏹ Detener' : '▶ Iniciar detección'}
              </button>

              {/* Sensitivity */}
              <div style={{ background: '#f9fafb', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Sensibilidad de movimiento</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#D4AF37' }}>{sensitivity > 60 ? 'Baja' : sensitivity > 35 ? 'Media' : 'Alta'}</span>
                </div>
                <input type="range" min="15" max="80" value={sensitivity}
                  onChange={e => setSensitivity(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#D4AF37' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                  <span>Alta (detecta todo)</span><span>Baja (solo grandes)</span>
                </div>
              </div>

              {/* Line config */}
              <div style={{ background: '#f9fafb', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 12 }}>Línea de conteo</div>
                <button onClick={() => setIsEditingLine(e => !e)}
                  style={{ width: '100%', padding: '9px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 10,
                    background: isEditingLine ? '#fffbeb' : '#fff',
                    border: `1.5px solid ${isEditingLine ? '#D4AF37' : '#d1d5db'}`,
                    color: isEditingLine ? '#92400e' : '#374151' }}>
                  {isEditingLine ? '✅ Listo (guardado automático)' : '📏 Ajustar línea'}
                </button>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={flipDir}
                    onChange={e => { const v = e.target.checked; setFlipDir(v); flipRef.current = v; setTimeout(drawStaticLine, 20); autoSaveConfig(lineRef.current, v); }}
                    style={{ width: 15, height: 15 }} />
                  <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Invertir entrada/salida</span>
                </label>
              </div>

              <button onClick={() => setCounter({ in: 0, out: 0 })}
                style={{ padding: '9px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                🔄 Reiniciar conteo
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
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                  <div style={{ fontWeight: 700, color: '#374151', marginBottom: 4 }}>Sin registros para esta fecha</div>
                  <div style={{ fontSize: 13 }}>No se detectaron cruces el {statsDate}</div>
                </div>
              )}
            </>
          )}

          {!stats && !statsLoading && (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>📊</div>
              <div>Selecciona una fecha y presiona <strong>Ver datos</strong></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
