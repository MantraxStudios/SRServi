import { useState, useEffect, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faCheck, faMotorcycle, faToggleOn, faToggleOff, faSave, faShoppingBag } from '@fortawesome/free-solid-svg-icons';
import { QRCodeCanvas } from 'qrcode.react';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';
const UE_COLOR = '#06C167';

const STATUS_COLORS = { preparing: '#f59e0b', pending: '#6b7280', ready: '#3b82f6', completed: '#22c55e' };
const STATUS_LABELS = { preparing: 'En preparación', pending: 'Pendiente', ready: 'Listo', completed: 'Completado' };

export default function UberEatsIntegration() {
  const { token } = useAuth();
  const { selectedStore } = useContext(StoreContext);

  const [config, setConfig]             = useState({ is_enabled: true, webhook_secret: '' });
  const [orders, setOrders]             = useState([]);
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [saveOk, setSaveOk]             = useState(false);
  const [copied, setCopied]             = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const storeCode  = selectedStore?.code || '';
  const webhookUrl = storeCode ? `${BASE_URL}/api/ubereats/webhook/${storeCode}` : '';

  useEffect(() => {
    if (!selectedStore?.id || !token) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/ubereats/config?store_id=${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`/api/ubereats/orders?store_id=${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([cfgData, ordData]) => {
      if (cfgData.config) setConfig({ is_enabled: !!cfgData.config.is_enabled, webhook_secret: cfgData.config.webhook_secret || '' });
      setOrders(ordData.orders || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedStore?.id, token]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/ubereats/config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStore.id, ...config }),
      });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch { alert('Error al guardar'); }
    finally { setSaving(false); }
  };

  const copy = (text, fn) => {
    navigator.clipboard.writeText(text).then(() => { fn(true); setTimeout(() => fn(false), 2000); });
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
        <p>Selecciona una tienda para configurar UberEats.</p>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: UE_COLOR, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 16px ${UE_COLOR}55`,
        }}>
          <FontAwesomeIcon icon={faMotorcycle} style={{ color: '#fff', fontSize: 20 }} />
        </div>
        <div>
          <h1 style={{ ...styles.title, marginBottom: 0 }}>Uber Eats — {selectedStore.name}</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Recibe pedidos de Uber Eats en tiempo real</p>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Config card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Configuración</h3>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 20, padding: '12px 14px',
            background: config.is_enabled ? '#f0fdf4' : '#fafafa',
            borderRadius: 10,
            border: `1px solid ${config.is_enabled ? UE_COLOR + '55' : '#e5e7eb'}`,
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Recepción de pedidos</p>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                {config.is_enabled ? 'Activa — recibiendo pedidos de Uber Eats' : 'Inactiva — webhook deshabilitado'}
              </p>
            </div>
            <button onClick={() => setConfig(c => ({ ...c, is_enabled: !c.is_enabled }))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 28, color: config.is_enabled ? UE_COLOR : '#d1d5db' }}>
              <FontAwesomeIcon icon={config.is_enabled ? faToggleOn : faToggleOff} />
            </button>
          </div>

          {/* Webhook URL */}
          <div style={{ marginBottom: 16 }}>
            <label style={styles.label}>URL del Webhook</label>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>
              Configura esta URL en el portal <strong>Uber Eats Manager</strong> como endpoint de notificaciones de pedidos.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly value={webhookUrl} style={{ ...styles.input, flex: 1, background: '#f8fafc', fontSize: 12 }} />
              <button onClick={() => copy(webhookUrl, setCopied)} style={styles.copyBtn}>
                <FontAwesomeIcon icon={copied ? faCheck : faCopy} />
                {copied ? ' Copiado' : ' Copiar'}
              </button>
            </div>
          </div>

          {/* QR */}
          {webhookUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 12, background: '#f8fafc', borderRadius: 10, marginBottom: 16 }}>
              <QRCodeCanvas value={webhookUrl} size={120} level="M" fgColor={UE_COLOR} />
              <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>QR de la URL del webhook</p>
            </div>
          )}

          {/* Secret */}
          <div style={{ marginBottom: 20 }}>
            <label style={styles.label}>Token secreto (opcional)</label>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>
              Uber Eats envía el header <code>x-uber-signature</code> para verificar el origen. Ponlo aquí.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={config.webhook_secret} onChange={e => setConfig(c => ({ ...c, webhook_secret: e.target.value }))}
                placeholder="Token secreto..." style={{ ...styles.input, flex: 1, fontFamily: 'monospace', fontSize: 12 }} />
              <button onClick={generateSecret} style={{ ...styles.copyBtn, background: '#1e293b', color: '#fff', border: 'none' }}>Generar</button>
              {config.webhook_secret && (
                <button onClick={() => copy(config.webhook_secret, setCopiedSecret)} style={styles.copyBtn}>
                  <FontAwesomeIcon icon={copiedSecret ? faCheck : faCopy} />
                </button>
              )}
            </div>
          </div>

          <button onClick={save} disabled={saving} style={{
            width: '100%', padding: '13px', borderRadius: 12, border: 'none',
            background: saveOk ? '#22c55e' : UE_COLOR, color: '#fff',
            fontWeight: 800, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s',
          }}>
            <FontAwesomeIcon icon={saveOk ? faCheck : faSave} />
            {saving ? 'Guardando...' : saveOk ? 'Guardado' : 'Guardar configuración'}
          </button>
        </div>

        {/* How-to + payload */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>¿Cómo configurar?</h3>
          <ol style={{ paddingLeft: 18, color: '#374151', fontSize: 14, lineHeight: 1.8, margin: 0 }}>
            <li>Ingresa a <strong>Uber Eats Manager</strong> (manager.ubereats.com).</li>
            <li>Ve a <strong>Configuración → Integraciones → Webhooks</strong>.</li>
            <li>Pega la <strong>URL del webhook</strong> que aparece arriba.</li>
            <li>Copia el <strong>Client Secret</strong> que te da Uber en el campo <em>Token secreto</em>.</li>
            <li>Activa la recepción con el toggle y guarda.</li>
          </ol>
          <div style={{ marginTop: 16, padding: 12, background: '#f0fdf4', borderRadius: 10, border: `1px solid ${UE_COLOR}44` }}>
            <p style={{ margin: 0, fontSize: 13, color: '#14532d' }}>
              <strong>Nota:</strong> Uber Eats envía el evento <code>orders.notification</code> al confirmar un pedido. Los pedidos aparecen con badge verde 🟢 en el Worker Panel al instante.
            </p>
          </div>
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '0 0 6px' }}>Ejemplo de payload Uber Eats:</p>
            <pre style={{ fontSize: 10, background: '#0f172a', color: '#94a3b8', borderRadius: 8, padding: 10, overflow: 'auto', margin: 0, lineHeight: 1.5 }}>
{`{
  "event_type": "orders.notification",
  "order_id": "abc-123",
  "status": "started",
  "total": { "price": 9500 },
  "payment_info": { "status": "COMPLETED" },
  "eater": {
    "first_name": "María",
    "last_name": "González",
    "phone": "912345678"
  },
  "cart": {
    "items": [{
      "title": "Pizza Margherita",
      "quantity": 1,
      "price": {
        "unit_price": { "amount": 9500 }
      },
      "selected_modifier_groups": [{
        "title": "Tamaño",
        "selected_items": [
          { "title": "Mediana" }
        ]
      }],
      "special_instructions": "Sin cebolla"
    }]
  }
}`}
            </pre>
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '8px 0 14px' }}>
        <FontAwesomeIcon icon={faShoppingBag} style={{ marginRight: 8, color: UE_COLOR }} />
        Pedidos Uber Eats recientes
      </h3>

      {loading ? (
        <div style={styles.empty}><p>Cargando...</p></div>
      ) : orders.length === 0 ? (
        <div style={styles.empty}>
          <p style={{ color: '#9ca3af' }}>Aún no se han recibido pedidos de Uber Eats.</p>
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
                    <span style={{ fontSize: 20 }}>🟢</span>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>#{o.order_number || o.id}</span>
                      {o.ubereats_order_id && (
                        <span style={{ ...styles.tag, marginLeft: 6 }}>ID: {o.ubereats_order_id.slice(0, 14)}</span>
                      )}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                    background: (STATUS_COLORS[o.status] || '#6b7280') + '20',
                    color: STATUS_COLORS[o.status] || '#6b7280',
                    border: `1px solid ${(STATUS_COLORS[o.status] || '#6b7280')}44`,
                  }}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                </div>

                {o.customer_name && (
                  <p style={{ margin: '0 0 6px', fontSize: 13, color: '#374151' }}>
                    👤 {o.customer_name}{o.customer_phone ? ` · ${o.customer_phone}` : ''}
                  </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                  {items.map((it, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#374151' }}>
                      <span style={{ fontWeight: 700, minWidth: 20 }}>{it.quantity}×</span>
                      <span style={{ flex: 1 }}>{it.name}{it.notes ? <span style={{ color: '#6b7280', fontSize: 11 }}> · {it.notes}</span> : null}</span>
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
