import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMoneyBillWave, faCreditCard, faUtensils, faShoppingBag,
  faHashtag, faPercent, faTruck, faTabletAlt, faClock,
  faCheck, faExclamationTriangle, faSave, faSync, faPlus,
  faChevronDown, faChevronUp, faTableCells, faFlask, faCubes, faQrcode,
  faTrash, faCheckCircle, faCircle, faXmark, faCommentDots, faUser, faStopwatch
} from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#D4AF37';

function useIsMobile(bp = 900) {
  const [m, setM] = useState(typeof window !== 'undefined' ? window.innerWidth < bp : false);
  useEffect(() => {
    const onR = () => setM(window.innerWidth < bp);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, [bp]);
  return m;
}

const DEFAULT_FORM = {
  name: 'Principal',
  description: '',
  accept_cash: true,
  accept_card: true,
  is_active: true,
  is_default: true,
  default_terminal: '',
  allow_serve: true,
  allow_takeout: true,
  hide_decimals: false,
  allow_table_service: false,
  tip_percentage: 0,
  delivery_enabled: false,
  delivery_payment_methods: 'tuu,mercadopago',
  require_order_comment: false,
  require_customer_name: false
};

function PillToggle({ active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 46, height: 27, borderRadius: 14, border: 'none', padding: 0,
        background: active ? GOLD : '#d1d5db', cursor: 'pointer',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0
      }}
    >
      <div style={{
        position: 'absolute', top: 3.5,
        left: active ? 22 : 3.5,
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff', transition: 'left 0.18s',
        boxShadow: '0 1px 4px rgba(0,0,0,.18)'
      }} />
    </button>
  );
}

function Row({ icon, label, sub, active, onToggle, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '13px 0', borderBottom: '1px solid #f3f3f3'
    }}>
      <FontAwesomeIcon icon={icon} style={{ fontSize: 17, color: active ? '#111' : '#c4c4c4', width: 20, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#111', lineHeight: 1.2 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
      </div>
      {onToggle && <PillToggle active={active} onClick={onToggle} />}
      {children}
    </div>
  );
}

// Campo de texto simple para credenciales de wallet (no secreto)
function WalletField({ label, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>{label}</label>
      <input
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '9px 11px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  );
}

// Campo secreto: si ya hay un valor guardado, muestra "guardado" y no lo revela.
// El usuario solo escribe para reemplazarlo; si lo deja vacío, se conserva.
function WalletSecret({ label, value, onChange, isSet, placeholder, multiline }) {
  const Comp = multiline ? 'textarea' : 'input';
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
        {label}
        {isSet && <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '1px 7px', borderRadius: 20 }}>Guardado</span>}
      </label>
      <Comp
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={isSet ? '•••••• (dejar vacío para no cambiar)' : placeholder}
        rows={multiline ? 3 : undefined}
        style={{ width: '100%', padding: '9px 11px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: multiline ? 'vertical' : undefined, fontFamily: multiline ? 'monospace' : 'inherit' }}
      />
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.7px', margin: '20px 0 4px' }}>
      {children}
    </div>
  );
}

