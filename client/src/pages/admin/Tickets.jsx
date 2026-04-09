import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTicketAlt, faPaperPlane, faImage, faTimes, faLock, faRedo, faCheckCircle, faExclamationTriangle, faCircle, faUserShield, faVolumeUp } from '@fortawesome/free-solid-svg-icons';
import { io } from 'socket.io-client';

const API = 'https://srservi2.srautomatic.com';
const PRIORITIES = [
  { value: 'low', label: 'Leve', color: '#95a5a6' },
  { value: 'normal', label: 'Normal', color: '#3498db' },
  { value: 'important', label: 'Importante', color: '#f39c12' },
  { value: 'urgent', label: 'Urgente', color: '#e74c3c' },
];

// Notification sound using Web Audio API
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    // Second beep
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 1100;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.45);
  } catch {}
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
  const msgEndRef = useRef(null);
  const selectedTicketRef = useRef(null);

  useEffect(() => { selectedTicketRef.current = selectedTicket; }, [selectedTicket]);

  useEffect(() => {
    fetchTickets();
    const socket = io(API);
    socket.on('ticket_message', (data) => {
      // Play sound for admin replies
      if (data.sender_type === 'admin') {
        playNotificationSound();
      }
      // Reload messages if viewing this ticket
      if (selectedTicketRef.current && data.ticket_id === selectedTicketRef.current) {
        loadMessages(selectedTicketRef.current);
      }
      fetchTickets();
    });
    socket.on('ticket_updated', () => fetchTickets());
    socket.on('ticket_created', () => fetchTickets());
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchTickets = async () => {
    try {
      const res = await fetch(API + '/api/tickets', { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) setTickets(await res.json());
    } catch {} finally { setLoading(false); }
  };

  const loadMessages = async (ticketId) => {
    try {
      const res = await fetch(API + `/api/tickets/${ticketId}/messages`, { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) {
        const data = await res.json();
        setTicketData(data.ticket);
        setMessages(data.messages);
      }
    } catch {}
  };

  const openTicket = (id) => { setSelectedTicket(id); loadMessages(id); };

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

  return (
    <>
      <header className="admin-header">
        <h1><FontAwesomeIcon icon={faTicketAlt} /> Soporte</h1>
        <button onClick={() => { setShowNew(true); setCreatedPin(null); }} className="btn btn-primary"><FontAwesomeIcon icon={faPlus} /> Nuevo Ticket</button>
      </header>
      <div className="admin-main" style={{ display: 'flex', gap: '16px', height: 'calc(100vh - 120px)' }}>
        {/* Ticket list */}
        <div style={{ width: '320px', flexShrink: 0, overflowY: 'auto' }}>
          {tickets.length === 0 && <div className="empty-state"><p className="empty-state-text">No hay tickets</p></div>}
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
                {t.assigned_to && (
                  <div style={{ fontSize: '10px', color: '#9b59b6', marginTop: '4px' }}>
                    <FontAwesomeIcon icon={faUserShield} /> {t.assigned_to}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
          {!selectedTicket ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
              <div style={{ textAlign: 'center' }}>
                <FontAwesomeIcon icon={faTicketAlt} style={{ fontSize: '48px', marginBottom: '12px' }} />
                <p>Selecciona un ticket</p>
              </div>
            </div>
          ) : (
            <>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #e0e0e0', background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: '700', fontSize: '15px' }}>#{ticketData?.id} - {ticketData?.subject}</span>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                      <FontAwesomeIcon icon={faLock} /> PIN: {ticketData?.support_pin}
                      {ticketData?.assigned_to && (
                        <span style={{ marginLeft: '12px', color: '#9b59b6' }}>
                          <FontAwesomeIcon icon={faUserShield} /> Atendido por: <strong>{ticketData.assigned_to}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {ticketData?.status === 'open' && (
                      <button onClick={closeTicket} className="btn btn-sm btn-secondary">Cerrar</button>
                    )}
                    {ticketData?.status === 'closed' && (
                      <button onClick={reopenTicket} className="btn btn-sm btn-primary"><FontAwesomeIcon icon={faRedo} /> Reabrir</button>
                    )}
                    {ticketData?.status === 'resolved' && (
                      <span style={{ fontSize: '12px', color: '#9b59b6', fontWeight: '700' }}><FontAwesomeIcon icon={faCheckCircle} /> Resuelto</span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {messages.map(m => (
                  <div key={m.id} style={{ alignSelf: m.sender_type === 'user' ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                    <div style={{ padding: '10px 14px', borderRadius: m.sender_type === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.sender_type === 'user' ? 'var(--primary, #000)' : '#f0f0f0', color: m.sender_type === 'user' ? '#fff' : '#333', fontSize: '14px' }}>
                      {m.message}
                      {m.image && <img src={API + m.image} alt="" style={{ maxWidth: '200px', borderRadius: '8px', marginTop: '6px', display: 'block' }} />}
                    </div>
                    <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px', textAlign: m.sender_type === 'user' ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: m.sender_type === 'user' ? 'flex-end' : 'flex-start' }}>
                      {m.sender_type === 'admin' && <FontAwesomeIcon icon={faUserShield} style={{ color: '#9b59b6' }} />}
                      {m.sender_name} - {new Date(m.created_at).toLocaleTimeString()}
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
                  <input type="text" value={newMsg} onChange={(e) => setNewMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }} placeholder="Escribe un mensaje..." style={{ flex: 1, padding: '10px', border: '2px solid #e0e0e0', borderRadius: '10px', outline: 'none' }} />
                  <button onClick={sendMessage} disabled={sending || (!newMsg.trim() && !msgImage)} style={{ background: 'var(--primary, #000)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 16px', cursor: 'pointer', fontSize: '14px' }}>
                    <FontAwesomeIcon icon={faPaperPlane} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
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
                <p style={{ fontSize: '12px', color: '#aaa' }}>
                  <FontAwesomeIcon icon={faExclamationTriangle} /> Guarda este PIN. El equipo de soporte podria pedirtelo.
                </p>
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
