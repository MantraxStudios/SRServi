import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faKey, faLock, faCheckCircle, faShieldAlt } from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

function ForgotPassword() {
  const [step, setStep] = useState('verify'); // 'verify' | 'reset' | 'done'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
    if (newPassword.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');
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
            width: '56px', height: '56px', borderRadius: '50%',
            background: '#000', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 14px'
          }}>
            <FontAwesomeIcon
              icon={step === 'done' ? faCheckCircle : faShieldAlt}
              style={{ fontSize: '24px', color: '#D4AF37' }}
            />
          </div>
          <h2 style={{ fontWeight: 800, fontSize: '20px', marginBottom: '6px' }}>
            {step === 'done' ? '¡Contraseña actualizada!' : 'Recuperar contraseña'}
          </h2>
          <p style={{ color: '#666', fontSize: '13px' }}>
            {step === 'verify' && 'Verifica tu identidad con tu app de autenticación.'}
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
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Código de tu app de autenticación</label>
              <div className="input-icon-wrapper">
                <FontAwesomeIcon icon={faKey} className="input-icon" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  style={{ letterSpacing: '6px', fontSize: '20px', fontWeight: 700 }}
                  required
                />
              </div>
              <p style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>
                Abre Google Authenticator, Authy u otra app y busca SRServi.
              </p>
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full"
              disabled={loading || code.length !== 6}
              style={{ background: '#D4AF37', border: 'none', color: '#000', fontWeight: 800 }}
            >
              {loading ? 'Verificando...' : 'Verificar identidad'}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleReset}>
            <div className="form-group">
              <label>Nueva contraseña</label>
              <div className="input-icon-wrapper">
                <FontAwesomeIcon icon={faLock} className="input-icon" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Confirmar contraseña</label>
              <div className="input-icon-wrapper">
                <FontAwesomeIcon icon={faLock} className="input-icon" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
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
              {loading ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <button
            onClick={() => navigate('/login')}
            className="btn btn-primary btn-lg btn-full"
            style={{ background: '#D4AF37', border: 'none', color: '#000', fontWeight: 800 }}
          >
            Ir al inicio de sesión
          </button>
        )}

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link to="/login" style={{ fontSize: '13px', color: '#888' }}>
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
