import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBox, faClock, faCheck, faTimes, faSearch, faSignOutAlt, faUserCog, faMoneyBillWave, faPlus, faExternalLinkAlt, faUtensils, faShoppingBag, faMotorcycle, faConciergeBell, faFileExcel } from '@fortawesome/free-solid-svg-icons';
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
  const [storeCode, setStoreCode] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [paySearch, setPaySearch] = useState('');
  const [payResult, setPayResult] = useState(null);

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

    // Polling de respaldo cada 30 segundos
    const pollInterval = setInterval(() => {
      fetchOrders(parsedWorker.store_id);
    }, 30000);

    // Recargar cuando la ventana recupera el foco
    const handleFocus = () => {
      fetchOrders(parsedWorker.store_id);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      socket.disconnect();
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

  // CSV export — descarga todos los pedidos del día en formato Excel (CSV con
   // BOM UTF-8 y separador ";" para que Excel en español lo parsee bien).
  const downloadTodayExcel = () => {
    const all = [
      ...(orders || []),
      ...(completedOrders || []),
      ...(pendingCashOrders || [])
    ];
    if (!all.length) return;
    // Dedup por id (por si un pedido estuviera en más de una lista)
    const seen = new Set();
    const todayOrders = all.filter(o => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });

    const headers = [
      'N° Pedido', 'Fecha', 'Tipo', 'Estado', 'Método pago', 'Total',
      'Producto', 'Cantidad', 'Precio unitario', 'Subtotal',
      'Ingredientes', 'Extras'
    ];
    const escape = (v) => {
      const s = String(v ?? '');
      if (/[;"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const statusLabel = (s) => ({
      pending: 'Pendiente', preparing: 'En preparación',
      ready: 'Listo', completed: 'Completado'
    })[s] || s || '';
    const methodLabel = (m) => ({
      cash: 'Efectivo', card: 'Tarjeta', qr: 'QR'
    })[m] || m || '';

    const rows = [headers.join(';')];
    todayOrders.forEach(order => {
      const base = [
        order.id,
        new Date(order.created_at).toLocaleString('es-CL'),
        order.order_type === 'takeout' ? 'Para llevar' : 'Para comer aquí',
        statusLabel(order.status),
        methodLabel(order.payment_method),
        Number(order.total || 0).toFixed(2)
      ];
      const items = Array.isArray(order.items) ? order.items : [];
      if (items.length) {
        items.forEach(item => {
          rows.push([
            ...base,
            item.product_name,
            item.quantity,
            Number(item.unit_price || 0).toFixed(2),
            (Number(item.unit_price || 0) * Number(item.quantity || 0)).toFixed(2),
            Array.isArray(item.selected_ingredients) ? item.selected_ingredients.join(', ') : '',
            Array.isArray(item.selected_extras) ? item.selected_extras.join(', ') : ''
          ].map(escape).join(';'));
        });
      } else {
        rows.push([...base, '', '', '', '', '', ''].map(escape).join(';'));
      }
    });

    const csv = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const storeName = (worker?.store_name || 'tienda').replace(/[^a-z0-9]/gi, '_');
    const dateTag = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `pedidos_${storeName}_${dateTag}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  const stats = {
    pending: orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready: orders.filter(o => o.status === 'ready').length,
    total: orders.length
  };

  return (
    <div className="worker-container" style={{
      '--store-primary': colors.primary,
      '--store-secondary': colors.secondary,
      '--store-accent': colors.accent
    }}>
      <header className="worker-header">
        <div>
          <h1 className="worker-header-title">Panel de Trabajador</h1>
          <p className="worker-header-subtitle">{worker?.store_name || 'Tienda'}</p>
        </div>
        <div className="worker-header-buttons">
          <button className="worker-new-order-btn" onClick={() => setShowNewOrder(true)}>
            <FontAwesomeIcon icon={faPlus} />
            <span>Ingresar Pedido</span>
          </button>
          <button className="worker-new-order-btn" onClick={() => setShowPayModal(true)} style={{ background: '#1a6b1a' }}>
            <FontAwesomeIcon icon={faMoneyBillWave} />
            <span>Cobrar</span>
          </button>
          <button
            className="worker-switch-btn"
            onClick={downloadTodayExcel}
            disabled={!(orders.length || completedOrders.length || pendingCashOrders.length)}
            title="Descargar pedidos de hoy en Excel"
          >
            <FontAwesomeIcon icon={faFileExcel} />
            <span>Excel del día</span>
          </button>
          {storeCode && (
            <button className="worker-switch-btn" onClick={() => window.open(`/store/${storeCode}`, '_blank')}>
              <FontAwesomeIcon icon={faExternalLinkAlt} />
              <span>Ver Tienda</span>
            </button>
          )}
          <button className="worker-switch-btn" onClick={() => setShowWorkerSwitch(true)}>
            <FontAwesomeIcon icon={faUserCog} />
            <span>Cambiar</span>
          </button>
          <button className="worker-logout-btn" onClick={handleLogout}>
            <FontAwesomeIcon icon={faSignOutAlt} />
          </button>
        </div>
      </header>

      <div className="worker-controls">
        <div className="worker-search">
          <FontAwesomeIcon icon={faSearch} className="worker-search-icon" />
          <input
            type="text"
            placeholder="Buscar por numero de pedido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="worker-filters">
          {['all', 'pending', 'preparing', 'ready'].map(f => (
            <button
              key={f}
              className={`worker-filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="worker-tabs">
          <button
            className={`worker-tab ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            <FontAwesomeIcon icon={faClock} /> Activos ({orders.length})
          </button>
          <button
            className={`worker-tab ${activeTab === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveTab('completed')}
          >
            <FontAwesomeIcon icon={faCheck} /> Completados ({completedOrders.length})
          </button>
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
                  <div className="worker-order-total">
                    ${isNaN(order.total) ? '0.00' : Number(order.total).toFixed(2)}
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
                            <strong>Ingredientes:</strong> {Array.isArray(item.selected_ingredients) ? item.selected_ingredients.map(i => i.name || i).join(', ') : item.selected_ingredients}
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
                {selectedOrder.status === 'pending' && (
                  <button
                    className="worker-action-btn preparing"
                    onClick={() => updateOrderStatus(selectedOrder.id, 'preparing')}
                  >
                    <FontAwesomeIcon icon={faBox} /> Preparando
                  </button>
                )}
                {selectedOrder.status === 'preparing' && (
                  <button
                    className="worker-action-btn ready"
                    onClick={() => updateOrderStatus(selectedOrder.id, 'ready')}
                  >
                    <FontAwesomeIcon icon={faCheck} /> Listo
                  </button>
                )}
                {selectedOrder.status === 'ready' && (
                  <button
                    className="worker-action-btn complete"
                    onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}
                  >
                    <FontAwesomeIcon icon={faCheck} /> Marcar Completado
                  </button>
                )}
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
        <div className="worker-modal-overlay" onClick={closePayModal}>
          <div className="worker-modal" onClick={e => e.stopPropagation()}>
            <div className="worker-modal-header">
              <h2 className="worker-modal-title">Cobrar Pedido</h2>
              <button className="worker-modal-close" onClick={closePayModal}>x</button>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: colors.secondary }}>Número de Pedido</label>
              <input
                type="text"
                value={paySearch}
                onChange={e => handlePaySearch(e.target.value)}
                placeholder="Ej: A01, B12..."
                autoFocus
                style={{
                  width: '100%', padding: '10px 14px', fontSize: '1.1rem',
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
              <div>
                <div style={{ background: '#111', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                  <div className="worker-detail-row">
                    <span className="worker-detail-label">Pedido:</span>
                    <span className="worker-detail-value" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: colors.accent }}>
                      #{getOrderDisplayNumber(payResult)}
                    </span>
                  </div>
                  <div className="worker-detail-row">
                    <span className="worker-detail-label">Tipo:</span>
                    <span className="worker-detail-value">
                      <FontAwesomeIcon icon={getOrderTypeInfo(payResult.order_type).icon} /> {getOrderTypeInfo(payResult.order_type).label}
                    </span>
                  </div>
                  <div className="worker-detail-row">
                    <span className="worker-detail-label">Total:</span>
                    <span className="worker-detail-value" style={{ color: '#22c55e', fontWeight: 'bold' }}>
                      ${isNaN(payResult.total) ? '0.00' : Number(payResult.total).toFixed(2)}
                    </span>
                  </div>
                  {payResult.items && payResult.items.length > 0 && (
                    <div className="worker-items-list" style={{ marginTop: '8px' }}>
                      {payResult.items.map((item, idx) => (
                        <div key={idx} className="worker-order-item-line">
                          <span className="worker-order-item-qty">{item.quantity}x</span>
                          <span className="worker-order-item-name">{item.product_name || item.name || 'Producto'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {payResult._isPendingCash ? (
                  <button
                    className="worker-action-btn approve"
                    style={{ width: '100%', justifyContent: 'center', fontSize: '1rem', padding: '12px' }}
                    onClick={handleApprovePay}
                  >
                    <FontAwesomeIcon icon={faCheck} /> Marcar como Pagado
                  </button>
                ) : (
                  <div style={{ color: '#f59e0b', textAlign: 'center', padding: '8px' }}>
                    Este pedido ya está procesado (estado: {payResult.status})
                  </div>
                )}
              </div>
            )}

            <div className="worker-modal-actions modal-close-actions" style={{ marginTop: '12px' }}>
              <button className="worker-action-btn close" onClick={closePayModal}>Cerrar</button>
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
