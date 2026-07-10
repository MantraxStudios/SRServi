import { useState, useEffect } from 'react';
import { useStore } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar, faTrash, faUser, faPhone, faToggleOn, faToggleOff, faSave } from '@fortawesome/free-solid-svg-icons';

const API = 'https://mantraxtools.store';

export default function LoyaltyConfig() {
  const { selectedStore } = useStore();
  const { token } = useAuth();

  const [enabled, setEnabled] = useState(false);
  const [discountPct, setDiscountPct] = useState(10);
  const [requiredPurchases, setRequiredPurchases] = useState(5);
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedStore) return;
    Promise.all([
      fetch(`${API}/api/loyalty/config?store_id=${selectedStore.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
      fetch(`${API}/api/loyalty/customers?store_id=${selectedStore.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
    ]).then(([config, custs]) => {
      setEnabled(!!config.enabled);
      setDiscountPct(Number(config.discount_percentage) || 10);
      setRequiredPurchases(Number(config.required_purchases) || 5);
      setCustomers(Array.isArray(custs) ? custs : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedStore, token]);

  async function handleSave() {
    if (!selectedStore) return;
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`${API}/api/loyalty/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          store_id: selectedStore.id,
          enabled,
          discount_percentage: discountPct,
          required_purchases: requiredPurchases,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {} finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este cliente habitual?')) return;
    await fetch(`${API}/api/loyalty/customers/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ store_id: selectedStore.id }),
    });
    setCustomers(c => c.filter(x => x.id !== id));
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Cargando...</div>
  );

  const qualifiesCount = customers.filter(c => c.purchase_count >= requiredPurchases).length;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <FontAwesomeIcon icon={faStar} style={{ fontSize: 24, color: '#D4AF37' }} />
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#111' }}>Cliente Habitual</h1>
      </div>

      {/* Config card */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, color: '#374151' }}>Configuración</h2>

        {/* Enable toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, padding: '14px 16px', background: '#f9fafb', borderRadius: 12, border: '1.5px solid #e5e7eb' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#111', fontSize: 15 }}>Sistema activo</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {enabled ? 'Se mostrará la cámara al pagar' : 'No se detectará rostro al pagar'}
            </div>
          </div>
          <button
            onClick={() => setEnabled(p => !p)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 32, color: enabled ? '#22c55e' : '#9ca3af', padding: 0 }}
          >
            <FontAwesomeIcon icon={enabled ? faToggleOn : faToggleOff} />
          </button>
        </div>

        {/* Discount */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontWeight: 600, color: '#374151', marginBottom: 6, fontSize: 14 }}>
            Descuento para cliente habitual (%)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="number"
              min={1} max={100}
              value={discountPct}
              onChange={e => setDiscountPct(Number(e.target.value))}
              style={{ width: 100, padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: 10, fontSize: 18, fontWeight: 700, textAlign: 'center' }}
            />
            <span style={{ fontSize: 14, color: '#6b7280' }}>% de descuento en cada compra</span>
          </div>
        </div>

        {/* Required purchases */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ display: 'block', fontWeight: 600, color: '#374151', marginBottom: 6, fontSize: 14 }}>
            Compras necesarias para activar el descuento
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="number"
              min={1} max={999}
              value={requiredPurchases}
              onChange={e => setRequiredPurchases(Number(e.target.value))}
              style={{ width: 100, padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: 10, fontSize: 18, fontWeight: 700, textAlign: 'center' }}
            />
            <span style={{ fontSize: 14, color: '#6b7280' }}>compras antes de obtener el descuento</span>
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
            Ej: si pones 5, el cliente recibirá el descuento desde su 5.ª compra en adelante.
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '12px 28px', background: saved ? '#22c55e' : '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.2s' }}
        >
          <FontAwesomeIcon icon={faSave} />
          {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar configuración'}
        </button>
      </div>

      {/* Customers */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#374151', margin: 0 }}>
            Clientes registrados
            <span style={{ marginLeft: 10, background: '#f3f4f6', borderRadius: 20, padding: '2px 10px', fontSize: 13, fontWeight: 600, color: '#6b7280' }}>
              {customers.length}
            </span>
          </h2>
          {qualifiesCount > 0 && (
            <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
              ⭐ {qualifiesCount} con descuento activo
            </span>
          )}
        </div>

        {customers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
            <div>Todavía no hay clientes habituales registrados.</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Los clientes se registran desde la pantalla de cobro.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {customers.map(c => {
              const qualifies = c.purchase_count >= requiredPurchases;
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${qualifies ? '#bbf7d0' : '#e5e7eb'}`, background: qualifies ? '#f0fdf4' : '#fafafa' }}>
                  {c.face_photo ? (
                    <img src={c.face_photo} alt={c.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5e7eb', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FontAwesomeIcon icon={faUser} style={{ color: '#9ca3af' }} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#111', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {c.name}
                      {qualifies && <span style={{ fontSize: 11, background: '#22c55e', color: '#fff', borderRadius: 20, padding: '1px 8px', fontWeight: 700 }}>Descuento activo</span>}
                    </div>
                    {c.phone && (
                      <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <FontAwesomeIcon icon={faPhone} style={{ fontSize: 10 }} /> {c.phone}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {c.purchase_count} compra{c.purchase_count !== 1 ? 's' : ''} &nbsp;·&nbsp;
                      <span style={{ color: qualifies ? '#16a34a' : '#6b7280', fontWeight: qualifies ? 700 : 400 }}>
                        {qualifies ? `${discountPct}% desc.` : `${requiredPurchases - c.purchase_count} más para descuento`}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(c.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: 6, borderRadius: 8, flexShrink: 0 }}
                    title="Eliminar cliente"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
