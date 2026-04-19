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
  const buildPosList = (mpTerminals, tuuDevices, tuuAssignments, tuuStoreDevs, squareDevsList = []) => {
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
    const squareList = (Array.isArray(squareDevsList) ? squareDevsList : []).map(d => ({
      id: d.id,
      provider: 'square',
      name: d.name,
      terminal_id: d.device_id,
      store_id: d.store_id,
    }));
    return [...mpList, ...tuuList, ...squareList];
  };

  const saveMpPos = async () => {
    if (!mpNewName.trim() || !mpNewToken.trim() || !mpNewTerminalId.trim()) { setMpSaveMsg('Completa todos los campos'); return; }
    setSavingMp(true); setMpSaveMsg('');
    try {
      const res = await fetch(API + '/api/mercado-pago-terminals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name: mpNewName.trim(), mercadopago_access_token: mpNewToken.trim(), mercadopago_terminal_id: mpNewTerminalId.trim(), store_id: selectedStore.id })
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
      const res = await fetch(API + '/api/tuu/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStore.id, name: tuuNewName.trim(), serial: tuuNewSerial.trim(), device_id: tuuNewDeviceId.trim(), api_key: tuuNewApiKey.trim(), dte_type: tuuNewDteType })
      });
      const data = await res.json();
      if (res.ok || data.success) {
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
    if (pos.provider === 'mercadopago') {
      await fetch(API + '/api/mercado-pago-terminals/' + pos.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    } else if (pos.provider === 'tuu') {
      await fetch(API + '/api/tuu/devices/' + pos.id, { method: 'DELETE' });
    } else if (pos.provider === 'square') {
      await fetch(API + '/api/square/devices/' + pos.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    }
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

  // Reconstruir la lista unificada cada vez que cambien los datos de algún proveedor
  useEffect(() => {
    setPosList(buildPosList(terminals, tuuPosDevices, tuuAssignments, tuuStoreDevices, squareDevices));
  }, [terminals, tuuPosDevices, tuuAssignments, tuuStoreDevices, squareDevices]);

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
      const res = await fetch(API + '/api/square/config', { headers: { Authorization: 'Bearer ' + token } });
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
    if (!token) return;
    try {
      const res = await fetch(API + '/api/haulmer/config', { headers: { Authorization: 'Bearer ' + token } });
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
          commerce_name: haulmerCommerceName.trim() || 'Mi Tienda'
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
    setSquareSavingCfg(true); setSquareError('');
    try {
      const res = await fetch(API + '/api/square/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ access_token: squareAccessToken.trim(), location_id: squareLocationId.trim() })
      });
      if (res.ok) { setSquareCfgSaved(true); setSquareStep('code'); setSquareError(''); }
      else { const d = await res.json(); setSquareError(d.error || 'Error al guardar'); }
    } catch { setSquareError('Error de conexión'); }
    setSquareSavingCfg(false);
  };

  const squareFetchLocations = async () => {
    setSquareLoadingLocs(true); setSquareError('');
    if (!squareCfgSaved) { await squareSaveConfig(); }
    try {
      const res = await fetch(API + '/api/square/locations', { headers: { Authorization: 'Bearer ' + token } });
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
        body: JSON.stringify({ access_token: squareAccessToken.trim() || undefined, location_id: squareLocationId.trim() })
      });
      if (!cfgRes.ok && squareAccessToken.trim()) { const d = await cfgRes.json(); setSquareError(d.error || 'Error al guardar config'); setSquareGenerating(false); return; }
      const res = await fetch(API + '/api/square/device-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ location_id: squareLocationId.trim(), device_name: squareDeviceName.trim() || 'Square Terminal' })
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
        const res = await fetch(API + '/api/square/device-code/' + encodeURIComponent(codeId), { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        setSquareCodeStatus(data.status || '');
        if (data.status === 'PAIRED' && data.device_id) {
          clearInterval(intervalId); setSquarePolling(false);
          setSquarePollMsg('✔ Terminal emparejado. Device ID: ' + data.device_id);
          setSquareStep('paired');
          // Auto-save device
          await fetch(API + '/api/square/devices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ store_id: selectedStore.id, name: squareDeviceName.trim() || 'Square Terminal', device_id: data.device_id, device_code_id: codeId, location_id: squareLocationId })
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

  // Re-fetch everything from server and rebuild the unified list.
  // Declared as function (not const) so it hoists and can be called anywhere in the component.
  if (loading) return <div className="loading">Cargando...</div>;

  const showMPSection = mpInCountry || terminals.length > 0;

  return (
    <>
      <header className="admin-header">
        <h1><FontAwesomeIcon icon={faCashRegister} style={{ marginRight: '10px' }} />Vincular POS</h1>
      </header>

      <div className="admin-main">
        {installMessage && (
          <div style={{
            padding: '10px 14px', marginBottom: '14px', borderRadius: '10px', fontWeight: '600', fontSize: '13px',
            backgroundColor: installMessage.includes('Error') ? '#fef2f2' : '#f0fdf4',
            color: installMessage.includes('Error') ? '#dc2626' : '#16a34a',
            border: `1px solid ${installMessage.includes('Error') ? '#fecaca' : '#bbf7d0'}`
          }}>{installMessage}</div>
        )}

        {/* ==== HEADER TERMINALES ==== */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', color: '#111', margin: '0 0 4px', fontWeight: '800' }}>Terminales POS</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#888' }}>
              <span style={{ fontSize: '15px' }}>{activeCountry.flag}</span>
              <span>{activeCountry.name}</span>
              <button onClick={() => setShowCountryModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GOLD, fontWeight: '700', fontSize: '11px', padding: '0 2px' }}>
                Cambiar
              </button>
            </div>
          </div>
          <button onClick={() => { setShowPosModal(true); setPosTab(0); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}>
            <FontAwesomeIcon icon={faPlus} /> Agregar Terminal
          </button>
        </div>

        {/* ==== LISTA UNIFICADA DE POS ==== */}
        {posList.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', border: '2px dashed #e5e7eb', borderRadius: '16px', background: '#fafafa' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>💳</div>
            <p style={{ color: '#6b7280', margin: '0 0 6px', fontSize: '15px', fontWeight: '700' }}>Sin terminales POS configurados</p>
            <p style={{ color: '#bbb', margin: 0, fontSize: '12px' }}>Presiona "Agregar Terminal" para vincular tu primera terminal</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '14px' }}>
            {posList.map(pos => {
              const providerColor = pos.provider === 'mercadopago' ? '#009EE3' : pos.provider === 'tuu' ? '#9c27b0' : pos.provider === 'square' ? '#3b82f6' : '#f59e0b';
              const providerEmoji = pos.provider === 'mercadopago' ? '💳' : pos.provider === 'tuu' ? '📱' : pos.provider === 'square' ? '📟' : '💰';
              const providerName = pos.provider === 'mercadopago' ? 'Mercado Pago Point' : pos.provider === 'tuu' ? 'Tuu POS' : pos.provider === 'square' ? 'Square Terminal' : 'Sumup';
              return (
                <div key={pos.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '18px', position: 'relative', transition: 'box-shadow 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'}
                >
                  <button onClick={() => deletePos(pos)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: '16px', padding: '4px', lineHeight: 1 }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}
                    title="Eliminar">✕</button>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', background: providerColor + '15' }}>
                    {providerEmoji}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#111', marginBottom: '3px', paddingRight: '20px' }}>{pos.name}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '700', color: providerColor, background: providerColor + '12', padding: '3px 8px', borderRadius: '20px', marginBottom: '10px' }}>
                    {providerName}
                  </div>
                  {pos.provider === 'tuu' ? (
                    <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>Serial: {pos.serial || '—'}</div>
                  ) : pos.provider === 'mercadopago' ? (
                    <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>ID: {pos.terminal_id ? pos.terminal_id.slice(0,14) + '…' : '—'}</div>
                  ) : null}
                  {pos.device_uid && (
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: pos.assigned ? '#22c55e' : '#fbbf24', flexShrink: 0 }}></div>
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>{pos.assigned ? pos.assigned_name : 'Sin asignar'}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ==== PAGOS CON QR ==== */}
        <div style={{ marginTop: '32px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', color: '#111', margin: '0 0 4px', fontWeight: '800' }}>Pagos con QR</h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>El cliente escanea un QR en la pantalla y paga desde su celular.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* MercadoPago QR */}
          <div style={{ background: '#fff', border: '1.5px solid ' + (mpQrConfigured ? '#111' : '#e5e7eb'), borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', background: '#f5f5f5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>💳</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '800', color: '#111' }}>MercadoPago QR</span>
                  {mpQrConfigured
                    ? <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: '#111', color: '#fff' }}>ACTIVO</span>
                    : <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: '#f3f4f6', color: '#6b7280' }}>SIN CONFIGURAR</span>
                  }
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
                  {mpQrConfigured ? `Token: ${mpQrPreview}` : 'Necesitas tu Access Token de MercadoPago'}
                </p>
              </div>
            </div>
            <div style={{ padding: '0 20px 18px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="password"
                  value={mpQrToken}
                  onChange={e => setMpQrToken(e.target.value)}
                  placeholder={mpQrConfigured ? 'Nuevo token (dejar vacío para mantener)' : 'APP_USR-xxxx-xxxx-xxxx'}
                  style={{ flex: 1, padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', fontFamily: 'monospace', outline: 'none' }}
                />
                <button
                  onClick={saveMpQrConfig}
                  disabled={mpQrSaving || !mpQrToken.trim()}
                  style={{ padding: '9px 18px', background: mpQrSaving || !mpQrToken.trim() ? '#e5e7eb' : '#111', color: mpQrSaving || !mpQrToken.trim() ? '#9ca3af' : '#fff', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: mpQrSaving || !mpQrToken.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                >
                  {mpQrSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
              {mpQrMsg && (
                <p style={{ margin: '8px 0 0', fontSize: '12px', fontWeight: '700', color: mpQrMsg.includes('Error') ? '#dc2626' : '#16a34a' }}>{mpQrMsg}</p>
              )}
              <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#bbb' }}>
                Obtén el token en <strong style={{ color: '#888' }}>mercadopago.com/developers</strong> → Tu app → Credenciales de producción
              </p>
            </div>
          </div>

          {/* Haulmer QR */}
          <div style={{ background: '#fff', border: '1.5px solid ' + (haulmerLoaded ? '#111' : '#e5e7eb'), borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', background: '#f5f5f5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>🌐</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '800', color: '#111' }}>Haulmer QR</span>
                  {haulmerLoaded
                    ? <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: '#111', color: '#fff' }}>ACTIVO</span>
                    : <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: '#f3f4f6', color: '#6b7280' }}>SIN CONFIGURAR</span>
                  }
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>Pasarela QR nativa — Chile (TUU / Haulmer)</p>
              </div>
            </div>
            <div style={{ padding: '0 20px 18px', display: 'grid', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#555', display: 'block', marginBottom: '4px' }}>Account ID *</label>
                  <input
                    type="text"
                    value={haulmerAccountId}
                    onChange={e => setHaulmerAccountId(e.target.value)}
                    placeholder="Ej: 12345"
                    style={{ width: '100%', padding: '9px 11px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '12px', boxSizing: 'border-box', fontFamily: 'monospace', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#555', display: 'block', marginBottom: '4px' }}>Nombre del comercio</label>
                  <input
                    type="text"
                    value={haulmerCommerceName}
                    onChange={e => setHaulmerCommerceName(e.target.value)}
                    placeholder="Mi Tienda"
                    style={{ width: '100%', padding: '9px 11px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#555', display: 'block', marginBottom: '4px' }}>
                  Secret Key *{haulmerLoaded && <span style={{ fontWeight: '400', color: '#bbb' }}> — dejar vacío para mantener el actual</span>}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="password"
                    value={haulmerSecretKey}
                    onChange={e => setHaulmerSecretKey(e.target.value)}
                    placeholder={haulmerLoaded ? '••••••••••••••••' : 'Tu secret key de Haulmer'}
                    style={{ flex: 1, padding: '9px 11px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace', outline: 'none' }}
                  />
                  <button
                    onClick={saveHaulmerConfig}
                    disabled={haulmerSaving}
                    style={{ padding: '9px 18px', background: haulmerSaving ? '#e5e7eb' : '#111', color: haulmerSaving ? '#9ca3af' : '#fff', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: haulmerSaving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {haulmerSaving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
              {haulmerMsg && (
                <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: haulmerMsg.includes('Error') || haulmerMsg.includes('requerido') ? '#dc2626' : '#16a34a' }}>{haulmerMsg}</p>
              )}
            </div>
          </div>
        </div>

        {/* ==== QR DE LA TIENDA ==== */}
        {selectedStore && (
          <div style={{ marginTop: '28px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', background: '#000', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" style={{ width: '22px', height: '22px', fill: '#D4AF37' }}>
                  <path d="M3 3h7v7H3V3zm1 1v5h5V4H4zm1 1h3v3H5V5zm8-2h7v7h-7V3zm1 1v5h5V4h-5zm1 1h3v3h-3V5zM3 13h7v7H3v-7zm1 1v5h5v-5H4zm1 1h3v3H5v-3zm8 0h2v2h-2v-2zm2 2h2v2h-2v-2zm2-2h2v2h-2v-2zm-4 4h2v2h-2v-2zm2 0h2v2h-2v-2zm2-2h2v4h-2v-4zm-4-4h4v2h-4v-2z"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#111' }}>QR de la tienda</h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Comparte el QR para que tus clientes accedan al menú digital</p>
              </div>
              <div style={{ padding: '6px 12px', background: GOLD + '18', border: `1.5px solid ${GOLD}`, borderRadius: '8px', fontSize: '13px', fontWeight: '800', color: '#111' }}>
                {selectedStore.name}
              </div>
            </div>
            <div style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <div ref={qrRef} style={{ padding: '20px', background: '#fff', borderRadius: '16px', border: '2px solid #e5e7eb', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <QRCodeCanvas
                  key={selectedStore.id}
                  value={`${API}/store/${selectedStore.code}?delivery=true`}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="H"
                  includeMargin={false}
                />
              </div>
              <div style={{ textAlign: 'center', maxWidth: '340px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Tienda: <span style={{ color: '#111' }}>{selectedStore.name}</span>
                </p>
                <p style={{ margin: 0, fontSize: '12px', fontFamily: 'monospace', color: '#444', wordBreak: 'break-all', padding: '8px 12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  {API}/store/{selectedStore.code}?delivery=true
                </p>
              </div>
              <button
                onClick={downloadQR}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 28px', background: '#000', color: '#D4AF37', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', letterSpacing: '0.3px' }}
              >
                <FontAwesomeIcon icon={faDownload} />
                Descargar QR
              </button>
            </div>
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
                  <button key={tab} onClick={() => { setPosTab(i); setMpModalStep('token'); setMpModalDetected([]); setMpModalError(''); }} style={{ padding: '10px 14px', background: 'none', border: 'none', borderBottom: posTab === i ? '3px solid #D4AF37' : '3px solid transparent', cursor: 'pointer', fontSize: '13px', fontWeight: posTab === i ? '800' : '500', color: posTab === i ? '#111' : '#999', whiteSpace: 'nowrap' }}>{tab}</button>
                ))}
              </div>
              <div style={{ padding: '20px' }}>
                {posTab === 0 && (
                  <div>
                    {mpModalStep === 'token' && (
                      <div>
                        <div style={{ marginBottom: '14px' }}>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '4px' }}>Access Token de Mercado Pago</label>
                          <input value={mpNewToken} onChange={e => setMpNewToken(e.target.value)} placeholder="APP_USR-xxxxxxxx-xxxx-xxxx" style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#888' }}>Obténlo en <a href="https://www.mercadopago.com/developers/panel/app" target="_blank" rel="noreferrer" style={{ color: '#0066cc' }}>mercadopago.com/developers</a> → Tu app → Credenciales</p>
                        </div>
                        <button onClick={async () => {
                          if (!mpNewToken.trim()) { setMpModalError('Ingresa el Access Token'); return; }
                          setMpModalDetecting(true); setMpModalError('');
                          setMpModalDetected([]);
                          try {
                            const res = await fetch(API + '/api/mercado-pago-detect-devices', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                              body: JSON.stringify({ access_token: mpNewToken.trim() })
                            });
                            const data = await res.json();
                            if (!res.ok) { setMpModalError(data.error || 'Error al consultar'); setMpModalDetecting(false); return; }
                            if (data.length === 0) { setMpModalError('No se encontraron dispositivos Point. Vincula tu Point en la app de Mercado Pago → Tu negocio → Sucursales y cajas'); setMpModalDetecting(false); return; }
                            setMpModalDetected(data);
                            setMpModalStep('select');
                          } catch { setMpModalError('Error de conexion'); }
                          setMpModalDetecting(false);
                        }} disabled={mpModalDetecting} className="btn btn-primary" style={{ width: '100%', background: '#009ee3', color: '#fff', fontWeight: '800', padding: '12px', borderRadius: '10px', border: 'none', fontSize: '15px' }}>
                          {mpModalDetecting ? <><FontAwesomeIcon icon={faSpinner} spin /> Buscando dispositivos...</> : 'Buscar dispositivos Point'}
                        </button>
                        {mpModalError && <p style={{ marginTop: '8px', fontSize: '12px', color: '#dc3545' }}>{mpModalError}</p>}
                      </div>
                    )}
                    {mpModalStep === 'select' && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#111' }}>Selecciona tus dispositivos Point ({mpModalDetected.length})</p>
                          <button onClick={() => { setMpModalStep('token'); setMpModalDetected([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#999' }}>← Cambiar token</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                          {mpModalDetected.map(d => (
                            <div key={d.id} style={{ padding: '12px', background: '#f9fafb', border: '2px solid #e5e7eb', borderRadius: '10px', cursor: 'pointer' }}
                              onClick={async () => {
                                setSavingMp(true);
                                const name = d.external_pos_id ? d.external_pos_id.split('__')[0] : ('Point ' + d.id.slice(0,8));
                                const res = await fetch(API + '/api/mercado-pago-terminals', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                                  body: JSON.stringify({ name, mercadopago_access_token: mpNewToken.trim(), mercadopago_terminal_id: d.id, store_id: selectedStore.id })
                                });
                                if (res.ok) {
                                  const created = await res.json();
                                  // Cerrar modal y mostrar banner de espera
                                  setShowPosModal(false);
                                  setMpBannerMode(null);
                                  setMpWorkingBanner(true);
                                  setMpNewToken('');
                                  setMpModalStep('token');
                                  setMpModalDetected([]);
                                  // Configurar PDV en MercadoPago
                                  try {
                                    await fetch(API + `/api/mercado-pago-terminals/${created.id}/mode`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                                      body: JSON.stringify({ device_id: d.id, operating_mode: 'PDV' })
                                    });
                                  } catch { /* ignore mode error */ }
                                  // Consultar estado real del dispositivo en MP
                                  try {
                                    const statusRes = await fetch(API + `/api/mercado-pago-terminals/${created.id}/status`, {
                                      headers: { Authorization: 'Bearer ' + token }
                                    });
                                    if (statusRes.ok) {
                                      const statusData = await statusRes.json();
                                      setMpBannerMode(statusData.operating_mode || 'UNDEFINED');
                                    } else {
                                      setMpBannerMode('PDV');
                                    }
                                  } catch { setMpBannerMode('PDV'); }
                                  refreshAll();
                                  setTimeout(() => setMpWorkingBanner(false), 5000);
                                } else {
                                  const err = await res.json();
                                  setMpModalError(err.error || 'Error al guardar');
                                }
                                setSavingMp(false);
                              }}>
                              <div style={{ fontSize: '14px', fontWeight: '800', color: '#111' }}>{d.external_pos_id ? d.external_pos_id.split('__')[0] : 'Point'}</div>
                              <div style={{ fontSize: '11px', color: '#888', fontFamily: 'monospace' }}>{d.id}</div>
                            </div>
                          ))}
                        </div>
                        {savingMp && <p style={{ marginTop: '8px', textAlign: 'center', fontSize: '12px', color: '#666' }}><FontAwesomeIcon icon={faSpinner} spin /> Guardando...</p>}
                        {mpModalError && <p style={{ marginTop: '8px', fontSize: '12px', color: '#dc3545' }}>{mpModalError}</p>}
                      </div>
                    )}
                    {mpSaveMsg && <p style={{ marginTop: '10px', fontSize: '12px', color: mpSaveMsg.includes('Error') || mpSaveMsg.includes('error') ? '#dc3545' : '#155724' }}>{mpSaveMsg}</p>}
                  </div>
                )}
                {posTab === 1 && (
                  <div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '4px' }}>API Key de Tuu</label>
                      <input value={tuuNewApiKey} onChange={e => setTuuNewApiKey(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }} />
                      <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#888' }}>La obtienes en integrations.tuu.cl</p>
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '4px' }}>Nombre del POS</label>
                      <input value={tuuNewName} onChange={e => setTuuNewName(e.target.value)} placeholder="Ej: Mostrador" style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '4px' }}>Serial del POS</label>
                      <input value={tuuNewSerial} onChange={e => setTuuNewSerial(e.target.value)} placeholder="XXXXXXXXXX" style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                    </div>
                    <input type="hidden" value={tuuNewDeviceId} />
                    <input type="hidden" value={tuuNewDteType} />
                    <button onClick={saveTuuPos} disabled={savingTuu} className="btn btn-primary" style={{ width: '100%', background: '#6a1b9a', color: '#fff', fontWeight: '800', padding: '12px', borderRadius: '10px', border: 'none', fontSize: '15px' }}>
                      {savingTuu ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Guardar Tuu POS'}
                    </button>
                    {tuuSaveMsg2 && <p style={{ marginTop: '8px', fontSize: '12px', color: tuuSaveMsg2.includes('Error') ? '#dc3545' : '#155724' }}>{tuuSaveMsg2}</p>}
                  </div>
                )}
                {posTab === 2 && (
                  <div>
                    {/* Step 1: Config */}
                    <div style={{ marginBottom: '14px', padding: '12px', background: squareStep !== 'config' ? '#f9fafb' : '#fff', border: '2px solid ' + (squareStep === 'config' ? '#000' : '#e5e7eb'), borderRadius: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: squareStep === 'config' ? '12px' : '0', cursor: 'pointer' }} onClick={() => setSquareStep('config')}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#111' }}>① Credenciales Square</span>
                        {squareCfgSaved && <span style={{ fontSize: '11px', color: '#155724', background: '#d4edda', padding: '2px 8px', borderRadius: '20px', fontWeight: '700' }}>✔ Guardado</span>}
                      </div>
                      {squareStep === 'config' && (
                        <div>
                          <div style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '4px' }}>Access Token de Square</label>
                            <input value={squareAccessToken} onChange={e => setSquareAccessToken(e.target.value)} placeholder="EAAl..." style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                            <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#888' }}>Obtén el Production Token en <a href="https://developer.squareup.com" target="_blank" rel="noreferrer" style={{ color: '#0066cc' }}>developer.squareup.com</a> → tu app → Credentials</p>
                          </div>
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <label style={{ fontSize: '12px', fontWeight: '700', color: '#333' }}>Location ID</label>
                              <button onClick={squareFetchLocations} disabled={squareLoadingLocs || !squareAccessToken.trim()} style={{ fontSize: '11px', color: '#0066cc', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                {squareLoadingLocs ? '⏳ Cargando...' : '🔍 Buscar ubicaciones'}
                              </button>
                            </div>
                            {squareLocations.length > 0 ? (
                              <select value={squareLocationId} onChange={e => setSquareLocationId(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }}>
                                <option value="">-- Selecciona una ubicación --</option>
                                {squareLocations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.id})</option>)}
                              </select>
                            ) : (
                              <input value={squareLocationId} onChange={e => setSquareLocationId(e.target.value)} placeholder="Ej: LAR6T2M15K5BQ" style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                            )}
                            <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#888' }}>O ingrésalo manualmente desde tu Square Dashboard → Ajustes → Ubicaciones</p>
                          </div>
                          <button onClick={async () => { await squareSaveConfig(); if (!squareError) setSquareStep('code'); }} disabled={squareSavingCfg || !squareAccessToken.trim() || !squareLocationId.trim()} style={{ width: '100%', padding: '11px', background: '#000', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '14px', cursor: 'pointer' }}>
                            {squareSavingCfg ? '⏳ Guardando...' : 'Guardar y continuar →'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Step 2: Generate code */}
                    <div style={{ marginBottom: '14px', padding: '12px', background: squareStep !== 'code' ? '#f9fafb' : '#fff', border: '2px solid ' + (squareStep === 'code' ? '#000' : '#e5e7eb'), borderRadius: '10px', opacity: squareCfgSaved ? 1 : 0.5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: squareStep === 'code' ? '12px' : '0', cursor: squareCfgSaved ? 'pointer' : 'default' }} onClick={() => squareCfgSaved && setSquareStep('code')}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#111' }}>② Vincular terminal Square</span>
                      </div>
                      {squareStep === 'code' && (
                        <div>
                          <div style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#333', display: 'block', marginBottom: '4px' }}>Nombre del terminal (opcional)</label>
                            <input value={squareDeviceName} onChange={e => setSquareDeviceName(e.target.value)} placeholder="Ej: Caja Principal" style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }} />
                          </div>
                          <button onClick={squareGenerateCode} disabled={squareGenerating || squarePolling} style={{ width: '100%', padding: '12px', background: '#000', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', marginBottom: '14px' }}>
                            {squareGenerating ? '⏳ Generando...' : '🔲 Generar código de inicio de sesión'}
                          </button>
                          {squareCode && (
                            <div style={{ background: '#fefce8', border: '2px solid #D4AF37', borderRadius: '12px', padding: '16px', textAlign: 'center', marginBottom: '12px' }}>
                              <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#666' }}>Ingresa este código en el terminal Square:</p>
                              <div style={{ fontSize: '36px', fontWeight: '900', letterSpacing: '6px', color: '#000', fontFamily: 'monospace' }}>{squareCode}</div>
                              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#888' }}>Terminal → Iniciar sesión → Usar código de dispositivo</p>
                              {squareCodeExpiry && <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#999' }}>Expira: {new Date(squareCodeExpiry).toLocaleTimeString('es-CL')}</p>}
                            </div>
                          )}
                          {squarePolling && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#f0f9ff', borderRadius: '8px', fontSize: '12px', color: '#0369a1' }}>
                              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                              {squarePollMsg || 'Esperando emparejamiento...'}
                            </div>
                          )}
                          {squareStep === 'paired' && (
                            <div style={{ padding: '10px 12px', background: '#d1fae5', borderRadius: '8px', fontSize: '13px', color: '#065f46', fontWeight: '700' }}>{squarePollMsg}</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Paired success */}
                    {squareStep === 'paired' && (
                      <div style={{ padding: '12px 14px', background: '#d1fae5', border: '2px solid #6ee7b7', borderRadius: '10px', fontSize: '13px', color: '#065f46', fontWeight: '700', textAlign: 'center' }}>
                        ✔ {squarePollMsg || 'Terminal vinculado exitosamente'}
                        <div style={{ marginTop: '8px' }}>
                          <button onClick={() => { setSquareStep('code'); setSquareCode(''); setSquareCodeId(''); setSquarePollMsg(''); }} style={{ fontSize: '12px', color: '#0369a1', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>+ Vincular otro terminal</button>
                        </div>
                      </div>
                    )}

                    {/* Devices list */}
                    {squareDevices.length > 0 && (
                      <div style={{ marginTop: '14px' }}>
                        <p style={{ fontSize: '12px', fontWeight: '700', color: '#555', margin: '0 0 6px' }}>Terminales Square vinculados:</p>
                        {squareDevices.map(d => (
                          <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '4px' }}>
                            <div>
                              <span style={{ fontSize: '13px', fontWeight: '700', color: '#111' }}>{d.name}</span>
                              <span style={{ fontSize: '11px', color: '#888', marginLeft: '8px', fontFamily: 'monospace' }}>{d.device_id?.slice(0, 16)}...</span>
                            </div>
                            <button onClick={async () => { if (!confirm('¿Desvincular ' + d.name + '?')) return; await fetch(API + '/api/square/devices/' + d.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }); refreshAll(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc3545', fontSize: '16px' }}>🗑</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {squareError && <p style={{ marginTop: '10px', fontSize: '12px', color: '#dc3545', fontWeight: '700' }}>⚠ {squareError}</p>}
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
