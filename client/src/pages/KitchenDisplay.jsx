import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFire, faTimes, faExpand } from '@fortawesome/free-solid-svg-icons';
import { SOCKET_URL } from '../config.js';
import KitchenBoard from '../components/KitchenBoard';

const ADDON_BASE = 'https://srservi2.srautomatic.com';

export default function KitchenDisplay() {
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [orders, setOrders] = useState([]);
  const [addonImages, setAddonImages] = useState({});
  const [clock, setClock] = useState(new Date());

  const fetchOrders = async (storeId) => {
    try {
      const token = localStorage.getItem('workerToken');
      const res = await fetch(`/api/orders/store/${storeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const active = data.filter(o => {
        const d = new Date(o.created_at);
        return d >= today && o.status !== 'completed' && o.payment_process === 1
          && Array.isArray(o.items) && o.items.length > 0;
      });
      setOrders(active);
    } catch { /* ignore */ }
  };

  const advance = async (order, next) => {
    if (!worker) return;
    // Optimistic update
    if (next === 'completed') setOrders(prev => prev.filter(o => o.id !== order.id));
    else setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next } : o));
    try {
      const token = localStorage.getItem('workerToken');
      const body = { status: next };
      if (next === 'completed') { body.worker_id = worker.id; body.worker_name = worker.name; }
      await fetch(`/api/orders/${order.id}/status?store_id=${worker.store_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
    } catch {
      fetchOrders(worker.store_id);
    }
  };

  useEffect(() => {
    const workerData = localStorage.getItem('worker');
    if (!workerData) { navigate('/worker-login'); return; }
    const parsed = JSON.parse(workerData);
    setWorker(parsed);
    fetchOrders(parsed.store_id);

    // Addon images
    if (parsed.store_code) {
      const code = parsed.store_code;
      Promise.all([
        fetch(`${ADDON_BASE}/api/public/${code}/extras`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${ADDON_BASE}/api/public/${code}/ingredients`).then(r => r.ok ? r.json() : []).catch(() => []),
      ]).then(([extras, ingredients]) => {
        const map = {};
        const toUrl = (img) => img ? (img.startsWith('http') ? img : ADDON_BASE + img) : null;
        [...(extras || []), ...(ingredients || [])].forEach(it => {
          if (it.name && it.image) map[it.name.toLowerCase()] = toUrl(it.image);
        });
        setAddonImages(map);
      });
    }

    const socket = io(SOCKET_URL, {
      reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 10000
    });
    socket.on('connect', () => {
      socket.emit('register_store', parsed.store_id);
      fetchOrders(parsed.store_id);
    });
    socket.on('new_order', (order) => {
      if (order.payment_process === 1) setOrders(prev => prev.find(o => o.id === order.id) ? prev : [order, ...prev]);
    });
    socket.on('cash_approved', (order) => {
      if (order.payment_process === 1) setOrders(prev => prev.find(o => o.id === order.id) ? prev : [order, ...prev]);
    });
    socket.on('payment_confirmed', (order) => {
      if (order.payment_process === 1) setOrders(prev => prev.find(o => o.id === order.id) ? prev : [order, ...prev]);
    });
    socket.on('order_updated', (uo) => {
      if (uo && uo.id) {
        if (uo.status === 'completed') setOrders(prev => prev.filter(o => o.id !== uo.id));
        else setOrders(prev => prev.map(o => o.id === uo.id ? { ...o, ...uo } : o));
      } else fetchOrders(parsed.store_id);
    });
    socket.on('order_deleted', () => fetchOrders(parsed.store_id));

    const poll = setInterval(() => fetchOrders(parsed.store_id), 30000);
    const clockI = setInterval(() => setClock(new Date()), 1000 * 30);
    const onFocus = () => fetchOrders(parsed.store_id);
    window.addEventListener('focus', onFocus);

    return () => {
      socket.disconnect();
      clearInterval(poll);
      clearInterval(clockI);
      window.removeEventListener('focus', onFocus);
    };
  }, [navigate]);

  const goFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', display: 'flex', flexDirection: 'column', padding: 14, boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FontAwesomeIcon icon={faFire} style={{ color: '#D4AF37', fontSize: 24 }} />
          <div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 900, lineHeight: 1 }}>Cocina</div>
            <div style={{ color: '#888', fontSize: 12, marginTop: 3 }}>{worker?.store_name || ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ color: '#fff', fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {clock.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button onClick={goFullscreen} title="Pantalla completa" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', width: 40, height: 40, borderRadius: 10, cursor: 'pointer', fontSize: 16 }}>
            <FontAwesomeIcon icon={faExpand} />
          </button>
          <button onClick={() => navigate('/worker-panel')} title="Salir" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', width: 40, height: 40, borderRadius: 10, cursor: 'pointer', fontSize: 16 }}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <KitchenBoard orders={orders} onAdvance={advance} addonImages={addonImages} variant="display" />
      </div>
    </div>
  );
}
