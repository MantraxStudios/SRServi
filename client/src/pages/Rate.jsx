import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

/* ── Ambient (day/night cycle) ──────────────────────────────────────── */
function getAmbientKey() {
  const h = new Date().getHours();
  if (h >= 5  && h < 9)  return 'dawn';
  if (h >= 9  && h < 14) return 'morning';
  if (h >= 14 && h < 19) return 'afternoon';
  if (h >= 19 && h < 22) return 'sunset';
  return 'night';
}

const AMBIENTS = {
  dawn: {
    bg:      'linear-gradient(160deg, #fdb97d 0%, #f7927a 45%, #f06a7a 100%)',
    text:    '#3d1500',
    sub:     '#7a3a1a',
    brand:   'rgba(61,21,0,0.35)',
    stars:   false,
    clouds:  true,
    label:   '🌅 Amanecer',
  },
  morning: {
    bg:      'linear-gradient(160deg, #c6e4f5 0%, #ddf0fa 55%, #c0dff0 100%)',
    text:    '#1e293b',
    sub:     '#64748b',
    brand:   'rgba(30,41,59,0.30)',
    stars:   false,
    clouds:  false,
    label:   '☀️ Mañana',
  },
  afternoon: {
    bg:      'linear-gradient(160deg, #fff0c4 0%, #ffe080 45%, #ffcc00 100%)',
    text:    '#3d2a00',
    sub:     '#7a5500',
    brand:   'rgba(61,42,0,0.30)',
    stars:   false,
    clouds:  false,
    label:   '🌤️ Tarde',
  },
  sunset: {
    bg:      'linear-gradient(160deg, #ff6b35 0%, #d9534f 38%, #7b2fa0 100%)',
    text:    '#ffffff',
    sub:     'rgba(255,255,255,0.75)',
    brand:   'rgba(255,255,255,0.30)',
    stars:   false,
    clouds:  false,
    label:   '🌆 Atardecer',
  },
  night: {
    bg:      'linear-gradient(160deg, #0d1b2a 0%, #1b2b4b 55%, #0a1628 100%)',
    text:    '#e2e8f0',
    sub:     '#94a3b8',
    brand:   'rgba(226,232,240,0.25)',
    stars:   true,
    clouds:  false,
    label:   '🌙 Noche',
  },
};

/* ── Stars (night) ──────────────────────────────────────────────────── */
const STARS = [
  {cx:8,  cy:8,  r:0.7, d:0.0 },{cx:22, cy:4,  r:0.5, d:0.4 },{cx:35, cy:14, r:1.0, d:0.8 },
  {cx:48, cy:6,  r:0.6, d:1.2 },{cx:61, cy:12, r:0.8, d:0.3 },{cx:74, cy:5,  r:0.5, d:1.6 },
  {cx:85, cy:16, r:1.1, d:0.7 },{cx:93, cy:9,  r:0.6, d:1.0 },{cx:14, cy:26, r:0.5, d:2.0 },
  {cx:28, cy:32, r:0.9, d:0.5 },{cx:42, cy:22, r:0.6, d:1.4 },{cx:55, cy:28, r:0.8, d:0.1 },
  {cx:67, cy:20, r:0.5, d:1.8 },{cx:79, cy:30, r:1.0, d:0.6 },{cx:96, cy:24, r:0.7, d:1.1 },
  {cx:5,  cy:42, r:0.8, d:1.5 },{cx:19, cy:48, r:0.5, d:0.2 },{cx:33, cy:50, r:0.7, d:1.9 },
  {cx:50, cy:38, r:1.0, d:0.9 },{cx:64, cy:44, r:0.6, d:0.4 },{cx:77, cy:52, r:0.9, d:1.3 },
  {cx:90, cy:40, r:0.5, d:0.7 },{cx:10, cy:60, r:0.8, d:1.7 },{cx:25, cy:65, r:0.6, d:0.3 },
  {cx:40, cy:70, r:1.0, d:1.0 },{cx:57, cy:58, r:0.7, d:2.1 },{cx:72, cy:62, r:0.5, d:0.6 },
  {cx:84, cy:68, r:0.9, d:1.4 },{cx:97, cy:55, r:0.6, d:0.8 },{cx:3,  cy:75, r:0.8, d:1.2 },
];

