import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTv, faSave, faTrash, faUpload, faToggleOn, faToggleOff,
  faCrown, faSpinner, faEye, faImage, faTimes, faFont, faSquarePlus,
  faAlignLeft, faAlignCenter, faAlignRight, faBold, faItalic, faHandPointer
} from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#D4AF37';

const TIMEOUT_OPTIONS = [
  { label: '30 segundos', value: 30 },
  { label: '1 minuto', value: 60 },
  { label: '2 minutos', value: 120 },
  { label: '5 minutos', value: 300 },
  { label: '10 minutos', value: 600 },
  { label: '15 minutos', value: 900 },
];

const uid = () => Math.random().toString(36).slice(2, 9);

// ¿La URL apunta a un video? (para renderizar <video> en vez de <img>)
export const isVideoUrl = (u) => /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(u || '');

// Layout por defecto para usuarios sin diseño guardado (editable)
const defaultLayout = () => ({
  clickAnywhere: true,
  elements: [
    { id: uid(), type: 'text', content: '¡HOLA! COMPRA AQUÍ', xPct: 50, yPct: 40, fontSize: 7, color: '#ffffff', bold: true, italic: false, align: 'center' },
    { id: uid(), type: 'button', content: 'Toca para comenzar', xPct: 50, yPct: 82, fontSize: 4, color: '#000000', bg: GOLD, bold: true, italic: false, align: 'center', padX: 6, padY: 3, radius: 50 },
  ],
});

// Estilo compartido de un elemento. `unit` = px que mide 1vmin en el contenedor.
export function screensaverElStyle(el, unit) {
  const s = {
    position: 'absolute',
    left: el.xPct + '%',
    top: el.yPct + '%',
    transform: 'translate(-50%, -50%)',
    fontSize: (el.fontSize * unit) + 'px',
    fontWeight: el.bold ? 900 : 500,
    fontStyle: el.italic ? 'italic' : 'normal',
    color: el.color || '#fff',
    textAlign: el.align || 'center',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.15,
    maxWidth: '92%',
    userSelect: 'none',
  };
  if (el.type === 'button') {
    s.background = el.bg || GOLD;
    s.padding = `${(el.padY ?? 3) * unit}px ${(el.padX ?? 6) * unit}px`;
    s.borderRadius = ((el.radius ?? 12) * unit) + 'px';
    s.fontWeight = el.bold ? 900 : 700;
    s.boxShadow = '0 6px 24px rgba(0,0,0,0.35)';
    s.textShadow = 'none';
  } else {
    s.textShadow = '0 2px 18px rgba(0,0,0,0.55)';
  }
  return s;
}

