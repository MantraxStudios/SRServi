import { useState, useEffect, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTrash, faPencilAlt, faCheck, faClock, faUser,
  faExclamationTriangle, faClipboardList, faTimes, faCopy, faClone,
  faChartBar, faChevronLeft, faChevronRight
} from '@fortawesome/free-solid-svg-icons';
import { StoreContext } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

const API = 'https://srservi2.srautomatic.com';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function formatWeekRange(weekStartStr) {
  const start = new Date(weekStartStr + 'T12:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = d => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const yearSuffix = end.getFullYear() !== new Date().getFullYear() ? ` ${end.getFullYear()}` : '';
  return `${fmt(start)} – ${fmt(end)}${yearSuffix}`;
}

function getWeekStart() {
  const now = new Date();
  const d = new Date(now);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function getTaskStatus(task) {
  if (task.completed_at) return 'completed';
  const now = new Date();
  const todayDow = now.getDay();
  const weekStart = getWeekStart();
  const taskDate = new Date(weekStart);
  taskDate.setDate(taskDate.getDate() + task.day_of_week);
  if (todayDow < task.day_of_week) return 'upcoming';
  if (todayDow === task.day_of_week) {
    const [h, m] = task.due_time.split(':').map(Number);
    const due = new Date(); due.setHours(h, m, 0, 0);
    const expire = new Date(due.getTime() + 3600000);
    if (now < due) return 'upcoming';
    if (now <= expire) return 'active';
    return 'expired';
  }
  return 'expired';
}

function StatusBadge({ task }) {
  const status = getTaskStatus(task);
  const cfg = {
    completed: { label: 'Completada', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', icon: faCheck },
    active:    { label: 'En plazo',   color: '#92400e', bg: '#fffbeb', border: '#fcd34d', icon: faClock },
    upcoming:  { label: 'Pendiente',  color: '#374151', bg: '#f3f4f6', border: '#d1d5db', icon: null },
    expired:   { label: 'Expirada',   color: '#991b1b', bg: '#fef2f2', border: '#fca5a5', icon: faExclamationTriangle },
  }[status];
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px',
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', letterSpacing: '0.02em'
    }}>
      {cfg.icon && <FontAwesomeIcon icon={cfg.icon} style={{ fontSize: 9 }} />}
      {cfg.label}
    </span>
  );
}

const emptyForm = { worker_id: '', name: '', description: '', day_of_week: '1', due_time: '09:00' };

