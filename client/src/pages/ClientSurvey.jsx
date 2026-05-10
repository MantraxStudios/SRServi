import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const CSS = `
  .sv-wrap {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
    position: relative;
    overflow: hidden;
  }
  .sv-body {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
    padding: 0 16px 32px;
    position: relative;
    z-index: 1;
  }
  .sv-left {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding-top: 36px;
    width: 100%;
  }
  .sv-right {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
    width: 100%;
  }
  .sv-logo { width: 70px; height: 70px; border-radius: 18px; object-fit: cover; }
  .sv-logo-ph {
    width: 70px; height: 70px; border-radius: 18px;
    display: flex; align-items: center; justify-content: center;
    font-size: 30px; font-weight: 900;
  }
  .sv-progress { width: 100%; max-width: 420px; }
  .sv-card {
    background: #fff;
    border-radius: 24px;
    padding: 24px 20px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.35);
  }
  .sv-opts { display: flex; flex-direction: column; gap: 10px; }
  .sv-brand {
    color: rgba(255,255,255,0.3);
    font-size: 11px;
    text-align: center;
    margin: 0;
    letter-spacing: 1px;
    z-index: 1;
    position: relative;
  }
  .sv-title { color: #fff; font-weight: 900; font-size: 20px; margin: 0; text-align: center; }
  .sv-subtitle { font-weight: 700; font-size: 12px; margin: 0; letter-spacing: 2px; text-transform: uppercase; }
  .sv-divider { display: none; }

  /* Tablet landscape — 700px+ wide in landscape */
  @media (min-width: 700px) and (orientation: landscape) {
    .sv-body {
      flex-direction: row;
      align-items: stretch;
      gap: 0;
      padding: 0;
    }
    .sv-left {
      width: 38%;
      flex-shrink: 0;
      padding: 48px 32px;
      justify-content: center;
      border-right: 1px solid rgba(255,255,255,0.08);
    }
    .sv-right {
      flex: 1;
      padding: 48px 40px;
      justify-content: center;
      overflow-y: auto;
    }
    .sv-logo { width: 96px; height: 96px; border-radius: 24px; }
    .sv-logo-ph { width: 96px; height: 96px; border-radius: 24px; font-size: 42px; }
    .sv-title { font-size: 24px; }
    .sv-progress { max-width: 520px; }
    .sv-card { max-width: 520px; padding: 28px 26px; }
    .sv-divider { display: block; width: 48px; height: 3px; border-radius: 2px; margin: 4px 0; }
  }

  @media (min-width: 1024px) and (orientation: landscape) {
    .sv-left { width: 36%; padding: 48px 48px; }
    .sv-right { padding: 48px 64px; }
    .sv-progress { max-width: 580px; }
    .sv-card { max-width: 580px; padding: 32px 30px; }
  }
`;

export default function ClientSurvey() {
  const { code } = useParams();
  const [store, setStore]           = useState(null);
  const [questions, setQuestions]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [answers, setAnswers]       = useState({});
  const [step, setStep]             = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/public/${code}`).then(r => r.json()),
      fetch(`/api/public/${code}/survey-questions`).then(r => r.json()),
    ])
      .then(([storeData, qData]) => {
        if (storeData.store) setStore(storeData.store); else setError('Tienda no encontrada');
        if (qData.questions) setQuestions(qData.questions);
      })
      .catch(() => setError('Error al cargar'))
      .finally(() => setLoading(false));
  }, [code]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => window.location.reload(), 4000);
    return () => clearTimeout(t);
  }, [done]);

  const primary  = store?.primary_color || '#1a1a2e';
  const accent   = store?.accent_color  || '#D4AF37';
  const name     = store?.name || '';
  const current  = questions[step];
  const progress = (step / questions.length) * 100;

  const select = (option) => {
    const next = { ...answers, [current.key]: option };
    setAnswers(next);
    if (step < questions.length - 1) {
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

  if (loading || !questions.length) return (
    <>
      <style>{CSS}</style>
      <div className="sv-wrap" style={{ background: '#0d0d1a', justifyContent: 'center', alignItems: 'center' }}>
        <div style={spinnerStyle} />
      </div>
    </>
  );

  if (error) return (
    <>
      <style>{CSS}</style>
      <div className="sv-wrap" style={{ background: '#0d0d1a', justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: '#ef4444', fontSize: 16 }}>{error}</p>
      </div>
    </>
  );

  if (done) return (
    <>
      <style>{CSS}</style>
      <div className="sv-wrap" style={{ background: `linear-gradient(145deg, ${primary} 0%, #0d0d1a 100%)` }}>
        <div style={goldLine(accent)} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
          <div style={{ fontSize: 80 }}>🎯</div>
          <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: 0 }}>¡Gracias!</h2>
          <p style={{ color: accent, fontSize: 15, fontWeight: 700, margin: 0 }}>Tu opinión es muy valiosa.</p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>Nos ayudas a mejorar cada día.</p>
        </div>
        <p className="sv-brand">Powered by SRAutomatic.cl</p>
        <div style={goldLine(accent)} />
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="sv-wrap" style={{ background: `linear-gradient(145deg, ${primary} 0%, #0d0d1a 100%)` }}>
        <div style={circle(accent, 200, -50, -50, 0.07)} />
        <div style={circle(accent, 140, 'auto', -30, 0.05, 'bottom')} />
        <div style={goldLine(accent)} />

        <div className="sv-body">
          {/* Left panel (portrait: top block) */}
          <div className="sv-left">
            {store?.logo_url ? (
              <img src={store.logo_url} alt={name} className="sv-logo"
                style={{ border: `3px solid ${accent}` }} />
            ) : (
              <div className="sv-logo-ph" style={{ background: accent, color: primary }}>
                {name[0]?.toUpperCase() || '★'}
              </div>
            )}
            <h1 className="sv-title">{name}</h1>
            <p className="sv-subtitle" style={{ color: accent }}>Encuesta · Cliente ideal</p>
            <div className="sv-divider" style={{ background: accent }} />
            <p className="sv-brand" style={{ marginTop: 8 }}>Powered by SRAutomatic.cl</p>
          </div>

          {/* Right panel (portrait: bottom block) */}
          <div className="sv-right">
            {/* Progress */}
            <div className="sv-progress">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                  Pregunta {step + 1} de {questions.length}
                </span>
                <span style={{ color: accent, fontSize: 12, fontWeight: 700 }}>
                  {Math.round((step / questions.length) * 100)}%
                </span>
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
            <div className="sv-card">
              <p style={{ textAlign: 'center', color: '#374151', fontSize: 16, fontWeight: 700, margin: '0 0 22px', lineHeight: 1.4 }}>
                {current.text}
              </p>
              <div className="sv-opts">
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
                    onMouseEnter={e => { e.currentTarget.style.background = `${primary}10`; e.currentTarget.style.borderColor = primary; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = `${primary}22`; }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <p className="sv-brand">Powered by SRAutomatic.cl</p>
          </div>
        </div>

        <div style={goldLine(accent)} />
      </div>
    </>
  );
}

const goldLine = (accent) => ({
  height: 5, background: accent, width: '100%', flexShrink: 0, zIndex: 2,
});

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

const spinnerStyle = {
  width: 40, height: 40,
  border: '4px solid rgba(255,255,255,0.15)',
  borderTopColor: '#D4AF37',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};
