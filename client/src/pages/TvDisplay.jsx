import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUtensils, faBell, faClock, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import NoSleep from 'nosleep.js';

const TV_CODE_KEY = 'srservi_tv_code';

function useNoSleep() {
  useEffect(() => {
    const noSleep = new NoSleep();

    const enable = () => {
      noSleep.enable();
      document.removeEventListener('click', enable);
      document.removeEventListener('touchstart', enable);
    };

    // NoSleep requires a user gesture on some browsers — try immediately,
    // fall back to first interaction if that fails.
    noSleep.enable().catch(() => {
      document.addEventListener('click', enable, { once: true });
      document.addEventListener('touchstart', enable, { once: true });
    });

    const onVisible = () => { if (document.visibilityState === 'visible') noSleep.enable().catch(() => {}); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      noSleep.disable();
    };
  }, []);
}

function TvDisplay() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState({ store: null, preparing: [], ready: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [time, setTime] = useState(new Date());
  const [highlightOrder, setHighlightOrder] = useState(null);
  const [started, setStarted] = useState(false);
  const prevReadyRef = useRef([]);
  const firstLoadRef = useRef(true);
  const audioRef = useRef(null);
  const audioUnlockedRef = useRef(false);

  useNoSleep();

  // Reproduce el sonido de notificación. Devuelve la promesa para poder
  // diagnosticar en consola si el navegador lo bloqueó.
  const playBeep = () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.muted = false;
      a.volume = 1;
      a.currentTime = 0;
      const p = a.play();
      if (p && p.catch) p.catch((err) => console.warn('[TV] audio bloqueado:', err?.name || err));
    } catch (err) {
      console.warn('[TV] audio error:', err);
    }
  };

  // Al tocar "COMENZAR MONITOREO" se desbloquea el audio (los navegadores
  // bloquean el sonido automático hasta que el usuario interactúa una vez).
  const startMonitoring = () => {
    const a = audioRef.current;
    if (a) {
      a.muted = false;
      a.volume = 1;
      a.play().then(() => {
        a.pause();
        a.currentTime = 0;
        audioUnlockedRef.current = true;
      }).catch((err) => console.warn('[TV] no se pudo desbloquear audio:', err?.name || err));
    }
    setStarted(true);
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch(`/api/store/${code}/tv-orders`);
      if (!res.ok) throw new Error('Tienda no encontrada');
      const json = await res.json();

      // Detecta pedidos que ENTRAN a la columna "LISTOS PARA RETIRAR" para
      // animación/sonido. Esa columna incluye tanto los pedidos en estado
      // 'ready' como los recién completados (< 5 min), así que vigilamos ambos:
      // si el flujo marca el pedido directo como completado, igual suena.
      // El sonido NO suena cuando entra en preparación, solo al quedar listo.
      // En la primera carga NO sonamos (evita sonido al abrir la pantalla);
      // a partir de ahí suena aunque la lista pase de 0 a 1.
      const nowTs = Date.now();
      const recentCompleted = (json.completed || []).filter(o => {
        const t = new Date(o.completed_at).getTime();
        return (nowTs - t) < 5 * 60 * 1000;
      });
      const readyList = [...json.ready, ...recentCompleted];
      const prevReadyIds = new Set(prevReadyRef.current.map(o => o.id));
      const newReady = readyList.filter(o => !prevReadyIds.has(o.id));

      if (newReady.length > 0 && !firstLoadRef.current) {
        setHighlightOrder(newReady[0].order_number);
        setTimeout(() => setHighlightOrder(null), 5000);
        playBeep();
      }
      prevReadyRef.current = readyList;
      firstLoadRef.current = false;

      localStorage.setItem(TV_CODE_KEY, code);
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    const timeInterval = setInterval(() => setTime(new Date()), 1000);

    const socket = io(SOCKET_URL);
    socket.on('connect', () => {
      socket.emit('presence_join', { store_code: code, panel: 'tv' });
    });
    socket.on('reconnect', () => {
      socket.emit('presence_join', { store_code: code, panel: 'tv' });
    });
    socket.on('order_status_updated', () => fetchOrders());
    socket.on('new_order', () => fetchOrders());

    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
      socket.disconnect();
    };
  }, [code]);

  if (loading) {
    return (
      <div className="tv-loading">
        <div className="tv-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="tv-error">
        <h1>Error</h1>
        <p>{error}</p>
        <button
          onClick={() => { localStorage.removeItem(TV_CODE_KEY); navigate('/tv'); }}
          style={{ marginTop: '16px', padding: '10px 24px', background: '#D4AF37', border: 'none', borderRadius: '8px', color: '#0a0a0a', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}
        >
          Cambiar tienda
        </button>
      </div>
    );
  }

  const { store, preparing, ready, completed } = data;
  const formatTime = (d) => d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (d) => d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

  const now = new Date();
  // completed recientes (< 5 min) van en "Listos para retirar"
  const completedRecent = (completed || []).filter(o => {
    const t = new Date(o.completed_at);
    return (now - t) < 5 * 60 * 1000;
  });
  // completed viejos (>= 5 min) van en la franja "Entregados"
  const completedOld = (completed || []).filter(o => {
    const t = new Date(o.completed_at);
    return (now - t) >= 5 * 60 * 1000;
  });
  // columna "Listos para retirar" = ready + completedRecent
  const readyAndRecent = [...ready, ...completedRecent];

  return (
    <div
      className="tv-container"
      style={{
        '--tv-primary': store?.primary_color || '#000000',
        '--tv-secondary': store?.secondary_color || '#FFFFFF',
        '--tv-accent': store?.accent_color || '#D4AF37'
      }}
    >
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      {!started && (
        <div className="tv-start-overlay">
          {store?.logo_url && <img src={store.logo_url} alt="" className="tv-start-logo" />}
          <h1 className="tv-start-title">{store?.name || 'Pantalla de pedidos'}</h1>
          <button className="tv-start-btn" onClick={startMonitoring}>▶ COMENZAR MONITOREO</button>
          <p className="tv-start-hint">Tocá el botón para iniciar y activar el sonido</p>
        </div>
      )}

      <header className="tv-header">
        {store?.logo_url && <img src={store.logo_url} alt="" className="tv-logo" />}
        <h1 className="tv-store-name">{store?.name}</h1>
      </header>

      <main className="tv-main">
        <section className="tv-column tv-column-preparing">
          <div className="tv-column-header">
            <FontAwesomeIcon icon={faUtensils} className="tv-column-icon tv-icon-preparing" />
            <h2>EN PREPARACIÓN</h2>
            <span className="tv-column-count">{preparing.length}</span>
          </div>
          <div className="tv-orders-grid">
            {preparing.length === 0 ? (
              <div className="tv-empty">
                <FontAwesomeIcon icon={faClock} />
                <p>Sin pedidos</p>
              </div>
            ) : (
              preparing.map((order, idx) => (
                <div
                  key={order.id}
                  className="tv-order-card tv-order-preparing"
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >
                  <div className="tv-order-number">{order.order_number}</div>
                  <div className="tv-order-pulse" />
                </div>
              ))
            )}
          </div>
        </section>

        <section className="tv-column tv-column-ready">
          <div className="tv-column-header">
            <FontAwesomeIcon icon={faBell} className="tv-column-icon tv-icon-ready" />
            <h2>LISTOS PARA RETIRAR</h2>
            <span className="tv-column-count">{readyAndRecent.length}</span>
          </div>
          <div className="tv-orders-grid">
            {readyAndRecent.length === 0 ? (
              <div className="tv-empty">
                <FontAwesomeIcon icon={faCheckCircle} />
                <p>Ningún pedido listo</p>
              </div>
            ) : (
              readyAndRecent.map((order, idx) => (
                <div
                  key={order.id}
                  className={`tv-order-card tv-order-ready ${highlightOrder === order.order_number ? 'tv-highlight' : ''}`}
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >
                  <div className="tv-order-number">{order.order_number}</div>
                  <div className="tv-order-shine" />
                </div>
              ))
            )}
          </div>
        </section>

        {completedOld.length > 0 && (
          <section className="tv-column tv-column-completed" style={{ gridColumn: '1 / -1', maxHeight: '140px' }}>
            <div className="tv-column-header" style={{ marginBottom: '10px', paddingBottom: '8px', borderColor: '#555' }}>
              <FontAwesomeIcon icon={faCheckCircle} className="tv-column-icon" style={{ background: 'rgba(150,150,150,0.15)', color: '#888', fontSize: '14px', width: '28px', height: '28px', borderRadius: '8px' }} />
              <h2 style={{ fontSize: '12px', color: '#666', letterSpacing: '2px' }}>ENTREGADOS</h2>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {completedOld.map((order) => (
                <div key={order.id} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '4px 12px', color: '#555', fontWeight: '700', fontSize: '14px', textDecoration: 'line-through' }}>
                  {order.order_number}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {highlightOrder && (
        <div className="tv-popup-overlay">
          <div className="tv-popup">
            <FontAwesomeIcon icon={faBell} className="tv-popup-icon" />
            <p className="tv-popup-label">PEDIDO LISTO</p>
            <h2 className="tv-popup-number">{highlightOrder}</h2>
          </div>
        </div>
      )}

      <style>{`
        @keyframes tv-fade-in {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes tv-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6); }
          50% { box-shadow: 0 0 0 25px rgba(245, 158, 11, 0); }
        }

        @keyframes tv-shine {
          0% { transform: translateX(-100%) skewX(-20deg); }
          100% { transform: translateX(200%) skewX(-20deg); }
        }

        @keyframes tv-bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        @keyframes tv-popup-in {
          0% { opacity: 0; transform: scale(0.5); }
          50% { transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes tv-bell-shake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-15deg); }
          75% { transform: rotate(15deg); }
        }

        @keyframes tv-spin {
          to { transform: rotate(360deg); }
        }

        .tv-container {
          width: 100vw;
          height: 100vh;
          background: #0a0a0a;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: fixed;
          top: 0;
          left: 0;
        }

        .tv-loading, .tv-error {
          width: 100vw;
          height: 100vh;
          background: #0a0a0a;
          color: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: sans-serif;
        }

        .tv-spinner {
          width: 80px;
          height: 80px;
          border: 6px solid #222;
          border-top-color: var(--tv-accent, #D4AF37);
          border-radius: 50%;
          animation: tv-spin 1s linear infinite;
        }

        .tv-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 14px 28px;
          background: #000;
          border-bottom: 3px solid var(--tv-accent);
        }

        .tv-logo {
          height: 72px;
          width: auto;
          max-width: 160px;
          border-radius: 14px;
          object-fit: contain;
          border: 2px solid var(--tv-accent);
        }

        .tv-store-name {
          font-size: 22px;
          font-weight: 900;
          margin: 0;
          letter-spacing: 2px;
          color: #fff;
          text-transform: uppercase;
        }

        .tv-main {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr auto;
          gap: 0;
          overflow: hidden;
        }

        .tv-column {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 16px 20px;
        }

        .tv-column-preparing {
          background: #1a1410;
          border-right: 2px solid #000;
        }

        .tv-column-ready {
          background: #0f1a12;
        }

        .tv-column-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-bottom: 10px;
          margin-bottom: 14px;
          border-bottom: 2px solid;
        }

        .tv-column-preparing .tv-column-header {
          border-color: #f59e0b;
        }

        .tv-column-ready .tv-column-header {
          border-color: #22c55e;
        }

        .tv-column-header h2 {
          font-size: 15px;
          font-weight: 900;
          margin: 0;
          letter-spacing: 2px;
          flex: 1;
          color: #fff;
        }

        .tv-column-icon {
          font-size: 18px;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .tv-icon-preparing {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          animation: tv-bounce 2s infinite;
        }

        .tv-icon-ready {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
          animation: tv-bell-shake 1.5s ease-in-out infinite;
        }

        .tv-column-count {
          padding: 4px 12px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 900;
          min-width: 36px;
          text-align: center;
        }

        .tv-column-preparing .tv-column-count {
          background: #f59e0b;
          color: #000;
        }

        .tv-column-ready .tv-column-count {
          background: #22c55e;
          color: #000;
        }

        .tv-start-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: linear-gradient(160deg, #0a0a0a, #1a1a1a);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 24px;
          color: #fff;
          text-align: center;
          padding: 24px;
        }
        .tv-start-logo {
          width: 120px;
          height: 120px;
          object-fit: contain;
          border-radius: 20px;
          background: #fff;
        }
        .tv-start-title {
          font-size: clamp(28px, 5vw, 54px);
          font-weight: 900;
          margin: 0;
        }
        .tv-start-btn {
          padding: 22px 52px;
          font-size: clamp(24px, 3.4vw, 42px);
          font-weight: 900;
          letter-spacing: 1px;
          border: none;
          border-radius: 18px;
          background: #22c55e;
          color: #000;
          cursor: pointer;
          box-shadow: 0 12px 40px rgba(34, 197, 94, 0.45);
        }
        .tv-start-btn:active { transform: scale(0.97); }
        .tv-start-hint { font-size: 16px; color: #999; margin: 0; }

        .tv-orders-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(105px, 130px));
          gap: 10px;
          overflow-y: auto;
          align-content: start;
          align-items: start;
          justify-content: start;
        }

        .tv-orders-grid::-webkit-scrollbar { width: 0; }

        .tv-empty {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: #333;
          font-size: 14px;
          font-weight: 700;
          gap: 10px;
        }

        .tv-empty svg { font-size: 48px; opacity: 0.3; }

        .tv-order-card {
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          aspect-ratio: 1 / 1;      /* tarjeta cuadrada */
          font-weight: 900;
          position: relative;
          overflow: hidden;
          padding: 10px;
          animation: tv-fade-in 0.5s ease-out backwards;
        }

        .tv-order-preparing {
          background: #f59e0b;
          color: #000;
          box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.3);
          animation: tv-fade-in 0.5s ease-out backwards, tv-pulse 2s infinite;
        }

        .tv-order-ready {
          background: #22c55e;
          color: #000;
          box-shadow: 0 0 20px rgba(34, 197, 94, 0.4);
        }

        .tv-order-number {
          font-size: clamp(26px, 2.6vw, 42px);
          letter-spacing: -1px;
          line-height: 1;
          text-align: center;
          z-index: 2;
        }

        .tv-order-products {
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .tv-order-product {
          display: flex;
          align-items: baseline;
          gap: 6px;
          font-weight: 800;
        }

        .tv-order-product-qty {
          font-size: 14px;
          flex-shrink: 0;
          opacity: 0.75;
        }

        .tv-order-product-name {
          font-size: 14px;
          line-height: 1.25;
          font-weight: 700;
        }

        .tv-order-pulse {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 70%);
          pointer-events: none;
        }

        .tv-order-shine {
          position: absolute;
          top: 0;
          left: 0;
          width: 50%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          animation: tv-shine 3s infinite;
        }

        .tv-highlight {
          animation: tv-fade-in 0.5s ease-out, tv-bounce 0.8s infinite !important;
          box-shadow: 0 0 30px rgba(34, 197, 94, 0.8);
          transform: scale(1.05);
        }

        .tv-popup-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: tv-fade-in 0.3s;
        }

        .tv-popup {
          background: linear-gradient(135deg, #34d399 0%, #22c55e 100%);
          color: #000;
          padding: 30px 60px;
          border-radius: 24px;
          text-align: center;
          box-shadow: 0 20px 80px rgba(34, 197, 94, 0.6);
          animation: tv-popup-in 0.5s ease-out;
          border: 4px solid var(--tv-accent);
        }

        .tv-popup-icon {
          font-size: 48px;
          color: #000;
          animation: tv-bell-shake 1s ease-in-out infinite;
          margin-bottom: 12px;
        }

        .tv-popup-label {
          font-size: 18px;
          font-weight: 900;
          margin: 0 0 10px;
          letter-spacing: 4px;
        }

        .tv-popup-number {
          font-size: 120px;
          font-weight: 900;
          margin: 0;
          letter-spacing: -4px;
          line-height: 1;
        }
      `}</style>
    </div>
  );
}

export default TvDisplay;
