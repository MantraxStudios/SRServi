import { useState, useEffect, useContext, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartLine, faChevronLeft, faChevronRight,
  faCog, faSave, faEdit, faCheck, faTimes,
  faCoins, faStar, faMoneyBill, faTrash, faArrowTrendUp,
  faSun, faMoon, faClock, faCalendarDay
} from '@fortawesome/free-solid-svg-icons';
import { StoreContext } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

const API = 'https://srservi3.srautomatic.com';

const SHIFT_LABELS = { AM: 'Turno AM', PM: 'Turno PM', PART_TIME: 'Part-time' };
const SHIFT_SHORT = { AM: 'AM', PM: 'PM', PART_TIME: 'PT' };
const SHIFT_COLORS = { AM: '#2563eb', PM: '#7c3aed', PART_TIME: '#059669' };
const SHIFT_ICONS = { AM: faSun, PM: faMoon, PART_TIME: faClock };

function today() {
  return new Date().toISOString().split('T')[0];
}

function fmtCLP(v) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v || 0);
}

function useIsMobile(bp = 768) {
  const [m, setM] = useState(typeof window !== 'undefined' ? window.innerWidth < bp : false);
  useEffect(() => {
    const onR = () => setM(window.innerWidth < bp);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, [bp]);
  return m;
}

export default function VentasDelMes() {
  const { selectedStore } = useContext(StoreContext);
  const { token } = useAuth();
  const isMobile = useIsMobile();

  const storeCode = selectedStore?.code;

  return (
    <div style={{ padding: isMobile ? '14px' : '24px', maxWidth: 1200, margin: '0 auto', color: '#09090b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isMobile ? 16 : 24 }}>
        <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg,#e3c356,#b8960c)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(212,175,55,0.35)' }}>
          <FontAwesomeIcon icon={faArrowTrendUp} style={{ color: '#000', fontSize: 18 }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 19 : 22, fontWeight: 800, color: '#09090b', letterSpacing: '-0.02em' }}>Ventas del Mes</h1>
          <p style={{ margin: 0, color: '#71717a', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedStore?.name || 'Sin tienda seleccionada'} · Proyecciones</p>
        </div>
      </div>

      {!storeCode ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: '#a1a1aa', background: '#fff', border: '1px solid #e4e4e7', borderRadius: 14 }}>
          Selecciona una tienda para ver las ventas
        </div>
      ) : (
        <SalesPanel storeCode={storeCode} token={token} isMobile={isMobile} />
      )}
    </div>
  );
}

