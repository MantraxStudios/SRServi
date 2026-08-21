import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGift, faStar, faClipboardCheck, faPhone, faCheck, faArrowRight } from '@fortawesome/free-solid-svg-icons';

const GOLD = '#D4AF37';

// Página pública a la que apunta el QR: el cliente completa la encuesta, nos
// califica en Google y registra su teléfono para obtener el beneficio.
export default function FidelidadEnroll() {
  const { code } = useParams();
  const [cfg, setCfg] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(0);          // 0 intro · 1 encuesta · 2 google · 3 registro · 4 listo
  const [answers, setAnswers] = useState({});
  const [googleDone, setGoogleDone] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [benefit, setBenefit] = useState('');

  useEffect(() => {
    fetch(`/api/public/${code}/fidelidad`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Tienda no encontrada')))
      .then(setCfg)
      .catch(e => setError(e.message));
  }, [code]);

  const questions = cfg?.questions || [];
  const allAnswered = questions.length > 0 && questions.every(q => answers[q.key]);

  const enroll = async () => {
    if (!name.trim() || !phone.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/public/${code}/fidelidad/enroll`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), answers, google_done: googleDone }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo completar');
      setBenefit(d.benefit || cfg?.benefit || '');
      setStep(4);
    } catch (e) { alert(e.message); }
    finally { setSubmitting(false); }
  };

  if (error) return <Center><div style={{ textAlign: 'center' }}><div style={{ fontSize: 40 }}>😕</div><h2>{error}</h2></div></Center>;
  if (!cfg) return <Center><div className="fid-spinner" /></Center>;

  const steps = [
    { icon: faClipboardCheck, label: 'Encuesta' },
    { icon: faStar, label: 'Google' },
    { icon: faPhone, label: 'Tus datos' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f10', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{css}</style>
      <div style={{ width: '100%', maxWidth: 460 }}>
        {/* Cabecera */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 62, height: 62, borderRadius: 18, background: `${GOLD}22`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <FontAwesomeIcon icon={faGift} style={{ color: GOLD, fontSize: 26 }} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>{cfg.store?.name || 'Beneficio'}</h1>
          <p style={{ margin: '6px 0 0', color: '#a1a1aa', fontSize: 14 }}>
            {cfg.benefit ? cfg.benefit : 'Inscríbete y obtén un beneficio exclusivo'}
          </p>
        </div>

        {/* Progreso */}
        {step >= 1 && step <= 3 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {steps.map((s, i) => (
              <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: 5, borderRadius: 999, background: step - 1 >= i ? GOLD : '#2a2a2c' }} />
                <div style={{ fontSize: 11, marginTop: 5, color: step - 1 >= i ? GOLD : '#71717a', fontWeight: 700 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ background: '#1a1a1c', border: '1px solid #2a2a2c', borderRadius: 18, padding: 20 }}>
          {/* Paso 0: intro */}
          {step === 0 && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#d4d4d8', fontSize: 14.5, lineHeight: 1.6, marginTop: 0 }}>
                Para recibir tu beneficio solo tienes que:
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px', textAlign: 'left' }}>
                {['Responder una breve encuesta', 'Calificarnos en Google', 'Registrar tu nombre y WhatsApp'].map((t, i) => (
                  <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 2 ? '1px solid #2a2a2c' : 'none' }}>
                    <span style={{ width: 26, height: 26, borderRadius: 999, background: `${GOLD}22`, color: GOLD, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 14 }}>{t}</span>
                  </li>
                ))}
              </ul>
              <Primary onClick={() => setStep(1)}>Empezar <FontAwesomeIcon icon={faArrowRight} /></Primary>
            </div>
          )}

          {/* Paso 1: encuesta */}
          {step === 1 && (
            <div>
              <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>Cuéntanos sobre tu visita</h3>
              {questions.map(q => (
                <div key={q.key} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8, color: '#e4e4e7' }}>{q.text}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {q.options.map(opt => (
                      <button key={opt} onClick={() => setAnswers(a => ({ ...a, [q.key]: opt }))}
                        className={`fid-opt${answers[q.key] === opt ? ' active' : ''}`}>{opt}</button>
                    ))}
                  </div>
                </div>
              ))}
              <Primary disabled={!allAnswered} onClick={() => setStep(2)}>Continuar</Primary>
            </div>
          )}

          {/* Paso 2: Google */}
          {step === 2 && (
            <div style={{ textAlign: 'center' }}>
              <FontAwesomeIcon icon={faStar} style={{ color: GOLD, fontSize: 34, marginBottom: 10 }} />
              <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Califícanos en Google</h3>
              <p style={{ color: '#a1a1aa', fontSize: 13.5, lineHeight: 1.5, marginTop: 0 }}>
                Tu reseña nos ayuda muchísimo. Toca el botón, deja tu estrella y vuelve aquí.
              </p>
              {cfg.google_url ? (
                <a href={cfg.google_url} target="_blank" rel="noreferrer" onClick={() => setGoogleDone(true)}
                  className="fid-btn-outline" style={{ display: 'block', marginBottom: 12 }}>
                  <FontAwesomeIcon icon={faStar} /> Abrir Google para calificar
                </a>
              ) : (
                <p style={{ color: '#71717a', fontSize: 12.5 }}>La tienda aún no configuró su enlace de Google.</p>
              )}
              <Primary disabled={cfg.google_url && !googleDone} onClick={() => setStep(3)}>
                {cfg.google_url ? 'Ya califiqué, continuar' : 'Continuar'}
              </Primary>
            </div>
          )}

          {/* Paso 3: registro */}
          {step === 3 && (
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Tus datos</h3>
              <p style={{ color: '#a1a1aa', fontSize: 13, marginTop: 0, marginBottom: 14 }}>
                Quedarás registrado con tu WhatsApp. Al comprar solo deberás ingresarlo.
              </p>
              <input className="fid-input" placeholder="Tu nombre" value={name} onChange={e => setName(e.target.value)} />
              <input className="fid-input" placeholder="Tu WhatsApp (ej: +56 9 1234 5678)" value={phone}
                onChange={e => setPhone(e.target.value)} inputMode="tel" />
              <Primary disabled={!name.trim() || !phone.trim() || submitting} onClick={enroll}>
                {submitting ? 'Enviando…' : 'Obtener mi beneficio'}
              </Primary>
            </div>
          )}

          {/* Paso 4: listo */}
          {step === 4 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 999, background: '#16a34a22', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <FontAwesomeIcon icon={faCheck} style={{ color: '#22c55e', fontSize: 28 }} />
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>¡Listo, {name.split(' ')[0]}!</h2>
              <p style={{ color: '#d4d4d8', fontSize: 14, lineHeight: 1.5, marginTop: 0 }}>Ya estás inscrito. Este es tu beneficio:</p>
              <div style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}55`, borderRadius: 14, padding: '16px', margin: '10px 0 14px' }}>
                <FontAwesomeIcon icon={faGift} style={{ color: GOLD, fontSize: 22, marginBottom: 8 }} />
                <div style={{ fontSize: 15.5, fontWeight: 800, color: '#fff' }}>{benefit || 'Un beneficio especial en tu próxima compra'}</div>
              </div>
              <p style={{ color: '#a1a1aa', fontSize: 12.5 }}>Muestra esta pantalla en caja o ingresa tu WhatsApp al comprar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Primary({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="fid-primary">
      {children}
    </button>
  );
}
function Center({ children }) {
  return <div style={{ minHeight: '100vh', background: '#0f0f10', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}><style>{css}</style>{children}</div>;
}

const css = `
  .fid-primary { width: 100%; margin-top: 8px; background: ${GOLD}; color: #0a0a0a; border: none; border-radius: 12px; padding: 14px; font-size: 15px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
  .fid-primary:disabled { opacity: 0.4; cursor: default; }
  .fid-btn-outline { border: 1px solid ${GOLD}; color: ${GOLD}; border-radius: 12px; padding: 13px; font-size: 14.5px; font-weight: 800; text-decoration: none; }
  .fid-opt { background: #232326; border: 1px solid #2f2f33; color: #d4d4d8; border-radius: 999px; padding: 8px 14px; font-size: 13px; font-weight: 700; cursor: pointer; }
  .fid-opt.active { background: ${GOLD}; color: #0a0a0a; border-color: ${GOLD}; }
  .fid-input { width: 100%; box-sizing: border-box; background: #232326; border: 1px solid #2f2f33; color: #fff; border-radius: 12px; padding: 13px 14px; font-size: 15px; margin-bottom: 10px; }
  .fid-input::placeholder { color: #71717a; }
  .fid-spinner { width: 48px; height: 48px; border: 5px solid rgba(255,255,255,0.15); border-top-color: ${GOLD}; border-radius: 50%; animation: fidspin 1s linear infinite; }
  @keyframes fidspin { to { transform: rotate(360deg); } }
`;
