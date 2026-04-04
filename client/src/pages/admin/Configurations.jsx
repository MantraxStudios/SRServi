import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faMoneyBillWave, faCreditCard, faCheck } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

function Configurations() {
  const { selectedStore } = useStore();
  const [configurations, setConfigurations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    accept_cash: true,
    accept_card: true,
    is_active: true,
    is_default: false
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedStore) {
      setLoading(true);
      fetchConfigurations();
    } else {
      setLoading(false);
      setConfigurations([]);
    }
  }, [selectedStore]);

  const fetchConfigurations = async () => {
    if (!selectedStore) {
      setLoading(false);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/store-configurations?store_id=${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setConfigurations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching configurations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedStore?.id) {
      setError('Selecciona una tienda primero');
      return;
    }

    if (!formData.accept_cash && !formData.accept_card) {
      setError('Debes aceptar al menos un método de pago');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingConfig 
        ? `/api/store-configurations/${editingConfig.id}` 
        : '/api/store-configurations';
      
      const response = await fetch(url, {
        method: editingConfig ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...formData, store_id: selectedStore.id })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar la configuración');
      }

      setShowModal(false);
      setEditingConfig(null);
      setFormData({
        name: '',
        description: '',
        accept_cash: true,
        accept_card: true,
        is_active: true,
        is_default: false
      });
      fetchConfigurations();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (config) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      description: config.description || '',
      accept_cash: Boolean(config.accept_cash),
      accept_card: Boolean(config.accept_card),
      is_active: Boolean(config.is_active),
      is_default: Boolean(config.is_default)
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta configuración?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/store-configurations/${id}?store_id=${selectedStore.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Error al eliminar la configuración');
      }

      fetchConfigurations();
    } catch (error) {
      alert(error.message);
    }
  };

  const openModal = () => {
    setEditingConfig(null);
    setFormData({
      name: '',
      description: '',
      accept_cash: true,
      accept_card: true,
      is_active: true,
      is_default: false
    });
    setShowModal(true);
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <>
      <header className="admin-header">
        <h1>Configuraciones de Pago</h1>
        <button className="btn btn-primary" onClick={openModal}>
          <FontAwesomeIcon icon={faPlus} />
          Nueva Configuracion
        </button>
      </header>
      <div className="admin-main">
        {error && <div className="error">{error}</div>}

        <div className="card">
          {configurations.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
              No hay configuraciones. Crea una para definir los metodos de pago disponibles.
            </p>
          ) : (
            <div className="admin-table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Efectivo</th>
                    <th>Tarjeta</th>
                    <th>Activo</th>
                    <th>Predeterminada</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                {configurations.map(config => (
                  <tr key={config.id}>
                    <td style={{ fontWeight: '600' }}>{config.name}</td>
                    <td>
                      {config.accept_cash ? (
                        <span style={{ color: '#28a745' }}><FontAwesomeIcon icon={faCheck} /></span>
                      ) : (
                        <span style={{ color: '#dc3545' }}>-</span>
                      )}
                    </td>
                    <td>
                      {config.accept_card ? (
                        <span style={{ color: '#28a745' }}><FontAwesomeIcon icon={faCheck} /></span>
                      ) : (
                        <span style={{ color: '#dc3545' }}>-</span>
                      )}
                    </td>
                    <td>
                      {config.is_active ? (
                        <span className="badge badge-success">Activo</span>
                      ) : (
                        <span className="badge badge-secondary">Inactivo</span>
                      )}
                    </td>
                    <td>
                      {config.is_default ? (
                        <span className="badge badge-primary"><FontAwesomeIcon icon={faCheck} /> Predeterminada</span>
                      ) : (
                        <span style={{ color: '#666' }}>-</span>
                      )}
                    </td>
                    <td>
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleEdit(config)}
                        style={{ marginRight: '8px' }}
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(config.id)}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingConfig ? 'Editar Configuracion' : 'Nueva Configuracion'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Ej: Pago con Tarjeta"
                />
              </div>

              <div className="form-group">
                <label>Descripcion (opcional)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ej: Solo pagos con tarjeta de credito o debito"
                />
              </div>

              <div className="form-group">
                <label>Metodos de Pago</label>
                <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.accept_cash}
                      onChange={(e) => setFormData({ ...formData, accept_cash: e.target.checked })}
                    />
                    <FontAwesomeIcon icon={faMoneyBillWave} style={{ color: '#28a745' }} />
                    <span>Efectivo</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.accept_card}
                      onChange={(e) => setFormData({ ...formData, accept_card: e.target.checked })}
                    />
                    <FontAwesomeIcon icon={faCreditCard} style={{ color: '#007bff' }} />
                    <span>Tarjeta</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <span>Activo</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_default}
                      onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    />
                    <span>Predeterminada</span>
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingConfig ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Configurations;
