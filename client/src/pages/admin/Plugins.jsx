import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faPlug, faToggleOn, faToggleOff, faTrash, faCog, faSave, faPuzzlePiece } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { usePlugins } from '../../context/PluginContext';

const API = 'https://srservi2.srautomatic.com';

function Plugins() {
  const { selectedStore } = useStore();
  const { refreshPlugins } = usePlugins();
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(null);
  const [settingsData, setSettingsData] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetchPlugins();
  }, []);

  const fetchPlugins = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API + '/api/admin/plugins', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPlugins(data);
      }
    } catch (err) {
      console.error('Error fetching plugins:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.zip')) {
      setMessage('Solo se aceptan archivos .zip');
      return;
    }

    setUploading(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('plugin', file);

      const response = await fetch(API + '/api/admin/plugins/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`Plugin "${data.name}" v${data.version} instalado`);
        fetchPlugins();
        refreshPlugins();
      } else {
        setMessage(data.error || 'Error al instalar plugin');
      }
    } catch (err) {
      setMessage('Error al subir el archivo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const togglePlugin = async (pluginId, isActive) => {
    try {
      const token = localStorage.getItem('token');
      const action = isActive ? 'deactivate' : 'activate';
      const response = await fetch(API + `/api/admin/plugins/${pluginId}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchPlugins();
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
        <label className={`btn btn-primary${uploading ? ' disabled' : ''}`} style={{ cursor: uploading ? 'wait' : 'pointer' }}>
          <FontAwesomeIcon icon={faUpload} />
          {uploading ? 'Instalando...' : 'Subir Plugin (.zip)'}
          <input
            type="file"
            accept=".zip"
            onChange={handleUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
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
                  <div>
                    <h3 className="plugin-card-name">{plugin.name}</h3>
                    <span className="plugin-card-version">v{plugin.version}</span>
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
                </div>

                <div className="plugin-card-actions">
                  {plugin.is_active && Object.keys(plugin.settings_schema || {}).length > 0 && (
                    <button className="btn btn-sm btn-secondary" onClick={() => openSettings(plugin)}>
                      <FontAwesomeIcon icon={faCog} /> Config
                    </button>
                  )}
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
