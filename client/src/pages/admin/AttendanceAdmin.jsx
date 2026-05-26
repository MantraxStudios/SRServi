import { useState, useEffect, useContext, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserClock, faCalendar, faTrash, faDownload, faExternalLinkAlt,
  faChevronLeft, faChevronRight, faSearch, faUserMinus,
  faChartLine, faCog, faSave, faEdit, faCheck, faTimes,
  faCoins, faStar, faMoneyBill
} from '@fortawesome/free-solid-svg-icons';
import { StoreContext } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

const API = 'https://srservi2.srautomatic.com';

const TYPE_LABELS = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  INICIO_ALMUERZO: 'Inicio Almuerzo',
  FIN_ALMUERZO: 'Fin Almuerzo',
  INICIO_PAUSA: 'Inicio Pausa',
  FIN_PAUSA: 'Fin Pausa',
};
const TYPE_COLORS = {
  ENTRADA: '#16a34a',
  SALIDA: '#dc2626',
  INICIO_ALMUERZO: '#d97706',
  FIN_ALMUERZO: '#059669',
  INICIO_PAUSA: '#7c3aed',
  FIN_PAUSA: '#4f46e5',
};

const SHIFT_LABELS = { AM: 'Turno AM', PM: 'Turno PM', PART_TIME: 'Part-time' };
const SHIFT_COLORS = { AM: '#2563eb', PM: '#7c3aed', PART_TIME: '#059669' };

function today() {
  return new Date().toISOString().split('T')[0];
}

function fmtCLP(v) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v || 0);
}

