import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

export default function Rate() {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');

  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(null);
  const [hover, setHover] = useState(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/public/${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.store) setStore(data.store);
        else setError('Tienda no encontrada');
      })
      .catch(() => setError('Error al cargar la tienda'))
      .finally(() => setLoading(false));
  }, [code]);

  const submit = async () => {
    if (rating === null) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/${code}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment, order_id: orderId, source: 'qr' }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      alert('Error al enviar la calificación. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const colors = {
    primary: store?.primary_color || '#1a1a2e',
    accent: store?.accent_color || '#D4AF37',
    secondary: store?.secondary_color || '#ffffff',
  };

  const getRatingColor = (val) => {
    if (val <= 3) return '#ef4444';
    if (val <= 6) return '#f59e0b';
    return '#22c55e';
  };

  const getRatingLabel = (val) => {
    if (val === null) return '';
    if (val <= 2) return 'Muy malo';
    if (val <= 4) return 'Malo';
    if (val <= 5) return 'Regular';
    if (val <= 7) return 'Bueno';
    if (val <= 9) return 'Muy bueno';
    return '¡Excelente!';
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.spinner} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={{ color: '#ef4444', textAlign: 'center', fontSize: 16 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ ...styles.page, background: `linear-gradient(135deg, ${colors.primary} 0%, #0d0d1a 100%)` }}>
        <div style={styles.card}>
          <div style={{ fontSize: 64, textAlign: 'center', marginBottom: 16 }}>🎉</div>
          <h2 style={{ textAlign: 'center', color: colors.primary, fontSize: 22, margin: '0 0 8px' }}>¡Gracias por tu calificación!</h2>
          <p style={{ textAlign: 'center', color: '#666', fontSize: 15 }}>Tu opinión nos ayuda a mejorar.</p>
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <div style={{
              display: 'inline-block',
              background: getRatingColor(rating),
              color: '#fff',
              borderRadius: 50,
              width: 56,
              height: 56,
              lineHeight: '56px',
              fontSize: 24,
              fontWeight: 800,
            }}>
              {rating}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.page, background: `linear-gradient(135deg, ${colors.primary} 0%, #0d0d1a 100%)` }}>
      <div style={styles.card}>
        {/* Header tienda */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {store?.logo_url && (
            <img
              src={store.logo_url}
              alt={store.name}
              style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', marginBottom: 12, border: `3px solid ${colors.accent}` }}
            />
          )}
          {!store?.logo_url && (
            <div style={{
              width: 72, height: 72, borderRadius: 16, background: colors.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px', fontSize: 26, fontWeight: 800, color: colors.accent,
            }}>
              {(store?.name || '?')[0].toUpperCase()}
            </div>
          )}
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', margin: '0 0 4px' }}>{store?.name}</h1>
          <p style={{ fontSize: 14, color: '#888', margin: 0 }}>Califica tu experiencia</p>
        </div>

        {/* Rating buttons 0-10 */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: '#666', textAlign: 'center', margin: '0 0 12px' }}>
            Selecciona una puntuación del 0 al 10
          </p>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => {
              const active = rating === val || hover === val;
              const col = getRatingColor(val);
              return (
                <button
                  key={val}
                  onClick={() => setRating(val)}
                  onMouseEnter={() => setHover(val)}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    border: active ? `2px solid ${col}` : '2px solid #e5e7eb',
                    background: active ? col : '#f9fafb',
                    color: active ? '#fff' : '#374151',
                    fontWeight: 700,
                    fontSize: 16,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    transform: active ? 'scale(1.12)' : 'scale(1)',
                  }}
                >
                  {val}
                </button>
              );
            })}
          </div>
          {(rating !== null || hover !== null) && (
            <p style={{ textAlign: 'center', marginTop: 10, fontSize: 14, fontWeight: 700, color: getRatingColor(hover ?? rating) }}>
              {getRatingLabel(hover ?? rating)}
            </p>
          )}
        </div>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Deja un comentario (opcional)..."
          maxLength={500}
          rows={3}
          style={{
            width: '100%',
            borderRadius: 10,
            border: '2px solid #e5e7eb',
            padding: '10px 12px',
            fontSize: 14,
            resize: 'vertical',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            outline: 'none',
            color: '#374151',
          }}
        />
        <p style={{ fontSize: 11, color: '#aaa', textAlign: 'right', margin: '2px 0 16px' }}>{comment.length}/500</p>

        {/* Submit */}
        <button
          onClick={submit}
          disabled={rating === null || submitting}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 12,
            border: 'none',
            background: rating !== null ? colors.accent : '#e5e7eb',
            color: rating !== null ? (colors.primary || '#000') : '#aaa',
            fontWeight: 800,
            fontSize: 16,
            cursor: rating !== null ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
          }}
        >
          {submitting ? 'Enviando...' : 'Enviar calificación'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    background: '#1a1a2e',
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: '28px 24px',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '4px solid rgba(255,255,255,0.2)',
    borderTopColor: '#D4AF37',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
