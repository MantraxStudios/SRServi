import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { SOCKET_URL, getProductImageUrl } from '../config.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCartShopping, faUtensils } from '@fortawesome/free-solid-svg-icons';
import NoSleep from 'nosleep.js';

// Pantalla de TV que muestra en vivo el carrito que el cliente arma en el tótem.
// Se empareja por código de tienda: /tv-cart/:code
function TvCart() {
  const { code } = useParams();
  const [store, setStore] = useState(null);
  const [cart, setCart] = useState([]);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  // Mantener la pantalla encendida
  useEffect(() => {
    const noSleep = new NoSleep();
    noSleep.enable().catch(() => {
      const enable = () => { noSleep.enable().catch(() => {}); document.removeEventListener('click', enable); };
      document.addEventListener('click', enable, { once: true });
    });
    return () => noSleep.disable();
  }, []);

  // Resolver tienda por código
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/${code}`);
        if (!res.ok) throw new Error('Tienda no encontrada');
        const json = await res.json();
        if (!cancelled) setStore(json.store || json);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  // Socket: unirse a la sala de la tienda y escuchar el carrito en vivo
  useEffect(() => {
    if (!store?.id) return;
    const socket = io(SOCKET_URL);
    socketRef.current = socket;
    const join = () => socket.emit('join_store_room', store.id);
    socket.on('connect', join);
    socket.on('reconnect', join);
    socket.on('tv_cart_update', (data) => {
      if (String(data.store_id) === String(store.id)) setCart(data.cart || []);
    });
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [store?.id]);

  const symbol = store?.currency_symbol || '$';
  const money = (v) => `${symbol}${Number(v || 0).toLocaleString('es-CL')}`;
  const accent = store?.accent_color || '#D4AF37';
  const total = cart.reduce((s, i) => s + Number(i.total || 0), 0);
  const totalUnits = cart.reduce((s, i) => s + Number(i.quantity || 0), 0);

  if (error) {
    return (
      <div style={styles.center}>
        <div style={{ color: '#fff', fontSize: 24 }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={{ ...styles.header, borderBottom: `3px solid ${accent}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ ...styles.iconBox, background: accent }}>
            <FontAwesomeIcon icon={faCartShopping} style={{ color: '#0a0a0a', fontSize: 26 }} />
          </div>
          <div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#fff', lineHeight: 1 }}>Tu pedido</div>
            <div style={{ fontSize: 18, color: '#9ca3af', marginTop: 4 }}>{store?.name || ''}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 16, color: '#9ca3af' }}>{totalUnits} producto{totalUnits !== 1 ? 's' : ''}</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: accent, lineHeight: 1 }}>{money(total)}</div>
        </div>
      </header>

      <div style={styles.list}>
        {cart.length === 0 ? (
          <div style={styles.empty}>
            <FontAwesomeIcon icon={faUtensils} style={{ fontSize: 64, color: '#3f3f46', marginBottom: 18 }} />
            <div style={{ fontSize: 30, fontWeight: 800, color: '#e5e7eb' }}>¡Bienvenido!</div>
            <div style={{ fontSize: 20, color: '#9ca3af', marginTop: 8 }}>Elegí tus productos en la pantalla y los verás aparecer aquí.</div>
          </div>
        ) : (
          cart.map((item, idx) => (
            <div key={idx} style={styles.row}>
              {item.product_image ? (
                <img src={getProductImageUrl(item.product_image)} alt="" style={styles.thumb} />
              ) : (
                <div style={{ ...styles.thumb, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesomeIcon icon={faUtensils} style={{ color: '#71717a', fontSize: 26 }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{item.product_name}</div>
                {(item.selected_ingredients?.length > 0 || item.selected_extras?.length > 0) && (
                  <div style={{ fontSize: 17, color: '#9ca3af', marginTop: 4 }}>
                    {[...(item.selected_ingredients || []), ...(item.selected_extras || [])].join(' · ')}
                  </div>
                )}
              </div>
              <div style={{ ...styles.qty, borderColor: accent, color: accent }}>x{item.quantity}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', minWidth: 140, textAlign: 'right' }}>{money(item.total)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' },
  center: { minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 36px', background: '#111' },
  iconBox: { width: 60, height: 60, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  list: { flex: 1, overflowY: 'auto', padding: '24px 36px', display: 'flex', flexDirection: 'column', gap: 14 },
  row: { display: 'flex', alignItems: 'center', gap: 20, background: '#161616', border: '1px solid #262626', borderRadius: 16, padding: '16px 20px' },
  thumb: { width: 72, height: 72, borderRadius: 12, objectFit: 'cover', flexShrink: 0, background: '#262626' },
  qty: { border: '2px solid', borderRadius: 12, padding: '6px 14px', fontSize: 24, fontWeight: 900, flexShrink: 0 },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '80px 20px' },
};

export default TvCart;
