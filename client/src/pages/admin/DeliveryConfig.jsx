import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMotorcycle, faSave, faMapMarkerAlt, faClock, faMoneyBillWave, faSync, faCreditCard } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

const API = 'https://srservi2.srautomatic.com';

const inputStyle = {
  width: '100%', padding: '10px 12px', background: '#fff',
  border: '1px solid #d1d5db', borderRadius: 8,
  color: '#111', fontSize: 13, outline: 'none', boxSizing: 'border-box'
};
const labelStyle = { fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block', fontWeight: 500 };
const sectionStyle = {
  background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
  padding: '20px', marginBottom: 16
};

export default function DeliveryConfig() {
  const { selectedStore } = useStore();
  const { token } = useAuth();
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [form, setForm] = useState({
    address: '',
    lat: '',
    lng: '',
    radius_km: 5,
    fee: 0,
    fee_type: 'fixed',
    fee_per_km: 0,
    free_km: 0,
    min_order: 0,
    hours_source: 'cash_register',
    open_time: '09:00',
    close_time: '22:00',
    estimated_minutes: 45,
    payment_cash: true,
    payment_card: false
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [gettingGps, setGettingGps] = useState(false);

  const fetch_ = useCallback(async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/delivery-settings?store_id=${selectedStore.id}`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        if (data && data.store_id) {
          setForm({
            address: data.address || '',
            lat: data.lat || '',
            lng: data.lng || '',
            radius_km: data.radius_km || 5,
            fee: data.fee || 0,
            fee_type: data.fee_type || 'fixed',
            fee_per_km: data.fee_per_km || 0,
            free_km: data.free_km || 0,
            min_order: data.min_order || 0,
            hours_source: data.hours_source || 'cash_register',
            open_time: data.open_time || '09:00',
            close_time: data.close_time || '22:00',
            estimated_minutes: data.estimated_minutes || 45,
            payment_cash: data.payment_cash !== false,
            payment_card: !!data.payment_card
          });
        }
      }
    } finally { setLoading(false); }
  }, [selectedStore, token]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const autoDetectGPS = () => {
    setGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(f => ({ ...f, lat: pos.coords.latitude.toFixed(7), lng: pos.coords.longitude.toFixed(7) }));
        setGettingGps(false);
      },
      () => { alert('No se pudo obtener la ubicación. Ingrésala manualmente.'); setGettingGps(false); }
    );
  };

  const handleSave = async () => {
    if (!selectedStore) return;
    if (!form.address.trim()) { alert('La dirección es requerida'); return; }
    if (!form.lat || !form.lng) { alert('Las coordenadas son requeridas. Usa "Detectar coordenadas".'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/delivery-settings`, {
        method: 'PUT', headers: authHeaders,
        body: JSON.stringify({ store_id: selectedStore.id, ...form, lat: parseFloat(form.lat), lng: parseFloat(form.lng) })
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
      else { const d = await res.json(); alert(d.error || 'Error al guardar'); }
    } finally { setSaving(false); }
  };

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  if (!selectedStore) {
    return <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Selecciona una tienda</div>;
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FontAwesomeIcon icon={faMotorcycle} style={{ color: '#D4AF37' }} />
            Configuración Delivery
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
            Configura tu servicio de delivery propio. Los clientes te encontrarán en la app de delivery.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ background: saved ? '#22c55e' : '#D4AF37', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: saving ? 'not-allowed' : 'pointer', color: '#000', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <FontAwesomeIcon icon={saved ? faSync : faSave} />
          {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar'}
        </button>
      </div>

      {/* Enable Delivery Note */}
      <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#92740f' }}>
        💡 Para activar el delivery en esta tienda, asegúrate de tener <strong>Delivery habilitado</strong> en Configuraciones. La apertura/cierre de delivery se maneja con la caja registradora.
      </div>

      {/* Ubicación */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <FontAwesomeIcon icon={faMapMarkerAlt} style={{ color: '#D4AF37' }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>Ubicación del local</span>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Dirección exacta *</label>
          <input style={inputStyle} placeholder="Ej: Av. Corrientes 1234, Buenos Aires" value={form.address} onChange={e => f('address', e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Latitud</label>
            <input style={inputStyle} type="number" step="0.0000001" placeholder="-34.6037" value={form.lat} onChange={e => f('lat', e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Longitud</label>
            <input style={inputStyle} type="number" step="0.0000001" placeholder="-58.3816" value={form.lng} onChange={e => f('lng', e.target.value)} />
          </div>
        </div>

        <button
          onClick={autoDetectGPS}
          disabled={gettingGps}
          style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: '#15803d', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          📍 {gettingGps ? 'Detectando...' : 'Detectar coordenadas desde este dispositivo'}
        </button>

        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9ca3af' }}>
          Las coordenadas son necesarias para aparecer en la búsqueda de clientes por GPS.
          Si no puedes detectarlas automáticamente, búscalas en Google Maps haciendo clic en tu dirección.
        </p>
      </div>

      {/* Delivery settings */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <FontAwesomeIcon icon={faMotorcycle} style={{ color: '#D4AF37' }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>Configuración de envío</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Radio de cobertura (km)</label>
            <input style={inputStyle} type="number" min="0.5" max="50" step="0.5" value={form.radius_km} onChange={e => f('radius_km', parseFloat(e.target.value) || 5)} />
          </div>
          <div>
            <label style={labelStyle}>Pedido mínimo ($)</label>
            <input style={inputStyle} type="number" min="0" step="0.01" value={form.min_order} onChange={e => f('min_order', parseFloat(e.target.value) || 0)} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Tipo de costo de envío</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['fixed', '💵 Precio fijo'], ['per_km', '📏 Por kilómetro']].map(([v, lbl]) => (
              <div key={v} onClick={() => f('fee_type', v)} style={{ flex: 1, padding: '10px', border: `2px solid ${form.fee_type === v ? '#D4AF37' : '#e5e7eb'}`, borderRadius: 8, cursor: 'pointer', background: form.fee_type === v ? 'rgba(212,175,55,0.05)' : '#fff', textAlign: 'center', fontSize: 13, fontWeight: 600, color: form.fee_type === v ? '#92400e' : '#374151' }}>{lbl}</div>
            ))}
          </div>
        </div>

        {form.fee_type === 'fixed' ? (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Costo de envío ($)</label>
            <input style={{ ...inputStyle, maxWidth: 180 }} type="number" min="0" step="0.01" value={form.fee} onChange={e => f('fee', parseFloat(e.target.value) || 0)} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Precio por km ($)</label>
              <input style={inputStyle} type="number" min="0" step="0.01" value={form.fee_per_km} onChange={e => f('fee_per_km', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label style={labelStyle}>Km gratuitos (0 = sin gratis)</label>
              <input style={inputStyle} type="number" min="0" step="0.1" value={form.free_km} onChange={e => f('free_km', parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        )}

        <div>
          <label style={labelStyle}>Tiempo estimado de entrega (minutos)</label>
          <input style={{ ...inputStyle, maxWidth: 120 }} type="number" min="10" max="180" value={form.estimated_minutes} onChange={e => f('estimated_minutes', parseInt(e.target.value) || 45)} />
        </div>
      </div>

      {/* Horarios */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <FontAwesomeIcon icon={faClock} style={{ color: '#D4AF37' }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>Horario de delivery</span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {[
            { value: 'cash_register', label: '🏧 Vinculado a caja', desc: 'Abre cuando abres caja, cierra cuando la cierras' },
            { value: 'custom', label: '🕐 Horario personalizado', desc: 'Define horario fijo de apertura y cierre' }
          ].map(opt => (
            <div
              key={opt.value}
              onClick={() => f('hours_source', opt.value)}
              style={{
                flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer',
                border: form.hours_source === opt.value ? '2px solid #D4AF37' : '1px solid #d1d5db',
                background: form.hours_source === opt.value ? 'rgba(212,175,55,0.06)' : '#fafafa'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: '#111', marginBottom: 4 }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>{opt.desc}</div>
            </div>
          ))}
        </div>

        {form.hours_source === 'custom' && (
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Apertura</label>
              <input style={inputStyle} type="time" value={form.open_time} onChange={e => f('open_time', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Cierre</label>
              <input style={inputStyle} type="time" value={form.close_time} onChange={e => f('close_time', e.target.value)} />
            </div>
          </div>
        )}

        {form.hours_source === 'cash_register' && (
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#0369a1' }}>
            ℹ️ Tu local aparecerá como <strong>abierto</strong> cuando tengas una caja registradora activa, y como <strong>cerrado</strong> cuando la cierres.
          </div>
        )}
      </div>

      {/* Métodos de pago */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <FontAwesomeIcon icon={faCreditCard} style={{ color: '#D4AF37' }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>Métodos de pago aceptados</span>
        </div>
        <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, marginTop: 0 }}>
          Indicá cómo acepta pago tu repartidor al hacer la entrega.
        </p>
        {[
          { key: 'payment_cash', label: '💵 Efectivo contra entrega', desc: 'El cliente paga en efectivo al recibir el pedido' },
          { key: 'payment_card', label: '💳 Tarjeta contra entrega (Tuu)', desc: 'Tu repartidor cobra con el terminal Tuu al entregar' }
        ].map(opt => (
          <div
            key={opt.key}
            onClick={() => {
              const next = !form[opt.key];
              if (!next && opt.key === 'payment_cash' && !form.payment_card) return;
              if (!next && opt.key === 'payment_card' && !form.payment_cash) return;
              f(opt.key, next);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              border: form[opt.key] ? '2px solid #D4AF37' : '1px solid #d1d5db',
              borderRadius: 10, cursor: 'pointer', marginBottom: 10,
              background: form[opt.key] ? 'rgba(212,175,55,0.06)' : '#fafafa'
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              background: form[opt.key] ? '#D4AF37' : '#f3f4f6',
              border: form[opt.key] ? 'none' : '1.5px solid #d1d5db',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {form[opt.key] && <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>✓</span>}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{opt.desc}</div>
            </div>
          </div>
        ))}
        {form.payment_card && (
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#0369a1' }}>
            ℹ️ El pago con tarjeta usa el terminal Tuu de tu cuenta. El cliente elige pagar con tarjeta y tu repartidor procesa el cobro al llegar.
          </div>
        )}
      </div>

      {/* Preview URL */}
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 6 }}>Link para compartir con clientes:</div>
        <div style={{ fontSize: 13, color: '#6b7280', wordBreak: 'break-all', fontFamily: 'monospace' }}>
          {window.location.origin}/delivery/{selectedStore.code}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          O simplemente: {window.location.origin}/delivery (los clientes te encontrarán por GPS)
        </div>
      </div>
    </div>
  );
}
