import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'https://mantraxtools.store';

function RestaurantCard({ store, onClick }) {
  const closed = !store.isOpen;
  return (
    <div
      onClick={() => !closed && onClick(store)}
      style={{
        background: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        cursor: closed ? 'default' : 'pointer',
        boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
        border: '1px solid #f0f0f0',
        transition: 'box-shadow 0.2s, transform 0.15s',
        opacity: closed ? 0.6 : 1,
      }}
      onMouseEnter={e => { if (!closed) { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.13)'; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = ''; }}
    >
      {/* Hero image */}
      <div style={{ height: 160, background: '#f5f5f5', position: 'relative', overflow: 'hidden' }}>
        {store.logo ? (
          <img src={store.logo} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f9f5e8 0%, #f0e9c8 100%)' }}>
            <div style={{ width: 56, height: 56, background: '#D4AF37', borderRadius: 14, overflow: 'hidden' }}><img src="/iconweb.png" alt="SR" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
          </div>
        )}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: closed ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.95)',
          color: closed ? '#fff' : '#16a34a',
          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
          letterSpacing: 0.3, boxShadow: '0 1px 4px rgba(0,0,0,0.12)'
        }}>
          {closed ? 'Cerrado' : '● Abierto'}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#111', marginBottom: 6, lineHeight: 1.2 }}>{store.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 14 }}>📍</span> {store.distance_km} km
          </span>
          <span style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 14 }}>🕐</span> {store.estimated_minutes || 45} min
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {store.fee > 0 ? (
            <span style={{ fontSize: 12, color: '#374151', background: '#f3f4f6', padding: '4px 10px', borderRadius: 20, fontWeight: 600 }}>
              Envío ${store.fee}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: '#15803d', background: '#f0fdf4', padding: '4px 10px', borderRadius: 20, fontWeight: 700 }}>
              Envío gratis
            </span>
          )}
          {store.min_order > 0 && (
            <span style={{ fontSize: 12, color: '#9ca3af', padding: '4px 0' }}>
              Mín. ${store.min_order}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DeliveryLanding() {
  const navigate = useNavigate();
  const [gpsState, setGpsState] = useState('idle');
  const [coords, setCoords] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const requestGPS = () => {
    setGpsState('requesting');
    navigator.geolocation.getCurrentPosition(
      pos => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsState('granted'); },
      () => setGpsState('denied'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  useEffect(() => {
    if (!coords) return;
    setLoading(true);
    fetch(`${API}/api/delivery/restaurants?lat=${coords.lat}&lng=${coords.lng}`)
      .then(r => r.json())
      .then(data => setStores(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [coords]);

  const filtered = stores.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fa', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0' }}>
            <div style={{ width: 38, height: 38, background: '#D4AF37', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}><img src="/iconweb.png" alt="SR" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#111', lineHeight: 1 }}>SRServi Delivery</div>
              {coords && <div style={{ fontSize: 11, color: '#D4AF37', marginTop: 2 }}>Ubicación activa</div>}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 20px 80px' }}>

        {/* GPS CTA */}
        {gpsState === 'idle' && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ width: 90, height: 90, background: '#fdf9ed', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 42, border: '2px solid #f5e8a8' }}>🛵</div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111', margin: '0 0 10px', letterSpacing: -0.5 }}>Delivery a tu puerta</h1>
            <p style={{ color: '#6b7280', fontSize: 15, margin: '0 0 32px', lineHeight: 1.6, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
              Activá tu ubicación para descubrir los restaurantes que hacen delivery cerca de vos.
            </p>
            <button
              onClick={requestGPS}
              style={{
                background: '#D4AF37', color: '#fff', border: 'none', borderRadius: 12,
                padding: '15px 32px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(212,175,55,0.35)', display: 'inline-flex', alignItems: 'center', gap: 8
              }}
            >
              📍 Activar ubicación
            </button>
            <p style={{ color: '#c0c4cc', fontSize: 12, marginTop: 14 }}>Solo se usa para mostrar restaurantes cercanos</p>
          </div>
        )}

        {gpsState === 'requesting' && (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📡</div>
            <p style={{ fontWeight: 600 }}>Obteniendo tu ubicación...</p>
          </div>
        )}

        {gpsState === 'denied' && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
            <h2 style={{ color: '#ef4444', fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Ubicación bloqueada</h2>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24, maxWidth: 300, margin: '0 auto 24px' }}>
              Habilitá el acceso a tu ubicación en la configuración del navegador para continuar.
            </p>
            <button onClick={requestGPS} style={{ background: '#D4AF37', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              Reintentar
            </button>
          </div>
        )}

        {gpsState === 'granted' && (
          <div style={{ paddingTop: 24 }}>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 24 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 17 }}>🔍</span>
              <input
                type="text"
                placeholder="Buscar restaurante..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '13px 14px 13px 44px', boxSizing: 'border-box',
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
                  color: '#111', fontSize: 14, outline: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
                }}
              />
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                <p style={{ fontWeight: 600 }}>Buscando restaurantes cerca...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏪</div>
                <p style={{ fontWeight: 600, color: '#374151' }}>No hay restaurantes disponibles</p>
                <p style={{ fontSize: 13 }}>Intentá ampliar el área de búsqueda o revisá más tarde</p>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500, marginBottom: 16 }}>
                  {filtered.length} restaurante{filtered.length !== 1 ? 's' : ''} cerca de ti
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
                  {filtered.map(store => (
                    <RestaurantCard key={store.id} store={store} onClick={s => navigate(`/delivery/${s.code}`)} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
