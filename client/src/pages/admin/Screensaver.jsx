import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTv, faSave, faTrash, faUpload, faToggleOn, faToggleOff,
  faCrown, faSpinner, faEye, faImage, faTimes
} from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#D4AF37';

const TIMEOUT_OPTIONS = [
  { label: '30 segundos', value: 30 },
  { label: '1 minuto', value: 60 },
  { label: '2 minutos', value: 120 },
  { label: '5 minutos', value: 300 },
  { label: '10 minutos', value: 600 },
  { label: '15 minutos', value: 900 },
];

export default function Screensaver() {
  const { token } = useAuth();
  const { selectedStore } = useStore() || {};

  const [isPremium, setIsPremium] = useState(false);
  const [planLoading, setPlanLoading] = useState(true);

  const [enabled, setEnabled] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [timeoutSeconds, setTimeoutSeconds] = useState(60);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState(null);

  // Check premium
  useEffect(() => {
    if (!token) return;
    setPlanLoading(true);
    fetch(API + '/api/my-plan', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => {
        const planName = data?.plan?.plan_name || data?.plan?.name || '';
        setIsPremium(!!planName && planName !== 'Gratis');
      })
      .catch(() => {})
      .finally(() => setPlanLoading(false));
  }, [token]);

  // Load config
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(API + '/api/screensaver/config', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        setEnabled(!!data.enabled);
        setMediaUrl(data.media_url || null);
        setTimeoutSeconds(data.timeout_seconds || 60);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
  };

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const fd = new FormData();
      fd.append('enabled', enabled ? 'true' : 'false');
      fd.append('timeout_seconds', timeoutSeconds);
      if (pendingFile) fd.append('media', pendingFile);
      else if (mediaUrl) fd.append('media_url', mediaUrl);
      const res = await fetch(API + '/api/screensaver/config', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        setMediaUrl(data.media_url || null);
        setPendingFile(null);
        setPendingPreviewUrl(null);
        setMsg('✔ Configuración guardada');
        setTimeout(() => setMsg(''), 3000);
      } else {
        const d = await res.json();
        setMsg('Error: ' + (d.error || 'intenta de nuevo'));
      }
    } catch { setMsg('Error de conexión'); }
    finally { setSaving(false); }
  };

  const deleteMedia = async () => {
    if (!confirm('¿Eliminar imagen/gif personalizado?')) return;
    setDeleting(true);
    try {
      await fetch(API + '/api/screensaver/media', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      });
      setMediaUrl(null);
      setPendingFile(null);
      setPendingPreviewUrl(null);
      setMsg('Imagen eliminada');
      setTimeout(() => setMsg(''), 2500);
    } catch { setMsg('Error al eliminar'); }
    finally { setDeleting(false); }
  };

  const displayMedia = pendingPreviewUrl || (mediaUrl ? API + mediaUrl : null);
  const storeLogo = selectedStore?.logo_url ? API + selectedStore.logo_url : null;

  if (planLoading || loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
        <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '24px' }} />
      </div>
    );
  }

  return (
    <>
      <header className="admin-header">
        <h1><FontAwesomeIcon icon={faTv} style={{ marginRight: '10px' }} />Salva Pantallas</h1>
      </header>

      <div className="admin-main">

        {/* Premium gate */}
        {!isPremium && (
          <div style={{
            background: 'linear-gradient(135deg, #000 60%, #1a1400)',
            border: '2px solid ' + GOLD,
            borderRadius: '16px',
            padding: '32px 24px',
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '44px', marginBottom: '10px' }}>✨</div>
            <FontAwesomeIcon icon={faCrown} style={{ color: GOLD, fontSize: '28px', marginBottom: '12px', display: 'block' }} />
            <h2 style={{ color: GOLD, margin: '0 0 8px', fontSize: '20px', fontWeight: '900' }}>
              Función Premium
            </h2>
            <p style={{ color: '#ccc', fontSize: '13px', margin: '0 0 20px', lineHeight: 1.6 }}>
              El salva pantallas personalizado está disponible solo para cuentas Premium.<br />
              Actualiza tu plan para activarlo en todas tus tiendas.
            </p>
            <a href="/admin/plans" style={{
              display: 'inline-block', padding: '12px 28px',
              background: GOLD, color: '#000', fontWeight: '900',
              borderRadius: '10px', textDecoration: 'none', fontSize: '14px'
            }}>
              Ver planes
            </a>
          </div>
        )}

        {/* Config panel */}
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: '14px', overflow: 'hidden',
          opacity: isPremium ? 1 : 0.4,
          pointerEvents: isPremium ? 'auto' : 'none'
        }}>
          {/* Header */}
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', background: '#000', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
              📺
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#111' }}>Configuración del salva pantallas</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Se activa en todas las tiendas de tu cuenta</p>
            </div>
          </div>

          <div style={{ padding: '22px' }}>

            {/* Enable toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#f9fafb', borderRadius: '10px', marginBottom: '20px', cursor: 'pointer' }} onClick={() => setEnabled(v => !v)}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#111' }}>Activar salva pantallas</div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                  {enabled ? 'Activo — aparece en todas tus tiendas' : 'Inactivo — no se mostrará'}
                </div>
              </div>
              <FontAwesomeIcon
                icon={enabled ? faToggleOn : faToggleOff}
                style={{ fontSize: '32px', color: enabled ? '#22c55e' : '#d1d5db' }}
              />
            </div>

            {/* Timeout */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#555', display: 'block', marginBottom: '6px' }}>
                Tiempo de inactividad para activarse
              </label>
              <select
                value={timeoutSeconds}
                onChange={e => setTimeoutSeconds(Number(e.target.value))}
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', background: '#fff' }}
              >
                {TIMEOUT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Media upload */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#555', display: 'block', marginBottom: '6px' }}>
                Imagen o GIF personalizado <span style={{ fontWeight: '400', color: '#aaa' }}>(opcional — si no hay, se muestra el logo de la tienda)</span>
              </label>

              {displayMedia ? (
                <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                  <img
                    src={displayMedia}
                    alt="Preview"
                    style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '10px', border: '2px solid #e5e7eb', display: 'block' }}
                  />
                  <button
                    onClick={() => {
                      if (pendingFile) { setPendingFile(null); setPendingPreviewUrl(null); }
                      else deleteMedia();
                    }}
                    disabled={deleting}
                    style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}
                    title="Eliminar imagen"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{ border: '2px dashed #d1d5db', borderRadius: '10px', padding: '28px', textAlign: 'center', cursor: 'pointer', background: '#fafafa', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = GOLD}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#d1d5db'}
                >
                  <FontAwesomeIcon icon={faImage} style={{ fontSize: '28px', color: '#d1d5db', marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#555' }}>Haz clic para subir imagen o GIF</div>
                  <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>JPG, PNG, WEBP, GIF — máx. 10MB</div>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {displayMedia && (
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ marginTop: '8px', background: 'none', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer', color: '#555', fontWeight: '600' }}
                >
                  <FontAwesomeIcon icon={faUpload} style={{ marginRight: '5px' }} />
                  Cambiar imagen
                </button>
              )}
            </div>

            {/* Preview hint */}
            {!displayMedia && storeLogo && (
              <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#92400e', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>ℹ️</span>
                <span>Sin imagen personalizada se mostrará el <strong>logo de la tienda</strong> con su nombre.</span>
              </div>
            )}

            {msg && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', marginBottom: '14px', background: msg.includes('Error') ? '#fef2f2' : '#f0fdf4', color: msg.includes('Error') ? '#dc2626' : '#16a34a' }}>
                {msg}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={save}
                disabled={saving}
                style={{ padding: '11px 24px', background: saving ? '#ccc' : '#000', color: GOLD, border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '800', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}
              >
                <FontAwesomeIcon icon={saving ? faSpinner : faSave} spin={saving} />
                {saving ? 'Guardando...' : 'Guardar configuración'}
              </button>

              <button
                onClick={() => setPreview(true)}
                style={{ padding: '11px 20px', background: '#f3f4f6', color: '#111', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}
              >
                <FontAwesomeIcon icon={faEye} />
                Previsualizar
              </button>
            </div>
          </div>
        </div>

        {/* Info box */}
        <div style={{ marginTop: '16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px 16px', fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>
          <strong style={{ color: '#374151' }}>¿Cómo funciona?</strong><br />
          El salva pantallas aparece automáticamente en el totem/kiosco de cada tienda luego del tiempo de inactividad configurado.
          Al tocar o hacer clic en la pantalla, desaparece y el cliente puede seguir usando la tienda normalmente.
        </div>
      </div>

      {/* Preview overlay */}
      {preview && (
        <ScreensaverPreview
          mediaUrl={displayMedia}
          storeName={selectedStore?.name || 'Mi Tienda'}
          storeLogo={storeLogo}
          onClose={() => setPreview(false)}
        />
      )}
    </>
  );
}

function ScreensaverPreview({ mediaUrl, storeName, storeLogo, onClose }) {
  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, background: '#000', cursor: 'pointer' }}
      onClick={onClose}
    >
      <div style={{ position: 'absolute', top: '14px', right: '14px', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', color: '#fff', fontWeight: '700' }}>
        Toca para cerrar vista previa
      </div>
      <ScreensaverContent mediaUrl={mediaUrl} storeName={storeName} storeLogo={storeLogo} />
    </div>
  );
}

export function ScreensaverContent({ mediaUrl, storeName, storeLogo }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', background: '#000' }}>
      {mediaUrl ? (
        <img
          src={mediaUrl}
          alt="Salva pantallas"
          style={{ maxWidth: '80vw', maxHeight: '70vh', objectFit: 'contain', borderRadius: '12px' }}
        />
      ) : (
        <>
          {storeLogo && (
            <img
              src={storeLogo}
              alt={storeName}
              style={{ maxWidth: '260px', maxHeight: '260px', objectFit: 'contain', animation: 'ss-float 4s ease-in-out infinite' }}
            />
          )}
          <div style={{ fontSize: 'clamp(24px, 5vw, 48px)', fontWeight: '900', color: '#fff', letterSpacing: '-1px', textAlign: 'center', textShadow: '0 2px 20px rgba(212,175,55,0.4)' }}>
            {storeName}
          </div>
          {!storeLogo && (
            <div style={{ fontSize: '72px' }}>🏪</div>
          )}
        </>
      )}
      <style>{`
        @keyframes ss-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
    </div>
  );
}
