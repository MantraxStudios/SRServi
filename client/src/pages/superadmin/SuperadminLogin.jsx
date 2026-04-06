import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldAlt, faEnvelope, faLock, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

function SuperadminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(API + '/api/superadmin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al iniciar sesión');
      }

      localStorage.setItem('superadminToken', data.token);
      localStorage.setItem('superadmin', JSON.stringify(data.superadmin));
      navigate('/superadmin/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="superadmin-login-container">
      <div className="auth-card">
        <div className="auth-card-header">
          <div className="auth-icon-wrapper">
            <FontAwesomeIcon icon={faShieldAlt} className="auth-icon" />
          </div>
          <h1 className="auth-title">Superadmin</h1>
          <p className="auth-subtitle">Panel de administración del sistema</p>
        </div>

        {error && (
          <div className="auth-error">
            <FontAwesomeIcon icon={faExclamationTriangle} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <div className="form-input-wrapper">
              <FontAwesomeIcon icon={faEnvelope} className="form-input-icon" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="form-input with-icon"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <div className="form-input-wrapper">
              <FontAwesomeIcon icon={faLock} className="form-input-icon" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="form-input with-icon"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`btn btn-primary btn-block ${loading ? 'btn-disabled' : ''}`}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="auth-footer">
          <p>¿Olvidaste tu contraseña? Contacta al desarrollador.</p>
        </div>
      </div>
    </div>
  );
}

export default SuperadminLogin;
