import { useState, useEffect, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarDay,
  faDollarSign,
  faShoppingCart,
  faChartLine,
  faClock,
  faCheck,
  faTimes,
  faSpinner,
  faChevronDown,
  faChevronUp,
  faCreditCard,
  faMoneyBillWave,
  faMobileAlt,
  faBoxOpen,
  faTrophy,
  faFilter,
  faSync,
  faReceipt,
} from '@fortawesome/free-solid-svg-icons';

const STATUS_MAP = {
  paid:      { label: 'Pagado',    color: '#22c55e' },
  processed: { label: 'Procesado', color: '#22c55e' },
  completed: { label: 'Completado',color: '#22c55e' },
  approved:  { label: 'Aprobado',  color: '#22c55e' },
  pending:   { label: 'Pendiente', color: '#f59e0b' },
  waiting:   { label: 'Esperando', color: '#f59e0b' },
  cancelled: { label: 'Cancelado', color: '#ef4444' },
};

const PAYMENT_LABELS = {
  cash:        { label: 'Efectivo',    icon: faMoneyBillWave, color: '#22c55e' },
  card:        { label: 'Tarjeta',     icon: faCreditCard,    color: '#3b82f6' },
  mercadopago: { label: 'MercadoPago', icon: faMobileAlt,     color: '#009ee3' },
};

const TYPE_LABELS = {
  serve:    { label: 'Mesa',    color: '#8b5cf6' },
  takeout:  { label: 'Llevar',  color: '#f59e0b' },
  delivery: { label: 'Delivery',color: '#ef4444' },
};

