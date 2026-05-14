import { useState, useEffect, useRef, useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faVideo, faUpload, faTrash, faDesktop, faKey, faCopy, faCheck,
  faPlay, faPen, faTimes, faExclamationTriangle, faHistory, faPowerOff,
  faMusic, faVolumeMute, faVolumeUp, faImage, faArrowUp, faArrowDown, faFolder,
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

function formatSeconds(s) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

export default function CCTV() {
  const { token } = useAuth();
  const { selectedStore } = useContext(StoreContext);
  const [tab, setTab] = useState('videos');

  const [videos, setVideos] = useState([]);
  const [screens, setScreens] = useState([]);
  const [music, setMusic] = useState([]);
  const [images, setImages] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [albumFilter, setAlbumFilter] = useState(null); // null = todas
  const [newAlbumName, setNewAlbumName] = useState('');
  const [assignAlbumModal, setAssignAlbumModal] = useState(null); // screen

  const [loadingVideos, setLoadingVideos] = useState(true);
  const [loadingScreens, setLoadingScreens] = useState(true);
  const [loadingMusic, setLoadingMusic] = useState(true);
  const [loadingImages, setLoadingImages] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [uploadMusicProgress, setUploadMusicProgress] = useState(0);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadImagesProgress, setUploadImagesProgress] = useState(0);

  const [localDurations, setLocalDurations] = useState({});

  const [copiedCode, setCopiedCode] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [dragOverMusic, setDragOverMusic] = useState(false);
  const [dragOverImages, setDragOverImages] = useState(false);

  const [assignModal, setAssignModal] = useState(null);
  const [assignMusicModal, setAssignMusicModal] = useState(null);
  const [renameModal, setRenameModal] = useState(null);
  const [renameName, setRenameName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [powerLogModal, setPowerLogModal] = useState(null);
  const [loadingLog, setLoadingLog] = useState(false);

  const fileInputRef = useRef();
  const musicInputRef = useRef();
  const imageInputRef = useRef();

  const headers = { Authorization: `Bearer ${token}` };

  const fetchVideos = async () => {
    try { const r = await fetch(`${API}/api/cctv/videos`, { headers }); if (r.ok) setVideos(await r.json()); }
    catch { } finally { setLoadingVideos(false); }
  };
  const fetchScreens = async () => {
    try { const r = await fetch(`${API}/api/cctv/screens`, { headers }); if (r.ok) setScreens(await r.json()); }
    catch { } finally { setLoadingScreens(false); }
  };
  const fetchMusic = async () => {
    try { const r = await fetch(`${API}/api/cctv/music`, { headers }); if (r.ok) setMusic(await r.json()); }
    catch { } finally { setLoadingMusic(false); }
  };
  const fetchImages = async () => {
    try {
      const r = await fetch(`${API}/api/cctv/images`, { headers });
      if (r.ok) {
        const data = await r.json();
        setImages(data);
        const durations = {};
        data.forEach(img => { durations[img.id] = img.duration_seconds; });
        setLocalDurations(durations);
      }
    } catch { } finally { setLoadingImages(false); }
  };
  const fetchAlbums = async () => {
    try { const r = await fetch(`${API}/api/cctv/albums`, { headers }); if (r.ok) setAlbums(await r.json()); }
    catch { }
  };

  useEffect(() => { fetchVideos(); fetchScreens(); fetchMusic(); fetchImages(); fetchAlbums(); }, []);
  useEffect(() => {
    if (tab === 'screens') { const t = setInterval(fetchScreens, 15000); return () => clearInterval(t); }
  }, [tab]);

  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };
  const showError = (msg) => { setError(msg); setTimeout(() => setError(''), 5000); };

  // ── Upload helpers ──────────────────────────────────────────────────────────
  const handleUpload = async (file) => {
    if (!file) return;
    const allowed = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.mpeg', '.mpg'];
    if (!allowed.includes('.' + file.name.split('.').pop().toLowerCase())) { showError('Solo se permiten videos (mp4, webm, avi, mov, mkv)'); return; }
    setUploading(true); setUploadProgress(0);
    const formData = new FormData(); formData.append('video', file);
    try {
      const xhr = new XMLHttpRequest();
      await new Promise((res, rej) => {
        xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100)); };
        xhr.onload = () => xhr.status === 200 ? res() : rej(new Error(JSON.parse(xhr.responseText)?.error || 'Error'));
        xhr.onerror = () => rej(new Error('Error de red'));
        xhr.open('POST', `${API}/api/cctv/videos`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
      await fetchVideos(); showSuccess('Video subido correctamente');
    } catch (e) { showError(e.message); }
    finally { setUploading(false); setUploadProgress(0); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleUploadMusic = async (file) => {
    if (!file) return;
    const allowed = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac'];
    if (!allowed.includes('.' + file.name.split('.').pop().toLowerCase())) { showError('Solo se permiten audios (mp3, m4a, aac, wav, ogg, flac)'); return; }
    setUploadingMusic(true); setUploadMusicProgress(0);
    const formData = new FormData(); formData.append('music', file);
    try {
      const xhr = new XMLHttpRequest();
      await new Promise((res, rej) => {
        xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadMusicProgress(Math.round(e.loaded / e.total * 100)); };
        xhr.onload = () => xhr.status === 200 ? res() : rej(new Error(JSON.parse(xhr.responseText)?.error || 'Error'));
        xhr.onerror = () => rej(new Error('Error de red'));
        xhr.open('POST', `${API}/api/cctv/music`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
      await fetchMusic(); showSuccess('Música subida correctamente');
    } catch (e) { showError(e.message); }
    finally { setUploadingMusic(false); setUploadMusicProgress(0); if (musicInputRef.current) musicInputRef.current.value = ''; }
  };

  const handleUploadImages = async (files) => {
    if (!files?.length) return;
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const valid = Array.from(files).filter(f => allowed.includes('.' + f.name.split('.').pop().toLowerCase()));
    if (!valid.length) { showError('Solo se permiten imágenes (jpg, png, gif, webp)'); return; }
    setUploadingImages(true); setUploadImagesProgress(0);
    const formData = new FormData();
    valid.forEach(f => formData.append('images', f));
    try {
      const xhr = new XMLHttpRequest();
      await new Promise((res, rej) => {
        xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadImagesProgress(Math.round(e.loaded / e.total * 100)); };
        xhr.onload = () => xhr.status === 200 ? res() : rej(new Error(JSON.parse(xhr.responseText)?.error || 'Error'));
        xhr.onerror = () => rej(new Error('Error de red'));
        xhr.open('POST', `${API}/api/cctv/images`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
      await fetchImages();
      showSuccess(`${valid.length} imagen${valid.length > 1 ? 'es' : ''} subida${valid.length > 1 ? 's' : ''}`);
    } catch (e) { showError(e.message); }
    finally { setUploadingImages(false); setUploadImagesProgress(0); if (imageInputRef.current) imageInputRef.current.value = ''; }
  };

  // ── Image management ────────────────────────────────────────────────────────
  const saveDuration = async (id, seconds) => {
    const dur = Math.max(1, Math.min(300, parseInt(seconds) || 5));
    setLocalDurations(d => ({ ...d, [id]: dur }));
    try {
      await fetch(`${API}/api/cctv/images/${id}/duration`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_seconds: dur })
      });
      setImages(imgs => imgs.map(i => i.id === id ? { ...i, duration_seconds: dur } : i));
    } catch (e) { showError(e.message); }
  };

  const moveImage = async (id, direction) => {
    const idx = images.findIndex(i => i.id === id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === images.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newOrder = [...images];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    setImages(newOrder);
    try {
      await fetch(`${API}/api/cctv/images/order`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newOrder.map((img, i) => ({ id: img.id, sort_order: i })) })
      });
    } catch (e) { showError(e.message); await fetchImages(); }
  };

  const deleteImage = async (id) => {
    try {
      const r = await fetch(`${API}/api/cctv/images/${id}`, { method: 'DELETE', headers });
      if (!r.ok) throw new Error((await r.json()).error);
      setImages(imgs => imgs.filter(i => i.id !== id));
      showSuccess('Imagen eliminada');
    } catch (e) { showError(e.message); }
    setDeleteConfirm(null);
  };

  // ── Album management ────────────────────────────────────────────────────────
  const createAlbum = async () => {
    if (!newAlbumName.trim()) return;
    try {
      const r = await fetch(`${API}/api/cctv/albums`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAlbumName.trim() })
      });
      if (!r.ok) throw new Error((await r.json()).error);
      const album = await r.json();
      setAlbums(a => [...a, album]);
      setNewAlbumName('');
      showSuccess('Álbum creado');
    } catch (e) { showError(e.message); }
  };

  const deleteAlbum = async (id) => {
    try {
      const r = await fetch(`${API}/api/cctv/albums/${id}`, { method: 'DELETE', headers });
      if (!r.ok) throw new Error((await r.json()).error);
      setAlbums(a => a.filter(x => x.id !== id));
      if (albumFilter === id) setAlbumFilter(null);
      setImages(imgs => imgs.map(i => i.album_id === id ? { ...i, album_id: null } : i));
      showSuccess('Álbum eliminado');
    } catch (e) { showError(e.message); }
    setDeleteConfirm(null);
  };

  const assignImageAlbum = async (imageId, albumId) => {
    try {
      const r = await fetch(`${API}/api/cctv/images/${imageId}/album`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ album_id: albumId ? parseInt(albumId) : null })
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setImages(imgs => imgs.map(i => i.id === imageId ? { ...i, album_id: albumId ? parseInt(albumId) : null } : i));
    } catch (e) { showError(e.message); }
  };

  const assignScreenAlbum = async (screenId, albumId) => {
    try {
      const r = await fetch(`${API}/api/cctv/screens/${screenId}/album`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ album_id: albumId || null })
      });
      if (!r.ok) throw new Error((await r.json()).error);
      await fetchScreens();
      showSuccess(albumId ? 'Álbum asignado a la pantalla' : 'Pantalla configurada para mostrar todas las imágenes');
      setAssignAlbumModal(null);
    } catch (e) { showError(e.message); }
  };

  // ── Screen controls ─────────────────────────────────────────────────────────
  const setScreenMode = async (screen, mode) => {
    try {
      const r = await fetch(`${API}/api/cctv/screens/${screen.id}/mode`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setScreens(s => s.map(x => x.id === screen.id ? { ...x, display_mode: mode } : x));
      showSuccess(`Pantalla cambiada a ${mode === 'images' ? 'modo imágenes' : 'modo video'}`);
    } catch (e) { showError(e.message); }
  };

  const toggleMute = async (screen) => {
    const newMuted = !screen.video_muted;
    try {
      const r = await fetch(`${API}/api/cctv/screens/${screen.id}/mute`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted: newMuted })
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setScreens(s => s.map(x => x.id === screen.id ? { ...x, video_muted: newMuted } : x));
      showSuccess(newMuted ? 'Video muteado' : 'Audio del video activado');
    } catch (e) { showError(e.message); }
  };

  const assignVideo = async (screenId, videoId) => {
    try {
      const r = await fetch(`${API}/api/cctv/screens/${screenId}/assign`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId || null })
      });
      if (!r.ok) throw new Error((await r.json()).error);
      await fetchScreens(); showSuccess('Video asignado'); setAssignModal(null);
    } catch (e) { showError(e.message); }
  };

  const assignMusic = async (screenId, musicId) => {
    try {
      const r = await fetch(`${API}/api/cctv/screens/${screenId}/music`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ music_id: musicId || null })
      });
      if (!r.ok) throw new Error((await r.json()).error);
      await fetchScreens(); showSuccess(musicId ? 'Música asignada' : 'Música removida'); setAssignMusicModal(null);
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
      await fetchScreens(); showSuccess('Pantalla renombrada'); setRenameModal(null);
    } catch (e) { showError(e.message); }
  };

  const openPowerLog = async (screen) => {
    setLoadingLog(true); setPowerLogModal({ screen, log: [] });
    try {
      const r = await fetch(`${API}/api/cctv/screens/${screen.id}/power-log`, { headers });
      if (r.ok) setPowerLogModal({ screen, log: await r.json() });
    } catch { } finally { setLoadingLog(false); }
  };

  const deleteVideo = async (id) => {
    try {
      const r = await fetch(`${API}/api/cctv/videos/${id}`, { method: 'DELETE', headers });
      if (!r.ok) throw new Error((await r.json()).error);
      setVideos(v => v.filter(x => x.id !== id)); showSuccess('Video eliminado');
    } catch (e) { showError(e.message); }
    setDeleteConfirm(null);
  };

  const deleteMusic = async (id) => {
    try {
      const r = await fetch(`${API}/api/cctv/music/${id}`, { method: 'DELETE', headers });
      if (!r.ok) throw new Error((await r.json()).error);
      setMusic(m => m.filter(x => x.id !== id)); await fetchScreens(); showSuccess('Música eliminada');
    } catch (e) { showError(e.message); }
    setDeleteConfirm(null);
  };

  const deleteScreen = async (id) => {
    try {
      const r = await fetch(`${API}/api/cctv/screens/${id}`, { method: 'DELETE', headers });
      if (!r.ok) throw new Error((await r.json()).error);
      setScreens(s => s.filter(x => x.id !== id)); showSuccess('Pantalla eliminada');
    } catch (e) { showError(e.message); }
    setDeleteConfirm(null);
  };

  const copyStoreCode = () => {
    if (!selectedStore?.code) return;
    navigator.clipboard.writeText(selectedStore.code);
    setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000);
  };

  const totalLoopTime = images.reduce((s, i) => s + (localDurations[i.id] ?? i.duration_seconds), 0);
  const filteredImages = albumFilter !== null ? images.filter(i => i.album_id === albumFilter) : images;

  // ── Upload zone helper ──────────────────────────────────────────────────────
  const UploadZone = ({ onUpload, uploading, progress, accept, icon, label, hint, dragOverState, setDragOverState, inputRef, multiple }) => (
    <div
      onDragOver={e => { e.preventDefault(); setDragOverState(true); }}
      onDragLeave={() => setDragOverState(false)}
      onDrop={e => { e.preventDefault(); setDragOverState(false); multiple ? onUpload(e.dataTransfer.files) : onUpload(e.dataTransfer.files[0]); }}
      onClick={() => !uploading && inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragOverState ? GOLD : '#d4d4d8'}`, borderRadius: 12,
        padding: '36px 24px', textAlign: 'center', cursor: uploading ? 'default' : 'pointer',
        background: dragOverState ? '#fffbeb' : '#fafafa', transition: 'all 0.2s', marginBottom: 24
      }}
    >
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} style={{ display: 'none' }}
        onChange={e => multiple ? onUpload(e.target.files) : onUpload(e.target.files[0])} />
      {uploading ? (
        <div>
          <div style={{ color: '#09090b', fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Subiendo... {progress}%</div>
          <div style={{ height: 6, background: '#e4e4e7', borderRadius: 4, overflow: 'hidden', maxWidth: 360, margin: '0 auto' }}>
            <div style={{ height: '100%', background: GOLD, borderRadius: 4, width: `${progress}%`, transition: 'width 0.3s' }} />
          </div>
        </div>
      ) : (
        <>
          <div style={{ width: 44, height: 44, background: '#f4f4f5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <FontAwesomeIcon icon={icon} style={{ fontSize: 18, color: '#71717a' }} />
          </div>
          <div style={{ color: '#09090b', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{label}</div>
          <div style={{ color: '#71717a', fontSize: 13 }}>{hint}</div>
        </>
      )}
    </div>
  );

  return (
    <div style={{ padding: '20px 12px', fontFamily: 'inherit', maxWidth: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, background: GOLD, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FontAwesomeIcon icon={faVideo} style={{ color: '#0a0a0a', fontSize: 15 }} />
          </div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#09090b' }}>Cartelería Digital</h1>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#71717a' }}>Control remoto de pantallas TV</p>
      </div>

      {/* Alerts */}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '11px 16px', color: '#991b1b', marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}><FontAwesomeIcon icon={faExclamationTriangle} />{error}</div>}
      {success && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '11px 16px', color: '#15803d', marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}><FontAwesomeIcon icon={faCheck} />{success}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', marginBottom: 20, borderBottom: '1px solid #e4e4e7' }}>
        {[
          ['videos', faVideo, 'Videos', videos.length],
          ['images', faImage, 'Imágenes', images.length],
          ['music', faMusic, 'Música', music.length],
          ['screens', faDesktop, 'Pantallas', screens.length],
        ].map(([key, icon, label, count]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: '9px 4px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: tab === key ? `2px solid ${GOLD}` : '2px solid transparent',
            color: tab === key ? '#09090b' : '#71717a', fontWeight: tab === key ? 700 : 500, fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            marginBottom: -1, transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}>
            <FontAwesomeIcon icon={icon} style={{ fontSize: 12 }} />
            {label}
            {count > 0 && <span style={{ background: tab === key ? GOLD : '#f4f4f5', color: tab === key ? '#0a0a0a' : '#71717a', borderRadius: 20, padding: '1px 5px', fontSize: 10, fontWeight: 700 }}>{count}</span>}
          </button>
        ))}
      </div>

      {/* VIDEOS TAB */}
      {tab === 'videos' && (
        <div>
          <UploadZone onUpload={handleUpload} uploading={uploading} progress={uploadProgress} accept="video/*"
            icon={faUpload} label="Arrastra un video aquí o haz clic para seleccionar"
            hint="MP4, WebM, AVI, MOV, MKV — hasta 4 GB"
            dragOverState={dragOver} setDragOverState={setDragOver} inputRef={fileInputRef} multiple={false} />
          {loadingVideos ? <div style={{ textAlign: 'center', color: '#71717a', padding: 40 }}>Cargando...</div>
            : videos.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#71717a' }}>No hay videos subidos aún</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {videos.map(v => (
                <div key={v.id} style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, background: '#fff8e1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FontAwesomeIcon icon={faPlay} style={{ color: GOLD, fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#09090b', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.original_name}</div>
                    <div style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{formatBytes(v.file_size)} · {formatDate(v.created_at)}</div>
                  </div>
                  <button onClick={() => setDeleteConfirm({ type: 'video', id: v.id, name: v.original_name })}
                    style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', color: '#dc2626' }}>
                    <FontAwesomeIcon icon={faTrash} style={{ fontSize: 13 }} />
                  </button>
                </div>
              ))}
            </div>}
        </div>
      )}

      {/* IMAGES TAB */}
      {tab === 'images' && (
        <div>
          <UploadZone onUpload={handleUploadImages} uploading={uploadingImages} progress={uploadImagesProgress} accept="image/*"
            icon={faImage} label="Arrastra imágenes aquí o haz clic para seleccionar (múltiples)"
            hint="JPG, PNG, GIF, WebP — hasta 20 MB por imagen"
            dragOverState={dragOverImages} setDragOverState={setDragOverImages} inputRef={imageInputRef} multiple={true} />

          {/* Albums section */}
          <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <FontAwesomeIcon icon={faFolder} style={{ color: GOLD, fontSize: 14 }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: '#09090b' }}>Álbumes</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: albums.length > 0 ? 12 : 0 }}>
              <input
                value={newAlbumName}
                onChange={e => setNewAlbumName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createAlbum()}
                placeholder="Nuevo álbum..."
                style={{ padding: '7px 12px', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fafafa', flex: '1 1 160px', minWidth: 120 }}
              />
              <button onClick={createAlbum} disabled={!newAlbumName.trim()}
                style={{ padding: '7px 16px', background: GOLD, border: 'none', borderRadius: 8, cursor: newAlbumName.trim() ? 'pointer' : 'default', color: '#0a0a0a', fontWeight: 700, fontSize: 13, opacity: newAlbumName.trim() ? 1 : 0.5 }}>
                Crear
              </button>
            </div>
            {albums.length > 0 ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {albums.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', background: albumFilter === a.id ? GOLD : '#f4f4f5', borderRadius: 20, overflow: 'hidden', border: `1px solid ${albumFilter === a.id ? GOLD : '#e4e4e7'}` }}>
                    <button onClick={() => setAlbumFilter(albumFilter === a.id ? null : a.id)}
                      style={{ padding: '5px 12px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: albumFilter === a.id ? '#0a0a0a' : '#71717a', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <FontAwesomeIcon icon={faFolder} style={{ fontSize: 11 }} />
                      {a.name}
                      <span style={{ fontSize: 11, color: albumFilter === a.id ? '#0a0a0a' : '#a1a1aa' }}>({images.filter(i => i.album_id === a.id).length})</span>
                    </button>
                    <button onClick={() => setDeleteConfirm({ type: 'album', id: a.id, name: a.name })}
                      style={{ padding: '5px 8px', background: 'none', border: 'none', borderLeft: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer', color: albumFilter === a.id ? '#0a0a0a' : '#a1a1aa' }}>
                      <FontAwesomeIcon icon={faTimes} style={{ fontSize: 10 }} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#a1a1aa', fontSize: 13 }}>Crea álbumes para agrupar imágenes y asignarlas por pantalla.</div>
            )}
          </div>

          {/* Filter indicator */}
          {albumFilter !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 14px', background: '#fff8e1', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
              <FontAwesomeIcon icon={faFolder} style={{ fontSize: 12 }} />
              Álbum: <strong>{albums.find(a => a.id === albumFilter)?.name}</strong>
              <button onClick={() => setAlbumFilter(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <FontAwesomeIcon icon={faTimes} /> Ver todas
              </button>
            </div>
          )}

          {filteredImages.length > 0 && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#0369a1', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <span><strong>{filteredImages.length}</strong> imagen{filteredImages.length !== 1 ? 'es' : ''}</span>
              <span>·</span>
              <span>Loop: <strong>{formatSeconds(filteredImages.reduce((s, i) => s + (localDurations[i.id] ?? i.duration_seconds), 0))}</strong></span>
              {albumFilter === null && <><span>·</span><span>Asigná el modo imágenes en la pestaña <strong>Pantallas</strong></span></>}
            </div>
          )}

          {loadingImages ? <div style={{ textAlign: 'center', color: '#71717a', padding: 40 }}>Cargando...</div>
            : filteredImages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <div style={{ width: 56, height: 56, background: '#f4f4f5', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <FontAwesomeIcon icon={faImage} style={{ fontSize: 22, color: '#a1a1aa' }} />
                </div>
                <div style={{ color: '#71717a', fontSize: 14, fontWeight: 500 }}>{albumFilter !== null ? 'No hay imágenes en este álbum' : 'No hay imágenes subidas aún'}</div>
                <div style={{ color: '#a1a1aa', fontSize: 13, marginTop: 4 }}>{albumFilter !== null ? 'Asigná imágenes a este álbum con el selector en cada fila' : 'Subí imágenes para crear un slideshow en tus pantallas'}</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredImages.map((img) => {
                  const globalIdx = images.indexOf(img);
                  return (
                    <div key={img.id} style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {/* Orden badge */}
                      <div style={{ width: 28, height: 28, background: '#f4f4f5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#71717a', fontSize: 12, fontWeight: 700 }}>
                        {globalIdx + 1}
                      </div>

                      {/* Thumbnail */}
                      <img src={`${API}${img.url}`} alt={img.original_name}
                        style={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1px solid #e4e4e7' }} />

                      {/* Name */}
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ color: '#09090b', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.original_name}</div>
                        <div style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{formatBytes(img.file_size)}</div>
                      </div>

                      {/* Album selector */}
                      {albums.length > 0 && (
                        <select value={img.album_id ? String(img.album_id) : ''} onChange={e => assignImageAlbum(img.id, e.target.value || null)}
                          style={{ padding: '5px 8px', border: '1px solid #e4e4e7', borderRadius: 7, fontSize: 12, color: img.album_id ? '#7e22ce' : '#a1a1aa', background: img.album_id ? '#fdf4ff' : '#fafafa', cursor: 'pointer', flexShrink: 0, maxWidth: 130 }}>
                          <option value="">Sin álbum</option>
                          {albums.map(a => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
                        </select>
                      )}

                      {/* Duration */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ color: '#71717a', fontSize: 13 }}>Duración:</span>
                        <input type="number" min={1} max={300}
                          value={localDurations[img.id] ?? img.duration_seconds}
                          onChange={e => setLocalDurations(d => ({ ...d, [img.id]: e.target.value }))}
                          onBlur={e => saveDuration(img.id, e.target.value)}
                          style={{ width: 60, padding: '5px 8px', border: '1px solid #e4e4e7', borderRadius: 7, fontSize: 13, fontWeight: 600, color: '#09090b', textAlign: 'center', outline: 'none', background: '#fafafa' }} />
                        <span style={{ color: '#71717a', fontSize: 13 }}>seg</span>
                      </div>

                      {/* Order buttons — hidden when filtering */}
                      {albumFilter === null && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                          <button onClick={() => moveImage(img.id, 'up')} disabled={globalIdx === 0}
                            style={{ background: 'none', border: '1px solid #e4e4e7', borderRadius: 5, padding: '2px 7px', cursor: globalIdx === 0 ? 'default' : 'pointer', color: globalIdx === 0 ? '#d4d4d8' : '#71717a', fontSize: 10 }}>
                            <FontAwesomeIcon icon={faArrowUp} />
                          </button>
                          <button onClick={() => moveImage(img.id, 'down')} disabled={globalIdx === images.length - 1}
                            style={{ background: 'none', border: '1px solid #e4e4e7', borderRadius: 5, padding: '2px 7px', cursor: globalIdx === images.length - 1 ? 'default' : 'pointer', color: globalIdx === images.length - 1 ? '#d4d4d8' : '#71717a', fontSize: 10 }}>
                            <FontAwesomeIcon icon={faArrowDown} />
                          </button>
                        </div>
                      )}

                      {/* Delete */}
                      <button onClick={() => setDeleteConfirm({ type: 'image', id: img.id, name: img.original_name })}
                        style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', color: '#dc2626', flexShrink: 0 }}>
                        <FontAwesomeIcon icon={faTrash} style={{ fontSize: 13 }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      )}

      {/* MUSIC TAB */}
      {tab === 'music' && (
        <div>
          <UploadZone onUpload={handleUploadMusic} uploading={uploadingMusic} progress={uploadMusicProgress} accept="audio/*"
            icon={faMusic} label="Arrastra un archivo de audio aquí o haz clic para seleccionar"
            hint="MP3, M4A, AAC, WAV, OGG, FLAC — hasta 200 MB"
            dragOverState={dragOverMusic} setDragOverState={setDragOverMusic} inputRef={musicInputRef} multiple={false} />
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#0369a1' }}>
            La música se reproduce en loop. Asignala desde la pestaña <strong>Pantallas</strong> → botón <strong>Música</strong>.
          </div>
          {loadingMusic ? <div style={{ textAlign: 'center', color: '#71717a', padding: 40 }}>Cargando...</div>
            : music.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#71717a' }}>No hay música subida aún</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {music.map(m => (
                <div key={m.id} style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, background: '#f0f9ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FontAwesomeIcon icon={faMusic} style={{ color: '#0369a1', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#09090b', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.original_name}</div>
                    <div style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{formatBytes(m.file_size)} · {formatDate(m.created_at)}</div>
                  </div>
                  <button onClick={() => setDeleteConfirm({ type: 'music', id: m.id, name: m.original_name })}
                    style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', color: '#dc2626' }}>
                    <FontAwesomeIcon icon={faTrash} style={{ fontSize: 13 }} />
                  </button>
                </div>
              ))}
            </div>}
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
              Ingresá este código en la app de Cartelería TV para vincular la pantalla.
            </div>
            {selectedStore?.code ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ background: '#09090b', borderRadius: 8, padding: '10px 24px', letterSpacing: 8, fontSize: 26, fontWeight: 900, color: GOLD, fontFamily: 'monospace' }}>
                  {selectedStore.code}
                </div>
                <button onClick={copyStoreCode} style={{ background: copiedCode ? '#f0fdf4' : '#f4f4f5', border: `1px solid ${copiedCode ? '#bbf7d0' : '#e4e4e7'}`, borderRadius: 7, padding: '8px 14px', cursor: 'pointer', color: copiedCode ? '#15803d' : '#09090b', fontWeight: 600, fontSize: 13 }}>
                  <FontAwesomeIcon icon={copiedCode ? faCheck : faCopy} style={{ marginRight: 6 }} />
                  {copiedCode ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            ) : <div style={{ color: '#a1a1aa', fontSize: 13 }}>Seleccioná una tienda para ver el código.</div>}
          </div>

          {loadingScreens ? <div style={{ textAlign: 'center', color: '#71717a', padding: 40 }}>Cargando...</div>
            : screens.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <FontAwesomeIcon icon={faDesktop} style={{ fontSize: 32, color: '#a1a1aa', marginBottom: 12 }} />
                <div style={{ color: '#71717a', fontSize: 14, fontWeight: 500 }}>No hay pantallas vinculadas</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {screens.map(s => {
                  const mode = s.display_mode || 'video';
                  return (
                    <div key={s.id} style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                        {/* Screen info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                          <div style={{ width: 36, height: 36, background: s.is_online ? '#f0fdf4' : '#f4f4f5', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FontAwesomeIcon icon={faDesktop} style={{ color: s.is_online ? '#16a34a' : '#a1a1aa', fontSize: 14 }} />
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ color: '#09090b', fontWeight: 700, fontSize: 14 }}>{s.device_name}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: s.is_online ? '#f0fdf4' : '#f4f4f5', color: s.is_online ? '#15803d' : '#71717a', border: `1px solid ${s.is_online ? '#bbf7d0' : '#e4e4e7'}`, whiteSpace: 'nowrap' }}>
                                {s.is_online ? '● On' : '○ Off'}
                              </span>
                              {/* Mode badge */}
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: mode === 'images' ? '#fdf4ff' : '#fff8e1', color: mode === 'images' ? '#7e22ce' : '#92400e', border: `1px solid ${mode === 'images' ? '#e9d5ff' : '#fde68a'}`, whiteSpace: 'nowrap' }}>
                                {mode === 'images' ? '🖼 Imgs' : '▶ Video'}
                              </span>
                            </div>
                            <div style={{ color: '#a1a1aa', fontSize: 12, marginTop: 2 }}>Última vez: {s.last_seen ? formatDate(s.last_seen) : 'Nunca'}</div>
                            {mode === 'video' && s.video_name && <div style={{ color: '#71717a', fontSize: 12, marginTop: 1 }}>▶ {s.video_name}</div>}
                            {mode === 'images' && (
                              <div style={{ color: '#7e22ce', fontSize: 12, marginTop: 1 }}>
                                {s.album_name
                                  ? <><FontAwesomeIcon icon={faFolder} style={{ fontSize: 10, marginRight: 4 }} />{s.album_name}</>
                                  : `🖼 Todas las imágenes`}
                                {images.length > 0 && ` · loop ${formatSeconds(totalLoopTime)}`}
                              </div>
                            )}
                            {s.music_name && <div style={{ color: '#0369a1', fontSize: 12, marginTop: 1 }}>♪ {s.music_name}</div>}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'flex-start', width: '100%' }}>
                          {/* Mode toggle */}
                          <button onClick={() => setScreenMode(s, mode === 'images' ? 'video' : 'images')}
                            style={{ background: mode === 'images' ? '#fdf4ff' : '#f4f4f5', border: `1px solid ${mode === 'images' ? '#e9d5ff' : '#e4e4e7'}`, borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: mode === 'images' ? '#7e22ce' : '#71717a', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FontAwesomeIcon icon={mode === 'images' ? faVideo : faImage} style={{ fontSize: 11 }} />
                            {mode === 'images' ? 'Video' : 'Imgs'}
                          </button>
                          {/* Mute */}
                          {mode === 'video' && (
                            <button onClick={() => toggleMute(s)}
                              style={{ background: s.video_muted ? '#fef2f2' : '#f0fdf4', border: `1px solid ${s.video_muted ? '#fca5a5' : '#bbf7d0'}`, borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: s.video_muted ? '#dc2626' : '#15803d', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <FontAwesomeIcon icon={s.video_muted ? faVolumeMute : faVolumeUp} style={{ fontSize: 11 }} />
                              {s.video_muted ? 'Mute' : 'Audio'}
                            </button>
                          )}
                          {/* Music */}
                          <button onClick={() => setAssignMusicModal(s)}
                            style={{ background: s.music_name ? '#f0f9ff' : '#f4f4f5', border: `1px solid ${s.music_name ? '#bae6fd' : '#e4e4e7'}`, borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: s.music_name ? '#0369a1' : '#71717a', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FontAwesomeIcon icon={faMusic} style={{ fontSize: 11 }} />
                            Música
                          </button>
                          {/* Album */}
                          {mode === 'images' && (
                            <button onClick={() => setAssignAlbumModal(s)}
                              style={{ background: s.album_name ? '#fdf4ff' : '#f4f4f5', border: `1px solid ${s.album_name ? '#e9d5ff' : '#e4e4e7'}`, borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: s.album_name ? '#7e22ce' : '#71717a', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, maxWidth: 110, overflow: 'hidden' }}>
                              <FontAwesomeIcon icon={faFolder} style={{ fontSize: 11, flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.album_name || 'Álbum'}</span>
                            </button>
                          )}
                          {/* Assign video */}
                          {mode === 'video' && (
                            <button onClick={() => setAssignModal(s)}
                              style={{ background: s.video_name ? '#fff8e1' : '#f4f4f5', border: `1px solid ${s.video_name ? '#fde68a' : '#e4e4e7'}`, borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: s.video_name ? '#92400e' : '#71717a', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <FontAwesomeIcon icon={faVideo} style={{ fontSize: 11 }} />
                              Video
                            </button>
                          )}
                          <button onClick={() => openPowerLog(s)} style={{ background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: '#71717a' }} title="Historial">
                            <FontAwesomeIcon icon={faHistory} style={{ fontSize: 12 }} />
                          </button>
                          <button onClick={() => { setRenameModal(s); setRenameName(s.device_name); }} style={{ background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: '#71717a' }} title="Renombrar">
                            <FontAwesomeIcon icon={faPen} style={{ fontSize: 12 }} />
                          </button>
                          <button onClick={() => setDeleteConfirm({ type: 'screen', id: s.id, name: s.device_name })} style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: '#dc2626' }} title="Eliminar">
                            <FontAwesomeIcon icon={faTrash} style={{ fontSize: 12 }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      )}

      {/* Assign Video Modal */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', width: '90%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Video para <span style={{ color: GOLD }}>{assignModal.device_name}</span></h3>
              <button onClick={() => setAssignModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#a1a1aa' }}><FontAwesomeIcon icon={faTimes} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              <button onClick={() => assignVideo(assignModal.id, null)} style={{ background: '#fafafa', border: '1px solid #e4e4e7', borderRadius: 8, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', color: '#71717a', fontStyle: 'italic', fontSize: 14 }}>Sin video</button>
              {videos.map(v => (
                <button key={v.id} onClick={() => assignVideo(assignModal.id, v.id)} style={{ background: assignModal.current_video_id === v.id ? '#fff8e1' : '#fafafa', border: `1px solid ${assignModal.current_video_id === v.id ? '#fde68a' : '#e4e4e7'}`, borderRadius: 8, padding: '11px 14px', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ color: '#09090b', fontWeight: 600, fontSize: 14 }}>{v.original_name}</div>
                  <div style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{formatBytes(v.file_size)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Assign Music Modal */}
      {assignMusicModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', width: '90%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Música para <span style={{ color: GOLD }}>{assignMusicModal.device_name}</span></h3>
              <button onClick={() => setAssignMusicModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#a1a1aa' }}><FontAwesomeIcon icon={faTimes} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              <button onClick={() => assignMusic(assignMusicModal.id, null)} style={{ background: '#fafafa', border: '1px solid #e4e4e7', borderRadius: 8, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', color: '#71717a', fontStyle: 'italic', fontSize: 14 }}>Sin música</button>
              {music.map(m => (
                <button key={m.id} onClick={() => assignMusic(assignMusicModal.id, m.id)} style={{ background: assignMusicModal.music_id === m.id ? '#f0f9ff' : '#fafafa', border: `1px solid ${assignMusicModal.music_id === m.id ? '#bae6fd' : '#e4e4e7'}`, borderRadius: 8, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FontAwesomeIcon icon={faMusic} style={{ color: '#0369a1', fontSize: 14, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#09090b', fontWeight: 600, fontSize: 14 }}>{m.original_name}</div>
                    <div style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{formatBytes(m.file_size)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', width: '90%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700 }}>Renombrar pantalla</h3>
            <input value={renameName} onChange={e => setRenameName(e.target.value)} onKeyDown={e => e.key === 'Enter' && renameScreen()} placeholder="Nombre de la pantalla" autoFocus
              style={{ width: '100%', padding: '10px 12px', background: '#fafafa', border: '1px solid #e4e4e7', borderRadius: 8, color: '#09090b', fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />
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
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Historial — <span style={{ color: GOLD }}>{powerLogModal.screen.device_name}</span></h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#71717a' }}>Últimos 100 eventos</p>
              </div>
              <button onClick={() => setPowerLogModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#a1a1aa' }}><FontAwesomeIcon icon={faTimes} /></button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loadingLog ? <div style={{ textAlign: 'center', color: '#71717a', padding: 32 }}>Cargando...</div>
                : powerLogModal.log.length === 0 ? <div style={{ textAlign: 'center', color: '#a1a1aa', padding: 32 }}>Sin registros.</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {powerLogModal.log.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 9, background: entry.event === 'on' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${entry.event === 'on' ? '#bbf7d0' : '#fca5a5'}` }}>
                      <FontAwesomeIcon icon={faPowerOff} style={{ color: entry.event === 'on' ? '#16a34a' : '#dc2626', fontSize: 14, flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: 13, color: entry.event === 'on' ? '#15803d' : '#dc2626', minWidth: 60 }}>{entry.event === 'on' ? 'Encendida' : 'Apagada'}</span>
                      <span style={{ color: '#71717a', fontSize: 13 }}>{formatDate(entry.logged_at)}</span>
                    </div>
                  ))}
                </div>}
            </div>
          </div>
        </div>
      )}

      {/* Assign Album Modal */}
      {assignAlbumModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', width: '90%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Imágenes para <span style={{ color: GOLD }}>{assignAlbumModal.device_name}</span></h3>
              <button onClick={() => setAssignAlbumModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#a1a1aa' }}><FontAwesomeIcon icon={faTimes} /></button>
            </div>
            <p style={{ color: '#71717a', fontSize: 13, margin: '0 0 16px' }}>Elegí qué imágenes se muestran en esta pantalla.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
              <button onClick={() => assignScreenAlbum(assignAlbumModal.id, null)}
                style={{ background: !assignAlbumModal.current_album_id ? '#fff8e1' : '#fafafa', border: `1px solid ${!assignAlbumModal.current_album_id ? '#fde68a' : '#e4e4e7'}`, borderRadius: 8, padding: '11px 14px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ color: '#09090b', fontWeight: 600, fontSize: 14 }}>🖼 Todas las imágenes</div>
                <div style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{images.length} imagen{images.length !== 1 ? 'es' : ''}</div>
              </button>
              {albums.map(a => {
                const count = images.filter(i => i.album_id === a.id).length;
                return (
                  <button key={a.id} onClick={() => assignScreenAlbum(assignAlbumModal.id, a.id)}
                    style={{ background: assignAlbumModal.current_album_id === a.id ? '#fdf4ff' : '#fafafa', border: `1px solid ${assignAlbumModal.current_album_id === a.id ? '#e9d5ff' : '#e4e4e7'}`, borderRadius: 8, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FontAwesomeIcon icon={faFolder} style={{ color: GOLD, fontSize: 18, flexShrink: 0 }} />
                    <div>
                      <div style={{ color: '#09090b', fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                      <div style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{count} imagen{count !== 1 ? 'es' : ''}</div>
                    </div>
                  </button>
                );
              })}
              {albums.length === 0 && (
                <div style={{ color: '#a1a1aa', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>
                  No hay álbumes. Creá uno en la pestaña <strong>Imágenes</strong>.
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
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>
              ¿Eliminar {deleteConfirm.type === 'video' ? 'video' : deleteConfirm.type === 'music' ? 'música' : deleteConfirm.type === 'image' ? 'imagen' : deleteConfirm.type === 'album' ? 'álbum' : 'pantalla'}?
            </h3>
            <p style={{ color: '#71717a', fontSize: 14, margin: '0 0 20px' }}><strong style={{ color: '#09090b' }}>{deleteConfirm.name}</strong> será eliminado permanentemente.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '11px', background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: 8, color: '#71717a', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button
                onClick={() => {
                  if (deleteConfirm.type === 'video') deleteVideo(deleteConfirm.id);
                  else if (deleteConfirm.type === 'music') deleteMusic(deleteConfirm.id);
                  else if (deleteConfirm.type === 'image') deleteImage(deleteConfirm.id);
                  else if (deleteConfirm.type === 'album') deleteAlbum(deleteConfirm.id);
                  else deleteScreen(deleteConfirm.id);
                }}
                style={{ flex: 1, padding: '11px', background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
