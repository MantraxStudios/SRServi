import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTicketAlt, faCalendarAlt, faClock, faMapMarkerAlt, faSpinner,
  faCheckCircle, faTimesCircle, faArrowLeft, faMinus, faPlus, faShoppingCart
} from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#C8A415';

function EventCard({ event, onSelect }) {
  const dateStr = new Date(event.event_date + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  const isSoldOut = event.max_capacity && event.sold_count >= event.max_capacity;

  return (
    <div onClick={() => !isSoldOut && onSelect(event)} style={{
      background: '#fff', borderRadius: 14, padding: '20px',
      border: '1px solid #e5e7eb', cursor: isSoldOut ? 'not-allowed' : 'pointer',
      opacity: isSoldOut ? 0.6 : 1, transition: 'box-shadow 0.15s, border-color 0.15s',
      marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
    }}
      onMouseEnter={e => { if (!isSoldOut) { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; e.currentTarget.style.borderColor = GOLD; } }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
    >
      {event.image_url && <img src={event.image_url} alt={event.name} style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 10, marginBottom: 14 }} />}
      <h3 style={{ margin: '0 0 8px', color: '#111', fontSize: 19, fontWeight: 700 }}>{event.name}</h3>
      {event.description && <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: 14, lineHeight: 1.5 }}>{event.description}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 13, color: '#6b7280' }}>
        <span><FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: 6, color: GOLD }} />{dateStr}</span>
        <span><FontAwesomeIcon icon={faClock} style={{ marginRight: 6, color: GOLD }} />
          {event.time_start?.slice(0, 5)}{event.time_end ? ` – ${event.time_end.slice(0, 5)}` : ''}
        </span>
        {event.location && <span><FontAwesomeIcon icon={faMapMarkerAlt} style={{ marginRight: 6, color: GOLD }} />{event.location}</span>}
      </div>
      {isSoldOut ? (
        <div style={{ marginTop: 12, color: '#ef4444', fontWeight: 700, fontSize: 13 }}>AGOTADO</div>
      ) : (
        <button style={{
          marginTop: 16, width: '100%', padding: '11px', background: GOLD, border: 'none',
          borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
          letterSpacing: '0.3px'
        }}>
          <FontAwesomeIcon icon={faTicketAlt} style={{ marginRight: 8 }} />Ver entradas
        </button>
      )}
    </div>
  );
}

