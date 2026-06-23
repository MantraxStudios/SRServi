import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCog, faPlus, faTrash, faEdit, faCheck, faEye, faEyeSlash, faTrophy, faStore } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../components/Layout';

const PRESET_COLORS = ['#22c55e', '#D4AF37', '#3b82f6', '#ef4444', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#0a0a0a', '#6b7280'];

const ALL_TABS = [
  { key: 'ventarapida', label: 'Venta rápida' },
  { key: 'active', label: 'Pedidos' },
  { key: 'completed', label: 'Completados' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'mesas', label: 'Mesas' },
  { key: 'tasks', label: 'Tareas' },
  { key: 'procedures', label: 'Guías' },
  { key: 'rankings', label: 'Rankings' },
  { key: 'comments', label: 'Comentarios' },
];

function WorkerConfig() {
  const { token } = useAuth();
  const { selectedStore } = useStore();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#D4AF37');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [panelTabs, setPanelTabs] = useState({});
  const [tabsSaving, setTabsSaving] = useState(false);
  const [allStores, setAllStores] = useState([]);
  const [rankingStoreIds, setRankingStoreIds] = useState([]);
  const [rankingSaving, setRankingSaving] = useState(false);

  useEffect(() => {
    if (selectedStore) {
      fetchMethods();
      fetchStoreConfig();
      fetchAllStores();
    } else {
      setLoading(false);
      setMethods([]);
    }
  }, [selectedStore]);

  const fetchStoreConfig = async () => {
    try {
      const res = await fetch(`/api/stores/${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.worker_panel_tabs) {
          try { setPanelTabs(typeof data.worker_panel_tabs === 'string' ? JSON.parse(data.worker_panel_tabs) : data.worker_panel_tabs); } catch { setPanelTabs({}); }
        }
        if (data.ranking_store_ids) {
          try {
            const ids = typeof data.ranking_store_ids === 'string' ? JSON.parse(data.ranking_store_ids) : data.ranking_store_ids;
            setRankingStoreIds(Array.isArray(ids) ? ids : []);
          } catch { setRankingStoreIds([]); }
        }
      }
    } catch {}
  };

  const fetchAllStores = async () => {
    try {
      const res = await fetch('/api/stores', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setAllStores(Array.isArray(data) ? data : []);
      }
    } catch {}
  };

  const isTabEnabled = (key) => panelTabs[key] !== false;

  const toggleTab = (key) => {
    setPanelTabs(prev => ({ ...prev, [key]: prev[key] === false ? true : false }));
  };

  const savePanelTabs = async () => {
    setTabsSaving(true);
    try {
      const res = await fetch(`/api/stores/${selectedStore.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: selectedStore.name, primary_color: selectedStore.primary_color, secondary_color: selectedStore.secondary_color, accent_color: selectedStore.accent_color, header_color: selectedStore.header_color, currency_code: selectedStore.currency_code, currency_symbol: selectedStore.currency_symbol, currency_name: selectedStore.currency_name, worker_panel_tabs: JSON.stringify(panelTabs) })
      });
      if (res.ok) { setSuccess('Pestañas guardadas'); setTimeout(() => setSuccess(''), 3000); }
    } catch {} finally { setTabsSaving(false); }
  };

  const toggleRankingStore = (storeId) => {
    setRankingStoreIds(prev => prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]);
  };

  const saveRankingStores = async () => {
    setRankingSaving(true);
    try {
      const res = await fetch(`/api/stores/${selectedStore.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: selectedStore.name, primary_color: selectedStore.primary_color, secondary_color: selectedStore.secondary_color, accent_color: selectedStore.accent_color, header_color: selectedStore.header_color, currency_code: selectedStore.currency_code, currency_symbol: selectedStore.currency_symbol, currency_name: selectedStore.currency_name, ranking_store_ids: JSON.stringify(rankingStoreIds) })
      });
      if (res.ok) { setSuccess('Sucursales de ranking guardadas'); setTimeout(() => setSuccess(''), 3000); }
    } catch {} finally { setRankingSaving(false); }
  };

  const fetchMethods = async () => {
    try {
      const response = await fetch(`/api/worker-payment-methods?store_id=${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMethods(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openForm = (method = null) => {
    if (method) {
      setEditingMethod(method);
      setFormName(method.name);
      setFormColor(method.color);
    } else {
      setEditingMethod(null);
      setFormName('');
      setFormColor('#D4AF37');
    }
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      setError('El nombre es requerido');
      return;
    }

    try {
      const url = editingMethod
        ? `/api/worker-payment-methods/${editingMethod.id}`
        : '/api/worker-payment-methods';

      const response = await fetch(url, {
        method: editingMethod ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          store_id: selectedStore.id,
          name: formName.trim(),
          color: formColor
        })
      });

      if (!response.ok) throw new Error('Error al guardar');

      setShowForm(false);
      setSuccess(editingMethod ? 'Metodo actualizado' : 'Metodo creado');
      setTimeout(() => setSuccess(''), 3000);
      fetchMethods();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminar este metodo de pago?')) return;
    try {
      await fetch(`/api/worker-payment-methods/${id}?store_id=${selectedStore.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchMethods();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  if (!selectedStore) {
    return (
      <>
        <header className="admin-header"><h1>Config. Vendedor</h1></header>
        <div className="admin-main">
          <div className="card empty-state">
            <p className="empty-state-text">Selecciona una tienda</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="admin-header">
        <h1>Config. Vendedor</h1>
      </header>
      <div className="admin-main">
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        {/* Panel tabs config */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h3 className="card-title">
              <FontAwesomeIcon icon={faEye} /> Menú del panel vendedor
            </h3>
          </div>
          <p className="text-muted text-sm" style={{ marginBottom: '16px' }}>
            Activa o desactiva las secciones que aparecen en el panel del vendedor.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            {ALL_TABS.map(tab => {
              const enabled = isTabEnabled(tab.key);
              return (
                <button
                  key={tab.key}
                  onClick={() => toggleTab(tab.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                    border: enabled ? '2px solid #D4AF37' : '2px solid #e5e7eb',
                    background: enabled ? 'rgba(212,175,55,0.08)' : '#f9fafb',
                    color: enabled ? '#000' : '#9ca3af',
                    fontWeight: 600, fontSize: '13px', textAlign: 'left'
                  }}
                >
                  <FontAwesomeIcon icon={enabled ? faEye : faEyeSlash} style={{ color: enabled ? '#D4AF37' : '#d1d5db', fontSize: '14px' }} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <button className="btn btn-primary" onClick={savePanelTabs} disabled={tabsSaving} style={{ fontSize: '13px' }}>
            {tabsSaving ? 'Guardando...' : 'Guardar pestañas'}
          </button>
        </div>

        {/* Ranking stores config */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h3 className="card-title">
              <FontAwesomeIcon icon={faTrophy} /> Ranking de sucursales
            </h3>
          </div>
          <p className="text-muted text-sm" style={{ marginBottom: '16px' }}>
            Selecciona las sucursales que participan en el ranking visible para los vendedores.
          </p>
          {allStores.length === 0 ? (
            <p className="text-muted text-sm">No hay sucursales disponibles.</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {allStores.map(store => {
                  const selected = rankingStoreIds.includes(store.id);
                  return (
                    <button
                      key={store.id}
                      onClick={() => toggleRankingStore(store.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
                        border: selected ? '2px solid #D4AF37' : '1px solid #e5e7eb',
                        background: selected ? 'rgba(212,175,55,0.08)' : '#fff',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '6px',
                        background: selected ? '#D4AF37' : '#f3f4f6',
                        border: selected ? 'none' : '1px solid #d1d5db',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {selected && <FontAwesomeIcon icon={faCheck} style={{ fontSize: '11px', color: '#fff' }} />}
                      </div>
                      <FontAwesomeIcon icon={faStore} style={{ color: '#6b7280', fontSize: '13px' }} />
                      <span style={{ fontWeight: 600, fontSize: '13px', color: '#374151' }}>{store.name}</span>
                      <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: 'auto' }}>{store.code}</span>
                    </button>
                  );
                })}
              </div>
              <button className="btn btn-primary" onClick={saveRankingStores} disabled={rankingSaving} style={{ fontSize: '13px' }}>
                {rankingSaving ? 'Guardando...' : 'Guardar ranking'}
              </button>
            </>
          )}
        </div>

        {/* Payment methods */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">
              <FontAwesomeIcon icon={faUserCog} /> Métodos de pago manual
            </h3>
            <button className="btn btn-primary btn-sm" onClick={() => openForm()}>
              <FontAwesomeIcon icon={faPlus} /> Nuevo
            </button>
          </div>
          <p className="text-muted text-sm" style={{ marginBottom: '20px' }}>
            Configura el método de pago manual cuando el vendedor no use el tótem y necesite registrar la venta en el sistema.
          </p>

          {loading ? (
            <div className="empty-state"><p>Cargando...</p></div>
          ) : methods.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-text">No hay metodos de pago. Crea el primero.</p>
            </div>
          ) : (
            <div className="worker-config-methods-grid">
              {methods.map(method => (
                <div key={method.id} className="worker-config-method-card">
                  <div className="worker-config-method-color" style={{ backgroundColor: method.color }} />
                  <div className="worker-config-method-info">
                    <span className="worker-config-method-name">{method.name}</span>
                  </div>
                  <div className="worker-config-method-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => openForm(method)}>
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(method.id)}>
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">{editingMethod ? 'Editar metodo' : 'Nuevo metodo de pago'}</h3>
                <button className="modal-close" onClick={() => setShowForm(false)}>
                  <FontAwesomeIcon icon={faPlus} style={{ transform: 'rotate(45deg)' }} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Nombre</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej: Efectivo, Tarjeta, Transferencia, Nequi..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Color</label>
                  <div className="worker-config-color-picker">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`worker-config-color-dot${formColor === color ? ' active' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormColor(color)}
                      >
                        {formColor === color && <FontAwesomeIcon icon={faCheck} />}
                      </button>
                    ))}
                    <input
                      type="color"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="worker-config-color-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Vista previa</label>
                  <div className="worker-config-preview">
                    <div className="worker-config-preview-btn" style={{ backgroundColor: formColor }}>
                      {formName || 'Metodo de pago'}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3" style={{ marginTop: '20px' }}>
                  <button type="button" className="btn btn-secondary flex-1" onClick={() => setShowForm(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary flex-1">
                    {editingMethod ? 'Guardar' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default WorkerConfig;
