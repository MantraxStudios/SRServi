import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faStore, 
  faBox, 
  faShoppingBag,
  faPalette,
  faExclamationCircle,
  faArrowRight,
  faPlus,
  faCog
} from '@fortawesome/free-solid-svg-icons';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../components/Layout';

function Dashboard() {
  const { user } = useAuth();
  const { selectedStore } = useStore();
  const [stats, setStats] = useState({
    products: 0,
    categories: 0,
    orders: 0,
    ingredients: 0,
    extras: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedStore) {
      setLoading(true);
      fetchData();
    } else {
      setLoading(false);
    }
  }, [selectedStore]);

  const fetchData = async () => {
    if (!selectedStore) {
      setLoading(false);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      
      const [productsRes, categoriesRes, ordersRes, ingredientsRes, extrasRes] = await Promise.all([
        fetch(`/api/products?store_id=${selectedStore.id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/categories?store_id=${selectedStore.id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/orders?store_id=${selectedStore.id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/ingredients?store_id=${selectedStore.id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/extras?store_id=${selectedStore.id}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const [products, categories, orders, ingredients, extras] = await Promise.all([
        productsRes.json(),
        categoriesRes.json(),
        ordersRes.json(),
        ingredientsRes.json(),
        extrasRes.json()
      ]);

      setStats({
        products: Array.isArray(products) ? products.length : 0,
        categories: Array.isArray(categories) ? categories.length : 0,
        orders: Array.isArray(orders) ? orders.length : 0,
        ingredients: Array.isArray(ingredients) ? ingredients.length : 0,
        extras: Array.isArray(extras) ? extras.length : 0
      });

      if (Array.isArray(orders) && orders.length > 0) {
        setRecentOrders(orders.slice(0, 4));
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon, value, label, link, color, bgColor }) => (
    <Link to={link} style={{ textDecoration: 'none', flex: 1, minWidth: '150px' }}>
      <div className="card" style={{ 
        padding: '20px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        border: '2px solid transparent'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.border = `2px solid ${color}`;
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.border = '2px solid transparent';
        e.currentTarget.style.boxShadow = 'none';
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          backgroundColor: bgColor,
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px auto'
        }}>
          <FontAwesomeIcon icon={icon} style={{ fontSize: '24px', color }} />
        </div>
        <h3 style={{ fontSize: '28px', fontWeight: '700', color: '#000', margin: '0 0 4px 0' }}>
          {value}
        </h3>
        <p style={{ color: '#666', margin: 0, fontSize: '13px' }}>{label}</p>
      </div>
    </Link>
  );

  const QuickAction = ({ icon, label, sublabel, link, color }) => (
    <Link to={link} style={{ textDecoration: 'none', color: 'inherit', flex: 1, minWidth: '200px' }}>
      <div style={{
        padding: '16px',
        backgroundColor: '#FAFAFA',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        border: '2px solid transparent'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#F0F0F0';
        e.currentTarget.style.border = `2px solid ${color}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#FAFAFA';
        e.currentTarget.style.border = '2px solid transparent';
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          backgroundColor: color,
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <FontAwesomeIcon icon={icon} style={{ color: 'white', fontSize: '18px' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '600', fontSize: '14px' }}>{label}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{sublabel}</div>
        </div>
        <FontAwesomeIcon icon={faArrowRight} style={{ color: '#ccc', fontSize: '14px' }} />
      </div>
    </Link>
  );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <>
      <header className="admin-header">
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%'
        }}>
          <div>
            <h1 style={{ fontSize: '24px', margin: 0 }}>Panel de Control</h1>
            <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 0 0' }}>
              {user?.business_name || user?.username}
            </p>
          </div>
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <div style={{
            background: 'linear-gradient(135deg, var(--gold), var(--gold-light))',
            padding: '12px 24px',
            borderRadius: 'var(--radius-md)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)'
          }}>
            <span style={{ fontSize: '14px', fontWeight: '600', opacity: 0.9 }}>Código:</span>
            <span style={{ fontSize: '26px', fontWeight: '800', letterSpacing: '3px', color: 'var(--white)' }}>
              {user?.code}
            </span>
          </div>
          <Link 
            to="/admin/settings" 
            style={{
              backgroundColor: 'var(--gray-light)',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              color: 'var(--gray-dark)',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s ease',
              border: '2px solid transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--gold-light)';
              e.currentTarget.style.color = 'var(--white)';
              e.currentTarget.style.border = '2px solid var(--gold)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--gray-light)';
              e.currentTarget.style.color = 'var(--gray-dark)';
              e.currentTarget.style.border = '2px solid transparent';
            }}
          >
            <FontAwesomeIcon icon={faCog} style={{ fontSize: '20px' }} />
          </Link>
          </div>
        </div>
      </header>

      <div className="admin-main" style={{ padding: '24px' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px', 
          marginBottom: '24px' 
        }}>
          <StatCard 
            icon={faBox} 
            value={stats.products} 
            label="Productos" 
            link="/admin/products"
            color="#D4AF37"
            bgColor="#FFF3CD"
          />
          <StatCard 
            icon={faStore} 
            value={stats.categories} 
            label="Categorías" 
            link="/admin/categories"
            color="#4CAF50"
            bgColor="#E8F5E9"
          />
          <StatCard 
            icon={faShoppingBag} 
            value={stats.orders} 
            label="Pedidos" 
            link="/admin/orders"
            color="#2196F3"
            bgColor="#E3F2FD"
          />
          <StatCard 
            icon={faPalette} 
            value={stats.ingredients} 
            label="Ingredientes" 
            link="/admin/ingredients"
            color="#E91E63"
            bgColor="#FCE4EC"
          />
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '24px' 
        }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h3 style={{ fontSize: '16px', margin: 0, fontWeight: '600' }}>
                Configuración Rápida
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <QuickAction 
                icon={faPlus} 
                label="Agregar Producto" 
                sublabel={`${stats.products} productos`}
                link="/admin/products"
                color="#D4AF37"
              />
              <QuickAction 
                icon={faStore} 
                label="Gestionar Categorías" 
                sublabel={`${stats.categories} categorías`}
                link="/admin/categories"
                color="#4CAF50"
              />
              <QuickAction 
                icon={faBox} 
                label="Ingredientes" 
                sublabel={`${stats.ingredients} configurados`}
                link="/admin/ingredients"
                color="#2196F3"
              />
              <QuickAction 
                icon={faPalette} 
                label="Personalizar Tienda" 
                sublabel="Colores y moneda"
                link="/admin/settings"
                color="#9C27B0"
              />
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h3 style={{ fontSize: '16px', margin: 0, fontWeight: '600' }}>
                Pedidos Recientes
              </h3>
              <Link to="/admin/orders" style={{ 
                color: '#D4AF37',
                textDecoration: 'none',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                Ver todos <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: '11px' }} />
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '32px 20px',
                color: '#666'
              }}>
                <FontAwesomeIcon icon={faShoppingBag} style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.3 }} />
                <p style={{ margin: 0, fontSize: '14px' }}>Sin pedidos aún</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recentOrders.map((order, index) => (
                  <div key={index} style={{
                    padding: '14px',
                    backgroundColor: '#FAFAFA',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>
                        {order.customer_name || 'Cliente'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {formatDate(order.created_at)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        fontWeight: '700', 
                        fontSize: '15px',
                        color: '#D4AF37'
                      }}>
                        ${order.total?.toFixed(2) || '0.00'}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: order.status === 'completed' ? '#E8F5E9' : 
                          order.status === 'pending' ? '#FFF3CD' : '#FFEBEE',
                        color: order.status === 'completed' ? '#4CAF50' : 
                          order.status === 'pending' ? '#FF9800' : '#F44336'
                      }}>
                        {order.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {stats.categories === 0 || stats.products === 0 ? (
          <div className="card" style={{ marginTop: '24px', backgroundColor: '#FFF3CD', border: '2px solid #FF9800' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <FontAwesomeIcon icon={faExclamationCircle} style={{ 
                fontSize: '28px', 
                color: '#FF9800',
                marginTop: '2px'
              }} />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '15px', marginBottom: '6px', color: '#000' }}>
                  ¡Comienza a configurar tu tienda!
                </h3>
                <p style={{ margin: '0 0 12px 0', color: '#666', fontSize: '13px' }}>
                  Para que tu tienda funcione, necesitas crear categorías y productos.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {stats.categories === 0 && (
                    <Link to="/admin/categories" className="btn btn-primary btn-sm" style={{ padding: '10px 16px' }}>
                      <FontAwesomeIcon icon={faStore} /> Categorías
                    </Link>
                  )}
                  {stats.products === 0 && (
                    <Link to="/admin/products" className="btn btn-secondary btn-sm" style={{ padding: '10px 16px' }}>
                      <FontAwesomeIcon icon={faBox} /> Productos
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

export default Dashboard;