function Stars() {
  return (
    <svg
      style={{ position:'fixed', inset:0, width:'100%', height:'75%', pointerEvents:'none', zIndex:0 }}
      viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
    >
      {STARS.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r}
          fill="white"
          style={{ animation:`rv-twinkle ${1.5 + (i % 5) * 0.4}s ease-in-out ${s.d}s infinite` }}
        />
      ))}
    </svg>
  );
}

/* ── Faces ──────────────────────────────────────────────────────────── */
const FACES = [
  { label: 'MUY INSATISFECHO', value: 2,  color: '#cc1f1f', dark: '#7a0000', type: 'verysad',   delay: 0   },
  { label: 'INSATISFECHO',     value: 4,  color: '#e07020', dark: '#7a3000', type: 'sad',       delay: 0.2 },
  { label: 'INDIFERENTE',      value: 6,  color: '#f5c200', dark: '#7a6000', type: 'neutral',   delay: 0.4 },
  { label: 'SATISFECHO',       value: 8,  color: '#7ac52e', dark: '#3d6e14', type: 'happy',     delay: 0.6 },
  { label: 'MUY SATISFECHO',   value: 10, color: '#1e8a1e', dark: '#0d4d0d', type: 'veryhappy', delay: 0.8 },
];

/* ── CSS ─────────────────────────────────────────────────────────────── */
const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pop  { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

  /* Ambient */
  @keyframes rv-twinkle {
    0%, 100% { opacity: 0.25; r: 0.5; }
    50%      { opacity: 1;    r: 1.1; }
  }

  /* Eye animations */
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

  /* Mouth animations */
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

  /* Layout */
  .rv-wrap {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
    overflow: hidden;
    position: relative;
    transition: background 4s ease;
  }
  .rv-gold-line { height: 5px; width: 100%; flex-shrink: 0; position: relative; z-index: 1; }

  .rv-topbar {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 24px;
    flex-shrink: 0;
    position: relative;
    z-index: 1;
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
    position: relative;
    z-index: 1;
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
    gap: clamp(4px, 1.5vw, 16px);
    width: 100%;
    max-width: 1100px;
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
    width: min(18vw, 260px);
    height: min(18vw, 260px);
    filter: drop-shadow(0 8px 20px rgba(0,0,0,0.35)) drop-shadow(0 2px 5px rgba(0,0,0,0.20));
    display: block;
    overflow: visible;
  }
  .rv-face-label {
    font-size: clamp(13px, 2.8vw, 22px);
    font-weight: 900;
    text-align: center;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    line-height: 1.3;
    text-shadow: 0 1px 4px rgba(0,0,0,0.30);
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
    position: relative;
    z-index: 1;
  }
  .rv-done-svg   { width: min(40vw, 200px); height: min(40vw, 200px); filter: drop-shadow(0 10px 24px rgba(0,0,0,0.38)) drop-shadow(0 3px 6px rgba(0,0,0,0.20)); overflow: visible; }
  .rv-done-title { font-size: clamp(36px, 9vw, 60px); font-weight: 900; }
  .rv-done-sub   { font-size: clamp(16px, 3vw, 22px); }

  .rv-brand {
    font-size: 12px;
    letter-spacing: 1px;
    text-align: center;
    flex-shrink: 0;
    padding-bottom: 10px;
    position: relative;
    z-index: 1;
  }

  /* Ambient badge */
  .rv-ambient-badge {
    position: fixed;
    top: 10px;
    right: 14px;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 20px;
    background: rgba(255,255,255,0.18);
    backdrop-filter: blur(6px);
    letter-spacing: 0.3px;
    z-index: 10;
    pointer-events: none;
  }

  @media (orientation: landscape) {
    .rv-topbar { padding: 6px 24px; }
    .rv-logo-img, .rv-logo-ph { width: 72px; height: 72px; font-size: 32px; border-radius: 14px; }
    .rv-store-name { font-size: clamp(22px, 5vh, 40px); }
    .rv-headline   { font-size: clamp(26px, 7vh, 56px); }
    .rv-face-svg   { width: min(20vh, 175px); height: min(20vh, 175px); }
    .rv-face-label { font-size: clamp(10px, 2vh, 16px); }
    .rv-faces      { gap: clamp(6px, 1.8vw, 18px); max-width: 1020px; }
    .rv-body       { gap: clamp(10px, 2.5vh, 30px); }
    .rv-done-svg   { width: min(28vh, 150px); height: min(28vh, 150px); }
    .rv-done-title { font-size: clamp(28px, 7vh, 52px); }
  }
  @media (min-width: 600px) and (orientation: portrait) {
    .rv-logo-img, .rv-logo-ph { width: 140px; height: 140px; font-size: 62px; border-radius: 24px; }
    .rv-store-name { font-size: clamp(34px, 6vw, 62px); }
    .rv-face-svg   { width: min(18vw, 280px); height: min(18vw, 280px); }
    .rv-face-label { font-size: clamp(14px, 2.5vw, 24px); }
    .rv-faces      { max-width: 1100px; gap: clamp(8px, 2vw, 22px); }
    .rv-done-svg   { width: min(34vw, 220px); height: min(34vw, 220px); }
  }
`;

/* ── FaceSVG ─────────────────────────────────────────────────────────── */
function FaceSVG({ type, color, dark, delay = 0, className = 'rv-face-svg' }) {
  const d   = (n) => `${(delay + n).toFixed(2)}s`;
  const gId = `sg-${type}`;
  const hId = `hl-${type}`;

  const eyeCircle = (extra = 0) => ({
    transformBox: 'fill-box', transformOrigin: 'center',
    animation: `rv-blink 4.2s ease-in-out ${d(extra)} infinite`,
  });
  const eyeCircleLook = (extra = 0) => ({
    transformBox: 'fill-box', transformOrigin: 'center',
    animation: `rv-blink 4.2s ease-in-out ${d(extra)} infinite, rv-look 5.5s ease-in-out ${d(0.4)} infinite`,
  });
  const eyeCircleSad = (extra = 0) => ({
    transformBox: 'fill-box', transformOrigin: 'center',
    animation: `rv-blink 4.2s ease-in-out ${d(extra)} infinite, rv-sad-eye 3s ease-in-out ${d(0)} infinite`,
  });
  const squintEye = (extra = 0) => ({
    transformBox: 'fill-box', transformOrigin: 'center',
    animation: `rv-squint-bounce 1.8s ease-in-out ${d(extra)} infinite`,
  });
  const mouth = (anim, dur = 2.5) => ({
    transformBox: 'fill-box', transformOrigin: 'center',
    animation: `${anim} ${dur}s ease-in-out ${d(0)} infinite`,
  });

  return (
    <svg viewBox="0 0 100 100" className={className}>
      <defs>
        <radialGradient id={gId} cx="35%" cy="28%" r="72%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.32"/>
          <stop offset="42%"  stopColor="#ffffff" stopOpacity="0"/>
          <stop offset="100%" stopColor="#000000" stopOpacity="0.36"/>
        </radialGradient>
        <radialGradient id={hId} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.70"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
      </defs>

      <circle cx="50" cy="50" r="50" fill={color}/>
      <circle cx="50" cy="50" r="50" fill={`url(#${gId})`}/>
      <ellipse cx="34" cy="27" rx="19" ry="13" fill={`url(#${hId})`}/>
      <circle cx="50" cy="50" r="49" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="3"/>

      {type === 'veryhappy' && <>
        <path d="M26 38 Q35 27 44 38" stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none" style={squintEye(0)}/>
        <path d="M56 38 Q65 27 74 38" stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none" style={squintEye(0.09)}/>
        <path d="M20 55 Q50 83 80 55" stroke={dark} strokeWidth="5"   strokeLinecap="round" fill="none" style={mouth('rv-mouth-veryhappy', 2)}/>
      </>}
      {type === 'happy' && <>
        <circle cx="35" cy="38" r="5.5" fill={dark} style={eyeCircle(0)}/>
        <circle cx="65" cy="38" r="5.5" fill={dark} style={eyeCircle(0.06)}/>
        <path d="M28 58 Q50 76 72 58" stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none" style={mouth('rv-mouth-happy', 2.6)}/>
      </>}
      {type === 'neutral' && <>
        <circle cx="35" cy="38" r="5.5" fill={dark} style={eyeCircleLook(0)}/>
        <circle cx="65" cy="38" r="5.5" fill={dark} style={eyeCircleLook(0.06)}/>
        <line x1="28" y1="63" x2="72" y2="63" stroke={dark} strokeWidth="4.5" strokeLinecap="round" style={mouth('rv-mouth-neutral', 3)}/>
      </>}
      {type === 'sad' && <>
        <circle cx="35" cy="38" r="5.5" fill={dark} style={eyeCircleSad(0)}/>
        <circle cx="65" cy="38" r="5.5" fill={dark} style={eyeCircleSad(0.06)}/>
        <path d="M28 70 Q50 55 72 70" stroke={dark} strokeWidth="4.5" strokeLinecap="round" fill="none" style={mouth('rv-mouth-sad', 2.4)}/>
      </>}
      {type === 'verysad' && <>
        <circle cx="35" cy="38" r="5.5" fill={dark} style={eyeCircleSad(0)}/>
        <circle cx="65" cy="38" r="5.5" fill={dark} style={eyeCircleSad(0.06)}/>
        <path d="M20 76 Q50 53 80 76" stroke={dark} strokeWidth="5"   strokeLinecap="round" fill="none" style={mouth('rv-mouth-verysad', 2)}/>
      </>}
    </svg>
  );
}

