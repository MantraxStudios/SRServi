import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBox, faClock, faCheck, faTimes, faSearch, faSignOutAlt, faUserCog, faMoneyBillWave, faPlus, faExternalLinkAlt, faUtensils, faShoppingBag, faMotorcycle, faConciergeBell, faPrint, faClipboardList, faExclamationTriangle, faCashRegister, faLock, faBook, faChair, faFire, faPlay, faTrophy, faCommentDots, faUserClock, faGift } from '@fortawesome/free-solid-svg-icons';
import { SOCKET_URL } from '../config.js';
import WorkerNewOrder from '../components/WorkerNewOrder';
import WorkerTableMap from '../components/WorkerTableMap';
import KitchenBoard from '../components/KitchenBoard';

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
    active:    { label: 'Activa',     bg: 'rgba(22,163,74,0.12)',   color: '#16a34a',  border: 'rgba(22,163,74,0.3)' },
    completed: { label: 'Completada', bg: 'rgba(22,163,74,0.10)',   color: '#16a34a',  border: 'rgba(22,163,74,0.25)' },
    expired:   { label: 'Vencida',    bg: 'rgba(239,68,68,0.10)',   color: '#ef4444',  border: 'rgba(239,68,68,0.25)' },
    upcoming:  { label: 'Próxima',    bg: 'rgba(255,255,255,0.06)', color: '#999',     border: 'rgba(255,255,255,0.1)' },
  }[status] || { label: status, bg: '#1a1a1a', color: '#888', border: '#333' };

  return (
    <div
      className="worker-order-card"
      style={{
        border: status === 'active' ? '2px solid #16a34a' : '1px solid rgba(0,0,0,0.08)',
        boxShadow: status === 'active' ? '0 0 0 3px rgba(22,163,74,0.2), 0 2px 8px rgba(0,0,0,0.06)' : '0 2px 8px rgba(0,0,0,0.06)',
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
  const raw = tasks.filter(t => t.day_of_week === todayDow);
  const statusOrder = { active: 0, pending: 1, expired: 2, completed: 3 };
  const todayTasks = [...raw].sort((a, b) =>
    (statusOrder[getTaskStatus(a)] ?? 9) - (statusOrder[getTaskStatus(b)] ?? 9)
  );
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
        flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '12px',
        alignContent: 'start', gridAutoRows: 'max-content', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch'
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
  const [whatsappOrders, setWhatsappOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [storeColors, setStoreColors] = useState(null);
  const [hideDecimals, setHideDecimals] = useState(false);
  const [showPrices, setShowPrices] = useState(true);
  const [showWorkerSwitch, setShowWorkerSwitch] = useState(false);
  const [switchingWorker, setSwitchingWorker] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
  const [procedures, setProcedures] = useState([]);
  const [selectedProc, setSelectedProc] = useState(null);
  const [procStep, setProcStep] = useState(0);
  const [prepTables, setPrepTables] = useState([]);
  const [activePrepTable, setActivePrepTable] = useState(null);
  const [customCreations, setCustomCreations] = useState([]);
  const [activeCustomCreation, setActiveCustomCreation] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [addonImages, setAddonImages] = useState({}); // { 'nombre en minúscula': 'url imagen' }
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [sellResetKey, setSellResetKey] = useState(0); // remonta la venta rápida embebida tras cada pedido
  // Abrir automáticamente la pantalla de venta al entrar (una sola vez por sesión)
  const autoOpenedNewOrderRef = useRef(false);
  const [storeCode, setStoreCode] = useState(() => {
    try { return JSON.parse(localStorage.getItem('worker') || '{}').store_code || ''; } catch { return ''; }
  });
  const [showPayModal, setShowPayModal] = useState(false);
  // ── Tarjeta de sellos ──
  const [showStampModal, setShowStampModal] = useState(false);
  const [stampConfig, setStampConfig] = useState(null);
  const [stampCodeW, setStampCodeW] = useState('');
  const [stampCardW, setStampCardW] = useState(null);
  const [stampBusy, setStampBusy] = useState(false);
  const [stampMsg, setStampMsg] = useState('');
  const [paySearch, setPaySearch] = useState('');
  const [payResult, setPayResult] = useState(null);
  const [cashRegister, setCashRegister] = useState(null);
  const [cashLoading, setCashLoading] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashOpeningAmount, setCashOpeningAmount] = useState('');
  const [showCloseCashModal, setShowCloseCashModal] = useState(false);
  const [cashSummary, setCashSummary] = useState(null);
  const [cashSummaryLoading, setCashSummaryLoading] = useState(false);
  const [showEgresoForm, setShowEgresoForm] = useState(false);
  const [egresoAmount, setEgresoAmount] = useState('');
  const [egresoDesc, setEgresoDesc] = useState('');
  const [egresoCategory, setEgresoCategory] = useState('Gasto');
  const [egresoSaving, setEgresoSaving] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [completingTask, setCompletingTask] = useState(null);
  const [taskError, setTaskError] = useState('');
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [, setTick] = useState(0);
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [panelTabs, setPanelTabs] = useState({});
  const [rankings, setRankings] = useState({ stores: [], workers: [] });
  const [rankingPeriod, setRankingPeriod] = useState('today');
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentSending, setCommentSending] = useState(false);

  const colors = storeColors || {
    primary: '#0a0a0a',
    secondary: '#ffffff',
    accent: '#D4AF37'
  };

  const formatPrice = (price) => {
    const num = Number(price);
    if (isNaN(num)) return hideDecimals ? '0' : '0.00';
    if (hideDecimals) {
      const fixed = num.toFixed(2);
      return fixed.endsWith('.00') ? String(Math.round(num)) : fixed;
    }
    return num.toFixed(2);
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
    fetchWhatsAppOrders(parsedWorker.store_id);
    fetchDeliveryOrders(parsedWorker.store_id);
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

      fetch(`${BASE}/api/public/custom-creations/${code}`)
        .then(r => r.ok ? r.json() : []).then(data => { if (Array.isArray(data)) setCustomCreations(data); }).catch(() => {});

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
      socket.emit('presence_join', { store_code: parsedWorker.store_code, panel: 'worker', store_name: parsedWorker.store_name });
      fetchOrders(parsedWorker.store_id);
      fetchWhatsAppOrders(parsedWorker.store_id);
      fetchCashRegister();
    });

    socket.on('new_order', (order) => {
      if (order.source === 'whatsapp') {
        setWhatsappOrders(prev => {
          if (prev.find(o => o.id === order.id)) return prev;
          return [order, ...prev];
        });
      }
      if (order.payment_process === 0 && order.payment_method !== 'mercadopago') {
        setPendingCashOrders(prev => {
          if (prev.find(o => o.id === order.id)) return prev;
          return [order, ...prev];
        });
      } else if (order.payment_process === 1) {
        setOrders(prev => {
          if (prev.find(o => o.id === order.id)) return prev;
          return [order, ...prev];
        });
      }
    });

    socket.on('cash_approved', (order) => {
      setPendingCashOrders(prev => prev.filter(o => o.id !== order.id));
      if (order.payment_process === 1) {
        setOrders(prev => {
          if (prev.find(o => o.id === order.id)) return prev;
          return [order, ...prev];
        });
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
      fetchDeliveryOrders(parsedWorker.store_id);
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

  // Al cargar el panel, si hay caja abierta, mostrar la venta de inmediato
  // (una sola vez) para agilizar el cobro en vez de la lista de pedidos.
  useEffect(() => {
    if (cashRegister && !autoOpenedNewOrderRef.current) {
      autoOpenedNewOrderRef.current = true;
      setShowNewOrder(true);
    }
  }, [cashRegister]);

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

  const fetchCashSummary = async () => {
    const token = localStorage.getItem('workerToken');
    setCashSummaryLoading(true);
    try {
      const res = await fetch('/api/cash-register/summary', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCashSummary(await res.json());
      } else {
        setCashSummary(null);
      }
    } catch (e) {
      setCashSummary(null);
    } finally {
      setCashSummaryLoading(false);
    }
  };

  const addEgreso = async () => {
    const amount = parseFloat(egresoAmount);
    if (!amount || amount <= 0) { alert('Ingresa un monto válido'); return; }
    const token = localStorage.getItem('workerToken');
    setEgresoSaving(true);
    try {
      const res = await fetch('/api/cash-register/movement', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description: egresoDesc.trim() || null, category: egresoCategory })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Error al registrar egreso'); return; }
      setEgresoAmount('');
      setEgresoDesc('');
      setEgresoCategory('Gasto');
      setShowEgresoForm(false);
      await fetchCashSummary();
    } catch (e) {
      alert('Error de conexión');
    } finally {
      setEgresoSaving(false);
    }
  };

  const deleteEgreso = async (id) => {
    const token = localStorage.getItem('workerToken');
    try {
      const res = await fetch(`/api/cash-register/movement/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) await fetchCashSummary();
    } catch (e) { /* silent */ }
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
      setCashSummary(null);
    } catch (e) {
      alert('Error de conexión');
    } finally {
      setCashLoading(false);
    }
  };

  useEffect(() => {
    if ((showCashModal && cashRegister) || showCloseCashModal) {
      fetchCashSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCashModal, showCloseCashModal, cashRegister]);

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
      setShowPrices(data.worker_show_prices === undefined ? true : !!data.worker_show_prices);
      if (data.worker_panel_tabs) {
        try { setPanelTabs(typeof data.worker_panel_tabs === 'string' ? JSON.parse(data.worker_panel_tabs) : data.worker_panel_tabs); } catch { setPanelTabs({}); }
      }
    } catch (error) {
      console.error('Error fetching store colors:', error);
    }
    try {
      const cfgRes = await fetch(`/api/public/store-configurations/${storeId}`);
      if (cfgRes.ok) {
        const cfgs = await cfgRes.json();
        const defaultCfg = Array.isArray(cfgs) ? (cfgs.find(c => c.is_default) || cfgs[0]) : null;
        if (defaultCfg) setHideDecimals(!!defaultCfg.hide_decimals);
      }
    } catch {}
  };

  const isTabVisible = (key) => panelTabs[key] !== false;

  const fetchRankings = async (period) => {
    if (!worker) return;
    setRankingsLoading(true);
    try {
      const res = await fetch(`/api/stores/${worker.store_id}/rankings?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setRankings(data);
      }
    } catch {} finally { setRankingsLoading(false); }
  };

  const fetchComments = async () => {
    if (!worker) return;
    try {
      const res = await fetch(`/api/stores/${worker.store_id}/worker-comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(Array.isArray(data) ? data : []);
      }
    } catch {}
  };

  const sendComment = async () => {
    if (!newComment.trim() || !worker) return;
    setCommentSending(true);
    try {
      const res = await fetch(`/api/stores/${worker.store_id}/worker-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worker_id: worker.id, worker_name: worker.name, comment: newComment.trim() })
      });
      if (res.ok) {
        setNewComment('');
        fetchComments();
      }
    } catch {} finally { setCommentSending(false); }
  };

  useEffect(() => {
    if (activeTab === 'rankings' && worker) fetchRankings(rankingPeriod);
  }, [activeTab, rankingPeriod, worker?.store_id]);

  useEffect(() => {
    if (activeTab === 'comments' && worker) fetchComments();
  }, [activeTab, worker?.store_id]);

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
    const total = done.reduce((s, o) => s + Number(o.total||0), 0);
    const pts = done.filter(o=>o.created_at&&o.completed_at).map(o=>(new Date(o.completed_at)-new Date(o.created_at))/60000);
    const avg = pts.length ? Math.round(pts.reduce((a,b)=>a+b,0)/pts.length) : null;
    const byW = {};
    done.forEach(o => { const w=o.completed_by_name||'Sin asignar'; if(!byW[w])byW[w]={count:0,total:0}; byW[w].count++; byW[w].total+=Number(o.total||0); });
    const wRows = Object.entries(byW).map(([n,d]) => '<tr><td>'+n+'</td><td style="text-align:center">'+d.count+'</td><td style="text-align:right;font-weight:700">$'+formatPrice(d.total)+'</td></tr>').join('');
    const oRows = todayOrders.map(o => {
      const items = (o.items||[]).map(i => {
        const ings = Array.isArray(i.selected_ingredients) ? i.selected_ingredients.map(x=>x.name||x).join(', ') : '';
        const exts = Array.isArray(i.selected_extras) ? i.selected_extras.map(x=>x.name||x).join(', ') : '';
        const comps = Array.isArray(i.selected_complements) ? i.selected_complements.map(x=>x.name||x).join(', ') : '';
        return '<div style="margin-bottom:3px"><strong>'+i.quantity+'x</strong> '+(i.product_name||i.name||'Producto')+(ings?'<br><span style="color:#666;font-size:11px">'+ings+'</span>':'')+(exts?'<br><span style="color:#888;font-size:11px">+ '+exts+'</span>':'')+(comps?'<br><span style="color:#888;font-size:11px">+ '+comps+'</span>':'')+'</div>';
      }).join('');
      const originalTotal = (o.items||[]).reduce((s,i) => s + Number(i.unit_price||0)*Number(i.quantity||1), 0);
      const finalTotal = Number(o.total||0);
      const priceModified = Math.abs(finalTotal - originalTotal) > 0.01;
      // % de propina estimado: diferencia positiva entre total final y subtotal de ítems, sobre el subtotal
      const tipAmount = Math.max(finalTotal - originalTotal, 0);
      const tipPct = originalTotal > 0 ? (tipAmount / originalTotal) * 100 : 0;
      const tipCell = tipAmount > 0.01
        ? '<span style="font-weight:700;color:#15803d">'+tipPct.toFixed(1).replace(/\.0$/,'')+'%</span>'
          + '<br><span style="color:#888;font-size:11px">$'+formatPrice(Math.round(tipAmount))+'</span>'
        : '<span style="color:#999">0%</span>';
      const totalCell = priceModified
        ? '<span style="color:#16a34a;font-weight:800;font-size:13px">✓</span> '
          + '<span style="text-decoration:line-through;color:#999;font-size:11px;margin-right:4px">$'+formatPrice(originalTotal)+'</span>'
          + '<span style="font-weight:800;color:#15803d">$'+formatPrice(finalTotal)+'</span>'
        : '<span style="color:#dc2626;font-size:12px;margin-right:3px">✗</span>'
          + '<span style="font-weight:800">$'+formatPrice(finalTotal)+'</span>';
      const bg = o.status==='completed'?'#f0fff4':o.status==='preparing'?'#fffbeb':'#fff';
      return '<tr style="background:'+bg+'"><td style="font-weight:800;font-size:15px">'+getOrderDisplayNumber(o)+'</td><td>'+tl(o.order_type)+(o.table_number!=null?'<br><small>Mesa '+o.table_number+'</small>':'')+'</td><td>'+fmt(o.created_at)+'</td><td>'+(o.completed_at?fmt(o.completed_at):'—')+'</td><td style="font-weight:700">'+fmtPrep(o.created_at,o.completed_at)+'</td><td>'+sl(o.status)+'</td><td style="font-weight:600">'+(o.completed_by_name||'—')+'</td><td style="font-size:12px">'+(items||'—')+'</td><td style="text-align:center;white-space:nowrap">'+tipCell+'</td><td style="text-align:right;white-space:nowrap">'+totalCell+'</td></tr>';
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
      '<div class="stats"><div class="stat"><div class="stat-label">Total pedidos</div><div class="stat-value">'+todayOrders.length+'</div></div><div class="stat"><div class="stat-label">Completados</div><div class="stat-value">'+done.length+'</div></div><div class="stat"><div class="stat-label">Ingresos totales</div><div class="stat-value">$'+formatPrice(total)+'</div></div><div class="stat"><div class="stat-label">Tiempo prom. prep.</div><div class="stat-value">'+(avg!=null?avg+' min':'—')+'</div></div></div>'+
      (wRows?'<h2>Rendimiento por Trabajador</h2><table><thead><tr><th>Trabajador</th><th>Pedidos</th><th>Total gestionado</th></tr></thead><tbody>'+wRows+'</tbody></table>':'')+
      '<h2>Detalle de Pedidos</h2><table><thead><tr><th>#</th><th>Tipo</th><th>Entrada</th><th>Salida</th><th>Tiempo prep.</th><th>Estado</th><th>Atendido por</th><th>Productos</th><th>% Propina</th><th>Total</th></tr></thead><tbody>'+oRows+'</tbody></table>'+
      '<div class="footer">SRServi — '+sn+' — '+new Date().toLocaleString('es-ES')+'</div></body></html>';
    const win = window.open('', '_blank', 'width=1050,height=750');
    if (!win) { alert('Permite ventanas emergentes para generar el PDF.'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  // ── Tarjeta de sellos ──
  const openStampModal = async () => {
    setShowStampModal(true);
    setStampMsg(''); setStampCardW(null); setStampCodeW('');
    if (!stampConfig && storeCode) {
      try {
        const r = await fetch(`/api/public/${storeCode}/stamp-card`);
        if (r.ok) { const d = await r.json(); setStampConfig(d.config); }
      } catch {}
    }
  };
  const stampLookup = async () => {
    const card_code = stampCodeW.replace(/\D/g, '');
    if (card_code.length !== 5) return;
    setStampBusy(true); setStampMsg('');
    try {
      const r = await fetch(`/api/public/${storeCode}/stamp-card/lookup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ card_code })
      });
      const d = await r.json();
      if (r.ok) setStampCardW(d);
      else setStampMsg(d.error || 'No existe una tarjeta con esa clave');
    } catch {} finally { setStampBusy(false); }
  };
  const stampAdd = async () => {
    const card_code = stampCodeW.replace(/\D/g, '');
    if (card_code.length !== 5) return;
    setStampBusy(true); setStampMsg('');
    try {
      const r = await fetch(`/api/public/${storeCode}/stamp-card/stamp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ card_code })
      });
      if (r.ok) {
        const d = await r.json();
        setStampCardW(c => ({ ...(c || {}), stamps: d.card.stamps, stamps_required: d.stamps_required, reward_available: d.card.reward_available, token: d.card.token, reward_label: d.card.config?.reward_label }));
        setStampMsg(d.rewardEarned ? '🎉 ¡Recompensa desbloqueada!' : '✓ Sello agregado');
      } else {
        const d = await r.json().catch(() => ({}));
        setStampMsg(d.error || 'No se pudo sumar el sello');
      }
    } catch {} finally { setStampBusy(false); }
  };
  const stampRedeem = async () => {
    if (!stampCardW?.token) return;
    setStampBusy(true); setStampMsg('');
    try {
      const r = await fetch(`/api/public/${storeCode}/stamp-card/redeem`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: stampCardW.token })
      });
      if (r.ok) {
        const d = await r.json();
        setStampCardW(c => ({ ...c, stamps: d.card.stamps, reward_available: false }));
        setStampMsg('✓ Recompensa canjeada');
      }
    } catch {} finally { setStampBusy(false); }
  };

  const fetchDeliveryOrders = async (storeId) => {
    const BASE = 'https://srservi2.srautomatic.com';
    const token = localStorage.getItem('workerToken');
    setDeliveryLoading(true);
    try {
      const res = await fetch(`${BASE}/api/worker/delivery?store_id=${storeId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setDeliveryOrders(await res.json());
    } catch {}
    finally { setDeliveryLoading(false); }
  };

  const handleDeliveryAction = async (orderId, status) => {
    const BASE = 'https://srservi2.srautomatic.com';
    const token = localStorage.getItem('workerToken');
    const workerData = JSON.parse(localStorage.getItem('worker') || '{}');
    try {
      await fetch(`${BASE}/api/worker/delivery/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ store_id: workerData.store_id, status })
      });
      if (status === 'rejected' || status === 'delivered') {
        setDeliveryOrders(prev => prev.filter(o => o.id !== orderId));
      } else {
        setDeliveryOrders(prev => prev.map(o => o.id === orderId ? { ...o, delivery_status: status } : o));
      }
      if (status === 'accepted' || status === 'preparing') {
        fetchOrders(workerData.store_id);
      }
    } catch (e) { alert('Error: ' + e.message); }
  };

  const fetchOrders = async (storeId) => {
    try {
      const token = localStorage.getItem('workerToken');
      console.log('Fetching orders for store:', storeId);
      const response = await fetch(`/api/orders/store/${storeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('Orders response status:', response.status);

      if (response.status === 401 || response.status === 403) {
        setShowSessionExpired(true);
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

  const fetchWhatsAppOrders = async (storeId) => {
    try {
      const token = localStorage.getItem('workerToken');
      const response = await fetch(`/api/orders/store/${storeId}/whatsapp`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWhatsappOrders(data);
      }
    } catch (error) {
      console.error('Error fetching whatsapp orders:', error);
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
      if (res.status === 401 || res.status === 403) {
        setShowSessionExpired(true);
        return;
      }
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

  // Cocina (KDS): pedidos en curso (pendiente / preparando / listo), los más antiguos primero
  const kitchenOrders = (orders || [])
    .filter(o => o.status !== 'completed' && Array.isArray(o.items) && o.items.length > 0)
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

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

  const [reprintingIds, setReprintingIds] = useState(new Set());
  const [reprintedIds, setReprintedIds] = useState(new Set());

  const reprintOrder = async (orderId) => {
    if (reprintingIds.has(orderId)) return;
    setReprintingIds(prev => new Set([...prev, orderId]));
    try {
      const token = localStorage.getItem('workerToken');
      const res = await fetch(`/api/orders/${orderId}/reprint?store_id=${worker.store_id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error del servidor');
      setReprintedIds(prev => new Set([...prev, orderId]));
      setTimeout(() => setReprintedIds(prev => { const n = new Set(prev); n.delete(orderId); return n; }), 3000);
    } catch (error) {
      console.error('Error al solicitar reimpresión:', error);
      alert('Error al reimprimir. Verificá que la impresora esté conectada.');
    } finally {
      setReprintingIds(prev => { const n = new Set(prev); n.delete(orderId); return n; });
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
    total: formatPrice([...orders, ...completedOrders, ...pendingCashOrders].reduce((s, o) => s + Number(o.total || 0), 0))
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
              className={`worker-cash-btn ${cashRegister ? 'open' : 'closed'}`}
              onClick={() => setShowCashModal(true)}
              title={cashRegister ? 'Caja abierta — click para cerrar' : 'Abrir caja'}
            >
              <span className="worker-cash-dot" />
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
            <div className="worker-header-tools">
              <button
                className="worker-header-icon-btn"
                onClick={downloadTodayPDF}
                disabled={!(orders.length || completedOrders.length || pendingCashOrders.length)}
                title="Generar PDF"
              >
                <FontAwesomeIcon icon={faPrint} />
              </button>
              {storeCode && (
                <button className="worker-header-icon-btn" onClick={openStampModal} title="Tarjeta de sellos">
                  <FontAwesomeIcon icon={faGift} />
                </button>
              )}
              {storeCode && (
                <button className="worker-header-icon-btn" onClick={() => window.open(`/store/${storeCode}`, '_blank')} title="Ver tienda">
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                </button>
              )}
              {storeCode && (
                <button className="worker-header-icon-btn" onClick={() => navigate(`/attendance/${storeCode}`, { state: { fromWorkerPanel: true } })} title="Asistencia">
                  <FontAwesomeIcon icon={faUserClock} />
                </button>
              )}
              <button className="worker-header-icon-btn" onClick={() => setShowWorkerSwitch(true)} title="Cambiar usuario">
                <FontAwesomeIcon icon={faUserCog} />
              </button>
              <button className="worker-header-icon-btn worker-logout-btn" onClick={handleLogout} title="Cerrar sesión">
                <FontAwesomeIcon icon={faSignOutAlt} />
              </button>
            </div>
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

      <div className="worker-body">
        {/* ── Contenido principal ── */}
        <div className="worker-main">
          <div className="worker-main-top">
            <div className="worker-tab-bar">
              {isTabVisible('ventarapida') && <button
                className={`worker-tab-btn ${activeTab === 'ventarapida' ? 'active' : ''}`}
                onClick={() => setActiveTab('ventarapida')}
                title="Menú de venta"
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Venta rápida</span>
              </button>}
              {isTabVisible('active') && <button
                className={`worker-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
                onClick={() => setActiveTab('active')}
              >
                <FontAwesomeIcon icon={faClock} />
                <span>Pedidos</span>
                {(orders.length + deliveryOrders.length) > 0 && <span className="worker-tab-badge">{orders.length + deliveryOrders.length}</span>}
              </button>}
              {isTabVisible('completed') && <button
                className={`worker-tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
                onClick={() => setActiveTab('completed')}
              >
                <FontAwesomeIcon icon={faCheck} />
                <span>Completados</span>
                {completedOrders.length > 0 && <span className="worker-tab-badge">{completedOrders.length}</span>}
              </button>}
              {isTabVisible('whatsapp') && <button
                className={`worker-tab-btn ${activeTab === 'whatsapp' ? 'active' : ''}`}
                onClick={() => setActiveTab('whatsapp')}
              >
                <span>💬</span>
                <span>WhatsApp</span>
                {whatsappOrders.length > 0 && <span className="worker-tab-badge">{whatsappOrders.length}</span>}
              </button>}
              {isTabVisible('mesas') && <button
                className={`worker-tab-btn ${activeTab === 'mesas' ? 'active' : ''}`}
                onClick={() => setActiveTab('mesas')}
              >
                <FontAwesomeIcon icon={faChair} />
                <span>Mesas</span>
              </button>}
              <div className="worker-tab-bar-sep" />
              {isTabVisible('tasks') && <button
                className={`worker-tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
                onClick={() => { setActiveTab('tasks'); setTaskError(''); }}
              >
                <FontAwesomeIcon icon={faClipboardList} />
                <span>Tareas</span>
                {(() => { const n = tasks.filter(t => t.day_of_week === new Date().getDay() && !t.completed_at).length; return n > 0 ? <span className="worker-tab-badge">{n}</span> : null; })()}
              </button>}
              {isTabVisible('procedures') && <button
                className={`worker-tab-btn ${activeTab === 'procedures' ? 'active' : ''}`}
                onClick={() => setActiveTab('procedures')}
              >
                <FontAwesomeIcon icon={faBook} />
                <span>Guías</span>
              </button>}
              {isTabVisible('rankings') && <button
                className={`worker-tab-btn ${activeTab === 'rankings' ? 'active' : ''}`}
                onClick={() => setActiveTab('rankings')}
              >
                <FontAwesomeIcon icon={faTrophy} />
                <span>Rankings</span>
              </button>}
              {isTabVisible('comments') && <button
                className={`worker-tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
                onClick={() => setActiveTab('comments')}
              >
                <FontAwesomeIcon icon={faCommentDots} />
                <span>Comentarios</span>
              </button>}
            </div>
            <div className="worker-search">
              <FontAwesomeIcon icon={faSearch} className="worker-search-icon" />
              <input
                type="text"
                placeholder="Buscar pedido..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

      <div className="worker-orders" style={activeTab === 'tasks' || activeTab === 'mesas' || activeTab === 'ventarapida' || activeTab === 'rankings' || activeTab === 'comments' ? { padding: 0 } : undefined}>
        {activeTab === 'active' ? (
          (filteredOrders.length === 0 && deliveryOrders.length === 0) ? (
            <div className="empty-state">
              <p>No hay pedidos activos</p>
            </div>
          ) : (
            <div className="worker-orders-list">
              {deliveryOrders.map(order => (
                <div key={order.id} className="worker-order-card" style={{ border: '2px solid rgba(212,175,55,0.4)', background: '#0f0f0f' }}>
                  {/* Header */}
                  <div className="worker-order-header">
                    <h3 className="worker-order-number" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      🛵 Delivery #{order.id}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: order.payment_method === 'card' ? '#22c55e' : '#D4AF37', fontWeight: 700, background: order.payment_method === 'card' ? 'rgba(34,197,94,0.12)' : 'rgba(212,175,55,0.12)', padding: '2px 8px', borderRadius: 20 }}>
                        {order.payment_method === 'card' ? '💳 Pagado' : '💵 Efectivo'}
                      </span>
                      <span style={{ fontSize: 11, color: '#D4AF37', fontWeight: 700, background: 'rgba(212,175,55,0.12)', padding: '2px 8px', borderRadius: 20 }}>NUEVO</span>
                    </div>
                  </div>

                  {/* Cliente */}
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                    <div style={{ fontSize: 13, color: '#fff', fontWeight: 700, marginBottom: 4 }}>
                      👤 {order.dc_name || order.customer_name || 'Cliente'}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: order.dc_email || order.customer_email ? 2 : 0 }}>
                      📞 {order.dc_phone || order.customer_phone || 'Sin teléfono'}
                    </div>
                    {(order.dc_email || order.customer_email) && (
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>✉️ {order.dc_email || order.customer_email}</div>
                    )}
                  </div>

                  {/* Dirección */}
                  {order.delivery_address ? (
                    <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: '#D4AF37', fontWeight: 600 }}>
                      📍 {order.delivery_address}
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#ef4444' }}>
                      ⚠️ Sin dirección de entrega
                    </div>
                  )}

                  {/* Items */}
                  {Array.isArray(order.items) && order.items.length > 0 && (
                    <div style={{ marginBottom: 10, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                      {order.items.map((item, i) => (
                        <div key={i} style={{ fontSize: 12, color: '#d1d5db', paddingBottom: 2 }}>{item.quantity}× {item.product_name}</div>
                      ))}
                    </div>
                  )}

                  {/* Total + hora */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 17, fontWeight: 900, color: '#D4AF37' }}>${Number(order.total).toFixed(0)}</span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{new Date(order.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {/* Acciones — progresivas según estado */}
                  {(() => {
                    const ds = order.delivery_status;
                    if (!ds || ds === 'waiting') return (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleDeliveryAction(order.id, 'rejected')} style={{ flex: 1, padding: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✕ Rechazar</button>
                        <button onClick={() => handleDeliveryAction(order.id, 'accepted')} style={{ flex: 1, padding: '10px', background: '#D4AF37', border: 'none', borderRadius: 8, color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>✓ Aceptar</button>
                      </div>
                    );
                    if (ds === 'accepted') return (
                      <button onClick={() => handleDeliveryAction(order.id, 'preparing')} style={{ width: '100%', padding: '11px', background: '#818cf8', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>🍳 Iniciar preparación</button>
                    );
                    if (ds === 'preparing') return (
                      <button onClick={() => handleDeliveryAction(order.id, 'on_the_way')} style={{ width: '100%', padding: '11px', background: '#f59e0b', border: 'none', borderRadius: 8, color: '#000', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>🛵 Enviar al cliente</button>
                    );
                    if (ds === 'on_the_way') return (
                      <button onClick={() => handleDeliveryAction(order.id, 'delivered')} style={{ width: '100%', padding: '11px', background: '#22c55e', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>📦 Marcar como entregado</button>
                    );
                    return null;
                  })()}
                </div>
              ))}
              {deliveryOrders.length > 0 && filteredOrders.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 8px', opacity: 0.4 }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                  <span style={{ fontSize: 10, color: '#666', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Otros pedidos</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                </div>
              )}
              {filteredOrders.map(order => (
                <div
                  key={order.id}
                  className="worker-order-card"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="worker-order-header">
                    <h3 className="worker-order-number">{getOrderDisplayNumber(order)}</h3>
                    {(() => {
                      const mins = Math.max(0, Math.floor((Date.now() - new Date(order.created_at)) / 60000));
                      const urg = mins >= 15 ? '#ef4444' : mins >= 8 ? '#f59e0b' : '#22c55e';
                      return (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 800, color: urg, background: `${urg}1f`, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                          <FontAwesomeIcon icon={faClock} /> {mins} min
                        </div>
                      );
                    })()}
                  </div>
                  <div className={`worker-order-type ${getOrderTypeInfo(order.order_type).cls}`} style={{ marginBottom: 6 }}>
                    <FontAwesomeIcon icon={getOrderTypeInfo(order.order_type).icon} />
                    {getOrderTypeInfo(order.order_type).label}
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
                  {order.order_type === 'delivery' && order.source === 'delivery_app' && (
                    <div style={{ background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, padding: '8px 10px', marginBottom: 6, fontSize: 12 }}>
                      {(order.customer_name || order.customer_phone) && (
                        <div style={{ color: '#d1d5db', fontWeight: 600, marginBottom: 2 }}>
                          👤 {order.customer_name || ''}{order.customer_phone ? ` · 📞 ${order.customer_phone}` : ''}
                        </div>
                      )}
                      {order.delivery_address ? (
                        <div style={{ color: '#D4AF37', fontWeight: 600 }}>📍 {order.delivery_address}</div>
                      ) : (
                        <div style={{ color: '#ef4444' }}>⚠️ Sin dirección</div>
                      )}
                      <div style={{ color: '#6b7280', marginTop: 2 }}>
                        {order.payment_method === 'card' ? '💳 Pagado online' : '💵 Cobra en efectivo'}
                      </div>
                    </div>
                  )}
                  <div className="worker-order-info">
                    <p className="worker-order-time">
                      {new Date(order.created_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  {order.items && order.items.length > 0 && (() => {
                    const comboGroups = {};
                    const standalone = [];
                    for (const item of order.items) {
                      if (item.combo_label) {
                        if (!comboGroups[item.combo_label]) comboGroups[item.combo_label] = [];
                        comboGroups[item.combo_label].push(item);
                      } else standalone.push(item);
                    }
                    const renderLine = (item, k) => (
                      <div key={k} className="worker-order-item-line">
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
                          {Array.isArray(item.selected_complements) && item.selected_complements.length > 0 && (
                            <div className="worker-order-item-addons">
                              {item.selected_complements.map((c, i) => {
                                const name = typeof c === 'object' ? (c.name || '') : (c || '');
                                const img = addonImages[name.toLowerCase()];
                                return <AddonChip key={i} name={name} img={img} prefix="+" />;
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                    return (
                      <div className="worker-order-items-preview">
                        {standalone.map((item, idx) => renderLine(item, `s${idx}`))}
                        {Object.entries(comboGroups).map(([label, items]) => (
                          <div key={label} style={{ borderLeft: '3px solid #D4AF37', paddingLeft: '8px', marginTop: '4px' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#D4AF37', marginBottom: '3px' }}>🎁 {label}</div>
                            {items.map((item, idx) => renderLine(item, `c${idx}`))}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {order.customer_comment && order.customer_comment.trim() && (
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: 6,
                      background: 'rgba(212,175,55,0.10)', border: '1px solid rgba(212,175,55,0.35)',
                      borderRadius: 8, padding: '7px 10px', marginTop: 8,
                      fontSize: 12.5, color: '#f5e6b0', lineHeight: 1.4
                    }}>
                      <FontAwesomeIcon icon={faCommentDots} style={{ color: '#D4AF37', marginTop: 2, flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{order.customer_comment}</span>
                    </div>
                  )}
                  {showPrices && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                      <div className="worker-order-total" style={{ margin: 0 }}>
                        ${ formatPrice(order.total) }
                      </div>
                    </div>
                  )}
                  {/* ── Botones de acción ── */}
                  <div
                    className="worker-order-actions"
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                  >
                    {(() => {
                      const started = order.status === 'preparing' || order.status === 'ready';
                      return (
                        <>
                          {/* Iniciar preparación */}
                          <button
                            onClick={() => updateOrderStatus(order.id, 'preparing')}
                            disabled={started}
                            title="Iniciar preparación"
                            className="woa-btn woa-start"
                            style={{
                              background: started ? '#1c1c1c' : 'rgba(59,130,246,0.13)',
                              border: `1px solid ${started ? '#2e2e2e' : 'rgba(59,130,246,0.35)'}`,
                              color: started ? '#555' : '#3b82f6',
                              cursor: started ? 'default' : 'pointer',
                            }}
                          >
                            <FontAwesomeIcon icon={faPlay} />
                          </button>

                          {/* En preparación — se enciende al iniciar (clic para volver a pendiente) */}
                          <button
                            onClick={() => updateOrderStatus(order.id, started ? 'pending' : 'preparing')}
                            title={started ? 'En preparación' : 'Aún sin iniciar'}
                            className={`woa-btn woa-cooking${started ? ' active' : ''}`}
                            style={{
                              background: started ? 'rgba(245,158,11,0.22)' : '#1c1c1c',
                              border: `1px solid ${started ? '#f59e0b' : '#2e2e2e'}`,
                              color: started ? '#f59e0b' : '#555',
                            }}
                          >
                            <FontAwesomeIcon icon={faUtensils} />
                          </button>
                        </>
                      );
                    })()}

                    {/* Completado — botón principal sólido */}
                    <button
                      onClick={() => updateOrderStatus(order.id, 'completed')}
                      title="Completado"
                      className="woa-btn woa-complete"
                      style={{
                        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                        boxShadow: '0 2px 8px rgba(22,163,74,0.25)',
                      }}
                    >
                      <FontAwesomeIcon icon={faCheck} />
                    </button>

                    {/* Reimprimir — va de último */}
                    <button
                      onClick={() => reprintOrder(order.id)}
                      disabled={reprintingIds.has(order.id)}
                      title="Reimprimir"
                      className="woa-btn woa-reprint"
                      style={{
                        background: reprintedIds.has(order.id) ? 'rgba(34,197,94,0.15)' : '#1c1c1c',
                        border: `1px solid ${reprintedIds.has(order.id) ? 'rgba(34,197,94,0.5)' : '#2e2e2e'}`,
                        color: reprintedIds.has(order.id) ? '#22c55e' : '#777',
                        cursor: reprintingIds.has(order.id) ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <FontAwesomeIcon icon={reprintedIds.has(order.id) ? faCheck : faPrint} spin={reprintingIds.has(order.id)} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'cocina' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                onClick={() => window.open('/cocina', '_blank')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.35)', color: '#D4AF37', padding: '7px 14px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} /> Abrir pantalla de cocina
              </button>
            </div>
            <KitchenBoard
              orders={kitchenOrders}
              onAdvance={(order, next) => updateOrderStatus(order.id, next)}
              addonImages={addonImages}
              variant="tab"
            />
          </>
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
                  {order.order_type === 'delivery' && order.source === 'delivery_app' && (
                    <div style={{ background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 8, padding: '8px 10px', marginBottom: 6, fontSize: 12 }}>
                      {(order.customer_name || order.customer_phone) && (
                        <div style={{ color: '#d1d5db', fontWeight: 600, marginBottom: 2 }}>
                          👤 {order.customer_name || ''}{order.customer_phone ? ` · 📞 ${order.customer_phone}` : ''}
                        </div>
                      )}
                      {order.delivery_address ? (
                        <div style={{ color: '#D4AF37', fontWeight: 600 }}>📍 {order.delivery_address}</div>
                      ) : (
                        <div style={{ color: '#ef4444' }}>⚠️ Sin dirección</div>
                      )}
                      <div style={{ color: '#6b7280', marginTop: 2 }}>
                        {order.payment_method === 'card' ? '💳 Pagado online' : '💵 Cobra en efectivo'}
                      </div>
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
                  {order.items && order.items.length > 0 && (() => {
                    const comboGroups = {};
                    const standalone = [];
                    for (const item of order.items) {
                      if (item.combo_label) {
                        if (!comboGroups[item.combo_label]) comboGroups[item.combo_label] = [];
                        comboGroups[item.combo_label].push(item);
                      } else standalone.push(item);
                    }
                    const renderLine = (item, k) => (
                      <div key={k} className="worker-order-item-line">
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
                          {Array.isArray(item.selected_complements) && item.selected_complements.length > 0 && (
                            <div className="worker-order-item-addons">
                              {item.selected_complements.map((c, i) => {
                                const name = typeof c === 'object' ? (c.name || '') : (c || '');
                                const img = addonImages[name.toLowerCase()];
                                return <AddonChip key={i} name={name} img={img} prefix="+" />;
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                    return (
                      <div className="worker-order-items-preview">
                        {standalone.map((item, idx) => renderLine(item, `s${idx}`))}
                        {Object.entries(comboGroups).map(([label, items]) => (
                          <div key={label} style={{ borderLeft: '3px solid #D4AF37', paddingLeft: '8px', marginTop: '4px' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#D4AF37', marginBottom: '3px' }}>🎁 {label}</div>
                            {items.map((item, idx) => renderLine(item, `c${idx}`))}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {order.customer_comment && order.customer_comment.trim() && (
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: 6,
                      background: 'rgba(212,175,55,0.10)', border: '1px solid rgba(212,175,55,0.35)',
                      borderRadius: 8, padding: '7px 10px', marginTop: 8,
                      fontSize: 12.5, color: '#f5e6b0', lineHeight: 1.4
                    }}>
                      <FontAwesomeIcon icon={faCommentDots} style={{ color: '#D4AF37', marginTop: 2, flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{order.customer_comment}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                    {showPrices ? (
                      <div className="worker-order-total" style={{ margin: 0 }}>
                        ${ formatPrice(order.total) }
                      </div>
                    ) : <div />}
                    <button
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); reprintOrder(order.id); }}
                      disabled={reprintingIds.has(order.id)}
                      style={{
                        height: 34, paddingInline: 14, borderRadius: 8, flexShrink: 0,
                        background: reprintedIds.has(order.id) ? 'rgba(34,197,94,0.12)' : '#1c1c1c',
                        border: `1px solid ${reprintedIds.has(order.id) ? 'rgba(34,197,94,0.4)' : '#2e2e2e'}`,
                        color: reprintedIds.has(order.id) ? '#22c55e' : '#777',
                        cursor: reprintingIds.has(order.id) ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 12, fontWeight: 700, touchAction: 'manipulation', transition: 'all 0.18s'
                      }}
                    >
                      <FontAwesomeIcon icon={reprintedIds.has(order.id) ? faCheck : faPrint} spin={reprintingIds.has(order.id)} />
                      {reprintedIds.has(order.id) ? 'Enviado' : 'Reimprimir'}
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
        {activeTab === 'ventarapida' && worker && (
          cashRegister ? (
            <WorkerNewOrder
              key={sellResetKey}
              embedded
              worker={worker}
              storeId={worker.store_id}
              storeCode={storeCode}
              onClose={() => setSellResetKey(k => k + 1)}
              onOrderCreated={() => fetchOrders(worker.store_id)}
            />
          ) : (
            <div className="empty-state" style={{ textAlign: 'center' }}>
              <FontAwesomeIcon icon={faLock} style={{ fontSize: 34, color: '#D4AF37', marginBottom: 14 }} />
              <p style={{ marginBottom: 16 }}>Abre la caja para empezar a vender</p>
              <button
                onClick={() => setShowCashModal(true)}
                style={{ background: 'linear-gradient(135deg,#D4AF37,#b8860b)', color: '#111', border: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
              >
                <FontAwesomeIcon icon={faCashRegister} style={{ marginRight: 8 }} /> Abrir caja
              </button>
            </div>
          )
        )}

        {activeTab === 'whatsapp' && (
          whatsappOrders.length === 0 ? (
            <div className="empty-state">
              <p>No hay pedidos de WhatsApp hoy</p>
            </div>
          ) : (
            <div className="worker-orders-list">
              {whatsappOrders.map(order => {
                const phone = order.customer_phone || '';
                const waLink = phone ? `https://wa.me/${phone}` : null;
                const isPaid = order.payment_process === 1 || order.cash_approved;
                const payLabel = order.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta';
                const typeLabel = order.order_type === 'delivery' ? '🚀 Delivery' : '🏪 Para aquí / llevar';
                const statusColors = {
                  pending:   { bg: '#FEF3C7', color: '#92400E', label: 'Pendiente' },
                  preparing: { bg: '#DBEAFE', color: '#1E40AF', label: 'Preparando' },
                  ready:     { bg: '#D1FAE5', color: '#065F46', label: 'Listo' },
                  completed: { bg: '#F3F4F6', color: '#374151', label: 'Completado' },
                };
                const sc = statusColors[order.status] || statusColors.pending;
                return (
                  <div key={order.id} className="worker-order-card" style={{ cursor: 'default' }}>
                    <div className="worker-order-header">
                      <h3 className="worker-order-number">{order.order_number || `#${order.id}`}</h3>
                      <span style={{
                        background: '#25D36622', color: '#128C7E', border: '1px solid #25D366',
                        borderRadius: '8px', padding: '3px 10px', fontSize: '12px', fontWeight: 700
                      }}>
                        💬 WhatsApp
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span style={{
                        background: sc.bg, color: sc.color,
                        borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: 600
                      }}>{sc.label}</span>
                      <span style={{ fontSize: '12px', color: '#666' }}>{typeLabel}</span>
                      <span style={{ fontSize: '12px', color: '#666' }}>💳 {payLabel}</span>
                      {!isPaid && (
                        <span style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: 600 }}>
                          Sin pagar
                        </span>
                      )}
                    </div>
                    {order.items && order.items.length > 0 && (() => {
                      const comboGroups = {};
                      const standalone = [];
                      for (const item of order.items) {
                        if (item.combo_label) {
                          if (!comboGroups[item.combo_label]) comboGroups[item.combo_label] = [];
                          comboGroups[item.combo_label].push(item);
                        } else standalone.push(item);
                      }
                      return (
                        <div className="worker-order-items-preview">
                          {standalone.map((item, idx) => (
                            <div key={idx} className="worker-order-item-line">
                              <span className="worker-order-item-qty">{item.quantity}x</span>
                              <span className="worker-order-item-name">{item.product_name || item.name || 'Producto'}</span>
                            </div>
                          ))}
                          {Object.entries(comboGroups).map(([label, items]) => (
                            <div key={label} style={{ borderLeft: '3px solid #D4AF37', paddingLeft: '8px', marginTop: '4px' }}>
                              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#D4AF37', marginBottom: '3px' }}>🎁 {label}</div>
                              {items.map((item, idx) => (
                                <div key={idx} className="worker-order-item-line">
                                  <span className="worker-order-item-qty">{item.quantity}x</span>
                                  <span className="worker-order-item-name">{item.product_name || item.name || 'Producto'}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                      {showPrices ? (
                        <div className="worker-order-total" style={{ margin: 0 }}>
                          ${isNaN(order.total) ? '0' : Number(order.total).toLocaleString('es-CL')}
                        </div>
                      ) : <div />}
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            background: '#25D366', color: '#fff', border: 'none',
                            borderRadius: '8px', padding: '7px 14px', fontSize: '13px',
                            fontWeight: 700, textDecoration: 'none', cursor: 'pointer'
                          }}
                        >
                          <FontAwesomeIcon icon={faExternalLinkAlt} />
                          Ir al chat
                        </a>
                      )}
                    </div>
                    <p style={{ fontSize: '11px', color: '#aaa', margin: '6px 0 0' }}>
                      {new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      {phone && ` · +${phone}`}
                    </p>
                  </div>
                );
              })}
            </div>
          )
        )}
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
        {activeTab === 'mesas' && worker && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <WorkerTableMap
              worker={worker}
              storeId={worker.store_id}
              storeCode={storeCode}
              onOrderCreated={() => fetchOrders(worker.store_id)}
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
            {/* Creaciones personalizadas */}
            {customCreations.length > 0 && (
              <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {customCreations.map(c => (
                  <button key={c.id} onClick={() => setActiveCustomCreation(c)}
                    style={{ width: '100%', padding: 0, background: '#111', border: '1px solid #2a2a2a', borderRadius: 12, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'stretch' }}>
                    <div style={{ width: 100, flexShrink: 0, background: '#1a1a1a', position: 'relative', minHeight: 58 }}>
                      {c.background_image ? (
                        <img src={c.background_image.startsWith('http') ? c.background_image : 'https://srservi2.srautomatic.com' + c.background_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 58 }}>
                          <span style={{ fontSize: 22 }}>🎨</span>
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, padding: '12px 14px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{c.title}</div>
                        <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Creación personalizada · 1920×1080</div>
                      </div>
                      <span style={{ color: '#D4AF37', fontSize: 18 }}>›</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {procedures.length === 0 && prepTables.length === 0 && customCreations.length === 0 ? (
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
                            {(firstStep.instruction || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()}
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
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {/* Image on the left */}
                  {imgUrl && (
                    <div onClick={() => setLightboxImg(imgUrl)}
                      style={{ width: 130, flexShrink: 0, borderRadius: 12, overflow: 'hidden', cursor: 'zoom-in' }}>
                      <img src={imgUrl} alt=""
                        style={{ width: '100%', objectFit: 'cover', display: 'block', borderRadius: 12 }} />
                    </div>
                  )}

                  {/* Text on the right (or full width when no image) */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Step number + title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: '#D4AF37', color: '#000',
                        fontWeight: 900, fontSize: 15,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {procStep + 1}
                      </div>
                      {step?.title && (
                        <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                          {step.title}
                        </div>
                      )}
                    </div>

                    {/* Instruction */}
                    {step?.instruction && (
                      <div className="rich-content-dark"
                        style={{ fontSize: 14, color: '#ddd', lineHeight: 1.7, marginBottom: 14 }}
                        dangerouslySetInnerHTML={{ __html: step.instruction }}
                      />
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
                </div>
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

        {activeTab === 'rankings' && (
          <div style={{ padding: '16px', overflowY: 'auto', height: 'calc(100svh - 155px)', background: '#0a0a0a' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {[{ key: 'today', label: 'Hoy' }, { key: 'week', label: 'Semana' }, { key: 'month', label: 'Mes' }].map(p => (
                <button
                  key={p.key}
                  onClick={() => setRankingPeriod(p.key)}
                  style={{
                    padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: rankingPeriod === p.key ? '#D4AF37' : '#1e1e1e',
                    color: rankingPeriod === p.key ? '#000' : '#aaa',
                    fontWeight: 700, fontSize: 13
                  }}
                >{p.label}</button>
              ))}
            </div>

            {rankingsLoading ? <p style={{ color: '#666', textAlign: 'center', padding: 20 }}>Cargando...</p> : (
              <>
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ color: '#D4AF37', fontSize: 14, fontWeight: 800, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                    <FontAwesomeIcon icon={faTrophy} style={{ marginRight: 8 }} />Ranking Sucursales
                  </h3>
                  {rankings.stores?.length === 0 ? (
                    <p style={{ color: '#666', fontSize: 13 }}>No hay datos para este período</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {rankings.stores?.map((s, i) => (
                        <div key={s.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 14px', borderRadius: 12,
                          background: i === 0 ? 'rgba(212,175,55,0.1)' : '#111',
                          border: i === 0 ? '1px solid rgba(212,175,55,0.3)' : '1px solid #1e1e1e'
                        }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: i === 0 ? '#D4AF37' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#333',
                            color: i < 3 ? '#000' : '#aaa',
                            fontWeight: 900, fontSize: 14,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>{i + 1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                            <div style={{ fontSize: 11, color: '#666' }}>{s.order_count} pedidos</div>
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: i === 0 ? '#D4AF37' : '#fff' }}>${Number(s.total_sales).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 style={{ color: '#D4AF37', fontSize: 14, fontWeight: 800, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                    <FontAwesomeIcon icon={faUserCog} style={{ marginRight: 8 }} />Ranking Vendedores
                  </h3>
                  {rankings.workers?.length === 0 ? (
                    <p style={{ color: '#666', fontSize: 13 }}>No hay datos para este período</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {rankings.workers?.map((w, i) => (
                        <div key={`${w.id}`} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 14px', borderRadius: 12,
                          background: i === 0 ? 'rgba(212,175,55,0.1)' : '#111',
                          border: i === 0 ? '1px solid rgba(212,175,55,0.3)' : '1px solid #1e1e1e'
                        }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: i === 0 ? '#D4AF37' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#333',
                            color: i < 3 ? '#000' : '#aaa',
                            fontWeight: 900, fontSize: 14,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>{i + 1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</div>
                            <div style={{ fontSize: 11, color: '#666' }}>{w.store_name} · {w.order_count} pedidos</div>
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: i === 0 ? '#D4AF37' : '#fff' }}>${Number(w.total_sales).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100svh - 155px)', background: '#0a0a0a' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {comments.length === 0 ? (
                <div className="empty-state"><p>No hay comentarios aún</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {comments.map(c => (
                    <div key={c.id} style={{
                      padding: '12px 14px', borderRadius: 12, background: '#111', border: '1px solid #1e1e1e'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#D4AF37' }}>{c.worker_name}</span>
                        <span style={{ fontSize: 11, color: '#555' }}>{new Date(c.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.5, margin: 0 }}>{c.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{
              flexShrink: 0, padding: '12px 16px', borderTop: '1px solid #1e1e1e',
              display: 'flex', gap: 10
            }}>
              <input
                type="text"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Escribe un comentario..."
                onKeyDown={e => e.key === 'Enter' && sendComment()}
                style={{
                  flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: 10,
                  padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none'
                }}
              />
              <button
                onClick={sendComment}
                disabled={commentSending || !newComment.trim()}
                style={{
                  padding: '10px 18px', borderRadius: 10, border: 'none',
                  background: newComment.trim() ? '#D4AF37' : '#333',
                  color: newComment.trim() ? '#000' : '#666',
                  fontWeight: 700, fontSize: 13, cursor: newComment.trim() ? 'pointer' : 'default'
                }}
              >{commentSending ? '...' : 'Enviar'}</button>
            </div>
          </div>
        )}
      </div>
        </div>{/* /worker-main */}
      </div>{/* /worker-body */}

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
              <span className="worker-detail-value">${ formatPrice(selectedOrder.total) }</span>
            </div>

            {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <div className="worker-items-list">
                    <h4 className="worker-items-title">Productos:</h4>
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="worker-item-row flex-col">
                        <div className="flex justify-between w-full worker-item-main">
                          <span className="worker-detail-value">{item.quantity}x {item.product_name || item.name || 'Producto'}</span>
                          <span className="worker-detail-value">${ formatPrice(Number(item.unit_price) * Number(item.quantity)) }</span>
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

            {selectedOrder.customer_comment && selectedOrder.customer_comment.trim() && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                background: 'rgba(212,175,55,0.10)', border: '1px solid rgba(212,175,55,0.35)',
                borderRadius: 8, padding: '10px 12px', marginTop: 12,
                fontSize: 14, color: '#8a6d1a', lineHeight: 1.45
              }}>
                <FontAwesomeIcon icon={faCommentDots} style={{ color: '#D4AF37', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', marginBottom: 2 }}>Comentario del cliente:</strong>
                  <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedOrder.customer_comment}</span>
                </div>
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

            {/* ── Acciones del modal ── */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Fila superior: Reimprimir + estado contextual */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => reprintOrder(selectedOrder.id)}
                  disabled={reprintingIds.has(selectedOrder.id)}
                  style={{
                    flex: 1, height: 44, borderRadius: 10,
                    background: reprintedIds.has(selectedOrder.id) ? 'rgba(34,197,94,0.1)' : '#f5f5f5',
                    border: `1px solid ${reprintedIds.has(selectedOrder.id) ? 'rgba(34,197,94,0.3)' : '#e0e0e0'}`,
                    color: reprintedIds.has(selectedOrder.id) ? '#16a34a' : '#555',
                    fontSize: 13, fontWeight: 700, cursor: reprintingIds.has(selectedOrder.id) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    transition: 'all 0.18s'
                  }}
                >
                  <FontAwesomeIcon icon={reprintedIds.has(selectedOrder.id) ? faCheck : faPrint} spin={reprintingIds.has(selectedOrder.id)} />
                  {reprintedIds.has(selectedOrder.id) ? 'Enviado' : 'Reimprimir'}
                </button>

                {selectedOrder.status === 'pending' && (
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, 'preparing')}
                    style={{
                      flex: 1, height: 44, borderRadius: 10,
                      background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                      color: '#d97706', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7
                    }}
                  >
                    <FontAwesomeIcon icon={faBox} /> Pedido Tomado
                  </button>
                )}

                {(selectedOrder.status === 'preparing' || selectedOrder.status === 'ready') && (
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, 'pending')}
                    style={{
                      flex: 1, height: 44, borderRadius: 10,
                      background: '#f5f5f5', border: '1px solid #e0e0e0',
                      color: '#666', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7
                    }}
                  >
                    <FontAwesomeIcon icon={faClock} /> Pendiente
                  </button>
                )}
              </div>

              {/* Completado — botón principal grande */}
              {selectedOrder.status !== 'completed' && (
                <button
                  onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}
                  style={{
                    width: '100%', height: 48, borderRadius: 10,
                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    border: 'none', color: '#fff',
                    fontSize: 15, fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 3px 12px rgba(22,163,74,0.3)'
                  }}
                >
                  <FontAwesomeIcon icon={faCheck} /> Completado
                </button>
              )}
            </div>

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

                  {/* ── Egresos / gastos de la caja ── */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ color: '#fff', fontSize: '13px', fontWeight: 700 }}>
                        <FontAwesomeIcon icon={faMoneyBillWave} style={{ color: '#ef4444', marginRight: 6 }} />
                        Egresos {cashSummary?.movements?.length ? `(${cashSummary.movements.length})` : ''}
                      </span>
                      {!showEgresoForm && (
                        <button
                          onClick={() => setShowEgresoForm(true)}
                          style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '8px', padding: '5px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                        >
                          <FontAwesomeIcon icon={faPlus} /> Agregar
                        </button>
                      )}
                    </div>

                    {showEgresoForm && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                        <input
                          type="number" min="0" step="0.01" placeholder="Monto" value={egresoAmount}
                          onChange={e => setEgresoAmount(e.target.value)} autoFocus
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #333', background: '#111', color: '#fff', fontSize: '16px', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                        />
                        <input
                          type="text" placeholder="Descripción (ej. insumos, proveedor)" value={egresoDesc}
                          onChange={e => setEgresoDesc(e.target.value)}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #333', background: '#111', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                        />
                        <select
                          value={egresoCategory} onChange={e => setEgresoCategory(e.target.value)}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #333', background: '#111', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                        >
                          <option value="Gasto">Gasto</option>
                          <option value="Retiro">Retiro</option>
                          <option value="Proveedor">Proveedor</option>
                          <option value="Insumos">Insumos</option>
                          <option value="Otro">Otro</option>
                        </select>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={addEgreso} disabled={egresoSaving}
                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#D4AF37', color: '#000', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
                          >
                            {egresoSaving ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button
                            onClick={() => { setShowEgresoForm(false); setEgresoAmount(''); setEgresoDesc(''); }}
                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {cashSummary?.movements?.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {cashSummary.movements.map(m => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '8px 10px' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.description || m.category}</div>
                              <div style={{ color: '#777', fontSize: '11px' }}>{m.category}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: 700 }}>-${formatPrice(m.amount)}</span>
                              <button onClick={() => deleteEgreso(m.id)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: '12px' }} title="Eliminar">
                                <FontAwesomeIcon icon={faTimes} />
                              </button>
                            </div>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px', marginTop: '2px' }}>
                          <span style={{ color: '#aaa', fontSize: '12px', fontWeight: 700 }}>Total egresos</span>
                          <span style={{ color: '#ef4444', fontSize: '14px', fontWeight: 800 }}>-${formatPrice(cashSummary.total_egresos)}</span>
                        </div>
                      </div>
                    ) : (!showEgresoForm && (
                      <p style={{ color: '#666', fontSize: '12px', margin: 0, textAlign: 'center' }}>Sin egresos registrados</p>
                    ))}
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
              <p style={{ color: '#ccc', fontSize: '14px', margin: '0 0 14px' }}>
                Estado de resultados del turno
              </p>

              {cashSummaryLoading ? (
                <p style={{ color: '#888', fontSize: '13px', padding: '16px 0' }}>Calculando...</p>
              ) : cashSummary ? (
                <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', margin: '0 0 12px' }}>
                  {/* Ingresos */}
                  <div style={{ color: '#16a34a', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Ingresos</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', color: '#ccc' }}>
                    <span>Apertura (inicial)</span><span style={{ color: '#fff', fontWeight: 600 }}>${formatPrice(cashSummary.opening)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', color: '#ccc' }}>
                    <span>Ventas en efectivo</span><span style={{ color: '#fff', fontWeight: 600 }}>${formatPrice(cashSummary.ventas_efectivo)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', color: '#ccc' }}>
                    <span>Ventas con tarjeta</span><span style={{ color: '#fff', fontWeight: 600 }}>${formatPrice(cashSummary.ventas_tarjeta)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 4 }}>
                    <span style={{ color: '#aaa', fontWeight: 700 }}>Total vendido</span>
                    <span style={{ color: '#16a34a', fontWeight: 800 }}>${formatPrice(cashSummary.total_ventas)}</span>
                  </div>

                  {/* Egresos */}
                  <div style={{ color: '#ef4444', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, margin: '12px 0 6px' }}>Egresos</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', color: '#ccc' }}>
                    <span>Total egresos {cashSummary.movements?.length ? `(${cashSummary.movements.length})` : ''}</span>
                    <span style={{ color: '#ef4444', fontWeight: 700 }}>-${formatPrice(cashSummary.total_egresos)}</span>
                  </div>

                  {/* Resultado */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', fontSize: '14px', borderTop: '1px solid rgba(255,255,255,0.12)', marginTop: 8 }}>
                    <span style={{ color: '#fff', fontWeight: 800 }}>Resultado neto</span>
                    <span style={{ color: cashSummary.resultado_neto >= 0 ? '#16a34a' : '#ef4444', fontWeight: 900 }}>${formatPrice(cashSummary.resultado_neto)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 10, padding: '10px 12px', marginTop: 10 }}>
                    <span style={{ color: '#D4AF37', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Efectivo esperado en caja</span>
                    <span style={{ color: '#D4AF37', fontSize: '20px', fontWeight: 900 }}>${formatPrice(cashSummary.efectivo_esperado)}</span>
                  </div>
                  <p style={{ color: '#555', fontSize: '10px', margin: '6px 0 0', textAlign: 'center' }}>= apertura + ventas efectivo − egresos</p>
                </div>
              ) : (
                <div style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 10, padding: '12px 20px', margin: '0 0 12px' }}>
                  <p style={{ color: '#888', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Total vendido</p>
                  <p style={{ color: '#D4AF37', fontSize: '28px', fontWeight: 900, margin: 0 }}>${stats.total}</p>
                </div>
              )}
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

      {showStampModal && (
        <div className="worker-modal-overlay pay-modal-overlay">
          <div className="worker-modal" style={{ display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="worker-modal-header">
              <h2 className="worker-modal-title"><FontAwesomeIcon icon={faGift} style={{ marginRight: 8, color: '#D4AF37' }} />Tarjeta de sellos</h2>
              <button className="worker-modal-close" onClick={() => setShowStampModal(false)}>x</button>
            </div>
            <div style={{ padding: '4px 2px' }}>
              {!stampConfig?.enabled ? (
                <div style={{ color: '#999', textAlign: 'center', padding: '20px' }}>
                  La tarjeta de sellos no está activada. Actívala en el panel de administración → Configuraciones.
                </div>
              ) : (
                <>
                  <label style={{ display: 'block', marginBottom: '6px', color: colors.secondary }}>Clave del cliente (5 dígitos)</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={5}
                      value={stampCodeW}
                      onChange={e => { setStampCodeW(e.target.value.replace(/\D/g, '').slice(0, 5)); setStampCardW(null); setStampMsg(''); }}
                      placeholder="Ej: 48213"
                      style={{ flex: 1, padding: '12px 14px', fontSize: '1.3rem', letterSpacing: 4, textAlign: 'center', fontWeight: 700, background: '#1a1a1a', color: '#fff', border: `1px solid ${colors.accent}`, borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button className="btn btn-secondary" onClick={stampLookup} disabled={stampBusy || stampCodeW.replace(/\D/g, '').length !== 5}>
                      {stampBusy ? '...' : 'Buscar'}
                    </button>
                  </div>

                  {stampCardW && (
                    <div style={{ background: '#1a1a1a', border: `1px solid ${colors.accent}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                      <div style={{ fontSize: 28, fontWeight: 900, color: '#D4AF37', textAlign: 'center' }}>
                        {stampCardW.stamps}<span style={{ fontSize: 18, color: '#888' }}> / {stampCardW.stamps_required}</span>
                      </div>
                      <div style={{ textAlign: 'center', color: '#aaa', fontSize: 13, marginBottom: 4 }}>sellos</div>
                      {stampCardW.reward_available && (
                        <div style={{ textAlign: 'center', color: '#22c55e', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
                          🎉 {stampCardW.reward_label || stampConfig.reward_label}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={stampAdd} disabled={stampBusy}>
                          + Sumar sello
                        </button>
                        {stampCardW.reward_available && (
                          <button className="btn btn-success" style={{ flex: 1, background: '#16a34a', color: '#fff' }} onClick={stampRedeem} disabled={stampBusy}>
                            Canjear
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {stampMsg && (
                    <div style={{ textAlign: 'center', color: '#22c55e', fontWeight: 600, padding: '4px 0' }}>{stampMsg}</div>
                  )}
                </>
              )}
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
                      ${ formatPrice(payResult.total) }
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

      {/* Creación personalizada full-screen */}
      {activeCustomCreation && (() => {
        const c = activeCustomCreation;
        const CW = 1920, CH = 1080;
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #111', flexShrink: 0, background: '#0a0a0a' }}>
              <button onClick={() => setActiveCustomCreation(null)}
                style={{ background: '#1e1e1e', border: 'none', borderRadius: 9, color: '#aaa', padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}>
                ← Volver
              </button>
              <div style={{ flex: 1, fontWeight: 800, fontSize: 15, color: '#fff', textAlign: 'center' }}>{c.title}</div>
            </div>
            {/* Canvas viewer — escala para llenar pantalla */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 8 }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '100%', aspectRatio: `${CW}/${CH}` }}>
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 8 }}>
                  {/* Fondo */}
                  {c.background_image ? (
                    <img src={c.background_image.startsWith('http') ? c.background_image : 'https://srservi2.srautomatic.com' + c.background_image}
                      alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)' }} />
                  )}
                  {/* Elementos — posicionados porcentualmente */}
                  {(c.elements || []).map(el => el.type === 'image' ? (
                    <div key={el.id} style={{
                      position: 'absolute',
                      left: `${(el.x / CW) * 100}%`,
                      top: `${(el.y / CH) * 100}%`,
                      width: `${(el.width / CW) * 100}%`,
                      height: `${(el.height / CH) * 100}%`,
                      opacity: el.opacity, pointerEvents: 'none', overflow: 'hidden',
                    }}>
                      <img src={el.imgUrl.startsWith('http') ? el.imgUrl : 'https://srservi2.srautomatic.com' + el.imgUrl} alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                    </div>
                  ) : (
                    <div key={el.id} style={{
                      position: 'absolute',
                      left: `${(el.x / CW) * 100}%`,
                      top: `${(el.y / CH) * 100}%`,
                      fontSize: `${(el.fontSize / CW) * 100}vw`,
                      color: el.color, fontWeight: el.fontWeight,
                      fontFamily: el.fontFamily, textShadow: el.textShadow,
                      opacity: el.opacity, lineHeight: 1.15,
                      whiteSpace: 'pre-wrap', pointerEvents: 'none',
                    }}>
                      {el.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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

      {showSessionExpired && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100000,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24
        }}>
          <div style={{
            background: '#111', borderRadius: 20,
            border: '2px solid #D4AF37',
            padding: '32px 28px',
            maxWidth: 360, width: '100%',
            textAlign: 'center',
            boxShadow: '0 8px 40px rgba(0,0,0,0.9)'
          }}>
            <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: '0 0 10px' }}>
              Sesión expirada
            </h2>
            <p style={{ color: '#aaa', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
              Tu sesión ha expirado. Por favor, vuelve a iniciar sesión para continuar.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem('workerToken');
                localStorage.removeItem('worker');
                navigate('/worker-login');
              }}
              style={{
                width: '100%', padding: '14px',
                background: '#D4AF37', color: '#000',
                border: 'none', borderRadius: 12,
                fontWeight: 900, fontSize: 16,
                cursor: 'pointer'
              }}
            >
              Iniciar sesión
            </button>
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
