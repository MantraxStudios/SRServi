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
  const [tuuApiKey, setTuuApiKey] = useState('');
  const [tuuDteType, setTuuDteType] = useState(0);
  const [tuuSaving, setTuuSaving] = useState(false);
  const [tuuSaveMsg, setTuuSaveMsg] = useState('');
  const [tuuPosDevices, setTuuPosDevices] = useState([]);
  const [tuuStoreDevices, setTuuStoreDevices] = useState([]);
  const [tuuAssignments, setTuuAssignments] = useState([]);
  const [tuuAddForm, setTuuAddForm] = useState({ name: '', serial: '' });
  const [tuuAdding, setTuuAdding] = useState(false);

  // ==== Unified POS list (unified POS list + modal) ====
  const [posList, setPosList] = useState([]);
  const [showPosModal, setShowPosModal] = useState(false);
  const [posTab, setPosTab] = useState(0);
  const [mpNewName, setMpNewName] = useState('');
  const [mpNewToken, setMpNewToken] = useState('');
  const [mpNewTerminalId, setMpNewTerminalId] = useState('');
  const [savingMp, setSavingMp] = useState(false);
  const [mpSaveMsg, setMpSaveMsg] = useState('');
  const [tuuNewName, setTuuNewName] = useState('');
  const [tuuNewSerial, setTuuNewSerial] = useState('');
  const [tuuNewDteType, setTuuNewDteType] = useState(0);
  const [savingTuu, setSavingTuu] = useState(false);
  const [tuuSaveMsg2, setTuuSaveMsg2] = useState('');

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

  // ==== Unified POS helpers ====
  const buildPosList = (mpTerminals, tuuDevices, tuuAssignments, tuuStoreDevs) => {
    const mpList = (Array.isArray(mpTerminals) ? mpTerminals : []).map(t => ({
      id: t.id,
      provider: 'mercadopago',
      name: t.name,
      terminal_id: t.mercadopago_terminal_id,
      store_id: t.store_id,
    }));
    const tuuList = (Array.isArray(tuuDevices) ? tuuDevices : []).map(d => {
      const assign = (Array.isArray(tuuAssignments) ? tuuAssignments : []).find(a => a.tuu_device_id === d.id);
      const storeDev = (Array.isArray(tuuStoreDevs) ? tuuStoreDevs : []).find(s => s.device_uid === assign?.device_uid);
      return {
        id: d.id,
        provider: 'tuu',
        name: d.name,
        serial: d.serial,
        device_uid: assign?.device_uid || null,
        assigned: !!storeDev,
        assigned_name: storeDev?.device_name || null,
        store_id: d.store_id,
      };
    });
    return [...mpList, ...tuuList];
  };

  const fetchPosList = async () => {
    if (!selectedStore?.id) return;
    const [mpRes, tuuRes] = await Promise.all([
      fetch(API + '/api/mercado-pago-terminals').catch(() => null),
      fetch(API + '/api/tuu/devices?store_id=' + selectedStore.id).catch(() => null),
    ]);
    const tuuData = tuuRes?.ok ? await tuuRes.json() : { posDevices: [], storeDevices: [], assignments: [] };
    let mpTerminals = [];
    if (mpRes?.ok) {
      const raw = await mpRes.json();
      mpTerminals = Array.isArray(raw) ? raw : (raw.terminals || []);
    }
    setPosList(buildPosList(mpTerminals, tuuData.posDevices || [], tuuData.assignments || [], tuuData.storeDevices || []));
  };

  const saveMpPos = async () => {
    if (!mpNewName.trim() || !mpNewToken.trim() || !mpNewTerminalId.trim()) { setMpSaveMsg('Completa todos los campos'); return; }
    setSavingMp(true); setMpSaveMsg('');
    try {
      const res = await fetch(API + '/api/mercadopago-terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name: mpNewName.trim(), mercadopago_access_token: mpNewToken.trim(), mercadopago_terminal_id: mpNewTerminalId.trim(), store_id: selectedStore.id })
      });
      const data = await res.json();
      if (res.ok) {
        setMpSaveMsg('✔ Guardado');
        setMpNewName(''); setMpNewToken(''); setMpNewTerminalId('');
        fetchPosList();
        setTimeout(() => setShowPosModal(false), 1200);
      } else { setMpSaveMsg('Error: ' + (data.error || 'revisalo')); }
    } catch { setMpSaveMsg('Error de conexion'); }
    finally { setSavingMp(false); }
  };

  const saveTuuPos = async () => {
    if (!tuuNewName.trim() || !tuuNewSerial.trim()) { setTuuSaveMsg2('Completa todos los campos'); return; }
    setSavingTuu(true); setTuuSaveMsg2('');
    try {
      const res = await fetch(API + '/api/tuu/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStore.id, name: tuuNewName.trim(), serial: tuuNewSerial.trim(), dte_type: tuuNewDteType })
      });
      const data = await res.json();
      if (res.ok || data.success) {
        setTuuSaveMsg2('✔ Guardado');
        setTuuNewName(''); setTuuNewSerial('');
        fetchPosList();
        setTimeout(() => setShowPosModal(false), 1200);
      } else { setTuuSaveMsg2('Error: ' + (data.error || 'revisalo')); }
    } catch { setTuuSaveMsg2('Error de conexion'); }
    finally { setSavingTuu(false); }
  };

  const deletePos = async (pos) => {
    if (!confirm('¿Eliminar este terminal?')) return;
    if (pos.provider === 'mercadopago') {
      await fetch(API + '/api/mercadopago-terminal/' + pos.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    } else if (pos.provider === 'tuu') {
      await fetch(API + '/api/tuu/devices/' + pos.id, { method: 'DELETE' });
    }
    fetchPosList();
  };

  useEffect(() => {
    fetchTerminals();
    fetchWorkshopPlugins();
    fetchTuuConfig();
    fetchPosList();
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

        {/* ==== HEADER UNIFICADO ==== */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', marginTop: '8px' }}>
          <h2 style={{ fontSize: '16px', color: '#111', margin: 0, fontWeight: '800' }}>Terminales POS</h2>
          <button onClick={() => { setShowPosModal(true); setPosTab(0); }} className="btn btn-primary btn-sm" style={{ background: '#D4AF37', color: '#000', fontWeight: '800' }}>
            <FontAwesomeIcon icon={faPlus} /> Agregar Terminal
          </button>
        </div>

        {/* ==== LISTA UNIFICADA DE POS ==== */}
        {posList.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', border: '2px dashed #e5e7eb', borderRadius: '12px', background: '#fafafa' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💳</div>
            <p style={{ color: '#9ca3af', margin: '0 0 8px', fontSize: '14px' }}>Sin terminals POS configurados</p>
            <p style={{ color: '#bbb', margin: 0, fontSize: '12px' }}>Presiona "Agregar Terminal" para vincular tu primera terminal</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {posList.map(pos => (
              <div key={pos.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '4px' }}>
                  <button onClick={() => deletePos(pos)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '14px', padding: '2px 4px' }} title="Eliminar">✕</button>
                </div>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', background: pos.provider === 'mercadopago' ? '#009EE315' : pos.provider === 'tuu' ? '#9c27b015' : '#3b82f615' }}>
                  {pos.provider === 'mercadopago' ? '💳' : pos.provider === 'tuu' ? '📱' : '📟'}
                </div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#111', marginBottom: '2px' }}>{pos.name}</div>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>
                  {pos.provider === 'mercadopago' ? 'Mercado Pago Point' : pos.provider === 'tuu' ? 'Tuu POS' : pos.provider === 'square' ? 'Square' : 'Sumup'}
                </div>
                {pos.provider === 'tuu' ? (
                  <div style={{ fontSize: '10px', color: '#999', fontFamily: 'monospace' }}>Serial: {pos.serial || '—'}</div>
                ) : pos.provider === 'mercadopago' ? (
                  <div style={{ fontSize: '10px', color: '#999', fontFamily: 'monospace' }}>ID: {pos.terminal_id ? pos.terminal_id.slice(0,12) + '...' : '—'}</div>
                ) : null}
                {pos.device_uid && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: pos.assigned ? '#22c55e' : '#fbbf24' }}></div>
                    <span style={{ fontSize: '10px', color: '#666' }}>{pos.assigned ? pos.assigned_name : 'Sin asignar'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ==== MODAL AGREGAR POS ==== */}
        {showPosModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#111' }}>Agregar Terminal</h3>
                <button onClick={() => setShowPosModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#999', padding: '4px' }}>✕</button>
              </div>
              <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', margin: '16px 0 0', padding: '0 20px' }}>
                {['Mercado Pago', 'Tuu POS', 'Square', 'Sumup'].map((tab, i) => (
                  <button key={tab} onClick={() => setPosTab(i)} style={{ padding: '10px 14px', background: 'none', border: 'none', borderBottom: posTab === i ? '3px solid #D4AF37' : '3px solid transparent', cursor: 'pointer', fontSize: '13px', fontWeight: posTab === i ? '800' : '500', color: posTab === i ? '#111' : '#999', whiteSpace: 'nowrap' }}>{tab}</button>
                ))}
              </div>
              <div style={{ padding: '20px' }}>
                {posTab === 0 && (
                  <div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '4px' }}>Nombre de la terminal</label>
                      <input value={mpNewName} onChange={e => setMpNewName(e.target.value)} placeholder="Ej: Mostrador principal" style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '4px' }}>Access Token de Mercado Pago</label>
                      <input value={mpNewToken} onChange={e => setMpNewToken(e.target.value)} placeholder="APP_USR-xxxxxxxx-xxxx-xxxx" style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '4px' }}>Terminal ID</label>
                      <input value={mpNewTerminalId} onChange={e => setMpNewTerminalId(e.target.value)} placeholder="E-Terminal-xxxxx" style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                    </div>
                    <button onClick={saveMpPos} disabled={savingMp} className="btn btn-primary" style={{ width: '100%', background: '#009ee3', color: '#fff', fontWeight: '800', padding: '12px', borderRadius: '10px', border: 'none', fontSize: '15px' }}>
                      {savingMp ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Guardar Mercado Pago'}
                    </button>
                  </div>
                )}
                {posTab === 1 && (
                  <div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '4px' }}>Nombre del POS</label>
                      <input value={tuuNewName} onChange={e => setTuuNewName(e.target.value)} placeholder="Ej: Mostrador" style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '4px' }}>Serial del POS</label>
                      <input value={tuuNewSerial} onChange={e => setTuuNewSerial(e.target.value)} placeholder="XXXXXXXXXX" style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '4px' }}>Tipo de documento</label>
                      <select value={tuuNewDteType} onChange={e => setTuuNewDteType(parseInt(e.target.value))} style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}>
                        <option value={0}>Sin boleta</option>
                        <option value={39}>Boleta</option>
                        <option value={41}>Boleta exenta</option>
                        <option value={33}>Factura</option>
                        <option value={34}>Factura exenta</option>
                      </select>
                    </div>
                    <button onClick={saveTuuPos} disabled={savingTuu} className="btn btn-primary" style={{ width: '100%', background: '#6a1b9a', color: '#fff', fontWeight: '800', padding: '12px', borderRadius: '10px', border: 'none', fontSize: '15px' }}>
                      {savingTuu ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Guardar Tuu POS'}
                    </button>
                  </div>
                )}
                {posTab === 2 && (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔲</div>
                    <p style={{ color: '#666', fontSize: '13px' }}>Square próximamente</p>
                    <p style={{ color: '#bbb', fontSize: '12px' }}>Las credenciales se configuran desde <a href="#" style={{ color: '#0066cc' }}>square.com</a></p>
                  </div>
                )}
                {posTab === 3 && (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ fontSize: '36px', marginBottom: '12px' }}>📱</div>
                    <p style={{ color: '#666', fontSize: '13px' }}>Sumup próximamente</p>
                    <p style={{ color: '#bbb', fontSize: '12px' }}>Las credenciales se configuran desde <a href="#" style={{ color: '#0066cc' }}>sumup.com</a></p>
                  </div>
                )}
                {posTab === 0 && mpSaveMsg && <p style={{ marginTop: '10px', fontSize: '12px', color: mpSaveMsg.includes('Error') ? '#dc3545' : '#155724' }}>{mpSaveMsg}</p>}
                {posTab === 1 && tuuSaveMsg2 && <p style={{ marginTop: '10px', fontSize: '12px', color: tuuSaveMsg2.includes('Error') ? '#dc3545' : '#155724' }}>{tuuSaveMsg2}</p>}
              </div>
            </div>
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
