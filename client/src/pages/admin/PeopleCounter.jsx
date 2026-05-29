import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../components/Layout';

const API = 'https://srservi2.srautomatic.com';
const getToday = () => new Date().toISOString().slice(0, 10);
const DEFAULT_LINE = { x1: 0.15, y1: 0.5, x2: 0.85, y2: 0.5 };

function getSide(px, py, x1, y1, x2, y2) {
  return (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
}

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

export default function PeopleCounter() {
  const { token } = useAuth();
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;

  const [phase, setPhase] = useState('loading'); // loading | ready | error
  const [loadMsg, setLoadMsg] = useState('Cargando TensorFlow.js...');
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('live');
  const [isRunning, setIsRunning] = useState(false);
  const [isEditingLine, setIsEditingLine] = useState(false);
  const [lineConfig, setLineConfig] = useState(DEFAULT_LINE);
  const [flipDir, setFlipDir] = useState(false);
  const [counter, setCounter] = useState({ in: 0, out: 0 });
  const [cameras, setCameras] = useState([]);
  const [camId, setCamId] = useState('');
  const [statsDate, setStatsDate] = useState(getToday);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const modelRef = useRef(null);
  const tracksRef = useRef([]);
  const lineRef = useRef(DEFAULT_LINE);
  const flipRef = useRef(false);
  const isRunningRef = useRef(false);
  const animRef = useRef(null);
  const lastDetectRef = useRef(0);
  const nextIdRef = useRef(0);
  const dragRef = useRef(null);
  const dragAnimRef = useRef(null);
  const storeIdRef = useRef(storeId);
  const tokenRef = useRef(token);

  useEffect(() => { lineRef.current = lineConfig; }, [lineConfig]);
  useEffect(() => { flipRef.current = flipDir; }, [flipDir]);
  useEffect(() => { storeIdRef.current = storeId; }, [storeId]);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // Load COCO-SSD via CDN
  useEffect(() => {
    (async () => {
      try {
        setLoadMsg('Cargando TensorFlow.js...');
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
        setLoadMsg('Inicializando backend...');
        await window.tf.ready();
        setLoadMsg('Cargando modelo de detección...');
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
        setLoadMsg('Inicializando detector...');
        modelRef.current = await window.cocoSsd.load({ base: 'mobilenet_v2' });
        setPhase('ready');
      } catch (e) {
        setLoadError('Error al cargar: ' + (e?.message || 'red o navegador no compatible'));
        setPhase('error');
      }
    })();

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
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    });

    const mx = (lx1 + lx2) / 2, my = (ly1 + ly2) / 2;
    const dLen = Math.hypot(lx2 - lx1, ly2 - ly1) || 1;
    const nx = -(ly2 - ly1) / dLen * 38, ny = (lx2 - lx1) / dLen * 38;
    const flip = flipRef.current;

    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const inLabel = flip ? 'SALIDA' : 'ENTRADA';
    const outLabel = flip ? 'ENTRADA' : 'SALIDA';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(inLabel, mx + nx + 1, my + ny + 6);
    ctx.fillText(outLabel, mx - nx + 1, my - ny + 6);
    ctx.fillStyle = '#22c55e'; ctx.fillText(inLabel, mx + nx, my + ny + 5);
    ctx.fillStyle = '#ef4444'; ctx.fillText(outLabel, mx - nx, my - ny + 5);
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
    if (!isRunning && phase === 'ready') {
      const t = setTimeout(drawStaticLine, 50);
      return () => clearTimeout(t);
    }
  }, [lineConfig, isRunning, phase, flipDir, drawStaticLine]);

  const startCamera = async () => {
    if (!modelRef.current) return;
    try {
      const constraints = {
        video: { deviceId: camId ? { exact: camId } : undefined, width: { ideal: 640 }, height: { ideal: 480 } }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play();
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
    const stream = videoRef.current?.srcObject;
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    tracksRef.current = [];
    setTimeout(drawStaticLine, 80);
  };

  const detectLoop = async () => {
    if (!isRunningRef.current) return;
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState < 2) { animRef.current = requestAnimationFrame(detectLoop); return; }

    const W = video.videoWidth || 640, H = video.videoHeight || 360;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

    const now = Date.now();
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Throttle detection to ~5 FPS — enough for counting, much lighter
    if (now - lastDetectRef.current > 200 && modelRef.current) {
      lastDetectRef.current = now;
      let preds = [];
      try { preds = await modelRef.current.detect(video); } catch {}
      const persons = preds.filter(p => p.class === 'person' && p.score > 0.45);

      const line = lineRef.current;
      const lx1 = line.x1 * W, ly1 = line.y1 * H;
      const lx2 = line.x2 * W, ly2 = line.y2 * H;
      const maxD = Math.hypot(W, H) * 0.13;
      const used = new Set();
      const next = [];

      for (const p of persons) {
        const cx = p.bbox[0] + p.bbox[2] / 2;
        const cy = p.bbox[1] + p.bbox[3] / 2;
        let best = null, bestD = maxD;
        for (const tr of tracksRef.current) {
          if (used.has(tr.id)) continue;
          const d = Math.hypot(cx - tr.cx, cy - tr.cy);
          if (d < bestD) { bestD = d; best = tr; }
        }
        const rawSide = getSide(cx, cy, lx1, ly1, lx2, ly2) > 0 ? 1 : -1;
        const side = flipRef.current ? -rawSide : rawSide;

        if (best) {
          used.add(best.id);
          const canCount = best.side !== null && best.side !== side && (now - (best.lastCross || 0) > 3000);
          if (canCount) {
            const dir = side === 1 ? 'in' : 'out';
            handleCrossing(dir);
          }
          next.push({ ...best, cx, cy, side, lastSeen: now, bbox: p.bbox, lastCross: canCount ? now : best.lastCross });
        } else {
          next.push({ id: nextIdRef.current++, cx, cy, side, lastSeen: now, bbox: p.bbox, lastCross: 0 });
        }
      }
      // Keep stale tracks alive briefly so they can re-appear
      tracksRef.current = [...next, ...tracksRef.current.filter(t => !used.has(t.id) && now - t.lastSeen < 1500)];

      // Draw detection boxes
      for (const tr of tracksRef.current) {
        ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2;
        ctx.strokeRect(tr.bbox[0], tr.bbox[1], tr.bbox[2], tr.bbox[3]);
        ctx.fillStyle = 'rgba(34,197,94,0.1)';
        ctx.fillRect(tr.bbox[0], tr.bbox[1], tr.bbox[2], tr.bbox[3]);
      }
    }

    drawLine(ctx, W, H);
    animRef.current = requestAnimationFrame(detectLoop);
  };

  const handleCrossing = (dir) => {
    setCounter(prev => ({ ...prev, [dir]: prev[dir] + 1 }));
    const sid = storeIdRef.current;
    const tok = tokenRef.current;
    if (sid && tok) {
      fetch(`${API}/api/stores/${sid}/people-counter/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ direction: dir, crossed_at: new Date().toISOString() })
      }).catch(() => {});
    }
  };

  const saveConfig = async () => {
    if (!storeId) return;
    setSaving(true);
    try {
      await fetch(`${API}/api/stores/${storeId}/people-counter/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ line: lineConfig, flip: flipDir })
      });
      setIsEditingLine(false);
    } catch (e) { alert('Error al guardar: ' + e.message); }
    finally { setSaving(false); }
  };

  // Canvas drag for line editing
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
    const d1 = Math.hypot(x - l.x1, y - l.y1);
    const d2 = Math.hypot(x - l.x2, y - l.y2);
    if (d1 < 0.07) dragRef.current = 'p1';
    else if (d2 < 0.07) dragRef.current = 'p2';
  };

  const onMove = (e) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const { x, y } = getRelPos(e);
    // Update ref directly — zero React re-renders during drag
    lineRef.current = dragRef.current === 'p1'
      ? { ...lineRef.current, x1: x, y1: y }
      : { ...lineRef.current, x2: x, y2: y };
    // Redraw canvas at most once per frame (rAF-throttled)
    if (!dragAnimRef.current) {
      dragAnimRef.current = requestAnimationFrame(() => {
        drawStaticLine();
        dragAnimRef.current = null;
      });
    }
  };

  const onUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (dragAnimRef.current) { cancelAnimationFrame(dragAnimRef.current); dragAnimRef.current = null; }
    // Sync React state once at end of drag (single re-render)
    setLineConfig({ ...lineRef.current });
  };

  // Stats chart
  const maxHourly = stats ? Math.max(1, ...stats.hourly.map(h => h.in + h.out)) : 1;

  const btnStyle = (active, danger) => ({
    padding: '9px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13,
    cursor: 'pointer',
    background: danger ? (active ? '#fee2e2' : '#fff') : (active ? '#D4AF37' : '#f3f4f6'),
    color: danger ? (active ? '#dc2626' : '#6b7280') : (active ? '#000' : '#374151'),
    border: danger ? '1px solid #fecaca' : 'none'
  });

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', maxWidth: 980, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111' }}>Contador de Aforo</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Conteo automático de personas por línea virtual con cámara</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['live', '📷 En Vivo'], ['stats', '📊 Estadísticas']].map(([t, lbl]) => (
            <button key={t} onClick={() => setTab(t)} style={btnStyle(tab === t, false)}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* ── LIVE TAB ── */}
      {tab === 'live' && (
        <>
          {/* Counter summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
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

          {/* Camera + Controls grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, alignItems: 'start' }}>
            {/* Camera view */}
            <div style={{ background: '#111', borderRadius: 14, overflow: 'hidden' }}>
              {phase === 'loading' && (
                <div style={{ height: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                  <div style={{ width: 44, height: 44, border: '3px solid rgba(212,175,55,0.25)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
                  <div style={{ fontSize: 13, color: '#D4AF37', fontWeight: 600 }}>{loadMsg}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Descargando ~25 MB la primera vez</div>
                </div>
              )}
              {phase === 'error' && (
                <div style={{ height: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <div style={{ fontSize: 44 }}>⚠️</div>
                  <div style={{ fontSize: 13, color: '#ef4444', textAlign: 'center', maxWidth: 320, padding: '0 20px' }}>{loadError}</div>
                </div>
              )}
              {phase === 'ready' && (
                <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
                  <video ref={videoRef} autoPlay playsInline muted
                    style={{ width: '100%', display: 'block', minHeight: 360, background: '#000', objectFit: 'cover' }} />
                  <canvas ref={canvasRef}
                    style={{
                      position: 'absolute', inset: 0, width: '100%', height: '100%',
                      cursor: isEditingLine ? 'crosshair' : 'default', touchAction: 'none'
                    }}
                    onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
                    onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
                  />
                  {/* Live counter overlay */}
                  {isRunning && (
                    <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 8, pointerEvents: 'none' }}>
                      <span style={{ background: 'rgba(34,197,94,0.9)', color: '#fff', fontSize: 14, fontWeight: 800, padding: '5px 12px', borderRadius: 20 }}>
                        ↑ {counter.in}
                      </span>
                      <span style={{ background: 'rgba(239,68,68,0.9)', color: '#fff', fontSize: 14, fontWeight: 800, padding: '5px 12px', borderRadius: 20 }}>
                        ↓ {counter.out}
                      </span>
                    </div>
                  )}
                  {isEditingLine && (
                    <div style={{
                      position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                      background: 'rgba(0,0,0,0.75)', color: '#D4AF37', fontSize: 12, fontWeight: 700,
                      padding: '7px 16px', borderRadius: 20, pointerEvents: 'none', whiteSpace: 'nowrap'
                    }}>
                      Arrastra los puntos dorados para posicionar la línea
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Camera selector */}
              {cameras.length > 1 && (
                <div>
                  <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cámara</label>
                  <select value={camId} onChange={e => setCamId(e.target.value)} disabled={isRunning}
                    style={{ width: '100%', padding: '9px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}>
                    {cameras.map((c, i) => (
                      <option key={c.deviceId} value={c.deviceId}>{c.label || `Cámara ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Start / Stop */}
              <button onClick={isRunning ? stopCamera : startCamera} disabled={phase !== 'ready'}
                style={{
                  padding: '13px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 15, cursor: phase !== 'ready' ? 'not-allowed' : 'pointer',
                  background: phase !== 'ready' ? '#f3f4f6' : isRunning ? '#fee2e2' : '#D4AF37',
                  color: phase !== 'ready' ? '#9ca3af' : isRunning ? '#dc2626' : '#000'
                }}>
                {phase === 'loading' ? '⏳ Cargando modelo...' : isRunning ? '⏹ Detener detección' : '▶ Iniciar detección'}
              </button>

              {/* Line configuration card */}
              <div style={{ background: '#f9fafb', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Línea de conteo</div>

                <button onClick={() => setIsEditingLine(e => !e)}
                  style={{
                    width: '100%', padding: '9px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 10,
                    background: isEditingLine ? '#fffbeb' : '#fff',
                    border: `1.5px solid ${isEditingLine ? '#D4AF37' : '#d1d5db'}`,
                    color: isEditingLine ? '#92400e' : '#374151'
                  }}>
                  {isEditingLine ? '✏️ Editando línea...' : '📏 Mover línea'}
                </button>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: isEditingLine ? 10 : 0 }}>
                  <input type="checkbox" checked={flipDir} onChange={e => { setFlipDir(e.target.checked); flipRef.current = e.target.checked; setTimeout(drawStaticLine, 20); }}
                    style={{ width: 15, height: 15, cursor: 'pointer' }} />
                  <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>Invertir entrada/salida</span>
                </label>

                {isEditingLine && (
                  <button onClick={saveConfig} disabled={saving}
                    style={{ width: '100%', padding: '9px', borderRadius: 8, border: 'none', background: '#D4AF37', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    {saving ? 'Guardando...' : '💾 Guardar posición'}
                  </button>
                )}
              </div>

              {/* Reset */}
              <button onClick={() => setCounter({ in: 0, out: 0 })}
                style={{ padding: '9px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                🔄 Reiniciar conteo de hoy
              </button>

              {/* Tips */}
              <div style={{ background: '#fffbeb', borderRadius: 10, padding: '12px 14px', border: '1px solid #fde68a', fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
                <strong>Consejos:</strong><br />
                • Coloca la cámara mirando perpendicularmente al flujo<br />
                • La línea debe cruzar toda la entrada<br />
                • Buena iluminación mejora la precisión
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── STATS TAB ── */}
      {tab === 'stats' && (
        <div>
          {/* Date filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <input type="date" value={statsDate} onChange={e => setStatsDate(e.target.value)} max={getToday()}
              style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, cursor: 'pointer' }} />
            <button onClick={() => loadStats(statsDate)} disabled={statsLoading}
              style={{ padding: '9px 20px', background: '#D4AF37', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {statsLoading ? '...' : 'Ver datos'}
            </button>
          </div>

          {stats && (
            <>
              {/* Total cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
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

              {/* Hourly bar chart */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 24, marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 20, color: '#111' }}>Tráfico por hora — {statsDate}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160, padding: '0 4px' }}>
                  {Array.from({ length: 24 }, (_, h) => {
                    const hd = stats.hourly?.find(x => x.hour === h) || { in: 0, out: 0 };
                    const total = hd.in + hd.out;
                    const pct = total / maxHourly;
                    const barH = Math.max(total > 0 ? 10 : 2, pct * 130);
                    return (
                      <div key={h} title={`${h}:00 — Entradas: ${hd.in}, Salidas: ${hd.out}`}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'default' }}>
                        {total > 0 && <div style={{ fontSize: 9, fontWeight: 800, color: '#374151' }}>{total}</div>}
                        <div style={{
                          width: '100%', borderRadius: '3px 3px 0 0',
                          background: total > 0 ? '#D4AF37' : '#f3f4f6',
                          height: barH, transition: 'height 0.4s ease'
                        }} />
                        <div style={{ fontSize: 8, color: '#9ca3af', fontWeight: 600 }}>{h}h</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hourly detail table */}
              {stats.hourly?.filter(h => h.in + h.out > 0).length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 24 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16, color: '#111' }}>Detalle por hora</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                        {['Hora', 'Entradas', 'Salidas', 'Total'].map((h, i) => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : 'right', color: '#6b7280', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.hourly.filter(h => h.in + h.out > 0).map(h => (
                        <tr key={h.hour} style={{ borderBottom: '1px solid #f9fafb' }}>
                          <td style={{ padding: '9px 12px', fontWeight: 700, color: '#374151' }}>{String(h.hour).padStart(2, '0')}:00 – {String(h.hour + 1).padStart(2, '0')}:00</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', color: '#22c55e', fontWeight: 800 }}>{h.in}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 800 }}>{h.out}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 900, color: '#111' }}>{h.in + h.out}</td>
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
