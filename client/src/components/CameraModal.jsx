import { useRef, useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faTimes, faCheck, faRedo } from '@fortawesome/free-solid-svg-icons';

/**
 * CameraModal — abre la cámara, captura una foto y devuelve un File.
 *
 * Props:
 *   onCapture(file: File) — llamado con el archivo cuando el usuario confirma
 *   onClose()             — llamado al cancelar
 */
export default function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [photo, setPhoto] = useState(null); // data URL

  // Arranca la cámara al montar
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        alert('No se pudo acceder a la cámara. Verifica los permisos.');
        onClose();
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const capture = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    setPhoto(c.toDataURL('image/jpeg', 0.92));
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  const retake = () => {
    setPhoto(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
  };

  const confirm = () => {
    fetch(photo)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], 'foto-producto.jpg', { type: 'image/jpeg' });
        onCapture(file);
      });
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.93)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 }}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Visor */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, borderRadius: 18, overflow: 'hidden', background: '#111', aspectRatio: '4/3' }}>
        {photo
          ? <img src={photo} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        }
      </div>

      {/* Controles */}
      {!photo ? (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 12, padding: '12px 22px', fontWeight: '700', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <FontAwesomeIcon icon={faTimes} /> Cancelar
          </button>
          <button
            onClick={capture}
            style={{ background: '#D4AF37', border: 'none', color: '#000', borderRadius: '50%', width: 70, height: 70, fontSize: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 5px rgba(212,175,55,0.25)', flexShrink: 0 }}
          >
            <FontAwesomeIcon icon={faCamera} />
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <button
            onClick={retake}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 12, padding: '12px 22px', fontWeight: '700', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <FontAwesomeIcon icon={faRedo} /> Repetir
          </button>
          <button
            onClick={confirm}
            style={{ background: '#2ecc71', border: 'none', color: '#fff', borderRadius: 12, padding: '12px 28px', fontWeight: '800', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(46,204,113,0.3)' }}
          >
            <FontAwesomeIcon icon={faCheck} /> Usar foto
          </button>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
