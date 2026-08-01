import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config.js';

const API = 'https://srservi2.srautomatic.com';

export default function StampCard() {
  const { token: tokenParam } = useParams();
  const [card, setCard] = useState(null);
  const [token, setToken] = useState(tokenParam || null);
  const [loading, setLoading] = useState(!!tokenParam);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const socketRef = useRef(null);

  // Si hay token en la URL, cargar la tarjeta por token
  useEffect(() => {
    if (!tokenParam) return;
    let alive = true;
    fetch(`${API}/api/card/${tokenParam}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('not found'))))
      .then(d => { if (alive) { setCard(d); setToken(d.token); } })
      .catch(() => { if (alive) setError('No pudimos encontrar esta tarjeta.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tokenParam]);

  // Socket: confirmación en vivo cuando la tarjeta se usa en el tótem/caja
  useEffect(() => {
    if (!token) return;
    const socket = io(SOCKET_URL);
    socketRef.current = socket;
    const join = () => socket.emit('join_card_room', token);
    socket.on('connect', join);
    socket.on('reconnect', join);
    socket.on('stamp_card_update', (data) => {
      setCard(prev => prev ? {
        ...prev,
        stamps: data.action === 'redeem' ? (data.stamps ?? 0) : (data.stamps ?? prev.stamps),
        reward_available: !!data.reward_available
      } : prev);
      setConfirm(data);
    });
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [token]);

  if (loading) return <Center><div style={{ color: '#888' }}>Cargando tu tarjeta...</div></Center>;

  // Sin tarjeta cargada y sin token → pantalla de acceso con clave de 5 dígitos
  if (!card) {
    return <CodeEntry onCard={(c) => { setCard(c); setToken(c.token); setError(''); }} error={error} setError={setError} />;
  }

  const cfg = card.config || {};
  const required = Math.max(1, parseInt(cfg.stamps_required) || 10);
  const stamps = Math.min(card.stamps || 0, required);
  const rewardAvailable = !!card.reward_available;
  const rewardLabel = cfg.reward_label || '1 producto gratis';
  const cardUrl = card.token ? `${API}/tarjeta/${card.token}` : (typeof window !== 'undefined' ? window.location.href : '');

  return (
    <Center>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #111 0%, #2a2a2a 100%)', color: '#fff', padding: '28px 24px', textAlign: 'center' }}>
          {card.store_logo && (
            <img src={card.store_logo} alt={card.store_name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.25)', marginBottom: 10 }} />
          )}
          <div style={{ fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.7 }}>Tarjeta de sellos</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800 }}>{card.store_name || 'Tu tarjeta'}</h1>
          {card.name && <div style={{ marginTop: 4, fontSize: 14, opacity: 0.85 }}>{card.name}</div>}
        </div>

        {/* Clave */}
        <div style={{ background: '#faf7ee', borderBottom: '1px solid #eee', padding: '12px 20px', textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>Tu clave: </span>
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: 4, color: '#111' }}>{card.code}</span>
          <div style={{ fontSize: 11, color: '#a1874a', marginTop: 2 }}>Muéstrala al pagar para sumar tu sello</div>
        </div>

        {/* Reward banner */}
        {rewardAvailable && (
          <div style={{ background: '#16a34a', color: '#fff', padding: '12px 20px', textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
            🎉 ¡Recompensa disponible!
          </div>
        )}

        <div style={{ padding: '24px' }}>
          {/* Progreso */}
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <span style={{ fontSize: 34, fontWeight: 900, color: '#D4AF37' }}>{stamps}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#9ca3af' }}> / {required}</span>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
              {card.store_id
                ? (rewardAvailable ? '¡Tarjeta completa!' : `Te faltan ${required - stamps} sello${required - stamps !== 1 ? 's' : ''} para tu recompensa`)
                : 'Usa tu clave en la tienda para empezar a sumar sellos'}
            </div>
          </div>

          {/* Grilla de sellos */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(required, 5)}, 1fr)`, gap: 10, marginBottom: 22 }}>
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

          {/* Recompensa */}
          <div style={{ background: '#faf7ee', border: '1.5px solid #D4AF37', borderRadius: 12, padding: '12px 16px', textAlign: 'center', marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tu recompensa</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginTop: 2 }}>{rewardLabel}</div>
          </div>

          {/* QR */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Guarda o comparte tu tarjeta</div>
            <div style={{ display: 'inline-block', padding: 12, background: '#fff', border: '1px solid #eee', borderRadius: 14 }}>
              <QRCodeCanvas value={cardUrl} size={160} level="H" includeMargin={false} />
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmación en vivo */}
      {confirm && (
        <div onClick={() => setConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 20, padding: '28px 24px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 52, marginBottom: 8 }}>
              {confirm.action === 'redeem' ? '✅' : confirm.action === 'reward' ? '🎉' : '⭐'}
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#111' }}>
              {confirm.action === 'redeem' ? '¡Recompensa canjeada!' : confirm.action === 'reward' ? '¡Recompensa desbloqueada!' : '¡Sello agregado!'}
            </h2>
            <p style={{ margin: '0 0 4px', fontSize: 14, color: '#6b7280' }}>{confirm.store_name}</p>
            {confirm.action !== 'redeem' && confirm.stamps != null && confirm.stamps_required != null && (
              <div style={{ fontSize: 15, fontWeight: 700, color: '#D4AF37', margin: '6px 0' }}>{confirm.stamps} / {confirm.stamps_required} sellos</div>
            )}
            {confirm.action === 'reward' && confirm.reward_label && (
              <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>{confirm.reward_label}</div>
            )}
            <button onClick={() => setConfirm(null)} style={{ marginTop: 20, width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: '#111', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Entendido</button>
          </div>
        </div>
      )}
    </Center>
  );
}

// Pantalla de acceso: teclado numérico para ingresar/crear la clave de 5 dígitos
function CodeEntry({ onCard, error, setError }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const press = (d) => { if (code.length < 5) { setCode(code + d); setError(''); } };
  const back = () => setCode(code.slice(0, -1));

  const submit = async () => {
    if (code.length !== 5) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(`${API}/api/card`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const d = await r.json();
      if (r.ok) onCard(d);
      else setError(d.error || 'No se pudo abrir la tarjeta');
    } catch { setError('Error de conexión'); }
    finally { setBusy(false); }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'];

  return (
    <Center>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.12)', padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 6 }}>🎁</div>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#111' }}>Tu tarjeta de sellos</h1>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#6b7280' }}>
          Ingresa tu clave de 5 dígitos. Si es nueva, se creará tu tarjeta.
        </p>

        {/* Display de dígitos */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              width: 42, height: 54, borderRadius: 10,
              border: `2px solid ${i === code.length ? '#D4AF37' : '#e5e7eb'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 800, color: '#111', background: '#fafafa'
            }}>
              {code[i] || ''}
            </div>
          ))}
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 13, margin: '6px 0', fontWeight: 600 }}>{error}</div>}

        {/* Teclado numérico */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}>
          {keys.map(k => {
            if (k === 'back') return (
              <button key={k} onClick={back} disabled={busy} style={keyStyle('#f3f4f6', '#111')}>⌫</button>
            );
            if (k === 'ok') return (
              <button key={k} onClick={submit} disabled={busy || code.length !== 5} style={keyStyle(code.length === 5 ? '#16a34a' : '#e5e7eb', '#fff')}>
                {busy ? '...' : '✓'}
              </button>
            );
            return (
              <button key={k} onClick={() => press(k)} disabled={busy} style={keyStyle('#fff', '#111', true)}>{k}</button>
            );
          })}
        </div>
      </div>
    </Center>
  );
}

function keyStyle(bg, color, bordered) {
  return {
    padding: '16px 0', fontSize: 22, fontWeight: 800, color,
    background: bg, border: bordered ? '1.5px solid #e5e7eb' : 'none',
    borderRadius: 12, cursor: 'pointer'
  };
}

function Center({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      {children}
    </div>
  );
}
