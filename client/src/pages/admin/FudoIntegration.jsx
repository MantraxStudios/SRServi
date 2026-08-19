import { useState, useEffect, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSave, faSync, faSpinner, faCheckCircle, faTimesCircle,
  faExclamationTriangle, faEye, faEyeSlash, faToggleOn, faToggleOff,
  faDownload, faCopy, faBell,
} from '@fortawesome/free-solid-svg-icons';

export default function FudoIntegration() {
  const { token } = useAuth();
  const { selectedStore } = useContext(StoreContext);
  const storeId = selectedStore?.id;

  const [cfg, setCfg]         = useState({ api_key: '', api_secret: '', enabled: false, last_sync_at: null, last_sync_status: null, last_error: null });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [toast, setToast]     = useState(null);

  useEffect(() => {
    if (!storeId || !token) return;
    setLoading(true);
    fetch(`/api/fudo/${storeId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setCfg(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storeId, token]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  const save = async () => {
    if (!storeId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/fudo/${storeId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: cfg.api_key, api_secret: cfg.api_secret, enabled: cfg.enabled }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('Configuración guardada');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const testConnection = async () => {
    if (!storeId) return;
    setTesting(true);
    try {
      const res = await fetch(`/api/fudo/${storeId}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: cfg.api_key, api_secret: cfg.api_secret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('Conexión con Fudo exitosa ✓');
    } catch (e) { showToast(e.message, 'error'); }
    finally { setTesting(false); }
  };

  const sync = async () => {
    if (!storeId) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/fudo/${storeId}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.summary ? `Sincronizado con Fudo: ${data.summary}` : 'Productos sincronizados con Fudo');
      setCfg(p => ({ ...p, last_sync_at: new Date().toISOString(), last_sync_status: data.failed ? 'error' : 'ok', last_error: data.failed ? (data.errors?.[0] || null) : null }));
    } catch (e) {
      showToast(e.message, 'error');
      setCfg(p => ({ ...p, last_sync_at: new Date().toISOString(), last_sync_status: 'error', last_error: e.message }));
    } finally { setSyncing(false); }
  };

  const copyWebhook = async () => {
    if (!cfg.webhook_url) return;
    try {
      await navigator.clipboard.writeText(cfg.webhook_url);
      showToast('URL del webhook copiada');
    } catch { showToast('No se pudo copiar', 'error'); }
  };

  const importFromFudo = async () => {
    if (!storeId) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/fudo/${storeId}/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.summary ? `Importado desde Fudo: ${data.summary}` : 'Catálogo importado desde Fudo');
    } catch (e) {
      showToast(e.message, 'error');
    } finally { setImporting(false); }
  };

  if (!selectedStore) {
    return (
      <div style={s.page}>
        <div style={s.empty}>Selecciona una tienda para configurar la integración con Fudo.</div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, left: 16, zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : '#22c55e',
          color: '#fff', padding: '12px 16px', borderRadius: 12,
          fontWeight: 700, fontSize: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 8,
          maxWidth: 460, marginLeft: 'auto',
        }}>
          <FontAwesomeIcon icon={toast.type === 'error' ? faTimesCircle : faCheckCircle} />
          {toast.msg}
        </div>
      )}

      <div style={s.header}>
        <h1 style={s.title}>Integración con Fudo</h1>
        <p style={s.subtitle}>Sincronizá tu catálogo y recibí en SRServi los pedidos de Fudo — <strong>{selectedStore.name}</strong></p>
      </div>

      <div style={{ ...s.card, background: '#fffbee', border: '1px solid #f5deb3', marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#7a5c00', lineHeight: 1.6 }}>
          <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: 6 }} />
          Esta integración requiere que tu cuenta de <strong>Fudo</strong> tenga habilitada la <strong>API de propósito general</strong> (la activa el soporte de Fudo a pedido).
          Luego generá una <strong>API Key</strong> y un <strong>API Secret</strong> desde Fudo → Administración → Usuarios → API.
        </p>
      </div>

      <div style={s.card}>
        <h3 style={s.cardTitle}>Credenciales de Fudo</h3>
        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>API Key</label>
          <input
            type="text"
            value={cfg.api_key}
            onChange={e => setCfg(p => ({ ...p, api_key: e.target.value }))}
            placeholder="Pegá acá la API Key generada en Fudo"
            style={s.input}
            autoComplete="off"
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>API Secret</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showSecret ? 'text' : 'password'}
              value={cfg.api_secret}
              onChange={e => setCfg(p => ({ ...p, api_secret: e.target.value }))}
              placeholder="Pegá acá el API Secret generado en Fudo"
              style={{ ...s.input, paddingRight: 42 }}
              autoComplete="off"
            />
            <button onClick={() => setShowSecret(p => !p)} style={s.eyeBtn}>
              <FontAwesomeIcon icon={showSecret ? faEyeSlash : faEye} />
            </button>
          </div>
        </div>

        <button
          onClick={testConnection}
          disabled={testing || !cfg.api_key || !cfg.api_secret}
          style={{ ...s.btnPrimary, background: '#0ea5e9', marginBottom: 12, opacity: (!cfg.api_key || !cfg.api_secret || testing) ? 0.5 : 1 }}
        >
          {testing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCheckCircle} />}
          {testing ? ' Probando...' : ' Probar conexión'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#374151' }}>Sincronización activa</p>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Activá para habilitar la sincronización de productos</p>
          </div>
          <button
            onClick={() => setCfg(p => ({ ...p, enabled: !p.enabled }))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 32, color: cfg.enabled ? '#22c55e' : '#d1d5db' }}
          >
            <FontAwesomeIcon icon={cfg.enabled ? faToggleOn : faToggleOff} />
          </button>
        </div>

        <button onClick={save} disabled={saving || loading} style={s.btnPrimary}>
          {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
          {saving ? ' Guardando...' : ' Guardar configuración'}
        </button>
      </div>

      <div style={{ ...s.card, marginTop: 16 }}>
        <h3 style={s.cardTitle}>
          <FontAwesomeIcon icon={faBell} style={{ marginRight: 6, color: '#f59e0b' }} />
          Recibir pedidos de Fudo
        </h3>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px', lineHeight: 1.6 }}>
          Para que las ventas hechas en Fudo aparezcan automáticamente en el panel de SRServi,
          configurá este <strong>webhook</strong> en Fudo (Administración → Integraciones/Webhooks)
          apuntando a la URL de abajo. Debés tener la <strong>Sincronización activa</strong> encendida.
        </p>

        {cfg.enabled ? (
          <>
            <label style={s.label}>URL del webhook (pegala en Fudo)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly value={cfg.webhook_url || 'Guardá la configuración para generar la URL'} style={{ ...s.input, fontSize: 12, background: '#f9fafb' }} onFocus={e => e.target.select()} />
              <button onClick={copyWebhook} disabled={!cfg.webhook_url} style={{ ...s.btnPrimary, width: 'auto', padding: '10px 14px', background: '#0ea5e9', flexShrink: 0, opacity: cfg.webhook_url ? 1 : 0.5 }}>
                <FontAwesomeIcon icon={faCopy} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 0', lineHeight: 1.5 }}>
              Las ventas entran como <strong>pagadas</strong> y se muestran en vivo en el panel del local.
              El secreto ya viene incluido en la URL: no lo compartas.
            </p>
          </>
        ) : (
          <p style={{ fontSize: 13, color: '#d97706', margin: 0, fontWeight: 600 }}>
            Activá la <strong>Sincronización activa</strong> y guardá para obtener la URL del webhook.
          </p>
        )}
      </div>

      <div style={{ ...s.card, marginTop: 16 }}>
        <h3 style={s.cardTitle}>Sincronización de productos</h3>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>
          Envía tu catálogo de productos de SRServi a Fudo.
        </p>

        {cfg.last_sync_at && (
          <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 14, background: cfg.last_sync_status === 'ok' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${cfg.last_sync_status === 'ok' ? '#bbf7d0' : '#fecaca'}` }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: cfg.last_sync_status === 'ok' ? '#15803d' : '#dc2626' }}>
              <FontAwesomeIcon icon={cfg.last_sync_status === 'ok' ? faCheckCircle : faTimesCircle} /> Última sincronización: {new Date(cfg.last_sync_at).toLocaleString('es-CL')}
            </p>
            {cfg.last_error && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#dc2626' }}>{cfg.last_error}</p>}
          </div>
        )}

        <button onClick={sync} disabled={syncing || !cfg.api_key || !cfg.api_secret} style={{ ...s.btnPrimary, background: '#1e293b', opacity: (!cfg.api_key || !cfg.api_secret || syncing) ? 0.5 : 1 }}>
          {syncing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSync} />}
          {syncing ? ' Sincronizando...' : ' Sincronizar ahora'}
        </button>
        {(!cfg.api_key || !cfg.api_secret) && (
          <p style={{ textAlign: 'center', fontSize: 12, color: '#d97706', margin: '8px 0 0', fontWeight: 600 }}>
            Guardá tu API Key y API Secret para poder sincronizar
          </p>
        )}
      </div>

      <div style={{ ...s.card, marginTop: 16 }}>
        <h3 style={s.cardTitle}>Importar catálogo desde Fudo</h3>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>
          Trae tus productos de Fudo a SRServi. Crea los que falten (por nombre) junto con sus categorías; no duplica los que ya tenés.
        </p>

        <button onClick={importFromFudo} disabled={importing || !cfg.api_key || !cfg.api_secret} style={{ ...s.btnPrimary, background: '#7c3aed', opacity: (!cfg.api_key || !cfg.api_secret || importing) ? 0.5 : 1 }}>
          {importing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faDownload} />}
          {importing ? ' Importando...' : ' Importar de Fudo'}
        </button>
        {(!cfg.api_key || !cfg.api_secret) && (
          <p style={{ textAlign: 'center', fontSize: 12, color: '#d97706', margin: '8px 0 0', fontWeight: 600 }}>
            Guardá tu API Key y API Secret para poder importar
          </p>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { padding: '20px 16px', maxWidth: 640, margin: '0 auto', fontFamily: 'system-ui,-apple-system,sans-serif' },
  header: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 800, color: '#1e293b', margin: '0 0 4px' },
  subtitle: { fontSize: 13, color: '#6b7280', margin: 0 },
  card: { background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb' },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#374151', marginTop: 0, marginBottom: 14 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  eyeBtn: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 },
  btnPrimary: { width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: '#D4AF37', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  empty: { textAlign: 'center', padding: '60px 24px', color: '#6b7280', fontSize: 15 },
};
