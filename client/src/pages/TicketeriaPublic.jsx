import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTicketAlt, faCalendarAlt, faClock, faMapMarkerAlt, faSpinner,
  faCheckCircle, faTimesCircle, faArrowLeft, faMinus, faPlus, faShoppingCart
} from '@fortawesome/free-solid-svg-icons';

const API = 'https://srservi2.srautomatic.com';

function EventCard({ event, onSelect }) {
  const dateStr = new Date(event.event_date + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  const isSoldOut = event.max_capacity && event.sold_count >= event.max_capacity;

  return (
    <div onClick={() => !isSoldOut && onSelect(event)} style={{
      background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '18px 20px',
      border: '1px solid rgba(255,255,255,0.08)', cursor: isSoldOut ? 'not-allowed' : 'pointer',
      opacity: isSoldOut ? 0.6 : 1, transition: 'transform 0.15s, border-color 0.15s',
      marginBottom: 14,
    }}
      onMouseEnter={e => { if (!isSoldOut) e.currentTarget.style.borderColor = '#D4AF37'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
    >
      {event.image_url && <img src={event.image_url} alt={event.name} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 10, marginBottom: 12 }} />}
      <h3 style={{ margin: '0 0 8px', color: '#fff', fontSize: 18 }}>{event.name}</h3>
      {event.description && <p style={{ margin: '0 0 10px', color: '#aaa', fontSize: 13, lineHeight: 1.5 }}>{event.description}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, color: '#999' }}>
        <span><FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: 6, color: '#D4AF37' }} />{dateStr}</span>
        <span><FontAwesomeIcon icon={faClock} style={{ marginRight: 6, color: '#D4AF37' }} />
          {event.time_start?.slice(0, 5)}{event.time_end ? ` – ${event.time_end.slice(0, 5)}` : ''}
        </span>
        {event.location && <span><FontAwesomeIcon icon={faMapMarkerAlt} style={{ marginRight: 6, color: '#D4AF37' }} />{event.location}</span>}
      </div>
      {isSoldOut ? (
        <div style={{ marginTop: 10, color: '#f87171', fontWeight: 700, fontSize: 13 }}>AGOTADO</div>
      ) : (
        <button style={{
          marginTop: 14, width: '100%', padding: '10px', background: '#D4AF37', border: 'none',
          borderRadius: 10, color: '#111', fontWeight: 800, fontSize: 14, cursor: 'pointer'
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

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><FontAwesomeIcon icon={faSpinner} spin style={{ color: '#D4AF37', fontSize: 28 }} /></div>;

  return (
    <form onSubmit={handleSubmit}>
      <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer', fontSize: 14, marginBottom: 16, padding: 0 }}>
        <FontAwesomeIcon icon={faArrowLeft} /> Volver
      </button>

      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, border: '1px solid rgba(212,175,55,0.2)' }}>
        <h3 style={{ margin: '0 0 6px', color: '#D4AF37', fontSize: 17 }}>{event.name}</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#999' }}>
          <span><FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: 5 }} />{dateStr}</span>
          <span><FontAwesomeIcon icon={faClock} style={{ marginRight: 5 }} />{event.time_start?.slice(0, 5)}{event.time_end ? ` – ${event.time_end.slice(0, 5)}` : ''}</span>
          {event.location && <span><FontAwesomeIcon icon={faMapMarkerAlt} style={{ marginRight: 5 }} />{event.location}</span>}
        </div>
      </div>

      <h4 style={{ color: '#fff', marginBottom: 12, fontSize: 15 }}>Selecciona tus entradas</h4>

      {categories.length === 0 ? (
        <div style={{ color: '#888', fontSize: 14, padding: '10px 0' }}>No hay categorías disponibles para este evento.</div>
      ) : categories.map(cat => (
        <div key={cat.id} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
          background: 'rgba(255,255,255,0.04)', borderRadius: 10, marginBottom: 8,
          border: qtys[cat.id] > 0 ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.06)'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{cat.name}</div>
            {cat.description && <div style={{ fontSize: 12, color: '#999' }}>{cat.description}</div>}
          </div>
          <div style={{ fontWeight: 700, color: '#D4AF37', fontSize: 16, minWidth: 80, textAlign: 'right' }}>
            {cat.price === 0 ? 'Gratis' : `$${cat.price.toLocaleString('es-CL')}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={() => adjust(cat.id, -1)} style={qtyBtnStyle} disabled={!qtys[cat.id]}>
              <FontAwesomeIcon icon={faMinus} />
            </button>
            <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700, fontSize: 16 }}>{qtys[cat.id] || 0}</span>
            <button type="button" onClick={() => adjust(cat.id, 1)} style={qtyBtnStyle} disabled={cat.max_qty && qtys[cat.id] >= cat.max_qty}>
              <FontAwesomeIcon icon={faPlus} />
            </button>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 24 }}>
        <h4 style={{ color: '#fff', marginBottom: 12, fontSize: 15 }}>Datos del comprador</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input required placeholder="Nombre completo *" value={buyer.name} onChange={e => setBuyer(b => ({ ...b, name: e.target.value }))} style={inputStyle} />
          <input required type="email" placeholder="Correo electrónico * (aquí recibirás tus entradas)" value={buyer.email} onChange={e => setBuyer(b => ({ ...b, email: e.target.value }))} style={inputStyle} />
          <input type="tel" placeholder="Teléfono (opcional)" value={buyer.phone} onChange={e => setBuyer(b => ({ ...b, phone: e.target.value }))} style={inputStyle} />
        </div>
      </div>

      {error && <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(248,113,113,0.15)', border: '1px solid #f87171', borderRadius: 8, color: '#f87171', fontSize: 13 }}>{error}</div>}

      <div style={{ marginTop: 20, padding: '14px 16px', background: 'rgba(212,175,55,0.08)', borderRadius: 10, border: '1px solid rgba(212,175,55,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#ccc', fontSize: 14 }}>{totalTickets} entrada{totalTickets !== 1 ? 's' : ''}</span>
          <span style={{ fontWeight: 800, color: '#D4AF37', fontSize: 20 }}>${total.toLocaleString('es-CL')}</span>
        </div>
      </div>

      <button type="submit" disabled={submitting || totalTickets === 0} style={{
        width: '100%', marginTop: 16, padding: '14px', background: totalTickets === 0 ? '#555' : '#D4AF37',
        border: 'none', borderRadius: 12, color: '#111', fontWeight: 800, fontSize: 16,
        cursor: totalTickets === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
      }}>
        {submitting ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faShoppingCart} />}
        {submitting ? 'Redirigiendo...' : 'Pagar con Haulmer'}
      </button>

      <p style={{ textAlign: 'center', fontSize: 11, color: '#666', marginTop: 10 }}>
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
        // Try to confirm first
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
      <FontAwesomeIcon icon={faSpinner} spin style={{ color: '#D4AF37', fontSize: 36, marginBottom: 16, display: 'block' }} />
      <p style={{ color: '#ccc' }}>Confirmando tu pago...</p>
    </div>
  );

  if (status === 'success') return (
    <div style={{ textAlign: 'center', padding: '30px 20px' }}>
      <FontAwesomeIcon icon={faCheckCircle} style={{ color: '#22c55e', fontSize: 60, marginBottom: 16, display: 'block' }} />
      <h2 style={{ color: '#22c55e', marginBottom: 8 }}>¡Pago confirmado!</h2>
      <p style={{ color: '#ccc', marginBottom: 4 }}>Tus entradas para <strong style={{ color: '#fff' }}>{purchase?.event_name}</strong> fueron enviadas a:</p>
      <p style={{ color: '#D4AF37', fontWeight: 700, fontSize: 16 }}>{purchase?.buyer_email}</p>
      <p style={{ color: '#888', fontSize: 13, marginTop: 8 }}>Revisa tu bandeja de entrada (y spam).</p>
      <a href={`/tickets/${storeCode}`} style={{ display: 'inline-block', marginTop: 20, padding: '10px 24px', background: '#D4AF37', borderRadius: 10, color: '#111', fontWeight: 700, textDecoration: 'none' }}>
        Ver más eventos
      </a>
    </div>
  );

  if (status === 'failed') return (
    <div style={{ textAlign: 'center', padding: '30px 20px' }}>
      <FontAwesomeIcon icon={faTimesCircle} style={{ color: '#f87171', fontSize: 60, marginBottom: 16, display: 'block' }} />
      <h2 style={{ color: '#f87171' }}>Pago no completado</h2>
      <p style={{ color: '#ccc' }}>El pago fue cancelado o rechazado. No se realizó ningún cobro.</p>
      <a href={`/tickets/${storeCode}`} style={{ display: 'inline-block', marginTop: 20, padding: '10px 24px', background: 'rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
        Volver a intentar
      </a>
    </div>
  );

  if (status === 'pending') return (
    <div style={{ textAlign: 'center', padding: '30px 20px' }}>
      <FontAwesomeIcon icon={faSpinner} spin style={{ color: '#fbbf24', fontSize: 50, marginBottom: 16, display: 'block' }} />
      <h2 style={{ color: '#fbbf24' }}>Verificando pago...</h2>
      <p style={{ color: '#ccc' }}>Tu pago está siendo procesado. Si ya realizaste el pago, recibirás las entradas en tu correo en breve.</p>
    </div>
  );

  return (
    <div style={{ textAlign: 'center', padding: 40, color: '#f87171' }}>
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
    minHeight: '100vh', background: '#0d0d0d', color: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  };

  const containerStyle = { maxWidth: 600, margin: '0 auto', padding: '30px 20px' };

  if (loading) return (
    <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <FontAwesomeIcon icon={faSpinner} spin style={{ color: '#D4AF37', fontSize: 40 }} />
    </div>
  );

  if (error) return (
    <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <FontAwesomeIcon icon={faTimesCircle} style={{ color: '#f87171', fontSize: 50, marginBottom: 14 }} />
        <p style={{ color: '#f87171', fontSize: 18 }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div style={pageStyle}>
      <div style={{ background: '#111', borderBottom: '1px solid rgba(212,175,55,0.2)', padding: '14px 20px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <FontAwesomeIcon icon={faTicketAlt} style={{ color: '#D4AF37', fontSize: 20 }} />
          <span style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>{store?.name || 'Ticketería'}</span>
        </div>
      </div>

      <div style={containerStyle}>
        {ref ? (
          <ConfirmationView reference={ref} storeCode={storeCode} />
        ) : cancelled ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <FontAwesomeIcon icon={faTimesCircle} style={{ color: '#f87171', fontSize: 50, marginBottom: 12, display: 'block' }} />
            <h2 style={{ color: '#f87171' }}>Compra cancelada</h2>
            <p style={{ color: '#ccc' }}>No se realizó ningún cobro.</p>
            <button onClick={() => window.location.href = `/tickets/${storeCode}`}
              style={{ marginTop: 16, padding: '10px 24px', background: '#D4AF37', border: 'none', borderRadius: 10, color: '#111', fontWeight: 700, cursor: 'pointer' }}>
              Volver a los eventos
            </button>
          </div>
        ) : selectedEvent ? (
          <PurchaseForm event={selectedEvent} storeId={store?.id} onBack={() => setSelectedEvent(null)} onSuccess={() => {}} />
        ) : (
          <div>
            <h2 style={{ color: '#fff', marginBottom: 6, fontSize: 22 }}>
              <FontAwesomeIcon icon={faTicketAlt} style={{ color: '#D4AF37', marginRight: 10 }} />Eventos disponibles
            </h2>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>Selecciona un evento para comprar tus entradas.</p>

            {events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 50, color: '#555' }}>
                <FontAwesomeIcon icon={faTicketAlt} style={{ fontSize: 50, marginBottom: 14, display: 'block' }} />
                No hay eventos disponibles en este momento.
              </div>
            ) : events.map(ev => <EventCard key={ev.id} event={ev} onSelect={setSelectedEvent} />)}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' };
const qtyBtnStyle = { width: 32, height: 32, background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 8, color: '#D4AF37', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' };
