import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClock, faCheck, faPlay, faChair, faUtensils, faShoppingBag,
  faMotorcycle, faConciergeBell, faBellSlash, faBell, faFire
} from '@fortawesome/free-solid-svg-icons';

// ── Helpers (self-contained so the board works standalone) ──
function getOrderDisplayNumber(order) {
  if (order.order_number) return order.order_number;
  const id = order.id || 0;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letter = letters[id % 26] || 'A';
  const num = (id % 99) + 1;
  return `${letter}${num.toString().padStart(2, '0')}`;
}

function getOrderTypeInfo(type) {
  switch (type) {
    case 'serve': return { label: 'Aquí', icon: faUtensils };
    case 'takeout': return { label: 'Llevar', icon: faShoppingBag };
    case 'delivery': return { label: 'Delivery', icon: faMotorcycle };
    case 'pedidosya': return { label: 'PedidosYa', icon: faMotorcycle };
    case 'rappi': return { label: 'Rappi', icon: faMotorcycle };
    case 'ubereats': return { label: 'UberEats', icon: faMotorcycle };
    case 'mostrador': return { label: 'Mostrador', icon: faConciergeBell };
    default: return { label: type || 'Aquí', icon: faUtensils };
  }
}

function AddonChip({ name, img, prefix }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 5, padding: '2px 7px 2px 2px', fontSize: 12, color: '#cfcfcf', whiteSpace: 'nowrap' }}>
      {img
        ? <img src={img} alt={name} style={{ width: 18, height: 18, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />
        : prefix && <span style={{ color: '#888', fontSize: 11, padding: '0 2px' }}>{prefix}</span>}
      {!img && prefix && ' '}{name}
    </span>
  );
}

// ── Beep generator (no audio asset needed) ──
function playBeep(ctx) {
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [0, 0.18].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 0 ? 880 : 1175;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.18);
    });
  } catch { /* ignore */ }
}

const COLUMNS = [
  { key: 'pending',   title: 'Pendiente',  color: '#3b82f6', next: 'preparing', btn: 'Empezar', btnIcon: faPlay },
  { key: 'preparing', title: 'Preparando', color: '#f59e0b', next: 'ready',     btn: 'Listo',   btnIcon: faCheck },
  { key: 'ready',     title: 'Listo',      color: '#22c55e', next: 'completed', btn: 'Entregar', btnIcon: faShoppingBag },
];

