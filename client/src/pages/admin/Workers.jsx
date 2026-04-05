import { useState, useEffect, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faTrash, faUser, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { StoreContext } from '../../components/Layout';
import { API_URL } from '../../config.js';

function Workers() {
  const { selectedStore, colors } = useContext(StoreContext);
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
      const response = await fetch(API_URL + '/api/workers', {
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

  const s = {
    container: { padding: '30px', backgroundColor: colors.secondary, minHeight: '100vh' },
    loadingContainer: {
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '400px', gap: '15px', backgroundColor: colors.secondary
    },
    spinner: {
      width: '40px', height: '40px', border: `4px solid ${colors.secondary}`,
      borderTop: `4px solid ${colors.primary}`, borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    },
    emptyContainer: {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '400px', color: colors.primary, backgroundColor: colors.secondary
    },
    header: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: '30px'
    },
    title: { margin: 0, fontSize: '28px', color: colors.primary },
    subtitle: { margin: '5px 0 0 0', color: colors.primary, opacity: 0.7, fontSize: '14px' },
    addButton: {
      display: 'flex', alignItems: 'center', gap: '8px',
      background: colors.primary,
      color: colors.secondary, border: 'none', padding: '12px 24px',
      borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
    },
    emptyState: {
      textAlign: 'center', padding: '60px 20px',
      background: colors.secondary, borderRadius: '12px',
      boxShadow: `0 2px 10px ${colors.primary}22`
    },
    emptyIcon: { fontSize: '60px', color: colors.primary, opacity: 0.3, marginBottom: '20px' },
    emptyButton: {
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      background: colors.primary,
      color: colors.secondary, border: 'none', padding: '12px 24px',
      borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', marginTop: '20px'
    },
    grid: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px'
    },
    workerCard: {
      background: colors.secondary, borderRadius: '12px', padding: '20px',
      display: 'flex', alignItems: 'center', gap: '15px',
      boxShadow: `0 2px 10px ${colors.primary}22`
    },
    workerAvatar: {
      width: '60px', height: '60px', borderRadius: '50%',
      background: colors.primary,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: colors.secondary, fontSize: '24px'
    },
    workerInfo: { flex: 1 },
    workerName: { margin: 0, fontSize: '18px', color: colors.primary },
    workerUsername: {
      margin: '5px 0 0 0', fontSize: '14px', color: colors.primary,
      display: 'flex', alignItems: 'center', gap: '5px', opacity: 0.7
    },
    workerDate: { margin: '5px 0 0 0', fontSize: '12px', color: colors.primary, opacity: 0.5 },
    deleteButton: {
      background: `${colors.accent}22`, color: colors.accent, border: 'none',
      padding: '10px', borderRadius: '8px', cursor: 'pointer'
    },
    modalOverlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '20px', zIndex: 1000
    },
    modal: {
      background: colors.secondary, borderRadius: '16px', padding: '30px',
      maxWidth: '450px', width: '100%', boxShadow: `0 10px 40px ${colors.primary}44`
    },
    modalTitle: { margin: '0 0 25px 0', fontSize: '24px', color: colors.primary },
    error: {
      background: `${colors.accent}22`, color: colors.accent, padding: '12px',
      borderRadius: '8px', marginBottom: '20px', fontSize: '14px'
    },
    form: { display: 'flex', flexDirection: 'column', gap: '20px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
    label: { fontSize: '14px', color: colors.primary, fontWeight: 'bold' },
    input: {
      padding: '12px 15px', border: `2px solid ${colors.primary}22`,
      borderRadius: '8px', fontSize: '14px', outline: 'none', color: colors.primary,
      backgroundColor: 'white'
    },
    formActions: { display: 'flex', gap: '10px', marginTop: '10px' },
    cancelButton: {
      flex: 1, padding: '12px', border: `2px solid ${colors.primary}33`,
      borderRadius: '8px', background: colors.secondary, color: colors.primary,
      cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
    },
    submitButton: {
      flex: 1, padding: '12px', border: 'none', borderRadius: '8px',
      background: colors.primary,
      color: colors.secondary, cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
    }
  };

  if (loading) {
    return (
      <div style={s.loadingContainer}>
        <div style={s.spinner}></div>
        <p>Cargando trabajadores...</p>
      </div>
    );
  }

  if (!selectedStore) {
    return (
      <div style={s.emptyContainer}>
        <p>Selecciona una tienda para ver los trabajadores</p>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Trabajadores</h1>
          <p style={s.subtitle}>Gestiona los trabajadores de {selectedStore.name}</p>
        </div>
        <button style={s.addButton} onClick={() => setShowModal(true)}>
          <FontAwesomeIcon icon={faUserPlus} />
          Agregar Trabajador
        </button>
      </div>

      {workers.length === 0 ? (
        <div style={s.emptyState}>
          <FontAwesomeIcon icon={faUser} style={s.emptyIcon} />
          <h3>No hay trabajadores</h3>
          <p>Agrega trabajadores para que puedan acceder al panel</p>
          <button style={s.emptyButton} onClick={() => setShowModal(true)}>
            <FontAwesomeIcon icon={faUserPlus} />
            Agregar Trabajador
          </button>
        </div>
      ) : (
        <div style={s.grid}>
          {workers.map(worker => (
            <div key={worker.id} style={s.workerCard}>
              <div style={s.workerAvatar}>
                <FontAwesomeIcon icon={faUser} />
              </div>
              <div style={s.workerInfo}>
                <h3 style={s.workerName}>{worker.name}</h3>
                <p style={s.workerUsername}>
                  <FontAwesomeIcon icon={faEnvelope} />
                  {worker.username}
                </p>
                <p style={s.workerDate}>
                  Creado: {new Date(worker.created_at).toLocaleDateString('es-ES')}
                </p>
              </div>
              <button style={s.deleteButton} onClick={() => handleDelete(worker.id)}>
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={s.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Agregar Trabajador</h2>
            
            {error && <div style={s.error}>{error}</div>}

            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.formGroup}>
                <label style={s.label}>Nombre Completo</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  style={s.input}
                  placeholder="Ej: Juan Pérez"
                  required
                />
              </div>

              <div style={s.formGroup}>
                <label style={s.label}>Usuario</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  style={s.input}
                  placeholder="Ej: juanperez"
                  required
                />
              </div>

              <div style={s.formGroup}>
                <label style={s.label}>Contraseña</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  style={s.input}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </div>

              <div style={s.formActions}>
                <button type="button" style={s.cancelButton} onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" style={s.submitButton}>
                  Crear Trabajador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Workers;
