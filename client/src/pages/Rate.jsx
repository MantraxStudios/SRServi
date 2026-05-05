import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const EMOJIS = [
  { emoji: '😡', label: 'Muy malo',  value: 2  },
  { emoji: '😕', label: 'Malo',      value: 4  },
  { emoji: '😐', label: 'Regular',   value: 6  },
  { emoji: '😊', label: 'Bueno',     value: 8  },
  { emoji: '🤩', label: 'Excelente', value: 10 },
];

export default function Rate() {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');

  const [store, setStore]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [selected, setSelected] = useState(null);
  const [comment, setComment]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);

  useEffect(() => {
    fetch(`/api/public/${code}`)
      .then(r => r.json())
      .then(d => { if (d.store) setStore(d.store); else setError('Tienda no encontrada'); })
      .catch(() => setError('Error al cargar la tienda'))
      .finally(() => setLoading(false));
  }, [code]);

  const submit = async () => {
    if (selected === null) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/${code}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: EMOJIS[selected].value, comment, order_id: orderId, source: 'qr' }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      alert('Error al enviar. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const primary = store?.primary_color || '#1a1a2e';
  const accent  = store?.accent_color  || '#D4AF37';
  const name    = store?.name || '';

  /* ── pantallas de carga / error ─────────────────────────────────────── */
  if (loading) return (
    <div style={{ ...full, background: '#0d0d1a', justifyContent: 'center' }}>
      <div style={spinner} />
    </div>
  );

  if (error) return (
    <div style={{ ...full, background: '#0d0d1a', justifyContent: 'center' }}>
      <p style={{ color: '#ef4444', fontSize: 16 }}>{error}</p>
    </div>
  );

  /* ── pantalla de agradecimiento ─────────────────────────────────────── */
  if (done) {
    const ch = EMOJIS[selected] || EMOJIS[4];
    return (
      <div style={{ ...full, background: `linear-gradient(145deg, ${primary} 0%, #0d0d1a 100%)` }}>
        {/* línea dorada superior */}
        <div style={goldLine(accent)} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
          <div style={{ fontSize: 90, lineHeight: 1, filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))' }}>{ch.emoji}</div>
          <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 900, margin: 0 }}>¡Gracias!</h2>
          <p style={{ color: accent, fontSize: 16, fontWeight: 700, margin: 0 }}>{ch.label}</p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0 }}>Tu opinión nos ayuda a mejorar.</p>
        </div>

        {/* branding */}
        <p style={brandText}>Powered by SRAutomatic.cl</p>
        <div style={goldLine(accent)} />
      </div>
    );
  }

  /* ── página principal ───────────────────────────────────────────────── */
  return (
    <div style={{ ...full, background: `linear-gradient(145deg, ${primary} 0%, #0d0d1a 100%)` }}>

      {/* círculos decorativos (igual que el JPG) */}
      <div style={circle(accent, 220, -60, -60, 0.07)} />
      <div style={circle(accent, 160, 'auto', -40, 0.05, 'bottom')} />

      {/* línea dorada superior */}
      <div style={goldLine(accent)} />

      {/* ── contenido ────────────────────────────────────────────────── */}
      <div style={scroll}>

        {/* logo / inicial */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 40 }}>
          {store?.logo_url ? (
            <img src={store.logo_url} alt={name}
              style={{ width: 80, height: 80, borderRadius: 20, objectFit: 'cover', border: `3px solid ${accent}`, boxShadow: `0 4px 24px ${accent}55` }} />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: 20,
              background: accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 34, fontWeight: 900, color: primary,
              boxShadow: `0 4px 24px ${accent}55`,
            }}>
              {name[0]?.toUpperCase() || '★'}
            </div>
          )}
          <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 22, margin: 0, textAlign: 'center' }}>{name}</h1>
          <p style={{ color: accent, fontWeight: 700, fontSize: 13, margin: 0, letterSpacing: 2, textTransform: 'uppercase' }}>
            Califica tu experiencia
          </p>
          {/* estrellitas decorativas */}
          <p style={{ color: accent, fontSize: 20, margin: 0, letterSpacing: 6 }}>★ ★ ★ ★ ★</p>
        </div>

        {/* ── tarjeta blanca (emojis + comentario) ─────────────────── */}
        <div style={whiteCard}>

          <p style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, fontWeight: 600, margin: '0 0 20px', letterSpacing: 0.5 }}>
            ¿Cómo fue tu visita?
          </p>

          {/* emojis */}
          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 20 }}>
            {EMOJIS.map((item, i) => {
              const active = selected === i;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    background: active ? `${primary}15` : 'transparent',
                    border: active ? `2.5px solid ${primary}` : '2.5px solid transparent',
                    borderRadius: 16, padding: '10px 6px', cursor: 'pointer',
                    transition: 'all 0.15s', outline: 'none', minWidth: 52,
                  }}
                >
                  <span style={{
                    fontSize: 40, lineHeight: 1, display: 'block',
                    transform: active ? 'scale(1.25)' : 'scale(1)',
                    transition: 'transform 0.15s',
                    filter: active ? `drop-shadow(0 3px 8px ${primary}55)` : 'none',
                  }}>{item.emoji}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: 0.3, color: active ? primary : '#9ca3af',
                  }}>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* divider */}
          <div style={{ height: 1, background: '#f1f5f9', margin: '0 0 16px' }} />

          {/* comentario */}
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Deja un comentario (opcional)..."
            maxLength={500}
            rows={3}
            style={{
              width: '100%', borderRadius: 12, border: '2px solid #e5e7eb',
              padding: '10px 12px', fontSize: 14, resize: 'none',
              fontFamily: 'inherit', boxSizing: 'border-box',
              outline: 'none', color: '#374151', transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = primary}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />
          <p style={{ fontSize: 11, color: '#d1d5db', textAlign: 'right', margin: '3px 0 16px' }}>{comment.length}/500</p>

          {/* botón */}
          <button
            onClick={submit}
            disabled={selected === null || submitting}
            style={{
              width: '100%', padding: '15px', borderRadius: 14, border: 'none',
              background: selected !== null
                ? `linear-gradient(135deg, ${primary}, ${accent})`
                : '#e5e7eb',
              color: selected !== null ? '#fff' : '#9ca3af',
              fontWeight: 900, fontSize: 16, cursor: selected !== null ? 'pointer' : 'not-allowed',
              letterSpacing: 0.5, transition: 'all 0.2s',
              boxShadow: selected !== null ? `0 4px 20px ${primary}55` : 'none',
            }}
          >
            {submitting
              ? 'Enviando...'
              : selected !== null
                ? `Enviar ${EMOJIS[selected].emoji}`
                : 'Selecciona una opción'}
          </button>
        </div>

        {/* branding */}
        <p style={brandText}>Powered by SRAutomatic.cl</p>
      </div>

      {/* línea dorada inferior */}
      <div style={goldLine(accent)} />
    </div>
  );
}

