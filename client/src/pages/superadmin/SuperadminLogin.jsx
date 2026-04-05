import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldHalved } from '@fortawesome/free-solid-svg-icons';

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
      const res = await fetch('http://localhost:3001/api/superadmin/login', {
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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1a1a2e',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#16213e',
        borderRadius: '16px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <FontAwesomeIcon 
            icon={faShieldHalved} 
            style={{ 
              fontSize: '48px', 
              color: '#e94560',
              marginBottom: '16px'
            }} 
          />
          <h1 style={{ 
            color: '#fff', 
            fontSize: '24px',
            marginBottom: '8px'
          }}>
            Superadmin
          </h1>
          <p style={{ color: '#a0a0a0', fontSize: '14px' }}>
            Panel de administración del sistema
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(233, 69, 96, 0.1)',
            border: '1px solid #e94560',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            color: '#e94560',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: '#fff',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #2a2a4a',
                backgroundColor: '#1a1a2e',
                color: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#e94560'}
              onBlur={(e) => e.target.style.borderColor = '#2a2a4a'}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              color: '#fff',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #2a2a4a',
                backgroundColor: '#1a1a2e',
                color: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#e94560'}
              onBlur={(e) => e.target.style.borderColor = '#2a2a4a'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: loading ? '#4a4a6a' : '#e94560',
              color: '#fff',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          marginTop: '20px',
          color: '#a0a0a0',
          fontSize: '12px'
        }}>
          ¿Olvidaste tu contraseña? Contacta al desarrollador.
        </p>
      </div>
    </div>
  );
}

export default SuperadminLogin;
