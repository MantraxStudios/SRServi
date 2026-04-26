import { useState, useEffect, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faTrash, faUser, faEnvelope, faSignInAlt } from '@fortawesome/free-solid-svg-icons';
import { StoreContext } from '../../components/Layout';

const API = 'https://srservi2.srautomatic.com';

function Workers() {
  const { selectedStore } = useContext(StoreContext);
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
    try {
      setLoading(true);
      const adminToken = localStorage.getItem('token');
      
      // Usar el endpoint especial del admin para acceder como worker
      const response = await fetch(API + `/api/admin/login-as-worker/${worker.id}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'No se pudo iniciar sesión como trabajador');
      }

      const data = await response.json();
      
      // Guardar token de worker
      localStorage.setItem('workerToken', data.token);
      localStorage.setItem('workerStoreCode', data.worker.store_code);
      localStorage.setItem('workerId', data.worker.id);
      localStorage.setItem('workerName', data.worker.name);

      // Guardar objeto worker completo para que WorkerPanel lo lea correctamente
      localStorage.setItem('worker', JSON.stringify(data.worker));

      // Abrir panel de trabajador en nueva pestaña
      window.open('/worker-panel', '_blank');
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