export default function Screensaver() {
  const { token } = useAuth();
  const { selectedStore } = useStore() || {};

  const [isPremium, setIsPremium] = useState(false);
  const [planLoading, setPlanLoading] = useState(true);

  const [enabled, setEnabled] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [timeoutSeconds, setTimeoutSeconds] = useState(60);
  const [layout, setLayout] = useState(defaultLayout);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState(null);

  // Check premium
  useEffect(() => {
    if (!token) return;
    setPlanLoading(true);
    fetch(API + '/api/my-plan', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => {
        const planName = data?.plan?.plan_name || data?.plan?.name || '';
        setIsPremium(!!planName && planName !== 'Gratis');
      })
      .catch(() => {})
      .finally(() => setPlanLoading(false));
  }, [token]);

  // Load config
  useEffect(() => {
    if (!token || !selectedStore?.id) return;
    setLoading(true);
    setPendingFile(null);
    setPendingPreviewUrl(null);
    setSelectedId(null);
    fetch(API + '/api/screensaver/config?store_id=' + selectedStore.id, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        setEnabled(!!data.enabled);
        setMediaUrl(data.media_url || null);
        setTimeoutSeconds(data.timeout_seconds || 60);
        let parsed = null;
        try { parsed = data.layout ? JSON.parse(data.layout) : null; } catch { parsed = null; }
        setLayout(parsed && Array.isArray(parsed.elements) ? parsed : defaultLayout());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, selectedStore?.id]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
  };

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const fd = new FormData();
      fd.append('enabled', enabled ? 'true' : 'false');
      fd.append('timeout_seconds', timeoutSeconds);
      fd.append('layout', JSON.stringify(layout));
      if (selectedStore?.id) fd.append('store_id', selectedStore.id);
      if (pendingFile) fd.append('media', pendingFile);
      else if (mediaUrl) fd.append('media_url', mediaUrl);
      const res = await fetch(API + '/api/screensaver/config', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        setMediaUrl(data.media_url || null);
        setPendingFile(null);
        setPendingPreviewUrl(null);
        setMsg('✔ Configuración guardada');
        setTimeout(() => setMsg(''), 3000);
      } else {
        const d = await res.json();
        setMsg('Error: ' + (d.error || 'intenta de nuevo'));
      }
    } catch { setMsg('Error de conexión'); }
    finally { setSaving(false); }
  };

  const deleteMedia = async () => {
    if (!confirm('¿Eliminar imagen de fondo?')) return;
    setDeleting(true);
    try {
      await fetch(API + '/api/screensaver/media?store_id=' + (selectedStore?.id || 0), {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      });
      setMediaUrl(null);
      setPendingFile(null);
      setPendingPreviewUrl(null);
      setMsg('Fondo eliminado');
      setTimeout(() => setMsg(''), 2500);
    } catch { setMsg('Error al eliminar'); }
    finally { setDeleting(false); }
  };

  // ── Editor de elementos ────────────────────────────────────────────────
  const updateEl = useCallback((id, patch) => {
    setLayout(l => ({ ...l, elements: l.elements.map(e => e.id === id ? { ...e, ...patch } : e) }));
  }, []);
  const addEl = (type) => {
    const base = type === 'button'
      ? { id: uid(), type: 'button', content: 'Nuevo botón', xPct: 50, yPct: 60, fontSize: 4, color: '#000000', bg: GOLD, bold: true, italic: false, align: 'center', padX: 6, padY: 3, radius: 50 }
      : { id: uid(), type: 'text', content: 'Texto nuevo', xPct: 50, yPct: 50, fontSize: 6, color: '#ffffff', bold: true, italic: false, align: 'center' };
    setLayout(l => ({ ...l, elements: [...l.elements, base] }));
    setSelectedId(base.id);
  };
  const removeEl = (id) => {
    setLayout(l => ({ ...l, elements: l.elements.filter(e => e.id !== id) }));
    setSelectedId(s => s === id ? null : s);
  };

  const displayMedia = pendingPreviewUrl || (mediaUrl ? API + mediaUrl : null);
  const mediaIsVideo = pendingFile ? (pendingFile.type || '').startsWith('video') : isVideoUrl(mediaUrl);
  const storeLogo = selectedStore?.logo_url ? API + selectedStore.logo_url : null;
  const selectedEl = layout.elements.find(e => e.id === selectedId) || null;

  if (planLoading || loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
        <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '24px' }} />
      </div>
    );
  }

  return (
    <>
      <header className="admin-header">
        <h1><FontAwesomeIcon icon={faTv} style={{ marginRight: '10px' }} />Salva Pantallas</h1>
      </header>

      <div className="admin-main">

        {/* Premium gate */}
        {!isPremium && (
          <div style={{ background: 'linear-gradient(135deg, #000 60%, #1a1400)', border: '2px solid ' + GOLD, borderRadius: '16px', padding: '32px 24px', textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '44px', marginBottom: '10px' }}>✨</div>
            <FontAwesomeIcon icon={faCrown} style={{ color: GOLD, fontSize: '28px', marginBottom: '12px', display: 'block' }} />
            <h2 style={{ color: GOLD, margin: '0 0 8px', fontSize: '20px', fontWeight: '900' }}>Función Premium</h2>
            <p style={{ color: '#ccc', fontSize: '13px', margin: '0 0 20px', lineHeight: 1.6 }}>
              El salva pantallas personalizado está disponible solo para cuentas Premium.<br />
              Actualiza tu plan para activarlo en tus tiendas.
            </p>
            <a href="/admin/plans" style={{ display: 'inline-block', padding: '12px 28px', background: GOLD, color: '#000', fontWeight: '900', borderRadius: '10px', textDecoration: 'none', fontSize: '14px' }}>Ver planes</a>
          </div>
        )}

        <div style={{ opacity: isPremium ? 1 : 0.4, pointerEvents: isPremium ? 'auto' : 'none', display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* ── Lienzo editable ── */}
          <div style={{ flex: '0 0 auto' }}>
            <EditorCanvas
              layout={layout}
              background={displayMedia}
              backgroundIsVideo={mediaIsVideo}
              storeLogo={storeLogo}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={(id, xPct, yPct) => updateEl(id, { xPct, yPct })}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'center' }}>
              <button onClick={() => addEl('text')} style={toolBtn}>
                <FontAwesomeIcon icon={faFont} /> Texto
              </button>
              <button onClick={() => addEl('button')} style={toolBtn}>
                <FontAwesomeIcon icon={faSquarePlus} /> Botón
              </button>
            </div>
            <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginTop: '8px' }}>
              Arrastra los elementos para moverlos. Toca uno para editarlo.
            </p>
          </div>

          {/* ── Panel derecho: propiedades + config ── */}
          <div style={{ flex: '1 1 300px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Propiedades del elemento seleccionado */}
            <div style={panelCard}>
              <div style={panelTitle}>{selectedEl ? 'Editar elemento' : 'Elemento'}</div>
              {!selectedEl ? (
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                  Selecciona un texto o botón del lienzo para editar su contenido, tamaño y color.
                </p>
              ) : (
                <ElementProps el={selectedEl} onChange={patch => updateEl(selectedEl.id, patch)} onRemove={() => removeEl(selectedEl.id)} />
              )}
            </div>

            {/* Toggle: cerrar al tocar cualquier parte */}
            <div style={panelCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => setLayout(l => ({ ...l, clickAnywhere: !l.clickAnywhere }))}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>
                    <FontAwesomeIcon icon={faHandPointer} style={{ marginRight: 6, color: GOLD }} />
                    Cerrar al tocar cualquier parte
                  </div>
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '2px', maxWidth: 240 }}>
                    {layout.clickAnywhere
                      ? 'Un toque en cualquier zona de la pantalla lo cierra'
                      : 'Solo se cierra al tocar un botón que agregues'}
                  </div>
                </div>
                <FontAwesomeIcon icon={layout.clickAnywhere ? faToggleOn : faToggleOff} style={{ fontSize: '30px', color: layout.clickAnywhere ? '#22c55e' : '#d1d5db' }} />
              </div>
            </div>

            {/* Activar + tiempo */}
            <div style={panelCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '14px' }} onClick={() => setEnabled(v => !v)}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#111' }}>Activar salva pantallas</div>
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{enabled ? 'Activo' : 'Inactivo'}</div>
                </div>
                <FontAwesomeIcon icon={enabled ? faToggleOn : faToggleOff} style={{ fontSize: '30px', color: enabled ? '#22c55e' : '#d1d5db' }} />
              </div>
              <label style={miniLabel}>Tiempo de inactividad para activarse</label>
              <select value={timeoutSeconds} onChange={e => setTimeoutSeconds(Number(e.target.value))}
                style={{ width: '100%', padding: '9px 11px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', background: '#fff' }}>
                {TIMEOUT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Imagen o video de fondo */}
            <div style={panelCard}>
              <label style={miniLabel}>Imagen o video de fondo <span style={{ fontWeight: 400, color: '#aaa' }}>(opcional)</span></label>
              {displayMedia ? (
                <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                  {mediaIsVideo
                    ? <video src={displayMedia} muted loop autoPlay playsInline style={{ maxWidth: '100%', maxHeight: '140px', borderRadius: '10px', border: '2px solid #e5e7eb', display: 'block' }} />
                    : <img src={displayMedia} alt="Fondo" style={{ maxWidth: '100%', maxHeight: '140px', borderRadius: '10px', border: '2px solid #e5e7eb', display: 'block' }} />}
                  <button onClick={() => { if (pendingFile) { setPendingFile(null); setPendingPreviewUrl(null); } else deleteMedia(); }} disabled={deleting}
                    style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              ) : (
                <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #d1d5db', borderRadius: '10px', padding: '20px', textAlign: 'center', cursor: 'pointer', background: '#fafafa' }}>
                  <FontAwesomeIcon icon={faImage} style={{ fontSize: '24px', color: '#d1d5db', display: 'block', margin: '0 auto 6px' }} />
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#555' }}>Subir imagen, GIF o video</div>
                  <div style={{ fontSize: '11px', color: '#aaa', marginTop: '3px' }}>JPG, PNG, WEBP, GIF, MP4, WEBM</div>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/ogg,video/quicktime" style={{ display: 'none' }} onChange={handleFileChange} />
              {displayMedia && (
                <button onClick={() => fileRef.current?.click()} style={{ marginTop: '8px', background: 'none', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer', color: '#555', fontWeight: '600' }}>
                  <FontAwesomeIcon icon={faUpload} style={{ marginRight: '5px' }} /> Cambiar fondo
                </button>
              )}
            </div>

            {msg && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', background: msg.includes('Error') ? '#fef2f2' : '#f0fdf4', color: msg.includes('Error') ? '#dc2626' : '#16a34a' }}>{msg}</div>
            )}

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={save} disabled={saving} style={{ flex: 1, padding: '12px 20px', background: saving ? '#ccc' : '#000', color: GOLD, border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '800', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
                <FontAwesomeIcon icon={saving ? faSpinner : faSave} spin={saving} />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setPreview(true)} style={{ padding: '12px 18px', background: '#f3f4f6', color: '#111', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <FontAwesomeIcon icon={faEye} /> Ver
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px 16px', fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>
          <strong style={{ color: '#374151' }}>¿Cómo funciona?</strong><br />
          El salva pantallas aparece en el totem de esta tienda tras el tiempo de inactividad. Diseña lo que verá el cliente
          agregando textos y botones sobre la imagen de fondo. Al tocar (según tu configuración) desaparece y el cliente sigue comprando.
        </div>
      </div>

      {preview && (
        <FullscreenPreview layout={layout} background={displayMedia} backgroundIsVideo={mediaIsVideo} storeLogo={storeLogo} onClose={() => setPreview(false)} />
      )}
    </>
  );
}

const toolBtn = { display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' };
const panelCard = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' };
const panelTitle = { fontSize: '13px', fontWeight: 800, color: '#111', marginBottom: '12px' };
const miniLabel = { fontSize: '12px', fontWeight: '700', color: '#555', display: 'block', marginBottom: '6px' };

// ── Lienzo con elementos arrastrables ──────────────────────────────────────
function EditorCanvas({ layout, background, backgroundIsVideo, storeLogo, selectedId, onSelect, onMove }) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const [unit, setUnit] = useState(3);

  const measure = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    setUnit(Math.min(el.clientWidth, el.clientHeight) / 100);
  }, []);
  useEffect(() => { measure(); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }, [measure]);

  const onPointerDown = (e, id) => {
    e.stopPropagation();
    onSelect(id);
    dragRef.current = { id };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onMove(dragRef.current.id, Math.max(2, Math.min(98, +x.toFixed(1))), Math.max(2, Math.min(98, +y.toFixed(1))));
  };
  const onPointerUp = () => { dragRef.current = null; };

  return (
    <div
      ref={canvasRef}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onClick={() => onSelect(null)}
      style={{
        position: 'relative', width: 300, height: 533, borderRadius: 18, overflow: 'hidden',
        background: (background && !backgroundIsVideo) ? `#000 center/cover url(${background})` : 'linear-gradient(160deg,#0a0a0a,#1a1a1a)',
        border: '3px solid #111', boxShadow: '0 10px 30px rgba(0,0,0,0.25)', touchAction: 'none', cursor: 'default',
      }}
    >
      {background && backgroundIsVideo && (
        <video src={background} muted loop autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: background ? 'linear-gradient(to bottom, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)' : 'transparent' }} />
      {!background && storeLogo && (
        <img src={storeLogo} alt="" style={{ position: 'absolute', top: '18%', left: '50%', transform: 'translate(-50%,-50%)', width: 80, height: 80, objectFit: 'contain', opacity: 0.9 }} />
      )}
      {layout.elements.map(el => (
        <div
          key={el.id}
          onPointerDown={e => onPointerDown(e, el.id)}
          onClick={e => e.stopPropagation()}
          style={{
            ...screensaverElStyle(el, unit),
            cursor: 'grab',
            outline: selectedId === el.id ? `2px dashed ${GOLD}` : 'none',
            outlineOffset: 4,
          }}
        >
          {el.content}
        </div>
      ))}
    </div>
  );
}

// ── Panel de propiedades de un elemento ─────────────────────────────────────
function ElementProps({ el, onChange, onRemove }) {
  const row = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 };
  const lbl = { fontSize: 11, fontWeight: 700, color: '#666', width: 78, flexShrink: 0 };
  return (
    <div>
      <label style={miniLabel}>Contenido</label>
      <textarea value={el.content} onChange={e => onChange({ content: e.target.value })} rows={2}
        style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', resize: 'vertical', marginBottom: 12, fontFamily: 'inherit' }} />

      <div style={row}>
        <span style={lbl}>Tamaño</span>
        <input type="range" min={2} max={18} step={0.5} value={el.fontSize} onChange={e => onChange({ fontSize: Number(e.target.value) })} style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#888', width: 30, textAlign: 'right' }}>{el.fontSize}</span>
      </div>

      <div style={row}>
        <span style={lbl}>Color texto</span>
        <input type="color" value={el.color || '#ffffff'} onChange={e => onChange({ color: e.target.value })} style={{ width: 42, height: 30, border: 'none', background: 'none', cursor: 'pointer' }} />
      </div>

      {el.type === 'button' && (
        <>
          <div style={row}>
            <span style={lbl}>Color fondo</span>
            <input type="color" value={el.bg || GOLD} onChange={e => onChange({ bg: e.target.value })} style={{ width: 42, height: 30, border: 'none', background: 'none', cursor: 'pointer' }} />
          </div>
          <div style={row}>
            <span style={lbl}>Redondeo</span>
            <input type="range" min={0} max={50} step={1} value={el.radius ?? 12} onChange={e => onChange({ radius: Number(e.target.value) })} style={{ flex: 1 }} />
          </div>
          <div style={row}>
            <span style={lbl}>Relleno</span>
            <input type="range" min={1} max={12} step={0.5} value={el.padX ?? 6} onChange={e => onChange({ padX: Number(e.target.value) })} style={{ flex: 1 }} title="Horizontal" />
            <input type="range" min={1} max={10} step={0.5} value={el.padY ?? 3} onChange={e => onChange({ padY: Number(e.target.value) })} style={{ flex: 1 }} title="Vertical" />
          </div>
        </>
      )}

      <div style={row}>
        <span style={lbl}>Estilo</span>
        <button onClick={() => onChange({ bold: !el.bold })} style={styleToggle(el.bold)}><FontAwesomeIcon icon={faBold} /></button>
        <button onClick={() => onChange({ italic: !el.italic })} style={styleToggle(el.italic)}><FontAwesomeIcon icon={faItalic} /></button>
        <button onClick={() => onChange({ align: 'left' })} style={styleToggle(el.align === 'left')}><FontAwesomeIcon icon={faAlignLeft} /></button>
        <button onClick={() => onChange({ align: 'center' })} style={styleToggle(el.align === 'center' || !el.align)}><FontAwesomeIcon icon={faAlignCenter} /></button>
        <button onClick={() => onChange({ align: 'right' })} style={styleToggle(el.align === 'right')}><FontAwesomeIcon icon={faAlignRight} /></button>
      </div>

      <button onClick={onRemove} style={{ marginTop: 6, width: '100%', padding: '9px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
        <FontAwesomeIcon icon={faTrash} style={{ marginRight: 6 }} /> Eliminar elemento
      </button>
    </div>
  );
}

const styleToggle = (active) => ({
  width: 32, height: 30, borderRadius: 7, border: '1px solid ' + (active ? GOLD : '#e5e7eb'),
  background: active ? GOLD : '#fff', color: active ? '#000' : '#666', cursor: 'pointer', fontSize: 12,
});

// ── Vista previa a pantalla completa ────────────────────────────────────────
function FullscreenPreview({ layout, background, backgroundIsVideo, storeLogo, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: '#000', cursor: 'pointer' }}>
      <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 2, background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 14px', fontSize: 12, color: '#fff', fontWeight: 700 }}>
        Toca para cerrar
      </div>
      <ScreensaverContent layout={layout} background={background} backgroundIsVideo={backgroundIsVideo} storeLogo={storeLogo} />
    </div>
  );
}

// Render compartido (también usado como fallback). `background` = URL absoluta.
export function ScreensaverContent({ layout, background, backgroundIsVideo, storeLogo }) {
  const unit = typeof window !== 'undefined' ? Math.min(window.innerWidth, window.innerHeight) / 100 : 4;
  const isVid = backgroundIsVideo != null ? backgroundIsVideo : isVideoUrl(background);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' }}>
      {background && (isVid
        ? <video src={background} muted loop autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <img src={background} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />)}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: background ? 'linear-gradient(to bottom, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)' : 'linear-gradient(160deg,#0a0a0a,#1a1a1a)' }} />
      {!background && storeLogo && (
        <img src={storeLogo} alt="" style={{ position: 'absolute', top: '18%', left: '50%', transform: 'translate(-50%,-50%)', width: 140, height: 140, objectFit: 'contain' }} />
      )}
      {(layout?.elements || []).map(el => (
        <div key={el.id} style={screensaverElStyle(el, unit)}>{el.content}</div>
      ))}
    </div>
  );
}