function SalesPanel({ storeCode, token, isMobile }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [sales, setSales] = useState([]);
  const [autoSales, setAutoSales] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValues, setEditValues] = useState({ gross_sales: '', net_sales: '', transactions: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/attendance/${storeCode}/sales?year=${year}&month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSales(data.sales || []);
        setAutoSales(data.autoSales || []);
        setConfig(data.config);
      }
    } finally { setLoading(false); }
  }, [storeCode, token, year, month]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const todayStr = today();

  const daysInMonth = new Date(year, month, 0).getDate();
  const allDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  });

  const manualMap = {};
  sales.forEach(s => { manualMap[`${s.date.split('T')[0]}_${s.shift}`] = s; });

  const autoMap = {};
  autoSales.forEach(s => { autoMap[`${s.date.split('T')[0]}_${s.shift}`] = s; });

  function getEffectiveSale(date, shift) {
    const key = `${date}_${shift}`;
    if (manualMap[key]) return { data: manualMap[key], isAuto: false };
    if (autoMap[key]) return { data: autoMap[key], isAuto: true };
    return null;
  }

  const allEffective = [];
  allDays.forEach(date => {
    ['AM', 'PM', 'PART_TIME'].forEach(shift => {
      const e = getEffectiveSale(date, shift);
      if (e) allEffective.push({ ...e.data, date, shift });
    });
  });

  const workingDays = [...new Set(allEffective.map(s => s.date.split('T')[0]))];
  const workingDaysPast = workingDays.filter(d => d <= todayStr).length;

  const totalNetSales = allEffective.reduce((a, r) => a + parseFloat(r.net_sales || 0), 0);
  const totalGrossSales = allEffective.reduce((a, r) => a + parseFloat(r.gross_sales || 0), 0);
  const avgDailyNet = workingDaysPast > 0 ? totalNetSales / workingDaysPast : 0;

  const isCurrentMonth = year === now.getFullYear() && (month === now.getMonth() + 1);
  const daysPast = isCurrentMonth ? parseInt(todayStr.split('-')[2]) : daysInMonth;
  const remainingDays = daysInMonth - daysPast;
  const projectedNet = totalNetSales + avgDailyNet * remainingDays;
  const monthProgress = Math.min(100, Math.round((daysPast / daysInMonth) * 100));

  const commissionRate = config ? parseFloat(config.commission_rate) : 1;
  const dailyBonus = config ? parseFloat(config.daily_bonus) : 10;
  const successBonus = config ? parseFloat(config.success_bonus) : 10;
  const commissionThreshold = config ? parseFloat(config.commission_threshold) : 0;

  const commissionBase = projectedNet > commissionThreshold ? projectedNet : 0;
  const projectedCommission = commissionBase * (commissionRate / 100);
  const dailyBonusTotal = workingDaysPast * dailyBonus;

  const amNet = allEffective.filter(s => s.shift === 'AM').reduce((a, r) => a + parseFloat(r.net_sales || 0), 0);
  const pmNet = allEffective.filter(s => s.shift === 'PM').reduce((a, r) => a + parseFloat(r.net_sales || 0), 0);
  const ptNet = allEffective.filter(s => s.shift === 'PART_TIME').reduce((a, r) => a + parseFloat(r.net_sales || 0), 0);

  function startEdit(date, shift) {
    const e = getEffectiveSale(date, shift);
    const s = e ? e.data : null;
    setEditingCell({ date, shift });
    setEditValues({
      gross_sales: s ? s.gross_sales : '',
      net_sales: s ? s.net_sales : '',
      transactions: s ? s.transactions : '',
      notes: s && !e?.isAuto ? (s.notes || '') : '',
    });
  }

  async function saveCell() {
    if (!editingCell) return;
    setSaving(true);
    try {
      await fetch(`${API}/api/attendance/${storeCode}/sales`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingCell, ...editValues })
      });
      await fetchSales();
      setEditingCell(null);
    } finally { setSaving(false); }
  }

  async function deleteCell(date, shift) {
    await fetch(`${API}/api/attendance/${storeCode}/sales?date=${date}&shift=${shift}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    await fetchSales();
  }

  function shiftMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m); setYear(y);
  }

  const monthName = new Date(year, month - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

  const sharedTableProps = {
    allDays, todayStr, getEffectiveSale, editingCell, editValues, setEditValues,
    startEdit, saveCell, deleteCell, saving, cancelEdit: () => setEditingCell(null)
  };

  return (
    <div>
      {/* ── Mes + Configurar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#fff', borderRadius: 10, padding: '4px', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <button onClick={() => shiftMonth(-1)} style={navBtn}>
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <span style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize', minWidth: isMobile ? 110 : 150, textAlign: 'center', color: '#09090b' }}>{monthName}</span>
          <button onClick={() => shiftMonth(1)} style={navBtn}>
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
        <button
          onClick={() => setShowConfig(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: showConfig ? '#09090b' : '#fff', border: '1px solid ' + (showConfig ? '#09090b' : '#e4e4e7'), borderRadius: 10, color: showConfig ? '#fff' : '#09090b', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginLeft: 'auto', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <FontAwesomeIcon icon={faCog} /> {!isMobile && 'Configurar'}
        </button>
      </div>

      {showConfig && config && (
        <ConfigPanel config={config} storeCode={storeCode} token={token} onSaved={fetchSales} isMobile={isMobile} />
      )}

      {/* ── Hero: Proyección + Comisión ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: 14, marginBottom: 20 }}>
        <div style={{
          background: 'linear-gradient(135deg, #18181b 0%, #000 100%)',
          borderRadius: 16, padding: isMobile ? '18px 18px' : '22px 24px', color: '#fff',
          position: 'relative', overflow: 'hidden', border: '1px solid #27272a'
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,0.22), transparent 70%)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, position: 'relative' }}>
            <FontAwesomeIcon icon={faArrowTrendUp} style={{ color: '#D4AF37', fontSize: 14 }} />
            <span style={{ fontSize: 12, color: '#D4AF37', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Proyección fin de mes</span>
          </div>
          <div style={{ fontSize: isMobile ? 32 : 40, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, position: 'relative' }}>{fmtCLP(projectedNet)}</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap', position: 'relative' }}>
            <HeroSub label="Vendido a hoy" value={fmtCLP(totalNetSales)} />
            <HeroSub label="Prom. diario" value={fmtCLP(avgDailyNet)} />
            <HeroSub label="Días trab." value={String(workingDaysPast)} />
          </div>
          <div style={{ marginTop: 16, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>
              <span>Avance del mes</span><span>{monthProgress}%</span>
            </div>
            <div style={{ height: 7, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${monthProgress}%`, height: '100%', background: 'linear-gradient(90deg,#b8960c,#e3c356)', borderRadius: 99, transition: 'width 0.4s' }} />
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 16, padding: isMobile ? '18px' : '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesomeIcon icon={faCoins} style={{ color: '#d97706', fontSize: 13 }} />
              </div>
              <span style={{ fontSize: 12, color: '#71717a', fontWeight: 600 }}>Comisión {commissionRate}% proyectada</span>
            </div>
            <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 900, color: '#09090b', letterSpacing: '-0.02em' }}>{fmtCLP(projectedCommission)}</div>
            <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2 }}>{commissionThreshold > 0 ? `Activa sobre ${fmtCLP(commissionThreshold)}` : 'Activa desde $0'}</div>
          </div>
          <div style={{ borderTop: '1px solid #f4f4f5', paddingTop: 14, display: 'flex', gap: 12 }}>
            <MiniStat icon={faStar} color="#dc2626" label="Bono diario acum." value={fmtCLP(dailyBonusTotal)} />
            <div style={{ width: 1, background: '#f4f4f5' }} />
            <MiniStat icon={faStar} color="#4f46e5" label="Bono éxito (ref.)" value={fmtCLP(successBonus)} />
          </div>
        </div>
      </div>

      {/* ── Resumen del mes ── */}
      <SectionLabel>Resumen del mes</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Ventas netas" value={fmtCLP(totalNetSales)} icon={faMoneyBill} color="#16a34a" />
        <StatCard label="Ventas brutas" value={fmtCLP(totalGrossSales)} icon={faChartLine} color="#2563eb" />
        <StatCard label="Promedio diario" value={fmtCLP(avgDailyNet)} icon={faCalendarDay} color="#7c3aed" style={isMobile ? { gridColumn: '1 / -1' } : undefined} />
      </div>

      {/* ── Por turno ── */}
      <SectionLabel>Ventas netas por turno</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 22 }}>
        <StatCard label={isMobile ? 'AM' : 'Turno AM'} value={fmtCLP(amNet)} icon={SHIFT_ICONS.AM} color={SHIFT_COLORS.AM} compact={isMobile} />
        <StatCard label={isMobile ? 'PM' : 'Turno PM'} value={fmtCLP(pmNet)} icon={SHIFT_ICONS.PM} color={SHIFT_COLORS.PM} compact={isMobile} />
        <StatCard label={isMobile ? 'Part-t.' : 'Part-time'} value={fmtCLP(ptNet)} icon={SHIFT_ICONS.PART_TIME} color={SHIFT_COLORS.PART_TIME} compact={isMobile} />
      </div>

      {/* ── Detalle diario ── */}
      <SectionLabel>Detalle diario</SectionLabel>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#a1a1aa', background: '#fff', border: '1px solid #e4e4e7', borderRadius: 14 }}>Cargando...</div>
      ) : isMobile ? (
        <SalesCards {...sharedTableProps} />
      ) : (
        <SalesTable {...sharedTableProps} />
      )}
    </div>
  );
}

