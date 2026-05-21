import { useState, useEffect, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserClock, faCalendar, faTrash, faDownload, faExternalLinkAlt,
  faChevronLeft, faChevronRight, faSearch, faUserMinus
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
  ENTRADA: '#22c55e',
  SALIDA: '#ef4444',
  INICIO_ALMUERZO: '#f59e0b',
  FIN_ALMUERZO: '#10b981',
  INICIO_PAUSA: '#8b5cf6',
  FIN_PAUSA: '#6366f1',
};

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function AttendanceAdmin() {
  const { selectedStore } = useContext(StoreContext);
  const { token } = useAuth();

  const [records, setRecords] = useState([]);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(today());
  const [tab, setTab] = useState('records'); // 'records' | 'persons'
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
    } finally {
      setLoading(false);
    }
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
    else fetchPersons();
  }, [storeCode, token, date, tab]);

  function shiftDate(days) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  }

  async function deletePerson(id) {
    if (!storeCode || !token) return;
    setDeletingId(id);
    try {
      await fetch(`${API}/api/attendance/${storeCode}/persons/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setPersons(prev => prev.filter(p => p.id !== id));
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  }

  function exportCsv() {
    const headers = ['Nombre', 'Apellido', 'RUT', 'Tipo', 'Hora'];
    const rows = records.map(r => [
      r.name, r.surname, r.rut,
      TYPE_LABELS[r.type] || r.type,
      new Date(r.recorded_at).toLocaleTimeString('es-CL')
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `asistencia_${date}.csv`;
    a.click();
  }

  const filteredRecords = records.filter(r =>
    !search || `${r.name} ${r.surname} ${r.rut}`.toLowerCase().includes(search.toLowerCase())
  );
  const filteredPersons = persons.filter(p =>
    !search || `${p.name} ${p.surname} ${p.rut}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, background: '#D4AF37', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesomeIcon icon={faUserClock} style={{ color: '#080808', fontSize: 18 }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Control de Asistencia</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            {selectedStore?.name || 'Sin tienda seleccionada'}
          </p>
        </div>
        {storeCode && (
          <a
            href={`/attendance/${storeCode}`}
            target="_blank"
            rel="noreferrer"
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: '#D4AF37', color: '#080808', fontWeight: 700, fontSize: 13, padding: '8px 16px', borderRadius: 8, textDecoration: 'none' }}
          >
            <FontAwesomeIcon icon={faExternalLinkAlt} />
            Abrir tótem
          </a>
        )}
      </div>

      {!storeCode ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.3)' }}>
          Selecciona una tienda para ver los registros
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[['records', 'Registros del día'], ['persons', 'Empleados registrados']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setTab(key); setSearch(''); }}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  background: tab === key ? '#D4AF37' : 'rgba(255,255,255,0.06)',
                  color: tab === key ? '#080808' : 'rgba(255,255,255,0.6)',
                }}
              >{label}</button>
            ))}
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {tab === 'records' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '4px 8px' }}>
                <button onClick={() => shiftDate(-1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px 6px' }}>
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  style={{ background: 'none', border: 'none', color: '#fff', fontSize: 14, outline: 'none', cursor: 'pointer' }}
                />
                <button onClick={() => shiftDate(1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px 6px' }}>
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            )}
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: 13 }} />
              <input
                style={{ width: '100%', padding: '9px 12px 9px 34px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                placeholder="Buscar por nombre o RUT..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {tab === 'records' && records.length > 0 && (
              <button onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <FontAwesomeIcon icon={faDownload} /> Exportar CSV
              </button>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'rgba(255,255,255,0.3)' }}>Cargando...</div>
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

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a1a1a', borderRadius: 14, padding: 28, maxWidth: 360, width: '90%', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px', color: '#fff' }}>¿Eliminar empleado?</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 20 }}>
              Se eliminará <strong style={{ color: '#fff' }}>{confirmDelete.name} {confirmDelete.surname}</strong> y todos sus registros de asistencia.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={() => deletePerson(confirmDelete.id)} disabled={deletingId === confirmDelete.id} style={{ flex: 1, padding: '11px', background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                {deletingId === confirmDelete.id ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecordsTable({ records, date }) {
  if (records.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.3)' }}>
        <FontAwesomeIcon icon={faCalendar} style={{ fontSize: 40, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
        No hay registros para el {new Date(date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>
    );
  }
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
            {['Empleado', 'RUT', 'Tipo', 'Hora'].map(h => (
              <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
              <td style={{ padding: '13px 16px', color: '#fff', fontWeight: 600 }}>{r.name} {r.surname}</td>
              <td style={{ padding: '13px 16px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', fontSize: 13 }}>{r.rut}</td>
              <td style={{ padding: '13px 16px' }}>
                <span style={{ background: `${TYPE_COLORS[r.type]}20`, color: TYPE_COLORS[r.type], borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                  {TYPE_LABELS[r.type] || r.type}
                </span>
              </td>
              <td style={{ padding: '13px 16px', color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: 'monospace' }}>
                {new Date(r.recorded_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
        {records.length} registro{records.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

function PersonsTable({ persons, confirmDelete, setConfirmDelete, deletingId, onDelete }) {
  if (persons.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.3)' }}>
        <FontAwesomeIcon icon={faUserMinus} style={{ fontSize: 40, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
        No hay empleados registrados
      </div>
    );
  }
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
            {['Foto', 'Nombre', 'RUT', 'Registrado', ''].map(h => (
              <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {persons.map((p, i) => (
            <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
              <td style={{ padding: '10px 16px' }}>
                {p.face_photo ? (
                  <img src={p.face_photo} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(212,175,55,0.4)' }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👤</div>
                )}
              </td>
              <td style={{ padding: '10px 16px', color: '#fff', fontWeight: 600 }}>{p.name} {p.surname}</td>
              <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', fontSize: 13 }}>{p.rut}</td>
              <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                {new Date(p.created_at).toLocaleDateString('es-CL')}
              </td>
              <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                <button
                  onClick={() => setConfirmDelete(p)}
                  disabled={deletingId === p.id}
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#ef4444', cursor: 'pointer', padding: '6px 12px', fontSize: 12, fontWeight: 600 }}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
        {persons.length} empleado{persons.length !== 1 ? 's' : ''} registrado{persons.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
