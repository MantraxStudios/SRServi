import { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCamera, faTimes, faCheck, faSpinner, faStar, faUserPlus, faUser, faPhone,
} from '@fortawesome/free-solid-svg-icons';

// Estado global persistente en memoria (sobrevive re-renders, se pierde al recargar la página)
let faceapiModule = null;
let modelsReady = false;
let preloadPromise = null;

// Llamar esto en background desde Store.jsx cuando loyalty está habilitado
export async function preloadFaceApi() {
  if (modelsReady) return;
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    try {
      if (!faceapiModule) faceapiModule = await import('@vladmandic/face-api');
      const faceapi = faceapiModule;
      if (!faceapi.nets.tinyFaceDetector.isLoaded) {
        try { await faceapi.tf.setBackend('webgl'); } catch { await faceapi.tf.setBackend('cpu'); }
        await faceapi.tf.ready();
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
      }
      modelsReady = true;
    } catch {
      preloadPromise = null; // permitir reintentar si falla
    }
  })();
  return preloadPromise;
}

const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
const MATCH_THRESHOLD = 0.5;
const STABLE_FRAMES = 4;
const API = 'https://srservi2.srautomatic.com';

export default function LoyaltyCheckModal({ storeCode, onClose, onResult, primaryColor = '#111', accentColor = '#D4AF37' }) {
  const [phase, setPhase] = useState('permission'); // permission | loading | scanning | matched | not_found | register
  const [loadingMsg, setLoadingMsg] = useState('');
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

  // Cargar datos de loyalty al montar
  useEffect(() => {
    fetch(`${API}/api/public/${storeCode}/loyalty`)
      .then(r => r.json())
      .then(data => {
        setLoyaltyConfig(data.config);
        setCustomers(data.customers || []);
      })
      .catch(() => {});
  }, [storeCode]);

  function stopCamera() {
    clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  useEffect(() => () => stopCamera(), []);

  async function startCamera() {
    setError('');
    // Si los modelos ya están listos, saltar directamente a cámara
    if (!modelsReady) {
      setPhase('loading');
      setLoadingMsg('Cargando motor IA…');
      await preloadFaceApi();
    }
    try {
      const faceapi = faceapiModule;

      // Construir matcher con clientes cargados
      if (customers.length > 0) {
        const labeled = customers.map(c =>
          new faceapi.LabeledFaceDescriptors(String(c.id), [new Float32Array(c.face_descriptor)])
        );
        matcherRef.current = new faceapi.FaceMatcher(labeled, MATCH_THRESHOLD);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase('scanning'); // video element se renderiza DESPUÉS de este setState
    } catch (e) {
      setError(e.name === 'NotAllowedError'
        ? 'Permisos de cámara denegados. Actívalos en tu navegador.'
        : 'Error: ' + e.message);
      setPhase('permission');
    }
  }

  // Conecta el stream al <video> después de que React lo renderice en fase 'scanning'
  useEffect(() => {
    if (phase !== 'scanning') return;
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [phase]);

  const runDetection = useCallback(async () => {
    if (!faceapiModule) return;
    const faceapi = faceapiModule;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.45 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!detection) { stableCount.current = 0; return; }

    const dims = faceapi.matchDimensions(canvas, video, true);
    const resized = faceapi.resizeResults(detection, dims);
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
    const photo = cap.toDataURL('image/jpeg', 0.7);
    setCurrentDescriptor(descriptor);
    setCurrentPhoto(photo);

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
    } finally {
      setSaving(false);
    }
  }

  const qualifies = matchedCustomer && loyaltyConfig &&
    Number(matchedCustomer.purchase_count) >= Number(loyaltyConfig.required_purchases);

  const s = {
    overlay: { position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    card: { background: '#fff', borderRadius: 20, padding: '26px 22px', width: '92%', maxWidth: 390, textAlign: 'center', position: 'relative', maxHeight: '92vh', overflowY: 'auto' },
    close: { position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af', padding: 4 },
    title: { fontSize: 19, fontWeight: 800, color: primaryColor, marginBottom: 6, marginTop: 4 },
    sub: { fontSize: 13, color: '#6b7280', marginBottom: 18, lineHeight: 1.5 },
    btn: { width: '100%', padding: '13px', background: primaryColor, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
    ghost: { width: '100%', padding: '11px', background: 'transparent', color: '#6b7280', border: '1.5px solid #e5e7eb', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginTop: 8 },
    input: { width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 15, marginBottom: 10, boxSizing: 'border-box' },
    err: { color: '#ef4444', fontSize: 12, marginTop: 4 },
  };

  const skip = () => { stopCamera(); onResult({ customer: null, discountPercent: null }); };

  return (
    <div style={s.overlay}>
      <div style={s.card}>
        <button style={s.close} onClick={() => { stopCamera(); onClose(); }}>
          <FontAwesomeIcon icon={faTimes} />
        </button>

        {phase === 'permission' && (
          <>
            <div style={{ fontSize: 44, marginBottom: 10 }}>⭐</div>
            <div style={s.title}>Cliente Habitual</div>
            <div style={s.sub}>Detecta tu rostro para identificarte y acceder a descuentos exclusivos.</div>
            {modelsReady && (
              <div style={{ fontSize: 11, color: '#16a34a', marginBottom: 8 }}>✓ Motor listo</div>
            )}
            {error && <div style={s.err}>{error}</div>}
            <button style={s.btn} onClick={startCamera}>
              <FontAwesomeIcon icon={faCamera} /> Permitir cámara
            </button>
            <button style={s.ghost} onClick={skip}>Continuar sin escanear</button>
          </>
        )}

        {phase === 'loading' && (
          <div style={{ padding: '28px 0' }}>
            <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 32, color: primaryColor, marginBottom: 14 }} />
            <div style={s.title}>{loadingMsg || 'Cargando…'}</div>
          </div>
        )}

        {phase === 'scanning' && (
          <>
            <div style={s.title}>Escaneando…</div>
            <div style={s.sub}>Mira directo a la cámara</div>
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', minHeight: 220, display: 'block', borderRadius: 12, background: '#111', objectFit: 'cover' }}
              />
              <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
            </div>
            <button style={s.ghost} onClick={skip}>Omitir</button>
          </>
        )}

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
