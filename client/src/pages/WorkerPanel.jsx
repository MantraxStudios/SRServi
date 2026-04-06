import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBox, faClock, faCheck, faTimes, faSearch, faSignOutAlt, faUserCog, faMoneyBillWave } from '@fortawesome/free-solid-svg-icons';
import { SOCKET_URL } from '../config.js';

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

  const colors = storeColors || {
    primary: '#1a1a2e',
    secondary: '#ffffff',
    accent: '#e94560'
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

    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
      socket.emit('register_store', parsedWorker.store_id);
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

    return () => socket.disconnect();
  }, [navigate]);

  const fetchStoreColors = async (storeId) => {
    try {
      const response = await fetch(`/api/stores/${storeId}`);
      if (!response.ok) throw new Error('Store not found');
      const data = await response.json();
      setStoreColors({
        primary: data.primary_color || '#1a1a2e',
        secondary: data.secondary_color || '#ffffff',
        accent: data.accent_color || '#e94560'
      });
    } catch (error) {
      console.error('Error fetching store colors:', error);
    }
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
      console.log('Orders fetched:', data.length);
      if (data.length > 0) {
        console.log('First order order_type:', data[0].order_type);
      }
      const activeOrders = data.filter(o => o.status !== 'completed' && o.payment_process === 1);
      const completed = data.filter(o => o.status === 'completed');
      const pendingCash = data.filter(o => o.payment_method === 'cash' && !o.cash_approved && o.payment_process === 0);
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

  const getOrderDisplayNumber = (order) => {
    if (order.order_number) return order.order_number;
    const id = order.id || 0;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const letter = letters[id % 26] || 'A';
    const num = (id % 99) + 1;
    return `${letter}${num.toString().padStart(2, '0')}`;
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
          <button className="worker-switch-btn" onClick={() => setShowWorkerSwitch(true)}>
            <FontAwesomeIcon icon={faUserCog} />
            Cambiar Usuario
          </button>
          <button className="worker-logout-btn" onClick={handleLogout}>
            <FontAwesomeIcon icon={faSignOutAlt} />
          </button>
        </div>
      </header>

      <div className="worker-stats">
        <div className="worker-stat">
          <span className="worker-stat-number">{stats.pending}</span>
          <span className="worker-stat-label">Pendientes</span>
        </div>
        <div className="worker-stat">
          <span className="worker-stat-number">{stats.preparing}</span>
          <span className="worker-stat-label">Preparando</span>
        </div>
        <div className="worker-stat">
          <span className="worker-stat-number">{stats.ready}</span>
          <span className="worker-stat-label">Listos</span>
        </div>
        <div className="worker-stat">
          <span className="worker-stat-number">{stats.total}</span>
          <span className="worker-stat-label">Total</span>
        </div>
      </div>

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
            className={`worker-tab ${activeTab === 'cash' ? 'active' : ''}`}
            onClick={() => setActiveTab('cash')}
          >
            <FontAwesomeIcon icon={faMoneyBillWave} /> Efectivo ({pendingCashOrders.length})
            {pendingCashOrders.length > 0 && (
              <span className="worker-tab-badge">
                {pendingCashOrders.length}
              </span>
            )}
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
                    <div className={`worker-order-type ${order.order_type === 'takeout' ? 'takeout' : 'serve'}`}>
                      <FontAwesomeIcon icon={order.order_type === 'takeout' ? faBox : faClock} />
                      {order.order_type === 'takeout' ? 'Llevar' : 'Aqui'}
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
                  <div className="worker-order-total">
                    ${isNaN(order.total) ? '0.00' : Number(order.total).toFixed(2)}
                  </div>
                  <button className="worker-view-btn" onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}>
                    Ver Detalles
                  </button>
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'cash' ? (
          pendingCashOrders.length === 0 ? (
            <div className="empty-state">
              <p>No hay pagos en efectivo pendientes</p>
            </div>
          ) : (
            <div className="worker-orders-list">
              {pendingCashOrders.map(order => (
                <div
                  key={order.id}
                  className="worker-order-card cash-pending"
                >
                  <div className="worker-order-header">
                    <h3 className="worker-order-number">{getOrderDisplayNumber(order)}</h3>
                    <div className="worker-order-type serve">
                      <FontAwesomeIcon icon={faMoneyBillWave} /> Efectivo
                    </div>
                  </div>
                  <div className="worker-order-info">
                    <div className="worker-status-badge cash-pending-badge">
                      <FontAwesomeIcon icon={faClock} /> Pendiente de Pago
                    </div>
                    <p className="worker-order-time">
                      {new Date(order.created_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="worker-order-total">
                    ${isNaN(order.total) ? '0.00' : Number(order.total).toFixed(2)}
                  </div>
                  <button
                    className="worker-action-btn approve"
                    onClick={() => approveCashPayment(order.id)}
                  >
                    <FontAwesomeIcon icon={faCheck} /> Aprobar Pago
                  </button>
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
                    <div className={`worker-order-type ${order.order_type === 'takeout' ? 'takeout' : 'serve'}`}>
                      <FontAwesomeIcon icon={order.order_type === 'takeout' ? faBox : faClock} />
                      {order.order_type === 'takeout' ? 'Llevar' : 'Aqui'}
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
                <FontAwesomeIcon icon={selectedOrder.order_type === 'takeout' ? faBox : faClock} />
                {selectedOrder.order_type === 'takeout' ? 'Para Llevar' : 'Para Comer Aqui'}
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
    </div>
  );
}

export default WorkerPanel;
