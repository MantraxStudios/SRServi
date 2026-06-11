import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPalette, faCoins, faChevronDown, faCheck, faFire, faClock,
  faShieldAlt, faLock, faUnlock, faRobot, faKey, faEye, faEyeSlash,
  faStore, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';

const CURRENCIES = [
  { code: 'USD', symbol: '$',  name: 'Dólar Estadounidense' },
  { code: 'EUR', symbol: '€',  name: 'Euro' },
  { code: 'GBP', symbol: '£',  name: 'Libra Esterlina' },
  { code: 'JPY', symbol: '¥',  name: 'Yen Japonés' },
  { code: 'MXN', symbol: '$',  name: 'Peso Mexicano' },
  { code: 'COP', symbol: '$',  name: 'Peso Colombiano' },
  { code: 'ARS', symbol: '$',  name: 'Peso Argentino' },
  { code: 'PEN', symbol: 'S/', name: 'Sol Peruano' },
  { code: 'BRL', symbol: 'R$', name: 'Real Brasileño' },
  { code: 'CLP', symbol: '$',  name: 'Peso Chileno' },
];

/* ── Shared style tokens ─────────────────────────────── */
const GOLD  = '#D4AF37';
const card  = {
  background: '#fff',
  borderRadius: 16,
  border: '1px solid #e5e7eb',
  overflow: 'hidden',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  marginBottom: 20,
};
const cardHeader = {
  padding: '18px 22px',
  borderBottom: '1px solid #f3f4f6',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};
const cardTitle  = { fontWeight: 800, fontSize: 15, color: '#111' };
const cardBody   = { padding: '20px 22px' };
const label      = { display: 'block', fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 6 };
const hint       = { fontSize: 12, color: '#9ca3af', marginTop: 4 };
const inputBase  = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid #e5e7eb',
  fontSize: 14, color: '#111',
  outline: 'none', background: '#fff',
  transition: 'border-color 0.15s',
};
const badge = (color, bg) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '4px 10px', borderRadius: 20,
  fontSize: 12, fontWeight: 700,
  color, background: bg,
});
const btnGold = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '10px 18px', borderRadius: 10, border: 'none',
  background: GOLD, color: '#000', fontWeight: 800, fontSize: 14,
  cursor: 'pointer', transition: 'opacity 0.15s',
};
const btnSecondary = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '10px 18px', borderRadius: 10,
  border: '1.5px solid #e5e7eb',
  background: '#f9fafb', color: '#374151', fontWeight: 700, fontSize: 14,
  cursor: 'pointer',
};
const btnDanger = { ...btnSecondary, border: '1.5px solid #fca5a5', color: '#dc2626', background: '#fff5f5' };

/* ── Toggle switch ───────────────────────────────────── */
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        background: checked ? GOLD : '#d1d5db',
        position: 'relative', cursor: 'pointer',
        flexShrink: 0, transition: 'background 0.2s',
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

