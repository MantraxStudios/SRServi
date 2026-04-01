import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faEnvelope, faLock, faStore } from '@fortawesome/free-solid-svg-icons';

function Register() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    business_name: ''
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

    if (formData.password !== formData.confirmPassword) {
      setError('Las contrasenas no coinciden');
      return;
    }

    if (formData.password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          business_name: formData.business_name
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al registrar');
      }

      login(data.user, data.token);
      
      alert(`Registro exitoso! Tu codigo es: ${data.user.code}`);
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
          <h1 className="auth-title">Crear Cuenta</h1>
          <p className="auth-subtitle">Únete a SRServi y comienza a vender</p>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label style={{ fontSize: '14px', color: 'var(--gray-dark)' }}>Nombre de Usuario</label>
            <div style={{ position: 'relative' }}>
              <FontAwesomeIcon 
                icon={faUser} 
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
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                style={{ 
                  paddingLeft: '48px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--gray)',
                  fontSize: '16px'
                }}
                placeholder="Tu nombre completo"
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '14px', color: 'var(--gray-dark)' }}>Nombre del Negocio</label>
            <div style={{ position: 'relative' }}>
              <FontAwesomeIcon 
                icon={faStore} 
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
                type="text"
                name="business_name"
                value={formData.business_name}
                onChange={handleChange}
                style={{ 
                  paddingLeft: '48px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--gray)',
                  fontSize: '16px'
                }}
                placeholder="Nombre de tu restaurante (opcional)"
              />
            </div>
          </div>

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
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '14px', color: 'var(--gray-dark)' }}>Confirmar Contraseña</label>
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
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                style={{ 
                  paddingLeft: '48px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--gray)',
                  fontSize: '16px'
                }}
                placeholder="Repite tu contraseña"
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
            {loading ? 'Registrando...' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="auth-footer" style={{ marginTop: '32px' }}>
          <p style={{ fontSize: '15px' }}>
            ¿Ya tienes cuenta?{' '}
            <Link 
              to="/login" 
              style={{ 
                color: 'var(--gold)', 
                fontWeight: '700',
                fontSize: '15px'
              }}
            >
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
