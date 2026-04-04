import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBox, faClock, faCheck, faTimes, faSearch, faSignOutAlt, faUserCog, faMoneyBillWave } from '@fortawesome/free-solid-svg-icons';

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

    const socket = io('http://localhost:3001');

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

  const s = {
    container: {
      minHeight: '100vh',
      background: '#f5f5f5'
    },
    header: {
      background: colors.primary,
      padding: '20px 30px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    },
    headerTitle: {
      color: colors.secondary,
      margin: 0,
      fontSize: '20px'
    },
    headerSubtitle: {
      color: `${colors.secondary}99`,
      margin: '4px 0 0 0',
      fontSize: '13px'
    },
    headerButtons: {
      display: 'flex',
      gap: '10px'
    },
    switchButton: {
      background: `${colors.secondary}22`,
      color: colors.secondary,
      border: 'none',
      padding: '10px 20px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    logoutButton: {
      background: colors.accent,
      color: colors.secondary,
      border: 'none',
      padding: '10px 20px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    statsContainer: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '15px',
      padding: '20px 30px',
      background: colors.secondary
    },
    statCard: {
      textAlign: 'center',
      padding: '15px',
      borderRadius: '12px',
      background: '#f8f8f8'
    },
    statNumber: {
      display: 'block',
      fontSize: '32px',
      fontWeight: 'bold',
      color: colors.primary
    },
    statLabel: {
      color: '#666',
      fontSize: '12px',
      marginTop: '4px'
    },
    controls: {
      display: 'flex',
      gap: '15px',
      padding: '0 30px 20px 30px',
      background: colors.secondary
    },
    searchContainer: {
      flex: 1,
      position: 'relative'
    },
    searchIcon: {
      position: 'absolute',
      left: '15px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#999'
    },
    searchInput: {
      width: '100%',
      padding: '12px 12px 12px 45px',
      border: '2px solid #e5e5e5',
      borderRadius: '10px',
      fontSize: '14px',
      outline: 'none',
      boxSizing: 'border-box'
    },
    filterContainer: {
      display: 'flex',
      gap: '8px'
    },
    filterButton: (isActive) => ({
      padding: '10px 16px',
      border: isActive ? 'none' : '2px solid #e5e5e5',
      background: isActive ? colors.primary : colors.secondary,
      color: isActive ? colors.secondary : '#666',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 'bold'
    }),
    tabsContainer: {
      display: 'flex',
      gap: '10px',
      marginTop: '15px',
      borderBottom: `2px solid ${colors.primary}20`
    },
    tabButton: (active) => ({
      padding: '12px 20px',
      border: 'none',
      background: 'transparent',
      color: active ? colors.primary : '#666',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      borderBottom: active ? `3px solid ${colors.primary}` : '3px solid transparent',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }),
    ordersContainer: {
      padding: '20px 30px',
      background: colors.secondary,
      minHeight: '300px'
    },
    ordersList: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '16px',
      paddingBottom: '15px',
      minHeight: '200px'
    },
    orderCard: {
      flex: '1 1 280px',
      maxWidth: '320px',
      background: '#f8f9fa',
      borderRadius: '16px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      cursor: 'pointer',
      transition: 'all 0.2s',
      border: '1px solid #e5e5e5'
    },
    orderHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '12px'
    },
    orderNumber: {
      fontSize: '16px',
      fontWeight: 'bold',
      color: colors.primary,
      margin: 0
    },
    orderInfo: {
      marginBottom: '12px'
    },
    customerName: {
      color: '#333',
      margin: '0 0 4px 0',
      fontSize: '14px',
      fontWeight: '500'
    },
    orderTime: {
      color: '#999',
      fontSize: '12px',
      margin: 0
    },
    statusBadge: (status) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 12px',
      borderRadius: '20px',
      background: `${getStatusColor(status)}22`,
      color: getStatusColor(status),
      fontSize: '12px',
      fontWeight: 'bold',
      textTransform: 'capitalize'
    }),
    totalAmount: {
      fontSize: '20px',
      fontWeight: 'bold',
      color: colors.primary,
      marginTop: 'auto',
      paddingTop: '12px',
      borderTop: '1px solid #e5e5e5'
    },
    viewButton: {
      background: colors.primary,
      color: colors.secondary,
      border: 'none',
      padding: '10px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 'bold',
      marginTop: '10px',
      width: '100%'
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    modalContent: {
      background: colors.secondary,
      borderRadius: '16px',
      padding: '30px',
      width: '90%',
      maxWidth: '500px',
      maxHeight: '80vh',
      overflow: 'auto'
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      paddingBottom: '15px',
      borderBottom: '2px solid #f0f0f0'
    },
    modalTitle: {
      margin: 0,
      color: colors.primary,
      fontSize: '22px'
    },
    closeButton: {
      background: 'none',
      border: 'none',
      fontSize: '24px',
      cursor: 'pointer',
      color: '#999'
    },
    detailRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: '1px solid #f0f0f0'
    },
    detailLabel: {
      color: '#666',
      fontSize: '14px'
    },
    detailValue: {
      color: colors.primary,
      fontWeight: 'bold',
      fontSize: '14px'
    },
    itemsList: {
      marginTop: '15px'
    },
    item: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '10px',
      background: '#f8f8f8',
      borderRadius: '8px',
      marginBottom: '8px'
    },
    itemName: {
      color: colors.primary,
      fontWeight: '500'
    },
    itemQty: {
      color: '#666',
      fontSize: '13px'
    },
    itemPrice: {
      color: colors.primary,
      fontWeight: 'bold'
    },
    modalActions: {
      display: 'flex',
      gap: '12px',
      marginTop: '25px',
      flexWrap: 'wrap'
    },
    actionButton: {
      flex: 1,
      minWidth: '120px',
      padding: '14px',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 'bold',
      textAlign: 'center'
    },
    loadingContainer: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: '#f5f5f5'
    },
    spinner: {
      width: '50px',
      height: '50px',
      border: `4px solid ${colors.primary}22`,
      borderTopColor: colors.primary,
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    },
    emptyState: {
      textAlign: 'center',
      padding: '60px 20px',
      color: '#999'
    },
    workerList: {
      maxHeight: '300px',
      overflowY: 'auto'
    },
    workerItem: (isSelected) => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 15px',
      borderRadius: '8px',
      marginBottom: '8px',
      background: isSelected ? `${colors.primary}22` : '#f8f8f8',
      cursor: 'pointer',
      border: isSelected ? `2px solid ${colors.primary}` : '2px solid transparent',
      transition: 'all 0.2s'
    }),
    workerAvatar: {
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      background: colors.primary,
      color: colors.secondary,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold'
    },
    workerName: {
      color: colors.primary,
      fontWeight: '500',
      flex: 1,
      marginLeft: '12px'
    },
    currentBadge: {
      background: colors.accent,
      color: colors.secondary,
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 'bold'
    }
  };

  if (loading) {
    return (
      <div style={s.loadingContainer}>
        <div style={s.spinner}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
    <div style={s.container}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      
      <header style={s.header}>
        <div>
          <h1 style={s.headerTitle}>Panel de Trabajador</h1>
          <p style={s.headerSubtitle}>{worker?.store_name || 'Tienda'}</p>
        </div>
        <div style={s.headerButtons}>
          <button onClick={() => setShowWorkerSwitch(true)} style={s.switchButton}>
            <FontAwesomeIcon icon={faUserCog} />
            Cambiar Usuario
          </button>
          <button onClick={handleLogout} style={s.logoutButton}>
            <FontAwesomeIcon icon={faSignOutAlt} />
          </button>
        </div>
      </header>

      <div style={s.statsContainer}>
        <div style={s.statCard}>
          <span style={s.statNumber}>{stats.pending}</span>
          <span style={s.statLabel}>Pendientes</span>
        </div>
        <div style={s.statCard}>
          <span style={s.statNumber}>{stats.preparing}</span>
          <span style={s.statLabel}>Preparando</span>
        </div>
        <div style={s.statCard}>
          <span style={s.statNumber}>{stats.ready}</span>
          <span style={s.statLabel}>Listos</span>
        </div>
        <div style={s.statCard}>
          <span style={s.statNumber}>{stats.total}</span>
          <span style={s.statLabel}>Total</span>
        </div>
      </div>

      <div style={s.controls}>
        <div style={s.searchContainer}>
          <FontAwesomeIcon icon={faSearch} style={s.searchIcon} />
          <input
            type="text"
            placeholder="Buscar por número de pedido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={s.searchInput}
          />
        </div>
        <div style={s.filterContainer}>
          {['all', 'pending', 'preparing', 'ready'].map(f => (
            <button
              key={f}
              style={s.filterButton(filter === f)}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div style={s.tabsContainer}>
          <button
            style={s.tabButton(activeTab === 'active')}
            onClick={() => setActiveTab('active')}
          >
            <FontAwesomeIcon icon={faClock} /> Activos ({orders.length})
          </button>
          <button
            style={{
              ...s.tabButton(activeTab === 'cash'),
              background: activeTab === 'cash' ? colors.primary : 'transparent',
              color: activeTab === 'cash' ? colors.secondary : '#666',
              borderBottom: activeTab === 'cash' ? `3px solid ${colors.accent}` : '3px solid transparent',
              position: 'relative'
            }}
            onClick={() => setActiveTab('cash')}
          >
            <FontAwesomeIcon icon={faMoneyBillWave} /> Efectivo ({pendingCashOrders.length})
            {pendingCashOrders.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: '#DC3545',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}>
                {pendingCashOrders.length}
              </span>
            )}
          </button>
          <button
            style={s.tabButton(activeTab === 'completed')}
            onClick={() => setActiveTab('completed')}
          >
            <FontAwesomeIcon icon={faCheck} /> Completados ({completedOrders.length})
          </button>
        </div>
      </div>

      <div style={s.ordersContainer}>
        {activeTab === 'active' ? (
          filteredOrders.length === 0 ? (
            <div style={s.emptyState}>
              <p>No hay pedidos activos</p>
            </div>
          ) : (
            <div style={s.ordersList}>
              {filteredOrders.map(order => (
                <div 
                  key={order.id} 
                  style={s.orderCard}
                  onClick={() => setSelectedOrder(order)}
                >
                  <div style={s.orderHeader}>
                    <h3 style={s.orderNumber}>{getOrderDisplayNumber(order)}</h3>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      background: order.order_type === 'takeout' ? '#007BFF' : '#28A745',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}>
                      <FontAwesomeIcon icon={order.order_type === 'takeout' ? faBox : faClock} />
                      {order.order_type === 'takeout' ? 'Llevar' : 'Aqui'}
                    </div>
                  </div>
                  <div style={s.orderInfo}>
                    <div style={s.statusBadge(order.status)}>
                      <FontAwesomeIcon icon={getStatusIcon(order.status)} />
                      {order.status}
                    </div>
                    <p style={s.orderTime}>
                      {new Date(order.created_at).toLocaleTimeString('es-ES', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                  <div style={s.totalAmount}>
                    ${isNaN(order.total) ? '0.00' : Number(order.total).toFixed(2)}
                  </div>
                  <button style={s.viewButton} onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}>
                    Ver Detalles
                  </button>
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'cash' ? (
          pendingCashOrders.length === 0 ? (
            <div style={s.emptyState}>
              <p>No hay pagos en efectivo pendientes</p>
            </div>
          ) : (
            <div style={s.ordersList}>
              {pendingCashOrders.map(order => (
                <div 
                  key={order.id} 
                  style={{...s.orderCard, border: '2px solid #DC3545'}}
                >
                  <div style={s.orderHeader}>
                    <h3 style={s.orderNumber}>{getOrderDisplayNumber(order)}</h3>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      background: '#28A745',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}>
                      <FontAwesomeIcon icon={faMoneyBillWave} /> Efectivo
                    </div>
                  </div>
                  <div style={s.orderInfo}>
                    <div style={{...s.statusBadge('pending'), background: '#FFC107', color: '#000'}}>
                      <FontAwesomeIcon icon={faClock} /> Pendiente de Pago
                    </div>
                    <p style={s.orderTime}>
                      {new Date(order.created_at).toLocaleTimeString('es-ES', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                  <div style={s.totalAmount}>
                    ${isNaN(order.total) ? '0.00' : Number(order.total).toFixed(2)}
                  </div>
                  <button 
                    style={{...s.viewButton, background: '#28A745', color: 'white'}}
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
            <div style={s.emptyState}>
              <p>No hay pedidos completados</p>
            </div>
          ) : (
            <div style={s.ordersList}>
              {filteredCompletedOrders.map(order => (
                <div 
                  key={order.id} 
                  style={{...s.orderCard, opacity: 0.8}}
                  onClick={() => setSelectedOrder(order)}
                >
                  <div style={s.orderHeader}>
                    <h3 style={s.orderNumber}>{getOrderDisplayNumber(order)}</h3>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      background: order.order_type === 'takeout' ? '#007BFF' : '#28A745',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}>
                      <FontAwesomeIcon icon={order.order_type === 'takeout' ? faBox : faClock} />
                      {order.order_type === 'takeout' ? 'Llevar' : 'Aqui'}
                    </div>
                  </div>
                  <div style={s.orderInfo}>
                    <div style={{...s.statusBadge('completed'), background: '#28a745', color: 'white'}}>
                      <FontAwesomeIcon icon={faCheck} /> Completado
                    </div>
                    <p style={s.orderTime}>
                      {new Date(order.completed_at || order.created_at).toLocaleString('es-ES', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                  <div style={s.totalAmount}>
                    ${isNaN(order.total) ? '0.00' : Number(order.total).toFixed(2)}
                  </div>
                  {order.completed_by_name && (
                    <p style={{fontSize: '11px', color: '#666', marginTop: '8px'}}>
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
        <div style={s.modal} onClick={() => setSelectedOrder(null)}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Pedido #{getOrderDisplayNumber(selectedOrder)}</h2>
              <button style={s.closeButton} onClick={() => setSelectedOrder(null)}>×</button>
            </div>

            <div style={s.detailRow}>
              <span style={s.detailLabel}>Tipo:</span>
              <span style={{
                ...s.detailValue,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <FontAwesomeIcon icon={selectedOrder.order_type === 'takeout' ? faBox : faClock} style={{ fontSize: '16px' }} />
                {selectedOrder.order_type === 'takeout' ? 'Para Llevar' : 'Para Comer Aqui'}
              </span>
            </div>
            <div style={s.detailRow}>
              <span style={s.detailLabel}>Estado:</span>
              <span style={s.detailValue}>{selectedOrder.status}</span>
            </div>
            <div style={s.detailRow}>
              <span style={s.detailLabel}>Total:</span>
              <span style={s.detailValue}>${isNaN(selectedOrder.total) ? '0.00' : Number(selectedOrder.total).toFixed(2)}</span>
            </div>

            {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <div style={s.itemsList}>
                    <h4 style={{ color: colors.primary, marginBottom: '10px' }}>Productos:</h4>
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} style={{ ...s.item, flexDirection: 'column', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
                          <span style={s.itemName}>{item.quantity}x {item.product_name || item.name || 'Producto'}</span>
                          <span style={s.itemPrice}>${(Number(item.unit_price) * Number(item.quantity)).toFixed(2)}</span>
                        </div>
                        {item.selected_ingredients && item.selected_ingredients.length > 0 && (
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                            <strong>Ingredientes:</strong> {Array.isArray(item.selected_ingredients) ? item.selected_ingredients.map(i => i.name || i).join(', ') : item.selected_ingredients}
                          </div>
                        )}
                        {item.selected_extras && item.selected_extras.length > 0 && (
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                            <strong>Extras:</strong> {Array.isArray(item.selected_extras) ? item.selected_extras.map(e => e.name || e).join(', ') : item.selected_extras}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

            {selectedOrder.status !== 'completed' && (
              <div style={s.modalActions}>
                {selectedOrder.status === 'pending' && (
                  <button 
                    style={{...s.actionButton, background: '#f59e0b', color: 'white'}}
                    onClick={() => updateOrderStatus(selectedOrder.id, 'preparing')}
                  >
                    <FontAwesomeIcon icon={faBox} /> Preparando
                  </button>
                )}
                {selectedOrder.status === 'preparing' && (
                  <button 
                    style={{...s.actionButton, background: '#22c55e', color: 'white'}}
                    onClick={() => updateOrderStatus(selectedOrder.id, 'ready')}
                  >
                    <FontAwesomeIcon icon={faCheck} /> Listo
                  </button>
                )}
                {selectedOrder.status === 'ready' && (
                  <button 
                    style={{...s.actionButton, background: '#8b5cf6', color: 'white', fontSize: '16px', padding: '14px 24px'}}
                    onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}
                  >
                    <FontAwesomeIcon icon={faCheck} /> Marcar Completado
                  </button>
                )}
              </div>
            )}

            {selectedOrder.status === 'completed' && selectedOrder.completed_by_name && (
              <div style={{textAlign: 'center', padding: '15px', background: '#f0fdf4', borderRadius: '8px', marginTop: '10px'}}>
                <p style={{fontSize: '14px', color: '#166534', margin: 0}}>
                  <FontAwesomeIcon icon={faCheck} /> Completado por <strong>{selectedOrder.completed_by_name}</strong>
                </p>
                {selectedOrder.completed_at && (
                  <p style={{fontSize: '12px', color: '#666', marginTop: '5px'}}>
                    {new Date(selectedOrder.completed_at).toLocaleString('es-ES')}
                  </p>
                )}
              </div>
            )}

            <div style={{...s.modalActions, marginTop: '15px'}}>
              <button 
                style={{...s.actionButton, background: colors.primary, color: colors.secondary}}
                onClick={() => setSelectedOrder(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showWorkerSwitch && (
        <div style={s.modal} onClick={() => setShowWorkerSwitch(false)}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Cambiar Usuario</h2>
              <button style={s.closeButton} onClick={() => setShowWorkerSwitch(false)}>×</button>
            </div>

            <div style={s.workerList}>
              {workers.map(w => (
                <div 
                  key={w.id}
                  style={s.workerItem(w.id === worker.id)}
                  onClick={() => w.id !== worker.id && switchWorker(w)}
                >
                  <div style={s.workerAvatar}>
                    {w.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <span style={s.workerName}>{w.username}</span>
                  {w.id === worker.id && (
                    <span style={s.currentBadge}>Actual</span>
                  )}
                </div>
              ))}
            </div>

            <div style={s.modalActions}>
              <button 
                style={{...s.actionButton, background: colors.primary, color: colors.secondary}}
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
