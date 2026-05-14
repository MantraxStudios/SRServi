import { useState, useEffect, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTrash, faPencilAlt, faCheck, faClock, faUser,
  faExclamationTriangle, faClipboardList, faTimes, faCopy, faClone,
  faChartBar, faChevronLeft, faChevronRight, faCalendar, faStore, faArrowRight
} from '@fortawesome/free-solid-svg-icons';
import { StoreContext } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

const API = 'https://srservi2.srautomatic.com';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MONTHS_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function formatWeekRange(weekStartStr) {
  const start = new Date(weekStartStr + 'T12:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const year = end.getFullYear();
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} de ${MONTHS_FULL[end.getMonth()]} ${year}`;
  }
  return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${year}`;
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
  const [detailWorkerId, setDetailWorkerId] = useState(null);
  const [workerSearch, setWorkerSearch] = useState('');
  const [dupAllModal, setDupAllModal] = useState(null);
  const [dupAllTarget, setDupAllTarget] = useState('');
  const [dupAllSaving, setDupAllSaving] = useState(false);
  const [dupDayModal, setDupDayModal] = useState(null); // { sourceDow }
  const [dupDayTarget, setDupDayTarget] = useState('');
  const [dupDaySaving, setDupDaySaving] = useState(false);
  const [historyModal, setHistoryModal] = useState(null); // { workerId, workerName, initials }
  const [historyData, setHistoryData] = useState(null);  // { tasks, weeks }
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyWeekIdx, setHistoryWeekIdx] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [, tick] = useState(0);

  // Duplicar a otra tienda
  const [dupStoreModal, setDupStoreModal] = useState(false);
  const [allStores, setAllStores] = useState([]);
  const [dupTargetStore, setDupTargetStore] = useState('');
  const [dupTargetWorkers, setDupTargetWorkers] = useState([]);
  const [workerMapping, setWorkerMapping] = useState({}); // { source_worker_id: target_worker_id }
  const [dupStoreSaving, setDupStoreSaving] = useState(false);
  const [dupStoreError, setDupStoreError] = useState('');

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

  const openCreate = (presetWorkerId = null) => {
    setEditingTask(null);
    setIsDuplicating(false);
    const wid = presetWorkerId ? presetWorkerId.toString() : workers[0]?.id?.toString() || '';
    setForm({ ...emptyForm, worker_id: wid });
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

  const openDupDay = (dow) => {
    const otherDays = WEEK_ORDER.filter(d => d !== dow);
    setDupDayModal({ sourceDow: dow });
    setDupDayTarget(otherDays[0].toString());
    setDupDaySaving(false);
  };

  const handleDupDay = async () => {
    if (!dupDayModal || dupDayTarget === '') return;
    setDupDaySaving(true);
    const sourceTasks = byDay[dupDayModal.sourceDow];
    try {
      await Promise.all(sourceTasks.map(task =>
        fetch(`${API}/api/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            store_id: selectedStore.id,
            worker_id: task.worker_id,
            name: task.name,
            description: task.description || null,
            day_of_week: parseInt(dupDayTarget),
            due_time: task.due_time,
          }),
        })
      ));
      setDupDayModal(null);
      fetchTasks(weekOffset);
    } catch (err) {
      alert('Error al duplicar tareas del día');
    } finally {
      setDupDaySaving(false);
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

  const openDupStore = async () => {
    setDupStoreError('');
    setDupStoreSaving(false);
    setWorkerMapping({});
    setDupTargetWorkers([]);
    setDupTargetStore('');
    try {
      const res = await fetch(`${API}/api/stores`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const others = Array.isArray(data) ? data.filter(s => s.id !== selectedStore.id) : [];
      setAllStores(others);
      if (others.length > 0) {
        setDupTargetStore(String(others[0].id));
        await loadTargetWorkers(others[0].id);
      }
    } catch {}
    setDupStoreModal(true);
  };

  const loadTargetWorkers = async (storeId) => {
    try {
      const res = await fetch(`${API}/api/workers?store_id=${storeId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setDupTargetWorkers(Array.isArray(data) ? data : []);
    } catch {
      setDupTargetWorkers([]);
    }
    setWorkerMapping({});
  };

  const handleDupStoreTargetChange = async (storeId) => {
    setDupTargetStore(storeId);
    await loadTargetWorkers(parseInt(storeId));
  };

  const handleDupStore = async () => {
    setDupStoreError('');
    // Verificar que todos los workers origen con tareas tengan un mapeo
    const sourceWorkersWithTasks = [...new Set(tasks.map(t => t.worker_id))];
    const unmapped = sourceWorkersWithTasks.filter(id => !workerMapping[id]);
    if (unmapped.length > 0) {
      const names = unmapped.map(id => workers.find(w => w.id === id)?.name || id).join(', ');
      setDupStoreError(`Asigna un trabajador destino para: ${names}`);
      return;
    }
    setDupStoreSaving(true);
    try {
      const res = await fetch(`${API}/api/tasks/duplicate-to-store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          source_store_id: selectedStore.id,
          target_store_id: parseInt(dupTargetStore),
          worker_mapping: workerMapping,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al duplicar');
      setDupStoreModal(false);
      alert(`✓ ${data.count} tareas copiadas correctamente a ${allStores.find(s => s.id === parseInt(dupTargetStore))?.name}`);
    } catch (err) {
      setDupStoreError(err.message);
    } finally {
      setDupStoreSaving(false);
    }
  };

  const displayedTasks = detailWorkerId
    ? tasks.filter(t => Number(t.worker_id) === Number(detailWorkerId))
    : tasks;

  const workerStats = workers
    .map(w => {
      const wTasks = tasks.filter(t => t.worker_id === w.id);
      const completed = wTasks.filter(t => t.completed_at).length;
      const total = wTasks.length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      const initials = w.name.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();
      return { ...w, completed, total, pct, initials };
    })
    .filter(w => w.name.toLowerCase().includes(workerSearch.toLowerCase().trim()));

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
          {detailWorkerId ? (
            <>
              <button
                onClick={() => setDetailWorkerId(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '0 0 4px', marginBottom: 2 }}
              >
                <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 11 }} /> Trabajadores
              </button>
              <h1>{workers.find(w => w.id === detailWorkerId)?.name}</h1>
              {!loading && (() => {
                const wt = tasks.filter(t => t.worker_id === detailWorkerId);
                const done = wt.filter(t => t.completed_at).length;
                return <p className="text-sm text-muted">{done}/{wt.length} tareas completadas · semana {formatWeekRange(getWeekStartStr(weekOffset))}</p>;
              })()}
            </>
          ) : (
            <>
              <h1>Tareas Semanales</h1>
              <p className="text-sm text-muted">
                Asigna y controla tareas semanales de {selectedStore.name}. Se reinician cada domingo a medianoche.
              </p>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tasks.length > 0 && !detailWorkerId && (
            <button className="btn btn-secondary" onClick={openDupStore}>
              <FontAwesomeIcon icon={faStore} />
              Copiar a otra tienda
            </button>
          )}
          <button className="btn btn-primary" onClick={() => openCreate(detailWorkerId)} disabled={workers.length === 0}>
            <FontAwesomeIcon icon={faPlus} />
            Nueva Tarea
          </button>
        </div>
      </header>

      <div className="admin-main">

        {/* ── Navegador de semana ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '14px 18px', borderRadius: 14, background: '#1a2535', border: '1px solid #2d3f58' }}>
          {/* Flecha izquierda */}
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            disabled={weekOffset <= -12}
            style={{
              width: 38, height: 38, borderRadius: 10, border: '1px solid #3a4f68',
              background: '#243044', color: weekOffset <= -12 ? '#4a5568' : '#cbd5e1',
              cursor: weekOffset <= -12 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}
          >
            <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 13 }} />
          </button>

          {/* Centro: rango de semana */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Semana
            </div>
            <div style={{ fontWeight: 800, fontSize: 19, color: '#f1f5f9', letterSpacing: '-0.01em', textAlign: 'center' }}>
              {formatWeekRange(getWeekStartStr(weekOffset))}
            </div>
            {weekOffset === 0 ? (
              <div style={{ fontSize: 11, color: '#D4AF37', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                ● Semana actual
              </div>
            ) : (
              <button
                onClick={() => setWeekOffset(0)}
                style={{ fontSize: 12, color: '#D4AF37', fontWeight: 700, border: 'none', background: 'none', cursor: 'pointer', padding: 0, textAlign: 'center' }}
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
              width: 38, height: 38, borderRadius: 10, border: '1px solid #3a4f68',
              background: '#243044', color: weekOffset >= 0 ? '#4a5568' : '#cbd5e1',
              cursor: weekOffset >= 0 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}
          >
            <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 13 }} />
          </button>

          {/* Selector de fecha */}
          <div style={{ position: 'relative', flexShrink: 0 }} title="Ir a una fecha">
            <button style={{
              width: 38, height: 38, borderRadius: 10,
              border: '1px solid rgba(212,175,55,0.5)',
              background: 'rgba(212,175,55,0.15)',
              color: '#D4AF37', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FontAwesomeIcon icon={faCalendar} style={{ fontSize: 13 }} />
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

        {detailWorkerId ? (
          /* ── Kanban para trabajador seleccionado ── */
          loading ? (
            <div className="loading">Cargando tareas...</div>
          ) : (
            <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 'max-content' }}>
                {WEEK_ORDER.map(dow => {
                  const dayTasks = byDay[dow];
                  const isToday = weekOffset === 0 && dow === todayDow;
                  const colDate = new Date(getWeekStart());
                  colDate.setDate(colDate.getDate() + weekOffset * 7 + dow);
                  const colYear = colDate.getFullYear();
                  const dateLabel = `${colDate.getDate()} ${MONTHS[colDate.getMonth()]}${colYear !== new Date().getFullYear() ? ` ${colYear}` : ''}`;
                  return (
                    <div key={dow} style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{
                        padding: '10px 14px', borderRadius: 12,
                        background: isToday ? 'linear-gradient(135deg, #D4AF37 0%, #a07c20 100%)' : '#f3f4f6',
                        color: isToday ? '#000' : '#374151', fontWeight: 800, fontSize: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        boxShadow: isToday ? '0 4px 14px rgba(212,175,55,0.35)' : 'none', letterSpacing: '0.02em',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span>{DAYS[dow]}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, letterSpacing: 0 }}>{dateLabel}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {dayTasks.length > 0 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openDupDay(dow); }}
                              title="Duplicar tareas de este día"
                              style={{
                                width: 24, height: 24, borderRadius: 7, border: 'none',
                                background: isToday ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.09)',
                                color: isToday ? '#000' : '#374151',
                                cursor: 'pointer', fontSize: 10,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <FontAwesomeIcon icon={faClone} />
                            </button>
                          )}
                          <span style={{ fontSize: 11, fontWeight: 700, minWidth: 22, textAlign: 'center', background: isToday ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.09)', borderRadius: 20, padding: '2px 8px' }}>
                            {dayTasks.length}
                          </span>
                        </div>
                      </div>

                      {dayTasks.length === 0 ? (
                        <div style={{ border: '2px dashed #e5e7eb', borderRadius: 12, padding: '18px 12px', textAlign: 'center', color: '#d1d5db', fontSize: 12 }}>
                          Sin tareas
                        </div>
                      ) : dayTasks.map(task => {
                        const status = getTaskStatus(task, weekOffset === 0);
                        const accentCol = { completed: '#16a34a', active: '#d97706', upcoming: '#94a3b8', expired: '#ef4444' }[status];
                        const taskBg = { completed: '#f9fefb', active: '#fffcf5', upcoming: '#fff', expired: '#fff9f9' }[status];
                        return (
                          <div key={task.id} style={{ background: taskBg, border: '1px solid #e5e7eb', borderLeft: `3px solid ${accentCol}`, borderRadius: 12, padding: '10px 11px' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#111', lineHeight: 1.3, marginBottom: 3 }}>{task.name}</div>
                            {task.description && (
                              <p style={{ margin: '0 0 4px', fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>{task.description}</p>
                            )}
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

                      {workers.length > 0 && (
                        <button
                          onClick={() => {
                            setForm({ ...emptyForm, day_of_week: dow.toString(), worker_id: detailWorkerId?.toString() || workers[0]?.id?.toString() || '' });
                            setEditingTask(null); setIsDuplicating(false); setError('');
                            setShowModal(true);
                          }}
                          style={{ width: '100%', padding: '7px', borderRadius: 10, border: '2px dashed #e5e7eb', background: 'transparent', color: '#9ca3af', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
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
          )
        ) : (
          /* ── Lista de trabajadores ── */
          <>
            <div style={{ marginBottom: 14 }}>
              <input
                type="text"
                placeholder="Buscar trabajador..."
                value={workerSearch}
                onChange={e => setWorkerSearch(e.target.value)}
                style={{ width: '100%', maxWidth: 360, padding: '10px 16px', borderRadius: 10, border: '1px solid #2d3f58', background: '#1a2535', color: '#f1f5f9', fontSize: 14, outline: 'none' }}
              />
            </div>
            {loading ? (
              <div className="loading">Cargando...</div>
            ) : workers.length === 0 ? (
              <div className="empty-state">
                <FontAwesomeIcon icon={faClipboardList} className="empty-state-icon" />
                <h3 className="empty-state-title">Sin trabajadores</h3>
                <p className="empty-state-text">Primero agrega trabajadores en la sección Vendedores</p>
              </div>
            ) : workerStats.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px 0', fontSize: 14 }}>
                No se encontró ningún trabajador
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 1fr 90px', padding: '6px 18px 10px', fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  <span>Trabajador</span>
                  <span style={{ textAlign: 'center' }}>Hechas</span>
                  <span style={{ textAlign: 'center' }}>Total</span>
                  <span style={{ paddingLeft: 12 }}>Progreso</span>
                  <span></span>
                </div>
                {workerStats.map(ws => {
                  const pc = ws.pct === 100 ? '#22c55e' : ws.pct > 0 ? '#f59e0b' : '#64748b';
                  return (
                    <div
                      key={ws.id}
                      onClick={() => setDetailWorkerId(ws.id)}
                      style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 1fr 90px', alignItems: 'center', padding: '14px 18px', borderRadius: 14, background: '#1a2535', border: '1px solid #2d3f58', cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#1f2e44'; e.currentTarget.style.borderColor = '#3d5470'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#1a2535'; e.currentTarget.style.borderColor = '#2d3f58'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg, #D4AF37, #8B6914)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: '#000' }}>
                          {ws.initials}
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                      </div>
                      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18, color: pc }}>{ws.completed}</div>
                      <div style={{ textAlign: 'center', fontWeight: 600, fontSize: 16, color: '#94a3b8' }}>{ws.total}</div>
                      <div style={{ padding: '0 12px' }}>
                        <div style={{ height: 8, background: '#243044', borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${ws.pct}%`, background: pc, borderRadius: 6, transition: 'width 0.4s' }} />
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 11, color: pc, fontWeight: 700, marginTop: 4 }}>{ws.pct}%</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => openHistory(ws.id, ws.name, ws.initials)} title="Historial"
                          style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid #3a4f68', background: '#243044', color: '#94a3b8', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FontAwesomeIcon icon={faChartBar} />
                        </button>
                        {workers.length > 1 && (
                          <button onClick={() => openDupAll(ws.id, ws.name)} title="Duplicar tareas"
                            style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(212,175,55,0.5)', background: 'rgba(212,175,55,0.15)', color: '#D4AF37', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FontAwesomeIcon icon={faClone} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
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
                        width: 34, height: 34, borderRadius: 9, border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
                        background: 'rgba(255,255,255,0.08)', color: historyWeekIdx >= historyData.weeks.length - 1 ? '#4a5568' : '#cbd5e1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}
                    >
                      <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 12 }} />
                    </button>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9' }}>
                        {formatWeekRange(week.week_start)}
                      </div>
                      {isCurrentWeek && (
                        <div style={{ fontSize: 11, color: '#D4AF37', fontWeight: 700, marginTop: 3, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                          ● Semana actual
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setHistoryWeekIdx(i => Math.max(i - 1, 0))}
                      disabled={historyWeekIdx === 0}
                      style={{
                        width: 34, height: 34, borderRadius: 9, border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
                        background: 'rgba(255,255,255,0.08)', color: historyWeekIdx === 0 ? '#4a5568' : '#cbd5e1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}
                    >
                      <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 12 }} />
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
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                        {completedCount}/{totalCount} tareas
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 8, background: 'rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden' }}>
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
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6, fontWeight: 600 }}>
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

      {dupDayModal && (
        <div className="modal-overlay" onClick={() => !dupDaySaving && setDupDayModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Duplicar tareas del día</h2>
              <button className="modal-close" onClick={() => !dupDaySaving && setDupDayModal(null)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <p style={{ fontSize: 14, color: '#aaa', marginBottom: 16 }}>
              Se copiarán las {byDay[dupDayModal.sourceDow]?.length} tareas del <strong style={{ color: '#fff' }}>{DAYS[dupDayModal.sourceDow]}</strong> al día seleccionado.
            </p>
            <div className="form-group">
              <label>Día destino</label>
              <select value={dupDayTarget} onChange={e => setDupDayTarget(e.target.value)}>
                {WEEK_ORDER.filter(d => d !== dupDayModal.sourceDow).map(d => (
                  <option key={d} value={d}>{DAYS[d]}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3" style={{ marginTop: 8 }}>
              <button
                className="btn btn-secondary flex-1"
                onClick={() => setDupDayModal(null)}
                disabled={dupDaySaving}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary flex-1"
                onClick={handleDupDay}
                disabled={dupDaySaving}
              >
                {dupDaySaving ? 'Duplicando...' : 'Duplicar tareas'}
              </button>
            </div>
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

      {dupStoreModal && (
        <div className="modal-overlay" onClick={() => !dupStoreSaving && setDupStoreModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, width: '100%' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                <FontAwesomeIcon icon={faStore} style={{ marginRight: 8, color: '#D4AF37' }} />
                Copiar tareas a otra tienda
              </h2>
              <button className="modal-close" onClick={() => !dupStoreSaving && setDupStoreModal(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#aaa', marginBottom: 18 }}>
              Se copiarán las <strong style={{ color: '#f1f5f9' }}>{tasks.length} tareas</strong> de <strong style={{ color: '#D4AF37' }}>{selectedStore.name}</strong> a la tienda destino. Para cada trabajador origen, elige quién recibirá sus tareas.
            </p>

            {allStores.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#666', fontSize: 13 }}>
                No tienes otras tiendas disponibles.
              </div>
            ) : (
              <>
                {/* Selector de tienda destino */}
                <div className="form-group">
                  <label>Tienda destino</label>
                  <select
                    value={dupTargetStore}
                    onChange={e => handleDupStoreTargetChange(e.target.value)}
                    disabled={dupStoreSaving}
                  >
                    {allStores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Mapeo de trabajadores */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 10 }}>
                    Asignar trabajadores
                  </label>

                  {[...new Set(tasks.map(t => t.worker_id))].map(sourceWId => {
                    const sourceWorker = workers.find(w => w.id === sourceWId);
                    if (!sourceWorker) return null;
                    const taskCount = tasks.filter(t => t.worker_id === sourceWId).length;
                    return (
                      <div key={sourceWId} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', marginBottom: 8,
                        background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.07)'
                      }}>
                        {/* Origen */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sourceWorker.name}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{taskCount} tarea{taskCount !== 1 ? 's' : ''}</div>
                        </div>

                        <FontAwesomeIcon icon={faArrowRight} style={{ color: '#D4AF37', fontSize: 12, flexShrink: 0 }} />

                        {/* Destino */}
                        <div style={{ flex: 1 }}>
                          {dupTargetWorkers.length === 0 ? (
                            <span style={{ fontSize: 12, color: '#555', fontStyle: 'italic' }}>Sin trabajadores</span>
                          ) : (
                            <select
                              value={workerMapping[sourceWId] || ''}
                              onChange={e => setWorkerMapping(prev => ({ ...prev, [sourceWId]: parseInt(e.target.value) }))}
                              disabled={dupStoreSaving}
                              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: '#1a2535', color: '#f1f5f9', fontSize: 13 }}
                            >
                              <option value="">— Elegir —</option>
                              {dupTargetWorkers.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {dupStoreError && (
                  <div style={{ fontSize: 13, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
                    {dupStoreError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button className="btn btn-secondary flex-1" onClick={() => setDupStoreModal(false)} disabled={dupStoreSaving}>
                    Cancelar
                  </button>
                  <button
                    className="btn btn-primary flex-1"
                    onClick={handleDupStore}
                    disabled={dupStoreSaving || dupTargetWorkers.length === 0}
                  >
                    {dupStoreSaving ? 'Copiando...' : `Copiar ${tasks.length} tareas`}
                  </button>
                </div>
              </>
            )}
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
