import { useState, useEffect, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCashRegister,
  faCalendarAlt,
  faSearch,
  faUser,
  faClock,
} from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

function CashRegisters() {
  const { token } = useAuth();
  const { selectedStore } = useContext(StoreContext);

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const currSym = '$';
  const fmtTime = d => d ? new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const closedByLabel = v => ({ manual: 'Trabajador', admin: 'Administrador', auto: 'Automático' })[v] || v || '—';

  const duration = (opened, closed) => {
    if (!opened || !closed) return '—';
    const mins = Math.round((new Date(closed) - new Date(opened)) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const fetchHistory = async () => {
    if (!selectedStore?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/cash-register/history?store_id=${selectedStore.id}&date_from=${dateFrom}&date_to=${dateTo}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
      setSearched(true);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStore?.id) fetchHistory();
  }, [selectedStore?.id]);

  const totalVendido = history.reduce((s, r) => s + Number(r.total_vendido || 0), 0);
  const totalApertura = history.reduce((s, r) => s + Number(r.opening_amount || 0), 0);
  const totalEfectivo = history.reduce((s, r) => s + Number(r.total_efectivo || 0), 0);
  const totalAlCierre = history.reduce((s, r) => s + Number(r.opening_amount || 0) + Number(r.total_efectivo || 0), 0);

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <FontAwesomeIcon icon={faCashRegister} style={{ color: '#D4AF37', fontSize: 22 }} />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff' }}>Historial de Caja</h1>
      </div>

      {/* Filtros */}
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: '20px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: '#888', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: 6 }} />Desde
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff', padding: '8px 12px', fontSize: 14 }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: '#888', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: 6 }} />Hasta
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff', padding: '8px 12px', fontSize: 14 }}
          />
        </div>
        <button
          onClick={fetchHistory}
          disabled={loading || !selectedStore?.id}
          style={{ background: '#D4AF37', color: '#000', fontWeight: 800, border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}
        >
          <FontAwesomeIcon icon={faSearch} />
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {/* Totales */}
      {searched && history.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ color: '#888', fontSize: 11, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Cajas en período</p>
            <p style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: 0 }}>{history.length}</p>
          </div>
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ color: '#888', fontSize: 11, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Total apertura</p>
            <p style={{ color: '#D4AF37', fontSize: 26, fontWeight: 900, margin: 0 }}>{currSym}{totalApertura.toFixed(2)}</p>
          </div>
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ color: '#888', fontSize: 11, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Total vendido</p>
            <p style={{ color: '#22c55e', fontSize: 26, fontWeight: 900, margin: 0 }}>{currSym}{totalVendido.toFixed(2)}</p>
          </div>
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ color: '#888', fontSize: 11, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Total efectivo</p>
            <p style={{ color: '#3b82f6', fontSize: 26, fontWeight: 900, margin: 0 }}>{currSym}{totalEfectivo.toFixed(2)}</p>
          </div>
          <div style={{ background: '#111', border: '2px solid #D4AF37', borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ color: '#D4AF37', fontSize: 11, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Total al cierre</p>
            <p style={{ color: '#D4AF37', fontSize: 26, fontWeight: 900, margin: 0 }}>{currSym}{totalAlCierre.toFixed(2)}</p>
            <p style={{ color: '#888', fontSize: 10, margin: '4px 0 0' }}>Apertura + efectivo cobrado</p>
          </div>
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: '16px 20px' }}>
            <p style={{ color: '#888', fontSize: 11, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Total pedidos</p>
            <p style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: 0 }}>{history.reduce((s, r) => s + Number(r.total_pedidos || 0), 0)}</p>
          </div>
        </div>
      )}

      {/* Tabla */}
      {!selectedStore?.id ? (
        <p style={{ color: '#666', textAlign: 'center', marginTop: 40 }}>Seleccioná una tienda para ver el historial.</p>
      ) : loading ? (
        <p style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>Cargando...</p>
      ) : searched && history.length === 0 ? (
        <p style={{ color: '#666', textAlign: 'center', marginTop: 40 }}>No hay registros para el período seleccionado.</p>
      ) : history.length > 0 ? (
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #222' }}>
                {['Fecha', 'Trabajador', 'Apertura', 'Cierre', 'Duración', 'Monto apertura', 'Total vendido', 'Efectivo', 'Total al cierre', 'Diferencia', 'Pedidos', 'Cerrado por'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((r, i) => {
                const vendido = Number(r.total_vendido || 0);
                const apertura = Number(r.opening_amount || 0);
                const efectivo = Number(r.total_efectivo || 0);
                const alCierre = apertura + efectivo;
                const diff = alCierre - apertura;
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #1a1a1a', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '12px 14px', color: '#ccc', whiteSpace: 'nowrap' }}>{fmtDate(r.opened_at)}</td>
                    <td style={{ padding: '12px 14px', color: '#fff', fontWeight: 600 }}>
                      <FontAwesomeIcon icon={faUser} style={{ marginRight: 6, color: '#D4AF37', fontSize: 11 }} />
                      {r.worker_name || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#ccc', whiteSpace: 'nowrap' }}>
                      <FontAwesomeIcon icon={faClock} style={{ marginRight: 5, color: '#22c55e', fontSize: 11 }} />
                      {fmtTime(r.opened_at)}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#ccc', whiteSpace: 'nowrap' }}>
                      <FontAwesomeIcon icon={faClock} style={{ marginRight: 5, color: '#ef4444', fontSize: 11 }} />
                      {fmtTime(r.closed_at)}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#888' }}>{duration(r.opened_at, r.closed_at)}</td>
                    <td style={{ padding: '12px 14px', color: '#D4AF37', fontWeight: 700 }}>{currSym}{apertura.toFixed(2)}</td>
                    <td style={{ padding: '12px 14px', color: '#22c55e', fontWeight: 700 }}>{currSym}{vendido.toFixed(2)}</td>
                    <td style={{ padding: '12px 14px', color: '#3b82f6', fontWeight: 700 }}>{currSym}{efectivo.toFixed(2)}</td>
                    <td style={{ padding: '12px 14px', color: '#D4AF37', fontWeight: 800, background: 'rgba(212,175,55,0.07)', whiteSpace: 'nowrap' }}>
                      {currSym}{alCierre.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: diff >= 0 ? '#22c55e' : '#ef4444' }}>
                      {diff >= 0 ? '+' : ''}{currSym}{diff.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#ccc', textAlign: 'center' }}>{r.total_pedidos}</td>
                    <td style={{ padding: '12px 14px', color: '#888', fontSize: 12 }}>{closedByLabel(r.closed_by)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default CashRegisters;
