import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faMoneyBillWave, faCreditCard, faCheck, faStore, faCreditCardAlt, faUtensils, faShoppingBag, faExclamationTriangle, faDesktop, faSync, faSearch } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

function Configurations() {
  const { selectedStore } = useStore();
  const [configurations, setConfigurations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [terminals, setTerminals] = useState([]);
  const [loadingTerminals, setLoadingTerminals] = useState(false);
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
    allow_takeout: true
  });
  const [error, setError] = useState('');
  const [storeCodeInput, setStoreCodeInput] = useState('');
  const [localStore, setLocalStore] = useState(null);
  const [localLoading, setLocalLoading] = useState(false);

  const loadStoreByCode = async (e) => {
    e.preventDefault();
    if (!storeCodeInput.trim()) return;
    setLocalLoading(true);
    try {
      const res = await fetch('/api/stores/code/' + storeCodeInput.trim().toUpperCase());
      if (!res.ok) { alert('Tienda no encontrada'); setLocalLoading(false); return; }
      const store = await res.json();
      setLocalStore(store);
      setStoreCodeInput('');
      const [mpRes, tuuRes] = await Promise.all([
        fetch('/api/mercado-pago-terminals?store_id=' + store.id, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }),
        fetch('/api/tuu/devices?store_id=' + store.id)
      ]);
      const mpData = mpRes.ok ? await mpRes.json() : [];
      const tuuData = tuuRes.ok ? await tuuRes.json() : {};
      const mpList = (Array.isArray(mpData) ? mpData : []).map(t => ({ id: t.id, name: t.name, provider: 'mercadopago' }));
      const tuuList = (Array.isArray(tuuData.posDevices) ? tuuData.posDevices : []).map(d => ({ id: d.id, name: d.name, provider: 'tuu' }));
      setTerminals([...mpList, ...tuuList]);
    } catch { alert('Error al buscar tienda'); }
    finally { setLocalLoading(false); }
  };

  const fetchTerminals = async () => {
    if (!selectedStore) return;
    setLoadingTerminals(true);
    const token = localStorage.getItem('token');
    try {
      const [mpRes, tuuRes] = await Promise.all([
        fetch('/api/mercado-pago-terminals?store_id=' + selectedStore.id, { headers: { Authorization: 'Bearer ' + token } }),
        fetch('/api/tuu/devices?store_id=' + selectedStore.id)
      ]);
      const mpData = mpRes.ok ? await mpRes.json() : [];
      const tuuData = tuuRes.ok ? await tuuRes.json() : {};
      const mpList = (Array.isArray(mpData) ? mpData : []).map(t => ({
        id: t.id, name: t.name, provider: 'mercadopago'
      }));
      const tuuList = (Array.isArray(tuuData.posDevices) ? tuuData.posDevices : []).map(d => ({
        id: d.id, name: d.name, provider: 'tuu'
      }));
      setTerminals([...mpList, ...tuuList]);
    } catch (error) {
      console.error('Error fetching terminals:', error);
    } finally {
      setLoadingTerminals(false);
    }
  };

  useEffect(() => {
    if (selectedStore) {
      setLoading(true);
      fetchConfigurations();
      fetchTerminals();
    } else {
      setLoading(false);
      setConfigurations([]);
      setTerminals([]);
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
        allow_takeout: true
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
      default_minimarket_terminal: config.default_minimarket_terminal || '',
      default_terminal: config.default_terminal || '',
      allow_serve: Boolean(config.allow_serve),
      allow_takeout: Boolean(config.allow_takeout)
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
      default_minimarket_terminal: '',
      default_terminal: '',
      allow_serve: true,
      allow_takeout: true
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <form onSubmit={loadStoreByCode} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="text"
              value={storeCodeInput}
              onChange={(e) => setStoreCodeInput(e.target.value)}
              placeholder="Codigo de tienda"
              style={{ padding: '6px 10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', width: '150px' }}
            />
            <button type="submit" disabled={localLoading} style={{ background: '#D4AF37', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: '#000', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FontAwesomeIcon icon={faSearch} />
            </button>
          </form>
          <button className="btn btn-primary" onClick={openModal}>
            <FontAwesomeIcon icon={faPlus} />
            Nueva Config
          </button>
        </div>
      </header>

      {localStore && (
        <div style={{ background: '#fff8e1', border: '2px solid #D4AF37', borderRadius: '12px', padding: '16px', margin: '0 24px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div>
              <strong style={{ fontSize: '15px' }}>{localStore.name || 'Tienda ' + localStore.id}</strong>
              <span style={{ marginLeft: '8px', fontSize: '12px', color: '#888' }}>Codigo: {localStore.code}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#555' }}>
                {terminals.length} POS vinculado{terminals.length !== 1 ? 's' : ''}
              </span>
              <button onClick={fetchTerminals} disabled={loadingTerminals} style={{ background: 'none', border: '1px solid #D4AF37', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer', color: '#D4AF37' }}>
                <FontAwesomeIcon icon={faSync} spin={loadingTerminals} />
              </button>
            </div>
          </div>
          {terminals.length === 0 ? (
            <p style={{ margin: 0, fontSize: '13px', color: '#888' }}>
              No hay POS vinculados a esta tienda.{' '}
              <a href="/admin/terminals" style={{ color: '#0066cc' }}>Ir a Vincular POS</a>
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {terminals.map(t => (
                <span key={t.id} style={{ background: t.provider === 'mercadopago' ? '#009ee310' : '#9c27b010', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: '700' }}>
                  {t.name} {t.provider === 'tuu' ? '(Tuu)' : '(MP)'}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

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
                <label>Opciones de Pedido</label>
                <div className="flex flex-wrap gap-3">
                  <div className={`checkbox-card ${formData.allow_serve ? 'active-green' : ''}`}>
                    <input
                      type="checkbox"
                      checked={formData.allow_serve}
                      onChange={(e) => setFormData({ ...formData, allow_serve: e.target.checked })}
                    />
                    <span className="checkbox-card-icon"><FontAwesomeIcon icon={faUtensils} /></span>
                    <div>
                      <span className="font-semibold">Comer aquí</span>
                      <span className="text-muted text-xs">Para servir en mesa</span>
                    </div>
                  </div>

                  <div className={`checkbox-card ${formData.allow_takeout ? 'active-blue' : ''}`}>
                    <input
                      type="checkbox"
                      checked={formData.allow_takeout}
                      onChange={(e) => setFormData({ ...formData, allow_takeout: e.target.checked })}
                    />
                    <span className="checkbox-card-icon"><FontAwesomeIcon icon={faShoppingBag} /></span>
                    <div>
                      <span className="font-semibold">Para llevar</span>
                      <span className="text-muted text-xs">Servicio para llevar</span>
                    </div>
                  </div>
                </div>
                {!formData.allow_serve && !formData.allow_takeout && (
                  <p className="validation-warning">
                    <FontAwesomeIcon icon={faExclamationTriangle} /> Al menos una opción de pedido debe estar habilitada
                  </p>
                )}
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
                <div className="flex gap-4">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.accept_cash}
                      onChange={(e) => setFormData({ ...formData, accept_cash: e.target.checked })}
                    />
                    <FontAwesomeIcon icon={faMoneyBillWave} className="icon-success" />
                    <span>Efectivo</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.accept_card}
                      onChange={(e) => setFormData({ ...formData, accept_card: e.target.checked })}
                    />
                    <FontAwesomeIcon icon={faCreditCard} className="icon-blue" />
                    <span>Tarjeta</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ margin: 0 }}>
                    <FontAwesomeIcon icon={faDesktop} style={{ color: '#666', marginRight: '6px' }} />
                    Terminal POS
                  </label>
                  <button
                    type="button"
                    onClick={fetchTerminals}
                    disabled={loadingTerminals || !selectedStore}
                    style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer', color: '#666' }}
                    title="Actualizar lista de POS"
                  >
                    <FontAwesomeIcon icon={faSync} spin={loadingTerminals} style={{ marginRight: '4px' }} />
                    {loadingTerminals ? 'Buscando...' : 'Actualizar'}
                  </button>
                </div>
                {selectedStore && (
                  <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#888' }}>
                    Tienda: <strong>{selectedStore.name || 'Tienda ' + selectedStore.id}</strong>
                    {terminals.length > 0 && ` · ${terminals.length} POS disponible${terminals.length !== 1 ? 's' : ''}`}
                  </p>
                )}
                <select
                  value={formData.default_terminal}
                  onChange={(e) => setFormData({ ...formData, default_terminal: e.target.value })}
                  style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', background: '#fff' }}
                >
                  <option value="">Ninguna</option>
                  {terminals.map(terminal => (
                    <option key={`${terminal.provider}-${terminal.id}`} value={terminal.id}>
                      {terminal.name} {terminal.provider === 'tuu' ? '(Tuu)' : '(MP)'}
                    </option>
                  ))}
                </select>
                {!selectedStore && (
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#d97706' }}>
                    Selecciona una tienda arriba para ver los POS disponibles
                  </p>
                )}
                {selectedStore && terminals.length === 0 && !loadingTerminals && (
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#888' }}>
                    No hay POS vinculados a esta tienda.{' '}
                    <span style={{ color: '#0066cc', cursor: 'pointer' }} onClick={() => window.location.href = '/admin/terminals'}>
                      Ir a Vincular POS
                    </span>
                  </p>
                )}
              </div>

              <div className="form-group">
                <label>Tipo de Store</label>
                <div>
                  <div className={`checkbox-card ${formData.is_minimarket ? 'active-gold' : ''}`}>
                    <input
                      type="checkbox"
                      checked={formData.is_minimarket}
                      onChange={(e) => setFormData({ ...formData, is_minimarket: e.target.checked })}
                    />
                    <FontAwesomeIcon icon={faStore} className="icon-gold" />
                    <span className="font-semibold">Minimarket</span>
                    <span className="text-muted text-xs">(Interfaz simplificada con grid de productos)</span>
                  </div>
                </div>
                {formData.is_minimarket && (
                  <div className="minimarket-terminal-section">
                    <label className="font-semibold">
                      <FontAwesomeIcon icon={faCreditCardAlt} className="icon-gold" />
                      {' '}Terminal Point para Minimarket
                    </label>
                    <select
                      value={formData.default_minimarket_terminal}
                      onChange={(e) => setFormData({ ...formData, default_minimarket_terminal: e.target.value })}
                    >
                      <option value="">Seleccionar terminal...</option>
                      {terminals.map(terminal => (
                        <option key={terminal.id} value={terminal.id}>
                          {terminal.name || terminal.device_id}
                        </option>
                      ))}
                    </select>
                    {terminals.length === 0 && (
                      <p className="text-muted text-xs">
                        No hay terminales registrados. <a href="/terminals" className="icon-blue">Crear terminal</a>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="form-group">
                <div className="flex gap-4">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <span>Activo</span>
                  </label>
                  <label className="checkbox-label">
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
