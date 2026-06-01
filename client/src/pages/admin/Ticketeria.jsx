import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faEdit, faTrash, faSave, faTimes, faTicketAlt,
  faCalendarAlt, faClock, faMapMarkerAlt, faUsers, faQrcode,
  faCheckCircle, faTimesCircle, faSpinner, faTag, faEye, faSyncAlt
} from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

const CATEGORY_PRESETS = ['Adulto', 'Niño', 'Adulto Mayor', 'Estudiante', 'VIP', 'General'];

function EventForm({ event, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: event?.name || '',
    description: event?.description || '',
    event_date: event?.event_date ? event.event_date.slice(0, 10) : '',
    time_start: event?.time_start ? event.time_start.slice(0, 5) : '',
    time_end: event?.time_end ? event.time_end.slice(0, 5) : '',
    location: event?.location || '',
    max_capacity: event?.max_capacity || '',
    status: event?.status || 'active',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input required placeholder="Nombre del evento *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        style={inputStyle} />
      <textarea placeholder="Descripción (opcional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>Fecha *</label>
          <input required type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Hora inicio *</label>
          <input required type="time" value={form.time_start} onChange={e => setForm(f => ({ ...f, time_start: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Hora fin</label>
          <input type="time" value={form.time_end} onChange={e => setForm(f => ({ ...f, time_end: e.target.value }))} style={inputStyle} />
        </div>
      </div>
      <input placeholder="Lugar / Dirección" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={inputStyle} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>Capacidad máxima (opcional)</label>
          <input type="number" min="1" placeholder="Sin límite" value={form.max_capacity} onChange={e => setForm(f => ({ ...f, max_capacity: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Estado</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
            <option value="active">Activo</option>
            <option value="finished">Finalizado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
        <button type="button" onClick={onCancel} style={btnSecondaryStyle}>Cancelar</button>
        <button type="submit" disabled={saving} style={btnPrimaryStyle}>
          {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />} Guardar
        </button>
      </div>
    </form>
  );
}

function CategoryRow({ cat, onEdit, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, marginBottom: 6 }}>
      <FontAwesomeIcon icon={faTag} style={{ color: '#D4AF37', fontSize: 13 }} />
      <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{cat.name}</span>
      {cat.description && <span style={{ fontSize: 12, color: '#999', flex: 1 }}>{cat.description}</span>}
      <span style={{ fontWeight: 700, color: '#D4AF37', fontSize: 15, minWidth: 80, textAlign: 'right' }}>
        {cat.price === 0 ? 'Gratis' : `$${cat.price.toLocaleString('es-CL')}`}
      </span>
      {cat.max_qty && <span style={{ fontSize: 11, color: '#888' }}>Máx: {cat.max_qty}</span>}
      <button onClick={() => onEdit(cat)} style={iconBtnStyle}><FontAwesomeIcon icon={faEdit} /></button>
      <button onClick={() => onDelete(cat.id)} style={{ ...iconBtnStyle, color: '#f87171' }}><FontAwesomeIcon icon={faTrash} /></button>
    </div>
  );
}

function CategoryForm({ cat, onSave, onCancel }) {
  const [form, setForm] = useState({ name: cat?.name || '', description: cat?.description || '', price: cat?.price ?? '', max_qty: cat?.max_qty || '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', background: 'rgba(212,175,55,0.08)', padding: '10px 12px', borderRadius: 8, marginBottom: 8 }}>
      <div style={{ flex: '0 0 auto', minWidth: 140 }}>
        <label style={labelStyle}>Categoría *</label>
        <input list="cat-presets" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ ...inputStyle, fontSize: 13 }} placeholder="Ej: Adulto" />
        <datalist id="cat-presets">{CATEGORY_PRESETS.map(p => <option key={p} value={p} />)}</datalist>
      </div>
      <div style={{ flex: '0 0 auto', minWidth: 120 }}>
        <label style={labelStyle}>Descripción</label>
        <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, fontSize: 13 }} placeholder="Opcional" />
      </div>
      <div style={{ flex: '0 0 auto', minWidth: 100 }}>
        <label style={labelStyle}>Precio (CLP) *</label>
        <input required type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} style={{ ...inputStyle, fontSize: 13 }} placeholder="0 = Gratis" />
      </div>
      <div style={{ flex: '0 0 auto', minWidth: 90 }}>
        <label style={labelStyle}>Cupos máx.</label>
        <input type="number" min="1" value={form.max_qty} onChange={e => setForm(f => ({ ...f, max_qty: e.target.value }))} style={{ ...inputStyle, fontSize: 13 }} placeholder="Sin límite" />
      </div>
      <button type="submit" disabled={saving} style={{ ...btnPrimaryStyle, height: 36, padding: '0 14px', fontSize: 13 }}>
        {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
      </button>
      <button type="button" onClick={onCancel} style={{ ...btnSecondaryStyle, height: 36, padding: '0 14px', fontSize: 13 }}>
        <FontAwesomeIcon icon={faTimes} />
      </button>
    </form>
  );
}

function ScannerTab({ storeId, token, events }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const scan = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/api/ticketeria/tickets/${code.trim()}/scan`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      setResult({ ok: res.ok, ...data });
    } catch {
      setResult({ ok: false, error: 'Error de red' });
    } finally {
      setLoading(false);
      setCode('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: '20px 0' }}>
      <h3 style={{ color: '#D4AF37', marginBottom: 16 }}><FontAwesomeIcon icon={faQrcode} /> Escáner de Entradas</h3>
      <form onSubmit={scan} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input ref={inputRef} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Escanea o escribe el código (T-XXXXXXXX)"
          style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 16, letterSpacing: 2 }} />
        <button type="submit" disabled={loading} style={btnPrimaryStyle}>
          {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Validar'}
        </button>
      </form>
      {result && (
        <div style={{
          padding: '16px 20px', borderRadius: 12, background: result.ok ? 'rgba(34,197,94,0.12)' : 'rgba(248,113,113,0.12)',
          border: `1px solid ${result.ok ? '#22c55e' : '#f87171'}`, marginBottom: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: result.ticket ? 8 : 0 }}>
            <FontAwesomeIcon icon={result.ok ? faCheckCircle : faTimesCircle} style={{ color: result.ok ? '#22c55e' : '#f87171', fontSize: 22 }} />
            <span style={{ fontWeight: 700, fontSize: 16, color: result.ok ? '#22c55e' : '#f87171' }}>
              {result.ok ? '✅ ENTRADA VÁLIDA' : `❌ ${result.error || 'Error'}`}
            </span>
          </div>
          {result.ticket && (
            <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.8, marginLeft: 32 }}>
              <div><strong>Código:</strong> {result.ticket.ticket_code}</div>
              <div><strong>Titular:</strong> {result.ticket.buyer_name}</div>
              <div><strong>Categoría:</strong> {result.ticket.category_name}</div>
              <div><strong>Evento:</strong> {result.ticket.event_name}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Ticketeria() {
  const { token } = useAuth();
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;

  const [tab, setTab] = useState('events'); // events | purchases | scanner
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [categories, setCategories] = useState({});
  const [addingCatFor, setAddingCatFor] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [filterEvent, setFilterEvent] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (storeId) loadEvents(); }, [storeId]);

  const loadEvents = async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/ticketeria/events?store_id=${storeId}`, { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch { setError('Error cargando eventos'); }
    finally { setLoading(false); }
  };

  const loadCategories = async (eventId) => {
    try {
      const res = await fetch(`${API}/api/ticketeria/events/${eventId}/categories`, { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      setCategories(prev => ({ ...prev, [eventId]: Array.isArray(data) ? data : [] }));
    } catch {}
  };

  const loadPurchases = async () => {
    if (!storeId) return;
    setPurchasesLoading(true);
    try {
      const url = filterEvent ? `${API}/api/ticketeria/purchases?store_id=${storeId}&event_id=${filterEvent}` : `${API}/api/ticketeria/purchases?store_id=${storeId}`;
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      setPurchases(Array.isArray(data) ? data : []);
    } catch { setError('Error cargando compras'); }
    finally { setPurchasesLoading(false); }
  };

  useEffect(() => { if (tab === 'purchases') loadPurchases(); }, [tab, filterEvent, storeId]);

  const handleSaveEvent = async (form) => {
    setError('');
    const method = editingEvent ? 'PUT' : 'POST';
    const url = editingEvent ? `${API}/api/ticketeria/events/${editingEvent.id}` : `${API}/api/ticketeria/events`;
    const body = editingEvent ? form : { ...form, store_id: storeId };
    const res = await fetch(url, {
      method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Error guardando'); return; }
    setShowEventForm(false);
    setEditingEvent(null);
    loadEvents();
  };

  const handleDeleteEvent = async (id) => {
    if (!confirm('¿Eliminar este evento y todas sus entradas?')) return;
    const res = await fetch(`${API}/api/ticketeria/events/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    if (res.ok) loadEvents();
  };

  const toggleExpand = async (eventId) => {
    if (expandedEvent === eventId) { setExpandedEvent(null); return; }
    setExpandedEvent(eventId);
    if (!categories[eventId]) await loadCategories(eventId);
  };

  const handleSaveCategory = async (form) => {
    setError('');
    if (editingCat) {
      const res = await fetch(`${API}/api/ticketeria/categories/${editingCat.id}`, {
        method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Error'); return; }
      setEditingCat(null);
      loadCategories(expandedEvent);
    } else {
      const res = await fetch(`${API}/api/ticketeria/events/${addingCatFor}/categories`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Error'); return; }
      setAddingCatFor(null);
      loadCategories(addingCatFor);
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    await fetch(`${API}/api/ticketeria/categories/${catId}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    loadCategories(expandedEvent);
  };

  const publicUrl = selectedStore ? `${window.location.origin}/tickets/${selectedStore.code}` : '';

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FontAwesomeIcon icon={faTicketAlt} style={{ color: '#D4AF37' }} /> Ticketería
          </h2>
          {selectedStore && (
            <div style={{ marginTop: 6, fontSize: 13, color: '#888' }}>
              Venta pública:{' '}
              <a href={publicUrl} target="_blank" rel="noreferrer" style={{ color: '#D4AF37' }}>{publicUrl}</a>
            </div>
          )}
        </div>
        {tab === 'events' && (
          <button onClick={() => { setShowEventForm(true); setEditingEvent(null); }} style={btnPrimaryStyle}>
            <FontAwesomeIcon icon={faPlus} /> Nuevo Evento
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
        {[['events', faCalendarAlt, 'Eventos'], ['purchases', faUsers, 'Compras'], ['scanner', faQrcode, 'Escáner']].map(([key, icon, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === key ? '#D4AF37' : 'rgba(255,255,255,0.06)',
            color: tab === key ? '#111' : '#ccc', display: 'flex', alignItems: 'center', gap: 6
          }}>
            <FontAwesomeIcon icon={icon} /> {label}
          </button>
        ))}
      </div>

      {error && <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.15)', border: '1px solid #f87171', borderRadius: 8, color: '#f87171', marginBottom: 14, fontSize: 13 }}>{error}</div>}

      {/* EVENTOS TAB */}
      {tab === 'events' && (
        <div>
          {(showEventForm || editingEvent) && (
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid rgba(212,175,55,0.3)' }}>
              <h3 style={{ margin: '0 0 14px', color: '#D4AF37', fontSize: 15 }}>{editingEvent ? 'Editar Evento' : 'Nuevo Evento'}</h3>
              <EventForm event={editingEvent} onSave={handleSaveEvent} onCancel={() => { setShowEventForm(false); setEditingEvent(null); }} />
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#888' }}><FontAwesomeIcon icon={faSpinner} spin /> Cargando...</div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
              <FontAwesomeIcon icon={faTicketAlt} style={{ fontSize: 40, marginBottom: 12, display: 'block', color: '#333' }} />
              No hay eventos. Crea el primero.
            </div>
          ) : events.map(event => (
            <div key={event.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, marginBottom: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => toggleExpand(event.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{event.name}</span>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                      background: event.status === 'active' ? 'rgba(34,197,94,0.15)' : event.status === 'cancelled' ? 'rgba(248,113,113,0.15)' : 'rgba(156,163,175,0.15)',
                      color: event.status === 'active' ? '#22c55e' : event.status === 'cancelled' ? '#f87171' : '#9ca3af'
                    }}>{event.status === 'active' ? 'Activo' : event.status === 'cancelled' ? 'Cancelado' : 'Finalizado'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 12, color: '#999', flexWrap: 'wrap' }}>
                    <span><FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: 4 }} />
                      {new Date(event.event_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <span><FontAwesomeIcon icon={faClock} style={{ marginRight: 4 }} />{event.time_start?.slice(0, 5)}{event.time_end ? ` – ${event.time_end.slice(0, 5)}` : ''}</span>
                    {event.location && <span><FontAwesomeIcon icon={faMapMarkerAlt} style={{ marginRight: 4 }} />{event.location}</span>}
                    <span><FontAwesomeIcon icon={faUsers} style={{ marginRight: 4 }} />{event.sold_count} vendidas{event.max_capacity ? ` / ${event.max_capacity}` : ''}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={e => { e.stopPropagation(); setEditingEvent(event); setShowEventForm(false); }} style={iconBtnStyle}><FontAwesomeIcon icon={faEdit} /></button>
                  <button onClick={e => { e.stopPropagation(); handleDeleteEvent(event.id); }} style={{ ...iconBtnStyle, color: '#f87171' }}><FontAwesomeIcon icon={faTrash} /></button>
                </div>
              </div>

              {expandedEvent === event.id && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#D4AF37' }}><FontAwesomeIcon icon={faTag} /> Categorías y precios</span>
                    <button onClick={() => { setAddingCatFor(event.id); setEditingCat(null); }} style={{ ...btnPrimaryStyle, fontSize: 12, padding: '5px 12px' }}>
                      <FontAwesomeIcon icon={faPlus} /> Agregar
                    </button>
                  </div>

                  {addingCatFor === event.id && (
                    <CategoryForm onSave={handleSaveCategory} onCancel={() => setAddingCatFor(null)} />
                  )}
                  {editingCat && editingCat.event_id === event.id && (
                    <CategoryForm cat={editingCat} onSave={handleSaveCategory} onCancel={() => setEditingCat(null)} />
                  )}

                  {(categories[event.id] || []).length === 0 ? (
                    <div style={{ fontSize: 13, color: '#666', padding: '8px 0' }}>Sin categorías. Agrega al menos una (Adulto, Niño, etc.)</div>
                  ) : (categories[event.id] || []).map(cat => (
                    <CategoryRow key={cat.id} cat={cat}
                      onEdit={c => { setEditingCat({ ...c, event_id: event.id }); setAddingCatFor(null); }}
                      onDelete={handleDeleteCategory} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* COMPRAS TAB */}
      {tab === 'purchases' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} style={{ ...inputStyle, maxWidth: 250, fontSize: 13 }}>
              <option value="">Todos los eventos</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
            <button onClick={loadPurchases} style={{ ...btnSecondaryStyle, fontSize: 13 }}>
              <FontAwesomeIcon icon={faSyncAlt} /> Actualizar
            </button>
          </div>

          {purchasesLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#888' }}><FontAwesomeIcon icon={faSpinner} spin /></div>
          ) : purchases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>No hay compras registradas.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: '#888', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={thStyle}>Comprador</th>
                    <th style={thStyle}>Evento</th>
                    <th style={thStyle}>Total</th>
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600 }}>{p.buyer_name}</div>
                        <div style={{ color: '#888', fontSize: 11 }}>{p.buyer_email}</div>
                        {p.buyer_phone && <div style={{ color: '#888', fontSize: 11 }}>{p.buyer_phone}</div>}
                      </td>
                      <td style={tdStyle}>{p.event_name}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: '#D4AF37' }}>${p.total_amount.toLocaleString('es-CL')}</td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                          background: p.status === 'paid' ? 'rgba(34,197,94,0.15)' : p.status === 'pending' ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)',
                          color: p.status === 'paid' ? '#22c55e' : p.status === 'pending' ? '#fbbf24' : '#f87171'
                        }}>
                          {p.status === 'paid' ? 'Pagado' : p.status === 'pending' ? 'Pendiente' : p.status === 'failed' ? 'Fallido' : 'Cancelado'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontSize: 11, color: '#999' }}>
                        {new Date(p.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 10, color: '#666', fontFamily: 'monospace' }}>{p.haulmer_reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SCANNER TAB */}
      {tab === 'scanner' && <ScannerTab storeId={storeId} token={token} events={events} />}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' };
const btnPrimaryStyle = { padding: '9px 18px', background: '#D4AF37', border: 'none', borderRadius: 8, color: '#111', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 };
const btnSecondaryStyle = { padding: '9px 18px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#ccc', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 };
const iconBtnStyle = { background: 'transparent', border: 'none', color: '#D4AF37', cursor: 'pointer', fontSize: 14, padding: '4px 6px', borderRadius: 6 };
const thStyle = { padding: '8px 10px', fontWeight: 600, fontSize: 12 };
const tdStyle = { padding: '10px 10px', verticalAlign: 'top' };
