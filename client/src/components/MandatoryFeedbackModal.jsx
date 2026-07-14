import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar, faCommentDots } from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

/**
 * Modal de feedback OBLIGATORIO — se muestra una única vez por usuario.
 * Bloquea el panel hasta que el usuario envíe su valoración.
 * onDone() se llama cuando el feedback fue enviado con éxito (o ya existía).
 */
function MandatoryFeedbackModal({ token, onDone }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [likedMost, setLikedMost] = useState('');
  const [improvement, setImprovement] = useState('');
  const [recommend, setRecommend] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!rating) { setError('Selecciona una calificación con las estrellas'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/user/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          rating,
          liked_most: likedMost.trim(),
          improvement: improvement.trim(),
          would_recommend: recommend,
        }),
      });
      if (res.ok || res.status === 409) { onDone(); return; }
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'No se pudo enviar el feedback');
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <div
        style={{
          background: '#111', border: '1px solid rgba(212,175,55,0.3)',
          borderRadius: '16px', width: '100%', maxWidth: '460px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.8)', overflow: 'hidden',
          maxHeight: '92vh', overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: 'rgba(212,175,55,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontSize: '17px', flexShrink: 0 }}>
            <FontAwesomeIcon icon={faCommentDots} />
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '17px', fontWeight: 700 }}>¡Tu opinión nos importa!</h3>
            <p style={{ margin: '2px 0 0', color: '#888', fontSize: '12.5px' }}>Cuéntanos tu experiencia antes de continuar.</p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 24px' }}>
          {/* Estrellas */}
          <label style={{ display: 'block', color: '#ccc', fontSize: '12px', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ¿Cómo calificarías SRServi? *
          </label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => { setRating(n); setError(''); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                  fontSize: '30px', lineHeight: 1,
                  color: (hover || rating) >= n ? '#D4AF37' : '#3a3a3a',
                  transition: 'color 0.12s, transform 0.12s',
                  transform: (hover || rating) >= n ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                <FontAwesomeIcon icon={faStar} />
              </button>
            ))}
          </div>

          {/* Lo que más te gustó */}
          <label style={{ display: 'block', color: '#ccc', fontSize: '12px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ¿Qué es lo que más te gusta?
          </label>
          <textarea
            value={likedMost}
            onChange={(e) => setLikedMost(e.target.value)}
            rows={2}
            placeholder="Opcional..."
            style={{ width: '100%', padding: '10px 14px', background: '#1a1a1a', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '8px', color: '#fff', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', marginBottom: '16px', fontFamily: 'inherit' }}
          />

          {/* Qué mejorarías */}
          <label style={{ display: 'block', color: '#ccc', fontSize: '12px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ¿Qué mejorarías?
          </label>
          <textarea
            value={improvement}
            onChange={(e) => setImprovement(e.target.value)}
            rows={2}
            placeholder="Opcional..."
            style={{ width: '100%', padding: '10px 14px', background: '#1a1a1a', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '8px', color: '#fff', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', marginBottom: '18px', fontFamily: 'inherit' }}
          />

          {/* Recomendarías */}
          <label style={{ display: 'block', color: '#ccc', fontSize: '12px', fontWeight: 600, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ¿Nos recomendarías?
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {[{ v: true, label: '👍 Sí' }, { v: false, label: '👎 No' }].map(({ v, label }) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setRecommend(v)}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
                  border: recommend === v ? '1px solid #D4AF37' : '1px solid rgba(255,255,255,0.12)',
                  background: recommend === v ? 'rgba(212,175,55,0.15)' : 'transparent',
                  color: recommend === v ? '#D4AF37' : '#aaa', transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {error && <p style={{ margin: '14px 0 0', color: '#f87171', fontSize: '12.5px' }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={submit}
            disabled={saving}
            style={{
              width: '100%', padding: '12px', borderRadius: '9px', fontSize: '14px', fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', border: 'none',
              background: saving ? 'rgba(212,175,55,0.3)' : '#D4AF37', color: '#000',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.15s',
            }}
          >
            {saving ? (
              <>
                <div style={{ width: '14px', height: '14px', border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Enviando...
              </>
            ) : 'Enviar y continuar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MandatoryFeedbackModal;
