import { useState, useEffect, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faCheck, faMotorcycle, faToggleOn, faToggleOff, faSave, faShoppingBag } from '@fortawesome/free-solid-svg-icons';
import { QRCodeCanvas } from 'qrcode.react';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

const STATUS_COLORS = {
  preparing: '#f59e0b',
  pending:   '#6b7280',
  ready:     '#3b82f6',
  completed: '#22c55e',
};
const STATUS_LABELS = {
  preparing: 'En preparación',
  pending:   'Pendiente',
  ready:     'Listo',
  completed: 'Completado',
};

export default function RappiIntegration() {
  const { token } = useAuth();
  const { selectedStore } = useContext(StoreContext);

  const [config, setConfig]           = useState({ is_enabled: true, webhook_secret: '' });
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveOk, setSaveOk]           = useState(false);
  const [copied, setCopied]           = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const storeCode  = selectedStore?.code || '';
  const webhookUrl = storeCode ? `${BASE_URL}/api/rappi/webhook/${storeCode}` : '';

  useEffect(() => {
    if (!selectedStore?.id || !token) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/rappi/config?store_id=${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`/api/rappi/orders?store_id=${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([cfgData, ordData]) => {
      if (cfgData.config) {
        setConfig({ is_enabled: !!cfgData.config.is_enabled, webhook_secret: cfgData.config.webhook_secret || '' });
      }
      setOrders(ordData.orders || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedStore?.id, token]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/rappi/config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStore.id, ...config }),
      });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch {
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const copy = (text, setCopiedFn) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedFn(true);
      setTimeout(() => setCopiedFn(false), 2000);
    });
  };

  const generateSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
    setConfig(c => ({ ...c, webhook_secret: s }));
  };

  if (!selectedStore) return (
    <div style={styles.page}>
      <div style={styles.empty}>
        <FontAwesomeIcon icon={faMotorcycle} style={{ fontSize: 40, color: '#d1d5db', marginBottom: 12 }} />
        <p>Selecciona una tienda para configurar Rappi.</p>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>
        <span style={{ marginRight: 10 }}>🛵</span>
        Integración Rappi — {selectedStore.name}
      </h1>

      <div style={styles.grid}>
        {/* ── Config card ── */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Configuración</h3>

          {/* Enable toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '12px 14px', background: config.is_enabled ? '#f0fdf4' : '#fafafa', borderRadius: 10, border: `1px solid ${config.is_enabled ? '#86efac' : '#e5e7eb'}` }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Recepción de pedidos</p>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                {config.is_enabled ? 'Activa — recibiendo pedidos de Rappi' : 'Inactiva — webhook deshabilitado'}
              </p>
            </div>
            <button onClick={() => setConfig(c => ({ ...c, is_enabled: !c.is_enabled }))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 28, color: config.is_enabled ? '#22c55e' : '#d1d5db' }}>
              <FontAwesomeIcon icon={config.is_enabled ? faToggleOn : faToggleOff} />
            </button>
          </div>

          {/* Webhook URL */}
          <div style={{ marginBottom: 16 }}>
            <label style={styles.label}>URL del Webhook</label>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>
              Configura esta URL en el panel de Rappi Partners como endpoint de órdenes.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                readOnly
                value={webhookUrl}
                style={{ ...styles.input, flex: 1, background: '#f8fafc', color: '#374151', fontSize: 12 }}
              />
              <button onClick={() => copy(webhookUrl, setCopied)} style={styles.copyBtn}>
                <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
                {copied ? ' Copiado' : ' Copiar'}
              </button>
            </div>
          </div>

          {/* QR del webhook */}
          {webhookUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px', background: '#f8fafc', borderRadius: 10, marginBottom: 16 }}>
              <QRCodeCanvas value={webhookUrl} size={120} level="M" />
              <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>QR de la URL del webhook</p>
            </div>
          )}

          {/* Webhook secret */}
          <div style={{ marginBottom: 20 }}>
            <label style={styles.label}>Token secreto (opcional)</label>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>
              Si Rappi envía un header <code>x-rappi-signature</code>, ponlo aquí para verificar autenticidad.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={config.webhook_secret}
                onChange={e => setConfig(c => ({ ...c, webhook_secret: e.target.value }))}
                placeholder="Token secreto..."
                style={{ ...styles.input, flex: 1, fontFamily: 'monospace', fontSize: 12 }}
              />
              <button onClick={generateSecret} style={{ ...styles.copyBtn, background: '#1e293b', color: '#fff', border: 'none' }}>
                Generar
              </button>
              {config.webhook_secret && (
                <button onClick={() => copy(config.webhook_secret, setCopiedSecret)} style={styles.copyBtn}>
                  <FontAwesomeIcon icon={copiedSecret ? faCheck : faCopy} />
                </button>
              )}
            </div>
          </div>

          <button onClick={save} disabled={saving}
            style={{
              width: '100%', padding: '13px', borderRadius: 12, border: 'none',
              background: saveOk ? '#22c55e' : '#1e293b', color: '#fff',
              fontWeight: 800, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s',
            }}>
            <FontAwesomeIcon icon={saveOk ? faCheck : faSave} />
            {saving ? 'Guardando...' : saveOk ? 'Guardado' : 'Guardar configuración'}
          </button>
        </div>

        {/* ── How-to card ── */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>¿Cómo configurar?</h3>
          <ol style={{ paddingLeft: 18, color: '#374151', fontSize: 14, lineHeight: 1.8, margin: 0 }}>
            <li>Ingresa al <strong>Rappi Partner Portal</strong> de tu país.</li>
            <li>Ve a <strong>Configuración → Integraciones → Webhooks</strong>.</li>
            <li>Pega la <strong>URL del webhook</strong> que aparece arriba.</li>
            <li>Si Rappi ofrece un token de firma, cópialo en el campo <em>Token secreto</em> y guarda.</li>
            <li>Activa la recepción de pedidos con el <strong>toggle</strong>.</li>
            <li>Guarda la configuración.</li>
          </ol>
          <div style={{ marginTop: 16, padding: '12px', background: '#fffbeb', borderRadius: 10, border: '1px solid #fde68a' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>
              <strong>Nota:</strong> Cada pedido nuevo de Rappi aparece automáticamente en el <strong>Worker Panel</strong> con el badge <em>🛵 Rappi</em> y notificación en tiempo real.
            </p>
          </div>
          <div style={{ marginTop: 12, padding: '12px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#1e40af' }}>
              <strong>Prueba manual:</strong> Puedes hacer un <code>POST</code> a la URL del webhook con el formato JSON de Rappi para probar la integración sin esperar pedidos reales.
            </p>
          </div>
        </div>
      </div>

      {/* ── Recent Rappi orders ── */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '8px 0 14px' }}>
        <FontAwesomeIcon icon={faShoppingBag} style={{ marginRight: 8, color: '#f97316' }} />
        Pedidos Rappi recientes
      </h3>

      {loading ? (
        <div style={styles.empty}><p>Cargando...</p></div>
      ) : orders.length === 0 ? (
        <div style={styles.empty}>
          <p style={{ color: '#9ca3af' }}>Aún no se han recibido pedidos de Rappi.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map(o => {
            let items = [];
            try { items = typeof o.external_items === 'string' ? JSON.parse(o.external_items) : (o.external_items || []); } catch {}
            return (
              <div key={o.id} style={styles.orderItem}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }}>🛵</span>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>
                        #{o.order_number || o.id}
                      </span>
                      {o.rappi_order_id && (
                        <span style={{ ...styles.tag, marginLeft: 6 }}>ID Rappi: {o.rappi_order_id.slice(0, 12)}...</span>
                      )}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                    background: (STATUS_COLORS[o.status] || '#6b7280') + '20',
                    color: STATUS_COLORS[o.status] || '#6b7280',
                    border: `1px solid ${STATUS_COLORS[o.status] || '#6b7280'}44`,
                  }}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                </div>

                {/* Cliente */}
                {o.customer_name && (
                  <p style={{ margin: '0 0 6px', fontSize: 13, color: '#374151' }}>
                    👤 {o.customer_name}{o.customer_phone ? ` · ${o.customer_phone}` : ''}
                  </p>
                )}

                {/* Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                  {items.map((it, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#374151' }}>
                      <span style={{ fontWeight: 700, minWidth: 20 }}>{it.quantity}×</span>
                      <span style={{ flex: 1 }}>{it.name}</span>
                      {it.unit_price > 0 && (
                        <span style={{ color: '#6b7280', fontWeight: 600 }}>${(it.unit_price * it.quantity).toFixed(0)}</span>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={styles.tag}>
                    {new Date(o.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>${Number(o.total).toFixed(0)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  page:      { padding: '28px 24px', maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' },
  title:     { fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 24 },
  grid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 },
  card:      { background: '#fff', borderRadius: 16, padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #e5e7eb' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 16, marginTop: 0 },
  label:     { fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 },
  input:     { padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, width: '100%', boxSizing: 'border-box', outline: 'none', color: '#1e293b' },
  copyBtn:   { padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#f8fafc', color: '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 },
  orderItem: { background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' },
  tag:       { fontSize: 11, color: '#6b7280', background: '#f1f5f9', borderRadius: 6, padding: '2px 7px' },
  empty:     { textAlign: 'center', padding: '48px 24px', color: '#6b7280', fontSize: 15 },
};
