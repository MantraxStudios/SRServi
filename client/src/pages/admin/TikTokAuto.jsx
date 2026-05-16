import { useState, useEffect, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faPlay, faEye, faDownload,
  faCheckCircle, faTimesCircle, faSpinner,
  faToggleOn, faToggleOff, faClock, faExclamationTriangle,
  faLink, faUnlink, faEyeSlash, faKey,
} from '@fortawesome/free-solid-svg-icons';

const CSS = `
.tt-page { padding: 20px 16px; max-width: 1100px; margin: 0 auto; font-family: system-ui,-apple-system,sans-serif; }
.tt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
.tt-header { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
.tt-title { font-size: 22px; font-weight: 800; color: #1e293b; margin: 0; }
.tt-subtitle { font-size: 13px; color: #6b7280; margin: 0; }
.tt-tpl-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid #f1f5f9; gap: 8px; }
.tt-tpl-actions { display: flex; gap: 6px; flex-shrink: 0; }
@media (max-width: 680px) {
  .tt-page { padding: 14px 12px; }
  .tt-grid { grid-template-columns: 1fr; gap: 14px; }
  .tt-header { gap: 10px; margin-bottom: 16px; }
  .tt-title { font-size: 18px; }
  .tt-tpl-header { flex-wrap: wrap; gap: 8px; }
  .tt-tpl-actions { width: 100%; justify-content: flex-end; }
}
`;

