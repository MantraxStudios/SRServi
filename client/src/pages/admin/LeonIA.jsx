import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faRobot, faUser, faTrash, faLightbulb } from '@fortawesome/free-solid-svg-icons';

const SUGGESTIONS = [
  '¿Cuáles son los más vendidos esta semana?',
  '¿Qué hago con los productos menos vendidos?',
  '¿Cuánto ingresé este mes?',
  '¿A qué hora vendo más?',
  '¿Tengo productos sin stock?',
  'Dame un resumen de esta semana',
  '¿Qué me recomiendas para mejorar ventas?',
  'Análisis por categoría',
];

function formatMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

export default function LeonIA() {
  const { token } = useAuth();
  const { selectedStore } = useStore();
  const [messages, setMessages] = useState([
    {
      role: 'leon',
      text: '¡Hola! Soy **León IA** 🦁, tu asistente de negocios inteligente.\n\nPuedo analizar tus ventas, identificar productos con bajo rendimiento, darte recomendaciones estratégicas y mucho más.\n\n¿En qué puedo ayudarte hoy?',
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    if (!selectedStore) {
      setMessages(prev => [...prev, { role: 'leon', text: '⚠️ Selecciona una tienda primero para que pueda analizar tus datos.', ts: Date.now() }]);
      return;
    }

    setMessages(prev => [...prev, { role: 'user', text: q, ts: Date.now() }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/leon-ia/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ question: q, store_id: selectedStore.id }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'leon', text: data.answer || 'No pude obtener una respuesta.', ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'leon', text: '❌ Hubo un error al procesar tu consulta. Intenta de nuevo.', ts: Date.now() }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const clearChat = () => {
    setMessages([{
      role: 'leon',
      text: '¡Conversación reiniciada! ¿En qué puedo ayudarte?',
      ts: Date.now(),
    }]);
  };

  return (
    <div className="leon-ia-page">
      <div className="leon-ia-header">
        <div className="leon-ia-header-brand">
          <div className="leon-ia-avatar large">
            <FontAwesomeIcon icon={faRobot} />
          </div>
          <div>
            <h1 className="leon-ia-title">León IA</h1>
            <span className="leon-ia-subtitle">Asistente de negocios • {selectedStore?.name || 'Sin tienda'}</span>
          </div>
        </div>
        <button className="leon-ia-clear-btn" onClick={clearChat} title="Limpiar chat">
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>

      <div className="leon-ia-chat">
        {messages.map((msg, i) => (
          <div key={i} className={`leon-ia-bubble-row ${msg.role}`}>
            {msg.role === 'leon' && (
              <div className="leon-ia-avatar small">
                <FontAwesomeIcon icon={faRobot} />
              </div>
            )}
            <div className={`leon-ia-bubble ${msg.role}`}>
              <span dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.text) }} />
            </div>
            {msg.role === 'user' && (
              <div className="leon-ia-avatar small user">
                <FontAwesomeIcon icon={faUser} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="leon-ia-bubble-row leon">
            <div className="leon-ia-avatar small">
              <FontAwesomeIcon icon={faRobot} />
            </div>
            <div className="leon-ia-bubble leon leon-ia-typing">
              <span className="leon-ia-dot" />
              <span className="leon-ia-dot" />
              <span className="leon-ia-dot" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="leon-ia-suggestions">
        <div className="leon-ia-suggestions-label">
          <FontAwesomeIcon icon={faLightbulb} /> Sugerencias
        </div>
        <div className="leon-ia-suggestions-list">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} className="leon-ia-suggestion-btn" onClick={() => sendMessage(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <form
        className="leon-ia-input-bar"
        onSubmit={e => { e.preventDefault(); sendMessage(); }}
      >
        <input
          ref={inputRef}
          className="leon-ia-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Pregúntale algo a León IA..."
          disabled={loading}
          autoComplete="off"
        />
        <button
          type="submit"
          className="leon-ia-send-btn"
          disabled={loading || !input.trim()}
        >
          <FontAwesomeIcon icon={faPaperPlane} />
        </button>
      </form>
    </div>
  );
}
