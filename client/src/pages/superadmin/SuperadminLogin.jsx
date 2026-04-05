import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldAlt, faEnvelope, faLock, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { API_URL } from '../../config.js';

const COLORS = {
  black: '#000000',
  white: '#FFFFFF',
  gold: '#D4AF37',
  goldLight: '#E5C158',
  goldDark: '#B8962E',
  grayLight: '#F5F5F5',
  gray: '#CCCCCC',
  grayDark: '#666666',
  danger: '#DC3545'
};

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
      const res = await fetch(API_URL + '/api/superadmin/login', {
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
      backgroundColor: COLORS.black,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: COLORS.white,
        borderRadius: '24px',
        padding: '48px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(212, 175, 55, 0.2)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            backgroundColor: COLORS.black,
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <FontAwesomeIcon 
              icon={faShieldAlt} 
              style={{ 
                fontSize: '40px', 
                color: COLORS.gold
              }} 
            />
          </div>
          <h1 style={{ 
            color: COLORS.black, 
            fontSize: '28px',
            fontWeight: '700',
            marginBottom: '8px'
          }}>
            Superadmin
          </h1>
          <p style={{ color: COLORS.grayDark, fontSize: '14px' }}>
            Panel de administración del sistema
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(220, 53, 69, 0.1)',
            border: `2px solid ${COLORS.danger}`,
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: COLORS.danger }} />
            <span style={{ color: COLORS.danger, fontSize: '14px' }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              color: COLORS.black,
              marginBottom: '10px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              Email
            </label>
            <div style={{ position: 'relative' }}>
              <FontAwesomeIcon 
                icon={faEnvelope} 
                style={{ 
                  position: 'absolute', 
                  left: '16px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: COLORS.grayDark
                }} 
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '16px 16px 16px 48px',
                  borderRadius: '14px',
                  border: `2px solid ${COLORS.grayLight}`,
                  backgroundColor: COLORS.grayLight,
                  color: COLORS.black,
                  fontSize: '15px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = COLORS.gold;
                  e.target.style.backgroundColor = COLORS.white;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = COLORS.grayLight;
                  e.target.style.backgroundColor = COLORS.grayLight;
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <label style={{
              display: 'block',
              color: COLORS.black,
              marginBottom: '10px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <FontAwesomeIcon 
                icon={faLock} 
                style={{ 
                  position: 'absolute', 
                  left: '16px', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: COLORS.grayDark
                }} 
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '16px 16px 16px 48px',
                  borderRadius: '14px',
                  border: `2px solid ${COLORS.grayLight}`,
                  backgroundColor: COLORS.grayLight,
                  color: COLORS.black,
                  fontSize: '15px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = COLORS.gold;
                  e.target.style.backgroundColor = COLORS.white;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = COLORS.grayLight;
                  e.target.style.backgroundColor = COLORS.grayLight;
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '18px',
              borderRadius: '14px',
              border: 'none',
              backgroundColor: loading ? COLORS.gray : COLORS.black,
              color: loading ? COLORS.grayDark : COLORS.white,
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = COLORS.gold;
                e.currentTarget.style.color = COLORS.black;
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = COLORS.black;
                e.currentTarget.style.color = COLORS.white;
              }
            }}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div style={{
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: `1px solid ${COLORS.grayLight}`,
          textAlign: 'center'
        }}>
          <p style={{
            color: COLORS.grayDark,
            fontSize: '12px'
          }}>
            ¿Olvidaste tu contraseña? Contacta al desarrollador.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SuperadminLogin;
