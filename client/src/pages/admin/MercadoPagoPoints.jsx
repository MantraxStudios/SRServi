import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePlugins } from '../../context/PluginContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faEdit, faTrash, faCreditCard, faSync, faCheckCircle,
  faExclamationTriangle, faSearch, faLink, faGlobe, faCashRegister,
  faPuzzlePiece, faDownload, faCodeBranch, faChevronDown, faChevronUp,
  faSpinner, faCheck, faUser
} from '@fortawesome/free-solid-svg-icons';
import {
  COUNTRIES, DEFAULT_COUNTRY, getCountry, loadCountry, saveCountry, loadPluginCountries
} from '../../constants/pos';

// POS nativo integrado: Mercado Pago Point (único built-in).
const BUILTIN_MP_POINT_COUNTRIES = ['CL', 'AR', 'BR', 'MX', 'PE', 'CO', 'UY'];

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#D4AF37';

function MercadoPagoPoints() {
  const { token } = useAuth();
  const { refreshPlugins } = usePlugins();

  // País seleccionado (default: Chile)
  const [country, setCountry] = useState(loadCountry);
  const [showCountryModal, setShowCountryModal] = useState(() => {
    try { return !localStorage.getItem('srservi_country'); } catch { return true; }
  });

  // ==== Workshop ====
  const [workshopPlugins, setWorkshopPlugins] = useState([]);
  const [installedIds, setInstalledIds] = useState([]);
  const [pluginCountriesMap, setPluginCountriesMap] = useState({});
  const [loadingWorkshop, setLoadingWorkshop] = useState(true);
  const [installing, setInstalling] = useState(null);
  const [installMessage, setInstallMessage] = useState('');
  const [expandedVersions, setExpandedVersions] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // ==== Estado heredado del flujo Mercado Pago Point ====
  const [terminals, setTerminals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState(null);
  const [formData, setFormData] = useState({ name: '', mercadopago_access_token: '', mercadopago_terminal_id: '' });
  const [mpDevices, setMpDevices] = useState({});
  const [loadingDevices, setLoadingDevices] = useState({});
  const [changingMode, setChangingMode] = useState(null);
  const [setupStep, setSetupStep] = useState('token');
  const [setupToken, setSetupToken] = useState('');
  const [setupName, setSetupName] = useState('');
  const [detectedDevices, setDetectedDevices] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState('');
  const [savingSetup, setSavingSetup] = useState(false);

  useEffect(() => {
    fetchTerminals();
    fetchWorkshopPlugins();
    fetchInstalledIds();
    setPluginCountriesMap(loadPluginCountries());
  }, []);

  const fetchWorkshopPlugins = async () => {
    setLoadingWorkshop(true);
    try {
      const response = await fetch(API + '/api/workshop/plugins?search=');
      if (response.ok) setWorkshopPlugins(await response.json());
    } catch { setWorkshopPlugins([]); }
    finally { setLoadingWorkshop(false); }
  };

  const fetchInstalledIds = async () => {
    try {
      const response = await fetch(API + '/api/workshop/installed-ids', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (response.ok) setInstalledIds(await response.json());
    } catch {}
  };

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
    setInstallMessage('');
    try {
      const response = await fetch(API + `/api/workshop/install/${pluginId}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: version || undefined })
      });
      const data = await response.json();
      if (response.ok) {
        setInstallMessage(`"${data.plugin?.name || pluginId}" v${data.plugin?.version || ''} instalado. Actívalo en Plugins.`);
        refreshPlugins && refreshPlugins();
        fetchInstalledIds();
      } else {
        setInstallMessage(data.error || 'Error al instalar');
      }
    } catch { setInstallMessage('Error al instalar'); }
    finally { setInstalling(null); }
  };

  // Plugins del workshop filtrados por país:
  //  - Si el plugin tiene países asignados (localStorage) y el país actual está incluido → mostrar.
  //  - Si el plugin NO tiene países asignados → mostrar siempre (disponible global).
  const filteredWorkshopPlugins = useMemo(() => {
    return workshopPlugins.filter(plugin => {
      const assigned = pluginCountriesMap[plugin.plugin_id];
      if (!assigned || assigned.length === 0) return true;
      return assigned.includes(country);
    });
  }, [workshopPlugins, pluginCountriesMap, country]);

  const activeCountry = getCountry(country);
  const mpInCountry = BUILTIN_MP_POINT_COUNTRIES.includes(country);

  const selectCountry = (code) => {
    setCountry(code);
    saveCountry(code);
    setShowCountryModal(false);
  };

  const scrollToMP = () => {
    const el = document.getElementById('mp-point-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ==== Mercado Pago Point (flujo original) ====
  const fetchTerminals = async () => {
    try {
      const response = await fetch(API + '/api/mercado-pago-terminals', { headers: { Authorization: 'Bearer ' + token } });
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      setTerminals(list);
      list.forEach(t => fetchDevices(t.id));
    } catch { setTerminals([]); }
    finally { setLoading(false); }
  };

  const fetchDevices = async (terminalId) => {
    setLoadingDevices(prev => ({ ...prev, [terminalId]: true }));
    try {
      const response = await fetch(API + `/api/mercado-pago-terminals/${terminalId}/devices`, { headers: { Authorization: 'Bearer ' + token } });
      if (response.ok) { const data = await response.json(); setMpDevices(prev => ({ ...prev, [terminalId]: data })); }
    } catch {}
    finally { setLoadingDevices(prev => ({ ...prev, [terminalId]: false })); }
  };

  const changeMode = async (terminalId, deviceId, newMode) => {
    setChangingMode(deviceId);
    try {
      const response = await fetch(API + `/api/mercado-pago-terminals/${terminalId}/mode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ device_id: deviceId, operating_mode: newMode })
      });
      if (response.ok) await fetchDevices(terminalId);
      else { const err = await response.json(); alert(err.error || 'Error'); }
    } catch { alert('Error de conexion'); }
    finally { setChangingMode(null); }
  };

  const detectDevicesFromToken = async () => {
    if (!setupToken.trim()) return;
    setDetecting(true);
    setDetectError('');
    setDetectedDevices([]);
    try {
      const response = await fetch(API + '/api/mercado-pago-detect-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ access_token: setupToken.trim() })
      });
      if (!response.ok) {
        const err = await response.json();
        setDetectError(err.error || 'Error al consultar MercadoPago');
        return;
      }
      const data = await response.json();
      if (data.length === 0) {
        setDetectError('No se encontraron dispositivos Point vinculados a este Access Token. Asegurate de haber creado una sucursal y caja en la app de Mercado Pago y vinculado tu Point.');
      } else {
        setDetectedDevices(data);
        setSetupStep('detect');
      }
    } catch { setDetectError('Error de conexion'); }
    finally { setDetecting(false); }
  };

  const selectDevice = async (device) => {
    setSavingSetup(true);
    try {
      const name = setupName.trim() || device.external_pos_id || device.id.split('__')[0] || 'Point';
      const response = await fetch(API + '/api/mercado-pago-terminals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name, mercadopago_access_token: setupToken.trim(), mercadopago_terminal_id: device.id })
      });
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Error al guardar'); }
      const created = await response.json();
      if (device.operating_mode !== 'PDV') {
        await fetch(API + `/api/mercado-pago-terminals/${created.id}/mode`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ device_id: device.id, operating_mode: 'PDV' })
        });
      }
      setShowModal(false);
      resetWizard();
      fetchTerminals();
    } catch (err) { alert(err.message); }
    finally { setSavingSetup(false); }
  };

  const resetWizard = () => {
    setSetupStep('token');
    setSetupToken('');
    setSetupName('');
    setDetectedDevices([]);
    setDetectError('');
    setEditingTerminal(null);
  };

  const openEditModal = (terminal) => {
    setEditingTerminal(terminal);
    setFormData({ name: terminal.name, mercadopago_access_token: terminal.mercadopago_access_token, mercadopago_terminal_id: terminal.mercadopago_terminal_id });
    setShowModal(true);
    setSetupStep('edit');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(API + `/api/mercado-pago-terminals/${editingTerminal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if (!response.ok) { const err = await response.json(); throw new Error(err.error); }
      setShowModal(false);
      resetWizard();
      fetchTerminals();
    } catch (err) { alert(err.message); }
  };

  const handleDelete = async (terminalId) => {
    if (!confirm('¿Seguro que deseas eliminar esta máquina Point?')) return;
    try {
      await fetch(API + `/api/mercado-pago-terminals/${terminalId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      fetchTerminals();
    } catch {}
  };

  if (loading) return <div className="loading">Cargando...</div>;

  const showMPSection = mpInCountry || terminals.length > 0;

  return (
    <>
      <header className="admin-header">
        <h1><FontAwesomeIcon icon={faCashRegister} style={{ marginRight: '10px' }} />Vincular POS</h1>
      </header>

      <div className="admin-main">
        {/* Selector de país */}
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '18px 22px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: GOLD + '22', color: GOLD,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', flexShrink: 0
          }}>
            <FontAwesomeIcon icon={faGlobe} />
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              País del negocio
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#111', marginTop: '2px' }}>
              <span style={{ fontSize: '22px', marginRight: '8px' }}>{activeCountry.flag}</span>
              {activeCountry.name}
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => setShowCountryModal(true)}
            style={{ whiteSpace: 'nowrap' }}
          >
            Cambiar país
          </button>
        </div>

        {installMessage && (
          <div style={{
            padding: '12px 16px', marginBottom: '16px', borderRadius: '8px', fontWeight: '600',
            backgroundColor: installMessage.includes('Error') ? '#f8d7da' : '#d4edda',
            color: installMessage.includes('Error') ? '#721c24' : '#155724'
          }}>{installMessage}</div>
        )}

        {/* Catálogo de POS disponibles */}
        <h2 style={{ fontSize: '18px', color: '#111', margin: '0 0 12px' }}>
          Sistemas POS disponibles en {activeCountry.name}
        </h2>
        <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 16px' }}>
          Elige un sistema POS nativo o instala el plugin que necesites desde el Workshop.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '14px',
          marginBottom: '30px'
        }}>
          {/* Mercado Pago Point (built-in) */}
          {mpInCountry && (
            <div style={{
              background: '#fff',
              border: '2px solid ' + GOLD,
              borderRadius: '12px',
              padding: '18px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '10px',
                  background: '#009EE315',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px'
                }}>💳</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '700', color: '#111', fontSize: '15px' }}>Mercado Pago Point</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Mercado Pago</div>
                </div>
                <span style={{
                  padding: '3px 8px', background: GOLD + '22', color: '#57410a',
                  borderRadius: '10px', fontSize: '10px', fontWeight: '700'
                }}>NATIVO</span>
              </div>
              <p style={{ color: '#4b5563', fontSize: '12px', lineHeight: '1.5', margin: '0 0 12px' }}>
                Terminal Point de Mercado Pago. Detectamos tus dispositivos automáticamente con tu Access Token.
              </p>
              <button
                onClick={scrollToMP}
                className="btn btn-primary btn-sm"
                style={{ width: '100%' }}
              >
                <FontAwesomeIcon icon={faLink} /> Configurar ahora
              </button>
            </div>
          )}

          {/* Workshop plugins (filtrados por país) */}
          {loadingWorkshop ? (
            <div className="card" style={{ padding: '20px', textAlign: 'center', color: '#6b7280', gridColumn: '1 / -1' }}>
              <FontAwesomeIcon icon={faSpinner} spin /> Cargando plugins del Workshop...
            </div>
          ) : filteredWorkshopPlugins.length === 0 && !mpInCountry ? (
            <div className="card" style={{ padding: '40px 20px', textAlign: 'center', gridColumn: '1 / -1' }}>
              <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: '32px', color: '#f59e0b', marginBottom: '12px' }} />
              <p style={{ color: '#6b7280', margin: 0 }}>
                No hay plugins disponibles para <strong>{activeCountry.name}</strong> en el Workshop todavía.
              </p>
            </div>
          ) : (
            filteredWorkshopPlugins.map(plugin => {
              const installed = getInstalled(plugin.plugin_id);
              const assignedCountries = pluginCountriesMap[plugin.plugin_id];
              const recommended = assignedCountries && assignedCountries.includes(country);
              return (
                <div key={plugin.plugin_id} style={{
                  background: '#fff',
                  border: recommended ? '2px solid #2ecc71' : '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '18px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    {plugin.logo ? (
                      <img src={API + plugin.logo} alt="" style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', border: '1px solid #e5e7eb' }} />
                    ) : (
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '10px',
                        background: '#f3f4f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '22px', color: '#9ca3af'
                      }}>
                        <FontAwesomeIcon icon={faPuzzlePiece} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', color: '#111', fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {plugin.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>
                        <FontAwesomeIcon icon={faUser} /> {plugin.author || 'Sin autor'} · v{plugin.latest_version || plugin.version}
                      </div>
                    </div>
                    {recommended && (
                      <span style={{
                        padding: '3px 8px', background: '#d4edda', color: '#155724',
                        borderRadius: '10px', fontSize: '10px', fontWeight: '700'
                      }}>{activeCountry.flag}</span>
                    )}
                  </div>

                  {plugin.description && (
                    <p style={{ color: '#4b5563', fontSize: '12px', lineHeight: '1.5', margin: '0 0 10px' }}>
                      {plugin.description}
                    </p>
                  )}

                  {installed && (
                    <div style={{
                      padding: '6px 10px', borderRadius: '6px', marginBottom: '10px',
                      background: '#d4edda', color: '#155724', fontSize: '11px', fontWeight: '700'
                    }}>
                      <FontAwesomeIcon icon={faCheck} /> Instalado (v{installed.version})
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#6b7280', marginBottom: '10px' }}>
                    <span><FontAwesomeIcon icon={faDownload} /> {plugin.downloads || 0} descargas</span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => fetchVersions(plugin.plugin_id)}
                      title="Ver versiones"
                    >
                      <FontAwesomeIcon icon={faCodeBranch} />
                      <FontAwesomeIcon icon={expandedVersions === plugin.plugin_id ? faChevronUp : faChevronDown} style={{ fontSize: '10px' }} />
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => installPlugin(plugin.plugin_id)}
                      disabled={installing === plugin.plugin_id}
                    >
                      {installing === plugin.plugin_id ? (
                        <><FontAwesomeIcon icon={faSpinner} spin /> Instalando...</>
                      ) : installed ? (
                        <><FontAwesomeIcon icon={faDownload} /> Actualizar</>
                      ) : (
                        <><FontAwesomeIcon icon={faDownload} /> Instalar</>
                      )}
                    </button>
                  </div>

                  {expandedVersions === plugin.plugin_id && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#111' }}>
                        <FontAwesomeIcon icon={faCodeBranch} /> Versiones disponibles
                      </div>
                      {loadingVersions ? (
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                          <FontAwesomeIcon icon={faSpinner} spin /> Cargando...
                        </div>
                      ) : versions.length === 0 ? (
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>Sin versiones aprobadas</div>
                      ) : (
                        versions.map(v => (
                          <div key={v.version} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: '12px'
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong>v{v.version}</strong>
                              {v.changelog && (
                                <span style={{ color: '#6b7280', marginLeft: '6px', fontSize: '11px' }}>— {v.changelog}</span>
                              )}
                              <div style={{ color: '#9ca3af', fontSize: '10px', marginTop: '2px' }}>
                                {new Date(v.created_at).toLocaleDateString('es-ES')}
                              </div>
                            </div>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => installPlugin(plugin.plugin_id, v.version)}
                              disabled={installing === plugin.plugin_id + v.version}
                              style={{ fontSize: '11px', padding: '4px 10px' }}
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
            })
          )}
        </div>

        {/* Sección Mercado Pago Point (solo si aplica al país o ya hay terminales) */}
        {showMPSection && (
          <div id="mp-point-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', marginTop: '30px', flexWrap: 'wrap', gap: '10px' }}>
              <h2 style={{ fontSize: '18px', color: '#111', margin: 0 }}>
                <FontAwesomeIcon icon={faCreditCard} style={{ color: '#009EE3', marginRight: '8px' }} />
                Mercado Pago Point
              </h2>
              <button onClick={() => { resetWizard(); setShowModal(true); }} className="btn btn-primary">
                <FontAwesomeIcon icon={faPlus} /> Agregar Point
              </button>
            </div>

            <div className="card" style={{ marginBottom: '20px', padding: '16px', background: '#fffbe6', border: '2px solid #e6c200', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '15px' }}><FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#e6a800' }} /> Antes de agregar un Point</h3>
              <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.8', color: '#555' }}>
                <li>En la <strong>app de Mercado Pago</strong> del celular, ve a <strong>Tu negocio &gt; Sucursales y cajas</strong></li>
                <li>Crea una <strong>Sucursal</strong> y una <strong>Caja</strong></li>
                <li>Vincula tu <strong>dispositivo Point</strong> a la caja <strong>escaneando el codigo QR</strong> que aparece en la pantalla del Point desde la app</li>
                <li>Obtener tu <strong>Access Token</strong> desde <a href="https://www.mercadopago.com/developers/panel/app" target="_blank" rel="noreferrer" style={{ color: '#0066cc' }}>mercadopago.com/developers</a> &gt; Credenciales de produccion</li>
                <li>Click en <strong>"Agregar Point"</strong> arriba, pega tu token y <strong>detectamos tus dispositivos automaticamente</strong></li>
              </ol>
            </div>

            {terminals.length === 0 ? (
              <div className="empty-state">
                <h3 className="empty-state-title">Sin máquinas configuradas</h3>
                <p className="empty-state-text">Agrega tu primer Point para empezar a cobrar.</p>
              </div>
            ) : (
              <div className="terminals-grid">
                {terminals.map(terminal => {
                  const devices = mpDevices[terminal.id] || [];
                  const isLoadingDevs = loadingDevices[terminal.id];
                  return (
                    <div key={terminal.id} className="terminal-card">
                      <div className="terminal-card-actions">
                        <button onClick={() => openEditModal(terminal)} className="store-action-btn"><FontAwesomeIcon icon={faEdit} /></button>
                        <button onClick={() => handleDelete(terminal.id)} className="store-action-btn danger"><FontAwesomeIcon icon={faTrash} /></button>
                      </div>
                      <h3 className="terminal-card-name">{terminal.name}</h3>
                      <div className="terminal-field-label">Terminal ID</div>
                      <div className="terminal-field-value" style={{ fontSize: '11px', wordBreak: 'break-all' }}>{terminal.mercadopago_terminal_id}</div>
                      <div className="terminal-field-label">Access Token</div>
                      <div className="terminal-field-value masked">{terminal.mercadopago_access_token?.slice(0, 20)}...</div>

                      <div style={{ marginTop: '16px', borderTop: '1px solid #e0e0e0', paddingTop: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#555' }}>Estado del dispositivo</span>
                          <button onClick={() => fetchDevices(terminal.id)} disabled={isLoadingDevs} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: '11px' }}>
                            <FontAwesomeIcon icon={faSync} spin={isLoadingDevs} />
                          </button>
                        </div>
                        {devices.map(dev => (
                          <div key={dev.id} style={{ padding: '8px', background: '#fafafa', borderRadius: '8px', border: '1px solid #eee' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: '#666' }}>Modo:</span>
                              <button onClick={() => changeMode(terminal.id, dev.id, 'PDV')} disabled={changingMode === dev.id}
                                style={{ padding: '3px 10px', fontSize: '11px', fontWeight: '700', borderRadius: '6px', cursor: 'pointer', border: '2px solid', background: dev.operating_mode === 'PDV' ? '#2ecc71' : '#fff', color: dev.operating_mode === 'PDV' ? '#fff' : '#555', borderColor: dev.operating_mode === 'PDV' ? '#2ecc71' : '#ddd' }}>
                                {dev.operating_mode === 'PDV' && <FontAwesomeIcon icon={faCheckCircle} style={{ marginRight: '3px' }} />}PDV
                              </button>
                              <button onClick={() => changeMode(terminal.id, dev.id, 'STANDALONE')} disabled={changingMode === dev.id}
                                style={{ padding: '3px 10px', fontSize: '11px', fontWeight: '700', borderRadius: '6px', cursor: 'pointer', border: '2px solid', background: dev.operating_mode === 'STANDALONE' ? '#3498db' : '#fff', color: dev.operating_mode === 'STANDALONE' ? '#fff' : '#555', borderColor: dev.operating_mode === 'STANDALONE' ? '#3498db' : '#ddd' }}>
                                {dev.operating_mode === 'STANDALONE' && <FontAwesomeIcon icon={faCheckCircle} style={{ marginRight: '3px' }} />}STANDALONE
                              </button>
                              {changingMode === dev.id && <span style={{ fontSize: '10px', color: '#888' }}>...</span>}
                            </div>
                          </div>
                        ))}
                        {!isLoadingDevs && devices.length === 0 && <p style={{ fontSize: '11px', color: '#999', margin: 0 }}>Sin datos del dispositivo</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: selector de país */}
      {showCountryModal && (
        <div className="modal-overlay" onClick={() => {
          try { if (localStorage.getItem('srservi_country')) setShowCountryModal(false); } catch {}
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                <FontAwesomeIcon icon={faGlobe} /> ¿De qué país es tu negocio?
              </h2>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <p style={{ color: '#6b7280', fontSize: '13px', marginTop: 0 }}>
                Filtramos los plugins POS del Workshop según tu país.
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '8px',
                marginTop: '12px'
              }}>
                {COUNTRIES.map(c => (
                  <button
                    key={c.code}
                    onClick={() => selectCountry(c.code)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      background: country === c.code ? GOLD + '22' : '#fff',
                      border: country === c.code ? `2px solid ${GOLD}` : '1px solid #e5e7eb',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: country === c.code ? '700' : '500',
                      color: '#111',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>{c.flag}</span>
                    <span>{c.name}</span>
                    {c.code === DEFAULT_COUNTRY && (
                      <span style={{ marginLeft: 'auto', fontSize: '9px', color: GOLD, fontWeight: '700' }}>★</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Mercado Pago Point wizard (heredado) */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetWizard(); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {setupStep === 'edit' ? 'Editar Máquina Point' : setupStep === 'detect' ? 'Seleccionar dispositivo' : 'Agregar Point'}
              </h2>
              <button className="modal-close" onClick={() => { setShowModal(false); resetWizard(); }}>&times;</button>
            </div>

            {setupStep === 'edit' && (
              <form onSubmit={handleEditSubmit}>
                <div className="form-group">
                  <label>Nombre</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Access Token</label>
                  <input type="text" value={formData.mercadopago_access_token} onChange={(e) => setFormData({ ...formData, mercadopago_access_token: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Terminal ID</label>
                  <input type="text" value={formData.mercadopago_terminal_id} onChange={(e) => setFormData({ ...formData, mercadopago_terminal_id: e.target.value })} required />
                </div>
                <div className="flex gap-3 justify-end">
                  <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); resetWizard(); }}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Guardar</button>
                </div>
              </form>
            )}

            {setupStep === 'token' && (
              <div>
                <div className="form-group">
                  <label>Nombre del Point (opcional)</label>
                  <input type="text" value={setupName} onChange={(e) => setSetupName(e.target.value)} placeholder="Ej: Point Caja 1" />
                </div>
                <div className="form-group">
                  <label>Access Token de Mercado Pago *</label>
                  <input type="text" value={setupToken} onChange={(e) => setSetupToken(e.target.value)} placeholder="APP_USR-..." required style={{ fontFamily: 'monospace', fontSize: '13px' }} />
                  <small style={{ color: '#888', fontSize: '11px' }}>Encontralo en <a href="https://www.mercadopago.com/developers/panel/app" target="_blank" rel="noreferrer" style={{ color: '#0066cc' }}>mercadopago.com/developers</a> &gt; Credenciales de produccion</small>
                </div>
                {detectError && (
                  <div style={{ padding: '10px', background: '#f8d7da', color: '#721c24', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>
                    {detectError}
                  </div>
                )}
                <button onClick={detectDevicesFromToken} disabled={detecting || !setupToken.trim()} className="btn btn-primary btn-full" style={{ marginTop: '8px' }}>
                  <FontAwesomeIcon icon={detecting ? faSync : faSearch} spin={detecting} /> {detecting ? 'Buscando dispositivos...' : 'Detectar mis Points'}
                </button>
              </div>
            )}

            {setupStep === 'detect' && (
              <div>
                <p style={{ fontSize: '13px', color: '#666', marginTop: 0 }}>
                  Encontramos <strong>{detectedDevices.length}</strong> dispositivo{detectedDevices.length > 1 ? 's' : ''}. Selecciona el que quieres usar:
                </p>
                {detectedDevices.map(dev => (
                  <div key={dev.id} style={{ padding: '14px', background: '#fafafa', borderRadius: '10px', marginBottom: '8px', border: '2px solid #e0e0e0', cursor: 'pointer', transition: 'border-color 0.2s' }}
                    onClick={() => !savingSetup && selectDevice(dev)}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2ecc71'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '700' }}>{dev.id.split('__')[0]}</div>
                        <div style={{ fontSize: '11px', color: '#888', fontFamily: 'monospace', marginTop: '2px' }}>{dev.id}</div>
                        {dev.external_pos_id && <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>POS: {dev.external_pos_id}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: '700', background: dev.operating_mode === 'PDV' ? '#2ecc7133' : '#3498db33', color: dev.operating_mode === 'PDV' ? '#27ae60' : '#2980b9' }}>
                          {dev.operating_mode}
                        </div>
                        {dev.operating_mode !== 'PDV' && <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>Se configurara como PDV</div>}
                      </div>
                    </div>
                    <div style={{ marginTop: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#2ecc71', fontWeight: '600' }}>
                        <FontAwesomeIcon icon={faLink} /> Click para agregar
                      </span>
                    </div>
                  </div>
                ))}
                {savingSetup && <p style={{ textAlign: 'center', color: '#888', fontSize: '13px' }}>Configurando dispositivo...</p>}
                <button onClick={() => setSetupStep('token')} className="btn btn-secondary btn-full" style={{ marginTop: '8px' }}>
                  Volver
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default MercadoPagoPoints;
