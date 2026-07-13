import { useState, useEffect, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMagicWandSparkles, faSpinner, faDownload, faExclamationTriangle,
  faCheckCircle, faImage, faTrash, faSquare, faMobileScreen, faPanorama,
  faVideo, faFilm,
} from '@fortawesome/free-solid-svg-icons';

const CSS = `
.aig-page { padding: 20px 16px; max-width: 1100px; margin: 0 auto; font-family: system-ui,-apple-system,sans-serif; }
.aig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
.aig-header { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
.aig-title { font-size: 22px; font-weight: 800; color: #1e293b; margin: 0; }
.aig-subtitle { font-size: 13px; color: #6b7280; margin: 0; }
.aig-gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 680px) {
  .aig-page { padding: 14px 12px; }
  .aig-grid { grid-template-columns: 1fr; gap: 14px; }
  .aig-header { gap: 10px; margin-bottom: 16px; }
  .aig-title { font-size: 18px; }
  .aig-subtitle { font-size: 12px; }
  .aig-gallery { grid-template-columns: 1fr 1fr; }
}
`;

const ASPECTS = [
  { id: 'square',     label: 'Cuadrada',    sub: '1:1 · redes sociales',  icon: faSquare,        w: 512, h: 512 },
  { id: 'vertical',   label: 'Vertical',    sub: '9:16 · historias',      icon: faMobileScreen,  w: 512, h: 896 },
  { id: 'horizontal', label: 'Horizontal',  sub: '16:9 · banners',        icon: faPanorama,      w: 896, h: 512 },
];

