import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const API = 'https://srservi3.srautomatic.com';
const GOLD = '#C8A415';

function formatDate(raw) {
  if (!raw) return '';
  const s = typeof raw === 'string' ? raw : raw.toISOString?.() ?? String(raw);
  const d = new Date(s.slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function formatTime(t) {
  if (!t) return '';
  return String(t).slice(0, 5);
}

export default function TicketViewer() {
  const { code } = useParams();
  const upperCode = (code || '').toUpperCase();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/api/ticketeria/public/ticket/${upperCode}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false));
  }, [upperCode]);

  const ticketUrl = `${window.location.origin}/ticket/${upperCode}`;
  const totalTickets = data?.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const isAdmitted = !!data?.admitted;
  const isPaid = data?.status === 'paid';

  if (loading) return (
    <div style={pg}>
      <div style={{ textAlign: 'center', paddingTop: 100 }}>
        <div style={{ width: 44, height: 44, border: `4px solid ${GOLD}30`, borderTopColor: GOLD, borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  if (error || !data) return (
    <div style={pg}>
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>❓</div>
        <h2 style={{ color: '#dc2626', margin: '0 0 8px' }}>Entrada no encontrada</h2>
        <p style={{ color: '#6b7280', fontSize: 14 }}>El código <strong>{upperCode}</strong> no es válido.</p>
      </div>
    </div>
  );

  return (
    <div style={pg}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '13px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🎟️</span>
          <span style={{ fontWeight: 800, fontSize: 17, color: '#111' }}>Entrada Digital</span>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '22px 16px 40px' }}>

        {/* Badge de estado */}
        {isAdmitted ? (
          <div style={badge('#fef2f2', '#dc2626', '#fca5a5')}>
            <span style={{ fontSize: 22 }}>❌</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>ENTRADA YA UTILIZADA</div>
              {data.admitted_at && (
                <div style={{ fontSize: 12, marginTop: 2, opacity: 0.8 }}>
                  Admitida el {new Date(data.admitted_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              )}
            </div>
          </div>
        ) : isPaid ? (
          <div style={badge('#f0fdf4', '#16a34a', '#86efac')}>
            <span style={{ fontSize: 22 }}>✅</span>
            <div style={{ fontWeight: 900, fontSize: 16 }}>ENTRADA VÁLIDA</div>
          </div>
        ) : (
          <div style={badge('#fffbeb', '#d97706', '#fde68a')}>
            <span style={{ fontSize: 22 }}>⏳</span>
            <div style={{ fontWeight: 900, fontSize: 16 }}>PAGO PENDIENTE</div>
          </div>
        )}

        {/* QR + código */}
        <div style={card}>
          <div style={{ textAlign: 'center' }}>
            <QRCodeSVG value={ticketUrl} size={200} level="H" fgColor="#111" bgColor="#ffffff"
              style={{ borderRadius: 8, border: `4px solid ${GOLD}`, display: 'block', margin: '0 auto' }} />
            <div style={{ marginTop: 14, fontFamily: 'monospace', fontSize: 26, fontWeight: 900, letterSpacing: 5, color: '#111' }}>
              {upperCode}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#9ca3af' }}>Código único de tu compra</div>
          </div>
        </div>

        {/* Evento */}
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          {data.event_image && (
            <img src={data.event_image} alt={data.event_name} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
          )}
          <div style={{ padding: '16px 18px' }}>
            <h2 style={{ margin: '0 0 10px', color: '#111', fontSize: 18, fontWeight: 800 }}>{data.event_name}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 14, color: '#374151' }}>
              <div>📅 <strong>{formatDate(data.event_date)}</strong></div>
              {(data.time_start) && (
                <div>⏰ {formatTime(data.time_start)}{data.time_end ? ` – ${formatTime(data.time_end)}` : ''}</div>
              )}
              {data.location && <div>📍 {data.location}</div>}
            </div>
          </div>
        </div>

        {/* Comprador */}
        <div style={card}>
          <h3 style={sectionTitle}>Comprador</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 14, color: '#374151' }}>
            <div>👤 <strong>{data.buyer_name}</strong></div>
            <div>✉️ {data.buyer_email}</div>
            {data.buyer_phone && <div>📱 {data.buyer_phone}</div>}
          </div>
        </div>

        {/* Entradas */}
        <div style={card}>
          <h3 style={sectionTitle}>Entradas ({totalTickets} persona{totalTickets !== 1 ? 's' : ''})</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '6px 0', textAlign: 'left', color: '#6b7280', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Categoría</th>
                <th style={{ padding: '6px 0', textAlign: 'center', color: '#6b7280', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Cant.</th>
                <th style={{ padding: '6px 0', textAlign: 'right', color: '#6b7280', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Precio</th>
              </tr>
            </thead>
            <tbody>
              {(data.items || []).map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '9px 0', color: '#111', fontWeight: 600 }}>{item.category_name}</td>
                  <td style={{ padding: '9px 0', textAlign: 'center', color: '#374151' }}>{item.quantity}</td>
                  <td style={{ padding: '9px 0', textAlign: 'right', color: GOLD, fontWeight: 700 }}>
                    {item.unit_price === 0 ? 'Gratis' : `$${Number(item.unit_price).toLocaleString('es-CL')}`}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ paddingTop: 10, fontWeight: 700, color: '#111', fontSize: 15 }}>Total</td>
                <td style={{ paddingTop: 10, textAlign: 'right', fontWeight: 900, color: GOLD, fontSize: 18 }}>
                  {data.total_amount === 0 ? 'Gratis' : `$${Number(data.total_amount).toLocaleString('es-CL')}`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', margin: '8px 0 0' }}>
          Powered by SRServi · {data.haulmer_reference || upperCode}
        </p>
      </div>
    </div>
  );
}

const pg = { minHeight: '100vh', background: '#f9fafb', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', color: '#111' };
const card = { background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '16px 18px', marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };
const sectionTitle = { margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' };
const badge = (bg, color, border) => ({
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '14px 18px', borderRadius: 12, background: bg,
  border: `2px solid ${border}`, marginBottom: 16, color
});
