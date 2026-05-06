import { useState, useEffect, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faInstagram, faSave, faPlay, faEye, faEyeSlash,
  faCheckCircle, faTimesCircle, faSpinner, faDownload,
  faToggleOn, faToggleOff, faClock, faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import { faInstagram as fabInstagram } from '@fortawesome/free-brands-svg-icons';

const API = 'https://srservi2.srautomatic.com';

export default function InstagramAuto() {
  const { token } = useAuth();
  const { selectedStore } = useContext(StoreContext);

  const [cfg, setCfg]           = useState({ ig_username: '', ig_password: '', caption_template: '', enabled: false });
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [posting, setPosting]   = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [lastStatus, setLastStatus] = useState(null);
  const [toast, setToast]       = useState(null);

  const storeId = selectedStore?.id;

  useEffect(() => {
    if (!storeId || !token) return;
    setLoading(true);
    setPreviewUrl(null);
    fetch(`${API}/api/instagram/${storeId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setCfg({ ig_username: d.ig_username || '', ig_password: d.ig_password || '', caption_template: d.caption_template || '', enabled: !!d.enabled });
        setLastStatus({ last_posted_at: d.last_posted_at, last_error: d.last_error, template_counter: d.template_counter });
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

  const loadPreview = async () => {
    if (!storeId) return;
    setPreviewing(true);
    setPreviewUrl(null);
    try {
      const res = await fetch(`${API}/api/instagram/${storeId}/preview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error generando imagen');
      const blob = await res.blob();
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) { showToast(e.message, 'error'); }
    finally { setPreviewing(false); }
  };

  const downloadPreview = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `instagram-promo-${selectedStore?.code || 'tienda'}.jpg`;
    a.click();
  };

  const postNow = async () => {
    if (!storeId) return;
    if (!cfg.ig_username || (!cfg.ig_password || cfg.ig_password === '')) {
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
      setLastStatus(prev => ({ ...prev, last_posted_at: new Date().toISOString(), last_error: null }));
    } catch (e) { showToast(e.message, 'error'); }
    finally { setPosting(false); }
  };

  if (!selectedStore) {
    return (
      <div style={s.page}>
        <div style={s.empty}>
          <FontAwesomeIcon icon={faInstagram} style={{ fontSize: 48, color: '#d1d5db', marginBottom: 14 }} />
          <p>Selecciona una tienda para configurar Instagram.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : '#22c55e',
          color: '#fff', padding: '12px 20px', borderRadius: 12,
          fontWeight: 700, fontSize: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <FontAwesomeIcon icon={toast.type === 'error' ? faTimesCircle : faCheckCircle} />
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerIcon}>
          <FontAwesomeIcon icon={faInstagram} style={{ fontSize: 28, background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }} />
        </div>
        <div>
          <h1 style={s.title}>Instagram Auto-Post</h1>
          <p style={s.subtitle}>Publicá automáticamente cada semana con tus productos y promociones — <strong>{selectedStore.name}</strong></p>
        </div>
      </div>

      <div style={s.grid}>
        {/* Left: Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Credentials card */}
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
              <p style={s.hint}>
                Usá una cuenta de Instagram Business. La contraseña se guarda cifrada en el servidor.
              </p>
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
                  ✅ Activo — se publicará automáticamente cada semana con una plantilla diferente.
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
                {lastStatus.last_error && (
                  <div style={{ ...s.statusRow, background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>
                    <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#ef4444', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#dc2626' }}>{lastStatus.last_error}</span>
                  </div>
                )}
                <div style={s.statusRow}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>
                    Plantilla actual: #{(lastStatus.template_counter || 0) % 3 + 1} de 3
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Save button */}
          <button onClick={save} disabled={saving || loading} style={s.btnPrimary}>
            {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
            {saving ? ' Guardando...' : ' Guardar configuración'}
          </button>

          {/* Post now */}
          <button onClick={postNow} disabled={posting || !cfg.ig_username} style={s.btnInstagram}>
            {posting ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlay} />}
            {posting ? ' Publicando...' : ' Publicar ahora'}
          </button>
        </div>

        {/* Right: Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ ...s.cardTitle, marginBottom: 0 }}>Vista previa de imagen</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {previewUrl && (
                  <button onClick={downloadPreview} style={s.btnSmall}>
                    <FontAwesomeIcon icon={faDownload} /> Descargar
                  </button>
                )}
                <button onClick={loadPreview} disabled={previewing} style={s.btnSmallPrimary}>
                  {previewing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faEye} />}
                  {previewing ? ' Generando...' : ' Previsualizar'}
                </button>
              </div>
            </div>

            {previewUrl ? (
              <img src={previewUrl} alt="Preview" style={{ width: '100%', borderRadius: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }} />
            ) : (
              <div style={{ background: '#f8fafc', borderRadius: 14, aspectRatio: '1/1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, border: '2px dashed #e2e8f0' }}>
                <FontAwesomeIcon icon={faInstagram} style={{ fontSize: 48, color: '#cbd5e1' }} />
                <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>Haz clic en "Previsualizar" para generar la imagen</p>
              </div>
            )}
          </div>

          {/* Info card */}
          <div style={{ ...s.card, background: '#fafafa', border: '1px solid #e5e7eb' }}>
            <h3 style={{ ...s.cardTitle, color: '#374151' }}>¿Cómo funciona?</h3>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'Se genera una imagen 1080×1080 con tus productos más vendidos y precios.',
                '3 plantillas rotativas: Productos / Promociones / Mix — cada semana una diferente.',
                'Si tenés cupones activos, aparecen automáticamente en la imagen.',
                'Con la publicación automática, se publica cada domingo a las 10:00 AM.',
                'Podés publicar manualmente en cualquier momento con "Publicar ahora".',
                'Requiere cuenta de Instagram Business o Creator.',
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
  page: { padding: '28px 24px', maxWidth: 1100, margin: '0 auto', fontFamily: 'system-ui,-apple-system,sans-serif' },
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 },
  headerIcon: { width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 },
  subtitle: { fontSize: 14, color: '#6b7280', margin: 0 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' },
  card: { background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#374151', marginTop: 0, marginBottom: 16 },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' },
  hint: { fontSize: 11, color: '#9ca3af', margin: '6px 0 0' },
  eyeBtn: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 },
  statusRow: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  btnPrimary: { width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: '#1e293b', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnInstagram: { width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnSmall: { padding: '7px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  btnSmallPrimary: { padding: '7px 14px', borderRadius: 8, border: 'none', background: '#1e293b', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  empty: { textAlign: 'center', padding: '60px 24px', color: '#6b7280', fontSize: 15 },
};
