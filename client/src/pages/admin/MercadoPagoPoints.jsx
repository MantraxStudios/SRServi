import { useEffect, useState, useMemo, useRef } from 'react';
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
import { QRCodeCanvas } from 'qrcode.react';

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
  const [mpModalStep, setMpModalStep] = useState('token');
  const [mpModalDetected, setMpModalDetected] = useState([]);
  const [mpModalDetecting, setMpModalDetecting] = useState(false);
  const [mpModalError, setMpModalError] = useState('');
  const [mpWorkingBanner, setMpWorkingBanner] = useState(false);
  const [mpBannerMode, setMpBannerMode] = useState(null); // null = cargando, string = modo detectado
  const [tuuNewName, setTuuNewName] = useState('');
  const [tuuNewSerial, setTuuNewSerial] = useState('');
  const [tuuNewDeviceId, setTuuNewDeviceId] = useState('');
  const [tuuNewApiKey, setTuuNewApiKey] = useState('');
  const [tuuNewDteType, setTuuNewDteType] = useState(0);
  const [savingTuu, setSavingTuu] = useState(false);
  const [tuuSaveMsg2, setTuuSaveMsg2] = useState('');

  // === MercadoPago QR (credencial directa de la tienda) ===
  const [mpQrToken, setMpQrToken] = useState('');
  const [mpQrConfigured, setMpQrConfigured] = useState(false);
  const [mpQrPreview, setMpQrPreview] = useState('');
  const [mpQrSaving, setMpQrSaving] = useState(false);
  const [mpQrMsg, setMpQrMsg] = useState('');

  // === Haulmer QR nativo ===
  const [haulmerAccountId, setHaulmerAccountId] = useState('');
  const [haulmerSecretKey, setHaulmerSecretKey] = useState('');
  const [haulmerCommerceName, setHaulmerCommerceName] = useState('');
  const [haulmerSaving, setHaulmerSaving] = useState(false);
  const [haulmerMsg, setHaulmerMsg] = useState('');
  const [haulmerLoaded, setHaulmerLoaded] = useState(false);

  // === Square Terminal state ===
  const [squareAccessToken, setSquareAccessToken] = useState('');
  const [squareLocationId, setSquareLocationId] = useState('');
  const [squareDeviceName, setSquareDeviceName] = useState('');
  const [squareLocations, setSquareLocations] = useState([]);
  const [squareLoadingLocs, setSquareLoadingLocs] = useState(false);
  const [squareCode, setSquareCode] = useState('');
  const [squareCodeId, setSquareCodeId] = useState('');
  const [squareCodeExpiry, setSquareCodeExpiry] = useState('');
  const [squareCodeStatus, setSquareCodeStatus] = useState('');
  const [squareGenerating, setSquareGenerating] = useState(false);
  const [squarePolling, setSquarePolling] = useState(false);
  const [squarePollMsg, setSquarePollMsg] = useState('');
  const [squareSavingCfg, setSquareSavingCfg] = useState(false);
  const [squareCfgSaved, setSquareCfgSaved] = useState(false);
  const [squareDevices, setSquareDevices] = useState([]);
  const [squareStep, setSquareStep] = useState('config'); // 'config' | 'code' | 'paired'
  const [squareError, setSquareError] = useState('');

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
  // terminals viene de /api/pos-terminals — ya unificado, todos los providers
  const buildPosList = (posTerminals) => {
    return (Array.isArray(posTerminals) ? posTerminals : []).map(t => ({
      id: t.id,
      provider: t.provider,
      name: t.name,
      terminal_id: t.device_id,
      device_id: t.device_id,
      store_id: t.store_id,
      pos_pin: t.pos_pin || null,
    }));
  };

  const saveMpPos = async () => {
    if (!mpNewName.trim() || !mpNewToken.trim() || !mpNewTerminalId.trim()) { setMpSaveMsg('Completa todos los campos'); return; }
    setSavingMp(true); setMpSaveMsg('');
    try {
      const res = await fetch(API + '/api/pos-terminals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ store_id: selectedStore.id, provider: 'mercadopago', name: mpNewName.trim(), api_key: mpNewToken.trim(), device_id: mpNewTerminalId.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setMpSaveMsg('✔ Guardado');
        setMpNewName(''); setMpNewToken(''); setMpNewTerminalId('');
        refreshAll();
        setTimeout(() => setShowPosModal(false), 1200);
      } else { setMpSaveMsg('Error: ' + (data.error || 'revisalo')); }
    } catch { setMpSaveMsg('Error de conexion'); }
    finally { setSavingMp(false); }
  };

  const saveTuuPos = async () => {
    if (!tuuNewName.trim() || !tuuNewSerial.trim()) { setTuuSaveMsg2('Completa todos los campos'); return; }
    setSavingTuu(true); setTuuSaveMsg2('');
    try {
      const res = await fetch(API + '/api/pos-terminals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ store_id: selectedStore.id, provider: 'tuu', name: tuuNewName.trim(), api_key: tuuNewApiKey.trim(), device_id: tuuNewSerial.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setTuuSaveMsg2('✔ Guardado');
        setTuuNewName(''); setTuuNewSerial(''); setTuuNewDeviceId(''); setTuuNewApiKey('');
        refreshAll();
        setTimeout(() => setShowPosModal(false), 1200);
      } else { setTuuSaveMsg2('Error: ' + (data.error || 'revisalo')); }
    } catch { setTuuSaveMsg2('Error de conexion'); }
    finally { setSavingTuu(false); }
  };

  const deletePos = async (pos) => {
    if (!confirm('¿Eliminar este terminal?')) return;
    await fetch(API + '/api/pos-terminals/' + pos.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    refreshAll();
  };

  // Calls all fetch functions in parallel to refresh data from server.
  // fetchTerminals, fetchTuuConfig, fetchSquareData are declared further below —
  // this is fine because refreshAll is only ever *called* at runtime (events/effects),
  // never at declaration time, so all const functions are already evaluated by then.
  const refreshAll = async () => {
    try {
      await Promise.all([
        fetchTerminals(),
        fetchTuuConfig(),
        fetchSquareData(),
      ]);
    } catch { /* silently ignore */ }
  };

  const fetchMpQrConfig = async () => {
    if (!selectedStore?.id || !token) return;
    try {
      const res = await fetch(API + `/api/stores/${selectedStore.id}/mp-config`, { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) {
        const data = await res.json();
        setMpQrConfigured(data.configured);
        setMpQrPreview(data.token_preview || '');
      }
    } catch {}
  };

  const saveMpQrConfig = async () => {
    if (!mpQrToken.trim()) { setMpQrMsg('Ingresa el Access Token'); return; }
    setMpQrSaving(true); setMpQrMsg('');
    try {
      const res = await fetch(API + `/api/stores/${selectedStore.id}/mp-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ mp_access_token: mpQrToken.trim() })
      });
      if (res.ok) {
        setMpQrMsg('✔ Guardado correctamente');
        setMpQrToken('');
        setMpQrConfigured(true);
        fetchMpQrConfig();
        setTimeout(() => setMpQrMsg(''), 3000);
      } else {
        const d = await res.json();
        setMpQrMsg('Error: ' + (d.error || 'Token inválido'));
      }
    } catch { setMpQrMsg('Error de conexión'); }
    finally { setMpQrSaving(false); }
  };

  useEffect(() => {
    fetchWorkshopPlugins();
    fetchHaulmerConfig();
    fetchMpQrConfig();
    refreshAll();
    setPluginCountriesMap(loadPluginCountries());
  }, [selectedStore?.id]);

  // Reconstruir la lista unificada — terminals ya viene de /api/pos-terminals (todos los providers)
  useEffect(() => {
    setPosList(buildPosList(terminals));
  }, [terminals]);

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

  const fetchSquareData = async () => {
    if (!selectedStore?.id || !token) return;
    try {
      const res = await fetch(API + `/api/square/config?store_id=${selectedStore.id}`, { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) {
        const data = await res.json();
        setSquareCfgSaved(data.hasToken);
        setSquareLocationId(data.location_id || '');
      }
    } catch {}
    try {
      const res = await fetch(API + '/api/square/devices?store_id=' + selectedStore.id, { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) setSquareDevices(await res.json());
    } catch {}
  };

  const fetchHaulmerConfig = async () => {
    if (!token || !selectedStore?.id) return;
    try {
      const res = await fetch(API + `/api/haulmer/config?store_id=${selectedStore.id}`, { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) {
        const data = await res.json();
        setHaulmerAccountId(data.account_id || '');
        setHaulmerCommerceName(data.commerce_name || '');
        setHaulmerLoaded(!!(data.account_id));
      }
    } catch {}
  };

  const saveHaulmerConfig = async () => {
    if (!haulmerAccountId.trim() || !haulmerSecretKey.trim()) {
      setHaulmerMsg('Account ID y Secret Key son requeridos');
      return;
    }
    setHaulmerSaving(true); setHaulmerMsg('');
    try {
      const res = await fetch(API + '/api/haulmer/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          account_id: haulmerAccountId.trim(),
          secret_key: haulmerSecretKey.trim(),
          commerce_name: haulmerCommerceName.trim() || 'Mi Tienda',
          store_id: selectedStore?.id || null
        })
      });
      if (res.ok) {
        setHaulmerMsg('✔ Guardado correctamente');
        setHaulmerSecretKey('');
        setHaulmerLoaded(true);
        setTimeout(() => setHaulmerMsg(''), 3000);
      } else {
        const d = await res.json();
        setHaulmerMsg('Error: ' + (d.error || 'intenta de nuevo'));
      }
    } catch { setHaulmerMsg('Error de conexión'); }
    finally { setHaulmerSaving(false); }
  };

  const squareSaveConfig = async () => {
    if (!squareAccessToken.trim()) { setSquareError('Ingresa el Access Token'); return; }
    if (!squareLocationId.trim()) { setSquareError('Ingresa el Location ID'); return; }
    setSquareSavingCfg(true); setSquareError('');
    try {
      const res = await fetch(API + '/api/square/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ access_token: squareAccessToken.trim(), location_id: squareLocationId.trim(), store_id: selectedStore?.id || null })
      });
      if (res.ok) { setSquareCfgSaved(true); setSquareError(''); }
      else { const d = await res.json(); setSquareError(d.error || 'Error al guardar'); }
    } catch { setSquareError('Error de conexión'); }
    setSquareSavingCfg(false);
  };

  const squareFetchLocations = async () => {
    setSquareLoadingLocs(true); setSquareError('');
    if (!squareCfgSaved) { await squareSaveConfig(); }
    try {
      const storeParam = selectedStore?.id ? `?store_id=${selectedStore.id}` : '';
      const res = await fetch(API + `/api/square/locations${storeParam}`, { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) { const locs = await res.json(); setSquareLocations(locs); }
      else { const d = await res.json(); setSquareError(d.error || 'Error al cargar ubicaciones'); }
    } catch { setSquareError('Error de conexión'); }
    setSquareLoadingLocs(false);
  };

  const squareGenerateCode = async () => {
    setSquareError('');
    if (!squareLocationId.trim()) { setSquareError('Selecciona o ingresa un Location ID'); return; }
    setSquareGenerating(true); setSquareCode(''); setSquareCodeId(''); setSquareCodeStatus(''); setSquarePollMsg('');
    try {
      // Save config first (in case token or location changed)
      const cfgRes = await fetch(API + '/api/square/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ access_token: squareAccessToken.trim() || undefined, location_id: squareLocationId.trim(), store_id: selectedStore?.id || null })
      });
      if (!cfgRes.ok && squareAccessToken.trim()) { const d = await cfgRes.json(); setSquareError(d.error || 'Error al guardar config'); setSquareGenerating(false); return; }
      const res = await fetch(API + '/api/square/device-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ location_id: squareLocationId.trim(), device_name: squareDeviceName.trim() || 'Square Terminal', store_id: selectedStore?.id || null })
      });
      const data = await res.json();
      if (!res.ok) { setSquareError(data.error || 'Error al generar código'); setSquareGenerating(false); return; }
      setSquareCode(data.code || '');
      setSquareCodeId(data.id || '');
      setSquareCodeExpiry(data.pair_by || '');
      setSquareCodeStatus(data.status || 'UNPAIRED');
      setSquareStep('code');
      // Start polling
      setSquarePolling(true);
      squarePoll(data.id);
    } catch (e) { setSquareError('Error: ' + e.message); }
    setSquareGenerating(false);
  };

  const squarePoll = async (codeId) => {
    let attempts = 0;
    const maxAttempts = 100; // ~5 min
    const intervalId = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) { clearInterval(intervalId); setSquarePolling(false); setSquarePollMsg('Código expirado. Genera uno nuevo.'); return; }
      try {
        const res = await fetch(API + `/api/square/device-code/${encodeURIComponent(codeId)}?store_id=${selectedStore?.id || ''}`, { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        setSquareCodeStatus(data.status || '');
        if (data.status === 'PAIRED' && data.device_id) {
          clearInterval(intervalId); setSquarePolling(false);
          setSquarePollMsg('✔ Terminal emparejado. Device ID: ' + data.device_id);
          setSquareStep('paired');
          // Auto-save device to unified pos_terminals
          await fetch(API + '/api/pos-terminals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ store_id: selectedStore.id, provider: 'square', name: squareDeviceName.trim() || 'Square Terminal', api_key: squareAccessToken, device_id: data.device_id })
          });
          fetchSquareData();
          refreshAll();
        } else if (data.status === 'UNKNOWN') {
          clearInterval(intervalId); setSquarePolling(false); setSquarePollMsg('Código expirado. Genera uno nuevo.');
        } else {
          setSquarePollMsg('Esperando que ingreses el código en el terminal... (' + attempts + ')');
        }
      } catch { /* ignore poll errors */ }
    }, 3000);
    // Store intervalId so we can clear it on unmount/tab switch
    window._squarePollInterval = intervalId;
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

  const qrRef = useRef(null);
  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${selectedStore?.code || 'tienda'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const scrollToMP = () => {
    const el = document.getElementById('mp-point-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ==== Mercado Pago Point (flujo original) ====
  const fetchTerminals = async () => {
    try {
      const storeParam = selectedStore?.id ? `?store_id=${selectedStore.id}` : '';
      const response = await fetch(API + '/api/pos-terminals' + storeParam, { headers: { Authorization: 'Bearer ' + token } });
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      setTerminals(list);
      // Only fetch MP devices for mercadopago terminals
      list.filter(t => t.provider === 'mercadopago').forEach(t => fetchDevices(t.id));
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

  // Re-fetch everything from server and rebuild the unified list.
  // Declared as function (not const) so it hoists and can be called anywhere in the component.
  if (loading) return <div className="loading">Cargando...</div>;

  const showMPSection = mpInCountry || terminals.length > 0;

  const inputStyle = { width: '100%', padding: '10px 13px', border: '1.5px solid #e2e2e2', borderRadius: '9px', fontSize: '13px', boxSizing: 'border-box', outline: 'none', background: '#fafafa', transition: 'border-color 0.15s', color: '#111' };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '700', color: '#666', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' };
  const sectionTitle = { fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 14px' };
  const card = { background: '#fff', border: '1px solid #ebebeb', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' };
  const providerMeta = (p) => ({
    mercadopago: { color: '#009EE3', bg: '#e8f6fd', emoji: '💳', name: 'Mercado Pago Point' },
    tuu:         { color: '#7c3aed', bg: '#f5f0ff', emoji: '📱', name: 'Tuu POS' },
    square:      { color: '#3b82f6', bg: '#eff6ff', emoji: '📟', name: 'Square Terminal' },
    sumup:       { color: '#f59e0b', bg: '#fef3c7', emoji: '💰', name: 'Sumup' },
  }[p] || { color: '#888', bg: '#f5f5f5', emoji: '💳', name: p });

  return (
    <>
      <header className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0 }}><FontAwesomeIcon icon={faCashRegister} style={{ marginRight: '10px' }} />Vincular POS</h1>
          {selectedStore && (
            <span style={{ fontSize: '12px', color: '#888', fontWeight: '500', background: '#f5f5f5', padding: '4px 10px', borderRadius: '20px' }}>
              {selectedStore.name}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCountryModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#f5f5f5', border: '1px solid #e5e5e5', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#333' }}
        >
          <span style={{ fontSize: '16px' }}>{activeCountry.flag}</span>
          {activeCountry.name}
        </button>
      </header>

      <div className="admin-main" style={{ maxWidth: '860px' }}>
        {installMessage && (
          <div style={{
            padding: '10px 14px', marginBottom: '20px', borderRadius: '10px', fontWeight: '600', fontSize: '13px',
            backgroundColor: installMessage.includes('Error') ? '#fef2f2' : '#f0fdf4',
            color: installMessage.includes('Error') ? '#dc2626' : '#16a34a',
            border: `1px solid ${installMessage.includes('Error') ? '#fecaca' : '#bbf7d0'}`
          }}>{installMessage}</div>
        )}

        {/* ── TERMINALES VINCULADAS ── */}
        <div style={{ marginBottom: '36px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <p style={sectionTitle}>Terminales vinculadas</p>
            <button
              onClick={() => { setShowPosModal(true); setPosTab(0); }}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: '9px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
            >
              <FontAwesomeIcon icon={faPlus} /> Agregar Terminal
            </button>
          </div>

          {posList.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', border: '2px dashed #e5e7eb', borderRadius: '14px', background: '#fafafa' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔌</div>
              <p style={{ color: '#555', margin: '0 0 4px', fontSize: '14px', fontWeight: '700' }}>Sin terminales configuradas</p>
              <p style={{ color: '#aaa', margin: 0, fontSize: '12px' }}>Presiona "Agregar Terminal" para vincular tu primera terminal de pago</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {posList.map(pos => {
                const meta = providerMeta(pos.provider);
                return (
                  <div key={pos.id} style={{ ...card, padding: '16px', position: 'relative', transition: 'box-shadow 0.18s, transform 0.18s' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <button onClick={() => deletePos(pos)}
                      style={{ position: 'absolute', top: '10px', right: '10px', background: '#fff0f0', border: '1px solid #fdd', cursor: 'pointer', color: '#e57373', fontSize: '12px', padding: '4px 7px', borderRadius: '6px', lineHeight: 1, transition: 'color 0.15s, background 0.15s, border-color 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#c0392b'; e.currentTarget.style.background = '#ffe0e0'; e.currentTarget.style.borderColor = '#f5a0a0'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#e57373'; e.currentTarget.style.background = '#fff0f0'; e.currentTarget.style.borderColor = '#fdd'; }}
                      title="Eliminar terminal">
                      <FontAwesomeIcon icon={faTrash} style={{ fontSize: '11px' }} />
                    </button>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', background: meta.bg, flexShrink: 0 }}>
                      {meta.emoji}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#111', marginBottom: '4px', paddingRight: '22px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pos.name}</div>
                    <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: '700', color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: '20px', marginBottom: '10px' }}>
                      {meta.name}
                    </span>
                    <div style={{ fontSize: '11px', color: '#aaa', fontFamily: 'monospace' }}>
                      {pos.provider === 'tuu' ? `Serial: ${pos.serial || '—'}` : pos.provider === 'mercadopago' ? `ID: ${pos.terminal_id ? pos.terminal_id.slice(0,12) + '…' : '—'}` : pos.terminal_id ? pos.terminal_id.slice(0,14) + '…' : '—'}
                    </div>
                    {pos.pos_pin && (
                      <div style={{ marginTop: '10px', background: '#f9f6ee', border: '1px solid #e8d99a', borderRadius: '8px', padding: '8px 10px' }}>
                        <div style={{ fontSize: '10px', color: '#9a8000', fontWeight: '700', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PIN de acceso</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: '800', color: '#5a4500', letterSpacing: '0.15em' }}>{pos.pos_pin}</span>
                          <button
                            onClick={() => { navigator.clipboard.writeText(pos.pos_pin); }}
                            title="Copiar PIN"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a8000', padding: '2px 4px', fontSize: '13px', lineHeight: 1 }}
                          >📋</button>
                        </div>
                        <div style={{ fontSize: '10px', color: '#aaa', marginTop: '3px' }}>Usa este PIN en la app Android para ver pedidos en efectivo</div>
                      </div>
                    )}
                    {pos.device_uid && (
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: pos.assigned ? '#22c55e' : '#fbbf24', flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', color: '#888' }}>{pos.assigned ? pos.assigned_name : 'Sin asignar'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── PAGOS CON QR ── */}
        <div style={{ marginBottom: '36px' }}>
          <p style={sectionTitle}>Pagos con QR</p>
          <p style={{ margin: '-8px 0 16px', fontSize: '12px', color: '#aaa' }}>El cliente escanea un QR en pantalla y paga desde su celular.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
            {/* MercadoPago QR */}
            <div style={{ ...card }}>
              <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f3f3f3' }}>
                <div style={{ width: '38px', height: '38px', background: '#e8f6fd', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>💳</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#111' }}>MercadoPago QR</span>
                    {mpQrConfigured
                      ? <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '20px', background: '#dcfce7', color: '#15803d' }}>● Activo</span>
                      : <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '20px', background: '#f3f4f6', color: '#9ca3af' }}>Sin configurar</span>
                    }
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {mpQrConfigured ? `Token: ${mpQrPreview}` : 'Access Token de MercadoPago Developers'}
                  </p>
                </div>
              </div>
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="password" value={mpQrToken} onChange={e => setMpQrToken(e.target.value)}
                    placeholder={mpQrConfigured ? 'Nuevo token…' : 'APP_USR-xxxx-xxxx-xxxx'}
                    style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: '12px' }}
                    onFocus={e => e.target.style.borderColor = '#D4AF37'} onBlur={e => e.target.style.borderColor = '#e2e2e2'}
                  />
                  <button onClick={saveMpQrConfig} disabled={mpQrSaving || !mpQrToken.trim()}
                    style={{ padding: '10px 16px', background: mpQrSaving || !mpQrToken.trim() ? '#f0f0f0' : '#111', color: mpQrSaving || !mpQrToken.trim() ? '#bbb' : '#fff', border: 'none', borderRadius: '9px', fontWeight: '700', fontSize: '12px', cursor: mpQrSaving || !mpQrToken.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                    {mpQrSaving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
                {mpQrMsg && <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: mpQrMsg.includes('Error') ? '#dc2626' : '#16a34a' }}>{mpQrMsg}</p>}
                <p style={{ margin: 0, fontSize: '11px', color: '#bbb' }}>Obtén el token en <strong style={{ color: '#888' }}>mercadopago.com/developers</strong> → Credenciales de producción</p>
              </div>
            </div>

            {/* Haulmer QR */}
            <div style={{ ...card }}>
              <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f3f3f3' }}>
                <div style={{ width: '38px', height: '38px', background: '#f0fdf4', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🌐</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#111' }}>Haulmer QR</span>
                    {haulmerLoaded
                      ? <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '20px', background: '#dcfce7', color: '#15803d' }}>● Activo</span>
                      : <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '20px', background: '#f3f4f6', color: '#9ca3af' }}>Sin configurar</span>
                    }
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#aaa' }}>Pasarela QR nativa — Chile (TUU / Haulmer)</p>
                </div>
              </div>
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={labelStyle}>Account ID *</label>
                    <input type="text" value={haulmerAccountId} onChange={e => setHaulmerAccountId(e.target.value)}
                      placeholder="Ej: 12345" style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px' }}
                      onFocus={e => e.target.style.borderColor = '#D4AF37'} onBlur={e => e.target.style.borderColor = '#e2e2e2'}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Nombre comercio</label>
                    <input type="text" value={haulmerCommerceName} onChange={e => setHaulmerCommerceName(e.target.value)}
                      placeholder="Mi Tienda" style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#D4AF37'} onBlur={e => e.target.style.borderColor = '#e2e2e2'}
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Secret Key *{haulmerLoaded && <span style={{ fontWeight: '400', color: '#ccc', textTransform: 'none', letterSpacing: 0 }}> — vacío = mantener</span>}</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="password" value={haulmerSecretKey} onChange={e => setHaulmerSecretKey(e.target.value)}
                      placeholder={haulmerLoaded ? '••••••••••' : 'Secret key de Haulmer'}
                      style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: '12px' }}
                      onFocus={e => e.target.style.borderColor = '#D4AF37'} onBlur={e => e.target.style.borderColor = '#e2e2e2'}
                    />
                    <button onClick={saveHaulmerConfig} disabled={haulmerSaving}
                      style={{ padding: '10px 16px', background: haulmerSaving ? '#f0f0f0' : '#111', color: haulmerSaving ? '#bbb' : '#fff', border: 'none', borderRadius: '9px', fontWeight: '700', fontSize: '12px', cursor: haulmerSaving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                      {haulmerSaving ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                </div>
                {haulmerMsg && <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: haulmerMsg.includes('Error') || haulmerMsg.includes('requerido') ? '#dc2626' : '#16a34a' }}>{haulmerMsg}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* ── QR DE LA TIENDA ── */}
        {selectedStore && (
          <div style={{ marginBottom: '36px' }}>
            <p style={sectionTitle}>QR de la tienda</p>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '32px', padding: '24px 28px', flexWrap: 'wrap' }}>
              <div ref={qrRef} style={{ padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e5e5', flexShrink: 0 }}>
                <QRCodeCanvas
                  key={selectedStore.id}
                  value={`${API}/store/${selectedStore.code}?delivery=true`}
                  size={140}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="H"
                  includeMargin={false}
                />
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: '#111' }}>{selectedStore.name}</span>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#D4AF37', background: 'rgba(212,175,55,0.12)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(212,175,55,0.3)' }}>
                    {selectedStore.code}
                  </span>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#888' }}>Comparte este QR para que tus clientes accedan al menú digital de tu tienda.</p>
                <p style={{ margin: '0 0 16px', fontSize: '11px', fontFamily: 'monospace', color: '#666', background: '#f8f8f8', padding: '8px 11px', borderRadius: '7px', border: '1px solid #ebebeb', wordBreak: 'break-all' }}>
                  {API}/store/{selectedStore.code}?delivery=true
                </p>
                <button onClick={downloadQR}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#000', color: '#D4AF37', border: 'none', borderRadius: '9px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                  <FontAwesomeIcon icon={faDownload} /> Descargar QR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL AGREGAR POS ── */}
        {showPosModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
            onClick={() => setShowPosModal(false)}>
            <div style={{ background: '#fff', borderRadius: '18px', width: '100%', maxWidth: '460px', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}
              onClick={e => e.stopPropagation()}>
              {/* Modal header */}
              <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#111' }}>Agregar Terminal POS</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#aaa' }}>Selecciona tu proveedor y configura la terminal</p>
                </div>
                <button onClick={() => setShowPosModal(false)} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', width: '30px', height: '30px', borderRadius: '50%', fontSize: '16px', color: '#777', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>

              {/* Provider selector */}
              <div style={{ padding: '16px 22px', borderBottom: '1px solid #f0f0f0' }}>
                <p style={{ ...sectionTitle, margin: '0 0 10px' }}>Proveedor</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {[
                    { label: 'Mercado Pago', emoji: '💳', color: '#009EE3', bg: '#e8f6fd' },
                    { label: 'Tuu POS',      emoji: '📱', color: '#7c3aed', bg: '#f5f0ff' },
                    { label: 'Square',       emoji: '📟', color: '#3b82f6', bg: '#eff6ff' },
                    { label: 'Sumup',        emoji: '💰', color: '#f59e0b', bg: '#fef3c7' },
                  ].map((p, i) => (
                    <button key={i} onClick={() => { setPosTab(i); setMpModalStep('token'); setMpModalDetected([]); setMpModalError(''); }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', padding: '10px 4px', background: posTab === i ? p.bg : '#fafafa', border: posTab === i ? `2px solid ${p.color}` : '2px solid transparent', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', outline: 'none' }}>
                      <span style={{ fontSize: '20px' }}>{p.emoji}</span>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: posTab === i ? p.color : '#888', textAlign: 'center', lineHeight: '1.2' }}>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form area */}
              <div style={{ padding: '20px 22px' }}>
                {posTab === 0 && (
                  <div>
                    {mpModalStep === 'token' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ padding: '12px 14px', background: '#e8f6fd', borderRadius: '10px', fontSize: '12px', color: '#0369a1' }}>
                          💡 Necesitas el <strong>Access Token de producción</strong> de tu app en MercadoPago Developers
                        </div>
                        <a href="https://www.youtube.com/watch?v=KC9NjZ2OMP0" target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#e8f6fd', border: '1px solid #bae6fd', borderRadius: '10px', textDecoration: 'none', color: '#0369a1', fontSize: '12px', fontWeight: '600' }}>
                          ▶ Ver tutorial: Cómo vincular Mercado Pago Point
                        </a>
                        <div>
                          <label style={labelStyle}>Access Token *</label>
                          <input value={mpNewToken} onChange={e => setMpNewToken(e.target.value)}
                            placeholder="APP_USR-xxxxxxxx-xxxx-xxxx"
                            style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px' }}
                            onFocus={e => e.target.style.borderColor = '#009EE3'} onBlur={e => e.target.style.borderColor = '#e2e2e2'}
                          />
                          <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#aaa' }}>
                            En <a href="https://www.mercadopago.com/developers/panel/app" target="_blank" rel="noreferrer" style={{ color: '#009EE3', textDecoration: 'none', fontWeight: '600' }}>mercadopago.com/developers</a> → Tu app → Credenciales de producción
                          </p>
                        </div>
                        <button onClick={async () => {
                          if (!mpNewToken.trim()) { setMpModalError('Ingresa el Access Token'); return; }
                          setMpModalDetecting(true); setMpModalError(''); setMpModalDetected([]);
                          try {
                            const res = await fetch(API + '/api/mercado-pago-detect-devices', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ access_token: mpNewToken.trim() }) });
                            const data = await res.json();
                            if (!res.ok) { setMpModalError(data.error || 'Error al consultar'); setMpModalDetecting(false); return; }
                            if (data.length === 0) { setMpModalError('No se encontraron dispositivos Point. Vincula tu Point en la app de Mercado Pago → Tu negocio → Sucursales y cajas'); setMpModalDetecting(false); return; }
                            setMpModalDetected(data); setMpModalStep('select');
                          } catch { setMpModalError('Error de conexión'); }
                          setMpModalDetecting(false);
                        }} disabled={mpModalDetecting || !mpNewToken.trim()}
                          style={{ width: '100%', padding: '11px', background: mpModalDetecting || !mpNewToken.trim() ? '#f0f0f0' : '#009EE3', color: mpModalDetecting || !mpNewToken.trim() ? '#bbb' : '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: mpModalDetecting || !mpNewToken.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          {mpModalDetecting ? <><FontAwesomeIcon icon={faSpinner} spin /> Buscando dispositivos…</> : <><FontAwesomeIcon icon={faSearch} /> Buscar dispositivos Point</>}
                        </button>
                        {mpModalError && <p style={{ margin: 0, fontSize: '12px', color: '#dc3545', background: '#fff5f5', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca' }}>{mpModalError}</p>}
                      </div>
                    )}
                    {mpModalStep === 'select' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#111' }}>{mpModalDetected.length} dispositivo{mpModalDetected.length !== 1 ? 's' : ''} encontrado{mpModalDetected.length !== 1 ? 's' : ''}</p>
                          <button onClick={() => { setMpModalStep('token'); setMpModalDetected([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#009EE3', fontWeight: '600' }}>← Cambiar token</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                          {mpModalDetected.map(d => (
                            <div key={d.id}
                              style={{ padding: '12px 14px', background: '#fafafa', border: '1.5px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = '#009EE3'; e.currentTarget.style.background = '#e8f6fd'; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fafafa'; }}
                              onClick={async () => {
                                setSavingMp(true);
                                const name = d.external_pos_id ? d.external_pos_id.split('__')[0] : ('Point ' + d.id.slice(0,8));
                                const res = await fetch(API + '/api/mercado-pago-terminals', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ name, mercadopago_access_token: mpNewToken.trim(), mercadopago_terminal_id: d.id, store_id: selectedStore.id }) });
                                if (res.ok) {
                                  const created = await res.json();
                                  setShowPosModal(false); setMpBannerMode(null); setMpWorkingBanner(true); setMpNewToken(''); setMpModalStep('token'); setMpModalDetected([]);
                                  try { await fetch(API + `/api/mercado-pago-terminals/${created.id}/mode`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ device_id: d.id, operating_mode: 'PDV' }) }); } catch {}
                                  try {
                                    const statusRes = await fetch(API + `/api/mercado-pago-terminals/${created.id}/status`, { headers: { Authorization: 'Bearer ' + token } });
                                    if (statusRes.ok) { const statusData = await statusRes.json(); setMpBannerMode(statusData.operating_mode || 'UNDEFINED'); } else { setMpBannerMode('PDV'); }
                                  } catch { setMpBannerMode('PDV'); }
                                  refreshAll(); setTimeout(() => setMpWorkingBanner(false), 5000);
                                } else { const err = await res.json(); setMpModalError(err.error || 'Error al guardar'); }
                                setSavingMp(false);
                              }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#111' }}>{d.external_pos_id ? d.external_pos_id.split('__')[0] : 'Point'}</div>
                                  <div style={{ fontSize: '10px', color: '#aaa', fontFamily: 'monospace', marginTop: '2px' }}>{d.id}</div>
                                </div>
                                <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', background: d.operating_mode === 'PDV' ? '#dcfce7' : '#dbeafe', color: d.operating_mode === 'PDV' ? '#15803d' : '#1d4ed8' }}>{d.operating_mode}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {savingMp && <p style={{ margin: 0, textAlign: 'center', fontSize: '12px', color: '#666' }}><FontAwesomeIcon icon={faSpinner} spin /> Guardando…</p>}
                        {mpModalError && <p style={{ margin: 0, fontSize: '12px', color: '#dc3545', background: '#fff5f5', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca' }}>{mpModalError}</p>}
                      </div>
                    )}
                    {mpSaveMsg && <p style={{ marginTop: '10px', fontSize: '12px', color: mpSaveMsg.includes('Error') ? '#dc3545' : '#155724' }}>{mpSaveMsg}</p>}
                  </div>
                )}

                {posTab === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ padding: '11px 14px', background: '#f5f0ff', borderRadius: '10px', fontSize: '12px', color: '#7c3aed' }}>
                      💡 Necesitas las credenciales de tu cuenta en{' '}
                      <a href="https://espacio.haulmer.com" target="_blank" rel="noreferrer" style={{ color: '#7c3aed', fontWeight: '700' }}>espacio.haulmer.com</a>
                    </div>
                    <a href="https://www.youtube.com/watch?v=mO2LgD1uoBs" target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#fff0ff', border: '1px solid #e9d5ff', borderRadius: '10px', textDecoration: 'none', color: '#7c3aed', fontSize: '12px', fontWeight: '600' }}>
                      ▶ Ver tutorial: Cómo vincular Tuu POS
                    </a>
                    <div>
                      <label style={labelStyle}>API Key de Tuu *</label>
                      <input value={tuuNewApiKey} onChange={e => setTuuNewApiKey(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX"
                        style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px' }}
                        onFocus={e => e.target.style.borderColor = '#7c3aed'} onBlur={e => e.target.style.borderColor = '#e2e2e2'}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Nombre del POS</label>
                      <input value={tuuNewName} onChange={e => setTuuNewName(e.target.value)} placeholder="Ej: Mostrador principal" style={inputStyle}
                        onFocus={e => e.target.style.borderColor = '#7c3aed'} onBlur={e => e.target.style.borderColor = '#e2e2e2'}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Serial del POS</label>
                      <input value={tuuNewSerial} onChange={e => setTuuNewSerial(e.target.value)} placeholder="XXXXXXXXXX"
                        style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px' }}
                        onFocus={e => e.target.style.borderColor = '#7c3aed'} onBlur={e => e.target.style.borderColor = '#e2e2e2'}
                      />
                    </div>
                    <input type="hidden" value={tuuNewDeviceId} />
                    <input type="hidden" value={tuuNewDteType} />
                    <button onClick={saveTuuPos} disabled={savingTuu}
                      style={{ width: '100%', padding: '11px', background: savingTuu ? '#f0f0f0' : '#7c3aed', color: savingTuu ? '#bbb' : '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: savingTuu ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      {savingTuu ? <><FontAwesomeIcon icon={faSpinner} spin /> Guardando…</> : 'Guardar Tuu POS'}
                    </button>
                    {tuuSaveMsg2 && <p style={{ margin: 0, fontSize: '12px', color: tuuSaveMsg2.includes('Error') ? '#dc3545' : '#155724' }}>{tuuSaveMsg2}</p>}
                  </div>
                )}

                {posTab === 2 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    {/* Instrucciones */}
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '11px 13px', fontSize: '12px', color: '#1e40af', lineHeight: '1.6' }}>
                      <strong>¿Cómo configurar?</strong><br />
                      1. Ve a <a href="https://developer.squareup.com/console/en/apps" target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', fontWeight: '700' }}>developer.squareup.com/console/en/apps</a> → tu app → <strong>Credentials</strong> y copia el <strong>Access Token</strong>.<br />
                      2. En la misma app ve a <strong>Locations</strong> o usa el botón "Buscar ubicaciones" para obtener el <strong>Location ID</strong>.<br />
                      3. Llena los campos y presiona <strong>Guardar y generar código</strong> — el terminal recibirá la solicitud automáticamente.
                    </div>

                    {/* Formulario de configuración + generación de código */}
                    {squareStep !== 'paired' && (
                      <div style={{ border: '1.5px solid #3b82f6', borderRadius: '11px', overflow: 'hidden' }}>
                        <div style={{ padding: '11px 14px', background: '#eff6ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#1d4ed8' }}>
                            {squareCode ? '② Ingresa el código en el terminal' : '① Credenciales y terminal'}
                          </span>
                          {squareCfgSaved && !squareCode && <span style={{ fontSize: '10px', color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: '20px', fontWeight: '700' }}>✔ Configurado</span>}
                        </div>
                        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #e5e7eb' }}>

                          {/* Campos de config — solo visibles si aún no se generó el código */}
                          {!squareCode && (
                            <>
                              <div>
                                <label style={labelStyle}>Access Token</label>
                                <input value={squareAccessToken} onChange={e => setSquareAccessToken(e.target.value)}
                                  placeholder="EAAl..."
                                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px' }}
                                  onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e2e2e2'}
                                />
                                <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#aaa' }}>
                                  Obtenlo en <a href="https://developer.squareup.com/console/en/apps" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', fontWeight: '600', textDecoration: 'none' }}>developer.squareup.com/console/en/apps</a> → tu app → Credentials
                                </p>
                              </div>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                  <label style={{ ...labelStyle, margin: 0 }}>Location ID</label>
                                  <button onClick={squareFetchLocations} disabled={squareLoadingLocs || !squareAccessToken.trim()}
                                    style={{ fontSize: '11px', color: '#3b82f6', background: 'none', border: 'none', cursor: squareLoadingLocs || !squareAccessToken.trim() ? 'not-allowed' : 'pointer', padding: 0, fontWeight: '600', opacity: !squareAccessToken.trim() ? 0.4 : 1 }}>
                                    {squareLoadingLocs ? '⏳ Cargando…' : '🔍 Buscar ubicaciones'}
                                  </button>
                                </div>
                                {squareLocations.length > 0 ? (
                                  <select value={squareLocationId} onChange={e => setSquareLocationId(e.target.value)} style={{ ...inputStyle }}>
                                    <option value="">— Selecciona una ubicación —</option>
                                    {squareLocations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.id})</option>)}
                                  </select>
                                ) : (
                                  <input value={squareLocationId} onChange={e => setSquareLocationId(e.target.value)}
                                    placeholder="Ej: LAR6T2M15K5BQ"
                                    style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px' }}
                                    onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e2e2e2'}
                                  />
                                )}
                              </div>
                              <div>
                                <label style={labelStyle}>Nombre del terminal</label>
                                <input value={squareDeviceName} onChange={e => setSquareDeviceName(e.target.value)}
                                  placeholder="Ej: Caja Principal"
                                  style={inputStyle}
                                  onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e2e2e2'}
                                />
                              </div>
                              <button
                                onClick={squareGenerateCode}
                                disabled={squareGenerating || squarePolling || !squareAccessToken.trim() || !squareLocationId.trim()}
                                style={{
                                  width: '100%', padding: '11px',
                                  background: squareGenerating || squarePolling || !squareAccessToken.trim() || !squareLocationId.trim() ? '#f0f0f0' : '#3b82f6',
                                  color: squareGenerating || squarePolling || !squareAccessToken.trim() || !squareLocationId.trim() ? '#bbb' : '#fff',
                                  border: 'none', borderRadius: '9px', fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                                }}>
                                {squareGenerating ? <><FontAwesomeIcon icon={faSpinner} spin /> Guardando y generando…</> : '🔲 Guardar y generar código de inicio de sesión'}
                              </button>
                            </>
                          )}

                          {/* Código generado */}
                          {squareCode && (
                            <div style={{ background: '#fffbeb', border: '1.5px solid #D4AF37', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                              <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#92400e', fontWeight: '600' }}>Ingresa este código en el terminal Square:</p>
                              <div style={{ fontSize: '36px', fontWeight: '900', letterSpacing: '8px', color: '#000', fontFamily: 'monospace', margin: '8px 0' }}>{squareCode}</div>
                              <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#888' }}>En el terminal: <strong>Iniciar sesión → Usar código de dispositivo</strong></p>
                              {squareCodeExpiry && <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#aaa' }}>Expira: {new Date(squareCodeExpiry).toLocaleTimeString('es-CL')}</p>}
                            </div>
                          )}

                          {/* Estado del polling */}
                          {squarePolling && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#eff6ff', borderRadius: '8px', fontSize: '12px', color: '#1d4ed8' }}>
                              <FontAwesomeIcon icon={faSpinner} spin /> {squarePollMsg || 'Esperando que ingreses el código en el terminal…'}
                            </div>
                          )}

                          {/* Botón para generar nuevo código si el actual expiró */}
                          {squareCode && !squarePolling && squareStep !== 'paired' && (
                            <button onClick={() => { setSquareCode(''); setSquareCodeId(''); setSquarePollMsg(''); setSquareStep('config'); }}
                              style={{ fontSize: '12px', color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '7px 12px', cursor: 'pointer', fontWeight: '600' }}>
                              ↩ Volver a configurar / generar nuevo código
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Éxito de emparejamiento */}
                    {squareStep === 'paired' && (
                      <div style={{ padding: '14px 16px', background: '#dcfce7', border: '1.5px solid #86efac', borderRadius: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '22px', marginBottom: '6px' }}>✅</div>
                        <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#15803d', fontWeight: '700' }}>Terminal vinculado exitosamente</p>
                        <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#166534' }}>{squarePollMsg}</p>
                        <button onClick={() => { setSquareStep('config'); setSquareCode(''); setSquareCodeId(''); setSquarePollMsg(''); setSquareDeviceName(''); }}
                          style={{ fontSize: '12px', color: '#1d4ed8', background: '#fff', border: '1px solid #bfdbfe', borderRadius: '7px', padding: '6px 14px', cursor: 'pointer', fontWeight: '600' }}>
                          + Vincular otro terminal
                        </button>
                      </div>
                    )}

                    {/* Lista de terminales vinculados */}
                    {squareDevices.length > 0 && (
                      <div>
                        <p style={{ ...sectionTitle, margin: '4px 0 8px' }}>Terminales vinculados</p>
                        {squareDevices.map(d => (
                          <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: '#fafafa', border: '1px solid #ebebeb', borderRadius: '8px', marginBottom: '6px' }}>
                            <div>
                              <span style={{ fontSize: '13px', fontWeight: '700', color: '#111' }}>{d.name}</span>
                              <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '8px', fontFamily: 'monospace' }}>{d.device_id?.slice(0, 16)}…</span>
                            </div>
                            <button
                              onClick={async () => { if (!confirm('¿Desvincular ' + d.name + '?')) return; await fetch(API + '/api/square/devices/' + d.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }); refreshAll(); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', padding: '3px 6px', borderRadius: '5px', transition: 'color 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#ddd'}>
                              <FontAwesomeIcon icon={faTrash} style={{ fontSize: '12px' }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {squareError && <p style={{ margin: 0, fontSize: '12px', color: '#dc3545', background: '#fff5f5', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca' }}>⚠ {squareError}</p>}
                  </div>
                )}

                {posTab === 3 && (
                  <div style={{ textAlign: 'center', padding: '28px 0' }}>
                    <div style={{ width: '56px', height: '56px', background: '#fef3c7', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', margin: '0 auto 14px' }}>💰</div>
                    <p style={{ color: '#333', fontSize: '14px', fontWeight: '700', margin: '0 0 6px' }}>Sumup — Próximamente</p>
                    <p style={{ color: '#bbb', fontSize: '12px', margin: 0 }}>Estamos trabajando en la integración con Sumup</p>
                  </div>
                )}
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

      {/* Banner: configurando PDV en MercadoPago */}
      {mpWorkingBanner && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#000', borderRadius: '20px', padding: '36px 48px',
            textAlign: 'center', maxWidth: '360px', width: '90%',
            border: '2px solid #D4AF37', boxShadow: '0 24px 80px rgba(0,0,0,0.5)'
          }}>
            {mpBannerMode === null ? (
              /* Estado: cargando */
              <>
                <div style={{ fontSize: '44px', marginBottom: '16px' }}>⚙️</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#D4AF37', marginBottom: '8px' }}>
                  Estamos trabajando
                </div>
                <div style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.5' }}>
                  Configurando tu terminal en modo PDV.<br />
                  Esto tomará solo un momento...
                </div>
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '6px' }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: '8px', height: '8px', borderRadius: '50%', background: '#D4AF37',
                      animation: `bounce 0.8s ease-in-out ${i * 0.15}s infinite alternate`
                    }} />
                  ))}
                </div>
              </>
            ) : (
              /* Estado: resultado */
              <>
                <div style={{ fontSize: '48px', marginBottom: '14px' }}>
                  {mpBannerMode === 'PDV' ? '✅' : mpBannerMode === 'STANDALONE' ? '📟' : '⚠️'}
                </div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#D4AF37', marginBottom: '10px' }}>
                  Terminal configurado
                </div>
                <div style={{
                  display: 'inline-block',
                  padding: '6px 18px',
                  borderRadius: '30px',
                  fontSize: '15px',
                  fontWeight: '800',
                  letterSpacing: '1px',
                  background: mpBannerMode === 'PDV' ? '#16a34a22' : mpBannerMode === 'STANDALONE' ? '#d9770622' : '#71717a22',
                  color: mpBannerMode === 'PDV' ? '#4ade80' : mpBannerMode === 'STANDALONE' ? '#fb923c' : '#a1a1aa',
                  border: `1.5px solid ${mpBannerMode === 'PDV' ? '#4ade80' : mpBannerMode === 'STANDALONE' ? '#fb923c' : '#71717a'}`,
                  marginBottom: '10px'
                }}>
                  {mpBannerMode}
                </div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '6px' }}>
                  {mpBannerMode === 'PDV'
                    ? 'Tu Point está listo para recibir pagos desde SRServi.'
                    : mpBannerMode === 'STANDALONE'
                    ? 'El terminal está en modo autónomo. Puedes cambiarlo desde la configuración.'
                    : 'No se pudo determinar el estado. Verifica en la app de Mercado Pago.'}
                </div>
              </>
            )}
          </div>
          <style>{`@keyframes bounce { from { transform: translateY(0); opacity:0.4; } to { transform: translateY(-8px); opacity:1; } }`}</style>
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
