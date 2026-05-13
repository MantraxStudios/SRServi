import { useState, useEffect, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faPlay, faEye, faEyeSlash,
  faCheckCircle, faTimesCircle, faSpinner, faDownload,
  faToggleOn, faToggleOff, faClock, faExclamationTriangle,
  faLink, faUnlink, faShieldAlt, faMobileAlt,
} from '@fortawesome/free-solid-svg-icons';

const CSS = `
.ig-page { padding: 20px 16px; max-width: 1100px; margin: 0 auto; font-family: system-ui,-apple-system,sans-serif; }
.ig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
.ig-header { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
.ig-title { font-size: 22px; font-weight: 800; color: #1e293b; margin: 0; }
.ig-subtitle { font-size: 13px; color: #6b7280; margin: 0; }
.ig-tpl-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid #f1f5f9; gap: 8px; }
.ig-tpl-actions { display: flex; gap: 6px; flex-shrink: 0; }
@media (max-width: 680px) {
  .ig-page { padding: 14px 12px; }
  .ig-grid { grid-template-columns: 1fr; gap: 14px; }
  .ig-header { gap: 10px; margin-bottom: 16px; }
  .ig-title { font-size: 18px; }
  .ig-subtitle { font-size: 12px; }
  .ig-tpl-header { flex-wrap: wrap; gap: 8px; }
  .ig-tpl-actions { width: 100%; justify-content: flex-end; }
}
`;

