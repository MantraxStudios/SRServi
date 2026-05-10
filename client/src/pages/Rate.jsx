import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const EMOJIS = [
  { emoji: '😡', value: 2  },
  { emoji: '😕', value: 4  },
  { emoji: '😐', value: 6  },
  { emoji: '😊', value: 8  },
  { emoji: '🤩', value: 10 },
];

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes bubble-rise {
    0%   { transform: translateY(0)      scale(1);    opacity: 0.85; }
    80%  { transform: translateY(-110vh) scale(1.05); opacity: 0.6;  }
    100% { transform: translateY(-130vh) scale(0.95); opacity: 0;    }
  }
  @keyframes bubble-sway {
    0%   { margin-left: 0px;  }
    25%  { margin-left: 28px; }
    75%  { margin-left: -28px;}
    100% { margin-left: 0px;  }
  }

  .rv-bubbles {
    position: fixed;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 0;
  }
  .rv-bubble {
    position: absolute;
    bottom: -80px;
    border-radius: 50%;
    animation: bubble-rise linear infinite, bubble-sway ease-in-out infinite;
  }

  .rv-wrap {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
    background: #fff;
    overflow: hidden;
    position: relative;
  }

  /* Gold line */
  .rv-gold-line {
    height: 5px;
    width: 100%;
    flex-shrink: 0;
    position: relative;
    z-index: 1;
  }

  /* Top bar */
  .rv-topbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 20px;
    flex-shrink: 0;
    position: relative;
    z-index: 1;
  }
  .rv-logo-img {
    width: 140px; height: 140px;
    border-radius: 22px;
    object-fit: contain;
    flex-shrink: 0;
    display: block;
  }
  .rv-logo-ph {
    width: 140px; height: 140px;
    border-radius: 22px;
    display: flex; align-items: center; justify-content: center;
    font-size: 60px; font-weight: 900;
    flex-shrink: 0;
  }
  .rv-store-name {
    font-size: clamp(28px, 7vw, 44px);
    font-weight: 900;
    color: #1e293b;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Main body */
  .rv-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(16px, 3vh, 36px);
    padding: 8px 16px 16px;
    position: relative;
    z-index: 1;
    overflow: hidden;
  }

  .rv-headline {
    font-size: clamp(32px, 9vw, 68px);
    font-weight: 900;
    color: #1e293b;
    text-align: center;
    letter-spacing: -0.5px;
    line-height: 1.1;
    padding: 0 8px;
  }

  /* Emoji row */
  .rv-emojis {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: clamp(2px, 1vw, 10px);
    width: 100%;
    max-width: 100%;
    flex-shrink: 0;
  }

  .rv-emoji-btn {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 2.5px solid transparent;
    border-radius: 16px;
    padding: clamp(6px, 1.5vh, 16px) 2px;
    cursor: pointer;
    transition: transform 0.12s, background 0.12s, border-color 0.12s;
    outline: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .rv-emoji-btn:active { transform: scale(0.88); }

  /* Portrait: 5 emojis must fit across width */
  .rv-emoji-icon {
    font-size: min(15vw, 100px);
    line-height: 1;
    display: block;
    user-select: none;
  }

  .rv-brand {
    font-size: 12px;
    color: #d1d5db;
    letter-spacing: 1px;
    text-align: center;
    flex-shrink: 0;
  }

  /* Done screen */
  .rv-done {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(12px, 2.5vh, 24px);
    padding: 24px;
    position: relative;
    z-index: 1;
  }
  .rv-done-emoji { font-size: clamp(80px, 22vw, 130px); line-height: 1; }
  .rv-done-title { font-size: clamp(32px, 9vw, 56px); font-weight: 900; color: #1e293b; }
  .rv-done-sub   { font-size: clamp(16px, 3vw, 22px); color: #9ca3af; }

  /* Landscape (short screen) */
  @media (orientation: landscape) {
    .rv-topbar { padding: 6px 24px; gap: 14px; }
    .rv-logo-img, .rv-logo-ph { width: 72px; height: 72px; border-radius: 16px; font-size: 30px; }
    .rv-store-name { font-size: clamp(22px, 4.5vh, 38px); }
    .rv-headline   { font-size: clamp(24px, 6vh, 52px); }
    .rv-emoji-icon { font-size: min(16vh, 130px); }
    .rv-emoji-btn  { border-radius: 20px; padding: clamp(6px, 1.5vh, 18px) 4px; }
    .rv-emojis     { gap: clamp(4px, 1.5vw, 20px); max-width: 900px; }
    .rv-done-emoji { font-size: min(22vh, 120px); }
    .rv-done-title { font-size: clamp(26px, 7vh, 52px); }
  }

  /* Tablet landscape */
  @media (min-width: 900px) and (orientation: landscape) {
    .rv-topbar { padding: 10px 40px; gap: 18px; }
    .rv-logo-img, .rv-logo-ph { width: 90px; height: 90px; border-radius: 20px; font-size: 38px; }
    .rv-store-name { font-size: clamp(30px, 5vh, 46px); }
    .rv-headline   { font-size: clamp(36px, 8vh, 64px); }
    .rv-emoji-icon { font-size: min(20vh, 160px); }
    .rv-emojis     { gap: clamp(10px, 2vw, 32px); max-width: 1100px; }
    .rv-done-title { font-size: clamp(36px, 9vh, 60px); }
  }

  /* Tablet portrait */
  @media (min-width: 600px) and (orientation: portrait) {
    .rv-topbar { padding: 18px 32px; gap: 20px; }
    .rv-logo-img, .rv-logo-ph { width: 160px; height: 160px; border-radius: 26px; font-size: 68px; }
    .rv-store-name { font-size: clamp(34px, 5vw, 52px); }
    .rv-headline   { font-size: clamp(42px, 7vw, 72px); }
    .rv-emoji-icon { font-size: min(13vw, 120px); }
    .rv-emojis     { gap: clamp(8px, 1.5vw, 20px); max-width: 760px; }
    .rv-done-emoji { font-size: clamp(100px, 20vw, 160px); }
    .rv-done-title { font-size: clamp(42px, 8vw, 64px); }
  }
`;

export default function Rate() {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');

  const [store, setStore]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(null); // stores selected emoji

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

  const select = async (item) => {
    if (submitting || done) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/${code}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: item.value, comment: '', order_id: orderId, source: 'qr' }),
      });
      if (!res.ok) throw new Error();
      setDone(item);
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
          style={{ border: `2px solid ${accent}` }} />
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
        <Bubbles accent={accent} />
        <div className="rv-gold-line" style={{ background: accent }} />
        {topBar}
        <div className="rv-done">
          <div className="rv-done-emoji">{done.emoji}</div>
          <h2 className="rv-done-title">¡Gracias!</h2>
          <p className="rv-done-sub">Tu opinión nos ayuda a mejorar.</p>
        </div>
        <p className="rv-brand" style={{ paddingBottom: 16 }}>Powered by SRAutomatic.cl</p>
        <div className="rv-gold-line" style={{ background: accent }} />
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="rv-wrap">
        <Bubbles accent={accent} />
        <div className="rv-gold-line" style={{ background: accent }} />
        {topBar}

        <div className="rv-body">
          <p className="rv-headline">¿Cómo fue tu experiencia hoy?</p>

          <div className="rv-emojis">
            {EMOJIS.map((item) => (
              <button
                key={item.value}
                className="rv-emoji-btn"
                onClick={() => select(item)}
                disabled={submitting}
                style={{ opacity: submitting ? 0.5 : 1 }}
                onMouseEnter={e => { e.currentTarget.style.background = `${accent}18`; e.currentTarget.style.borderColor = `${accent}55`; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
              >
                <span className="rv-emoji-icon">{item.emoji}</span>
              </button>
            ))}
          </div>

          <p className="rv-brand">Powered by SRAutomatic.cl</p>
        </div>

        <div className="rv-gold-line" style={{ background: accent }} />
      </div>
    </>
  );
}

const BUBBLES = [
  { size: 34, left: '5%',  dur: 4.5, sway: 2.8, delay: 0   },
  { size: 20, left: '14%', dur: 3.8, sway: 2.2, delay: 0.6 },
  { size: 50, left: '25%', dur: 5.2, sway: 3.4, delay: 0.2 },
  { size: 16, left: '38%', dur: 3.4, sway: 2.0, delay: 1.2 },
  { size: 38, left: '50%', dur: 4.8, sway: 3.0, delay: 0.9 },
  { size: 24, left: '62%', dur: 3.6, sway: 2.4, delay: 0.4 },
  { size: 56, left: '73%', dur: 5.5, sway: 3.6, delay: 1.5 },
  { size: 18, left: '83%', dur: 3.9, sway: 2.1, delay: 0.7 },
  { size: 42, left: '91%', dur: 4.6, sway: 3.2, delay: 0.3 },
  { size: 22, left: '2%',  dur: 4.2, sway: 2.5, delay: 2.0 },
  { size: 30, left: '46%', dur: 3.7, sway: 2.3, delay: 1.8 },
  { size: 14, left: '70%', dur: 3.3, sway: 1.9, delay: 1.1 },
];

function Bubbles({ accent }) {
  const color = accent || '#D4AF37';
  return (
    <div className="rv-bubbles">
      {BUBBLES.map((b, i) => (
        <div
          key={i}
          className="rv-bubble"
          style={{
            width: b.size,
            height: b.size,
            left: b.left,
            background: `radial-gradient(circle at 33% 33%, ${color}88, ${color}33)`,
            border: `2px solid ${color}77`,
            boxShadow: `0 0 8px ${color}44`,
            animationDuration: `${b.dur}s, ${b.sway}s`,
            animationDelay: `${b.delay}s, ${b.delay * 0.5}s`,
          }}
        />
      ))}
    </div>
  );
}

const spinnerStyle = (accent) => ({
  width: 40, height: 40,
  border: '4px solid #e5e7eb',
  borderTopColor: accent || '#D4AF37',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
});