const TikTokIcon = ({ size = 20, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.05a8.16 8.16 0 0 0 4.77 1.53V7.15a4.85 4.85 0 0 1-1-.46z"/>
  </svg>
);

const TEMPLATES = [
  { id: 0, name: 'Podio',      emoji: '🏆', desc: 'Ranking 01/02/03 con medallas y precios.',          color: '#D4AF37' },
  { id: 1, name: 'Neon Deals', emoji: '⚡', desc: 'Cupones con borde neón gigante. Grid 2×2 sin cupones.', color: '#a855f7' },
  { id: 2, name: 'Magazine',   emoji: '📸', desc: 'Foto héroe grande, dos tiles abajo. Estilo editorial.', color: '#3b82f6' },
  { id: 3, name: 'White Clean',emoji: '🤍', desc: 'Franja de color arriba, producto estrella centrado.', color: '#111111' },
  { id: 4, name: 'Noir Gold',  emoji: '🖤', desc: 'Producto en círculo con anillo dorado brillante.', color: '#b8972e' },
  { id: 5, name: 'Bold Split', emoji: '✂️', desc: 'Corte diagonal en color de acento. Estilo póster.', color: '#374151' },
];

const API = 'https://srservi2.srautomatic.com';

export default function TikTokAuto() {
  const { token }          = useAuth();
  const { selectedStore }  = useContext(StoreContext);
  const [searchParams]     = useSearchParams();

  const [cfg, setCfg]             = useState({ client_key: '', client_secret: '', caption_template: '', enabled: false, post_time: '10:00', post_days: '0' });
  const [showSecret, setShowSecret] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [posting, setPosting]     = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [previewing, setPreviewing] = useState(null);
  const [previews, setPreviews]   = useState({});
  const [lastStatus, setLastStatus] = useState(null);
  const [toast, setToast]         = useState(null);

  const storeId = selectedStore?.id;
  const nextTpl = ((lastStatus?.template_counter || 0)) % 6;

  // On mount: check for OAuth result in URL
  useEffect(() => {
    const connected_param = searchParams.get('connected');
    const error_param     = searchParams.get('error');
    if (connected_param === '1') showToast('¡Cuenta de TikTok conectada!');
    if (error_param) showToast(decodeURIComponent(error_param), 'error');
  }, []);

  useEffect(() => {
    if (!storeId || !token) return;
    setLoading(true);
    setPreviews({});
    fetch(`${API}/api/tiktok/${storeId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setCfg({ client_key: d.client_key || '', client_secret: d.client_secret || '', caption_template: d.caption_template || '', enabled: !!d.enabled, post_time: d.post_time || '10:00', post_days: d.post_days || '0' });
        setConnected(!!d.tk_connected);
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
      const res = await fetch(`${API}/api/tiktok/${storeId}`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(cfg),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('Configuración guardada');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const connectTikTok = async () => {
    if (!storeId) return;
    setConnecting(true);
    try {
      const res = await fetch(`${API}/api/tiktok/${storeId}/auth-url`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (e) { showToast(e.message, 'error'); setConnecting(false); }
  };

  const disconnect = async () => {
    if (!storeId) return;
    if (!window.confirm('¿Desconectar la cuenta de TikTok?')) return;
    try {
      await fetch(`${API}/api/tiktok/${storeId}/disconnect`, {
        method:  'DELETE',
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
      const res = await fetch(`${API}/api/tiktok/${storeId}/preview?tpl=${tplIdx}`, {
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
    a.download = `tiktok-tpl${tplIdx + 1}-${selectedStore?.code || 'tienda'}.jpg`;
    a.click();
  };

  const postNow = async () => {
    if (!storeId) return;
    if (!window.confirm('¿Publicar ahora en TikTok?')) return;
    setPosting(true);
    try {
      const res = await fetch(`${API}/api/tiktok/${storeId}/post-now`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('¡Publicado en TikTok!');
      setLastStatus(prev => ({ ...prev, last_posted_at: new Date().toISOString(), last_error: null, template_counter: (prev?.template_counter || 0) + 1 }));
    } catch (e) { showToast(e.message, 'error'); }
    finally { setPosting(false); }
  };

  if (!selectedStore) {
    return (
      <div className="tt-page">
        <style>{CSS}</style>
        <div style={s.empty}>
          <TikTokIcon size={48} style={{ color: '#d1d5db', marginBottom: 14 }} />
          <p>Seleccioná una tienda para configurar TikTok.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tt-page">
      <style>{CSS}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, left: 16, zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : '#22c55e',
          color: '#fff', padding: '12px 16px', borderRadius: 12,
          fontWeight: 700, fontSize: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 8, maxWidth: 400, marginLeft: 'auto',
        }}>
          <FontAwesomeIcon icon={toast.type === 'error' ? faTimesCircle : faCheckCircle} />
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="tt-header">
        <div style={s.headerIcon}>
          <TikTokIcon size={26} style={{ color: '#fff' }} />
        </div>
        <div>
          <h1 className="tt-title">TikTok Auto-Post</h1>
          <p className="tt-subtitle">Publicá automáticamente — <strong>{selectedStore.name}</strong></p>
        </div>
      </div>

      <div className="tt-grid">
        {/* ── Left: Config ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Connect card */}
          <div style={s.card}>
            <h3 style={s.cardTitle}>Cuenta de TikTok</h3>

            {/* Credenciales de la app */}
            <div style={s.field}>
              <label style={s.label}>
                <FontAwesomeIcon icon={faKey} style={{ marginRight: 6, color: '#6b7280' }} />
                Client Key
              </label>
              <input
                value={cfg.client_key}
                onChange={e => setCfg(p => ({ ...p, client_key: e.target.value.trim() }))}
                placeholder="Ej: awxxxxxxxxxxxxxxxxxx"
                style={s.input}
                onFocus={e => e.target.style.borderColor = '#010101'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ ...s.field, marginBottom: 16 }}>
              <label style={s.label}>
                <FontAwesomeIcon icon={faKey} style={{ marginRight: 6, color: '#6b7280' }} />
                Client Secret
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={cfg.client_secret}
                  onChange={e => setCfg(p => ({ ...p, client_secret: e.target.value }))}
                  placeholder="Client Secret de tu app TikTok"
                  style={{ ...s.input, paddingRight: 44 }}
                  onFocus={e => e.target.style.borderColor = '#010101'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
                <button onClick={() => setShowSecret(p => !p)} style={s.eyeBtn}>
                  <FontAwesomeIcon icon={showSecret ? faEyeSlash : faEye} />
                </button>
              </div>
              <p style={s.hint}>Obtenés estas credenciales en <strong>developers.tiktok.com</strong> → tu app → Manage → Credenciales.</p>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 10, background: connected ? '#f0fdf4' : '#fef9f0', border: `1px solid ${connected ? '#bbf7d0' : '#fde68a'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FontAwesomeIcon icon={connected ? faCheckCircle : faTimesCircle} style={{ color: connected ? '#16a34a' : '#d97706', fontSize: 16 }} />
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: connected ? '#15803d' : '#92400e' }}>
                    {connected ? 'Cuenta conectada' : 'Cuenta no conectada'}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: connected ? '#166534' : '#78350f' }}>
                    {connected ? 'Listo para publicar en TikTok' : 'Conectá tu cuenta para publicar'}
                  </p>
                </div>
              </div>
              {connected ? (
                <button onClick={disconnect} style={{ background: 'none', border: '1px solid #fca5a5', color: '#ef4444', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <FontAwesomeIcon icon={faUnlink} /> Desconectar
                </button>
              ) : (
                <button onClick={connectTikTok} disabled={connecting} style={s.btnTikTok}>
                  {connecting ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faLink} />}
                  {connecting ? ' Redirigiendo...' : ' Conectar con TikTok'}
                </button>
              )}
            </div>

            {!cfg.client_key && (
              <div style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: 10, border: '1px solid #fde68a', marginTop: 4 }}>
                <p style={{ margin: 0, fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
                  ⚠️ Ingresá el <strong>Client Key</strong> y <strong>Client Secret</strong> de tu app TikTok y guardá antes de conectar.
                </p>
              </div>
            )}
            {cfg.client_key && !connected && (
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', marginTop: 4 }}>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                  Al hacer clic en "Conectar" serás redirigido a TikTok para autorizar la aplicación. Asegurate de agregar <strong>https://srservi2.srautomatic.com/api/tiktok/callback</strong> como URL de redirección en tu app de TikTok for Developers.
                </p>
              </div>
            )}
          </div>

          {/* Caption */}
          <div style={s.card}>
            <h3 style={s.cardTitle}>Caption personalizado <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span></h3>
            <textarea
              value={cfg.caption_template}
              onChange={e => setCfg(p => ({ ...p, caption_template: e.target.value }))}
              rows={4}
              placeholder={`✨ ${selectedStore.name} ✨\n\n🔥 Lo más pedido esta semana...\n\n📲 srservi2.srautomatic.com/store/${selectedStore.code}\n\n#${selectedStore.name?.replace(/\s+/g, '')} #SRServi #TikTok`}
              style={{ ...s.input, resize: 'vertical', height: 'auto' }}
            />
            <p style={s.hint}>Si lo dejás vacío se genera automáticamente con el nombre de la tienda y los productos.</p>
          </div>

          {/* Auto-post schedule */}
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ ...s.cardTitle, marginBottom: 4 }}>Publicación automática</h3>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                  {cfg.enabled
                    ? (() => {
                        const days  = (cfg.post_days || '0').split(',').map(Number);
                        const NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
                        const label = days.length === 7 ? 'todos los días' : days.map(d => NAMES[d]).join(', ');
                        return `Publica ${label} a las ${cfg.post_time || '10:00'}`;
                      })()
                    : 'Activá para programar publicaciones automáticas'}
                </p>
              </div>
              <button
                onClick={() => setCfg(p => ({ ...p, enabled: !p.enabled }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 36, color: cfg.enabled ? '#22c55e' : '#d1d5db', flexShrink: 0 }}
              >
                <FontAwesomeIcon icon={cfg.enabled ? faToggleOn : faToggleOff} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                <FontAwesomeIcon icon={faClock} style={{ marginRight: 6 }} />
                Hora de publicación
              </label>
              <input
                type="time"
                value={cfg.post_time || '10:00'}
                onChange={e => setCfg(p => ({ ...p, post_time: e.target.value }))}
                style={{ padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontSize: 15, fontWeight: 700, outline: 'none', cursor: 'pointer', width: 140 }}
                onFocus={e => e.target.style.borderColor = '#010101'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Días de publicación
                </label>
                <button
                  onClick={() => {
                    const all = '0,1,2,3,4,5,6';
                    setCfg(p => ({ ...p, post_days: (p.post_days || '') === all ? '0' : all }));
                  }}
                  style={{ fontSize: 11, fontWeight: 700, color: (cfg.post_days || '') === '0,1,2,3,4,5,6' ? '#010101' : '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {(cfg.post_days || '') === '0,1,2,3,4,5,6' ? '✓ Todos los días' : 'Todos los días'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[['Dom',0],['Lun',1],['Mar',2],['Mié',3],['Jue',4],['Vie',5],['Sáb',6]].map(([label, num]) => {
                  const days   = (cfg.post_days || '0').split(',').map(Number);
                  const active = days.includes(num);
                  return (
                    <button key={num}
                      onClick={() => {
                        const cur  = (cfg.post_days || '0').split(',').map(Number).filter(n => n !== 99);
                        const next = active ? cur.filter(d => d !== num) : [...cur, num].sort((a,b) => a - b);
                        setCfg(p => ({ ...p, post_days: (next.length ? next : [0]).join(',') }));
                      }}
                      style={{ padding: '7px 12px', borderRadius: 8, border: `2px solid ${active ? '#010101' : '#e5e7eb'}`, background: active ? '#f1f5f9' : '#fff', fontWeight: 700, fontSize: 12, color: active ? '#010101' : '#6b7280', cursor: 'pointer', transition: 'all 0.15s' }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {cfg.enabled && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                <p style={{ margin: 0, fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
                  ✅ Activo — rotando entre las 6 plantillas automáticamente.
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
                <div style={s.statusRow}>
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

          <button onClick={postNow} disabled={posting || !connected} style={{ ...s.btnTikTok, opacity: (!connected || posting) ? 0.5 : 1, width: '100%', justifyContent: 'center', padding: '12px' }}>
            {posting ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlay} />}
            {posting ? ' Publicando...' : ' Publicar ahora en TikTok'}
          </button>
          {!connected && (
            <p style={{ textAlign: 'center', fontSize: 12, color: '#d97706', margin: '-4px 0 0', fontWeight: 600 }}>
              Conectá tu cuenta TikTok para poder publicar
            </p>
          )}
        </div>

        {/* ── Right: Templates preview ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={s.card}>
            <h3 style={s.cardTitle}>Plantillas disponibles</h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
              Las mismas 6 plantillas de Instagram, optimizadas para TikTok. Rotan cada publicación.
            </p>

            {TEMPLATES.map(tpl => (
              <div key={tpl.id} style={{
                border: `2px solid ${nextTpl === tpl.id ? tpl.color : '#e5e7eb'}`,
                borderRadius: 14,
                marginBottom: 14,
                overflow: 'hidden',
                background: nextTpl === tpl.id ? `${tpl.color}08` : '#fff',
              }}>
                <div className="tt-tpl-header">
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
                  <div className="tt-tpl-actions">
                    {previews[tpl.id] && (
                      <button onClick={() => downloadPreview(tpl.id)} style={s.btnSmall}>
                        <FontAwesomeIcon icon={faDownload} />
                      </button>
                    )}
                    <button onClick={() => loadPreview(tpl.id)} disabled={previewing === tpl.id} style={{ ...s.btnSmallPrimary, background: tpl.color }}>
                      {previewing === tpl.id ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faEye} />}
                      {previewing === tpl.id ? ' ...' : ' Ver'}
                    </button>
                  </div>
                </div>

                {previews[tpl.id] && (
                  <img src={previews[tpl.id]} alt={`Preview ${tpl.name}`} style={{ width: '100%', display: 'block' }} />
                )}
                {!previews[tpl.id] && (
                  <div style={{ background: '#f8fafc', padding: '20px', textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Hacé clic en "Ver" para previsualizar</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ ...s.card, background: '#fafafa', border: '1px solid #e5e7eb' }}>
            <h3 style={{ ...s.cardTitle, color: '#374151' }}>¿Cómo funciona?</h3>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'Imagen 1080×1080 con tus productos y precios, publicada como foto en TikTok.',
                '6 plantillas rotativas: las mismas que Instagram.',
                'Requiere una app registrada en TikTok for Developers.',
                'El token OAuth se guarda de forma segura en el servidor.',
                'Podés publicar manualmente en cualquier momento.',
                'La programación automática sigue el mismo horario configurable.',
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
  headerIcon:      { width: 48, height: 48, borderRadius: 14, background: '#010101', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  card:            { background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb' },
  cardTitle:       { fontSize: 14, fontWeight: 700, color: '#374151', marginTop: 0, marginBottom: 14 },
  field:           { marginBottom: 14 },
  label:           { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input:           { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  hint:            { fontSize: 11, color: '#9ca3af', margin: '5px 0 0' },
  eyeBtn:          { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 },
  statusRow:       { display: 'flex', alignItems: 'flex-start', gap: 8 },
  btnPrimary:      { width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: '#1e293b', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnTikTok:       { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#010101', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' },
  btnSmall:        { padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnSmallPrimary: { padding: '7px 12px', borderRadius: 8, border: 'none', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 },
  empty:           { textAlign: 'center', padding: '60px 24px', color: '#6b7280', fontSize: 15 },
};
