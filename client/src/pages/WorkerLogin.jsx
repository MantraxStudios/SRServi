import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faLock, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { API_URL } from '../config.js';

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
      const response = await fetch(`${API_URL}/api/workers/login`, {
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

  const s = {
    container: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1a1a2e',
      padding: '20px'
    },
    card: {
      background: '#ffffff',
      borderRadius: '20px',
      padding: '40px',
      width: '100%',
      maxWidth: '400px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
    },
    backButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: 'none',
      border: 'none',
      color: '#666',
      cursor: 'pointer',
      marginBottom: '20px',
      fontSize: '14px',
      padding: 0
    },
    title: {
      textAlign: 'center',
      color: '#1a1a2e',
      marginBottom: '10px',
      fontSize: '28px',
      fontWeight: 'bold'
    },
    subtitle: {
      textAlign: 'center',
      color: '#666',
      marginBottom: '30px',
      fontSize: '14px'
    },
    error: {
      background: '#fee2e2',
      color: '#dc2626',
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '20px',
      textAlign: 'center',
      fontSize: '14px'
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    },
    inputGroup: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    },
    icon: {
      position: 'absolute',
      left: '15px',
      color: '#999',
      fontSize: '18px'
    },
    input: {
      width: '100%',
      padding: '15px 15px 15px 45px',
      border: '2px solid #e5e5e5',
      borderRadius: '10px',
      fontSize: '16px',
      outline: 'none',
      boxSizing: 'border-box',
      color: '#1a1a2e',
      backgroundColor: 'white'
    },
    button: {
      background: '#1a1a2e',
      color: '#ffffff',
      border: 'none',
      padding: '15px',
      borderRadius: '10px',
      fontSize: '16px',
      fontWeight: 'bold',
      cursor: 'pointer'
    }
  };

  return (
    <div style={s.container}>
      <div style={s.card}>
        <button onClick={() => navigate('/')} style={s.backButton}>
          <FontAwesomeIcon icon={faArrowLeft} /> Volver
        </button>

        <h1 style={s.title}>Panel de Trabajadores</h1>
        <p style={s.subtitle}>Ingresa tus credenciales</p>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.inputGroup}>
            <FontAwesomeIcon icon={faUser} style={s.icon} />
            <input
              type="text"
              placeholder="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={s.input}
              required
            />
          </div>

          <div style={s.inputGroup}>
            <FontAwesomeIcon icon={faLock} style={s.icon} />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={s.input}
              required
            />
          </div>

          <button type="submit" style={s.button} disabled={loading}>
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default WorkerLogin;
