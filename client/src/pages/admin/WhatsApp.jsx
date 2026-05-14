import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle, faTimesCircle, faSpinner,
  faPaperPlane, faUnlink, faLink, faSync
} from '@fortawesome/free-solid-svg-icons';

function WaIcon({ size = 24, color = '#25D366' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

const API = 'https://srservi2.srautomatic.com';

function WhatsApp() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testMsg, setTestMsg] = useState('Hola! Este es un mensaje de prueba desde SRServi.');
  const [testResult, setTestResult] = useState(null);
  const pollRef = useRef(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API}/api/whatsapp/status`, { headers });
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 4000);
    return () => clearInterval(pollRef.current);
  }, []);

  const handleConnect = async () => {
    setActionLoading(true);
    await fetch(`${API}/api/whatsapp/connect`, { method: 'POST', headers });
    setActionLoading(false);
    fetchStatus();
  };

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar WhatsApp? Se eliminará la sesión guardada.')) return;
    setActionLoading(true);
    await fetch(`${API}/api/whatsapp/disconnect`, { method: 'POST', headers });
    setActionLoading(false);
    fetchStatus();
  };

  const handleSendTest = async (e) => {
    e.preventDefault();
    setTestResult(null);
    try {
      const res = await fetch(`${API}/api/whatsapp/send`, {
        method: 'POST', headers,
        body: JSON.stringify({ to: testTo, message: testMsg })
      });
      const data = await res.json();
      setTestResult(res.ok ? { ok: true, msg: 'Mensaje enviado correctamente' } : { ok: false, msg: data.error });
    } catch (e) {
      setTestResult({ ok: false, msg: e.message });
    }
  };

  const statusColor = status?.connected ? '#22c55e' : status?.hasQR ? '#f59e0b' : '#ef4444';
  const statusText = status?.connected ? 'Conectado' : status?.hasQR ? 'Esperando escaneo QR' : status?.connecting ? 'Conectando...' : 'Desconectado';
  const statusIcon = status?.connected ? faCheckCircle : status?.hasQR || status?.connecting ? faSpinner : faTimesCircle;

  return (
    <>
      <header className="admin-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <WaIcon size={26} />
            WhatsApp
          </h1>
          <p className="text-sm text-muted">Número global — se usa para enviar mensajes a trabajadores de todas las tiendas</p>
        </div>
      </header>

      <div className="admin-main" style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Status card */}
        <div style={{
          background: '#fff', borderRadius: 14, border: '1px solid #f0f0f0',
          padding: '24px 28px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,.05)'
        }}>
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
              onClick={fetchStatus}
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
                WhatsApp conectado. Los mensajes automáticos del SRBrain se enviarán por WhatsApp.
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
                <strong>Escanea el código QR</strong> con tu WhatsApp. Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo.
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{ background: '#fff', padding: 12, borderRadius: 12, border: '2px solid #25D366' }}>
                  <img src={status.qr} alt="QR WhatsApp" style={{ width: 240, height: 240, display: 'block' }} />
                </div>
              </div>
              <p style={{ textAlign: 'center', fontSize: 12, color: '#888', marginTop: 8 }}>
                El QR expira en ~60 segundos. Si expira, haz clic en "Reconectar".
              </p>
            </div>
          ) : (
            <div>
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
                padding: '12px 16px', marginBottom: 16, fontSize: 14, color: '#7f1d1d'
              }}>
                Sin conexión. Haz clic en "Conectar", escanea el QR con tu WhatsApp y listo — ese número se usará para todas las tiendas.
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

        {/* Test message */}
        {status?.connected && (
          <div style={{
            background: '#fff', borderRadius: 14, border: '1px solid #f0f0f0',
            padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,.05)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
              <FontAwesomeIcon icon={faPaperPlane} style={{ marginRight: 8, color: '#25D366' }} />
              Enviar mensaje de prueba
            </h3>
            <form onSubmit={handleSendTest}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>
                  Número de teléfono (con código de país)
                </label>
                <input
                  type="text"
                  value={testTo}
                  onChange={e => setTestTo(e.target.value)}
                  placeholder="+56912345678"
                  required
                  style={{
                    width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
                    borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Mensaje</label>
                <textarea
                  value={testMsg}
                  onChange={e => setTestMsg(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
                    borderRadius: 8, fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box'
                  }}
                />
              </div>
              {testResult && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13,
                  background: testResult.ok ? '#f0fdf4' : '#fef2f2',
                  color: testResult.ok ? '#166534' : '#dc2626',
                  border: `1px solid ${testResult.ok ? '#bbf7d0' : '#fecaca'}`
                }}>
                  <FontAwesomeIcon icon={testResult.ok ? faCheckCircle : faTimesCircle} style={{ marginRight: 7 }} />
                  {testResult.msg}
                </div>
              )}
              <button
                type="submit"
                style={{
                  padding: '10px 20px', borderRadius: 8, border: 'none',
                  background: '#25D366', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14
                }}
              >
                <FontAwesomeIcon icon={faPaperPlane} style={{ marginRight: 7 }} />
                Enviar prueba
              </button>
            </form>
          </div>
        )}

        <div style={{
          marginTop: 24, padding: '16px 20px', background: '#f9fafb', borderRadius: 12,
          border: '1px solid #e5e7eb', fontSize: 13, color: '#6b7280', lineHeight: 1.6
        }}>
          <strong style={{ color: '#374151' }}>Una sola conexión para todo</strong><br />
          Este número se comparte entre todas las tiendas de la plataforma. Solo necesitas conectarlo una vez —
          León IA lo usará para enviar recordatorios de tareas y mensajes de ánimo a los trabajadores de cualquier tienda.
          La sesión se guarda en el servidor y se reconecta automáticamente al reiniciar.
        </div>
      </div>
    </>
  );
}

export default WhatsApp;