export default function AttendanceAdmin() {
  const { selectedStore } = useContext(StoreContext);
  const { token } = useAuth();

  const [records, setRecords] = useState([]);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(today());
  const [tab, setTab] = useState('records');
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const storeCode = selectedStore?.code;

  async function fetchRecords() {
    if (!storeCode || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/attendance/${storeCode}/records?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setRecords(await res.json());
    } finally { setLoading(false); }
  }

  async function fetchPersons() {
    if (!storeCode || !token) return;
    try {
      const res = await fetch(`${API}/api/attendance/${storeCode}/persons/admin`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setPersons(await res.json());
    } catch {}
  }

  useEffect(() => {
    if (tab === 'records') fetchRecords();
    else if (tab === 'persons') fetchPersons();
  }, [storeCode, token, date, tab]);

  function shiftDate(days) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  }

  async function deletePerson(id) {
    setDeletingId(id);
    try {
      await fetch(`${API}/api/attendance/${storeCode}/persons/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setPersons(prev => prev.filter(p => p.id !== id));
    } finally { setDeletingId(null); setConfirmDelete(null); }
  }

  function exportCsv() {
    const headers = ['Nombre', 'Apellido', 'RUT', 'Tipo', 'Hora'];
    const rows = records.map(r => [
      r.name, r.surname, r.rut,
      TYPE_LABELS[r.type] || r.type,
      new Date(r.recorded_at).toLocaleTimeString('es-CL')
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `asistencia_${date}.csv`;
    a.click();
  }

  const filteredRecords = records.filter(r =>
    !search || `${r.name} ${r.surname} ${r.rut}`.toLowerCase().includes(search.toLowerCase())
  );
  const filteredPersons = persons.filter(p =>
    !search || `${p.name} ${p.surname} ${p.rut}`.toLowerCase().includes(search.toLowerCase())
  );

  const TABS = [
    ['records', 'Registros del día'],
    ['persons', 'Empleados'],
    ['sales', 'Ventas & Comisiones'],
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', color: '#09090b' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ width: 44, height: 44, background: '#D4AF37', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FontAwesomeIcon icon={faUserClock} style={{ color: '#000', fontSize: 18 }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#09090b' }}>Control de Asistencia</h1>
          <p style={{ margin: 0, color: '#71717a', fontSize: 13 }}>{selectedStore?.name || 'Sin tienda seleccionada'}</p>
        </div>
        {storeCode && (
          <a
            href={`/attendance/${storeCode}`}
            target="_blank"
            rel="noreferrer"
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: '#D4AF37', color: '#000', fontWeight: 700, fontSize: 13, padding: '9px 16px', borderRadius: 8, textDecoration: 'none' }}
          >
            <FontAwesomeIcon icon={faExternalLinkAlt} />
            Abrir tótem
          </a>
        )}
      </div>

      {!storeCode ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: '#a1a1aa' }}>
          Selecciona una tienda para ver los registros
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid #e4e4e7', paddingBottom: 0 }}>
            {TABS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setTab(key); setSearch(''); }}
                style={{
                  padding: '9px 18px', border: 'none', background: 'none',
                  fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  color: tab === key ? '#D4AF37' : '#71717a',
                  borderBottom: tab === key ? '2px solid #D4AF37' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >{label}</button>
            ))}
          </div>

          {tab === 'sales' ? (
            <SalesPanel storeCode={storeCode} token={token} />
          ) : (
            <>
              {/* Toolbar */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                {tab === 'records' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f4f4f5', borderRadius: 8, padding: '4px 8px', border: '1px solid #e4e4e7' }}>
                    <button onClick={() => shiftDate(-1)} style={{ background: 'none', border: 'none', color: '#09090b', cursor: 'pointer', padding: '4px 8px', fontSize: 13 }}>
                      <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                    <input
                      type="date" value={date}
                      onChange={e => setDate(e.target.value)}
                      style={{ background: 'none', border: 'none', color: '#09090b', fontSize: 14, outline: 'none', cursor: 'pointer' }}
                    />
                    <button onClick={() => shiftDate(1)} style={{ background: 'none', border: 'none', color: '#09090b', cursor: 'pointer', padding: '4px 8px', fontSize: 13 }}>
                      <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                  </div>
                )}
                <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                  <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa', fontSize: 13 }} />
                  <input
                    style={{ width: '100%', padding: '9px 12px 9px 34px', background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: 8, color: '#09090b', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                    placeholder="Buscar por nombre o RUT..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                {tab === 'records' && records.length > 0 && (
                  <button onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: 8, color: '#09090b', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    <FontAwesomeIcon icon={faDownload} /> CSV
                  </button>
                )}
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#a1a1aa' }}>Cargando...</div>
              ) : tab === 'records' ? (
                <RecordsTable records={filteredRecords} date={date} />
              ) : (
                <PersonsTable
                  persons={filteredPersons}
                  confirmDelete={confirmDelete}
                  setConfirmDelete={setConfirmDelete}
                  deletingId={deletingId}
                  onDelete={deletePerson}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Delete modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px', color: '#09090b', fontSize: 18 }}>¿Eliminar empleado?</h3>
            <p style={{ color: '#71717a', fontSize: 14, marginBottom: 20 }}>
              Se eliminará <strong style={{ color: '#09090b' }}>{confirmDelete.name} {confirmDelete.surname}</strong> y todos sus registros.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '11px', background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: 8, color: '#09090b', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                Cancelar
              </button>
              <button onClick={() => deletePerson(confirmDelete.id)} disabled={deletingId === confirmDelete.id} style={{ flex: 1, padding: '11px', background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                {deletingId === confirmDelete.id ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sales Panel ─────────────────────────────────────────────────────────────

function SalesPanel({ storeCode, token }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [sales, setSales] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // {date, shift}
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
        setConfig(data.config);
      }
    } finally { setLoading(false); }
  }, [storeCode, token, year, month]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const todayStr = today();

  // Build calendar days for the month
  const daysInMonth = new Date(year, month, 0).getDate();
  const allDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  });

  // Index sales by date+shift
  const salesMap = {};
  sales.forEach(s => {
    salesMap[`${s.date.split('T')[0]}_${s.shift}`] = s;
  });

  function getSale(date, shift) {
    return salesMap[`${date}_${shift}`] || null;
  }

  // Days that have at least one sale record (working days)
  const workingDays = [...new Set(sales.map(s => s.date.split('T')[0]))];
  const workingDaysPast = workingDays.filter(d => d <= todayStr).length;

  // Totals
  const totalNetSales = sales.reduce((s, r) => s + parseFloat(r.net_sales || 0), 0);
  const totalGrossSales = sales.reduce((s, r) => s + parseFloat(r.gross_sales || 0), 0);
  const avgDailyNet = workingDaysPast > 0 ? totalNetSales / workingDaysPast : 0;

  // Projection: remaining working days estimated as same ratio
  const daysPast = parseInt(todayStr.split('-')[2]);
  const remainingDays = daysInMonth - daysPast;
  const projectedNet = totalNetSales + avgDailyNet * remainingDays;

  const commissionRate = config ? parseFloat(config.commission_rate) : 1;
  const dailyBonus = config ? parseFloat(config.daily_bonus) : 10;
  const successBonus = config ? parseFloat(config.success_bonus) : 10;
  const commissionThreshold = config ? parseFloat(config.commission_threshold) : 0;

  const commissionBase = projectedNet > commissionThreshold ? projectedNet : 0;
  const projectedCommission = commissionBase * (commissionRate / 100);
  const dailyBonusTotal = workingDaysPast * dailyBonus;

  // By shift totals
  const amNet = sales.filter(s => s.shift === 'AM').reduce((a, r) => a + parseFloat(r.net_sales || 0), 0);
  const pmNet = sales.filter(s => s.shift === 'PM').reduce((a, r) => a + parseFloat(r.net_sales || 0), 0);
  const ptNet = sales.filter(s => s.shift === 'PART_TIME').reduce((a, r) => a + parseFloat(r.net_sales || 0), 0);

  function startEdit(date, shift) {
    const s = getSale(date, shift);
    setEditingCell({ date, shift });
    setEditValues({
      gross_sales: s ? s.gross_sales : '',
      net_sales: s ? s.net_sales : '',
      transactions: s ? s.transactions : '',
      notes: s ? (s.notes || '') : '',
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

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="V. Netas del mes" value={fmtCLP(totalNetSales)} icon={faMoneyBill} color="#16a34a" />
        <StatCard label="V. Brutas del mes" value={fmtCLP(totalGrossSales)} icon={faChartLine} color="#2563eb" />
        <StatCard label="Prom. diario neto" value={fmtCLP(avgDailyNet)} icon={faChartLine} color="#7c3aed" />
        <StatCard label="Turno AM (neto)" value={fmtCLP(amNet)} icon={faChartLine} color={SHIFT_COLORS.AM} />
        <StatCard label="Turno PM (neto)" value={fmtCLP(pmNet)} icon={faChartLine} color={SHIFT_COLORS.PM} />
        <StatCard label="Part-time (neto)" value={fmtCLP(ptNet)} icon={faChartLine} color={SHIFT_COLORS.PART_TIME} />
        <StatCard label="Proyección fin de mes" value={fmtCLP(projectedNet)} icon={faChartLine} color="#D4AF37" sub={`${workingDaysPast} días trabajados`} />
        <StatCard label={`Comisión ${commissionRate}% proyectada`} value={fmtCLP(projectedCommission)} icon={faCoins} color="#d97706" sub={commissionThreshold > 0 ? `Activa sobre ${fmtCLP(commissionThreshold)}` : 'Activa desde $0'} />
        <StatCard label="Bono diario acumulado" value={fmtCLP(dailyBonusTotal)} icon={faStar} color="#dc2626" sub={`${workingDaysPast} días × ${fmtCLP(dailyBonus)}`} />
        <StatCard label="Bono éxito (ref.)" value={fmtCLP(successBonus)} icon={faStar} color="#4f46e5" sub="Por operación compra/venta" />
      </div>

      {/* Month nav + config toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f4f4f5', borderRadius: 8, padding: '4px 8px', border: '1px solid #e4e4e7' }}>
          <button onClick={() => shiftMonth(-1)} style={{ background: 'none', border: 'none', color: '#09090b', cursor: 'pointer', padding: '4px 8px' }}>
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <span style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize', minWidth: 140, textAlign: 'center' }}>{monthName}</span>
          <button onClick={() => shiftMonth(1)} style={{ background: 'none', border: 'none', color: '#09090b', cursor: 'pointer', padding: '4px 8px' }}>
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
        <button
          onClick={() => setShowConfig(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: showConfig ? '#09090b' : '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: 8, color: showConfig ? '#fff' : '#09090b', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          <FontAwesomeIcon icon={faCog} /> Configurar
        </button>
      </div>

      {showConfig && config && (
        <ConfigPanel config={config} storeCode={storeCode} token={token} onSaved={fetchSales} />
      )}

      {/* Sales table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#a1a1aa' }}>Cargando...</div>
      ) : (
        <SalesTable
          allDays={allDays}
          todayStr={todayStr}
          getSale={getSale}
          editingCell={editingCell}
          editValues={editValues}
          setEditValues={setEditValues}
          startEdit={startEdit}
          saveCell={saveCell}
          deleteCell={deleteCell}
          saving={saving}
          cancelEdit={() => setEditingCell(null)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color, sub }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 30, height: 30, background: `${color}15`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesomeIcon icon={icon} style={{ color, fontSize: 13 }} />
        </div>
        <span style={{ fontSize: 12, color: '#71717a', fontWeight: 600 }}>{label}</span>
      </div>
      <span style={{ fontSize: 20, fontWeight: 800, color: '#09090b' }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: '#a1a1aa' }}>{sub}</span>}
    </div>
  );
}

function SalesTable({ allDays, todayStr, getSale, editingCell, editValues, setEditValues, startEdit, saveCell, deleteCell, saving, cancelEdit }) {
  const SHIFTS = ['AM', 'PM', 'PART_TIME'];

  const isEditing = (date, shift) => editingCell?.date === date && editingCell?.shift === shift;

  const inputStyle = {
    width: '100%', padding: '4px 6px', border: '1px solid #D4AF37', borderRadius: 4,
    fontSize: 12, background: '#fffbeb', outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, overflow: 'hidden' }}>
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
              const dayTotalNet = SHIFTS.reduce((a, s) => a + parseFloat(getSale(date, s)?.net_sales || 0), 0);

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
                      <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isFuture ? '#a1a1aa' : '#09090b' }}>
                        {new Date(date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </td>

                  {SHIFTS.map((shift, si) => {
                    const sale = getSale(date, shift);
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
                            <div style={{ flex: 1, padding: '8px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                              <span style={{ fontSize: 12, color: '#52525b' }}>{fmtCLP(sale.gross_sales)}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#09090b' }}>{fmtCLP(sale.net_sales)}</span>
                              <span style={{ fontSize: 11, color: '#a1a1aa' }}>{sale.transactions || 0}</span>
                            </div>
                            {!isFuture && (
                              <div style={{ display: 'flex', gap: 2, padding: '0 6px' }}>
                                <button onClick={() => startEdit(date, shift)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', padding: 3, fontSize: 11 }}>
                                  <FontAwesomeIcon icon={faEdit} />
                                </button>
                                <button onClick={() => deleteCell(date, shift)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', padding: 3, fontSize: 11 }}>
                                  <FontAwesomeIcon icon={faTrash} />
                                </button>
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

const thStyle = {
  padding: '10px 12px', textAlign: 'left', color: '#71717a',
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5
};

// ─── Config Panel ─────────────────────────────────────────────────────────────

function ConfigPanel({ config, storeCode, token, onSaved }) {
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
    padding: '8px 12px', border: '1px solid #e4e4e7', borderRadius: 8,
    fontSize: 14, outline: 'none', background: '#f4f4f5', color: '#09090b', width: '100%', boxSizing: 'border-box'
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#09090b' }}>
        <FontAwesomeIcon icon={faCog} style={{ marginRight: 8, color: '#D4AF37' }} />
        Configuración de Comisiones y Bonos
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        <ConfigField label="Comisión del grupo (%)" value={form.commission_rate} onChange={v => setForm(f => ({ ...f, commission_rate: v }))} style={fieldStyle} type="number" step="0.1" min="0" />
        <ConfigField label="Umbral activación comisión ($)" value={form.commission_threshold} onChange={v => setForm(f => ({ ...f, commission_threshold: v }))} style={fieldStyle} type="number" min="0" />
        <ConfigField label="Bono diario por trabajador ($)" value={form.daily_bonus} onChange={v => setForm(f => ({ ...f, daily_bonus: v }))} style={fieldStyle} type="number" min="0" />
        <ConfigField label="Bono éxito compra/venta ($)" value={form.success_bonus} onChange={v => setForm(f => ({ ...f, success_bonus: v }))} style={fieldStyle} type="number" min="0" />
        <ConfigField label="Inicio Turno AM" value={form.am_start?.substring(0,5)} onChange={v => setForm(f => ({ ...f, am_start: v + ':00' }))} style={fieldStyle} type="time" />
        <ConfigField label="Fin Turno AM" value={form.am_end?.substring(0,5)} onChange={v => setForm(f => ({ ...f, am_end: v + ':00' }))} style={fieldStyle} type="time" />
        <ConfigField label="Inicio Turno PM" value={form.pm_start?.substring(0,5)} onChange={v => setForm(f => ({ ...f, pm_start: v + ':00' }))} style={fieldStyle} type="time" />
        <ConfigField label="Fin Turno PM" value={form.pm_end?.substring(0,5)} onChange={v => setForm(f => ({ ...f, pm_end: v + ':00' }))} style={fieldStyle} type="time" />
      </div>
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: saved ? '#16a34a' : '#D4AF37', border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
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

// ─── Records Table ────────────────────────────────────────────────────────────

function RecordsTable({ records, date }) {
  if (records.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', color: '#a1a1aa' }}>
        <FontAwesomeIcon icon={faCalendar} style={{ fontSize: 36, marginBottom: 12, display: 'block' }} />
        No hay registros para el {new Date(date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>
    );
  }
  return (
    <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
          <thead>
            <tr style={{ background: '#f4f4f5', borderBottom: '1px solid #e4e4e7' }}>
              {['Empleado', 'RUT', 'Tipo', 'Hora'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#71717a', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={r.id} style={{ borderTop: i > 0 ? '1px solid #f4f4f5' : 'none' }}>
                <td style={{ padding: '13px 16px', color: '#09090b', fontWeight: 600, fontSize: 14 }}>{r.name} {r.surname}</td>
                <td style={{ padding: '13px 16px', color: '#52525b', fontFamily: 'monospace', fontSize: 13 }}>{r.rut}</td>
                <td style={{ padding: '13px 16px' }}>
                  <span style={{ background: `${TYPE_COLORS[r.type]}15`, color: TYPE_COLORS[r.type], borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                    {TYPE_LABELS[r.type] || r.type}
                  </span>
                </td>
                <td style={{ padding: '13px 16px', color: '#52525b', fontSize: 14, fontFamily: 'monospace' }}>
                  {new Date(r.recorded_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 16px', borderTop: '1px solid #f4f4f5', color: '#a1a1aa', fontSize: 12 }}>
        {records.length} registro{records.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

function PersonsTable({ persons, confirmDelete, setConfirmDelete, deletingId, onDelete }) {
  if (persons.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', color: '#a1a1aa' }}>
        <FontAwesomeIcon icon={faUserMinus} style={{ fontSize: 36, marginBottom: 12, display: 'block' }} />
        No hay empleados registrados
      </div>
    );
  }
  return (
    <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
          <thead>
            <tr style={{ background: '#f4f4f5', borderBottom: '1px solid #e4e4e7' }}>
              {['Foto', 'Nombre', 'RUT', 'Registrado', ''].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#71717a', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {persons.map((p, i) => (
              <tr key={p.id} style={{ borderTop: i > 0 ? '1px solid #f4f4f5' : 'none' }}>
                <td style={{ padding: '10px 16px' }}>
                  {p.face_photo ? (
                    <img src={p.face_photo} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: '2px solid #D4AF37' }} />
                  ) : (
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, border: '1px solid #e4e4e7' }}>👤</div>
                  )}
                </td>
                <td style={{ padding: '10px 16px', color: '#09090b', fontWeight: 600, fontSize: 14 }}>{p.name} {p.surname}</td>
                <td style={{ padding: '10px 16px', color: '#52525b', fontFamily: 'monospace', fontSize: 13 }}>{p.rut}</td>
                <td style={{ padding: '10px 16px', color: '#71717a', fontSize: 13 }}>
                  {new Date(p.created_at).toLocaleDateString('es-CL')}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                  <button
                    onClick={() => setConfirmDelete(p)}
                    disabled={deletingId === p.id}
                    style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', cursor: 'pointer', padding: '6px 12px', fontSize: 12, fontWeight: 600 }}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 16px', borderTop: '1px solid #f4f4f5', color: '#a1a1aa', fontSize: 12 }}>
        {persons.length} empleado{persons.length !== 1 ? 's' : ''} registrado{persons.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
