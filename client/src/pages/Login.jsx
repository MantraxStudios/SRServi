import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock } from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(API + '/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al iniciar sesion');
      }

      login(data.user, data.token);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            width: '80px', 
            height: '80px', 
            background: 'linear-gradient(135deg, var(--gold), var(--gold-light))',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 20px rgba(212, 175, 55, 0.3)'
          }}>
            <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--white)' }}>SR</span>
          </div>
          <h1 className="auth-title">SRServi</h1>
          <p className="auth-subtitle">Sistema de Pedidos para Restaurantes</p>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label style={{ fontSize: '14px', color: 'var(--gray-dark)' }}>Correo electrónico</label>
            <div style={{ position: 'relative' }}>
              <FontAwesomeIcon 
                icon={faEnvelope} 
                style={{ 
                  position: 'absolute', 
                  left: '14px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--gold)',
                  fontSize: '18px'
                }} 
              />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                style={{ 
                  paddingLeft: '48px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--gray)',
                  fontSize: '16px'
                }}
                placeholder="tu@email.com"
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '14px', color: 'var(--gray-dark)' }}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <FontAwesomeIcon 
                icon={faLock} 
                style={{ 
                  position: 'absolute', 
                  left: '14px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--gold)',
                  fontSize: '18px'
                }} 
              />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                style={{ 
                  paddingLeft: '48px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--gray)',
                  fontSize: '16px'
                }}
                placeholder="Tu contraseña"
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            style={{ 
              width: '100%', 
              marginTop: '8px',
              padding: '16px',
              fontSize: '18px',
              fontWeight: '700',
              borderRadius: 'var(--radius-md)'
            }}
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="auth-footer" style={{ marginTop: '32px' }}>
          <p style={{ fontSize: '15px' }}>
            ¿No tienes cuenta?{' '}
            <Link 
              to="/register" 
              style={{ 
                color: 'var(--gold)', 
                fontWeight: '700',
                fontSize: '15px'
              }}
            >
              Regístrate aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
