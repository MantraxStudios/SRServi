import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWhatsapp
} from '@fortawesome/free-brands-svg-icons';
import {
  faCheckCircle, faTimesCircle, faSpinner, faQrcode,
  faPaperPlane, faUnlink, faLink, faSync
} from '@fortawesome/free-solid-svg-icons';

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
            <FontAwesomeIcon icon={faWhatsapp} style={{ color: '#25D366' }} />
            WhatsApp
          </h1>
          <p className="text-sm text-muted">Conecta tu número personal para enviar mensajes automáticos</p>
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
              <FontAwesomeIcon icon={faWhatsapp} style={{ fontSize: 24, color: '#25D366' }} />
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
                WhatsApp no conectado. Haz clic en "Conectar" para escanear el QR con tu teléfono.
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
          <strong style={{ color: '#374151' }}>¿Cómo funciona?</strong><br />
          Usa tu número personal de WhatsApp para enviar mensajes automáticos a trabajadores. No requiere API de pago.
          La sesión se guarda en el servidor y se reconecta automáticamente. El SRBrain usará WhatsApp para recordatorios
          de tareas y mensajes de ánimo; si no hay conexión, usará SMS como respaldo.
        </div>
      </div>
    </>
  );
}

export default WhatsApp;
