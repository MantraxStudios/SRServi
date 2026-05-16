import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBox, faClock, faCheck, faTimes, faSearch, faSignOutAlt, faUserCog, faMoneyBillWave, faPlus, faExternalLinkAlt, faUtensils, faShoppingBag, faMotorcycle, faConciergeBell, faPrint, faClipboardList, faExclamationTriangle, faCashRegister, faLock } from '@fortawesome/free-solid-svg-icons';
import { SOCKET_URL } from '../config.js';
import WorkerNewOrder from '../components/WorkerNewOrder';

const DAY_NAMES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const DAY_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const WEEK_ORDER = [1,2,3,4,5,6,0];

function AddonChip({ name, img, prefix, size = 'sm' }) {
  const dim = size === 'md' ? 22 : 16;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f5f5f5', borderRadius: 5, padding: size === 'md' ? '3px 7px 3px 3px' : '2px 5px 2px 2px', fontSize: size === 'md' ? 12 : 11, color: '#444', whiteSpace: 'nowrap' }}>
      {img
        ? <img src={img} alt={name} style={{ width: dim, height: dim, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />
        : prefix && <span style={{ color: '#888', fontSize: 10 }}>{prefix}</span>}
      {!img && prefix && ' '}{name}
    </span>
  );
}

function TaskDetailModal({ task, getTaskStatus, getCountdown, completeTask, completingTask, onClose }) {
  const status = getTaskStatus(task);
  const countdown = status === 'active' ? getCountdown(task) : null;

  const [dh, dm] = task.due_time.split(':').map(Number);
  const expireDate = new Date();
  expireDate.setHours(dh, dm + 60, 0, 0);
  const expireStr = expireDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const borderColor = status === 'completed' ? '#16a34a'
    : status === 'active' ? '#D4AF37'
    : status === 'expired' ? '#ef4444'
    : '#2a2a2a';

  const statusLabel = status === 'completed' ? 'Completada'
    : status === 'active' ? 'En curso'
    : status === 'expired' ? 'Vencida'
    : 'Pendiente';

  const completedTime = task.completed_at
    ? new Date(task.completed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          maxHeight: 'calc(100svh - 32px)',
          overflowY: 'auto',
          background: '#111',
          borderRadius: 20,
          border: `2px solid ${borderColor}`,
          padding: '20px 20px 24px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
        }}
      >
        {/* Cerrar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button
            onClick={onClose}
            style={{ background: '#1e1e1e', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '4px 10px', borderRadius: 8 }}
          >
            ×
          </button>
        </div>

        {/* Estado badge */}
        <div style={{ marginBottom: 12 }}>
          <span style={{
            fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20,
            color: borderColor, border: `1px solid ${borderColor}`,
            background: status === 'active' ? 'rgba(212,175,55,0.08)'
              : status === 'completed' ? 'rgba(22,163,74,0.08)'
              : status === 'expired' ? 'rgba(239,68,68,0.08)'
              : 'rgba(255,255,255,0.04)',
            letterSpacing: 0.5
          }}>
            {status === 'completed' && <FontAwesomeIcon icon={faCheck} style={{ marginRight: 5 }} />}
            {statusLabel}
          </span>
        </div>

        {/* Nombre */}
        <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
          {task.name}
        </h2>

        {/* Descripción */}
        {task.description && (
          <p style={{ margin: '0 0 16px', fontSize: 14, color: '#888', lineHeight: 1.6 }}>
            {task.description}
          </p>
        )}

        {/* Horario */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#1a1a1a', borderRadius: 10, padding: '10px 14px',
          marginBottom: 16, fontSize: 14, color: '#aaa'
        }}>
          <FontAwesomeIcon icon={faClock} style={{ color: '#D4AF37', fontSize: 13 }} />
          <span>Disponible desde <strong style={{ color: '#fff' }}>{task.due_time}</strong> hasta <strong style={{ color: '#fff' }}>{expireStr}</strong></span>
        </div>

        {/* Completada */}
        {status === 'completed' && completedTime && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 14, color: '#16a34a'
          }}>
            <FontAwesomeIcon icon={faCheck} />
            Completada a las <strong style={{ marginLeft: 4 }}>{completedTime}</strong>
          </div>
        )}

        {/* Countdown activo */}
        {status === 'active' && countdown && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.25)',
            borderRadius: 12, padding: '14px', marginBottom: 18
          }}>
            <FontAwesomeIcon icon={faClock} style={{ color: '#D4AF37', fontSize: 16 }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#D4AF37', letterSpacing: 2, lineHeight: 1 }}>
                {countdown}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>restantes para completar</div>
            </div>
          </div>
        )}

        {/* Botón completar */}
        {status === 'active' && (
          <button
            onClick={() => { completeTask(task.id); onClose(); }}
            disabled={completingTask === task.id}
            style={{
              width: '100%', padding: '16px',
              background: completingTask === task.id ? '#1a1a1a' : '#D4AF37',
              color: completingTask === task.id ? '#555' : '#000',
              border: 'none', borderRadius: 14,
              fontWeight: 900, fontSize: 16, letterSpacing: 0.3,
              cursor: completingTask === task.id ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'all 0.15s'
            }}
          >
            <FontAwesomeIcon icon={faCheck} />
            {completingTask === task.id ? 'Registrando...' : 'Marcar como completada'}
          </button>
        )}

        {status === 'expired' && (
          <div style={{
            textAlign: 'center', padding: '12px', fontSize: 13, color: '#ef4444',
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10
          }}>
            El tiempo para completar esta tarea ya venció
          </div>
        )}
      </div>
    </div>
  );
}

