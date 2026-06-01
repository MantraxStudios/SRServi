import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../components/Layout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus, faEdit, faTrash, faSave, faTimes, faTicketAlt,
  faCalendarAlt, faClock, faMapMarkerAlt, faUsers, faQrcode,
  faCheckCircle, faTimesCircle, faSpinner, faTag, faSyncAlt
} from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#C8A415';

const CATEGORY_PRESETS = ['Adulto', 'Niño', 'Adulto Mayor', 'Estudiante', 'VIP', 'General'];

/* ── Estilos comunes ── */
const card = { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px 20px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
const inputS = { width: '100%', padding: '8px 12px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, color: '#111', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelS = { display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' };
const btnPrimary = { padding: '8px 16px', background: GOLD, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const btnSecondary = { padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const iconBtn = { background: 'transparent', border: 'none', color: GOLD, cursor: 'pointer', fontSize: 14, padding: '4px 6px', borderRadius: 6 };

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
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input required placeholder="Nombre del evento *" value={form.name} onChange={e => set('name', e.target.value)} style={inputS} />
      <textarea placeholder="Descripción (opcional)" value={form.description} onChange={e => set('description', e.target.value)}
        style={{ ...inputS, minHeight: 70, resize: 'vertical' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelS}>Fecha *</label>
          <input required type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} style={inputS} />
        </div>
        <div>
          <label style={labelS}>Hora inicio *</label>
          <input required type="time" value={form.time_start} onChange={e => set('time_start', e.target.value)} style={inputS} />
        </div>
        <div>
          <label style={labelS}>Hora fin</label>
          <input type="time" value={form.time_end} onChange={e => set('time_end', e.target.value)} style={inputS} />
        </div>
      </div>
      <input placeholder="Lugar / Dirección" value={form.location} onChange={e => set('location', e.target.value)} style={inputS} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelS}>Capacidad máxima (opcional)</label>
          <input type="number" min="1" placeholder="Sin límite" value={form.max_capacity} onChange={e => set('max_capacity', e.target.value)} style={inputS} />
        </div>
        <div>
          <label style={labelS}>Estado</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} style={inputS}>
            <option value="active">Activo</option>
            <option value="finished">Finalizado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button type="button" onClick={onCancel} style={btnSecondary}>Cancelar</button>
        <button type="submit" disabled={saving} style={btnPrimary}>
          {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />} Guardar
        </button>
      </div>
    </form>
  );
}

function CategoryForm({ cat, onSave, onCancel }) {
  const [form, setForm] = useState({ name: cat?.name || '', description: cat?.description || '', price: cat?.price ?? '', max_qty: cat?.max_qty || '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{
      display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end',
      background: '#fffbeb', padding: '12px 14px', borderRadius: 8, marginBottom: 8,
      border: `1px solid ${GOLD}40`
    }}>
      <div style={{ flex: '0 0 auto', minWidth: 140 }}>
        <label style={labelS}>Categoría *</label>
        <input list="cat-presets" required value={form.name} onChange={e => set('name', e.target.value)} style={{ ...inputS, fontSize: 13 }} placeholder="Ej: Adulto" />
        <datalist id="cat-presets">{CATEGORY_PRESETS.map(p => <option key={p} value={p} />)}</datalist>
      </div>
      <div style={{ flex: '0 0 auto', minWidth: 130 }}>
        <label style={labelS}>Descripción</label>
        <input value={form.description} onChange={e => set('description', e.target.value)} style={{ ...inputS, fontSize: 13 }} placeholder="Opcional" />
      </div>
      <div style={{ flex: '0 0 auto', minWidth: 100 }}>
        <label style={labelS}>Precio (CLP) *</label>
        <input required type="number" min="0" value={form.price} onChange={e => set('price', e.target.value)} style={{ ...inputS, fontSize: 13 }} placeholder="0 = Gratis" />
      </div>
      <div style={{ flex: '0 0 auto', minWidth: 90 }}>
        <label style={labelS}>Cupos máx.</label>
        <input type="number" min="1" value={form.max_qty} onChange={e => set('max_qty', e.target.value)} style={{ ...inputS, fontSize: 13 }} placeholder="Sin límite" />
      </div>
      <button type="submit" disabled={saving} style={{ ...btnPrimary, height: 36, padding: '0 14px' }}>
        {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
      </button>
      <button type="button" onClick={onCancel} style={{ ...btnSecondary, height: 36, padding: '0 14px' }}>
        <FontAwesomeIcon icon={faTimes} />
      </button>
    </form>
  );
}