function ConfigCard({ config, isDefault, onSave, saving }) {
  const [form, setForm] = useState(config);
  const [open, setOpen] = useState(isDefault);
  const dirty = JSON.stringify(form) !== JSON.stringify(config);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  return (
    <div style={{
      border: `1.5px solid ${isDefault ? GOLD : '#e8e8e8'}`,
      borderRadius: 14, overflow: 'hidden', marginBottom: 10,
      background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.04)'
    }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer',
          borderBottom: open ? '1px solid #f0f0f0' : 'none'
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: form.is_active ? '#22c55e' : '#d1d5db', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: '#111', flex: 1, textAlign: 'left' }}>{form.name}</span>
        {isDefault && (
          <span style={{ fontSize: 11, background: '#faf7ee', color: '#92400e', border: `1px solid ${GOLD}`, borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>
            Predeterminada
          </span>
        )}
        <FontAwesomeIcon icon={open ? faChevronUp : faChevronDown} style={{ color: '#bbb', fontSize: 12 }} />
      </button>

      {open && (
        <div style={{ padding: '4px 18px 20px' }}>

          <SectionLabel>Pagos</SectionLabel>
          <Row icon={faMoneyBillWave} label="Efectivo" sub="Pago en caja" active={form.accept_cash} onToggle={() => set('accept_cash', !form.accept_cash)} />
          <Row icon={faCreditCard} label="Tarjeta / POS" sub="Débito, crédito, QR" active={form.accept_card} onToggle={() => set('accept_card', !form.accept_card)} />
          {!form.accept_cash && !form.accept_card && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 5 }}>
              <FontAwesomeIcon icon={faExclamationTriangle} /> Activa al menos un método
            </p>
          )}

          <SectionLabel>Tipo de pedido</SectionLabel>
          <Row icon={faUtensils} label="Comer aquí" sub="Servir en mesa" active={form.allow_serve} onToggle={() => set('allow_serve', !form.allow_serve)} />
          <Row icon={faShoppingBag} label="Para llevar" active={form.allow_takeout} onToggle={() => set('allow_takeout', !form.allow_takeout)} />
          <Row icon={faTableCells} label="Pedir número de mesa" sub="Al confirmar pago" active={form.allow_table_service} onToggle={() => set('allow_table_service', !form.allow_table_service)} />
          <Row icon={faTruck} label="Pedidos por QR" sub="Cliente escanea desde su teléfono" active={form.delivery_enabled} onToggle={() => set('delivery_enabled', !form.delivery_enabled)} />

          {form.delivery_enabled && (() => {
            const methods = (form.delivery_payment_methods || '').split(',').map(m => m.trim()).filter(Boolean);
            const has = (m) => methods.includes(m);
            const toggle = (m) => {
              const next = has(m) ? methods.filter(x => x !== m) : [...methods, m];
              set('delivery_payment_methods', next.join(','));
            };
            return (
              <div style={{ marginLeft: 18, paddingLeft: 14, borderLeft: `2px solid ${GOLD}33`, marginTop: 2 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '6px 0 2px' }}>
                  Métodos de pago del delivery
                </div>
                <Row icon={faCreditCard} label="TUU" sub="Pago con tarjeta TUU" active={has('tuu')} onToggle={() => toggle('tuu')} />
                <Row icon={faMoneyBillWave} label="Efectivo" sub="Paga al recibir el pedido" active={has('efectivo')} onToggle={() => toggle('efectivo')} />
                <Row icon={faQrcode} label="MercadoPago" sub="Pago online por QR" active={has('mercadopago')} onToggle={() => toggle('mercadopago')} />
                {methods.length === 0 && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <FontAwesomeIcon icon={faExclamationTriangle} /> Activa al menos un método para el delivery
                  </p>
                )}
              </div>
            );
          })()}

          <SectionLabel>Extras</SectionLabel>
          <Row icon={faHashtag} label="Ocultar decimales" sub="Los precios enteros no muestran .00" active={form.hide_decimals} onToggle={() => set('hide_decimals', !form.hide_decimals)} />
          <Row icon={faCommentDots} label="Pedir comentario" sub="Al confirmar pago, el cliente puede agregar una nota" active={form.require_order_comment} onToggle={() => set('require_order_comment', !form.require_order_comment)} />
          <Row icon={faUser} label="Solicitar nombre del cliente" sub="Muestra un campo con teclado táctil antes de confirmar el pedido" active={form.require_customer_name} onToggle={() => set('require_customer_name', !form.require_customer_name)} />

          <Row icon={faPercent} label="Propina sugerida" sub="0 = sin propina" active={form.tip_percentage > 0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number" min="0" max="100" step="1" value={form.tip_percentage}
                onChange={e => set('tip_percentage', Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                style={{ width: 52, padding: '6px 8px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 14, fontWeight: 700, textAlign: 'center', outline: 'none' }}
              />
              <span style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>%</span>
            </div>
          </Row>

          <SectionLabel>Estado</SectionLabel>
          <Row icon={faCheck} label="Configuración activa" active={form.is_active} onToggle={() => set('is_active', !form.is_active)} />
          <Row icon={faCheck} label="Predeterminada" sub="Se aplica si el dispositivo no tiene una asignada" active={form.is_default} onToggle={() => set('is_default', !form.is_default)} />

          <button
            type="button"
            disabled={saving || (!dirty && config.id)}
            onClick={() => onSave(form)}
            style={{
              width: '100%', marginTop: 18, padding: '12px', borderRadius: 10, border: 'none',
              background: dirty ? '#111' : '#f0f0f0',
              color: dirty ? '#fff' : '#aaa',
              fontWeight: 700, fontSize: 14, cursor: dirty ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s'
            }}
          >
            <FontAwesomeIcon icon={saving ? faSync : faSave} spin={saving} />
            {saving ? 'Guardando...' : dirty ? 'Guardar cambios' : 'Sin cambios'}
          </button>
        </div>
      )}
    </div>
  );
}

function DeviceCard({ device, configs, onSave, saving, selectMode, selected, onSelectToggle }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(device.label || '');
  const [configId, setConfigId] = useState(device.config_id || '');
  const [restartTime, setRestartTime] = useState(device.restart_time || '');
  const dirty = label !== (device.label || '') || String(configId) !== String(device.config_id || '') || String(restartTime) !== String(device.restart_time || '');

  const online = device.last_seen && (new Date() - new Date(device.last_seen)) < 300000;
  const configName = configs.find(c => String(c.id) === String(device.config_id))?.name || 'Predeterminada';

  const formatDate = (d) => {
    if (!d) return 'Nunca';
    const diff = Math.floor((new Date() - new Date(d)) / 60000);
    if (diff < 1) return 'Ahora mismo';
    if (diff < 60) return `Hace ${diff} min`;
    if (diff < 1440) return `Hace ${Math.floor(diff / 60)}h`;
    return new Date(d).toLocaleDateString('es-CL');
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1.5px solid #e8e8e8',
    borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box',
    background: '#fafafa', color: '#111'
  };

  return (
    <div style={{
      background: '#fff',
      border: selected ? `1.5px solid ${GOLD}` : '1.5px solid #e8e8e8',
      borderLeft: selected ? `4px solid ${GOLD}` : `4px solid ${online ? '#22c55e' : '#d1d5db'}`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: selected ? `0 0 0 3px ${GOLD}22` : 'none',
      transition: 'box-shadow 0.15s, border-color 0.15s'
    }}>
      {/* Header row — siempre visible */}
      <button
        type="button"
        onClick={() => selectMode ? onSelectToggle(device.id) : setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer',
          borderBottom: (open && !selectMode) ? '1px solid #f0f0f0' : 'none'
        }}
      >
        {selectMode && (
          <FontAwesomeIcon icon={selected ? faCheckCircle : faCircle} style={{ fontSize: 20, color: selected ? GOLD : '#d1d5db', flexShrink: 0 }} />
        )}
        <FontAwesomeIcon icon={faTabletAlt} style={{ fontSize: 16, color: online ? '#22c55e' : '#ccc', flexShrink: 0 }} />
        <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#111', lineHeight: 1.2 }}>
            {device.label || <span style={{ color: '#bbb', fontStyle: 'italic', fontWeight: 400 }}>Sin nombre</span>}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
            {online
              ? <span style={{ color: '#16a34a', fontWeight: 600 }}>En línea</span>
              : `Última vez: ${formatDate(device.last_seen)}`}
            {' · '}{configName}
          </div>
        </div>
        {!selectMode && <FontAwesomeIcon icon={open ? faChevronUp : faChevronDown} style={{ color: '#ccc', fontSize: 11, flexShrink: 0 }} />}
      </button>

      {/* Cuerpo expandible */}
      {open && !selectMode && (
        <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Nombre del dispositivo
            </label>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ej: Tótem entrada, Caja 1..."
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Configuración asignada
            </label>
            <select
              value={configId}
              onChange={e => setConfigId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Predeterminada</option>
              {configs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <FontAwesomeIcon icon={faClock} style={{ marginRight: 5 }} />
              Reinicio automático (segundos)
            </label>
            <input
              type="number" min="0" value={restartTime}
              onChange={e => setRestartTime(e.target.value)}
              placeholder="0 = desactivado"
              style={inputStyle}
            />
            {restartTime > 0 && (
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                Se reiniciará cada {restartTime}s sin actividad
              </div>
            )}
          </div>

          <button
            onClick={() => onSave(device.id, { label, config_id: configId ? parseInt(configId) : null, restart_time: restartTime || null })}
            disabled={!dirty || saving}
            style={{
              padding: '10px', borderRadius: 9, border: 'none',
              background: dirty ? '#111' : '#f0f0f0',
              color: dirty ? '#fff' : '#bbb',
              fontWeight: 700, fontSize: 13, cursor: dirty ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              transition: 'background 0.15s', marginTop: 2
            }}
          >
            <FontAwesomeIcon icon={saving ? faSync : faSave} spin={saving} />
            {saving ? 'Guardando...' : dirty ? 'Guardar' : 'Sin cambios'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Configurations() {
  const { selectedStore } = useStore();
  const [configs, setConfigs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [extras, setExtras] = useState([]);
  const [compTab, setCompTab] = useState('ingredient');
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingDevice, setSavingDevice] = useState(null);
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [newConfigName, setNewConfigName] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState(new Set());
  const [deletingDevices, setDeletingDevices] = useState(false);
  const [stampCfg, setStampCfg] = useState(null);
  const [stampCards, setStampCards] = useState([]);
  const [stampSaving, setStampSaving] = useState(false);
  const [stampSaved, setStampSaved] = useState(false);
  const [walletCfg, setWalletCfg] = useState(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletSaving, setWalletSaving] = useState(false);
  const [walletSaved, setWalletSaved] = useState(false);
  const [timerCfg, setTimerCfg] = useState(null);
  const [timerSaving, setTimerSaving] = useState(false);
  const [timerSaved, setTimerSaved] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (selectedStore) loadAll();
    else { setLoading(false); setConfigs([]); setDevices([]); }
  }, [selectedStore]);

  const loadAll = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const [cfgRes, devRes, ingRes, extRes, stampCfgRes, stampCardsRes, walletRes, timerRes] = await Promise.all([
      fetch(`/api/store-configurations?store_id=${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(API + `/api/store-devices?store_id=${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/ingredients?store_id=${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/extras?store_id=${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/stamp-card/config?store_id=${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/stamp-card/cards?store_id=${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/stamp-card/wallet-config?store_id=${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/timer-game/config?store_id=${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } })
    ]);
    const cfgData = await cfgRes.json();
    const devData = devRes.ok ? await devRes.json() : [];
    const ingData = ingRes.ok ? await ingRes.json() : [];
    const extData = extRes.ok ? await extRes.json() : [];
    const stampCfgData = stampCfgRes.ok ? await stampCfgRes.json() : null;
    const stampCardsData = stampCardsRes.ok ? await stampCardsRes.json() : [];
    const walletCfgData = walletRes.ok ? await walletRes.json() : null;
    const timerCfgData = timerRes.ok ? await timerRes.json() : null;
    setConfigs(Array.isArray(cfgData) ? cfgData : []);
    setDevices(Array.isArray(devData) ? devData : []);
    setIngredients(Array.isArray(ingData) ? ingData : []);
    setExtras(Array.isArray(extData) ? extData : []);
    setStampCfg(stampCfgData ? {
      enabled: !!stampCfgData.enabled,
      money_per_point: Number(stampCfgData.money_per_point) || 1
    } : { enabled: false, money_per_point: 1 });
    setStampCards(Array.isArray(stampCardsData) ? stampCardsData : []);
    setWalletCfg(walletCfgData || {});
    setTimerCfg(timerCfgData ? {
      enabled: !!timerCfgData.enabled,
      target_seconds: Number(timerCfgData.target_seconds) || 10,
      tolerance_seconds: Number(timerCfgData.tolerance_seconds) || 0,
      discount_percent: Number(timerCfgData.discount_percent) || 10
    } : { enabled: true, target_seconds: 10, tolerance_seconds: 0, discount_percent: 10 });
    setLoading(false);
  };

  const saveTimerCfg = async () => {
    if (!timerCfg) return;
    setTimerSaving(true);
    setTimerSaved(false);
    const token = localStorage.getItem('token');
    try {
      await fetch('/api/timer-game/config', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...timerCfg, tolerance_seconds: 0, store_id: selectedStore.id })
      });
      setTimerSaved(true);
      setTimeout(() => setTimerSaved(false), 2500);
    } finally {
      setTimerSaving(false);
    }
  };

  const saveWalletCfg = async () => {
    if (!walletCfg) return;
    setWalletSaving(true);
    setWalletSaved(false);
    const token = localStorage.getItem('token');
    try {
      // Solo enviamos los secretos si el usuario escribió algo nuevo (campos con
      // sufijo _set indican que ya hay un valor guardado que no se toca).
      const body = { store_id: selectedStore.id };
      const w = walletCfg;
      body.google_issuer_id = w.google_issuer_id || '';
      body.google_sa_email = w.google_sa_email || '';
      if (w.google_sa_key) body.google_sa_key = w.google_sa_key;
      body.apple_pass_type_id = w.apple_pass_type_id || '';
      body.apple_team_id = w.apple_team_id || '';
      if (w.apple_signer_cert) body.apple_signer_cert = w.apple_signer_cert;
      if (w.apple_signer_key) body.apple_signer_key = w.apple_signer_key;
      if (w.apple_signer_key_passphrase) body.apple_signer_key_passphrase = w.apple_signer_key_passphrase;
      if (w.apple_wwdr) body.apple_wwdr = w.apple_wwdr;
      await fetch('/api/stamp-card/wallet-config', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      setWalletSaved(true);
      setTimeout(() => setWalletSaved(false), 2500);
      // Refrescar para reflejar los _set y limpiar los secretos escritos
      loadAll();
    } finally {
      setWalletSaving(false);
    }
  };

  const saveStampCfg = async () => {
    if (!stampCfg) return;
    setStampSaving(true);
    setStampSaved(false);
    const token = localStorage.getItem('token');
    try {
      await fetch('/api/stamp-card/config', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...stampCfg, store_id: selectedStore.id })
      });
      setStampSaved(true);
      setTimeout(() => setStampSaved(false), 2500);
    } finally {
      setStampSaving(false);
    }
  };

  const deleteStampCard = async (id) => {
    if (!window.confirm('¿Eliminar esta tarjeta de cliente?')) return;
    const token = localStorage.getItem('token');
    await fetch(`/api/stamp-card/cards/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_id: selectedStore.id })
    });
    setStampCards(prev => prev.filter(c => c.id !== id));
  };

  const toggleComplementActive = async (type, item) => {
    const token = localStorage.getItem('token');
    const path = type === 'extra' ? 'extras' : 'ingredients';
    const newVal = !item.is_active;
    const setter = type === 'extra' ? setExtras : setIngredients;
    setter(prev => prev.map(i => i.id === item.id ? { ...i, is_active: newVal } : i));
    try {
      const res = await fetch(`/api/${path}/${item.id}/active`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStore.id, is_active: newVal })
      });
      if (!res.ok) throw new Error('fail');
    } catch {
      setter(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !newVal } : i));
    }
  };

  const saveConfig = async (form) => {
    setSavingConfig(true);
    const token = localStorage.getItem('token');
    const isNew = !form.id;
    await fetch(isNew ? '/api/store-configurations' : `/api/store-configurations/${form.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, store_id: selectedStore.id })
    });
    setSavingConfig(false);
    loadAll();
  };

  const saveDevice = async (deviceId, data) => {
    setSavingDevice(deviceId);
    const token = localStorage.getItem('token');
    await fetch(API + `/api/store-devices/${deviceId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    setSavingDevice(null);
    loadAll();
  };

  const addConfig = async () => {
    if (!newConfigName.trim()) return;
    await saveConfig({ ...DEFAULT_FORM, name: newConfigName.trim(), is_default: false });
    setShowAddConfig(false);
    setNewConfigName('');
  };

  const toggleDeviceSelect = (id) => {
    setSelectedDevices(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const exitSelectMode = () => { setSelectMode(false); setSelectedDevices(new Set()); };

  const deleteSelectedDevices = async () => {
    if (selectedDevices.size === 0) return;
    if (!window.confirm(`¿Eliminar ${selectedDevices.size} tótem(s)? Volverán a registrarse si se vuelve a abrir la tienda en ese dispositivo.`)) return;
    setDeletingDevices(true);
    const token = localStorage.getItem('token');
    try {
      await Promise.all([...selectedDevices].map(id =>
        fetch(API + `/api/store-devices/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      ));
      exitSelectMode();
      await loadAll();
    } finally { setDeletingDevices(false); }
  };

  if (!selectedStore) return (
    <div className="empty-state">
      <p className="empty-state-text">Selecciona una tienda</p>
    </div>
  );

  if (loading) return <div className="loading">Cargando...</div>;

  const defaultConfig = configs.find(c => c.is_default) || configs[0];
  const otherConfigs = configs.filter(c => c.id !== defaultConfig?.id);

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Punto de Venta</h1>
          <p className="text-sm text-muted">Pago, pedidos y tótems — {selectedStore.name}</p>
        </div>
      </header>

      <div className="admin-main" style={{ maxWidth: isMobile ? 600 : 1080 }}>
       <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1fr) minmax(0,1fr)', gap: isMobile ? 0 : 28, alignItems: 'start' }}>
        {/* ── Columna izquierda: pagos + complementos ── */}
        <div>

        {/* ── Tarjeta Virtual de Puntos ── */}
        {stampCfg && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 12 }}>
              Tarjeta Virtual de Puntos
            </div>
            <div style={{ background: '#fff', border: `1.5px solid ${stampCfg.enabled ? GOLD : '#e8e8e8'}`, borderRadius: 14, padding: '4px 18px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <Row
                icon={faQrcode}
                label="Activar tarjeta de puntos"
                sub="Los clientes acumulan puntos por compra y los canjean como descuento"
                active={stampCfg.enabled}
                onToggle={() => setStampCfg(p => ({ ...p, enabled: !p.enabled }))}
              />

              {stampCfg.enabled && (
                <>
                  <Row icon={faPercent} label="Valor de cada punto" sub="Cuánto dinero descuenta 1 punto al canjear">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>$</span>
                      <input
                        type="number" min="0" step="0.5" value={stampCfg.money_per_point}
                        onChange={e => setStampCfg(p => ({ ...p, money_per_point: Math.max(0, parseFloat(e.target.value) || 0) }))}
                        style={{ width: 70, padding: '6px 8px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 14, fontWeight: 700, textAlign: 'center', outline: 'none' }}
                      />
                    </div>
                  </Row>
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>
                    Los puntos que da cada producto se configuran en cada producto (en el tótem, al editarlo).
                  </p>

                  {stampCards.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                        Clientes registrados ({stampCards.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                        {stampCards.map(c => (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid #eee', background: '#fafafa' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {c.name || (c.code ? 'Clave ' + c.code : 'Cliente')}
                              </div>
                              <div style={{ fontSize: 11, color: '#999' }}>
                                {c.code ? 'Clave ' + c.code + ' · ' : ''}{c.points || 0} puntos
                              </div>
                            </div>
                            <button
                              onClick={() => deleteStampCard(c.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: 6, borderRadius: 8, flexShrink: 0 }}
                              title="Eliminar tarjeta"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Wallet: credenciales propias de la tienda ── */}
                  <div style={{ marginTop: 18, borderTop: '1px solid #eee', paddingTop: 14 }}>
                    <button
                      type="button"
                      onClick={() => setWalletOpen(o => !o)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#111', textAlign: 'left' }}>
                        Añadir al celular (Google / Apple Wallet)
                        <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: '#9ca3af', marginTop: 2 }}>
                          Usa TUS credenciales para que los pases salgan a nombre de tu negocio
                        </span>
                      </span>
                      <FontAwesomeIcon icon={walletOpen ? faChevronUp : faChevronDown} style={{ color: '#9ca3af' }} />
                    </button>

                    {walletOpen && walletCfg && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                          Google Wallet (Android)
                        </div>
                        <WalletField label="Issuer ID" value={walletCfg.google_issuer_id} onChange={v => setWalletCfg(p => ({ ...p, google_issuer_id: v }))} placeholder="Ej: 33000000000012345" />
                        <WalletField label="Service Account (email)" value={walletCfg.google_sa_email} onChange={v => setWalletCfg(p => ({ ...p, google_sa_email: v }))} placeholder="cuenta@proyecto.iam.gserviceaccount.com" />
                        <WalletSecret label="Private key (PEM)" isSet={walletCfg.google_sa_key_set} value={walletCfg.google_sa_key} onChange={v => setWalletCfg(p => ({ ...p, google_sa_key: v }))} multiline placeholder="-----BEGIN PRIVATE KEY-----..." />

                        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '16px 0 8px' }}>
                          Apple Wallet (iPhone)
                        </div>
                        <WalletField label="Pass Type ID" value={walletCfg.apple_pass_type_id} onChange={v => setWalletCfg(p => ({ ...p, apple_pass_type_id: v }))} placeholder="pass.com.tunegocio.loyalty" />
                        <WalletField label="Team ID" value={walletCfg.apple_team_id} onChange={v => setWalletCfg(p => ({ ...p, apple_team_id: v }))} placeholder="Ej: ABCDE12345" />
                        <WalletSecret label="Certificado del Pass Type ID (PEM)" isSet={walletCfg.apple_signer_cert_set} value={walletCfg.apple_signer_cert} onChange={v => setWalletCfg(p => ({ ...p, apple_signer_cert: v }))} multiline placeholder="-----BEGIN CERTIFICATE-----..." />
                        <WalletSecret label="Private key del certificado (PEM)" isSet={walletCfg.apple_signer_key_set} value={walletCfg.apple_signer_key} onChange={v => setWalletCfg(p => ({ ...p, apple_signer_key: v }))} multiline placeholder="-----BEGIN PRIVATE KEY-----..." />
                        <WalletSecret label="Passphrase del key (si tiene)" isSet={walletCfg.apple_signer_key_passphrase_set} value={walletCfg.apple_signer_key_passphrase} onChange={v => setWalletCfg(p => ({ ...p, apple_signer_key_passphrase: v }))} placeholder="Opcional" />
                        <WalletSecret label="Apple WWDR (PEM)" isSet={walletCfg.apple_wwdr_set} value={walletCfg.apple_wwdr} onChange={v => setWalletCfg(p => ({ ...p, apple_wwdr: v }))} multiline placeholder="-----BEGIN CERTIFICATE-----..." />

                        <button
                          type="button"
                          disabled={walletSaving}
                          onClick={saveWalletCfg}
                          style={{
                            width: '100%', marginTop: 12, padding: '11px', borderRadius: 10, border: 'none',
                            background: walletSaved ? '#22c55e' : '#111', color: '#fff',
                            fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                          }}
                        >
                          <FontAwesomeIcon icon={walletSaving ? faSync : faSave} spin={walletSaving} />
                          {walletSaving ? 'Guardando...' : walletSaved ? '¡Guardado!' : 'Guardar credenciales de Wallet'}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              <button
                type="button"
                disabled={stampSaving}
                onClick={saveStampCfg}
                style={{
                  width: '100%', marginTop: 18, padding: '12px', borderRadius: 10, border: 'none',
                  background: stampSaved ? '#22c55e' : '#111', color: '#fff',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                <FontAwesomeIcon icon={stampSaving ? faSync : faSave} spin={stampSaving} />
                {stampSaving ? 'Guardando...' : stampSaved ? '¡Guardado!' : 'Guardar tarjeta de puntos'}
              </button>
            </div>
          </div>
        )}

        {/* ── Juego del cronómetro ── */}
        {timerCfg && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 12 }}>
              Juego del cronómetro
            </div>
            <div style={{ background: '#fff', border: `1.5px solid ${timerCfg.enabled ? GOLD : '#e8e8e8'}`, borderRadius: 14, padding: '4px 18px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <Row
                icon={faStopwatch}
                label="Activar juego del cronómetro"
                sub="El cliente detiene un cronómetro en el tótem; si acierta el tiempo, gana un descuento en su cuenta"
                active={timerCfg.enabled}
                onToggle={() => setTimerCfg(p => ({ ...p, enabled: !p.enabled }))}
              />

              {timerCfg.enabled && (
                <>
                  <Row icon={faStopwatch} label="Tiempo objetivo" sub="Segundos exactos en que debe detener el cronómetro">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number" min="0.1" step="0.1" value={timerCfg.target_seconds}
                        onChange={e => setTimerCfg(p => ({ ...p, target_seconds: Math.max(0.1, parseFloat(e.target.value) || 0) }))}
                        style={{ width: 70, padding: '6px 8px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 14, fontWeight: 700, textAlign: 'center', outline: 'none' }}
                      />
                      <span style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>seg</span>
                    </div>
                  </Row>

                  <Row icon={faPercent} label="Descuento al acertar" sub="Porcentaje que se descuenta del total de la cuenta">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number" min="0" max="100" step="1" value={timerCfg.discount_percent}
                        onChange={e => setTimerCfg(p => ({ ...p, discount_percent: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) }))}
                        style={{ width: 70, padding: '6px 8px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 14, fontWeight: 700, textAlign: 'center', outline: 'none' }}
                      />
                      <span style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>%</span>
                    </div>
                  </Row>

                  <p style={{ fontSize: 12, color: '#9ca3af', margin: '8px 0 0' }}>
                    {`El cliente debe detener el cronómetro EXACTAMENTE en ${Number(timerCfg.target_seconds).toFixed(2)}s para ganar el ${timerCfg.discount_percent}% de descuento.`}
                    {' '}Solo un intento por compra.
                  </p>
                </>
              )}

              <button
                type="button"
                disabled={timerSaving}
                onClick={saveTimerCfg}
                style={{
                  width: '100%', marginTop: 18, padding: '12px', borderRadius: 10, border: 'none',
                  background: timerSaved ? '#22c55e' : '#111', color: '#fff',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                <FontAwesomeIcon icon={timerSaving ? faSync : faSave} spin={timerSaving} />
                {timerSaving ? 'Guardando...' : timerSaved ? '¡Guardado!' : 'Guardar juego del cronómetro'}
              </button>
            </div>
          </div>
        )}

        {/* Configuraciones */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 12 }}>
            Configuración de pago
          </div>

          {configs.length === 0 ? (
            <div style={{
              background: '#fff', border: '1.5px dashed #e0e0e0', borderRadius: 14,
              padding: '28px 24px', textAlign: 'center'
            }}>
              <p style={{ color: '#aaa', fontSize: 14, margin: '0 0 16px' }}>No hay configuración creada aún</p>
              <button
                onClick={() => saveConfig(DEFAULT_FORM)}
                disabled={savingConfig}
                style={{ padding: '10px 22px', borderRadius: 9, border: 'none', background: GOLD, color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: 7 }} />
                Crear configuración predeterminada
              </button>
            </div>
          ) : (
            <>
              {defaultConfig && (
                <ConfigCard key={defaultConfig.id} config={defaultConfig} isDefault={true} onSave={saveConfig} saving={savingConfig} />
              )}
              {otherConfigs.map(cfg => (
                <ConfigCard key={cfg.id} config={cfg} isDefault={false} onSave={saveConfig} saving={savingConfig} />
              ))}

              {showAddConfig ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input
                    autoFocus
                    value={newConfigName}
                    onChange={e => setNewConfigName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addConfig()}
                    placeholder="Nombre de la configuración"
                    style={{ flex: 1, padding: '9px 12px', border: '1.5px solid #e2e2e2', borderRadius: 9, fontSize: 13, outline: 'none' }}
                  />
                  <button onClick={addConfig} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: '#111', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Crear</button>
                  <button onClick={() => setShowAddConfig(false)} style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid #e2e2e2', background: '#fff', cursor: 'pointer', color: '#888' }}>✕</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddConfig(true)}
                  style={{ marginTop: 4, padding: '8px 14px', borderRadius: 9, border: '1.5px dashed #ddd', background: 'transparent', color: '#aaa', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <FontAwesomeIcon icon={faPlus} /> Agregar configuración extra
                </button>
              )}
            </>
          )}
        </div>

        {/* Implementos y Extras — activar/desactivar */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>
            Implementos y Extras
          </div>
          <p style={{ fontSize: 12, color: '#bbb', margin: '0 0 12px' }}>
            Activa los que deben aparecer en el tótem y el panel del trabajador. Los nuevos quedan desactivados.
          </p>

          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button
              onClick={() => setCompTab('ingredient')}
              style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: '1.5px solid ' + (compTab === 'ingredient' ? '#111' : '#e2e2e2'), background: compTab === 'ingredient' ? '#111' : '#fff', color: compTab === 'ingredient' ? '#fff' : '#666', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
            >
              <FontAwesomeIcon icon={faFlask} /> Implementos
              <span style={{ fontSize: 11, opacity: 0.7 }}>({ingredients.filter(i => i.is_active).length}/{ingredients.length})</span>
            </button>
            <button
              onClick={() => setCompTab('extra')}
              style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: '1.5px solid ' + (compTab === 'extra' ? '#111' : '#e2e2e2'), background: compTab === 'extra' ? '#111' : '#fff', color: compTab === 'extra' ? '#fff' : '#666', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
            >
              <FontAwesomeIcon icon={faCubes} /> Extras
              <span style={{ fontSize: 11, opacity: 0.7 }}>({extras.filter(e => e.is_active).length}/{extras.length})</span>
            </button>
          </div>

          {(() => {
            const list = compTab === 'extra' ? extras : ingredients;
            if (list.length === 0) {
              return (
                <div style={{ background: '#fafafa', border: '1.5px dashed #e0e0e0', borderRadius: 14, padding: '24px', textAlign: 'center', color: '#bbb', fontSize: 13 }}>
                  No hay {compTab === 'extra' ? 'extras' : 'implementos'} creados.
                </div>
              );
            }
            return (
              <div style={{ display: 'grid', gap: 8 }}>
                {list.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '10px 14px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        {Number(item.price) > 0 ? `+$${Number(item.price).toFixed(0)}` : 'Sin costo'}
                        {' · '}{item.is_active ? 'Visible' : 'Oculto'}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleComplementActive(compTab, item)}
                      title={item.is_active ? 'Activado — visible' : 'Desactivado — oculto'}
                      style={{ width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative', background: item.is_active ? '#16a34a' : '#cbd5e1', transition: 'background 0.15s', flexShrink: 0, padding: 0 }}
                    >
                      <span style={{ position: 'absolute', top: 3, left: item.is_active ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        </div>{/* ── fin columna izquierda ── */}

        {/* ── Columna derecha: Tótems ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
              Tótems registrados {devices.length > 0 && <span style={{ color: '#c4c4c4' }}>({devices.length})</span>}
            </div>
            {devices.length > 0 && (
              selectMode ? (
                <button onClick={exitSelectMode} style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <FontAwesomeIcon icon={faXmark} /> Cancelar
                </button>
              ) : (
                <button onClick={() => setSelectMode(true)} style={{ background: '#fff', border: '1px solid #e2e2e2', borderRadius: 8, color: '#555', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '5px 12px' }}>
                  Seleccionar
                </button>
              )
            )}
          </div>
          <p style={{ fontSize: 12, color: '#bbb', margin: '0 0 12px' }}>
            Se registran automáticamente al abrir la tienda desde un dispositivo
          </p>

          {selectMode && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#fff7f7', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{selectedDevices.size} seleccionado(s)</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setSelectedDevices(new Set(devices.map(d => d.id)))} style={{ background: '#fff', border: '1px solid #e2e2e2', borderRadius: 8, color: '#555', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '6px 10px' }}>Todos</button>
                <button onClick={deleteSelectedDevices} disabled={selectedDevices.size === 0 || deletingDevices} style={{ background: selectedDevices.size === 0 ? '#f3f3f3' : '#ef4444', border: 'none', borderRadius: 8, color: selectedDevices.size === 0 ? '#bbb' : '#fff', fontSize: 12, fontWeight: 800, cursor: selectedDevices.size === 0 ? 'default' : 'pointer', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FontAwesomeIcon icon={faTrash} /> {deletingDevices ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          )}

          {devices.length === 0 ? (
            <div style={{ background: '#fafafa', border: '1.5px dashed #e0e0e0', borderRadius: 14, padding: '28px 24px', textAlign: 'center' }}>
              <FontAwesomeIcon icon={faTabletAlt} style={{ fontSize: 28, color: '#ddd', marginBottom: 10 }} />
              <p style={{ color: '#bbb', fontSize: 13, margin: 0 }}>Ningún dispositivo conectado.<br />Abre la tienda desde un tablet o computador.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {devices.map(device => (
                <DeviceCard key={device.id} device={device} configs={configs} onSave={saveDevice} saving={savingDevice === device.id} selectMode={selectMode} selected={selectedDevices.has(device.id)} onSelectToggle={toggleDeviceSelect} />
              ))}
            </div>
          )}
        </div>

       </div>{/* ── fin grid ── */}
      </div>
    </>
  );
}