const IgIcon = ({ size = 20, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
);

const TEMPLATES = [
  {
    id: 0,
    name: 'Podio',
    emoji: '🏆',
    desc: 'Fondo oscuro. Ranking 01/02/03 con medallas y precios en píldora dorada.',
    color: '#D4AF37',
  },
  {
    id: 1,
    name: 'Neon Deals',
    emoji: '⚡',
    desc: 'Fondo negro. Cupones con borde neón gigante. Sin cupones: grilla 2×2.',
    color: '#a855f7',
  },
  {
    id: 2,
    name: 'Magazine',
    emoji: '📸',
    desc: 'Franja superior de color, foto héroe grande, dos tiles abajo. Estilo editorial.',
    color: '#3b82f6',
  },
  {
    id: 3,
    name: 'White Clean',
    emoji: '🤍',
    desc: 'Fondo blanco puro. Franja de color arriba, producto estrella centrado, dos productos abajo.',
    color: '#111111',
  },
  {
    id: 4,
    name: 'Noir Gold',
    emoji: '🖤',
    desc: 'Negro absoluto. Producto en círculo con anillo dorado brillante y marcos en las esquinas.',
    color: '#b8972e',
  },
  {
    id: 5,
    name: 'Bold Split',
    emoji: '✂️',
    desc: 'Negro arriba / blanco abajo con corte diagonal en color de acento. Estilo póster.',
    color: '#374151',
  },
];

const API = 'https://srservi2.srautomatic.com';

export default function InstagramAuto() {
  const { token } = useAuth();
  const { selectedStore } = useContext(StoreContext);

  const [cfg, setCfg]               = useState({ ig_username: '', ig_password: '', caption_template: '', enabled: false });
  const [connected, setConnected]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [posting, setPosting]       = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [previewing, setPreviewing] = useState(null);
  const [showPass, setShowPass]     = useState(false);
  const [previews, setPreviews]     = useState({ 0: null, 1: null, 2: null });
  const [lastStatus, setLastStatus] = useState(null);
  const [toast, setToast]           = useState(null);
  // verification modal state
  const [verifyModal, setVerifyModal] = useState(null); // null | { type: '2fa'|'challenge', info? }
  const [verifyCode, setVerifyCode]   = useState('');
  const [verifyMethod, setVerifyMethod] = useState('0'); // '0'=TOTP, '1'=SMS

  const storeId = selectedStore?.id;
  const nextTpl = ((lastStatus?.template_counter || 0)) % 3;

  useEffect(() => {
    if (!storeId || !token) return;
    setLoading(true);
    setPreviews({ 0: null, 1: null, 2: null });
    fetch(`${API}/api/instagram/${storeId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setCfg({ ig_username: d.ig_username || '', ig_password: d.ig_password || '', caption_template: d.caption_template || '', enabled: !!d.enabled });
        setConnected(!!d.ig_connected);
        setLastStatus({ last_posted_at: d.last_posted_at, last_error: d.last_error, template_counter: d.template_counter ?? 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storeId, token]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const save = async () => {
    if (!storeId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/instagram/${storeId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('Configuración guardada');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const connect = async () => {
    if (!storeId) return;
    if (!cfg.ig_username || !cfg.ig_password) {
      showToast('Guardá usuario y contraseña primero', 'error');
      return;
    }
    setConnecting(true);
    try {
      const res = await fetch(`${API}/api/instagram/${storeId}/connect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.ok) {
        setConnected(true);
        showToast('¡Cuenta conectada exitosamente!');
      } else if (data.needsTwoFactor) {
        setVerifyCode('');
        setVerifyModal({ type: '2fa', info: data.info });
      } else if (data.needsChallenge) {
        setVerifyCode('');
        setVerifyModal({ type: 'challenge' });
      }
    } catch (e) { showToast(e.message, 'error'); }
    finally { setConnecting(false); }
  };

  const submitVerify = async () => {
    if (!verifyCode.trim()) return;
    setConnecting(true);
    try {
      const res = await fetch(`${API}/api/instagram/${storeId}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode, type: verifyModal.type, verificationMethod: verifyMethod }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConnected(true);
      setVerifyModal(null);
      showToast('¡Cuenta conectada exitosamente!');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setConnecting(false); }
  };

  const disconnect = async () => {
    if (!storeId) return;
    if (!window.confirm('¿Desconectar la cuenta de Instagram?')) return;
    try {
      await fetch(`${API}/api/instagram/${storeId}/session`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setConnected(false);
      showToast('Cuenta desconectada');
    } catch (e) { showToast(e.message, 'error'); }
  };

  const loadPreview = async (tplIdx) => {
    if (!storeId) return;
    setPreviewing(tplIdx);
    try {
      const res = await fetch(`${API}/api/instagram/${storeId}/preview?tpl=${tplIdx}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error generando imagen');
      const blob = await res.blob();
      setPreviews(p => ({ ...p, [tplIdx]: URL.createObjectURL(blob) }));
    } catch (e) { showToast(e.message, 'error'); }
    finally { setPreviewing(null); }
  };

  const downloadPreview = (tplIdx) => {
    const url = previews[tplIdx];
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `instagram-tpl${tplIdx + 1}-${selectedStore?.code || 'tienda'}.jpg`;
    a.click();
  };

  const postNow = async () => {
    if (!storeId) return;
    if (!cfg.ig_username || !cfg.ig_password) {
      showToast('Configura usuario y contraseña primero', 'error');
      return;
    }
    if (!window.confirm('¿Publicar ahora en Instagram?')) return;
    setPosting(true);
    try {
      const res = await fetch(`${API}/api/instagram/${storeId}/post-now`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('¡Publicado en Instagram!');
      setLastStatus(prev => ({ ...prev, last_posted_at: new Date().toISOString(), last_error: null, template_counter: (prev?.template_counter || 0) + 1 }));
    } catch (e) { showToast(e.message, 'error'); }
    finally { setPosting(false); }
  };

  if (!selectedStore) {
    return (
      <div className="ig-page">
        <style>{CSS}</style>
        <div style={s.empty}>
          <IgIcon size={48} style={{ color: '#d1d5db', marginBottom: 14 }} />
          <p>Selecciona una tienda para configurar Instagram.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ig-page">
      <style>{CSS}</style>

      {/* Verification modal */}
      {verifyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <FontAwesomeIcon icon={verifyModal.type === '2fa' ? faShieldAlt : faMobileAlt} style={{ fontSize: 22, color: '#D4AF37' }} />
              </div>
              <h3 style={{ fontWeight: 800, fontSize: 18, margin: '0 0 8px', color: '#111' }}>
                {verifyModal.type === '2fa' ? 'Verificación en 2 pasos' : 'Código de verificación'}
              </h3>
              <p style={{ color: '#666', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                {verifyModal.type === 'challenge'
                  ? 'Instagram envió un código a tu email o teléfono. Ingresalo a continuación.'
                  : 'Ingresá el código de 6 dígitos de tu app de autenticación o el código SMS.'}
              </p>
            </div>

            {verifyModal.type === '2fa' && verifyModal.info?.totp_two_factor_on === false && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Método de verificación</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ val: '0', label: 'App TOTP' }, { val: '1', label: 'SMS' }].map(m => (
                    <button key={m.val} onClick={() => setVerifyMethod(m.val)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${verifyMethod === m.val ? '#D4AF37' : '#e0e0e0'}`, background: verifyMethod === m.val ? '#fffbee' : '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', color: verifyMethod === m.val ? '#b8920a' : '#555' }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={verifyCode}
              onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
              style={{ width: '100%', fontSize: 30, letterSpacing: 10, textAlign: 'center', fontWeight: 700, padding: '14px 8px', border: '2px solid #e0e0e0', borderRadius: 12, outline: 'none', boxSizing: 'border-box', marginBottom: 14 }}
              onFocus={e => { e.target.style.borderColor = '#D4AF37'; }}
              onBlur={e => { e.target.style.borderColor = '#e0e0e0'; }}
              onKeyDown={e => e.key === 'Enter' && submitVerify()}
            />

            <button onClick={submitVerify} disabled={connecting || verifyCode.length < 4} style={{ ...s.btnInstagram, marginBottom: 10 }}>
              {connecting ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCheckCircle} />}
              {connecting ? ' Verificando...' : ' Confirmar código'}
            </button>
            <button onClick={() => setVerifyModal(null)} style={{ width: '100%', background: 'none', border: 'none', color: '#aaa', fontSize: 13, cursor: 'pointer', padding: '6px' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, left: 16, zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : '#22c55e',
          color: '#fff', padding: '12px 16px', borderRadius: 12,
          fontWeight: 700, fontSize: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 8,
          maxWidth: 400, marginLeft: 'auto',
        }}>
          <FontAwesomeIcon icon={toast.type === 'error' ? faTimesCircle : faCheckCircle} />
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="ig-header">
        <div style={s.headerIcon}>
          <IgIcon size={26} style={{ color: '#fff' }} />
        </div>
        <div>
          <h1 className="ig-title">Instagram Auto-Post</h1>
          <p className="ig-subtitle">Publicá automáticamente — <strong>{selectedStore.name}</strong></p>
        </div>
      </div>

      <div className="ig-grid">
        {/* ── Left: Config ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Credentials */}
          <div style={s.card}>
            <h3 style={s.cardTitle}>Cuenta de Instagram</h3>

            <div style={s.field}>
              <label style={s.label}>Usuario de Instagram</label>
              <input
                value={cfg.ig_username}
                onChange={e => setCfg(p => ({ ...p, ig_username: e.target.value }))}
                placeholder="@turestaurante"
                style={s.input}
              />
            </div>

            <div style={s.field}>
              <label style={s.label}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={cfg.ig_password}
                  onChange={e => setCfg(p => ({ ...p, ig_password: e.target.value }))}
                  placeholder="Contraseña de Instagram"
                  style={{ ...s.input, paddingRight: 44 }}
                />
                <button onClick={() => setShowPass(p => !p)} style={s.eyeBtn}>
                  <FontAwesomeIcon icon={showPass ? faEyeSlash : faEye} />
                </button>
              </div>
              <p style={s.hint}>Funciona con cuentas personales y Business. La contraseña se guarda cifrada.</p>
            </div>

            {/* Connection status */}
            <div style={{ padding: '12px 14px', borderRadius: 10, background: connected ? '#f0fdf4' : '#fef9f0', border: `1px solid ${connected ? '#bbf7d0' : '#fde68a'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FontAwesomeIcon icon={connected ? faCheckCircle : faTimesCircle} style={{ color: connected ? '#16a34a' : '#d97706', fontSize: 16 }} />
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: connected ? '#15803d' : '#92400e' }}>
                    {connected ? 'Cuenta conectada' : 'Cuenta no conectada'}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: connected ? '#166534' : '#78350f' }}>
                    {connected ? 'Listo para publicar' : 'Conectá tu cuenta para publicar'}
                  </p>
                </div>
              </div>
              {connected ? (
                <button onClick={disconnect} style={{ background: 'none', border: '1px solid #fca5a5', color: '#ef4444', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <FontAwesomeIcon icon={faUnlink} /> Desconectar
                </button>
              ) : (
                <button onClick={connect} disabled={connecting} style={{ background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap', opacity: connecting ? 0.7 : 1 }}>
                  {connecting ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faLink} />}
                  {connecting ? ' Conectando...' : ' Conectar'}
                </button>
              )}
            </div>

            <div style={s.field}>
              <label style={s.label}>Caption personalizado <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span></label>
              <textarea
                value={cfg.caption_template}
                onChange={e => setCfg(p => ({ ...p, caption_template: e.target.value }))}
                rows={4}
                placeholder={`✨ ${selectedStore.name} ✨\n\n🔥 Lo más pedido esta semana...\n\n📲 Pedí online: srservi2.srautomatic.com/store/${selectedStore.code}`}
                style={{ ...s.input, resize: 'vertical', height: 'auto' }}
              />
              <p style={s.hint}>Si lo dejás vacío se genera automáticamente.</p>
            </div>
          </div>

          {/* Auto-post toggle */}
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ ...s.cardTitle, marginBottom: 4 }}>Publicación automática</h3>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Publica cada domingo a las 10:00 AM</p>
              </div>
              <button
                onClick={() => setCfg(p => ({ ...p, enabled: !p.enabled }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 36, color: cfg.enabled ? '#22c55e' : '#d1d5db' }}
              >
                <FontAwesomeIcon icon={cfg.enabled ? faToggleOn : faToggleOff} />
              </button>
            </div>
            {cfg.enabled && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                <p style={{ margin: 0, fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
                  ✅ Activo — se publicará automáticamente cada semana rotando entre las 3 plantillas.
                </p>
              </div>
            )}
          </div>

          {/* Status */}
          {lastStatus && (
            <div style={s.card}>
              <h3 style={s.cardTitle}>Estado</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lastStatus.last_posted_at ? (
                  <div style={s.statusRow}>
                    <FontAwesomeIcon icon={faClock} style={{ color: '#6b7280' }} />
                    <span style={{ fontSize: 13, color: '#374151' }}>
                      Última publicación: <strong>{new Date(lastStatus.last_posted_at).toLocaleString('es-CL')}</strong>
                    </span>
                  </div>
                ) : (
                  <div style={s.statusRow}>
                    <FontAwesomeIcon icon={faClock} style={{ color: '#9ca3af' }} />
                    <span style={{ fontSize: 13, color: '#9ca3af' }}>Nunca publicado</span>
                  </div>
                )}
                <div style={{ ...s.statusRow, gap: 6 }}>
                  <span style={{ fontSize: 13, color: '#374151' }}>
                    Próxima plantilla: <strong>{TEMPLATES[nextTpl].emoji} {TEMPLATES[nextTpl].name}</strong>
                  </span>
                </div>
                {lastStatus.last_error && (
                  <div style={{ ...s.statusRow, background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>
                    <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#ef4444', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#dc2626' }}>{lastStatus.last_error}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <button onClick={save} disabled={saving || loading} style={s.btnPrimary}>
            {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
            {saving ? ' Guardando...' : ' Guardar configuración'}
          </button>

          <button onClick={postNow} disabled={posting || !cfg.ig_username || !connected} style={{ ...s.btnInstagram, opacity: (!connected || posting) ? 0.5 : 1 }}>
            {posting ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlay} />}
            {posting ? ' Publicando...' : ' Publicar ahora'}
          </button>
          {!connected && cfg.ig_username && (
            <p style={{ textAlign: 'center', fontSize: 12, color: '#d97706', margin: '-4px 0 0', fontWeight: 600 }}>
              Conectá tu cuenta para poder publicar
            </p>
          )}
        </div>

        {/* ── Right: Templates preview ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={s.card}>
            <h3 style={s.cardTitle}>Plantillas disponibles</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
              Las 6 plantillas rotan cada semana. Hacé clic en "Ver" para previsualizar cada una.
            </p>

            {TEMPLATES.map(tpl => (
              <div key={tpl.id} style={{
                border: `2px solid ${nextTpl === tpl.id ? tpl.color : '#e5e7eb'}`,
                borderRadius: 14,
                marginBottom: 14,
                overflow: 'hidden',
                background: nextTpl === tpl.id ? `${tpl.color}08` : '#fff',
              }}>
                {/* template header */}
                <div className="ig-tpl-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: tpl.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                      {tpl.emoji}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {tpl.name}
                        {nextTpl === tpl.id && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: tpl.color, color: '#fff', padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                            PRÓXIMA
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, lineHeight: 1.4 }}>{tpl.desc}</div>
                    </div>
                  </div>
                  <div className="ig-tpl-actions">
                    {previews[tpl.id] && (
                      <button onClick={() => downloadPreview(tpl.id)} style={s.btnSmall}>
                        <FontAwesomeIcon icon={faDownload} />
                      </button>
                    )}
                    <button onClick={() => loadPreview(tpl.id)} disabled={previewing === tpl.id} style={{ ...s.btnSmallPrimary, background: tpl.color }}>
                      {previewing === tpl.id
                        ? <FontAwesomeIcon icon={faSpinner} spin />
                        : <FontAwesomeIcon icon={faEye} />}
                      {previewing === tpl.id ? ' ...' : ' Ver'}
                    </button>
                  </div>
                </div>

                {/* preview image */}
                {previews[tpl.id] && (
                  <img
                    src={previews[tpl.id]}
                    alt={`Preview ${tpl.name}`}
                    style={{ width: '100%', display: 'block' }}
                  />
                )}

                {/* placeholder */}
                {!previews[tpl.id] && (
                  <div style={{ background: '#f8fafc', padding: '20px', textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
                      Hacé clic en "Ver" para previsualizar esta plantilla
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Info */}
          <div style={{ ...s.card, background: '#fafafa', border: '1px solid #e5e7eb' }}>
            <h3 style={{ ...s.cardTitle, color: '#374151' }}>¿Cómo funciona?</h3>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'Imagen 1080×1080 lista para Instagram con productos y precios.',
                '6 plantillas rotativas: Podio, Neon Deals, Magazine, White Clean, Noir Gold y Bold Split.',
                'Los cupones activos aparecen automáticamente en Neon Deals.',
                'Publicación automática cada domingo a las 10:00 AM.',
                'Podés publicar manualmente en cualquier momento.',
                'Funciona con cuentas personales, Business y Creator.',
              ].map((t, i) => (
                <li key={i} style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  headerIcon: { width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  card: { background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb' },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#374151', marginTop: 0, marginBottom: 14 },
  field: { marginBottom: 14 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  hint: { fontSize: 11, color: '#9ca3af', margin: '5px 0 0' },
  eyeBtn: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 },
  statusRow: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  btnPrimary: { width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: '#1e293b', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnInstagram: { width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnSmall: { padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnSmallPrimary: { padding: '7px 12px', borderRadius: 8, border: 'none', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 },
  empty: { textAlign: 'center', padding: '60px 24px', color: '#6b7280', fontSize: 15 },
};
