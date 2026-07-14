import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot, faTimes, faLightbulb, faVolumeHigh, faVolumeXmark } from '@fortawesome/free-solid-svg-icons';

/**
 * Asistente-guía de compra para el tótem (cliente final).
 * - 100% por reglas (sin backend / sin costo) → confiable en kiosco.
 * - Sugerencias contextuales automáticas según el paso actual (step).
 * - Chat de preguntas frecuentes con respuestas guiadas paso a paso.
 *
 * Props:
 *   step: 'browsing' | 'product' | 'has-items' | 'cart' | 'payment'
 *   cartCount: number
 *   accent: color de acento de la tienda
 *   currencySymbol: símbolo de moneda (para textos)
 */

const CONTEXT_HINTS = {
  browsing:  { icon: '👉', text: 'Toca un producto para empezar tu pedido.' },
  product:   { icon: '🧩', text: 'Personaliza tu producto y toca "Agregar" para sumarlo al carrito.' },
  'has-items': { icon: '🛒', text: 'Cuando termines de elegir, abre el carrito para pagar.' },
  cart:      { icon: '💳', text: 'Revisa tu pedido, elige "Servir aquí" o "Llevar" y toca Pagar.' },
  payment:   { icon: '✅', text: 'Elige tu método de pago y sigue las instrucciones en pantalla.' },
};

// Flujo 100% guiado por botones (el cliente nunca escribe).
// Cada opción tiene: label (texto del botón), answer (respuesta guiada)
// y follow (ids de las opciones que aparecen después para seguir guiando).
const OPTIONS = {
  buy: {
    label: '🛒 ¿Cómo compro?',
    answer:
      'Comprar es muy fácil 😊\n\n' +
      '1️⃣ Toca el producto que quieras.\n' +
      '2️⃣ Personalízalo (ingredientes, extras) y toca "Agregar".\n' +
      '3️⃣ Repite con todo lo que quieras pedir.\n' +
      '4️⃣ Abre el carrito 🛒 para revisar tu pedido.\n' +
      '5️⃣ Elige "Servir aquí" o "Llevar" y toca Pagar.\n\n' +
      '¡Yo te voy guiando en cada paso! 🤖',
    follow: ['add', 'pay'],
  },
  add: {
    label: '➕ Agregar un producto',
    answer:
      'Para agregar un producto:\n\n' +
      '1️⃣ Toca la foto o el nombre del producto.\n' +
      '2️⃣ Si tiene opciones, elígelas (tamaño, extras, ingredientes).\n' +
      '3️⃣ Ajusta la cantidad si quieres.\n' +
      '4️⃣ Toca el botón "Agregar".\n\n' +
      'Verás cómo el carrito 🛒 suma el producto arriba.',
    follow: ['pay', 'remove'],
  },
  pay: {
    label: '💳 ¿Cómo pago?',
    answer:
      'Para pagar tu pedido:\n\n' +
      '1️⃣ Abre el carrito 🛒.\n' +
      '2️⃣ Revisa que todo esté correcto.\n' +
      '3️⃣ Elige "Servir aquí" o "Llevar".\n' +
      '4️⃣ Toca "Pagar".\n' +
      '5️⃣ Elige el método (tarjeta, QR o efectivo) y sigue las instrucciones.\n\n' +
      'Al terminar recibirás tu número de pedido 🎟️',
    follow: ['here', 'total'],
  },
  remove: {
    label: '➖ Quitar o cambiar algo',
    answer:
      'Para quitar o cambiar algo:\n\n' +
      '1️⃣ Abre el carrito 🛒.\n' +
      '2️⃣ Usa los botones – / + para cambiar la cantidad.\n' +
      '3️⃣ Toca el ícono de basura 🗑️ para eliminar un producto.\n\n' +
      'También puedes vaciar todo y empezar de nuevo.',
    follow: ['add', 'pay'],
  },
  here: {
    label: '🍽️ Servir aquí o llevar',
    answer:
      '"Servir aquí" es para comer en el local 🍽️\n' +
      '"Llevar" es para llevarte el pedido 🥡\n\n' +
      'Elige la opción al abrir el carrito, justo antes de pagar. Si es en mesa, puede pedirte el número de mesa.',
    follow: ['pay', 'total'],
  },
  total: {
    label: '🧾 Ver el total',
    answer:
      'El total lo ves en el carrito 🛒 (arriba a la derecha).\n\n' +
      'Ahí aparece el detalle de cada producto y el monto a pagar antes de confirmar.',
    follow: ['pay', 'add'],
  },
  restart: {
    label: '🔄 Empezar de nuevo',
    answer:
      'Si quieres empezar de nuevo:\n\n' +
      '1️⃣ Abre el carrito 🛒.\n' +
      '2️⃣ Vacía los productos con el ícono de basura 🗑️.\n\n' +
      'Si no tocas nada por un rato, el tótem vuelve solo al inicio. ¡Tranquilo! 😊',
    follow: ['buy', 'add'],
  },
};

