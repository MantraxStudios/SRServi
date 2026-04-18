import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faKey, faLock, faCheckCircle, faShieldAlt } from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

function ForgotPassword() {
  const [method, setMethod] = useState(null); // null | 'email' | 'totp'

  if (!method) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%', background: '#000',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px'
            }}>
              <FontAwesomeIcon icon={faLock} style={{ fontSize: '24px', color: '#D4AF37' }} />
            </div>
            <h2 style={{ fontWeight: 800, fontSize: '20px', marginBottom: '6px' }}>¿Olvidaste tu contraseña?</h2>
            <p style={{ color: '#666', fontSize: '13px' }}>Elige cómo quieres recuperar tu cuenta</p>
          </div>

          <button
            onClick={() => setMethod('email')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
              padding: '16px', borderRadius: '12px', marginBottom: '12px',
              border: '2px solid #e0e0e0', background: '#fafafa', cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#D4AF3722', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FontAwesomeIcon icon={faEnvelope} style={{ color: '#D4AF37', fontSize: '18px' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Correo electrónico</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Te enviamos un enlace de recuperación</div>
            </div>
          </button>

          <button
            onClick={() => setMethod('totp')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
              padding: '16px', borderRadius: '12px', marginBottom: '20px',
              border: '2px solid #e0e0e0', background: '#fafafa', cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#00000011', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FontAwesomeIcon icon={faShieldAlt} style={{ color: '#333', fontSize: '18px' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>App de autenticación (2FA)</div>
              <div style={{ fontSize: '12px', color: '#888' }}>Usa el código de tu app para verificar</div>
            </div>
          </button>

          <div style={{ textAlign: 'center' }}>
            <Link to="/login" style={{ fontSize: '13px', color: '#888' }}>Volver al inicio de sesión</Link>
          </div>
        </div>
      </div>
    );
  }

  if (method === 'email') return <EmailReset onBack={() => setMethod(null)} />;
  if (method === 'totp') return <TotpReset onBack={() => setMethod(null)} />;
}

// ── Reset por correo ──────────────────────────────────────────────────────────
function EmailReset({ onBack }) {
  const [step, setStep] = useState('form'); // 'form' | 'sent'
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(API + '/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar correo');
      setStep('sent');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%', background: '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px'
          }}>
            <FontAwesomeIcon icon={step === 'sent' ? faCheckCircle : faEnvelope} style={{ fontSize: '24px', color: '#D4AF37' }} />
          </div>
          <h2 style={{ fontWeight: 800, fontSize: '20px', marginBottom: '6px' }}>
            {step === 'sent' ? '¡Correo enviado!' : 'Recuperar por correo'}
          </h2>
          <p style={{ color: '#666', fontSize: '13px' }}>
            {step === 'sent'
              ? `Revisa tu bandeja de entrada en ${email}. El enlace expira en 15 minutos.`
              : 'Te enviaremos un enlace para restablecer tu contraseña.'}
          </p>
        </div>

        {error && <div className="error" style={{ marginBottom: '16px' }}>{error}</div>}

        {step === 'form' && (
          <form onSubmit={handleSend}>
            <div className="form-group">
              <label>Correo electrónico</label>
              <div className="input-icon-wrapper">
                <FontAwesomeIcon icon={faEnvelope} className="input-icon" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full"
              disabled={loading}
              style={{ background: '#D4AF37', border: 'none', color: '#000', fontWeight: 800 }}
            >
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
          </form>
        )}

        {step === 'sent' && (
          <Link to="/login" className="btn btn-primary btn-lg btn-full" style={{ display: 'block', textAlign: 'center', background: '#D4AF37', border: 'none', color: '#000', fontWeight: 800, textDecoration: 'none' }}>
            Ir al inicio de sesión
          </Link>
        )}

        <div style={{ textAlign: 'center', marginTop: '14px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#888', fontSize: '13px', cursor: 'pointer' }}>
            ← Volver
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reset por TOTP (2FA) ──────────────────────────────────────────────────────
function TotpReset({ onBack }) {
  const [step, setStep] = useState('verify'); // 'verify' | 'reset' | 'done'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(API + '/api/auth/2fa/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al verificar');
      setRecoveryToken(data.recoveryToken);
      setStep('reset');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) return setError('Las contraseñas no coinciden');
    setLoading(true);
    try {
      const res = await fetch(API + '/api/auth/2fa/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryToken, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cambiar contraseña');
      setStep('done');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%', background: '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px'
          }}>
            <FontAwesomeIcon icon={step === 'done' ? faCheckCircle : faShieldAlt} style={{ fontSize: '24px', color: '#D4AF37' }} />
          </div>
          <h2 style={{ fontWeight: 800, fontSize: '20px', marginBottom: '6px' }}>
            {step === 'done' ? '¡Contraseña actualizada!' : 'Recuperar con 2FA'}
          </h2>
          <p style={{ color: '#666', fontSize: '13px' }}>
            {step === 'verify' && 'Verifica tu identidad con el código de tu app de autenticación.'}
            {step === 'reset' && 'Ingresa tu nueva contraseña.'}
            {step === 'done' && 'Ya puedes iniciar sesión con tu nueva contraseña.'}
          </p>
        </div>

        {error && <div className="error" style={{ marginBottom: '16px' }}>{error}</div>}

        {step === 'verify' && (
          <form onSubmit={handleVerify}>
            <div className="form-group">
              <label>Correo electrónico</label>
              <div className="input-icon-wrapper">
                <FontAwesomeIcon icon={faEnvelope} className="input-icon" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required />
              </div>
            </div>
            <div className="form-group">
              <label>Código de autenticación</label>
              <div className="input-icon-wrapper">
                <FontAwesomeIcon icon={faKey} className="input-icon" />
                <input
                  type="text" inputMode="numeric" maxLength={6}
                  value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  style={{ letterSpacing: '6px', fontSize: '20px', fontWeight: 700 }}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading || code.length !== 6}
              style={{ background: '#D4AF37', border: 'none', color: '#000', fontWeight: 800 }}>
              {loading ? 'Verificando...' : 'Verificar'}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleReset}>
            <div className="form-group">
              <label>Nueva contraseña</label>
              <div className="input-icon-wrapper">
                <FontAwesomeIcon icon={faLock} className="input-icon" />
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required />
              </div>
            </div>
            <div className="form-group">
              <label>Confirmar contraseña</label>
              <div className="input-icon-wrapper">
                <FontAwesomeIcon icon={faLock} className="input-icon" />
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repite la contraseña" required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}
              style={{ background: '#D4AF37', border: 'none', color: '#000', fontWeight: 800 }}>
              {loading ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <Link to="/login" className="btn btn-primary btn-lg btn-full"
            style={{ display: 'block', textAlign: 'center', background: '#D4AF37', border: 'none', color: '#000', fontWeight: 800, textDecoration: 'none' }}>
            Ir al inicio de sesión
          </Link>
        )}

        {step !== 'done' && (
          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#888', fontSize: '13px', cursor: 'pointer' }}>
              ← Volver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;
