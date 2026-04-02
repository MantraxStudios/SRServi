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
          <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
            <FontAwesomeIcon icon={faShoppingBag} style={{ fontSize: '64px', color: '#ccc', marginBottom: '20px' }} />
            <h2 style={{ color: '#666', marginBottom: '10px' }}>No hay pedidos</h2>
            <p style={{ color: '#999' }}>
              Los pedidos realizados por tus clientes apareceran aqui
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '20px' }}>
            {orders.map(order => (
              <div key={order.id} className="card">
                <div className="card-header">
                  <div>
                    <h3 style={{ fontSize: '20px' }}>Pedido #{order.id}</h3>
                    <p style={{ color: '#666', fontSize: '14px' }}>
                      {formatDate(order.created_at)}
                    </p>
                    <div style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: '700',
                      backgroundColor: order.order_type === 'takeout' ? '#007BFF' : '#28A745',
                      color: '#fff'
                    }}>
                      <span style={{ fontSize: '18px' }}>
                        {order.order_type === 'takeout' ? '🥡' : '🍽️'}
                      </span>
                      {order.order_type === 'takeout' ? 'Para Llevar' : 'Para Comer Aqui'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#D4AF37' }}>
                      ${order.total.toFixed(2)}
                    </div>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: order.status === 'pending' ? '#FFC107' : '#28A745',
                      color: '#000'
                    }}>
                      {order.status === 'pending' ? 'Pendiente' : 'Completado'}
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: '20px' }}>
                  {order.items.map((item, index) => (
                    <div key={index} style={{
                      padding: '12px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      marginBottom: '10px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '700' }}>{item.quantity}x {item.product_name}</span>
                        <span style={{ fontWeight: '700', color: '#D4AF37' }}>
                          ${(item.unit_price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                      {item.selected_ingredients && item.selected_ingredients.length > 0 && (
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                          <strong>Ingredientes:</strong> {item.selected_ingredients.join(', ')}
                        </div>
                      )}
                      {item.selected_extras && item.selected_extras.length > 0 && (
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
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
