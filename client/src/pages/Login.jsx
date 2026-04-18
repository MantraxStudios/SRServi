import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock, faDownload, faUserCog, faKey, faShieldAlt } from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

function Login() {
  const [step, setStep] = useState('login'); // 'login' | 'totp' | 'verify'
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [totpCode, setTotpCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: name === 'email' ? value.toLowerCase() : value });
  };

  const finishLogin = (user, token) => {
    login(user, token);
    navigate('/admin');
  };

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

      if (data.requiresVerification) {
        setVerifyEmail(data.email);
        setStep('verify');
        return;
      }

      if (data.requiresTwoFactor) {
        setTempToken(data.tempToken);
        setStep('totp');
        return;
      }

      finishLogin(data.user, data.token);
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
      finishLogin(data.user, data.token);
    } catch (err) {
      setError(err.message);
      setTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(API + '/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyEmail, code: verifyCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código incorrecto');
      finishLogin(data.user, data.token);
    } catch (err) {
      setError(err.message);
      setVerifyCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendMsg('');
    setResendLoading(true);
    try {
      const res = await fetch(API + '/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResendMsg('Código reenviado');
    } catch (err) {
      setResendMsg(err.message);
    } finally {
      setResendLoading(false);
    }
  };

  // ── Paso: verificación de correo ───────────────────────────────────────────
  if (step === 'verify') {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ maxWidth: '380px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: '#000', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 14px'
            }}>
              <FontAwesomeIcon icon={faEnvelope} style={{ fontSize: '24px', color: '#D4AF37' }} />
            </div>
            <h2 style={{ fontWeight: 800, fontSize: '20px', marginBottom: '6px' }}>Activa tu cuenta</h2>
            <p style={{ color: '#666', fontSize: '13px' }}>
              Enviamos un código de 6 dígitos a <strong>{verifyEmail}</strong>
            </p>
          </div>

          {error && <div className="error" style={{ marginBottom: '16px' }}>{error}</div>}

          <form onSubmit={handleVerifyEmail}>
            <div className="form-group">
              <label>Código de activación</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                style={{ fontSize: '28px', letterSpacing: '8px', textAlign: 'center', fontWeight: 700 }}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full auth-submit"
              disabled={loading || verifyCode.length !== 6}
            >
              {loading ? 'Verificando...' : 'Activar cuenta'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <button
              onClick={handleResend}
              disabled={resendLoading}
              style={{ background: 'none', border: 'none', color: '#D4AF37', fontSize: '13px', cursor: 'pointer' }}
            >
              {resendLoading ? 'Enviando...' : 'Reenviar código'}
            </button>
            {resendMsg && <p style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>{resendMsg}</p>}
          </div>

          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <button
              onClick={() => { setStep('login'); setError(''); setVerifyCode(''); }}
              style={{ background: 'none', border: 'none', color: '#888', fontSize: '13px', cursor: 'pointer' }}
            >
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Paso: verificación TOTP al iniciar sesión ──────────────────────────────
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

  // ── Paso: formulario de login ──────────────────────────────────────────────
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
