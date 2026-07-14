import { useState, useEffect, useRef, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot, faTimes, faPaperPlane, faLightbulb } from '@fortawesome/free-solid-svg-icons';

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

// Intenciones por reglas: cada una con palabras clave y respuesta guiada.
const INTENTS = [
  {
    keys: ['como compro', 'como pido', 'como hago', 'como funciona', 'empezar', 'comprar', 'realizar', 'pedido', 'como uso'],
    answer:
      'Comprar es muy fácil 😊\n\n' +
      '1️⃣ Toca el producto que quieras.\n' +
      '2️⃣ Personalízalo (ingredientes, extras) y toca "Agregar".\n' +
      '3️⃣ Repite con todo lo que quieras pedir.\n' +
      '4️⃣ Abre el carrito 🛒 para revisar tu pedido.\n' +
      '5️⃣ Elige "Servir aquí" o "Llevar" y toca Pagar.\n\n' +
      '¡Yo te voy guiando en cada paso! 🤖',
  },
  {
    keys: ['agregar', 'agrego', 'añadir', 'anadir', 'sumar', 'carrito como', 'como pongo', 'seleccionar producto'],
    answer:
      'Para agregar un producto:\n\n' +
      '1️⃣ Toca la foto o el nombre del producto.\n' +
      '2️⃣ Si tiene opciones, elígelas (tamaño, extras, ingredientes).\n' +
      '3️⃣ Ajusta la cantidad si quieres.\n' +
      '4️⃣ Toca el botón "Agregar".\n\n' +
      'Verás cómo el carrito 🛒 suma el producto arriba.',
  },
  {
    keys: ['pagar', 'pago', 'como pago', 'tarjeta', 'efectivo', 'transferencia', 'qr'],
    answer:
      'Para pagar tu pedido:\n\n' +
      '1️⃣ Abre el carrito 🛒.\n' +
      '2️⃣ Revisa que todo esté correcto.\n' +
      '3️⃣ Elige "Servir aquí" o "Llevar".\n' +
      '4️⃣ Toca "Pagar".\n' +
      '5️⃣ Elige el método (tarjeta, QR o efectivo) y sigue las instrucciones.\n\n' +
      'Al terminar recibirás tu número de pedido 🎟️',
  },
  {
    keys: ['quitar', 'eliminar', 'borrar', 'sacar', 'me equivoque', 'equivoque', 'cambiar cantidad', 'menos'],
    answer:
      'Para quitar o cambiar algo:\n\n' +
      '1️⃣ Abre el carrito 🛒.\n' +
      '2️⃣ Usa los botones – / + para cambiar la cantidad.\n' +
      '3️⃣ Toca el ícono de basura 🗑️ para eliminar un producto.\n\n' +
      'También puedes vaciar todo y empezar de nuevo.',
  },
  {
    keys: ['servir', 'llevar', 'aqui', 'para llevar', 'comer aqui', 'mesa', 'takeaway'],
    answer:
      '"Servir aquí" es para comer en el local 🍽️\n' +
      '"Llevar" es para llevarte el pedido 🥡\n\n' +
      'Elige la opción al abrir el carrito, justo antes de pagar. Si es en mesa, puede pedirte el número de mesa.',
  },
  {
    keys: ['total', 'cuanto', 'precio', 'cuesta', 'valor', 'suma'],
    answer:
      'El total lo ves en el carrito 🛒 (arriba a la derecha).\n\n' +
      'Ahí aparece el detalle de cada producto y el monto a pagar antes de confirmar.',
  },
  {
    keys: ['cancelar', 'empezar de nuevo', 'reiniciar', 'borrar todo', 'vaciar', 'salir'],
    answer:
      'Si quieres empezar de nuevo:\n\n' +
      '1️⃣ Abre el carrito 🛒.\n' +
      '2️⃣ Vacía los productos con el ícono de basura 🗑️.\n\n' +
      'Si no tocas nada por un rato, el tótem vuelve solo al inicio. ¡Tranquilo! 😊',
  },
];

const QUICK = ['¿Cómo compro?', '¿Cómo pago?', '¿Cómo agrego algo?', '¿Cómo quito un producto?'];

