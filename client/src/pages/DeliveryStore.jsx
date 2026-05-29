import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API = 'https://srservi2.srautomatic.com';

// ─── Auth Modal ───────────────────────────────────────────────────────────────
function DeliveryAuthModal({ onAuth, onClose }) {
  const [step, setStep] = useState('email'); // email | code | profile
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [needsProfile, setNeedsProfile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendCode = async () => {
    if (!email.trim() || !email.includes('@')) { setError('Email inválido'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/delivery/auth/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setNeedsProfile(data.needsProfile);
      setStep(data.needsProfile ? 'profile' : 'code');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const verify = async () => {
    if (code.length !== 6) { setError('El código tiene 6 dígitos'); return; }
    if (needsProfile && (!name.trim() || !phone.trim())) { setError('Nombre y teléfono requeridos'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/delivery/auth/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim(), name: name.trim() || undefined, phone: phone.trim() || undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      localStorage.setItem('deliveryToken', data.token);
      localStorage.setItem('deliveryCustomer', JSON.stringify(data.customer));
      onAuth(data.customer, data.token);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#111', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px', width: '100%', maxWidth: 480, border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>
            {step === 'email' ? 'Iniciar sesión' : step === 'profile' ? 'Tu perfil' : 'Verificar código'}
          </h2>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {step === 'email' && (
          <>
            <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 20 }}>Ingresa tu email para recibir un código de verificación</p>
            <input
              type="email" autoFocus placeholder="tu@email.com" value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && sendCode()}
              style={{ width: '100%', padding: '14px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: error ? 8 : 16 }}
            />
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</p>}
            <button onClick={sendCode} disabled={loading} style={{ width: '100%', padding: '14px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>
          </>
        )}

        {(step === 'profile' || step === 'code') && (
          <>
            {needsProfile && (
              <>
                <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 16 }}>Completa tu perfil para hacer delivery</p>
                <input
                  type="text" placeholder="Nombre completo" value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
                />
                <input
                  type="tel" placeholder="Teléfono" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }}
                />
              </>
            )}
            <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 8 }}>Ingresa el código de 6 dígitos enviado a <strong style={{ color: '#D4AF37' }}>{email}</strong></p>
            <input
              type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
              autoFocus={!needsProfile}
              style={{ width: '100%', padding: '14px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#D4AF37', fontSize: 22, fontWeight: 900, letterSpacing: 8, textAlign: 'center', outline: 'none', boxSizing: 'border-box', marginBottom: error ? 8 : 16 }}
            />
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</p>}
            <button onClick={verify} disabled={loading} style={{ width: '100%', padding: '14px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', marginBottom: 10 }}>
              {loading ? 'Verificando...' : 'Confirmar'}
            </button>
            <button onClick={() => { setStep('email'); setCode(''); setError(''); }} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#9ca3af', border: 'none', fontSize: 13, cursor: 'pointer' }}>
              Cambiar email
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Delivery Store Page ──────────────────────────────────────────────────────
export default function DeliveryStore() {
  const { code } = useParams();
  const navigate = useNavigate();

  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [deliverySettings, setDeliverySettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(() => {
    try { return JSON.parse(localStorage.getItem('deliveryCustomer') || 'null'); } catch { return null; }
  });
  const [deliveryToken, setDeliveryToken] = useState(() => localStorage.getItem('deliveryToken') || '');

  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAuth, setShowAuth] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [payStep, setPayStep] = useState('address'); // address | payment | success
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [placing, setPlacing] = useState(false);

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
      if (dsRes.ok) setDeliverySettings(await dsRes.json());
    }).catch(() => {}).finally(() => setLoading(false));
  }, [code]);

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const deliveryFee = deliverySettings?.fee || 0;
  const finalTotal = cartTotal + deliveryFee;
  const minOrder = deliverySettings?.min_order || 0;

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      if (item.qty === 1) return prev.filter(i => i.id !== id);
      return prev.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i);
    });
  };

  const handleCheckout = () => {
    if (!customer) { setShowAuth(true); return; }
    setShowCheckout(true);
  };

  const handleAuth = (c, t) => {
    setCustomer(c);
    setDeliveryToken(t);
    setShowAuth(false);
    setShowCheckout(true);
  };

  const placeOrder = async () => {
    if (!deliveryAddress.trim()) return;
    setPlacing(true);
    try {
      const res = await fetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: store.id,
          order_type: 'delivery',
          payment_method: 'cash',
          source: 'delivery_app',
          delivery_address: deliveryAddress,
          delivery_customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone,
          customer_email: customer.email,
          total: finalTotal.toFixed(2),
          items: cart.map(i => ({ product_id: i.id, quantity: i.qty, unit_price: i.price, selected_ingredients: [], selected_extras: [] })),
          delivery: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear pedido');
      setOrderSuccess(data);
      setPayStep('success');
      setCart([]);
    } catch (e) { alert(e.message); }
    finally { setPlacing(false); }
  };

  const filteredProducts = products.filter(p =>
    activeCategory === 'all' || String(p.category_id) === String(activeCategory)
  );

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
          Cargando menú...
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
        Restaurante no encontrado
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: cart.length > 0 ? 90 : 0 }}>
      {/* Header */}
      <div style={{
        background: '#111', borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 50
      }}>
        <button onClick={() => navigate('/delivery')} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, color: '#fff', padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>
          ←
        </button>
        {store.logo_url && <img src={store.logo_url.startsWith('http') ? store.logo_url : `${API}${store.logo_url}`} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{store.name}</div>
          {deliverySettings && (
            <div style={{ fontSize: 11, color: '#9ca3af' }}>
              🚚 Envío {deliverySettings.fee > 0 ? `$${deliverySettings.fee}` : 'gratis'} · ~{deliverySettings.estimated_minutes || 45} min
            </div>
          )}
        </div>
        {customer ? (
          <div style={{ fontSize: 12, color: '#D4AF37', textAlign: 'right', flexShrink: 0 }}>
            👤 {customer.name?.split(' ')[0]}
          </div>
        ) : (
          <button onClick={() => setShowAuth(true)} style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 8, color: '#D4AF37', padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            Ingresar
          </button>
        )}
      </div>

      {/* Categories */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.06)', scrollbarWidth: 'none' }}>
        {[{ id: 'all', name: 'Todos' }, ...categories].map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(String(cat.id))}
            style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              border: String(activeCategory) === String(cat.id) ? 'none' : '1px solid rgba(255,255,255,0.12)',
              background: String(activeCategory) === String(cat.id) ? '#D4AF37' : 'rgba(255,255,255,0.05)',
              color: String(activeCategory) === String(cat.id) ? '#000' : '#fff'
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Products */}
      <div style={{ padding: '8px 0' }}>
        {filteredProducts.map(product => {
          const cartItem = cart.find(i => i.id === product.id);
          const outOfStock = !product.unlimited_stock && product.stock === 0;
          return (
            <div key={product.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
              opacity: outOfStock ? 0.4 : 1
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 4 }}>{product.name}</div>
                {product.description && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, lineHeight: 1.4 }}>{product.description}</div>}
                <div style={{ fontSize: 15, fontWeight: 800, color: '#D4AF37' }}>${product.price}</div>
              </div>
              {product.image && (
                <img src={product.image.startsWith('http') ? product.image : `${API}${product.image}`} alt="" style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div style={{ flexShrink: 0 }}>
                {cartItem ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => removeFromCart(product.id)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: 'none', color: '#ef4444', fontSize: 16, cursor: 'pointer' }}>−</button>
                    <span style={{ fontWeight: 700, color: '#fff', minWidth: 20, textAlign: 'center' }}>{cartItem.qty}</span>
                    <button onClick={() => addToCart(product)} style={{ width: 32, height: 32, borderRadius: '50%', background: '#D4AF37', border: 'none', color: '#000', fontSize: 16, cursor: 'pointer', fontWeight: 900 }}>+</button>
                  </div>
                ) : (
                  <button
                    onClick={() => !outOfStock && addToCart(product)}
                    disabled={outOfStock}
                    style={{ width: 36, height: 36, borderRadius: '50%', background: '#D4AF37', border: 'none', color: '#000', fontSize: 22, cursor: outOfStock ? 'not-allowed' : 'pointer', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >+</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating cart bar */}
      {cart.length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 24px', background: 'linear-gradient(to top, #0a0a0a, transparent)', zIndex: 40 }}>
          <button
            onClick={handleCheckout}
            disabled={cartTotal < minOrder}
            style={{
              width: '100%', padding: '16px', borderRadius: 14, border: 'none',
              background: cartTotal >= minOrder ? '#D4AF37' : '#374151',
              color: cartTotal >= minOrder ? '#000' : '#9ca3af',
              fontWeight: 800, fontSize: 15, cursor: cartTotal >= minOrder ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}
          >
            <span style={{ background: cartTotal >= minOrder ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)', borderRadius: 20, padding: '2px 10px', fontSize: 13 }}>
              {cart.reduce((s, i) => s + i.qty, 0)}
            </span>
            <span>{cartTotal < minOrder ? `Mínimo $${minOrder}` : 'Ver pedido'}</span>
            <span>${finalTotal.toFixed(0)}</span>
          </button>
        </div>
      )}

      {/* Auth Modal */}
      {showAuth && <DeliveryAuthModal onAuth={handleAuth} onClose={() => setShowAuth(false)} />}

      {/* Checkout Modal */}
      {showCheckout && payStep !== 'success' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#111', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>Confirmar pedido</h2>
              <button onClick={() => setShowCheckout(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', fontSize: 16, cursor: 'pointer' }}>×</button>
            </div>

            {/* Items summary */}
            <div style={{ marginBottom: 16 }}>
              {cart.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#d1d5db' }}>
                  <span>{item.qty}× {item.name}</span>
                  <span>${(item.price * item.qty).toFixed(0)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 8, paddingTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#9ca3af', marginBottom: 4 }}>
                  <span>Subtotal</span><span>${cartTotal.toFixed(0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>
                  <span>Envío</span><span>{deliveryFee > 0 ? `$${deliveryFee}` : 'Gratis'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: '#D4AF37' }}>
                  <span>Total</span><span>${finalTotal.toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* Delivery address */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#9ca3af', display: 'block', marginBottom: 6 }}>Dirección de entrega *</label>
              <input
                type="text" placeholder="Ej: Calle 123, piso 4, dpto B"
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                style={{ width: '100%', padding: '12px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Customer info */}
            <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#d1d5db' }}>
              <div>👤 {customer?.name}</div>
              <div>📞 {customer?.phone}</div>
              <div>📧 {customer?.email}</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#9ca3af' }}>
              💵 Pago contra entrega en efectivo
            </div>

            <button
              onClick={placeOrder}
              disabled={!deliveryAddress.trim() || placing}
              style={{
                width: '100%', padding: '15px', background: !deliveryAddress.trim() || placing ? '#374151' : '#D4AF37',
                color: !deliveryAddress.trim() || placing ? '#9ca3af' : '#000',
                border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15,
                cursor: !deliveryAddress.trim() || placing ? 'not-allowed' : 'pointer'
              }}
            >
              {placing ? 'Enviando pedido...' : 'Confirmar pedido'}
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {payStep === 'success' && (
        <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
            <h2 style={{ color: '#22c55e', fontSize: 24, fontWeight: 900, marginBottom: 8 }}>¡Pedido enviado!</h2>
            <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Tu pedido fue enviado al restaurante. En breve lo confirmarán y comenzarán a prepararlo.
            </p>
            <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '14px 20px', marginBottom: 24, border: '1px solid rgba(34,197,94,0.2)' }}>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>Tiempo estimado de entrega</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#D4AF37', marginTop: 4 }}>~{deliverySettings?.estimated_minutes || 45} min</div>
            </div>
            <button
              onClick={() => { setPayStep('address'); setShowCheckout(false); navigate('/delivery'); }}
              style={{ background: '#D4AF37', color: '#000', border: 'none', borderRadius: 12, padding: '14px 32px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
