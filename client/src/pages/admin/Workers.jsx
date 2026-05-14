import { useState, useEffect, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faTrash, faUser, faEnvelope, faSignInAlt, faPhone, faSave } from '@fortawesome/free-solid-svg-icons';
import { StoreContext } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

const API = 'https://srservi2.srautomatic.com';

function PhoneEditor({ worker, token }) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(worker.phone || '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    await fetch(`${API}/api/workers/${worker.id}/phone`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ phone })
    });
    setSaving(false); setEditing(false); worker.phone = phone;
  };
  if (!editing) return (
    <p style={{ fontSize: 12, color: '#888', margin: '2px 0', cursor: 'pointer' }} onClick={() => setEditing(true)}>
      <FontAwesomeIcon icon={faPhone} style={{ marginRight: 5, fontSize: 10 }} />
      {phone || <span style={{ color: '#bbb' }}>Agregar teléfono SMS</span>}
    </p>
  );
  return (
    <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+56912345678"
        style={{ fontSize: 12, padding: '3px 7px', border: '1px solid #e2e2e2', borderRadius: 6, width: 130, outline: 'none' }} />
      <button onClick={save} disabled={saving}
        style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: '#D4AF37', color: '#000', fontSize: 11, cursor: 'pointer' }}>
        <FontAwesomeIcon icon={faSave} />
      </button>
      <button onClick={() => setEditing(false)}
        style={{ padding: '3px 7px', borderRadius: 6, border: '1px solid #e2e2e2', background: '#fff', fontSize: 11, cursor: 'pointer' }}>✕</button>
    </div>
  );
}

function Workers() {
  const { selectedStore } = useContext(StoreContext);
  const { token } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedStore) {
      fetchWorkers();
    } else {
      setWorkers([]);
      setLoading(false);
    }
  }, [selectedStore]);

  const fetchWorkers = async () => {
    if (!selectedStore) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/workers?store_id=${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setWorkers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching workers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API + '/api/workers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          store_id: selectedStore.id,
          ...formData
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear trabajador');
      }

      setShowModal(false);
      setFormData({ username: '', password: '', name: '' });
      fetchWorkers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (workerId) => {
    if (!confirm('¿Estás seguro de eliminar este trabajador?')) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/workers/${workerId}?store_id=${selectedStore.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchWorkers();
    } catch (error) {
      console.error('Error deleting worker:', error);
    }
  };

  const handleLoginAsWorker = async (worker) => {
    // Abrir ventana inmediatamente (gesto de usuario sincrónico) para evitar bloqueo de popup
    const workerWindow = window.open('', `worker-panel-${worker.id}`);

    try {
      setLoading(true);
      const adminToken = localStorage.getItem('token');

      const response = await fetch(API + `/api/admin/login-as-worker/${worker.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const data = await response.json();
        workerWindow.close();
        throw new Error(data.error || 'No se pudo iniciar sesión como trabajador');
      }

      const data = await response.json();

      // Guardar datos del worker en clave específica por worker para evitar conflictos entre tabs
      const workerKey = `worker_session_${worker.id}`;
      localStorage.setItem(workerKey, JSON.stringify(data.worker));
      localStorage.setItem('workerToken', data.token);
      localStorage.setItem('workerStoreCode', data.worker.store_code);
      localStorage.setItem('workerId', data.worker.id);
      localStorage.setItem('workerName', data.worker.name);
      localStorage.setItem('worker', JSON.stringify(data.worker));

      // Navegar la ventana ya abierta al panel del worker
      workerWindow.location.href = '/worker-panel';
    } catch (error) {
      console.error('Error logging in as worker:', error);
      alert('Error al iniciar sesión como trabajador: ' + error.message);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Cargando trabajadores...</div>;
  }

  if (!selectedStore) {
    return (
      <div className="empty-state">
        <p className="empty-state-text">Selecciona una tienda para ver los trabajadores</p>
      </div>
    );
  }

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Trabajadores</h1>
          <p className="text-sm text-muted">Gestiona los trabajadores de {selectedStore.name}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FontAwesomeIcon icon={faUserPlus} />
          Agregar Trabajador
        </button>
      </header>

      <div className="admin-main">
        {workers.length === 0 ? (
          <div className="empty-state">
            <FontAwesomeIcon icon={faUser} className="empty-state-icon" />
            <h3 className="empty-state-title">No hay trabajadores</h3>
            <p className="empty-state-text">Agrega trabajadores para que puedan acceder al panel</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: '20px' }}>
              <FontAwesomeIcon icon={faUserPlus} />
              Agregar Trabajador
            </button>
          </div>
        ) : (
          <div className="workers-grid">
            {workers.map(worker => (
              <div key={worker.id} className="worker-card-admin">
                <div className="worker-avatar-circle">
                  <FontAwesomeIcon icon={faUser} />
                </div>
                <div className="flex-1">
                  <h3 className="worker-name-admin">{worker.name}</h3>
                  <p className="worker-username-info">
                    <FontAwesomeIcon icon={faEnvelope} />
                    {worker.username}
                  </p>
                  <p className="worker-created-date">
                    Creado: {new Date(worker.created_at).toLocaleDateString('es-ES')}
                  </p>
                  <PhoneEditor worker={worker} token={token} />
                </div>
                <div className="worker-actions">
                  <button 
                    className="btn btn-primary btn-icon" 
                    title="Acceder como trabajador"
                    onClick={() => handleLoginAsWorker(worker)}
                  >
                    <FontAwesomeIcon icon={faSignInAlt} />
                  </button>
                  <button 
                    className="btn btn-danger btn-icon" 
                    onClick={() => handleDelete(worker.id)}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Agregar Trabajador</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            {error && <div className="error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre Completo</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Ej: Juan Pérez"
                  required
                />
              </div>

              <div className="form-group">
                <label>Usuario</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  placeholder="Ej: juanperez"
                  required
                />
              </div>

              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </div>

              <div className="flex gap-3">
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  Crear Trabajador
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
