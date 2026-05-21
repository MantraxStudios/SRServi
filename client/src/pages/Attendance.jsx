import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import * as faceapi from '@vladmandic/face-api';

const API = 'https://srservi2.srautomatic.com';
const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model';
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

function formatRutDisplay(rut) {
  const clean = normalizeRut(rut).replace(/-/g, '');
  if (clean.length < 2) return clean;
  return clean.slice(0, -1) + '-' + clean.slice(-1);
}

export default function Attendance() {
  const { storeCode } = useParams();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionInterval = useRef(null);
  const stableCount = useRef(0);
  const lastDescriptor = useRef(null);
  const personsRef = useRef([]);
  const matcherRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const resetTimer = useRef(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Cargando modelos...');
  const [cameraError, setCameraError] = useState(null);
  const [persons, setPersons] = useState([]);
  const [faceDetected, setFaceDetected] = useState(false);

  // State machine
  // idle | scanning | known | unknown | rut_conflict | success | error
  const [uiState, setUiState] = useState('idle');
  const [matchedPerson, setMatchedPerson] = useState(null);
  const [currentDescriptor, setCurrentDescriptor] = useState(null);

  // Form state
  const [rutInput, setRutInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [surnameInput, setSurnameInput] = useState('');
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const scheduleReset = useCallback(() => {
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
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
      lastDescriptor.current = null;
    }, AUTO_RESET_MS);
  }, []);

  // Load face-api.js models
  useEffect(() => {
    async function loadModels() {
      try {
        setLoadingMsg('Inicializando motor IA...');
        try {
          await faceapi.tf.setBackend('webgl');
        } catch {
          await faceapi.tf.setBackend('cpu');
        }
        await faceapi.tf.ready();
        setLoadingMsg('Cargando detector facial...');
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
        setLoadingMsg('Cargando detector de puntos...');
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL);
        setLoadingMsg('Cargando modelo de reconocimiento...');
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
        setModelsLoaded(true);
        setLoadingMsg('');
      } catch (e) {
        setLoadingMsg('Error cargando modelos: ' + e.message);
      }
    }
    loadModels();
  }, []);

  // Fetch registered persons
  const fetchPersons = useCallback(async () => {
    if (!storeCode) return;
    try {
      const res = await fetch(`${API}/api/attendance/${storeCode}/persons`);
      if (!res.ok) return;
      const data = await res.json();
      setPersons(data);
      personsRef.current = data;

      if (data.length > 0) {
        const labeled = data.map(p => {
          const desc = new Float32Array(p.face_descriptor);
          return new faceapi.LabeledFaceDescriptors(String(p.id), [desc]);
        });
        matcherRef.current = new faceapi.FaceMatcher(labeled, MATCH_THRESHOLD);
      } else {
        matcherRef.current = null;
      }
    } catch {}
  }, [storeCode]);

  useEffect(() => { fetchPersons(); }, [fetchPersons]);

  // Start camera
  useEffect(() => {
    if (!modelsLoaded) return;
    let stream;
    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        setCameraError('No se pudo acceder a la cámara: ' + e.message);
      }
    }
    startCamera();
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, [modelsLoaded]);

  // Detection loop
  const runDetection = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || uiState === 'success' || uiState === 'error') return;
    if (uiState === 'known' || uiState === 'unknown' || uiState === 'rut_conflict') return;

    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    const dims = faceapi.matchDimensions(canvas, video, true);

    if (!detection) {
      setFaceDetected(false);
      stableCount.current = 0;
      lastDescriptor.current = null;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    setFaceDetected(true);
    const resized = faceapi.resizeResults(detection, dims);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw bounding box
    const box = resized.detection.box;
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 3;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    // Scan line animation
    const scanY = box.y + (Date.now() % 1500) / 1500 * box.height;
    const grad = ctx.createLinearGradient(box.x, scanY - 10, box.x, scanY + 10);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.5, 'rgba(212,175,55,0.6)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(box.x, scanY - 10, box.width, 20);

    stableCount.current += 1;
    lastDescriptor.current = detection.descriptor;

    if (stableCount.current >= STABLE_FRAMES && uiState === 'idle') {
      stableCount.current = 0;
      const descriptor = detection.descriptor;

      // Capture face photo
      const captCanvas = captureCanvasRef.current || document.createElement('canvas');
      captCanvas.width = video.videoWidth;
      captCanvas.height = video.videoHeight;
      const cCtx = captCanvas.getContext('2d');
      cCtx.drawImage(video, 0, 0);
      const photo = captCanvas.toDataURL('image/jpeg', 0.7);

      setCurrentDescriptor({ descriptor: Array.from(descriptor), photo });

      if (matcherRef.current) {
        const best = matcherRef.current.findBestMatch(descriptor);
        if (best.label !== 'unknown') {
          const person = personsRef.current.find(p => String(p.id) === best.label);
          setMatchedPerson(person);
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
        setUiState('rut_conflict');
        setErrorMsg('Este RUT ya está registrado con otro rostro');
        scheduleReset();
      } else if (data.person?.id === matchedPerson?.id || matchedPerson?.rut === rut) {
        // RUT matches this face – show action buttons
        setUiState('action');
        setFormError('');
      } else {
        setFormError('El RUT no coincide con el rostro registrado');
      }
    } catch {
      setFormError('Error de conexión');
    } finally {
      setSaving(false);
    }
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
    } finally {
      setSaving(false);
    }
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
      // Check if this RUT is already taken by another face
      const check = await fetch(`${API}/api/attendance/${storeCode}/check-rut/${encodeURIComponent(rut)}`);
      const checkData = await check.json();
      if (checkData.exists) {
        setFormError('Este RUT ya está registrado con otro rostro');
        setSaving(false);
        return;
      }
      const res = await fetch(`${API}/api/attendance/${storeCode}/persons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rut,
          name,
          surname,
          face_descriptor: currentDescriptor.descriptor,
          face_photo: currentDescriptor.photo
        })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const person = await res.json();
      await fetchPersons();
      setMatchedPerson(person);
      setUiState('action');
    } catch (e) {
      setFormError(e.message || 'Error al registrar');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!modelsLoaded) {
    return (
      <div style={styles.full}>
        <div style={styles.loadingBox}>
          <div style={styles.logo}>SR</div>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>{loadingMsg}</p>
        </div>
      </div>
    );
  }

  if (cameraError) {
    return (
      <div style={styles.full}>
        <div style={styles.loadingBox}>
          <div style={{ fontSize: 48 }}>📷</div>
          <p style={{ color: '#ef4444', marginTop: 16 }}>{cameraError}</p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            Permite el acceso a la cámara en tu navegador y recarga la página
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.full}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLogo}>SR</div>
        <span style={styles.headerTitle}>Control de Asistencia</span>
        <span style={styles.headerTime}>{new Date().toLocaleString('es-CL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
      </div>

      <div style={styles.body}>
        {/* Camera panel */}
        <div style={styles.cameraPanel}>
          <div style={styles.videoWrapper}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={styles.video}
            />
            <canvas ref={canvasRef} style={styles.canvas} />
            {/* Face detected indicator */}
            <div style={{ ...styles.faceIndicator, borderColor: faceDetected ? '#D4AF37' : 'rgba(255,255,255,0.1)' }}>
              <div style={{ ...styles.faceIndicatorDot, background: faceDetected ? '#D4AF37' : 'rgba(255,255,255,0.2)' }} />
              <span style={{ color: faceDetected ? '#D4AF37' : 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                {faceDetected ? 'Rostro detectado' : 'Buscando rostro...'}
              </span>
            </div>
          </div>
          <p style={styles.cameraHint}>Mira directamente a la cámara</p>
        </div>

        {/* Control panel */}
        <div style={styles.controlPanel}>
          {uiState === 'idle' && <IdlePanel faceDetected={faceDetected} />}
          {uiState === 'known' && (
            <KnownPanel
              person={matchedPerson}
              rutInput={rutInput}
              setRutInput={setRutInput}
              formError={formError}
              saving={saving}
              onVerify={handleRutVerify}
              onCancel={() => { setUiState('idle'); setRutInput(''); setFormError(''); stableCount.current = 0; }}
            />
          )}
          {uiState === 'action' && (
            <ActionPanel
              person={matchedPerson}
              saving={saving}
              onRecord={handleRecord}
              onCancel={() => { setUiState('idle'); stableCount.current = 0; }}
            />
          )}
          {uiState === 'unknown' && (
            <RegisterPanel
              rutInput={rutInput}
              setRutInput={setRutInput}
              nameInput={nameInput}
              setNameInput={setNameInput}
              surnameInput={surnameInput}
              setSurnameInput={setSurnameInput}
              formError={formError}
              saving={saving}
              onRegister={handleRegister}
              onCancel={() => { setUiState('idle'); setRutInput(''); setNameInput(''); setSurnameInput(''); setFormError(''); stableCount.current = 0; }}
            />
          )}
          {uiState === 'rut_conflict' && <ConflictPanel message={errorMsg} />}
          {uiState === 'success' && <SuccessPanel message={successMsg} person={matchedPerson} />}
          {uiState === 'error' && <ErrorPanel message={errorMsg} />}
        </div>
      </div>
    </div>
  );
}

// ── Sub-panels ──────────────────────────────────────────────────────────────

function IdlePanel({ faceDetected }) {
  return (
    <div style={styles.panel}>
      <div style={{ fontSize: 72, marginBottom: 24 }}>👤</div>
      <h2 style={styles.panelTitle}>
        {faceDetected ? 'Identificando...' : 'Acerca tu rostro a la cámara'}
      </h2>
      {faceDetected && (
        <div style={styles.scanProgress}>
          <div style={styles.scanBar} />
        </div>
      )}
      <p style={styles.panelHint}>
        {faceDetected
          ? 'Mantén la posición...'
          : 'El sistema reconocerá tu identidad automáticamente'}
      </p>
    </div>
  );
}

function KnownPanel({ person, rutInput, setRutInput, formError, saving, onVerify, onCancel }) {
  return (
    <div style={styles.panel}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>👋</div>
      <h2 style={{ ...styles.panelTitle, color: '#D4AF37' }}>
        ¡Bienvenido/a!
      </h2>
      <p style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: '0 0 24px' }}>
        {person?.name} {person?.surname}
      </p>
      <p style={styles.panelHint}>Ingresa tu RUT para confirmar tu identidad</p>
      <input
        style={styles.input}
        placeholder="Ej: 12345678-9"
        value={rutInput}
        onChange={e => setRutInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onVerify()}
        autoFocus
      />
      {formError && <p style={styles.formError}>{formError}</p>}
      <button style={styles.btnPrimary} onClick={onVerify} disabled={saving}>
        {saving ? 'Verificando...' : 'Confirmar'}
      </button>
      <button style={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
    </div>
  );
}

function ActionPanel({ person, saving, onRecord, onCancel }) {
  return (
    <div style={styles.panel}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
      <h2 style={styles.panelTitle}>{person?.name} {person?.surname}</h2>
      <p style={styles.panelHint}>Selecciona el tipo de registro</p>
      <div style={styles.actionGrid}>
        {Object.entries(RECORD_LABELS).map(([key, label]) => (
          <button
            key={key}
            style={{ ...styles.actionBtn, borderColor: RECORD_COLORS[key], color: RECORD_COLORS[key] }}
            onClick={() => onRecord(key)}
            disabled={saving}
          >
            {label}
          </button>
        ))}
      </div>
      <button style={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
    </div>
  );
}

function RegisterPanel({ rutInput, setRutInput, nameInput, setNameInput, surnameInput, setSurnameInput, formError, saving, onRegister, onCancel }) {
  return (
    <div style={styles.panel}>
      <div style={{ fontSize: 52, marginBottom: 8 }}>🆕</div>
      <h2 style={styles.panelTitle}>Primer acceso</h2>
      <p style={styles.panelHint}>No encontramos tu rostro. Regístrate para continuar.</p>
      <input style={styles.input} placeholder="RUT (ej: 12345678-9)" value={rutInput} onChange={e => setRutInput(e.target.value)} />
      <input style={styles.input} placeholder="Nombre" value={nameInput} onChange={e => setNameInput(e.target.value)} />
      <input style={styles.input} placeholder="Apellido" value={surnameInput} onChange={e => setSurnameInput(e.target.value)} />
      {formError && <p style={styles.formError}>{formError}</p>}
      <button style={styles.btnPrimary} onClick={onRegister} disabled={saving}>
        {saving ? 'Registrando...' : 'Registrar y marcar entrada'}
      </button>
      <button style={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
    </div>
  );
}

function ConflictPanel({ message }) {
  return (
    <div style={styles.panel}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🚫</div>
      <h2 style={{ ...styles.panelTitle, color: '#ef4444' }}>Conflicto detectado</h2>
      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, textAlign: 'center' }}>{message}</p>
      <p style={styles.panelHint}>Volviendo automáticamente...</p>
    </div>
  );
}

function SuccessPanel({ message, person }) {
  return (
    <div style={styles.panel}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>✅</div>
      <h2 style={{ ...styles.panelTitle, color: '#22c55e' }}>¡Registrado!</h2>
      {person && <p style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>{person.name} {person.surname}</p>}
      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, textAlign: 'center', marginTop: 8 }}>{message}</p>
      <p style={styles.panelHint}>Volviendo en un momento...</p>
    </div>
  );
}

function ErrorPanel({ message }) {
  return (
    <div style={styles.panel}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>❌</div>
      <h2 style={{ ...styles.panelTitle, color: '#ef4444' }}>Error</h2>
      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, textAlign: 'center' }}>{message}</p>
      <p style={styles.panelHint}>Volviendo automáticamente...</p>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  full: {
    minHeight: '100vh',
    background: '#080808',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: '#fff',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 24px',
    background: '#111',
    borderBottom: '1px solid rgba(212,175,55,0.2)',
    gap: 12,
    flexShrink: 0,
  },
  headerLogo: {
    width: 40, height: 40,
    background: '#D4AF37',
    borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 900, fontSize: 16, color: '#080808',
  },
  headerTitle: {
    fontWeight: 700, fontSize: 18, color: '#fff', flex: 1,
  },
  headerTime: {
    color: 'rgba(255,255,255,0.4)', fontSize: 14,
  },
  body: {
    flex: 1,
    display: 'flex',
    gap: 0,
    overflow: 'hidden',
  },
  cameraPanel: {
    flex: '0 0 55%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: '#0d0d0d',
    borderRight: '1px solid rgba(255,255,255,0.05)',
  },
  videoWrapper: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 0 0 2px rgba(212,175,55,0.3)',
    maxWidth: '100%',
  },
  video: {
    display: 'block',
    width: '100%',
    maxWidth: 520,
    aspectRatio: '4/3',
    objectFit: 'cover',
    transform: 'scaleX(-1)',
  },
  canvas: {
    position: 'absolute',
    top: 0, left: 0,
    width: '100%', height: '100%',
    transform: 'scaleX(-1)',
    pointerEvents: 'none',
  },
  faceIndicator: {
    position: 'absolute',
    bottom: 12, left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    padding: '6px 14px',
    border: '1px solid',
    transition: 'border-color 0.3s',
    whiteSpace: 'nowrap',
  },
  faceIndicatorDot: {
    width: 8, height: 8, borderRadius: '50%', transition: 'background 0.3s',
  },
  cameraHint: {
    marginTop: 16, color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center',
  },
  controlPanel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    background: '#111',
    overflowY: 'auto',
  },
  panel: {
    width: '100%',
    maxWidth: 380,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 8,
  },
  panelTitle: {
    fontSize: 28, fontWeight: 700, color: '#fff', margin: 0,
  },
  panelHint: {
    color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '4px 0 16px', lineHeight: 1.5,
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: 16,
    background: '#1a1a1a',
    border: '1px solid rgba(212,175,55,0.3)',
    borderRadius: 10,
    color: '#fff',
    outline: 'none',
    marginBottom: 8,
    boxSizing: 'border-box',
  },
  formError: {
    color: '#ef4444', fontSize: 13, margin: '0 0 8px', width: '100%', textAlign: 'left',
  },
  btnPrimary: {
    width: '100%',
    padding: '15px',
    background: 'linear-gradient(135deg, #D4AF37, #b8972e)',
    border: 'none',
    borderRadius: 10,
    color: '#080808',
    fontWeight: 700,
    fontSize: 16,
    cursor: 'pointer',
    marginTop: 4,
  },
  btnSecondary: {
    width: '100%',
    padding: '13px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    cursor: 'pointer',
    marginTop: 4,
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    width: '100%',
    margin: '8px 0',
  },
  actionBtn: {
    padding: '16px 8px',
    background: 'transparent',
    border: '2px solid',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: 16,
    padding: 32,
    textAlign: 'center',
  },
  logo: {
    width: 72, height: 72,
    background: '#D4AF37',
    borderRadius: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 900, fontSize: 28, color: '#080808',
    marginBottom: 8,
  },
  spinner: {
    width: 40, height: 40,
    border: '3px solid rgba(212,175,55,0.2)',
    borderTop: '3px solid #D4AF37',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)', fontSize: 15, margin: 0,
  },
  scanProgress: {
    width: '100%',
    height: 4,
    background: 'rgba(212,175,55,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    margin: '8px 0',
  },
  scanBar: {
    height: '100%',
    width: '40%',
    background: '#D4AF37',
    borderRadius: 2,
    animation: 'scan 1.5s ease-in-out infinite',
  },
};

// Inject animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
  `;
  if (!document.getElementById('attendance-styles')) {
    style.id = 'attendance-styles';
    document.head.appendChild(style);
  }
}
