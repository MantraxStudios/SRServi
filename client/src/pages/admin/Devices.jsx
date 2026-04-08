import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTabletAlt, faSave, faClock, faCog, faSync } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

const API = 'https://srservi2.srautomatic.com';

function Devices() {
  const { selectedStore } = useStore();
  const [devices, setDevices] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [editDevice, setEditDevice] = useState(null);

  useEffect(() => {
    if (selectedStore) {
      fetchDevices();
      fetchConfigs();
    } else {
      setLoading(false);
      setDevices([]);
    }
  }, [selectedStore]);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API + `/api/store-devices?store_id=${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) setDevices(await response.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchConfigs = async () => {
    try {
      const response = await fetch(`/api/public/store-configurations/${selectedStore.id}`);
      if (response.ok) setConfigs(await response.json());
    } catch { /* ignore */ }
  };

  const saveDevice = async (deviceId, data) => {
    setSaving(deviceId);
    try {
      const token = localStorage.getItem('token');
      await fetch(API + `/api/store-devices/${deviceId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      setEditDevice(null);
      fetchDevices();
    } catch (err) { console.error(err); }
    finally { setSaving(null); }
  };

  const formatDate = (date) => {
    if (!date) return 'Nunca';
    const d = new Date(date);
    const now = new Date();
    const diffMin = Math.floor((now - d) / 60000);
    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `Hace ${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Hace ${diffH}h`;
    return d.toLocaleDateString('es-ES');
  };

  const isOnline = (date) => {
    if (!date) return false;
    return (new Date() - new Date(date)) < 300000; // 5 min
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <>
      <header className="admin-header">
        <h1><FontAwesomeIcon icon={faTabletAlt} /> Dispositivos</h1>
      </header>
      <div className="admin-main">
        <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
            Los dispositivos se registran automáticamente al acceder a la tienda. Asigna una configuración y hora de reinicio a cada uno.
            Al cambiar la configuración, el totem se reiniciará automáticamente.
          </p>
        </div>

        {devices.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <FontAwesomeIcon icon={faTabletAlt} style={{ fontSize: '48px', color: '#ccc', marginBottom: '16px' }} />
              <p className="empty-state-text">No hay dispositivos registrados.</p>
              <p style={{ color: '#999', fontSize: '14px' }}>Abre la tienda desde un dispositivo para que se registre.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {devices.map(device => {
              const online = isOnline(device.last_seen);
              const isEditing = editDevice === device.id;
              return (
                <div key={device.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 16px', background: online ? '#d4edda' : '#f8f8f8',
                    borderBottom: '1px solid #e0e0e0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FontAwesomeIcon icon={faTabletAlt} style={{ fontSize: '18px', color: online ? '#155724' : '#999' }} />
                      <div>
                        <strong style={{ fontSize: '15px' }}>{device.label || 'Sin nombre'}</strong>
                        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#888' }}>
                          {device.device_uid.substring(0, 20)}...
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                        background: online ? '#28a745' : '#ccc'
                      }} />
                      <span style={{ fontSize: '12px', color: '#666' }}>{formatDate(device.last_seen)}</span>
                      <button
                        onClick={() => setEditDevice(isEditing ? null : device.id)}
                        className="btn btn-sm btn-secondary"
                        style={{ fontSize: '12px' }}
                      >
                        <FontAwesomeIcon icon={faCog} />
                      </button>
                    </div>
                  </div>

                  {/* Info row */}
                  <div style={{ padding: '10px 16px', display: 'flex', gap: '16px', fontSize: '13px', color: '#666' }}>
                    <span>
                      <FontAwesomeIcon icon={faCog} /> Config: <strong>{
                        device.config_id
                          ? (configs.find(c => c.id === device.config_id)?.name || `#${device.config_id}`)
                          : 'Por defecto'
                      }</strong>
                    </span>
                    <span>
                      <FontAwesomeIcon icon={faClock} /> Reinicio: <strong>{device.restart_time || 'No programado'}</strong>
                    </span>
                  </div>

                  {/* Edit panel */}
                  {isEditing && (
                    <div style={{ padding: '16px', borderTop: '1px solid #e0e0e0', background: '#fafafa' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                        <div>
                          <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Nombre</label>
                          <input
                            id={`dev-label-${device.id}`}
                            type="text"
                            defaultValue={device.label || ''}
                            placeholder="Ej: Totem Entrada"
                            style={{ width: '100%', padding: '8px', border: '2px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Configuración</label>
                          <select
                            id={`dev-config-${device.id}`}
                            defaultValue={device.config_id || ''}
                            style={{ width: '100%', padding: '8px', border: '2px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', background: '#fff' }}
                          >
                            <option value="">Por defecto</option>
                            {configs.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
                            <FontAwesomeIcon icon={faSync} /> Reinicio diario
                          </label>
                          <input
                            id={`dev-restart-${device.id}`}
                            type="time"
                            defaultValue={device.restart_time || ''}
                            style={{ width: '100%', padding: '8px', border: '2px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                          />
                        </div>
                        <button
                          onClick={() => {
                            const label = document.getElementById(`dev-label-${device.id}`).value;
                            const config_id = document.getElementById(`dev-config-${device.id}`).value || null;
                            const restart_time = document.getElementById(`dev-restart-${device.id}`).value || null;
                            saveDevice(device.id, { label, config_id: config_id ? parseInt(config_id) : null, restart_time });
                          }}
                          disabled={saving === device.id}
                          className="btn btn-primary"
                          style={{ padding: '8px 16px' }}
                        >
                          <FontAwesomeIcon icon={faSave} /> {saving === device.id ? '...' : 'Guardar'}
                        </button>
                      </div>
                      <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#999' }}>
                        Al cambiar la configuración, el totem se recargará automáticamente en su próxima verificación.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default Devices;
