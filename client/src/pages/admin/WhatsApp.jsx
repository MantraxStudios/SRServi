import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle, faTimesCircle, faSpinner,
  faPaperPlane, faUnlink, faLink, faSync,
  faCalendarPlus, faClock, faTrash, faUsers, faUser, faRepeat, faUserGroup,
  faRobot, faToggleOn, faToggleOff, faPlay, faHistory,
  faTag, faBell, faSmile, faSave, faChartLine, faExclamationTriangle, faInfoCircle
} from '@fortawesome/free-solid-svg-icons';

function WaIcon({ size = 24, color = '#25D366' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#D4AF37';

const BRAIN_ACTION_ICONS = {
  brain_run: faChartLine, coupon_created: faTag, coupon_skipped: faTag,
  coupon_error: faExclamationTriangle, worker_reminder_sent: faBell,
  worker_reminder_skipped: faBell, morale_sent: faSmile,
  brain_error: faExclamationTriangle, default: faInfoCircle
};
const BRAIN_ACTION_COLORS = {
  coupon_created: '#22c55e', coupon_error: '#ef4444',
  worker_reminder_sent: '#3b82f6', morale_sent: GOLD,
  brain_error: '#ef4444', brain_run: '#a78bfa', default: '#9ca3af'
};

const STATUS_LABEL = {
  pending: { label: 'Pendiente', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  sent: { label: 'Enviado', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  failed: { label: 'Fallido', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  cancelled: { label: 'Cancelado', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
};

function formatDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
}

function localDatetimeValue() {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

function WhatsApp() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const pollRef = useRef(null);

  // Stores & workers for scheduling
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [workers, setWorkers] = useState([]);
  const [workersLoading, setWorkersLoading] = useState(false);

  // Schedule form
  const [recipientType, setRecipientType] = useState('all');
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [schedMsg, setSchedMsg] = useState('');
  const [schedAt, setSchedAt] = useState(localDatetimeValue());
  const [recurrence, setRecurrence] = useState('none');
  const [schedResult, setSchedResult] = useState(null);
  const [schedLoading, setSchedLoading] = useState(false);

  // Scheduled messages list
  const [scheduled, setScheduled] = useState([]);
  const [schedListLoading, setSchedListLoading] = useState(false);

  // León IA Autónomo
  const [brainConfig, setBrainConfig] = useState({
    enabled: false, auto_promotions: true, worker_reminders: true,
    morale_messages: true, promotion_threshold: 20, sender_name: 'El Administrador'
  });
  const [brainLog, setBrainLog] = useState([]);
  const [brainConfigLoading, setBrainConfigLoading] = useState(false);
  const [brainSaving, setBrainSaving] = useState(false);
  const [brainRunning, setBrainRunning] = useState(false);
  const [brainSaveMsg, setBrainSaveMsg] = useState('');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchStatus = async (storeId) => {
    const sid = storeId || selectedStore;
    if (!sid) { setLoading(false); return; }
    try {
      const res = await fetch(`${API}/api/whatsapp/status?store_id=${sid}`, { headers });
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const res = await fetch(`${API}/api/stores`, { headers });
      const data = await res.json();
      if (Array.isArray(data)) {
        setStores(data);
        if (data.length > 0 && !selectedStore) {
          const firstId = String(data[0].id);
          setSelectedStore(firstId);
          fetchStatus(firstId);
        }
      }
    } catch {}
  };

  const fetchGroups = async (storeId) => {
    if (!storeId) return;
    setGroupsLoading(true);
    setSelectedGroups([]);
    try {
      const res = await fetch(`${API}/api/whatsapp/groups?store_id=${storeId}`, { headers });
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } catch {
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  };

  const fetchWorkers = async (storeId) => {
    if (!storeId) return;
    setWorkersLoading(true);
    setSelectedWorkers([]);
    try {
      const res = await fetch(`${API}/api/workers?store_id=${storeId}`, { headers });
      const data = await res.json();
      setWorkers(Array.isArray(data) ? data : []);
    } catch {
      setWorkers([]);
    } finally {
      setWorkersLoading(false);
    }
  };

  const fetchScheduled = async () => {
    setSchedListLoading(true);
    try {
      const res = await fetch(`${API}/api/whatsapp/scheduled`, { headers });
      const data = await res.json();
      setScheduled(Array.isArray(data) ? data : []);
    } catch {
      setScheduled([]);
    } finally {
      setSchedListLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
    fetchScheduled();
  }, []);

  useEffect(() => {
    if (!selectedStore) return;
    setLoading(true);
    setStatus(null);
    fetchStatus(selectedStore);
    fetchWorkers(selectedStore);
    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchStatus(selectedStore), 4000);
    return () => clearInterval(pollRef.current);
  }, [selectedStore]);

  useEffect(() => {
    if (!selectedStore) return;
    setBrainConfigLoading(true);
    Promise.all([
      fetch(`${API}/api/brain/config?store_id=${selectedStore}`, { headers }).then(r => r.json()),
      fetch(`${API}/api/brain/log?store_id=${selectedStore}`, { headers }).then(r => r.json()),
    ]).then(([cfg, lg]) => {
      if (cfg && !cfg.error) setBrainConfig(cfg);
      if (Array.isArray(lg)) setBrainLog(lg);
    }).finally(() => setBrainConfigLoading(false));
  }, [selectedStore]);

  const handleConnect = async () => {
    if (!selectedStore) return;
    setActionLoading(true);
    await fetch(`${API}/api/whatsapp/connect`, {
      method: 'POST', headers,
      body: JSON.stringify({ store_id: parseInt(selectedStore) })
    });
    setActionLoading(false);
    fetchStatus(selectedStore);
  };

  const handleDisconnect = async () => {
    if (!selectedStore) return;
    if (!confirm('¿Desconectar WhatsApp? Se eliminará la sesión guardada.')) return;
    setActionLoading(true);
    await fetch(`${API}/api/whatsapp/disconnect`, {
      method: 'POST', headers,
      body: JSON.stringify({ store_id: parseInt(selectedStore) })
    });
    setActionLoading(false);
    fetchStatus(selectedStore);
  };

  const handleReconnect = async () => {
    if (!selectedStore) return;
    setActionLoading(true);
    setStatus(prev => ({ ...prev, hasQR: false, qr: null, connecting: true }));
    await fetch(`${API}/api/whatsapp/reconnect`, {
      method: 'POST', headers,
      body: JSON.stringify({ store_id: parseInt(selectedStore) })
    });
    setActionLoading(false);
    // Esperar un momento y luego empezar a hacer polling hasta ver el nuevo QR
    setTimeout(() => fetchStatus(selectedStore), 2000);
  };

  const toggleWorker = (id) => {
    setSelectedWorkers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleGroup = (jid) => {
    setSelectedGroups(prev =>
      prev.includes(jid) ? prev.filter(x => x !== jid) : [...prev, jid]
    );
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    setSchedResult(null);
    setSchedLoading(true);
    try {
      let recipients;
      if (recipientType === 'all') {
        recipients = { type: 'all' };
      } else if (recipientType === 'specific') {
        recipients = { type: 'specific', worker_ids: selectedWorkers };
      } else {
        recipients = { type: 'groups', group_jids: selectedGroups };
      }

      if (recipientType === 'specific' && selectedWorkers.length === 0) {
        setSchedResult({ ok: false, msg: 'Selecciona al menos un trabajador' });
        setSchedLoading(false);
        return;
      }
      if (recipientType === 'groups' && selectedGroups.length === 0) {
        setSchedResult({ ok: false, msg: 'Selecciona al menos un grupo' });
        setSchedLoading(false);
        return;
      }

      const res = await fetch(`${API}/api/whatsapp/scheduled`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          store_id: parseInt(selectedStore),
          message: schedMsg,
          recipients,
          scheduled_at: schedAt,
          recurrence
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSchedResult({ ok: true, msg: 'Mensaje programado correctamente' });
        setSchedMsg('');
        setSchedAt(localDatetimeValue());
        setSelectedWorkers([]);
        setSelectedGroups([]);
        setRecipientType('all');
        setRecurrence('none');
        fetchScheduled();
      } else {
        setSchedResult({ ok: false, msg: data.error });
      }
    } catch (e) {
      setSchedResult({ ok: false, msg: e.message });
    } finally {
      setSchedLoading(false);
    }
  };

  const saveBrainConfig = async () => {
    setBrainSaving(true); setBrainSaveMsg('');
    try {
      const res = await fetch(`${API}/api/brain/config`, {
        method: 'POST', headers,
        body: JSON.stringify({ ...brainConfig, store_id: parseInt(selectedStore) })
      });
      const data = await res.json();
      if (res.ok) { setBrainConfig(data); setBrainSaveMsg('✔ Guardado'); }
      else setBrainSaveMsg('Error: ' + (data.error || 'intenta de nuevo'));
    } catch { setBrainSaveMsg('Error de conexión'); }
    finally { setBrainSaving(false); setTimeout(() => setBrainSaveMsg(''), 3000); }
  };

  const runBrainNow = async () => {
    setBrainRunning(true);
    try {
      await fetch(`${API}/api/brain/run`, {
        method: 'POST', headers,
        body: JSON.stringify({ store_id: parseInt(selectedStore) })
      });
      setTimeout(() => {
        fetch(`${API}/api/brain/log?store_id=${selectedStore}`, { headers })
          .then(r => r.json()).then(lg => { if (Array.isArray(lg)) setBrainLog(lg); });
        setBrainRunning(false);
      }, 8000);
    } catch { setBrainRunning(false); }
  };

  const brainToggle = (key) => setBrainConfig(prev => ({ ...prev, [key]: !prev[key] }));

  const formatBrainDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const handleCancel = async (id) => {
    if (!confirm('¿Cancelar este mensaje programado?')) return;
    await fetch(`${API}/api/whatsapp/scheduled/${id}`, { method: 'DELETE', headers });
    fetchScheduled();
  };

  const statusColor = status?.connected ? '#22c55e' : status?.hasQR ? '#f59e0b' : '#ef4444';
  const statusText = status?.connected ? 'Conectado' : status?.hasQR ? 'Esperando escaneo QR' : status?.connecting ? 'Conectando...' : 'Desconectado';
  const statusIcon = status?.connected ? faCheckCircle : status?.hasQR || status?.connecting ? faSpinner : faTimesCircle;

  const card = {
    background: '#fff', borderRadius: 14, border: '1px solid #f0f0f0',
    padding: '24px 28px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,.05)'
  };

  return (
    <>
      <header className="admin-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <WaIcon size={26} />
            WhatsApp
          </h1>
          <p className="text-sm text-muted">Conecta WhatsApp y programa mensajes para tus trabajadores</p>
        </div>
      </header>

      <div className="admin-main" style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Store selector — controls which store's WA session is shown */}
        {stores.length > 1 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Tienda activa</label>
            <select
              value={selectedStore}
              onChange={e => setSelectedStore(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
                borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff', cursor: 'pointer'
              }}
            >
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {/* Status card */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 48, height: 48, background: '#f0fdf4', borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <WaIcon size={24} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Estado de conexión</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <FontAwesomeIcon
                  icon={statusIcon}
                  spin={status?.connecting || status?.hasQR}
                  style={{ color: statusColor, fontSize: 13 }}
                />
                <span style={{ fontSize: 13, color: statusColor, fontWeight: 600 }}>{statusText}</span>
              </div>
            </div>
            <button
              onClick={() => fetchStatus(selectedStore)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 14 }}
            >
              <FontAwesomeIcon icon={faSync} />
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#aaa' }}>
              <FontAwesomeIcon icon={faSpinner} spin /> Cargando...
            </div>
          ) : status?.connected ? (
            <div>
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
                padding: '12px 16px', marginBottom: 16, fontSize: 14, color: '#166534'
              }}>
                WhatsApp conectado. Los mensajes programados se enviarán por WhatsApp.
              </div>
              <button
                onClick={handleDisconnect}
                disabled={actionLoading}
                style={{
                  padding: '10px 20px', borderRadius: 8, border: '1px solid #fee2e2',
                  background: '#fff5f5', color: '#dc2626', fontWeight: 600, cursor: 'pointer', fontSize: 14
                }}
              >
                <FontAwesomeIcon icon={faUnlink} style={{ marginRight: 7 }} />
                Desconectar sesión
              </button>
            </div>
          ) : status?.hasQR ? (
            <div>
              <div style={{
                background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
                padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#92400e'
              }}>
                <strong>Escanea el código QR</strong> con tu WhatsApp.<br />
                <span style={{ fontSize: 13 }}>Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo.</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{ background: '#fff', padding: 12, borderRadius: 12, border: '2px solid #25D366' }}>
                  <img src={status.qr} alt="QR WhatsApp" style={{ width: 240, height: 240, display: 'block' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={handleReconnect}
                  disabled={actionLoading}
                  style={{
                    padding: '10px 20px', borderRadius: 8, border: 'none',
                    background: '#f59e0b', color: '#fff', fontWeight: 700,
                    cursor: actionLoading ? 'not-allowed' : 'pointer', fontSize: 14
                  }}
                >
                  {actionLoading
                    ? <><FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 7 }} />Generando...</>
                    : <><FontAwesomeIcon icon={faSync} style={{ marginRight: 7 }} />QR expiró — Generar nuevo</>
                  }
                </button>
              </div>
              <p style={{ textAlign: 'center', fontSize: 12, color: '#888', marginTop: 10 }}>
                El QR expira cada ~60 segundos. Si no puedes escanearlo, usa el botón de arriba.
              </p>
            </div>
          ) : (
            <div>
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
                padding: '12px 16px', marginBottom: 16, fontSize: 14, color: '#7f1d1d'
              }}>
                Sin conexión. Haz clic en "Conectar", escanea el QR con tu WhatsApp y listo.
              </div>
              <button
                onClick={handleConnect}
                disabled={actionLoading}
                style={{
                  padding: '12px 24px', borderRadius: 8, border: 'none',
                  background: '#25D366', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 15
                }}
              >
                {actionLoading
                  ? <><FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 7 }} />Conectando...</>
                  : <><FontAwesomeIcon icon={faLink} style={{ marginRight: 7 }} />Conectar WhatsApp</>
                }
              </button>
            </div>
          )}
        </div>

        {/* Schedule message form */}
        <div style={card}>
          <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={faCalendarPlus} style={{ color: '#25D366' }} />
            Programar mensaje
          </h3>

          <form onSubmit={handleSchedule}>
            {/* Store selector — only show inline if only 1 store (top selector hidden in that case) */}
            {stores.length === 1 && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Tienda</label>
                <select
                  value={selectedStore}
                  onChange={e => setSelectedStore(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
                    borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    background: '#fff', cursor: 'pointer'
                  }}
                >
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Recipients */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Destinatarios</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                {[
                  { type: 'all', icon: faUsers, label: 'Todos los trabajadores' },
                  { type: 'specific', icon: faUser, label: 'Trabajadores' },
                  { type: 'groups', icon: faUserGroup, label: 'Grupos' },
                ].map(opt => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => {
                      setRecipientType(opt.type);
                      if (opt.type === 'groups' && groups.length === 0 && status?.connected) {
                        fetchGroups(selectedStore);
                      }
                    }}
                    style={{
                      padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: `2px solid ${recipientType === opt.type ? '#25D366' : '#e5e7eb'}`,
                      background: recipientType === opt.type ? '#f0fdf4' : '#fff',
                      color: recipientType === opt.type ? '#166534' : '#6b7280'
                    }}
                  >
                    <FontAwesomeIcon icon={opt.icon} style={{ marginRight: 6 }} />
                    {opt.label}
                  </button>
                ))}
              </div>

              {recipientType === 'specific' && (
                <div style={{
                  border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 180,
                  overflowY: 'auto', padding: '4px 0'
                }}>
                  {workersLoading ? (
                    <div style={{ padding: '12px 16px', color: '#aaa', fontSize: 13 }}>
                      <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 6 }} />Cargando trabajadores...
                    </div>
                  ) : workers.length === 0 ? (
                    <div style={{ padding: '12px 16px', color: '#aaa', fontSize: 13 }}>
                      No hay trabajadores en esta tienda
                    </div>
                  ) : workers.map(w => (
                    <label key={w.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                      cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
                      background: selectedWorkers.includes(w.id) ? '#f0fdf4' : '#fff'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedWorkers.includes(w.id)}
                        onChange={() => toggleWorker(w.id)}
                        style={{ width: 15, height: 15, accentColor: '#25D366' }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{w.name}</span>
                      <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{w.username}</span>
                    </label>
                  ))}
                </div>
              )}

              {recipientType === 'groups' && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 200, overflowY: 'auto', padding: '4px 0' }}>
                  {!status?.connected ? (
                    <div style={{ padding: '12px 16px', color: '#aaa', fontSize: 13 }}>
                      Conecta WhatsApp primero para ver tus grupos
                    </div>
                  ) : groupsLoading ? (
                    <div style={{ padding: '12px 16px', color: '#aaa', fontSize: 13 }}>
                      <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 6 }} />Cargando grupos...
                    </div>
                  ) : groups.length === 0 ? (
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ color: '#aaa', fontSize: 13 }}>No se encontraron grupos</span>
                      <button
                        type="button"
                        onClick={() => fetchGroups(selectedStore)}
                        style={{ fontSize: 12, color: '#25D366', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                      >
                        <FontAwesomeIcon icon={faSync} style={{ marginRight: 4 }} />Recargar grupos
                      </button>
                    </div>
                  ) : groups.map(g => (
                    <label key={g.jid} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                      cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
                      background: selectedGroups.includes(g.jid) ? '#f0fdf4' : '#fff'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedGroups.includes(g.jid)}
                        onChange={() => toggleGroup(g.jid)}
                        style={{ width: 15, height: 15, accentColor: '#25D366' }}
                      />
                      <FontAwesomeIcon icon={faUserGroup} style={{ color: '#9ca3af', fontSize: 13 }} />
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{g.name}</span>
                      <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{g.participants} miembros</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Message */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Mensaje</label>
              <textarea
                value={schedMsg}
                onChange={e => setSchedMsg(e.target.value)}
                rows={4}
                required
                placeholder="Escribe el mensaje que quieres enviar..."
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
                  borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical',
                  boxSizing: 'border-box', fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Date/time */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                <FontAwesomeIcon icon={faClock} style={{ marginRight: 6, color: '#6b7280' }} />
                {recurrence === 'daily' ? 'Primera fecha y hora de envío' : 'Fecha y hora de envío'}
              </label>
              <input
                type="datetime-local"
                value={schedAt}
                onChange={e => setSchedAt(e.target.value)}
                required
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
                  borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Recurrence */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                <FontAwesomeIcon icon={faRepeat} style={{ marginRight: 6, color: '#6b7280' }} />
                Repetición
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setRecurrence('none')}
                  style={{
                    flex: 1, padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `2px solid ${recurrence === 'none' ? '#6366f1' : '#e5e7eb'}`,
                    background: recurrence === 'none' ? '#eef2ff' : '#fff',
                    color: recurrence === 'none' ? '#4338ca' : '#6b7280'
                  }}
                >
                  Solo una vez
                </button>
                <button
                  type="button"
                  onClick={() => setRecurrence('daily')}
                  style={{
                    flex: 1, padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `2px solid ${recurrence === 'daily' ? '#6366f1' : '#e5e7eb'}`,
                    background: recurrence === 'daily' ? '#eef2ff' : '#fff',
                    color: recurrence === 'daily' ? '#4338ca' : '#6b7280'
                  }}
                >
                  <FontAwesomeIcon icon={faRepeat} style={{ marginRight: 6 }} />
                  Todos los días a esta hora
                </button>
              </div>
              {recurrence === 'daily' && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b7280' }}>
                  Se enviará automáticamente cada día a la misma hora. Puedes cancelarlo desde la lista.
                </p>
              )}
            </div>

            {schedResult && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13,
                background: schedResult.ok ? '#f0fdf4' : '#fef2f2',
                color: schedResult.ok ? '#166534' : '#dc2626',
                border: `1px solid ${schedResult.ok ? '#bbf7d0' : '#fecaca'}`
              }}>
                <FontAwesomeIcon icon={schedResult.ok ? faCheckCircle : faTimesCircle} style={{ marginRight: 7 }} />
                {schedResult.msg}
              </div>
            )}

            <button
              type="submit"
              disabled={schedLoading || !selectedStore}
              style={{
                padding: '11px 24px', borderRadius: 8, border: 'none',
                background: schedLoading ? '#a7f3d0' : '#25D366',
                color: '#fff', fontWeight: 700, cursor: schedLoading ? 'not-allowed' : 'pointer', fontSize: 14
              }}
            >
              {schedLoading
                ? <><FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 7 }} />Programando...</>
                : <><FontAwesomeIcon icon={faCalendarPlus} style={{ marginRight: 7 }} />Programar mensaje</>
              }
            </button>
          </form>
        </div>

        {/* Scheduled messages list */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FontAwesomeIcon icon={faClock} style={{ color: '#6b7280' }} />
              Mensajes programados
            </h3>
            <button
              onClick={fetchScheduled}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 14 }}
            >
              <FontAwesomeIcon icon={faSync} />
            </button>
          </div>

          {schedListLoading ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#aaa' }}>
              <FontAwesomeIcon icon={faSpinner} spin /> Cargando...
            </div>
          ) : scheduled.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '28px 0', color: '#aaa', fontSize: 14,
              background: '#f9fafb', borderRadius: 10, border: '1px dashed #e5e7eb'
            }}>
              No hay mensajes programados
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {scheduled.map(m => {
                const st = STATUS_LABEL[m.status] || STATUS_LABEL.pending;
                const recipients = typeof m.recipients === 'string' ? JSON.parse(m.recipients) : m.recipients;
                const recipientLabel = recipients?.type === 'all'
                  ? 'Todos los trabajadores'
                  : recipients?.type === 'groups'
                    ? `${recipients?.group_jids?.length || 0} grupo(s)`
                    : `${recipients?.worker_ids?.length || 0} trabajador(es)`;
                return (
                  <div key={m.id} style={{
                    border: `1px solid ${st.border}`, borderRadius: 10,
                    padding: '14px 16px', background: st.bg
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 99,
                          fontSize: 11, fontWeight: 700, color: st.color,
                          border: `1px solid ${st.border}`, background: '#fff', marginBottom: 6
                        }}>
                          {st.label}
                        </div>
                        <p style={{
                          margin: '0 0 8px', fontSize: 14, color: '#111',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                        }}>
                          {m.message}
                        </p>
                        <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                          <span><FontAwesomeIcon icon={faClock} style={{ marginRight: 4 }} />{formatDateTime(m.scheduled_at)}</span>
                          <span>
                            <FontAwesomeIcon
                              icon={recipients?.type === 'groups' ? faUserGroup : faUsers}
                              style={{ marginRight: 4 }}
                            />
                            {recipientLabel}
                          </span>
                          {m.recurrence === 'daily' && (
                            <span style={{ color: '#4338ca' }}>
                              <FontAwesomeIcon icon={faRepeat} style={{ marginRight: 4 }} />Diario
                            </span>
                          )}
                          {m.status === 'sent' && m.sent_at && (
                            <span style={{ color: '#16a34a' }}>Enviado: {formatDateTime(m.sent_at)}</span>
                          )}
                        </div>
                      </div>
                      {m.status === 'pending' && (
                        <button
                          onClick={() => handleCancel(m.id)}
                          title="Cancelar"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#9ca3af', fontSize: 15, padding: 4, flexShrink: 0
                          }}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* León IA Autónomo */}
        <div style={{ ...card, marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: '#0a0a0a',
              display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0
            }}>
              <FontAwesomeIcon icon={faRobot} style={{ color: GOLD, fontSize: 20 }} />
              <span style={{
                position: 'absolute', top: -5, right: -5, background: GOLD, color: '#000',
                fontSize: 7, fontWeight: 900, borderRadius: 4, padding: '1px 4px', letterSpacing: '0.5px'
              }}>AUTO</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>León IA Autónomo</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Analiza tu negocio y actúa automáticamente cada mañana</div>
            </div>
            <button
              onClick={runBrainNow}
              disabled={brainRunning || !selectedStore}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', background: GOLD,
                color: '#000', fontWeight: 700, fontSize: 13,
                cursor: brainRunning ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 7, opacity: brainRunning ? 0.7 : 1
              }}
            >
              <FontAwesomeIcon icon={brainRunning ? faSpinner : faPlay} spin={brainRunning} />
              {brainRunning ? 'Ejecutando...' : 'Ejecutar ahora'}
            </button>
          </div>

          {brainConfigLoading ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#aaa' }}>
              <FontAwesomeIcon icon={faSpinner} spin /> Cargando León IA...
            </div>
          ) : (
            <>
              {/* Master toggle */}
              <div style={{
                background: brainConfig.enabled ? '#0a0a0a' : '#f9fafb',
                border: `1.5px solid ${brainConfig.enabled ? GOLD : '#e5e7eb'}`,
                borderRadius: 10, padding: '14px 16px', marginBottom: 16
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: brainConfig.enabled ? '#fff' : '#111' }}>
                      León IA Autónomo
                    </div>
                    <div style={{ fontSize: 12, color: brainConfig.enabled ? 'rgba(255,255,255,0.55)' : '#6b7280', marginTop: 3 }}>
                      {brainConfig.enabled
                        ? '✅ Analizando y actuando automáticamente cada día a las 8:00 AM'
                        : 'Desactivado. Actívalo para que León IA opere solo cada mañana.'}
                    </div>
                  </div>
                  <button
                    onClick={() => brainToggle('enabled')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 28, color: brainConfig.enabled ? GOLD : '#ccc', flexShrink: 0 }}
                  >
                    <FontAwesomeIcon icon={brainConfig.enabled ? faToggleOn : faToggleOff} />
                  </button>
                </div>
                {brainConfig.last_run_at && (
                  <div style={{ fontSize: 11, color: brainConfig.enabled ? 'rgba(255,255,255,0.35)' : '#aaa', marginTop: 8 }}>
                    Última ejecución: {formatBrainDate(brainConfig.last_run_at)}
                  </div>
                )}
              </div>

              {/* Modules */}
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '4px 16px', marginBottom: 16 }}>
                {[
                  { key: 'auto_promotions', icon: faTag, label: 'Promociones automáticas', desc: 'Crea cupones cuando las ventas están por debajo del promedio' },
                  { key: 'worker_reminders', icon: faBell, label: 'Recordatorios a trabajadores', desc: 'Envía WhatsApp a trabajadores que no completaron sus tareas' },
                  { key: 'morale_messages', icon: faSmile, label: 'Mensajes de ánimo diarios', desc: 'Envía mensajes motivadores cada mañana por WhatsApp' },
                ].map((mod, i) => (
                  <div key={mod.key} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 0', borderBottom: i < 2 ? '1px solid #e5e7eb' : 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, background: '#fff',
                        border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <FontAwesomeIcon icon={mod.icon} style={{ color: '#6b7280', fontSize: 13 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{mod.label}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{mod.desc}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => brainToggle(mod.key)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: brainConfig[mod.key] ? GOLD : '#ccc' }}
                    >
                      <FontAwesomeIcon icon={brainConfig[mod.key] ? faToggleOn : faToggleOff} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Config fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                    Nombre del remitente
                  </label>
                  <input
                    value={brainConfig.sender_name || ''}
                    onChange={e => setBrainConfig(p => ({ ...p, sender_name: e.target.value }))}
                    placeholder="El Administrador"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                  />
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>Los mensajes llegarán firmados con este nombre</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                    Umbral de promoción (%)
                  </label>
                  <input
                    type="number" min="5" max="50"
                    value={brainConfig.promotion_threshold || 20}
                    onChange={e => setBrainConfig(p => ({ ...p, promotion_threshold: parseInt(e.target.value) || 20 }))}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                  />
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>Crear cupón si las ventas están X% por debajo del promedio</div>
                </div>
              </div>

              {/* Save */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <button
                  onClick={saveBrainConfig}
                  disabled={brainSaving}
                  style={{
                    padding: '10px 20px', borderRadius: 8, border: 'none', background: '#111',
                    color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8
                  }}
                >
                  <FontAwesomeIcon icon={brainSaving ? faSpinner : faSave} spin={brainSaving} />
                  {brainSaving ? 'Guardando...' : 'Guardar configuración'}
                </button>
                {brainSaveMsg && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: brainSaveMsg.startsWith('✔') ? '#22c55e' : '#ef4444' }}>
                    {brainSaveMsg}
                  </span>
                )}
              </div>

              {/* Activity log */}
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <FontAwesomeIcon icon={faHistory} style={{ color: '#6b7280' }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Historial de actividad</div>
                </div>
                {brainLog.length === 0 ? (
                  <div style={{
                    textAlign: 'center', color: '#bbb', padding: '24px 0', fontSize: 14,
                    background: '#f9fafb', borderRadius: 10, border: '1px dashed #e5e7eb'
                  }}>
                    No hay actividad registrada aún.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {brainLog.map(entry => {
                      const icon = BRAIN_ACTION_ICONS[entry.action_type] || BRAIN_ACTION_ICONS.default;
                      const color = BRAIN_ACTION_COLORS[entry.action_type] || BRAIN_ACTION_COLORS.default;
                      return (
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid #f5f5f5' }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 7, background: color + '18',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            <FontAwesomeIcon icon={icon} style={{ color, fontSize: 11 }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: '#333', lineHeight: 1.4 }}>{entry.description}</div>
                            <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                              {formatBrainDate(entry.created_at)} · {entry.action_type}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>
    </>
  );
}

export default WhatsApp;
