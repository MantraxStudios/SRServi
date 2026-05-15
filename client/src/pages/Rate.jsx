import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const FACES = [
  { label: 'MUY SATISFECHO',   value: 10, color: '#1e8a1e', dark: '#0d4d0d', type: 'veryhappy' },
  { label: 'SATISFECHO',       value: 8,  color: '#7ac52e', dark: '#3d6e14', type: 'happy'     },
  { label: 'INDIFERENTE',      value: 6,  color: '#f5c200', dark: '#7a6000', type: 'neutral'   },
  { label: 'INSATISFECHO',     value: 4,  color: '#e07020', dark: '#7a3000', type: 'sad'       },
  { label: 'MUY INSATISFECHO', value: 2,  color: '#cc1f1f', dark: '#7a0000', type: 'verysad'   },
];

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pop  { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

  .rv-wrap {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
    background: linear-gradient(160deg, #c6e4f5 0%, #ddf0fa 55%, #c0dff0 100%);
    overflow: hidden;
    position: relative;
  }

  .rv-gold-line {
    height: 5px;
    width: 100%;
    flex-shrink: 0;
  }

  /* ── Top bar ── */
  .rv-topbar {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 24px;
    flex-shrink: 0;
  }
  .rv-logo-img {
    width: 80px; height: 80px;
    border-radius: 16px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .rv-logo-ph {
    width: 80px; height: 80px;
    border-radius: 16px;
    display: flex; align-items: center; justify-content: center;
    font-size: 36px; font-weight: 900;
    flex-shrink: 0;
  }
  .rv-store-name {
    font-size: clamp(22px, 5vw, 40px);
    font-weight: 900;
    color: #1e293b;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Body ── */
  .rv-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(20px, 4vh, 52px);
    padding: 0 16px 20px;
  }

  .rv-headline {
    font-size: clamp(38px, 10vw, 76px);
    font-weight: 900;
    text-align: center;
    letter-spacing: -0.5px;
    line-height: 1.05;
    text-transform: uppercase;
  }

  /* ── Faces row ── */
  .rv-faces {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: clamp(6px, 2vw, 20px);
    width: 100%;
    max-width: 920px;
  }

  .rv-face-btn {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px 2px;
    border-radius: 16px;
    transition: transform 0.13s;
    outline: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .rv-face-btn:not(:disabled):hover  { transform: scale(1.08); }
  .rv-face-btn:not(:disabled):active { transform: scale(0.88); }

  .rv-face-svg {
    width: min(17vw, 140px);
    height: min(17vw, 140px);
    filter: drop-shadow(0 4px 14px rgba(0,0,0,0.20));
    display: block;
  }

  .rv-face-label {
    font-size: clamp(9px, 1.8vw, 14px);
    font-weight: 800;
    text-align: center;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    line-height: 1.25;
  }

  /* ── Done ── */
  .rv-done {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(14px, 3vh, 28px);
    padding: 24px;
    animation: pop 0.35s ease-out;
  }
  .rv-done-svg   { width: min(38vw, 150px); height: min(38vw, 150px); filter: drop-shadow(0 6px 20px rgba(0,0,0,0.22)); }
  .rv-done-title { font-size: clamp(36px, 9vw, 60px); font-weight: 900; color: #1e293b; }
  .rv-done-sub   { font-size: clamp(16px, 3vw, 22px); color: #64748b; }

  .rv-brand {
    font-size: 12px;
    color: rgba(30,41,59,0.3);
    letter-spacing: 1px;
    text-align: center;
    flex-shrink: 0;
    padding-bottom: 10px;
  }

  /* ── Landscape ── */
  @media (orientation: landscape) {
    .rv-topbar { padding: 6px 24px; }
    .rv-logo-img, .rv-logo-ph { width: 56px; height: 56px; font-size: 24px; border-radius: 12px; }
    .rv-store-name { font-size: clamp(18px, 4vh, 30px); }
    .rv-headline   { font-size: clamp(26px, 7vh, 56px); }
    .rv-face-svg   { width: min(14vh, 110px); height: min(14vh, 110px); }
    .rv-face-label { font-size: clamp(7px, 1.4vh, 11px); }
    .rv-faces      { gap: clamp(6px, 1.8vw, 18px); max-width: 1020px; }
    .rv-body       { gap: clamp(10px, 2.5vh, 30px); }
    .rv-done-svg   { width: min(26vh, 120px); height: min(26vh, 120px); }
    .rv-done-title { font-size: clamp(28px, 7vh, 52px); }
  }

  /* ── Tablet portrait ── */
  @media (min-width: 600px) and (orientation: portrait) {
    .rv-logo-img, .rv-logo-ph { width: 100px; height: 100px; font-size: 44px; }
    .rv-face-svg   { width: min(15vw, 160px); height: min(15vw, 160px); }
    .rv-face-label { font-size: clamp(11px, 2vw, 16px); }
    .rv-faces      { max-width: 800px; gap: clamp(10px, 2.5vw, 26px); }
    .rv-done-svg   { width: min(32vw, 180px); height: min(32vw, 180px); }
  }
`;

function FaceSVG({ type, color, dark, className = 'rv-face-svg' }) {
  return (
    <svg viewBox="0 0 100 100" className={className}>
      <circle cx="50" cy="50" r="50" fill={color}/>

      {type === 'veryhappy' && <>
        {/* squinting happy eyes */}
        <path d="M26 38 Q35 27 44 38" stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none"/>
        <path d="M56 38 Q65 27 74 38" stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none"/>
        {/* big smile */}
        <path d="M20 55 Q50 83 80 55" stroke={dark} strokeWidth="5" strokeLinecap="round" fill="none"/>
      </>}

      {type === 'happy' && <>
        <circle cx="35" cy="38" r="5.5" fill={dark}/>
        <circle cx="65" cy="38" r="5.5" fill={dark}/>
        <path d="M28 58 Q50 76 72 58" stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none"/>
      </>}

      {type === 'neutral' && <>
        <circle cx="35" cy="38" r="5.5" fill={dark}/>
        <circle cx="65" cy="38" r="5.5" fill={dark}/>
        <line x1="28" y1="63" x2="72" y2="63" stroke={dark} strokeWidth="4.5" strokeLinecap="round"/>
      </>}

      {type === 'sad' && <>
        <circle cx="35" cy="38" r="5.5" fill={dark}/>
        <circle cx="65" cy="38" r="5.5" fill={dark}/>
        <path d="M28 70 Q50 55 72 70" stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none"/>
      </>}

      {type === 'verysad' && <>
        <circle cx="35" cy="38" r="5.5" fill={dark}/>
        <circle cx="65" cy="38" r="5.5" fill={dark}/>
        {/* strong frown */}
        <path d="M20 76 Q50 53 80 76" stroke={dark} strokeWidth="5" strokeLinecap="round" fill="none"/>
      </>}
    </svg>
  );
}

export default function Rate() {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');

  const [store, setStore]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(null);

  useEffect(() => {
    fetch(`/api/public/${code}`)
      .then(r => r.json())
      .then(d => { if (d.store) setStore(d.store); else setError('Tienda no encontrada'); })
      .catch(() => setError('Error al cargar la tienda'))
      .finally(() => setLoading(false));
  }, [code]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => window.location.reload(), 3000);
    return () => clearTimeout(t);
  }, [done]);

  const select = async (face) => {
    if (submitting || done) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/${code}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: face.value, comment: '', order_id: orderId, source: 'qr' }),
      });
      if (!res.ok) throw new Error();
      setDone(face);
    } catch {
      alert('Error al enviar. Intenta nuevamente.');
      setSubmitting(false);
    }
  };

  const accent  = store?.accent_color  || '#D4AF37';
  const primary = store?.primary_color || '#1a1a2e';
  const name    = store?.name || '';

  const topBar = (
    <div className="rv-topbar">
      {store?.logo_url ? (
        <img src={store.logo_url} alt={name} className="rv-logo-img"
          style={{ border: `3px solid ${accent}` }} />
      ) : store ? (
        <div className="rv-logo-ph" style={{ background: accent, color: primary }}>
          {name[0]?.toUpperCase() || '★'}
        </div>
      ) : null}
      <span className="rv-store-name">{name}</span>
    </div>
  );

  if (loading) return (
    <>
      <style>{CSS}</style>
      <div className="rv-wrap" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={spinnerStyle(accent)} />
      </div>
    </>
  );

  if (error) return (
    <>
      <style>{CSS}</style>
      <div className="rv-wrap" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: '#ef4444', fontSize: 16 }}>{error}</p>
      </div>
    </>
  );

  if (done) return (
    <>
      <style>{CSS}</style>
      <div className="rv-wrap">
        <div className="rv-gold-line" style={{ background: accent }} />
        {topBar}
        <div className="rv-done">
          <FaceSVG type={done.type} color={done.color} dark={done.dark} className="rv-done-svg" />
          <h2 className="rv-done-title">¡Gracias!</h2>
          <p className="rv-done-sub">Tu opinión nos ayuda a mejorar.</p>
        </div>
        <p className="rv-brand">Powered by SRAutomatic.cl</p>
        <div className="rv-gold-line" style={{ background: accent }} />
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="rv-wrap">
        <div className="rv-gold-line" style={{ background: accent }} />
        {topBar}

        <div className="rv-body">
          <p className="rv-headline" style={{ color: accent }}>
            ¿CÓMO FUE TU<br/>EXPERIENCIA HOY?
          </p>

          <div className="rv-faces">
            {FACES.map((face) => (
              <button
                key={face.value}
                className="rv-face-btn"
                onClick={() => select(face)}
                disabled={submitting}
                style={{ opacity: submitting ? 0.5 : 1 }}
              >
                <FaceSVG type={face.type} color={face.color} dark={face.dark} />
                <span className="rv-face-label" style={{ color: accent }}>
                  {face.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <p className="rv-brand">Powered by SRAutomatic.cl</p>
        <div className="rv-gold-line" style={{ background: accent }} />
      </div>
    </>
  );
}

const spinnerStyle = (accent) => ({
  width: 40, height: 40,
  border: '4px solid #e5e7eb',
  borderTopColor: accent || '#D4AF37',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
});
