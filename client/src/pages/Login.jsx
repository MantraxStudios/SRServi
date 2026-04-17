import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock, faDownload, faUserCog, faShieldAlt, faKey } from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

function Login() {
  const [step, setStep] = useState('login'); // 'login' | 'totp' | 'reminder'
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [totpCode, setTotpCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [pendingUser, setPendingUser] = useState(null);
  const [pendingToken, setPendingToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(API + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');

      if (data.requiresTwoFactor) {
        setTempToken(data.tempToken);
        setStep('totp');
        return;
      }

      if (data.twoFactorReminder && !sessionStorage.getItem('2fa_reminder_dismissed')) {
        setPendingUser(data.user);
        setPendingToken(data.token);
        setStep('reminder');
        return;
      }

      login(data.user, data.token);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTotpVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(API + '/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code: totpCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código incorrecto');
      login(data.user, data.token);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
      setTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  const finishLogin = () => {
    login(pendingUser, pendingToken);
    navigate('/admin');
  };

  const dismissReminder = () => {
    sessionStorage.setItem('2fa_reminder_dismissed', '1');
    finishLogin();
  };

  if (step === 'reminder') {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ maxWidth: '420px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #D4AF37, #92400e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <FontAwesomeIcon icon={faShieldAlt} style={{ fontSize: '28px', color: '#fff' }} />
            </div>
            <h2 style={{ fontWeight: 800, fontSize: '20px', marginBottom: '8px' }}>
              Protege tu cuenta SRServi
            </h2>
            <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.5' }}>
              Activa la <strong>verificación en 2 pasos</strong> para mayor seguridad.
              Sin ella, si alguien obtiene tu contraseña podría acceder a tu cuenta.
            </p>
          </div>

          <div style={{
            background: '#fffbeb', border: '1px solid #D4AF37', borderRadius: '10px',
            padding: '14px 16px', marginBottom: '20px', fontSize: '13px', color: '#92400e'
          }}>
            <strong>¿Para qué sirve?</strong><br />
            Cada vez que inicies sesión, tu app de autenticación generará un código de 6 dígitos.
            Funciona con <strong>Google Authenticator</strong>, <strong>Authy</strong> u otras.
          </div>

          <button
            onClick={() => { finishLogin(); setTimeout(() => navigate('/admin/settings'), 100); }}
            className="btn btn-primary btn-lg btn-full"
            style={{ marginBottom: '10px', background: '#D4AF37', border: 'none', color: '#000', fontWeight: 800 }}
          >
            <FontAwesomeIcon icon={faShieldAlt} style={{ marginRight: '8px' }} />
            Activar ahora
          </button>
          <button
            onClick={dismissReminder}
            className="btn btn-lg btn-full"
            style={{ background: 'transparent', border: '1px solid #ccc', color: '#888', fontSize: '14px' }}
          >
            Omitir por ahora
          </button>
        </div>
      </div>
    );
  }

  if (step === 'totp') {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ maxWidth: '380px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: '#000', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 14px'
            }}>
              <FontAwesomeIcon icon={faKey} style={{ fontSize: '24px', color: '#D4AF37' }} />
            </div>
            <h2 style={{ fontWeight: 800, fontSize: '20px', marginBottom: '6px' }}>Verificación en 2 pasos</h2>
            <p style={{ color: '#666', fontSize: '13px' }}>
              Abre tu app de autenticación e ingresa el código de 6 dígitos.
            </p>
          </div>

          {error && <div className="error" style={{ marginBottom: '16px' }}>{error}</div>}

          <form onSubmit={handleTotpVerify}>
            <div className="form-group">
              <label>Código de verificación</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                style={{ fontSize: '28px', letterSpacing: '8px', textAlign: 'center', fontWeight: 700 }}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full auth-submit"
              disabled={loading || totpCode.length !== 6}
            >
              {loading ? 'Verificando...' : 'Verificar'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              onClick={() => { setStep('login'); setError(''); setTotpCode(''); }}
              style={{ background: 'none', border: 'none', color: '#888', fontSize: '13px', cursor: 'pointer' }}
            >
              Volver al inicio de sesión
            </button>
          </div>

          <div style={{ marginTop: '16px', borderTop: '1px solid #eee', paddingTop: '14px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>¿Perdiste acceso a tu app?</p>
            <Link to="/forgot-password" style={{ fontSize: '13px', color: '#D4AF37', fontWeight: 700 }}>
              Recuperar con código de autenticación
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <span>SR</span>
          </div>
          <h1 className="auth-title">SRServi</h1>
          <p className="auth-subtitle">Sistema de Pedidos para Restaurantes</p>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Correo electrónico</label>
            <div className="input-icon-wrapper">
              <FontAwesomeIcon icon={faEnvelope} className="input-icon" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="tu@email.com"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <div className="input-icon-wrapper">
              <FontAwesomeIcon icon={faLock} className="input-icon" />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Tu contraseña"
              />
            </div>
          </div>

          <div style={{ textAlign: 'right', marginBottom: '12px' }}>
            <Link to="/forgot-password" style={{ fontSize: '13px', color: '#D4AF37' }}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-full auth-submit"
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="auth-link">Regístrate aquí</Link>
          </p>
          <Link
            to="/worker-login"
            className="btn btn-lg btn-full"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '12px', textDecoration: 'none', background: '#1a1a1a', color: '#D4AF37', border: '1px solid #D4AF37' }}
          >
            <FontAwesomeIcon icon={faUserCog} />
            Ingresar como Vendedor
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
          <a
            href="/api/download/launcher"
            className="btn btn-primary btn-lg btn-full"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none' }}
          >
            <FontAwesomeIcon icon={faDownload} />
            Descargar App Android
          </a>
          <a
            href="/api/download/tv"
            className="btn btn-lg btn-full"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', background: '#1a1a1a', color: '#D4AF37', border: '1px solid #D4AF37' }}
          >
            <FontAwesomeIcon icon={faDownload} />
            Descargar App TV Órdenes
          </a>
        </div>
      </div>
    </div>
  );
}

export default Login;
