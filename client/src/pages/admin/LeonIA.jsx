import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPaperPlane, faRobot, faUser, faTrash,
  faChartLine, faBox, faClock, faLightbulb,
  faExclamationTriangle, faTags
} from '@fortawesome/free-solid-svg-icons';

const SUGGESTIONS = [
  { icon: faChartLine, text: '¿Cuáles son los más vendidos esta semana?' },
  { icon: faBox, text: '¿Tengo productos sin stock?' },
  { icon: faLightbulb, text: '¿Qué hago con los menos vendidos?' },
  { icon: faChartLine, text: '¿Cuánto ingresé este mes?' },
  { icon: faClock, text: '¿A qué hora vendo más?' },
  { icon: faTags, text: 'Análisis por categoría' },
  { icon: faChartLine, text: 'Dame un resumen de esta semana' },
  { icon: faLightbulb, text: '¿Qué me recomiendas para mejorar?' },
];

function parseMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

function Message({ msg }) {
  const isLeon = msg.role === 'leon';
  return (
    <div className={`leon-bubble-row ${isLeon ? 'leon' : 'user'}`}>
      {isLeon && (
        <div className="leon-avatar-sm">
          <FontAwesomeIcon icon={faRobot} />
        </div>
      )}
      <div className={`leon-bubble ${isLeon ? 'leon' : 'user'}`}>
        {isLeon
          ? <span dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.text) }} />
          : <span>{msg.text}</span>
        }
        <span className="leon-bubble-time">
          {new Date(msg.ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
        </span>
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
      <div className="leon-avatar-sm">
        <FontAwesomeIcon icon={faRobot} />
      </div>
      <div className="leon-bubble leon leon-typing">
        <span className="leon-dot" /><span className="leon-dot" /><span className="leon-dot" />
      </div>
    </div>
  );
}

export default function LeonIA() {
  const { token } = useAuth();
  const { selectedStore } = useStore();
  const [messages, setMessages] = useState([
    {
      role: 'leon',
      text: '¡Hola! Soy **León IA** 🦁, tu asistente de negocios inteligente.\n\nPuedo analizar tus ventas, identificar productos con bajo rendimiento, darte recomendaciones estratégicas y mucho más.\n\n¿En qué puedo ayudarte hoy?',
      ts: Date.now(),
      intent: 'greeting',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const chatRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    if (!selectedStore) {
      setMessages(prev => [...prev, {
        role: 'leon',
        text: '⚠️ Selecciona una tienda primero para que pueda analizar tus datos.',
        ts: Date.now(),
      }]);
      return;
    }

    const userMsg = { role: 'user', text: q, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setShowSuggestions(false);

    // Historial reciente para contexto (últimos 6 mensajes)
    const historyForCtx = [...messages, userMsg].slice(-6).map(m => ({
      role: m.role,
      text: m.text,
      intent: m.intent || null,
      range: m.range || null,
    }));

    try {
      const res = await fetch('/api/leon-ia/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: q,
          store_id: selectedStore.id,
          history: historyForCtx,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || `Error ${res.status}`);
      }

      setMessages(prev => [...prev, {
        role: 'leon',
        text: data.answer,
        ts: Date.now(),
        intent: data.intent,
        range: data.range,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'leon',
        text: `❌ **Error al procesar tu consulta.**\n${err.message}\n\nIntenta de nuevo o recarga la página.`,
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages, selectedStore, token]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      role: 'leon',
      text: 'Chat reiniciado 🔄. ¿En qué puedo ayudarte?',
      ts: Date.now(),
      intent: 'greeting',
    }]);
    setShowSuggestions(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div className="leon-page">
      {/* Header */}
      <div className="leon-header">
        <div className="leon-header-brand">
          <div className="leon-avatar-lg">
            <FontAwesomeIcon icon={faRobot} />
          </div>
          <div className="leon-header-info">
            <div className="leon-header-name">
              León IA
              <span className="leon-status-dot" />
            </div>
            <div className="leon-header-sub">
              {selectedStore ? selectedStore.name : 'Sin tienda seleccionada'} · Análisis en tiempo real
            </div>
          </div>
        </div>
        <button className="leon-clear-btn" onClick={clearChat} title="Limpiar chat">
          <FontAwesomeIcon icon={faTrash} />
          <span>Limpiar</span>
        </button>
      </div>

      {/* Chat */}
      <div className="leon-chat" ref={chatRef}>
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Sugerencias */}
      {showSuggestions && (
        <div className="leon-suggestions">
          <div className="leon-suggestions-label">
            <FontAwesomeIcon icon={faLightbulb} /> Preguntas frecuentes
          </div>
          <div className="leon-suggestions-scroll">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                className="leon-suggestion"
                onClick={() => sendMessage(s.text)}
                disabled={loading}
              >
                <FontAwesomeIcon icon={s.icon} className="leon-suggestion-icon" />
                {s.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form className="leon-input-bar" onSubmit={e => { e.preventDefault(); sendMessage(); }}>
        {!showSuggestions && (
          <button
            type="button"
            className="leon-toggle-suggestions"
            onClick={() => setShowSuggestions(true)}
            title="Ver sugerencias"
          >
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
        <button
          type="submit"
          className="leon-send-btn"
          disabled={loading || !input.trim()}
        >
          <FontAwesomeIcon icon={faPaperPlane} />
        </button>
      </form>
    </div>
  );
}