function ScannerTab({ token }) {
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
        method: 'POST', headers: { Authorization: 'Bearer ' + token }
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
    <div style={{ maxWidth: 480, margin: '0 auto', paddingTop: 10 }}>
      <h3 style={{ color: '#111', marginBottom: 16, fontSize: 16, fontWeight: 700 }}>
        <FontAwesomeIcon icon={faQrcode} style={{ marginRight: 8, color: GOLD }} />Escáner de Entradas
      </h3>
      <form onSubmit={scan} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input ref={inputRef} value={code} onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="Escanea o escribe el código (T-XXXXXXXX)"
          style={{ ...inputS, flex: 1, fontFamily: 'monospace', fontSize: 16, letterSpacing: 2 }} />
        <button type="submit" disabled={loading} style={btnPrimary}>
          {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Validar'}
        </button>
      </form>
      {result && (
        <div style={{
          padding: '16px 20px', borderRadius: 12,
          background: result.ok ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${result.ok ? '#86efac' : '#fca5a5'}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: result.ticket ? 8 : 0 }}>
            <FontAwesomeIcon icon={result.ok ? faCheckCircle : faTimesCircle}
              style={{ color: result.ok ? '#16a34a' : '#dc2626', fontSize: 22 }} />
            <span style={{ fontWeight: 700, fontSize: 16, color: result.ok ? '#16a34a' : '#dc2626' }}>
              {result.ok ? '✅ ENTRADA VÁLIDA' : `❌ ${result.error || 'Error'}`}
            </span>
          </div>
          {result.ticket && (
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginLeft: 32 }}>
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

  const [tab, setTab] = useState('events');
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
      const url = filterEvent
        ? `${API}/api/ticketeria/purchases?store_id=${storeId}&event_id=${filterEvent}`
        : `${API}/api/ticketeria/purchases?store_id=${storeId}`;
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
      const prev = addingCatFor;
      setAddingCatFor(null);
      loadCategories(prev);
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    await fetch(`${API}/api/ticketeria/categories/${catId}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    loadCategories(expandedEvent);
  };

  const publicUrl = selectedStore ? `${window.location.origin}/tickets/${selectedStore.code}` : '';

  const statusBadge = (status) => ({
    active:    { bg: '#f0fdf4', color: '#16a34a', label: 'Activo' },
    cancelled: { bg: '#fef2f2', color: '#dc2626', label: 'Cancelado' },
    finished:  { bg: '#f3f4f6', color: '#6b7280', label: 'Finalizado' },
  }[status] || { bg: '#f3f4f6', color: '#6b7280', label: status });

  const purchaseStatusBadge = (status) => ({
    paid:      { bg: '#f0fdf4', color: '#16a34a', label: 'Pagado' },
    pending:   { bg: '#fffbeb', color: '#d97706', label: 'Pendiente' },
    failed:    { bg: '#fef2f2', color: '#dc2626', label: 'Fallido' },
    cancelled: { bg: '#fef2f2', color: '#dc2626', label: 'Cancelado' },
  }[status] || { bg: '#f3f4f6', color: '#6b7280', label: status });

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto', color: '#111' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, color: '#111', display: 'flex', alignItems: 'center', gap: 10, fontSize: 20 }}>
            <FontAwesomeIcon icon={faTicketAlt} style={{ color: GOLD }} /> Ticketería
          </h2>
          {selectedStore && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
              URL pública:{' '}
              <a href={publicUrl} target="_blank" rel="noreferrer" style={{ color: GOLD, fontWeight: 600 }}>{publicUrl}</a>
            </div>
          )}
        </div>
        {tab === 'events' && (
          <button onClick={() => { setShowEventForm(true); setEditingEvent(null); }} style={btnPrimary}>
            <FontAwesomeIcon icon={faPlus} /> Nuevo Evento
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[['events', faCalendarAlt, 'Eventos'], ['purchases', faUsers, 'Compras'], ['scanner', faQrcode, 'Escáner']].map(([key, icon, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '7px 16px', borderRadius: 8, border: tab === key ? 'none' : '1px solid #e5e7eb',
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === key ? GOLD : '#fff',
            color: tab === key ? '#fff' : '#374151',
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: tab === key ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            <FontAwesomeIcon icon={icon} /> {label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── EVENTOS ── */}
      {tab === 'events' && (
        <div>
          {(showEventForm || editingEvent) && (
            <div style={{ ...card, border: `1px solid ${GOLD}50`, background: '#fffbeb' }}>
              <h3 style={{ margin: '0 0 14px', color: '#111', fontSize: 15, fontWeight: 700 }}>{editingEvent ? 'Editar Evento' : 'Nuevo Evento'}</h3>
              <EventForm event={editingEvent} onSave={handleSaveEvent} onCancel={() => { setShowEventForm(false); setEditingEvent(null); }} />
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}><FontAwesomeIcon icon={faSpinner} spin /> Cargando...</div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 50, color: '#9ca3af' }}>
              <FontAwesomeIcon icon={faTicketAlt} style={{ fontSize: 40, marginBottom: 12, display: 'block', color: '#d1d5db' }} />
              No hay eventos. Crea el primero.
            </div>
          ) : events.map(ev => {
            const badge = statusBadge(ev.status);
            return (
              <div key={ev.id} style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => toggleExpand(ev.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{ev.name}</span>
                      <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, fontWeight: 600, background: badge.bg, color: badge.color }}>{badge.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 12, color: '#6b7280', flexWrap: 'wrap' }}>
                      <span><FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: 4, color: GOLD }} />
                        {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span><FontAwesomeIcon icon={faClock} style={{ marginRight: 4, color: GOLD }} />{ev.time_start?.slice(0, 5)}{ev.time_end ? ` – ${ev.time_end.slice(0, 5)}` : ''}</span>
                      {ev.location && <span><FontAwesomeIcon icon={faMapMarkerAlt} style={{ marginRight: 4, color: GOLD }} />{ev.location}</span>}
                      <span><FontAwesomeIcon icon={faUsers} style={{ marginRight: 4, color: GOLD }} />{ev.sold_count} vendidas{ev.max_capacity ? ` / ${ev.max_capacity}` : ''}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); setEditingEvent(ev); setShowEventForm(false); }} style={iconBtn}><FontAwesomeIcon icon={faEdit} /></button>
                    <button onClick={e => { e.stopPropagation(); handleDeleteEvent(ev.id); }} style={{ ...iconBtn, color: '#ef4444' }}><FontAwesomeIcon icon={faTrash} /></button>
                  </div>
                </div>

                {expandedEvent === ev.id && (
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: '14px 18px', background: '#fafafa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                        <FontAwesomeIcon icon={faTag} style={{ marginRight: 6, color: GOLD }} />Categorías y precios
                      </span>
                      <button onClick={() => { setAddingCatFor(ev.id); setEditingCat(null); }} style={{ ...btnPrimary, fontSize: 12, padding: '5px 12px' }}>
                        <FontAwesomeIcon icon={faPlus} /> Agregar
                      </button>
                    </div>

                    {addingCatFor === ev.id && (
                      <CategoryForm onSave={handleSaveCategory} onCancel={() => setAddingCatFor(null)} />
                    )}
                    {editingCat && editingCat.event_id === ev.id && (
                      <CategoryForm cat={editingCat} onSave={handleSaveCategory} onCancel={() => setEditingCat(null)} />
                    )}

                    {(categories[ev.id] || []).length === 0 ? (
                      <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>Sin categorías. Agrega al menos una (Adulto, Niño, etc.)</div>
                    ) : (categories[ev.id] || []).map(cat => (
                      <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff', borderRadius: 8, marginBottom: 6, border: '1px solid #e5e7eb' }}>
                        <FontAwesomeIcon icon={faTag} style={{ color: GOLD, fontSize: 12, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: '#111' }}>{cat.name}</span>
                        {cat.description && <span style={{ fontSize: 12, color: '#9ca3af', flex: 1 }}>{cat.description}</span>}
                        <span style={{ fontWeight: 700, color: GOLD, fontSize: 15, minWidth: 80, textAlign: 'right' }}>
                          {cat.price === 0 ? 'Gratis' : `$${cat.price.toLocaleString('es-CL')}`}
                        </span>
                        {cat.max_qty && <span style={{ fontSize: 11, color: '#9ca3af' }}>Máx: {cat.max_qty}</span>}
                        <button onClick={() => { setEditingCat({ ...cat, event_id: ev.id }); setAddingCatFor(null); }} style={iconBtn}><FontAwesomeIcon icon={faEdit} /></button>
                        <button onClick={() => handleDeleteCategory(cat.id)} style={{ ...iconBtn, color: '#ef4444' }}><FontAwesomeIcon icon={faTrash} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── COMPRAS ── */}
      {tab === 'purchases' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} style={{ ...inputS, maxWidth: 260, fontSize: 13 }}>
              <option value="">Todos los eventos</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
            <button onClick={loadPurchases} style={btnSecondary}>
              <FontAwesomeIcon icon={faSyncAlt} /> Actualizar
            </button>
          </div>

          {purchasesLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}><FontAwesomeIcon icon={faSpinner} spin /></div>
          ) : purchases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No hay compras registradas.</div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Comprador', 'Evento', 'Total', 'Estado', 'Fecha', 'Referencia'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', fontWeight: 600, color: '#6b7280', textAlign: 'left', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p, i) => {
                    const badge = purchaseStatusBadge(p.status);
                    return (
                      <tr key={p.id} style={{ borderBottom: i < purchases.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <td style={{ padding: '11px 14px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 600, color: '#111' }}>{p.buyer_name}</div>
                          <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>{p.buyer_email}</div>
                          {p.buyer_phone && <div style={{ color: '#9ca3af', fontSize: 11 }}>{p.buyer_phone}</div>}
                        </td>
                        <td style={{ padding: '11px 14px', color: '#374151', verticalAlign: 'top' }}>{p.event_name}</td>
                        <td style={{ padding: '11px 14px', fontWeight: 700, color: GOLD, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          ${p.total_amount.toLocaleString('es-CL')}
                        </td>
                        <td style={{ padding: '11px 14px', verticalAlign: 'top' }}>
                          <span style={{ padding: '3px 9px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.color }}>{badge.label}</span>
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: '#6b7280', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          {new Date(p.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', verticalAlign: 'top' }}>{p.haulmer_reference}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ESCÁNER ── */}
      {tab === 'scanner' && <ScannerTab token={token} />}
    </div>
  );
}
