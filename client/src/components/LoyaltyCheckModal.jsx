import { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faTimes, faCheck, faSpinner, faStar, faUserPlus } from '@fortawesome/free-solid-svg-icons';

const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
const MATCH_THRESHOLD = 0.5;
const STABLE_FRAMES = 4;
const API = 'https://srservi2.srautomatic.com';

// Persiste entre renders (se pierde al recargar página; el browser cache de CDN evita re-descarga)
let faceapiModule = null;
let modelsReady = false;
let bgPromise = null;

export async function preloadFaceApi() {
  if (modelsReady) return true;
  if (bgPromise) return bgPromise;
  bgPromise = (async () => {
    try {
      if (!faceapiModule) faceapiModule = await import('@vladmandic/face-api');
      const fa = faceapiModule;
      if (!fa.nets.tinyFaceDetector.isLoaded) {
        try { await fa.tf.setBackend('webgl'); } catch { await fa.tf.setBackend('cpu'); }
        await fa.tf.ready();
        await fa.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
        await fa.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL);
        await fa.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
      }
      modelsReady = true;
      return true;
    } catch {
      bgPromise = null;
      return false;
    }
  })();
  return bgPromise;
}

const STEPS = [
  'Descargando motor IA…',
  'Iniciando detector de rostros…',
  'Cargando reconocimiento facial…',
  'Abriendo cámara…',
];

