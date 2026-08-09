import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config.js';

const API = 'https://srservi2.srautomatic.com';

// Temas tipo tarjeta bancaria (estilo Santander y otros)
const THEMES = {
  red:    { label: 'Rojo',    grad: 'linear-gradient(135deg,#ec0000 0%,#7a0000 100%)', fg: '#fff', chip: '#f4c542' },
  black:  { label: 'Negro',   grad: 'linear-gradient(135deg,#3a3a3a 0%,#0a0a0a 100%)', fg: '#fff', chip: '#d4af37' },
  gold:   { label: 'Dorado',  grad: 'linear-gradient(135deg,#e6c15a 0%,#9c7c22 100%)', fg: '#1a1400', chip: '#7a5f10' },
  blue:   { label: 'Azul',    grad: 'linear-gradient(135deg,#1e40af 0%,#0a1638 100%)', fg: '#fff', chip: '#c0c8e0' },
  green:  { label: 'Verde',   grad: 'linear-gradient(135deg,#047857 0%,#022c22 100%)', fg: '#fff', chip: '#cdead9' },
  purple: { label: 'Violeta', grad: 'linear-gradient(135deg,#6d28d9 0%,#2e1065 100%)', fg: '#fff', chip: '#e2d4ff' },
};
const DEFAULT_THEME = 'red';
const themeOf = (t) => THEMES[t] || THEMES[DEFAULT_THEME];

