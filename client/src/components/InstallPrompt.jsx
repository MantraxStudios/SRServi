import { useState, useEffect } from 'react';

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInStandaloneMode = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const DISMISS_KEY = 'srservi_install_dismissed_v2';
const DISMISS_DAYS = 7;

function wasDismissedRecently() {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    return Date.now() - parseInt(ts) < DISMISS_DAYS * 86400000;
  } catch { return false; }
}

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [ios] = useState(isIOS);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;
    if (wasDismissedRecently()) return;

    if (ios) {
      setTimeout(() => setVisible(true), 3500);
      return;
    }

    // Usar el evento capturado antes de que React montara
    const readyNow = window.__pwaInstallPrompt;
    if (readyNow) {
      setPrompt(readyNow);
      setTimeout(() => setVisible(true), 2000);
      return;
    }

    // O esperar el evento si todavía no disparó
    const onReady = () => {
      if (window.__pwaInstallPrompt) {
        setPrompt(window.__pwaInstallPrompt);
        setTimeout(() => setVisible(true), 2000);
      }
    };
    window.addEventListener('pwaInstallReady', onReady);
    return () => window.removeEventListener('pwaInstallReady', onReady);
  }, [ios]);

  // Detectar cuando ya fue instalada
  useEffect(() => {
    const onInstalled = () => { setInstalled(true); setVisible(false); };
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, Date.now().toString()); } catch {}
  };

  const install = async () => {
    if (ios) { dismiss(); return; }
    if (!prompt) return;
    setInstalling(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        window.__pwaInstallPrompt = null;
        setVisible(false);
      } else {
        dismiss();
      }
    } catch {
      dismiss();
    } finally {
      setInstalling(false);
    }
  };

  if (!visible || installed) return null;

  const WA_SVG = (
    <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: 'currentColor', flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );

  return (
    <>
      <div onClick={dismiss} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        zIndex: 99990, animation: 'ipFadeIn 0.2s ease',
      }} />

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 99991,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        animation: 'ipSlideUp 0.32s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{
          background: '#1a1a1a',
          borderRadius: '24px 24px 0 0',
          padding: '0 20px 24px',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
        }}>
          {/* Handle */}
          <div style={{
            width: 40, height: 4, borderRadius: 2,
            background: 'rgba(255,255,255,0.15)',
            margin: '12px auto 20px',
          }} />

          {/* App info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <img
              src="/icon-192.png"
              alt="SRServi"
              style={{
                width: 64, height: 64, borderRadius: 16,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                border: '1px solid rgba(212,175,55,0.2)',
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 19, lineHeight: 1.2 }}>SRServi Panel</div>
              <div style={{ color: '#666', fontSize: 13, marginTop: 3 }}>Panel de Administración</div>
              <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
                {[1,2,3,4,5].map(i => (
                  <span key={i} style={{ color: '#D4AF37', fontSize: 13, lineHeight: 1 }}>★</span>
                ))}
                <span style={{ color: '#555', fontSize: 11, marginLeft: 4 }}>App gratuita</span>
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div style={{
            color: '#888', fontSize: 13, lineHeight: 1.5,
            marginBottom: 20, padding: '10px 12px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 10,
          }}>
            Instala el panel en tu pantalla de inicio. Se abre sin barra del navegador, como una app nativa.
          </div>

          {ios ? (
            <div>
              <p style={{ color: '#ccc', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                Cómo instalar en iPhone:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {[
                  { n: 1, text: 'Toca el botón Compartir  ↑' },
                  { n: 2, text: 'Selecciona "Añadir a pantalla de inicio"' },
                  { n: 3, text: 'Toca "Añadir"' },
                ].map(({ n, text }) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: 'rgba(212,175,55,0.15)',
                      border: '1px solid rgba(212,175,55,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#D4AF37', fontSize: 12, fontWeight: 800, flexShrink: 0,
                    }}>{n}</div>
                    <span style={{ color: '#ccc', fontSize: 14 }}>{text}</span>
                  </div>
                ))}
              </div>
              <button onClick={dismiss} style={{
                width: '100%', padding: 15, borderRadius: 14,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#ccc', fontSize: 16, fontWeight: 700, cursor: 'pointer',
              }}>Entendido</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={dismiss} style={{
                flex: 1, padding: 15, borderRadius: 14,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#888', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              }}>Ahora no</button>
              <button onClick={install} disabled={installing} style={{
                flex: 2.5, padding: 15, borderRadius: 14,
                background: installing ? 'rgba(212,175,55,0.4)' : '#D4AF37',
                border: 'none', color: '#000',
                fontSize: 16, fontWeight: 800,
                cursor: installing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {installing ? (
                  <>
                    <div style={{
                      width: 16, height: 16,
                      border: '2.5px solid rgba(0,0,0,0.25)',
                      borderTopColor: '#000', borderRadius: '50%',
                      animation: 'ipSpin 0.7s linear infinite',
                    }} />
                    Instalando...
                  </>
                ) : (
                  <>⬇ Agregar a inicio</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes ipFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ipSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes ipSpin    { to { transform: rotate(360deg) } }
      `}</style>
    </>
  );
}
