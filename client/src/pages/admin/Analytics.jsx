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
  faSortAmountDown,
  faSearch,
  faArrowDown,
  faHandHoldingUsd,
  faReceipt,
  faCreditCard,
  faTag,
  faUtensils,
  faChevronRight
} from '@fortawesome/free-solid-svg-icons';

function Analytics() {
  const { token } = useAuth();
  const { selectedStore } = useContext(StoreContext);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [summary, setSummary] = useState(null);
  const [salesByDay, setSalesByDay] = useState([]);
  const [salesByDow, setSalesByDow] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [topSortBy, setTopSortBy] = useState('quantity');
  const [topCategoryId, setTopCategoryId] = useState('');
  const [topLimit, setTopLimit] = useState(10);
  const [productSearch, setProductSearch] = useState('');
  const [bottomProducts, setBottomProducts] = useState([]);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const isCustomRangeReady = dateRange !== 'custom' || (customStart && customEnd);

  const rangeQueryParams = () => {
    if (dateRange === 'custom' && customStart && customEnd) {
      return `range=custom&start_date=${customStart}&end_date=${customEnd}`;
    }
    return `range=${dateRange}`;
  };

  useEffect(() => {
    if (selectedStore?.id && isCustomRangeReady) {
      fetchAnalytics();
      fetchCategories();
    }
  }, [selectedStore, dateRange, customStart, customEnd]);

  useEffect(() => {
    if (selectedStore?.id && isCustomRangeReady) {
      fetchTopProducts();
      fetchBottomProducts();
    }
  }, [selectedStore, dateRange, customStart, customEnd, topSortBy, topCategoryId, topLimit]);

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
      let url = `/api/analytics/top-products?store_id=${storeId}&${rangeQueryParams()}&limit=${topLimit}&sort_by=${topSortBy}`;
      if (topCategoryId) url += `&category_id=${topCategoryId}`;
      const res = await fetch(url, { headers });
      const data = res.ok ? await res.json() : [];
      setTopProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching top products:', err);
    }
  };

  const fetchBottomProducts = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const storeId = selectedStore.id;
      let url = `/api/analytics/bottom-products?store_id=${storeId}&${rangeQueryParams()}&limit=${topLimit}&sort_by=${topSortBy}`;
      if (topCategoryId) url += `&category_id=${topCategoryId}`;
      const res = await fetch(url, { headers });
      const data = res.ok ? await res.json() : [];
      setBottomProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching bottom products:', err);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const storeId = selectedStore.id;

      const [summaryRes, salesRes, ordersRes, dowRes] = await Promise.all([
        fetch(`/api/analytics/summary?store_id=${storeId}&${rangeQueryParams()}`, { headers }),
        fetch(`/api/analytics/sales-by-day?store_id=${storeId}&${rangeQueryParams()}`, { headers }),
        fetch(`/api/analytics/recent-orders?store_id=${storeId}&limit=25&${rangeQueryParams()}`, { headers }),
        fetch(`/api/analytics/sales-by-dow?store_id=${storeId}&${rangeQueryParams()}`, { headers }),
      ]);

      const [summaryData, salesData, ordersData, dowData] = await Promise.all([
        summaryRes.ok ? summaryRes.json() : { totalOrders: 0, completedOrders: 0, pendingOrders: 0, cancelledOrders: 0, revenue: 0, avgOrder: 0, tips: 0, tippedOrders: 0 },
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

  const openOrderDetail = async (orderId) => {
    setDetailLoading(true);
    setDetailOrder({ id: orderId });
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const res = await fetch(`/api/analytics/order/${orderId}?store_id=${selectedStore.id}`, { headers });
      if (res.ok) {
        setDetailOrder(await res.json());
      } else {
        setDetailOrder(null);
      }
    } catch (err) {
      console.error('Error fetching order detail:', err);
      setDetailOrder(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const paymentMethodLabel = (pm) => {
    const map = {
      cash: 'Efectivo', card: 'Tarjeta', pending: 'Por pagar',
      free: 'Sin costo', mp_checkout: 'Mercado Pago', qr: 'QR',
    };
    return map[pm] || pm || '—';
  };

  const orderTypeLabel = (ot) => {
    const map = { serve: 'Para servir', takeout: 'Para llevar', delivery: 'Delivery' };
    return map[ot] || ot || '—';
  };

  const formatDateTime = (dateStr) => {
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  const modifiersText = (item) => {
    const toNames = (arr) => (Array.isArray(arr) ? arr : [])
      .map(x => (typeof x === 'string' ? x : (x?.name || '')))
      .filter(Boolean);
    const parts = [
      ...toNames(item.selected_ingredients),
      ...toNames(item.selected_complements),
      ...toNames(item.selected_extras).map(n => `+ ${n}`),
    ];
    return parts.join(' · ');
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
        <div className="analytics-date-filters" style={{ flexWrap: 'wrap', gap: 8 }}>
          {['today', 'week', 'month', 'year', 'custom'].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`analytics-date-btn${dateRange === range ? ' active' : ''}`}
            >
              {range === 'today' ? 'Hoy' : range === 'week' ? '7 días' : range === 'month' ? '30 días' : range === 'year' ? 'Año' : 'Personalizado'}
            </button>
          ))}
          {dateRange === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={e => setCustomStart(e.target.value)}
                style={{
                  background: 'var(--background)', color: 'var(--foreground)',
                  border: '1px solid var(--border)', borderRadius: 6,
                  padding: '5px 8px', fontSize: 12,
                }}
              />
              <span className="text-sm text-muted">a</span>
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={e => setCustomEnd(e.target.value)}
                style={{
                  background: 'var(--background)', color: 'var(--foreground)',
                  border: '1px solid var(--border)', borderRadius: 6,
                  padding: '5px 8px', fontSize: 12,
                }}
              />
            </div>
          )}
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
              { icon: faHandHoldingUsd, color: '#10b981', cls: 'tips', label: 'Propinas', value: formatCurrency(summary?.tips || 0), sub: summary?.tippedOrders ? `${summary.tippedOrders} ${summary.tippedOrders === 1 ? 'pedido' : 'pedidos'} · ${(summary?.tipsPct || 0).toFixed(1).replace(/\.0$/, '')}%` : 'Sin propinas' },
              { icon: faClock, color: '#f59e0b', cls: 'pending', label: 'Pendientes', value: summary?.pendingOrders || 0 },
            ].map(({ icon, color, cls, label, value, sub }) => (
              <div key={label} className="analytics-stat-card">
                <div className="flex items-center gap-3">
                  <div className={`analytics-stat-icon ${cls}`} style={{ flexShrink: 0 }}>
                    <FontAwesomeIcon icon={icon} style={{ color, fontSize: '18px' }} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="analytics-stat-label">{label}</p>
                    <p className="analytics-stat-value">{value}</p>
                    {sub && <p className="analytics-stat-label" style={{ marginTop: 2, opacity: 0.7 }}>{sub}</p>}
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
                  const tip = Number(order.tip_amount) || 0;
                  return (
                    <div
                      key={order.id}
                      className="analytics-order-row"
                      onClick={() => openOrderDetail(order.id)}
                      style={{ cursor: 'pointer' }}
                      title="Ver detalle del pedido"
                    >
                      <div style={{ minWidth: 0 }}>
                        <div className="analytics-order-id" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          #{order.order_number || order.id}
                          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 10, opacity: 0.4 }} />
                        </div>
                        <div className="analytics-order-items">
                          {order.items_count} {order.items_count === 1 ? 'producto' : 'productos'}
                          {' · '}{paymentMethodLabel(order.payment_method)}
                          {tip > 0 && (
                            <span style={{ marginLeft: 6, color: '#10b981', fontWeight: 700 }}>
                              <FontAwesomeIcon icon={faHandHoldingUsd} style={{ marginRight: 3, fontSize: 10 }} />
                              {formatCurrency(tip)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="analytics-order-amount">
                          {formatCurrency(order.total)}
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

          {/* ── Filtros compartidos para productos ── */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16,
            padding: '10px 12px', background: 'var(--muted)', borderRadius: 10,
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 180px', minWidth: 140 }}>
              <FontAwesomeIcon icon={faSearch} style={{ fontSize: 11, color: 'var(--muted-foreground)' }} />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                style={{
                  background: 'var(--background)', color: 'var(--foreground)',
                  border: '1px solid var(--border)', borderRadius: 6,
                  padding: '5px 8px', fontSize: 12, width: '100%', outline: 'none',
                }}
              />
            </div>

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
                <option value="quantity">Por cantidad</option>
                <option value="revenue">Por ingreso</option>
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

          {/* ── Productos Más Vendidos ── */}
          <div className="analytics-section">
            <h3 className="analytics-section-title" style={{ marginBottom: 12 }}>
              <FontAwesomeIcon icon={faTrophy} style={{ marginRight: '8px', color: '#D4AF37' }} />
              Productos Más Vendidos
            </h3>

            {(() => {
              const filtered = topProducts.filter(p =>
                !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
              );
              return filtered.length > 0 ? (
                <div className="analytics-top-products">
                  {filtered.map((product, index) => {
                    const maxVal = topSortBy === 'revenue'
                      ? Math.max(...filtered.map(p => Number(p.revenue) || 0), 1)
                      : Math.max(...filtered.map(p => Number(p.total_sold) || 0), 1);
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
                  <p className="empty-state-text">{productSearch ? 'No se encontraron productos' : 'No hay datos de productos'}</p>
                </div>
              );
            })()}
          </div>

          {/* ── Productos Menos Vendidos ── */}
          <div className="analytics-section" style={{ marginTop: 24 }}>
            <h3 className="analytics-section-title" style={{ marginBottom: 12 }}>
              <FontAwesomeIcon icon={faArrowDown} style={{ marginRight: '8px', color: '#ef4444' }} />
              Productos Menos Vendidos
            </h3>

            {(() => {
              const filtered = bottomProducts.filter(p =>
                !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
              );
              return filtered.length > 0 ? (
                <div className="analytics-top-products">
                  {filtered.map((product, index) => {
                    const maxVal = topSortBy === 'revenue'
                      ? Math.max(...filtered.map(p => Number(p.revenue) || 0), 1)
                      : Math.max(...filtered.map(p => Number(p.total_sold) || 0), 1);
                    const currentVal = topSortBy === 'revenue' ? Number(product.revenue) || 0 : Number(product.total_sold) || 0;
                    const pct = (currentVal / maxVal) * 100;

                    return (
                      <div key={product.id} className="analytics-top-product" style={{ position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: `${pct}%`, background: 'rgba(239,68,68,0.07)',
                          borderRadius: 'inherit', transition: 'width 0.4s ease', pointerEvents: 'none',
                        }} />
                        <div className="analytics-rank" style={{ position: 'relative', color: '#ef4444' }}>
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
                                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
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
                  <FontAwesomeIcon icon={faArrowDown} className="empty-state-icon" />
                  <p className="empty-state-text">{productSearch ? 'No se encontraron productos' : 'No hay datos de productos con ventas bajas'}</p>
                </div>
              );
            })()}
          </div>
        </>
      )}

      {/* ── Modal: detalle del pedido ── */}
      {detailOrder && (
        <div
          onClick={() => setDetailOrder(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--background)', color: 'var(--foreground)',
              border: '1px solid var(--border)', borderRadius: 16,
              width: '100%', maxWidth: 460, maxHeight: '85vh', overflowY: 'auto',
              boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
            }}
          >
            {/* Cabecera */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 18px', borderBottom: '1px solid var(--border)',
              position: 'sticky', top: 0, background: 'var(--background)', zIndex: 1,
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FontAwesomeIcon icon={faReceipt} style={{ color: '#3b82f6' }} />
                Pedido #{detailOrder.order_number || detailOrder.id}
              </h3>
              <button
                onClick={() => setDetailOrder(null)}
                style={{
                  background: 'var(--muted)', border: 'none', borderRadius: 8,
                  width: 30, height: 30, cursor: 'pointer', color: 'var(--foreground)',
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            {detailLoading ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 24 }} />
              </div>
            ) : (
              <div style={{ padding: 18 }}>
                {/* Meta */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {[
                    { icon: faCreditCard, label: paymentMethodLabel(detailOrder.payment_method) },
                    { icon: faUtensils, label: orderTypeLabel(detailOrder.order_type) },
                    ...(detailOrder.table_number ? [{ icon: faTag, label: `Mesa ${detailOrder.table_number}` }] : []),
                    { icon: faClock, label: detailOrder.created_at ? formatDateTime(detailOrder.created_at) : '—' },
                  ].map((m, i) => (
                    <span key={i} style={{
                      fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                      background: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}>
                      <FontAwesomeIcon icon={m.icon} style={{ fontSize: 10, opacity: 0.7 }} />
                      {m.label}
                    </span>
                  ))}
                </div>

                {(detailOrder.customer_name || detailOrder.customer_phone) && (
                  <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 14 }}>
                    Cliente: {detailOrder.customer_name || ''} {detailOrder.customer_phone ? `(${detailOrder.customer_phone})` : ''}
                  </div>
                )}

                {/* Items */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  {(detailOrder.items || []).map((item, i) => {
                    const mods = modifiersText(item);
                    const lineTotal = (Number(item.unit_price) || 0) * (Number(item.quantity) || 0);
                    return (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px dashed var(--border)' }}>
                        <span style={{ fontWeight: 800, color: '#3b82f6', minWidth: 26 }}>{item.quantity}×</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>{item.product_name || 'Producto'}</div>
                          {mods && <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>{mods}</div>}
                        </div>
                        <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrency(lineTotal)}</span>
                      </div>
                    );
                  })}
                  {(!detailOrder.items || detailOrder.items.length === 0) && (
                    <div style={{ fontSize: 13, color: 'var(--muted-foreground)', padding: '8px 0' }}>Sin líneas de producto</div>
                  )}
                </div>

                {/* Totales */}
                <div style={{ marginTop: 14, fontSize: 14 }}>
                  {(() => {
                    const tip = Number(detailOrder.tip_amount) || 0;
                    const discount = Number(detailOrder.discount_total) || 0;
                    const subtotal = Number(detailOrder.subtotal) || 0;
                    const rows = [
                      { label: 'Subtotal', value: formatCurrency(subtotal) },
                      ...(discount > 0 ? [{ label: `Descuento${detailOrder.coupon_code ? ` (${detailOrder.coupon_code})` : ''}`, value: `- ${formatCurrency(discount)}`, color: '#ef4444' }] : []),
                      ...(tip > 0 ? [{ label: 'Propina', value: formatCurrency(tip), color: '#10b981' }] : []),
                    ];
                    return (
                      <>
                        {rows.map((r, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: r.color || 'var(--muted-foreground)' }}>
                            <span>{r.label}</span>
                            <span style={{ fontWeight: 600 }}>{r.value}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 6, borderTop: '1px solid var(--border)', fontWeight: 800, fontSize: 16 }}>
                          <span>Total</span>
                          <span>{formatCurrency(detailOrder.total)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {detailOrder.customer_comment && (
                  <div style={{ marginTop: 14, padding: 10, background: 'var(--muted)', borderRadius: 10, fontSize: 13 }}>
                    <strong>Comentario:</strong> {detailOrder.customer_comment}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Analytics;
