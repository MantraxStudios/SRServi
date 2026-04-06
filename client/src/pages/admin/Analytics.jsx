import { useState, useEffect, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartBar,
  faDollarSign,
  faShoppingCart,
  faCheck,
  faClock,
  faTimes,
  faBox,
  faCalendarAlt,
  faSpinner,
  faChartLine,
  faBoxOpen
} from '@fortawesome/free-solid-svg-icons';

function Analytics() {
  const { token } = useAuth();
  const { selectedStore } = useContext(StoreContext);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('week');
  const [summary, setSummary] = useState(null);
  const [salesByDay, setSalesByDay] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    if (selectedStore?.id) {
      fetchAnalytics();
    }
  }, [selectedStore, dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const storeId = selectedStore.id;

      const [summaryRes, salesRes, productsRes, ordersRes] = await Promise.all([
        fetch(`/api/analytics/summary?store_id=${storeId}&range=${dateRange}`, { headers }),
        fetch(`/api/analytics/sales-by-day?store_id=${storeId}&range=${dateRange}`, { headers }),
        fetch(`/api/analytics/top-products?store_id=${storeId}&range=${dateRange}&limit=10`, { headers }),
        fetch(`/api/analytics/recent-orders?store_id=${storeId}&limit=10`, { headers })
      ]);

      const [summaryData, salesData, productsData, ordersData] = await Promise.all([
        summaryRes.ok ? summaryRes.json() : { totalOrders: 0, completedOrders: 0, pendingOrders: 0, cancelledOrders: 0, revenue: 0, avgOrder: 0 },
        salesRes.ok ? salesRes.json() : [],
        productsRes.ok ? productsRes.json() : [],
        ordersRes.ok ? ordersRes.json() : []
      ]);

      setSummary(summaryData);
      setSalesByDay(Array.isArray(salesData) ? salesData : []);
      setTopProducts(Array.isArray(productsData) ? productsData : []);
      setRecentOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: selectedStore?.currency_code || 'USD'
    }).format(value);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short'
    });
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      'paid': { icon: faCheck, color: '#28a745', label: 'Pagado' },
      'processed': { icon: faCheck, color: '#28a745', label: 'Procesado' },
      'completed': { icon: faCheck, color: '#28a745', label: 'Completado' },
      'approved': { icon: faCheck, color: '#28a745', label: 'Aprobado' },
      'pending': { icon: faClock, color: '#f57c00', label: 'Pendiente' },
      'waiting': { icon: faClock, color: '#f57c00', label: 'Esperando' },
      'cancelled': { icon: faTimes, color: '#dc3545', label: 'Cancelado' }
    };
    return statusMap[status] || { icon: faClock, color: '#666', label: status };
  };

  const maxRevenue = Math.max(...salesByDay.map(d => d.revenue || 0), 1);

  if (!selectedStore) {
    return (
      <div className="empty-state">
        <p className="empty-state-text">Selecciona una tienda para ver los análisis</p>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <div className="flex justify-between items-center" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="text-lg font-bold" style={{ marginBottom: '8px' }}>
            <FontAwesomeIcon icon={faChartBar} style={{ marginRight: '12px' }} />
            Análisis
          </h1>
          <p className="text-sm text-muted">Estadísticas de tu tienda</p>
        </div>
        <div className="analytics-date-filters">
          {['today', 'week', 'month', 'year'].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`analytics-date-btn${dateRange === range ? ' active' : ''}`}
            >
              {range === 'today' ? 'Hoy' : range === 'week' ? '7 días' : range === 'month' ? '30 días' : 'Año'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center" style={{ height: '300px' }}>
          <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '32px' }} />
        </div>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: '32px' }}>
            <div className="analytics-stat-card">
              <div className="flex items-center gap-3" style={{ marginBottom: '12px' }}>
                <div className="analytics-stat-icon revenue">
                  <FontAwesomeIcon icon={faDollarSign} style={{ color: '#22c55e', fontSize: '20px' }} />
                </div>
                <div>
                  <p className="analytics-stat-label">Ingresos</p>
                  <p className="analytics-stat-value">
                    {formatCurrency(summary?.revenue || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="analytics-stat-card">
              <div className="flex items-center gap-3" style={{ marginBottom: '12px' }}>
                <div className="analytics-stat-icon orders">
                  <FontAwesomeIcon icon={faShoppingCart} style={{ color: '#3b82f6', fontSize: '20px' }} />
                </div>
                <div>
                  <p className="analytics-stat-label">Pedidos</p>
                  <p className="analytics-stat-value">
                    {summary?.totalOrders || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="analytics-stat-card">
              <div className="flex items-center gap-3" style={{ marginBottom: '12px' }}>
                <div className="analytics-stat-icon average">
                  <FontAwesomeIcon icon={faChartLine} style={{ color: 'var(--gold)', fontSize: '20px' }} />
                </div>
                <div>
                  <p className="analytics-stat-label">Ticket Promedio</p>
                  <p className="analytics-stat-value">
                    {formatCurrency(summary?.avgOrder || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="analytics-stat-card">
              <div className="flex items-center gap-3" style={{ marginBottom: '12px' }}>
                <div className="analytics-stat-icon pending">
                  <FontAwesomeIcon icon={faClock} style={{ color: '#f59e0b', fontSize: '20px' }} />
                </div>
                <div>
                  <p className="analytics-stat-label">Pendientes</p>
                  <p className="analytics-stat-value">
                    {summary?.pendingOrders || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="analytics-grid-2-1">
            <div className="analytics-section">
              <h3 className="analytics-section-title">
                <FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: '8px' }} />
                Ventas por Día
              </h3>
              {salesByDay.length > 0 ? (
                <div className="analytics-chart">
                  {salesByDay.map((day, index) => {
                    const height = ((day.revenue || 0) / maxRevenue) * 100;
                    return (
                      <div key={index} className="analytics-chart-bar">
                        <div className="analytics-bar" style={{ height: `${height}%` }} />
                        <span className="analytics-bar-label">{formatDate(day.date)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <FontAwesomeIcon icon={faChartBar} className="empty-state-icon" />
                  <p className="empty-state-text">No hay ventas en este período</p>
                </div>
              )}
            </div>

            <div className="analytics-section">
              <h3 className="analytics-section-title">
                <FontAwesomeIcon icon={faBox} style={{ marginRight: '8px' }} />
                Pedidos Recientes
              </h3>
              <div className="analytics-recent-orders">
                {recentOrders.length > 0 ? recentOrders.map((order) => {
                  const status = getStatusInfo(order.status);
                  return (
                    <div key={order.id} className="analytics-order-row">
                      <div>
                        <div className="analytics-order-id">
                          #{order.id}
                        </div>
                        <div className="analytics-order-items">
                          {order.items_count} {order.items_count === 1 ? 'producto' : 'productos'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="analytics-order-amount">
                          {formatCurrency(order.total_amount)}
                        </div>
                        <span className="badge" style={{ color: status.color, backgroundColor: `${status.color}15` }}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="empty-state">
                    <p className="empty-state-text">No hay pedidos recientes</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="analytics-section">
            <h3 className="analytics-section-title">
              <FontAwesomeIcon icon={faBoxOpen} style={{ marginRight: '8px' }} />
              Productos Más Vendidos
            </h3>
            {topProducts.length > 0 ? (
              <div className="analytics-top-products">
                {topProducts.map((product, index) => (
                  <div key={product.id} className="analytics-top-product">
                    <div className="analytics-rank">
                      #{index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="analytics-product-name">
                        {product.name}
                      </div>
                      <div className="analytics-product-stats">
                        <span>{product.total_sold} vendidos</span>
                        <span>{formatCurrency(product.revenue)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <FontAwesomeIcon icon={faBoxOpen} className="empty-state-icon" />
                <p className="empty-state-text">No hay datos de productos</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Analytics;
