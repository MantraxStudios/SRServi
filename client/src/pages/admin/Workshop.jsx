import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch, faDownload, faPlug, faUser, faEnvelope, faStar,
  faUpload, faSpinner, faCheck, faClock, faTimes, faTrash, faGlobe
} from '@fortawesome/free-solid-svg-icons';
import { usePlugins } from '../../context/PluginContext';
import { getImageUrl } from '../../config.js';

const API = 'https://srservi2.srautomatic.com';

function Workshop() {
  const { refreshPlugins } = usePlugins();
  const [tab, setTab] = useState('browse');
  const [plugins, setPlugins] = useState([]);
  const [myPlugins, setMyPlugins] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(null);
  const [message, setMessage] = useState('');

  // Publish form
  const [showPublish, setShowPublish] = useState(false);
  const [publishForm, setPublishForm] = useState({ description: '', contact_email: '' });
  const [pluginFile, setPluginFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    fetchPlugins();
    fetchMyPlugins();
  }, []);

  const fetchPlugins = async () => {
    setLoading(true);
    try {
      const response = await fetch(API + `/api/workshop/plugins?search=${encodeURIComponent(search)}`);
      if (response.ok) setPlugins(await response.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyPlugins = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API + '/api/workshop/my-plugins', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) setMyPlugins(await response.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchPlugins, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const installPlugin = async (pluginId) => {
    setInstalling(pluginId);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API + `/api/workshop/install/${pluginId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`"${data.plugin?.name || pluginId}" instalado. Actívalo en Plugins.`);
        refreshPlugins();
      } else {
        setMessage(data.error || 'Error al instalar');
      }
    } catch (err) {
      setMessage('Error al instalar');
    } finally {
      setInstalling(null);
    }
  };

  const publishPlugin = async (e) => {
    e.preventDefault();
    if (!pluginFile) return setMessage('Selecciona un archivo .zip');
    if (!publishForm.contact_email) return setMessage('Ingresa un email de contacto');

    setPublishing(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('plugin', pluginFile);
      formData.append('description', publishForm.description);
      formData.append('contact_email', publishForm.contact_email);
      if (logoFile) formData.append('logo', logoFile);

      const response = await fetch(API + '/api/workshop/publish', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`"${data.name}" enviado para revisión`);
        setShowPublish(false);
        setPluginFile(null);
        setLogoFile(null);
        setPublishForm({ description: '', contact_email: '' });
        fetchMyPlugins();
      } else {
        setMessage(data.error || 'Error al publicar');
      }
    } catch (err) {
      setMessage('Error al publicar');
    } finally {
      setPublishing(false);
    }
  };

  const deleteMyPlugin = async (pluginId) => {
    if (!confirm('¿Eliminar este plugin del workshop?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(API + `/api/workshop/my-plugins/${pluginId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchMyPlugins();
    } catch (err) {
      console.error(err);
    }
  };

  const statusBadge = (status) => {
    const map = {
      pending: { icon: faClock, label: 'En revisión', cls: 'workshop-status-pending' },
      approved: { icon: faCheck, label: 'Aprobado', cls: 'workshop-status-approved' },
      rejected: { icon: faTimes, label: 'Rechazado', cls: 'workshop-status-rejected' }
    };
    const s = map[status] || map.pending;
    return <span className={`workshop-status ${s.cls}`}><FontAwesomeIcon icon={s.icon} /> {s.label}</span>;
  };

  return (
    <>
      <header className="admin-header">
        <h1><FontAwesomeIcon icon={faGlobe} /> Workshop</h1>
        <button className="btn btn-primary" onClick={() => setShowPublish(true)}>
          <FontAwesomeIcon icon={faUpload} /> Publicar Plugin
        </button>
      </header>

      <div className="admin-main">
        {message && (
          <div style={{
            padding: '12px 16px', marginBottom: '16px', borderRadius: '8px', fontWeight: '600',
            backgroundColor: message.includes('Error') || message.includes('error') ? '#f8d7da' : '#d4edda',
            color: message.includes('Error') || message.includes('error') ? '#721c24' : '#155724'
          }}>{message}</div>
        )}

        <div className="workshop-tabs">
          <button className={`workshop-tab${tab === 'browse' ? ' active' : ''}`} onClick={() => setTab('browse')}>
            <FontAwesomeIcon icon={faSearch} /> Explorar
          </button>
          <button className={`workshop-tab${tab === 'mine' ? ' active' : ''}`} onClick={() => setTab('mine')}>
            <FontAwesomeIcon icon={faUser} /> Mis Plugins
          </button>
        </div>

        {tab === 'browse' && (
          <>
            <div className="workshop-search">
              <FontAwesomeIcon icon={faSearch} className="workshop-search-icon" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar plugins..."
                className="workshop-search-input"
              />
            </div>

            {loading ? (
              <div className="loading">Cargando...</div>
            ) : plugins.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <FontAwesomeIcon icon={faPlug} style={{ fontSize: '48px', color: '#ccc', marginBottom: '16px' }} />
                  <p className="empty-state-text">
                    {search ? 'No se encontraron plugins' : 'No hay plugins disponibles aún'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="workshop-grid">
                {plugins.map(plugin => (
                  <div key={plugin.plugin_id} className="workshop-card">
                    <div className="workshop-card-top">
                      {plugin.logo ? (
                        <img src={API + plugin.logo} alt="" className="workshop-card-logo" />
                      ) : (
                        <div className="workshop-card-logo-placeholder">
                          <FontAwesomeIcon icon={faPlug} />
                        </div>
                      )}
                      <div className="workshop-card-info">
                        <h3 className="workshop-card-name">{plugin.name}</h3>
                        <span className="workshop-card-version">v{plugin.version}</span>
                        <div className="workshop-card-author">
                          <FontAwesomeIcon icon={faUser} /> {plugin.author}
                        </div>
                      </div>
                    </div>
                    {plugin.description && (
                      <p className="workshop-card-desc">{plugin.description}</p>
                    )}
                    <div className="workshop-card-footer">
                      <span className="workshop-card-downloads">
                        <FontAwesomeIcon icon={faDownload} /> {plugin.downloads || 0}
                      </span>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => installPlugin(plugin.plugin_id)}
                        disabled={installing === plugin.plugin_id}
                      >
                        {installing === plugin.plugin_id ? (
                          <><FontAwesomeIcon icon={faSpinner} spin /> Instalando...</>
                        ) : (
                          <><FontAwesomeIcon icon={faDownload} /> Instalar</>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'mine' && (
          <>
            {myPlugins.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <p className="empty-state-text">No has publicado plugins aún</p>
                </div>
              </div>
            ) : (
              <div className="workshop-grid">
                {myPlugins.map(plugin => (
                  <div key={plugin.plugin_id} className="workshop-card">
                    <div className="workshop-card-top">
                      {plugin.logo ? (
                        <img src={API + plugin.logo} alt="" className="workshop-card-logo" />
                      ) : (
                        <div className="workshop-card-logo-placeholder">
                          <FontAwesomeIcon icon={faPlug} />
                        </div>
                      )}
                      <div className="workshop-card-info">
                        <h3 className="workshop-card-name">{plugin.name}</h3>
                        <span className="workshop-card-version">v{plugin.version}</span>
                        {statusBadge(plugin.status)}
                      </div>
                    </div>
                    {plugin.description && <p className="workshop-card-desc">{plugin.description}</p>}
                    <div className="workshop-card-footer">
                      <span className="workshop-card-downloads">
                        <FontAwesomeIcon icon={faDownload} /> {plugin.downloads || 0}
                      </span>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteMyPlugin(plugin.plugin_id)}>
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showPublish && (
        <div className="modal-overlay" onClick={() => setShowPublish(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title"><FontAwesomeIcon icon={faUpload} /> Publicar Plugin</h2>
              <button className="modal-close" onClick={() => setShowPublish(false)}>&times;</button>
            </div>
            <form onSubmit={publishPlugin} style={{ padding: '0 20px 20px' }}>
              <div className="form-group">
                <label>Archivo del Plugin (.zip) *</label>
                <input
                  type="file"
                  accept=".zip"
                  onChange={(e) => setPluginFile(e.target.files[0])}
                  className="file-upload-input"
                  required
                />
                <p className="text-sm text-muted" style={{ margin: '4px 0 0' }}>
                  El título, autor y versión se toman del plugin.json dentro del ZIP.
                  El autor será el nombre de tu empresa.
                </p>
              </div>
              <div className="form-group">
                <label>Logo del Plugin</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files[0])}
                  className="file-upload-input"
                />
                {logoFile && (
                  <div className="image-preview" style={{ marginTop: '8px' }}>
                    <img src={URL.createObjectURL(logoFile)} alt="Logo" className="image-preview-img" />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Descripción *</label>
                <textarea
                  value={publishForm.description}
                  onChange={(e) => setPublishForm({ ...publishForm, description: e.target.value })}
                  rows="3"
                  placeholder="¿Qué hace tu plugin?"
                  required
                />
              </div>
              <div className="form-group">
                <label><FontAwesomeIcon icon={faEnvelope} /> Email de Contacto *</label>
                <input
                  type="email"
                  value={publishForm.contact_email}
                  onChange={(e) => setPublishForm({ ...publishForm, contact_email: e.target.value })}
                  placeholder="tu@email.com"
                  required
                />
                <p className="text-sm text-muted" style={{ margin: '4px 0 0' }}>
                  Para contactarte en caso de revisión del plugin.
                </p>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={publishing}>
                {publishing ? (
                  <><FontAwesomeIcon icon={faSpinner} spin /> Publicando...</>
                ) : (
                  <><FontAwesomeIcon icon={faUpload} /> Enviar para Revisión</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Workshop;
