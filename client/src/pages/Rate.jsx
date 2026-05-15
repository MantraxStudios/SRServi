import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const FACES = [
  { label: 'MUY SATISFECHO',   value: 10, color: '#1e8a1e', dark: '#0d4d0d', type: 'veryhappy', delay: 0    },
  { label: 'SATISFECHO',       value: 8,  color: '#7ac52e', dark: '#3d6e14', type: 'happy',     delay: 0.2  },
  { label: 'INDIFERENTE',      value: 6,  color: '#f5c200', dark: '#7a6000', type: 'neutral',   delay: 0.4  },
  { label: 'INSATISFECHO',     value: 4,  color: '#e07020', dark: '#7a3000', type: 'sad',       delay: 0.6  },
  { label: 'MUY INSATISFECHO', value: 2,  color: '#cc1f1f', dark: '#7a0000', type: 'verysad',   delay: 0.8  },
];

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pop  { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

  /* ── Eye animations ── */
  @keyframes rv-blink {
    0%, 85%, 100% { transform: scaleY(1); }
    91%           { transform: scaleY(0.06); }
    94%           { transform: scaleY(1); }
    97%           { transform: scaleY(0.06); }
  }
  @keyframes rv-look {
    0%, 35%, 100% { transform: translateX(0px); }
    10%           { transform: translateX(3.5px); }
    25%           { transform: translateX(-3px); }
  }
  @keyframes rv-squint-bounce {
    0%, 100% { transform: translateY(0px) scaleX(1); }
    50%      { transform: translateY(-3px) scaleX(1.08); }
  }
  @keyframes rv-sad-eye {
    0%, 100% { transform: translateY(0px); }
    50%      { transform: translateY(1.5px); }
  }

  /* ── Mouth animations ── */
  @keyframes rv-mouth-veryhappy {
    0%, 100% { transform: scaleX(1) translateY(0px); }
    50%      { transform: scaleX(1.1) translateY(2px); }
  }
  @keyframes rv-mouth-happy {
    0%, 100% { transform: scaleX(1) translateY(0px); }
    50%      { transform: scaleX(1.07) translateY(1px); }
  }
  @keyframes rv-mouth-neutral {
    0%, 100% { transform: rotate(0deg) scaleX(1); }
    28%      { transform: rotate(7deg) scaleX(0.94); }
    72%      { transform: rotate(-7deg) scaleX(0.94); }
  }
  @keyframes rv-mouth-sad {
    0%, 100% { transform: translateY(0px) scaleX(1); }
    50%      { transform: translateY(2.5px) scaleX(1.04); }
  }
  @keyframes rv-mouth-verysad {
    0%, 100% { transform: translateY(0px) scaleX(1); }
    50%      { transform: translateY(4px) scaleX(1.06); }
  }

  /* ── Layout ── */
  .rv-wrap {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
    background: linear-gradient(160deg, #c6e4f5 0%, #ddf0fa 55%, #c0dff0 100%);
    overflow: hidden;
  }
  .rv-gold-line { height: 5px; width: 100%; flex-shrink: 0; }

  .rv-topbar {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 24px;
    flex-shrink: 0;
  }
  .rv-logo-img {
    width: 110px; height: 110px;
    border-radius: 20px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .rv-logo-ph {
    width: 110px; height: 110px;
    border-radius: 20px;
    display: flex; align-items: center; justify-content: center;
    font-size: 50px; font-weight: 900;
    flex-shrink: 0;
  }
  .rv-store-name {
    font-size: clamp(30px, 7vw, 58px);
    font-weight: 900;
    color: #1e293b;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

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
    transition: transform 0.13s ease;
    outline: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .rv-face-btn:not(:disabled):hover  { transform: scale(1.1); }
  .rv-face-btn:not(:disabled):active { transform: scale(0.87); }

  .rv-face-svg {
    width: min(18vw, 190px);
    height: min(18vw, 190px);
    filter: drop-shadow(0 8px 20px rgba(0,0,0,0.35)) drop-shadow(0 2px 5px rgba(0,0,0,0.20));
    display: block;
    overflow: visible;
  }
  .rv-face-label {
    font-size: clamp(10px, 2vw, 16px);
    font-weight: 800;
    text-align: center;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    line-height: 1.25;
  }

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
  .rv-done-svg   { width: min(40vw, 200px); height: min(40vw, 200px); filter: drop-shadow(0 10px 24px rgba(0,0,0,0.38)) drop-shadow(0 3px 6px rgba(0,0,0,0.20)); overflow: visible; }
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

  @media (orientation: landscape) {
    .rv-topbar { padding: 6px 24px; }
    .rv-logo-img, .rv-logo-ph { width: 72px; height: 72px; font-size: 32px; border-radius: 14px; }
    .rv-store-name { font-size: clamp(22px, 5vh, 40px); }
    .rv-headline   { font-size: clamp(26px, 7vh, 56px); }
    .rv-face-svg   { width: min(16vh, 140px); height: min(16vh, 140px); }
    .rv-face-label { font-size: clamp(8px, 1.5vh, 13px); }
    .rv-faces      { gap: clamp(6px, 1.8vw, 18px); max-width: 1020px; }
    .rv-body       { gap: clamp(10px, 2.5vh, 30px); }
    .rv-done-svg   { width: min(28vh, 150px); height: min(28vh, 150px); }
    .rv-done-title { font-size: clamp(28px, 7vh, 52px); }
  }
  @media (min-width: 600px) and (orientation: portrait) {
    .rv-logo-img, .rv-logo-ph { width: 140px; height: 140px; font-size: 62px; border-radius: 24px; }
    .rv-store-name { font-size: clamp(34px, 6vw, 62px); }
    .rv-face-svg   { width: min(16vw, 210px); height: min(16vw, 210px); }
    .rv-face-label { font-size: clamp(12px, 2vw, 18px); }
    .rv-faces      { max-width: 860px; gap: clamp(10px, 2.5vw, 28px); }
    .rv-done-svg   { width: min(34vw, 220px); height: min(34vw, 220px); }
  }
`;

function FaceSVG({ type, color, dark, delay = 0, className = 'rv-face-svg' }) {
  const d = (n) => `${(delay + n).toFixed(2)}s`;
  const gId = `sg-${type}`;
  const hId = `hl-${type}`;

  const eyeCircle = (extra = 0) => ({
    transformBox: 'fill-box',
    transformOrigin: 'center',
    animation: `rv-blink 4.2s ease-in-out ${d(extra)} infinite`,
  });

  const eyeCircleLook = (extra = 0) => ({
    transformBox: 'fill-box',
    transformOrigin: 'center',
    animation: `rv-blink 4.2s ease-in-out ${d(extra)} infinite, rv-look 5.5s ease-in-out ${d(0.4)} infinite`,
  });

  const eyeCircleSad = (extra = 0) => ({
    transformBox: 'fill-box',
    transformOrigin: 'center',
    animation: `rv-blink 4.2s ease-in-out ${d(extra)} infinite, rv-sad-eye 3s ease-in-out ${d(0)} infinite`,
  });

  const squintEye = (extra = 0) => ({
    transformBox: 'fill-box',
    transformOrigin: 'center',
    animation: `rv-squint-bounce 1.8s ease-in-out ${d(extra)} infinite`,
  });

  const mouth = (anim, dur = 2.5) => ({
    transformBox: 'fill-box',
    transformOrigin: 'center',
    animation: `${anim} ${dur}s ease-in-out ${d(0)} infinite`,
  });

  return (
    <svg viewBox="0 0 100 100" className={className}>
      <defs>
        {/* Sphere shading: bright top-left (light source), dark bottom-right (shadow) */}
        <radialGradient id={gId} cx="35%" cy="28%" r="72%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.32"/>
          <stop offset="42%"  stopColor="#ffffff" stopOpacity="0"/>
          <stop offset="100%" stopColor="#000000" stopOpacity="0.36"/>
        </radialGradient>
        {/* Specular highlight: glossy bright spot top-left */}
        <radialGradient id={hId} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.70"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
      </defs>

      {/* Base color */}
      <circle cx="50" cy="50" r="50" fill={color}/>
      {/* 3D sphere shading overlay */}
      <circle cx="50" cy="50" r="50" fill={`url(#${gId})`}/>
      {/* Glossy specular highlight — top left */}
      <ellipse cx="34" cy="27" rx="19" ry="13" fill={`url(#${hId})`}/>
      {/* Subtle rim to give depth at the edge */}
      <circle cx="50" cy="50" r="49" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="3"/>

      {type === 'veryhappy' && <>
        {/* squinting happy eyes — bounce upward joyfully */}
        <path d="M26 38 Q35 27 44 38" stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none"
          style={squintEye(0)}/>
        <path d="M56 38 Q65 27 74 38" stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none"
          style={squintEye(0.09)}/>
        {/* big smile — widens with joy */}
        <path d="M20 55 Q50 83 80 55" stroke={dark} strokeWidth="5" strokeLinecap="round" fill="none"
          style={mouth('rv-mouth-veryhappy', 2)}/>
      </>}

      {type === 'happy' && <>
        <circle cx="35" cy="38" r="5.5" fill={dark} style={eyeCircle(0)}/>
        <circle cx="65" cy="38" r="5.5" fill={dark} style={eyeCircle(0.06)}/>
        <path d="M28 58 Q50 76 72 58" stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none"
          style={mouth('rv-mouth-happy', 2.6)}/>
      </>}

      {type === 'neutral' && <>
        {/* neutral eyes look side to side */}
        <circle cx="35" cy="38" r="5.5" fill={dark} style={eyeCircleLook(0)}/>
        <circle cx="65" cy="38" r="5.5" fill={dark} style={eyeCircleLook(0.06)}/>
        {/* flat mouth wiggles indecisively */}
        <line x1="28" y1="63" x2="72" y2="63" stroke={dark} strokeWidth="4.5" strokeLinecap="round"
          style={mouth('rv-mouth-neutral', 3)}/>
      </>}

      {type === 'sad' && <>
        {/* sad eyes droop slightly */}
        <circle cx="35" cy="38" r="5.5" fill={dark} style={eyeCircleSad(0)}/>
        <circle cx="65" cy="38" r="5.5" fill={dark} style={eyeCircleSad(0.06)}/>
        {/* frown droops down */}
        <path d="M28 70 Q50 55 72 70" stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none"
          style={mouth('rv-mouth-sad', 2.4)}/>
      </>}

      {type === 'verysad' && <>
        <circle cx="35" cy="38" r="5.5" fill={dark} style={eyeCircleSad(0)}/>
        <circle cx="65" cy="38" r="5.5" fill={dark} style={eyeCircleSad(0.06)}/>
        {/* strong frown drops harder */}
        <path d="M20 76 Q50 53 80 76" stroke={dark} strokeWidth="5" strokeLinecap="round" fill="none"
          style={mouth('rv-mouth-verysad', 2)}/>
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
                <FaceSVG
                  type={face.type}
                  color={face.color}
                  dark={face.dark}
                  delay={face.delay}
                />
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
