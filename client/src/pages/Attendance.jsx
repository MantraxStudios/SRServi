import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import * as faceapi from '@vladmandic/face-api';
import { io } from 'socket.io-client';

const API = 'https://srservi2.srautomatic.com';
const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
const MATCH_THRESHOLD = 0.5;
const STABLE_FRAMES = 5;
const AUTO_RESET_MS = 4000;

const RECORD_LABELS = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  INICIO_ALMUERZO: 'Inicio Almuerzo',
  FIN_ALMUERZO: 'Fin Almuerzo',
  INICIO_PAUSA: 'Inicio Pausa',
  FIN_PAUSA: 'Fin Pausa',
};
const RECORD_COLORS = {
  ENTRADA: '#22c55e',
  SALIDA: '#ef4444',
  INICIO_ALMUERZO: '#f59e0b',
  FIN_ALMUERZO: '#10b981',
  INICIO_PAUSA: '#8b5cf6',
  FIN_PAUSA: '#6366f1',
};

function normalizeRut(rut) {
  return rut.replace(/\./g, '').toUpperCase().trim();
}

export default function Attendance() {
  const { storeCode } = useParams();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionInterval = useRef(null);
  const stableCount = useRef(0);
  const personsRef = useRef([]);
  const matcherRef = useRef(null);
  const resetTimer = useRef(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Inicializando motor IA...');
  const [cameraError, setCameraError] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);

  // 'idle' | 'known' | 'action' | 'unknown' | 'rut_conflict' | 'success' | 'error'
  const [uiState, setUiState] = useState('idle');
  const [matchedPerson, setMatchedPerson] = useState(null);
  const [currentDescriptor, setCurrentDescriptor] = useState(null);

  const [rutInput, setRutInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [surnameInput, setSurnameInput] = useState('');
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const modalOpen = uiState !== 'idle';

  const reset = useCallback(() => {
    clearTimeout(resetTimer.current);
    setUiState('idle');
    setMatchedPerson(null);
    setCurrentDescriptor(null);
    setRutInput('');
    setNameInput('');
    setSurnameInput('');
    setFormError('');
    setSuccessMsg('');
    setErrorMsg('');
    stableCount.current = 0;
  }, []);

  const scheduleReset = useCallback(() => {
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(reset, AUTO_RESET_MS);
  }, [reset]);

  // Presence tracking
  useEffect(() => {
    if (!storeCode) return;
    const socket = io(API);
    socket.on('connect', () => {
      socket.emit('presence_join', { store_code: storeCode, panel: 'totem' });
    });
    socket.on('reconnect', () => {
      socket.emit('presence_join', { store_code: storeCode, panel: 'totem' });
    });
    return () => socket.disconnect();
  }, [storeCode]);

  // Load face-api.js models
  useEffect(() => {
    async function loadModels() {
      try {
        setLoadingMsg('Inicializando motor IA...');
        try { await faceapi.tf.setBackend('webgl'); } catch { await faceapi.tf.setBackend('cpu'); }
        await faceapi.tf.ready();
        setLoadingMsg('Cargando detector facial...');
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
        setLoadingMsg('Cargando detector de puntos...');
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL);
        setLoadingMsg('Cargando reconocimiento...');
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
        setModelsLoaded(true);
      } catch (e) {
        setLoadingMsg('Error: ' + e.message);
      }
    }
    loadModels();
  }, []);

  // Fetch persons & build matcher
  const fetchPersons = useCallback(async () => {
    if (!storeCode) return;
    try {
      const res = await fetch(`${API}/api/attendance/${storeCode}/persons`);
      if (!res.ok) return;
      const data = await res.json();
      personsRef.current = data;
      if (data.length > 0) {
        const labeled = data.map(p =>
          new faceapi.LabeledFaceDescriptors(String(p.id), [new Float32Array(p.face_descriptor)])
        );
        matcherRef.current = new faceapi.FaceMatcher(labeled, MATCH_THRESHOLD);
      } else {
        matcherRef.current = null;
      }
    } catch {}
  }, [storeCode]);

  useEffect(() => { fetchPersons(); }, [fetchPersons]);

  // Camera
  useEffect(() => {
    if (!modelsLoaded) return;
    let stream;
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
    }).then(s => {
      stream = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    }).catch(e => setCameraError(e.message));
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [modelsLoaded]);

  // Detection loop
  const runDetection = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    if (uiState !== 'idle') return;

    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    const dims = faceapi.matchDimensions(canvas, video, true);

    if (!detection) {
      setFaceDetected(false);
      stableCount.current = 0;
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    setFaceDetected(true);
    const resized = faceapi.resizeResults(detection, dims);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const box = resized.detection.box;
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 3;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    const scanY = box.y + (Date.now() % 1500) / 1500 * box.height;
    const grad = ctx.createLinearGradient(box.x, scanY - 10, box.x, scanY + 10);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.5, 'rgba(212,175,55,0.6)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(box.x, scanY - 10, box.width, 20);

    stableCount.current += 1;

    if (stableCount.current >= STABLE_FRAMES) {
      stableCount.current = 0;
      const descriptor = detection.descriptor;

      const cap = document.createElement('canvas');
      cap.width = video.videoWidth;
      cap.height = video.videoHeight;
      cap.getContext('2d').drawImage(video, 0, 0);
      const photo = cap.toDataURL('image/jpeg', 0.7);

      setCurrentDescriptor({ descriptor: Array.from(descriptor), photo });

      if (matcherRef.current) {
        const best = matcherRef.current.findBestMatch(descriptor);
        if (best.label !== 'unknown') {
          setMatchedPerson(personsRef.current.find(p => String(p.id) === best.label));
          setUiState('known');
        } else {
          setUiState('unknown');
        }
      } else {
        setUiState('unknown');
      }
    }
  }, [uiState]);

  useEffect(() => {
    if (!modelsLoaded) return;
    detectionInterval.current = setInterval(runDetection, 250);
    return () => clearInterval(detectionInterval.current);
  }, [modelsLoaded, runDetection]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleRutVerify() {
    const rut = normalizeRut(rutInput);
    if (!rut) { setFormError('Ingresa tu RUT'); return; }
    setFormError('');
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/attendance/${storeCode}/check-rut/${encodeURIComponent(rut)}`);
      const data = await res.json();
      if (data.exists && data.person && data.person.id !== matchedPerson?.id) {
        setErrorMsg('Este RUT ya está registrado con otro rostro');
        setUiState('rut_conflict');
        scheduleReset();
      } else if (data.person?.id === matchedPerson?.id || matchedPerson?.rut === rut) {
        setFormError('');
        setUiState('action');
      } else {
        setFormError('El RUT no coincide con el rostro registrado');
      }
    } catch { setFormError('Error de conexión'); }
    finally { setSaving(false); }
  }

  async function handleRecord(type) {
    if (!matchedPerson) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/attendance/${storeCode}/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: matchedPerson.id, type })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const d = await res.json();
      const time = new Date(d.recorded_at || Date.now()).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      setSuccessMsg(`${RECORD_LABELS[type]} registrada a las ${time}`);
      setUiState('success');
      scheduleReset();
    } catch (e) {
      setErrorMsg(e.message || 'Error al registrar');
      setUiState('error');
      scheduleReset();
    } finally { setSaving(false); }
  }

  async function handleRegister() {
    const rut = normalizeRut(rutInput);
    const name = nameInput.trim();
    const surname = surnameInput.trim();
    if (!rut) { setFormError('Ingresa tu RUT'); return; }
    if (!name) { setFormError('Ingresa tu nombre'); return; }
    if (!surname) { setFormError('Ingresa tu apellido'); return; }
    if (!currentDescriptor) { setFormError('No se pudo capturar el rostro'); return; }
    setFormError('');
    setSaving(true);
    try {
      const check = await fetch(`${API}/api/attendance/${storeCode}/check-rut/${encodeURIComponent(rut)}`);
      const checkData = await check.json();
      if (checkData.exists) { setFormError('Este RUT ya está registrado con otro rostro'); setSaving(false); return; }
      const res = await fetch(`${API}/api/attendance/${storeCode}/persons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut, name, surname, face_descriptor: currentDescriptor.descriptor, face_photo: currentDescriptor.photo })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const person = await res.json();
      await fetchPersons();
      setMatchedPerson(person);
      setUiState('action');
    } catch (e) { setFormError(e.message || 'Error al registrar'); }
    finally { setSaving(false); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!modelsLoaded) {
    return (
      <div style={s.screen}>
        <div style={s.loadingWrap}>
          <div style={s.logoBox}><img src="/iconweb.png" alt="SR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
          <div style={s.spinner} />
          <p style={s.loadingTxt}>{loadingMsg}</p>
        </div>
      </div>
    );
  }

  if (cameraError) {
    return (
      <div style={s.screen}>
        <div style={s.loadingWrap}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>📷</div>
          <p style={{ color: '#ef4444', textAlign: 'center', marginBottom: 8 }}>Sin acceso a la cámara</p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center' }}>Permite el permiso de cámara y recarga</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.screen}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.logoBox}><img src="/iconweb.png" alt="SR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
        <span style={s.headerTitle}>Control de Asistencia</span>
        <LiveClock />
      </div>

      {/* Camera — full remaining height */}
      <div style={s.camWrap}>
        <video ref={videoRef} autoPlay playsInline muted style={s.video} />
        <canvas ref={canvasRef} style={s.canvas} />

        {/* Face status badge */}
        <div style={{ ...s.badge, borderColor: faceDetected ? '#D4AF37' : 'rgba(255,255,255,0.15)' }}>
          <div style={{ ...s.badgeDot, background: faceDetected ? '#D4AF37' : 'rgba(255,255,255,0.25)' }} />
          <span style={{ color: faceDetected ? '#D4AF37' : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600 }}>
            {faceDetected ? 'Rostro detectado' : 'Buscando rostro...'}
          </span>
        </div>

        {/* Idle hint */}
        {uiState === 'idle' && (
          <div style={s.idleHint}>
            <p style={s.idleHintTxt}>
              {faceDetected ? 'Mantén la posición...' : 'Mira directamente a la cámara'}
            </p>
          </div>
        )}
      </div>

      {/* ── Bottom modal ── */}
      <div style={{ ...s.modalBackdrop, opacity: modalOpen ? 1 : 0, pointerEvents: modalOpen ? 'all' : 'none' }} onClick={uiState === 'success' || uiState === 'error' || uiState === 'rut_conflict' ? reset : undefined} />
      <div style={{ ...s.modal, transform: modalOpen ? 'translateY(0)' : 'translateY(110%)' }}>
        <div style={s.modalHandle} />

        {uiState === 'known' && (
          <KnownPanel
            person={matchedPerson}
            rutInput={rutInput} setRutInput={setRutInput}
            formError={formError} saving={saving}
            onVerify={handleRutVerify} onCancel={reset}
          />
        )}
        {uiState === 'action' && (
          <ActionPanel person={matchedPerson} saving={saving} onRecord={handleRecord} onCancel={reset} />
        )}
        {uiState === 'unknown' && (
          <RegisterPanel
            rutInput={rutInput} setRutInput={setRutInput}
            nameInput={nameInput} setNameInput={setNameInput}
            surnameInput={surnameInput} setSurnameInput={setSurnameInput}
            formError={formError} saving={saving}
            onRegister={handleRegister} onCancel={reset}
          />
        )}
        {uiState === 'rut_conflict' && <FeedbackPanel emoji="🚫" color="#ef4444" title="Conflicto" msg={errorMsg} hint="Toca para cerrar" onTap={reset} />}
        {uiState === 'success' && <FeedbackPanel emoji="✅" color="#22c55e" title="¡Registrado!" msg={successMsg} name={matchedPerson ? `${matchedPerson.name} ${matchedPerson.surname}` : ''} hint="Toca para cerrar" onTap={reset} />}
        {uiState === 'error' && <FeedbackPanel emoji="❌" color="#ef4444" title="Error" msg={errorMsg} hint="Toca para cerrar" onTap={reset} />}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes scan { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }
      `}</style>
    </div>
  );
}

// ── Sub-panels ──────────────────────────────────────────────────────────────

function LiveClock() {
  const [t, setT] = useState('');
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginLeft: 'auto' }}>{t}</span>;
}

function KnownPanel({ person, rutInput, setRutInput, formError, saving, onVerify, onCancel }) {
  return (
    <div style={p.wrap}>
      <div style={p.emoji}>👋</div>
      <h2 style={{ ...p.title, color: '#D4AF37' }}>¡Bienvenido/a!</h2>
      <p style={p.name}>{person?.name} {person?.surname}</p>
      <p style={p.hint}>Ingresa tu RUT para confirmar</p>
      <input
        style={p.input} placeholder="Ej: 12345678-9"
        value={rutInput} onChange={e => setRutInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onVerify()}
        autoFocus
      />
      {formError && <p style={p.err}>{formError}</p>}
      <button style={p.btnGold} onClick={onVerify} disabled={saving}>{saving ? 'Verificando...' : 'Confirmar'}</button>
      <button style={p.btnGhost} onClick={onCancel}>Cancelar</button>
    </div>
  );
}

function ActionPanel({ person, saving, onRecord, onCancel }) {
  return (
    <div style={p.wrap}>
      <div style={p.emoji}>✅</div>
      <h2 style={p.title}>{person?.name} {person?.surname}</h2>
      <p style={p.hint}>Selecciona el tipo de registro</p>
      <div style={p.grid}>
        {Object.entries(RECORD_LABELS).map(([key, label]) => (
          <button
            key={key}
            style={{ ...p.actionBtn, borderColor: RECORD_COLORS[key], color: RECORD_COLORS[key] }}
            onClick={() => onRecord(key)} disabled={saving}
          >{label}</button>
        ))}
      </div>
      <button style={p.btnGhost} onClick={onCancel}>Cancelar</button>
    </div>
  );
}

function RegisterPanel({ rutInput, setRutInput, nameInput, setNameInput, surnameInput, setSurnameInput, formError, saving, onRegister, onCancel }) {
  return (
    <div style={p.wrap}>
      <div style={p.emoji}>🆕</div>
      <h2 style={p.title}>Primer acceso</h2>
      <p style={p.hint}>Completa tus datos para registrarte</p>
      <input style={p.input} placeholder="RUT (ej: 12345678-9)" value={rutInput} onChange={e => setRutInput(e.target.value)} />
      <input style={p.input} placeholder="Nombre" value={nameInput} onChange={e => setNameInput(e.target.value)} />
      <input style={p.input} placeholder="Apellido" value={surnameInput} onChange={e => setSurnameInput(e.target.value)} />
      {formError && <p style={p.err}>{formError}</p>}
      <button style={p.btnGold} onClick={onRegister} disabled={saving}>{saving ? 'Registrando...' : 'Registrar y continuar'}</button>
      <button style={p.btnGhost} onClick={onCancel}>Cancelar</button>
    </div>
  );
}

function FeedbackPanel({ emoji, color, title, msg, name, hint, onTap }) {
  return (
    <div style={{ ...p.wrap, cursor: 'pointer' }} onClick={onTap}>
      <div style={{ fontSize: 64, marginBottom: 8 }}>{emoji}</div>
      <h2 style={{ ...p.title, color }}>{title}</h2>
      {name && <p style={p.name}>{name}</p>}
      {msg && <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, textAlign: 'center', margin: '4px 0 8px' }}>{msg}</p>}
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>{hint}</p>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  screen: {
    position: 'fixed', inset: 0,
    background: '#000',
    display: 'flex', flexDirection: 'column',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: '#fff',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 16px',
    background: 'rgba(0,0,0,0.85)',
    borderBottom: '1px solid rgba(212,175,55,0.2)',
    flexShrink: 0, zIndex: 10,
  },
  logoBox: {
    width: 34, height: 34, background: '#D4AF37', borderRadius: 7,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 900, fontSize: 14, color: '#000', flexShrink: 0,
  },
  headerTitle: { fontWeight: 700, fontSize: 16 },
  camWrap: {
    position: 'relative', flex: 1, overflow: 'hidden', background: '#000',
  },
  video: {
    position: 'absolute', inset: 0,
    width: '100%', height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)',
  },
  canvas: {
    position: 'absolute', inset: 0,
    width: '100%', height: '100%',
    transform: 'scaleX(-1)',
    pointerEvents: 'none',
  },
  badge: {
    position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
    borderRadius: 20, padding: '7px 16px',
    border: '1px solid', transition: 'border-color 0.3s',
    whiteSpace: 'nowrap', zIndex: 5,
  },
  badgeDot: { width: 8, height: 8, borderRadius: '50%', transition: 'background 0.3s' },
  idleHint: {
    position: 'absolute', bottom: 20, left: 0, right: 0,
    display: 'flex', justifyContent: 'center', zIndex: 5,
  },
  idleHintTxt: {
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
    borderRadius: 10, padding: '6px 18px',
    color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0,
  },
  modalBackdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    zIndex: 20, transition: 'opacity 0.3s',
  },
  modal: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: '#141414',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTop: '1px solid rgba(212,175,55,0.2)',
    padding: '12px 20px 32px',
    zIndex: 30,
    transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
    maxHeight: '88vh', overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  modalHandle: {
    width: 40, height: 4, background: 'rgba(255,255,255,0.2)',
    borderRadius: 2, margin: '0 auto 20px',
  },
  loadingWrap: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32,
  },
  spinner: {
    width: 40, height: 40,
    border: '3px solid rgba(212,175,55,0.2)',
    borderTop: '3px solid #D4AF37',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 15, margin: 0, textAlign: 'center' },
};

const p = {
  wrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center', gap: 8, paddingBottom: 8,
  },
  emoji: { fontSize: 52, marginBottom: 4, lineHeight: 1 },
  title: { fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 },
  name: { fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 4px' },
  hint: { color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: '0 0 8px', lineHeight: 1.5 },
  input: {
    width: '100%', padding: '14px 16px', fontSize: 16,
    background: '#1e1e1e', border: '1px solid rgba(212,175,55,0.3)',
    borderRadius: 12, color: '#fff', outline: 'none',
    boxSizing: 'border-box', marginBottom: 4,
  },
  err: { color: '#ef4444', fontSize: 13, margin: '0 0 4px', width: '100%', textAlign: 'left' },
  btnGold: {
    width: '100%', padding: '15px',
    background: 'linear-gradient(135deg, #D4AF37, #b8972e)',
    border: 'none', borderRadius: 12,
    color: '#000', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginTop: 4,
  },
  btnGhost: {
    width: '100%', padding: '13px',
    background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12, color: 'rgba(255,255,255,0.45)',
    fontSize: 15, cursor: 'pointer', marginTop: 4,
  },
  grid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 10, width: '100%', margin: '4px 0',
  },
  actionBtn: {
    padding: '16px 8px', background: 'transparent',
    border: '2px solid', borderRadius: 12,
    fontWeight: 700, fontSize: 14, cursor: 'pointer',
  },
};
