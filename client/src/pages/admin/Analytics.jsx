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
  faBoxOpen,
  faTrophy
} from '@fortawesome/free-solid-svg-icons';

function Analytics() {
  const { token } = useAuth();
  const { selectedStore } = useContext(StoreContext);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('week');
  const [summary, setSummary] = useState(null);
  const [salesByDay, setSalesByDay] = useState([]);
  const [salesByDow, setSalesByDow] = useState([]);
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

      const [summaryRes, salesRes, productsRes, ordersRes, dowRes] = await Promise.all([
        fetch(`/api/analytics/summary?store_id=${storeId}&range=${dateRange}`, { headers }),
        fetch(`/api/analytics/sales-by-day?store_id=${storeId}&range=${dateRange}`, { headers }),
        fetch(`/api/analytics/top-products?store_id=${storeId}&range=${dateRange}&limit=10`, { headers }),
        fetch(`/api/analytics/recent-orders?store_id=${storeId}&limit=10`, { headers }),
        fetch(`/api/analytics/sales-by-dow?store_id=${storeId}&range=${dateRange}`, { headers }),
      ]);

      const [summaryData, salesData, productsData, ordersData, dowData] = await Promise.all([
        summaryRes.ok ? summaryRes.json() : { totalOrders: 0, completedOrders: 0, pendingOrders: 0, cancelledOrders: 0, revenue: 0, avgOrder: 0 },
        salesRes.ok ? salesRes.json() : [],
        productsRes.ok ? productsRes.json() : [],
        ordersRes.ok ? ordersRes.json() : [],
        dowRes.ok ? dowRes.json() : [],
      ]);

      setSummary(summaryData);
      setSalesByDay(Array.isArray(salesData) ? salesData : []);
      setSalesByDow(Array.isArray(dowData) ? dowData : []);
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

          {/* ── Días de mayor venta (Lun–Dom) ── */}
          {(() => {
            if (!salesByDow.length) return null;
            const maxOrders = Math.max(...salesByDow.map(d => d.orders), 1);
            const maxRev    = Math.max(...salesByDow.map(d => d.revenue), 1);
            const bestIdx   = salesByDow.reduce((best, d, i) => d.orders > salesByDow[best].orders ? i : best, 0);
            return (
              <div className="analytics-section" style={{ marginBottom: 32 }}>
                <h3 className="analytics-section-title">
                  <FontAwesomeIcon icon={faTrophy} style={{ marginRight: 8, color: '#D4AF37' }} />
                  Días de Mayor Venta
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                  {salesByDow.map((day, i) => {
                    const isBest = i === bestIdx;
                    const orderPct = (day.orders / maxOrders) * 100;
                    const revPct   = (day.revenue / maxRev) * 100;
                    return (
                      <div key={day.day_num} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        background: isBest ? 'linear-gradient(160deg,#fffbeb,#fef3c7)' : '#f9fafb',
                        border: isBest ? '2px solid #D4AF37' : '1px solid #e5e7eb',
                        borderRadius: 14, padding: '14px 6px 10px',
                        boxShadow: isBest ? '0 4px 16px rgba(212,175,55,0.25)' : 'none',
                        position: 'relative', minWidth: 0,
                      }}>
                        {isBest && (
                          <span style={{
                            position: 'absolute', top: -10,
                            background: '#D4AF37', color: '#000',
                            fontSize: 9, fontWeight: 900, padding: '2px 7px',
                            borderRadius: 20, letterSpacing: '0.05em',
                          }}>TOP</span>
                        )}
                        {/* Nombre del día */}
                        <span style={{ fontSize: 11, fontWeight: 800, color: isBest ? '#92400e' : '#374151', textAlign: 'center', lineHeight: 1.2 }}>
                          {day.day_name.slice(0, 3).toUpperCase()}
                        </span>
                        {/* Barra de pedidos */}
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <div style={{ width: '60%', height: 60, background: '#e5e7eb', borderRadius: 6, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                            <div style={{
                              width: '100%',
                              height: `${orderPct}%`,
                              background: isBest
                                ? 'linear-gradient(180deg,#D4AF37,#a07c20)'
                                : 'linear-gradient(180deg,#94a3b8,#64748b)',
                              borderRadius: 6,
                              transition: 'height 0.4s ease',
                              minHeight: day.orders > 0 ? 4 : 0,
                            }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 800, color: isBest ? '#92400e' : '#1e293b' }}>
                            {day.orders}
                          </span>
                          <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600 }}>pedidos</span>
                        </div>
                        {/* Ingresos */}
                        <div style={{
                          width: '100%', height: 4, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden', marginTop: 2
                        }}>
                          <div style={{
                            height: '100%', width: `${revPct}%`,
                            background: isBest ? '#D4AF37' : '#cbd5e1',
                            borderRadius: 4, transition: 'width 0.4s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: 10, color: isBest ? '#92400e' : '#6b7280', fontWeight: 700, textAlign: 'center' }}>
                          {formatCurrency(day.revenue)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

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
