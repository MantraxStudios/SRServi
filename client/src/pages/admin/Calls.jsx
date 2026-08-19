import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useStore } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPhone, faToggleOn, faToggleOff, faSave, faRobot, faSpinner,
  faReceipt, faCheck, faTrash, faChevronDown, faChevronUp, faClock, faUser,
} from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

// Voces open-source de Piper en español disponibles (deben coincidir con las que
// descarga telephony/bot/Dockerfile). Ordenadas de más a menos natural: las de
// calidad "alta" suenan más humanas.
const PIPER_VOICES = [
  { id: 'es_MX-claude-high', label: 'Claudia (Latam, alta · más natural)' },
  { id: 'es_AR-daniela-high', label: 'Daniela (Argentina, alta · muy natural)' },
  { id: 'es_ES-sharvard-medium', label: 'Sharvard (España, media)' },
  { id: 'es_ES-davefx-medium', label: 'Dave (España, media)' },
  { id: 'es_MX-ald-medium', label: 'Ald (México, media)' },
];

export default function Calls() {
  const { selectedStore } = useStore();
  const { token } = useAuth();

  const [cfg, setCfg] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const socketRef = useRef(null);

  const auth = { Authorization: `Bearer ${token}` };

  const loadOrders = () => {
    if (!selectedStore) return;
    fetch(`${API}/api/telephony/ai-orders?store_id=${selectedStore.id}`, { headers: auth })
      .then(r => r.json())
      .then(ord => setOrders(Array.isArray(ord) ? ord : []))
      .catch(() => {});
  };

  useEffect(() => {
    if (!selectedStore) return;
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/telephony/config?store_id=${selectedStore.id}`, { headers: auth }).then(r => r.json()),
      fetch(`${API}/api/telephony/ai-orders?store_id=${selectedStore.id}`, { headers: auth }).then(r => r.json()),
    ]).then(([config, ord]) => {
      setCfg(config);
      setOrders(Array.isArray(ord) ? ord : []);
    }).catch(() => {}).finally(() => setLoading(false));

    // Tiempo real: aparece el pedido apenas la IA termina la llamada
    const socket = io(API);
    socketRef.current = socket;
    socket.emit('join_store_room', selectedStore.id);
    socket.on('ai_call_order', () => loadOrders());
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [selectedStore, token]);

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  async function handleSave() {
    if (!selectedStore) return;
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(`${API}/api/telephony/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ store_id: selectedStore.id, ...cfg }),
      });
      if (res.ok) { setCfg(await res.json()); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    } catch {} finally { setSaving(false); }
  }

  async function setStatus(id, status) {
    await fetch(`${API}/api/telephony/ai-orders/${id}?store_id=${selectedStore.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ status }),
    });
    setOrders(o => o.map(x => x.id === id ? { ...x, status } : x));
  }

  const fmtMoney = (v) => new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: selectedStore?.currency_code || 'CLP', maximumFractionDigits: 0,
  }).format(Number(v) || 0);

  if (loading || !cfg) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
      <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 28 }} />
    </div>
  );

  const inputStyle = {
    width: '100%', padding: '10px 12px', border: '1.5px solid #d1d5db',
    borderRadius: 10, fontSize: 14, boxSizing: 'border-box',
  };
  const labelStyle = { display: 'block', fontWeight: 600, color: '#374151', marginBottom: 6, fontSize: 13 };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <FontAwesomeIcon icon={faRobot} style={{ fontSize: 24, color: '#3b82f6' }} />
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#111' }}>Llamadas IA</h1>
      </div>
      <p style={{ color: '#6b7280', fontSize: 14, marginTop: 0, marginBottom: 24 }}>
        Un agente de voz open source contesta el teléfono, entiende el pedido y lo deja aquí escrito.
      </p>

      {/* ── Configuración ── */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '14px 16px', background: '#f9fafb', borderRadius: 12, border: '1.5px solid #e5e7eb' }}>
          <div>
            <div style={{ fontWeight: 700, color: '#111', fontSize: 15 }}>Agente de voz activo</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {cfg.enabled ? 'La IA contestará las llamadas entrantes a tu número' : 'Las llamadas no serán atendidas por la IA'}
            </div>
          </div>
          <button onClick={() => set('enabled', !cfg.enabled)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 32, color: cfg.enabled ? '#22c55e' : '#9ca3af', padding: 0 }}>
            <FontAwesomeIcon icon={cfg.enabled ? faToggleOn : faToggleOff} />
          </button>
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: '4px 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FontAwesomeIcon icon={faPhone} style={{ color: '#3b82f6' }} /> Tu número de teléfono (Twilio)
        </h3>
        <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: '#1e40af', marginBottom: 14, lineHeight: 1.5 }}>
          Las llamadas funcionan con <b>Twilio</b> (proveedor único). Solo indica el <b>número (DID)</b> que
          compraste en Twilio; la conexión SIP ya está configurada en la plataforma.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Número (DID) comprado en Twilio</label>
            <input style={inputStyle} placeholder="+56 2 1234 5678" value={cfg.did_number || ''} onChange={e => set('did_number', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>
              Auth Token de tu cuenta de Twilio
              {cfg.twilio_auth_token_set && (
                <span style={{ marginLeft: 8, fontSize: 11, color: '#22c55e', fontWeight: 700 }}>
                  <FontAwesomeIcon icon={faCheck} /> guardado
                </span>
              )}
            </label>
            <input style={inputStyle} type="password" autoComplete="new-password"
              placeholder={cfg.twilio_auth_token_set ? '•••••••••• (déjalo vacío para no cambiarlo)' : 'Pega tu Auth Token de Twilio'}
              value={cfg.twilio_auth_token || ''} onChange={e => set('twilio_auth_token', e.target.value)} />
            <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 4 }}>
              Consola de Twilio → <b>Account Info → Auth Token</b>. NO es el API Key (SK…). Se guarda en el servidor y no se muestra de vuelta.
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Derivar a número humano — opcional</label>
            <input style={inputStyle} placeholder="+56 9 ..." value={cfg.forward_number || ''} onChange={e => set('forward_number', e.target.value)} />
          </div>
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: '10px 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FontAwesomeIcon icon={faRobot} style={{ color: '#3b82f6' }} /> Agente de voz (IA)
        </h3>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Saludo inicial (lo dice la IA al contestar)</label>
          <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
            placeholder="¡Hola! Gracias por llamar a Pizzería Roma. ¿Qué le gustaría pedir?"
            value={cfg.greeting_text || ''} onChange={e => set('greeting_text', e.target.value)} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Instrucciones para la IA (tono, reglas, horarios, delivery...)</label>
          <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
            placeholder="Eres el asistente telefónico de la tienda. Toma el pedido, confirma cantidades y pregunta si es para retirar o delivery. Sé breve y amable."
            value={cfg.system_prompt || ''} onChange={e => set('system_prompt', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Modelo LLM (Ollama)</label>
            <input style={inputStyle} placeholder="llama3" value={cfg.ollama_model || ''} onChange={e => set('ollama_model', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Voz (Piper TTS)</label>
            <select style={inputStyle} value={PIPER_VOICES.some(v => v.id === cfg.piper_voice) ? cfg.piper_voice : PIPER_VOICES[0].id} onChange={e => set('piper_voice', e.target.value)}>
              {PIPER_VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Idioma</label>
            <select style={inputStyle} value={cfg.language || 'es'} onChange={e => set('language', e.target.value)}>
              <option value="es">Español</option>
              <option value="en">Inglés</option>
              <option value="pt">Portugués</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Duración máx. de llamada (seg)</label>
            <input style={inputStyle} type="number" value={cfg.max_seconds || 300} onChange={e => set('max_seconds', e.target.value)} />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          style={{ padding: '12px 28px', background: saved ? '#22c55e' : '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FontAwesomeIcon icon={faSave} />
          {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar configuración'}
        </button>
      </div>

      {/* ── Pedidos captados por la IA ── */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#374151', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FontAwesomeIcon icon={faReceipt} style={{ color: '#3b82f6' }} /> Pedidos por teléfono
          <span style={{ marginLeft: 6, background: '#f3f4f6', borderRadius: 20, padding: '2px 10px', fontSize: 13, fontWeight: 600, color: '#6b7280' }}>
            {orders.length}
          </span>
        </h2>

        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📞</div>
            <div>Aún no hay pedidos captados por llamada.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {orders.map(o => {
              const items = o.order_json?.items || [];
              const isOpen = expanded === o.id;
              const statusColor = { new: '#3b82f6', reviewed: '#f59e0b', confirmed: '#22c55e', discarded: '#9ca3af' }[o.status] || '#6b7280';
              return (
                <div key={o.id} style={{ border: '1.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', opacity: o.status === 'discarded' ? 0.6 : 1 }}>
                  <div onClick={() => setExpanded(isOpen ? null : o.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', background: '#fafafa' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FontAwesomeIcon icon={faPhone} style={{ color: '#3b82f6' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#111', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {o.customer_name || o.from_number || 'Llamada'}
                        <span style={{ fontSize: 11, background: statusColor + '20', color: statusColor, borderRadius: 20, padding: '1px 8px', fontWeight: 700, textTransform: 'capitalize' }}>
                          {o.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.summary || `${items.length} producto(s)`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, color: '#111', fontSize: 14 }}>{fmtMoney(o.total)}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        <FontAwesomeIcon icon={faClock} style={{ fontSize: 9, marginRight: 3 }} />
                        {new Date(o.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <FontAwesomeIcon icon={isOpen ? faChevronUp : faChevronDown} style={{ color: '#9ca3af', flexShrink: 0 }} />
                  </div>

                  {isOpen && (
                    <div style={{ padding: '14px 16px', borderTop: '1px solid #e5e7eb' }}>
                      {o.from_number && (
                        <div style={{ fontSize: 13, color: '#374151', marginBottom: 10 }}>
                          <FontAwesomeIcon icon={faUser} style={{ marginRight: 6, color: '#9ca3af' }} />
                          {o.from_number}
                        </div>
                      )}
                      {items.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          {items.map((it, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed #eee', fontSize: 14 }}>
                              <span><b style={{ color: '#3b82f6' }}>{it.quantity || 1}×</b> {it.name}{it.notes ? ` — ${it.notes}` : ''}</span>
                              {it.price != null && <span style={{ fontWeight: 600 }}>{fmtMoney((it.price || 0) * (it.quantity || 1))}</span>}
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, fontWeight: 800 }}>
                            <span>Total</span><span>{fmtMoney(o.total)}</span>
                          </div>
                        </div>
                      )}
                      {o.transcript && (
                        <details style={{ marginBottom: 12 }}>
                          <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#6b7280' }}>Ver transcripción de la llamada</summary>
                          <div style={{ marginTop: 8, padding: 12, background: '#f9fafb', borderRadius: 10, fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                            {o.transcript}
                          </div>
                        </details>
                      )}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setStatus(o.id, 'confirmed')}
                          style={{ padding: '8px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FontAwesomeIcon icon={faCheck} /> Confirmar
                        </button>
                        <button onClick={() => setStatus(o.id, 'discarded')}
                          style={{ padding: '8px 16px', background: '#fff', color: '#ef4444', border: '1.5px solid #fecaca', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FontAwesomeIcon icon={faTrash} /> Descartar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
