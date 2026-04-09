import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTicketAlt, faPaperPlane, faImage, faTimes, faLock, faRedo, faCheckCircle, faExclamationTriangle, faCircle, faUserShield, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { io } from 'socket.io-client';

const API = 'https://srservi2.srautomatic.com';
const PRIORITIES = [
  { value: 'low', label: 'Leve', color: '#95a5a6' },
  { value: 'normal', label: 'Normal', color: '#3498db' },
  { value: 'important', label: 'Importante', color: '#f39c12' },
  { value: 'urgent', label: 'Urgente', color: '#e74c3c' },
];

let notificationAudio = null;
function ensureAudio() {
  if (!notificationAudio) {
    notificationAudio = new Audio('/notification.mp3');
    notificationAudio.volume = 1;
    notificationAudio.load();
  }
}
function playNotificationSound() {
  try {
    ensureAudio();
    notificationAudio.currentTime = 0;
    const p = notificationAudio.play();
    if (p && p.catch) p.catch(() => {
      // Fallback: Web Audio API beep
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [880, 1100].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = freq; osc.type = 'sine';
          const t = ctx.currentTime + i * 0.15;
          gain.gain.setValueAtTime(0.3, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
          osc.start(t); osc.stop(t + 0.3);
        });
      } catch {}
    });
  } catch {}
}
// Unlock audio on first user interaction
if (typeof document !== 'undefined') {
  const unlock = () => { ensureAudio(); notificationAudio.play().then(() => { notificationAudio.pause(); notificationAudio.currentTime = 0; }).catch(() => {}); document.removeEventListener('click', unlock); document.removeEventListener('touchstart', unlock); };
  document.addEventListener('click', unlock, { once: true });
  document.addEventListener('touchstart', unlock, { once: true });
}

