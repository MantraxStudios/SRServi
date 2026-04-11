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

  // ==== TUU POS native ====
  const [tuuConfigOpen, setTuuConfigOpen] = useState(false);
  const [tuuApiKey, setTuuApiKey] = useState('');
  const [tuuDteType, setTuuDteType] = useState(0);
  const [tuuSaving, setTuuSaving] = useState(false);
  const [tuuSaveMsg, setTuuSaveMsg] = useState('');
  const [tuuPosDevices, setTuuPosDevices] = useState([]);
  const [tuuStoreDevices, setTuuStoreDevices] = useState([]);
  const [tuuAssignments, setTuuAssignments] = useState([]);
  const [tuuAddForm, setTuuAddForm] = useState({ name: '', serial: '' });
  const [tuuAdding, setTuuAdding] = useState(false);

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
    fetchTuuConfig();
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

  const fetchTuuConfig = async () => {
    if (!selectedStore?.id) return;
    try {
      const res = await fetch(API + '/api/tuu/config?store_id=' + selectedStore.id);
      if (res.ok) {
        const data = await res.json();
        setTuuApiKey(data.api_key || '');
        setTuuDteType(data.dte_type || 0);
      }
    } catch {}
    try {
      const res = await fetch(API + '/api/tuu/devices?store_id=' + selectedStore.id);
      if (res.ok) {
        const data = await res.json();
        setTuuPosDevices(data.posDevices || []);
        setTuuStoreDevices(data.storeDevices || []);
        setTuuAssignments(data.assignments || []);
      }
    } catch {}
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

        {/* POS nativos */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '8px',
          marginBottom: '16px'
        }}>
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

          <div style={{
            background: '#fff',
            border: '2px solid #9c27b0',
            borderRadius: '8px',
            padding: '10px',
            minWidth: '140px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '6px',
                background: '#9c27b015',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px'
              }}>📱</div>
              <div style={{ flex: 1, fontSize: '12px', fontWeight: '700', color: '#111' }}>Tuu POS</div>
              <span style={{ padding: '2px 6px', background: '#9c27b022', color: '#6a1b9a', borderRadius: '6px', fontSize: '9px', fontWeight: '700' }}>NATIVO</span>
            </div>
            <button onClick={() => setTuuConfigOpen(true)} className="btn btn-sm" style={{ width: '100%', fontSize: '10px', padding: '4px 6px', background: '#9c27b0', color: '#fff' }}>
              <FontAwesomeIcon icon={faLink} /> Configurar
            </button>
          </div>
        </div>

        {/* ==== Sección: TUU POS nativo ==== */}
        <div style={{ marginTop: '16px' }}>
          <h2 style={{ fontSize: '14px', color: '#111', margin: '0 0 8px' }}>
            <FontAwesomeIcon icon={faCreditCard} style={{ marginRight: '6px', color: '#9c27b0' }} />
            Tuu POS
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#fafafa',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  background: '#9c27b022', color: '#9c27b0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px'
                }}>
                  <FontAwesomeIcon icon={faCreditCard} />
                </div>
                <div style={{ flex: 1, fontSize: '12px', fontWeight: '700', color: '#111' }}>
                  Tuu POS
                </div>
                <span style={{ padding: '2px 6px', background: '#9c27b022', color: '#9c27b0', borderRadius: '6px', fontSize: '9px', fontWeight: '700' }}>NATIVO</span>
                <button
                  className="btn btn-sm"
                  onClick={() => setTuuConfigOpen(true)}
                  style={{
                    background: '#9c27b020',
                    color: '#6a1b9a',
                    border: '1px solid #9c27b040',
                    fontWeight: '700',
                    fontSize: '10px',
                    padding: '4px 8px'
                  }}
                >
                  <FontAwesomeIcon icon={faCog} /> Config
                </button>
              </div>
              {tuuApiKey && tuuPosDevices.length > 0 && (
                <div style={{ padding: '6px 12px', fontSize: '11px', color: '#166534', background: '#f0fdf4' }}>
                  <FontAwesomeIcon icon={faCheckCircle} style={{ marginRight: '4px' }} />
                  {tuuPosDevices.length} POS configurado(s)
                </div>
              )}
              {!tuuApiKey && (
                <div style={{ padding: '6px 12px', fontSize: '11px', color: '#92400e', background: '#fffbeb' }}>
                  <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: '4px' }} />
                  Sin API Key — abre Config para configurar
                </div>
              )}
            </div>
            <div style={{ padding: '6px 10px', fontSize: '10px', color: '#6b7280', background: '#fafafa', borderTop: '1px solid #e5e7eb' }}>
              API Key en <a href="https://integrations.payment.haulmer.com" target="_blank" style={{ color: '#6a1b9a' }}>integrations.payment.haulmer.com</a>
            </div>
          </div>
        </div>


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

      {tuuConfigOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '520px', padding: '24px' }}>
            <h2 style={{ color: '#6a1b9a', marginBottom: '4px' }}>
              <FontAwesomeIcon icon={faCreditCard} style={{ marginRight: '8px' }} />
              Tuu POS — Configuración
            </h2>
            <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>
              Terminales POS para Cobro con Tarjeta
            </p>

            {/* Instrucciones */}
            <div style={{ border: '2px solid #9c27b0', borderRadius: '12px', padding: '14px', background: '#f3e5f5', marginBottom: '16px' }}>
              <h3 style={{ color: '#6a1b9a', margin: '0 0 8px', fontSize: '14px' }}>¿Cómo empezar?</h3>
              <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#444', lineHeight: '1.8' }}>
                <li><strong>Obtén tu API Key</strong> desde <a href="https://integrations.payment.haulmer.com" target="_blank" style={{ color: '#6a1b9a' }}>integrations.payment.haulmer.com</a> y pégala abajo.</li>
                <li><strong>Agrega tus POS</strong> con el nombre y serial del equipo.</li>
                <li><strong>Asigna cada tablet/celular</strong> a un POS — cuando un trabajador abre la tienda, se registra automáticamente.</li>
                <li><strong>En la caja</strong>, al cobrar elegís "Tuu" y el sistema usa el POS asignado.</li>
              </ol>
            </div>

            {/* API Key */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', display: 'block', marginBottom: '6px' }}>API Key</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="password"
                  value={tuuApiKey}
                  onChange={e => setTuuApiKey(e.target.value)}
                  placeholder="API Key de Tuu"
                  style={{ flex: 1, minWidth: '200px', padding: '8px 10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
                />
                <select
                  value={tuuDteType}
                  onChange={e => setTuuDteType(parseInt(e.target.value))}
                  style={{ padding: '8px 10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
                >
                  <option value={0}>Sin documento</option>
                  <option value={33}>Factura</option>
                  <option value={48}>Boleta NA</option>
                  <option value={99}>Boleta</option>
                </select>
                <button
                  onClick={async () => {
                    setTuuSaving(true);
                    setTuuSaveMsg('');
                    try {
                      const res = await fetch(API + '/api/tuu/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ store_id: selectedStore.id, api_key: tuuApiKey, dte_type: tuuDteType })
                      });
                      const data = await res.json();
                      setTuuSaveMsg(data.api_key ? 'Guardado ✓' : 'Error al guardar');
                    } catch { setTuuSaveMsg('Error de conexión'); }
                    setTuuSaving(false);
                    setTimeout(() => setTuuSaveMsg(''), 3000);
                  }}
                  disabled={tuuSaving}
                  className="btn btn-sm"
                  style={{ background: '#6a1b9a', color: '#fff', fontWeight: '700' }}
                >
                  {tuuSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <><FontAwesomeIcon icon={faSave} /> Guardar</>}
                </button>
              </div>
              {tuuSaveMsg && <p style={{ marginTop: '6px', fontSize: '12px', color: tuuSaveMsg.includes('Error') ? '#dc3545' : '#155724' }}>{tuuSaveMsg}</p>}
            </div>

            {/* POS Devices */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700' }}>Dispositivos POS</label>
                <button
                  onClick={() => setTuuAddForm({ name: '', serial: '' })}
                  className="btn btn-sm"
                  style={{ background: '#D4AF37', color: '#000', fontWeight: '700', fontSize: '12px' }}
                >
                  + Agregar POS
                </button>
              </div>
              {tuuAddForm && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <input
                    value={tuuAddForm.name}
                    onChange={e => setTuuAddForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Nombre (ej: Caja 1)"
                    style={{ flex: 1, minWidth: '120px', padding: '7px 10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }}
                  />
                  <input
                    value={tuuAddForm.serial}
                    onChange={e => setTuuAddForm(p => ({ ...p, serial: e.target.value }))}
                    placeholder="Serial (ej: TJ44...)"
                    style={{ flex: 1, minWidth: '120px', padding: '7px 10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }}
                  />
                  <button
                    onClick={async () => {
                      if (!tuuAddForm.name || !tuuAddForm.serial) return;
                      setTuuAdding(true);
                      await fetch(API + '/api/tuu/devices', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ store_id: selectedStore.id, name: tuuAddForm.name, serial: tuuAddForm.serial })
                      });
                      setTuuAdding(false);
                      setTuuAddForm(null);
                      fetchTuuConfig();
                    }}
                    disabled={tuuAdding}
                    className="btn btn-sm"
                    style={{ background: '#6a1b9a', color: '#fff', fontWeight: '700' }}
                  >
                    {tuuAdding ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Agregar'}
                  </button>
                  <button onClick={() => setTuuAddForm(null)} className="btn btn-sm btn-secondary" style={{ fontSize: '12px' }}>Cancelar</button>
                </div>
              )}
              {tuuPosDevices.length === 0 && (
                <p style={{ color: '#999', fontSize: '13px' }}>Sin POS. Agrega uno.</p>
              )}
              {tuuPosDevices.map(d => (
                <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div>
                    <strong style={{ fontSize: '13px' }}>{d.name}</strong>
                    <div style={{ fontSize: '12px', color: '#666' }}>{d.serial}</div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm('¿Eliminar este POS?')) return;
                      await fetch(API + '/api/tuu/devices/' + d.id, { method: 'DELETE' });
                      fetchTuuConfig();
                    }}
                    className="btn btn-sm"
                    style={{ background: '#dc3545', color: '#fff', fontSize: '11px', padding: '4px 8px' }}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>

            {/* Device-POS Assignment */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', display: 'block', marginBottom: '6px' }}>Asignar POS a Dispositivos</label>
              <p style={{ fontSize: '12px', color: '#666', margin: '0 0 10px' }}>Cada tablet/celular que accede a tu tienda se registra aquí. Asigna qué POS usa cada uno.</p>
              {tuuStoreDevices.length === 0 && (
                <p style={{ color: '#999', fontSize: '13px' }}>No hay dispositivos registrados. Abre la tienda desde un dispositivo para que se registre.</p>
              )}
              {tuuStoreDevices.map(sd => {
                const assigned = tuuAssignments.find(a => a.device_uid === sd.device_uid);
                return (
                  <div key={sd.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid #f0f0f0', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: '12px' }}>{sd.label || 'Sin nombre'}</strong>
                      <div style={{ fontSize: '10px', color: '#888', fontFamily: 'monospace', background: '#f5f5f5', padding: '1px 4px', borderRadius: '3px' }}>
                        {sd.device_uid?.substring(0, 16)}...
                      </div>
                    </div>
                    <select
                      value={assigned?.tuu_device_id || ''}
                      onChange={async e => {
                        const posId = e.target.value;
                        if (!posId) return;
                        await fetch(API + '/api/tuu/devices/assign', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ store_id: selectedStore.id, device_uid: sd.device_uid, tuu_device_id: parseInt(posId) })
                        });
                        fetchTuuConfig();
                      }}
                      style={{ padding: '6px 8px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '12px' }}
                    >
                      <option value="">Sin POS</option>
                      {tuuPosDevices.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            <button onClick={() => setTuuConfigOpen(false)} className="btn btn-secondary btn-full">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default MercadoPagoPoints;
