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
  faCog,
  faDesktop,
  faDownload
} from '@fortawesome/free-solid-svg-icons';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../components/Layout';

function Dashboard() {
  const { user, token } = useAuth();
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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'completed': return 'badge-success';
      case 'pending': return 'badge-warning';
      default: return 'badge-danger';
    }
  };

  return (
    <>
      <header className="admin-header">
        <div className="admin-header-row">
          <div className="admin-header-info">
            <h1>Panel de Control</h1>
            <p>{user?.business_name || user?.username}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="dashboard-code-badge">
              <span className="dashboard-code-label">Código:</span>
              <span className="dashboard-code-value">{user?.code}</span>
            </div>
            <Link to="/admin/settings" className="dashboard-settings-link">
              <FontAwesomeIcon icon={faCog} />
            </Link>
          </div>
        </div>
      </header>

      <div className="admin-main">
        <div className="stats-grid">
          <Link to="/admin/products" className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#FFF3CD', color: '#D4AF37' }}>
              <FontAwesomeIcon icon={faBox} />
            </div>
            <div className="stat-value">{stats.products}</div>
            <div className="stat-label">Productos</div>
          </Link>
          <Link to="/admin/categories" className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#E8F5E9', color: '#4CAF50' }}>
              <FontAwesomeIcon icon={faStore} />
            </div>
            <div className="stat-value">{stats.categories}</div>
            <div className="stat-label">Categorías</div>
          </Link>
          <Link to="/admin/orders" className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#E3F2FD', color: '#2196F3' }}>
              <FontAwesomeIcon icon={faShoppingBag} />
            </div>
            <div className="stat-value">{stats.orders}</div>
            <div className="stat-label">Pedidos</div>
          </Link>
          <Link to="/admin/ingredients" className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#FCE4EC', color: '#E91E63' }}>
              <FontAwesomeIcon icon={faPalette} />
            </div>
            <div className="stat-value">{stats.ingredients}</div>
            <div className="stat-label">Ingredientes</div>
          </Link>
        </div>

        <div className="content-grid">
          <div className="card">
            <div className="section-header">
              <h3 className="section-title">Configuración Rápida</h3>
            </div>
            <div className="flex flex-col gap-3">
              <Link to="/admin/products" className="quick-action">
                <div className="quick-action-icon" style={{ backgroundColor: '#D4AF37' }}>
                  <FontAwesomeIcon icon={faPlus} />
                </div>
                <div className="quick-action-info">
                  <div className="quick-action-label">Agregar Producto</div>
                  <div className="quick-action-sublabel">{stats.products} productos</div>
                </div>
                <FontAwesomeIcon icon={faArrowRight} className="quick-action-arrow" />
              </Link>
              {selectedStore && (
                <Link to={`/admin/editor/${selectedStore.code}?admin_edit=${token}`} className="quick-action">
                  <div className="quick-action-icon" style={{ backgroundColor: '#000000' }}>
                    <FontAwesomeIcon icon={faDesktop} />
                  </div>
                  <div className="quick-action-info">
                    <div className="quick-action-label">Editor Totem</div>
                    <div className="quick-action-sublabel">Diseño y productos</div>
                  </div>
                  <FontAwesomeIcon icon={faArrowRight} className="quick-action-arrow" />
                </Link>
              )}
              <Link to="/admin/categories" className="quick-action">
                <div className="quick-action-icon" style={{ backgroundColor: '#4CAF50' }}>
                  <FontAwesomeIcon icon={faStore} />
                </div>
                <div className="quick-action-info">
                  <div className="quick-action-label">Gestionar Categorías</div>
                  <div className="quick-action-sublabel">{stats.categories} categorías</div>
                </div>
                <FontAwesomeIcon icon={faArrowRight} className="quick-action-arrow" />
              </Link>
              <Link to="/admin/ingredients" className="quick-action">
                <div className="quick-action-icon" style={{ backgroundColor: '#2196F3' }}>
                  <FontAwesomeIcon icon={faBox} />
                </div>
                <div className="quick-action-info">
                  <div className="quick-action-label">Ingredientes</div>
                  <div className="quick-action-sublabel">{stats.ingredients} configurados</div>
                </div>
                <FontAwesomeIcon icon={faArrowRight} className="quick-action-arrow" />
              </Link>
              <Link to="/admin/settings" className="quick-action">
                <div className="quick-action-icon" style={{ backgroundColor: '#9C27B0' }}>
                  <FontAwesomeIcon icon={faPalette} />
                </div>
                <div className="quick-action-info">
                  <div className="quick-action-label">Personalizar Tienda</div>
                  <div className="quick-action-sublabel">Colores y moneda</div>
                </div>
                <FontAwesomeIcon icon={faArrowRight} className="quick-action-arrow" />
              </Link>
              <a
                href="/SRServiLauncherClient.apk"
                download="SRServiLauncherClient.apk"
                className="quick-action"
                style={{ textDecoration: 'none' }}
              >
                <div className="quick-action-icon" style={{ backgroundColor: '#D4AF37' }}>
                  <FontAwesomeIcon icon={faDownload} />
                </div>
                <div className="quick-action-info">
                  <div className="quick-action-label">Descargar App Android</div>
                  <div className="quick-action-sublabel">SRServi Launcher Client</div>
                </div>
                <FontAwesomeIcon icon={faArrowRight} className="quick-action-arrow" />
              </a>
            </div>
          </div>

          <div className="card">
            <div className="section-header">
              <h3 className="section-title">Pedidos Recientes</h3>
              <Link to="/admin/orders" className="section-link">
                Ver todos <FontAwesomeIcon icon={faArrowRight} />
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div className="empty-state">
                <FontAwesomeIcon icon={faShoppingBag} className="empty-state-icon" />
                <p className="empty-state-text">Sin pedidos aún</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {recentOrders.map((order, index) => (
                  <div key={index} className="order-row">
                    <div>
                      <div className="order-row-name">
                        {order.customer_name || 'Cliente'}
                      </div>
                      <div className="order-row-date">
                        {formatDate(order.created_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="order-row-amount">
                        ${order.total?.toFixed(2) || '0.00'}
                      </div>
                      <span className={`badge ${getStatusClass(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {stats.categories === 0 || stats.products === 0 ? (
          <div className="alert-banner">
            <FontAwesomeIcon icon={faExclamationCircle} className="alert-banner-icon" />
            <div className="alert-banner-content">
              <h3 className="alert-banner-title">¡Comienza a configurar tu tienda!</h3>
              <p className="alert-banner-text">
                Para que tu tienda funcione, necesitas crear categorías y productos.
              </p>
              <div className="alert-banner-actions">
                {stats.categories === 0 && (
                  <Link to="/admin/categories" className="btn btn-accent btn-sm">
                    <FontAwesomeIcon icon={faStore} /> Categorías
                  </Link>
                )}
                {stats.products === 0 && (
                  <Link to="/admin/products" className="btn btn-secondary btn-sm">
                    <FontAwesomeIcon icon={faBox} /> Productos
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

export default Dashboard;
