import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'https://srservi2.srautomatic.com';

const STATUS_LABELS = {
  waiting:    { label: 'Recibido',   color: '#6b7280', bg: '#f3f4f6' },
  accepted:   { label: 'Aceptado',   color: '#0369a1', bg: '#e0f2fe' },
  preparing:  { label: 'Preparando', color: '#92400e', bg: '#fef3c7' },
  on_the_way: { label: 'En camino',  color: '#065f46', bg: '#d1fae5' },
  delivered:  { label: 'Entregado',  color: '#15803d', bg: '#f0fdf4' },
  rejected:   { label: 'Rechazado',  color: '#dc2626', bg: '#fee2e2' },
};

const ACTIVE_STATUSES = ['waiting', 'accepted', 'preparing', 'on_the_way'];

const inp = { width: '100%', padding: '12px 14px', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, color: '#111', fontSize: 14, outline: 'none', boxSizing: 'border-box' };

export default function DeliveryAccount() {
  const navigate = useNavigate();
  const token = localStorage.getItem('deliveryToken') || '';

  const [customer, setCustomer] = useState(() => {
    try { return JSON.parse(localStorage.getItem('deliveryCustomer') || 'null'); } catch { return null; }
  });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!token || !customer) { navigate('/delivery'); return; }
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const r = await fetch(`${API}/api/delivery/my-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) setOrders(await r.json());
    } catch {}
    setLoading(false);
  };

  const startEdit = () => {
    setEditName(customer?.name || '');
    setEditPhone(customer?.phone || '');
    setSaveError('');
    setEditing(true);
  };

  const saveProfile = async () => {
    if (!editName.trim()) return;
    setSaving(true); setSaveError('');
    try {
      const r = await fetch(`${API}/api/delivery/my-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editName.trim(), phone: editPhone.trim() })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      const updated = { ...customer, name: d.name, phone: d.phone };
      setCustomer(updated);
      localStorage.setItem('deliveryCustomer', JSON.stringify(updated));
      setEditing(false);
    } catch (e) { setSaveError(e.message); }
    setSaving(false);
  };

  const logout = () => {
    localStorage.removeItem('deliveryToken');
    localStorage.removeItem('deliveryCustomer');
    navigate('/delivery');
  };

  if (!customer) return null;

  const activeOrders = orders.filter(o => ACTIVE_STATUSES.includes(o.delivery_status));
  const historyOrders = orders.filter(o => !ACTIVE_STATUSES.includes(o.delivery_status));
  const displayed = tab === 'active' ? activeOrders : historyOrders;

  const s = { fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#f7f8fa' };

  return (
    <div style={s}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ maxWidth: 540, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 14, color: '#374151', fontWeight: 600 }}>←</button>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#111' }}>Mi cuenta</div>
          <button
            onClick={logout}
            style={{ marginLeft: 'auto', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, color: '#dc2626', fontWeight: 600 }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 540, margin: '0 auto', padding: '20px 16px' }}>

        {/* Profile card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: editing ? 16 : 0 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fdf9ed', border: '2px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>👤</div>
            {!editing ? (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 17, color: '#111' }}>{customer.name}</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer.email}</div>
                  {customer.phone && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 1 }}>📞 {customer.phone}</div>}
                </div>
                <button
                  onClick={startEdit}
                  style={{ flexShrink: 0, background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}
                >
                  Editar
                </button>
              </>
            ) : (
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>Editar perfil</div>
            )}
          </div>

          {editing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="text" placeholder="Nombre completo *" value={editName} autoFocus
                onChange={e => { setEditName(e.target.value); setSaveError(''); }}
                style={inp}
              />
              <input type="tel" placeholder="Teléfono" value={editPhone}
                onChange={e => { setEditPhone(e.target.value); setSaveError(''); }}
                style={inp}
              />
              <div style={{ fontSize: 12, color: '#9ca3af', background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
                📧 {customer.email} — el correo no se puede cambiar
              </div>
              {saveError && <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>{saveError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setEditing(false)}
                  style={{ flex: 1, padding: '12px', background: '#f3f4f6', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#374151' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={saveProfile}
                  disabled={saving || !editName.trim()}
                  style={{ flex: 2, padding: '12px', background: saving || !editName.trim() ? '#d1d5db' : '#D4AF37', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: saving || !editName.trim() ? 'not-allowed' : 'pointer', color: saving || !editName.trim() ? '#9ca3af' : '#000', boxShadow: saving ? 'none' : '0 4px 14px rgba(212,175,55,0.25)' }}
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 12, padding: 4, marginBottom: 16 }}>
          {[
            ['active', activeOrders.length > 0 ? `Activos (${activeOrders.length})` : 'Activos'],
            ['history', 'Historial']
          ].map(([t, lbl]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#111' : '#6b7280', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}
            >
              {lbl}
            </button>
          ))}
        </div>

        {/* Orders list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
            <p>Cargando pedidos...</p>
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>{tab === 'active' ? '📭' : '📋'}</div>
            <p style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              {tab === 'active' ? 'No tienes pedidos activos' : 'Sin pedidos anteriores'}
            </p>
            {tab === 'active' && (
              <button
                onClick={() => navigate('/delivery')}
                style={{ marginTop: 12, background: '#D4AF37', color: '#000', border: 'none', borderRadius: 10, padding: '10px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(212,175,55,0.35)' }}
              >
                Explorar restaurantes
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {displayed.map(order => {
              const stLabel = STATUS_LABELS[order.delivery_status] || STATUS_LABELS['waiting'];
              const isActive = ACTIVE_STATUSES.includes(order.delivery_status);
              const logoSrc = order.store_logo ? (order.store_logo.startsWith('http') ? order.store_logo : `${API}${order.store_logo}`) : null;
              return (
                <div
                  key={order.id}
                  style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: isActive ? '1px solid rgba(212,175,55,0.35)' : '1px solid #f0f0f0' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: '#f3f4f6', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {logoSrc ? <img src={logoSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 20 }}>🏪</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{order.store_name}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>
                        {new Date(order.created_at).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {' · '}Pedido #{order.id}
                      </div>
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 17, color: '#D4AF37', flexShrink: 0 }}>${Number(order.total).toFixed(0)}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: stLabel.color, background: stLabel.bg, padding: '4px 12px', borderRadius: 20 }}>
                      {stLabel.label}
                    </span>
                    {isActive && (
                      <button
                        onClick={() => navigate(`/delivery/track/${order.id}`)}
                        style={{ background: '#D4AF37', border: 'none', borderRadius: 8, padding: '7px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', color: '#000', boxShadow: '0 2px 8px rgba(212,175,55,0.35)', flexShrink: 0 }}
                      >
                        📍 Seguir pedido
                      </button>
                    )}
                  </div>

                  {order.delivery_address && (
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                      📍 {order.delivery_address}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