/* ── Rate ────────────────────────────────────────────────────────────── */
export default function Rate() {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');

  const [store, setStore]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(null);
  const [ambientKey, setAmbientKey] = useState(getAmbientKey);

  /* refresh ambient every minute (for long-running kiosk sessions) */
  useEffect(() => {
    const t = setInterval(() => setAmbientKey(getAmbientKey()), 60_000);
    return () => clearInterval(t);
  }, []);

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
  const amb     = AMBIENTS[ambientKey];

  const wrapStyle = { background: amb.bg };

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
      <span className="rv-store-name" style={{ color: amb.text }}>{name}</span>
    </div>
  );

  if (loading) return (
    <>
      <style>{CSS}</style>
      <div className="rv-wrap" style={{ ...wrapStyle, justifyContent: 'center', alignItems: 'center' }}>
        <div style={spinnerStyle(accent)} />
      </div>
    </>
  );

  if (error) return (
    <>
      <style>{CSS}</style>
      <div className="rv-wrap" style={{ ...wrapStyle, justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: '#ef4444', fontSize: 16 }}>{error}</p>
      </div>
    </>
  );

  if (done) return (
    <>
      <style>{CSS}</style>
      <div className="rv-wrap" style={wrapStyle}>
        {amb.stars && <Stars />}
        <div className="rv-ambient-badge" style={{ color: amb.text }}>{amb.label}</div>
        <div className="rv-gold-line" style={{ background: accent }} />
        {topBar}
        <div className="rv-done">
          <FaceSVG type={done.type} color={done.color} dark={done.dark} className="rv-done-svg" />
          <h2 className="rv-done-title" style={{ color: amb.text }}>¡Gracias!</h2>
          <p className="rv-done-sub"   style={{ color: amb.sub  }}>Tu opinión nos ayuda a mejorar.</p>
        </div>
        <p className="rv-brand" style={{ color: amb.brand }}>Powered by SRAutomatic.cl</p>
        <div className="rv-gold-line" style={{ background: accent }} />
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="rv-wrap" style={wrapStyle}>
        {amb.stars && <Stars />}
        <div className="rv-ambient-badge" style={{ color: amb.text }}>{amb.label}</div>
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
                <FaceSVG type={face.type} color={face.color} dark={face.dark} delay={face.delay} />
                <span className="rv-face-label" style={{ color: amb.text }}>
                  {face.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <p className="rv-brand" style={{ color: amb.brand }}>Powered by SRAutomatic.cl</p>
        <div className="rv-gold-line" style={{ background: accent }} />
      </div>
    </>
  );
}

const spinnerStyle = (accent) => ({
  width: 40, height: 40,
  border: '4px solid rgba(255,255,255,0.3)',
  borderTopColor: accent || '#D4AF37',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
});