export default function KitchenBoard({ orders = [], onAdvance, addonImages = {}, variant = 'tab' }) {
  const [, setTick] = useState(0);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('kitchenSound') !== 'off');
  const [flashing, setFlashing] = useState(() => new Set());
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 760);
  const [mobileStage, setMobileStage] = useState('pending');
  const seenRef = useRef(null);
  const audioRef = useRef(null);

  // Re-render every 10s so the elapsed-time / urgency colors stay fresh
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(i);
  }, []);

  // Track viewport width for mobile layout
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth <= 760);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Detect newly arrived orders → beep + flash
  useEffect(() => {
    const ids = new Set(orders.map(o => o.id));
    if (seenRef.current === null) {
      seenRef.current = ids; // first load: don't alert for existing orders
      return;
    }
    const fresh = orders.filter(o => !seenRef.current.has(o.id));
    seenRef.current = ids;
    if (fresh.length > 0) {
      if (soundOn) {
        if (!audioRef.current) {
          try { audioRef.current = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* ignore */ }
        }
        if (audioRef.current?.state === 'suspended') audioRef.current.resume();
        playBeep(audioRef.current);
      }
      setFlashing(prev => {
        const next = new Set(prev);
        fresh.forEach(o => next.add(o.id));
        return next;
      });
      const freshIds = fresh.map(o => o.id);
      setTimeout(() => {
        setFlashing(prev => {
          const next = new Set(prev);
          freshIds.forEach(id => next.delete(id));
          return next;
        });
      }, 9000);
    }
  }, [orders, soundOn]);

  const toggleSound = () => {
    setSoundOn(prev => {
      const v = !prev;
      localStorage.setItem('kitchenSound', v ? 'on' : 'off');
      if (v) {
        if (!audioRef.current) {
          try { audioRef.current = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* ignore */ }
        }
        if (audioRef.current?.state === 'suspended') audioRef.current.resume();
        playBeep(audioRef.current);
      }
      return v;
    });
  };

  const grouped = {
    pending: orders.filter(o => o.status !== 'preparing' && o.status !== 'ready'),
    preparing: orders.filter(o => o.status === 'preparing'),
    ready: orders.filter(o => o.status === 'ready'),
  };
  // Oldest first within each column
  Object.values(grouped).forEach(arr => arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));

  const renderCard = (order, col) => {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(order.created_at)) / 60000));
    const urg = mins >= 15 ? '#ef4444' : mins >= 8 ? '#f59e0b' : '#22c55e';
    const ti = getOrderTypeInfo(order.order_type);
    const isFlashing = flashing.has(order.id);
    return (
      <div
        key={order.id}
        className={isFlashing ? 'kb-card-new' : undefined}
        style={{ background: '#141414', border: `2px solid ${isFlashing ? '#D4AF37' : urg}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', flexShrink: 0 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{getOrderDisplayNumber(order)}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 800, color: urg, background: `${urg}1f`, padding: '4px 10px', borderRadius: 20 }}>
            <FontAwesomeIcon icon={faClock} /> {mins}m
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '10px 14px 2px', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: '#D4AF37', background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', padding: '3px 10px', borderRadius: 8 }}>
            <FontAwesomeIcon icon={ti.icon} /> {ti.label}
          </span>
          {order.table_number != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,0.08)', padding: '3px 10px', borderRadius: 8 }}>
              <FontAwesomeIcon icon={faChair} /> Mesa {order.table_number}
            </span>
          )}
        </div>

        <div style={{ padding: '6px 14px 12px', flex: 1 }}>
          {(order.items || []).map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 12, padding: '9px 0', borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#D4AF37', minWidth: 38, lineHeight: 1.2 }}>{item.quantity}×</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.25 }}>{item.product_name || item.name || 'Producto'}</div>
                {Array.isArray(item.selected_ingredients) && item.selected_ingredients.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {item.selected_ingredients.map((ing, i) => {
                      const name = typeof ing === 'object' ? (ing.name || '') : (ing || '');
                      return <AddonChip key={i} name={name} img={addonImages[name.toLowerCase()]} />;
                    })}
                  </div>
                )}
                {Array.isArray(item.selected_extras) && item.selected_extras.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {item.selected_extras.map((ext, i) => {
                      const name = typeof ext === 'object' ? (ext.name || '') : (ext || '');
                      return <AddonChip key={i} name={name} img={addonImages[name.toLowerCase()]} prefix="+" />;
                    })}
                  </div>
                )}
                {item.notes && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#f59e0b', fontStyle: 'italic' }}>📝 {item.notes}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => onAdvance(order, col.next)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', background: col.key === 'pending' ? 'linear-gradient(135deg,#3b82f6,#2563eb)' : col.key === 'preparing' ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', color: '#fff', fontWeight: 900, fontSize: 16, cursor: 'pointer', letterSpacing: '0.02em' }}
        >
          <FontAwesomeIcon icon={col.btnIcon} /> {col.btn}
        </button>
      </div>
    );
  };

  const total = orders.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: variant === 'display' ? '100%' : 'auto', minHeight: 0 }}>
      <style>{`
        @keyframes kbPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(212,175,55,0.55); } 50% { box-shadow: 0 0 0 6px rgba(212,175,55,0); } }
        .kb-card-new { animation: kbPulse 1s ease-in-out infinite; }
        .kb-col::-webkit-scrollbar { width: 8px; }
        .kb-col::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 8px; }
      `}</style>

      {/* Sound toggle bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10, gap: 8 }}>
        <button
          onClick={toggleSound}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: soundOn ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${soundOn ? '#22c55e' : 'rgba(255,255,255,0.15)'}`, color: soundOn ? '#22c55e' : '#999', padding: '7px 14px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
        >
          <FontAwesomeIcon icon={soundOn ? faBell : faBellSlash} /> {soundOn ? 'Sonido activo' : 'Sonido apagado'}
        </button>
      </div>

      {total === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#666', padding: '60px 0' }}>
          <FontAwesomeIcon icon={faFire} style={{ fontSize: 46, marginBottom: 14, opacity: 0.4 }} />
          <p style={{ fontSize: 18, fontWeight: 700 }}>No hay nada por preparar</p>
        </div>
      ) : isNarrow ? (
        /* ── Móvil: selector de etapa + una columna a lo ancho ── */
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {COLUMNS.map(col => {
              const sel = mobileStage === col.key;
              return (
                <button
                  key={col.key}
                  onClick={() => setMobileStage(col.key)}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '9px 4px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${sel ? col.color : 'rgba(255,255,255,0.12)'}`, background: sel ? `${col.color}22` : 'rgba(255,255,255,0.03)' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 800, color: sel ? col.color : '#999', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{col.title}</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#fff', background: col.color, minWidth: 22, textAlign: 'center', padding: '1px 7px', borderRadius: 20 }}>{grouped[col.key].length}</span>
                </button>
              );
            })}
          </div>
          <div className="kb-col" style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {grouped[mobileStage].length === 0
              ? <div style={{ color: '#555', fontSize: 14, textAlign: 'center', padding: '40px 0' }}>Nada en esta etapa</div>
              : grouped[mobileStage].map(o => renderCard(o, COLUMNS.find(c => c.key === mobileStage)))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, flex: 1, minHeight: 0 }}>
          {COLUMNS.map(col => (
            <div key={col.key} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, background: 'rgba(255,255,255,0.02)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: `2px solid ${col.color}` }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: col.color, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{col.title}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', background: col.color, minWidth: 24, textAlign: 'center', padding: '2px 8px', borderRadius: 20 }}>{grouped[col.key].length}</span>
              </div>
              <div className="kb-col" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, overflowY: 'auto', flex: 1, minHeight: variant === 'display' ? 0 : 120 }}>
                {grouped[col.key].length === 0
                  ? <div style={{ color: '#555', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>—</div>
                  : grouped[col.key].map(o => renderCard(o, col))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
