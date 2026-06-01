import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const API = 'https://srservi2.srautomatic.com';
const GOLD = '#C8A415';

function StatusBadge({ status }) {
  const map = {
    valid:     { bg: '#f0fdf4', color: '#16a34a', border: '#86efac', icon: '✅', label: 'ENTRADA VÁLIDA' },
    used:      { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5', icon: '❌', label: 'ENTRADA YA UTILIZADA' },
    cancelled: { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db', icon: '🚫', label: 'ENTRADA CANCELADA' },
  };
  const s = map[status] || map.valid;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      padding: '14px 20px', borderRadius: 12, background: s.bg, border: `2px solid ${s.border}`,
      marginBottom: 20
    }}>
      <span style={{ fontSize: 22 }}>{s.icon}</span>
      <span style={{ fontWeight: 900, fontSize: 17, color: s.color, letterSpacing: '0.5px' }}>{s.label}</span>
    </div>
  );
}

export default function TicketViewer() {
  const { code } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/api/ticketeria/public/ticket/${code.toUpperCase()}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setTicket(d);
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false));
  }, [code]);

  const ticketUrl = `${window.location.origin}/ticket/${code.toUpperCase()}`;

  if (loading) return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ width: 40, height: 40, border: `4px solid ${GOLD}30`, borderTopColor: GOLD, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (error) return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 50, marginBottom: 16 }}>❓</div>
        <h2 style={{ color: '#dc2626', margin: '0 0 8px' }}>Ticket no encontrado</h2>
        <p style={{ color: '#6b7280', fontSize: 14 }}>El código <strong>{code.toUpperCase()}</strong> no existe o no es válido.</p>
      </div>
    </div>
  );

  const eventDate = new Date(ticket.event_date + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  const timeStr = ticket.time_start
    ? ticket.time_start.slice(0, 5) + (ticket.time_end ? ` – ${ticket.time_end.slice(0, 5)}` : '')
    : '';

  // Parsear todos los tickets de la misma compra
  const allTickets = ticket.all_tickets
    ? ticket.all_tickets.split('|').map(t => {
        const [cat, tc] = t.split(':');
        return { category: cat, code: tc };
      })
    : [{ category: ticket.category_name, code: ticket.ticket_code }];

  return (
    <div style={pageStyle}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: 540, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🎟️</span>
          <span style={{ fontWeight: 800, fontSize: 18, color: '#111' }}>Entrada Digital</span>
        </div>
      </div>

      <div style={{ maxWidth: 540, margin: '0 auto', padding: '24px 16px' }}>

        {/* Estado */}
        <StatusBadge status={ticket.status} />

        {/* QR grande */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '28px 20px', textAlign: 'center', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <QRCodeSVG value={ticketUrl} size={220} level="H" style={{ display: 'block', margin: '0 auto' }}
            fgColor="#111" bgColor="#ffffff"
          />
          <div style={{ marginTop: 16, fontFamily: 'monospace', fontSize: 26, fontWeight: 900, letterSpacing: 4, color: '#111' }}>
            {ticket.ticket_code}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#9ca3af' }}>
            {ticket.category_name}
          </div>
          {ticket.status === 'used' && ticket.used_at && (
            <div style={{ marginTop: 10, padding: '8px 14px', background: '#fef2f2', borderRadius: 8, fontSize: 13, color: '#dc2626', display: 'inline-block' }}>
              Utilizada el {new Date(ticket.used_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          )}
        </div>

        {/* Info del evento */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          {ticket.event_image && (
            <img src={ticket.event_image} alt={ticket.event_name} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
          )}
          <div style={{ padding: '16px 18px' }}>
            <h2 style={{ margin: '0 0 10px', color: '#111', fontSize: 18, fontWeight: 800 }}>{ticket.event_name}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 14, color: '#374151' }}>
              <div>📅 <strong>{eventDate}</strong></div>
              {timeStr && <div>⏰ {timeStr}</div>}
              {ticket.location && <div>📍 {ticket.location}</div>}
            </div>
          </div>
        </div>

        {/* Info del comprador */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '16px 18px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Información de la compra</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: '#374151' }}>
            <div>👤 <strong>{ticket.buyer_name}</strong></div>
            <div>✉️ {ticket.buyer_email}</div>
            {ticket.buyer_phone && <div>📱 {ticket.buyer_phone}</div>}
            <div>💰 {ticket.total_amount === 0 ? 'Gratis' : `$${Number(ticket.total_amount).toLocaleString('es-CL')}`}</div>
          </div>
        </div>

        {/* Todas las entradas de esta compra */}
        {allTickets.length > 1 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '16px 18px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Todas las entradas de esta compra ({allTickets.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allTickets.map((t, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 8,
                  background: t.code === ticket.ticket_code ? '#fffbeb' : '#f9fafb',
                  border: `1px solid ${t.code === ticket.ticket_code ? GOLD + '50' : '#e5e7eb'}`
                }}>
                  <div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, letterSpacing: 2, color: '#111' }}>{t.code}</span>
                    <span style={{ marginLeft: 10, fontSize: 13, color: '#6b7280' }}>{t.category}</span>
                    {t.code === ticket.ticket_code && <span style={{ marginLeft: 8, fontSize: 11, color: GOLD, fontWeight: 700 }}>← esta</span>}
                  </div>
                  {t.code !== ticket.ticket_code && (
                    <a href={`/ticket/${t.code}`} style={{ fontSize: 12, color: GOLD, fontWeight: 600, textDecoration: 'none' }}>Ver →</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', margin: '20px 0 0' }}>
          Powered by SRServi · Ref: {ticket.haulmer_reference}
        </p>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: '100vh',
  background: '#f9fafb',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: '#111'
};
