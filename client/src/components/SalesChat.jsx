import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faTimes, faPaperPlane, faRobot } from '@fortawesome/free-solid-svg-icons';
import { API_URL } from '../config';

const styles = `
  .sc-fab {
    position: fixed; bottom: 22px; right: 22px; z-index: 9998;
    width: 62px; height: 62px; border-radius: 50%; border: none; cursor: pointer;
    background: linear-gradient(135deg, #D4AF37 0%, #b8941f 100%);
    color: #1a1a1a; font-size: 26px;
    box-shadow: 0 8px 26px rgba(212,175,55,0.5);
    display: flex; align-items: center; justify-content: center;
    transition: transform .2s ease, box-shadow .2s ease;
  }
  .sc-fab:hover { transform: scale(1.08); box-shadow: 0 10px 30px rgba(212,175,55,0.65); }
  .sc-fab-badge {
    position: absolute; top: -4px; right: -4px; background: #ef4444; color: #fff;
    border-radius: 999px; font-size: 11px; font-weight: 700; padding: 2px 6px;
    box-shadow: 0 2px 6px rgba(0,0,0,.3);
  }

  .sc-panel {
    position: fixed; z-index: 9999; display: flex; flex-direction: column;
    background: #ffffff; overflow: hidden;
    bottom: 22px; right: 22px; width: 380px; height: 560px; max-height: calc(100vh - 44px);
    border-radius: 18px; box-shadow: 0 20px 60px rgba(0,0,0,0.28);
    border: 1px solid rgba(212,175,55,0.35);
    font-family: 'Inter', system-ui, sans-serif;
  }

  .sc-header {
    background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
    color: #fff; padding: 14px 16px; display: flex; align-items: center; gap: 11px;
    flex-shrink: 0;
  }
  .sc-avatar {
    width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, #D4AF37, #b8941f); color: #1a1a1a;
    display: flex; align-items: center; justify-content: center; font-size: 18px;
  }
  .sc-title { font-weight: 700; font-size: 15px; line-height: 1.1; }
  .sc-status { font-size: 11px; color: #22c55e; display: flex; align-items: center; gap: 5px; margin-top: 2px; }
  .sc-status::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: #22c55e; }
  .sc-close { margin-left: auto; background: none; border: none; color: #bbb; font-size: 18px; cursor: pointer; padding: 6px; }
  .sc-close:hover { color: #fff; }

  .sc-body {
    flex: 1; overflow-y: auto; padding: 16px; background: #f7f7f8;
    display: flex; flex-direction: column; gap: 10px;
  }
  .sc-msg { max-width: 82%; padding: 10px 13px; border-radius: 14px; font-size: 14px; line-height: 1.45; white-space: pre-wrap; word-wrap: break-word; }
  .sc-msg.bot { align-self: flex-start; background: #fff; color: #1a1a1a; border: 1px solid #eee; border-bottom-left-radius: 4px; }
  .sc-msg.user { align-self: flex-end; background: linear-gradient(135deg, #D4AF37, #b8941f); color: #1a1a1a; border-bottom-right-radius: 4px; }
  .sc-typing { align-self: flex-start; display: flex; gap: 4px; padding: 12px 14px; background: #fff; border: 1px solid #eee; border-radius: 14px; }
  .sc-typing span { width: 7px; height: 7px; border-radius: 50%; background: #D4AF37; animation: sc-bounce 1.2s infinite ease-in-out; }
  .sc-typing span:nth-child(2) { animation-delay: .2s; }
  .sc-typing span:nth-child(3) { animation-delay: .4s; }
  @keyframes sc-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .5; } 30% { transform: translateY(-5px); opacity: 1; } }

  .sc-quick { display: flex; flex-wrap: wrap; gap: 7px; padding: 0 16px 10px; background: #f7f7f8; }
  .sc-quick button {
    background: #fff; border: 1px solid #D4AF37; color: #1a1a1a; border-radius: 999px;
    padding: 7px 12px; font-size: 12.5px; cursor: pointer; transition: background .15s;
  }
  .sc-quick button:hover { background: #fdf6e3; }

  .sc-cta { margin: 0 16px 10px; background: #f7f7f8; }
  .sc-cta button {
    width: 100%; background: linear-gradient(135deg, #D4AF37, #b8941f); color: #1a1a1a;
    border: none; border-radius: 12px; padding: 11px; font-weight: 700; font-size: 14px; cursor: pointer;
  }

  .sc-input { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #eee; background: #fff; flex-shrink: 0; }
  .sc-input input {
    flex: 1; border: 1px solid #ddd; border-radius: 999px; padding: 11px 15px; font-size: 14px; outline: none;
  }
  .sc-input input:focus { border-color: #D4AF37; }
  .sc-input button {
    width: 44px; height: 44px; border-radius: 50%; border: none; flex-shrink: 0; cursor: pointer;
    background: linear-gradient(135deg, #D4AF37, #b8941f); color: #1a1a1a; font-size: 16px;
  }
  .sc-input button:disabled { opacity: .5; cursor: default; }

  @media (max-width: 480px) {
    .sc-panel {
      inset: 0; width: 100vw; height: 100vh; height: 100dvh; max-height: none;
      border-radius: 0; border: none;
    }
    .sc-fab { bottom: 16px; right: 16px; width: 56px; height: 56px; font-size: 23px; }
  }
`;

