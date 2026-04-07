import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch, faDownload, faPlug, faUser, faEnvelope,
  faUpload, faSpinner, faCheck, faClock, faTimes, faTrash, faGlobe,
  faCodeBranch, faChevronDown, faChevronUp
} from '@fortawesome/free-solid-svg-icons';
import { usePlugins } from '../../context/PluginContext';

const API = 'https://srservi2.srautomatic.com';

function Workshop() {
  const { refreshPlugins } = usePlugins();
  const [tab, setTab] = useState('browse');
  const [plugins, setPlugins] = useState([]);
  const [myPlugins, setMyPlugins] = useState([]);
  const [installedIds, setInstalledIds] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(null);
  const [message, setMessage] = useState('');
  const [expandedVersions, setExpandedVersions] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Publish form
  const [showPublish, setShowPublish] = useState(false);
  const [publishForm, setPublishForm] = useState({ description: '', contact_email: '', changelog: '' });
  const [pluginFile, setPluginFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    fetchPlugins();
    fetchMyPlugins();
    fetchInstalledIds();
  }, []);

  const fetchPlugins = async () => {
    setLoading(true);
    try {
      const response = await fetch(API + `/api/workshop/plugins?search=${encodeURIComponent(search)}`);
      if (response.ok) setPlugins(await response.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchMyPlugins = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API + '/api/workshop/my-plugins', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) setMyPlugins(await response.json());
    } catch (err) { console.error(err); }
  };

  const fetchInstalledIds = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API + '/api/workshop/installed-ids', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) setInstalledIds(await response.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const timer = setTimeout(fetchPlugins, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const getInstalled = (pluginId) => installedIds.find(i => i.plugin_id === pluginId);

  const fetchVersions = async (pluginId) => {
    if (expandedVersions === pluginId) { setExpandedVersions(null); return; }
    setLoadingVersions(true);
    setExpandedVersions(pluginId);
    try {
      const response = await fetch(API + `/api/workshop/plugins/${pluginId}/versions`);
      if (response.ok) setVersions(await response.json());
      else setVersions([]);
    } catch { setVersions([]); }
    finally { setLoadingVersions(false); }
  };

  const installPlugin = async (pluginId, version) => {
    setInstalling(pluginId + (version || ''));
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API + `/api/workshop/install/${pluginId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: version || undefined })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`"${data.plugin?.name || pluginId}" v${data.plugin?.version || ''} instalado. Actívalo en Plugins.`);
        refreshPlugins();
        fetchInstalledIds();
      } else {
        setMessage(data.error || 'Error al instalar');
      }
    } catch { setMessage('Error al instalar'); }
    finally { setInstalling(null); }
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
      formData.append('changelog', publishForm.changelog);
      if (logoFile) formData.append('logo', logoFile);

      const response = await fetch(API + '/api/workshop/publish', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`"${data.name}" v${data.version} enviado para revisión`);
        setShowPublish(false);
        setPluginFile(null);
        setLogoFile(null);
        setPublishForm({ description: '', contact_email: '', changelog: '' });
        fetchMyPlugins();
      } else {
        setMessage(data.error || 'Error al publicar');
      }
    } catch { setMessage('Error al publicar'); }
    finally { setPublishing(false); }
  };

  const deleteMyPlugin = async (pluginId) => {
    if (!confirm('¿Eliminar este plugin y todas sus versiones del workshop?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(API + `/api/workshop/my-plugins/${pluginId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchMyPlugins();
    } catch (err) { console.error(err); }
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
            backgroundColor: message.includes('Error') || message.includes('error') || message.includes('ya existe') ? '#f8d7da' : '#d4edda',
            color: message.includes('Error') || message.includes('error') || message.includes('ya existe') ? '#721c24' : '#155724'
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
                {plugins.map(plugin => {
                  const installed = getInstalled(plugin.plugin_id);
                  return (
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
                          <span className="workshop-card-version">v{plugin.latest_version || plugin.version}</span>
                          <div className="workshop-card-author">
                            <FontAwesomeIcon icon={faUser} /> {plugin.author}
                          </div>
                        </div>
                      </div>
                      {plugin.description && <p className="workshop-card-desc">{plugin.description}</p>}

                      {installed && (
                        <div style={{
                          padding: '8px 12px', borderRadius: '8px', marginBottom: '10px',
                          background: '#d4edda', color: '#155724', fontSize: '13px', fontWeight: '600'
                        }}>
                          <FontAwesomeIcon icon={faCheck} /> Instalado (v{installed.version})
                        </div>
                      )}

                      <div className="workshop-card-footer">
                        <span className="workshop-card-downloads">
                          <FontAwesomeIcon icon={faDownload} /> {plugin.downloads || 0}
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => fetchVersions(plugin.plugin_id)}
                          >
                            <FontAwesomeIcon icon={faCodeBranch} />
                            <FontAwesomeIcon icon={expandedVersions === plugin.plugin_id ? faChevronUp : faChevronDown} style={{ fontSize: '10px' }} />
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => installPlugin(plugin.plugin_id)}
                            disabled={installing === plugin.plugin_id}
                          >
                            {installing === plugin.plugin_id ? (
                              <><FontAwesomeIcon icon={faSpinner} spin /> ...</>
                            ) : installed ? (
                              <><FontAwesomeIcon icon={faDownload} /> Actualizar</>
                            ) : (
                              <><FontAwesomeIcon icon={faDownload} /> Instalar</>
                            )}
                          </button>
                        </div>
                      </div>

                      {expandedVersions === plugin.plugin_id && (
                        <div style={{ marginTop: '12px', borderTop: '1px solid #e0e0e0', paddingTop: '12px' }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>
                            <FontAwesomeIcon icon={faCodeBranch} /> Versiones
                          </div>
                          {loadingVersions ? (
                            <div style={{ fontSize: '13px', color: '#999' }}>Cargando...</div>
                          ) : versions.length === 0 ? (
                            <div style={{ fontSize: '13px', color: '#999' }}>Sin versiones aprobadas</div>
                          ) : (
                            versions.map(v => (
                              <div key={v.version} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: '13px'
                              }}>
                                <div>
                                  <strong>v{v.version}</strong>
                                  {v.changelog && <span style={{ color: '#666', marginLeft: '8px' }}>— {v.changelog}</span>}
                                  <div style={{ color: '#999', fontSize: '11px' }}>
                                    {new Date(v.created_at).toLocaleDateString('es-ES')}
                                  </div>
                                </div>
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => installPlugin(plugin.plugin_id, v.version)}
                                  disabled={installing === plugin.plugin_id + v.version}
                                  style={{ fontSize: '12px' }}
                                >
                                  {installed?.version === v.version ? (
                                    <><FontAwesomeIcon icon={faCheck} /> Actual</>
                                  ) : installing === plugin.plugin_id + v.version ? (
                                    <FontAwesomeIcon icon={faSpinner} spin />
                                  ) : (
                                    <><FontAwesomeIcon icon={faDownload} /> Instalar</>
                                  )}
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
                        <span className="workshop-card-version">v{plugin.latest_version || plugin.version}</span>
                        {statusBadge(plugin.status)}
                      </div>
                    </div>
                    {plugin.description && <p className="workshop-card-desc">{plugin.description}</p>}

                    {plugin.versions && plugin.versions.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>
                          <FontAwesomeIcon icon={faCodeBranch} /> Versiones ({plugin.versions.length})
                        </div>
                        {plugin.versions.map(v => (
                          <div key={v.version} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '4px 0', fontSize: '13px', borderBottom: '1px solid #f0f0f0'
                          }}>
                            <span>
                              <strong>v{v.version}</strong>
                              {v.changelog && <span style={{ color: '#666' }}> — {v.changelog}</span>}
                            </span>
                            {statusBadge(v.status)}
                          </div>
                        ))}
                      </div>
                    )}

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
                <input type="file" accept=".zip" onChange={(e) => setPluginFile(e.target.files[0])} className="file-upload-input" required />
                <p className="text-sm text-muted" style={{ margin: '4px 0 0' }}>
                  El título, autor y versión se toman del plugin.json. El autor será el nombre de tu empresa.
                  Para subir una nueva versión, sube el ZIP con una versión diferente en plugin.json.
                </p>
              </div>
              <div className="form-group">
                <label>Logo del Plugin</label>
                <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files[0])} className="file-upload-input" />
                {logoFile && (
                  <div className="image-preview" style={{ marginTop: '8px' }}>
                    <img src={URL.createObjectURL(logoFile)} alt="Logo" className="image-preview-img" />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Descripción *</label>
                <textarea value={publishForm.description} onChange={(e) => setPublishForm({ ...publishForm, description: e.target.value })} rows="3" placeholder="¿Qué hace tu plugin?" required />
              </div>
              <div className="form-group">
                <label>Changelog de esta versión</label>
                <input type="text" value={publishForm.changelog} onChange={(e) => setPublishForm({ ...publishForm, changelog: e.target.value })} placeholder="Ej: Corregido bug de pagos, nueva UI" />
              </div>
              <div className="form-group">
                <label><FontAwesomeIcon icon={faEnvelope} /> Email de Contacto *</label>
                <input type="email" value={publishForm.contact_email} onChange={(e) => setPublishForm({ ...publishForm, contact_email: e.target.value })} placeholder="tu@email.com" required />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={publishing}>
                {publishing ? <><FontAwesomeIcon icon={faSpinner} spin /> Publicando...</> : <><FontAwesomeIcon icon={faUpload} /> Enviar para Revisión</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Workshop;