function Tickets() {
  const { token } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [ticketData, setTicketData] = useState(null);
  const [newMsg, setNewMsg] = useState('');
  const [msgImage, setMsgImage] = useState(null);
  const [sending, setSending] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newPriority, setNewPriority] = useState('normal');
  const [newMessage, setNewMessage] = useState('');
  const [createdPin, setCreatedPin] = useState(null);
  const [mobileChat, setMobileChat] = useState(false);
  const msgEndRef = useRef(null);
  const selectedTicketRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => { selectedTicketRef.current = selectedTicket; }, [selectedTicket]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch(API + '/api/tickets', { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) setTickets(await res.json());
    } catch {} finally { setLoading(false); }
  }, [token]);

  const loadMessages = useCallback(async (ticketId) => {
    try {
      const res = await fetch(API + `/api/tickets/${ticketId}/messages`, { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) {
        const data = await res.json();
        setTicketData(data.ticket);
        setMessages(data.messages);
        scrollToBottom();
      }
    } catch {}
  }, [token, scrollToBottom]);

  useEffect(() => {
    fetchTickets();
    const socket = io(API);
    socketRef.current = socket;

    socket.on('ticket_message', (data) => {
      if (data.sender_type === 'admin') playNotificationSound();
      // Always reload messages for the current ticket
      const current = selectedTicketRef.current;
      if (current && data.ticket_id === current) {
        loadMessages(current);
      }
      fetchTickets();
    });

    socket.on('ticket_updated', () => {
      fetchTickets();
      const current = selectedTicketRef.current;
      if (current) loadMessages(current);
    });

    socket.on('ticket_created', () => fetchTickets());

    // Poll every 5s as fallback for missed socket events
    const poll = setInterval(() => {
      fetchTickets();
      const current = selectedTicketRef.current;
      if (current) loadMessages(current);
    }, 5000);

    return () => { socket.disconnect(); clearInterval(poll); };
  }, [fetchTickets, loadMessages]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const openTicket = (id) => { setSelectedTicket(id); loadMessages(id); setMobileChat(true); };

  const sendMessage = async () => {
    if (!newMsg.trim() && !msgImage) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('message', newMsg.trim());
      if (msgImage) fd.append('image', msgImage);
      await fetch(API + `/api/tickets/${selectedTicket}/messages`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd
      });
      setNewMsg(''); setMsgImage(null);
      loadMessages(selectedTicket);
      fetchTickets();
    } catch {} finally { setSending(false); }
  };

  const createTicket = async () => {
    if (!newSubject.trim() || !newMessage.trim()) return;
    try {
      const res = await fetch(API + '/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ subject: newSubject.trim(), priority: newPriority, message: newMessage.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedPin(data.support_pin);
        setNewSubject(''); setNewMessage(''); setNewPriority('normal');
        fetchTickets();
        // Auto open the new ticket
        setTimeout(() => { openTicket(data.id); }, 500);
      }
    } catch {}
  };

  const closeTicket = async () => {
    await fetch(API + `/api/tickets/${selectedTicket}/close`, { method: 'PUT', headers: { Authorization: 'Bearer ' + token } });
    fetchTickets(); loadMessages(selectedTicket);
  };

  const reopenTicket = async () => {
    await fetch(API + `/api/tickets/${selectedTicket}/reopen`, { method: 'PUT', headers: { Authorization: 'Bearer ' + token } });
    fetchTickets(); loadMessages(selectedTicket);
  };

  const getPriority = (p) => PRIORITIES.find(pr => pr.value === p) || PRIORITIES[1];

  if (loading) return <div className="loading">Cargando...</div>;

  const ticketList = (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      {tickets.length === 0 && <div className="empty-state" style={{ padding: '40px 20px' }}><p className="empty-state-text">No hay tickets</p></div>}
      {tickets.map(t => {
        const pr = getPriority(t.priority);
        return (
          <div key={t.id} onClick={() => openTicket(t.id)}
            style={{ padding: '12px 14px', borderRadius: '10px', marginBottom: '6px', cursor: 'pointer', border: selectedTicket === t.id ? '2px solid var(--primary)' : '2px solid transparent', background: selectedTicket === t.id ? '#f0f4ff' : '#fafafa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: '700' }}>#{t.id}</span>
              <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: '700', background: pr.color + '22', color: pr.color }}>{pr.label}</span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '2px' }}>{t.subject}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888' }}>
              <span style={{ color: t.status === 'open' ? '#2ecc71' : t.status === 'resolved' ? '#9b59b6' : '#95a5a6' }}>
                <FontAwesomeIcon icon={faCircle} style={{ fontSize: '6px', marginRight: '4px' }} />
                {t.status === 'open' ? 'Abierto' : t.status === 'resolved' ? 'Resuelto' : 'Cerrado'}
              </span>
              <span>{new Date(t.updated_at).toLocaleDateString()}</span>
            </div>
            {t.assigned_to && <div style={{ fontSize: '10px', color: '#9b59b6', marginTop: '4px' }}><FontAwesomeIcon icon={faUserShield} /> {t.assigned_to}</div>}
          </div>
        );
      })}
    </div>
  );

  const chatArea = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden', height: '100%' }}>
      {!selectedTicket ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
          <div style={{ textAlign: 'center' }}><FontAwesomeIcon icon={faTicketAlt} style={{ fontSize: '48px', marginBottom: '12px' }} /><p>Selecciona un ticket</p></div>
        </div>
      ) : (
        <>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #e0e0e0', background: '#fafafa', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => { setMobileChat(false); setSelectedTicket(null); }} className="btn btn-sm btn-secondary" style={{ display: 'none' }} id="ticket-back-btn"><FontAwesomeIcon icon={faArrowLeft} /></button>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: '700', fontSize: '15px' }}>#{ticketData?.id} - {ticketData?.subject}</span>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                <FontAwesomeIcon icon={faLock} /> PIN: {ticketData?.support_pin}
                {ticketData?.assigned_to && <span style={{ marginLeft: '12px', color: '#9b59b6' }}><FontAwesomeIcon icon={faUserShield} /> {ticketData.assigned_to}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {ticketData?.status === 'open' && <button onClick={closeTicket} className="btn btn-sm btn-secondary">Cerrar</button>}
              {ticketData?.status === 'closed' && <button onClick={reopenTicket} className="btn btn-sm btn-primary"><FontAwesomeIcon icon={faRedo} /> Reabrir</button>}
              {ticketData?.status === 'resolved' && <span style={{ fontSize: '12px', color: '#9b59b6', fontWeight: '700' }}><FontAwesomeIcon icon={faCheckCircle} /> Resuelto</span>}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.map(m => (
              <div key={m.id} style={{ alignSelf: m.sender_type === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%', display: 'flex', gap: '8px', flexDirection: m.sender_type === 'user' ? 'row-reverse' : 'row' }}>
                {m.sender_type === 'admin' && (
                  <div style={{ flexShrink: 0, marginTop: '2px' }}>
                    {m.sender_avatar ? (
                      <img src={API + m.sender_avatar} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: m.sender_name === 'SRServi Bot' ? '#e8f5e9' : '#f3e5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: m.sender_name === 'SRServi Bot' ? '#4caf50' : '#9b59b6' }}>
                        <FontAwesomeIcon icon={faUserShield} />
                      </div>
                    )}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ padding: '10px 14px', borderRadius: m.sender_type === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.sender_type === 'user' ? 'var(--primary, #000)' : m.sender_name === 'SRServi Bot' ? '#e8f5e9' : '#f0f0f0', color: m.sender_type === 'user' ? '#fff' : '#333', fontSize: '14px' }}>
                    {m.message}
                    {m.image && <img src={API + m.image} alt="" style={{ maxWidth: '200px', borderRadius: '8px', marginTop: '6px', display: 'block' }} />}
                    {!m.message && !m.image && m.sender_type === 'user' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', opacity: 0.8 }}>
                        <FontAwesomeIcon icon={faLock} /> Imagen enviada — solo el soporte de SRServi puede acceder a las imagenes por seguridad
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px', textAlign: m.sender_type === 'user' ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: m.sender_type === 'user' ? 'flex-end' : 'flex-start' }}>
                    {m.sender_name} - {new Date(m.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            <div ref={msgEndRef} />
          </div>
          {ticketData?.status !== 'resolved' && (
            <div style={{ padding: '12px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '8px', alignItems: 'center' }}>
              {msgImage && (
                <div style={{ position: 'relative' }}>
                  <img src={URL.createObjectURL(msgImage)} alt="" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                  <button onClick={() => setMsgImage(null)} style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '50%', width: '16px', height: '16px', fontSize: '8px', cursor: 'pointer' }}><FontAwesomeIcon icon={faTimes} /></button>
                </div>
              )}
              <label style={{ cursor: 'pointer', color: '#888', fontSize: '18px' }}>
                <FontAwesomeIcon icon={faImage} />
                <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) setMsgImage(e.target.files[0]); }} style={{ display: 'none' }} />
              </label>
              <input type="text" value={newMsg} onChange={(e) => setNewMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }} placeholder="Escribe un mensaje..." style={{ flex: 1, padding: '10px', border: '2px solid #e0e0e0', borderRadius: '10px', outline: 'none', fontSize: '14px' }} />
              <button onClick={sendMessage} disabled={sending || (!newMsg.trim() && !msgImage)} style={{ background: 'var(--primary, #000)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 16px', cursor: 'pointer', fontSize: '14px' }}>
                <FontAwesomeIcon icon={faPaperPlane} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .ticket-layout { flex-direction: column !important; height: auto !important; }
          .ticket-sidebar { width: 100% !important; max-height: ${mobileChat ? '0' : 'none'} !important; overflow: ${mobileChat ? 'hidden' : 'auto'} !important; padding: ${mobileChat ? '0' : '0'} !important; }
          .ticket-chat { display: ${mobileChat ? 'flex' : 'none'} !important; height: calc(100vh - 120px) !important; }
          #ticket-back-btn { display: inline-flex !important; }
        }
      `}</style>
      <header className="admin-header">
        <h1><FontAwesomeIcon icon={faTicketAlt} /> Soporte</h1>
        <button onClick={() => { setShowNew(true); setCreatedPin(null); }} className="btn btn-primary"><FontAwesomeIcon icon={faPlus} /> Nuevo Ticket</button>
      </header>
      <div className="admin-main ticket-layout" style={{ display: 'flex', gap: '16px', height: 'calc(100vh - 120px)' }}>
        <div className="ticket-sidebar" style={{ width: '320px', flexShrink: 0 }}>{ticketList}</div>
        <div className="ticket-chat" style={{ flex: 1, display: 'flex' }}>{chatArea}</div>
      </div>

      {showNew && (
        <div className="modal-overlay" onClick={() => { setShowNew(false); setCreatedPin(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{createdPin ? 'Ticket Creado' : 'Nuevo Ticket'}</h2>
              <button className="modal-close" onClick={() => { setShowNew(false); setCreatedPin(null); }}>&times;</button>
            </div>
            {createdPin ? (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '48px', color: '#2ecc71', marginBottom: '12px' }} />
                <h3>Ticket enviado</h3>
                <p style={{ color: '#888', fontSize: '14px' }}>Tu PIN de soporte es:</p>
                <div style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '8px', color: 'var(--primary)', margin: '12px 0' }}>{createdPin}</div>
                <p style={{ fontSize: '12px', color: '#aaa' }}><FontAwesomeIcon icon={faExclamationTriangle} /> Guarda este PIN.</p>
                <button onClick={() => { setShowNew(false); setCreatedPin(null); }} className="btn btn-primary btn-full" style={{ marginTop: '12px' }}>Entendido</button>
              </div>
            ) : (
              <div style={{ padding: '0 20px 20px' }}>
                <div className="form-group">
                  <label>Asunto *</label>
                  <input type="text" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Describe brevemente el problema" />
                </div>
                <div className="form-group">
                  <label>Prioridad</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {PRIORITIES.map(p => (
                      <button key={p.value} onClick={() => setNewPriority(p.value)}
                        style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', borderColor: newPriority === p.value ? p.color : '#e0e0e0', background: newPriority === p.value ? p.color + '15' : '#fff', color: newPriority === p.value ? p.color : '#888', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Mensaje *</label>
                  <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Describe tu problema en detalle..." rows={4} style={{ width: '100%', resize: 'vertical' }} />
                </div>
                <button onClick={createTicket} disabled={!newSubject.trim() || !newMessage.trim()} className="btn btn-primary btn-full">Enviar Ticket</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default Tickets;
