import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUtensils, faBell, faClock, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

const TV_CODE_KEY = 'srservi_tv_code';

function TvDisplay() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState({ store: null, preparing: [], ready: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [time, setTime] = useState(new Date());
  const [highlightOrder, setHighlightOrder] = useState(null);
  const prevReadyRef = useRef([]);
  const audioRef = useRef(null);

  const fetchOrders = async () => {
    try {
      const res = await fetch(`/api/store/${code}/tv-orders`);
      if (!res.ok) throw new Error('Tienda no encontrada');
      const json = await res.json();

      // Detect newly ready orders for animation/sound
      const prevReadyIds = new Set(prevReadyRef.current.map(o => o.id));
      const newReady = json.ready.filter(o => !prevReadyIds.has(o.id));
      if (newReady.length > 0 && prevReadyRef.current.length >= 0) {
        if (prevReadyRef.current.length > 0 || data.store) {
          setHighlightOrder(newReady[0].order_number);
          try {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {});
            }
          } catch {}
          setTimeout(() => setHighlightOrder(null), 5000);
        }
      }
      prevReadyRef.current = json.ready;

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

    const socket = io();
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

  const { store, preparing, ready } = data;
  const formatTime = (d) => d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (d) => d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

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
            <span className="tv-column-count">{ready.length}</span>
          </div>
          <div className="tv-orders-grid">
            {ready.length === 0 ? (
              <div className="tv-empty">
                <FontAwesomeIcon icon={faCheckCircle} />
                <p>Ningún pedido listo</p>
              </div>
            ) : (
              ready.map((order, idx) => (
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
          gap: 12px;
          padding: 12px 20px;
          background: #000;
          border-bottom: 3px solid var(--tv-accent);
        }

        .tv-logo {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          object-fit: cover;
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

        .tv-orders-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
          overflow-y: auto;
          align-content: start;
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
          aspect-ratio: 1;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          position: relative;
          overflow: hidden;
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
          font-size: 20px;
          letter-spacing: -0.5px;
          z-index: 2;
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
