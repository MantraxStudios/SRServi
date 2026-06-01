import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCamera, faTimes, faCheck, faSpinner, faStar,
  faUserPlus, faUser, faPhone
} from '@fortawesome/free-solid-svg-icons';

const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
const MATCH_THRESHOLD = 0.5;
const STABLE_FRAMES = 4;
const API = 'https://srservi2.srautomatic.com';

export default function LoyaltyCheckModal({
  storeCode,
  onClose,
  onResult,
  primaryColor = '#111',
  accentColor = '#D4AF37',
}) {
  const [phase, setPhase] = useState('permission');
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

  // Load loyalty data (config + customers + build face matcher)
  useEffect(() => {
    fetch(`${API}/api/public/${storeCode}/loyalty`)
      .then(r => r.json())
      .then(data => {
        setLoyaltyConfig(data.config);
        const cust = data.customers || [];
        setCustomers(cust);
        if (cust.length > 0) {
          const labeled = cust.map(c =>
            new faceapi.LabeledFaceDescriptors(
              String(c.id),
              [new Float32Array(c.face_descriptor)]
            )
          );
          matcherRef.current = new faceapi.FaceMatcher(labeled, MATCH_THRESHOLD);
        }
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
    setPhase('loading');
    setError('');
    try {
      setLoadingMsg('Cargando motor de reconocimiento...');
      if (!faceapi.nets.tinyFaceDetector.isLoaded) {
        try { await faceapi.tf.setBackend('webgl'); } catch { await faceapi.tf.setBackend('cpu'); }
        await faceapi.tf.ready();
        setLoadingMsg('Cargando detector facial...');
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
        setLoadingMsg('Cargando puntos de referencia...');
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL);
        setLoadingMsg('Cargando reconocimiento...');
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPhase('scanning');
    } catch (e) {
      setError(e.name === 'NotAllowedError'
        ? 'Permisos de cámara denegados. Actívalos en tu navegador.'
        : 'Error al iniciar cámara: ' + e.message);
      setPhase('permission');
    }
  }

  const runDetection = useCallback(async () => {
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
    cap.width = video.videoWidth;
    cap.height = video.videoHeight;
    cap.getContext('2d').drawImage(video, 0, 0);
    const photo = cap.toDataURL('image/jpeg', 0.7);

    setCurrentDescriptor(descriptor);
    setCurrentPhoto(photo);

    if (matcherRef.current && customers.length > 0) {
      const best = matcherRef.current.findBestMatch(new Float32Array(descriptor));
      if (best.label !== 'unknown') {
        const found = customers.find(c => String(c.id) === best.label);
        setMatchedCustomer(found);
        setPhase('matched');
        return;
      }
    }
    setPhase('not_found');
  }, [customers, accentColor]);

  useEffect(() => {
    if (phase !== 'scanning') return;
    intervalRef.current = setInterval(runDetection, 250);
    return () => clearInterval(intervalRef.current);
  }, [phase, runDetection]);

  async function handleRegister() {
    if (!nameInput.trim()) { setError('Ingresa tu nombre'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/public/${storeCode}/loyalty/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameInput.trim(),
          phone: phoneInput.trim() || null,
          face_descriptor: currentDescriptor,
          face_photo: currentPhoto,
        }),
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
    card: { background: '#fff', borderRadius: 20, padding: '28px 24px', width: '92%', maxWidth: 400, textAlign: 'center', position: 'relative', maxHeight: '92vh', overflowY: 'auto' },
    close: { position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af', padding: 4 },
    title: { fontSize: 20, fontWeight: 800, color: primaryColor, marginBottom: 6, marginTop: 4 },
    sub: { fontSize: 13, color: '#6b7280', marginBottom: 18, lineHeight: 1.5 },
    primaryBtn: { width: '100%', padding: '13px', background: primaryColor, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
    ghostBtn: { width: '100%', padding: '11px', background: 'transparent', color: '#6b7280', border: '1.5px solid #e5e7eb', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginTop: 8 },
    input: { width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 15, marginBottom: 10, boxSizing: 'border-box', outline: 'none' },
    errMsg: { color: '#ef4444', fontSize: 12, marginTop: 4 },
  };

  return (
    <div style={s.overlay}>
      <div style={s.card}>
        <button style={s.close} onClick={() => { stopCamera(); onClose(); }}>
          <FontAwesomeIcon icon={faTimes} />
        </button>

        {/* ── Permission ── */}
        {phase === 'permission' && (
          <>
            <div style={{ fontSize: 44, marginBottom: 10 }}>⭐</div>
            <div style={s.title}>Cliente Habitual</div>
            <div style={s.sub}>
              Detecta tu rostro para identificarte y obtener descuentos exclusivos por ser cliente frecuente.
            </div>
            {error && <div style={s.errMsg}>{error}</div>}
            <button style={s.primaryBtn} onClick={startCamera}>
              <FontAwesomeIcon icon={faCamera} />
              Permitir cámara y escanear
            </button>
            <button style={s.ghostBtn} onClick={() => onResult({ customer: null, discountPercent: null })}>
              Continuar sin escanear
            </button>
          </>
        )}

        {/* ── Loading ── */}
        {phase === 'loading' && (
          <div style={{ padding: '24px 0' }}>
            <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 34, color: primaryColor, marginBottom: 14 }} />
            <div style={s.title}>{loadingMsg || 'Cargando...'}</div>
          </div>
        )}

        {/* ── Scanning ── */}
        {phase === 'scanning' && (
          <>
            <div style={s.title}>Escaneando rostro...</div>
            <div style={s.sub}>Mira directamente a la cámara</div>
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
              <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', display: 'block', borderRadius: 12 }} />
              <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
            </div>
            <button style={s.ghostBtn} onClick={() => { stopCamera(); onResult({ customer: null, discountPercent: null }); }}>
              Omitir
            </button>
          </>
        )}

        {/* ── Matched ── */}
        {phase === 'matched' && matchedCustomer && (
          <>
            <div style={{ fontSize: 44, marginBottom: 10 }}>👋</div>
            <div style={s.title}>¡Hola, {matchedCustomer.name}!</div>

            {qualifies ? (
              <>
                <div style={{ background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 12, padding: '14px 16px', margin: '14px 0', color: '#166534' }}>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>🎉 ¡Eres cliente habitual!</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>
                    {loyaltyConfig.discount_percentage}% de descuento
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, color: '#4b7c5b' }}>
                    {matchedCustomer.purchase_count} compras realizadas
                  </div>
                </div>
                <button style={{ ...s.primaryBtn, background: '#16a34a' }} onClick={() => {
                  stopCamera();
                  onResult({ customer: matchedCustomer, discountPercent: Number(loyaltyConfig.discount_percentage) });
                }}>
                  <FontAwesomeIcon icon={faCheck} />
                  Aplicar {loyaltyConfig.discount_percentage}% de descuento
                </button>
              </>
            ) : (
              <>
                <div style={{ background: '#fef9c3', border: '2px solid #eab308', borderRadius: 12, padding: '14px 16px', margin: '14px 0', color: '#854d0e' }}>
                  <FontAwesomeIcon icon={faStar} style={{ color: accentColor, marginRight: 6 }} />
                  Llevas <strong>{matchedCustomer.purchase_count}</strong> de{' '}
                  <strong>{loyaltyConfig?.required_purchases}</strong> compras para obtener{' '}
                  el {loyaltyConfig?.discount_percentage}% de descuento
                </div>
                <button style={s.primaryBtn} onClick={() => {
                  stopCamera();
                  onResult({ customer: matchedCustomer, discountPercent: null });
                }}>
                  Continuar
                </button>
              </>
            )}

            <button style={s.ghostBtn} onClick={() => { stopCamera(); onResult({ customer: null, discountPercent: null }); }}>
              Continuar sin descuento
            </button>
          </>
        )}

        {/* ── Not found ── */}
        {phase === 'not_found' && (
          <>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🤔</div>
            <div style={s.title}>No te reconocemos</div>
            <div style={s.sub}>
              ¿Quieres registrarte como cliente habitual y acumular compras para obtener descuentos?
            </div>
            <button style={{ ...s.primaryBtn, background: accentColor, color: primaryColor }} onClick={() => setPhase('register')}>
              <FontAwesomeIcon icon={faUserPlus} />
              Registrarme
            </button>
            <button style={s.ghostBtn} onClick={() => { stopCamera(); onResult({ customer: null, discountPercent: null }); }}>
              No, continuar sin registrarme
            </button>
          </>
        )}

        {/* ── Register ── */}
        {phase === 'register' && (
          <>
            <div style={{ fontSize: 44, marginBottom: 10 }}>📝</div>
            <div style={s.title}>Registrarme</div>
            <div style={s.sub}>Tu rostro se guardará de forma segura para identificarte en futuras compras.</div>

            <div style={{ position: 'relative', marginBottom: 10 }}>
              <FontAwesomeIcon icon={faUser} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14 }} />
              <input
                style={{ ...s.input, paddingLeft: 36 }}
                placeholder="Tu nombre *"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
              />
            </div>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <FontAwesomeIcon icon={faPhone} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14 }} />
              <input
                style={{ ...s.input, paddingLeft: 36, marginBottom: 0 }}
                placeholder="Teléfono (opcional)"
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value)}
              />
            </div>

            {error && <div style={s.errMsg}>{error}</div>}

            <button style={s.primaryBtn} onClick={handleRegister} disabled={saving}>
              {saving
                ? <><FontAwesomeIcon icon={faSpinner} spin /> Guardando...</>
                : <><FontAwesomeIcon icon={faCheck} /> Registrarme</>}
            </button>
            <button style={s.ghostBtn} onClick={() => { stopCamera(); onResult({ customer: null, discountPercent: null }); }}>
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
