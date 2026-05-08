import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const QUESTIONS = [
  {
    key: 'frequency',
    text: '¿Con qué frecuencia nos visitas?',
    options: ['Primera vez', 'A veces', 'Seguido', 'Siempre'],
  },
  {
    key: 'how_found',
    text: '¿Cómo nos conociste?',
    options: ['Redes sociales', 'Recomendación', 'Google', 'Pasando por aquí'],
  },
  {
    key: 'age_range',
    text: '¿Cuál es tu rango de edad?',
    options: ['Menos de 25', '25–35', '36–50', 'Más de 50'],
  },
  {
    key: 'values_most',
    text: '¿Qué es lo que más valoras de nosotros?',
    options: ['Precio', 'Calidad', 'Rapidez', 'Atención'],
  },
  {
    key: 'recommend',
    text: '¿Recomendarías este lugar?',
    options: ['Sí, definitivamente', 'Probablemente', 'Tal vez', 'No'],
  },
];

export default function ClientSurvey() {
  const { code } = useParams();
  const [store, setStore]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [answers, setAnswers] = useState({});
  const [step, setStep]       = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]       = useState(false);

  useEffect(() => {
    fetch(`/api/public/${code}`)
      .then(r => r.json())
      .then(d => { if (d.store) setStore(d.store); else setError('Tienda no encontrada'); })
      .catch(() => setError('Error al cargar'))
      .finally(() => setLoading(false));
  }, [code]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => window.location.reload(), 4000);
    return () => clearTimeout(t);
  }, [done]);

  const primary = store?.primary_color || '#1a1a2e';
  const accent  = store?.accent_color  || '#D4AF37';
  const name    = store?.name || '';

  const current = QUESTIONS[step];
  const progress = ((step) / QUESTIONS.length) * 100;

  const select = (option) => {
    const next = { ...answers, [current.key]: option };
    setAnswers(next);
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      submit(next);
    }
  };

  const submit = async (finalAnswers) => {
    setSubmitting(true);
    try {
      await fetch(`/api/public/${code}/client-survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      setDone(true);
    } catch {
      alert('Error al enviar. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

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

  if (done) return (
    <div style={{ ...full, background: `linear-gradient(145deg, ${primary} 0%, #0d0d1a 100%)` }}>
      <div style={goldLine(accent)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
        <div style={{ fontSize: 80 }}>🎯</div>
        <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: 0 }}>¡Gracias!</h2>
        <p style={{ color: accent, fontSize: 15, fontWeight: 700, margin: 0 }}>Tu opinión es muy valiosa.</p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>Nos ayudas a mejorar cada día.</p>
      </div>
      <p style={brandText}>Powered by SRAutomatic.cl</p>
      <div style={goldLine(accent)} />
    </div>
  );

  return (
    <div style={{ ...full, background: `linear-gradient(145deg, ${primary} 0%, #0d0d1a 100%)` }}>
      <div style={circle(accent, 200, -50, -50, 0.07)} />
      <div style={circle(accent, 140, 'auto', -30, 0.05, 'bottom')} />
      <div style={goldLine(accent)} />

      <div style={scroll}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 36 }}>
          {store?.logo_url ? (
            <img src={store.logo_url} alt={name}
              style={{ width: 70, height: 70, borderRadius: 18, objectFit: 'cover', border: `3px solid ${accent}` }} />
          ) : (
            <div style={{
              width: 70, height: 70, borderRadius: 18, background: accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, fontWeight: 900, color: primary,
            }}>
              {name[0]?.toUpperCase() || '★'}
            </div>
          )}
          <h1 style={{ color: '#fff', fontWeight: 900, fontSize: 20, margin: 0, textAlign: 'center' }}>{name}</h1>
          <p style={{ color: accent, fontWeight: 700, fontSize: 12, margin: 0, letterSpacing: 2, textTransform: 'uppercase' }}>
            Encuesta · Cliente ideal
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Pregunta {step + 1} de {QUESTIONS.length}</span>
            <span style={{ color: accent, fontSize: 12, fontWeight: 700 }}>{Math.round((step / QUESTIONS.length) * 100)}%</span>
          </div>
          <div style={{ height: 5, background: 'rgba(255,255,255,0.12)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: accent, borderRadius: 4,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {/* Question card */}
        <div style={whiteCard}>
          <p style={{ textAlign: 'center', color: '#374151', fontSize: 16, fontWeight: 700, margin: '0 0 22px', lineHeight: 1.4 }}>
            {current.text}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {current.options.map((opt) => (
              <button
                key={opt}
                onClick={() => !submitting && select(opt)}
                disabled={submitting}
                style={{
                  padding: '14px 18px',
                  borderRadius: 14,
                  border: `2px solid ${primary}22`,
                  background: '#f8fafc',
                  color: '#1e293b',
                  fontWeight: 600,
                  fontSize: 15,
                  textAlign: 'left',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                  outline: 'none',
                }}
                onMouseEnter={e => { e.target.style.background = `${primary}10`; e.target.style.borderColor = primary; }}
                onMouseLeave={e => { e.target.style.background = '#f8fafc'; e.target.style.borderColor = `${primary}22`; }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <p style={brandText}>Powered by SRAutomatic.cl</p>
      </div>

      <div style={goldLine(accent)} />
    </div>
  );
}

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
  gap: 22,
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
