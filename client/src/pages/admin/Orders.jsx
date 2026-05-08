import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShoppingBag, faUtensils, faFileExcel, faCashRegister, faLockOpen, faLock } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

function Orders() {
  const { selectedStore } = useStore();
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cashRegister, setCashRegister] = useState(null);
  const [cashLoading, setCashLoading] = useState(false);

  // CSV export — opens natively in Excel. Uses UTF-8 BOM and semicolon
  // separator so Excel in Spanish locales parses it correctly.
  const downloadExcel = () => {
    if (!orders.length) return;
    const headers = [
      'N° Pedido', 'Fecha', 'Tipo', 'Estado', 'Total',
      'Producto', 'Cantidad', 'Precio unitario', 'Subtotal',
      'Ingredientes', 'Extras'
    ];
    const escape = (v) => {
      const s = String(v ?? '');
      if (/[;"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const rows = [headers.join(';')];
    orders.forEach(order => {
      const base = [
        order.id,
        new Date(order.created_at).toLocaleString('es-CL'),
        order.order_type === 'takeout' ? 'Para llevar' : 'Para comer aquí',
        order.status === 'pending' ? 'Pendiente' : 'Completado',
        Number(order.total).toFixed(2)
      ];
      if (Array.isArray(order.items) && order.items.length) {
        order.items.forEach(item => {
          rows.push([
            ...base,
            item.product_name,
            item.quantity,
            Number(item.unit_price).toFixed(2),
            (Number(item.unit_price) * Number(item.quantity)).toFixed(2),
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
    const storeName = (selectedStore?.name || 'tienda').replace(/[^a-z0-9]/gi, '_');
    const dateTag = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `ventas_${storeName}_${dateTag}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (selectedStore) {
      setLoading(true);
      fetchOrders();
      fetchCashRegister();
    } else {
      setLoading(false);
      setOrders([]);
      setCashRegister(null);
    }
  }, [selectedStore]);

  const fetchCashRegister = async () => {
    if (!selectedStore) return;
    try {
      const res = await fetch(`/api/cash-register/status/${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCashRegister(data.open ? data.register : null);
      }
    } catch (e) {
      console.error('Error fetching cash register:', e);
    }
  };

  const openAdminCashRegister = async () => {
    setCashLoading(true);
    try {
      const res = await fetch('/api/admin/cash-register/open', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStore.id })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Error al abrir caja'); return; }
      setCashRegister(data);
    } catch (e) {
      alert('Error de conexión al abrir la caja');
    } finally {
      setCashLoading(false);
    }
  };

  const closeAdminCashRegister = async () => {
    setCashLoading(true);
    try {
      const res = await fetch('/api/admin/cash-register/close', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStore.id })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Error al cerrar caja'); return; }
      setCashRegister(null);
    } catch (e) {
      alert('Error de conexión al cerrar la caja');
    } finally {
      setCashLoading(false);
    }
  };

  const fetchOrders = async () => {
    if (!selectedStore) {
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/orders?store_id=${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <>
      <header className="admin-header">
        <h1>Pedidos</h1>
        <button
          className="btn btn-primary"
          onClick={downloadExcel}
          disabled={!orders.length}
          title="Descargar ventas en formato Excel (CSV)"
        >
          <FontAwesomeIcon icon={faFileExcel} /> Descargar Excel
        </button>
      </header>
      <div className="admin-main">
        {/* Cash register control */}
        {selectedStore && (
          <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FontAwesomeIcon
                icon={faCashRegister}
                style={{ fontSize: 22, color: cashRegister ? '#22c55e' : '#9ca3af' }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  Caja {cashRegister ? 'abierta' : 'cerrada'}
                </div>
                {cashRegister && (
                  <div className="text-sm text-muted">
                    Abierta por {cashRegister.worker_name} · {new Date(cashRegister.opened_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
            <button
              className={`btn ${cashRegister ? 'btn-danger' : 'btn-success'}`}
              onClick={cashRegister ? closeAdminCashRegister : openAdminCashRegister}
              disabled={cashLoading}
            >
              <FontAwesomeIcon icon={cashRegister ? faLock : faLockOpen} />
              {cashLoading ? ' Procesando...' : cashRegister ? ' Cerrar caja' : ' Abrir caja'}
            </button>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="card empty-state">
            <FontAwesomeIcon icon={faShoppingBag} className="empty-state-icon" />
            <h2 className="empty-state-title">No hay pedidos</h2>
            <p className="empty-state-text">
              Los pedidos realizados por tus clientes apareceran aqui
            </p>
          </div>
        ) : (
          <div className="grid-list">
            {orders.map(order => (
              <div key={order.id} className="card">
                <div className="card-header">
                  <div>
                    <h3>Pedido #{order.id}</h3>
                    <p className="text-muted text-sm">
                      {formatDate(order.created_at)}
                    </p>
                    <div className={`order-type-badge ${order.order_type === 'takeout' ? 'takeout' : 'serve'}`}>
                      <span>
                        <FontAwesomeIcon icon={order.order_type === 'takeout' ? faShoppingBag : faUtensils} />
                      </span>
                      {order.order_type === 'takeout' ? 'Para Llevar' : 'Para Comer Aqui'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="order-amount">
                      ${order.total.toFixed(2)}
                    </div>
                    <span className={`badge ${order.status === 'pending' ? 'badge-warning' : 'badge-success'}`}>
                      {order.status === 'pending' ? 'Pendiente' : 'Completado'}
                    </span>
                  </div>
                </div>
                <div className="grid-list">
                  {order.items.map((item, index) => (
                    <div key={index} className="order-row flex-col">
                      <div className="flex justify-between w-full">
                        <span className="font-bold">{item.quantity}x {item.product_name}</span>
                        <span className="order-amount text-sm">
                          ${(item.unit_price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                      {item.selected_ingredients && item.selected_ingredients.length > 0 && (
                        <div className="text-sm text-muted">
                          <strong>Ingredientes:</strong> {item.selected_ingredients.join(', ')}
                        </div>
                      )}
                      {item.selected_extras && item.selected_extras.length > 0 && (
                        <div className="text-sm text-muted">
                          <strong>Extras:</strong> {item.selected_extras.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default Orders;
