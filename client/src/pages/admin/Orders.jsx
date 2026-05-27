import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShoppingBag, faUtensils, faFileExcel, faCashRegister, faLockOpen, faLock, faCheck, faSpinner, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

function Orders() {
  const { selectedStore } = useStore();
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cashRegister, setCashRegister] = useState(null);
  const [cashLoading, setCashLoading] = useState(false);
  const [showOpenCashModal, setShowOpenCashModal] = useState(false);
  const [showCloseCashModal, setShowCloseCashModal] = useState(false);
  const [cashOpeningAmount, setCashOpeningAmount] = useState('');
  const [completingOrder, setCompletingOrder] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [deletingOrders, setDeletingOrders] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
        body: JSON.stringify({ store_id: selectedStore.id, opening_amount: parseFloat(cashOpeningAmount) || 0 })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Error al abrir caja'); return; }
      setCashRegister(data);
      setCashOpeningAmount('');
      setShowOpenCashModal(false);
    } catch (e) {
      alert('Error de conexión al abrir la caja');
    } finally {
      setCashLoading(false);
    }
  };

  const closeAdminCashRegister = async () => {
    setCashLoading(true);
    setShowCloseCashModal(false);
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

  const markAsCompleted = async (orderId) => {
    setCompletingOrder(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status?store_id=${selectedStore.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'completed' } : o));
      } else {
        const data = await res.json();
        alert(data.error || 'Error al completar el pedido');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setCompletingOrder(null);
    }
  };

  const toggleSelect = (id) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    }
  };

  const deleteSelected = async () => {
    setDeletingOrders(true);
    setShowDeleteConfirm(false);
    try {
      const ids = [...selectedOrders];
      const res = await fetch(`/api/orders/bulk?store_id=${selectedStore.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (res.ok) {
        setOrders(prev => prev.filter(o => !selectedOrders.has(o.id)));
        setSelectedOrders(new Set());
        setSelectMode(false);
      } else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar pedidos');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setDeletingOrders(false);
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {orders.length > 0 && (
            <button
              className={`btn ${selectMode ? 'btn-secondary' : 'btn-secondary'}`}
              onClick={() => { setSelectMode(v => !v); setSelectedOrders(new Set()); }}
              style={selectMode ? { borderColor: '#ef4444', color: '#ef4444' } : {}}
            >
              <FontAwesomeIcon icon={faTrash} /> {selectMode ? 'Cancelar' : 'Seleccionar'}
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={downloadExcel}
            disabled={!orders.length}
            title="Descargar ventas en formato Excel (CSV)"
          >
            <FontAwesomeIcon icon={faFileExcel} /> Excel
          </button>
        </div>
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
                    {cashRegister.opening_amount > 0 && (
                      <span style={{ marginLeft: 8, color: '#D4AF37', fontWeight: 700 }}>
                        · Apertura: ${Number(cashRegister.opening_amount).toLocaleString('es-CL')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button
              className={`btn ${cashRegister ? 'btn-danger' : 'btn-success'}`}
              onClick={cashRegister ? () => setShowCloseCashModal(true) : () => setShowOpenCashModal(true)}
              disabled={cashLoading}
            >
              <FontAwesomeIcon icon={cashRegister ? faLock : faLockOpen} />
              {cashLoading ? ' Procesando...' : cashRegister ? ' Cerrar caja' : ' Abrir caja'}
            </button>
          </div>
        )}

        {selectMode && orders.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '12px 16px', background: selectedOrders.size > 0 ? '#fef2f2' : '#f9fafb', borderRadius: 12, border: `1.5px solid ${selectedOrders.size > 0 ? '#fecaca' : '#e5e7eb'}`, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={selectedOrders.size === orders.length && orders.length > 0}
                onChange={toggleSelectAll}
                style={{ width: 18, height: 18, accentColor: '#ef4444' }}
              />
              {selectedOrders.size === 0 ? 'Seleccionar todos' : `${selectedOrders.size} seleccionado${selectedOrders.size !== 1 ? 's' : ''}`}
            </label>
            {selectedOrders.size > 0 && (
              <button
                className="btn btn-danger"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deletingOrders}
                style={{ marginLeft: 'auto' }}
              >
                <FontAwesomeIcon icon={deletingOrders ? faSpinner : faTrash} spin={deletingOrders} />
                {deletingOrders ? ' Eliminando...' : ` Eliminar ${selectedOrders.size}`}
              </button>
            )}
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
              <div key={order.id} className="card" style={selectMode && selectedOrders.has(order.id) ? { border: '2px solid #ef4444', background: '#fff5f5' } : {}}>
                {selectMode && (
                  <div style={{ padding: '10px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(order.id)}
                      onChange={() => toggleSelect(order.id)}
                      style={{ width: 20, height: 20, accentColor: '#ef4444', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>
                      {selectedOrders.has(order.id) ? 'Seleccionado' : 'Seleccionar'}
                    </span>
                  </div>
                )}
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
                {order.status !== 'completed' && order.status !== 'cancelled' && (
                  <button
                    className="btn btn-success"
                    style={{ marginTop: 12, width: '100%' }}
                    onClick={() => markAsCompleted(order.id)}
                    disabled={completingOrder === order.id}
                  >
                    <FontAwesomeIcon icon={completingOrder === order.id ? faSpinner : faCheck} spin={completingOrder === order.id} />
                    {completingOrder === order.id ? ' Completando...' : ' Marcar como completado'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowDeleteConfirm(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <FontAwesomeIcon icon={faTrash} style={{ fontSize: 20, color: '#ef4444' }} />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1e293b' }}>Eliminar pedidos</h3>
            </div>
            <p style={{ color: '#374151', fontSize: 14, margin: '0 0 6px' }}>
              ¿Seguro que deseas eliminar <strong>{selectedOrders.size} pedido{selectedOrders.size !== 1 ? 's' : ''}</strong>?
            </p>
            <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 24px' }}>
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={deleteSelected} disabled={deletingOrders}>
                <FontAwesomeIcon icon={faTrash} />
                {' Sí, eliminar'}
              </button>
              <button className="btn" onClick={() => setShowDeleteConfirm(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showCloseCashModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowCloseCashModal(false)}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: '28px 24px',
            width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.18)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <FontAwesomeIcon icon={faLock} style={{ fontSize: 20, color: '#ef4444' }} />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1e293b' }}>Cerrar Caja</h3>
            </div>
            <p style={{ color: '#374151', fontSize: 14, margin: '0 0 6px' }}>
              ¿Seguro que deseas cerrar la caja?
            </p>
            <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 24px' }}>
              Se enviará el informe del día por correo al dueño de la tienda.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={closeAdminCashRegister}
                disabled={cashLoading}
              >
                <FontAwesomeIcon icon={faLock} />
                {cashLoading ? ' Cerrando...' : ' Sí, cerrar caja'}
              </button>
              <button className="btn" onClick={() => setShowCloseCashModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showOpenCashModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowOpenCashModal(false)}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: '28px 24px',
            width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.18)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <FontAwesomeIcon icon={faCashRegister} style={{ fontSize: 22, color: '#D4AF37' }} />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1e293b' }}>Abrir Caja</h3>
            </div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
              Efectivo en caja al abrir
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={cashOpeningAmount}
              onChange={e => setCashOpeningAmount(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') openAdminCashRegister(); if (e.key === 'Escape') setShowOpenCashModal(false); }}
              autoFocus
              style={{
                width: '100%', padding: '14px', borderRadius: 10,
                border: '2px solid #e2e8f0', fontSize: 22, fontWeight: 700,
                textAlign: 'center', outline: 'none', boxSizing: 'border-box',
                color: '#1e293b', marginBottom: 20
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-success"
                style={{ flex: 1 }}
                onClick={openAdminCashRegister}
                disabled={cashLoading}
              >
                <FontAwesomeIcon icon={faLockOpen} />
                {cashLoading ? ' Abriendo...' : ' Abrir Caja'}
              </button>
              <button
                className="btn"
                onClick={() => { setShowOpenCashModal(false); setCashOpeningAmount(''); }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Orders;