const navBtn = { background: 'none', border: 'none', color: '#09090b', cursor: 'pointer', padding: '6px 10px', borderRadius: 8, fontSize: 13 };

function HeroSub({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function MiniStat({ icon, color, label, value }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
        <FontAwesomeIcon icon={icon} style={{ color, fontSize: 11 }} />
        <span style={{ fontSize: 10.5, color: '#a1a1aa', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#09090b' }}>{value}</div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 10px 2px' }}>{children}</div>
  );
}

function StatCard({ label, value, icon, color, sub, compact, style }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e4e4e7', borderRadius: 14, padding: compact ? '12px 12px' : '15px 16px',
      display: 'flex', flexDirection: 'column', gap: compact ? 4 : 6, position: 'relative', overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)', ...style
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{ width: 26, height: 26, background: `${color}15`, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FontAwesomeIcon icon={icon} style={{ color, fontSize: 12 }} />
        </div>
        <span style={{ fontSize: 11.5, color: '#71717a', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </div>
      <span style={{ fontSize: compact ? 16 : 20, fontWeight: 800, color: '#09090b', letterSpacing: '-0.02em' }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: '#a1a1aa' }}>{sub}</span>}
    </div>
  );
}

const thStyle = {
  padding: '10px 12px', textAlign: 'left', color: '#71717a',
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5
};

const editInputStyle = {
  width: '100%', padding: '8px 10px', border: '1.5px solid #D4AF37', borderRadius: 8,
  fontSize: 14, background: '#fffbeb', outline: 'none', boxSizing: 'border-box', color: '#09090b'
};

function Legend() {
  return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid #f4f4f5', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: '#71717a', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }}></span>
        Auto (desde pedidos POS)
      </span>
      <span style={{ fontSize: 11, color: '#71717a', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#D4AF37' }}></span>
        Manual (editado por admin)
      </span>
    </div>
  );
}

/* ─────────────────────────  MÓVIL: tarjetas por día  ───────────────────────── */
function SalesCards({ allDays, todayStr, getEffectiveSale, editingCell, editValues, setEditValues, startEdit, saveCell, deleteCell, saving, cancelEdit }) {
  const SHIFTS = ['AM', 'PM', 'PART_TIME'];
  const isEditing = (date, shift) => editingCell?.date === date && editingCell?.shift === shift;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Legend />
      {allDays.map(date => {
        const isToday = date === todayStr;
        const isFuture = date > todayStr;
        const dayTotalNet = SHIFTS.reduce((a, s) => a + parseFloat(getEffectiveSale(date, s)?.data?.net_sales || 0), 0);
        const hasAny = SHIFTS.some(s => getEffectiveSale(date, s));

        // Ocultar días futuros vacíos para reducir ruido
        if (isFuture && !hasAny) return null;

        const dLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric' });

        return (
          <div key={date} style={{
            background: '#fff', border: `1px solid ${isToday ? '#D4AF37' : '#e4e4e7'}`, borderRadius: 14, overflow: 'hidden',
            boxShadow: isToday ? '0 2px 10px rgba(212,175,55,0.18)' : '0 1px 2px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: isToday ? '#fffbeb' : isFuture ? '#fafafa' : '#f9f9fb', borderBottom: '1px solid #f4f4f5' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 700, color: isFuture ? '#a1a1aa' : '#09090b', textTransform: 'capitalize' }}>
                {isToday && <span style={{ background: '#D4AF37', color: '#000', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 5 }}>HOY</span>}
                {dLabel}
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: dayTotalNet > 0 ? '#16a34a' : '#d4d4d8' }}>
                {dayTotalNet > 0 ? fmtCLP(dayTotalNet) : '—'}
              </span>
            </div>

            <div style={{ padding: '6px 10px 10px' }}>
              {SHIFTS.map(shift => {
                const effective = getEffectiveSale(date, shift);
                const sale = effective?.data;
                const isAuto = effective?.isAuto;
                const editing = isEditing(date, shift);

                if (editing) {
                  return (
                    <div key={shift} style={{ padding: '10px 6px', borderTop: '1px solid #f4f4f5' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <FontAwesomeIcon icon={SHIFT_ICONS[shift]} style={{ color: SHIFT_COLORS[shift], fontSize: 12 }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: SHIFT_COLORS[shift] }}>{SHIFT_LABELS[shift]}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <Field label="V. Brutas" v={editValues.gross_sales} on={e => setEditValues(x => ({ ...x, gross_sales: e }))} />
                        <Field label="V. Netas" v={editValues.net_sales} on={e => setEditValues(x => ({ ...x, net_sales: e }))} />
                        <Field label="Transacciones" v={editValues.transactions} on={e => setEditValues(x => ({ ...x, transactions: e }))} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button onClick={saveCell} disabled={saving} style={{ flex: 1, background: '#16a34a', border: 'none', color: '#fff', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                          <FontAwesomeIcon icon={faCheck} /> Guardar
                        </button>
                        <button onClick={cancelEdit} style={{ flex: 1, background: '#f4f4f5', border: '1px solid #e4e4e7', color: '#09090b', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={shift} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px', borderTop: '1px solid #f4f4f5' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `${SHIFT_COLORS[shift]}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FontAwesomeIcon icon={SHIFT_ICONS[shift]} style={{ color: SHIFT_COLORS[shift], fontSize: 13 }} />
                    </div>
                    <div style={{ width: 34, fontSize: 12, fontWeight: 700, color: '#71717a', flexShrink: 0 }}>{SHIFT_SHORT[shift]}</div>
                    {sale ? (
                      <>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: '#09090b' }}>{fmtCLP(sale.net_sales)}</span>
                            <span style={{ fontSize: 8.5, fontWeight: 800, padding: '2px 5px', borderRadius: 4, background: isAuto ? '#dcfce7' : '#fef9c3', color: isAuto ? '#16a34a' : '#a16207' }}>
                              {isAuto ? 'AUTO' : 'MANUAL'}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 1 }}>
                            Bruto {fmtCLP(sale.gross_sales)} · {sale.transactions || 0} txn
                          </div>
                        </div>
                        {!isFuture && (
                          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                            <button onClick={() => startEdit(date, shift)} title="Editar" style={iconBtn}>
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                            {!isAuto && (
                              <button onClick={() => deleteCell(date, shift)} title="Eliminar manual" style={{ ...iconBtn, color: '#fca5a5' }}>
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      !isFuture ? (
                        <button onClick={() => startEdit(date, shift)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: '#c4c4cc', fontSize: 13, fontWeight: 600, padding: '4px 0' }}>
                          + Ingresar
                        </button>
                      ) : (
                        <span style={{ flex: 1, color: '#d4d4d8', fontSize: 13 }}>—</span>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, v, on }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 10, color: '#71717a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</label>
      <input type="number" inputMode="numeric" placeholder="0" value={v} onChange={e => on(e.target.value)} style={editInputStyle} />
    </div>
  );
}

const iconBtn = { background: '#f4f4f5', border: 'none', cursor: 'pointer', color: '#71717a', width: 30, height: 30, borderRadius: 7, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' };

/* ─────────────────────────  ESCRITORIO: tabla  ───────────────────────── */
function SalesTable({ allDays, todayStr, getEffectiveSale, editingCell, editValues, setEditValues, startEdit, saveCell, deleteCell, saving, cancelEdit }) {
  const SHIFTS = ['AM', 'PM', 'PART_TIME'];
  const isEditing = (date, shift) => editingCell?.date === date && editingCell?.shift === shift;

  const inputStyle = {
    width: '100%', padding: '4px 6px', border: '1px solid #D4AF37', borderRadius: 4,
    fontSize: 12, background: '#fffbeb', outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
      <Legend />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr style={{ background: '#f4f4f5', borderBottom: '1px solid #e4e4e7' }}>
              <th style={thStyle}>Fecha</th>
              {SHIFTS.map(s => (
                <th key={s} colSpan={3} style={{ ...thStyle, color: SHIFT_COLORS[s], borderLeft: '1px solid #e4e4e7' }}>
                  {SHIFT_LABELS[s]}
                </th>
              ))}
              <th style={{ ...thStyle, borderLeft: '1px solid #e4e4e7' }}>Total neto día</th>
            </tr>
            <tr style={{ background: '#fafafa', borderBottom: '1px solid #e4e4e7' }}>
              <th style={thStyle}></th>
              {SHIFTS.map(s => (
                ['V. Brutas', 'V. Netas', 'Txn'].map((h, i) => (
                  <th key={`${s}_${h}`} style={{ ...thStyle, fontSize: 10, borderLeft: i === 0 ? '1px solid #e4e4e7' : 'none' }}>{h}</th>
                ))
              ))}
              <th style={{ ...thStyle, borderLeft: '1px solid #e4e4e7' }}></th>
            </tr>
          </thead>
          <tbody>
            {allDays.map((date, idx) => {
              const isToday = date === todayStr;
              const isFuture = date > todayStr;
              const dayTotalNet = SHIFTS.reduce((a, s) => {
                const e = getEffectiveSale(date, s);
                return a + parseFloat(e?.data?.net_sales || 0);
              }, 0);

              return (
                <tr
                  key={date}
                  style={{
                    borderTop: idx > 0 ? '1px solid #f4f4f5' : 'none',
                    background: isToday ? '#fffbeb' : isFuture ? '#fafafa' : '#fff',
                  }}
                >
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isToday && <span style={{ background: '#D4AF37', color: '#000', fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 4 }}>HOY</span>}
                      <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isFuture ? '#a1a1aa' : '#09090b', textTransform: 'capitalize' }}>
                        {new Date(date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </td>

                  {SHIFTS.map((shift, si) => {
                    const effective = getEffectiveSale(date, shift);
                    const sale = effective?.data;
                    const isAuto = effective?.isAuto;
                    const editing = isEditing(date, shift);

                    if (editing) {
                      return (
                        <td key={shift} colSpan={3} style={{ padding: '6px 8px', borderLeft: si === 0 ? '1px solid #e4e4e7' : 'none' }}>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 80 }}>
                              <label style={{ fontSize: 9, color: '#71717a', fontWeight: 600 }}>V. BRUTAS</label>
                              <input type="number" placeholder="0" value={editValues.gross_sales} onChange={e => setEditValues(v => ({ ...v, gross_sales: e.target.value }))} style={inputStyle} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 80 }}>
                              <label style={{ fontSize: 9, color: '#71717a', fontWeight: 600 }}>V. NETAS</label>
                              <input type="number" placeholder="0" value={editValues.net_sales} onChange={e => setEditValues(v => ({ ...v, net_sales: e.target.value }))} style={inputStyle} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 50 }}>
                              <label style={{ fontSize: 9, color: '#71717a', fontWeight: 600 }}>TXN</label>
                              <input type="number" placeholder="0" value={editValues.transactions} onChange={e => setEditValues(v => ({ ...v, transactions: e.target.value }))} style={inputStyle} />
                            </div>
                            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                              <button onClick={saveCell} disabled={saving} style={{ background: '#16a34a', border: 'none', color: '#fff', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>
                                <FontAwesomeIcon icon={faCheck} />
                              </button>
                              <button onClick={cancelEdit} style={{ background: '#f4f4f5', border: '1px solid #e4e4e7', color: '#09090b', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>
                                <FontAwesomeIcon icon={faTimes} />
                              </button>
                            </div>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={shift} colSpan={3} style={{ borderLeft: si === 0 ? '1px solid #e4e4e7' : 'none' }}>
                        {sale ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                            <div style={{ flex: 1, padding: '6px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                <span style={{
                                  fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                                  background: isAuto ? '#dcfce7' : '#fef9c3',
                                  color: isAuto ? '#16a34a' : '#a16207',
                                }}>
                                  {isAuto ? 'AUTO' : 'MANUAL'}
                                </span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
                                <span style={{ fontSize: 12, color: '#52525b' }}>{fmtCLP(sale.gross_sales)}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#09090b' }}>{fmtCLP(sale.net_sales)}</span>
                                <span style={{ fontSize: 11, color: '#a1a1aa' }}>{sale.transactions || 0}</span>
                              </div>
                            </div>
                            {!isFuture && (
                              <div style={{ display: 'flex', gap: 2, padding: '0 4px' }}>
                                <button onClick={() => startEdit(date, shift)} title="Editar / corregir" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', padding: 3, fontSize: 11 }}>
                                  <FontAwesomeIcon icon={faEdit} />
                                </button>
                                {!isAuto && (
                                  <button onClick={() => deleteCell(date, shift)} title="Eliminar manual (vuelve a auto)" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', padding: 3, fontSize: 11 }}>
                                    <FontAwesomeIcon icon={faTrash} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          !isFuture && (
                            <button
                              onClick={() => startEdit(date, shift)}
                              style={{ width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#d4d4d8', fontSize: 11, textAlign: 'left' }}
                            >
                              + Ingresar
                            </button>
                          )
                        )}
                      </td>
                    );
                  })}

                  <td style={{ padding: '8px 12px', borderLeft: '1px solid #e4e4e7', fontWeight: 700, fontSize: 13, color: dayTotalNet > 0 ? '#09090b' : '#d4d4d8', whiteSpace: 'nowrap' }}>
                    {dayTotalNet > 0 ? fmtCLP(dayTotalNet) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConfigPanel({ config, storeCode, token, onSaved, isMobile }) {
  const [form, setForm] = useState({ ...config });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`${API}/api/attendance/${storeCode}/sales/config`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      await onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  const fieldStyle = {
    padding: '9px 12px', border: '1px solid #e4e4e7', borderRadius: 8,
    fontSize: 14, outline: 'none', background: '#f9f9fb', color: '#09090b', width: '100%', boxSizing: 'border-box'
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 14, padding: isMobile ? 16 : 20, marginBottom: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#09090b' }}>
        <FontAwesomeIcon icon={faCog} style={{ marginRight: 8, color: '#D4AF37' }} />
        Configuración de Comisiones y Bonos
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: isMobile ? 12 : 16 }}>
        <ConfigField label="Comisión del grupo (%)" value={form.commission_rate} onChange={v => setForm(f => ({ ...f, commission_rate: v }))} style={fieldStyle} type="number" step="0.1" min="0" />
        <ConfigField label="Umbral comisión ($)" value={form.commission_threshold} onChange={v => setForm(f => ({ ...f, commission_threshold: v }))} style={fieldStyle} type="number" min="0" />
        <ConfigField label="Bono diario / trabajador ($)" value={form.daily_bonus} onChange={v => setForm(f => ({ ...f, daily_bonus: v }))} style={fieldStyle} type="number" min="0" />
        <ConfigField label="Bono éxito compra/venta ($)" value={form.success_bonus} onChange={v => setForm(f => ({ ...f, success_bonus: v }))} style={fieldStyle} type="number" min="0" />
        <ConfigField label="Inicio Turno AM" value={form.am_start?.substring(0,5)} onChange={v => setForm(f => ({ ...f, am_start: v + ':00' }))} style={fieldStyle} type="time" />
        <ConfigField label="Fin Turno AM" value={form.am_end?.substring(0,5)} onChange={v => setForm(f => ({ ...f, am_end: v + ':00' }))} style={fieldStyle} type="time" />
        <ConfigField label="Inicio Turno PM" value={form.pm_start?.substring(0,5)} onChange={v => setForm(f => ({ ...f, pm_start: v + ':00' }))} style={fieldStyle} type="time" />
        <ConfigField label="Fin Turno PM" value={form.pm_end?.substring(0,5)} onChange={v => setForm(f => ({ ...f, pm_end: v + ':00' }))} style={fieldStyle} type="time" />
      </div>
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 20px', background: saved ? '#16a34a' : 'linear-gradient(135deg,#e3c356,#b8960c)', border: 'none', borderRadius: 10, color: saved ? '#fff' : '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: isMobile ? '100%' : 'auto' }}>
          <FontAwesomeIcon icon={saved ? faCheck : faSave} />
          {saved ? 'Guardado' : saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}

function ConfigField({ label, value, onChange, style, type = 'text', step, min }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#71717a' }}>{label}</label>
      <input
        type={type}
        step={step}
        min={min}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={style}
      />
    </div>
  );
}
