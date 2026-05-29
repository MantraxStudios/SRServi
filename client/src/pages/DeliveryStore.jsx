import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API = 'https://srservi2.srautomatic.com';

// ─── Auth Modal ───────────────────────────────────────────────────────────────
const inp = { width: '100%', padding: '12px 14px', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, color: '#111', fontSize: 14, outline: 'none', boxSizing: 'border-box' };

function DeliveryAuthModal({ onAuth, onClose }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [step, setStep] = useState('form'); // 'form' | 'verify'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = (newTab) => { setTab(newTab); setStep('form'); setError(''); setCode(''); };

  const handleLogin = async () => {
    if (!email.includes('@') || !password) { setError('Completa todos los campos'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/api/delivery/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      localStorage.setItem('deliveryToken', d.token);
      localStorage.setItem('deliveryCustomer', JSON.stringify(d.customer));
      onAuth(d.customer, d.token);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.includes('@') || !password || password.length < 6) {
      setError('Completa todos los campos. La contraseña debe tener al menos 6 caracteres.'); return;
    }
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/api/delivery/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, name: name.trim(), phone: phone.trim() })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setStep('verify');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleVerify = async () => {
    if (code.length !== 6) { setError('El código tiene 6 dígitos'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/api/delivery/auth/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim(), name: name.trim(), phone: phone.trim() })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      localStorage.setItem('deliveryToken', d.token);
      localStorage.setItem('deliveryCustomer', JSON.stringify(d.customer));
      onAuth(d.customer, d.token);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 22px 44px', width: '100%', maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 0, background: '#f3f4f6', borderRadius: 10, padding: 3 }}>
            {[['login', 'Ingresar'], ['register', 'Crear cuenta']].map(([t, lbl]) => (
              <button key={t} onClick={() => reset(t)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#111' : '#6b7280', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>{lbl}</button>
            ))}
          </div>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 32, height: 32, fontSize: 16, cursor: 'pointer' }}>×</button>
        </div>

        {step === 'form' && tab === 'login' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="email" placeholder="tu@email.com" value={email} autoFocus onChange={e => { setEmail(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={inp} />
            <div style={{ position: 'relative' }}>
              <input type={showPwd ? 'text' : 'password'} placeholder="Contraseña" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ ...inp, paddingRight: 40 }} />
              <button onClick={() => setShowPwd(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>{showPwd ? '🙈' : '👁'}</button>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>{error}</p>}
            <button onClick={handleLogin} disabled={loading} style={{ padding: '14px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', marginTop: 4, boxShadow: '0 4px 14px rgba(212,175,55,0.35)' }}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', margin: 0 }}>¿Primera vez? <button onClick={() => reset('register')} style={{ background: 'none', border: 'none', color: '#D4AF37', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Crear cuenta</button></p>
          </div>
        )}

        {step === 'form' && tab === 'register' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="text" placeholder="Nombre completo *" value={name} autoFocus onChange={e => { setName(e.target.value); setError(''); }} style={inp} />
            <input type="tel" placeholder="Teléfono" value={phone} onChange={e => { setPhone(e.target.value); setError(''); }} style={inp} />
            <input type="email" placeholder="Email *" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} style={inp} />
            <div style={{ position: 'relative' }}>
              <input type={showPwd ? 'text' : 'password'} placeholder="Contraseña * (mín. 6 caracteres)" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} style={{ ...inp, paddingRight: 40 }} />
              <button onClick={() => setShowPwd(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>{showPwd ? '🙈' : '👁'}</button>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>{error}</p>}
            <button onClick={handleRegister} disabled={loading} style={{ padding: '14px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', marginTop: 4, boxShadow: '0 4px 14px rgba(212,175,55,0.35)' }}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </div>
        )}

        {step === 'verify' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Código enviado a <strong style={{ color: '#D4AF37' }}>{email}</strong></p>
            <input type="text" inputMode="numeric" maxLength={6} placeholder="000000" autoFocus value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
              style={{ ...inp, fontSize: 28, fontWeight: 900, letterSpacing: 12, textAlign: 'center', color: '#D4AF37', padding: '16px' }} />
            {error && <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>{error}</p>}
            <button onClick={handleVerify} disabled={loading} style={{ padding: '14px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 14px rgba(212,175,55,0.35)' }}>
              {loading ? 'Verificando...' : 'Verificar código'}
            </button>
            <button onClick={() => { setStep('form'); setCode(''); setError(''); }} style={{ padding: '10px', background: 'transparent', color: '#9ca3af', border: 'none', fontSize: 13, cursor: 'pointer' }}>← Volver</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Product Detail Modal ─────────────────────────────────────────────────────
function ProductModal({ product, onAdd, onClose }) {
  const [qty, setQty] = useState(1);
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [selectedIngredients, setSelectedIngredients] = useState([]);

  const extras = Array.isArray(product.extras) ? product.extras : [];
  const ingredients = Array.isArray(product.ingredients) ? product.ingredients : [];

  const extrasTotal = selectedExtras.reduce((sum, extraId) => {
    const extra = extras.find(e => e.id === extraId);
    return sum + (Number(extra?.price) || 0);
  }, 0);

  const itemUnitPrice = Number(product.price) + extrasTotal;
  const itemTotal = itemUnitPrice * qty;
  const outOfStock = !product.unlimited_stock && product.stock === 0;
  const maxExtras = product.max_extras || 0;

  const toggleExtra = (extraId) => {
    setSelectedExtras(prev => {
      if (prev.includes(extraId)) return prev.filter(id => id !== extraId);
      if (maxExtras > 0 && prev.length >= maxExtras) return prev;
      return [...prev, extraId];
    });
  };

  const toggleIngredient = (ingredientId) => {
    setSelectedIngredients(prev =>
      prev.includes(ingredientId) ? prev.filter(id => id !== ingredientId) : [...prev, ingredientId]
    );
  };

  const handleAdd = () => {
    onAdd({
      id: product.id,
      name: product.name,
      price: itemUnitPrice,
      qty,
      selectedIngredients: ingredients.filter(i => selectedIngredients.includes(i.id)).map(i => ({ id: i.id, name: i.name })),
      selectedExtras: extras.filter(e => selectedExtras.includes(e.id)).map(e => ({ id: e.id, name: e.name, price: Number(e.price) })),
    });
    onClose();
  };

  const imgSrc = product.image ? (product.image.startsWith('http') ? product.image : `${API}${product.image}`) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 500, maxHeight: '92vh', overflowY: 'auto', position: 'relative' }}>

        {/* Close button — always top-right inside the modal */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, background: imgSrc ? 'rgba(255,255,255,0.92)' : '#f3f4f6', border: 'none', borderRadius: '50%', width: 34, height: 34, color: '#374151', fontSize: 18, cursor: 'pointer', boxShadow: imgSrc ? '0 2px 8px rgba(0,0,0,0.15)' : 'none', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >×</button>

        {imgSrc && (
          <div style={{ height: 220, overflow: 'hidden', borderRadius: '20px 20px 0 0', flexShrink: 0 }}>
            <img src={imgSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        <div style={{ padding: '20px 20px 36px' }}>
          <div style={{ marginBottom: 16, paddingRight: imgSrc ? 0 : 40 }}>
            <div style={{ fontWeight: 800, fontSize: 20, color: '#111', lineHeight: 1.2, marginBottom: 6 }}>{product.name}</div>
            {product.description && (
              <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5, marginBottom: 8 }}>{product.description}</div>
            )}
            <div style={{ fontSize: 18, fontWeight: 800, color: '#D4AF37' }}>${Number(product.price).toFixed(0)}</div>
          </div>

          {/* Ingredients — positive selection */}
          {product.has_ingredients && ingredients.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 4 }}>Ingredientes</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>Seleccioná los que querés agregar</div>
              {ingredients.map(ing => {
                const selected = selectedIngredients.includes(ing.id);
                return (
                  <div
                    key={ing.id}
                    onClick={() => toggleIngredient(ing.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 14, color: '#111' }}>{ing.name}</span>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      background: selected ? '#D4AF37' : '#f3f4f6',
                      border: selected ? 'none' : '1.5px solid #d1d5db',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {selected && <span style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Extras */}
          {product.has_extras && extras.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 4 }}>Extras</div>
              {maxExtras > 0 && (
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>
                  Elegí hasta {maxExtras} · {selectedExtras.length}/{maxExtras}
                </div>
              )}
              {extras.map(extra => {
                const isSelected = selectedExtras.includes(extra.id);
                const maxReached = maxExtras > 0 && selectedExtras.length >= maxExtras;
                const disabled = !isSelected && maxReached;
                return (
                  <div
                    key={extra.id}
                    onClick={() => !disabled && toggleExtra(extra.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #f3f4f6', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 }}
                  >
                    <div>
                      <div style={{ fontSize: 14, color: '#111', fontWeight: isSelected ? 700 : 400 }}>{extra.name}</div>
                      {Number(extra.price) > 0 && <div style={{ fontSize: 12, color: '#D4AF37', fontWeight: 600, marginTop: 1 }}>+${Number(extra.price).toFixed(0)}</div>}
                    </div>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: isSelected ? '#D4AF37' : '#f3f4f6',
                      border: isSelected ? 'none' : '1.5px solid #d1d5db',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {isSelected && <span style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Qty + Add */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#f3f4f6', borderRadius: 12, padding: '8px 16px', flexShrink: 0 }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#374151', fontWeight: 700, lineHeight: 1, padding: 0 }}>−</button>
              <span style={{ fontWeight: 800, fontSize: 16, minWidth: 24, textAlign: 'center' }}>{qty}</span>
              <button onClick={() => setQty(q => q + 1)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#374151', fontWeight: 700, lineHeight: 1, padding: 0 }}>+</button>
            </div>
            <button
              onClick={handleAdd}
              disabled={outOfStock}
              style={{
                flex: 1, padding: '14px 16px',
                background: outOfStock ? '#d1d5db' : '#D4AF37',
                color: outOfStock ? '#9ca3af' : '#000',
                border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15,
                cursor: outOfStock ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: outOfStock ? 'none' : '0 4px 14px rgba(212,175,55,0.4)'
              }}
            >
              <span>{outOfStock ? 'Sin stock' : 'Agregar'}</span>
              {!outOfStock && <span>${itemTotal.toFixed(0)}</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product, cart, onSelect }) {
  const cartQty = cart.filter(i => i.id === product.id).reduce((s, i) => s + i.qty, 0);
  const outOfStock = !product.unlimited_stock && product.stock === 0;

  return (
    <div
      onClick={() => !outOfStock && onSelect()}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: '#fff', borderRadius: 14, padding: '14px 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0',
        cursor: outOfStock ? 'default' : 'pointer', opacity: outOfStock ? 0.5 : 1,
        transition: 'box-shadow 0.15s'
      }}
      onMouseEnter={e => { if (!outOfStock) e.currentTarget.style.boxShadow = '0 3px 14px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 4, lineHeight: 1.2 }}>{product.name}</div>
        {product.description && (
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {product.description}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#D4AF37' }}>${Number(product.price).toFixed(0)}</span>
          {outOfStock && <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, background: '#fef2f2', padding: '2px 8px', borderRadius: 20 }}>Sin stock</span>}
        </div>
      </div>

      <div style={{ position: 'relative', flexShrink: 0 }}>
        {product.image ? (
          <img
            src={product.image.startsWith('http') ? product.image : `${API}${product.image}`}
            alt="" style={{ width: 86, height: 86, borderRadius: 10, objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: 86, height: 86, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🍽️</div>
        )}
        {cartQty > 0 && (
          <div style={{
            position: 'absolute', top: -6, right: -6,
            background: '#D4AF37', color: '#000',
            width: 22, height: 22, borderRadius: '50%',
            fontSize: 11, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(212,175,55,0.5)'
          }}>
            {cartQty}
          </div>
        )}
        {!outOfStock && cartQty === 0 && (
          <div style={{
            position: 'absolute', bottom: -6, right: -6,
            background: '#D4AF37', color: '#000',
            width: 26, height: 26, borderRadius: '50%',
            fontSize: 18, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(212,175,55,0.5)', lineHeight: 1
          }}>+</div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DeliveryStore() {
  const { code } = useParams();
  const navigate = useNavigate();

  // Detect return from Haulmer payment gateway
  const searchParams = new URLSearchParams(window.location.search);
  const haulmerRef = searchParams.get('ref');
  const haulmerResult = searchParams.get('x_result');

  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [deliverySettings, setDeliverySettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(() => {
    try { return JSON.parse(localStorage.getItem('deliveryCustomer') || 'null'); } catch { return null; }
  });

  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [payStep, setPayStep] = useState('address');
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerCoords, setCustomerCoords] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [calculatedFee, setCalculatedFee] = useState(null); // null = use default fee

  // Handle return from Haulmer after payment
  useEffect(() => {
    if (!haulmerRef || !haulmerRef.startsWith('SRSN-')) return;
    if (haulmerResult === 'completed') {
      // Confirm via our endpoint and show success
      const xParams = {};
      for (const [k, v] of searchParams.entries()) { if (k.startsWith('x_')) xParams[k] = v; }
      fetch(`${API}/api/haulmer/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(xParams)
      }).catch(() => {});
      setPayStep('success');
      // Clean URL
      window.history.replaceState({}, '', `/delivery/${code}`);
    } else {
      // Cancelled or failed — just clean URL
      window.history.replaceState({}, '', `/delivery/${code}`);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/public/${code}`),
      fetch(`${API}/api/public/delivery-settings/${code}`)
    ]).then(async ([storeRes, dsRes]) => {
      if (!storeRes.ok) throw new Error('Tienda no encontrada');
      const storeData = await storeRes.json();
      setStore(storeData.store || storeData);
      setProducts((storeData.products || []).filter((p, i, a) => a.findIndex(x => x.id === p.id) === i));
      setCategories(storeData.categories || []);
      if (dsRes.ok) {
        const ds = await dsRes.json();
        setDeliverySettings(ds);
        if (ds.payment_cash !== false) setPaymentMethod('cash');
        else if (ds.payment_card) setPaymentMethod('card');
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [code]);

  const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const detectGPS = () => {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(pos => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCustomerCoords(coords);
      if (deliverySettings?.fee_type === 'per_km' && deliverySettings?.lat && deliverySettings?.lng) {
        const km = haversineKm(deliverySettings.lat, deliverySettings.lng, coords.lat, coords.lng);
        const freeKm = Number(deliverySettings.free_km) || 0;
        const perKm = Number(deliverySettings.fee_per_km) || 0;
        const fee = Math.max(0, Math.round((Math.max(0, km - freeKm)) * perKm));
        setCalculatedFee(fee);
      }
      setGpsLoading(false);
    }, () => { alert('No se pudo obtener ubicación'); setGpsLoading(false); }, { enableHighAccuracy: true });
  };

  const distanceKm = customerCoords && deliverySettings?.lat && deliverySettings?.lng
    ? Math.round(haversineKm(deliverySettings.lat, deliverySettings.lng, customerCoords.lat, customerCoords.lng) * 10) / 10
    : null;

  const cartTotal = cart.reduce((s, i) => s + Number(i.price) * i.qty, 0);
  const deliveryFee = calculatedFee !== null ? calculatedFee : (Number(deliverySettings?.fee) || 0);
  const finalTotal = cartTotal + deliveryFee;
  const minOrder = Number(deliverySettings?.min_order) || 0;
  const cartItemCount = cart.reduce((s, i) => s + i.qty, 0);

  const addToCart = (item) => {
    const extraIds = (item.selectedExtras || []).map(e => e.id).sort((a, b) => a - b);
    const key = `${item.id}_${extraIds.join(',')}`;
    setCart(prev => {
      const existing = prev.find(i => i.cartKey === key);
      if (existing) return prev.map(i => i.cartKey === key ? { ...i, qty: i.qty + item.qty } : i);
      return [...prev, { ...item, cartKey: key }];
    });
  };

  const handleCheckout = () => {
    if (!customer) {
      setPendingCheckout(true);
      setShowAuth(true);
      return;
    }
    setShowCheckout(true);
  };

  const handleAuth = (c, t) => {
    setCustomer(c);
    localStorage.setItem('deliveryToken', t);
    setShowAuth(false);
    if (pendingCheckout) {
      setPendingCheckout(false);
      setShowCheckout(true);
    }
  };

  const placeOrder = async () => {
    if (!deliveryAddress.trim()) return;
    setPlacing(true);
    try {
      const orderBody = {
        store_id: store.id,
        order_type: 'delivery',
        payment_method: paymentMethod === 'card' ? 'card' : 'cash',
        source: 'delivery_app',
        delivery_address: deliveryAddress,
        delivery_fee: deliveryFee,
        delivery_customer_id: customer.id,
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_email: customer.email,
        total: finalTotal.toFixed(2),
        items: cart.map(i => ({
          product_id: i.id,
          quantity: i.qty,
          unit_price: i.price,
          selected_ingredients: i.selectedIngredients || [],
          selected_extras: i.selectedExtras || []
        })),
        delivery: true
      };

      const orderRes = await fetch(`${API}/api/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderBody)
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error || 'Error al crear pedido');

      if (paymentMethod === 'card') {
        // Haulmer online payment — redirect customer to payment gateway
        const hRes = await fetch(`${API}/api/haulmer/payment`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: store.id,
            order_id: order.id,
            amount: Math.round(finalTotal),
            description: `Delivery #${order.id}`,
            return_url: `/delivery/${code}`,
            customer_email: customer.email,
            customer_name: customer.name,
            customer_phone: customer.phone
          })
        });
        const hData = await hRes.json();
        if (!hData.success) throw new Error(hData.error || 'Error generando pago Haulmer');
        // Save cart so success screen works after redirect
        localStorage.setItem('deliveryLastEstimated', String(deliverySettings?.estimated_minutes || 45));
        window.location.href = hData.paymentUrl;
        return;
      }

      // Cash — go to tracking
      setPayStep('success');
      setCart([]);
      localStorage.setItem('deliveryLastOrderId', String(order.id));
    } catch (e) { alert(e.message); }
    finally { setPlacing(false); }
  };

  // Group by category
  const categoriesWithProducts = categories
    .map(cat => ({ ...cat, products: products.filter(p => String(p.category_id) === String(cat.id)) }))
    .filter(c => c.products.length > 0);
  const uncategorized = products.filter(p => !p.category_id || !categories.find(c => String(c.id) === String(p.category_id)));

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f7f8fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#9ca3af' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
          <p style={{ fontWeight: 600 }}>Cargando menú...</p>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div style={{ minHeight: '100vh', background: '#f7f8fa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontWeight: 700 }}>
        Restaurante no encontrado
      </div>
    );
  }

  const logoSrc = store.logo_url ? (store.logo_url.startsWith('http') ? store.logo_url : `${API}${store.logo_url}`) : null;

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fa', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", paddingBottom: cart.length > 0 ? 96 : 48 }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
            <button onClick={() => navigate('/delivery')} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, color: '#374151', padding: '8px 12px', cursor: 'pointer', fontSize: 15, fontWeight: 600, flexShrink: 0 }}>←</button>
            {logoSrc && <img src={logoSrc} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#111', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{store.name}</div>
              {deliverySettings && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                  Envío {deliverySettings.fee > 0 ? `$${deliverySettings.fee}` : 'gratis'} · ~{deliverySettings.estimated_minutes || 45} min
                </div>
              )}
            </div>
            {customer ? (
              <button onClick={() => navigate('/delivery/account')} style={{ background: '#fdf9ed', border: '1.5px solid #D4AF37', borderRadius: 8, color: '#D4AF37', padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                👤 {customer.name?.split(' ')[0]}
              </button>
            ) : (
              <button onClick={() => { setPendingCheckout(false); setShowAuth(true); }} style={{ background: '#fdf9ed', border: '1.5px solid #D4AF37', borderRadius: 8, color: '#D4AF37', padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                Ingresar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hero banner */}
      {logoSrc && (
        <div style={{ height: 180, overflow: 'hidden', background: '#f0f0f0' }}>
          <img src={logoSrc} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      {/* Info strip */}
      {deliverySettings && (
        <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ maxWidth: 700, margin: '0 auto', padding: '10px 20px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>🚚 {deliverySettings.fee > 0 ? `Envío $${deliverySettings.fee}` : 'Envío gratis'}</span>
            <span style={{ fontSize: 13, color: '#6b7280' }}>🕐 ~{deliverySettings.estimated_minutes || 45} min</span>
            {minOrder > 0 && <span style={{ fontSize: 13, color: '#6b7280' }}>🛒 Pedido mínimo ${minOrder}</span>}
          </div>
        </div>
      )}

      {/* Menu */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 20px 0' }}>
        {categoriesWithProducts.map(cat => (
          <div key={cat.id} style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#111', margin: '0 0 14px', paddingBottom: 10, borderBottom: '2px solid #f0f0f0', letterSpacing: -0.3 }}>
              {cat.name}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cat.products.map(p => (
                <ProductCard key={p.id} product={p} cart={cart} onSelect={() => setSelectedProduct(p)} />
              ))}
            </div>
          </div>
        ))}

        {uncategorized.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#111', margin: '0 0 14px', paddingBottom: 10, borderBottom: '2px solid #f0f0f0' }}>Otros</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {uncategorized.map(p => (
                <ProductCard key={p.id} product={p} cart={cart} onSelect={() => setSelectedProduct(p)} />
              ))}
            </div>
          </div>
        )}

        {products.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
            <p style={{ fontWeight: 600, color: '#374151' }}>No hay productos disponibles</p>
          </div>
        )}
      </div>

      {/* Floating cart button */}
      {cart.length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 28px', background: 'linear-gradient(to top, #f7f8fa 70%, transparent)', zIndex: 40 }}>
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <button
              onClick={handleCheckout}
              disabled={cartTotal < minOrder}
              style={{
                width: '100%', padding: '16px 20px', borderRadius: 14, border: 'none',
                background: cartTotal >= minOrder ? '#D4AF37' : '#d1d5db',
                color: cartTotal >= minOrder ? '#000' : '#9ca3af',
                fontWeight: 800, fontSize: 15, cursor: cartTotal >= minOrder ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: cartTotal >= minOrder ? '0 4px 18px rgba(212,175,55,0.45)' : 'none'
              }}
            >
              <span style={{ background: 'rgba(0,0,0,0.12)', borderRadius: 20, padding: '2px 10px', fontSize: 13 }}>{cartItemCount}</span>
              <span>{cartTotal < minOrder ? `Mínimo $${minOrder}` : 'Ver pedido'}</span>
              <span>${finalTotal.toFixed(0)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {selectedProduct && (
        <ProductModal product={selectedProduct} onAdd={addToCart} onClose={() => setSelectedProduct(null)} />
      )}

      {/* Auth Modal */}
      {showAuth && <DeliveryAuthModal onAuth={handleAuth} onClose={() => setShowAuth(false)} />}

      {/* Checkout Modal */}
      {showCheckout && payStep !== 'success' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111' }}>Confirmar pedido</h2>
              <button onClick={() => setShowCheckout(false)} style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#374151', fontSize: 16, cursor: 'pointer' }}>×</button>
            </div>

            {/* Items */}
            <div style={{ background: '#f9fafb', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
              {cart.map(item => (
                <div key={item.cartKey} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#111', fontWeight: 600 }}>
                    <span>{item.qty}× {item.name}</span>
                    <span>${(item.price * item.qty).toFixed(0)}</span>
                  </div>
                  {item.selectedExtras?.length > 0 && (
                    <div style={{ fontSize: 12, color: '#D4AF37', marginTop: 2, fontWeight: 500 }}>
                      + {item.selectedExtras.map(e => e.name).join(', ')}
                    </div>
                  )}
                  {item.selectedIngredients?.length > 0 && (
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                      {item.selectedIngredients.map(i => i.name).join(', ')}
                    </div>
                  )}
                </div>
              ))}
              <div style={{ paddingTop: 10, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
                  <span>Subtotal</span><span>${cartTotal.toFixed(0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                  <span>Envío</span><span>{deliveryFee > 0 ? `$${deliveryFee}` : 'Gratis'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, color: '#111' }}>
                  <span>Total</span><span>${finalTotal.toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* Address + GPS */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Dirección de entrega *</label>
              <input
                type="text" placeholder="Ej: Av. Siempre Viva 742, piso 3"
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                style={{ width: '100%', padding: '13px', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, color: '#111', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
              />
              <button onClick={detectGPS} disabled={gpsLoading} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: '#15803d', fontSize: 12, fontWeight: 600 }}>
                📍 {gpsLoading ? 'Detectando...' : customerCoords ? 'Actualizar ubicación GPS' : 'Detectar mi ubicación para calcular envío'}
              </button>
              {distanceKm !== null && (
                <div style={{ marginTop: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#92400e' }}>
                  📏 Tu distancia al local: <strong>{distanceKm} km</strong>
                  {deliverySettings?.fee_type === 'per_km' && <span> · Envío calculado: <strong>${deliveryFee}</strong></span>}
                </div>
              )}
            </div>

            {/* Customer info */}
            <div style={{ background: '#fdf9ed', border: '1px solid #f5e8a8', borderRadius: 10, padding: '12px 16px', marginBottom: 14, fontSize: 13, color: '#374151' }}>
              <div style={{ marginBottom: 3 }}>👤 {customer?.name}</div>
              <div style={{ marginBottom: 3 }}>📞 {customer?.phone}</div>
              <div>📧 {customer?.email}</div>
            </div>

            {/* Payment method */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Método de pago al recibir</label>
              {deliverySettings?.payment_cash !== false && deliverySettings?.payment_card ? (
                // Both methods available — show selector
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { value: 'cash', label: '💵 Efectivo', desc: 'Pagás al recibir' },
                    { value: 'card', label: '💳 Tarjeta (Tuu)', desc: 'El repartidor cobra con terminal' }
                  ].map(opt => (
                    <div
                      key={opt.value}
                      onClick={() => setPaymentMethod(opt.value)}
                      style={{
                        flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer',
                        border: paymentMethod === opt.value ? '2px solid #D4AF37' : '1px solid #e5e7eb',
                        background: paymentMethod === opt.value ? 'rgba(212,175,55,0.06)' : '#f9fafb'
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#111', marginBottom: 2 }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{opt.desc}</div>
                    </div>
                  ))}
                </div>
              ) : deliverySettings?.payment_card && deliverySettings?.payment_cash === false ? (
                // Only card
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#0369a1', fontWeight: 600 }}>
                  💳 Tarjeta con terminal Tuu (contra entrega)
                </div>
              ) : (
                // Only cash (default)
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                  💵 Efectivo contra entrega
                </div>
              )}
            </div>

            <button
              onClick={placeOrder}
              disabled={!deliveryAddress.trim() || placing}
              style={{
                width: '100%', padding: '15px',
                background: !deliveryAddress.trim() || placing ? '#d1d5db' : '#D4AF37',
                color: !deliveryAddress.trim() || placing ? '#9ca3af' : '#000',
                border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15,
                cursor: !deliveryAddress.trim() || placing ? 'not-allowed' : 'pointer',
                boxShadow: deliveryAddress.trim() && !placing ? '0 4px 14px rgba(212,175,55,0.4)' : 'none'
              }}
            >
              {placing ? 'Enviando pedido...' : 'Confirmar pedido'}
            </button>
          </div>
        </div>
      )}

      {/* Success screen */}
      {payStep === 'success' && (
        <div style={{ position: 'fixed', inset: 0, background: '#f7f8fa', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <div style={{ width: 90, height: 90, background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 44, border: '2px solid #bbf7d0' }}>🎉</div>
            <h2 style={{ color: '#15803d', fontSize: 24, fontWeight: 900, margin: '0 0 10px' }}>¡Pedido enviado!</h2>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
              Tu pedido fue enviado al restaurante. En breve te confirmarán y comenzarán a prepararlo.
            </p>
            <div style={{ background: '#fff', borderRadius: 14, padding: '16px 24px', marginBottom: 28, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', border: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Tiempo estimado de entrega</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#D4AF37' }}>~{deliverySettings?.estimated_minutes || parseInt(localStorage.getItem('deliveryLastEstimated') || '45')} min</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {localStorage.getItem('deliveryLastOrderId') && (
                <button
                  onClick={() => navigate(`/delivery/track/${localStorage.getItem('deliveryLastOrderId')}`)}
                  style={{ background: '#D4AF37', color: '#000', border: 'none', borderRadius: 12, padding: '14px 36px', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 14px rgba(212,175,55,0.4)' }}
                >
                  📍 Seguir mi pedido
                </button>
              )}
              <button
                onClick={() => { setPayStep('address'); setShowCheckout(false); navigate('/delivery'); }}
                style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