/* ── estilos ─────────────────────────────────────────────────────────────── */
const full = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  position: 'relative',
  overflow: 'hidden',
};

const scroll = {
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 24,
  padding: '0 16px 32px',
  position: 'relative',
  zIndex: 1,
};

const whiteCard = {
  background: '#fff',
  borderRadius: 24,
  padding: '24px 20px',
  width: '100%',
  maxWidth: 420,
  boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
};

const goldLine = (accent) => ({
  height: 5,
  background: accent,
  width: '100%',
  flexShrink: 0,
  zIndex: 2,
});

const brandText = {
  color: 'rgba(255,255,255,0.3)',
  fontSize: 11,
  textAlign: 'center',
  margin: 0,
  letterSpacing: 1,
  zIndex: 1,
  position: 'relative',
};

const circle = (accent, size, left, top, opacity, vAlign = 'top') => ({
  position: 'absolute',
  width: size, height: size,
  borderRadius: '50%',
  background: accent,
  opacity,
  left: left === 'auto' ? undefined : left,
  right: left === 'auto' ? top : undefined,
  top: vAlign === 'top' ? top : undefined,
  bottom: vAlign === 'bottom' ? top : undefined,
  pointerEvents: 'none',
});

const spinner = {
  width: 40, height: 40,
  border: '4px solid rgba(255,255,255,0.15)',
  borderTopColor: '#D4AF37',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};