export default function Tasks() {
  const { selectedStore } = useContext(StoreContext);
  const { token } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [filterWorker, setFilterWorker] = useState('all');
  const [dupAllModal, setDupAllModal] = useState(null);
  const [dupAllTarget, setDupAllTarget] = useState('');
  const [dupAllSaving, setDupAllSaving] = useState(false);
  const [historyModal, setHistoryModal] = useState(null); // { workerId, workerName, initials }
  const [historyData, setHistoryData] = useState(null);  // { tasks, weeks }
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyWeekIdx, setHistoryWeekIdx] = useState(0);
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (selectedStore) {
      fetchTasks();
      fetchWorkers();
    } else {
      setTasks([]); setWorkers([]); setLoading(false);
    }
  }, [selectedStore]);

  const fetchTasks = async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks?store_id=${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkers = async () => {
    if (!selectedStore) return;
    try {
      const res = await fetch(`/api/workers?store_id=${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setWorkers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };

  const openCreate = () => {
    setEditingTask(null);
    setIsDuplicating(false);
    setForm({ ...emptyForm, worker_id: workers[0]?.id?.toString() || '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setIsDuplicating(false);
    setForm({
      worker_id: task.worker_id.toString(),
      name: task.name,
      description: task.description || '',
      day_of_week: task.day_of_week.toString(),
      due_time: task.due_time,
    });
    setError('');
    setShowModal(true);
  };

  const openDuplicate = (task) => {
    setEditingTask(null);
    setIsDuplicating(true);
    setForm({
      worker_id: workers[0]?.id?.toString() || '',
      name: task.name,
      description: task.description || '',
      day_of_week: task.day_of_week.toString(),
      due_time: task.due_time,
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const body = {
        store_id: selectedStore.id,
        worker_id: parseInt(form.worker_id),
        name: form.name.trim(),
        description: form.description.trim() || null,
        day_of_week: parseInt(form.day_of_week),
        due_time: form.due_time,
      };
      const url = editingTask ? `${API}/api/tasks/${editingTask.id}` : `${API}/api/tasks`;
      const method = editingTask ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      setShowModal(false);
      fetchTasks();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (taskId) => {
    if (!confirm('¿Eliminar esta tarea? Se borrarán también sus registros de completado.')) return;
    try {
      await fetch(`${API}/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      fetchTasks();
    } catch (e) {
      console.error(e);
    }
  };

  const openHistory = async (workerId, workerName, initials) => {
    setHistoryModal({ workerId, workerName, initials });
    setHistoryData(null);
    setHistoryWeekIdx(0);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API}/api/tasks/worker-history?store_id=${selectedStore.id}&worker_id=${workerId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar historial');
      setHistoryData(data);
    } catch (e) {
      console.error(e);
      setHistoryData({ tasks: [], weeks: [] });
    } finally {
      setHistoryLoading(false);
    }
  };

  const openDupAll = (workerId, workerName) => {
    const others = workers.filter(w => w.id !== workerId);
    setDupAllModal({ sourceWorkerId: workerId, sourceName: workerName });
    setDupAllTarget(others[0]?.id?.toString() || '');
    setDupAllSaving(false);
  };

  const handleDupAll = async () => {
    if (!dupAllTarget || !dupAllModal) return;
    setDupAllSaving(true);
    try {
      const res = await fetch(`${API}/api/tasks/duplicate-worker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          store_id: selectedStore.id,
          source_worker_id: dupAllModal.sourceWorkerId,
          target_worker_id: parseInt(dupAllTarget),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al duplicar');
      setDupAllModal(null);
      fetchTasks();
    } catch (err) {
      alert(err.message);
    } finally {
      setDupAllSaving(false);
    }
  };

  const displayedTasks = filterWorker === 'all'
    ? tasks
    : tasks.filter(t => t.worker_id === parseInt(filterWorker));

  const grouped = displayedTasks.reduce((acc, t) => {
    if (!acc[t.worker_id]) acc[t.worker_id] = { name: t.worker_name, tasks: [] };
    acc[t.worker_id].tasks.push(t);
    return acc;
  }, {});

  if (!selectedStore) {
    return (
      <div className="empty-state">
        <p className="empty-state-text">Selecciona una tienda para gestionar las tareas</p>
      </div>
    );
  }

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Tareas Semanales</h1>
          <p className="text-sm text-muted">
            Asigna y controla tareas semanales de {selectedStore.name}.
            Se reinician cada domingo a medianoche.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} disabled={workers.length === 0}>
          <FontAwesomeIcon icon={faPlus} />
          Nueva Tarea
        </button>
      </header>

      <div className="admin-main">
        {/* Worker filter */}
        {workers.length > 1 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <button
              onClick={() => setFilterWorker('all')}
              style={{
                padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                border: filterWorker === 'all' ? '2px solid #D4AF37' : '2px solid transparent',
                background: filterWorker === 'all' ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.05)',
                color: filterWorker === 'all' ? '#D4AF37' : '#aaa', cursor: 'pointer'
              }}
            >
              Todos
            </button>
            {workers.map(w => (
              <button
                key={w.id}
                onClick={() => setFilterWorker(w.id.toString())}
                style={{
                  padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                  border: filterWorker === w.id.toString() ? '2px solid #D4AF37' : '2px solid transparent',
                  background: filterWorker === w.id.toString() ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.05)',
                  color: filterWorker === w.id.toString() ? '#D4AF37' : '#aaa', cursor: 'pointer'
                }}
              >
                {w.name}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="loading">Cargando tareas...</div>
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <FontAwesomeIcon icon={faClipboardList} className="empty-state-icon" />
            <h3 className="empty-state-title">Sin tareas asignadas</h3>
            <p className="empty-state-text">
              {workers.length === 0
                ? 'Primero agrega trabajadores en la sección Vendedores'
                : 'Crea la primera tarea para tus trabajadores'}
            </p>
            {workers.length > 0 && (
              <button className="btn btn-primary" onClick={openCreate} style={{ marginTop: '16px' }}>
                <FontAwesomeIcon icon={faPlus} /> Nueva Tarea
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
            gap: '22px',
            alignItems: 'start'
          }}>
            {Object.entries(grouped).map(([wid, group]) => {
              const worker = workers.find(w => w.id === parseInt(wid));
              const initials = group.name.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();
              const completedCount = group.tasks.filter(t => getTaskStatus(t) === 'completed').length;
              return (
                <div key={wid} style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '18px',
                  overflow: 'hidden',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                }}>

                  {/* ── Worker header ── */}
                  <div style={{
                    padding: '18px 18px 14px',
                    background: 'linear-gradient(135deg, #fffbeb 0%, #fff 70%)',
                    borderBottom: '1px solid #f0e6b0',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>

                      {/* Avatar iniciales */}
                      <div style={{
                        width: 48, height: 48, borderRadius: 13, flexShrink: 0,
                        background: 'linear-gradient(135deg, #D4AF37 0%, #a07c20 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 900, color: '#000',
                        boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
                        letterSpacing: '-0.5px'
                      }}>
                        {initials}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#111', lineHeight: 1.2, marginBottom: 2 }}>
                          {group.name}
                        </div>
                        {worker?.username && (
                          <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', marginBottom: 8 }}>
                            {worker.username}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                            background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb'
                          }}>
                            {group.tasks.length} tarea{group.tasks.length !== 1 ? 's' : ''}
                          </span>
                          {completedCount > 0 && (
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                              background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0'
                            }}>
                              {completedCount} completada{completedCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Botones: historial + duplicar */}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => openHistory(parseInt(wid), group.name, initials)}
                          title="Ver historial de tareas"
                          style={{
                            width: 34, height: 34, borderRadius: 9,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: '#f3f4f6', border: '1px solid #e5e7eb',
                            color: '#6b7280', cursor: 'pointer', fontSize: 13
                          }}
                        >
                          <FontAwesomeIcon icon={faChartBar} />
                        </button>
                        {workers.length > 1 && (
                          <button
                            onClick={() => openDupAll(parseInt(wid), group.name)}
                            title="Duplicar todas las tareas"
                            style={{
                              width: 34, height: 34, borderRadius: 9,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: '#fffbeb', border: '1px solid #fcd34d',
                              color: '#92400e', cursor: 'pointer', fontSize: 13
                            }}
                          >
                            <FontAwesomeIcon icon={faClone} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Task list ── */}
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {group.tasks.map(task => {
                      const status = getTaskStatus(task);
                      const accent = { completed: '#16a34a', active: '#d97706', upcoming: '#d1d5db', expired: '#ef4444' }[status];
                      const taskBg = { completed: '#f9fefb', active: '#fffcf5', upcoming: '#fafafa', expired: '#fff9f9' }[status];
                      return (
                        <div key={task.id} style={{
                          background: taskBg,
                          border: '1px solid #e5e7eb',
                          borderLeft: `3px solid ${accent}`,
                          borderRadius: '11px',
                          padding: '11px 12px',
                          display: 'flex', gap: 10, alignItems: 'flex-start',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#111', marginBottom: 3, lineHeight: 1.3 }}>
                              {task.name}
                            </div>
                            {task.description && (
                              <p style={{ margin: '0 0 5px', fontSize: 11, color: '#6b7280', lineHeight: 1.45 }}>
                                {task.description}
                              </p>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <FontAwesomeIcon icon={faClock} style={{ color: '#D4AF37', fontSize: 9 }} />
                                {DAYS[task.day_of_week]} · {task.due_time}
                              </span>
                              <StatusBadge task={task} />
                            </div>
                            {task.completed_at && (
                              <div style={{ marginTop: 5, fontSize: 11, color: '#15803d', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <FontAwesomeIcon icon={faCheck} style={{ fontSize: 9 }} />
                                {new Date(task.completed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                {task.completed_by_name && <span style={{ color: '#9ca3af' }}> · {task.completed_by_name}</span>}
                              </div>
                            )}
                          </div>

                          {/* Acciones */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                            <button onClick={() => openDuplicate(task)} title="Duplicar"
                              style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', color: '#9ca3af', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FontAwesomeIcon icon={faCopy} />
                            </button>
                            <button onClick={() => openEdit(task)} title="Editar"
                              style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FontAwesomeIcon icon={faPencilAlt} />
                            </button>
                            <button onClick={() => handleDelete(task.id)} title="Eliminar"
                              style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #fca5a5', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {historyModal && (
        <div className="modal-overlay" onClick={() => setHistoryModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540, width: '100%' }}>

            {/* Header */}
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: 'linear-gradient(135deg, #D4AF37, #8B6914)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 900, color: '#000'
                }}>
                  {historyModal.initials}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{historyModal.workerName}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>Historial de tareas</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setHistoryModal(null)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            {historyLoading ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#555' }}>Cargando historial...</div>
            ) : !historyData?.weeks?.length ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#555' }}>
                <FontAwesomeIcon icon={faChartBar} style={{ fontSize: 28, marginBottom: 10, display: 'block' }} />
                Sin registros de historial aún
              </div>
            ) : (() => {
              const week = historyData.weeks[historyWeekIdx];
              const completedCount = Object.keys(week.completions).length;
              const totalCount = historyData.tasks.length;
              const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
              const isCurrentWeek = historyWeekIdx === 0;

              return (
                <>
                  {/* Week navigator */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 0 10px', borderBottom: '1px solid rgba(255,255,255,0.06)'
                  }}>
                    <button
                      onClick={() => setHistoryWeekIdx(i => Math.min(i + 1, historyData.weeks.length - 1))}
                      disabled={historyWeekIdx >= historyData.weeks.length - 1}
                      style={{
                        width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: 'rgba(255,255,255,0.05)', color: historyWeekIdx >= historyData.weeks.length - 1 ? '#333' : '#aaa',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}
                    >
                      <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
                    </button>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
                        {formatWeekRange(week.week_start)}
                      </div>
                      {isCurrentWeek && (
                        <div style={{ fontSize: 10, color: '#D4AF37', fontWeight: 600, marginTop: 2, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                          Semana actual
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setHistoryWeekIdx(i => Math.max(i - 1, 0))}
                      disabled={historyWeekIdx === 0}
                      style={{
                        width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: 'rgba(255,255,255,0.05)', color: historyWeekIdx === 0 ? '#333' : '#aaa',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}
                    >
                      <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 11 }} />
                    </button>
                  </div>

                  {/* Progress summary */}
                  <div style={{
                    padding: '16px 0 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: 16
                  }}>
                    {/* Big number */}
                    <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 70 }}>
                      <div style={{ fontSize: 36, fontWeight: 900, color: pct === 100 ? '#15803d' : pct > 0 ? '#d97706' : '#9ca3af', lineHeight: 1 }}>
                        {pct}<span style={{ fontSize: 16, fontWeight: 600 }}>%</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
                        {completedCount}/{totalCount} tareas
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 8, background: '#f3f4f6', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 8,
                          width: `${pct}%`,
                          background: pct === 100
                            ? 'linear-gradient(90deg, #16a34a, #4ade80)'
                            : pct > 0
                            ? 'linear-gradient(90deg, #92400e, #fbbf24)'
                            : 'transparent',
                          transition: 'width 0.4s ease'
                        }} />
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                        {pct === 100 ? '¡Todas completadas!' : pct === 0 ? 'Sin completar esta semana' : `${totalCount - completedCount} pendiente${totalCount - completedCount !== 1 ? 's' : ''}`}
                      </div>
                    </div>
                  </div>

                  {/* Task list */}
                  <div style={{ maxHeight: 340, overflowY: 'auto', padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {historyData.tasks.map(task => {
                      const comp = week.completions[task.id];
                      return (
                        <div key={task.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 14px', borderRadius: 12,
                          background: comp ? '#f9fefb' : '#fafafa',
                          border: `1px solid ${comp ? '#bbf7d0' : '#e5e7eb'}`,
                          borderLeft: `3px solid ${comp ? '#16a34a' : '#d1d5db'}`
                        }}>
                          {/* Check / X */}
                          <div style={{
                            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: comp ? '#f0fdf4' : '#f3f4f6',
                            color: comp ? '#15803d' : '#9ca3af', fontSize: 12
                          }}>
                            <FontAwesomeIcon icon={comp ? faCheck : faTimes} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: comp ? '#111' : '#6b7280' }}>
                              {task.name}
                            </div>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <span>{DAYS[task.day_of_week]} · {task.due_time}</span>
                              {comp && (
                                <span style={{ color: '#15803d' }}>
                                  completada {new Date(comp.completed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                  {comp.completed_by_name && ` · ${comp.completed_by_name}`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Week dots navigator */}
                  {historyData.weeks.length > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingTop: 14 }}>
                      {historyData.weeks.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setHistoryWeekIdx(i)}
                          style={{
                            width: i === historyWeekIdx ? 20 : 8,
                            height: 8, borderRadius: 4, border: 'none', cursor: 'pointer',
                            background: i === historyWeekIdx ? '#D4AF37' : 'rgba(255,255,255,0.1)',
                            transition: 'all 0.2s ease', padding: 0
                          }}
                        />
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {dupAllModal && (
        <div className="modal-overlay" onClick={() => !dupAllSaving && setDupAllModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Duplicar todas las tareas</h2>
              <button className="modal-close" onClick={() => !dupAllSaving && setDupAllModal(null)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <p style={{ fontSize: 14, color: '#aaa', marginBottom: 16 }}>
              Se copiarán todas las tareas de <strong style={{ color: '#fff' }}>{dupAllModal.sourceName}</strong> al trabajador seleccionado.
            </p>
            <div className="form-group">
              <label>Trabajador destino</label>
              <select value={dupAllTarget} onChange={e => setDupAllTarget(e.target.value)}>
                {workers.filter(w => w.id !== dupAllModal.sourceWorkerId).map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.username})</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3" style={{ marginTop: 8 }}>
              <button
                className="btn btn-secondary flex-1"
                onClick={() => setDupAllModal(null)}
                disabled={dupAllSaving}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary flex-1"
                onClick={handleDupAll}
                disabled={dupAllSaving || !dupAllTarget}
              >
                {dupAllSaving ? 'Duplicando...' : 'Duplicar tareas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingTask ? 'Editar Tarea' : isDuplicating ? 'Duplicar Tarea' : 'Nueva Tarea'}
              </h2>
              <button className="modal-close" onClick={() => !saving && setShowModal(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            {error && <div className="error">{error}</div>}

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Trabajador</label>
                <select
                  value={form.worker_id}
                  onChange={e => setForm({ ...form, worker_id: e.target.value })}
                  required
                >
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.username})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Nombre de la tarea</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Limpiar área de trabajo"
                  required
                />
              </div>

              <div className="form-group">
                <label>Descripción (opcional)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Detalles adicionales..."
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Día de la semana</label>
                  <select
                    value={form.day_of_week}
                    onChange={e => setForm({ ...form, day_of_week: e.target.value })}
                    required
                  >
                    {DAYS.map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Hora límite</label>
                  <input
                    type="time"
                    value={form.due_time}
                    onChange={e => setForm({ ...form, due_time: e.target.value })}
                    required
                  />
                </div>
              </div>

              <p style={{ fontSize: '12px', color: '#888', margin: '-4px 0 16px' }}>
                El trabajador tendrá 1 hora desde la hora límite para marcarla como completada.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn btn-secondary flex-1"
                  onClick={() => !saving && setShowModal(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
                  {saving ? 'Guardando...' : editingTask ? 'Guardar cambios' : isDuplicating ? 'Duplicar tarea' : 'Crear tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
