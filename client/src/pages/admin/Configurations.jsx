import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faMoneyBillWave, faCreditCard, faCheck, faStore, faCreditCardAlt } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

function Configurations() {
  const { selectedStore } = useStore();
  const [configurations, setConfigurations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [terminals, setTerminals] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    accept_cash: true,
    accept_card: true,
    is_active: true,
    is_default: false,
    is_minimarket: false,
    default_minimarket_terminal: ''
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

  const fetchTerminals = async () => {
    if (!selectedStore) return;
    
    try {
      const response = await fetch(`/api/public/terminals/${selectedStore.id}`);
      if (response.ok) {
        const data = await response.json();
        setTerminals(data);
      }
    } catch (error) {
      console.error('Error fetching terminals:', error);
    }
  };

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
        is_default: false,
        is_minimarket: false
      });
      fetchConfigurations();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (config) => {
    setEditingConfig(config);
    fetchTerminals();
    setFormData({
      name: config.name,
      description: config.description || '',
      accept_cash: Boolean(config.accept_cash),
      accept_card: Boolean(config.accept_card),
      is_active: Boolean(config.is_active),
      is_default: Boolean(config.is_default),
      is_minimarket: Boolean(config.is_minimarket),
      default_minimarket_terminal: config.default_minimarket_terminal || ''
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
    fetchTerminals();
    setFormData({
      name: '',
      description: '',
      accept_cash: true,
      accept_card: true,
      is_active: true,
      is_default: false,
      is_minimarket: false,
      default_minimarket_terminal: ''
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
                <label>Tipo de Store</label>
                <div style={{ marginTop: '8px' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    cursor: 'pointer', 
                    padding: '12px', 
                    background: formData.is_minimarket ? 'rgba(212, 175, 55, 0.1)' : '#f8f9fa', 
                    borderRadius: '8px', 
                    border: formData.is_minimarket ? '2px solid #D4AF37' : '2px solid transparent',
                    position: 'relative'
                  }}>
                    <input
                      type="checkbox"
                      checked={formData.is_minimarket}
                      onChange={(e) => setFormData({ ...formData, is_minimarket: e.target.checked })}
                      style={{ 
                        width: '20px', 
                        height: '20px', 
                        cursor: 'pointer',
                        position: 'relative',
                        zIndex: 1
                      }}
                    />
                    <FontAwesomeIcon icon={faStore} style={{ color: '#D4AF37' }} />
                    <span style={{ fontWeight: '600' }}>Minimarket</span>
                    <span style={{ color: '#666', fontSize: '12px', marginLeft: '8px' }}>(Interfaz simplificada con grid de productos)</span>
                  </div>
                </div>
                {formData.is_minimarket && (
                  <div style={{ marginTop: '12px', padding: '12px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                    <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                      <FontAwesomeIcon icon={faCreditCardAlt} style={{ color: '#D4AF37', marginRight: '8px' }} />
                      Terminal Point para Minimarket
                    </label>
                    <select
                      value={formData.default_minimarket_terminal}
                      onChange={(e) => setFormData({ ...formData, default_minimarket_terminal: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        fontSize: '14px'
                      }}
                    >
                      <option value="">Seleccionar terminal...</option>
                      {terminals.map(terminal => (
                        <option key={terminal.id} value={terminal.id}>
                          {terminal.name || terminal.device_id}
                        </option>
                      ))}
                    </select>
                    {terminals.length === 0 && (
                      <p style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
                        No hay terminales registrados. <a href="/terminals" style={{ color: '#007bff' }}>Crear terminal</a>
                      </p>
                    )}
                  </div>
                )}
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