/* ── Color row ───────────────────────────────────────── */
function ColorRow({ label: lbl, name, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{lbl}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{
          width: 38, height: 38, borderRadius: 10,
          border: '2px solid #e5e7eb', overflow: 'hidden',
          cursor: 'pointer', flexShrink: 0, display: 'block',
          background: value,
        }}>
          <input type="color" name={name} value={value} onChange={onChange}
            style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none', padding: 0 }} />
        </label>
        <input
          type="text" name={name} value={value} onChange={onChange}
          maxLength={7}
          style={{ ...inputBase, fontFamily: 'monospace', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', flex: 1 }}
        />
      </div>
    </div>
  );
}

function Settings() {
  const { user, token } = useAuth();
  const { selectedStore, fetchStores } = useStore();
  const [formData, setFormData] = useState({
    primary_color: '#000000',
    secondary_color: '#FFFFFF',
    accent_color: '#D4AF37',
    header_color: '#000000',
    currency_code: 'USD',
    currency_symbol: '$',
    currency_name: 'Dólar Estadounidense',
    smart_mode: true,
    inactivity_timeout: 120,
    show_top_selling: true,
    paid_order_status: 'pending',
    complements_label: '',
    extras_label: '',
    worker_show_prices: true,
  });
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [error, setError] = useState('');
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const loadedStoreId = useRef(null);
  const lastSavedRef = useRef(null); // JSON snapshot of the last persisted formData

  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSetup, setTotpSetup] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpDisableCode, setTotpDisableCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpError, setTotpError] = useState('');
  const [totpSuccess, setTotpSuccess] = useState('');
  const [totpStep, setTotpStep] = useState('idle');

  const [chatgptKey, setChatgptKey] = useState('');
  const [chatgptKeyPreview, setChatgptKeyPreview] = useState(null);
  const [chatgptHasKey, setChatgptHasKey] = useState(false);
  const [chatgptSaving, setChatgptSaving] = useState(false);
  const [chatgptMsg, setChatgptMsg] = useState(null);
  const [showChatgptKey, setShowChatgptKey] = useState(false);

  useEffect(() => {
    if (selectedStore && selectedStore.id !== loadedStoreId.current) {
      loadedStoreId.current = selectedStore.id;
      const loaded = {
        primary_color:     selectedStore.primary_color     || '#000000',
        secondary_color:   selectedStore.secondary_color   || '#FFFFFF',
        accent_color:      selectedStore.accent_color      || '#D4AF37',
        header_color:      selectedStore.header_color      || '#000000',
        currency_code:     selectedStore.currency_code     || 'USD',
        currency_symbol:   selectedStore.currency_symbol   || '$',
        currency_name:     selectedStore.currency_name     || 'Dólar Estadounidense',
        smart_mode:        selectedStore.smart_mode        ?? true,
        inactivity_timeout: selectedStore.inactivity_timeout ?? 120,
        show_top_selling:  selectedStore.show_top_selling  ?? true,
        paid_order_status: selectedStore.paid_order_status ?? 'pending',
        complements_label: selectedStore.complements_label ?? '',
        extras_label:      selectedStore.extras_label      ?? '',
        worker_show_prices: selectedStore.worker_show_prices ?? true,
      };
      lastSavedRef.current = JSON.stringify(loaded); // baseline so loading doesn't trigger a save
      setFormData(loaded);
    }
  }, [selectedStore]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/auth/2fa/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setTotpEnabled(d.enabled || false)).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/user/chatgpt-key', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setChatgptHasKey(d.has_key); setChatgptKeyPreview(d.key_preview); })
      .catch(() => {});
  }, [token]);

  const saveChatgptKey = async () => {
    if (!chatgptKey) return;
    setChatgptSaving(true); setChatgptMsg(null);
    try {
      const res = await fetch('/api/user/chatgpt-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ api_key: chatgptKey }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setChatgptHasKey(true);
      setChatgptKeyPreview(`sk-...${chatgptKey.slice(-4)}`);
      setChatgptKey('');
      setChatgptMsg({ text: 'API key guardada correctamente', ok: true });
    } catch (e) { setChatgptMsg({ text: e.message, ok: false }); }
    finally { setChatgptSaving(false); setTimeout(() => setChatgptMsg(null), 4000); }
  };

  const removeChatgptKey = async () => {
    setChatgptSaving(true); setChatgptMsg(null);
    try {
      const res = await fetch('/api/user/chatgpt-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ api_key: null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setChatgptHasKey(false); setChatgptKeyPreview(null); setChatgptKey('');
      setChatgptMsg({ text: 'API key eliminada', ok: true });
    } catch (e) { setChatgptMsg({ text: e.message, ok: false }); }
    finally { setChatgptSaving(false); setTimeout(() => setChatgptMsg(null), 4000); }
  };

  const startTotpSetup = async () => {
    setTotpError(''); setTotpLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/setup', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar código');
      setTotpSetup(data); setTotpStep('setup'); setTotpCode('');
    } catch (err) { setTotpError(err.message); }
    finally { setTotpLoading(false); }
  };

  const confirmTotpEnable = async () => {
    setTotpError(''); setTotpLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código incorrecto');
      setTotpEnabled(true); setTotpStep('idle'); setTotpSetup(null); setTotpCode('');
      setTotpSuccess('Verificación en 2 pasos activada'); setTimeout(() => setTotpSuccess(''), 4000);
    } catch (err) { setTotpError(err.message); }
    finally { setTotpLoading(false); }
  };

  const confirmTotpDisable = async () => {
    setTotpError(''); setTotpLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: totpDisableCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código incorrecto');
      setTotpEnabled(false); setTotpStep('idle'); setTotpDisableCode('');
      setTotpSuccess('Verificación en 2 pasos desactivada'); setTimeout(() => setTotpSuccess(''), 4000);
    } catch (err) { setTotpError(err.message); }
    finally { setTotpLoading(false); }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const selectCurrency = (currency) => {
    setFormData(prev => ({ ...prev, currency_code: currency.code, currency_symbol: currency.symbol, currency_name: currency.name }));
    setCurrencyDropdownOpen(false);
  };

  const saveSettings = async () => {
    if (!selectedStore) return;
    const snapshot = JSON.stringify(formData);
    setError(''); setSaveState('saving');
    try {
      const res = await fetch(`/api/stores/${selectedStore.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...formData, name: selectedStore.name }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))).error) || 'Error al guardar');
      lastSavedRef.current = snapshot;
      setSaveState('saved');
      fetchStores();
      setTimeout(() => setSaveState(s => (s === 'saved' ? 'idle' : s)), 2000);
    } catch (err) { setError(err.message); setSaveState('error'); }
  };

  // Auto-guardado con debounce: cualquier cambio se guarda solo
  useEffect(() => {
    if (!selectedStore || lastSavedRef.current === null) return;
    if (JSON.stringify(formData) === lastSavedRef.current) return; // sin cambios reales
    const t = setTimeout(() => { saveSettings(); }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  if (!selectedStore) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <FontAwesomeIcon icon={faStore} style={{ fontSize: 40, color: '#d1d5db', marginBottom: 16, display: 'block' }} />
        <h2 style={{ margin: '0 0 8px', color: '#111' }}>Seleccioná una tienda</h2>
        <p style={{ color: '#6b7280', marginBottom: 20 }}>Elegí una tienda desde el menú lateral para ver su configuración.</p>
        <Link to="/admin/stores" style={{ ...btnGold, textDecoration: 'none', display: 'inline-flex' }}>Ir a Tiendas</Link>
      </div>
    );
  }

  const mins = Math.floor((formData.inactivity_timeout || 120) / 60);
  const secs = (formData.inactivity_timeout || 120) % 60;

  return (
    <>
      {/* ── Page header ── */}
      <header className="admin-header">
        <div className="admin-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div className="admin-header-info">
            <h1>Configuración</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{selectedStore.name}</p>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, padding: '7px 14px', borderRadius: 20,
            background: saveState === 'error' ? '#fef2f2' : saveState === 'saved' ? '#f0fdf4' : '#f3f4f6',
            color: saveState === 'error' ? '#dc2626' : saveState === 'saved' ? '#16a34a' : '#6b7280' }}>
            {saveState === 'saving' && <><FontAwesomeIcon icon={faSpinner} spin /> Guardando…</>}
            {saveState === 'saved'  && <><FontAwesomeIcon icon={faCheck} /> Guardado</>}
            {saveState === 'error'  && <>✕ Error al guardar</>}
            {saveState === 'idle'   && <><FontAwesomeIcon icon={faCheck} style={{ color: '#9ca3af' }} /> Se guarda automáticamente</>}
          </div>
        </div>
      </header>

      <div className="admin-main" style={{ maxWidth: 1180 }}>

        {/* ── Global alert ── */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
            ✕ {error}
          </div>
        )}

        <div className="settings-grid">

          {/* ══ COLORES ══════════════════════════════════════════════ */}
          <div style={card}>
            <div style={cardHeader}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FontAwesomeIcon icon={faPalette} style={{ color: GOLD, fontSize: 15 }} />
              </div>
              <div>
                <div style={cardTitle}>Colores de tu Tienda</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Personalizá la apariencia del tótem</div>
              </div>
            </div>
            <div style={cardBody}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20, marginBottom: 24 }}>
                <ColorRow label="Color Primario"   name="primary_color"   value={formData.primary_color}   onChange={handleChange} />
                <ColorRow label="Color Secundario" name="secondary_color" value={formData.secondary_color} onChange={handleChange} />
                <ColorRow label="Color de Acento"  name="accent_color"    value={formData.accent_color}    onChange={handleChange} />
                <ColorRow label="Encabezado"        name="header_color"   value={formData.header_color}    onChange={handleChange} />
              </div>

              {/* Live preview */}
              <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <div style={{ background: formData.header_color, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: formData.accent_color, fontWeight: 800, fontSize: 16 }}>{selectedStore.name || user?.business_name}</span>
                  <span style={{ color: formData.accent_color, fontSize: 12, fontWeight: 600 }}>{formData.currency_symbol} {formData.currency_code}</span>
                </div>
                <div style={{ background: formData.secondary_color, padding: '18px' }}>
                  <div style={{ color: formData.primary_color, fontWeight: 600, fontSize: 14, marginBottom: 14 }}>
                    Ejemplo de producto
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: formData.accent_color, color: formData.primary_color, fontWeight: 700, fontSize: 13, cursor: 'default' }}>
                      {formData.currency_symbol} 12.99
                    </button>
                    <button type="button" style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: formData.primary_color, color: formData.secondary_color, fontWeight: 700, fontSize: 13, cursor: 'default' }}>
                      Agregar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ══ MONEDA ═══════════════════════════════════════════════ */}
          <div style={{ ...card, overflow: 'visible' }}>
            <div style={cardHeader}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FontAwesomeIcon icon={faCoins} style={{ color: '#16a34a', fontSize: 15 }} />
              </div>
              <div>
                <div style={cardTitle}>Moneda</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Los precios se mostrarán con esta moneda</div>
              </div>
            </div>
            <div style={cardBody}>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setCurrencyDropdownOpen(o => !o)}
                  style={{
                    ...inputBase, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', background: '#fff', fontWeight: 600,
                    border: currencyDropdownOpen ? `1.5px solid ${GOLD}` : '1.5px solid #e5e7eb',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ ...badge('#000', GOLD + '33'), fontFamily: 'monospace', fontWeight: 800 }}>{formData.currency_symbol}</span>
                    <span>{formData.currency_name}</span>
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>({formData.currency_code})</span>
                  </span>
                  <FontAwesomeIcon icon={faChevronDown} style={{ color: '#9ca3af', fontSize: 12, transition: 'transform 0.2s', transform: currencyDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                </button>

                {currencyDropdownOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 100,
                    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
                  }}>
                    {CURRENCIES.map(c => (
                      <button
                        key={c.code} type="button"
                        onClick={() => selectCurrency(c)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '11px 16px', border: 'none', textAlign: 'left', cursor: 'pointer',
                          background: formData.currency_code === c.code ? '#fffbeb' : '#fff',
                          borderBottom: '1px solid #f3f4f6',
                          fontSize: 14,
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: GOLD, minWidth: 22 }}>{c.symbol}</span>
                          <span style={{ fontWeight: 600 }}>{c.code}</span>
                          <span style={{ color: '#6b7280' }}>— {c.name}</span>
                        </span>
                        {formData.currency_code === c.code && <FontAwesomeIcon icon={faCheck} style={{ color: GOLD, fontSize: 13 }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ══ COMPORTAMIENTO ═══════════════════════════════════════ */}
          <div style={card}>
            <div style={cardHeader}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FontAwesomeIcon icon={faFire} style={{ color: '#f97316', fontSize: 15 }} />
              </div>
              <div>
                <div style={cardTitle}>Comportamiento</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Ajustá cómo funciona el tótem</div>
              </div>
            </div>
            <div style={cardBody}>

              {/* Smart mode */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111', marginBottom: 3 }}>Modo Smart</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>Los productos más vendidos aparecen primero con un badge brillante</div>
                </div>
                <Toggle checked={!!formData.smart_mode} onChange={v => setFormData(p => ({ ...p, smart_mode: v }))} />
              </div>

              {/* Top selling */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111', marginBottom: 3 }}>Mostrar "Más vendidos" 🔥</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>Badge de llama y reordenamiento de los más vendidos</div>
                </div>
                <Toggle checked={!!formData.show_top_selling} onChange={v => setFormData(p => ({ ...p, show_top_selling: v }))} />
              </div>

              {/* Inactivity timeout */}
              <div style={{ padding: '16px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <FontAwesomeIcon icon={faClock} style={{ color: '#6b7280', fontSize: 13 }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>Tiempo de inactividad</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                    <button type="button" onClick={() => setFormData(p => ({ ...p, inactivity_timeout: Math.max(30, (p.inactivity_timeout || 120) - 10) }))}
                      style={{ padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#374151', fontWeight: 700 }}>−</button>
                    <span style={{ padding: '8px 4px', fontSize: 15, fontWeight: 800, color: '#111', minWidth: 48, textAlign: 'center' }}>{formData.inactivity_timeout || 120}s</span>
                    <button type="button" onClick={() => setFormData(p => ({ ...p, inactivity_timeout: Math.min(600, (p.inactivity_timeout || 120) + 10) }))}
                      style={{ padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#374151', fontWeight: 700 }}>+</button>
                  </div>
                  <span style={{ fontSize: 13, color: '#9ca3af' }}>
                    {mins > 0 ? `${mins}m ` : ''}{secs > 0 ? `${secs}s` : ''} — después aparece el modal "¿Seguís ahí?"
                  </span>
                </div>
              </div>

              {/* Estado inicial del pedido */}
              <div style={{ paddingTop: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111', marginBottom: 4 }}>Estado inicial del pedido al pagar</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>¿En qué estado queda el pedido cuando se cobra con éxito?</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                  {[
                    { value: 'pending',   label: 'Pendiente',   desc: 'Queda en cola para preparar', icon: '⏳' },
                    { value: 'completed', label: 'Completado',  desc: 'Se marca directo como listo', icon: '✅' },
                  ].map(opt => (
                    <label key={opt.value} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                      padding: '14px 16px', borderRadius: 12,
                      border: `2px solid ${formData.paid_order_status === opt.value ? GOLD : '#e5e7eb'}`,
                      background: formData.paid_order_status === opt.value ? '#fffbeb' : '#f9fafb',
                      transition: 'all 0.15s',
                    }}>
                      <input type="radio" name="paid_order_status" value={opt.value}
                        checked={formData.paid_order_status === opt.value}
                        onChange={() => setFormData(p => ({ ...p, paid_order_status: opt.value }))}
                        style={{ accentColor: GOLD, marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{opt.icon} {opt.label}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Textos personalizables de personalización */}
              <div style={{ paddingTop: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111', marginBottom: 4 }}>Textos al personalizar un producto</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
                  Cómo se titulan los dos pasos al elegir un producto (en el tótem y el panel del trabajador). Déjalo vacío para usar los valores por defecto.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Paso 1 — Complementos
                    </label>
                    <input
                      type="text"
                      name="complements_label"
                      value={formData.complements_label}
                      onChange={handleChange}
                      maxLength={100}
                      placeholder="Complementos"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      Paso 2 — Extras
                    </label>
                    <input
                      type="text"
                      name="extras_label"
                      value={formData.extras_label}
                      onChange={handleChange}
                      maxLength={100}
                      placeholder="Extras"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ══ PANEL DE TRABAJADOR ═══════════════════════════════════ */}
          <div style={card}>
            <div style={cardHeader}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FontAwesomeIcon icon={faCoins} style={{ color: '#16a34a', fontSize: 15 }} />
              </div>
              <div>
                <div style={cardTitle}>Panel de trabajador</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Ajustá qué ven los trabajadores</div>
              </div>
            </div>
            <div style={cardBody}>
              {/* Mostrar precios */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '14px 0' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111', marginBottom: 3 }}>Mostrar precios de los pedidos</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>Si lo desactivás, los totales de cada pedido no se muestran en las tarjetas del panel del trabajador</div>
                </div>
                <Toggle checked={!!formData.worker_show_prices} onChange={v => setFormData(p => ({ ...p, worker_show_prices: v }))} />
              </div>
            </div>
          </div>

          {/* ══ SEGURIDAD 2FA ═════════════════════════════════════════ */}
        <div style={card}>
          <div style={cardHeader}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FontAwesomeIcon icon={faShieldAlt} style={{ color: '#3b82f6', fontSize: 15 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={cardTitle}>Verificación en 2 pasos</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Protegé tu cuenta con autenticación adicional</div>
            </div>
            <span style={totpEnabled ? badge('#16a34a', '#f0fdf4') : badge('#9ca3af', '#f3f4f6')}>
              {totpEnabled ? '● Activa' : '○ Inactiva'}
            </span>
          </div>
          <div style={cardBody}>
            {totpError   && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#dc2626' }}>{totpError}</div>}
            {totpSuccess && <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#16a34a' }}><FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />{totpSuccess}</div>}

            {totpStep === 'idle' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 14, color: '#374151' }}>
                    {totpEnabled
                      ? 'Tu cuenta está protegida. Se pedirá un código al iniciar sesión.'
                      : 'Activá para mayor seguridad. Compatible con Google Authenticator, Authy y más.'}
                  </div>
                </div>
                {totpEnabled ? (
                  <button onClick={() => { setTotpStep('disable'); setTotpDisableCode(''); setTotpError(''); }} style={btnDanger}>
                    <FontAwesomeIcon icon={faUnlock} /> Desactivar 2FA
                  </button>
                ) : (
                  <button onClick={startTotpSetup} disabled={totpLoading} style={{ ...btnGold }}>
                    {totpLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faShieldAlt} />}
                    {totpLoading ? 'Generando…' : 'Activar 2FA'}
                  </button>
                )}
              </div>
            )}

            {totpStep === 'setup' && totpSetup && (
              <div>
                <p style={{ fontSize: 14, color: '#374151', marginTop: 0, marginBottom: 16 }}>
                  <strong>Paso 1:</strong> Abrí <strong>Google Authenticator</strong> o <strong>Authy</strong> y escaneá:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <div style={{ padding: 16, background: '#fff', border: '2px solid #111', borderRadius: 12 }}>
                    <QRCodeCanvas value={totpSetup.otpauthUrl} size={180} level="H" />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>¿No podés escanear? Ingresá este código:</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, background: '#f3f4f6', padding: '8px 14px', borderRadius: 8, letterSpacing: 3, color: '#111', border: '1px solid #e0e0e0' }}>
                      {totpSetup.secret}
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: '#374151', marginBottom: 10 }}>
                  <strong>Paso 2:</strong> Ingresá el código de 6 dígitos de la app:
                </p>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <input type="text" inputMode="numeric" maxLength={6} value={totpCode}
                    onChange={e => { setTotpCode(e.target.value.replace(/\D/g, '')); setTotpError(''); }}
                    placeholder="000 000"
                    style={{ ...inputBase, fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: 800, flex: '1 1 140px', maxWidth: 200 }} />
                  <button onClick={confirmTotpEnable} disabled={totpLoading || totpCode.length !== 6} style={{ ...btnGold, opacity: totpCode.length !== 6 ? 0.5 : 1 }}>
                    {totpLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCheck} />}
                    Confirmar
                  </button>
                  <button onClick={() => { setTotpStep('idle'); setTotpSetup(null); setTotpError(''); }}
                    style={{ ...btnSecondary }}>Cancelar</button>
                </div>
              </div>
            )}

            {totpStep === 'disable' && (
              <div>
                <p style={{ fontSize: 14, color: '#374151', marginTop: 0, marginBottom: 14 }}>
                  Ingresá el código actual de tu app para desactivar:
                </p>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <input type="text" inputMode="numeric" maxLength={6} value={totpDisableCode}
                    onChange={e => { setTotpDisableCode(e.target.value.replace(/\D/g, '')); setTotpError(''); }}
                    placeholder="000 000"
                    style={{ ...inputBase, fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: 800, flex: '1 1 140px', maxWidth: 200 }} />
                  <button onClick={confirmTotpDisable} disabled={totpLoading || totpDisableCode.length !== 6}
                    style={{ ...btnDanger, background: '#dc2626', color: '#fff', border: 'none', opacity: totpDisableCode.length !== 6 ? 0.5 : 1 }}>
                    {totpLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faUnlock} />}
                    Desactivar
                  </button>
                  <button onClick={() => { setTotpStep('idle'); setTotpError(''); }} style={btnSecondary}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ CHATGPT API KEY ═══════════════════════════════════════ */}
        <div style={card}>
          <div style={cardHeader}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FontAwesomeIcon icon={faRobot} style={{ color: '#16a34a', fontSize: 15 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={cardTitle}>León IA — API Key de ChatGPT</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Mejorá las respuestas usando tu propia key de OpenAI</div>
            </div>
            {chatgptHasKey && <span style={badge('#16a34a', '#f0fdf4')}>● Configurada</span>}
          </div>
          <div style={cardBody}>
            {chatgptMsg && (
              <div style={{ background: chatgptMsg.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${chatgptMsg.ok ? '#86efac' : '#fca5a5'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: chatgptMsg.ok ? '#16a34a' : '#dc2626' }}>
                {chatgptMsg.text}
              </div>
            )}

            {chatgptHasKey && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <FontAwesomeIcon icon={faKey} style={{ color: '#16a34a' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>Key activa: <span style={{ fontFamily: 'monospace' }}>{chatgptKeyPreview}</span></div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>León IA usará GPT-4o-mini para respuestas más completas</div>
                </div>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={label}>{chatgptHasKey ? 'Reemplazar API Key' : 'Ingresar API Key de OpenAI'}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showChatgptKey ? 'text' : 'password'}
                  value={chatgptKey}
                  onChange={e => setChatgptKey(e.target.value)}
                  placeholder="sk-..."
                  style={{ ...inputBase, paddingRight: 44, fontFamily: 'monospace', fontSize: 13 }}
                />
                <button type="button" onClick={() => setShowChatgptKey(p => !p)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, fontSize: 14 }}>
                  <FontAwesomeIcon icon={showChatgptKey ? faEye : faEyeSlash} />
                </button>
              </div>
              <div style={hint}>Obtené tu key en platform.openai.com/api-keys — empieza con "sk-"</div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={saveChatgptKey} disabled={chatgptSaving || !chatgptKey} style={{ ...btnGold, opacity: !chatgptKey ? 0.5 : 1 }}>
                {chatgptSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faKey} />}
                {chatgptSaving ? 'Guardando…' : 'Guardar API Key'}
              </button>
              {chatgptHasKey && (
                <button type="button" onClick={removeChatgptKey} disabled={chatgptSaving} style={btnDanger}>
                  Eliminar API Key
                </button>
              )}
            </div>
          </div>
        </div>

        </div>
        {/* /settings-grid */}

      </div>
    </>
  );
}

export default Settings;
