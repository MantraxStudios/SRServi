import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faMoneyBillWave, faCreditCard, faCheck, faStore, faCreditCardAlt, faUtensils, faShoppingBag, faExclamationTriangle, faDesktop } from '@fortawesome/free-solid-svg-icons';
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
    is_default: false,
    is_minimarket: false,
    default_minimarket_terminal: '',
    default_terminal: '',
    allow_serve: true,
    allow_takeout: true,
    hide_decimals: false
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

    if (!formData.allow_serve && !formData.allow_takeout) {
      setError('Debes habilitar al menos una opción de pedido (comer aquí o llevar)');
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
        is_minimarket: false,
        default_minimarket_terminal: '',
        allow_serve: true,
        allow_takeout: true,
        hide_decimals: false
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
      is_default: Boolean(config.is_default),
      is_minimarket: Boolean(config.is_minimarket),
      default_minimarket_terminal: config.default_minimarket_terminal || '',
      default_terminal: config.default_terminal || '',
      allow_serve: Boolean(config.allow_serve),
      allow_takeout: Boolean(config.allow_takeout),
      hide_decimals: Boolean(config.hide_decimals)
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
      is_default: false,
      is_minimarket: false,
      default_minimarket_terminal: '',
      default_terminal: '',
      allow_serve: true,
      allow_takeout: true,
      hide_decimals: false
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
            <div className="empty-state">
              <p className="empty-state-text">
                No hay configuraciones. Crea una para definir los metodos de pago disponibles.
              </p>
            </div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Efectivo</th>
                    <th>Tarjeta</th>
                    <th>POS</th>
                    <th>Activo</th>
                    <th>Predeterminada</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                {configurations.map(config => (
                  <tr key={config.id}>
                    <td className="font-semibold">{config.name}</td>
                    <td>
                      {config.accept_cash ? (
                        <span className="icon-success"><FontAwesomeIcon icon={faCheck} /></span>
                      ) : (
                        <span className="icon-danger">-</span>
                      )}
                    </td>
                    <td>
                      {config.accept_card ? (
                        <span className="icon-success"><FontAwesomeIcon icon={faCheck} /></span>
                      ) : (
                        <span className="icon-danger">-</span>
                      )}
                    </td>
                    <td>
                      {config.default_terminal ? (
                        <span style={{ fontSize: '12px', color: '#555' }}>
                          <FontAwesomeIcon icon={faDesktop} style={{ color: '#666', marginRight: '4px' }} />
                          #{config.default_terminal}
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
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
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleEdit(config)}
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(config.id)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
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
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingConfig ? 'Editar Configuracion' : 'Nueva Configuracion'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="error" style={{ marginBottom: '16px' }}>{error}</div>}

              <div className="form-group">
                <label>Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Ej: Tarjeta + Efectivo"
                />
              </div>

              <div className="form-group">
                <label>Descripcion <span style={{ fontWeight: 400, color: '#aaa', fontSize: '12px' }}>(opcional)</span></label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ej: Solo pagos con tarjeta de credito o debito"
                />
              </div>

              <div className="form-group">
                <label>Métodos de Pago</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, accept_cash: !p.accept_cash }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px',
                      borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s',
                      border: `2px solid ${formData.accept_cash ? '#16a34a' : '#e0e0e0'}`,
                      background: formData.accept_cash ? '#f0fdf4' : '#fafafa',
                      color: formData.accept_cash ? '#15803d' : '#666'
                    }}
                  >
                    <FontAwesomeIcon icon={faMoneyBillWave} style={{ fontSize: '20px', color: formData.accept_cash ? '#16a34a' : '#aaa' }} />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: '700', fontSize: '14px' }}>Efectivo</div>
                      <div style={{ fontSize: '11px', opacity: 0.7 }}>Pago en caja</div>
                    </div>
                    {formData.accept_cash && <FontAwesomeIcon icon={faCheck} style={{ marginLeft: 'auto', color: '#16a34a' }} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, accept_card: !p.accept_card }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px',
                      borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s',
                      border: `2px solid ${formData.accept_card ? '#2563eb' : '#e0e0e0'}`,
                      background: formData.accept_card ? '#eff6ff' : '#fafafa',
                      color: formData.accept_card ? '#1d4ed8' : '#666'
                    }}
                  >
                    <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: '20px', color: formData.accept_card ? '#2563eb' : '#aaa' }} />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: '700', fontSize: '14px' }}>Tarjeta / POS</div>
                      <div style={{ fontSize: '11px', opacity: 0.7 }}>Débito · Crédito · QR</div>
                    </div>
                    {formData.accept_card && <FontAwesomeIcon icon={faCheck} style={{ marginLeft: 'auto', color: '#2563eb' }} />}
                  </button>
                </div>
                {!formData.accept_cash && !formData.accept_card && (
                  <p className="validation-warning" style={{ marginTop: '8px' }}>
                    <FontAwesomeIcon icon={faExclamationTriangle} /> Debes habilitar al menos un método de pago
                  </p>
                )}
              </div>

              <div className="form-group">
                <label>Tipo de Pedido</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, allow_serve: !p.allow_serve }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px',
                      borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s',
                      border: `2px solid ${formData.allow_serve ? '#16a34a' : '#e0e0e0'}`,
                      background: formData.allow_serve ? '#f0fdf4' : '#fafafa',
                      color: formData.allow_serve ? '#15803d' : '#666'
                    }}
                  >
                    <FontAwesomeIcon icon={faUtensils} style={{ fontSize: '18px', color: formData.allow_serve ? '#16a34a' : '#aaa' }} />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: '700', fontSize: '14px' }}>Comer aquí</div>
                      <div style={{ fontSize: '11px', opacity: 0.7 }}>Servir en mesa</div>
                    </div>
                    {formData.allow_serve && <FontAwesomeIcon icon={faCheck} style={{ marginLeft: 'auto', color: '#16a34a' }} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, allow_takeout: !p.allow_takeout }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px',
                      borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s',
                      border: `2px solid ${formData.allow_takeout ? '#2563eb' : '#e0e0e0'}`,
                      background: formData.allow_takeout ? '#eff6ff' : '#fafafa',
                      color: formData.allow_takeout ? '#1d4ed8' : '#666'
                    }}
                  >
                    <FontAwesomeIcon icon={faShoppingBag} style={{ fontSize: '18px', color: formData.allow_takeout ? '#2563eb' : '#aaa' }} />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: '700', fontSize: '14px' }}>Para llevar</div>
                      <div style={{ fontSize: '11px', opacity: 0.7 }}>Pedido para llevar</div>
                    </div>
                    {formData.allow_takeout && <FontAwesomeIcon icon={faCheck} style={{ marginLeft: 'auto', color: '#2563eb' }} />}
                  </button>
                </div>
                {!formData.allow_serve && !formData.allow_takeout && (
                  <p className="validation-warning" style={{ marginTop: '8px' }}>
                    <FontAwesomeIcon icon={faExclamationTriangle} /> Al menos una opción de pedido debe estar habilitada
                  </p>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, is_minimarket: !p.is_minimarket }))}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px 8px',
                    borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s',
                    border: `2px solid ${formData.is_minimarket ? '#D4AF37' : '#e0e0e0'}`,
                    background: formData.is_minimarket ? '#fffbeb' : '#fafafa',
                    color: formData.is_minimarket ? '#92400e' : '#666'
                  }}
                >
                  <FontAwesomeIcon icon={faStore} style={{ fontSize: '18px', color: formData.is_minimarket ? '#D4AF37' : '#aaa' }} />
                  <span style={{ fontSize: '12px', fontWeight: '700' }}>Minimarket</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, is_active: !p.is_active }))}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px 8px',
                    borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s',
                    border: `2px solid ${formData.is_active ? '#16a34a' : '#e0e0e0'}`,
                    background: formData.is_active ? '#f0fdf4' : '#fafafa',
                    color: formData.is_active ? '#15803d' : '#666'
                  }}
                >
                  <FontAwesomeIcon icon={faCheck} style={{ fontSize: '18px', color: formData.is_active ? '#16a34a' : '#aaa' }} />
                  <span style={{ fontSize: '12px', fontWeight: '700' }}>Activo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, is_default: !p.is_default }))}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px 8px',
                    borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s',
                    border: `2px solid ${formData.is_default ? '#7c3aed' : '#e0e0e0'}`,
                    background: formData.is_default ? '#f5f3ff' : '#fafafa',
                    color: formData.is_default ? '#6d28d9' : '#666'
                  }}
                >
                  <FontAwesomeIcon icon={faCheck} style={{ fontSize: '18px', color: formData.is_default ? '#7c3aed' : '#aaa' }} />
                  <span style={{ fontSize: '12px', fontWeight: '700' }}>Predeterminada</span>
                </button>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, hide_decimals: !p.hide_decimals }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', width: '100%',
                    borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s',
                    border: `2px solid ${formData.hide_decimals ? '#475569' : '#e0e0e0'}`,
                    background: formData.hide_decimals ? '#f8fafc' : '#fafafa',
                    color: formData.hide_decimals ? '#1e293b' : '#888'
                  }}
                >
                  <FontAwesomeIcon icon={faCreditCardAlt} style={{ fontSize: '16px', color: formData.hide_decimals ? '#475569' : '#ccc' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>Ocultar decimales (.00)</div>
                    <div style={{ fontSize: '11px', opacity: 0.65 }}>Los precios enteros no mostrarán centavos</div>
                  </div>
                  {formData.hide_decimals && <FontAwesomeIcon icon={faCheck} style={{ marginLeft: 'auto', color: '#475569' }} />}
                </button>
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
