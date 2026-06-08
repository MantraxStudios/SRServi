import { useState, useEffect } from 'react';

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInStandaloneMode = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const STORAGE_KEY = 'srservi_install_dismissed';
const DISMISS_DAYS = 7;

function wasDismissedRecently() {
  try {
    const ts = localStorage.getItem(STORAGE_KEY);
    if (!ts) return false;
    return Date.now() - parseInt(ts) < DISMISS_DAYS * 86400000;
  } catch { return false; }
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Ya instalada como PWA → no mostrar
    if (isInStandaloneMode()) return;
    if (wasDismissedRecently()) return;

    const iosDevice = isIOS();
    setIos(iosDevice);

    if (iosDevice) {
      // En iOS no hay beforeinstallprompt, mostrar instrucciones manuales
      setTimeout(() => setVisible(true), 3000);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setVisible(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY, Date.now().toString()); } catch {}
  };

  const install = async () => {
    if (ios) { dismiss(); return; }
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setVisible(false);
      } else {
        dismiss();
      }
    } catch {
      dismiss();
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop semitransparente */}
      <div
        onClick={dismiss}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 99990,
          animation: 'isbFadeIn 0.2s ease',
        }}
      />

      {/* Card principal */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 99991,
        padding: '0 0 env(safe-area-inset-bottom, 0px)',
        animation: 'isbSlideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{
          background: '#131313',
          borderRadius: '20px 20px 0 0',
          padding: '24px 24px 28px',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
        }}>
          {/* Pill handle */}
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: 'rgba(255,255,255,0.15)',
            margin: '-8px auto 20px',
          }} />

          {/* App info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{
              width: 60, height: 60, borderRadius: 16, overflow: 'hidden', flexShrink: 0,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              border: '1px solid rgba(212,175,55,0.25)',
            }}>
              <img src="/iconweb.png" alt="SRServi" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>SRServi Panel</div>
              <div style={{ color: '#888', fontSize: 13, marginTop: 3 }}>srservi.srautomatic.com</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                {[1,2,3,4,5].map(i => (
                  <span key={i} style={{ color: '#D4AF37', fontSize: 12 }}>★</span>
                ))}
                <span style={{ color: '#666', fontSize: 11 }}>App gratuita</span>
              </div>
            </div>
          </div>

          {/* Descripción */}
          <p style={{
            color: '#aaa', fontSize: 14, lineHeight: 1.5,
            margin: '0 0 20px', padding: '12px 14px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)',
          }}>
            Instala el panel de administración en tu dispositivo para acceso rápido, sin la barra del navegador, como una app nativa.
          </p>

          {ios ? (
            // Instrucciones iOS
            <div>
              <p style={{ color: '#ccc', fontSize: 14, marginBottom: 14, fontWeight: 600 }}>
                Cómo instalar en iPhone/iPad:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {[
                  { n: 1, text: 'Toca el botón Compartir', icon: '□↑' },
                  { n: 2, text: 'Selecciona "Añadir a pantalla de inicio"', icon: '+□' },
                  { n: 3, text: 'Toca "Añadir" para confirmar', icon: '✓' },
                ].map(({ n, text, icon }) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, background: 'rgba(212,175,55,0.15)',
                      border: '1px solid rgba(212,175,55,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#D4AF37', fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>{n}</div>
                    <span style={{ color: '#ccc', fontSize: 13 }}>{text}</span>
                  </div>
                ))}
              </div>
              <button onClick={dismiss} style={{
                width: '100%', padding: '14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#ccc', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              }}>
                Entendido
              </button>
            </div>
          ) : (
            // Botones Android/Desktop
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={dismiss} style={{
                flex: 1, padding: '14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#999', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              }}>
                Ahora no
              </button>
              <button onClick={install} disabled={installing} style={{
                flex: 2, padding: '14px', borderRadius: 12,
                background: installing ? 'rgba(212,175,55,0.5)' : '#D4AF37',
                border: 'none', color: '#000',
                fontSize: 15, fontWeight: 800, cursor: installing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {installing ? (
                  <>
                    <div style={{
                      width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)',
                      borderTopColor: '#000', borderRadius: '50%',
                      animation: 'isbSpin 0.7s linear infinite',
                    }} />
                    Instalando...
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 18 }}>⬇</span>
                    Instalar app
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes isbFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes isbSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes isbSpin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
