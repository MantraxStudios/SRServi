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

  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null); // index in EMOJIS
  const [hover, setHover] = useState(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/public/${code}`)
      .then(r => r.json())
      .then(data => { if (data.store) setStore(data.store); else setError('Tienda no encontrada'); })
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
      alert('Error al enviar la calificación. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const primary = store?.primary_color || '#1a1a2e';
  const accent  = store?.accent_color  || '#D4AF37';
  const active  = hover ?? selected;

  if (loading) return <div style={pg(primary)}><div style={sp} /></div>;

  if (error) return (
    <div style={pg(primary)}>
      <div style={card}><p style={{ color: '#ef4444', textAlign: 'center' }}>{error}</p></div>
    </div>
  );

  if (done) {
    const chosen = EMOJIS[selected] || EMOJIS[4];
    return (
      <div style={{ ...pg(primary), background: `linear-gradient(135deg, ${primary} 0%, #0d0d1a 100%)` }}>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ fontSize: 80, marginBottom: 8 }}>{chosen.emoji}</div>
          <h2 style={{ color: primary, fontSize: 22, margin: '0 0 6px', fontWeight: 800 }}>¡Gracias!</h2>
          <p style={{ color: '#555', fontSize: 15, margin: '0 0 4px' }}>{chosen.label}</p>
          <p style={{ color: '#999', fontSize: 13 }}>Tu opinión nos ayuda a mejorar.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...pg(primary), background: `linear-gradient(135deg, ${primary} 0%, #0d0d1a 100%)` }}>
      <div style={card}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {store?.logo_url ? (
            <img src={store.logo_url} alt={store.name}
              style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover', marginBottom: 12, border: `3px solid ${accent}` }} />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: 18, background: primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px', fontSize: 28, fontWeight: 900, color: accent,
              boxShadow: `0 4px 20px ${accent}44`,
            }}>
              {(store?.name || '?')[0].toUpperCase()}
            </div>
          )}
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', margin: '0 0 4px' }}>{store?.name}</h1>
          <p style={{ fontSize: 13, color: '#999', margin: 0 }}>¿Cómo fue tu experiencia?</p>
        </div>

        {/* Emoji buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {EMOJIS.map((item, i) => {
            const isActive = active === i;
            return (
              <button
                key={i}
                onClick={() => setSelected(i)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  background: isActive ? `${primary}10` : 'transparent',
                  border: isActive ? `2px solid ${primary}` : '2px solid transparent',
                  borderRadius: 16, padding: '10px 8px',
                  cursor: 'pointer', transition: 'all 0.15s',
                  outline: 'none',
                }}
              >
                <span style={{
                  fontSize: 44, lineHeight: 1,
                  transform: isActive ? 'scale(1.2)' : 'scale(1)',
                  transition: 'transform 0.15s',
                  filter: isActive ? 'drop-shadow(0 3px 8px rgba(0,0,0,0.2))' : 'none',
                  display: 'block',
                }}>{item.emoji}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: isActive ? primary : '#aaa',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Deja un comentario (opcional)..."
          maxLength={500}
          rows={3}
          style={{
            width: '100%', borderRadius: 12, border: '2px solid #e5e7eb',
            padding: '10px 12px', fontSize: 14, resize: 'vertical',
            fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', color: '#374151',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = primary}
          onBlur={e => e.target.style.borderColor = '#e5e7eb'}
        />
        <p style={{ fontSize: 11, color: '#bbb', textAlign: 'right', margin: '3px 0 16px' }}>{comment.length}/500</p>

        {/* Submit */}
        <button
          onClick={submit}
          disabled={selected === null || submitting}
          style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
            background: selected !== null ? primary : '#e5e7eb',
            color: selected !== null ? '#fff' : '#bbb',
            fontWeight: 800, fontSize: 16, cursor: selected !== null ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {submitting ? 'Enviando...' : (
            selected !== null
              ? `Enviar ${EMOJIS[selected].emoji}`
              : 'Selecciona una opción'
          )}
        </button>
      </div>
    </div>
  );
}

const pg = (primary) => ({
  minHeight: '100vh',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  background: primary,
});

const card = {
  background: '#fff', borderRadius: 24, padding: '28px 24px',
  width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
};

const sp = {
  width: 40, height: 40,
  border: '4px solid rgba(255,255,255,0.2)',
  borderTopColor: '#D4AF37',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};
