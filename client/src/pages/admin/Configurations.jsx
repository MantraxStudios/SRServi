import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMoneyBillWave, faCreditCard, faUtensils, faShoppingBag,
  faHashtag, faPercent, faTruck, faTabletAlt, faClock,
  faCheck, faExclamationTriangle, faSave, faSync, faPlus,
  faChevronDown, faChevronUp, faTableCells
} from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#D4AF37';

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
  delivery_payment_methods: 'tuu,mercadopago'
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

          <SectionLabel>Extras</SectionLabel>
          <Row icon={faHashtag} label="Ocultar decimales" sub="Los precios enteros no muestran .00" active={form.hide_decimals} onToggle={() => set('hide_decimals', !form.hide_decimals)} />

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

function DeviceCard({ device, configs, onSave, saving }) {
  const [label, setLabel] = useState(device.label || '');
  const [configId, setConfigId] = useState(device.config_id || '');
  const [restartTime, setRestartTime] = useState(device.restart_time || '');
  const dirty = label !== (device.label || '') || String(configId) !== String(device.config_id || '') || String(restartTime) !== String(device.restart_time || '');

  const online = device.last_seen && (new Date() - new Date(device.last_seen)) < 300000;
  const formatDate = (d) => {
    if (!d) return 'Nunca';
    const diff = Math.floor((new Date() - new Date(d)) / 60000);
    if (diff < 1) return 'Ahora';
    if (diff < 60) return `Hace ${diff}m`;
    if (diff < 1440) return `Hace ${Math.floor(diff / 60)}h`;
    return new Date(d).toLocaleDateString('es-CL');
  };

  return (
    <div style={{
      background: '#fff', border: `1.5px solid ${online ? '#bbf7d0' : '#e8e8e8'}`,
      borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.04)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9, flexShrink: 0,
          background: online ? '#f0fdf4' : '#f5f5f5',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <FontAwesomeIcon icon={faTabletAlt} style={{ fontSize: 17, color: online ? '#16a34a' : '#bbb' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: online ? '#22c55e' : '#d1d5db', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{device.label || 'Sin nombre'}</span>
            {online && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>En línea</span>}
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>Último acceso: {formatDate(device.last_seen)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nombre</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Ej: Tótem entrada, Caja 1..."
            style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e2e2', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Configuración</label>
            <select
              value={configId}
              onChange={e => setConfigId(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e2e2', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
            >
              <option value="">Predeterminada</option>
              {configs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <FontAwesomeIcon icon={faClock} style={{ marginRight: 4 }} />Reinicio (seg)
            </label>
            <input
              type="number" min="0" value={restartTime} onChange={e => setRestartTime(e.target.value)}
              placeholder="0 = desactivado"
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e2e2', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
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
            transition: 'background 0.15s'
          }}
        >
          <FontAwesomeIcon icon={saving ? faSync : faSave} spin={saving} />
          {saving ? 'Guardando...' : dirty ? 'Guardar' : 'Sin cambios'}
        </button>
      </div>
    </div>
  );
}

export default function Configurations() {
  const { selectedStore } = useStore();
  const [configs, setConfigs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingDevice, setSavingDevice] = useState(null);
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [newConfigName, setNewConfigName] = useState('');

  useEffect(() => {
    if (selectedStore) loadAll();
    else { setLoading(false); setConfigs([]); setDevices([]); }
  }, [selectedStore]);

  const loadAll = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const [cfgRes, devRes] = await Promise.all([
      fetch(`/api/store-configurations?store_id=${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(API + `/api/store-devices?store_id=${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } })
    ]);
    const cfgData = await cfgRes.json();
    const devData = devRes.ok ? await devRes.json() : [];
    setConfigs(Array.isArray(cfgData) ? cfgData : []);
    setDevices(Array.isArray(devData) ? devData : []);
    setLoading(false);
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

      <div className="admin-main" style={{ maxWidth: 560 }}>

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

        {/* Tótems */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>
            Tótems registrados
          </div>
          <p style={{ fontSize: 12, color: '#bbb', margin: '0 0 12px' }}>
            Se registran automáticamente al abrir la tienda desde un dispositivo
          </p>

          {devices.length === 0 ? (
            <div style={{ background: '#fafafa', border: '1.5px dashed #e0e0e0', borderRadius: 14, padding: '28px 24px', textAlign: 'center' }}>
              <FontAwesomeIcon icon={faTabletAlt} style={{ fontSize: 28, color: '#ddd', marginBottom: 10 }} />
              <p style={{ color: '#bbb', fontSize: 13, margin: 0 }}>Ningún dispositivo conectado.<br />Abre la tienda desde un tablet o computador.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {devices.map(device => (
                <DeviceCard key={device.id} device={device} configs={configs} onSave={saveDevice} saving={savingDevice === device.id} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
