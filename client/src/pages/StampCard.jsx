import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';

const API = 'https://srservi2.srautomatic.com';

export default function StampCard() {
  const { token } = useParams();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(`${API}/api/card/${token}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('not found'))))
      .then(d => { if (alive) setCard(d); })
      .catch(() => { if (alive) setError('No pudimos encontrar esta tarjeta.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);

  if (loading) return <Center><div style={{ color: '#888' }}>Cargando tu tarjeta...</div></Center>;
  if (error || !card) return <Center><div style={{ color: '#888', textAlign: 'center' }}>{error || 'Tarjeta no encontrada.'}</div></Center>;

  const required = Math.max(1, parseInt(card.config?.stamps_required) || 10);
  const stamps = Math.min(card.stamps || 0, required);
  const rewardAvailable = !!card.reward_available;
  const rewardLabel = card.config?.reward_label || '1 producto gratis';
  const cardUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <Center>
      <div style={{
        width: '100%', maxWidth: 420, background: '#fff', borderRadius: 24,
        boxShadow: '0 10px 40px rgba(0,0,0,0.12)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #111 0%, #2a2a2a 100%)', color: '#fff',
          padding: '28px 24px', textAlign: 'center'
        }}>
          {card.store_logo && (
            <img src={card.store_logo} alt={card.store_name}
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.25)', marginBottom: 10 }} />
          )}
          <div style={{ fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.7 }}>Tarjeta de sellos</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800 }}>{card.store_name}</h1>
          {card.name && <div style={{ marginTop: 4, fontSize: 14, opacity: 0.85 }}>{card.name}</div>}
        </div>

        {/* Reward banner */}
        {rewardAvailable && (
          <div style={{ background: '#16a34a', color: '#fff', padding: '12px 20px', textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
            🎉 ¡Recompensa disponible! Muestra esta tarjeta.
          </div>
        )}

        <div style={{ padding: '24px' }}>
          {/* Progress */}
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <span style={{ fontSize: 34, fontWeight: 900, color: '#D4AF37' }}>{stamps}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#9ca3af' }}> / {required}</span>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
              {rewardAvailable
                ? '¡Tarjeta completa!'
                : `Te faltan ${required - stamps} sello${required - stamps !== 1 ? 's' : ''} para tu recompensa`}
            </div>
          </div>

          {/* Stamp grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(required, 5)}, 1fr)`,
            gap: 10, marginBottom: 22
          }}>
            {Array.from({ length: required }).map((_, i) => {
              const filled = i < stamps;
              return (
                <div key={i} style={{
                  aspectRatio: '1', borderRadius: '50%',
                  border: `2px solid ${filled ? '#D4AF37' : '#e5e7eb'}`,
                  background: filled ? '#D4AF37' : '#fafafa',
                  color: filled ? '#fff' : '#d1d5db',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800
                }}>
                  {filled ? '★' : i + 1}
                </div>
              );
            })}
          </div>

          {/* Reward label */}
          <div style={{
            background: '#faf7ee', border: '1.5px solid #D4AF37', borderRadius: 12,
            padding: '12px 16px', textAlign: 'center', marginBottom: 22
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tu recompensa</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginTop: 2 }}>{rewardLabel}</div>
          </div>

          {/* QR */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
              Muestra este código al pagar para sumar tu sello
            </div>
            <div style={{ display: 'inline-block', padding: 12, background: '#fff', border: '1px solid #eee', borderRadius: 14 }}>
              <QRCodeCanvas value={cardUrl} size={160} level="H" includeMargin={false} />
            </div>
          </div>
        </div>
      </div>
    </Center>
  );
}

function Center({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#f3f4f6', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20,
      fontFamily: 'system-ui, sans-serif'
    }}>
      {children}
    </div>
  );
}
