import { useState, useEffect, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTrash, faPencilAlt, faCheck, faClock, faUser,
  faExclamationTriangle, faClipboardList, faTimes, faCopy, faClone,
  faChartBar, faChevronLeft, faChevronRight, faCalendar
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

function getWeekStartStr(offset = 0) {
  const d = getWeekStart();
  d.setDate(d.getDate() + offset * 7);
  return d.toISOString().split('T')[0];
}

function getTaskStatus(task, isCurrentWeek = true) {
  if (task.completed_at) return 'completed';
  if (!isCurrentWeek) return 'expired';
  const now = new Date();
  const todayDow = now.getDay();
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

function StatusBadge({ task, isCurrentWeek }) {
  const status = getTaskStatus(task, isCurrentWeek);
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
  const [weekOffset, setWeekOffset] = useState(0);
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (selectedStore) {
      fetchTasks(weekOffset);
      fetchWorkers();
    } else {
      setTasks([]); setWorkers([]); setLoading(false);
    }
  }, [selectedStore, weekOffset]);

  const fetchTasks = async (offset = 0) => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      const weekStart = getWeekStartStr(offset);
      const res = await fetch(`/api/tasks?store_id=${selectedStore.id}&week_start=${weekStart}`, {
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
      fetchTasks(weekOffset);
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
      fetchTasks(weekOffset);
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
      fetchTasks(weekOffset);
    } catch (err) {
      alert(err.message);
    } finally {
      setDupAllSaving(false);
    }
  };

  const displayedTasks = filterWorker === 'all'
    ? tasks
    : tasks.filter(t => t.worker_id === parseInt(filterWorker));

  const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Lun → Dom
  const todayDow = new Date().getDay();
  const byDay = WEEK_ORDER.reduce((acc, dow) => {
    acc[dow] = displayedTasks
      .filter(t => t.day_of_week === dow)
      .sort((a, b) => a.due_time.localeCompare(b.due_time));
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
        {/* Worker filter + actions */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
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
          {workers.map(w => {
            const wInitials = w.name.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const isActive = filterWorker === w.id.toString();
            return (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <button
                  onClick={() => setFilterWorker(isActive ? 'all' : w.id.toString())}
                  style={{
                    padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                    border: isActive ? '2px solid #D4AF37' : '2px solid transparent',
                    background: isActive ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.05)',
                    color: isActive ? '#D4AF37' : '#aaa', cursor: 'pointer'
                  }}
                >
                  {w.name}
                </button>
                <button
                  onClick={() => openHistory(w.id, w.name, wInitials)}
                  title="Historial"
                  style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#6b7280', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <FontAwesomeIcon icon={faChartBar} />
                </button>
                {workers.length > 1 && (
                  <button
                    onClick={() => openDupAll(w.id, w.name)}
                    title="Duplicar tareas a otro trabajador"
                    style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid rgba(212,175,55,0.25)', background: 'rgba(212,175,55,0.07)', color: '#92400e', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <FontAwesomeIcon icon={faClone} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Navegador de semana ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          {/* Flecha izquierda */}
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            disabled={weekOffset <= -12}
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: weekOffset <= -12 ? '#444' : '#aaa',
              cursor: weekOffset <= -12 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}
          >
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} />
          </button>

          {/* Centro: rango de semana */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
              {formatWeekRange(getWeekStartStr(weekOffset))}
            </div>
            {weekOffset === 0 ? (
              <div style={{ fontSize: 10, color: '#D4AF37', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Semana actual
              </div>
            ) : (
              <button
                onClick={() => setWeekOffset(0)}
                style={{ fontSize: 10, color: '#D4AF37', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'block', textAlign: 'center' }}
              >
                Ir a semana actual →
              </button>
            )}
          </div>

          {/* Flecha derecha */}
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            disabled={weekOffset >= 0}
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: weekOffset >= 0 ? '#444' : '#aaa',
              cursor: weekOffset >= 0 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}
          >
            <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 11 }} />
          </button>

          {/* Selector de fecha */}
          <div style={{ position: 'relative', flexShrink: 0 }} title="Ir a una fecha">
            <button style={{
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid rgba(212,175,55,0.3)',
              background: 'rgba(212,175,55,0.07)',
              color: '#D4AF37', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FontAwesomeIcon icon={faCalendar} style={{ fontSize: 11 }} />
            </button>
            <input
              type="date"
              max={new Date().toISOString().split('T')[0]}
              onChange={e => {
                if (!e.target.value) return;
                const picked = new Date(e.target.value + 'T12:00:00');
                const currentStart = getWeekStart();
                const pickedStart = new Date(picked);
                pickedStart.setDate(pickedStart.getDate() - pickedStart.getDay());
                pickedStart.setHours(0, 0, 0, 0);
                const diffWeeks = Math.round((pickedStart - currentStart) / (7 * 24 * 60 * 60 * 1000));
                setWeekOffset(Math.max(-12, Math.min(0, diffWeeks)));
                e.target.value = '';
              }}
              style={{
                position: 'absolute', inset: 0, opacity: 0,
                cursor: 'pointer', width: '100%', height: '100%',
              }}
            />
          </div>
        </div>

        {/* ── Resumen por trabajador ── */}
        {tasks.length > 0 && (() => {
          const summaryRows = workers
            .map(w => {
              const wTasks = tasks.filter(t => t.worker_id === w.id);
              if (wTasks.length === 0) return null;
              const completed = wTasks.filter(t => t.completed_at).length;
              const total = wTasks.length;
              const pct = Math.round((completed / total) * 100);
              const color = pct === 100 ? '#16a34a' : pct > 0 ? '#d97706' : '#9ca3af';
              const initials = w.name.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();
              return { ...w, completed, total, pct, color, initials };
            })
            .filter(Boolean);
          if (summaryRows.length === 0) return null;
          return (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              {summaryRows.map(sw => (
                <div
                  key={sw.id}
                  onClick={() => setFilterWorker(filterWorker === sw.id.toString() ? 'all' : sw.id.toString())}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    borderRadius: 12, cursor: 'pointer',
                    background: filterWorker === sw.id.toString() ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.03)',
                    border: filterWorker === sw.id.toString() ? '1px solid rgba(212,175,55,0.35)' : '1px solid rgba(255,255,255,0.08)',
                    minWidth: 170, transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(135deg, #D4AF37, #8B6914)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 900, color: '#000',
                  }}>
                    {sw.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sw.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${sw.pct}%`, background: sw.color, borderRadius: 2, transition: 'width 0.4s' }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: sw.color, minWidth: 36, textAlign: 'right', flexShrink: 0 }}>
                        {sw.completed}/{sw.total}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

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
          /* ── Vista semanal tipo Excel ── */
          <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 'max-content' }}>
              {WEEK_ORDER.map(dow => {
                const dayTasks = byDay[dow];
                const isToday = dow === todayDow;
                return (
                  <div key={dow} style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>

                    {/* Cabecera del día */}
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: isToday
                        ? 'linear-gradient(135deg, #D4AF37 0%, #a07c20 100%)'
                        : '#f3f4f6',
                      color: isToday ? '#000' : '#374151',
                      fontWeight: 800, fontSize: 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      boxShadow: isToday ? '0 4px 14px rgba(212,175,55,0.35)' : 'none',
                      letterSpacing: '0.02em',
                    }}>
                      <span>{DAYS[dow]}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, minWidth: 22, textAlign: 'center',
                        background: isToday ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.09)',
                        borderRadius: 20, padding: '2px 8px',
                      }}>
                        {dayTasks.length}
                      </span>
                    </div>

                    {/* Tareas del día */}
                    {dayTasks.length === 0 ? (
                      <div style={{
                        border: '2px dashed #e5e7eb', borderRadius: 12,
                        padding: '18px 12px', textAlign: 'center',
                        color: '#d1d5db', fontSize: 12,
                      }}>
                        Sin tareas
                      </div>
                    ) : dayTasks.map(task => {
                      const status = getTaskStatus(task, weekOffset === 0);
                      const accentCol = { completed: '#16a34a', active: '#d97706', upcoming: '#94a3b8', expired: '#ef4444' }[status];
                      const taskBg = { completed: '#f9fefb', active: '#fffcf5', upcoming: '#fff', expired: '#fff9f9' }[status];
                      const workerInitials = task.worker_name?.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
                      return (
                        <div key={task.id} style={{
                          background: taskBg,
                          border: '1px solid #e5e7eb',
                          borderLeft: `3px solid ${accentCol}`,
                          borderRadius: 12,
                          padding: '10px 11px',
                        }}>
                          {/* Worker badge (solo en modo "todos") */}
                          {filterWorker === 'all' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                              <div style={{
                                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                                background: 'linear-gradient(135deg, #D4AF37 0%, #a07c20 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 8, fontWeight: 900, color: '#000',
                              }}>
                                {workerInitials}
                              </div>
                              <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {task.worker_name}
                              </span>
                            </div>
                          )}

                          {/* Nombre */}
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#111', lineHeight: 1.3, marginBottom: 3 }}>
                            {task.name}
                          </div>

                          {task.description && (
                            <p style={{ margin: '0 0 4px', fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>
                              {task.description}
                            </p>
                          )}

                          {/* Hora + estado */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <FontAwesomeIcon icon={faClock} style={{ color: '#D4AF37', fontSize: 9 }} />
                              {task.due_time}
                            </span>
                            <StatusBadge task={task} isCurrentWeek={weekOffset === 0} />
                          </div>

                          {task.completed_at && (
                            <div style={{ fontSize: 10, color: '#15803d', display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
                              <FontAwesomeIcon icon={faCheck} style={{ fontSize: 9 }} />
                              {new Date(task.completed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                              {task.completed_by_name && <span style={{ color: '#9ca3af' }}> · {task.completed_by_name}</span>}
                            </div>
                          )}

                          {/* Acciones */}
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button onClick={() => openDuplicate(task)} title="Duplicar"
                              style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', color: '#9ca3af', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FontAwesomeIcon icon={faCopy} />
                            </button>
                            <button onClick={() => openEdit(task)} title="Editar"
                              style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FontAwesomeIcon icon={faPencilAlt} />
                            </button>
                            <button onClick={() => handleDelete(task.id)} title="Eliminar"
                              style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid #fca5a5', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Botón agregar rápido */}
                    {workers.length > 0 && (
                      <button
                        onClick={() => {
                          setForm({ ...emptyForm, day_of_week: dow.toString(), worker_id: workers[0]?.id?.toString() || '' });
                          setEditingTask(null); setIsDuplicating(false); setError('');
                          setShowModal(true);
                        }}
                        style={{
                          width: '100%', padding: '7px', borderRadius: 10,
                          border: '2px dashed #e5e7eb', background: 'transparent',
                          color: '#9ca3af', fontSize: 12, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.color = '#D4AF37'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#9ca3af'; }}
                      >
                        <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} /> Agregar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
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
