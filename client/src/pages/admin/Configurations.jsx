import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMoneyBillWave, faCreditCard, faUtensils, faShoppingBag,
  faHashtag, faPercent, faTruck, faTabletAlt, faClock,
  faCheck, faExclamationTriangle, faSave, faSync, faPlus,
  faChevronDown, faChevronUp
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

function Toggle({ active, onClick, icon, label, sub, color = '#16a34a', activeBg = '#f0fdf4' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        borderRadius: 10, cursor: 'pointer', width: '100%', textAlign: 'left',
        border: `2px solid ${active ? color : '#e8e8e8'}`,
        background: active ? activeBg : '#fafafa',
        transition: 'all 0.15s'
      }}
    >
      <FontAwesomeIcon icon={icon} style={{ fontSize: 18, color: active ? color : '#ccc', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: active ? '#111' : '#888' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        border: `2px solid ${active ? color : '#ddd'}`,
        background: active ? color : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        {active && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 9, color: '#fff' }} />}
      </div>
    </button>
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
      borderRadius: 14, overflow: 'hidden', marginBottom: 12,
      background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.04)'
    }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer',
          borderBottom: open ? '1px solid #f0f0f0' : 'none'
        }}
      >
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: form.is_active ? '#22c55e' : '#e5e7eb', flexShrink: 0
        }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: '#111', flex: 1, textAlign: 'left' }}>
          {form.name}
        </span>
        {isDefault && (
          <span style={{ fontSize: 11, background: '#faf7ee', color: '#92400e', border: `1px solid ${GOLD}`, borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>
            Predeterminada
          </span>
        )}
        <FontAwesomeIcon icon={open ? faChevronUp : faChevronDown} style={{ color: '#aaa', fontSize: 12 }} />
      </button>

      {open && (
        <div style={{ padding: '18px 18px 20px' }}>
          {/* Payment methods */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Métodos de pago
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Toggle active={form.accept_cash} onClick={() => set('accept_cash', !form.accept_cash)}
                icon={faMoneyBillWave} label="Efectivo" sub="Pago en caja" color="#16a34a" activeBg="#f0fdf4" />
              <Toggle active={form.accept_card} onClick={() => set('accept_card', !form.accept_card)}
                icon={faCreditCard} label="Tarjeta / POS" sub="Débito · Crédito · QR" color="#2563eb" activeBg="#eff6ff" />
            </div>
            {!form.accept_cash && !form.accept_card && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 5 }}>
                <FontAwesomeIcon icon={faExclamationTriangle} /> Activa al menos un método de pago
              </p>
            )}
          </div>

          {/* Order types */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Tipo de pedido
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Toggle active={form.allow_serve} onClick={() => set('allow_serve', !form.allow_serve)}
                icon={faUtensils} label="Comer aquí" sub="Servir en mesa" color="#16a34a" activeBg="#f0fdf4" />
              <Toggle active={form.allow_takeout} onClick={() => set('allow_takeout', !form.allow_takeout)}
                icon={faShoppingBag} label="Para llevar" sub="Pedido para llevar" color="#2563eb" activeBg="#eff6ff" />
            </div>
          </div>

          {/* Extras */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Opciones adicionales
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Toggle active={form.hide_decimals} onClick={() => set('hide_decimals', !form.hide_decimals)}
                icon={faHashtag} label="Ocultar decimales (.00)" sub="Los precios enteros no mostrarán centavos" color="#475569" activeBg="#f8fafc" />
              <Toggle active={form.allow_table_service} onClick={() => set('allow_table_service', !form.allow_table_service)}
                icon={faHashtag} label="Llevar a mesa" sub="Pedir número de mesa al confirmar pago" color="#b45309" activeBg="#fffdf0" />

              {/* Tip */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderRadius: 10, border: `2px solid ${form.tip_percentage > 0 ? '#059669' : '#e8e8e8'}`,
                background: form.tip_percentage > 0 ? '#f0fdf4' : '#fafafa'
              }}>
                <FontAwesomeIcon icon={faPercent} style={{ fontSize: 18, color: form.tip_percentage > 0 ? '#059669' : '#ccc', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: form.tip_percentage > 0 ? '#111' : '#888' }}>Propina sugerida</div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>0 = sin propina</div>
                </div>
                <input
                  type="number" min="0" max="100" step="1" value={form.tip_percentage}
                  onChange={e => set('tip_percentage', Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                  style={{ width: 56, padding: '6px 8px', border: '2px solid #e0e0e0', borderRadius: 8, fontSize: 14, fontWeight: 700, textAlign: 'center' }}
                />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#666' }}>%</span>
              </div>

              {/* QR delivery */}
              <Toggle active={form.delivery_enabled} onClick={() => set('delivery_enabled', !form.delivery_enabled)}
                icon={faTruck} label="Pedidos por QR" sub="Permite pedidos desde el teléfono del cliente" color="#b45309" activeBg="#fffdf0" />
            </div>
          </div>

          {/* Active / Default toggles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            <Toggle active={form.is_active} onClick={() => set('is_active', !form.is_active)}
              icon={faCheck} label="Activa" color="#16a34a" activeBg="#f0fdf4" />
            <Toggle active={form.is_default} onClick={() => set('is_default', !form.is_default)}
              icon={faCheck} label="Predeterminada" color="#7c3aed" activeBg="#f5f3ff" />
          </div>

          <button
            type="button"
            disabled={saving || (!dirty && config.id)}
            onClick={() => onSave(form)}
            style={{
              width: '100%', padding: '12px', borderRadius: 10, border: 'none',
              background: dirty ? '#111' : '#f0f0f0',
              color: dirty ? '#fff' : '#aaa',
              fontWeight: 700, fontSize: 14, cursor: dirty ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
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
      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: online ? '#f0fdf4' : '#f5f5f5',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <FontAwesomeIcon icon={faTabletAlt} style={{ fontSize: 18, color: online ? '#16a34a' : '#aaa' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: online ? '#22c55e' : '#d1d5db',
              display: 'inline-block', flexShrink: 0
            }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{device.label || 'Sin nombre'}</span>
            {online && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>En línea</span>}
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
            Último acceso: {formatDate(device.last_seen)}
          </div>
        </div>
      </div>

      {/* Edit fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#888', display: 'block', marginBottom: 4 }}>NOMBRE DEL DISPOSITIVO</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Ej: Tótem entrada, Caja 1..."
            style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e2e2', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#888', display: 'block', marginBottom: 4 }}>CONFIGURACIÓN</label>
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
            <label style={{ fontSize: 11, fontWeight: 700, color: '#888', display: 'block', marginBottom: 4 }}>
              <FontAwesomeIcon icon={faClock} style={{ marginRight: 4 }} />REINICIO (segundos)
            </label>
            <input
              type="number" min="0" value={restartTime} onChange={e => setRestartTime(e.target.value)}
              placeholder="0 = sin reinicio"
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
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7
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

      <div className="admin-main" style={{ maxWidth: 680 }}>

        {/* ── SECCIÓN 1: Configuración de pago ── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>
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
                <ConfigCard
                  key={defaultConfig.id}
                  config={defaultConfig}
                  isDefault={true}
                  onSave={saveConfig}
                  saving={savingConfig}
                />
              )}
              {otherConfigs.map(cfg => (
                <ConfigCard
                  key={cfg.id}
                  config={cfg}
                  isDefault={false}
                  onSave={saveConfig}
                  saving={savingConfig}
                />
              ))}

              {/* Add config */}
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

        {/* ── SECCIÓN 2: Tótems ── */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>
            Tótems registrados
          </div>
          <p style={{ fontSize: 12, color: '#bbb', margin: '0 0 12px' }}>
            Se registran automáticamente al abrir la tienda desde un dispositivo
          </p>

          {devices.length === 0 ? (
            <div style={{ background: '#fafafa', border: '1.5px dashed #e0e0e0', borderRadius: 14, padding: '28px 24px', textAlign: 'center' }}>
              <FontAwesomeIcon icon={faTabletAlt} style={{ fontSize: 32, color: '#ddd', marginBottom: 10 }} />
              <p style={{ color: '#bbb', fontSize: 13, margin: 0 }}>Ningún dispositivo conectado aún.<br />Abre la tienda desde un tablet o computador para que aparezca aquí.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {devices.map(device => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  configs={configs}
                  onSave={saveDevice}
                  saving={savingDevice === device.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
