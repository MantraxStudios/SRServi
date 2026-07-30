import { useState, useEffect, useRef, useContext, Fragment } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StoreContext } from '../../components/Layout';
import PlanLock from '../../components/PlanLock';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faVideo, faUpload, faTrash, faDesktop, faKey, faCopy, faCheck,
  faPlay, faPen, faTimes, faExclamationTriangle, faHistory, faPowerOff,
  faMusic, faVolumeMute, faVolumeUp, faImage, faArrowUp, faArrowDown, faFolder,
  faClock, faPlus, faToggleOn, faToggleOff, faLayerGroup,
  faRotate, faSlidersH, faChevronDown, faChevronUp, faPause,
} from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';
// Las subidas grandes van por un host SIN Cloudflare (DNS only), porque el plan
// free de Cloudflare corta las subidas en 100 MB. Este host pega directo a nginx
// (client_max_body_size 1G). El resto de la app sigue por API (con Cloudflare).
const UPLOAD_API = 'https://upload.srautomatic.com';
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
  const [libOpen, setLibOpen] = useState(null); // sección de biblioteca abierta (acordeón)

  const [videos, setVideos] = useState([]);
  const [screens, setScreens] = useState([]);
  const [music, setMusic] = useState([]);
  const [images, setImages] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [albumFilter, setAlbumFilter] = useState(null);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [assignAlbumModal, setAssignAlbumModal] = useState(null);

  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [renameGroupModal, setRenameGroupModal] = useState(null);
  const [renameGroupName, setRenameGroupName] = useState('');
  const [groupVideoModal, setGroupVideoModal] = useState(null);
  const [groupMusicModal, setGroupMusicModal] = useState(null);
  const [groupAlbumModal, setGroupAlbumModal] = useState(null);
  const [screenGroupModal, setScreenGroupModal] = useState(null);
  const [localVolumes, setLocalVolumes] = useState({});
  const [localIntervals, setLocalIntervals] = useState({});
  const [advancedOpen, setAdvancedOpen] = useState({}); // "Más ajustes" por pantalla

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
  const [generatingMenu, setGeneratingMenu] = useState(false); // orientación en curso o false

  const [localDurations, setLocalDurations] = useState({});

  const [copiedCode, setCopiedCode] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [dragOverMusic, setDragOverMusic] = useState(false);
  const [dragOverImages, setDragOverImages] = useState(false);

  const [assignModal, setAssignModal] = useState(null);
  const [assignMusicModal, setAssignMusicModal] = useState(null);
  const [screenModal, setScreenModal] = useState(null); // id de la pantalla: modal unificado de contenido
  const [renameModal, setRenameModal] = useState(null);
  const [screenSchedules, setScreenSchedules] = useState({}); // { [screenId]: { data, loading } }
  const [expandedSchedules, setExpandedSchedules] = useState({});
  const [scheduleModal, setScheduleModal] = useState(null); // screen object
  const [newSched, setNewSched] = useState({ video_id: '', name: '', start_time: '', end_time: '', days: [] });
  const [renameName, setRenameName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [powerLogModal, setPowerLogModal] = useState(null);
  const [loadingLog, setLoadingLog] = useState(false);

  const fileInputRef = useRef();
  const musicInputRef = useRef();
  const imageInputRef = useRef();
  const mVideoRef = useRef();   // subir video desde el modal de pantalla
  const mImageRef = useRef();   // subir imágenes desde el modal de pantalla
  const mMusicRef = useRef();   // subir música desde el modal de pantalla

  const headers = { Authorization: `Bearer ${token}` };

  const fetchVideos = async () => {
    try { const r = await fetch(`${API}/api/cctv/videos`, { headers }); if (r.ok) setVideos(await r.json()); }
    catch { } finally { setLoadingVideos(false); }
  };
  const fetchScreens = async () => {
    try {
      const r = await fetch(`${API}/api/cctv/screens`, { headers });
      if (r.ok) {
        const data = await r.json();
        setScreens(data);
        const vols = {}, ivs = {};
        data.forEach(s => { vols[s.id] = s.volume_level ?? 100; ivs[s.id] = s.image_interval ?? 5; });
        setLocalVolumes(vols);
        setLocalIntervals(ivs);
        // Cargar los horarios de cada pantalla para dibujar la línea de tiempo
        data.forEach(s => { fetchScreenSchedules(s.id); });
      }
    } catch { } finally { setLoadingScreens(false); }
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
  const fetchGroups = async () => {
    try { const r = await fetch(`${API}/api/cctv/groups`, { headers }); if (r.ok) setGroups(await r.json()); }
    catch { } finally { setLoadingGroups(false); }
  };

  const fetchScreenSchedules = async (screenId) => {
    setScreenSchedules(prev => ({ ...prev, [screenId]: { ...(prev[screenId] || {}), loading: true } }));
    try {
      const r = await fetch(`${API}/api/cctv/screens/${screenId}/schedules`, { headers });
      const data = r.ok ? await r.json() : [];
      setScreenSchedules(prev => ({ ...prev, [screenId]: { data, loading: false } }));
    } catch { setScreenSchedules(prev => ({ ...prev, [screenId]: { data: [], loading: false } })); }
  };

  const toggleScheduleExpand = (screenId) => {
    const next = !expandedSchedules[screenId];
    setExpandedSchedules(prev => ({ ...prev, [screenId]: next }));
    if (next && !screenSchedules[screenId]) fetchScreenSchedules(screenId);
  };

  const createSchedule = async () => {
    if (!scheduleModal || !newSched.video_id || !newSched.start_time) return;
    try {
      const r = await fetch(`${API}/api/cctv/screens/${scheduleModal.id}/schedules`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(newSched)
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setScheduleModal(null);
      setNewSched({ video_id: '', name: '', start_time: '', end_time: '', days: [] });
      await fetchScreenSchedules(scheduleModal.id);
      showSuccess('Horario creado');
    } catch (e) { showError(e.message); }
  };

  const toggleScheduleActive = async (sched, screenId) => {
    try {
      await fetch(`${API}/api/cctv/schedules/${sched.id}`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !sched.active })
      });
      setScreenSchedules(prev => ({
        ...prev,
        [screenId]: { ...prev[screenId], data: prev[screenId].data.map(x => x.id === sched.id ? { ...x, active: !x.active } : x) }
      }));
    } catch (e) { showError(e.message); }
  };

  const deleteSchedule = async (schedId, screenId) => {
    try {
      await fetch(`${API}/api/cctv/schedules/${schedId}`, { method: 'DELETE', headers });
      setScreenSchedules(prev => ({
        ...prev,
        [screenId]: { ...prev[screenId], data: prev[screenId].data.filter(x => x.id !== schedId) }
      }));
      showSuccess('Horario eliminado');
    } catch (e) { showError(e.message); }
  };

  const DAYS_LABELS = { mon: 'L', tue: 'M', wed: 'X', thu: 'J', fri: 'V', sat: 'S', sun: 'D' };
  const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  const toggleSchedDay = (day) => {
    setNewSched(prev => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day]
    }));
  };

  useEffect(() => { fetchVideos(); fetchScreens(); fetchMusic(); fetchImages(); fetchAlbums(); fetchGroups(); }, []);
  useEffect(() => {
    const t = setInterval(fetchScreens, 15000); return () => clearInterval(t);
  }, []);

  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };
  const showError = (msg) => { setError(msg); setTimeout(() => setError(''), 5000); };

  // ── Upload helpers ──────────────────────────────────────────────────────────
  // El proxy/Cloudflare puede rechazar la subida con un 413 y devolver HTML,
  // por eso NO se puede hacer JSON.parse a ciegas (rompía con "Unexpected token '<'").
  const xhrError = (xhr) => {
    if (xhr.status === 413) return 'El archivo es demasiado grande y el servidor lo rechazó. Probá con uno más liviano.';
    try { return JSON.parse(xhr.responseText)?.error || 'Error al subir'; }
    catch { return `Error al subir el archivo (${xhr.status || 'sin conexión'})`; }
  };

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
        xhr.onload = () => xhr.status === 200 ? res() : rej(new Error(xhrError(xhr)));
        xhr.onerror = () => rej(new Error('Error de red'));
        xhr.open('POST', `${UPLOAD_API}/api/cctv/videos`);
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
        xhr.onload = () => xhr.status === 200 ? res() : rej(new Error(xhrError(xhr)));
        xhr.onerror = () => rej(new Error('Error de red'));
        xhr.open('POST', `${UPLOAD_API}/api/cctv/music`);
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
        xhr.onload = () => xhr.status === 200 ? res() : rej(new Error(xhrError(xhr)));
        xhr.onerror = () => rej(new Error('Error de red'));
        xhr.open('POST', `${UPLOAD_API}/api/cctv/images`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });
      await fetchImages();
      showSuccess(`${valid.length} imagen${valid.length > 1 ? 'es' : ''} subida${valid.length > 1 ? 's' : ''}`);
    } catch (e) { showError(e.message); }
    finally { setUploadingImages(false); setUploadImagesProgress(0); if (imageInputRef.current) imageInputRef.current.value = ''; }
  };

  // Genera una imagen del menú (catálogo) de la tienda, la agrega a la biblioteca y
  // la asigna directamente a esta pantalla (la pasa a modo imágenes).
  const generateMenuForScreen = async (screen, orientation) => {
    if (!selectedStore?.id) { showError('Seleccioná una tienda primero'); return; }
    setGeneratingMenu(`${screen.id}:${orientation}`);
    try {
      const r = await fetch(`${API}/api/cctv/generate-menu-image`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: selectedStore.id, orientation }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'No se pudo generar la imagen'); }
      const rows = await r.json();
      setImages(rows);
      const newImg = rows[rows.length - 1]; // la recién creada (mayor sort_order)
      if (newImg && !screen.group_id) {
        await setScreenMode(screen, 'images');
        await assignScreenImage(screen.id, newImg.id);
        showSuccess('Menú generado y enviado a esta pantalla');
      } else {
        showSuccess('Menú generado y agregado a la biblioteca');
      }
    } catch (e) { showError(e.message); }
    finally { setGeneratingMenu(false); }
  };

  // ── Screen volume ───────────────────────────────────────────────────────────
  const setScreenVolume = async (screenId, level) => {
    try {
      await fetch(`${API}/api/cctv/screens/${screenId}/volume`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume_level: level })
      });
      setScreens(s => s.map(x => x.id === screenId ? { ...x, volume_level: level } : x));
    } catch (e) { showError(e.message); }
  };

  // ── Rotación de la pantalla (0/90/180/270) ────────────────────────────────────
  const rotateScreen = async (screen) => {
    const next = (((screen.rotation || 0) + 90) % 360);
    setScreens(s => s.map(x => x.id === screen.id ? { ...x, rotation: next } : x));
    try {
      await fetch(`${API}/api/cctv/screens/${screen.id}/rotation`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotation: next })
      });
    } catch (e) { showError(e.message); }
  };

  // ── Intervalo de imágenes/videos por pantalla (segundos) ──────────────────────
  const saveInterval = async (screenId, seconds) => {
    const iv = Math.max(1, Math.min(3600, parseInt(seconds) || 5));
    setLocalIntervals(v => ({ ...v, [screenId]: iv }));
    setScreens(s => s.map(x => x.id === screenId ? { ...x, image_interval: iv } : x));
    try {
      await fetch(`${API}/api/cctv/screens/${screenId}/interval`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_interval: iv })
      });
    } catch (e) { showError(e.message); }
  };

  // ── Image management ────────────────────────────────────────────────────────
  const saveDuration = async (id, seconds) => {
    const parsed = parseInt(seconds);
    const dur = parsed === 0 ? 0 : Math.max(1, Math.min(300, parsed || 5));
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

  // Asigna UNA sola imagen a la pantalla (imageId null = volver a álbum/todas).
  const assignScreenImage = async (screenId, imageId) => {
    try {
      const r = await fetch(`${API}/api/cctv/screens/${screenId}/image`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: imageId || null })
      });
      if (!r.ok) throw new Error((await r.json()).error);
      await fetchScreens();
      showSuccess(imageId ? 'Imagen asignada a la pantalla' : 'Volviste a mostrar el álbum/todas');
    } catch (e) { showError(e.message); }
  };

  // ── Group management ──────────────────────────────────────────────────────────
  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const r = await fetch(`${API}/api/cctv/groups`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName.trim() })
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setNewGroupName('');
      await fetchGroups();
      showSuccess('Grupo creado');
    } catch (e) { showError(e.message); }
  };

  const updateGroup = async (id, patch, msg) => {
    try {
      const r = await fetch(`${API}/api/cctv/groups/${id}`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      if (!r.ok) throw new Error((await r.json()).error);
      await fetchGroups();
      if (msg) showSuccess(msg);
    } catch (e) { showError(e.message); }
  };

  const renameGroup = async () => {
    if (!renameGroupModal || !renameGroupName.trim()) return;
    await updateGroup(renameGroupModal.id, { name: renameGroupName.trim() }, 'Grupo renombrado');
    setRenameGroupModal(null);
  };

  const deleteGroup = async (id) => {
    try {
      const r = await fetch(`${API}/api/cctv/groups/${id}`, { method: 'DELETE', headers });
      if (!r.ok) throw new Error((await r.json()).error);
      await fetchGroups(); await fetchScreens();
      showSuccess('Grupo eliminado');
    } catch (e) { showError(e.message); }
    setDeleteConfirm(null);
  };

  const assignScreenGroup = async (screenId, groupId) => {
    try {
      const r = await fetch(`${API}/api/cctv/screens/${screenId}/group`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId || null })
      });
      if (!r.ok) throw new Error((await r.json()).error);
      await fetchScreens(); await fetchGroups();
      showSuccess(groupId ? 'Pantalla agregada al grupo' : 'Pantalla quitada del grupo');
      setScreenGroupModal(null);
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
      showSuccess(`Pantalla cambiada a ${mode === 'images' ? 'modo imágenes' : mode === 'all' ? 'modo todo (videos + imágenes)' : 'modo video'}`);
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

  // Reproducir TODOS los videos en loop (playlist).
  const assignScreenVideoAll = async (screenId) => {
    try {
      const r = await fetch(`${API}/api/cctv/screens/${screenId}/video-all`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ play_all: true })
      });
      if (!r.ok) throw new Error((await r.json()).error);
      await fetchScreens(); showSuccess('Reproduciendo todos los videos');
    } catch (e) { showError(e.message); }
  };

  // Reproducir TODA la música en secuencia (playlist).
  const assignScreenMusicAll = async (screenId) => {
    try {
      const r = await fetch(`${API}/api/cctv/screens/${screenId}/music-all`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ play_all: true })
      });
      if (!r.ok) throw new Error((await r.json()).error);
      await fetchScreens(); showSuccess('Reproduciendo toda la música');
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

  // Devuelve la miniatura/preview del contenido que la pantalla está reproduciendo.
  const screenPreview = (s) => {
    const mode = s.display_mode || 'video';
    if (mode === 'all') {
      if (videos[0]?.url) return { type: 'video', src: `${API}${videos[0].url}`, empty: false };
      if (images[0]?.url) return { type: 'image', src: `${API}${images[0].url}`, empty: false };
      return { type: 'video', src: null, empty: true };
    }
    if (mode === 'images') {
      if (s.current_image_id) {
        const one = images.find(i => i.id === s.current_image_id);
        if (one) return { type: 'image', src: `${API}${one.url}`, empty: false };
      }
      const pool = s.current_album_id ? images.filter(i => i.album_id === s.current_album_id) : images;
      if (pool.length) return { type: 'image', src: `${API}${pool[0].url}`, empty: false };
      return { type: 'image', src: null, empty: true };
    }
    if (s.video_url) return { type: 'video', src: `${API}${s.video_url}`, empty: false };
    if (s.video_play_all && videos[0]?.url) return { type: 'video', src: `${API}${videos[0].url}`, empty: false };
    return { type: 'video', src: null, empty: true };
  };

  // Convierte "HH:MM" a fracción del día (0..1) para posicionar en la línea de tiempo.
  const timeToPct = (t) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return Math.min(1, Math.max(0, ((h * 60 + (m || 0)) / 1440)));
  };

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
    <PlanLock feature="cctv" title="Cartelería Digital" description="El módulo de Cartelería/CCTV para controlar tus pantallas TV está disponible en los planes de pago. Actualizá tu plan para desbloquearlo.">
    <div style={{ padding: '20px 12px', fontFamily: 'inherit', maxWidth: 1180, margin: '0 auto', boxSizing: 'border-box' }}>
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

      {/* ══════════ VINCULAR PANTALLA (arriba, junto al código) ══════════ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 14px' }}>
        <FontAwesomeIcon icon={faKey} style={{ color: GOLD, fontSize: 14 }} />
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#09090b' }}>Vincular pantalla</h2>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <FontAwesomeIcon icon={faKey} style={{ color: GOLD, fontSize: 14 }} />
          <span style={{ color: '#09090b', fontWeight: 700, fontSize: 14 }}>Vincular una nueva pantalla</span>
        </div>
        <div style={{ color: '#71717a', fontSize: 12, marginBottom: 12 }}>Ingresá este código en la app de Cartelería TV.</div>
        {selectedStore?.code ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ background: '#09090b', borderRadius: 8, padding: '8px 20px', letterSpacing: 6, fontSize: 22, fontWeight: 900, color: GOLD, fontFamily: 'monospace' }}>{selectedStore.code}</div>
            <button onClick={copyStoreCode} style={{ background: copiedCode ? '#f0fdf4' : '#f4f4f5', border: `1px solid ${copiedCode ? '#bbf7d0' : '#e4e4e7'}`, borderRadius: 7, padding: '8px 14px', cursor: 'pointer', color: copiedCode ? '#15803d' : '#09090b', fontWeight: 600, fontSize: 13 }}>
              <FontAwesomeIcon icon={copiedCode ? faCheck : faCopy} style={{ marginRight: 6 }} />{copiedCode ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        ) : <div style={{ color: '#a1a1aa', fontSize: 13 }}>Seleccioná una tienda para ver el código.</div>}
      </div>

      {/* ══════════ VISTA PRINCIPAL: PANTALLAS (estilo control remoto) ══════════ */}
      {loadingScreens ? (
        <div style={{ textAlign: 'center', color: '#71717a', padding: 40 }}>Cargando pantallas...</div>
      ) : screens.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', border: '1px solid #e4e4e7', borderRadius: 14, marginBottom: 24 }}>
          <FontAwesomeIcon icon={faDesktop} style={{ fontSize: 30, color: '#a1a1aa', marginBottom: 10 }} />
          <div style={{ color: '#09090b', fontSize: 15, fontWeight: 600 }}>No hay pantallas vinculadas</div>
          <div style={{ color: '#a1a1aa', fontSize: 13, marginTop: 4 }}>Vinculá una TV con el código de arriba.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 440px), 1fr))', gap: 20, marginBottom: 28 }}>
          {screens.map(s => {
            const mode = s.display_mode || 'video';
            const grouped = !!s.group_id;
            const prev = screenPreview(s);
            const rot = s.rotation || 0;
            const scheds = screenSchedules[s.id]?.data || [];
            const adv = !!advancedOpen[s.id];
            return (
              <div key={s.id} style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 16, padding: 14 }}>
                {/* Nombre + estado */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <FontAwesomeIcon icon={faDesktop} style={{ fontSize: 14, color: s.is_online ? '#16a34a' : '#a1a1aa', flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#09090b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.device_name}</span>
                  <button onClick={() => { setRenameModal(s); setRenameName(s.device_name); }} title="Editar nombre"
                    style={{ width: 22, height: 22, borderRadius: 6, background: '#f4f4f5', border: '1px solid #e4e4e7', cursor: 'pointer', color: '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
                    <FontAwesomeIcon icon={faPen} style={{ fontSize: 9 }} />
                  </button>
                  {grouped && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <FontAwesomeIcon icon={faLayerGroup} style={{ fontSize: 9 }} />{s.group_name}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: s.is_online ? '#f0fdf4' : '#f4f4f5', color: s.is_online ? '#15803d' : '#71717a', border: `1px solid ${s.is_online ? '#bbf7d0' : '#e4e4e7'}`, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {s.is_online ? '● En vivo' : '○ Offline'}
                  </span>
                </div>

                {/* Vista previa (clic para configurar) con Girar en overlay */}
                <div
                  onClick={() => setScreenModal(s.id)}
                  title={grouped ? 'Controlada por el grupo — tocá para configurar' : 'Tocá para cambiar el contenido'}
                  style={{ position: 'relative', aspectRatio: '16 / 9', background: '#0a0a0a', borderRadius: 12, overflow: 'hidden', border: '1px solid #e4e4e7', cursor: 'pointer' }}>
                  {prev.empty ? (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center', color: '#a1a1aa', fontSize: 13, fontWeight: 600 }}>
                      <FontAwesomeIcon icon={mode === 'images' ? faImage : faVideo} style={{ fontSize: 20 }} />
                      Sin contenido
                    </div>
                  ) : prev.type === 'video' ? (
                    <video src={`${prev.src}#t=0.5`} muted playsInline preload="metadata"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `rotate(${rot}deg)` }} />
                  ) : (
                    <img src={prev.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `rotate(${rot}deg)` }} />
                  )}
                  {/* Girar (overlay arriba-derecha) */}
                  <button onClick={e => { e.stopPropagation(); rotateScreen(s); }} title={`Girar (actual ${rot}°)`}
                    style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesomeIcon icon={faRotate} style={{ fontSize: 13 }} />
                  </button>
                  {/* Etiqueta del contenido + acción de cambiar */}
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '18px 8px 7px', display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(transparent, rgba(0,0,0,0.78))', pointerEvents: 'none' }}>
                    <span style={{ flex: 1, minWidth: 0, color: '#fff', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {grouped ? `Grupo: ${s.group_name}` : mode === 'all' ? 'Todo (videos + imágenes)' : mode === 'images' ? (s.image_name || s.album_name || 'Todas las imágenes') : (s.video_play_all ? 'Todos los videos' : (s.video_name || 'Sin video'))}
                    </span>
                    {!grouped && (
                      <span style={{ background: GOLD, color: '#0a0a0a', fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <FontAwesomeIcon icon={faPen} style={{ fontSize: 9 }} />Cambiar
                      </span>
                    )}
                  </div>
                </div>

                {/* Horario */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '14px 0 6px' }}>
                  <FontAwesomeIcon icon={faClock} style={{ fontSize: 12, color: GOLD }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#09090b' }}>Horario</span>
                  <button onClick={() => setScheduleModal(s)} style={{ marginLeft: 'auto', background: '#fffdf5', border: `1px solid ${GOLD}`, borderRadius: 20, color: '#92400e', fontSize: 12, fontWeight: 700, padding: '3px 11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} />Agregar
                  </button>
                </div>
                <div style={{ position: 'relative', background: '#0a0a0a', borderRadius: 9, height: 46, padding: '0 4px', marginBottom: scheds.length > 0 ? 8 : 0 }}>
                  <div style={{ position: 'absolute', left: 6, right: 6, top: 17, height: 2, background: GOLD, opacity: 0.4, borderRadius: 2 }} />
                  {scheds.filter(sc => sc.active).map(sc => (
                    <button key={sc.id} onClick={() => setScheduleModal(s)} title={`${sc.name || sc.video_name}`}
                      style={{ position: 'absolute', top: 8, left: `calc(6px + ${timeToPct(sc.start_time)} * (100% - 12px))`, transform: 'translateX(-50%)', minWidth: 40, borderRadius: 6, border: `1px solid ${GOLD}`, background: '#26210f', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1px 4px' }}>
                      <FontAwesomeIcon icon={faPlay} style={{ color: GOLD, fontSize: 7 }} />
                      <span style={{ color: GOLD, fontSize: 9, fontWeight: 700 }}>{sc.start_time}</span>
                    </button>
                  ))}
                  {/* marcas de hora (abajo) */}
                  {[['00:00', 0], ['06', 25], ['12', 50], ['18', 75], ['24:00', 100]].map(([lbl, pct]) => (
                    <span key={lbl} style={{ position: 'absolute', bottom: 3, left: `calc(6px + ${pct / 100} * (100% - 12px))`, transform: pct === 0 ? 'none' : pct === 100 ? 'translateX(-100%)' : 'translateX(-50%)', color: '#71717a', fontSize: 9 }}>{lbl}</span>
                  ))}
                  {scheds.filter(sc => sc.active).length === 0 && (
                    <span style={{ position: 'absolute', top: 15, left: '50%', transform: 'translateX(-50%)', color: '#71717a', fontSize: 11, fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                      Sin horarios (siempre lo mismo)
                    </span>
                  )}
                </div>
                {scheds.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                    {scheds.map(sc => (
                      <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: sc.active ? '#fffdf5' : '#f4f4f5', border: `1px solid ${sc.active ? '#fde68a' : '#e4e4e7'}`, borderRadius: 20, padding: '3px 6px 3px 10px', fontSize: 11 }}>
                        <span style={{ fontWeight: 700, color: '#09090b' }}>{sc.start_time}{sc.end_time ? `–${sc.end_time}` : ''}</span>
                        <span style={{ color: '#71717a', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.name || sc.video_name}</span>
                        <button onClick={() => toggleScheduleActive(sc, s.id)} title={sc.active ? 'Desactivar' : 'Activar'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: sc.active ? '#16a34a' : '#a1a1aa', fontSize: 13, padding: 0 }}>
                          <FontAwesomeIcon icon={sc.active ? faToggleOn : faToggleOff} />
                        </button>
                        <button onClick={() => deleteSchedule(sc.id, s.id)} title="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 11, padding: 0 }}>
                          <FontAwesomeIcon icon={faTimes} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Más ajustes (colapsable) */}
                <button onClick={() => setAdvancedOpen(o => ({ ...o, [s.id]: !o[s.id] }))}
                  style={{ marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}>
                  <FontAwesomeIcon icon={faSlidersH} style={{ fontSize: 12, color: GOLD }} />
                  Más ajustes
                  <FontAwesomeIcon icon={adv ? faChevronUp : faChevronDown} style={{ fontSize: 10 }} />
                </button>

                {adv && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f4f4f5', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => openPowerLog(s)} style={{ background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: 7, padding: '7px 10px', cursor: 'pointer', color: '#71717a', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }} title="Historial de encendido">
                        <FontAwesomeIcon icon={faHistory} style={{ fontSize: 11 }} />Historial
                      </button>
                      <button onClick={() => setDeleteConfirm({ type: 'screen', id: s.id, name: s.device_name })} style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, padding: '7px 10px', cursor: 'pointer', color: '#dc2626', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11 }} />Eliminar
                      </button>
                    </div>

                    {/* Generar imagen del menú (catálogo de la tienda) para esta pantalla */}
                    <div style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fff 100%)', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                        <FontAwesomeIcon icon={faImage} style={{ color: GOLD, fontSize: 12 }} />
                        <span style={{ fontWeight: 700, fontSize: 12.5, color: '#09090b' }}>Imagen del menú</span>
                      </div>
                      <div style={{ color: '#71717a', fontSize: 11.5, marginBottom: 9, lineHeight: 1.4 }}>
                        {grouped
                          ? 'Genera una imagen con tus productos (se agrega a la biblioteca; esta pantalla la controla el grupo).'
                          : 'Genera una imagen con tus productos y la envía a esta pantalla.'}
                        {!selectedStore && <span style={{ color: '#b45309', fontWeight: 600 }}> Seleccioná una tienda.</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => generateMenuForScreen(s, 'landscape')} disabled={!selectedStore || !!generatingMenu}
                          style={{ padding: '7px 12px', background: GOLD, border: 'none', borderRadius: 7, cursor: (!selectedStore || generatingMenu) ? 'default' : 'pointer', color: '#0a0a0a', fontWeight: 700, fontSize: 12, opacity: (!selectedStore || generatingMenu) ? 0.55 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FontAwesomeIcon icon={generatingMenu === `${s.id}:landscape` ? faRotate : faDesktop} spin={generatingMenu === `${s.id}:landscape`} style={{ fontSize: 11 }} />
                          Horizontal 1920×1080
                        </button>
                        <button onClick={() => generateMenuForScreen(s, 'portrait')} disabled={!selectedStore || !!generatingMenu}
                          style={{ padding: '7px 12px', background: '#fff', border: `1px solid ${GOLD}`, borderRadius: 7, cursor: (!selectedStore || generatingMenu) ? 'default' : 'pointer', color: '#92400e', fontWeight: 700, fontSize: 12, opacity: (!selectedStore || generatingMenu) ? 0.55 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FontAwesomeIcon icon={generatingMenu === `${s.id}:portrait` ? faRotate : faImage} spin={generatingMenu === `${s.id}:portrait`} style={{ fontSize: 11 }} />
                          Vertical 1080×1920
                        </button>
                      </div>
                    </div>

                    {/* Volumen */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FontAwesomeIcon icon={localVolumes[s.id] === 0 ? faVolumeMute : faVolumeUp} style={{ color: localVolumes[s.id] === 0 ? '#dc2626' : '#71717a', fontSize: 12, flexShrink: 0 }} />
                      <input type="range" min={0} max={100} step={5}
                        value={localVolumes[s.id] ?? 100}
                        onChange={e => setLocalVolumes(v => ({ ...v, [s.id]: parseInt(e.target.value) }))}
                        onMouseUp={e => setScreenVolume(s.id, parseInt(e.target.value))}
                        onTouchEnd={e => setScreenVolume(s.id, parseInt(e.target.value))}
                        style={{ flex: 1, accentColor: GOLD, cursor: 'pointer', height: 4 }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#71717a', minWidth: 32, textAlign: 'right' }}>{localVolumes[s.id] ?? 100}%</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Biblioteca (videos/imágenes/música/grupos) oculta: todo se gestiona desde el
          modal de cada pantalla al tocar la vista previa. */}

      {/* VIDEOS */}
      {libOpen === 'videos' && (
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

      {/* IMAGES */}
      {libOpen === 'images' && (
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
              <span>Loop: <strong>
                {filteredImages.some(i => parseInt(localDurations[i.id] ?? i.duration_seconds) === 0)
                  ? '∞'
                  : formatSeconds(filteredImages.reduce((s, i) => s + (parseInt(localDurations[i.id] ?? i.duration_seconds) || 0), 0))
                }
              </strong></span>
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
                  const durVal = parseInt(localDurations[img.id] ?? img.duration_seconds);
                  const isInfinite = durVal === 0;
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        <span style={{ color: '#71717a', fontSize: 13 }}>Dur:</span>
                        {!isInfinite ? (
                          <>
                            <input type="number" min={1} max={300}
                              value={localDurations[img.id] ?? img.duration_seconds}
                              onChange={e => setLocalDurations(d => ({ ...d, [img.id]: e.target.value }))}
                              onBlur={e => saveDuration(img.id, e.target.value)}
                              style={{ width: 52, padding: '5px 6px', border: '1px solid #e4e4e7', borderRadius: 7, fontSize: 13, fontWeight: 600, color: '#09090b', textAlign: 'center', outline: 'none', background: '#fafafa' }} />
                            <span style={{ color: '#71717a', fontSize: 13 }}>s</span>
                          </>
                        ) : (
                          <span style={{ fontSize: 20, fontWeight: 800, color: '#7e22ce', lineHeight: 1, padding: '0 6px' }}>∞</span>
                        )}
                        <button title={isInfinite ? 'Cambiar a tiempo fijo' : 'Imagen permanente (no cambia)'}
                          onClick={() => { const d = isInfinite ? 5 : 0; setLocalDurations(v => ({ ...v, [img.id]: d })); saveDuration(img.id, d); }}
                          style={{ background: isInfinite ? '#fdf4ff' : '#f4f4f5', border: `1px solid ${isInfinite ? '#e9d5ff' : '#e4e4e7'}`, borderRadius: 7, padding: '4px 8px', cursor: 'pointer', color: isInfinite ? '#7e22ce' : '#71717a', fontSize: 15, fontWeight: 800, lineHeight: 1 }}>
                          ∞
                        </button>
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

      {/* MUSIC */}
      {libOpen === 'music' && (
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

      {/* GROUPS */}
      {libOpen === 'groups' && (
        <div>
          {/* Create group */}
          <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <FontAwesomeIcon icon={faLayerGroup} style={{ color: GOLD, fontSize: 14 }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: '#09090b' }}>Grupos de pantallas</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createGroup()}
                placeholder="Nuevo grupo... (ej: Salón principal)"
                style={{ padding: '7px 12px', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fafafa', flex: '1 1 200px', minWidth: 140 }}
              />
              <button onClick={createGroup} disabled={!newGroupName.trim()}
                style={{ padding: '7px 16px', background: GOLD, border: 'none', borderRadius: 8, cursor: newGroupName.trim() ? 'pointer' : 'default', color: '#0a0a0a', fontWeight: 700, fontSize: 13, opacity: newGroupName.trim() ? 1 : 0.5 }}>
                Crear grupo
              </button>
            </div>
          </div>

          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#0369a1' }}>
            Asigná un video (o música / modo imágenes) al grupo y <strong>todas las pantallas del grupo reproducen lo mismo</strong>. Agregá pantallas a un grupo desde la pestaña <strong>Pantallas</strong> → botón <strong>Grupo</strong>.
          </div>

          {loadingGroups ? <div style={{ textAlign: 'center', color: '#71717a', padding: 40 }}>Cargando...</div>
            : groups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <FontAwesomeIcon icon={faLayerGroup} style={{ fontSize: 32, color: '#a1a1aa', marginBottom: 12 }} />
                <div style={{ color: '#71717a', fontSize: 14, fontWeight: 500 }}>No hay grupos creados</div>
                <div style={{ color: '#a1a1aa', fontSize: 13, marginTop: 4 }}>Creá un grupo para sincronizar el contenido de varias pantallas</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groups.map(g => {
                  const mode = g.display_mode || 'video';
                  const members = screens.filter(s => s.group_id === g.id);
                  return (
                    <div key={g.id} style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12, padding: '14px 16px' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 36, height: 36, background: '#fff8e1', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FontAwesomeIcon icon={faLayerGroup} style={{ color: GOLD, fontSize: 15 }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ color: '#09090b', fontWeight: 700, fontSize: 15 }}>{g.name}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7', whiteSpace: 'nowrap' }}>
                              {g.screen_count} pantalla{g.screen_count !== 1 ? 's' : ''}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: mode === 'images' ? '#fdf4ff' : '#fff8e1', color: mode === 'images' ? '#7e22ce' : '#92400e', border: `1px solid ${mode === 'images' ? '#e9d5ff' : '#fde68a'}`, whiteSpace: 'nowrap' }}>
                              {mode === 'images' ? '🖼 Imgs' : '▶ Video'}
                            </span>
                          </div>
                          <div style={{ marginTop: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {mode === 'video' && g.video_name && <span style={{ color: '#92400e', fontSize: 12 }}>▶ {g.video_name}</span>}
                            {mode === 'images' && <span style={{ color: '#7e22ce', fontSize: 12 }}>{g.album_name ? <><FontAwesomeIcon icon={faFolder} style={{ fontSize: 10, marginRight: 4 }} />{g.album_name}</> : '🖼 Todas las imágenes'}</span>}
                            {g.music_name && <span style={{ color: '#0369a1', fontSize: 12 }}>♪ {g.music_name}</span>}
                          </div>
                        </div>
                        <button onClick={() => { setRenameGroupModal(g); setRenameGroupName(g.name); }} style={{ background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: '#71717a' }} title="Renombrar">
                          <FontAwesomeIcon icon={faPen} style={{ fontSize: 12 }} />
                        </button>
                        <button onClick={() => setDeleteConfirm({ type: 'group', id: g.id, name: g.name })} style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: '#dc2626' }} title="Eliminar">
                          <FontAwesomeIcon icon={faTrash} style={{ fontSize: 12 }} />
                        </button>
                      </div>

                      {/* Playback controls */}
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingBottom: members.length ? 10 : 0, borderBottom: members.length ? '1px solid #f4f4f5' : 'none' }}>
                        <button onClick={() => updateGroup(g.id, { display_mode: mode === 'images' ? 'video' : 'images' })}
                          style={{ background: mode === 'images' ? '#fdf4ff' : '#f4f4f5', border: `1px solid ${mode === 'images' ? '#e9d5ff' : '#e4e4e7'}`, borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: mode === 'images' ? '#7e22ce' : '#71717a', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <FontAwesomeIcon icon={mode === 'images' ? faVideo : faImage} style={{ fontSize: 11 }} />
                          {mode === 'images' ? 'Video' : 'Imgs'}
                        </button>
                        {mode === 'video' && (
                          <button onClick={() => updateGroup(g.id, { video_muted: !g.video_muted })}
                            style={{ background: g.video_muted ? '#fef2f2' : '#f0fdf4', border: `1px solid ${g.video_muted ? '#fca5a5' : '#bbf7d0'}`, borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: g.video_muted ? '#dc2626' : '#15803d', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FontAwesomeIcon icon={g.video_muted ? faVolumeMute : faVolumeUp} style={{ fontSize: 11 }} />
                            {g.video_muted ? 'Mute' : 'Audio'}
                          </button>
                        )}
                        {mode === 'video' && (
                          <button onClick={() => setGroupVideoModal(g)}
                            style={{ background: g.video_name ? '#fff8e1' : '#f4f4f5', border: `1px solid ${g.video_name ? '#fde68a' : '#e4e4e7'}`, borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: g.video_name ? '#92400e' : '#71717a', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FontAwesomeIcon icon={faVideo} style={{ fontSize: 11 }} />
                            Video
                          </button>
                        )}
                        {mode === 'images' && (
                          <button onClick={() => setGroupAlbumModal(g)}
                            style={{ background: g.album_name ? '#fdf4ff' : '#f4f4f5', border: `1px solid ${g.album_name ? '#e9d5ff' : '#e4e4e7'}`, borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: g.album_name ? '#7e22ce' : '#71717a', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, maxWidth: 130, overflow: 'hidden' }}>
                            <FontAwesomeIcon icon={faFolder} style={{ fontSize: 11, flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.album_name || 'Álbum'}</span>
                          </button>
                        )}
                        <button onClick={() => setGroupMusicModal(g)}
                          style={{ background: g.music_name ? '#f0f9ff' : '#f4f4f5', border: `1px solid ${g.music_name ? '#bae6fd' : '#e4e4e7'}`, borderRadius: 7, padding: '7px 9px', cursor: 'pointer', color: g.music_name ? '#0369a1' : '#71717a', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <FontAwesomeIcon icon={faMusic} style={{ fontSize: 11 }} />
                          Música
                        </button>
                      </div>

                      {/* Member screens */}
                      {members.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                          {members.map(s => (
                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: 20, padding: '4px 6px 4px 10px' }}>
                              <FontAwesomeIcon icon={faDesktop} style={{ fontSize: 10, color: s.is_online ? '#16a34a' : '#a1a1aa' }} />
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#09090b' }}>{s.device_name}</span>
                              <button onClick={() => assignScreenGroup(s.id, null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', padding: '0 2px' }} title="Quitar del grupo">
                                <FontAwesomeIcon icon={faTimes} style={{ fontSize: 11 }} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {members.length === 0 && (
                        <div style={{ color: '#a1a1aa', fontSize: 12, marginTop: 10, fontStyle: 'italic' }}>
                          Sin pantallas. Agregalas desde la pestaña Pantallas → botón Grupo.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      )}


      {/* Schedule create modal */}
      {scheduleModal && (
        <div onClick={() => setScheduleModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: '24px 24px', width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nuevo horario programado</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#71717a' }}>{scheduleModal.device_name}</p>
              </div>
              <button onClick={() => setScheduleModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#a1a1aa' }}><FontAwesomeIcon icon={faTimes} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Video a reproducir *</label>
                <select value={newSched.video_id} onChange={e => setNewSched(p => ({ ...p, video_id: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }}>
                  <option value="">Seleccionar video...</option>
                  {videos.map(v => <option key={v.id} value={v.id}>{v.original_name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Nombre del horario (opcional)</label>
                <input type="text" value={newSched.name} onChange={e => setNewSched(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: Promo mediodía"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Hora inicio *</label>
                  <input type="time" value={newSched.start_time} onChange={e => setNewSched(p => ({ ...p, start_time: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Hora fin (opcional)</label>
                  <input type="time" value={newSched.end_time} onChange={e => setNewSched(p => ({ ...p, end_time: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Días</label>
                <p style={{ margin: '0 0 8px', fontSize: 11, color: '#a1a1aa' }}>Sin selección = todos los días</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ALL_DAYS.map(day => (
                    <button key={day} onClick={() => toggleSchedDay(day)}
                      style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${newSched.days.includes(day) ? GOLD : '#e4e4e7'}`, background: newSched.days.includes(day) ? '#fff8e1' : '#f4f4f5', color: newSched.days.includes(day) ? '#92400e' : '#71717a' }}>
                      {DAYS_LABELS[day]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button onClick={() => setScheduleModal(null)} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid #e4e4e7', background: 'transparent', color: '#71717a' }}>Cancelar</button>
              <button onClick={createSchedule} disabled={!newSched.video_id || !newSched.start_time}
                style={{ padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: !newSched.video_id || !newSched.start_time ? 'not-allowed' : 'pointer', border: 'none', background: !newSched.video_id || !newSched.start_time ? '#e4e4e7' : GOLD, color: !newSched.video_id || !newSched.start_time ? '#a1a1aa' : '#000', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FontAwesomeIcon icon={faClock} />
                Crear horario
              </button>
            </div>
          </div>
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

      {/* Group Video Modal */}
      {groupVideoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', width: '90%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Video para grupo <span style={{ color: GOLD }}>{groupVideoModal.name}</span></h3>
              <button onClick={() => setGroupVideoModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#a1a1aa' }}><FontAwesomeIcon icon={faTimes} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              <button onClick={() => { updateGroup(groupVideoModal.id, { video_id: null }, 'Video removido del grupo'); setGroupVideoModal(null); }} style={{ background: '#fafafa', border: '1px solid #e4e4e7', borderRadius: 8, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', color: '#71717a', fontStyle: 'italic', fontSize: 14 }}>Sin video</button>
              {videos.map(v => (
                <button key={v.id} onClick={() => { updateGroup(groupVideoModal.id, { video_id: v.id }, 'Video asignado al grupo'); setGroupVideoModal(null); }} style={{ background: groupVideoModal.current_video_id === v.id ? '#fff8e1' : '#fafafa', border: `1px solid ${groupVideoModal.current_video_id === v.id ? '#fde68a' : '#e4e4e7'}`, borderRadius: 8, padding: '11px 14px', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ color: '#09090b', fontWeight: 600, fontSize: 14 }}>{v.original_name}</div>
                  <div style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{formatBytes(v.file_size)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Group Music Modal */}
      {groupMusicModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', width: '90%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Música para grupo <span style={{ color: GOLD }}>{groupMusicModal.name}</span></h3>
              <button onClick={() => setGroupMusicModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#a1a1aa' }}><FontAwesomeIcon icon={faTimes} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              <button onClick={() => { updateGroup(groupMusicModal.id, { music_id: null }, 'Música removida'); setGroupMusicModal(null); }} style={{ background: '#fafafa', border: '1px solid #e4e4e7', borderRadius: 8, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', color: '#71717a', fontStyle: 'italic', fontSize: 14 }}>Sin música</button>
              {music.map(m => (
                <button key={m.id} onClick={() => { updateGroup(groupMusicModal.id, { music_id: m.id }, 'Música asignada al grupo'); setGroupMusicModal(null); }} style={{ background: groupMusicModal.current_music_id === m.id ? '#f0f9ff' : '#fafafa', border: `1px solid ${groupMusicModal.current_music_id === m.id ? '#bae6fd' : '#e4e4e7'}`, borderRadius: 8, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
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

      {/* Group Album Modal */}
      {groupAlbumModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', width: '90%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Imágenes para grupo <span style={{ color: GOLD }}>{groupAlbumModal.name}</span></h3>
              <button onClick={() => setGroupAlbumModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#a1a1aa' }}><FontAwesomeIcon icon={faTimes} /></button>
            </div>
            <p style={{ color: '#71717a', fontSize: 13, margin: '0 0 16px' }}>Elegí qué imágenes se muestran en las pantallas del grupo.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
              <button onClick={() => { updateGroup(groupAlbumModal.id, { album_id: null }, 'Grupo mostrará todas las imágenes'); setGroupAlbumModal(null); }}
                style={{ background: !groupAlbumModal.current_album_id ? '#fff8e1' : '#fafafa', border: `1px solid ${!groupAlbumModal.current_album_id ? '#fde68a' : '#e4e4e7'}`, borderRadius: 8, padding: '11px 14px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ color: '#09090b', fontWeight: 600, fontSize: 14 }}>🖼 Todas las imágenes</div>
                <div style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{images.length} imagen{images.length !== 1 ? 'es' : ''}</div>
              </button>
              {albums.map(a => {
                const count = images.filter(i => i.album_id === a.id).length;
                return (
                  <button key={a.id} onClick={() => { updateGroup(groupAlbumModal.id, { album_id: a.id }, 'Álbum asignado al grupo'); setGroupAlbumModal(null); }}
                    style={{ background: groupAlbumModal.current_album_id === a.id ? '#fdf4ff' : '#fafafa', border: `1px solid ${groupAlbumModal.current_album_id === a.id ? '#e9d5ff' : '#e4e4e7'}`, borderRadius: 8, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
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

      {/* Rename Group Modal */}
      {renameGroupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', width: '90%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700 }}>Renombrar grupo</h3>
            <input value={renameGroupName} onChange={e => setRenameGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && renameGroup()} placeholder="Nombre del grupo" autoFocus
              style={{ width: '100%', padding: '10px 12px', background: '#fafafa', border: '1px solid #e4e4e7', borderRadius: 8, color: '#09090b', fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setRenameGroupModal(null)} style={{ flex: 1, padding: '10px', background: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: 8, color: '#71717a', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={renameGroup} style={{ flex: 1, padding: '10px', background: GOLD, border: 'none', borderRadius: 8, color: '#0a0a0a', fontWeight: 700, cursor: 'pointer' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Screen to Group Modal */}
      {screenGroupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', width: '90%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Grupo para <span style={{ color: GOLD }}>{screenGroupModal.device_name}</span></h3>
              <button onClick={() => setScreenGroupModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#a1a1aa' }}><FontAwesomeIcon icon={faTimes} /></button>
            </div>
            <p style={{ color: '#71717a', fontSize: 13, margin: '0 0 16px' }}>Al agregarla a un grupo, la pantalla reproduce el contenido del grupo.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
              <button onClick={() => assignScreenGroup(screenGroupModal.id, null)}
                style={{ background: !screenGroupModal.group_id ? '#fff8e1' : '#fafafa', border: `1px solid ${!screenGroupModal.group_id ? '#fde68a' : '#e4e4e7'}`, borderRadius: 8, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', color: '#71717a', fontStyle: 'italic', fontSize: 14 }}>
                Sin grupo (control individual)
              </button>
              {groups.map(g => (
                <button key={g.id} onClick={() => assignScreenGroup(screenGroupModal.id, g.id)}
                  style={{ background: screenGroupModal.group_id === g.id ? '#eef2ff' : '#fafafa', border: `1px solid ${screenGroupModal.group_id === g.id ? '#c7d2fe' : '#e4e4e7'}`, borderRadius: 8, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FontAwesomeIcon icon={faLayerGroup} style={{ color: GOLD, fontSize: 18, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#09090b', fontWeight: 600, fontSize: 14 }}>{g.name}</div>
                    <div style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>{g.screen_count} pantalla{g.screen_count !== 1 ? 's' : ''} · {(g.display_mode || 'video') === 'images' ? 'imágenes' : (g.video_name || 'sin video')}</div>
                  </div>
                </button>
              ))}
              {groups.length === 0 && (
                <div style={{ color: '#a1a1aa', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>
                  No hay grupos. Creá uno en la pestaña <strong>Grupos</strong>.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODAL UNIFICADO DE PANTALLA (clic en la vista previa) ══════════ */}
      {screenModal != null && (() => {
        const sm = screens.find(x => x.id === screenModal);
        if (!sm) return null;
        const smMode = sm.display_mode || 'video';
        const smGrouped = !!sm.group_id;
        const selStyle = { width: '100%', padding: '9px 11px', border: '1px solid #e4e4e7', borderRadius: 9, fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer', boxSizing: 'border-box' };
        const secLabel = { fontSize: 11, fontWeight: 800, color: '#a1a1aa', letterSpacing: 0.4, textTransform: 'uppercase' };
        const upBtn = (onClick, label, busy) => (
          <button onClick={onClick} disabled={busy}
            style={{ background: '#fffdf5', border: `1px solid ${GOLD}`, borderRadius: 20, color: '#92400e', fontSize: 11, fontWeight: 700, padding: '4px 11px', cursor: busy ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, opacity: busy ? 0.6 : 1 }}>
            <FontAwesomeIcon icon={faUpload} style={{ fontSize: 10 }} />{busy ? 'Subiendo…' : label}
          </button>
        );
        const rowBtn = (active, activeBg, activeBorder, onClick, children) => (
          <button onClick={onClick}
            style={{ background: active ? activeBg : '#fafafa', border: `1px solid ${active ? activeBorder : '#e4e4e7'}`, borderRadius: 9, padding: '9px 12px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, width: '100%' }}>
            {children}
          </button>
        );
        return (
          <div onClick={() => setScreenModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: '20px 20px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Configurar <span style={{ color: GOLD }}>{sm.device_name}</span></h3>
                <button onClick={() => setScreenModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#a1a1aa' }}><FontAwesomeIcon icon={faTimes} /></button>
              </div>

              {/* Inputs ocultos para subir desde el modal */}
              <input ref={mVideoRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files[0])} />
              <input ref={mImageRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleUploadImages(e.target.files)} />
              <input ref={mMusicRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => handleUploadMusic(e.target.files[0])} />

              {/* Barra de progreso de subida (video / imágenes / música) */}
              {(uploading || uploadingImages || uploadingMusic) && (() => {
                const pct = uploading ? uploadProgress : uploadingImages ? uploadImagesProgress : uploadMusicProgress;
                const lbl = uploading ? 'Subiendo video' : uploadingImages ? 'Subiendo imágenes' : 'Subiendo música';
                return (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 5 }}>
                      <span>{lbl}…</span><span>{pct}%</span>
                    </div>
                    <div style={{ height: 8, background: '#f4f4f5', borderRadius: 20, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: GOLD, borderRadius: 20, transition: 'width .2s' }} />
                    </div>
                  </div>
                );
              })()}

              {smGrouped ? (
                <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#4338ca', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FontAwesomeIcon icon={faLayerGroup} />
                  El contenido lo controla el grupo <strong>{sm.group_name}</strong>. Quitala del grupo abajo para controlarla sola.
                </div>
              ) : (
                <>
                  {/* Modo: Video / Imágenes */}
                  <div style={{ display: 'flex', gap: 6, background: '#f4f4f5', borderRadius: 11, padding: 4, marginBottom: 16 }}>
                    {[['video', faVideo, 'Video'], ['images', faImage, 'Imágenes']].map(([m, ic, lbl]) => (
                      <button key={m} onClick={() => smMode !== m && setScreenMode(sm, m)}
                        style={{ flex: 1, background: smMode === m ? '#fff' : 'transparent', border: smMode === m ? `1px solid ${GOLD}` : '1px solid transparent', borderRadius: 8, padding: '8px 0', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: smMode === m ? '#09090b' : '#71717a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <FontAwesomeIcon icon={ic} style={{ fontSize: 12, color: smMode === m ? GOLD : '#a1a1aa' }} />{lbl}
                      </button>
                    ))}
                  </div>

                  {/* Contenido */}
                  {smMode === 'all' ? (
                    <div style={{ background: '#fffdf5', border: `1px solid ${GOLD}`, borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
                      <div style={{ fontSize: 13, color: '#92400e', fontWeight: 700, marginBottom: 4 }}>Reproduce todo en un solo loop</div>
                      <div style={{ fontSize: 12, color: '#a16207', lineHeight: 1.5, marginBottom: 10 }}>
                        Esta pantalla muestra <strong>todos los videos y todas las imágenes</strong>, uno tras otro, y vuelve a empezar. Cada imagen dura el intervalo configurado; cada video se reproduce completo.
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {upBtn(() => mVideoRef.current?.click(), 'Subir video', uploading)}
                        {upBtn(() => mImageRef.current?.click(), 'Subir imágenes', uploadingImages)}
                      </div>
                      <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 8 }}>{videos.length} video{videos.length !== 1 ? 's' : ''} · {images.length} imagen{images.length !== 1 ? 'es' : ''}</div>
                    </div>
                  ) : (<>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={secLabel}>{smMode === 'video' ? 'Video en pantalla' : 'Imágenes en pantalla'}</span>
                    {smMode === 'video'
                      ? upBtn(() => mVideoRef.current?.click(), 'Subir video', uploading)
                      : upBtn(() => mImageRef.current?.click(), 'Subir imágenes', uploadingImages)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', marginBottom: 18 }}>
                    {smMode === 'video' ? (<>
                      {rowBtn(!sm.current_video_id && !sm.video_play_all, '#fff8e1', '#fde68a', () => assignVideo(sm.id, null),
                        <span style={{ color: '#71717a', fontStyle: 'italic', fontSize: 13 }}>Sin video</span>)}
                      {videos.length > 1 && rowBtn(!!sm.video_play_all, '#fff8e1', '#fde68a', () => assignScreenVideoAll(sm.id),
                        <><FontAwesomeIcon icon={faPlay} style={{ color: GOLD, fontSize: 12, flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}><div style={{ color: '#09090b', fontWeight: 700, fontSize: 13 }}>Reproducir todos</div>
                            <div style={{ color: '#71717a', fontSize: 11 }}>{videos.length} videos en loop</div></div></>)}
                      {videos.map(v => (
                        <Fragment key={v.id}>{rowBtn(sm.current_video_id === v.id, '#fff8e1', '#fde68a', () => assignVideo(sm.id, v.id),
                          <><video src={`${API}${v.url}#t=0.5`} muted playsInline preload="metadata"
                              style={{ width: 56, height: 38, objectFit: 'cover', borderRadius: 6, flexShrink: 0, background: '#0a0a0a', border: '1px solid #e4e4e7' }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: '#09090b', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.original_name}</div>
                              <div style={{ color: '#71717a', fontSize: 11 }}>{formatBytes(v.file_size)}</div>
                            </div></>)}</Fragment>))}
                      {videos.length === 0 && <div style={{ color: '#a1a1aa', fontSize: 12, textAlign: 'center', padding: '10px 0' }}>No hay videos. Subí uno arriba.</div>}
                    </>) : (<>
                      {(() => { const thumb = images[0]; return rowBtn(!sm.current_album_id && !sm.current_image_id, '#fdf4ff', '#e9d5ff', () => assignScreenAlbum(sm.id, null),
                        <>{thumb
                            ? <img src={`${API}${thumb.url}`} alt="" style={{ width: 56, height: 38, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1px solid #e4e4e7' }} />
                            : <div style={{ width: 56, height: 38, borderRadius: 6, flexShrink: 0, background: '#faf5ff', border: '1px solid #e9d5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FontAwesomeIcon icon={faImage} style={{ color: '#7e22ce', fontSize: 13 }} /></div>}
                          <div><div style={{ color: '#09090b', fontWeight: 600, fontSize: 13 }}>Todas las imágenes</div>
                            <div style={{ color: '#71717a', fontSize: 11 }}>{images.length} imagen{images.length !== 1 ? 'es' : ''}</div></div></>); })()}
                      {albums.map(a => { const albImgs = images.filter(i => i.album_id === a.id); const count = albImgs.length; const thumb = albImgs[0]; return (
                        <Fragment key={a.id}>{rowBtn(sm.current_album_id === a.id, '#fdf4ff', '#e9d5ff', () => assignScreenAlbum(sm.id, a.id),
                          <>{thumb
                              ? <img src={`${API}${thumb.url}`} alt="" style={{ width: 56, height: 38, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1px solid #e4e4e7' }} />
                              : <div style={{ width: 56, height: 38, borderRadius: 6, flexShrink: 0, background: '#faf5ff', border: '1px solid #e9d5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FontAwesomeIcon icon={faFolder} style={{ color: GOLD, fontSize: 15 }} /></div>}
                            <div><div style={{ color: '#09090b', fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                              <div style={{ color: '#71717a', fontSize: 11 }}>{count} imagen{count !== 1 ? 'es' : ''}</div></div></>)}</Fragment>); })}
                      {images.length > 0 && (
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#a1a1aa', letterSpacing: 0.4, textTransform: 'uppercase', margin: '8px 0 2px' }}>O una sola imagen</div>
                      )}
                      {images.map(img => (
                        <Fragment key={img.id}>{rowBtn(sm.current_image_id === img.id, '#fdf4ff', '#e9d5ff', () => assignScreenImage(sm.id, img.id),
                          <><img src={`${API}${img.url}`} alt="" style={{ width: 56, height: 38, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1px solid #e4e4e7' }} />
                            <div style={{ minWidth: 0 }}><div style={{ color: '#09090b', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.original_name}</div>
                              <div style={{ color: '#71717a', fontSize: 11 }}>Imagen sola</div></div></>)}</Fragment>))}
                      {images.length === 0 && <div style={{ color: '#a1a1aa', fontSize: 12, textAlign: 'center', padding: '10px 0' }}>No hay imágenes. Subí arriba.</div>}
                    </>)}
                  </div>
                  </>)}
                </>
              )}

              {/* Música */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={secLabel}>Música de fondo</span>
                {upBtn(() => mMusicRef.current?.click(), 'Subir música', uploadingMusic)}
              </div>
              <select
                value={sm.music_play_all ? '__all__' : (sm.music_id || '')}
                onChange={e => { const v = e.target.value; if (v === '__all__') assignScreenMusicAll(sm.id); else assignMusic(sm.id, v || null); }}
                style={{ ...selStyle, marginBottom: 18 }}>
                <option value="">Sin música</option>
                {music.length > 1 && <option value="__all__">▶ Reproducir toda la música ({music.length} pistas)</option>}
                {music.map(m => <option key={m.id} value={m.id}>{m.original_name}</option>)}
              </select>

            </div>
          </div>
        );
      })()}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', width: '90%', maxWidth: 360, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ width: 48, height: 48, background: '#fef2f2', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: 20, color: '#dc2626' }} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>
              ¿Eliminar {deleteConfirm.type === 'video' ? 'video' : deleteConfirm.type === 'music' ? 'música' : deleteConfirm.type === 'image' ? 'imagen' : deleteConfirm.type === 'album' ? 'álbum' : deleteConfirm.type === 'group' ? 'grupo' : 'pantalla'}?
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
                  else if (deleteConfirm.type === 'group') deleteGroup(deleteConfirm.id);
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
    </PlanLock>
  );
}
