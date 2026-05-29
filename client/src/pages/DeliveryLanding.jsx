import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'https://srservi2.srautomatic.com';

function RestaurantCard({ store, onSelect }) {
  return (
    <div
      onClick={() => store.isOpen && onSelect(store)}
      style={{
        background: '#1a1a1a',
        borderRadius: 16,
        overflow: 'hidden',
        cursor: store.isOpen ? 'pointer' : 'default',
        opacity: store.isOpen ? 1 : 0.5,
        transition: 'transform 0.15s, box-shadow 0.15s',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
      }}
      onMouseEnter={e => { if (store.isOpen) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.5)'; } }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.4)'; }}
    >
      <div style={{
        height: 140, background: '#111',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden'
      }}>
        {store.logo ? (
          <img src={store.logo} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ fontSize: 48, color: '#333' }}>🍽️</div>
        )}
        {!store.isOpen && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#ef4444', letterSpacing: 1
          }}>
            CERRADO
          </div>
        )}
        {store.isOpen && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(34,197,94,0.9)', color: '#fff',
            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
            letterSpacing: 0.5
          }}>
            ABIERTO
          </div>
        )}
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', marginBottom: 6 }}>{store.name}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>📍 {store.distance_km} km</span>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>🕐 ~{store.estimated_minutes || 45} min</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {store.fee > 0 ? (
            <span style={{ fontSize: 11, background: 'rgba(212,175,55,0.12)', color: '#D4AF37', padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(212,175,55,0.2)' }}>
              Envío ${store.fee}
            </span>
          ) : (
            <span style={{ fontSize: 11, background: 'rgba(34,197,94,0.1)', color: '#22c55e', padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(34,197,94,0.2)' }}>
              Envío gratis
            </span>
          )}
          {store.min_order > 0 && (
            <span style={{ fontSize: 11, color: '#6b7280', padding: '3px 0' }}>
              Min. ${store.min_order}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DeliveryLanding() {
  const navigate = useNavigate();
  const [gpsState, setGpsState] = useState('idle'); // idle | requesting | granted | denied | error
  const [coords, setCoords] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const requestGPS = () => {
    setGpsState('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsState('granted');
      },
      (err) => {
        setGpsState('denied');
        setError('Para ver restaurantes cercanos necesitamos tu ubicación.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  useEffect(() => {
    if (!coords) return;
    setLoading(true);
    fetch(`${API}/api/delivery/restaurants?lat=${coords.lat}&lng=${coords.lng}`)
      .then(r => r.json())
      .then(data => setStores(Array.isArray(data) ? data : []))
      .catch(() => setError('No se pudieron cargar los restaurantes.'))
      .finally(() => setLoading(false));
  }, [coords]);

  const filtered = stores.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1208 100%)',
        borderBottom: '1px solid rgba(212,175,55,0.15)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          width: 40, height: 40, background: '#D4AF37', borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 14, color: '#0a0a0a', flexShrink: 0
        }}>SR</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>SRServi Delivery</div>
          {coords && <div style={{ fontSize: 11, color: '#D4AF37' }}>📍 Ubicación activa</div>}
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px 80px' }}>

        {/* Hero */}
        {gpsState === 'idle' && (
          <div style={{ textAlign: 'center', padding: '60px 20px 40px' }}>
            <div style={{ fontSize: 64, marginBottom: 24 }}>🛵</div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: '0 0 12px', lineHeight: 1.2 }}>
              Delivery a tu puerta
            </h1>
            <p style={{ color: '#9ca3af', fontSize: 15, margin: '0 0 32px', lineHeight: 1.6 }}>
              Activá tu ubicación para ver los restaurantes cercanos que hacen delivery.
            </p>
            <button
              onClick={requestGPS}
              style={{
                background: 'linear-gradient(135deg, #D4AF37, #b8972e)',
                color: '#000', border: 'none', borderRadius: 14,
                padding: '16px 32px', fontSize: 16, fontWeight: 800,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10,
                boxShadow: '0 4px 20px rgba(212,175,55,0.4)'
              }}
            >
              <span style={{ fontSize: 20 }}>📍</span>
              Activar ubicación
            </button>
            <p style={{ color: '#4b5563', fontSize: 12, marginTop: 16 }}>
              Solo usamos tu ubicación para mostrarte restaurantes cercanos
            </p>
          </div>
        )}

        {gpsState === 'requesting' && (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
            <p style={{ color: '#D4AF37', fontSize: 15 }}>Obteniendo tu ubicación...</p>
          </div>
        )}

        {gpsState === 'denied' && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h2 style={{ color: '#ef4444', fontSize: 20, marginBottom: 12 }}>Ubicación bloqueada</h2>
            <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 24 }}>
              Para ver restaurantes cercanos necesitamos acceso a tu ubicación. Por favor habilitala en la configuración de tu navegador.
            </p>
            <button onClick={requestGPS} style={{ background: '#D4AF37', color: '#000', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              Reintentar
            </button>
          </div>
        )}

        {gpsState === 'granted' && (
          <div style={{ paddingTop: 20 }}>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 16 }}>🔍</span>
              <input
                type="text"
                placeholder="Buscar restaurante..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '14px 14px 14px 44px', boxSizing: 'border-box',
                  background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, color: '#fff', fontSize: 14, outline: 'none'
                }}
              />
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
                Buscando restaurantes...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🏪</div>
                <p>No hay restaurantes disponibles en tu zona</p>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
                  {filtered.length} restaurante{filtered.length !== 1 ? 's' : ''} cerca de ti
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                  {filtered.map(store => (
                    <RestaurantCard
                      key={store.id}
                      store={store}
                      onSelect={s => navigate(`/delivery/${s.code}`)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', margin: '16px 0', color: '#f87171', fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
