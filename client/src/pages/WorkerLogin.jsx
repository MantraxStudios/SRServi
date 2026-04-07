import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faLock, faArrowLeft, faUserCog } from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

function WorkerLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(API + '/api/workers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al iniciar sesión');
      }

      localStorage.setItem('workerToken', data.token);
      localStorage.setItem('worker', JSON.stringify(data.worker));

      navigate('/worker-panel');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="worker-login-container">
      <div className="worker-login-card">
        <button onClick={() => navigate('/')} className="worker-back-btn">
          <FontAwesomeIcon icon={faArrowLeft} /> Volver
        </button>

        <div className="worker-login-header">
          <div className="worker-login-icon">
            <FontAwesomeIcon icon={faUserCog} />
          </div>
          <h1 className="worker-login-title">Panel de Trabajadores</h1>
          <p className="worker-login-subtitle">Ingresa tus credenciales para acceder</p>
        </div>

        {error && <div className="worker-login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="worker-login-form">
          <div className="worker-input-group">
            <FontAwesomeIcon icon={faUser} className="worker-input-icon" />
            <input
              type="text"
              placeholder="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="worker-input"
              required
            />
          </div>

          <div className="worker-input-group">
            <FontAwesomeIcon icon={faLock} className="worker-input-icon" />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="worker-input"
              required
            />
          </div>

          <button type="submit" className="worker-login-btn" disabled={loading}>
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default WorkerLogin;
