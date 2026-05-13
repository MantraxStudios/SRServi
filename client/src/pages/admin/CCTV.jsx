import { useState, useEffect, useRef, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faVideo, faUpload, faTrash, faDesktop, faKey, faCopy, faCheck,
  faPlay, faPen, faTimes, faExclamationTriangle, faHistory, faPowerOff,
} from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#D4AF37';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function CCTV() {
  const { token } = useAuth();
  const { selectedStore } = useContext(StoreContext);
  const [tab, setTab] = useState('videos');
  const [videos, setVideos] = useState([]);
  const [screens, setScreens] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [loadingScreens, setLoadingScreens] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [assignModal, setAssignModal] = useState(null);
  const [renameModal, setRenameModal] = useState(null);
  const [renameName, setRenameName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [powerLogModal, setPowerLogModal] = useState(null); // { screen, log: [] }
  const [loadingLog, setLoadingLog] = useState(false);
  const fileInputRef = useRef();

  const headers = { Authorization: `Bearer ${token}` };

  const fetchVideos = async () => {
    try {
      const r = await fetch(`${API}/api/cctv/videos`, { headers });
      if (r.ok) setVideos(await r.json());
    } catch { } finally { setLoadingVideos(false); }
  };

  const fetchScreens = async () => {
    try {
      const r = await fetch(`${API}/api/cctv/screens`, { headers });
      if (r.ok) setScreens(await r.json());
    } catch { } finally { setLoadingScreens(false); }
  };

  useEffect(() => { fetchVideos(); fetchScreens(); }, []);
  useEffect(() => {
    if (tab === 'screens') {
      const interval = setInterval(fetchScreens, 15000);
      return () => clearInterval(interval);
    }
  }, [tab]);

  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };
  const showError = (msg) => { setError(msg); setTimeout(() => setError(''), 5000); };

  const handleUpload = async (file) => {
    if (!file) return;
    const allowed = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.mpeg', '.mpg'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) { showError('Solo se permiten videos (mp4, webm, avi, mov, mkv)'); return; }
    setUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('video', file);
    try {
      const xhr = new XMLHttpRequest();
      await new Promise((resolve, reject) => {
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100)); };
        xhr.onload = () => { if (xhr.status === 200) resolve(); else reject(new Error(JSON.parse(xhr.responseText)?.error || 'Error al subir')); };
        xhr.onerror = () => reject(new Error('Error de red'));
        xhr.open('POST', `${API}/api/cctv/videos`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
      await fetchVideos();
      showSuccess('Video subido correctamente');
    } catch (e) { showError(e.message); }
    finally { setUploading(false); setUploadProgress(0); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const deleteVideo = async (id) => {
    try {
      const r = await fetch(`${API}/api/cctv/videos/${id}`, { method: 'DELETE', headers });
      if (!r.ok) throw new Error((await r.json()).error);
      setVideos(v => v.filter(x => x.id !== id));
      showSuccess('Video eliminado');
    } catch (e) { showError(e.message); }
    setDeleteConfirm(null);
  };

  const openPowerLog = async (screen) => {
    setLoadingLog(true);
    setPowerLogModal({ screen, log: [] });
    try {
      const r = await fetch(`${API}/api/cctv/screens/${screen.id}/power-log`, { headers });
      if (r.ok) setPowerLogModal({ screen, log: await r.json() });
    } catch { }
    finally { setLoadingLog(false); }
  };

  const copyStoreCode = () => {
    if (!selectedStore?.code) return;
    navigator.clipboard.writeText(selectedStore.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const assignVideo = async (screenId, videoId) => {
    try {
      const r = await fetch(`${API}/api/cctv/screens/${screenId}/assign`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId || null })
      });
      if (!r.ok) throw new Error((await r.json()).error);
      await fetchScreens();
      showSuccess('Video asignado a la pantalla');
      setAssignModal(null);
    } catch (e) { showError(e.message); }
  };

  const renameScreen = async () => {
    if (!renameModal) return;
    try {
      const r = await fetch(`${API}/api/cctv/screens/${renameModal.id}/name`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameName })
      });
      if (!r.ok) throw new Error((await r.json()).error);
      await fetchScreens();
      showSuccess('Pantalla renombrada');
      setRenameModal(null);
    } catch (e) { showError(e.message); }
  };

  const deleteScreen = async (id) => {
    try {
      const r = await fetch(`${API}/api/cctv/screens/${id}`, { method: 'DELETE', headers });
      if (!r.ok) throw new Error((await r.json()).error);
      setScreens(s => s.filter(x => x.id !== id));
      showSuccess('Pantalla eliminada');
    } catch (e) { showError(e.message); }
    setDeleteConfirm(null);
  };

  return (
    <div style={{ padding: '32px', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 40, height: 40, background: GOLD, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <FontAwesomeIcon icon={faVideo} style={{ color: '#0a0a0a', fontSize: 17 }} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#09090b' }}>Cartelería Digital</h1>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#71717a', paddingLeft: 52 }}>
          Control remoto de pantallas TV · Powered by SRAutomatic.cl
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '11px 16px', color: '#991b1b', marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FontAwesomeIcon icon={faExclamationTriangle} />
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '11px 16px', color: '#15803d', marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FontAwesomeIcon icon={faCheck} />
          {success}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid #e4e4e7' }}>
        {[['videos', faVideo, 'Videos', videos.length], ['screens', faDesktop, 'Pantallas', screens.length]].map(([key, icon, label, count]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: tab === key ? `2px solid ${GOLD}` : '2px solid transparent',
            color: tab === key ? '#09090b' : '#71717a',
            fontWeight: tab === key ? 700 : 500, fontSize: 14,
            display: 'flex', alignItems: 'center', gap: 7,
            marginBottom: -1, transition: 'all 0.15s'
          }}>
            <FontAwesomeIcon icon={icon} />
            {label}
            {count > 0 && (
              <span style={{
                background: tab === key ? GOLD : '#f4f4f5',
                color: tab === key ? '#0a0a0a' : '#71717a',
                borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700
              }}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* VIDEOS TAB */}
      {tab === 'videos' && (
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files[0]); }}
            onClick={() => !uploading && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? GOLD : '#d4d4d8'}`,
              borderRadius: 12, padding: '36px 24px', textAlign: 'center',
              cursor: uploading ? 'default' : 'pointer',
              background: dragOver ? '#fffbeb' : '#fafafa',
              transition: 'all 0.2s', marginBottom: 24
            }}
          >
            <input ref={fileInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files[0])} />
            {uploading ? (
              <div>
                <div style={{ color: '#09090b', fontSize: 15, fontWeight: 600, marginBottom: 10 }}>
                  Subiendo video... {uploadProgress}%
                </div>
                <div style={{ height: 6, background: '#e4e4e7', borderRadius: 4, overflow: 'hidden', maxWidth: 360, margin: '0 auto' }}>
                  <div style={{ height: '100%', background: GOLD, borderRadius: 4, width: `${uploadProgress}%`, transition: 'width 0.3s' }} />
                </div>
              </div>
            ) : (
              <>
                <div style={{ width: 44, height: 44, background: '#f4f4f5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <FontAwesomeIcon icon={faUpload} style={{ fontSize: 18, color: '#71717a' }} />
                </div>
                <div style={{ color: '#09090b', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                  Arrastra un video aquí o haz clic para seleccionar
                </div>
                <div style={{ color: '#71717a', fontSize: 13 }}>MP4, WebM, AVI, MOV, MKV — hasta 4 GB</div>
              </>
            )}
          </div>

          {loadingVideos ? (
            <div style={{ textAlign: 'center', color: '#71717a', padding: 40, fontSize: 14 }}>Cargando videos...</div>
          ) : videos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ width: 56, height: 56, background: '#f4f4f5', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <FontAwesomeIcon icon={faVideo} style={{ fontSize: 22, color: '#a1a1aa' }} />
              </div>
              <div style={{ color: '#71717a', fontSize: 14, fontWeight: 500 }}>No hay videos subidos aún</div>
              <div style={{ color: '#a1a1aa', fontSize: 13, marginTop: 4 }}>Sube tu primer video para empezar</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {videos.map(v => (
                <div key={v.id} style={{
                  background: '#fff', border: '1px solid #e4e4e7', borderRadius: 10,
                  padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12
                }}>
                  <div style={{ width: 38, height: 38, background: '#fff8e1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FontAwesomeIcon icon={faPlay} style={{ color: GOLD, fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#09090b', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.original_name}
                    </div>
                    <div style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>
                      {formatBytes(v.file_size)} · {formatDate(v.created_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteConfirm({ type: 'video', id: v.id, name: v.original_name })}
                    style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', color: '#dc2626' }}
                    title="Eliminar"
                  >
                    <FontAwesomeIcon icon={faTrash} style={{ fontSize: 13 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SCREENS TAB */}
      {tab === 'screens' && (
        <div>
          {/* Pairing card */}
          <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <FontAwesomeIcon icon={faKey} style={{ color: GOLD, fontSize: 14 }} />
              <span style={{ color: '#09090b', fontWeight: 700, fontSize: 15 }}>Código de vinculación</span>
            </div>
            <div style={{ color: '#71717a', fontSize: 13, marginBottom: 14 }}>
              Ingresá este código en la app de Cartelería TV para vincular la pantalla. Es permanente, no cambia nunca.
            </div>
            {selectedStore?.code ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{
                  background: '#09090b', borderRadius: 8, padding: '10px 24px',
                  letterSpacing: 8, fontSize: 26, fontWeight: 900, color: GOLD,
                  fontFamily: 'monospace'
                }}>
                  {selectedStore.code}
                </div>
                <button
                  onClick={copyStoreCode}
                  style={{
                    background: copiedCode ? '#f0fdf4' : '#f4f4f5',
                    border: `1px solid ${copiedCode ? '#bbf7d0' : '#e4e4e7'}`,
                    borderRadius: 7, padding: '8px 14px', cursor: 'pointer',
                    color: copiedCode ? '#15803d' : '#09090b', fontWeight: 600, fontSize: 13
                  }}
                >
                  <FontAwesomeIcon icon={copiedCode ? faCheck : faCopy} style={{ marginRight: 6 }} />
                  {copiedCode ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            ) : (
              <div style={{ color: '#a1a1aa', fontSize: 13 }}>Seleccioná una tienda para ver el código.</div>
            )}
          </div>

          {/* Screens list */}
          {loadingScreens ? (
            <div style={{ textAlign: 'center', color: '#71717a', padding: 40, fontSize: 14 }}>Cargando pantallas...</div>
          ) : screens.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ width: 56, height: 56, background: '#f4f4f5', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <FontAwesomeIcon icon={faDesktop} style={{ fontSize: 22, color: '#a1a1aa' }} />
              </div>
              <div style={{ color: '#71717a', fontSize: 14, fontWeight: 500 }}>No hay pantallas vinculadas</div>
              <div style={{ color: '#a1a1aa', fontSize: 13, marginTop: 4 }}>Genera un código y úsalo en la app de TV</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {screens.map(s => (
                <div key={s.id} style={{
                  background: '#fff', border: '1px solid #e4e4e7',
                  borderRadius: 12, padding: '16px 20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
                      <div style={{
                        width: 40, height: 40,
                        background: s.is_online ? '#f0fdf4' : '#f4f4f5',
                        borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <FontAwesomeIcon icon={faDesktop} style={{ color: s.is_online ? '#16a34a' : '#a1a1aa', fontSize: 16 }} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#09090b', fontWeight: 700, fontSize: 15 }}>{s.device_name}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                            background: s.is_online ? '#f0fdf4' : '#f4f4f5',
                            color: s.is_online ? '#15803d' : '#71717a',
                            border: `1px solid ${s.is_online ? '#bbf7d0' : '#e4e4e7'}`
                          }}>
                            {s.is_online ? '● Encendida' : '○ Apagada'}
                          </span>
                        </div>
                        <div style={{ color: '#a1a1aa', fontSize: 12, marginTop: 2 }}>
                          Última vez: {s.last_seen ? formatDate(s.last_seen) : 'Nunca'}
                        </div>
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ color: '#a1a1aa', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Reproduciendo</div>
                      <div style={{ color: s.video_name ? '#09090b' : '#a1a1aa', fontSize: 14, fontWeight: s.video_name ? 500 : 400, fontStyle: s.video_name ? 'normal' : 'italic' }}>
                        {s.video_name || 'Sin video asignado'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setAssignModal(s)}
                        style={{ background: '#fff8e1', border: `1px solid #fde68a`, borderRadius: 7, padding: '7px 13px', cursor: 'pointer', color: '#92400e', fontSize: 13, fontWeight: 600 }}
                      >
                        <FontAwesomeIcon icon={faVideo} style={{ marginRight: 5, fontSize: 11 }} />
                        Cambiar video
                      </button>
                      <button
                        onClick={() => openPowerLog(s)}
                        style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: '#0369a1' }}
                        title="Historial de encendido"
                      >
                        <FontAwesomeIcon icon={faHistory} style={{ fontSize: 12 }} />
                      </button>
                      <button
                        onClick={() => { setRenameModal(s); setRenameName(s.device_name); }}
                        style={{ background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: '#71717a' }}
                        title="Renombrar"
                      >
                        <FontAwesomeIcon icon={faPen} style={{ fontSize: 12 }} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'screen', id: s.id, name: s.device_name })}
                        style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: '#dc2626' }}
                        title="Eliminar pantalla"
                      >
                        <FontAwesomeIcon icon={faTrash} style={{ fontSize: 12 }} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assign Video Modal */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', width: '90%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, color: '#09090b', fontSize: 17, fontWeight: 700 }}>
                Asignar video a <span style={{ color: GOLD }}>{assignModal.device_name}</span>
              </h3>
              <button onClick={() => setAssignModal(null)} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: 16, padding: 4 }}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              <button
                onClick={() => assignVideo(assignModal.id, null)}
                style={{
                  background: !assignModal.current_video_id ? '#fff8e1' : '#fafafa',
                  border: `1px solid ${!assignModal.current_video_id ? '#fde68a' : '#e4e4e7'}`,
                  borderRadius: 8, padding: '11px 14px', cursor: 'pointer',
                  textAlign: 'left', color: '#71717a', fontStyle: 'italic', fontSize: 14
                }}
              >
                Sin video (pantalla en negro)
              </button>
              {videos.map(v => (
                <button
                  key={v.id}
                  onClick={() => assignVideo(assignModal.id, v.id)}
                  style={{
                    background: assignModal.current_video_id === v.id ? '#fff8e1' : '#fafafa',
                    border: `1px solid ${assignModal.current_video_id === v.id ? '#fde68a' : '#e4e4e7'}`,
                    borderRadius: 8, padding: '11px 14px', cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <div style={{ color: '#09090b', fontWeight: 600, fontSize: 14 }}>{v.original_name}</div>
                  <div style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{formatBytes(v.file_size)}</div>
                </button>
              ))}
              {videos.length === 0 && (
                <div style={{ color: '#71717a', fontSize: 13, textAlign: 'center', padding: 20 }}>
                  No hay videos. Ve a la pestaña Videos para subir uno.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', width: '90%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 16px', color: '#09090b', fontSize: 17, fontWeight: 700 }}>Renombrar pantalla</h3>
            <input
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && renameScreen()}
              placeholder="Nombre de la pantalla"
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', background: '#fafafa',
                border: '1px solid #e4e4e7', borderRadius: 8, color: '#09090b',
                fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 14
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setRenameModal(null)} style={{ flex: 1, padding: '10px', background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: 8, color: '#71717a', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={renameScreen} style={{ flex: 1, padding: '10px', background: GOLD, border: 'none', borderRadius: 8, color: '#0a0a0a', fontWeight: 700, cursor: 'pointer' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Power Log Modal */}
      {powerLogModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', width: '90%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h3 style={{ margin: 0, color: '#09090b', fontSize: 17, fontWeight: 700 }}>
                  Historial — <span style={{ color: GOLD }}>{powerLogModal.screen.device_name}</span>
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#71717a' }}>Últimos 100 eventos de encendido/apagado</p>
              </div>
              <button onClick={() => setPowerLogModal(null)} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: 16, padding: 4 }}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loadingLog ? (
                <div style={{ textAlign: 'center', color: '#71717a', padding: 32, fontSize: 14 }}>Cargando...</div>
              ) : powerLogModal.log.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#a1a1aa', padding: 32, fontSize: 14 }}>
                  Sin registros. La app de TV reporta los eventos al encenderse y apagarse.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {powerLogModal.log.map((entry, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 9,
                      background: entry.event === 'on' ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${entry.event === 'on' ? '#bbf7d0' : '#fca5a5'}`
                    }}>
                      <FontAwesomeIcon
                        icon={faPowerOff}
                        style={{ color: entry.event === 'on' ? '#16a34a' : '#dc2626', fontSize: 14, flexShrink: 0 }}
                      />
                      <span style={{ fontWeight: 700, fontSize: 13, color: entry.event === 'on' ? '#15803d' : '#dc2626', minWidth: 60 }}>
                        {entry.event === 'on' ? 'Encendida' : 'Apagada'}
                      </span>
                      <span style={{ color: '#71717a', fontSize: 13 }}>{formatDate(entry.logged_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', width: '90%', maxWidth: 360, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ width: 48, height: 48, background: '#fef2f2', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: 20, color: '#dc2626' }} />
            </div>
            <h3 style={{ margin: '0 0 8px', color: '#09090b', fontSize: 17, fontWeight: 700 }}>
              ¿Eliminar {deleteConfirm.type === 'video' ? 'video' : 'pantalla'}?
            </h3>
            <p style={{ color: '#71717a', fontSize: 14, margin: '0 0 20px' }}>
              <strong style={{ color: '#09090b' }}>{deleteConfirm.name}</strong> será eliminado permanentemente.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '11px', background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: 8, color: '#71717a', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button
                onClick={() => deleteConfirm.type === 'video' ? deleteVideo(deleteConfirm.id) : deleteScreen(deleteConfirm.id)}
                style={{ flex: 1, padding: '11px', background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 700 }}
              >Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
