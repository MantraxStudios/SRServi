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
  faTrophy,
  faFilter,
  faSortAmountDown
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
  const [categories, setCategories] = useState([]);
  const [topSortBy, setTopSortBy] = useState('quantity');
  const [topCategoryId, setTopCategoryId] = useState('');
  const [topLimit, setTopLimit] = useState(10);

  useEffect(() => {
    if (selectedStore?.id) {
      fetchAnalytics();
      fetchCategories();
    }
  }, [selectedStore, dateRange]);

  useEffect(() => {
    if (selectedStore?.id) {
      fetchTopProducts();
    }
  }, [selectedStore, dateRange, topSortBy, topCategoryId, topLimit]);

  const fetchCategories = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const res = await fetch(`/api/categories?store_id=${selectedStore.id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchTopProducts = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const storeId = selectedStore.id;
      let url = `/api/analytics/top-products?store_id=${storeId}&range=${dateRange}&limit=${topLimit}&sort_by=${topSortBy}`;
      if (topCategoryId) url += `&category_id=${topCategoryId}`;
      const res = await fetch(url, { headers });
      const data = res.ok ? await res.json() : [];
      setTopProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching top products:', err);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const storeId = selectedStore.id;

      const [summaryRes, salesRes, ordersRes, dowRes] = await Promise.all([
        fetch(`/api/analytics/summary?store_id=${storeId}&range=${dateRange}`, { headers }),
        fetch(`/api/analytics/sales-by-day?store_id=${storeId}&range=${dateRange}`, { headers }),
        fetch(`/api/analytics/recent-orders?store_id=${storeId}&limit=10`, { headers }),
        fetch(`/api/analytics/sales-by-dow?store_id=${storeId}&range=${dateRange}`, { headers }),
      ]);

      const [summaryData, salesData, ordersData, dowData] = await Promise.all([
        summaryRes.ok ? summaryRes.json() : { totalOrders: 0, completedOrders: 0, pendingOrders: 0, cancelledOrders: 0, revenue: 0, avgOrder: 0 },
        salesRes.ok ? salesRes.json() : [],
        ordersRes.ok ? ordersRes.json() : [],
        dowRes.ok ? dowRes.json() : [],
      ]);

      setSummary(summaryData);
      setSalesByDay(Array.isArray(salesData) ? salesData : []);
      setSalesByDow(Array.isArray(dowData) ? dowData : []);
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
    }).format(Number(value) || 0);
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
      <div className="analytics-header-row" style={{ marginBottom: '24px' }}>
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
            {[
              { icon: faDollarSign, color: '#22c55e', cls: 'revenue', label: 'Ingresos', value: formatCurrency(summary?.revenue || 0) },
              { icon: faShoppingCart, color: '#3b82f6', cls: 'orders', label: 'Pedidos', value: summary?.totalOrders || 0 },
              { icon: faChartLine, color: 'var(--gold)', cls: 'average', label: 'Ticket Prom.', value: formatCurrency(summary?.avgOrder || 0) },
              { icon: faClock, color: '#f59e0b', cls: 'pending', label: 'Pendientes', value: summary?.pendingOrders || 0 },
            ].map(({ icon, color, cls, label, value }) => (
              <div key={label} className="analytics-stat-card">
                <div className="flex items-center gap-3">
                  <div className={`analytics-stat-icon ${cls}`} style={{ flexShrink: 0 }}>
                    <FontAwesomeIcon icon={icon} style={{ color, fontSize: '18px' }} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="analytics-stat-label">{label}</p>
                    <p className="analytics-stat-value">{value}</p>
                  </div>
                </div>
              </div>
            ))}
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
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, minWidth: 300 }}>
                  {salesByDow.map((day, i) => {
                    const isBest = i === bestIdx;
                    const orderPct = (day.orders / maxOrders) * 100;
                    const rev = Number(day.revenue) || 0;
                    const revShort = rev >= 1000000
                      ? `$${(rev/1000000).toFixed(1)}M`
                      : rev >= 1000
                        ? `$${(rev/1000).toFixed(rev >= 10000 ? 0 : 1)}k`
                        : `$${Math.round(rev)}`;
                    return (
                      <div key={day.day_num} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        background: isBest ? 'rgba(212,175,55,0.08)' : 'var(--muted)',
                        border: isBest ? '1.5px solid rgba(212,175,55,0.45)' : '1px solid var(--border)',
                        borderRadius: 12, padding: '10px 4px 8px',
                        minWidth: 0, overflow: 'hidden',
                      }}>
                        {/* Día + estrella si es el mejor */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: isBest ? '#D4AF37' : 'var(--muted-foreground)', lineHeight: 1 }}>
                            {day.day_name.slice(0, 3).toUpperCase()}
                          </span>
                          {isBest && <span style={{ fontSize: 9, color: '#D4AF37', lineHeight: 1 }}>★</span>}
                        </div>

                        {/* Barra */}
                        <div style={{ width: '44%', height: 52, background: 'var(--border)', borderRadius: 4, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                          <div style={{
                            width: '100%', height: `${orderPct}%`,
                            background: isBest ? 'linear-gradient(180deg,#D4AF37,#B8952D)' : 'linear-gradient(180deg,#94a3b8,#64748b)',
                            borderRadius: 4, minHeight: day.orders > 0 ? 3 : 0,
                            transition: 'height 0.4s ease',
                          }} />
                        </div>

                        {/* Número de pedidos */}
                        <span style={{ fontSize: 14, fontWeight: 900, color: isBest ? '#D4AF37' : 'var(--foreground)', lineHeight: 1 }}>
                          {day.orders}
                        </span>

                        {/* Ingresos abreviados — caben siempre */}
                        <span style={{
                          fontSize: 9, fontWeight: 700, lineHeight: 1,
                          color: isBest ? 'rgba(212,175,55,0.75)' : 'var(--muted-foreground)',
                          width: '100%', textAlign: 'center',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          paddingLeft: 2, paddingRight: 2,
                        }}>
                          {revShort}
                        </span>
                      </div>
                    );
                  })}
                </div>
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
                <div style={{ overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                  <div className="analytics-chart" style={{ minWidth: `${Math.max(salesByDay.length * 38, 200)}px` }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <h3 className="analytics-section-title" style={{ margin: 0 }}>
                <FontAwesomeIcon icon={faBoxOpen} style={{ marginRight: '8px' }} />
                Productos Más Vendidos
              </h3>
            </div>

            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16,
              padding: '10px 12px', background: 'var(--muted)', borderRadius: 10,
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FontAwesomeIcon icon={faSortAmountDown} style={{ fontSize: 11, color: 'var(--muted-foreground)' }} />
                <select
                  value={topSortBy}
                  onChange={e => setTopSortBy(e.target.value)}
                  style={{
                    background: 'var(--background)', color: 'var(--foreground)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    padding: '5px 8px', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  <option value="quantity">Más vendidos</option>
                  <option value="revenue">Mayor ingreso</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FontAwesomeIcon icon={faFilter} style={{ fontSize: 11, color: 'var(--muted-foreground)' }} />
                <select
                  value={topCategoryId}
                  onChange={e => setTopCategoryId(e.target.value)}
                  style={{
                    background: 'var(--background)', color: 'var(--foreground)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    padding: '5px 8px', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  <option value="">Todas las categorías</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <select
                value={topLimit}
                onChange={e => setTopLimit(Number(e.target.value))}
                style={{
                  background: 'var(--background)', color: 'var(--foreground)',
                  border: '1px solid var(--border)', borderRadius: 6,
                  padding: '5px 8px', fontSize: 12, cursor: 'pointer',
                }}
              >
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
                <option value={20}>Top 20</option>
                <option value={50}>Top 50</option>
              </select>
            </div>

            {topProducts.length > 0 ? (
              <div className="analytics-top-products">
                {topProducts.map((product, index) => {
                  const maxVal = topSortBy === 'revenue'
                    ? Math.max(...topProducts.map(p => Number(p.revenue) || 0), 1)
                    : Math.max(...topProducts.map(p => Number(p.total_sold) || 0), 1);
                  const currentVal = topSortBy === 'revenue' ? Number(product.revenue) || 0 : Number(product.total_sold) || 0;
                  const pct = (currentVal / maxVal) * 100;

                  return (
                    <div key={product.id} className="analytics-top-product" style={{ position: 'relative', overflow: 'hidden' }}>
                      <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: `${pct}%`, background: 'rgba(212,175,55,0.07)',
                        borderRadius: 'inherit', transition: 'width 0.4s ease', pointerEvents: 'none',
                      }} />
                      <div className="analytics-rank" style={{ position: 'relative' }}>
                        #{index + 1}
                      </div>
                      <div className="flex-1" style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="analytics-product-name">
                            {product.name}
                          </div>
                          {product.category_name && (
                            <span style={{
                              fontSize: 10, padding: '1px 6px', borderRadius: 4,
                              background: 'rgba(212,175,55,0.12)', color: '#D4AF37',
                              fontWeight: 600, whiteSpace: 'nowrap',
                            }}>
                              {product.category_name}
                            </span>
                          )}
                        </div>
                        <div className="analytics-product-stats">
                          <span style={{ fontWeight: topSortBy === 'quantity' ? 700 : 400 }}>
                            {product.total_sold} vendidos
                          </span>
                          <span style={{ fontWeight: topSortBy === 'revenue' ? 700 : 400 }}>
                            {formatCurrency(product.revenue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