export default function AiImageGenerator() {
  const { token } = useAuth();
  const { selectedStore } = useContext(StoreContext);
  const storeId = selectedStore?.id;

  const [mode, setMode]               = useState('image'); // 'image' | 'video'
  const [prompt, setPrompt]           = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aspect, setAspect]           = useState('square');
  const [generating, setGenerating]   = useState(false);
  const [current, setCurrent]         = useState(null); // { url, type: 'image'|'video' }
  const [gallery, setGallery]         = useState([]);
  const [status, setStatus]           = useState(null);
  const [toast, setToast]             = useState(null);

  useEffect(() => {
    if (!storeId || !token) return;
    let cancelled = false;
    const checkStatus = () => {
      fetch('/api/ai-image/status', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => { if (!cancelled) setStatus(d); })
        .catch(() => {});
    };
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [storeId, token]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const generate = async () => {
    if (!storeId) return;
    if (!prompt.trim()) { showToast(`Escribí una descripción ${mode === 'video' ? 'del video' : 'de la imagen'} primero`, 'error'); return; }
    setGenerating(true);
    try {
      let res;
      if (mode === 'video') {
        res = await fetch('/api/ai-image/generate-video', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId,
            prompt: prompt.trim(),
            negative_prompt: negativePrompt.trim() || undefined,
          }),
        });
      } else {
        const asp = ASPECTS.find(a => a.id === aspect) || ASPECTS[0];
        res = await fetch('/api/ai-image/generate', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId,
            prompt: prompt.trim(),
            negative_prompt: negativePrompt.trim() || undefined,
            width: asp.w,
            height: asp.h,
          }),
        });
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error generando ${mode === 'video' ? 'el video' : 'la imagen'}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setCurrent({ url, type: mode });
      setGallery(g => [{ url, type: mode, prompt: prompt.trim(), ts: Date.now() }, ...g].slice(0, 12));
    } catch (e) { showToast(e.message, 'error'); }
    finally { setGenerating(false); }
  };

  const download = (item) => {
    const a = document.createElement('a');
    a.href = item.url;
    a.download = `ia-${selectedStore?.code || 'archivo'}-${item.ts ?? Date.now()}.${item.type === 'video' ? 'mp4' : 'png'}`;
    a.click();
  };

  const removeFromGallery = (ts) => {
    setGallery(g => g.filter(item => item.ts !== ts));
  };

  if (!selectedStore) {
    return (
      <div className="aig-page">
        <style>{CSS}</style>
        <div style={s.empty}>
          <FontAwesomeIcon icon={faImage} style={{ fontSize: 48, color: '#d1d5db', marginBottom: 14 }} />
          <p>Selecciona una tienda para generar imágenes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="aig-page">
      <style>{CSS}</style>

      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, left: 16, zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : '#22c55e',
          color: '#fff', padding: '12px 16px', borderRadius: 12,
          fontWeight: 700, fontSize: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 8,
          maxWidth: 400, marginLeft: 'auto',
        }}>
          <FontAwesomeIcon icon={toast.type === 'error' ? faExclamationTriangle : faCheckCircle} />
          {toast.msg}
        </div>
      )}

      <div className="aig-header">
        <div style={s.headerIcon}>
          <FontAwesomeIcon icon={faMagicWandSparkles} style={{ color: '#fff', fontSize: 20 }} />
        </div>
        <div>
          <h1 className="aig-title">Generador de Imágenes IA</h1>
          <p className="aig-subtitle">Creá imágenes profesionales para lo que necesites — <strong>{selectedStore.name}</strong></p>
        </div>
      </div>

      {status && status.status !== 'ok' && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>
            <FontAwesomeIcon icon={faExclamationTriangle} /> El servicio de IA no está disponible en este momento. Intentá de nuevo en unos minutos.
          </p>
        </div>
      )}
      {status?.loading && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#1d4ed8' }}>
            <FontAwesomeIcon icon={faSpinner} spin /> La IA se está preparando (solo la primera vez, puede tardar unos minutos)...
          </p>
        </div>
      )}

      <div className="aig-grid">
        {/* ── Left: Controls ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={s.card}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setMode('image')}
                style={{
                  flex: 1, padding: '9px 6px', borderRadius: 10, cursor: 'pointer',
                  border: `2px solid ${mode === 'image' ? '#D4AF37' : '#e5e7eb'}`,
                  background: mode === 'image' ? '#fffbee' : '#fff',
                  color: mode === 'image' ? '#92740a' : '#374151',
                  fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <FontAwesomeIcon icon={faImage} /> Imagen
              </button>
              <button
                onClick={() => setMode('video')}
                style={{
                  flex: 1, padding: '9px 6px', borderRadius: 10, cursor: 'pointer',
                  border: `2px solid ${mode === 'video' ? '#D4AF37' : '#e5e7eb'}`,
                  background: mode === 'video' ? '#fffbee' : '#fff',
                  color: mode === 'video' ? '#92740a' : '#374151',
                  fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <FontAwesomeIcon icon={faVideo} /> Video (5s)
              </button>
            </div>

            <h3 style={s.cardTitle}>{mode === 'video' ? 'Describí el video' : 'Describí la imagen'}</h3>
            <div style={s.field}>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={4}
                placeholder={mode === 'video'
                  ? 'Ej: hamburguesa gourmet girando lentamente sobre una mesa de madera, ambiente cálido'
                  : 'Ej: hamburguesa gourmet con papas fritas, fondo colorido, foto publicitaria profesional'}
                style={{ ...s.input, resize: 'vertical', height: 'auto' }}
              />
              <p style={s.hint}>
                {mode === 'video'
                  ? 'Describí la escena: el video se genera en formato vertical (ideal para historias/reels) con un movimiento sutil.'
                  : 'Sé específico: producto, ambiente, estilo. Cuanto más detalle, mejor el resultado.'}
              </p>
            </div>

            {mode === 'image' && (
              <div style={s.field}>
                <label style={s.label}>Formato</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {ASPECTS.map(a => (
                    <button
                      key={a.id}
                      onClick={() => setAspect(a.id)}
                      style={{
                        flex: 1, padding: '10px 6px', borderRadius: 10,
                        border: `2px solid ${aspect === a.id ? '#D4AF37' : '#e5e7eb'}`,
                        background: aspect === a.id ? '#fffbee' : '#fff',
                        cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      }}
                    >
                      <FontAwesomeIcon icon={a.icon} style={{ color: aspect === a.id ? '#D4AF37' : '#6b7280', fontSize: 16 }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: aspect === a.id ? '#92740a' : '#374151' }}>{a.label}</span>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{a.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setShowAdvanced(p => !p)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: showAdvanced ? 10 : 0 }}>
              {showAdvanced ? '▾ Ocultar opciones avanzadas' : '▸ Opciones avanzadas'}
            </button>
            {showAdvanced && (
              <div style={s.field}>
                <label style={s.label}>Evitar {mode === 'video' ? 'en el video' : 'en la imagen'} <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span></label>
                <input
                  value={negativePrompt}
                  onChange={e => setNegativePrompt(e.target.value)}
                  placeholder="Ej: texto, manos deformes, baja calidad"
                  style={s.input}
                />
              </div>
            )}

            <button onClick={generate} disabled={generating} style={{ ...s.btnPrimary, opacity: generating ? 0.7 : 1 }}>
              {generating ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={mode === 'video' ? faVideo : faMagicWandSparkles} />}
              {generating
                ? ` Generando ${mode === 'video' ? 'video' : 'imagen'}...`
                : ` Generar ${mode === 'video' ? 'video' : 'imagen'}`}
            </button>
            {mode === 'video' && (
              <p style={{ ...s.hint, textAlign: 'center', marginTop: 8 }}>
                Puede tardar varios minutos, sobre todo la primera vez.
              </p>
            )}
          </div>

          {/* Info */}
          <div style={{ ...s.card, background: '#fafafa', border: '1px solid #e5e7eb' }}>
            <h3 style={{ ...s.cardTitle, color: '#374151' }}>¿Cómo funciona?</h3>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'Describí lo que querés ver y la IA te genera una imagen o video listo para usar.',
                'Generá cualquier imagen: productos, banners, fondos para redes, lo que necesites.',
                'Los videos duran 5 segundos y salen en formato vertical, ideal para historias y reels.',
                'Cada resultado queda en tu galería de esta sesión para descargar cuando quieras.',
                'Para promociones con cupones, usá la sección Instagram Auto-Post.',
              ].map((t, i) => (
                <li key={i} style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{t}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Right: Preview + gallery ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={s.card}>
            <h3 style={s.cardTitle}>Resultado</h3>
            {current ? (
              <>
                {current.type === 'video' ? (
                  <video src={current.url} controls loop autoPlay muted style={{ width: '100%', display: 'block', borderRadius: 10, marginBottom: 10, background: '#000' }} />
                ) : (
                  <img src={current.url} alt="Imagen generada" style={{ width: '100%', display: 'block', borderRadius: 10, marginBottom: 10 }} />
                )}
                <button onClick={() => download(current)} style={{ ...s.btnPrimary, background: '#1e293b' }}>
                  <FontAwesomeIcon icon={faDownload} /> Descargar
                </button>
              </>
            ) : (
              <div style={{ background: '#f8fafc', padding: '40px 20px', textAlign: 'center', borderRadius: 10 }}>
                <FontAwesomeIcon icon={mode === 'video' ? faFilm : faImage} style={{ fontSize: 32, color: '#cbd5e1', marginBottom: 10 }} />
                <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
                  Describí {mode === 'video' ? 'un video' : 'una imagen'} a la izquierda y hacé clic en "Generar {mode === 'video' ? 'video' : 'imagen'}"
                </p>
              </div>
            )}
          </div>

          {gallery.length > 0 && (
            <div style={s.card}>
              <h3 style={s.cardTitle}>Galería de esta sesión</h3>
              <div className="aig-gallery">
                {gallery.map(item => (
                  <div key={item.ts} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                    {item.type === 'video' ? (
                      <video
                        src={item.url}
                        muted loop
                        style={{ width: '100%', display: 'block', cursor: 'pointer' }}
                        onClick={() => setCurrent(item)}
                        onMouseEnter={e => e.currentTarget.play()}
                        onMouseLeave={e => e.currentTarget.pause()}
                      />
                    ) : (
                      <img
                        src={item.url}
                        alt={item.prompt}
                        style={{ width: '100%', display: 'block', cursor: 'pointer' }}
                        onClick={() => setCurrent(item)}
                      />
                    )}
                    <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                      <button onClick={() => download(item)} style={s.galleryBtn}>
                        <FontAwesomeIcon icon={faDownload} style={{ fontSize: 11 }} />
                      </button>
                      <button onClick={() => removeFromGallery(item.ts)} style={s.galleryBtn}>
                        <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11 }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  headerIcon: { width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#D4AF37,#b8952d)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  card: { background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb' },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#374151', marginTop: 0, marginBottom: 14 },
  field: { marginBottom: 14 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  hint: { fontSize: 11, color: '#9ca3af', margin: '5px 0 0' },
  btnPrimary: { width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: '#D4AF37', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  galleryBtn: { width: 24, height: 24, borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', padding: '60px 24px', color: '#6b7280', fontSize: 15 },
};
