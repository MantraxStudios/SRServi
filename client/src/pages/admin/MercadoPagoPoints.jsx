import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePlugins } from '../../context/PluginContext';
import { useStore } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faEdit, faTrash, faCreditCard, faSync, faCheckCircle,
  faExclamationTriangle, faSearch, faLink, faGlobe, faCashRegister,
  faPuzzlePiece, faDownload, faCodeBranch, faChevronDown, faChevronUp,
  faSpinner, faCheck, faUser, faCog, faToggleOn, faToggleOff, faSave,
  faExternalLinkAlt
} from '@fortawesome/free-solid-svg-icons';
import {
  COUNTRIES, DEFAULT_COUNTRY, getCountry, loadCountry, saveCountry, loadPluginCountries
} from '../../constants/pos';

// POS nativo integrado: Mercado Pago Point (único built-in).
const BUILTIN_MP_POINT_COUNTRIES = ['CL', 'AR', 'BR', 'MX', 'PE', 'CO', 'UY'];

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#D4AF37';

function MercadoPagoPoints() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const {
    refreshPlugins,
    registry,
    installedPlugins,
    setPluginActive,
    fetchInstalledPlugins
  } = usePlugins();
  const { selectedStore } = useStore() || {};

  // Runtime check — puede no estar listo justo después de activar un plugin
  const hasAdminPageRuntime = (pluginId) => {
    const def = registry?.[pluginId];
    return !!(def?.adminPage || def?.slots?.['admin-page']);
  };

  // DB check — siempre disponible apenas se carga el listado
  const pluginDeclaresAdminUI = (plugin) => {
    return Array.isArray(plugin?.admin_slots) && plugin.admin_slots.length > 0;
  };

  // Combined: el plugin tiene (o tendrá) UI admin custom
  const hasAdminPage = (plugin) => {
    if (!plugin) return false;
    if (pluginDeclaresAdminUI(plugin)) return true;
    return hasAdminPageRuntime(plugin.plugin_id);
  };

  const openPluginConfig = (plugin) => {
    if (hasAdminPage(plugin)) {
      navigate(`/admin/plugins/${plugin.plugin_id}`);
    } else if (Object.keys(plugin.settings_schema || {}).length > 0) {
      openSettings(plugin);
    }
  };

  // País seleccionado (default: Chile). Si no hay guardado, persistimos Chile
  // silenciosamente para que el modal de selección NO aparezca en cada reinicio.
  const [country, setCountry] = useState(() => {
    const c = loadCountry();
    try {
      if (!localStorage.getItem('srservi_country')) {
        localStorage.setItem('srservi_country', c);
      }
    } catch {}
    return c;
  });
  // Solo se muestra cuando el usuario lo abre explícitamente desde el botón "cambiar país"
  const [showCountryModal, setShowCountryModal] = useState(false);

  // ==== Workshop ====
  const [workshopPlugins, setWorkshopPlugins] = useState([]);
  // installedPlugins viene del contexto — compartido entre Plugins.jsx y este componente
  const [pluginCountriesMap, setPluginCountriesMap] = useState({});
  const [loadingWorkshop, setLoadingWorkshop] = useState(true);
  const [installing, setInstalling] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [installMessage, setInstallMessage] = useState('');
  const [expandedVersions, setExpandedVersions] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(null);
  const [settingsData, setSettingsData] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Inline settings para la sección "Plugins de pagos"
  const [paymentPluginSettings, setPaymentPluginSettings] = useState({}); // { pluginId: {...values} }
  const [loadedSettingsFor, setLoadedSettingsFor] = useState({}); // { pluginId: true }
  const [savingPaymentFor, setSavingPaymentFor] = useState(null);

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
    // NOTA: NO re-fetcheamos installedPlugins aquí — usamos el state compartido del
    // PluginContext que ya fue poblado al entrar al área admin. Un re-fetch aquí puede
    // llegar con datos viejos y pisar optimistic updates hechos en otras páginas.
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

  // Normaliza cualquier representación de is_active a boolean puro.
  // MySQL TINYINT → Number, JSON parseo, boolean, string... todo queda true/false.
  const isTruthy = (v) =>
    v === true || v === 1 || v === '1' || v === 't' || v === 'true' || v === 'TRUE';

  const getInstalled = (pluginId) => installedPlugins.find(p => p.plugin_id === pluginId);

  const toggleActive = async (pluginId, currentlyActiveRaw) => {
    const currentlyActive = currentlyActiveRaw === true || currentlyActiveRaw === 1 || currentlyActiveRaw === '1';
    const nextActive = !currentlyActive;
    setTogglingId(pluginId);
    try {
      const authToken = localStorage.getItem('token');
      const action = currentlyActive ? 'deactivate' : 'activate';
      const response = await fetch(API + `/api/admin/plugins/${pluginId}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        // Optimistic update en el state COMPARTIDO del contexto
        setPluginActive(pluginId, nextActive);
        refreshPlugins();
        setInstallMessage(`Plugin ${nextActive ? 'activado' : 'desactivado'}`);
        setTimeout(() => setInstallMessage(''), 2000);
      }
    } catch (err) {
      console.error('Error toggling plugin:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const openSettings = async (plugin) => {
    if (!selectedStore) {
      alert('Selecciona una tienda primero');
      return;
    }
    try {
      const response = await fetch(API + `/api/admin/plugins/${plugin.plugin_id}/settings/${selectedStore.id}`, {
        headers: { Authorization: 'Bearer ' + token }
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
      const response = await fetch(API + `/api/admin/plugins/${settingsOpen.plugin_id}/settings/${selectedStore.id}`, {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settingsData)
      });
      if (response.ok) {
        setInstallMessage('Configuración guardada');
        setTimeout(() => setInstallMessage(''), 2000);
        setSettingsOpen(null);
      }
    } catch {}
    finally { setSavingSettings(false); }
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

  // ==== Helpers "Plugins de pagos" ====

  // Detección heurística de plugins relacionados a pagos
  const isPaymentPlugin = (plugin) => {
    const id = (plugin.plugin_id || '').toLowerCase();
    const name = (plugin.name || '').toLowerCase();
    const desc = (plugin.description || '').toLowerCase();
    const text = id + ' ' + name + ' ' + desc;
    const keywords = [
      'pay', 'pos', 'transbank', 'mercadopago', 'mercado pago', 'stripe',
      'square', 'clip', 'sumup', 'tuu', 'izipay', 'redelcom', 'point',
      'getnet', 'webpay', 'terminal', 'tarjeta', 'card reader', 'niubiz',
      'culqi', 'cobro', 'pasarela', 'checkout'
    ];
    if (keywords.some(k => text.includes(k))) return true;
    const hooks = plugin.hooks || [];
    if (hooks.some(h => typeof h === 'string' && h.includes('payment'))) return true;
    return false;
  };

  // Filtro directo (sin useMemo) para evitar stale memoization
  const paymentPlugins = installedPlugins.filter(isPaymentPlugin);

  // Cargar settings del plugin de pagos la primera vez que lo vemos activo con schema
  useEffect(() => {
    if (!selectedStore) return;
    installedPlugins.filter(isPaymentPlugin).forEach(plugin => {
      if (loadedSettingsFor[plugin.plugin_id]) return;
      if (!plugin.settings_schema || Object.keys(plugin.settings_schema).length === 0) return;
      fetch(API + `/api/admin/plugins/${plugin.plugin_id}/settings/${selectedStore.id}`, {
        headers: { Authorization: 'Bearer ' + token }
      })
        .then(r => r.ok ? r.json() : {})
        .then(data => {
          setPaymentPluginSettings(prev => ({ ...prev, [plugin.plugin_id]: data || {} }));
          setLoadedSettingsFor(prev => ({ ...prev, [plugin.plugin_id]: true }));
        })
        .catch(() => {});
    });
    // eslint-disable-next-line
  }, [installedPlugins, selectedStore]);

  const updatePaymentSetting = (pluginId, key, value) => {
    setPaymentPluginSettings(prev => ({
      ...prev,
      [pluginId]: { ...(prev[pluginId] || {}), [key]: value }
    }));
  };

  const savePaymentPluginSettings = async (plugin) => {
    if (!selectedStore) {
      setInstallMessage('Selecciona una tienda primero');
      return;
    }
    setSavingPaymentFor(plugin.plugin_id);
    try {
      const body = paymentPluginSettings[plugin.plugin_id] || {};
      const response = await fetch(API + `/api/admin/plugins/${plugin.plugin_id}/settings/${selectedStore.id}`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (response.ok) {
        setInstallMessage(`Configuración de "${plugin.name}" guardada`);
        setTimeout(() => setInstallMessage(''), 2500);
      } else {
        setInstallMessage('Error al guardar configuración');
      }
    } catch { setInstallMessage('Error de conexión'); }
    finally { setSavingPaymentFor(null); }
  };

  // Renderer inline para un campo del schema (versión con estado por plugin)
  const renderInlineField = (pluginId, key, schema) => {
    const state = paymentPluginSettings[pluginId] || {};
    const value = state[key] !== undefined ? state[key] : (schema.default ?? '');

    if (schema.type === 'boolean') {
      return (
        <div className="form-group" key={key}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => updatePaymentSetting(pluginId, key, e.target.checked)}
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
            onChange={(e) => updatePaymentSetting(pluginId, key, parseFloat(e.target.value) || 0)}
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
            onChange={(e) => updatePaymentSetting(pluginId, key, e.target.value)}
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
    return (
      <div className="form-group" key={key}>
        <label>{schema.label || key}</label>
        <input
          type={schema.secret ? 'password' : 'text'}
          value={value}
          onChange={(e) => updatePaymentSetting(pluginId, key, e.target.value)}
          placeholder={schema.placeholder || ''}
        />
      </div>
    );
  };

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
        setInstallMessage(`"${data.plugin?.name || pluginId}" v${data.plugin?.version || ''} instalado. Puedes activarlo y configurarlo abajo.`);
        refreshPlugins && refreshPlugins();
        fetchInstalledPlugins();
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
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          fontSize: '12px'
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '6px',
            background: GOLD + '22', color: GOLD,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', flexShrink: 0
          }}>
            <FontAwesomeIcon icon={faGlobe} />
          </div>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              País
            </div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#111', marginTop: '1px' }}>
              <span style={{ fontSize: '16px', marginRight: '6px' }}>{activeCountry.flag}</span>
              {activeCountry.name}
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowCountryModal(true)}
            style={{ whiteSpace: 'nowrap', padding: '6px 12px', fontSize: '11px' }}
          >
            Cambiar
          </button>
        </div>

        {installMessage && (
          <div style={{
            padding: '8px 12px', marginBottom: '10px', borderRadius: '6px', fontWeight: '600', fontSize: '12px',
            backgroundColor: installMessage.includes('Error') ? '#f8d7da' : '#d4edda',
            color: installMessage.includes('Error') ? '#721c24' : '#155724'
          }}>{installMessage}</div>
        )}

        {/* Catálogo de POS disponibles */}
        <h2 style={{ fontSize: '14px', color: '#111', margin: '0 0 8px' }}>
          POS disponibles en {activeCountry.name}
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '8px',
          marginBottom: '16px'
        }}>
          {/* Mercado Pago Point (built-in) */}
          {mpInCountry && (
            <div style={{
              background: '#fff',
              border: '2px solid ' + GOLD,
              borderRadius: '8px',
              padding: '10px',
              minWidth: '140px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  background: '#009EE315',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px'
                }}>💳</div>
                <div style={{ flex: 1, fontSize: '12px', fontWeight: '700', color: '#111' }}>Mercado Pago Point</div>
                <span style={{ padding: '2px 6px', background: GOLD + '22', color: '#57410a', borderRadius: '6px', fontSize: '9px', fontWeight: '700' }}>NATIVO</span>
              </div>
              <button onClick={scrollToMP} className="btn btn-primary btn-sm" style={{ width: '100%', fontSize: '10px', padding: '4px 6px' }}>
                <FontAwesomeIcon icon={faLink} /> Configurar
              </button>
            </div>
          )}

          {/* Workshop plugins (filtrados por país) */}
          {loadingWorkshop ? (
            <div style={{ padding: '12px', textAlign: 'center', color: '#6b7280', gridColumn: '1 / -1', fontSize: '12px' }}>
              <FontAwesomeIcon icon={faSpinner} spin /> Cargando...
            </div>
          ) : filteredWorkshopPlugins.length === 0 && !mpInCountry ? (
            <div style={{ padding: '20px 12px', textAlign: 'center', gridColumn: '1 / -1' }}>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '12px' }}>Sin plugins para {activeCountry.name}</p>
            </div>
          ) : (
            filteredWorkshopPlugins.map(plugin => {
              const installed = getInstalled(plugin.plugin_id);
              return (
                <div key={plugin.plugin_id} style={{
                  background: '#fff',
                  border: installed ? (installed.is_active ? '2px solid #2ecc71' : '2px solid #f59e0b') : '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '10px',
                  minWidth: '140px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    {plugin.logo ? (
                      <img src={API + plugin.logo} alt="" style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '6px',
                        background: '#f3f4f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', color: '#9ca3af'
                      }}>
                        <FontAwesomeIcon icon={faPuzzlePiece} />
                      </div>
                    )}
                    <div style={{ flex: 1, fontSize: '12px', fontWeight: '700', color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {plugin.name}
                    </div>
                  </div>

                  {installed ? (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => toggleActive(installed.plugin_id, installed.is_active)}
                        disabled={togglingId === installed.plugin_id}
                        style={{
                          flex: 1,
                          background: installed.is_active ? '#dcfce7' : '#fee2e2',
                          color: installed.is_active ? '#166534' : '#991b1b',
                          border: '1px solid ' + (installed.is_active ? '#bbf7d0' : '#fecaca'),
                          fontWeight: '700',
                          fontSize: '10px',
                          padding: '4px 6px'
                        }}
                      >
                        {togglingId === installed.plugin_id ? (
                          <FontAwesomeIcon icon={faSpinner} spin />
                        ) : installed.is_active ? (
                          <><FontAwesomeIcon icon={faToggleOn} /> Off</>
                        ) : (
                          <><FontAwesomeIcon icon={faToggleOff} /> On</>
                        )}
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openPluginConfig(installed)}
                        style={{ flex: 1, fontSize: '10px', padding: '4px 6px' }}
                      >
                        <FontAwesomeIcon icon={faCog} />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ width: '100%', fontSize: '10px', padding: '4px 6px' }}
                      onClick={() => installPlugin(plugin.plugin_id)}
                      disabled={installing === plugin.plugin_id}
                    >
                      {installing === plugin.plugin_id ? (
                        <FontAwesomeIcon icon={faSpinner} spin />
                      ) : (
                        <><FontAwesomeIcon icon={faDownload} /> Instalar</>
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ==== Sección: Plugins de pagos instalados ==== */}
        {paymentPlugins.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <h2 style={{ fontSize: '14px', color: '#111', margin: '0 0 8px' }}>
              <FontAwesomeIcon icon={faCreditCard} style={{ marginRight: '6px', color: GOLD }} />
              Pagos instalados
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {paymentPlugins.map(plugin => {
                const isActive = !!plugin.is_active && plugin.is_active !== '0' && plugin.is_active !== 0;
                return (
                  <div
                    key={plugin.plugin_id}
                    style={{
                      background: '#fff',
                      border: isActive ? '2px solid #22c55e' : '1px solid #e5e7eb',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: isActive ? '#f0fdf4' : '#fafafa',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      {plugin.logo ? (
                        <img
                          src={API + plugin.logo}
                          alt=""
                          style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '6px',
                          background: GOLD + '22', color: GOLD,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '14px'
                        }}>
                          <FontAwesomeIcon icon={faCreditCard} />
                        </div>
                      )}
                      <div style={{ flex: 1, fontSize: '12px', fontWeight: '700', color: '#111' }}>
                        {plugin.name}
                      </div>
                      <button
                        className="btn btn-sm"
                        onClick={() => toggleActive(plugin.plugin_id, isActive)}
                        disabled={togglingId === plugin.plugin_id}
                        style={{
                          background: isActive ? '#dcfce7' : '#fee2e2',
                          color: isActive ? '#166534' : '#991b1b',
                          border: '1px solid ' + (isActive ? '#bbf7d0' : '#fecaca'),
                          fontWeight: '700',
                          fontSize: '10px',
                          padding: '4px 6px'
                        }}
                      >
                        {togglingId === plugin.plugin_id ? (
                          <FontAwesomeIcon icon={faSpinner} spin />
                        ) : isActive ? (
                          <><FontAwesomeIcon icon={faToggleOn} /> Off</>
                        ) : (
                          <><FontAwesomeIcon icon={faToggleOff} /> On</>
                        )}
                      </button>
                      {isActive && hasAdminPage(plugin) && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => navigate(`/admin/plugins/${plugin.plugin_id}`)}
                          style={{ fontSize: '10px', padding: '4px 6px' }}
                        >
                          <FontAwesomeIcon icon={faCog} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sección Mercado Pago Point (solo si aplica al país o ya hay terminales) */}
        {showMPSection && (
          <div id="mp-point-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', marginTop: '20px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ fontSize: '14px', color: '#111', margin: 0 }}>
                <FontAwesomeIcon icon={faCreditCard} style={{ color: '#009EE3', marginRight: '6px' }} />
                Mercado Pago Point
              </h2>
              <button onClick={() => { resetWizard(); setShowModal(true); }} className="btn btn-primary btn-sm">
                <FontAwesomeIcon icon={faPlus} /> Agregar
              </button>
            </div>

            <div style={{ marginBottom: '12px', padding: '8px 12px', background: '#fffbe6', border: '1px solid #e6c200', borderRadius: '6px' }}>
              <p style={{ margin: 0, fontSize: '11px', color: '#555' }}>
                <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#e6a800', marginRight: '4px' }} />
                1. App Mercado Pago: <strong>Tu negocio &gt; Sucursales y cajas</strong>. 2. Vincula tu Point al <strong>escanear QR</strong>. 3. Token en <a href="https://www.mercadopago.com/developers/panel/app" target="_blank" rel="noreferrer" style={{ color: '#0066cc' }}>mercadopago.com/developers</a>
              </p>
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
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                <FontAwesomeIcon icon={faGlobe} /> País del negocio
              </h2>
            </div>
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                gap: '6px',
                marginTop: '10px'
              }}>
                {COUNTRIES.map(c => (
                  <button
                    key={c.code}
                    onClick={() => selectCountry(c.code)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 10px',
                      background: country === c.code ? GOLD + '22' : '#fff',
                      border: country === c.code ? `2px solid ${GOLD}` : '1px solid #e5e7eb',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: country === c.code ? '700' : '500',
                      color: '#111',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{c.flag}</span>
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: configuración de plugin instalado */}
      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                <FontAwesomeIcon icon={faCog} /> {settingsOpen.name}
              </h2>
              <button className="modal-close" onClick={() => setSettingsOpen(null)}>&times;</button>
            </div>
            <div style={{ padding: '0 16px 16px' }}>
              <p style={{ color: '#666', fontSize: '12px', margin: '0 0 12px' }}>
                Config: <strong>{selectedStore?.name || 'tienda'}</strong>
              </p>
              {Object.keys(settingsOpen.settings_schema || {}).length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '12px' }}>
                  Sin opciones configurables.
                </p>
              ) : (
                Object.entries(settingsOpen.settings_schema || {}).map(([key, schema]) =>
                  renderSettingsField(key, schema)
                )
              )}
              {Object.keys(settingsOpen.settings_schema || {}).length > 0 && (
                <button
                  onClick={saveSettings}
                  disabled={savingSettings}
                  className="btn btn-primary btn-full btn-sm"
                  style={{ marginTop: '10px' }}
                >
                  <FontAwesomeIcon icon={faSave} />
                  {savingSettings ? ' Guardando...' : ' Guardar'}
                </button>
              )}
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
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required style={{ fontSize: '12px' }} />
                </div>
                <div className="form-group">
                  <label>Access Token</label>
                  <input type="text" value={formData.mercadopago_access_token} onChange={(e) => setFormData({ ...formData, mercadopago_access_token: e.target.value })} required style={{ fontSize: '12px' }} />
                </div>
                <div className="form-group">
                  <label>Terminal ID</label>
                  <input type="text" value={formData.mercadopago_terminal_id} onChange={(e) => setFormData({ ...formData, mercadopago_terminal_id: e.target.value })} required style={{ fontSize: '12px' }} />
                </div>
                <div className="flex gap-3 justify-end">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setShowModal(false); resetWizard(); }}>Cancelar</button>
                  <button type="submit" className="btn btn-primary btn-sm">Guardar</button>
                </div>
              </form>
            )}

            {setupStep === 'token' && (
              <div>
                <div className="form-group">
                  <label>Nombre (opcional)</label>
                  <input type="text" value={setupName} onChange={(e) => setSetupName(e.target.value)} placeholder="Ej: Point Caja 1" style={{ fontSize: '12px' }} />
                </div>
                <div className="form-group">
                  <label>Access Token *</label>
                  <input type="text" value={setupToken} onChange={(e) => setSetupToken(e.target.value)} placeholder="APP_USR-..." required style={{ fontFamily: 'monospace', fontSize: '12px' }} />
                  <small style={{ color: '#888', fontSize: '10px' }}>En <a href="https://www.mercadopago.com/developers/panel/app" target="_blank" rel="noreferrer" style={{ color: '#0066cc' }}>mercadopago.com/developers</a></small>
                </div>
                {detectError && (
                  <div style={{ padding: '8px', background: '#f8d7da', color: '#721c24', borderRadius: '6px', fontSize: '11px', marginBottom: '10px' }}>
                    {detectError}
                  </div>
                )}
                <button onClick={detectDevicesFromToken} disabled={detecting || !setupToken.trim()} className="btn btn-primary btn-sm btn-full" style={{ marginTop: '6px' }}>
                  <FontAwesomeIcon icon={detecting ? faSync : faSearch} spin={detecting} /> {detecting ? 'Buscando...' : 'Detectar Points'}
                </button>
              </div>
            )}

            {setupStep === 'detect' && (
              <div>
                <p style={{ fontSize: '12px', color: '#666', marginTop: 0 }}>
                  {detectedDevices.length} dispositivo{detectedDevices.length > 1 ? 's' : ''}. Selecciona:
                </p>
                {detectedDevices.map(dev => (
                  <div key={dev.id} style={{ padding: '10px', background: '#fafafa', borderRadius: '8px', marginBottom: '6px', border: '2px solid #e0e0e0', cursor: 'pointer', transition: 'border-color 0.2s' }}
                    onClick={() => !savingSetup && selectDevice(dev)}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2ecc71'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700' }}>{dev.id.split('__')[0]}</div>
                        <div style={{ fontSize: '10px', color: '#888', fontFamily: 'monospace' }}>{dev.id}</div>
                      </div>
                      <div style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', background: dev.operating_mode === 'PDV' ? '#2ecc7133' : '#3498db33', color: dev.operating_mode === 'PDV' ? '#27ae60' : '#2980b9' }}>
                        {dev.operating_mode}
                      </div>
                    </div>
                  </div>
                ))}
                {savingSetup && <p style={{ textAlign: 'center', color: '#888', fontSize: '11px' }}>Configurando...</p>}
                <button onClick={() => setSetupStep('token')} className="btn btn-secondary btn-sm btn-full" style={{ marginTop: '6px' }}>
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
