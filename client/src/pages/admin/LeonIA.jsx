import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPaperPlane, faRobot, faUser, faTrash,
  faChartLine, faBox, faClock, faLightbulb, faTags, faBars
} from '@fortawesome/free-solid-svg-icons';

const SUGGESTIONS = [
  { icon: faChartLine, text: '¿Cuáles son los más vendidos esta semana?' },
  { icon: faBox,       text: '¿Tengo productos sin stock?' },
  { icon: faLightbulb, text: '¿Qué hago con los menos vendidos?' },
  { icon: faChartLine, text: '¿Cuánto ingresé este mes?' },
  { icon: faClock,     text: '¿A qué hora vendo más?' },
  { icon: faTags,      text: 'Análisis por categoría' },
  { icon: faChartLine, text: 'Dame un resumen de esta semana' },
  { icon: faLightbulb, text: '¿Qué me recomiendas para mejorar?' },
];

function parseMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

// ── Gráfico de barras SVG ──────────────────────────────────────────────────
function BarChart({ chart }) {
  if (!chart || !chart.values || !chart.values.length) return null;

  const { title, labels, values, unit, color, highlight } = chart;
  const W = 320, H = 140, PAD = { t: 28, r: 8, b: 36, l: 42 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const max = Math.max(...values, 1);
  const n = values.length;
  const barW = Math.max(6, Math.min(32, (innerW / n) * 0.65));
  const gap = innerW / n;

  // Y-axis ticks
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const val = (max / tickCount) * i;
    const y = PAD.t + innerH - (val / max) * innerH;
    return { val, y };
  });

  const fmtVal = (v) => {
    if (unit === '$') return v >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${Math.round(v)}`;
    return String(Math.round(v));
  };

  return (
    <div className="leon-chart">
      <div className="leon-chart-title">{title}</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {/* grid lines */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={PAD.l - 4} y={t.y + 4} textAnchor="end"
              fontSize="9" fill="rgba(255,255,255,0.3)">
              {fmtVal(t.val)}
            </text>
          </g>
        ))}

        {/* bars */}
        {values.map((v, i) => {
          const bh = Math.max(2, (v / max) * innerH);
          const x = PAD.l + gap * i + (gap - barW) / 2;
          const y = PAD.t + innerH - bh;
          const isHigh = i === highlight;
          const isMax = v === max;
          const barColor = (isHigh || isMax) ? color : `${color}88`;

          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh}
                rx="3" fill={barColor}
                style={{ transition: 'height 0.3s ease' }}
              />
              {/* value label on top for max or highlight */}
              {(isMax || isHigh) && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle"
                  fontSize="9" fontWeight="700" fill={color}>
                  {fmtVal(v)}
                </text>
              )}
              {/* x-axis label */}
              <text
                x={x + barW / 2}
                y={PAD.t + innerH + 14}
                textAnchor="middle"
                fontSize="9"
                fill="rgba(255,255,255,0.4)"
                transform={labels[i] && labels[i].length > 5
                  ? `rotate(-30, ${x + barW / 2}, ${PAD.t + innerH + 14})`
                  : undefined}
              >
                {labels[i] || ''}
              </text>
            </g>
          );
        })}

        {/* axes */}
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + innerH}
          stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        <line x1={PAD.l} y1={PAD.t + innerH} x2={W - PAD.r} y2={PAD.t + innerH}
          stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      </svg>
      <div className="leon-chart-unit">{unit}</div>
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────
function Message({ msg }) {
  const isLeon = msg.role === 'leon';
  return (
    <div className={`leon-bubble-row ${isLeon ? 'leon' : 'user'}`}>
      {isLeon && (
        <div className="leon-avatar-sm">
          <FontAwesomeIcon icon={faRobot} />
        </div>
      )}
      <div className="leon-bubble-col">
        <div className={`leon-bubble ${isLeon ? 'leon' : 'user'}`}>
          {isLeon
            ? <span dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.text) }} />
            : <span>{msg.text}</span>
          }
          <span className="leon-bubble-time">
            {new Date(msg.ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        {isLeon && msg.chart && <BarChart chart={msg.chart} />}
      </div>
      {!isLeon && (
        <div className="leon-avatar-sm user">
          <FontAwesomeIcon icon={faUser} />
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="leon-bubble-row leon">
      <div className="leon-avatar-sm"><FontAwesomeIcon icon={faRobot} /></div>
      <div className="leon-bubble leon leon-typing">
        <span className="leon-dot" /><span className="leon-dot" /><span className="leon-dot" />
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function LeonIA() {
  const { token } = useAuth();
  const { selectedStore, setMenuOpen } = useStore();
  const [messages, setMessages] = useState([{
    role: 'leon',
    text: '¡Hola! Soy **León IA** 🦁, tu asistente de negocios inteligente.\n\nPuedo analizar tus ventas, identificar productos con bajo rendimiento, darte recomendaciones estratégicas y mucho más.\n\n¿En qué puedo ayudarte hoy?',
    ts: Date.now(),
    intent: 'greeting',
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    if (!selectedStore) {
      setMessages(prev => [...prev, {
        role: 'leon', text: '⚠️ Selecciona una tienda primero.', ts: Date.now(),
      }]);
      return;
    }

    const userMsg = { role: 'user', text: q, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setShowSuggestions(false);

    const historyForCtx = [...messages, userMsg].slice(-8).map(m => ({
      role: m.role, text: m.text, intent: m.intent || null, range: m.range || null,
    }));

    try {
      const res = await fetch('/api/leon-ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ question: q, store_id: selectedStore.id, history: historyForCtx }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Error ${res.status}`);
      setMessages(prev => [...prev, {
        role: 'leon', text: data.answer, chart: data.chart || null,
        ts: Date.now(), intent: data.intent, range: data.range,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'leon',
        text: `❌ **Error:** ${err.message}\n\nIntenta de nuevo.`,
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages, selectedStore, token]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => {
    setMessages([{
      role: 'leon', text: 'Chat reiniciado 🔄. ¿En qué puedo ayudarte?',
      ts: Date.now(), intent: 'greeting',
    }]);
    setShowSuggestions(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div className="leon-page">
      <div className="leon-header">
        <button className="leon-menu-btn" onClick={() => setMenuOpen(true)} title="Abrir menú">
          <FontAwesomeIcon icon={faBars} />
        </button>
        <div className="leon-header-brand">
          <div className="leon-avatar-lg"><FontAwesomeIcon icon={faRobot} /></div>
          <div className="leon-header-info">
            <div className="leon-header-name">
              León IA <span className="leon-status-dot" />
            </div>
            <div className="leon-header-sub">
              {selectedStore ? selectedStore.name : 'Sin tienda'} · Análisis en tiempo real
            </div>
          </div>
        </div>
        <button className="leon-clear-btn" onClick={clearChat} title="Limpiar chat">
          <FontAwesomeIcon icon={faTrash} /><span>Limpiar</span>
        </button>
      </div>

      <div className="leon-chat">
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {showSuggestions && (
        <div className="leon-suggestions">
          <div className="leon-suggestions-label">
            <FontAwesomeIcon icon={faLightbulb} /> Preguntas frecuentes
          </div>
          <div className="leon-suggestions-scroll">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} className="leon-suggestion"
                onClick={() => sendMessage(s.text)} disabled={loading}>
                <FontAwesomeIcon icon={s.icon} className="leon-suggestion-icon" />
                {s.text}
              </button>
            ))}
          </div>
        </div>
      )}

      <form className="leon-input-bar" onSubmit={e => { e.preventDefault(); sendMessage(); }}>
        {!showSuggestions && (
          <button type="button" className="leon-toggle-suggestions"
            onClick={() => setShowSuggestions(true)} title="Ver sugerencias">
            <FontAwesomeIcon icon={faLightbulb} />
          </button>
        )}
        <input
          ref={inputRef}
          className="leon-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? 'León está analizando...' : 'Escribe tu pregunta...'}
          disabled={loading}
          autoComplete="off"
        />
        <button type="submit" className="leon-send-btn"
          disabled={loading || !input.trim()}>
          <FontAwesomeIcon icon={faPaperPlane} />
        </button>
      </form>
    </div>
  );
}
