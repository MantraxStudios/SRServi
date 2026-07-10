import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API = 'https://srservi2.srautomatic.com';

const STEPS = [
  { key: 'waiting',    icon: '📋', label: 'Recibido',    desc: 'El restaurante recibió tu pedido' },
  { key: 'accepted',   icon: '✅', label: 'Aceptado',    desc: 'Confirmaron tu pedido' },
  { key: 'preparing',  icon: '🍳', label: 'Preparando',  desc: 'Están preparando tu pedido' },
  { key: 'on_the_way', icon: '🛵', label: 'En camino',   desc: 'Tu pedido está en camino' },
  { key: 'delivered',  icon: '📦', label: 'Entregado',   desc: '¡Tu pedido fue entregado!' },
];

function stepIndex(status) {
  const i = STEPS.findIndex(s => s.key === status);
  return i >= 0 ? i : 0;
}

export default function DeliveryTrack() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const intervalRef = useRef(null);

  const token = localStorage.getItem('deliveryToken') || '';

  const load = async () => {
    if (!token) { setError('Debes iniciar sesión para rastrear tu pedido'); return; }
    try {
      const r = await fetch(`${API}/api/delivery/order/${orderId}/track`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) { const d = await r.json(); setError(d.error || 'No encontrado'); return; }
      setOrder(await r.json());
    } catch { setError('Error de conexión'); }
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 6000);
    return () => clearInterval(intervalRef.current);
  }, [orderId]);

  const s = { fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#f7f8fa' };

  if (error) return (
    <div style={{ ...s, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>😕</div>
        <div style={{ fontWeight: 700, color: '#374151', marginBottom: 8 }}>{error}</div>
        <button onClick={() => navigate('/delivery')} style={{ background: '#D4AF37', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14, color: '#000' }}>Ir a Delivery</button>
      </div>
    </div>
  );

  if (!order) return (
    <div style={{ ...s, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <p>Cargando seguimiento...</p>
      </div>
    </div>
  );

  const currentStep = stepIndex(order.delivery_status || 'waiting');
  const rejected = order.delivery_status === 'rejected';
  const delivered = order.delivery_status === 'delivered';

  return (
    <div style={s}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ maxWidth: 540, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/delivery')} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 14, color: '#374151', fontWeight: 600 }}>←</button>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#111' }}>Seguimiento de pedido</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Pedido #{orderId}</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 540, margin: '0 auto', padding: '24px 20px' }}>

        {/* Store + Summary */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px', marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: '#D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🏪</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#111' }}>{order.store_name}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{new Date(order.created_at).toLocaleString('es-CL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</div>
            </div>
            <div style={{ marginLeft: 'auto', fontWeight: 900, fontSize: 20, color: '#D4AF37' }}>${Number(order.total).toFixed(0)}</div>
          </div>
          <div style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#374151' }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>📍 Dirección</div>
            <div style={{ color: '#6b7280' }}>{order.delivery_address}</div>
          </div>
        </div>

        {/* Status */}
        {rejected ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, padding: '28px 20px', textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#dc2626', marginBottom: 6 }}>Pedido rechazado</div>
            <div style={{ fontSize: 13, color: '#9ca3af' }}>El restaurante no pudo aceptar tu pedido. Por favor contacta al local.</div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 20px', marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111', marginBottom: 20 }}>Estado del pedido</div>
            {STEPS.map((step, i) => {
              const done = i < currentStep;
              const active = i === currentStep;
              const future = i > currentStep;
              return (
                <div key={step.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: i < STEPS.length - 1 ? 0 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, border: '2px solid',
                      background: done ? '#D4AF37' : active ? '#fffbeb' : '#f9fafb',
                      borderColor: done ? '#D4AF37' : active ? '#D4AF37' : '#e5e7eb',
                      opacity: future ? 0.4 : 1
                    }}>
                      {done ? '✓' : step.icon}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div style={{ width: 2, height: 32, background: done ? '#D4AF37' : '#e5e7eb', marginTop: 2 }} />
                    )}
                  </div>
                  <div style={{ paddingTop: 8, paddingBottom: i < STEPS.length - 1 ? 32 : 0, opacity: future ? 0.4 : 1 }}>
                    <div style={{ fontWeight: active ? 800 : 600, fontSize: 14, color: active ? '#D4AF37' : done ? '#111' : '#9ca3af' }}>{step.label}</div>
                    {(active || done) && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{step.desc}</div>}
                  </div>
                  {active && !delivered && (
                    <div style={{ marginLeft: 'auto', paddingTop: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#D4AF37', animation: 'pulse 1.5s infinite' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {delivered && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: '20px', textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#15803d' }}>¡Pedido entregado!</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Gracias por tu compra. ¡Que lo disfrutes!</div>
          </div>
        )}

        <button onClick={() => navigate('/delivery')} style={{ width: '100%', padding: '14px', background: '#f3f4f6', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#374151' }}>
          Volver al inicio
        </button>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}