const WELCOME = '¡Hola! 👋 Soy Sofía, tu asesora de SRServi. Te ayudo a digitalizar tu negocio: punto de venta, pedidos, inventario, delivery y más. ¿Qué tipo de local tienes?';
const QUICK = ['¿Cuánto cuesta?', 'Tengo un restaurante', '¿Qué incluye?', 'Quiero una demo'];

export default function SalesChat({ source = 'landing', autoOpen = false }) {
  const [open, setOpen] = useState(autoOpen);
  const [messages, setMessages] = useState([{ role: 'sofia', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const bodyRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, loading, open]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setShowQuick(false);
    setInput('');
    const history = messages.map(m => ({ role: m.role, text: m.text }));
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sales-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: msg, history, source }),
      });
      const data = await res.json();
      const answer = data.answer || 'Disculpa, tuve un problema. ¿Me lo repites? 🙏';
      setMessages(prev => [...prev, { role: 'sofia', text: answer }]);
      if (data.lead && (data.lead.phone || data.lead.email)) setLeadCaptured(true);
    } catch {
      setMessages(prev => [...prev, { role: 'sofia', text: 'Ups, no pude conectar. Intenta de nuevo en un momento 🙏' }]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <>
      <style>{styles}</style>
      {!open && (
        <button className="sc-fab" onClick={() => setOpen(true)} aria-label="Abrir chat de ventas">
          <FontAwesomeIcon icon={faComments} />
          <span className="sc-fab-badge">1</span>
        </button>
      )}

      {open && (
        <div className="sc-panel">
          <div className="sc-header">
            <div className="sc-avatar"><FontAwesomeIcon icon={faRobot} /></div>
            <div>
              <div className="sc-title">Sofía · SRServi</div>
              <div className="sc-status">En línea · responde al instante</div>
            </div>
            <button className="sc-close" onClick={() => setOpen(false)} aria-label="Cerrar">
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          <div className="sc-body" ref={bodyRef}>
            {messages.map((m, i) => (
              <div key={i} className={`sc-msg ${m.role === 'user' ? 'user' : 'bot'}`}>{m.text}</div>
            ))}
            {loading && (
              <div className="sc-typing"><span></span><span></span><span></span></div>
            )}
          </div>

          {showQuick && !loading && (
            <div className="sc-quick">
              {QUICK.map(q => (
                <button key={q} onClick={() => send(q)}>{q}</button>
              ))}
            </div>
          )}

          {leadCaptured && (
            <div className="sc-cta">
              <button onClick={() => navigate('/register')}>Crear mi cuenta gratis →</button>
            </div>
          )}

          <div className="sc-input">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Escribe tu mensaje…"
              disabled={loading}
            />
            <button onClick={() => send()} disabled={loading || !input.trim()} aria-label="Enviar">
              <FontAwesomeIcon icon={faPaperPlane} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
