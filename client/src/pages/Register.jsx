import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faEnvelope, faLock, faStore, faDownload, faUserCog, faGlobe, faDesktop } from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

function Register() {
  const [step, setStep] = useState('form'); // 'form' | 'verify'
  const COUNTRIES = [
    'Argentina','Bolivia','Brasil','Chile','Colombia','Costa Rica','Cuba',
    'Ecuador','El Salvador','España','Guatemala','Honduras','México',
    'Nicaragua','Panamá','Paraguay','Perú','Puerto Rico','República Dominicana',
    'Uruguay','Venezuela','Otro'
  ];

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    business_name: '',
    country: ''
  });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.country) {
      setError('Por favor selecciona tu país');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(API + '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          business_name: formData.business_name,
          country: formData.country
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar');

      setVerifyEmail(data.email);
      setStep('verify');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
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
      login(data.user, data.token);
      navigate('/admin');
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

  // ── Modal: verificación de correo ─────────────────────────────────────────
  const verifyModal = step === 'verify' && (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '16px'
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '36px 32px',
        width: '100%', maxWidth: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: '#000', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 16px'
          }}>
            <FontAwesomeIcon icon={faEnvelope} style={{ fontSize: '26px', color: '#D4AF37' }} />
          </div>
          <h2 style={{ fontWeight: 800, fontSize: '20px', marginBottom: '8px', color: '#111' }}>
            Activa tu cuenta
          </h2>
          <p style={{ color: '#666', fontSize: '13px', lineHeight: 1.5 }}>
            Enviamos un código de 6 dígitos a<br />
            <strong style={{ color: '#111' }}>{verifyEmail}</strong>
          </p>
        </div>

        {error && <div className="error" style={{ marginBottom: '16px' }}>{error}</div>}

        <form onSubmit={handleVerify}>
          <div className="form-group">
            <label style={{ fontWeight: 600, fontSize: '13px', color: '#444', marginBottom: '8px', display: 'block' }}>
              Código de activación
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={verifyCode}
              onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
              style={{
                width: '100%', fontSize: '32px', letterSpacing: '10px',
                textAlign: 'center', fontWeight: 700, padding: '14px 8px',
                border: '2px solid #e0e0e0', borderRadius: '12px',
                outline: 'none', boxSizing: 'border-box'
              }}
              onFocus={e => e.target.style.borderColor = '#D4AF37'}
              onBlur={e => e.target.style.borderColor = '#e0e0e0'}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg btn-full auth-submit"
            disabled={loading || verifyCode.length !== 6}
            style={{ marginTop: '4px' }}
          >
            {loading ? 'Verificando...' : 'Activar cuenta'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '8px' }}>
            ¿No recibiste el correo?
          </p>
          <button
            onClick={handleResend}
            disabled={resendLoading}
            style={{
              background: 'none', border: '1px solid #D4AF37', color: '#D4AF37',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              padding: '8px 20px', borderRadius: '8px',
              opacity: resendLoading ? 0.6 : 1
            }}
          >
            {resendLoading ? 'Enviando...' : 'Reenviar código'}
          </button>
          {resendMsg && (
            <p style={{ fontSize: '12px', color: resendMsg === 'Código reenviado' ? '#16a34a' : '#dc2626', marginTop: '8px' }}>
              {resendMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  // ── Paso: formulario de registro ───────────────────────────────────────────
  return (
    <>
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <span>SR</span>
          </div>
          <h1 className="auth-title">Crear Cuenta</h1>
          <p className="auth-subtitle">Únete a SRServi y comienza a vender</p>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre de Usuario</label>
            <div className="input-icon-wrapper">
              <FontAwesomeIcon icon={faUser} className="input-icon" />
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                placeholder="Tu nombre completo"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Nombre del Negocio</label>
            <div className="input-icon-wrapper">
              <FontAwesomeIcon icon={faStore} className="input-icon" />
              <input
                type="text"
                name="business_name"
                value={formData.business_name}
                onChange={handleChange}
                placeholder="Nombre de tu restaurante (opcional)"
              />
            </div>
          </div>

          <div className="form-group">
            <label>País <span style={{ color: '#e53e3e' }}>*</span></label>
            <div className="input-icon-wrapper">
              <FontAwesomeIcon icon={faGlobe} className="input-icon" />
              <select
                name="country"
                value={formData.country}
                onChange={handleChange}
                required
                style={{ paddingLeft: '36px', width: '100%', appearance: 'none' }}
              >
                <option value="">Selecciona tu país...</option>
                {COUNTRIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

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
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Confirmar Contraseña</label>
            <div className="input-icon-wrapper">
              <FontAwesomeIcon icon={faLock} className="input-icon" />
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder="Repite tu contraseña"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-full auth-submit"
            disabled={loading}
          >
            {loading ? 'Registrando...' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="auth-link">Inicia sesión</Link>
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
          <a
            href="/api/download/windows"
            className="btn btn-lg btn-full"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', textDecoration: 'none', background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)', color: '#fff', border: '2px solid #D4AF37', borderRadius: '12px', fontWeight: 700, fontSize: '15px', padding: '14px' }}
          >
            <FontAwesomeIcon icon={faDesktop} style={{ color: '#D4AF37', fontSize: '18px' }} />
            <span>
              <span style={{ color: '#D4AF37' }}>SRServi</span> para Windows
            </span>
            <FontAwesomeIcon icon={faDownload} style={{ marginLeft: 'auto', opacity: 0.7 }} />
          </a>
        </div>
      </div>
    </div>
    {verifyModal}
    </>
  );
}

export default Register;
