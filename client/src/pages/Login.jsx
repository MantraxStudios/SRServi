import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock, faDownload, faUserCog, faShieldAlt, faKey } from '@fortawesome/free-solid-svg-icons';
import { QRCodeCanvas } from 'qrcode.react';

const API = 'https://srservi2.srautomatic.com';

function Login() {
  const [step, setStep] = useState('login'); // 'login' | 'totp' | 'setup2fa'
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [totpCode, setTotpCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [pendingUser, setPendingUser] = useState(null);
  const [pendingToken, setPendingToken] = useState('');
  const [setupData, setSetupData] = useState(null); // { secret, otpauthUrl }
  const [setupCode, setSetupCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

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

      if (data.requiresTwoFactor) {
        setTempToken(data.tempToken);
        setStep('totp');
        return;
      }

      setPendingUser(data.user);
      setPendingToken(data.token);

      // Fetch setup QR inline
      const setupRes = await fetch(API + '/api/auth/2fa/setup', {
        headers: { 'Authorization': `Bearer ${data.token}` }
      });
      const setupJson = await setupRes.json();
      if (setupRes.ok) {
        setSetupData(setupJson);
        setSetupCode('');
        setStep('setup2fa');
      } else {
        finishLogin(data.user, data.token);
      }
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

  const handleActivate2FA = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(API + '/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${pendingToken}` },
        body: JSON.stringify({ code: setupCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código incorrecto');
      finishLogin(pendingUser, pendingToken);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

  // ── Paso: configurar 2FA después de login exitoso ──────────────────────────
  if (step === 'setup2fa' && setupData) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ maxWidth: '420px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #D4AF37, #92400e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px'
            }}>
              <FontAwesomeIcon icon={faShieldAlt} style={{ fontSize: '24px', color: '#fff' }} />
            </div>
            <h2 style={{ fontWeight: 800, fontSize: '20px', marginBottom: '6px' }}>Protege tu cuenta</h2>
            <p style={{ color: '#666', fontSize: '13px', lineHeight: '1.5' }}>
              Activa la verificación en 2 pasos para que nadie más pueda entrar aunque tenga tu contraseña.
              Funciona con <strong>Google Authenticator</strong>, <strong>Authy</strong> y otras apps.
            </p>
          </div>

          {error && <div className="error" style={{ marginBottom: '12px' }}>{error}</div>}

          <p style={{ fontSize: '13px', color: '#444', marginBottom: '12px', fontWeight: 600 }}>
            1. Escanea este QR con tu app de autenticación:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ padding: '14px', background: '#fff', border: '2px solid #000', borderRadius: '12px' }}>
              <QRCodeCanvas value={setupData.otpauthUrl} size={180} level="H" bgColor="#ffffff" fgColor="#000000" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>¿No puedes escanear? Ingresa este código en la app:</p>
              <div style={{
                fontFamily: 'monospace', fontSize: '13px', fontWeight: 700,
                background: '#f3f4f6', padding: '6px 12px', borderRadius: '8px',
                letterSpacing: '3px', color: '#1a1a1a', border: '1px solid #e0e0e0',
                wordBreak: 'break-all'
              }}>
                {setupData.secret}
              </div>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: '#444', marginBottom: '8px', fontWeight: 600 }}>
            2. Ingresa el código de 6 dígitos que muestra la app:
          </p>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '14px' }}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={setupCode}
              onChange={e => { setSetupCode(e.target.value.replace(/\D/g, '')); setError(''); }}
              placeholder="000000"
              style={{
                flex: 1, fontSize: '24px', letterSpacing: '8px', textAlign: 'center',
                fontWeight: 700, padding: '10px', borderRadius: '10px',
                border: '2px solid #e0e0e0', outline: 'none'
              }}
            />
            <button
              onClick={handleActivate2FA}
              disabled={loading || setupCode.length !== 6}
              className="btn btn-primary"
              style={{
                background: setupCode.length === 6 ? '#D4AF37' : '#e0e0e0',
                border: 'none', color: setupCode.length === 6 ? '#000' : '#999',
                fontWeight: 800, padding: '10px 18px', borderRadius: '10px', fontSize: '14px'
              }}
            >
              {loading ? '...' : 'Activar'}
            </button>
          </div>

          <button
            onClick={() => finishLogin(pendingUser, pendingToken)}
            style={{
              width: '100%', background: 'transparent', border: '1px solid #ddd',
              color: '#999', borderRadius: '10px', padding: '10px',
              cursor: 'pointer', fontSize: '13px'
            }}
          >
            Omitir por ahora
          </button>
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
