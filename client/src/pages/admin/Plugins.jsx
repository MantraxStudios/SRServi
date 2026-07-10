import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faPlug, faToggleOn, faToggleOff, faTrash, faCog, faSave, faPuzzlePiece, faGlobe, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { usePlugins } from '../../context/PluginContext';
import { COUNTRIES, DEFAULT_COUNTRY, getCountry, loadPluginCountries, setPluginCountries, getPluginCountries } from '../../constants/pos';

const API = 'https://srservi2.srautomatic.com';

function Plugins() {
  const navigate = useNavigate();
  const { selectedStore } = useStore();
  const { refreshPlugins, registry, installedPlugins, setPluginActive, fetchInstalledPlugins } = usePlugins();
  // plugins derived from shared context state — always in sync with other pages
  const plugins = installedPlugins;
  const setPlugins = () => {}; // no-op, kept for backwards compat in other places
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(null);
  const [settingsData, setSettingsData] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Upload flow con selección de país
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadCountries, setUploadCountries] = useState([DEFAULT_COUNTRY]);

  // Países por plugin (almacenado en localStorage, cliente-only)
  const [pluginCountriesMap, setPluginCountriesMap] = useState({});
  const [editingCountriesOf, setEditingCountriesOf] = useState(null);
  const [editCountriesDraft, setEditCountriesDraft] = useState([]);

  useEffect(() => {
    setPluginCountriesMap(loadPluginCountries());
    // NOTA: NO re-fetcheamos installedPlugins — usamos el state compartido del PluginContext.
  }, []);

  // fetchPlugins ahora es un wrapper del fetch compartido en PluginContext
  const fetchPlugins = fetchInstalledPlugins;

  const openUploadModal = () => {
    setUploadFile(null);
    setUploadCountries([DEFAULT_COUNTRY]);
    setUploadModalOpen(true);
  };

  const toggleUploadCountry = (code) => {
    setUploadCountries(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.zip')) {
      setMessage('Solo se aceptan archivos .zip');
      return;
    }
    setUploadFile(file);
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      setMessage('Selecciona un archivo .zip primero');
      return;
    }
    if (uploadCountries.length === 0) {
      setMessage('Selecciona al menos un país para el plugin');
      return;
    }

    setUploading(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('plugin', uploadFile);
      formData.append('countries', JSON.stringify(uploadCountries));

      const response = await fetch(API + '/api/admin/plugins/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();
      if (response.ok) {
        // Guardar países localmente asociados al plugin instalado
        const pluginId = data.plugin_id || data.id;
        if (pluginId) {
          setPluginCountries(pluginId, uploadCountries);
          setPluginCountriesMap(loadPluginCountries());
        }
        setMessage(`Plugin "${data.name}" v${data.version} instalado`);
        setUploadModalOpen(false);
        setUploadFile(null);
        setUploadCountries([DEFAULT_COUNTRY]);
        fetchPlugins();
        refreshPlugins();
      } else {
        setMessage(data.error || 'Error al instalar plugin');
      }
    } catch (err) {
      setMessage('Error al subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  const openCountryEditor = (plugin) => {
    const current = getPluginCountries(plugin.plugin_id);
    setEditCountriesDraft(current.length ? current : [DEFAULT_COUNTRY]);
    setEditingCountriesOf(plugin);
  };

  const toggleEditCountry = (code) => {
    setEditCountriesDraft(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const saveCountriesForPlugin = () => {
    if (!editingCountriesOf) return;
    setPluginCountries(editingCountriesOf.plugin_id, editCountriesDraft);
    setPluginCountriesMap(loadPluginCountries());
    setEditingCountriesOf(null);
  };

  const togglePlugin = async (pluginId, currentlyActiveRaw) => {
    const currentlyActive = currentlyActiveRaw === true || currentlyActiveRaw === 1 || currentlyActiveRaw === '1';
    const nextActive = !currentlyActive;
    try {
      const token = localStorage.getItem('token');
      const action = currentlyActive ? 'deactivate' : 'activate';
      const response = await fetch(API + `/api/admin/plugins/${pluginId}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        // Optimistic update en el state COMPARTIDO del contexto
        setPluginActive(pluginId, nextActive);
        refreshPlugins();
      }
    } catch (err) {
      console.error('Error toggling plugin:', err);
    }
  };

  const uninstallPlugin = async (pluginId, name) => {
    if (!confirm(`¿Estás seguro de desinstalar "${name}"? Se eliminará completamente.`)) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API + `/api/admin/plugins/${pluginId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setMessage(`Plugin "${name}" desinstalado`);
        fetchPlugins();
        refreshPlugins();
      }
    } catch (err) {
      console.error('Error uninstalling plugin:', err);
    }
  };

  const openSettings = async (plugin) => {
    if (!selectedStore) {
      alert('Selecciona una tienda primero');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API + `/api/admin/plugins/${plugin.plugin_id}/settings/${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSettingsData(data);
        setSettingsOpen(plugin);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  const saveSettings = async () => {
    if (!settingsOpen || !selectedStore) return;
    setSavingSettings(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API + `/api/admin/plugins/${settingsOpen.plugin_id}/settings/${selectedStore.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settingsData)
      });
      if (response.ok) {
        setMessage('Configuración guardada');
        setTimeout(() => setMessage(''), 2000);
        setSettingsOpen(null);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const renderSettingsField = (key, schema) => {
    const value = settingsData[key] !== undefined ? settingsData[key] : (schema.default || '');

    if (schema.type === 'boolean') {
      return (
        <div className="form-group" key={key}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => setSettingsData({ ...settingsData, [key]: e.target.checked })}
            />
            {schema.label || key}
          </label>
        </div>
      );
    }

    if (schema.type === 'number') {
      return (
        <div className="form-group" key={key}>
          <label>{schema.label || key}</label>
          <input
            type="number"
            value={value}
            onChange={(e) => setSettingsData({ ...settingsData, [key]: parseFloat(e.target.value) || 0 })}
            placeholder={schema.placeholder || ''}
          />
        </div>
      );
    }

    if (schema.type === 'select' && schema.options) {
      return (
        <div className="form-group" key={key}>
          <label>{schema.label || key}</label>
          <select
            value={value}
            onChange={(e) => setSettingsData({ ...settingsData, [key]: e.target.value })}
          >
            {schema.options.map(opt => (
              <option key={opt.value || opt} value={opt.value || opt}>
                {opt.label || opt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    // Default: string
    return (
      <div className="form-group" key={key}>
        <label>{schema.label || key}</label>
        <input
          type={schema.secret ? 'password' : 'text'}
          value={value}
          onChange={(e) => setSettingsData({ ...settingsData, [key]: e.target.value })}
          placeholder={schema.placeholder || ''}
        />
      </div>
    );
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <>
      <header className="admin-header">
        <h1>
          <FontAwesomeIcon icon={faPuzzlePiece} /> Plugins
        </h1>
        <button className="btn btn-primary" onClick={openUploadModal} disabled={uploading}>
          <FontAwesomeIcon icon={faUpload} />
          {uploading ? 'Instalando...' : 'Subir Plugin (.zip)'}
        </button>
      </header>

      <div className="admin-main">
        {message && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '8px',
            backgroundColor: message.includes('Error') || message.includes('Solo') ? '#f8d7da' : '#d4edda',
            color: message.includes('Error') || message.includes('Solo') ? '#721c24' : '#155724',
            fontWeight: '600'
          }}>
            {message}
          </div>
        )}

        {plugins.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <FontAwesomeIcon icon={faPuzzlePiece} style={{ fontSize: '48px', color: '#ccc', marginBottom: '16px' }} />
              <p className="empty-state-text">No hay plugins instalados.</p>
              <p style={{ color: '#999', fontSize: '14px' }}>
                Sube un archivo .zip con un plugin para empezar.
              </p>
            </div>
          </div>
        ) : (
          <div className="plugins-grid">
            {plugins.map(plugin => (
              <div key={plugin.plugin_id} className={`plugin-card${plugin.is_active ? ' active' : ''}`}>
                <div className="plugin-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {plugin.logo ? (
                      <img src={API + plugin.logo} alt="" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e0e0e0' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FontAwesomeIcon icon={faPuzzlePiece} style={{ fontSize: '18px', color: '#bbb' }} />
                      </div>
                    )}
                    <div>
                      <h3 className="plugin-card-name">{plugin.name}</h3>
                      <span className="plugin-card-version">v{plugin.version}</span>
                    </div>
                  </div>
                  <button
                    className={`plugin-toggle-btn${plugin.is_active ? ' active' : ''}`}
                    onClick={() => togglePlugin(plugin.plugin_id, plugin.is_active)}
                    title={plugin.is_active ? 'Desactivar' : 'Activar'}
                  >
                    <FontAwesomeIcon icon={plugin.is_active ? faToggleOn : faToggleOff} />
                  </button>
                </div>

                {plugin.description && (
                  <p className="plugin-card-desc">{plugin.description}</p>
                )}

                {plugin.author && (
                  <p className="plugin-card-author">Por {plugin.author}</p>
                )}

                <div className="plugin-card-meta">
                  {plugin.hooks && plugin.hooks.length > 0 && (
                    <span className="plugin-badge">
                      <FontAwesomeIcon icon={faPlug} /> {plugin.hooks.length} hook{plugin.hooks.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {plugin.is_active && (
                    <span className="plugin-badge active">Activo</span>
                  )}
                  {(pluginCountriesMap[plugin.plugin_id] || []).map(code => {
                    const c = getCountry(code);
                    return (
                      <span key={code} className="plugin-badge" style={{ background: '#f0f0f0', color: '#333' }}>
                        {c.flag} {c.code}
                      </span>
                    );
                  })}
                  <button
                    onClick={() => openCountryEditor(plugin)}
                    title="Editar países"
                    style={{ background: 'none', border: '1px dashed #ccc', borderRadius: '10px', padding: '2px 8px', fontSize: '10px', cursor: 'pointer', color: '#666' }}
                  >
                    <FontAwesomeIcon icon={faGlobe} /> {(pluginCountriesMap[plugin.plugin_id] || []).length === 0 ? 'Asignar país' : 'Editar'}
                  </button>
                </div>

                <div className="plugin-card-actions">
                  {plugin.is_active && (() => {
                    // Usamos datos de DB (siempre disponibles) para decidir si mostrar el botón.
                    // El registry runtime puede estar vacío justo al activar el plugin.
                    const hasSettings = Object.keys(plugin.settings_schema || {}).length > 0;
                    const hasAdminUI = Array.isArray(plugin.admin_slots) && plugin.admin_slots.length > 0;
                    if (!hasSettings && !hasAdminUI) return null;

                    const handleClick = () => {
                      // Al click decidimos destino según lo que esté cargado runtime
                      const def = registry[plugin.plugin_id];
                      const hasAdminPageRuntime = !!(def?.adminPage || def?.slots?.['admin-page']);
                      if (hasAdminPageRuntime || hasAdminUI) {
                        navigate(`/admin/plugins/${plugin.plugin_id}`);
                      } else if (hasSettings) {
                        openSettings(plugin);
                      }
                    };

                    return (
                      <button className="btn btn-sm btn-secondary" onClick={handleClick}>
                        <FontAwesomeIcon icon={hasAdminUI ? faExternalLinkAlt : faCog} /> Config
                      </button>
                    );
                  })()}
                  <button className="btn btn-sm btn-danger" onClick={() => uninstallPlugin(plugin.plugin_id, plugin.name)}>
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ marginTop: '24px' }}>
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 12px' }}>Estructura de un Plugin</h3>
            <pre style={{
              background: '#1e1e1e',
              color: '#d4d4d4',
              padding: '16px',
              borderRadius: '8px',
              fontSize: '13px',
              overflow: 'auto',
              lineHeight: '1.6'
            }}>
{`mi-plugin/
  plugin.json     → Metadata y configuración
  server.js       → Hooks del servidor (eventos)
  admin.js        → UI para el panel admin
  store.js        → UI para la tienda pública

// plugin.json
{
  "id": "mi-plugin",
  "name": "Mi Plugin",
  "version": "1.0.0",
  "description": "Descripción del plugin",
  "author": "Tu Nombre",
  "hooks": ["order_created", "payment_completed"],
  "adminSlots": ["sidebar", "dashboard-widgets"],
  "storeSlots": ["store-header", "store-footer"],
  "settings": {
    "apiKey": { "type": "string", "label": "API Key" },
    "enabled": { "type": "boolean", "label": "Activar", "default": true }
  },
  "routes": true
}

// Hooks disponibles:
// order_created, order_updated
// payment_started, payment_completed, payment_failed
// product_created, product_updated, product_deleted`}
            </pre>
          </div>
        </div>
      </div>

      {/* Upload modal con selector de país */}
      {uploadModalOpen && (
        <div className="modal-overlay" onClick={() => !uploading && setUploadModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                <FontAwesomeIcon icon={faUpload} /> Subir Plugin
              </h2>
              <button className="modal-close" onClick={() => !uploading && setUploadModalOpen(false)}>&times;</button>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <div className="form-group">
                <label>Archivo .zip *</label>
                <input type="file" accept=".zip" onChange={handleFileChange} disabled={uploading} />
                {uploadFile && (
                  <small style={{ color: '#2ecc71', fontSize: '11px' }}>
                    <FontAwesomeIcon icon={faUpload} /> {uploadFile.name}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>
                  <FontAwesomeIcon icon={faGlobe} /> Países donde funciona el plugin *
                </label>
                <small style={{ display: 'block', color: '#888', fontSize: '11px', marginBottom: '8px' }}>
                  Selecciona los países en los que este plugin está disponible. Aparecerá en "Vincular POS" para los usuarios de esos países.
                </small>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: '6px',
                  marginTop: '8px'
                }}>
                  {COUNTRIES.map(c => {
                    const selected = uploadCountries.includes(c.code);
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => toggleUploadCountry(c.code)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '8px 10px',
                          background: selected ? '#D4AF3722' : '#fff',
                          border: selected ? '2px solid #D4AF37' : '1px solid #e5e7eb',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: selected ? '700' : '500',
                          color: '#111',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{ fontSize: '16px' }}>{c.flag}</span>
                        <span>{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 justify-end" style={{ marginTop: '16px' }}>
                <button className="btn btn-secondary" onClick={() => setUploadModalOpen(false)} disabled={uploading}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleUpload} disabled={uploading || !uploadFile}>
                  <FontAwesomeIcon icon={faUpload} /> {uploading ? 'Instalando...' : 'Instalar plugin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar países de un plugin instalado */}
      {editingCountriesOf && (
        <div className="modal-overlay" onClick={() => setEditingCountriesOf(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                <FontAwesomeIcon icon={faGlobe} /> Países — {editingCountriesOf.name}
              </h2>
              <button className="modal-close" onClick={() => setEditingCountriesOf(null)}>&times;</button>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <p style={{ color: '#6b7280', fontSize: '13px', marginTop: 0 }}>
                Estos son los países en los que este plugin aparecerá como POS disponible.
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '6px',
                marginTop: '12px'
              }}>
                {COUNTRIES.map(c => {
                  const selected = editCountriesDraft.includes(c.code);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => toggleEditCountry(c.code)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 10px',
                        background: selected ? '#D4AF3722' : '#fff',
                        border: selected ? '2px solid #D4AF37' : '1px solid #e5e7eb',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: selected ? '700' : '500',
                        color: '#111',
                        textAlign: 'left'
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>{c.flag}</span>
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3 justify-end" style={{ marginTop: '16px' }}>
                <button className="btn btn-secondary" onClick={() => setEditingCountriesOf(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={saveCountriesForPlugin}>
                  <FontAwesomeIcon icon={faSave} /> Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <FontAwesomeIcon icon={faCog} /> {settingsOpen.name} - Configuración
              </h2>
              <button className="modal-close" onClick={() => setSettingsOpen(null)}>
                &times;
              </button>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <p style={{ color: '#666', fontSize: '14px', margin: '0 0 16px' }}>
                Configuración para: <strong>{selectedStore?.name}</strong>
              </p>
              {Object.entries(settingsOpen.settings_schema || {}).map(([key, schema]) =>
                renderSettingsField(key, schema)
              )}
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="btn btn-primary btn-full"
                style={{ marginTop: '12px' }}
              >
                <FontAwesomeIcon icon={faSave} />
                {savingSettings ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Plugins;
