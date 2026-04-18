import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faCheckCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [step, setStep] = useState('form'); // 'form' | 'done' | 'invalid'
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) setStep('invalid');
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) return setError('Las contraseñas no coinciden');
    if (newPassword.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');
    setLoading(true);
    try {
      const res = await fetch(API + '/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al restablecer');
      setStep('done');
    } catch (err) {
      setError(err.message);
      if (err.message.includes('expiró') || err.message.includes('inválido')) setStep('invalid');
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
            <FontAwesomeIcon
              icon={step === 'done' ? faCheckCircle : step === 'invalid' ? faExclamationTriangle : faLock}
              style={{ fontSize: '24px', color: step === 'invalid' ? '#dc2626' : '#D4AF37' }}
            />
          </div>
          <h2 style={{ fontWeight: 800, fontSize: '20px', marginBottom: '6px' }}>
            {step === 'done' ? '¡Contraseña actualizada!' : step === 'invalid' ? 'Enlace inválido' : 'Nueva contraseña'}
          </h2>
          <p style={{ color: '#666', fontSize: '13px' }}>
            {step === 'done' && 'Tu contraseña fue cambiada correctamente.'}
            {step === 'invalid' && 'Este enlace expiró o ya fue usado. Solicita uno nuevo.'}
            {step === 'form' && 'Ingresa tu nueva contraseña para SRServi.'}
          </p>
        </div>

        {error && step === 'form' && <div className="error" style={{ marginBottom: '16px' }}>{error}</div>}

        {step === 'form' && (
          <form onSubmit={handleSubmit}>
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

        {(step === 'done' || step === 'invalid') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Link to="/login" className="btn btn-primary btn-lg btn-full"
              style={{ display: 'block', textAlign: 'center', background: '#D4AF37', border: 'none', color: '#000', fontWeight: 800, textDecoration: 'none' }}>
              Ir al inicio de sesión
            </Link>
            {step === 'invalid' && (
              <Link to="/forgot-password" className="btn btn-lg btn-full"
                style={{ display: 'block', textAlign: 'center', background: 'transparent', border: '1px solid #ddd', color: '#666', textDecoration: 'none' }}>
                Solicitar nuevo enlace
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ResetPassword;
