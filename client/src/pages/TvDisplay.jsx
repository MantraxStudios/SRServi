import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUtensils, faBell, faClock, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

function TvDisplay() {
  const { code } = useParams();
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
        <div className="tv-header-left">
          {store?.logo_url && <img src={store.logo_url} alt="" className="tv-logo" />}
          <div>
            <h1 className="tv-store-name">{store?.name}</h1>
            <p className="tv-store-date">{formatDate(time)}</p>
          </div>
        </div>
        <div className="tv-header-right">
          <div className="tv-time">{formatTime(time)}</div>
        </div>
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
          background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
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
          background: #000;
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
          border: 6px solid #333;
          border-top-color: var(--tv-accent, #D4AF37);
          border-radius: 50%;
          animation: tv-spin 1s linear infinite;
        }

        .tv-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 40px;
          background: rgba(0, 0, 0, 0.4);
          border-bottom: 3px solid var(--tv-accent);
          backdrop-filter: blur(10px);
        }

        .tv-header-left {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .tv-logo {
          width: 70px;
          height: 70px;
          border-radius: 14px;
          object-fit: cover;
          border: 3px solid var(--tv-accent);
        }

        .tv-store-name {
          font-size: 36px;
          font-weight: 900;
          margin: 0;
          letter-spacing: 1px;
          color: #fff;
        }

        .tv-store-date {
          font-size: 16px;
          color: #999;
          margin: 4px 0 0;
          text-transform: capitalize;
        }

        .tv-time {
          font-size: 56px;
          font-weight: 900;
          color: var(--tv-accent);
          font-variant-numeric: tabular-nums;
          letter-spacing: -1px;
        }

        .tv-main {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          padding: 30px 40px;
          overflow: hidden;
        }

        .tv-column {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 24px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          border: 2px solid rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }

        .tv-column-preparing {
          border-top: 6px solid #f59e0b;
        }

        .tv-column-ready {
          border-top: 6px solid #22c55e;
        }

        .tv-column-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding-bottom: 20px;
          margin-bottom: 20px;
          border-bottom: 2px solid rgba(255, 255, 255, 0.1);
        }

        .tv-column-header h2 {
          font-size: 26px;
          font-weight: 900;
          margin: 0;
          letter-spacing: 2px;
          flex: 1;
          color: #fff;
        }

        .tv-column-icon {
          font-size: 32px;
        }

        .tv-icon-preparing {
          color: #f59e0b;
          animation: tv-bounce 2s infinite;
        }

        .tv-icon-ready {
          color: #22c55e;
          animation: tv-bell-shake 1.5s ease-in-out infinite;
        }

        .tv-column-count {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          padding: 6px 18px;
          border-radius: 20px;
          font-size: 22px;
          font-weight: 900;
          min-width: 50px;
          text-align: center;
        }

        .tv-column-preparing .tv-column-count {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }

        .tv-column-ready .tv-column-count {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .tv-orders-grid {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 20px;
          overflow-y: auto;
          align-content: start;
          padding: 4px;
        }

        .tv-orders-grid::-webkit-scrollbar { width: 0; }

        .tv-empty {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: #444;
          font-size: 18px;
          gap: 16px;
        }

        .tv-empty svg { font-size: 80px; }

        .tv-order-card {
          aspect-ratio: 1;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          position: relative;
          overflow: hidden;
          animation: tv-fade-in 0.5s ease-out backwards;
        }

        .tv-order-preparing {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          color: #000;
          animation: tv-fade-in 0.5s ease-out backwards, tv-pulse 2s infinite;
        }

        .tv-order-ready {
          background: linear-gradient(135deg, #34d399 0%, #22c55e 100%);
          color: #000;
        }

        .tv-order-number {
          font-size: 70px;
          letter-spacing: -2px;
          z-index: 2;
          text-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
          box-shadow: 0 0 60px rgba(34, 197, 94, 0.8);
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
          padding: 60px 100px;
          border-radius: 32px;
          text-align: center;
          box-shadow: 0 20px 80px rgba(34, 197, 94, 0.6);
          animation: tv-popup-in 0.5s ease-out;
          border: 6px solid var(--tv-accent);
        }

        .tv-popup-icon {
          font-size: 80px;
          color: #000;
          animation: tv-bell-shake 1s ease-in-out infinite;
          margin-bottom: 20px;
        }

        .tv-popup-label {
          font-size: 28px;
          font-weight: 900;
          margin: 0 0 16px;
          letter-spacing: 4px;
        }

        .tv-popup-number {
          font-size: 200px;
          font-weight: 900;
          margin: 0;
          letter-spacing: -8px;
          line-height: 1;
        }
      `}</style>
    </div>
  );
}

export default TvDisplay;
