import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API = 'https://srservi2.srautomatic.com';

// ─── Auth Modal ───────────────────────────────────────────────────────────────
function DeliveryAuthModal({ onAuth, onClose }) {
  const [step, setStep] = useState('email');
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
      setStep('code');
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px', width: '100%', maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111' }}>
            {step === 'email' ? 'Iniciar sesión' : 'Verificar código'}
          </h2>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#374151', fontSize: 16, cursor: 'pointer' }}>×</button>
        </div>

        {step === 'email' && (
          <>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>Ingresá tu email para recibir un código de verificación</p>
            <input
              type="email" autoFocus placeholder="tu@email.com" value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && sendCode()}
              style={{ width: '100%', padding: '13px', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, color: '#111', fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: error ? 8 : 16 }}
            />
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</p>}
            <button onClick={sendCode} disabled={loading} style={{ width: '100%', padding: '14px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 14px rgba(212,175,55,0.35)' }}>
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>
          </>
        )}

        {step === 'code' && (
          <>
            {needsProfile && (
              <>
                <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 12 }}>Completá tu perfil para hacer delivery</p>
                <input
                  type="text" placeholder="Nombre completo" value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, color: '#111', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
                />
                <input
                  type="tel" placeholder="Teléfono" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, color: '#111', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }}
                />
              </>
            )}
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 8 }}>Código enviado a <strong style={{ color: '#D4AF37' }}>{email}</strong></p>
            <input
              type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
              autoFocus={!needsProfile}
              style={{ width: '100%', padding: '14px', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, color: '#D4AF37', fontSize: 24, fontWeight: 900, letterSpacing: 10, textAlign: 'center', outline: 'none', boxSizing: 'border-box', marginBottom: error ? 8 : 16 }}
            />
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</p>}
            <button onClick={verify} disabled={loading} style={{ width: '100%', padding: '14px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', marginBottom: 10, boxShadow: '0 4px 14px rgba(212,175,55,0.35)' }}>
              {loading ? 'Verificando...' : 'Confirmar'}
            </button>
            <button onClick={() => { setStep('email'); setCode(''); setError(''); }} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#6b7280', border: 'none', fontSize: 13, cursor: 'pointer' }}>
              Cambiar email
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Product Detail Modal ─────────────────────────────────────────────────────
function ProductModal({ product, onAdd, onClose }) {
  const [qty, setQty] = useState(1);
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [selectedIngredients, setSelectedIngredients] = useState(
    (product.has_ingredients && product.ingredients?.length > 0)
      ? product.ingredients.map(i => i.id)
      : []
  );

  const extrasTotal = selectedExtras.reduce((sum, extraId) => {
    const extra = product.extras?.find(e => e.id === extraId);
    return sum + (extra?.price || 0);
  }, 0);

  const itemUnitPrice = product.price + extrasTotal;
  const itemTotal = itemUnitPrice * qty;
  const outOfStock = !product.unlimited_stock && product.stock === 0;

  const toggleExtra = (extraId) => {
    const max = product.max_extras || 0;
    setSelectedExtras(prev => {
      if (prev.includes(extraId)) return prev.filter(id => id !== extraId);
      if (max > 0 && prev.length >= max) return prev;
      return [...prev, extraId];
    });
  };

  const toggleIngredient = (ingredientId) => {
    setSelectedIngredients(prev =>
      prev.includes(ingredientId) ? prev.filter(id => id !== ingredientId) : [...prev, ingredientId]
    );
  };

  const handleAdd = () => {
    const allIngredients = product.ingredients || [];
    const removedIngredients = allIngredients.filter(i => !selectedIngredients.includes(i.id));
    onAdd({
      id: product.id,
      name: product.name,
      price: itemUnitPrice,
      qty,
      selectedIngredients: allIngredients.filter(i => selectedIngredients.includes(i.id)).map(i => ({ id: i.id, name: i.name })),
      removedIngredients: removedIngredients.map(i => ({ id: i.id, name: i.name })),
      selectedExtras: (product.extras || []).filter(e => selectedExtras.includes(e.id)).map(e => ({ id: e.id, name: e.name, price: e.price })),
    });
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 500, maxHeight: '92vh', overflowY: 'auto' }}>
        {product.image && (
          <div style={{ height: 220, overflow: 'hidden', borderRadius: '20px 20px 0 0', position: 'relative', flexShrink: 0 }}>
            <img
              src={product.image.startsWith('http') ? product.image : `${API}${product.image}`}
              alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        <div style={{ padding: '20px 20px 36px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 20, color: '#111', lineHeight: 1.2, marginBottom: 6 }}>{product.name}</div>
              {product.description && (
                <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5, marginBottom: 8 }}>{product.description}</div>
              )}
              <div style={{ fontSize: 18, fontWeight: 800, color: '#D4AF37' }}>${product.price.toFixed(0)}</div>
            </div>
            {!product.image && (
              <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#374151', fontSize: 18, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>×</button>
            )}
          </div>

          {product.image && (
            <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 34, height: 34, color: '#374151', fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', lineHeight: 1 }}>×</button>
          )}

          {/* Ingredients (complements — deselect to remove) */}
          {product.has_ingredients && product.ingredients?.length > 0 && (
            <div style={{ marginTop: 20, marginBottom: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 4 }}>Ingredientes</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>Destildá los que no querés incluir</div>
              {product.ingredients.map(ing => {
                const included = selectedIngredients.includes(ing.id);
                return (
                  <div
                    key={ing.id}
                    onClick={() => toggleIngredient(ing.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 14, color: included ? '#111' : '#9ca3af', textDecoration: included ? 'none' : 'line-through' }}>{ing.name}</span>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      background: included ? '#D4AF37' : '#f3f4f6',
                      border: included ? 'none' : '1.5px solid #d1d5db',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {included && <span style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Extras */}
          {product.has_extras && product.extras?.length > 0 && (
            <div style={{ marginTop: 20, marginBottom: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 4 }}>Extras</div>
              {product.max_extras > 0 && (
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>Elegí hasta {product.max_extras} · {selectedExtras.length}/{product.max_extras}</div>
              )}
              {product.extras.map(extra => {
                const isSelected = selectedExtras.includes(extra.id);
                const maxReached = product.max_extras > 0 && selectedExtras.length >= product.max_extras;
                const disabled = !isSelected && maxReached;
                return (
                  <div
                    key={extra.id}
                    onClick={() => !disabled && toggleExtra(extra.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #f3f4f6', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 }}
                  >
                    <div>
                      <div style={{ fontSize: 14, color: '#111', fontWeight: isSelected ? 700 : 400 }}>{extra.name}</div>
                      {extra.price > 0 && <div style={{ fontSize: 12, color: '#D4AF37', fontWeight: 600, marginTop: 1 }}>+${extra.price.toFixed(0)}</div>}
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
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 24 }}>
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
          <span style={{ fontSize: 15, fontWeight: 800, color: '#D4AF37' }}>${product.price.toFixed(0)}</span>
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
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [payStep, setPayStep] = useState('address');
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
  const cartItemCount = cart.reduce((s, i) => s + i.qty, 0);

  const addToCart = (item) => {
    const key = `${item.id}_${JSON.stringify(item.selectedExtras?.map(e => e.id).sort())}`;
    setCart(prev => {
      const existing = prev.find(i => i.cartKey === key);
      if (existing) return prev.map(i => i.cartKey === key ? { ...i, qty: i.qty + item.qty } : i);
      return [...prev, { ...item, cartKey: key }];
    });
  };

  const handleCheckout = () => {
    if (!customer) { setShowAuth(true); return; }
    setShowCheckout(true);
  };

  const handleAuth = (c, t) => {
    setCustomer(c);
    localStorage.setItem('deliveryToken', t);
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
          items: cart.map(i => ({
            product_id: i.id,
            quantity: i.qty,
            unit_price: i.price,
            selected_ingredients: i.selectedIngredients || [],
            selected_extras: i.selectedExtras || []
          })),
          delivery: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear pedido');
      setPayStep('success');
      setCart([]);
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
              <div style={{ fontSize: 12, color: '#D4AF37', fontWeight: 700, flexShrink: 0 }}>👤 {customer.name?.split(' ')[0]}</div>
            ) : (
              <button onClick={() => setShowAuth(true)} style={{ background: '#fdf9ed', border: '1.5px solid #D4AF37', borderRadius: 8, color: '#D4AF37', padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
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
                  {item.removedIngredients?.length > 0 && (
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                      Sin: {item.removedIngredients.map(i => i.name).join(', ')}
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

            {/* Address */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Dirección de entrega *</label>
              <input
                type="text" placeholder="Ej: Av. Siempre Viva 742, piso 3"
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                style={{ width: '100%', padding: '13px', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 10, color: '#111', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Customer info */}
            <div style={{ background: '#fdf9ed', border: '1px solid #f5e8a8', borderRadius: 10, padding: '12px 16px', marginBottom: 14, fontSize: 13, color: '#374151' }}>
              <div style={{ marginBottom: 3 }}>👤 {customer?.name}</div>
              <div style={{ marginBottom: 3 }}>📞 {customer?.phone}</div>
              <div>📧 {customer?.email}</div>
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#15803d', fontWeight: 600 }}>
              💵 Pago contra entrega en efectivo
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
              <div style={{ fontSize: 26, fontWeight: 900, color: '#D4AF37' }}>~{deliverySettings?.estimated_minutes || 45} min</div>
            </div>
            <button
              onClick={() => { setPayStep('address'); setShowCheckout(false); navigate('/delivery'); }}
              style={{ background: '#D4AF37', color: '#000', border: 'none', borderRadius: 12, padding: '14px 36px', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 14px rgba(212,175,55,0.4)' }}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
