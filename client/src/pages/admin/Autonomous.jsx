import { useEffect, useState } from 'react';
import { useStore } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router-dom';
import {
  faRobot, faToggleOn, faToggleOff, faPlay, faHistory,
  faTag, faBell, faSmile, faSave, faChartLine,
  faExclamationTriangle, faInfoCircle, faSpinner, faArrowRight
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
  const [waStatus, setWaStatus] = useState(null);

  const storeId = selectedStore?.id;

  useEffect(() => {
    if (!storeId || !token) return;
    setLoadingConfig(true);
    Promise.all([
      fetch(`${API}/api/brain/config?store_id=${storeId}`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      fetch(`${API}/api/brain/log?store_id=${storeId}`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      fetch(`${API}/api/whatsapp/status`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()).catch(() => null),
    ]).then(([cfg, lg, wa]) => {
      if (cfg && !cfg.error) setConfig(cfg);
      if (Array.isArray(lg)) setLog(lg);
      setWaStatus(wa);
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

  if (loadingConfig) return <div className="loading">Cargando León IA...</div>;

  const card = { background: '#fff', border: '1px solid #ebebeb', borderRadius: 14, padding: '22px 24px', marginBottom: 20 };
  const label = { display: 'block', fontSize: 12, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 };
  const input = { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e2e2', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' };

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <FontAwesomeIcon icon={faRobot} style={{ color: GOLD, fontSize: 22 }} />
          <span style={{ position: 'absolute', top: -5, right: -5, background: GOLD, color: '#000', fontSize: 8, fontWeight: 900, borderRadius: 4, padding: '1px 4px', letterSpacing: '0.5px' }}>AUTO</span>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
            León IA <span style={{ fontSize: 13, fontWeight: 600, color: '#888' }}>— Modo Autónomo</span>
          </h1>
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
      <div style={{ ...card, background: config.enabled ? '#0a0a0a' : '#fff', border: `1.5px solid ${config.enabled ? GOLD : '#ebebeb'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: config.enabled ? '#fff' : '#111' }}>León IA Autónomo</div>
            <div style={{ fontSize: 13, color: config.enabled ? 'rgba(255,255,255,0.55)' : '#666', marginTop: 3 }}>
              {config.enabled ? '✅ Analizando y actuando automáticamente cada día a las 8:00 AM' : 'Desactivado. Actívalo para que León IA opere solo cada mañana.'}
            </div>
          </div>
          <button onClick={() => toggle('enabled')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 30, color: config.enabled ? GOLD : '#ccc', flexShrink: 0 }}>
            <FontAwesomeIcon icon={config.enabled ? faToggleOn : faToggleOff} />
          </button>
        </div>
        {config.last_run_at && (
          <div style={{ fontSize: 11, color: config.enabled ? 'rgba(255,255,255,0.35)' : '#aaa', marginTop: 10 }}>
            Última ejecución: {formatDate(config.last_run_at)}
          </div>
        )}
      </div>

      {/* Módulos */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 18 }}>Módulos</div>
        {[
          { key: 'auto_promotions', icon: faTag, label: 'Promociones automáticas', desc: `Crea cupones cuando las ventas del mes están por debajo del promedio` },
          { key: 'worker_reminders', icon: faBell, label: 'Recordatorios a trabajadores', desc: 'Envía WhatsApp a trabajadores que no completaron sus tareas' },
          { key: 'morale_messages', icon: faSmile, label: 'Mensajes de ánimo diarios', desc: 'Envía mensajes motivadores cada mañana por WhatsApp' },
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

        {/* WhatsApp status */}
        {waStatus?.connected ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px', marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#22c55e"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>WhatsApp conectado</span>
              <span style={{ fontSize: 12, color: '#15803d', marginLeft: 8 }}>— Los mensajes se enviarán automáticamente</span>
            </div>
            <Link to="/admin/whatsapp" style={{ fontSize: 12, color: '#15803d', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              Configurar <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 10 }} />
            </Link>
          </div>
        ) : (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#ef4444"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>WhatsApp no conectado</span>
              <span style={{ fontSize: 12, color: '#b91c1c', marginLeft: 8 }}>— Los mensajes no se enviarán hasta conectar</span>
            </div>
            <Link to="/admin/whatsapp" style={{ fontSize: 12, color: '#dc2626', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              Conectar <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 10 }} />
            </Link>
          </div>
        )}

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
            <span style={{ fontSize: 12 }}>Activa León IA y ejecuta el primer ciclo.</span>
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