// Comprime una imagen del cliente a un data URL liviano (para guardar en la BD).
function compressImage(file, maxW = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function StampCard() {
  const { token: tokenParam } = useParams();
  const [card, setCard] = useState(null);
  const [token, setToken] = useState(tokenParam || null);
  const [loading, setLoading] = useState(!!tokenParam);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTheme, setEditTheme] = useState(DEFAULT_THEME);
  const [editPhoto, setEditPhoto] = useState(undefined); // undefined = sin cambio, null = quitar, string = nueva
  const [saving, setSaving] = useState(false);
  const [wallets, setWallets] = useState({ google: false, apple: false });
  const socketRef = useRef(null);

  const openEditor = () => {
    setEditName(card?.name || '');
    setEditTheme(card?.theme || DEFAULT_THEME);
    setEditPhoto(undefined);
    setEditing(true);
  };

  const saveCustomization = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const body = { name: editName, theme: editTheme };
      if (editPhoto !== undefined) body.bg_photo = editPhoto; // string nuevo o null para quitar
      const r = await fetch(`${API}/api/card/${token}/customize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (r.ok) { setCard(await r.json()); setEditing(false); }
      else { const d = await r.json().catch(() => ({})); alert(d.error || 'No se pudo guardar'); }
    } catch { alert('Error de conexión'); }
    finally { setSaving(false); }
  };

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setEditPhoto(await compressImage(file)); } catch { alert('No se pudo procesar la imagen'); }
  };

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

  // Qué wallets están disponibles (según las credenciales de ESTA tienda)
  useEffect(() => {
    if (!card?.token) return;
    let alive = true;
    fetch(`${API}/api/wallet/status?token=${encodeURIComponent(card.token)}`)
      .then(r => (r.ok ? r.json() : { google: false, apple: false }))
      .then(d => { if (alive) setWallets(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [card?.token]);

  // Socket: confirmación en vivo cuando la tarjeta se usa en el tótem/caja
  useEffect(() => {
    if (!token) return;
    const socket = io(SOCKET_URL);
    socketRef.current = socket;
    const join = () => socket.emit('join_card_room', token);
    socket.on('connect', join);
    socket.on('reconnect', join);
    socket.on('stamp_card_update', (data) => {
      setCard(prev => prev ? { ...prev, points: data.points ?? prev.points } : prev);
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
  const mpp = Number(cfg.money_per_point) || 0;
  const points = card.points || 0;
  const moneyValue = Math.round(points * mpp);
  const cardUrl = card.token ? `${API}/tarjeta/${card.token}` : (typeof window !== 'undefined' ? window.location.href : '');

  // Valores en vivo (para previsualizar mientras se personaliza)
  const theme = themeOf(editing ? editTheme : (card.theme || DEFAULT_THEME));
  const livePhoto = editing ? (editPhoto !== undefined ? editPhoto : card.bg_photo) : card.bg_photo;
  const liveName = (editing ? editName : card.name) || '';

  return (
    <Center>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* ══════════ Tarjeta (estilo bancario) ══════════ */}
        <div style={{
          position: 'relative', width: '100%', aspectRatio: '1.586', borderRadius: 18, overflow: 'hidden',
          background: livePhoto ? '#000' : theme.grad, color: theme.fg,
          boxShadow: '0 16px 44px rgba(0,0,0,0.30)', fontFamily: 'system-ui, sans-serif',
        }}>
          {livePhoto && <img src={livePhoto} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
          {livePhoto && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,0,0,0.55), rgba(0,0,0,0.35))' }} />}
          <div style={{ position: 'relative', zIndex: 1, height: '100%', padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: livePhoto ? '#fff' : theme.fg }}>
            {/* Emisor */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {card.store_logo && <img src={card.store_logo} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.4)' }} />}
                <span style={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.store_name || 'Tu tarjeta'}</span>
              </div>
              <span style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 800, opacity: 0.85 }}>Puntos</span>
            </div>

            {/* Chip + saldo */}
            <div>
              <div style={{ width: 42, height: 30, borderRadius: 6, background: theme.chip, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)', marginBottom: 10, backgroundImage: 'linear-gradient(90deg, rgba(0,0,0,0.12) 1px, transparent 1px), linear-gradient(rgba(0,0,0,0.12) 1px, transparent 1px)', backgroundSize: '10px 8px' }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{points.toLocaleString('es-CL')}</span>
                <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>pts</span>
                {mpp > 0 && <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>≈ ${moneyValue.toLocaleString('es-CL')}</span>}
              </div>
            </div>

            {/* Número (clave) */}
            <div style={{ fontSize: 19, letterSpacing: 4, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              ····&nbsp;&nbsp;{card.code}
            </div>

            {/* Titular + marca */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 8.5, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.7 }}>Titular</div>
                <div style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{liveName || 'Cliente'}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 8.5, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.7 }}>Tarjeta de puntos</div>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>SRSERVI</div>
              </div>
            </div>
          </div>
        </div>

        {!card.store_id && (
          <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 10 }}>Usa tu clave en la tienda para empezar a acumular puntos</div>
        )}

        {/* ══════════ Panel: personalizar o acciones ══════════ */}
        {editing ? (
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.10)', padding: 18, marginTop: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 12 }}>Personaliza tu tarjeta</div>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 6 }}>Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {Object.entries(THEMES).map(([key, t]) => (
                <button key={key} onClick={() => setEditTheme(key)} title={t.label}
                  style={{ width: 38, height: 38, borderRadius: 10, cursor: 'pointer', background: t.grad, border: editTheme === key ? '3px solid #111' : '2px solid #e5e7eb' }} />
              ))}
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 6 }}>Foto de fondo</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <label style={{ flex: 1, textAlign: 'center', padding: '10px', border: '1.5px dashed #d1d5db', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#555', background: '#fafafa' }}>
                📷 Subir foto
                <input type="file" accept="image/*" onChange={pickPhoto} style={{ display: 'none' }} />
              </label>
              {(editPhoto !== undefined ? editPhoto : card.bg_photo) && (
                <button onClick={() => setEditPhoto(null)} style={{ padding: '10px 14px', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#dc2626', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Quitar</button>
              )}
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 6 }}>Nombre en la tarjeta</label>
            <input value={editName} maxLength={40} onChange={e => setEditName(e.target.value)} placeholder="Tu nombre"
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(false)} disabled={saving} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: '#555', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={saveCustomization} disabled={saving} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: '#111', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        ) : (
          <>
            <button onClick={openEditor} style={{ width: '100%', marginTop: 16, padding: '13px', borderRadius: 14, border: '1.5px solid #e5e7eb', background: '#fff', color: '#111', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
              🎨 Personalizar mi tarjeta
            </button>

            {/* Añadir al teléfono (Google / Apple Wallet) */}
            {card.token && (wallets.google || wallets.apple) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {wallets.google && (
                  <a href={`${API}/api/card/${card.token}/google-wallet`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '13px', borderRadius: 14, background: '#000', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                    <span style={{ fontSize: 18 }}>🅶</span> Añadir a Google Wallet
                  </a>
                )}
                {wallets.apple && (
                  <a href={`${API}/api/card/${card.token}/apple-wallet`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '13px', borderRadius: 14, background: '#000', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                    <span style={{ fontSize: 18 }}></span> Añadir a Apple Wallet
                  </a>
                )}
              </div>
            )}

            {/* QR para guardar/compartir */}
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.08)', padding: 18, marginTop: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Muestra este código al pagar o guárdalo</div>
              <div style={{ display: 'inline-block', padding: 12, background: '#fff', border: '1px solid #eee', borderRadius: 14 }}>
                <QRCodeCanvas value={cardUrl} size={150} level="H" includeMargin={false} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de confirmación en vivo */}
      {confirm && (
        <div onClick={() => setConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 20, padding: '28px 24px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 52, marginBottom: 8 }}>
              {confirm.action === 'redeem' ? '✅' : '⭐'}
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#111' }}>
              {confirm.action === 'redeem'
                ? `¡Canjeaste ${confirm.points_used ?? ''} puntos!`
                : `¡Sumaste ${confirm.points_added ?? ''} puntos!`}
            </h2>
            <p style={{ margin: '0 0 4px', fontSize: 14, color: '#6b7280' }}>{confirm.store_name}</p>
            {confirm.points != null && (
              <div style={{ fontSize: 15, fontWeight: 700, color: '#D4AF37', margin: '6px 0' }}>Saldo: {confirm.points} puntos</div>
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
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#111' }}>Tu tarjeta de puntos</h1>
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
