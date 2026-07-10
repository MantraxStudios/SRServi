import { useState, useEffect, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faTrash, faSignInAlt, faPhone, faSave, faPen, faUser, faWhiskeyGlass } from '@fortawesome/free-solid-svg-icons';
import { StoreContext } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#D4AF37';

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function avatarColor(name) {
  const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];
  if (!name) return colors[0];
  return colors[name.charCodeAt(0) % colors.length];
}

function PhoneEditor({ worker, token, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(worker.phone || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await fetch(`${API}/api/workers/${worker.id}/phone`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ phone })
    });
    setSaving(false);
    setEditing(false);
    worker.phone = phone;
    onSaved?.(phone);
  };

  if (!editing) return (
    <button
      onClick={() => setEditing(true)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0, color: phone ? '#555' : '#bbb', fontSize: 12 }}
    >
      <FontAwesomeIcon icon={faPhone} style={{ fontSize: 10 }} />
      {phone || 'Agregar teléfono'}
      <FontAwesomeIcon icon={faPen} style={{ fontSize: 8, opacity: 0.5 }} />
    </button>
  );

  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <input
        value={phone}
        onChange={e => setPhone(e.target.value)}
        placeholder="+56912345678"
        autoFocus
        onKeyDown={e => e.key === 'Enter' && save()}
        style={{ fontSize: 12, padding: '4px 8px', border: '1.5px solid #e2e2e2', borderRadius: 6, width: 140, outline: 'none' }}
      />
      <button onClick={save} disabled={saving}
        style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: GOLD, color: '#000', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
        {saving ? '...' : <FontAwesomeIcon icon={faSave} />}
      </button>
      <button onClick={() => setEditing(false)}
        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e2e2', background: '#fff', fontSize: 11, cursor: 'pointer', color: '#888' }}>✕</button>
    </div>
  );
}

function Workers() {
  const { selectedStore } = useContext(StoreContext);
  const { token } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selectedStore) fetchWorkers();
    else { setWorkers([]); setLoading(false); }
  }, [selectedStore]);

  const fetchWorkers = async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workers?store_id=${selectedStore.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setWorkers(Array.isArray(data) ? data : []);
    } catch { setWorkers([]); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      const res = await fetch(API + '/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ store_id: selectedStore.id, ...formData })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear trabajador');
      setShowModal(false);
      setFormData({ username: '', password: '', name: '' });
      fetchWorkers();
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (workerId) => {
    if (!confirm('¿Eliminar este trabajador?')) return;
    await fetch(`/api/workers/${workerId}?store_id=${selectedStore.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    fetchWorkers();
  };

  const handleLoginAsWorker = async (worker) => {
    const workerWindow = window.open('', `worker-panel-${worker.id}`);
    try {
      const res = await fetch(API + `/api/admin/login-as-worker/${worker.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) { workerWindow.close(); throw new Error((await res.json()).error); }
      const data = await res.json();
      localStorage.setItem(`worker_session_${worker.id}`, JSON.stringify(data.worker));
      localStorage.setItem('workerToken', data.token);
      localStorage.setItem('workerStoreCode', data.worker.store_code);
      localStorage.setItem('workerId', data.worker.id);
      localStorage.setItem('workerName', data.worker.name);
      localStorage.setItem('worker', JSON.stringify(data.worker));
      workerWindow.location.href = '/worker-panel';
    } catch (err) {
      workerWindow.close();
      alert('Error: ' + err.message);
    }
  };

  if (!selectedStore) return (
    <div className="empty-state">
      <p className="empty-state-text">Selecciona una tienda para ver los trabajadores</p>
    </div>
  );

  return (
    <>
      {/* Header */}
      <header className="admin-header">
        <div>
          <h1>Trabajadores</h1>
          <p className="text-sm text-muted">{selectedStore.name}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FontAwesomeIcon icon={faUserPlus} />
          Agregar
        </button>
      </header>

      <div className="admin-main">
        {loading ? (
          <div className="loading">Cargando...</div>
        ) : workers.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: 60 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <FontAwesomeIcon icon={faUser} style={{ fontSize: 26, color: '#ccc' }} />
            </div>
            <h3 className="empty-state-title">Sin trabajadores</h3>
            <p className="empty-state-text">Agrega trabajadores para que puedan acceder al panel</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 20 }}>
              <FontAwesomeIcon icon={faUserPlus} /> Agregar trabajador
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 680 }}>
            {workers.map(worker => (
              <div key={worker.id} style={{
                background: '#fff', border: '1px solid #ebebeb', borderRadius: 14,
                padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
                boxShadow: '0 1px 3px rgba(0,0,0,.04)'
              }}>
                {/* Avatar */}
                <div style={{
                  width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                  background: avatarColor(worker.name),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: '0.5px'
                }}>
                  {initials(worker.name)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {worker.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>@{worker.username}</div>
                  <div style={{ marginTop: 5 }}>
                    <PhoneEditor worker={worker} token={token} />
                  </div>
                </div>

                {/* Fecha */}
                <div style={{ fontSize: 11, color: '#bbb', textAlign: 'right', flexShrink: 0, display: 'none' }} className="worker-date-col">
                  {new Date(worker.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: '2-digit' })}
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    title="Entrar como trabajador"
                    onClick={() => handleLoginAsWorker(worker)}
                    style={{
                      width: 36, height: 36, borderRadius: 9, border: 'none',
                      background: '#f0f9ff', color: '#0284c7',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14
                    }}
                  >
                    <FontAwesomeIcon icon={faSignInAlt} />
                  </button>
                  <button
                    title="Eliminar"
                    onClick={() => handleDelete(worker.id)}
                    style={{
                      width: 36, height: 36, borderRadius: 9, border: 'none',
                      background: '#fff5f5', color: '#ef4444',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14
                    }}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nuevo trabajador</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            {error && <div className="error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre completo</label>
                <input type="text" value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Juan Pérez" required />
              </div>
              <div className="form-group">
                <label>Usuario</label>
                <input type="text" value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Ej: juanperez" required />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input type="password" value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres" minLength={6} required />
              </div>
              <div className="flex gap-3">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={submitting}>
                  {submitting ? 'Creando...' : 'Crear trabajador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Workers;