// Menú principal (todas las opciones, en orden).
const MENU_IDS = ['buy', 'add', 'pay', 'remove', 'here', 'total', 'restart'];

const GREETING = '¡Hola! 🤖 Soy tu asistente de compra. Te guío paso a paso para que pidas fácil y rápido. Toca una opción de abajo 👇';

// ---- Text-to-Speech (voz que guía la venta) ----
const TTS_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Deja el texto listo para leer en voz alta: quita emojis, viñetas y numeración.
function cleanForSpeech(text) {
  return (text || '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️‍]/gu, '') // emojis/símbolos
    .replace(/[•·▪]/g, '')
    .replace(/^\s*\d+[️⃣.)-]*\s*/gm, '') // "1️⃣", "1." al inicio de línea
    .replace(/["“”]/g, '')
    .replace(/\n+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Elige la mejor voz en español disponible (prioriza es-CL/es-MX/es-ES).
function pickSpanishVoice() {
  if (!TTS_SUPPORTED) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const prefs = ['es-cl', 'es-419', 'es-mx', 'es-us', 'es-es', 'es'];
  for (const p of prefs) {
    const v = voices.find((x) => (x.lang || '').toLowerCase().startsWith(p));
    if (v) return v;
  }
  return voices.find((x) => (x.lang || '').toLowerCase().startsWith('es')) || null;
}

export default function StoreGuide({ step = 'browsing', cartCount = 0, accent = '#D4AF37' }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'bot', text: GREETING }]);
  const [suggestions, setSuggestions] = useState(MENU_IDS);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [muted, setMuted] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('sg_tts_muted') === '1';
  });
  const bodyRef = useRef(null);
  const lastStepRef = useRef(step);
  const mutedRef = useRef(muted);
  const voiceRef = useRef(null);
  const greetedRef = useRef(false);

  const hint = CONTEXT_HINTS[step] || null;

  // Mantiene sincronizado el ref para poder consultar el estado dentro de callbacks.
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // Carga la voz en español (las voces llegan de forma asíncrona en algunos navegadores).
  useEffect(() => {
    if (!TTS_SUPPORTED) return;
    const load = () => { voiceRef.current = pickSpanishVoice(); };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    };
  }, []);

  // Lee un texto en voz alta (cancela lo anterior para no encimar audios).
  const speak = useCallback((text) => {
    if (!TTS_SUPPORTED || mutedRef.current) return;
    const clean = cleanForSpeech(text);
    if (!clean) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = (voiceRef.current && voiceRef.current.lang) || 'es-ES';
      if (voiceRef.current) u.voice = voiceRef.current;
      u.rate = 1;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
    } catch { /* noop */ }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      try { localStorage.setItem('sg_tts_muted', next ? '1' : '0'); } catch { /* noop */ }
      if (next && TTS_SUPPORTED) { try { window.speechSynthesis.cancel(); } catch { /* noop */ } }
      return next;
    });
  }, []);

  // Reaparece la sugerencia cuando cambia el paso, y la lee en voz alta.
  useEffect(() => {
    if (lastStepRef.current !== step) {
      lastStepRef.current = step;
      setHintDismissed(false);
      const h = CONTEXT_HINTS[step];
      if (h) speak(h.text);
    }
  }, [step, speak]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, open]);

  // Abre el panel; saluda por voz solo la primera vez (no re-lee al reabrir).
  const openPanel = useCallback(() => {
    setOpen(true);
    setHintDismissed(true);
    if (!greetedRef.current) {
      greetedRef.current = true;
      speak(GREETING);
    }
  }, [speak]);

  // El cliente elige una opción → mostramos su respuesta y las siguientes opciones.
  const choose = (id) => {
    const opt = OPTIONS[id];
    if (!opt) return;
    setMessages((prev) => [...prev, { role: 'user', text: opt.label }, { role: 'bot', text: opt.answer }]);
    speak(opt.answer);
    // Opciones de seguimiento + siempre "Ver todo el menú".
    const next = (opt.follow || []).filter((x) => x !== id);
    setSuggestions([...next, 'menu']);
  };

  const styles = useMemo(() => `
    /* Botón pequeño y redondo, POR ENCIMA de la barra del carrito */
    .sg-fab {
      position: fixed; bottom: 92px; left: 16px; z-index: 9990;
      width: 54px; height: 54px; padding: 0; border-radius: 50%; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      background: ${accent}; color: #1a1a1a;
      box-shadow: 0 8px 22px rgba(0,0,0,0.32);
      font-family: inherit;
      transition: transform .18s ease;
    }
    .sg-fab:hover { transform: scale(1.08); }
    .sg-fab-icon { font-size: 22px; }
    .sg-fab-ping { position: absolute; top: -2px; right: -2px; width: 13px; height: 13px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 0 rgba(239,68,68,0.6); animation: sg-ping 1.8s infinite; }
    @keyframes sg-ping { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6);} 70% { box-shadow: 0 0 0 10px rgba(239,68,68,0);} 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0);} }

    /* Globo de mensaje que baja desde arriba, anclado sobre el botón */
    .sg-hint {
      position: fixed; bottom: 156px; left: 16px; z-index: 9989; max-width: 300px;
      background: #fff; color: #1a1a1a; border-radius: 16px; padding: 12px 14px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.22); border: 2px solid ${accent};
      display: flex; gap: 10px; align-items: flex-start; font-size: 14.5px; line-height: 1.4;
      animation: sg-drop .3s cubic-bezier(.2,.8,.3,1.2);
    }
    /* Colita del globo apuntando hacia abajo (al botón) */
    .sg-hint::after {
      content: ''; position: absolute; bottom: -10px; left: 22px;
      width: 18px; height: 18px; background: #fff;
      border-right: 2px solid ${accent}; border-bottom: 2px solid ${accent};
      transform: rotate(45deg); border-bottom-right-radius: 3px;
    }
    @keyframes sg-drop { from { opacity: 0; transform: translateY(-14px) scale(.96);} to { opacity: 1; transform: none;} }
    .sg-hint-icon { font-size: 20px; flex-shrink: 0; }
    .sg-hint-close { margin-left: 6px; background: none; border: none; color: #999; cursor: pointer; font-size: 15px; flex-shrink: 0; }

    .sg-panel {
      position: fixed; z-index: 9991; display: flex; flex-direction: column;
      bottom: 22px; left: 22px; width: 380px; height: 560px; max-height: calc(100vh - 44px);
      background: #fff; border-radius: 20px; overflow: hidden;
      box-shadow: 0 24px 70px rgba(0,0,0,0.34); border: 1px solid rgba(0,0,0,0.08);
      font-family: inherit;
    }
    .sg-head { background: #1a1a1a; color: #fff; padding: 15px 16px; display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
    .sg-ava { width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0; background: ${accent}; color: #1a1a1a; display: flex; align-items: center; justify-content: center; font-size: 19px; }
    .sg-t { font-weight: 800; font-size: 16px; line-height: 1.1; }
    .sg-s { font-size: 11.5px; color: #22c55e; margin-top: 2px; }
    .sg-mute { margin-left: auto; background: none; border: none; color: ${accent}; font-size: 18px; cursor: pointer; padding: 6px 8px; }
    .sg-x { background: none; border: none; color: #bbb; font-size: 20px; cursor: pointer; padding: 6px; }

    .sg-body { flex: 1; overflow-y: auto; padding: 16px; background: #f6f6f7; display: flex; flex-direction: column; gap: 10px; }
    .sg-msg { max-width: 84%; padding: 12px 14px; border-radius: 16px; font-size: 15px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
    .sg-msg.bot { align-self: flex-start; background: #fff; border: 1px solid #eee; border-bottom-left-radius: 5px; }
    .sg-msg.user { align-self: flex-end; background: ${accent}; color: #1a1a1a; font-weight: 600; border-bottom-right-radius: 5px; }

    .sg-quick { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 16px; background: #fff; border-top: 1px solid #eee; flex-shrink: 0; max-height: 40vh; overflow-y: auto; }
    .sg-quick button { background: #fff; border: 1.5px solid ${accent}; color: #1a1a1a; border-radius: 999px; padding: 11px 16px; font-size: 14.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .15s ease; }
    .sg-quick button:hover { background: ${accent}22; }
    .sg-quick .sg-menu-btn { background: ${accent}; color: #1a1a1a; border-color: ${accent}; font-weight: 700; }

    @media (max-width: 480px) {
      .sg-panel { inset: 0; width: 100vw; height: 100dvh; max-height: none; border-radius: 0; border: none; }
      .sg-fab { bottom: 88px; left: 12px; }
      .sg-hint { left: 12px; right: 12px; max-width: none; bottom: 150px; }
    }
  `, [accent]);

  return (
    <>
      <style>{styles}</style>

      {/* Sugerencia contextual automática */}
      {!open && hint && !hintDismissed && (
        <div className="sg-hint">
          <span className="sg-hint-icon">{hint.icon}</span>
          <span>{hint.text}</span>
          <button className="sg-hint-close" onClick={() => setHintDismissed(true)} aria-label="Cerrar sugerencia">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      {/* Botón flotante */}
      {!open && (
        <button className="sg-fab" onClick={openPanel} aria-label="Abrir asistente de ayuda" title="¿Necesitas ayuda?">
          <span className="sg-fab-icon"><FontAwesomeIcon icon={faRobot} /></span>
          <span className="sg-fab-ping" />
        </button>
      )}

      {/* Panel de chat */}
      {open && (
        <div className="sg-panel">
          <div className="sg-head">
            <div className="sg-ava"><FontAwesomeIcon icon={faRobot} /></div>
            <div>
              <div className="sg-t">Asistente de compra</div>
              <div className="sg-s">● Te guío paso a paso</div>
            </div>
            {TTS_SUPPORTED && (
              <button
                className="sg-mute"
                onClick={toggleMute}
                aria-label={muted ? 'Activar voz' : 'Silenciar voz'}
                title={muted ? 'Activar voz' : 'Silenciar voz'}
              >
                <FontAwesomeIcon icon={muted ? faVolumeXmark : faVolumeHigh} />
              </button>
            )}
            <button className="sg-x" onClick={() => setOpen(false)} aria-label="Cerrar">
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          <div className="sg-body" ref={bodyRef}>
            {hint && (
              <div className="sg-msg bot" style={{ background: '#fffbe9', borderColor: accent }}>
                <FontAwesomeIcon icon={faLightbulb} style={{ color: accent, marginRight: 6 }} />
                {hint.text}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`sg-msg ${m.role}`}>{m.text}</div>
            ))}
          </div>

          {/* Opciones guiadas: el cliente solo toca, nunca escribe */}
          <div className="sg-quick">
            {suggestions.map((id) =>
              id === 'menu' ? (
                <button key="menu" className="sg-menu-btn" onClick={() => setSuggestions(MENU_IDS)}>
                  🏠 Ver todo el menú
                </button>
              ) : (
                <button key={id} onClick={() => choose(id)}>{OPTIONS[id]?.label}</button>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}