const GREETING = '¡Hola! 🤖 Soy tu asistente de compra. Te guío paso a paso para que pidas fácil y rápido. ¿En qué te ayudo?';
const FALLBACK =
  'Te ayudo con tu compra 😊\n\n' +
  '• Toca un producto para agregarlo.\n' +
  '• Abre el carrito 🛒 para revisar.\n' +
  '• Toca "Pagar" y elige cómo pagar.\n\n' +
  'Prueba con: "¿cómo pago?" o "¿cómo agrego algo?"';

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function matchIntent(text) {
  const t = normalize(text);
  let best = null;
  let bestScore = 0;
  for (const intent of INTENTS) {
    const score = intent.keys.reduce((acc, k) => acc + (t.includes(normalize(k)) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = intent; }
  }
  return bestScore > 0 ? best.answer : FALLBACK;
}

export default function StoreGuide({ step = 'browsing', cartCount = 0, accent = '#D4AF37' }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'bot', text: GREETING }]);
  const [input, setInput] = useState('');
  const [hintDismissed, setHintDismissed] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const bodyRef = useRef(null);
  const lastStepRef = useRef(step);

  const hint = CONTEXT_HINTS[step] || null;

  // Reaparece la sugerencia cuando cambia el paso.
  useEffect(() => {
    if (lastStepRef.current !== step) {
      lastStepRef.current = step;
      setHintDismissed(false);
    }
  }, [step]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, open]);

  const send = (text) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setShowQuick(false);
    setInput('');
    const answer = matchIntent(msg);
    setMessages((prev) => [...prev, { role: 'user', text: msg }, { role: 'bot', text: answer }]);
  };

  const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } };

  const styles = useMemo(() => `
    .sg-fab {
      position: fixed; bottom: 22px; left: 22px; z-index: 9990;
      display: flex; align-items: center; gap: 10px;
      padding: 12px 18px 12px 14px; border-radius: 999px; border: none; cursor: pointer;
      background: ${accent}; color: #1a1a1a;
      box-shadow: 0 8px 26px rgba(0,0,0,0.32);
      font-weight: 800; font-size: 16px; font-family: inherit;
      transition: transform .18s ease;
    }
    .sg-fab:hover { transform: scale(1.05); }
    .sg-fab-icon { font-size: 22px; }
    .sg-fab-ping { position: absolute; top: -3px; right: -3px; width: 14px; height: 14px; border-radius: 50%; background: #ef4444; box-shadow: 0 0 0 rgba(239,68,68,0.6); animation: sg-ping 1.8s infinite; }
    @keyframes sg-ping { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6);} 70% { box-shadow: 0 0 0 10px rgba(239,68,68,0);} 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0);} }

    .sg-hint {
      position: fixed; bottom: 86px; left: 22px; z-index: 9989; max-width: 320px;
      background: #fff; color: #1a1a1a; border-radius: 16px; padding: 14px 16px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.22); border: 2px solid ${accent};
      display: flex; gap: 10px; align-items: flex-start; font-size: 15px; line-height: 1.4;
      animation: sg-pop .25s ease;
    }
    @keyframes sg-pop { from { opacity: 0; transform: translateY(8px) scale(.96);} to { opacity: 1; transform: none;} }
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
    .sg-x { margin-left: auto; background: none; border: none; color: #bbb; font-size: 20px; cursor: pointer; padding: 6px; }

    .sg-body { flex: 1; overflow-y: auto; padding: 16px; background: #f6f6f7; display: flex; flex-direction: column; gap: 10px; }
    .sg-msg { max-width: 84%; padding: 12px 14px; border-radius: 16px; font-size: 15px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
    .sg-msg.bot { align-self: flex-start; background: #fff; border: 1px solid #eee; border-bottom-left-radius: 5px; }
    .sg-msg.user { align-self: flex-end; background: ${accent}; color: #1a1a1a; font-weight: 600; border-bottom-right-radius: 5px; }

    .sg-quick { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 16px 12px; background: #f6f6f7; }
    .sg-quick button { background: #fff; border: 1.5px solid ${accent}; color: #1a1a1a; border-radius: 999px; padding: 9px 14px; font-size: 13.5px; cursor: pointer; font-family: inherit; }

    .sg-input { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #eee; background: #fff; flex-shrink: 0; }
    .sg-input input { flex: 1; border: 1.5px solid #ddd; border-radius: 999px; padding: 13px 16px; font-size: 15px; outline: none; font-family: inherit; }
    .sg-input input:focus { border-color: ${accent}; }
    .sg-input button { width: 48px; height: 48px; border-radius: 50%; border: none; flex-shrink: 0; cursor: pointer; background: ${accent}; color: #1a1a1a; font-size: 17px; }
    .sg-input button:disabled { opacity: .5; cursor: default; }

    @media (max-width: 480px) {
      .sg-panel { inset: 0; width: 100vw; height: 100dvh; max-height: none; border-radius: 0; border: none; }
      .sg-fab { bottom: 16px; left: 16px; }
      .sg-hint { left: 16px; right: 16px; max-width: none; bottom: 80px; }
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
        <button className="sg-fab" onClick={() => { setOpen(true); setHintDismissed(true); }} aria-label="Abrir asistente de ayuda">
          <span className="sg-fab-icon"><FontAwesomeIcon icon={faRobot} /></span>
          ¿Ayuda?
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

          {showQuick && (
            <div className="sg-quick">
              {QUICK.map((q) => (
                <button key={q} onClick={() => send(q)}>{q}</button>
              ))}
            </div>
          )}

          <div className="sg-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Escribe tu pregunta…"
            />
            <button onClick={() => send()} disabled={!input.trim()} aria-label="Enviar">
              <FontAwesomeIcon icon={faPaperPlane} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
