import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShoppingBag } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

function Orders() {
  const { selectedStore } = useStore();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedStore) {
      setLoading(true);
      fetchOrders();
    } else {
      setLoading(false);
      setOrders([]);
    }
  }, [selectedStore]);

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
      </header>
      <div className="admin-main">
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
                        {order.order_type === 'takeout' ? '🥡' : '🍽️'}
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