export default function LoyaltyCheckModal({ storeCode, onClose, onResult, primaryColor = '#111', accentColor = '#D4AF37' }) {
  const [phase, setPhase] = useState('permission');
  const [stepIdx, setStepIdx] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [loyaltyConfig, setLoyaltyConfig] = useState(null);
  const [matchedCustomer, setMatchedCustomer] = useState(null);
  const [currentDescriptor, setCurrentDescriptor] = useState(null);
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const matcherRef = useRef(null);
  const stableCount = useRef(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/api/public/${storeCode}/loyalty`)
      .then(r => r.json())
      .then(d => { setLoyaltyConfig(d.config); setCustomers(d.customers || []); })
      .catch(() => {});
  }, [storeCode]);

  function stopCamera() {
    clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }
  useEffect(() => () => stopCamera(), []);

  // Conecta stream al <video> una vez que React lo monta
  useEffect(() => {
    if (phase !== 'scanning' || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, [phase]);

  async function startCamera() {
    setError('');
    setPhase('loading');
    setStepIdx(0);

    try {
      // ── Paso 1: cargar módulo JS ──────────────────────────────────────────
      if (!faceapiModule) {
        setStepIdx(0);
        faceapiModule = await import('@vladmandic/face-api');
      }
      const fa = faceapiModule;

      // ── Paso 2: inicializar backend + modelos ─────────────────────────────
      if (!modelsReady) {
        setStepIdx(1);
        try { await fa.tf.setBackend('webgl'); } catch { await fa.tf.setBackend('cpu'); }
        await fa.tf.ready();

        setStepIdx(2);
        await fa.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
        await fa.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL);
        await fa.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
        modelsReady = true;
        bgPromise = Promise.resolve(true);
      }

      // Construir matcher
      if (customers.length > 0) {
        const labeled = customers.map(c =>
          new fa.LabeledFaceDescriptors(String(c.id), [new Float32Array(c.face_descriptor)])
        );
        matcherRef.current = new fa.FaceMatcher(labeled, MATCH_THRESHOLD);
      }

      // ── Paso 3: cámara ────────────────────────────────────────────────────
      setStepIdx(3);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase('scanning');

    } catch (e) {
      // Limpiar estado para que pueda reintentar
      if (!modelsReady) { faceapiModule = null; bgPromise = null; }
      if (e.name === 'NotAllowedError') {
        setError('Permisos de cámara denegados. Actívalos en tu navegador e intenta de nuevo.');
      } else if (e.message?.includes('fetch')) {
        setError('Sin conexión para descargar los modelos. Verifica tu internet.');
      } else {
        setError('Error: ' + e.message);
      }
      setPhase('permission');
    }
  }

  const runDetection = useCallback(async () => {
    if (!faceapiModule || !modelsReady) return;
    const fa = faceapiModule;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const detection = await fa
      .detectSingleFace(video, new fa.TinyFaceDetectorOptions({ scoreThreshold: 0.45 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!detection) { stableCount.current = 0; return; }

    const dims = fa.matchDimensions(canvas, video, true);
    const resized = fa.resizeResults(detection, dims);
    const box = resized.detection.box;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    const scanY = box.y + (Date.now() % 1500) / 1500 * box.height;
    const grad = ctx.createLinearGradient(box.x, scanY - 8, box.x, scanY + 8);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.5, `${accentColor}99`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(box.x, scanY - 8, box.width, 16);

    stableCount.current += 1;
    if (stableCount.current < STABLE_FRAMES) return;

    stableCount.current = 0;
    clearInterval(intervalRef.current);
    stopCamera();

    const descriptor = Array.from(detection.descriptor);
    const cap = document.createElement('canvas');
    cap.width = video.videoWidth; cap.height = video.videoHeight;
    cap.getContext('2d').drawImage(video, 0, 0);
    setCurrentDescriptor(descriptor);
    setCurrentPhoto(cap.toDataURL('image/jpeg', 0.7));

    if (matcherRef.current && customers.length > 0) {
      const best = matcherRef.current.findBestMatch(new Float32Array(descriptor));
      if (best.label !== 'unknown') {
        setMatchedCustomer(customers.find(c => String(c.id) === best.label));
        setPhase('matched');
        return;
      }
    }
    setPhase('not_found');
  }, [customers, accentColor]);

  useEffect(() => {
    if (phase !== 'scanning') return;
    intervalRef.current = setInterval(runDetection, 300);
    return () => clearInterval(intervalRef.current);
  }, [phase, runDetection]);

  async function handleRegister() {
    if (!nameInput.trim()) { setError('Ingresa tu nombre'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`${API}/api/public/${storeCode}/loyalty/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput.trim(), phone: phoneInput.trim() || null, face_descriptor: currentDescriptor, face_photo: currentPhoto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar');
      onResult({ customer: { ...data, purchase_count: 0 }, discountPercent: null });
    } catch (e) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  const qualifies = matchedCustomer && loyaltyConfig &&
    Number(matchedCustomer.purchase_count) >= Number(loyaltyConfig.required_purchases);

  const skip = () => { stopCamera(); onResult({ customer: null, discountPercent: null }); };

  const s = {
    overlay: { position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    card: { background: '#fff', borderRadius: 20, padding: '26px 22px', width: '92%', maxWidth: 390, textAlign: 'center', position: 'relative', maxHeight: '92vh', overflowY: 'auto' },
    close: { position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af', padding: 4 },
    title: { fontSize: 19, fontWeight: 800, color: primaryColor, marginBottom: 6, marginTop: 4 },
    sub: { fontSize: 13, color: '#6b7280', marginBottom: 18, lineHeight: 1.5 },
    btn: { width: '100%', padding: '13px', background: primaryColor, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
    ghost: { width: '100%', padding: '11px', background: 'transparent', color: '#6b7280', border: '1.5px solid #e5e7eb', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginTop: 8 },
    input: { width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 15, marginBottom: 10, boxSizing: 'border-box' },
    err: { color: '#ef4444', fontSize: 12, marginTop: 6, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' },
  };

  return (
    <div style={s.overlay}>
      <div style={s.card}>
        <button style={s.close} onClick={() => { stopCamera(); onClose(); }}>
          <FontAwesomeIcon icon={faTimes} />
        </button>

        {/* ── Pantalla inicial ── */}
        {phase === 'permission' && (
          <>
            <div style={{ fontSize: 44, marginBottom: 10 }}>⭐</div>
            <div style={s.title}>Cliente Habitual</div>
            <div style={s.sub}>Detecta tu rostro para identificarte y acceder a descuentos exclusivos.</div>
            {modelsReady && <div style={{ fontSize: 11, color: '#16a34a', marginBottom: 8 }}>✓ Motor listo — apertura instantánea</div>}
            {error && <div style={s.err}>{error}</div>}
            <button style={s.btn} onClick={startCamera}>
              <FontAwesomeIcon icon={faCamera} />
              {modelsReady ? 'Abrir cámara' : 'Permitir cámara'}
            </button>
            <button style={s.ghost} onClick={skip}>Continuar sin escanear</button>
          </>
        )}

        {/* ── Cargando modelos ── */}
        {phase === 'loading' && (
          <div style={{ padding: '20px 0' }}>
            <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 30, color: primaryColor, marginBottom: 14 }} />
            <div style={s.title}>Preparando reconocimiento</div>

            {/* Barra de progreso */}
            <div style={{ background: '#f3f4f6', borderRadius: 99, height: 8, margin: '16px 0 8px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                borderRadius: 99,
                background: accentColor,
                width: `${Math.round((stepIdx + 1) / STEPS.length * 100)}%`,
                transition: 'width 0.4s ease',
              }} />
            </div>

            {/* Pasos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12, textAlign: 'left' }}>
              {STEPS.map((label, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: i < stepIdx ? '#16a34a' : i === stepIdx ? primaryColor : '#d1d5db', fontWeight: i === stepIdx ? 700 : 400 }}>
                  <span style={{ width: 18, textAlign: 'center', flexShrink: 0 }}>
                    {i < stepIdx ? '✓' : i === stepIdx ? <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 11 }} /> : '○'}
                  </span>
                  {label}
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 14 }}>
              Solo se descarga la primera vez — el navegador lo guarda en caché
            </div>

            <button style={{ ...s.ghost, marginTop: 18 }} onClick={skip}>Omitir y continuar</button>
          </div>
        )}

        {/* ── Escaneando ── */}
        {phase === 'scanning' && (
          <>
            <div style={s.title}>Escaneando rostro…</div>
            <div style={s.sub}>Mira directo a la cámara</div>
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
              <video ref={videoRef} autoPlay muted playsInline
                style={{ width: '100%', minHeight: 220, display: 'block', borderRadius: 12, background: '#111', objectFit: 'cover' }} />
              <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
            </div>
            <button style={s.ghost} onClick={skip}>Omitir</button>
          </>
        )}

        {/* ── Cliente reconocido ── */}
        {phase === 'matched' && matchedCustomer && (
          <>
            <div style={{ fontSize: 44, marginBottom: 10 }}>👋</div>
            <div style={s.title}>¡Hola, {matchedCustomer.name}!</div>
            {qualifies ? (
              <>
                <div style={{ background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 12, padding: '14px', margin: '14px 0', color: '#166534' }}>
                  <div style={{ fontSize: 12, marginBottom: 2 }}>🎉 ¡Cliente habitual!</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{loyaltyConfig.discount_percentage}% de descuento</div>
                  <div style={{ fontSize: 11, marginTop: 3, color: '#4b7c5b' }}>{matchedCustomer.purchase_count} compras realizadas</div>
                </div>
                <button style={{ ...s.btn, background: '#16a34a' }} onClick={() => { stopCamera(); onResult({ customer: matchedCustomer, discountPercent: Number(loyaltyConfig.discount_percentage) }); }}>
                  <FontAwesomeIcon icon={faCheck} /> Aplicar {loyaltyConfig.discount_percentage}% descuento
                </button>
              </>
            ) : (
              <>
                <div style={{ background: '#fef9c3', border: '2px solid #eab308', borderRadius: 12, padding: '12px', margin: '14px 0', color: '#854d0e', fontSize: 13 }}>
                  <FontAwesomeIcon icon={faStar} style={{ color: accentColor, marginRight: 5 }} />
                  Llevas <strong>{matchedCustomer.purchase_count}</strong> de <strong>{loyaltyConfig?.required_purchases}</strong> compras para el {loyaltyConfig?.discount_percentage}% desc.
                </div>
                <button style={s.btn} onClick={() => { stopCamera(); onResult({ customer: matchedCustomer, discountPercent: null }); }}>Continuar</button>
              </>
            )}
            <button style={s.ghost} onClick={skip}>Continuar sin descuento</button>
          </>
        )}

        {/* ── No reconocido ── */}
        {phase === 'not_found' && (
          <>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🤔</div>
            <div style={s.title}>No te reconocemos</div>
            <div style={s.sub}>¿Quieres registrarte para acumular compras y obtener descuentos?</div>
            <button style={{ ...s.btn, background: accentColor, color: primaryColor }} onClick={() => setPhase('register')}>
              <FontAwesomeIcon icon={faUserPlus} /> Registrarme
            </button>
            <button style={s.ghost} onClick={skip}>No, continuar</button>
          </>
        )}

        {/* ── Registro ── */}
        {phase === 'register' && (
          <>
            <div style={{ fontSize: 44, marginBottom: 10 }}>📝</div>
            <div style={s.title}>Registrarme</div>
            <div style={s.sub}>Tu rostro quedará guardado para futuras compras.</div>
            <input style={s.input} placeholder="Tu nombre *" value={nameInput} onChange={e => setNameInput(e.target.value)} />
            <input style={s.input} placeholder="Teléfono (opcional)" value={phoneInput} onChange={e => setPhoneInput(e.target.value)} />
            {error && <div style={s.err}>{error}</div>}
            <button style={s.btn} onClick={handleRegister} disabled={saving}>
              {saving ? <><FontAwesomeIcon icon={faSpinner} spin /> Guardando…</> : <><FontAwesomeIcon icon={faCheck} /> Registrarme</>}
            </button>
            <button style={s.ghost} onClick={skip}>Cancelar</button>
          </>
        )}
      </div>
    </div>
  );
}