function PurchaseForm({ event, storeId, onBack, onSuccess }) {
  const [categories, setCategories] = useState([]);
  const [qtys, setQtys] = useState({});
  const [buyer, setBuyer] = useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/api/ticketeria/public/events/${event.id}`)
      .then(r => r.json())
      .then(d => {
        setCategories(d.categories || []);
        const init = {};
        (d.categories || []).forEach(c => { init[c.id] = 0; });
        setQtys(init);
      })
      .catch(() => setError('Error cargando categorías'))
      .finally(() => setLoading(false));
  }, [event.id]);

  const total = categories.reduce((sum, c) => sum + (qtys[c.id] || 0) * c.price, 0);
  const totalTickets = Object.values(qtys).reduce((a, b) => a + b, 0);

  const adjust = (catId, delta) => {
    setQtys(prev => {
      const cat = categories.find(c => c.id === catId);
      const newVal = Math.max(0, (prev[catId] || 0) + delta);
      const max = cat?.max_qty ?? 20;
      return { ...prev, [catId]: Math.min(newVal, max) };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (totalTickets === 0) { setError('Selecciona al menos una entrada'); return; }
    if (!buyer.name.trim() || !buyer.email.trim()) { setError('Nombre y correo son requeridos'); return; }
    setError('');
    setSubmitting(true);
    try {
      const items = categories.filter(c => qtys[c.id] > 0).map(c => ({ category_id: c.id, quantity: qtys[c.id] }));
      const res = await fetch(`${API}/api/ticketeria/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, event_id: event.id, buyer_name: buyer.name, buyer_email: buyer.email, buyer_phone: buyer.phone, items })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error procesando compra'); return; }
      window.location.href = data.paymentUrl;
    } catch { setError('Error de conexión. Intenta nuevamente.'); }
    finally { setSubmitting(false); }
  };

  const dateStr = new Date(event.event_date + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><FontAwesomeIcon icon={faSpinner} spin style={{ color: GOLD, fontSize: 28 }} /></div>;

  return (
    <form onSubmit={handleSubmit}>
      <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: GOLD, cursor: 'pointer', fontSize: 14, marginBottom: 20, padding: 0, fontWeight: 600 }}>
        <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6 }} />Volver a eventos
      </button>

      <div style={{ background: '#fffbeb', borderRadius: 12, padding: '14px 18px', marginBottom: 22, border: `1px solid ${GOLD}40` }}>
        <h3 style={{ margin: '0 0 6px', color: '#111', fontSize: 17, fontWeight: 700 }}>{event.name}</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#6b7280' }}>
          <span><FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: 5, color: GOLD }} />{dateStr}</span>
          <span><FontAwesomeIcon icon={faClock} style={{ marginRight: 5, color: GOLD }} />{event.time_start?.slice(0, 5)}{event.time_end ? ` – ${event.time_end.slice(0, 5)}` : ''}</span>
          {event.location && <span><FontAwesomeIcon icon={faMapMarkerAlt} style={{ marginRight: 5, color: GOLD }} />{event.location}</span>}
        </div>
      </div>

      <h4 style={{ color: '#111', marginBottom: 12, fontSize: 15, fontWeight: 700 }}>Selecciona tus entradas</h4>

      {categories.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: 14, padding: '10px 0' }}>No hay categorías disponibles.</div>
      ) : categories.map(cat => (
        <div key={cat.id} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
          background: qtys[cat.id] > 0 ? '#fffbeb' : '#fff',
          borderRadius: 10, marginBottom: 8,
          border: `1px solid ${qtys[cat.id] > 0 ? GOLD + '70' : '#e5e7eb'}`,
          transition: 'all 0.15s'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#111' }}>{cat.name}</div>
            {cat.description && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{cat.description}</div>}
          </div>
          <div style={{ fontWeight: 700, color: GOLD, fontSize: 16, minWidth: 80, textAlign: 'right' }}>
            {cat.price === 0 ? 'Gratis' : `$${cat.price.toLocaleString('es-CL')}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={() => adjust(cat.id, -1)} style={qtyBtnStyle} disabled={!qtys[cat.id]}>
              <FontAwesomeIcon icon={faMinus} />
            </button>
            <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700, fontSize: 16, color: '#111' }}>{qtys[cat.id] || 0}</span>
            <button type="button" onClick={() => adjust(cat.id, 1)} style={qtyBtnStyle} disabled={cat.max_qty && qtys[cat.id] >= cat.max_qty}>
              <FontAwesomeIcon icon={faPlus} />
            </button>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 28 }}>
        <h4 style={{ color: '#111', marginBottom: 12, fontSize: 15, fontWeight: 700 }}>Tus datos</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input required placeholder="Nombre completo *" value={buyer.name} onChange={e => setBuyer(b => ({ ...b, name: e.target.value }))} style={inputStyle} />
          <input required type="email" placeholder="Correo electrónico * (aquí recibirás tus entradas)" value={buyer.email} onChange={e => setBuyer(b => ({ ...b, email: e.target.value }))} style={inputStyle} />
          <input type="tel" placeholder="Teléfono (opcional)" value={buyer.phone} onChange={e => setBuyer(b => ({ ...b, phone: e.target.value }))} style={inputStyle} />
        </div>
      </div>

      {error && <div style={{ marginTop: 14, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{error}</div>}

      <div style={{ marginTop: 20, padding: '14px 18px', background: '#fffbeb', borderRadius: 10, border: `1px solid ${GOLD}50` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: 14 }}>{totalTickets} entrada{totalTickets !== 1 ? 's' : ''}</span>
          <span style={{ fontWeight: 800, color: GOLD, fontSize: 22 }}>${total.toLocaleString('es-CL')}</span>
        </div>
      </div>

      <button type="submit" disabled={submitting || totalTickets === 0} style={{
        width: '100%', marginTop: 14, padding: '14px', background: totalTickets === 0 ? '#d1d5db' : GOLD,
        border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, fontSize: 16,
        cursor: totalTickets === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
      }}>
        {submitting ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faShoppingCart} />}
        {submitting ? 'Redirigiendo...' : 'Pagar con Haulmer'}
      </button>

      <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 10 }}>
        Recibirás tus entradas por correo electrónico al confirmar el pago.
      </p>
    </form>
  );
}

function ConfirmationView({ reference, storeCode }) {
  const [status, setStatus] = useState('loading');
  const [purchase, setPurchase] = useState(null);

  useEffect(() => {
    let attempts = 0;
    const poll = async () => {
      try {
        await fetch(`${API}/api/ticketeria/purchase/${reference}/confirm`, { method: 'POST' });
        const res = await fetch(`${API}/api/ticketeria/purchase/${reference}/status`);
        const data = await res.json();
        if (data.status === 'paid') {
          setPurchase(data);
          setStatus('success');
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          setStatus('failed');
        } else if (attempts < 8) {
          attempts++;
          setTimeout(poll, 2000);
        } else {
          setPurchase(data);
          setStatus('pending');
        }
      } catch { setStatus('error'); }
    };
    poll();
  }, [reference]);

  if (status === 'loading') return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <FontAwesomeIcon icon={faSpinner} spin style={{ color: GOLD, fontSize: 36, marginBottom: 16, display: 'block' }} />
      <p style={{ color: '#6b7280' }}>Confirmando tu pago...</p>
    </div>
  );

  if (status === 'success') return (
    <div style={{ textAlign: 'center', padding: '30px 20px' }}>
      <FontAwesomeIcon icon={faCheckCircle} style={{ color: '#22c55e', fontSize: 60, marginBottom: 16, display: 'block' }} />
      <h2 style={{ color: '#16a34a', marginBottom: 8 }}>¡Pago confirmado!</h2>
      <p style={{ color: '#374151', marginBottom: 4 }}>Tus entradas para <strong>{purchase?.event_name}</strong> fueron enviadas a:</p>
      <p style={{ color: GOLD, fontWeight: 700, fontSize: 16 }}>{purchase?.buyer_email}</p>
      <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 8 }}>Revisa tu bandeja de entrada (y spam).</p>
      <a href={`/tickets/${storeCode}`} style={{ display: 'inline-block', marginTop: 20, padding: '10px 24px', background: GOLD, borderRadius: 10, color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
        Ver más eventos
      </a>
    </div>
  );

  if (status === 'failed') return (
    <div style={{ textAlign: 'center', padding: '30px 20px' }}>
      <FontAwesomeIcon icon={faTimesCircle} style={{ color: '#ef4444', fontSize: 60, marginBottom: 16, display: 'block' }} />
      <h2 style={{ color: '#dc2626' }}>Pago no completado</h2>
      <p style={{ color: '#6b7280' }}>El pago fue cancelado o rechazado. No se realizó ningún cobro.</p>
      <a href={`/tickets/${storeCode}`} style={{ display: 'inline-block', marginTop: 20, padding: '10px 24px', background: '#f3f4f6', borderRadius: 10, color: '#374151', fontWeight: 700, textDecoration: 'none' }}>
        Volver a intentar
      </a>
    </div>
  );

  if (status === 'pending') return (
    <div style={{ textAlign: 'center', padding: '30px 20px' }}>
      <FontAwesomeIcon icon={faSpinner} spin style={{ color: '#f59e0b', fontSize: 50, marginBottom: 16, display: 'block' }} />
      <h2 style={{ color: '#d97706' }}>Verificando pago...</h2>
      <p style={{ color: '#6b7280' }}>Tu pago está siendo procesado. Si ya realizaste el pago, recibirás las entradas en tu correo en breve.</p>
    </div>
  );

  return (
    <div style={{ textAlign: 'center', padding: 40, color: '#ef4444' }}>
      <FontAwesomeIcon icon={faTimesCircle} style={{ fontSize: 40, marginBottom: 10, display: 'block' }} />
      Error verificando el pago. Contacta al organizador.
    </div>
  );
}

export default function TicketeriaPublic() {
  const { storeCode } = useParams();
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');
  const cancelled = searchParams.get('cancelled');

  const [store, setStore] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const storeRes = await fetch(`${API}/api/stores/by-code/${storeCode}`);
        if (!storeRes.ok) { setError('Tienda no encontrada'); return; }
        const storeData = await storeRes.json();
        setStore(storeData);
        const evRes = await fetch(`${API}/api/ticketeria/public/events?store_id=${storeData.id}`);
        const evData = await evRes.json();
        setEvents(Array.isArray(evData) ? evData : []);
      } catch { setError('Error cargando información'); }
      finally { setLoading(false); }
    };
    load();
  }, [storeCode]);

  const pageStyle = {
    minHeight: '100vh',
    background: '#f9fafb',
    color: '#111',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  };

  const containerStyle = { maxWidth: 600, margin: '0 auto', padding: '30px 20px' };

  if (loading) return (
    <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <FontAwesomeIcon icon={faSpinner} spin style={{ color: GOLD, fontSize: 40 }} />
    </div>
  );

  if (error) return (
    <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <FontAwesomeIcon icon={faTimesCircle} style={{ color: '#ef4444', fontSize: 50, marginBottom: 14 }} />
        <p style={{ color: '#ef4444', fontSize: 18 }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <FontAwesomeIcon icon={faTicketAlt} style={{ color: GOLD, fontSize: 22 }} />
          <span style={{ fontWeight: 800, fontSize: 18, color: '#111' }}>{store?.name || 'Ticketería'}</span>
        </div>
      </div>

      <div style={containerStyle}>
        {ref ? (
          <ConfirmationView reference={ref} storeCode={storeCode} />
        ) : cancelled ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <FontAwesomeIcon icon={faTimesCircle} style={{ color: '#ef4444', fontSize: 50, marginBottom: 12, display: 'block' }} />
            <h2 style={{ color: '#dc2626' }}>Compra cancelada</h2>
            <p style={{ color: '#6b7280' }}>No se realizó ningún cobro.</p>
            <button onClick={() => window.location.href = `/tickets/${storeCode}`}
              style={{ marginTop: 16, padding: '10px 24px', background: GOLD, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Volver a los eventos
            </button>
          </div>
        ) : selectedEvent ? (
          <PurchaseForm event={selectedEvent} storeId={store?.id} onBack={() => setSelectedEvent(null)} onSuccess={() => {}} />
        ) : (
          <div>
            <h2 style={{ color: '#111', marginBottom: 4, fontSize: 22, fontWeight: 800 }}>
              <FontAwesomeIcon icon={faTicketAlt} style={{ color: GOLD, marginRight: 10 }} />Eventos disponibles
            </h2>
            <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 22 }}>Selecciona un evento para comprar tus entradas.</p>

            {events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 50, color: '#d1d5db' }}>
                <FontAwesomeIcon icon={faTicketAlt} style={{ fontSize: 50, marginBottom: 14, display: 'block' }} />
                <span style={{ color: '#9ca3af' }}>No hay eventos disponibles en este momento.</span>
              </div>
            ) : events.map(ev => <EventCard key={ev.id} event={ev} onSelect={setSelectedEvent} />)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '20px', fontSize: 12, color: '#d1d5db', borderTop: '1px solid #f3f4f6' }}>
        Powered by SRServi · Pagos procesados por Haulmer
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '11px 14px',
  background: '#fff', border: '1px solid #d1d5db', borderRadius: 10,
  color: '#111', fontSize: 15, outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s'
};

const qtyBtnStyle = {
  width: 32, height: 32, background: '#fff', border: `1px solid ${GOLD}`,
  borderRadius: 8, color: GOLD, cursor: 'pointer', fontSize: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'center'
};
