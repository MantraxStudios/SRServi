import { useState, useEffect, useContext, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserClock, faCalendar, faTrash, faDownload, faExternalLinkAlt,
  faChevronLeft, faChevronRight, faSearch, faUserMinus,
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
