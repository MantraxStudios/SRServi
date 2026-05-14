import { useEffect, useState } from 'react';
import { useStore } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBrain, faToggleOn, faToggleOff, faPlay, faHistory,
  faTag, faBell, faSmile, faSave, faChartLine, faCheckCircle,
  faExclamationTriangle, faInfoCircle, faSpinner
} from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#D4AF37';

const ACTION_ICONS = {
  brain_run: faChartLine,
  coupon_created: faTag,
  coupon_skipped: faTag,
  coupon_error: faExclamationTriangle,
  worker_reminder_sent: faBell,
  worker_reminder_skipped: faBell,
  morale_sent: faSmile,
  brain_error: faExclamationTriangle,
  default: faInfoCircle
};

const ACTION_COLORS = {
  coupon_created: '#22c55e',
  coupon_error: '#ef4444',
  worker_reminder_sent: '#3b82f6',
  morale_sent: GOLD,
  brain_error: '#ef4444',
  brain_run: '#a78bfa',
  default: '#9ca3af'
};

export default function Autonomous() {
  const { selectedStore } = useStore() || {};
  const { token } = useAuth();

  const [config, setConfig] = useState({
    enabled: false, auto_promotions: true, worker_reminders: true,
    morale_messages: true, promotion_threshold: 20, sender_name: 'El Administrador'
  });
  const [log, setLog] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [running, setRunning] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const storeId = selectedStore?.id;

  useEffect(() => {
    if (!storeId || !token) return;
    setLoadingConfig(true);
    Promise.all([
      fetch(`${API}/api/brain/config?store_id=${storeId}`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      fetch(`${API}/api/brain/log?store_id=${storeId}`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
    ]).then(([cfg, lg]) => {
      if (cfg && !cfg.error) setConfig(cfg);
      if (Array.isArray(lg)) setLog(lg);
    }).finally(() => setLoadingConfig(false));
  }, [storeId, token]);

  const saveConfig = async () => {
    setSavingConfig(true); setSaveMsg('');
    try {
      const res = await fetch(`${API}/api/brain/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ ...config, store_id: storeId })
      });
      const data = await res.json();
      if (res.ok) { setConfig(data); setSaveMsg('✔ Guardado'); }
      else setSaveMsg('Error: ' + (data.error || 'intenta de nuevo'));
    } catch { setSaveMsg('Error de conexión'); }
    finally { setSavingConfig(false); setTimeout(() => setSaveMsg(''), 3000); }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      await fetch(`${API}/api/brain/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ store_id: storeId })
      });
      setTimeout(() => {
        fetch(`${API}/api/brain/log?store_id=${storeId}`, { headers: { Authorization: 'Bearer ' + token } })
          .then(r => r.json()).then(lg => { if (Array.isArray(lg)) setLog(lg); });
        setRunning(false);
      }, 8000);
    } catch { setRunning(false); }
  };

  const toggle = (key) => setConfig(prev => ({ ...prev, [key]: !prev[key] }));

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (loadingConfig) return <div className="loading">Cargando SRBrain...</div>;

  const card = { background: '#fff', border: '1px solid #ebebeb', borderRadius: 14, padding: '22px 24px', marginBottom: 20 };
  const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 };
  const input = { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e2e2', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' };

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#faf7ee', border: `2px solid ${GOLD}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FontAwesomeIcon icon={faBrain} style={{ color: GOLD, fontSize: 20 }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111' }}>SRBrain — Sistema Autónomo</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Analiza tu negocio diariamente y actúa en forma automática</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button
            onClick={runNow}
            disabled={running}
            style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: GOLD, color: '#000', fontWeight: 700, fontSize: 13, cursor: running ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: running ? 0.7 : 1 }}>
            <FontAwesomeIcon icon={running ? faSpinner : faPlay} spin={running} />
            {running ? 'Ejecutando...' : 'Ejecutar ahora'}
          </button>
        </div>
      </div>

      {/* Master toggle */}
      <div style={{ ...card, background: config.enabled ? '#faf7ee' : '#fff', border: `1.5px solid ${config.enabled ? GOLD : '#ebebeb'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>SRBrain Activado</div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 3 }}>
              {config.enabled ? '✅ El sistema analiza y actúa automáticamente cada día a las 8:00 AM' : 'El sistema está desactivado. Actívalo para comenzar.'}
            </div>
          </div>
          <button onClick={() => toggle('enabled')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 30, color: config.enabled ? GOLD : '#ccc' }}>
            <FontAwesomeIcon icon={config.enabled ? faToggleOn : faToggleOff} />
          </button>
        </div>
        {config.last_run_at && (
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 10 }}>
            Última ejecución: {formatDate(config.last_run_at)}
          </div>
        )}
      </div>

      {/* Módulos */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 18 }}>Módulos</div>
        {[
          { key: 'auto_promotions', icon: faTag, label: 'Promociones automáticas', desc: `Crea cupones cuando las ventas del mes están por debajo del promedio` },
          { key: 'worker_reminders', icon: faBell, label: 'Recordatorios a trabajadores', desc: 'Envía SMS a trabajadores que no completaron sus tareas' },
          { key: 'morale_messages', icon: faSmile, label: 'Mensajes de ánimo diarios', desc: 'Envía mensajes motivadores cada mañana a todo el equipo' },
        ].map(mod => (
          <div key={mod.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f5f5f5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesomeIcon icon={mod.icon} style={{ color: '#666', fontSize: 15 }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{mod.label}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{mod.desc}</div>
              </div>
            </div>
            <button onClick={() => toggle(mod.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: config[mod.key] ? GOLD : '#ccc' }}>
              <FontAwesomeIcon icon={config[mod.key] ? faToggleOn : faToggleOff} />
            </button>
          </div>
        ))}
      </div>

      {/* Configuración */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 18 }}>Configuración</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={label}>Nombre del remitente</label>
            <input style={input} value={config.sender_name || ''} onChange={e => setConfig(p => ({ ...p, sender_name: e.target.value }))} placeholder="El Administrador" />
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Los mensajes llegarán firmados con este nombre</div>
          </div>
          <div>
            <label style={label}>Umbral de promoción (%)</label>
            <input style={input} type="number" min="5" max="50" value={config.promotion_threshold || 20}
              onChange={e => setConfig(p => ({ ...p, promotion_threshold: parseInt(e.target.value) || 20 }))} />
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Crear cupón si las ventas están X% por debajo del promedio</div>
          </div>
        </div>

        <div style={{ background: '#fffbe6', border: '1px solid #ffe066', borderRadius: 8, padding: '12px 14px', marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#7a5c00', marginBottom: 4 }}>📱 SMS via Twilio</div>
          <div style={{ fontSize: 12, color: '#7a5c00' }}>
            Para enviar SMS configura las variables de entorno: <strong>TWILIO_ACCOUNT_SID</strong>, <strong>TWILIO_AUTH_TOKEN</strong>, <strong>TWILIO_PHONE_NUMBER</strong>.
            Los trabajadores deben tener su teléfono registrado en la sección <strong>Trabajadores</strong>.
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={saveConfig} disabled={savingConfig}
            style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={savingConfig ? faSpinner : faSave} spin={savingConfig} />
            {savingConfig ? 'Guardando...' : 'Guardar configuración'}
          </button>
          {saveMsg && <span style={{ fontSize: 13, color: saveMsg.startsWith('✔') ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{saveMsg}</span>}
        </div>
      </div>

      {/* Activity Log */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <FontAwesomeIcon icon={faHistory} style={{ color: '#888' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Historial de actividad</div>
        </div>
        {log.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#bbb', padding: '30px 0', fontSize: 14 }}>
            No hay actividad registrada aún.<br />
            <span style={{ fontSize: 12 }}>Activa SRBrain y ejecuta el primer ciclo.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {log.map(entry => {
              const icon = ACTION_ICONS[entry.action_type] || ACTION_ICONS.default;
              const color = ACTION_COLORS[entry.action_type] || ACTION_COLORS.default;
              return (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid #f8f8f8' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FontAwesomeIcon icon={icon} style={{ color, fontSize: 12 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#333', lineHeight: 1.4 }}>{entry.description}</div>
                    <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>{formatDate(entry.created_at)} · {entry.action_type}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