function MiniTaskCard({ task, getTaskStatus, getCountdown, completeTask, completingTask }) {
  const status = getTaskStatus(task);
  const [countdown, setCountdown] = useState(status === 'active' ? getCountdown(task) : null);

  useEffect(() => {
    if (status !== 'active') return;
    const interval = setInterval(() => setCountdown(getCountdown(task)), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const [dh, dm] = task.due_time.split(':').map(Number);
  const expireDate = new Date();
  expireDate.setHours(dh, dm + 60, 0, 0);
  const expireStr = expireDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const completedTime = task.completed_at
    ? new Date(task.completed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : null;

  const isCompleting = completingTask === task.id;

  const statusCfg = {
    active:    { label: 'Activa',     bg: 'rgba(212,175,55,0.12)',  color: '#D4AF37',  border: 'rgba(212,175,55,0.3)' },
    completed: { label: 'Completada', bg: 'rgba(22,163,74,0.10)',   color: '#16a34a',  border: 'rgba(22,163,74,0.25)' },
    expired:   { label: 'Vencida',    bg: 'rgba(239,68,68,0.10)',   color: '#ef4444',  border: 'rgba(239,68,68,0.25)' },
    upcoming:  { label: 'Próxima',    bg: 'rgba(255,255,255,0.06)', color: '#999',     border: 'rgba(255,255,255,0.1)' },
  }[status] || { label: status, bg: '#1a1a1a', color: '#888', border: '#333' };

  return (
    <div
      className="worker-order-card"
      style={{
        border: status === 'active' ? '2px solid #D4AF37' : '1px solid rgba(0,0,0,0.08)',
        boxShadow: status === 'active' ? '0 0 0 3px rgba(212,175,55,0.15), 0 2px 8px rgba(0,0,0,0.06)' : '0 2px 8px rgba(0,0,0,0.06)',
        opacity: status === 'completed' ? 0.7 : 1,
        cursor: 'default',
      }}
    >
      {/* Header: nombre + badge estado */}
      <div className="worker-order-header">
        <h3 className="worker-order-number">{task.name}</h3>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, flexShrink: 0,
          background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}`,
          letterSpacing: 0.5
        }}>
          {statusCfg.label}
        </span>
      </div>

      {/* Descripción — inline para que nunca quede oculta por el CSS móvil */}
      {task.description && (
        <div style={{ background: '#f8f8f8', borderRadius: 6, padding: '8px 10px', marginBottom: 10, display: 'block' }}>
          <span style={{ fontSize: 14, color: '#444', lineHeight: 1.5 }}>{task.description}</span>
        </div>
      )}

      {/* Horario */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#888', marginBottom: 12 }}>
        <FontAwesomeIcon icon={faClock} style={{ fontSize: 11, color: '#D4AF37' }} />
        {task.due_time} – {expireStr}
      </div>

      {/* Botón completar — ancho completo, bien grande en móvil */}
      {status === 'active' && (
        <button
          onClick={() => !isCompleting && completeTask(task.id)}
          disabled={isCompleting}
          style={{
            width: '100%', padding: '13px', borderRadius: 10, border: 'none',
            background: isCompleting ? '#d1fae5' : '#16a34a',
            color: isCompleting ? '#6b7280' : '#fff',
            fontSize: 15, fontWeight: 800, cursor: isCompleting ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: isCompleting ? 'none' : '0 2px 10px rgba(22,163,74,0.35)',
            transition: 'all 0.15s',
          }}
        >
          <FontAwesomeIcon icon={faCheck} />
          {isCompleting ? 'Registrando…' : 'Marcar como completada'}
        </button>
      )}

      {/* Completed badge */}
      {status === 'completed' && completedTime && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: '#f0fdf4', borderRadius: 10, color: '#16a34a', fontWeight: 700, fontSize: 14 }}>
          <FontAwesomeIcon icon={faCheck} /> Completada a las {completedTime}
        </div>
      )}

      {/* Countdown para activa */}
      {status === 'active' && countdown && (
        <p style={{ margin: '8px 0 0', textAlign: 'center', fontSize: 12, color: '#D4AF37', fontWeight: 700 }}>
          Tiempo restante: {countdown}
        </p>
      )}
    </div>
  );
}


function TasksTab({ tasks, completeTask, completingTask, taskError, setTaskError, tasksLoading, getTaskStatus, getCountdown }) {
  const todayDow = new Date().getDay();
  const todayTasks = tasks.filter(t => t.day_of_week === todayDow);
  const totalDone = todayTasks.filter(t => t.completed_at).length;

  if (tasksLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 16px', color: '#555', background: '#0a0a0a', height: 'calc(100svh - 155px)' }}>
        <div style={{
          width: '36px', height: '36px', border: '3px solid #222',
          borderTopColor: '#D4AF37', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 14px'
        }} />
        <span style={{ fontSize: '13px' }}>Cargando tareas...</span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100svh - 155px)',
      overflow: 'hidden',
      background: '#0a0a0a'
    }}>
      {/* Barra de progreso del día */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 12px', borderBottom: '1px solid #1e1e1e', flexShrink: 0
      }}>
        {taskError && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#f87171'
          }}>
            <FontAwesomeIcon icon={faExclamationTriangle} />
            <span style={{ flex: 1 }}>{taskError}</span>
            <button onClick={() => setTaskError('')} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )}
        {!taskError && (
          <>
            <span style={{ fontSize: 11, color: '#666', flexShrink: 0 }}>Hoy</span>
            <div style={{ flex: 1, height: 3, background: '#1e1e1e', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4, background: '#D4AF37',
                width: todayTasks.length > 0 ? ((totalDone / todayTasks.length) * 100) + '%' : '0%',
                transition: 'width 0.3s'
              }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#D4AF37', flexShrink: 0 }}>
              {totalDone}/{todayTasks.length}
            </span>
          </>
        )}
      </div>

      {/* Header hoy */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', borderBottom: '1px solid #1e1e1e',
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: 1 }}>
          {DAY_SHORT[todayDow]} — Hoy
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: totalDone === todayTasks.length && todayTasks.length > 0 ? '#16a34a' : '#666' }}>
          {totalDone}/{todayTasks.length} completadas
        </span>
      </div>

      <div className="worker-orders-list tasks-list" style={{
        flex: 1, overflowY: 'auto', padding: '12px',
        alignContent: 'start', scrollbarWidth: 'none'
      }}>
        {todayTasks.length === 0 ? (
          <div className="empty-state"><p>No hay tareas para hoy</p></div>
        ) : (
          todayTasks.map(task => (
            <MiniTaskCard
              key={task.id}
              task={task}
              getTaskStatus={getTaskStatus}
              getCountdown={getCountdown}
              completeTask={completeTask}
              completingTask={completingTask}
            />
          ))
        )}
      </div>
    </div>
  );
}

function WorkerPanel() {
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [pendingCashOrders, setPendingCashOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [storeColors, setStoreColors] = useState(null);
  const [showWorkerSwitch, setShowWorkerSwitch] = useState(false);
  const [switchingWorker, setSwitchingWorker] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
  const [procedures, setProcedures] = useState([]);
  const [selectedProc, setSelectedProc] = useState(null);
  const [procStep, setProcStep] = useState(0);
  const [prepTables, setPrepTables] = useState([]);
  const [activePrepTable, setActivePrepTable] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [addonImages, setAddonImages] = useState({}); // { 'nombre en minúscula': 'url imagen' }
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [storeCode, setStoreCode] = useState(() => {
    try { return JSON.parse(localStorage.getItem('worker') || '{}').store_code || ''; } catch { return ''; }
  });
  const [showPayModal, setShowPayModal] = useState(false);
  const [paySearch, setPaySearch] = useState('');
  const [payResult, setPayResult] = useState(null);
  const [cashRegister, setCashRegister] = useState(null);
  const [cashLoading, setCashLoading] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashOpeningAmount, setCashOpeningAmount] = useState('');
  const [showCloseCashModal, setShowCloseCashModal] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [completingTask, setCompletingTask] = useState(null);
  const [taskError, setTaskError] = useState('');
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [, setTick] = useState(0);

  const colors = storeColors || {
    primary: '#0a0a0a',
    secondary: '#ffffff',
    accent: '#D4AF37'
  };

  useEffect(() => {
    const workerData = localStorage.getItem('worker');
    if (!workerData) {
      navigate('/worker-login');
      return;
    }

    const parsedWorker = JSON.parse(workerData);
    setWorker(parsedWorker);

    fetchStoreColors(parsedWorker.store_id);
    fetchOrders(parsedWorker.store_id);
    fetchWorkers(parsedWorker.store_id);
    fetchCashRegister();
    fetchTasks();
    if (parsedWorker.store_code) {
      const BASE = 'https://srservi2.srautomatic.com';
      const code = parsedWorker.store_code;

      fetch(`${BASE}/api/public/procedures/${code}`)
        .then(r => r.ok ? r.json() : []).then(data => setProcedures(Array.isArray(data) ? data : [])).catch(() => {});

      fetch(`${BASE}/api/public/prep-tables/${code}`)
        .then(r => r.ok ? r.json() : []).then(data => { if (Array.isArray(data)) setPrepTables(data); }).catch(() => {});

      // Cargar imágenes de extras e ingredientes para mostrar en órdenes
      Promise.all([
        fetch(`${BASE}/api/public/${code}/extras`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${BASE}/api/public/${code}/ingredients`).then(r => r.ok ? r.json() : []).catch(() => []),
      ]).then(([extras, ingredients]) => {
        const map = {};
        const toUrl = (img) => {
          if (!img) return null;
          return img.startsWith('http') ? img : BASE + img;
        };
        [...(extras || []), ...(ingredients || [])].forEach(item => {
          if (item.name && item.image) map[item.name.toLowerCase()] = toUrl(item.image);
        });
        setAddonImages(map);
      });
    }

    // Socket con reconexion automatica
    const socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000
    });

    socket.on('connect', () => {
      console.log('Socket conectado - recargando pedidos');
      socket.emit('register_store', parsedWorker.store_id);
      fetchOrders(parsedWorker.store_id);
      fetchCashRegister();
    });

    socket.on('new_order', (order) => {
      if (order.payment_process === 0 && order.payment_method !== 'mercadopago') {
        setPendingCashOrders(prev => [order, ...prev]);
      } else if (order.payment_process === 1) {
        setOrders(prev => [order, ...prev]);
      }
    });

    socket.on('cash_approved', (order) => {
      setPendingCashOrders(prev => prev.filter(o => o.id !== order.id));
      if (order.payment_process === 1) {
        setOrders(prev => [order, ...prev]);
      }
    });

    socket.on('payment_confirmed', (order) => {
      if (order.payment_process === 1) {
        setOrders(prev => {
          if (prev.find(o => o.id === order.id)) return prev;
          return [order, ...prev];
        });
      }
    });

    socket.on('order_updated', (updatedOrder) => {
      if (updatedOrder && updatedOrder.id) {
        if (updatedOrder.status === 'completed') {
          setOrders(prev => prev.filter(o => o.id !== updatedOrder.id));
          setCompletedOrders(prev => {
            if (prev.find(o => o.id === updatedOrder.id)) return prev;
            return [updatedOrder, ...prev];
          });
        } else {
          setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
        }
      } else {
        fetchOrders(parsedWorker.store_id);
      }
    });

    socket.on('order_deleted', () => {
      fetchOrders(parsedWorker.store_id);
    });

    socket.on('cash_register_changed', (data) => {
      setCashRegister(data.open ? data.register : null);
    });

    // Countdown timer for active tasks (every second)
    const tickInterval = setInterval(() => setTick(t => t + 1), 1000);

    // Polling de respaldo cada 30 segundos
    const pollInterval = setInterval(() => {
      fetchOrders(parsedWorker.store_id);
      fetchTasks();
      fetchCashRegister();
    }, 30000);

    // Recargar cuando la ventana recupera el foco
    const handleFocus = () => {
      fetchOrders(parsedWorker.store_id);
      fetchTasks();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      socket.disconnect();
      clearInterval(tickInterval);
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [navigate]);

  const fetchCashRegister = async () => {
    const workerData = localStorage.getItem('worker');
    if (!workerData) return;
    const parsedWorker = JSON.parse(workerData);
    try {
      const res = await fetch(`/api/cash-register/status/${parsedWorker.store_id}`);
      if (res.ok) {
        const data = await res.json();
        setCashRegister(data.open ? data.register : null);
      }
    } catch (e) {
      console.error('Error fetching cash register:', e);
    }
  };

  const openCashRegisterFn = async () => {
    const token = localStorage.getItem('workerToken');
    setCashLoading(true);
    try {
      const res = await fetch('/api/cash-register/open', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ opening_amount: parseFloat(cashOpeningAmount) || 0 })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Error al abrir caja'); return; }
      setCashRegister(data);
      setCashOpeningAmount('');
      setShowCashModal(false);
    } catch (e) {
      alert('Error de conexión');
    } finally {
      setCashLoading(false);
    }
  };

  const closeCashRegisterFn = async () => {
    const token = localStorage.getItem('workerToken');
    setCashLoading(true);
    try {
      const res = await fetch('/api/cash-register/close', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Error al cerrar caja'); return; }
      setCashRegister(null);
      setShowCloseCashModal(false);
      setShowCashModal(false);
    } catch (e) {
      alert('Error de conexión');
    } finally {
      setCashLoading(false);
    }
  };

  const fetchStoreColors = async (storeId) => {
    try {
      const token = localStorage.getItem('workerToken');
      const response = await fetch(`/api/stores/${storeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Store not found');
      const data = await response.json();
      setStoreColors({
        primary: data.primary_color || '#0a0a0a',
        secondary: data.secondary_color || '#ffffff',
        accent: data.accent_color || '#D4AF37'
      });
      if (data.code) setStoreCode(data.code);
    } catch (error) {
      console.error('Error fetching store colors:', error);
    }
  };

  const downloadPrepTablePDF = (table) => {
    const cols = table.columns || [];
    const defaultRows = table.rows || 8;
    const maxRows = cols.length > 0 ? Math.max(1, ...cols.map(c => c.rows || defaultRows)) : defaultRows;
    const isLandscape = cols.length > 4;
    const storeName = worker?.store_name || 'SRServi';
    const headerCells = cols.map(col => `<th>${col.name}</th>`).join('');
    const bodyRows = Array.from({ length: maxRows }, (_, rowIdx) => {
      const tds = cols.map(col => {
        const colRows = col.rows || defaultRows;
        if (rowIdx >= colRows) return `<td class="empty"></td>`;
        const cell = (table.cells || {})[`${col.id}_${rowIdx}`] || {};
        const imgUrl = cell.image_url ? (cell.image_url.startsWith('http') ? cell.image_url : 'https://srservi2.srautomatic.com' + cell.image_url) : null;
        let content = '';
        if (imgUrl) content += `<img src="${imgUrl}" class="cell-img">`;
        if (cell.name) content += `<div class="cell-name">${cell.name}</div>`;
        if (cell.note) content += `<div class="cell-note">${cell.note}</div>`;
        return `<td>${content || '<span class="empty-cell">—</span>'}</td>`;
      }).join('');
      return `<tr><td class="row-num">${rowIdx + 1}</td>${tds}</tr>`;
    }).join('');
    const css = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:10px}.hdr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px;padding-bottom:10px;border-bottom:3px solid #000}.hdr h1{font-size:18px;font-weight:800}.hdr p{font-size:11px;color:#666;margin-top:3px}.hdr-r{text-align:right;font-size:11px;color:#666}table{width:100%;border-collapse:collapse}th{background:#111;color:#D4AF37;padding:8px 10px;font-size:11px;font-weight:800;text-align:center;border:1px solid #333}td{padding:6px 8px;border:1px solid #ddd;vertical-align:middle;text-align:center}.row-num{font-weight:800;font-size:13px;color:#D4AF37;background:#111;width:32px}.empty{background:#f5f5f5}.cell-img{width:60px;height:60px;object-fit:cover;border-radius:6px;display:block;margin:0 auto 4px}.cell-name{font-weight:700;font-size:12px;line-height:1.2}.cell-note{font-size:10px;color:#666;margin-top:2px}.empty-cell{color:#ccc}.footer{margin-top:14px;padding-top:10px;border-top:1px solid #ddd;font-size:10px;color:#888;text-align:center}@media print{body{padding:0}@page{size:A4 ${isLandscape ? 'landscape' : 'portrait'};margin:12mm}}`;
    const date = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${table.title || 'Tabla de preparación'}</title><style>${css}</style></head><body><div class="hdr"><div><h1>${table.title || 'Tabla de preparación'}</h1><p>${storeName}</p></div><div class="hdr-r"><p>${date}</p></div></div><table><thead><tr><th>#</th>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table><div class="footer">SRServi — ${storeName} — ${new Date().toLocaleString('es-ES')}</div></body></html>`;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Permite ventanas emergentes para generar el PDF.'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 700);
  };

  const downloadTodayPDF = () => {
    const all = [...(orders || []), ...(completedOrders || []), ...(pendingCashOrders || [])];
    if (!all.length) { alert('No hay pedidos hoy para exportar.'); return; }
    const seen = new Set();
    const todayOrders = all
      .filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true; })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const sl = s => ({ pending: 'Pendiente', preparing: 'En preparación', ready: 'Listo', completed: 'Completado' })[s] || s || '';
    const tl = t => ({ serve: 'Aquí', takeout: 'Para llevar', delivery: 'Delivery', pedidosya: 'PedidosYa', rappi: 'Rappi', ubereats: 'UberEats', mostrador: 'Mostrador' })[t] || 'Aquí';
    const fmt = d => d ? new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—';
    const fmtPrep = (c, x) => { if (!c || !x) return '—'; const m = Math.round((new Date(x)-new Date(c))/60000); return m < 1 ? '< 1 min' : m + ' min'; };
    const done = todayOrders.filter(o => o.status === 'completed');
    const total = todayOrders.reduce((s, o) => s + Number(o.total||0), 0);
    const pts = done.filter(o=>o.created_at&&o.completed_at).map(o=>(new Date(o.completed_at)-new Date(o.created_at))/60000);
    const avg = pts.length ? Math.round(pts.reduce((a,b)=>a+b,0)/pts.length) : null;
    const byW = {};
    done.forEach(o => { const w=o.completed_by_name||'Sin asignar'; if(!byW[w])byW[w]={count:0,total:0}; byW[w].count++; byW[w].total+=Number(o.total||0); });
    const wRows = Object.entries(byW).map(([n,d]) => '<tr><td>'+n+'</td><td style="text-align:center">'+d.count+'</td><td style="text-align:right;font-weight:700">$'+d.total.toFixed(2)+'</td></tr>').join('');
    const oRows = todayOrders.map(o => {
      const items = (o.items||[]).map(i => {
        const ings = Array.isArray(i.selected_ingredients) ? i.selected_ingredients.map(x=>x.name||x).join(', ') : '';
        const exts = Array.isArray(i.selected_extras) ? i.selected_extras.map(x=>x.name||x).join(', ') : '';
        return '<div style="margin-bottom:3px"><strong>'+i.quantity+'x</strong> '+(i.product_name||i.name||'Producto')+(ings?'<br><span style="color:#666;font-size:11px">'+ings+'</span>':'')+(exts?'<br><span style="color:#888;font-size:11px">+ '+exts+'</span>':'')+'</div>';
      }).join('');
      const originalTotal = (o.items||[]).reduce((s,i) => s + Number(i.unit_price||0)*Number(i.quantity||1), 0);
      const finalTotal = Number(o.total||0);
      const priceModified = Math.abs(finalTotal - originalTotal) > 0.01;
      const totalCell = priceModified
        ? '<span style="color:#16a34a;font-weight:800;font-size:13px">✓</span> '
          + '<span style="text-decoration:line-through;color:#999;font-size:11px;margin-right:4px">$'+originalTotal.toFixed(2)+'</span>'
          + '<span style="font-weight:800;color:#15803d">$'+finalTotal.toFixed(2)+'</span>'
        : '<span style="color:#dc2626;font-size:12px;margin-right:3px">✗</span>'
          + '<span style="font-weight:800">$'+finalTotal.toFixed(2)+'</span>';
      const bg = o.status==='completed'?'#f0fff4':o.status==='preparing'?'#fffbeb':'#fff';
      return '<tr style="background:'+bg+'"><td style="font-weight:800;font-size:15px">'+getOrderDisplayNumber(o)+'</td><td>'+tl(o.order_type)+(o.table_number!=null?'<br><small>Mesa '+o.table_number+'</small>':'')+'</td><td>'+fmt(o.created_at)+'</td><td>'+(o.completed_at?fmt(o.completed_at):'—')+'</td><td style="font-weight:700">'+fmtPrep(o.created_at,o.completed_at)+'</td><td>'+sl(o.status)+'</td><td style="font-weight:600">'+(o.completed_by_name||'—')+'</td><td style="font-size:12px">'+(items||'—')+'</td><td style="text-align:right;white-space:nowrap">'+totalCell+'</td></tr>';
    }).join('');
    const ds = new Date().toLocaleDateString('es-ES',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    const sn = worker?.store_name||'Tienda';
    const wn = worker?.name||worker?.username||'Trabajador';
    const css = '*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:20px}'+
      '.top{display:flex;justify-content:space-between;margin-bottom:18px;padding-bottom:14px;border-bottom:3px solid #000}'+
      '.top h1{font-size:22px;font-weight:800}.top p{color:#555;font-size:12px;margin-top:3px}.top-right{text-align:right;font-size:12px;color:#555}'+
      '.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}'+
      '.stat{background:#f5f5f5;border-radius:8px;padding:10px 14px;border-left:4px solid #D4AF37}'+
      '.stat-label{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.5px}.stat-value{font-size:20px;font-weight:800;margin-top:2px}'+
      'h2{font-size:13px;font-weight:800;text-transform:uppercase;margin:20px 0 8px;padding-bottom:5px;border-bottom:2px solid #D4AF37}'+
      'table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px}'+
      'th{background:#111;color:#fff;padding:8px;text-align:left;font-size:11px}td{padding:7px 8px;border-bottom:1px solid #e5e5e5;vertical-align:top}'+
      '.footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#888;text-align:center}'+
      '@media print{body{padding:8px}@page{margin:12mm;size:A4 landscape}}';
    const html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Informe '+sn+'</title><style>'+css+'</style></head><body>'+
      '<div class="top"><div><h1>'+sn+'</h1><p>Informe de pedidos del día</p><p>'+ds+'</p></div><div class="top-right"><p>Generado por: <strong>'+wn+'</strong></p><p>Hora: '+new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})+'</p></div></div>'+
      '<div class="stats"><div class="stat"><div class="stat-label">Total pedidos</div><div class="stat-value">'+todayOrders.length+'</div></div><div class="stat"><div class="stat-label">Completados</div><div class="stat-value">'+done.length+'</div></div><div class="stat"><div class="stat-label">Ingresos totales</div><div class="stat-value">$'+total.toFixed(2)+'</div></div><div class="stat"><div class="stat-label">Tiempo prom. prep.</div><div class="stat-value">'+(avg!=null?avg+' min':'—')+'</div></div></div>'+
      (wRows?'<h2>Rendimiento por Trabajador</h2><table><thead><tr><th>Trabajador</th><th>Pedidos</th><th>Total gestionado</th></tr></thead><tbody>'+wRows+'</tbody></table>':'')+
      '<h2>Detalle de Pedidos</h2><table><thead><tr><th>#</th><th>Tipo</th><th>Entrada</th><th>Salida</th><th>Tiempo prep.</th><th>Estado</th><th>Atendido por</th><th>Productos</th><th>Total</th></tr></thead><tbody>'+oRows+'</tbody></table>'+
      '<div class="footer">SRServi — '+sn+' — '+new Date().toLocaleString('es-ES')+'</div></body></html>';
    const win = window.open('', '_blank', 'width=1050,height=750');
    if (!win) { alert('Permite ventanas emergentes para generar el PDF.'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };
  const fetchOrders = async (storeId) => {
    try {
      const token = localStorage.getItem('workerToken');
      console.log('Fetching orders for store:', storeId);
      const response = await fetch(`/api/orders/store/${storeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('Orders response status:', response.status);

      if (response.status === 403) {
        console.log('403 Forbidden - redirecting to login');
        navigate('/worker-login');
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch orders:', errorText);
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();

      // Only show today's orders
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = data.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate >= today;
      });

      const activeOrders = todayOrders.filter(o => o.status !== 'completed' && o.payment_process === 1);
      const completed = todayOrders.filter(o => o.status === 'completed');
      const pendingCash = todayOrders.filter(o => o.payment_process === 0 && o.status !== 'completed' && o.status !== 'cancelled' && o.payment_method !== 'mercadopago');
      setOrders(activeOrders);
      setCompletedOrders(completed);
      setPendingCashOrders(pendingCash);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkers = async (storeId) => {
    try {
      const token = localStorage.getItem('workerToken');
      const response = await fetch(`/api/workers?store_id=${storeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setWorkers(data);
      }
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  };

  const fetchTasks = async () => {
    const token = localStorage.getItem('workerToken');
    if (!token) return;
    setTasksLoading(true);
    try {
      const res = await fetch('/api/worker-tasks', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error fetching tasks:', e);
    } finally {
      setTasksLoading(false);
    }
  };

  const completeTask = async (taskId) => {
    const token = localStorage.getItem('workerToken');
    setCompletingTask(taskId); setTaskError('');
    try {
      const res = await fetch(`/api/worker-tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) { setTaskError(data.error || 'Error al marcar tarea'); return; }
      fetchTasks();
    } catch (e) {
      setTaskError('Error de conexión');
    } finally {
      setCompletingTask(null);
    }
  };

  const getTaskStatus = (task) => {
    if (task.completed_at) return 'completed';
    const now = new Date();
    const todayDow = now.getDay();
    if (todayDow < task.day_of_week) return 'upcoming';
    if (todayDow === task.day_of_week) {
      const [h, m] = task.due_time.split(':').map(Number);
      const due = new Date(); due.setHours(h, m, 0, 0);
      const expire = new Date(due.getTime() + 3600000);
      if (now < due) return 'upcoming';
      if (now <= expire) return 'active';
      return 'expired';
    }
    return 'expired';
  };

  const getCountdown = (task) => {
    const [h, m] = task.due_time.split(':').map(Number);
    const due = new Date(); due.setHours(h, m, 0, 0);
    const expire = new Date(due.getTime() + 3600000);
    const remaining = expire - new Date();
    if (remaining <= 0) return null;
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const switchWorker = (newWorker) => {
    const workerData = {
      ...newWorker,
      store_name: worker.store_name
    };
    localStorage.setItem('worker', JSON.stringify(workerData));
    setWorker(workerData);
    setShowWorkerSwitch(false);
    setSwitchingWorker(null);
    fetchOrders(newWorker.store_id);
    fetchTasks();
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      const token = localStorage.getItem('workerToken');
      const body = { status };
      if (status === 'completed') {
        body.worker_id = worker.id;
        body.worker_name = worker.name;
      }

      const response = await fetch(`/api/orders/${orderId}/status?store_id=${worker.store_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const updatedOrder = await response.json();

        if (status === 'completed') {
          const originalOrder = orders.find(o => o.id === orderId);
          setOrders(prev => prev.filter(o => o.id !== orderId));
          setCompletedOrders(prev => [{
            ...originalOrder,
            ...updatedOrder,
            status: 'completed'
          }, ...prev]);
        } else {
          setOrders(prev => prev.map(order =>
            order.id === orderId ? { ...order, status } : order
          ));
        }
      }
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('workerToken');
    localStorage.removeItem('worker');
    navigate('/worker-login');
  };

  const approveCashPayment = async (orderId) => {
    try {
      const token = localStorage.getItem('workerToken');
      const response = await fetch(`/api/orders/${orderId}/approve-cash?store_id=${worker.store_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          worker_id: worker.id,
          worker_name: worker.name
        })
      });

      if (response.ok) {
        const updatedOrder = await response.json();
        setPendingCashOrders(prev => prev.filter(o => o.id !== orderId));
        setOrders(prev => [{ ...updatedOrder, ...pendingCashOrders.find(o => o.id === orderId) }, ...prev]);
      }
    } catch (error) {
      console.error('Error approving cash payment:', error);
    }
  };

  const filteredOrders = (orders || []).filter(order => {
    const matchesFilter = filter === 'all' || order.status === filter;
    const matchesSearch = (order.order_number || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
                          (order.order_type || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filteredCompletedOrders = (completedOrders || []).filter(order => {
    const matchesSearch = (order.order_number || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
                          (order.order_type || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    return matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return colors.accent;
      case 'preparing': return '#f59e0b';
      case 'ready': return '#22c55e';
      case 'delivered': return '#6b7280';
      default: return colors.primary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return faClock;
      case 'preparing': return faBox;
      case 'ready': return faCheck;
      case 'completed': return faCheck;
      default: return faClock;
    }
  };

  const getOrderTypeInfo = (type) => {
    switch (type) {
      case 'serve': return { label: 'Aqui', icon: faUtensils, cls: 'serve' };
      case 'takeout': return { label: 'Llevar', icon: faShoppingBag, cls: 'takeout' };
      case 'delivery': return { label: 'Delivery', icon: faMotorcycle, cls: 'delivery' };
      case 'pedidosya': return { label: 'PedidosYa', icon: faMotorcycle, cls: 'pedidosya' };
      case 'rappi': return { label: 'Rappi', icon: faMotorcycle, cls: 'rappi' };
      case 'ubereats': return { label: 'UberEats', icon: faMotorcycle, cls: 'ubereats' };
      case 'mostrador': return { label: 'Mostrador', icon: faConciergeBell, cls: 'mostrador' };
      default: return { label: type || 'Aqui', icon: faUtensils, cls: 'serve' };
    }
  };

  const getOrderDisplayNumber = (order) => {
    if (order.order_number) return order.order_number;
    const id = order.id || 0;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const letter = letters[id % 26] || 'A';
    const num = (id % 99) + 1;
    return `${letter}${num.toString().padStart(2, '0')}`;
  };

  const reprintOrder = async (orderId) => {
    try {
      const token = localStorage.getItem('workerToken');
      await fetch(`/api/orders/${orderId}/reprint?store_id=${worker.store_id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error al solicitar reimpresión:', error);
    }
  };

  const closePayModal = () => {
    setShowPayModal(false);
    setPaySearch('');
    setPayResult(null);
  };

  const handlePaySearch = async (term) => {
    setPaySearch(term);
    if (!term.trim()) { setPayResult(null); return; }
    const t = term.trim().toUpperCase();

    const needsPayment = (o) => o.payment_process === 0 && o.payment_method !== 'mercadopago';

    // 1. Buscar en estado local
    const inPending = pendingCashOrders.find(o =>
      (o.order_number || '').toUpperCase() === t ||
      getOrderDisplayNumber(o).toUpperCase() === t
    );
    if (inPending) { setPayResult({ ...inPending, _needsPayment: true }); return; }

    const inActive = orders.find(o =>
      (o.order_number || '').toUpperCase() === t ||
      getOrderDisplayNumber(o).toUpperCase() === t
    );
    if (inActive) { setPayResult({ ...inActive, _needsPayment: false }); return; }

    // 2. Fallback: buscar en la API directamente
    try {
      const token = localStorage.getItem('workerToken');
      const resp = await fetch(`/api/orders/store/${worker.store_id}/find?q=${encodeURIComponent(term.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const found = await resp.json();
        if (found) {
          setPayResult({ ...found, _needsPayment: needsPayment(found) });
          return;
        }
      }
    } catch {}

    setPayResult(undefined);
  };

  const handleApprovePay = async () => {
    if (!payResult?._needsPayment) return;
    try {
      const token = localStorage.getItem('workerToken');
      const response = await fetch(`/api/orders/${payResult.id}/mark-paid?store_id=${worker.store_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ worker_id: worker.id, worker_name: worker.name })
      });
      if (response.ok) {
        const updatedOrder = await response.json();
        setPendingCashOrders(prev => prev.filter(o => o.id !== payResult.id));
        setOrders(prev => {
          if (prev.find(o => o.id === updatedOrder.id)) return prev;
          const original = pendingCashOrders.find(o => o.id === payResult.id);
          return [{ ...(original || {}), ...updatedOrder }, ...prev];
        });
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
    }
    closePayModal();
  };

  if (loading) {
    return (
      <div className="loading-center">
        <div className="spinner"></div>
      </div>
    );
  }

  const avgPrepTime = (() => {
    const done = completedOrders.filter(o => o.created_at && o.completed_at);
    if (!done.length) return null;
    const avg = done.reduce((sum, o) => sum + (new Date(o.completed_at) - new Date(o.created_at)), 0) / done.length;
    const mins = Math.round(avg / 60000);
    return mins < 1 ? '< 1 min' : `${mins} min`;
  })();

  const stats = {
    pending: orders.filter(o => o.status === 'pending').length + pendingCashOrders.length,
    ready: completedOrders.length,
    total: [...orders, ...completedOrders, ...pendingCashOrders].reduce((s, o) => s + Number(o.total || 0), 0).toFixed(1)
  };

  return (
    <div className="worker-container" style={{
      '--store-primary': colors.primary,
      '--store-secondary': colors.secondary,
      '--store-accent': colors.accent
    }}>
      {/* Header compacto mobile-first */}
      <header className="worker-header">
        <div className="worker-header-top">
          <div className="worker-header-info">
            <h1 className="worker-header-title">{worker?.store_name || 'Tienda'}</h1>
            <p className="worker-header-subtitle">{worker?.name || worker?.username || 'Trabajador'}</p>
          </div>
          <div className="worker-header-right">
            <button
              onClick={() => setShowCashModal(true)}
              title={cashRegister ? 'Caja abierta — click para cerrar' : 'Abrir caja'}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '10px', border: 'none',
                background: cashRegister ? 'rgba(22,163,74,0.15)' : 'rgba(239,68,68,0.15)',
                color: cashRegister ? '#16a34a' : '#ef4444',
                cursor: 'pointer', fontWeight: 700, fontSize: '13px',
                transition: 'all 0.15s', flexShrink: 0
              }}
            >
              <FontAwesomeIcon icon={faCashRegister} />
              <span className="worker-btn-label">{cashRegister ? 'Caja' : 'Sin caja'}</span>
            </button>
            <button
              className="worker-action-primary"
              onClick={() => cashRegister ? setShowNewOrder(true) : setShowCashModal(true)}
              title={cashRegister ? 'Nuevo pedido' : 'Abre la caja para crear pedidos'}
              style={!cashRegister ? { opacity: 0.5 } : {}}
            >
              <FontAwesomeIcon icon={cashRegister ? faPlus : faLock} />
              <span className="worker-btn-label">Nuevo</span>
            </button>
            <button
              className="worker-action-primary green"
              onClick={() => cashRegister ? setShowPayModal(true) : setShowCashModal(true)}
              title={cashRegister ? 'Cobrar' : 'Abre la caja para cobrar'}
              style={!cashRegister ? { opacity: 0.5 } : {}}
            >
              <FontAwesomeIcon icon={cashRegister ? faMoneyBillWave : faLock} />
              <span className="worker-btn-label">Cobrar</span>
            </button>
            <button
              className="worker-header-icon-btn"
              onClick={downloadTodayPDF}
              disabled={!(orders.length || completedOrders.length || pendingCashOrders.length)}
              title="Generar PDF"
            >
              <FontAwesomeIcon icon={faPrint} />
            </button>
            {storeCode && (
              <button className="worker-header-icon-btn" onClick={() => window.open(`/store/${storeCode}`, '_blank')} title="Ver tienda">
                <FontAwesomeIcon icon={faExternalLinkAlt} />
              </button>
            )}
            <button className="worker-switch-btn" onClick={() => setShowWorkerSwitch(true)} title="Cambiar usuario">
              <FontAwesomeIcon icon={faUserCog} />
            </button>
            <button className="worker-logout-btn" onClick={handleLogout} title="Cerrar sesión">
              <FontAwesomeIcon icon={faSignOutAlt} />
            </button>
          </div>
        </div>

        {/* Stats en el header */}
        <div className="worker-stats-row">
          <div className="worker-stat preparing">
            <span className="worker-stat-num" style={{ fontSize: avgPrepTime ? '1rem' : undefined }}>
              {avgPrepTime ?? '—'}
            </span>
            <span className="worker-stat-label">T. Promedio</span>
          </div>
          <div className="worker-stat total">
            <span className="worker-stat-num" style={{ fontSize: '1rem', letterSpacing: 0 }}>${stats.total}</span>
            <span className="worker-stat-label">Vendido</span>
          </div>
        </div>
      </header>

      <div className="worker-controls">
        <div className="worker-search">
          <FontAwesomeIcon icon={faSearch} className="worker-search-icon" />
          <input
            type="text"
            placeholder="Buscar pedido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="worker-tabs-filters">
          <div className="worker-tabs">
            <button
              className={`worker-tab ${activeTab === 'active' ? 'active' : ''}`}
              onClick={() => setActiveTab('active')}
            >
              <FontAwesomeIcon icon={faClock} />
              Pendientes <span className="worker-tab-count">{orders.length}</span>
            </button>
            <button
              className={`worker-tab ${activeTab === 'completed' ? 'active' : ''}`}
              onClick={() => setActiveTab('completed')}
            >
              <FontAwesomeIcon icon={faCheck} />
              Completados <span className="worker-tab-count">{completedOrders.length}</span>
            </button>
            <button
              className={`worker-tab ${activeTab === 'tasks' ? 'active' : ''}`}
              onClick={() => { setActiveTab('tasks'); setTaskError(''); }}
            >
              <FontAwesomeIcon icon={faClipboardList} />
              Tareas{(() => { const n = tasks.filter(t => t.day_of_week === new Date().getDay() && !t.completed_at).length; return n > 0 ? <span className="worker-tab-count">{n}</span> : null; })()}
            </button>
            <button
              className={`worker-tab ${activeTab === 'procedures' ? 'active' : ''}`}
              onClick={() => setActiveTab('procedures')}
            >
              <FontAwesomeIcon icon={faClipboardList} />
              Guías
            </button>
          </div>
          {activeTab !== 'tasks' && activeTab !== 'procedures' && (
          <div className="worker-filters">
            {['all', 'pending', 'preparing', 'ready'].map(f => (
              <button
                key={f}
                className={`worker-filter-btn ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendiente' : f === 'preparing' ? 'Preparando' : 'Listo'}
              </button>
            ))}
          </div>
          )}
        </div>
      </div>

      <div className="worker-orders" style={activeTab === 'tasks' ? { padding: 0 } : undefined}>
        {activeTab === 'active' ? (
          filteredOrders.length === 0 ? (
            <div className="empty-state">
              <p>No hay pedidos activos</p>
            </div>
          ) : (
            <div className="worker-orders-list">
              {filteredOrders.map(order => (
                <div
                  key={order.id}
                  className="worker-order-card"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="worker-order-header">
                    <h3 className="worker-order-number">{getOrderDisplayNumber(order)}</h3>
                    <div className={`worker-order-type ${getOrderTypeInfo(order.order_type).cls}`}>
                      <FontAwesomeIcon icon={getOrderTypeInfo(order.order_type).icon} />
                      {getOrderTypeInfo(order.order_type).label}
                    </div>
                  </div>
                  {['rappi','pedidosya','ubereats'].includes(order.order_type) && (() => {
                    const cfg = {
                      rappi:     { bg: 'rgba(255,75,0,0.12)',  color: '#ff4b00', border: 'rgba(255,75,0,0.4)',   label: 'Rappi',     emoji: '🛵' },
                      pedidosya: { bg: 'rgba(250,0,80,0.10)',  color: '#fa0050', border: 'rgba(250,0,80,0.35)',  label: 'PedidosYa', emoji: '🏍️' },
                      ubereats:  { bg: 'rgba(6,193,103,0.12)', color: '#06c167', border: 'rgba(6,193,103,0.4)',  label: 'UberEats',  emoji: '🟢' },
                    }[order.order_type];
                    return (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                        borderRadius: '8px', padding: '3px 10px', fontSize: '12px', fontWeight: 800,
                        marginBottom: '6px', letterSpacing: '0.3px'
                      }}>
                        {cfg.emoji} {order.customer_name || `Pedido ${cfg.label}`}
                      </div>
                    );
                  })()}
                  {order.table_number != null && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      background: '#D4AF3722', color: '#92400e', border: '1px solid #D4AF37',
                      borderRadius: '8px', padding: '3px 10px', fontSize: '13px', fontWeight: 700,
                      marginBottom: '6px'
                    }}>
                      Mesa {order.table_number}
                    </div>
                  )}
                  <div className="worker-order-info">
                    <div className="worker-status-badge" style={{ backgroundColor: `${getStatusColor(order.status)}22`, color: getStatusColor(order.status) }}>
                      <FontAwesomeIcon icon={getStatusIcon(order.status)} />
                      {order.status}
                    </div>
                    <p className="worker-order-time">
                      {new Date(order.created_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  {order.items && order.items.length > 0 && (
                    <div className="worker-order-items-preview">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="worker-order-item-line">
                          <span className="worker-order-item-qty">{item.quantity}x</span>
                          <div className="worker-order-item-detail">
                            <span className="worker-order-item-name">{item.product_name || item.name || 'Producto'}</span>
                            {item.selected_ingredients && item.selected_ingredients.length > 0 && (
                              <div className="worker-order-item-addons">
                                {(Array.isArray(item.selected_ingredients) ? item.selected_ingredients : []).map((ing, i) => {
                                  const name = typeof ing === 'object' ? (ing.name || '') : (ing || '');
                                  const img = addonImages[name.toLowerCase()];
                                  return <AddonChip key={i} name={name} img={img} />;
                                })}
                              </div>
                            )}
                            {item.selected_extras && item.selected_extras.length > 0 && (
                              <div className="worker-order-item-addons">
                                {(Array.isArray(item.selected_extras) ? item.selected_extras : []).map((ext, i) => {
                                  const name = typeof ext === 'object' ? (ext.name || '') : (ext || '');
                                  const img = addonImages[name.toLowerCase()];
                                  return <AddonChip key={i} name={name} img={img} prefix="+" />;
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                    <div className="worker-order-total" style={{ margin: 0 }}>
                      ${isNaN(order.total) ? '0.00' : Number(order.total).toFixed(2)}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); reprintOrder(order.id); }}
                        title="Reimprimir"
                        style={{
                          width: '34px', height: '34px', borderRadius: '50%',
                          background: 'rgba(212,175,55,0.15)', border: '1.5px solid #D4AF37',
                          color: '#D4AF37', cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem',
                          touchAction: 'manipulation'
                        }}
                      >
                        <FontAwesomeIcon icon={faPrint} />
                      </button>
                      <button
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); updateOrderStatus(order.id, 'completed'); }}
                        title="Marcar como completado"
                        style={{
                          width: '34px', height: '34px', borderRadius: '50%',
                          background: 'rgba(34,197,94,0.15)', border: '1.5px solid #22c55e',
                          color: '#22c55e', cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem',
                          touchAction: 'manipulation'
                        }}
                      >
                        <FontAwesomeIcon icon={faCheck} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'completed' ? (
          filteredCompletedOrders.length === 0 ? (
            <div className="empty-state">
              <p>No hay pedidos completados</p>
            </div>
          ) : (
            <div className="worker-orders-list">
              {filteredCompletedOrders.map(order => (
                <div
                  key={order.id}
                  className="worker-order-card completed"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="worker-order-header">
                    <h3 className="worker-order-number">{getOrderDisplayNumber(order)}</h3>
                    <div className={`worker-order-type ${getOrderTypeInfo(order.order_type).cls}`}>
                      <FontAwesomeIcon icon={getOrderTypeInfo(order.order_type).icon} />
                      {getOrderTypeInfo(order.order_type).label}
                    </div>
                  </div>
                  {['rappi','pedidosya','ubereats'].includes(order.order_type) && (() => {
                    const cfg = {
                      rappi:     { bg: 'rgba(255,75,0,0.12)',  color: '#ff4b00', border: 'rgba(255,75,0,0.4)',   label: 'Rappi',     emoji: '🛵' },
                      pedidosya: { bg: 'rgba(250,0,80,0.10)',  color: '#fa0050', border: 'rgba(250,0,80,0.35)',  label: 'PedidosYa', emoji: '🏍️' },
                      ubereats:  { bg: 'rgba(6,193,103,0.12)', color: '#06c167', border: 'rgba(6,193,103,0.4)',  label: 'UberEats',  emoji: '🟢' },
                    }[order.order_type];
                    return (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                        borderRadius: '8px', padding: '3px 10px', fontSize: '12px', fontWeight: 800,
                        marginBottom: '6px', letterSpacing: '0.3px'
                      }}>
                        {cfg.emoji} {order.customer_name || `Pedido ${cfg.label}`}
                      </div>
                    );
                  })()}
                  {order.table_number != null && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      background: '#D4AF3722', color: '#92400e', border: '1px solid #D4AF37',
                      borderRadius: '8px', padding: '3px 10px', fontSize: '13px', fontWeight: 700,
                      marginBottom: '6px'
                    }}>
                      Mesa {order.table_number}
                    </div>
                  )}
                  <div className="worker-order-info">
                    <div className="worker-status-badge completed-badge">
                      <FontAwesomeIcon icon={faCheck} /> Completado
                    </div>
                    <p className="worker-order-time">
                      {new Date(order.completed_at || order.created_at).toLocaleString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  {order.items && order.items.length > 0 && (
                    <div className="worker-order-items-preview">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="worker-order-item-line">
                          <span className="worker-order-item-qty">{item.quantity}x</span>
                          <div className="worker-order-item-detail">
                            <span className="worker-order-item-name">{item.product_name || item.name || 'Producto'}</span>
                            {item.selected_ingredients && item.selected_ingredients.length > 0 && (
                              <div className="worker-order-item-addons">
                                {(Array.isArray(item.selected_ingredients) ? item.selected_ingredients : []).map((ing, i) => {
                                  const name = typeof ing === 'object' ? (ing.name || '') : (ing || '');
                                  const img = addonImages[name.toLowerCase()];
                                  return <AddonChip key={i} name={name} img={img} />;
                                })}
                              </div>
                            )}
                            {item.selected_extras && item.selected_extras.length > 0 && (
                              <div className="worker-order-item-addons">
                                {(Array.isArray(item.selected_extras) ? item.selected_extras : []).map((ext, i) => {
                                  const name = typeof ext === 'object' ? (ext.name || '') : (ext || '');
                                  const img = addonImages[name.toLowerCase()];
                                  return <AddonChip key={i} name={name} img={img} prefix="+" />;
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                    <div className="worker-order-total" style={{ margin: 0 }}>
                      ${isNaN(order.total) ? '0.00' : Number(order.total).toFixed(2)}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); reprintOrder(order.id); }}
                      title="Reimprimir"
                      style={{
                        width: '34px', height: '34px', borderRadius: '50%',
                        background: 'rgba(212,175,55,0.15)', border: '1.5px solid #D4AF37',
                        color: '#D4AF37', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem',
                        flexShrink: 0
                      }}
                    >
                      <FontAwesomeIcon icon={faPrint} />
                    </button>
                  </div>
                  {order.completed_by_name && (
                    <p className="worker-order-completed-by">
                      Atendido por: <strong>{order.completed_by_name}</strong>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )
        ) : null}
        {activeTab === 'tasks' && (
          <div style={{ margin: 0, padding: 0 }}>
            <TasksTab
              tasks={tasks}
              completeTask={completeTask}
              completingTask={completingTask}
              taskError={taskError}
              setTaskError={setTaskError}
              tasksLoading={tasksLoading}
              getTaskStatus={getTaskStatus}
              getCountdown={getCountdown}
            />
          </div>
        )}
        {activeTab === 'procedures' && !selectedProc && (
          <div style={{ padding: '16px 12px 80px', maxWidth: 600, margin: '0 auto' }}>
            {/* Tablas de preparación */}
            {prepTables.length > 0 && (
              <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {prepTables.map(tbl => (
                  <button
                    key={tbl.id}
                    onClick={() => setActivePrepTable(tbl)}
                    style={{
                      width: '100%', padding: '14px 16px',
                      background: '#1a1a1a', border: '1px solid #2a2a2a',
                      borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 12
                    }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FontAwesomeIcon icon={faClipboardList} style={{ color: '#D4AF37', fontSize: 15 }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{tbl.title}</div>
                      <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                        {(tbl.columns || []).length} productos · {tbl.rows || 8} pasos
                      </div>
                    </div>
                    <span style={{ color: '#D4AF37', fontSize: 18 }}>›</span>
                  </button>
                ))}
              </div>
            )}
            {procedures.length === 0 && prepTables.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 24px', color: '#555' }}>
                <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 40, marginBottom: 14, display: 'block', margin: '0 auto 14px', color: '#333' }} />
                <div style={{ fontSize: 15, color: '#666' }}>No hay guías todavía.</div>
              </div>
            ) : procedures.length === 0 ? null : (

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {procedures.map(proc => {
                  const firstStep = proc.steps?.[0];
                  const imgUrl = firstStep?.image_url
                    ? (firstStep.image_url.startsWith('http') ? firstStep.image_url : 'https://srservi2.srautomatic.com' + firstStep.image_url)
                    : null;
                  return (
                    <button
                      key={proc.id}
                      onClick={() => { setSelectedProc(proc); setProcStep(0); }}
                      style={{
                        display: 'flex', alignItems: 'stretch', gap: 0,
                        background: '#161616', border: '1px solid #2a2a2a',
                        borderRadius: 14, overflow: 'hidden',
                        cursor: 'pointer', textAlign: 'left', padding: 0,
                        width: '100%'
                      }}
                    >
                      {imgUrl && (
                        <div style={{ width: 88, flexShrink: 0 }}>
                          <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </div>
                      )}
                      <div style={{ flex: 1, padding: '14px 16px', minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 5, lineHeight: 1.2 }}>{proc.title}</div>
                        {firstStep?.instruction && (
                          <div style={{ fontSize: 12, color: '#888', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {firstStep.instruction}
                          </div>
                        )}
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#D4AF37', background: 'rgba(212,175,55,0.1)', padding: '2px 8px', borderRadius: 20 }}>
                            {proc.steps?.length || 0} pasos
                          </span>
                          <span style={{ color: '#444', fontSize: 16, marginLeft: 'auto' }}>›</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'procedures' && selectedProc && (() => {
          const steps = selectedProc.steps || [];
          const step = steps[procStep];
          const imgUrl = step?.image_url
            ? (step.image_url.startsWith('http') ? step.image_url : 'https://srservi2.srautomatic.com' + step.image_url)
            : null;
          const isLast = procStep === steps.length - 1;
          const isFirst = procStep === 0;

          return (
            <div style={{
              display: 'flex', flexDirection: 'column',
              height: 'calc(100svh - 115px)',
              background: '#0d0d0d'
            }}>
              {/* Top bar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px',
                borderBottom: '1px solid #1e1e1e',
                flexShrink: 0
              }}>
                <button
                  onClick={() => setSelectedProc(null)}
                  style={{ background: '#1e1e1e', border: 'none', color: '#aaa', fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}
                >
                  ← Volver
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedProc.title}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#666', flexShrink: 0 }}>
                  {procStep + 1} / {steps.length}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 3, background: '#1e1e1e', flexShrink: 0 }}>
                <div style={{
                  height: '100%',
                  width: `${((procStep + 1) / steps.length) * 100}%`,
                  background: '#D4AF37',
                  transition: 'width 0.3s ease'
                }} />
              </div>

              {/* Step content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
                {/* Step number badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: '#D4AF37', color: '#000',
                    fontWeight: 900, fontSize: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {procStep + 1}
                  </div>
                  {step?.title && (
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                      {step.title}
                    </div>
                  )}
                </div>

                {/* Image */}
                {imgUrl && (
                  <div
                    onClick={() => setLightboxImg(imgUrl)}
                    style={{ cursor: 'zoom-in', borderRadius: 12, overflow: 'hidden', marginBottom: 18 }}
                  >
                    <img
                      src={imgUrl}
                      alt=""
                      style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                )}

                {/* Instruction */}
                {step?.instruction && (
                  <div style={{ fontSize: 15, color: '#ddd', lineHeight: 1.7, marginBottom: 16 }}>
                    {step.instruction}
                  </div>
                )}

                {/* Tip */}
                {step?.tip && (
                  <div style={{
                    background: 'rgba(212,175,55,0.08)',
                    border: '1px solid rgba(212,175,55,0.25)',
                    borderRadius: 10, padding: '10px 14px',
                    fontSize: 13, color: '#c9a227', lineHeight: 1.5
                  }}>
                    💡 {step.tip}
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div style={{
                display: 'flex', gap: 10, padding: '12px 16px 20px',
                borderTop: '1px solid #1e1e1e', flexShrink: 0
              }}>
                <button
                  onClick={() => setProcStep(s => s - 1)}
                  disabled={isFirst}
                  style={{
                    flex: 1, padding: '13px', borderRadius: 12, border: 'none',
                    background: isFirst ? '#1a1a1a' : '#222',
                    color: isFirst ? '#333' : '#aaa',
                    fontSize: 15, fontWeight: 700, cursor: isFirst ? 'default' : 'pointer'
                  }}
                >
                  ← Anterior
                </button>
                {isLast ? (
                  <button
                    onClick={() => setSelectedProc(null)}
                    style={{
                      flex: 1, padding: '13px', borderRadius: 12, border: 'none',
                      background: '#D4AF37', color: '#000',
                      fontSize: 15, fontWeight: 800, cursor: 'pointer'
                    }}
                  >
                    ✓ Listo
                  </button>
                ) : (
                  <button
                    onClick={() => setProcStep(s => s + 1)}
                    style={{
                      flex: 1, padding: '13px', borderRadius: 12, border: 'none',
                      background: '#D4AF37', color: '#000',
                      fontSize: 15, fontWeight: 800, cursor: 'pointer'
                    }}
                  >
                    Siguiente →
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {selectedOrder && (
        <div className="worker-modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="worker-modal" onClick={e => e.stopPropagation()}>
            <div className="worker-modal-header">
              <h2 className="worker-modal-title">Pedido #{getOrderDisplayNumber(selectedOrder)}</h2>
              <button className="worker-modal-close" onClick={() => setSelectedOrder(null)}>x</button>
            </div>

            <div className="worker-detail-row">
              <span className="worker-detail-label">Tipo:</span>
              <span className="worker-detail-value flex items-center gap-2">
                <FontAwesomeIcon icon={getOrderTypeInfo(selectedOrder.order_type).icon} />
                {getOrderTypeInfo(selectedOrder.order_type).label}
              </span>
            </div>
            {selectedOrder.table_number != null && (
              <div className="worker-detail-row">
                <span className="worker-detail-label">Mesa:</span>
                <span className="worker-detail-value" style={{ color: '#D4AF37', fontWeight: 800, fontSize: '18px' }}>
                  {selectedOrder.table_number}
                </span>
              </div>
            )}
            {selectedOrder.customer_name && (
              <div className="worker-detail-row">
                <span className="worker-detail-label">Cliente:</span>
                <span className="worker-detail-value">🛵 {selectedOrder.customer_name}{selectedOrder.customer_phone ? ` · ${selectedOrder.customer_phone}` : ''}</span>
              </div>
            )}
            <div className="worker-detail-row">
              <span className="worker-detail-label">Estado:</span>
              <span className="worker-detail-value">{selectedOrder.status}</span>
            </div>
            <div className="worker-detail-row">
              <span className="worker-detail-label">Total:</span>
              <span className="worker-detail-value">${isNaN(selectedOrder.total) ? '0.00' : Number(selectedOrder.total).toFixed(2)}</span>
            </div>

            {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <div className="worker-items-list">
                    <h4 className="worker-items-title">Productos:</h4>
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="worker-item-row flex-col">
                        <div className="flex justify-between w-full worker-item-main">
                          <span className="worker-detail-value">{item.quantity}x {item.product_name || item.name || 'Producto'}</span>
                          <span className="worker-detail-value">${(Number(item.unit_price) * Number(item.quantity)).toFixed(2)}</span>
                        </div>
                        {item.selected_ingredients && item.selected_ingredients.length > 0 && (
                          <div className="worker-item-extras">
                            <strong>Complementos: </strong>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: 4 }}>
                              {(Array.isArray(item.selected_ingredients) ? item.selected_ingredients : []).map((ing, i) => {
                                const name = typeof ing === 'object' ? (ing.name || '') : (ing || '');
                                const img = addonImages[name.toLowerCase()];
                                return <AddonChip key={i} name={name} img={img} size="md" />;
                              })}
                            </div>
                          </div>
                        )}
                        {item.selected_extras && item.selected_extras.length > 0 && (
                          <div className="worker-item-extras">
                            <strong>Extras: </strong>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: 4 }}>
                              {(Array.isArray(item.selected_extras) ? item.selected_extras : []).map((ext, i) => {
                                const name = typeof ext === 'object' ? (ext.name || '') : (ext || '');
                                const img = addonImages[name.toLowerCase()];
                                return <AddonChip key={i} name={name} img={img} size="md" prefix="+" />;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

            {selectedOrder.status !== 'completed' && (
              <div className="worker-modal-actions">
                <button
                  className="worker-action-btn complete"
                  onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}
                >
                  <FontAwesomeIcon icon={faCheck} /> Completado
                </button>
              </div>
            )}

            {selectedOrder.status === 'completed' && selectedOrder.completed_by_name && (
              <div className="worker-completed-info">
                <p className="worker-completed-text">
                  <FontAwesomeIcon icon={faCheck} /> Completado por <strong>{selectedOrder.completed_by_name}</strong>
                </p>
                {selectedOrder.completed_at && (
                  <p className="worker-completed-date">
                    {new Date(selectedOrder.completed_at).toLocaleString('es-ES')}
                  </p>
                )}
              </div>
            )}

            <div className="worker-modal-actions modal-close-actions">
              <button
                className="worker-action-btn close"
                onClick={() => setSelectedOrder(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCashModal && (
        <div className="worker-modal-overlay" onClick={() => setShowCashModal(false)}>
          <div className="worker-modal" onClick={e => e.stopPropagation()}>
            <div className="worker-modal-header">
              <h2 className="worker-modal-title">
                <FontAwesomeIcon icon={faCashRegister} style={{ marginRight: 8 }} />
                {cashRegister ? 'Caja Abierta' : 'Abrir Caja'}
              </h2>
              <button className="worker-modal-close" onClick={() => setShowCashModal(false)}>x</button>
            </div>
            <div style={{ padding: '16px 0' }}>
              {cashRegister ? (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(22,163,74,0.15)', border: '2px solid #16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <FontAwesomeIcon icon={faCashRegister} style={{ fontSize: '28px', color: '#16a34a' }} />
                    </div>
                    <p style={{ color: '#16a34a', fontWeight: 700, fontSize: '15px', margin: '0 0 6px' }}>Caja abierta</p>
                    <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>
                      Por: <strong style={{ color: '#fff' }}>{cashRegister.worker_name}</strong>
                    </p>
                    <p style={{ color: '#555', fontSize: '12px', margin: '4px 0 0' }}>
                      Desde: {new Date(cashRegister.opened_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {cashRegister.opening_amount > 0 && (
                      <p style={{ color: '#D4AF37', fontSize: '13px', fontWeight: 700, margin: '6px 0 0' }}>
                        Apertura: ${Number(cashRegister.opening_amount).toLocaleString('es-CL')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowCloseCashModal(true)}
                    disabled={cashLoading}
                    style={{
                      width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                      background: 'rgba(239,68,68,0.15)',
                      color: '#ef4444',
                      fontWeight: 800, fontSize: '14px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                    Cerrar Caja
                  </button>
                </>
              ) : (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <FontAwesomeIcon icon={faLock} style={{ fontSize: '28px', color: '#ef4444' }} />
                    </div>
                    <p style={{ color: '#fff', fontWeight: 700, fontSize: '15px', margin: '0 0 4px' }}>Sin caja abierta</p>
                    <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>Debes abrir la caja para poder atender pedidos</p>
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', color: '#aaa', fontSize: '12px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Efectivo en caja al abrir
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={cashOpeningAmount}
                      onChange={e => setCashOpeningAmount(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') openCashRegisterFn(); }}
                      autoFocus
                      style={{
                        width: '100%', padding: '12px 14px', borderRadius: '10px',
                        border: '1.5px solid #333', background: '#111',
                        color: '#fff', fontSize: '20px', fontWeight: 700,
                        outline: 'none', boxSizing: 'border-box', textAlign: 'center'
                      }}
                    />
                  </div>
                  <button
                    onClick={openCashRegisterFn}
                    disabled={cashLoading}
                    style={{
                      width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                      background: cashLoading ? '#1a1a1a' : '#D4AF37',
                      color: cashLoading ? '#555' : '#000',
                      fontWeight: 800, fontSize: '14px', cursor: cashLoading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                  >
                    <FontAwesomeIcon icon={faCashRegister} />
                    {cashLoading ? 'Abriendo...' : 'Abrir Caja'}
                  </button>
                </>
              )}
            </div>
            <div className="worker-modal-actions">
              <button className="worker-action-btn close" onClick={() => setShowCashModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showCloseCashModal && (
        <div className="worker-modal-overlay" onClick={() => setShowCloseCashModal(false)}>
          <div className="worker-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="worker-modal-header">
              <h2 className="worker-modal-title">
                <FontAwesomeIcon icon={faTimes} style={{ marginRight: 8, color: '#ef4444' }} />
                Cerrar Caja
              </h2>
              <button className="worker-modal-close" onClick={() => setShowCloseCashModal(false)}>x</button>
            </div>
            <div style={{ padding: '16px 0', textAlign: 'center' }}>
              <p style={{ color: '#ccc', fontSize: '14px', margin: '0 0 12px' }}>
                ¿Seguro que deseas cerrar la caja?
              </p>
              <div style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 10, padding: '12px 20px', margin: '0 0 12px' }}>
                <p style={{ color: '#888', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Efectivo a cerrar</p>
                <p style={{ color: '#D4AF37', fontSize: '28px', fontWeight: 900, margin: 0 }}>
                  ${stats.total}
                </p>
              </div>
              <p style={{ color: '#666', fontSize: '12px', margin: 0 }}>
                Se enviará el informe del día por correo al dueño de la tienda.
              </p>
            </div>
            <div className="worker-modal-actions">
              <button
                className="worker-action-btn close"
                onClick={closeCashRegisterFn}
                disabled={cashLoading}
                style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 800 }}
              >
                {cashLoading ? 'Cerrando...' : 'Sí, cerrar caja'}
              </button>
              <button className="worker-action-btn" onClick={() => setShowCloseCashModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showWorkerSwitch && (
        <div className="worker-modal-overlay" onClick={() => setShowWorkerSwitch(false)}>
          <div className="worker-modal" onClick={e => e.stopPropagation()}>
            <div className="worker-modal-header">
              <h2 className="worker-modal-title">Cambiar Usuario</h2>
              <button className="worker-modal-close" onClick={() => setShowWorkerSwitch(false)}>x</button>
            </div>

            <div className="worker-list">
              {workers.map(w => (
                <div
                  key={w.id}
                  className={`worker-list-item ${w.id === worker.id ? 'selected' : ''}`}
                  onClick={() => w.id !== worker.id && switchWorker(w)}
                >
                  <div className="worker-avatar">
                    {w.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <span className="worker-list-name">{w.username}</span>
                  {w.id === worker.id && (
                    <span className="worker-current-badge">Actual</span>
                  )}
                </div>
              ))}
            </div>

            <div className="worker-modal-actions">
              <button
                className="worker-action-btn close"
                onClick={() => setShowWorkerSwitch(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showPayModal && (
        <div className="worker-modal-overlay pay-modal-overlay">
          <div className="worker-modal" style={{ display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="worker-modal-header">
              <h2 className="worker-modal-title">Cobrar Pedido</h2>
              <button className="worker-modal-close" onClick={closePayModal}>x</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: colors.secondary }}>Número de Pedido</label>
                <input
                  type="text"
                  inputMode="text"
                  value={paySearch}
                  onChange={e => handlePaySearch(e.target.value)}
                  placeholder="Ej: A01, B12..."
                  autoFocus
                  style={{
                    width: '100%', padding: '12px 14px', fontSize: '1.2rem',
                    background: '#1a1a1a', color: '#fff', border: `1px solid ${colors.accent}`,
                    borderRadius: '8px', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              {paySearch.trim() && payResult === undefined && (
                <div style={{ color: '#ef4444', textAlign: 'center', padding: '12px' }}>
                  No se encontró ningún pedido con ese número
                </div>
              )}

              {payResult && (
                <div style={{ background: '#1a1a1a', borderRadius: '8px', padding: '14px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Pedido:</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: '800', color: colors.accent }}>
                      #{getOrderDisplayNumber(payResult)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Tipo:</span>
                    <span style={{ color: '#fff', fontWeight: '600', fontSize: '13px' }}>
                      <FontAwesomeIcon icon={getOrderTypeInfo(payResult.order_type).icon} /> {getOrderTypeInfo(payResult.order_type).label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Total:</span>
                    <span style={{ color: '#22c55e', fontWeight: '800', fontSize: '1.2rem' }}>
                      ${isNaN(payResult.total) ? '0.00' : Number(payResult.total).toFixed(2)}
                    </span>
                  </div>
                  {payResult.items && payResult.items.length > 0 && (
                    <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                      {payResult.items.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '6px', padding: '3px 0', fontSize: '13px' }}>
                          <span style={{ color: colors.accent, fontWeight: '700', minWidth: '22px' }}>{item.quantity}x</span>
                          <span style={{ color: '#fff', fontWeight: '500' }}>{item.product_name || item.name || 'Producto'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ paddingTop: '12px', flexShrink: 0 }}>
              {payResult && (
                payResult._needsPayment ? (
                  <button
                    className="worker-action-btn approve"
                    style={{ width: '100%', justifyContent: 'center', fontSize: '1.05rem', padding: '14px', marginBottom: '10px' }}
                    onClick={handleApprovePay}
                  >
                    <FontAwesomeIcon icon={faCheck} /> Marcar como Pagado
                    {payResult.payment_method && payResult.payment_method !== 'cash' && (
                      <span style={{ fontSize: '0.8rem', opacity: 0.75, marginLeft: 6 }}>
                        ({payResult.payment_method})
                      </span>
                    )}
                  </button>
                ) : payResult.status === 'completed' ? (
                  <div style={{ color: '#22c55e', textAlign: 'center', padding: '8px', marginBottom: '10px', fontSize: '13px', fontWeight: 600 }}>
                    ✓ Pedido ya completado
                  </div>
                ) : (
                  <div style={{ color: '#f59e0b', textAlign: 'center', padding: '8px', marginBottom: '10px', fontSize: '13px' }}>
                    Este pedido ya está en cola (estado: {payResult.status})
                  </div>
                )
              )}
              <button className="worker-action-btn close" style={{ width: '100%', justifyContent: 'center' }} onClick={closePayModal}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showNewOrder && (
        <WorkerNewOrder
          worker={worker}
          storeId={worker.store_id}
          storeCode={storeCode}
          onClose={() => setShowNewOrder(false)}
          onOrderCreated={() => fetchOrders(worker.store_id)}
        />
      )}

      {/* Tabla de preparación full-screen */}
      {activePrepTable && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
            <button onClick={() => setActivePrepTable(null)}
              style={{ background: '#1e1e1e', border: 'none', borderRadius: 9, color: '#aaa', padding: '8px 12px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              ← Volver
            </button>
            <div style={{ flex: 1, fontWeight: 800, fontSize: 15, color: '#fff', textAlign: 'center' }}>
              {activePrepTable.title}
            </div>
            <button onClick={() => downloadPrepTablePDF(activePrepTable)}
              style={{ background: '#1e1e1e', border: 'none', borderRadius: 9, color: '#D4AF37', padding: '8px 12px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
              <FontAwesomeIcon icon={faPrint} />
              PDF A4
            </button>
            {prepTables.length > 1 && (
              <div style={{ display: 'flex', gap: 6 }}>
                {prepTables.map((tbl, i) => (
                  <button key={tbl.id} onClick={() => setActivePrepTable(tbl)}
                    style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                      background: activePrepTable.id === tbl.id ? '#D4AF37' : '#2a2a2a',
                      color: activePrepTable.id === tbl.id ? '#000' : '#888'
                    }}>
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '16px 12px 32px' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 14px', background: '#1a1a1a', color: '#fff', fontSize: 11, fontWeight: 700, borderRight: '1px solid #2a2a2a', width: 36, textAlign: 'center', position: 'sticky', left: 0, zIndex: 2 }}>#</th>
                  {(activePrepTable.columns || []).map(col => (
                    <th key={col.id} style={{ padding: '10px 16px', background: '#1a1a1a', color: '#D4AF37', fontSize: 12, fontWeight: 800, borderRight: '1px solid #2a2a2a', textAlign: 'center', whiteSpace: 'nowrap', minWidth: 120 }}>
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const cols = activePrepTable.columns || [];
                  const defaultRows = activePrepTable.rows || 8;
                  const maxRows = cols.length > 0 ? Math.max(1, ...cols.map(c => c.rows || defaultRows)) : defaultRows;
                  return Array.from({ length: maxRows }, (_, rowIdx) => (
                    <tr key={rowIdx} style={{ borderBottom: '1px solid #1a1a1a' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 900, fontSize: 16, color: '#D4AF37', textAlign: 'center', background: '#111', borderRight: '1px solid #2a2a2a', position: 'sticky', left: 0 }}>
                        {rowIdx + 1}
                      </td>
                      {cols.map(col => {
                        const colRows = col.rows || defaultRows;
                        if (rowIdx >= colRows) {
                          return <td key={col.id} style={{ padding: '10px 12px', borderRight: '1px solid #1a1a1a', background: '#060606', minWidth: 120 }} />;
                        }
                        const cell = (activePrepTable.cells || {})[`${col.id}_${rowIdx}`] || {};
                        const imgUrl = cell.image_url ? (cell.image_url.startsWith('http') ? cell.image_url : 'https://srservi2.srautomatic.com' + cell.image_url) : null;
                        return (
                          <td key={col.id} style={{ padding: '10px 12px', borderRight: '1px solid #1a1a1a', verticalAlign: 'middle', textAlign: 'center', minWidth: 120 }}>
                            {(cell.name || imgUrl) ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                {imgUrl && <img src={imgUrl} alt={cell.name} onClick={() => setLightboxImg(imgUrl)} style={{ width: 130, height: 130, objectFit: 'cover', borderRadius: 10, cursor: 'zoom-in' }} />}
                                {cell.name && <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{cell.name}</div>}
                                {cell.note && <div style={{ fontSize: 11, color: '#888', lineHeight: 1.2 }}>{cell.note}</div>}
                              </div>
                            ) : <span style={{ color: '#333', fontSize: 16 }}>—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.93)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', padding: 16
          }}
        >
          <img
            src={lightboxImg}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 10, objectFit: 'contain' }}
          />
          <button
            onClick={() => setLightboxImg(null)}
            style={{
              position: 'fixed', top: 16, right: 16,
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
              width: 40, height: 40, color: '#fff', fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1
            }}
          >✕</button>
        </div>
      )}
    </div>
  );
}

export default WorkerPanel;
