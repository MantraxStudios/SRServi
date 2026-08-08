import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { QRCodeCanvas } from 'qrcode.react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBriefcase, faDownload, faTrash, faSpinner, faPhone, faEnvelope, faClock, faUser } from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

const STATUS = {
  nuevo: { label: 'Nuevo', color: '#2563eb', bg: '#dbeafe' },
  revisado: { label: 'Revisado', color: '#7c3aed', bg: '#ede9fe' },
  contactado: { label: 'Contactado', color: '#16a34a', bg: '#dcfce7' },
  descartado: { label: 'Descartado', color: '#6b7280', bg: '#f3f4f6' },
};

export default function Jobs() {
  const { token } = useAuth();
  const { selectedStore } = useContext(StoreContext);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todos');
  const qrRef = useRef(null);

  const publicUrl = selectedStore ? `${window.location.origin}/trabajo/${selectedStore.code}` : '';

  const load = useCallback(async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/jobs?store_id=${selectedStore.id}`, { headers: { Authorization: 'Bearer ' + token } });
      if (r.ok) setApps(await r.json());
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, [selectedStore, token]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (id, status) => {
    setApps(a => a.map(x => x.id === id ? { ...x, status } : x));
    await fetch(`${API}/api/jobs/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ status }),
    }).catch(() => {});
  };

  const remove = async (id) => {
    if (!window.confirm('¿Eliminar esta postulación?')) return;
    setApps(a => a.filter(x => x.id !== id));
    await fetch(`${API}/api/jobs/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }).catch(() => {});
  };

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `QR-Trabajo-${selectedStore?.code || 'tienda'}.png`;
    a.click();
  };

  const shown = filter === 'todos' ? apps : apps.filter(a => a.status === filter);
  const count = (s) => apps.filter(a => a.status === s).length;

  if (!selectedStore) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Selecciona una tienda.</div>;

  return (
    <div style={{ padding: '20px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg,#1d4ed8,#60a5fa)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20 }}>
          <FontAwesomeIcon icon={faBriefcase} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111' }}>Postulaciones de Trabajo</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Recibe candidatos con un QR en tu local</p>
        </div>
      </div>

      {/* QR card */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', background: '#fff', border: '1px solid #eee', borderRadius: 16, padding: 22, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        <div ref={qrRef} style={{ padding: 14, background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', flexShrink: 0 }}>
          <QRCodeCanvas value={publicUrl} size={150} level="H" bgColor="#ffffff" fgColor="#0f172a" />
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#111' }}>QR para postular</h3>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#666', lineHeight: 1.5 }}>
            Imprime este QR y pégalo en tu local. Quien lo escanee llega a tu página de postulación y deja sus datos.
          </p>
          <p style={{ margin: '0 0 14px', fontSize: 11.5, fontFamily: 'monospace', color: '#555', background: '#f8f8f8', padding: '8px 11px', borderRadius: 7, border: '1px solid #ececec', wordBreak: 'break-all' }}>{publicUrl}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={downloadQr} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              <FontAwesomeIcon icon={faDownload} /> Descargar QR
            </button>
            <a href={publicUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#fff', color: '#111', border: '1.5px solid #ddd', borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
              Ver formulario
            </a>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['todos', 'nuevo', 'revisado', 'contactado', 'descartado'].map(f => {
          const active = filter === f;
          const meta = STATUS[f];
          const n = f === 'todos' ? apps.length : count(f);
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: active ? '1.5px solid #111' : '1.5px solid #e5e5e5',
              background: active ? '#111' : '#fff', color: active ? '#fff' : '#555',
            }}>
              {f === 'todos' ? 'Todos' : meta.label} <span style={{ opacity: 0.7 }}>({n})</span>
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}><FontAwesomeIcon icon={faSpinner} spin /> Cargando…</div>
      ) : shown.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 50, color: '#aaa', background: '#fafafa', borderRadius: 14, border: '1px dashed #e0e0e0' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
          Aún no hay postulaciones{filter !== 'todos' ? ' en este estado' : ''}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map(a => {
            const meta = STATUS[a.status] || STATUS.nuevo;
            return (
              <div key={a.id} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 14, padding: 18, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#111' }}><FontAwesomeIcon icon={faUser} style={{ color: '#94a3b8', marginRight: 6 }} />{a.name}{a.age ? `, ${a.age}` : ''}</span>
                      {a.position && <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', padding: '2px 9px', borderRadius: 20 }}>{a.position}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: 13, color: '#555' }}>
                      {a.phone && <a href={`tel:${a.phone}`} style={{ color: '#16a34a', textDecoration: 'none' }}><FontAwesomeIcon icon={faPhone} /> {a.phone}</a>}
                      {a.email && <a href={`mailto:${a.email}`} style={{ color: '#2563eb', textDecoration: 'none' }}><FontAwesomeIcon icon={faEnvelope} /> {a.email}</a>}
                      {a.availability && <span><FontAwesomeIcon icon={faClock} style={{ color: '#94a3b8' }} /> {a.availability}</span>}
                    </div>
                    {a.experience && <p style={{ margin: '10px 0 0', fontSize: 13.5, color: '#333', lineHeight: 1.5 }}><strong style={{ color: '#666' }}>Experiencia:</strong> {a.experience}</p>}
                    {a.message && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#777', lineHeight: 1.5, fontStyle: 'italic' }}>“{a.message}”</p>}
                    <p style={{ margin: '8px 0 0', fontSize: 11.5, color: '#aaa' }}>{new Date(a.created_at).toLocaleString('es-CL')}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <select value={a.status} onChange={e => changeStatus(a.id, e.target.value)} style={{ padding: '7px 10px', borderRadius: 9, border: `1.5px solid ${meta.color}`, color: meta.color, background: meta.bg, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                      {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <button onClick={() => remove(a.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, padding: 4 }}>
                      <FontAwesomeIcon icon={faTrash} /> Eliminar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