function today() {
  return new Date().toISOString().split('T')[0];
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function OrderRow({ order, currency }) {
  const [open, setOpen] = useState(false);
  const status = STATUS_MAP[order.status] || { label: order.status, color: '#888' };
  const payment = PAYMENT_LABELS[order.payment_method] || { label: order.payment_method, icon: faDollarSign, color: '#888' };

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 8,
      background: 'var(--card)',
      transition: 'border-color 0.15s',
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Order # + time */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--foreground)' }}>
              #{order.id}
            </span>
            {order.order_number && (
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600 }}>
                {order.order_number}
              </span>
            )}
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
              background: `${status.color}18`, color: status.color,
            }}>
              {status.label}
            </span>
            {TYPE_LABELS[order.order_type] && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                background: `${TYPE_LABELS[order.order_type].color}18`,
                color: TYPE_LABELS[order.order_type].color,
              }}>
                {TYPE_LABELS[order.order_type].label}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              {formatTime(order.created_at)}
            </span>
            <span style={{ fontSize: 11, color: payment.color, display: 'flex', alignItems: 'center', gap: 4 }}>
              <FontAwesomeIcon icon={payment.icon} style={{ fontSize: 10 }} />
              {payment.label}
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              {order.items?.length || 0} producto{order.items?.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        {/* Total */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)' }}>
            {currency}{Number(order.total).toFixed(2)}
          </span>
        </div>
        <FontAwesomeIcon
          icon={open ? faChevronUp : faChevronDown}
          style={{ fontSize: 11, color: 'var(--muted-foreground)', flexShrink: 0 }}
        />
      </button>

      {open && order.items?.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px', background: 'var(--muted)' }}>
          {order.items.map((item, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '6px 0', borderBottom: i < order.items.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ minWidth: 0, flex: 1, marginRight: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                  {item.quantity}× {item.product_name}
                </span>
                {item.selected_ingredients?.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                    {item.selected_ingredients.map(ing => typeof ing === 'string' ? ing : ing.name).join(', ')}
                  </div>
                )}
                {item.selected_extras?.length > 0 && (
                  <div style={{ fontSize: 11, color: '#D4AF37', marginTop: 1 }}>
                    + {item.selected_extras.map(ex => typeof ex === 'string' ? ex : ex.name).join(', ')}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
                {currency}{(Number(item.unit_price) * Number(item.quantity)).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VentasDelDia() {
  const { token } = useAuth();
  const { selectedStore } = useContext(StoreContext);

  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    if (selectedStore?.id) fetchData();
  }, [selectedStore, date]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analytics/ventas-dia?store_id=${selectedStore.id}&date=${date}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const currency = selectedStore?.currency_symbol || '$';

  const fmt = (v) => `${currency}${Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const filteredOrders = (data?.orders || []).filter(o => {
    if (filterStatus !== 'all') {
      const isCompleted = ['completed', 'paid', 'processed', 'approved'].includes(o.status);
      const isPending   = ['pending', 'waiting'].includes(o.status);
      if (filterStatus === 'completed' && !isCompleted) return false;
      if (filterStatus === 'pending'   && !isPending)   return false;
      if (filterStatus === 'cancelled' && o.status !== 'cancelled') return false;
    }
    if (filterPayment !== 'all' && o.payment_method !== filterPayment) return false;
    if (filterType    !== 'all' && o.order_type    !== filterType)    return false;
    return true;
  });

  if (!selectedStore) {
    return (
      <div className="empty-state">
        <p className="empty-state-text">Selecciona una tienda para ver las ventas</p>
      </div>
    );
  }

  const s = data?.summary;

  return (
    <div style={{ padding: '20px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <FontAwesomeIcon icon={faCalendarDay} style={{ color: '#D4AF37' }} />
            Ventas del Día
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted-foreground)' }}>
            Detalle de pedidos y totales
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="date"
            value={date}
            max={today()}
            onChange={e => setDate(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--card)', color: 'var(--foreground)', fontSize: 13,
              cursor: 'pointer', outline: 'none',
            }}
          />
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#D4AF37', color: '#000', fontWeight: 700, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: loading ? 0.7 : 1,
            }}
          >
            <FontAwesomeIcon icon={faSync} spin={loading} />
            Actualizar
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 32, color: '#D4AF37' }} />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12, marginBottom: 20,
          }}>
            {[
              { icon: faDollarSign,  color: '#22c55e', label: 'Total del Día',   value: fmt(s?.totalRevenue || 0) },
              { icon: faShoppingCart,color: '#3b82f6', label: 'Pedidos',          value: s?.totalOrders || 0 },
              { icon: faChartLine,   color: '#D4AF37', label: 'Ticket Promedio',  value: fmt(s?.avgOrder || 0) },
              { icon: faCheck,       color: '#22c55e', label: 'Completados',      value: s?.completedOrders || 0 },
              { icon: faClock,       color: '#f59e0b', label: 'Pendientes',       value: s?.pendingOrders || 0 },
              { icon: faTimes,       color: '#ef4444', label: 'Cancelados',       value: s?.cancelledOrders || 0 },
            ].map(({ icon, color, label, value }) => (
              <div key={label} style={{
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FontAwesomeIcon icon={icon} style={{ color, fontSize: 16 }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--foreground)', lineHeight: 1.2 }}>{value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Payment breakdown */}
          {s && Object.keys(s.byPaymentMethod).length > 0 && (
            <div style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
              padding: '16px', marginBottom: 20,
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12,
            }}>
              {Object.entries(s.byPaymentMethod).map(([pm, val]) => {
                const p = PAYMENT_LABELS[pm] || { label: pm, icon: faDollarSign, color: '#888' };
                return (
                  <div key={pm} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 9, background: `${p.color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <FontAwesomeIcon icon={p.icon} style={{ color: p.color, fontSize: 14 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 600 }}>{p.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)' }}>{fmt(val.total)}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{val.count} pedido{val.count !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="vdd-two-col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 260px', gap: 20, alignItems: 'start' }}>

            {/* Left: orders list */}
            <div>
              {/* Filters */}
              <div style={{
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
                padding: '12px 14px', marginBottom: 14,
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              }}>
                <FontAwesomeIcon icon={faFilter} style={{ color: 'var(--muted-foreground)', fontSize: 12 }} />
                <FilterSelect
                  value={filterStatus}
                  onChange={setFilterStatus}
                  options={[
                    { value: 'all',       label: 'Todos' },
                    { value: 'completed', label: 'Completados' },
                    { value: 'pending',   label: 'Pendientes' },
                    { value: 'cancelled', label: 'Cancelados' },
                  ]}
                />
                <FilterSelect
                  value={filterPayment}
                  onChange={setFilterPayment}
                  options={[
                    { value: 'all',        label: 'Pago: Todos' },
                    { value: 'cash',       label: 'Efectivo' },
                    { value: 'card',       label: 'Tarjeta' },
                    { value: 'mercadopago',label: 'MercadoPago' },
                  ]}
                />
                <FilterSelect
                  value={filterType}
                  onChange={setFilterType}
                  options={[
                    { value: 'all',      label: 'Tipo: Todos' },
                    { value: 'serve',    label: 'Mesa' },
                    { value: 'takeout',  label: 'Llevar' },
                    { value: 'delivery', label: 'Delivery' },
                  ]}
                />
                {filteredOrders.length !== (data?.orders?.length || 0) && (
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginLeft: 'auto' }}>
                    {filteredOrders.length} de {data?.orders?.length}
                  </span>
                )}
              </div>

              {/* Orders */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <FontAwesomeIcon icon={faReceipt} style={{ color: 'var(--muted-foreground)', fontSize: 12 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
                  Pedidos ({filteredOrders.length})
                </span>
              </div>

              {filteredOrders.length === 0 ? (
                <div style={{
                  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
                  padding: '40px 20px', textAlign: 'center',
                }}>
                  <FontAwesomeIcon icon={faShoppingCart} style={{ fontSize: 32, color: 'var(--muted-foreground)', marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--muted-foreground)', fontSize: 14, margin: 0 }}>
                    {data?.orders?.length === 0 ? 'Sin pedidos este día' : 'Sin resultados para los filtros'}
                  </p>
                </div>
              ) : (
                filteredOrders.map(order => (
                  <OrderRow key={order.id} order={order} currency={currency} />
                ))
              )}
            </div>

            {/* Right: top products */}
            <div className="vdd-sidebar" style={{
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
              padding: '16px', position: 'sticky', top: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <FontAwesomeIcon icon={faTrophy} style={{ color: '#D4AF37', fontSize: 14 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
                  Más Vendidos
                </span>
              </div>
              {data?.topProducts?.length > 0 ? (
                data.topProducts.map((p, i) => (
                  <div key={p.name} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 0',
                    borderBottom: i < data.topProducts.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 6, background: i === 0 ? 'rgba(212,175,55,0.15)' : 'var(--muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 800, color: i === 0 ? '#D4AF37' : 'var(--muted-foreground)',
                      flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                        {p.quantity} un. · {fmt(p.revenue)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <FontAwesomeIcon icon={faBoxOpen} style={{ fontSize: 24, color: 'var(--muted-foreground)', marginBottom: 8, display: 'block' }} />
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>Sin datos</p>
                </div>
              )}
            </div>
          </div>

          {/* Mobile: top products below on small screens */}
          <style>{`
            @media (max-width: 640px) {
              .vdd-two-col {
                grid-template-columns: 1fr !important;
              }
              .vdd-sidebar {
                position: static !important;
              }
            }
          `}</style>
        </>
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)',
        background: 'var(--card)', color: 'var(--foreground)', fontSize: 12,
        fontWeight: 600, cursor: 'pointer', outline: 'none',
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export default VentasDelDia;
