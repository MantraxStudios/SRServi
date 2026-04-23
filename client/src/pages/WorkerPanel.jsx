import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBox, faClock, faCheck, faTimes, faSearch, faSignOutAlt, faUserCog, faMoneyBillWave, faPlus, faExternalLinkAlt, faUtensils, faShoppingBag, faMotorcycle, faConciergeBell, faPrint, faClipboardList, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { SOCKET_URL } from '../config.js';
import WorkerNewOrder from '../components/WorkerNewOrder';

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
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [storeCode, setStoreCode] = useState(() => {
    try { return JSON.parse(localStorage.getItem('worker') || '{}').store_code || ''; } catch { return ''; }
  });
  const [showPayModal, setShowPayModal] = useState(false);
  const [paySearch, setPaySearch] = useState('');
  const [payResult, setPayResult] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [completingTask, setCompletingTask] = useState(null);
  const [taskError, setTaskError] = useState('');
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
    fetchTasks();

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
      // Recargar pedidos al reconectar
      fetchOrders(parsedWorker.store_id);
    });

    socket.on('new_order', (order) => {
      if (order.payment_method === 'cash' && !order.cash_approved) {
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

    socket.on('order_updated', () => {
      fetchOrders(parsedWorker.store_id);
    });

    socket.on('order_deleted', () => {
      fetchOrders(parsedWorker.store_id);
    });

    // Countdown timer for active tasks (every second)
    const tickInterval = setInterval(() => setTick(t => t + 1), 1000);

    // Polling de respaldo cada 30 segundos
    const pollInterval = setInterval(() => {
      fetchOrders(parsedWorker.store_id);
      fetchTasks();
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

  const downloadTodayPDF = () => {
    const all = [...(orders || []), ...(completedOrders || []), ...(pendingCashOrders || [])];
    if (!all.length) { alert('No hay pedidos hoy para exportar.'); return; }
    const seen = new Set();
    const todayOrders = all
      .filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true; })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const sl = s => ({ pending: 'Pendiente', preparing: 'En preparación', ready: 'Listo', completed: 'Completado' })[s] || s || '';
    const tl = t => ({ serve: 'Aquí', takeout: 'Para llevar', delivery: 'Delivery', pedidosya: 'PedidosYa', rappi: 'Rappi', mostrador: 'Mostrador' })[t] || 'Aquí';
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
      const pendingCash = todayOrders.filter(o => o.payment_method === 'cash' && !o.cash_approved && o.payment_process === 0);
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

  const closePayModal = () => {
    setShowPayModal(false);
    setPaySearch('');
    setPayResult(null);
  };

  const handlePaySearch = async (term) => {
    setPaySearch(term);
    if (!term.trim()) { setPayResult(null); return; }
    const t = term.trim().toUpperCase();

    // 1. Buscar en estado local
    const inPending = pendingCashOrders.find(o =>
      (o.order_number || '').toUpperCase() === t ||
      getOrderDisplayNumber(o).toUpperCase() === t
    );
    if (inPending) { setPayResult({ ...inPending, _isPendingCash: true }); return; }

    const inActive = orders.find(o =>
      (o.order_number || '').toUpperCase() === t ||
      getOrderDisplayNumber(o).toUpperCase() === t
    );
    if (inActive) { setPayResult({ ...inActive, _isPendingCash: false }); return; }

    // 2. Fallback: buscar en la API directamente
    try {
      const token = localStorage.getItem('workerToken');
      const resp = await fetch(`/api/orders/store/${worker.store_id}/find?q=${encodeURIComponent(term.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const found = await resp.json();
        if (found) {
          const isPendingCash = found.payment_method === 'cash' && !found.cash_approved;
          setPayResult({ ...found, _isPendingCash: isPendingCash });
          return;
        }
      }
    } catch {}

    setPayResult(undefined);
  };

  const handleApprovePay = async () => {
    if (!payResult?._isPendingCash) return;
    await approveCashPayment(payResult.id);
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
            <button className="worker-action-primary" onClick={() => setShowNewOrder(true)} title="Nuevo pedido">
              <FontAwesomeIcon icon={faPlus} />
              <span className="worker-btn-label">Nuevo</span>
            </button>
            <button className="worker-action-primary green" onClick={() => setShowPayModal(true)} title="Cobrar">
              <FontAwesomeIcon icon={faMoneyBillWave} />
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
              Tareas{tasks.filter(t => !t.completed_at).length > 0 && (
                <span className="worker-tab-count">{tasks.filter(t => !t.completed_at).length}</span>
              )}
            </button>
          </div>
          {activeTab !== 'tasks' && (
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

      <div className="worker-orders">
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
                              <span className="worker-order-item-addons">
                                {(Array.isArray(item.selected_ingredients) ? item.selected_ingredients.map(i => i.name || i).join(', ') : item.selected_ingredients)}
                              </span>
                            )}
                            {item.selected_extras && item.selected_extras.length > 0 && (
                              <span className="worker-order-item-addons">
                                + {(Array.isArray(item.selected_extras) ? item.selected_extras.map(e => e.name || e).join(', ') : item.selected_extras)}
                              </span>
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
                      onClick={e => { e.stopPropagation(); updateOrderStatus(order.id, 'completed'); }}
                      title="Marcar como completado"
                      style={{
                        width: '34px', height: '34px', borderRadius: '50%',
                        background: 'rgba(34,197,94,0.15)', border: '1.5px solid #22c55e',
                        color: '#22c55e', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem',
                        flexShrink: 0
                      }}
                    >
                      <FontAwesomeIcon icon={faCheck} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
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
                              <span className="worker-order-item-addons">
                                {(Array.isArray(item.selected_ingredients) ? item.selected_ingredients.map(i => i.name || i).join(', ') : item.selected_ingredients)}
                              </span>
                            )}
                            {item.selected_extras && item.selected_extras.length > 0 && (
                              <span className="worker-order-item-addons">
                                + {(Array.isArray(item.selected_extras) ? item.selected_extras.map(e => e.name || e).join(', ') : item.selected_extras)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="worker-order-total">
                    ${isNaN(order.total) ? '0.00' : Number(order.total).toFixed(2)}
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
        )}
        {activeTab === 'tasks' && (
          <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
            {taskError && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
                borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <FontAwesomeIcon icon={faExclamationTriangle} />
                {taskError}
                <button onClick={() => setTaskError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '16px' }}>×</button>
              </div>
            )}
            {tasksLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Cargando tareas...</div>
            ) : tasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: '#888' }}>
                <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: '36px', marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                <p style={{ margin: 0 }}>No tienes tareas asignadas esta semana</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[0,1,2,3,4,5,6].map(dow => {
                  const dayTasks = tasks.filter(t => t.day_of_week === dow);
                  if (!dayTasks.length) return null;
                  const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
                  const isToday = new Date().getDay() === dow;
                  return (
                    <div key={dow}>
                      <div style={{
                        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '1px', color: isToday ? '#D4AF37' : '#666',
                        padding: '4px 0 8px'
                      }}>
                        {dayNames[dow]}{isToday ? ' — Hoy' : ''}
                      </div>
                      {dayTasks.map(task => {
                        const status = getTaskStatus(task);
                        const countdown = status === 'active' ? getCountdown(task) : null;
                        const [h, m] = task.due_time.split(':').map(Number);
                        const due = new Date(); due.setHours(h, m, 0, 0);
                        const expireTime = new Date(due.getTime() + 3600000);
                        const expireStr = expireTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div key={task.id} style={{
                            background: status === 'completed' ? 'rgba(22,163,74,0.06)'
                              : status === 'active' ? 'rgba(217,119,6,0.06)'
                              : status === 'expired' ? 'rgba(220,38,38,0.04)'
                              : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${
                              status === 'completed' ? 'rgba(22,163,74,0.2)'
                              : status === 'active' ? 'rgba(217,119,6,0.3)'
                              : status === 'expired' ? 'rgba(220,38,38,0.15)'
                              : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: '12px', padding: '14px 16px', marginBottom: '6px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              <div style={{
                                width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                                background: status === 'completed' ? 'rgba(22,163,74,0.15)'
                                  : status === 'active' ? 'rgba(217,119,6,0.15)'
                                  : 'rgba(255,255,255,0.05)',
                                color: status === 'completed' ? '#16a34a' : status === 'active' ? '#d97706' : '#666'
                              }}>
                                {status === 'completed' ? <FontAwesomeIcon icon={faCheck} />
                                  : status === 'expired' ? <FontAwesomeIcon icon={faTimes} />
                                  : <FontAwesomeIcon icon={faClock} />}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '3px' }}>{task.name}</div>
                                {task.description && (
                                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '5px' }}>{task.description}</div>
                                )}
                                <div style={{ fontSize: '12px', color: '#aaa' }}>
                                  Disponible: {task.due_time} — {expireStr}
                                  {task.completed_at && (
                                    <span style={{ color: '#16a34a', marginLeft: 8 }}>
                                      · Marcada a las {new Date(task.completed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {status === 'active' && (
                              <div style={{ marginTop: '12px' }}>
                                {countdown && (
                                  <div style={{
                                    textAlign: 'center', fontSize: '13px', color: '#d97706',
                                    fontWeight: 700, marginBottom: '8px'
                                  }}>
                                    <FontAwesomeIcon icon={faClock} style={{ marginRight: 6 }} />
                                    Tiempo restante: {countdown}
                                  </div>
                                )}
                                <button
                                  onClick={() => completeTask(task.id)}
                                  disabled={completingTask === task.id}
                                  style={{
                                    width: '100%', padding: '11px', borderRadius: '10px',
                                    background: completingTask === task.id ? 'rgba(212,175,55,0.3)' : '#D4AF37',
                                    color: '#000', border: 'none', fontWeight: 800, fontSize: '14px',
                                    cursor: completingTask === task.id ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                  }}
                                >
                                  <FontAwesomeIcon icon={faCheck} />
                                  {completingTask === task.id ? 'Marcando...' : 'Marcar como completada'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
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
                            <strong>Complementos:</strong> {Array.isArray(item.selected_ingredients) ? item.selected_ingredients.map(i => i.name || i).join(', ') : item.selected_ingredients}
                          </div>
                        )}
                        {item.selected_extras && item.selected_extras.length > 0 && (
                          <div className="worker-item-extras">
                            <strong>Extras:</strong> {Array.isArray(item.selected_extras) ? item.selected_extras.map(e => e.name || e).join(', ') : item.selected_extras}
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
                payResult._isPendingCash ? (
                  <button
                    className="worker-action-btn approve"
                    style={{ width: '100%', justifyContent: 'center', fontSize: '1.05rem', padding: '14px', marginBottom: '10px' }}
                    onClick={handleApprovePay}
                  >
                    <FontAwesomeIcon icon={faCheck} /> Marcar como Pagado
                  </button>
                ) : (
                  <div style={{ color: '#f59e0b', textAlign: 'center', padding: '8px', marginBottom: '10px' }}>
                    Este pedido ya está procesado (estado: {payResult.status})
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
    </div>
  );
}

export default WorkerPanel;
