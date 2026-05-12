import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faVideo, faUpload, faTrash, faDesktop, faKey, faCopy, faCheck,
  faCircle, faPlay, faChevronDown, faPen, faTimes, faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

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
  const [tab, setTab] = useState('videos');
  const [videos, setVideos] = useState([]);
  const [screens, setScreens] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [loadingScreens, setLoadingScreens] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pairingCode, setPairingCode] = useState(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [assignModal, setAssignModal] = useState(null);
  const [renameModal, setRenameModal] = useState(null);
  const [renameName, setRenameName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
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
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(`.${ext}`)) { showError('Solo se permiten videos (mp4, webm, avi, mov, mkv)'); return; }
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

  const generateCode = async () => {
    setGeneratingCode(true);
    try {
      const r = await fetch(`${API}/api/cctv/screens/generate-code`, { method: 'POST', headers });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setPairingCode(data.code);
      setCopiedCode(false);
      await fetchScreens();
    } catch (e) { showError(e.message); }
    finally { setGeneratingCode(false); }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(pairingCode);
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
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff' }}>
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 48, height: 48, background: 'linear-gradient(135deg,#D4AF37,#b8972e)',
          borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <FontAwesomeIcon icon={faVideo} style={{ color: '#0a0a0a', fontSize: 20 }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>Cartelería Digital</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Control remoto de pantallas TV</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', color: '#ef4444', marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FontAwesomeIcon icon={faExclamationTriangle} />
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '12px 16px', color: '#22c55e', marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FontAwesomeIcon icon={faCheck} />
          {success}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4 }}>
        {[['videos', faVideo, 'Videos'], ['screens', faDesktop, 'Pantallas']].map(([key, icon, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: '10px 20px', border: 'none', borderRadius: 8, cursor: 'pointer',
            background: tab === key ? 'linear-gradient(135deg,#D4AF37,#b8972e)' : 'transparent',
            color: tab === key ? '#0a0a0a' : 'rgba(255,255,255,0.5)',
            fontWeight: tab === key ? 700 : 500, fontSize: 14, transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            <FontAwesomeIcon icon={icon} />
            {label}
            {key === 'screens' && screens.length > 0 && (
              <span style={{
                background: tab === key ? 'rgba(0,0,0,0.2)' : 'rgba(212,175,55,0.15)',
                color: tab === key ? '#0a0a0a' : '#D4AF37',
                borderRadius: 10, padding: '1px 7px', fontSize: 12, fontWeight: 700
              }}>{screens.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* VIDEOS TAB */}
      {tab === 'videos' && (
        <div>
          {/* Upload area */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files[0]); }}
            onClick={() => !uploading && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#D4AF37' : 'rgba(212,175,55,0.25)'}`,
              borderRadius: 16, padding: '40px 24px', textAlign: 'center', cursor: uploading ? 'default' : 'pointer',
              background: dragOver ? 'rgba(212,175,55,0.06)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s', marginBottom: 24
            }}
          >
            <input ref={fileInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files[0])} />
            {uploading ? (
              <div>
                <div style={{ color: '#D4AF37', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
                  Subiendo video... {uploadProgress}%
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg,#D4AF37,#b8972e)', borderRadius: 4, width: `${uploadProgress}%`, transition: 'width 0.3s' }} />
                </div>
              </div>
            ) : (
              <>
                <FontAwesomeIcon icon={faUpload} style={{ fontSize: 32, color: '#D4AF37', marginBottom: 12 }} />
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                  Arrastra un video aquí o haz clic para seleccionar
                </div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
                  MP4, WebM, AVI, MOV, MKV — hasta 4 GB
                </div>
              </>
            )}
          </div>

          {/* Videos list */}
          {loadingVideos ? (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 40 }}>Cargando videos...</div>
          ) : videos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <FontAwesomeIcon icon={faVideo} style={{ fontSize: 40, color: 'rgba(255,255,255,0.1)', marginBottom: 12 }} />
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>No hay videos subidos aún</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {videos.map(v => (
                <div key={v.id} style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14
                }}>
                  <div style={{
                    width: 40, height: 40, background: 'rgba(212,175,55,0.12)', borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <FontAwesomeIcon icon={faPlay} style={{ color: '#D4AF37', fontSize: 14 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.original_name}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>
                      {formatBytes(v.file_size)} · {formatDate(v.created_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteConfirm({ type: 'video', id: v.id, name: v.original_name })}
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: '#ef4444' }}
                    title="Eliminar"
                  >
                    <FontAwesomeIcon icon={faTrash} />
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
          {/* Generate code */}
          <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 16, padding: '20px 24px', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  <FontAwesomeIcon icon={faKey} style={{ color: '#D4AF37', marginRight: 8 }} />
                  Emparejar nueva pantalla
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                  Genera un código e ingrésalo en la app de TV para vincularla
                </div>
              </div>
              <button
                onClick={generateCode}
                disabled={generatingCode}
                style={{
                  background: 'linear-gradient(135deg,#D4AF37,#b8972e)', border: 'none', borderRadius: 10,
                  padding: '10px 20px', color: '#0a0a0a', fontWeight: 700, fontSize: 14, cursor: 'pointer'
                }}
              >
                {generatingCode ? 'Generando...' : 'Generar Código'}
              </button>
            </div>
            {pairingCode && (
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  background: '#0a0a0a', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 10,
                  padding: '12px 24px', letterSpacing: 6, fontSize: 24, fontWeight: 900, color: '#D4AF37',
                  fontFamily: 'monospace'
                }}>
                  {pairingCode}
                </div>
                <button
                  onClick={copyCode}
                  style={{
                    background: copiedCode ? 'rgba(34,197,94,0.15)' : 'rgba(212,175,55,0.1)',
                    border: `1px solid ${copiedCode ? 'rgba(34,197,94,0.3)' : 'rgba(212,175,55,0.2)'}`,
                    borderRadius: 8, padding: '10px 16px', cursor: 'pointer',
                    color: copiedCode ? '#22c55e' : '#D4AF37', fontWeight: 600, fontSize: 14
                  }}
                >
                  <FontAwesomeIcon icon={copiedCode ? faCheck : faCopy} style={{ marginRight: 6 }} />
                  {copiedCode ? 'Copiado' : 'Copiar'}
                </button>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Válido por 15 min</span>
              </div>
            )}
          </div>

          {/* Screens list */}
          {loadingScreens ? (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: 40 }}>Cargando pantallas...</div>
          ) : screens.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <FontAwesomeIcon icon={faDesktop} style={{ fontSize: 40, color: 'rgba(255,255,255,0.1)', marginBottom: 12 }} />
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>No hay pantallas vinculadas aún</div>
              <div style={{ color: 'rgba(255,255,255,0.18)', fontSize: 12, marginTop: 6 }}>Genera un código y úsalo en la app de TV</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {screens.map(s => (
                <div key={s.id} style={{
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${s.is_online ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 14, padding: '16px 20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 180 }}>
                      <div style={{
                        width: 44, height: 44, background: s.is_online ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.06)',
                        borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <FontAwesomeIcon icon={faDesktop} style={{ color: s.is_online ? '#22c55e' : 'rgba(255,255,255,0.3)', fontSize: 18 }} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{s.device_name}</span>
                          <FontAwesomeIcon icon={faCircle} style={{ fontSize: 7, color: s.is_online ? '#22c55e' : 'rgba(255,255,255,0.2)' }} />
                          <span style={{ fontSize: 12, color: s.is_online ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>
                            {s.is_online ? 'Encendida' : 'Apagada'}
                          </span>
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>
                          Última vez: {s.last_seen ? formatDate(s.last_seen) : 'Nunca'}
                        </div>
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 3 }}>Reproduciendo:</div>
                      <div style={{ color: s.video_name ? '#fff' : 'rgba(255,255,255,0.25)', fontSize: 14, fontWeight: 600 }}>
                        {s.video_name || 'Sin video asignado'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setAssignModal(s)}
                        style={{
                          background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)',
                          borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: '#D4AF37', fontSize: 13, fontWeight: 600
                        }}
                      >
                        <FontAwesomeIcon icon={faChevronDown} style={{ marginRight: 6 }} />
                        Cambiar Video
                      </button>
                      <button
                        onClick={() => { setRenameModal(s); setRenameName(s.device_name); }}
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}
                        title="Renombrar"
                      >
                        <FontAwesomeIcon icon={faPen} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'screen', id: s.id, name: s.device_name })}
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: '#ef4444' }}
                        title="Eliminar pantalla"
                      >
                        <FontAwesomeIcon icon={faTrash} />
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 20, padding: '28px 32px', width: '90%', maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 18 }}>Asignar video a <span style={{ color: '#D4AF37' }}>{assignModal.device_name}</span></h3>
              <button onClick={() => setAssignModal(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18 }}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              <button
                onClick={() => assignVideo(assignModal.id, null)}
                style={{
                  background: !assignModal.current_video_id ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${!assignModal.current_video_id ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 10, padding: '12px 16px', cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
                  textAlign: 'left', fontStyle: 'italic', fontSize: 14
                }}
              >
                Sin video (pantalla en negro)
              </button>
              {videos.map(v => (
                <button
                  key={v.id}
                  onClick={() => assignVideo(assignModal.id, v.id)}
                  style={{
                    background: assignModal.current_video_id === v.id ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${assignModal.current_video_id === v.id ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 10, padding: '12px 16px', cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{v.original_name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>{formatBytes(v.file_size)}</div>
                </button>
              ))}
              {videos.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 20 }}>
                  No hay videos subidos. Ve a la pestaña Videos para subir uno.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 20, padding: '28px 32px', width: '90%', maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 20px', color: '#fff', fontSize: 18 }}>Renombrar pantalla</h3>
            <input
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && renameScreen()}
              placeholder="Nombre de la pantalla"
              autoFocus
              style={{
                width: '100%', padding: '12px 14px', background: '#1a1a1a', border: '1px solid rgba(212,175,55,0.3)',
                borderRadius: 10, color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 16
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setRenameModal(null)} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={renameScreen} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg,#D4AF37,#b8972e)', border: 'none', borderRadius: 10, color: '#0a0a0a', fontWeight: 700, cursor: 'pointer' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#141414', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: '28px 32px', width: '90%', maxWidth: 380, textAlign: 'center' }}>
            <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: 32, color: '#ef4444', marginBottom: 16 }} />
            <h3 style={{ margin: '0 0 8px', color: '#fff', fontSize: 18 }}>¿Eliminar {deleteConfirm.type === 'video' ? 'video' : 'pantalla'}?</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '0 0 24px' }}>
              <strong style={{ color: '#fff' }}>{deleteConfirm.name}</strong> será eliminado permanentemente.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button
                onClick={() => deleteConfirm.type === 'video' ? deleteVideo(deleteConfirm.id) : deleteScreen(deleteConfirm.id)}
                style={{ flex: 1, padding: '12px', background: '#ef4444', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontWeight: 700 }}
              >Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
