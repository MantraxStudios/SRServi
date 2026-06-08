import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine, faPlus, faTrash, faArrowUp, faArrowDown, faMoneyBillWave } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

const CATEGORIES = ['Proveedores', 'Sueldos', 'Alquiler', 'Servicios', 'Impuestos', 'Mantenimiento', 'Marketing', 'Otros'];

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

function IncomeStatement() {
  const { selectedStore, colors } = useStore();
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ amount: '', category: 'Proveedores', description: '', expense_date: today() });
  const [saving, setSaving] = useState(false);

  const currency = colors?.currency?.symbol || '$';
  const fmt = (n) => `${currency}${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  useEffect(() => {
    if (selectedStore) fetchData();
    else { setData(null); setLoading(false); }
  }, [selectedStore, from, to]);

  const fetchData = async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/income-statement?store_id=${selectedStore.id}&from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await res.json();
      setData(d);
    } catch (err) {
      setError('Error al cargar el estado de resultados');
    } finally {
      setLoading(false);
    }
  };

  const addExpense = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStore.id, ...form })
      });
      if (!res.ok) throw new Error('Error al guardar el gasto');
      setShowModal(false);
      setForm({ amount: '', category: 'Proveedores', description: '', expense_date: today() });
      fetchData();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const deleteExpense = async (id) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/expenses/${id}?store_id=${selectedStore.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) { alert(err.message); }
  };

  if (!selectedStore) {
    return <div className="admin-main"><div className="empty-state"><p className="empty-state-text">Seleccioná una tienda.</p></div></div>;
  }

  const neto = data ? data.resultado_neto : 0;
  const netoPositive = neto >= 0;

  const cardStyle = { background: '#fff', border: '1px solid #ebebeb', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' };

  return (
    <>
      <header className="admin-header">
        <h1 style={{ margin: 0 }}><FontAwesomeIcon icon={faChartLine} style={{ marginRight: 10 }} />Estado de Resultados</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FontAwesomeIcon icon={faPlus} /> Registrar gasto
        </button>
      </header>

      <div className="admin-main" style={{ maxWidth: 900 }}>
        {error && <div className="error">{error}</div>}

        {/* Filtro de fechas */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>Desde</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '8px 10px', border: '1.5px solid #e2e2e2', borderRadius: 8 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>Hasta</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '8px 10px', border: '1.5px solid #e2e2e2', borderRadius: 8 }} />
          </div>
        </div>

        {loading || !data ? (
          <div className="loading">Cargando...</div>
        ) : (
          <>
            {/* Resumen */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
              <div style={{ ...cardStyle, borderLeft: '4px solid #16a34a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontWeight: 700, fontSize: 13 }}>
                  <FontAwesomeIcon icon={faArrowUp} /> INGRESOS
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{fmt(data.total_ingresos)}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{data.total_pedidos} pedidos</div>
              </div>
              <div style={{ ...cardStyle, borderLeft: '4px solid #dc2626' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', fontWeight: 700, fontSize: 13 }}>
                  <FontAwesomeIcon icon={faArrowDown} /> EGRESOS
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{fmt(data.total_egresos)}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{data.expenses.length} gastos</div>
              </div>
              <div style={{ ...cardStyle, borderLeft: `4px solid ${netoPositive ? '#D4AF37' : '#dc2626'}`, background: netoPositive ? '#fffdf5' : '#fff7f7' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: netoPositive ? '#92760a' : '#dc2626', fontWeight: 700, fontSize: 13 }}>
                  <FontAwesomeIcon icon={faMoneyBillWave} /> RESULTADO NETO
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: netoPositive ? '#92760a' : '#dc2626' }}>{fmt(neto)}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{netoPositive ? 'Ganancia' : 'Pérdida'} del período</div>
              </div>
            </div>

            {/* Detalle ingresos */}
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Ingresos por método de pago</h3>
              <Row label="💵 Efectivo" value={fmt(data.ingresos_efectivo)} />
              <Row label="💳 Tarjeta / otros" value={fmt(data.ingresos_tarjeta)} />
              <Row label="Total ingresos" value={fmt(data.total_ingresos)} bold />
            </div>

            {/* Detalle egresos */}
            <div style={{ ...cardStyle }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Gastos por categoría</h3>
              {data.egresos_por_categoria.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>No hay gastos en este período. Registrá uno con "Registrar gasto".</p>
              ) : (
                data.egresos_por_categoria.map(c => <Row key={c.category} label={c.category} value={fmt(c.amount)} />)
              )}

              {data.expenses.length > 0 && (
                <table className="table" style={{ marginTop: 14 }}>
                  <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Monto</th><th></th></tr></thead>
                  <tbody>
                    {data.expenses.map(e => (
                      <tr key={e.id}>
                        <td>{e.expense_date}</td>
                        <td>{e.category}</td>
                        <td>{e.description || '-'}</td>
                        <td>{fmt(e.amount)}</td>
                        <td>
                          <button className="btn btn-sm btn-danger" onClick={() => deleteExpense(e.id)}>
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Registrar gasto</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={addExpense}>
              <div className="form-group">
                <label>Monto</label>
                <input type="number" step="0.01" min="0" value={form.amount} required placeholder="0.00"
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Categoría</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Fecha</label>
                <input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Descripción (opcional)</label>
                <input type="text" value={form.description} placeholder="Ej: Compra de insumos"
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar gasto'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #f3f3f3', fontWeight: bold ? 800 : 500, fontSize: bold ? 15 : 14 }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default IncomeStatement;
