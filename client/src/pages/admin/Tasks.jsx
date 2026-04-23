import { useState, useEffect, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faTrash, faPencilAlt, faCheck, faClock, faUser,
  faExclamationTriangle, faClipboardList, faTimes
} from '@fortawesome/free-solid-svg-icons';
import { StoreContext } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

const API = 'https://srservi2.srautomatic.com';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

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
    completed: { label: 'Completada', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
    active:    { label: 'En plazo',   color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
    upcoming:  { label: 'Pendiente',  color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
    expired:   { label: 'Expirada',   color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  }[status];
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px',
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap'
    }}>
      {status === 'completed' && <FontAwesomeIcon icon={faCheck} style={{ marginRight: 4 }} />}
      {status === 'expired' && <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: 4 }} />}
      {status === 'active' && <FontAwesomeIcon icon={faClock} style={{ marginRight: 4 }} />}
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
  const [filterWorker, setFilterWorker] = useState('all');
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
    setForm({ ...emptyForm, worker_id: workers[0]?.id?.toString() || '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (task) => {
    setEditingTask(task);
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {Object.entries(grouped).map(([wid, group]) => (
              <div key={wid} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px', overflow: 'hidden'
              }}>
                <div style={{
                  padding: '14px 20px', background: 'rgba(212,175,55,0.07)',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'rgba(212,175,55,0.15)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: '#D4AF37', flexShrink: 0
                  }}>
                    <FontAwesomeIcon icon={faUser} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '15px' }}>{group.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#888' }}>
                    {group.tasks.length} tarea{group.tasks.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div style={{ padding: '8px 0' }}>
                  {group.tasks.map(task => (
                    <div key={task.id} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 20px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '14px' }}>{task.name}</span>
                          <StatusBadge task={task} />
                        </div>
                        {task.description && (
                          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#888' }}>{task.description}</p>
                        )}
                        <div style={{ display: 'flex', gap: '16px', marginTop: '5px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', color: '#aaa' }}>
                            <FontAwesomeIcon icon={faClock} style={{ marginRight: 4, color: '#D4AF37' }} />
                            {DAYS[task.day_of_week]} {task.due_time}
                          </span>
                          {task.completed_at && (
                            <span style={{ fontSize: '12px', color: '#16a34a' }}>
                              <FontAwesomeIcon icon={faCheck} style={{ marginRight: 4 }} />
                              Marcada a las {new Date(task.completed_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                              {task.completed_by_name && ` por ${task.completed_by_name}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => openEdit(task)}
                          title="Editar"
                        >
                          <FontAwesomeIcon icon={faPencilAlt} />
                        </button>
                        <button
                          className="btn btn-danger btn-icon btn-sm"
                          onClick={() => handleDelete(task.id)}
                          title="Eliminar"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingTask ? 'Editar Tarea' : 'Nueva Tarea'}
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
                  {saving ? 'Guardando...' : editingTask ? 'Guardar cambios' : 'Crear tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
