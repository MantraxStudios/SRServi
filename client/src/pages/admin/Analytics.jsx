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
  const { selectedStore, colors } = useContext(StoreContext);
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
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: '#666' }}>Selecciona una tienda para ver los análisis</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: colors.primary, marginBottom: '8px' }}>
            <FontAwesomeIcon icon={faChartBar} style={{ marginRight: '12px', color: colors.accent }} />
            Análisis
          </h1>
          <p style={{ color: '#666', fontSize: '14px' }}>Estadísticas de tu tienda</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['today', 'week', 'month', 'year'].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              style={{
                padding: '10px 16px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                backgroundColor: dateRange === range ? colors.accent : '#e0e0e0',
                color: dateRange === range ? colors.primary : '#666',
                transition: 'all 0.2s ease'
              }}
            >
              {range === 'today' ? 'Hoy' : range === 'week' ? '7 días' : range === 'month' ? '30 días' : 'Año'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '32px', color: colors.accent }} />
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            <div style={{
              backgroundColor: colors.secondary,
              borderRadius: '12px',
              padding: '20px',
              border: `1px solid ${colors.primary}11`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(40,167,69,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FontAwesomeIcon icon={faDollarSign} style={{ color: '#28a745', fontSize: '20px' }} />
                </div>
                <div>
                  <p style={{ margin: 0, color: '#666', fontSize: '12px', fontWeight: '600' }}>Ingresos</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: colors.primary }}>
                    {formatCurrency(summary?.revenue || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div style={{
              backgroundColor: colors.secondary,
              borderRadius: '12px',
              padding: '20px',
              border: `1px solid ${colors.primary}11`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(25,118,210,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FontAwesomeIcon icon={faShoppingCart} style={{ color: '#1976d2', fontSize: '20px' }} />
                </div>
                <div>
                  <p style={{ margin: 0, color: '#666', fontSize: '12px', fontWeight: '600' }}>Pedidos</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: colors.primary }}>
                    {summary?.totalOrders || 0}
                  </p>
                </div>
              </div>
            </div>

            <div style={{
              backgroundColor: colors.secondary,
              borderRadius: '12px',
              padding: '20px',
              border: `1px solid ${colors.primary}11`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(212,175,55,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FontAwesomeIcon icon={faChartLine} style={{ color: colors.accent, fontSize: '20px' }} />
                </div>
                <div>
                  <p style={{ margin: 0, color: '#666', fontSize: '12px', fontWeight: '600' }}>Ticket Promedio</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: colors.primary }}>
                    {formatCurrency(summary?.avgOrder || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div style={{
              backgroundColor: colors.secondary,
              borderRadius: '12px',
              padding: '20px',
              border: `1px solid ${colors.primary}11`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(245,124,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FontAwesomeIcon icon={faClock} style={{ color: '#f57c00', fontSize: '20px' }} />
                </div>
                <div>
                  <p style={{ margin: 0, color: '#666', fontSize: '12px', fontWeight: '600' }}>Pendientes</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: colors.primary }}>
                    {summary?.pendingOrders || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
            <div style={{
              backgroundColor: colors.secondary,
              borderRadius: '16px',
              padding: '24px',
              border: `1px solid ${colors.primary}11`
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: colors.primary }}>
                <FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: '8px', color: colors.accent }} />
                Ventas por Día
              </h3>
              {salesByDay.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '200px' }}>
                  {salesByDay.map((day, index) => {
                    const height = ((day.revenue || 0) / maxRevenue) * 100;
                    return (
                      <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '100%',
                          height: `${height}%`,
                          minHeight: '4px',
                          backgroundColor: colors.accent,
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s ease'
                        }} />
                        <span style={{ fontSize: '10px', color: '#666' }}>{formatDate(day.date)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
                  <FontAwesomeIcon icon={faChartBar} style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }} />
                  <p>No hay ventas en este período</p>
                </div>
              )}
            </div>

            <div style={{
              backgroundColor: colors.secondary,
              borderRadius: '16px',
              padding: '24px',
              border: `1px solid ${colors.primary}11`
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: colors.primary }}>
                <FontAwesomeIcon icon={faBox} style={{ marginRight: '8px', color: colors.accent }} />
                Pedidos Recientes
              </h3>
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {recentOrders.length > 0 ? recentOrders.map((order) => {
                  const status = getStatusInfo(order.status);
                  return (
                    <div key={order.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: `1px solid ${colors.primary}11`
                    }}>
                      <div>
                        <div style={{ fontWeight: '600', color: colors.primary, fontSize: '14px' }}>
                          #{order.id}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {order.items_count} {order.items_count === 1 ? 'producto' : 'productos'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '700', color: colors.primary, fontSize: '14px' }}>
                          {formatCurrency(order.total_amount)}
                        </div>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          color: status.color,
                          backgroundColor: `${status.color}15`,
                          padding: '2px 8px',
                          borderRadius: '10px'
                        }}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                  );
                }) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    <p>No hay pedidos recientes</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: colors.secondary,
            borderRadius: '16px',
            padding: '24px',
            border: `1px solid ${colors.primary}11`
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: colors.primary }}>
              <FontAwesomeIcon icon={faBoxOpen} style={{ marginRight: '8px', color: colors.accent }} />
              Productos Más Vendidos
            </h3>
            {topProducts.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                {topProducts.map((product, index) => (
                  <div key={product.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px',
                    backgroundColor: colors.primary + '05',
                    borderRadius: '12px'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: colors.accent + '20',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '700',
                      color: colors.accent,
                      fontSize: '16px'
                    }}>
                      #{index + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: colors.primary, fontSize: '14px', marginBottom: '4px' }}>
                        {product.name}
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#666' }}>
                        <span>{product.total_sold} vendidos</span>
                        <span>{formatCurrency(product.revenue)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                <FontAwesomeIcon icon={faBoxOpen} style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }} />
                <p>No hay datos de productos</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Analytics;
