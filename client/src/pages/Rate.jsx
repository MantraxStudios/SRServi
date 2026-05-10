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

  .rv-wrap {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
    background: #fff;
    overflow: hidden;
  }

  /* Top bar */
  .rv-topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    flex-shrink: 0;
  }
  .rv-logo-img {
    width: 44px; height: 44px;
    border-radius: 12px;
    object-fit: cover;
    flex-shrink: 0;
  }
  .rv-logo-ph {
    width: 44px; height: 44px;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 900;
    flex-shrink: 0;
  }
  .rv-store-name {
    font-size: 17px;
    font-weight: 800;
    color: #1e293b;
    line-height: 1.1;
  }

  /* Gold line */
  .rv-gold-line {
    height: 4px;
    width: 100%;
    flex-shrink: 0;
  }

  /* Main body */
  .rv-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 32px;
    padding: 24px 16px;
  }

  .rv-headline {
    font-size: 22px;
    font-weight: 800;
    color: #1e293b;
    text-align: center;
    letter-spacing: -0.3px;
  }

  /* Emoji row */
  .rv-emojis {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    width: 100%;
    max-width: 560px;
  }

  .rv-emoji-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 2.5px solid transparent;
    border-radius: 20px;
    padding: 12px 4px;
    cursor: pointer;
    transition: transform 0.12s, background 0.12s, border-color 0.12s;
    outline: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .rv-emoji-btn:active {
    transform: scale(0.92);
  }

  .rv-emoji-icon {
    font-size: clamp(52px, 11vw, 80px);
    line-height: 1;
    display: block;
    user-select: none;
  }

  .rv-brand {
    font-size: 11px;
    color: #d1d5db;
    letter-spacing: 1px;
    text-align: center;
  }

  /* Submitting overlay */
  .rv-sending {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }

  /* Done screen */
  .rv-done {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 24px;
  }
  .rv-done-emoji { font-size: 90px; line-height: 1; }
  .rv-done-title { font-size: 28px; font-weight: 900; color: #1e293b; }
  .rv-done-sub { font-size: 13px; color: #9ca3af; }

  /* Tablet landscape */
  @media (min-width: 700px) and (orientation: landscape) {
    .rv-topbar { padding: 18px 32px; }
    .rv-logo-img, .rv-logo-ph { width: 52px; height: 52px; border-radius: 14px; }
    .rv-store-name { font-size: 20px; }
    .rv-headline { font-size: 28px; }
    .rv-emojis {
      gap: 16px;
      max-width: 800px;
    }
    .rv-emoji-btn {
      border-radius: 28px;
      padding: 20px 8px;
    }
    .rv-emoji-icon {
      font-size: clamp(80px, 10vw, 120px);
    }
  }

  @media (min-width: 1024px) and (orientation: landscape) {
    .rv-emoji-icon {
      font-size: clamp(100px, 10vw, 140px);
    }
    .rv-emojis { max-width: 960px; gap: 24px; }
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
        <div className="rv-gold-line" style={{ background: accent }} />
        {topBar}

        <div className="rv-body">
          <p className="rv-headline">¿Cómo fue tu visita?</p>

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

const spinnerStyle = (accent) => ({
  width: 40, height: 40,
  border: '4px solid #e5e7eb',
  borderTopColor: accent || '#D4AF37',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
});
