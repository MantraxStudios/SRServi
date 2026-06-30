import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const STARS = [1, 2, 3, 4, 5];

function StarRating({ value, onChange, label }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#374151', fontSize: 14 }}>{label}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        {STARS.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: 36, lineHeight: 1,
              color: s <= (hover || value) ? '#C8A415' : '#d1d5db',
              transition: 'color 0.15s'
            }}
          >★</button>
        ))}
      </div>
      {value > 0 && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6b7280' }}>
          {['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'][value]}
        </p>
      )}
    </div>
  );
}

export default function Feedback() {
  const { token } = useParams();
  const [state, setState] = useState('loading'); // loading | form | done | invalid | already
  const [businessName, setBusinessName] = useState('');

  const [overallRating, setOverallRating] = useState(0);
  const [easeOfUse, setEaseOfUse] = useState(0);
  const [supportQuality, setSupportQuality] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState(null);
  const [comment, setComment] = useState('');
  const [improvements, setImprovements] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/feedback/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.already_responded) { setState('already'); setBusinessName(data.business_name || ''); return; }
        if (data.valid) { setState('form'); setBusinessName(data.business_name || ''); return; }
        setState('invalid');
      })
      .catch(() => setState('invalid'));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (overallRating === 0) { setError('Por favor califica tu experiencia general'); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/feedback/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overall_rating: overallRating,
          ease_of_use: easeOfUse || null,
          support_quality: supportQuality || null,
          would_recommend: wouldRecommend,
          comment: comment.trim() || null,
          improvement_suggestions: improvements.trim() || null
        })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al enviar'); setSubmitting(false); return; }
      setState('done');
    } catch { setError('Error de conexión'); setSubmitting(false); }
  }

  const cardStyle = {
    background: '#fff', borderRadius: 16, padding: '32px 28px',
    maxWidth: 520, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.10)'
  };

  if (state === 'loading') return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#6b7280' }}>Cargando...</p>
    </div>
  );

  if (state === 'invalid') return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
          <h2 style={{ margin: '0 0 8px', color: '#111' }}>Enlace no válido</h2>
          <p style={{ color: '#6b7280', margin: 0 }}>Este enlace de encuesta no existe o ha expirado.</p>
        </div>
      </div>
    </div>
  );

  if (state === 'already') return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h2 style={{ margin: '0 0 8px', color: '#111' }}>Ya respondiste esta encuesta</h2>
          <p style={{ color: '#6b7280', margin: 0 }}>Gracias {businessName} por tu feedback. ¡Nos ayuda mucho a mejorar!</p>
        </div>
      </div>
    </div>
  );

  if (state === 'done') return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h2 style={{ margin: '0 0 10px', color: '#111', fontSize: 22 }}>¡Gracias por tu opinión!</h2>
          <p style={{ color: '#6b7280', margin: 0, fontSize: 15 }}>
            Tu feedback nos ayuda a seguir mejorando SRServi para ti y para miles de negocios.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⭐</div>
          <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900, color: '#111' }}>
            ¿Cómo ha sido tu experiencia?
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
            Hola <strong>{businessName}</strong>, tu opinión sobre SRServi nos ayuda a mejorar.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Overall */}
          <div style={{ background: '#fffbeb', borderRadius: 12, padding: '16px 20px', marginBottom: 20, border: '1px solid #fde68a' }}>
            <StarRating value={overallRating} onChange={setOverallRating} label="¿Cómo calificarías SRServi en general? *" />
          </div>

          <StarRating value={easeOfUse} onChange={setEaseOfUse} label="Facilidad de uso del sistema" />
          <StarRating value={supportQuality} onChange={setSupportQuality} label="Calidad del soporte técnico" />

          {/* Would recommend */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#374151', fontSize: 14 }}>¿Recomendarías SRServi a otros negocios?</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {[{ v: true, label: '👍 Sí' }, { v: false, label: '👎 No' }].map(({ v, label }) => (
                <button
                  key={String(v)} type="button"
                  onClick={() => setWouldRecommend(v)}
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: '2px solid',
                    borderColor: wouldRecommend === v ? '#C8A415' : '#e5e7eb',
                    background: wouldRecommend === v ? '#fffbeb' : '#fff',
                    color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 14,
                    transition: 'all 0.15s'
                  }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#374151', fontSize: 14 }}>
              Comentarios generales
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="¿Qué es lo que más te gusta de SRServi?"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>

          {/* Improvements */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#374151', fontSize: 14 }}>
              ¿Qué mejorarías?
            </label>
            <textarea
              value={improvements}
              onChange={e => setImprovements(e.target.value)}
              placeholder="Cuéntanos qué funcionalidades añadirías o qué cambiarías..."
              rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>

          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: 14 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 10, border: 'none',
              background: submitting ? '#d1d5db' : '#C8A415',
              color: '#fff', fontWeight: 800, fontSize: 16, cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s'
            }}
          >
            {submitting ? 'Enviando...' : 'Enviar mi opinión'}
          </button>
        </form>

        <p style={{ textAlign: 'center', margin: '16px 0 0', fontSize: 11, color: '#9ca3af' }}>
          SRServi — Tu privacidad es importante. Solo usamos tu opinión para mejorar el servicio.
        </p>
      </div>
    </div>
  );
}
