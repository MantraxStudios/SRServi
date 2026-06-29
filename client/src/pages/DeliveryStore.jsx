import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API = 'https://srservi2.srautomatic.com';

// ── Auth Modal ────────────────────────────────────────────────────────────────
function DeliveryAuthModal({ onAuth, onClose }) {
  const [tab, setTab] = useState('login');
  const [step, setStep] = useState('form');
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

  const inp = {
    width: '100%', padding: '14px 16px',
    background: '#f9fafb', border: '1.5px solid #e5e7eb',
    borderRadius: 12, color: '#111', fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 500, boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 0' }}>
          <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 2 }} />
        </div>
        <div style={{ padding: '20px 22px 44px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, display: 'flex', background: '#f3f4f6', borderRadius: 12, padding: 4 }}>
              {[['login', 'Ingresar'], ['register', 'Crear cuenta']].map(([t, lbl]) => (
                <button key={t} onClick={() => reset(t)} style={{
                  flex: 1, padding: '9px', borderRadius: 9, border: 'none',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  background: tab === t ? '#fff' : 'transparent',
                  color: tab === t ? '#111' : '#9ca3af',
                  boxShadow: tab === t ? '0 1px 6px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s'
                }}>{lbl}</button>
              ))}
            </div>
            <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 18, cursor: 'pointer', color: '#6b7280', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>

          {step === 'form' && tab === 'login' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="email" placeholder="tu@email.com" value={email} autoFocus
                onChange={e => { setEmail(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} style={inp} />
              <div style={{ position: 'relative' }}>
                <input type={showPwd ? 'text' : 'password'} placeholder="Contraseña" value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  style={{ ...inp, paddingRight: 48 }} />
                <button onClick={() => setShowPwd(s => !s)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>
                  {showPwd ? '🙈' : '👁'}
                </button>
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 12, background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>{error}</div>}
              <button onClick={handleLogin} disabled={loading} style={{ padding: '15px', background: loading ? '#f3f4f6' : '#D4AF37', color: loading ? '#9ca3af' : '#000', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: loading ? 'default' : 'pointer', marginTop: 4, boxShadow: loading ? 'none' : '0 4px 16px rgba(212,175,55,0.4)' }}>
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
              <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', margin: '4px 0 0' }}>
                ¿Primera vez?{' '}
                <button onClick={() => reset('register')} style={{ background: 'none', border: 'none', color: '#D4AF37', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Crear cuenta</button>
              </p>
            </div>
          )}

          {step === 'form' && tab === 'register' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="text" placeholder="Nombre completo *" value={name} autoFocus onChange={e => { setName(e.target.value); setError(''); }} style={inp} />
              <input type="tel" placeholder="Teléfono" value={phone} onChange={e => { setPhone(e.target.value); setError(''); }} style={inp} />
              <input type="email" placeholder="Email *" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} style={inp} />
              <div style={{ position: 'relative' }}>
                <input type={showPwd ? 'text' : 'password'} placeholder="Contraseña * (mín. 6 caracteres)" value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }} style={{ ...inp, paddingRight: 48 }} />
                <button onClick={() => setShowPwd(s => !s)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>
                  {showPwd ? '🙈' : '👁'}
                </button>
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 12, background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>{error}</div>}
              <button onClick={handleRegister} disabled={loading} style={{ padding: '15px', background: loading ? '#f3f4f6' : '#D4AF37', color: loading ? '#9ca3af' : '#000', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: loading ? 'default' : 'pointer', marginTop: 4, boxShadow: loading ? 'none' : '0 4px 16px rgba(212,175,55,0.4)' }}>
                {loading ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </div>
          )}

          {step === 'verify' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#111' }}>Verificá tu email</h3>
                <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>Código enviado a <strong style={{ color: '#D4AF37' }}>{email}</strong></p>
              </div>
              <input type="text" inputMode="numeric" maxLength={6} placeholder="000000" autoFocus value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
                style={{ ...inp, fontSize: 32, fontWeight: 900, letterSpacing: 14, textAlign: 'center', color: '#D4AF37', padding: '18px' }} />
              {error && <div style={{ color: '#ef4444', fontSize: 12, background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>{error}</div>}
              <button onClick={handleVerify} disabled={loading} style={{ padding: '15px', background: loading ? '#f3f4f6' : '#D4AF37', color: loading ? '#9ca3af' : '#000', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: loading ? 'default' : 'pointer', boxShadow: loading ? 'none' : '0 4px 16px rgba(212,175,55,0.4)' }}>
                {loading ? 'Verificando...' : 'Confirmar código'}
              </button>
              <button onClick={() => { setStep('form'); setCode(''); setError(''); }} style={{ padding: '10px', background: 'transparent', color: '#9ca3af', border: 'none', fontSize: 13, cursor: 'pointer' }}>
                ← Volver
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Product Detail Modal ───────────────────────────────────────────────────────
function ProductModal({ product, comboName, complementsLabel, extrasLabel, onAdd, onClose }) {
  const [qty, setQty] = useState(product._comboQty || 1);
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [selectedIngredients, setSelectedIngredients] = useState(
    () => (product.ingredients || []).filter(i => i.included_by_default).map(i => i.id)
  );
  const [selectedComplements, setSelectedComplements] = useState([]);

  const extras = Array.isArray(product.extras) ? product.extras : [];
  const ingredients = Array.isArray(product.ingredients) ? product.ingredients : [];
  const complementGroups = Array.isArray(product.complement_groups) ? product.complement_groups : [];
  const maxIngredients = parseInt(product.max_ingredients) || 0;
  const maxExtras = parseInt(product.max_extras) || 0;

  // Build ordered list of steps from whatever the product actually has
  const steps = [];
  if (ingredients.length > 0) steps.push('ingredients');
  if (extras.length > 0) steps.push('extras');
  complementGroups.forEach((g, i) => steps.push('group_' + i));

  const [stepIdx, setStepIdx] = useState(0);
  const currentStep = steps[stepIdx] || null;
  const isLastStep = stepIdx >= steps.length - 1;
  const isFirstStep = stepIdx === 0;

  const extrasTotal = selectedExtras.reduce((sum, id) => {
    const e = extras.find(x => x.id === id);
    return sum + (Number(e?.price) || 0);
  }, 0);
  const complementsTotal = selectedComplements.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const ingredientsTotal = selectedIngredients.reduce((sum, id) => {
    const ing = ingredients.find(i => i.id === id);
    return sum + (ing && !ing.included_by_default ? (Number(ing.price) || 0) : 0);
  }, 0);
  const itemUnitPrice = Number(product.price) + extrasTotal + complementsTotal + ingredientsTotal;
  const itemTotal = itemUnitPrice * qty;
  const outOfStock = !product.unlimited_stock && product.stock === 0;

  const nonDefaultSelected = selectedIngredients.filter(id => {
    const ing = ingredients.find(i => i.id === id);
    return ing && !ing.included_by_default;
  }).length;
  const atMaxIng = maxIngredients > 0 && nonDefaultSelected >= maxIngredients;

  const toggleExtra = (extraId) => {
    setSelectedExtras(prev => {
      if (prev.includes(extraId)) return prev.filter(id => id !== extraId);
      if (maxExtras > 0 && prev.length >= maxExtras) return prev;
      return [...prev, extraId];
    });
  };

  const toggleIngredient = (ing) => {
    if (!ing.unlimited_stock && ing.stock === 0) return;
    setSelectedIngredients(prev => {
      if (prev.includes(ing.id)) return prev.filter(id => id !== ing.id);
      if (!ing.included_by_default && maxIngredients > 0) {
        const cur = prev.filter(id => { const i = ingredients.find(x => x.id === id); return i && !i.included_by_default; }).length;
        if (cur >= maxIngredients) return prev;
      }
      return [...prev, ing.id];
    });
  };

  const toggleComplementOption = (group, option) => {
    setSelectedComplements(prev => {
      const exists = prev.some(s => s.option_id === option.id);
      if (exists) return prev.filter(s => s.option_id !== option.id);
      const inGroup = prev.filter(s => s.group_id === group.id);
      if (group.max_select > 0 && inGroup.length >= group.max_select) {
        if (group.max_select === 1) {
          return [...prev.filter(s => s.group_id !== group.id), { group_id: group.id, group_name: group.name, option_id: option.id, name: option.name, price: Number(option.price) || 0 }];
        }
        return prev;
      }
      return [...prev, { group_id: group.id, group_name: group.name, option_id: option.id, name: option.name, price: Number(option.price) || 0 }];
    });
  };

  const handleNext = () => {
    // Validate current step if it's a group
    if (currentStep && currentStep.startsWith('group_')) {
      const gIdx = parseInt(currentStep.split('_')[1]);
      const g = complementGroups[gIdx];
      if (g) {
        const count = selectedComplements.filter(s => s.group_id === g.id).length;
        const min = g.required ? Math.max(1, g.min_select || 0) : (g.min_select || 0);
        if (count < min) {
          alert(`Elegí al menos ${min} en "${g.name}".`);
          return;
        }
      }
    }
    if (!isLastStep) {
      setStepIdx(stepIdx + 1);
    } else {
      // Final: validate ALL groups then add
      for (const g of complementGroups) {
        const count = selectedComplements.filter(s => s.group_id === g.id).length;
        const min = g.required ? Math.max(1, g.min_select || 0) : (g.min_select || 0);
        if (count < min) {
          alert(`Elegí al menos ${min} en "${g.name}".`);
          return;
        }
      }
      onAdd({
        id: product.id, name: product.name, price: itemUnitPrice, qty,
        comboName: comboName || null,
        selectedIngredients: ingredients.filter(i => selectedIngredients.includes(i.id)).map(i => ({ id: i.id, name: i.name })),
        selectedExtras: extras.filter(e => selectedExtras.includes(e.id)).map(e => ({ id: e.id, name: e.name, price: Number(e.price) })),
        selectedComplements,
      });
    }
  };

  const imgSrc = product.image ? (product.image.startsWith('http') ? product.image : `${API}${product.image}`) : null;
  const defaultIngs = ingredients.filter(i => i.included_by_default);
  const extraIngs = ingredients.filter(i => !i.included_by_default);

  // Step label for header
  const stepLabel = steps.length > 1 ? `Paso ${stepIdx + 1} de ${steps.length}` : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 500, maxHeight: '92vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 14, zIndex: 10,
          background: imgSrc ? 'rgba(255,255,255,0.95)' : '#f3f4f6',
          border: 'none', borderRadius: '50%', width: 36, height: 36,
          color: '#374151', fontSize: 18, cursor: 'pointer',
          boxShadow: imgSrc ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600
        }}>×</button>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {imgSrc ? (
            <div style={{ height: 220, overflow: 'hidden', borderRadius: '24px 24px 0 0', position: 'relative', flexShrink: 0 }}>
              <img src={imgSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 50%)' }} />
            </div>
          ) : (
            <div style={{ height: 24 }} />
          )}

          <div style={{ padding: '20px 20px 16px' }}>
            {/* Product info */}
            <div style={{ marginBottom: 14 }}>
              {comboName && (
                <div style={{ fontSize: 11, fontWeight: 700, color: '#D4AF37', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 20, padding: '3px 10px', display: 'inline-block', marginBottom: 8 }}>
                  Combo: {comboName}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#111', lineHeight: 1.2, flex: 1 }}>{product.name}</h2>
                <div style={{ fontSize: 19, fontWeight: 900, color: '#D4AF37', flexShrink: 0 }}>${Number(product.price).toFixed(0)}</div>
              </div>
              {product.description && (
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{product.description}</p>
              )}
            </div>

            {/* Step indicator */}
            {stepLabel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 3, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${((stepIdx + 1) / steps.length) * 100}%`, height: '100%', background: '#D4AF37', borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, flexShrink: 0 }}>{stepLabel}</span>
              </div>
            )}

            {/* ── STEP: Ingredients ── */}
            {currentStep === 'ingredients' && (
              <div>
                {defaultIngs.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ background: '#f9fafb', borderRadius: 10, padding: '9px 14px', marginBottom: 6, borderLeft: '3px solid #D4AF37' }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#111' }}>{complementsLabel} — incluidos</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Desmarcá los que no querés</div>
                    </div>
                    {defaultIngs.map(ing => {
                      const selected = selectedIngredients.includes(ing.id);
                      const oos = !ing.unlimited_stock && ing.stock === 0;
                      return (
                        <div key={ing.id} onClick={() => !oos && toggleIngredient(ing)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #f3f4f6', cursor: oos ? 'default' : 'pointer', opacity: oos ? 0.4 : 1 }}>
                          <span style={{ fontSize: 14, color: selected ? '#111' : '#9ca3af', fontWeight: selected ? 600 : 400, textDecoration: selected ? 'none' : 'line-through' }}>
                            {ing.name}{oos ? ' (agotado)' : ''}
                          </span>
                          <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, background: selected ? '#D4AF37' : '#f3f4f6', border: selected ? 'none' : '1.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                            {selected && <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>✓</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {extraIngs.length > 0 && (
                  <div>
                    <div style={{ background: '#f9fafb', borderRadius: 10, padding: '9px 14px', marginBottom: 6, borderLeft: '3px solid #D4AF37' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: '#111' }}>{complementsLabel} — adicionales</div>
                        {maxIngredients > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: atMaxIng ? '#D4AF37' : '#9ca3af' }}>{nonDefaultSelected}/{maxIngredients}</span>
                        )}
                      </div>
                      {maxIngredients > 0 && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Elegí hasta {maxIngredients}</div>}
                    </div>
                    {extraIngs.map(ing => {
                      const isSelected = selectedIngredients.includes(ing.id);
                      const oos = !ing.unlimited_stock && ing.stock === 0;
                      const disabled = oos || (!isSelected && atMaxIng);
                      return (
                        <div key={ing.id} onClick={() => !disabled && toggleIngredient(ing)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #f3f4f6', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 }}>
                          <div>
                            <div style={{ fontSize: 14, color: '#111', fontWeight: isSelected ? 700 : 400 }}>{ing.name}{oos ? ' (agotado)' : ''}</div>
                            {Number(ing.price) > 0 && <div style={{ fontSize: 12, color: '#D4AF37', fontWeight: 700, marginTop: 2 }}>+${Number(ing.price).toFixed(0)}</div>}
                          </div>
                          <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, background: isSelected ? '#D4AF37' : '#f3f4f6', border: isSelected ? 'none' : '1.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                            {isSelected && <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>✓</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── STEP: Extras ── */}
            {currentStep === 'extras' && (
              <div>
                <div style={{ background: '#f9fafb', borderRadius: 10, padding: '9px 14px', marginBottom: 6, borderLeft: '3px solid #D4AF37' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#111' }}>{extrasLabel}</div>
                    {maxExtras > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: selectedExtras.length >= maxExtras ? '#D4AF37' : '#9ca3af' }}>{selectedExtras.length}/{maxExtras}</span>
                    )}
                  </div>
                  {maxExtras > 0 && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Elegí hasta {maxExtras}</div>}
                </div>
                {extras.map(extra => {
                  const isSelected = selectedExtras.includes(extra.id);
                  const maxReached = maxExtras > 0 && selectedExtras.length >= maxExtras;
                  const disabled = !isSelected && maxReached;
                  return (
                    <div key={extra.id} onClick={() => !disabled && toggleExtra(extra.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #f3f4f6', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 }}>
                      <div>
                        <div style={{ fontSize: 14, color: '#111', fontWeight: isSelected ? 700 : 400 }}>{extra.name}</div>
                        {Number(extra.price) > 0 && <div style={{ fontSize: 12, color: '#D4AF37', fontWeight: 700, marginTop: 2 }}>+${Number(extra.price).toFixed(0)}</div>}
                      </div>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: isSelected ? '#D4AF37' : '#f3f4f6', border: isSelected ? 'none' : '1.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        {isSelected && <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── STEP: Each complement group gets its own step ── */}
            {currentStep && currentStep.startsWith('group_') && (() => {
              const gIdx = parseInt(currentStep.split('_')[1]);
              const group = complementGroups[gIdx];
              if (!group) return null;
              const selInGroup = selectedComplements.filter(s => s.group_id === group.id);
              const atMax = group.max_select > 0 && selInGroup.length >= group.max_select;
              const isRadio = group.max_select === 1;
              const subtitle = isRadio ? 'Elegí una opción'
                : group.max_select > 0 ? `Elegí hasta ${group.max_select}`
                : group.min_select > 0 ? `Elegí al menos ${group.min_select}`
                : 'Opcional';
              return (
                <div>
                  <div style={{ background: '#f9fafb', borderRadius: 10, padding: '9px 14px', marginBottom: 6, borderLeft: '3px solid #D4AF37' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color: '#111' }}>{group.name}</span>
                        {group.required && <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: '#ef4444', borderRadius: 20, padding: '1px 7px' }}>Obligatorio</span>}
                      </div>
                      {group.max_select > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: atMax ? '#D4AF37' : '#9ca3af' }}>{selInGroup.length}/{group.max_select}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{subtitle}</div>
                  </div>
                  {(group.options || []).map(opt => {
                    const isSelected = selInGroup.some(s => s.option_id === opt.id);
                    const oos = !opt.unlimited_stock && opt.stock === 0;
                    const disabled = oos || (!isSelected && atMax && !isRadio);
                    return (
                      <div key={opt.id} onClick={() => !disabled && toggleComplementOption(group, opt)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #f3f4f6', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 22, height: 22, borderRadius: isRadio ? '50%' : 6, flexShrink: 0, background: isSelected ? '#D4AF37' : '#f3f4f6', border: isSelected ? 'none' : '1.5px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                            {isSelected && <span style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>✓</span>}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, color: '#111', fontWeight: isSelected ? 700 : 400 }}>{opt.name}</div>
                            {oos && <div style={{ fontSize: 11, color: '#ef4444' }}>Agotado</div>}
                          </div>
                        </div>
                        {Number(opt.price) > 0 && <div style={{ fontSize: 13, color: '#D4AF37', fontWeight: 700 }}>+${Number(opt.price).toFixed(0)}</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '12px 20px 40px', borderTop: '1px solid #f3f4f6', background: '#fff', flexShrink: 0 }}>
          {!comboName && isLastStep && (
            <div style={{ display: 'flex', alignItems: 'center', background: '#f3f4f6', borderRadius: 14, overflow: 'hidden', marginBottom: 12, width: 'fit-content' }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ background: 'none', border: 'none', width: 44, height: 44, cursor: 'pointer', color: '#374151', fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
              <span style={{ fontWeight: 900, fontSize: 16, minWidth: 28, textAlign: 'center', color: '#111' }}>{qty}</span>
              <button onClick={() => setQty(q => q + 1)} style={{ background: 'none', border: 'none', width: 44, height: 44, cursor: 'pointer', color: '#374151', fontWeight: 800, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            {!isFirstStep && (
              <button onClick={() => setStepIdx(stepIdx - 1)} style={{ padding: '14px 18px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>← Volver</button>
            )}
            <button onClick={handleNext} disabled={outOfStock} style={{
              flex: 1, padding: '14px 16px',
              background: outOfStock ? '#e5e7eb' : '#D4AF37',
              color: outOfStock ? '#9ca3af' : '#000',
              border: 'none', borderRadius: 14, fontWeight: 800, fontSize: 15,
              cursor: outOfStock ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: outOfStock ? 'none' : '0 4px 16px rgba(212,175,55,0.4)'
            }}>
              <span>{outOfStock ? 'Sin stock' : isLastStep ? (comboName ? 'Continuar combo' : 'Agregar') : 'Siguiente →'}</span>
              {!outOfStock && isLastStep && <span style={{ fontWeight: 900 }}>${itemTotal.toFixed(0)}</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ product, cart, onSelect }) {
  const cartQty = cart.filter(i => i.id === product.id).reduce((s, i) => s + i.qty, 0);
  const outOfStock = !product.unlimited_stock && product.stock === 0;
  const imgSrc = product.image ? (product.image.startsWith('http') ? product.image : `${API}${product.image}`) : null;

  return (
    <div
      onClick={() => !outOfStock && onSelect()}
      style={{
        display: 'flex', alignItems: 'stretch',
        background: '#fff', borderRadius: 16,
        boxShadow: cartQty > 0 ? '0 4px 16px rgba(212,175,55,0.18)' : '0 2px 10px rgba(0,0,0,0.06)',
        border: cartQty > 0 ? '2px solid rgba(212,175,55,0.4)' : '1px solid rgba(0,0,0,0.07)',
        cursor: outOfStock ? 'default' : 'pointer',
        opacity: outOfStock ? 0.55 : 1,
        overflow: 'hidden',
        transition: 'all 0.15s'
      }}
    >
      <div style={{ flex: 1, padding: '14px 14px 14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 4, lineHeight: 1.25 }}>{product.name}</div>
          {product.description && (
            <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 6 }}>
              {product.description}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#D4AF37' }}>${Number(product.price).toFixed(0)}</span>
            {outOfStock && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, background: '#fef2f2', padding: '2px 8px', borderRadius: 20, border: '1px solid #fecaca' }}>Sin stock</span>}
          </div>
          {cartQty > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#C49B1E', background: 'rgba(212,175,55,0.1)', padding: '3px 10px', borderRadius: 20 }}>
              ×{cartQty} en carrito
            </span>
          )}
        </div>
      </div>

      <div style={{ position: 'relative', width: 96, flexShrink: 0 }}>
        {imgSrc ? (
          <img src={imgSrc} alt="" style={{ width: 96, height: '100%', minHeight: 88, objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: 96, height: '100%', minHeight: 88, background: 'linear-gradient(135deg, #f3f4f6, #e9eaec)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🍽️</div>
        )}
        {!outOfStock && cartQty === 0 && (
          <div style={{ position: 'absolute', bottom: 8, right: 8, background: '#D4AF37', color: '#000', width: 26, height: 26, borderRadius: '50%', fontSize: 18, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(212,175,55,0.5)', lineHeight: 1 }}>+</div>
        )}
        {cartQty > 0 && (
          <div style={{ position: 'absolute', top: 6, right: 6, background: '#D4AF37', color: '#000', width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(212,175,55,0.5)' }}>{cartQty}</div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DeliveryStore() {
  const { code } = useParams();
  const navigate = useNavigate();

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
  const [combos, setCombos] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const comboFlowRef = useRef({ name: null, queue: [] });
  const [showAuth, setShowAuth] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [payStep, setPayStep] = useState('address');
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [orderNotes, setOrderNotes] = useState('');
  const [customerCoords, setCustomerCoords] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [calculatedFee, setCalculatedFee] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);

  useEffect(() => {
    if (!haulmerRef || !haulmerRef.startsWith('SRSN-')) return;
    if (haulmerResult === 'completed') {
      const xParams = {};
      for (const [k, v] of searchParams.entries()) { if (k.startsWith('x_')) xParams[k] = v; }
      fetch(`${API}/api/haulmer/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(xParams)
      }).catch(() => {});
      setPayStep('success');
      window.history.replaceState({}, '', `/delivery/${code}`);
    } else {
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
      setCombos(Array.isArray(storeData.combos) ? storeData.combos : []);
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
    const compIds = (item.selectedComplements || []).map(s => s.option_id).sort((a, b) => a - b);
    const comboKey = item.comboName ? `_combo${Date.now()}` : '';
    const key = `${item.id}_${extraIds.join(',')}_${compIds.join(',')}${comboKey}`;
    setCart(prev => {
      if (item.comboName) return [...prev, { ...item, cartKey: key }];
      const existing = prev.find(i => i.cartKey === key);
      if (existing) return prev.map(i => i.cartKey === key ? { ...i, qty: i.qty + item.qty } : i);
      return [...prev, { ...item, cartKey: key }];
    });
  };

  const openProductForCombo = (product, quantity) => {
    const hasIngredients = (product.ingredients || []).length > 0;
    const hasExtras = (product.extras || []).length > 0;
    const hasGroups = Array.isArray(product.complement_groups) && product.complement_groups.length > 0;
    if (!hasIngredients && !hasExtras && !hasGroups) {
      addToCart({ id: product.id, name: product.name, price: Number(product.price), qty: quantity, comboName: comboFlowRef.current.name, selectedIngredients: [], selectedExtras: [], selectedComplements: [] });
      processNextComboItem();
    } else {
      setSelectedProduct({ ...product, _comboQty: quantity });
    }
  };

  const processNextComboItem = () => {
    const flow = comboFlowRef.current;
    if (flow.queue.length === 0) {
      flow.name = null;
      setSelectedProduct(null);
      return;
    }
    const next = flow.queue.shift();
    openProductForCombo(next.product, next.quantity);
  };

  const startCombo = (combo) => {
    const items = (combo.items || [])
      .map(ci => {
        const product = products.find(p => String(p.id) === String(ci.product_id));
        if (!product) return null;
        if (!product.unlimited_stock && product.stock === 0) return null;
        return { product, quantity: ci.quantity || 1 };
      })
      .filter(Boolean);
    if (items.length === 0) { alert('Este combo no tiene productos disponibles.'); return; }
    comboFlowRef.current = { name: combo.name, queue: items };
    processNextComboItem();
  };

  const handleCheckout = () => {
    if (!customer) { setPendingCheckout(true); setShowAuth(true); return; }
    setShowCheckout(true);
  };

  const handleAuth = (c, t) => {
    setCustomer(c);
    localStorage.setItem('deliveryToken', t);
    setShowAuth(false);
    if (pendingCheckout) { setPendingCheckout(false); setShowCheckout(true); }
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
          product_id: i.id, quantity: i.qty, unit_price: i.price,
          combo_name: i.comboName || null,
          selected_ingredients: i.selectedIngredients || [],
          selected_extras: i.selectedExtras || [],
          selected_complements: i.selectedComplements || []
        })),
        delivery: true,
        customer_comment: orderNotes.trim() || null
      };

      const orderRes = await fetch(`${API}/api/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderBody)
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error || 'Error al crear pedido');

      if (paymentMethod === 'card') {
        const hRes = await fetch(`${API}/api/haulmer/payment`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: store.id, order_id: order.id,
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
        localStorage.setItem('deliveryLastEstimated', String(deliverySettings?.estimated_minutes || 45));
        window.location.href = hData.paymentUrl;
        return;
      }

      setPayStep('success');
      setCart([]);
      localStorage.setItem('deliveryLastOrderId', String(order.id));
    } catch (e) { alert(e.message); }
    finally { setPlacing(false); }
  };

  const categoriesWithProducts = categories
    .map(cat => ({ ...cat, products: products.filter(p => String(p.category_id) === String(cat.id)) }))
    .filter(c => c.products.length > 0);
  const uncategorized = products.filter(p => !p.category_id || !categories.find(c => String(c.id) === String(p.category_id)));

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f4f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '3px solid #e5e7eb', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#9ca3af', fontWeight: 600, fontSize: 14, margin: 0 }}>Cargando menú...</p>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div style={{ minHeight: '100vh', background: '#f4f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🍽️</div>
          <div style={{ fontWeight: 700, color: '#374151', fontSize: 18 }}>Restaurante no encontrado</div>
        </div>
      </div>
    );
  }

  const logoSrc = store.logo_url ? (store.logo_url.startsWith('http') ? store.logo_url : `${API}${store.logo_url}`) : null;
  const hasCategoryBar = categoriesWithProducts.length > 1;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f6', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", paddingBottom: cart.length > 0 ? 100 : 48 }}>

      {/* ── Sticky Header ─────────────────────────────────────────────────────── */}
      <header style={{
        background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)'
      }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12, height: 58 }}>
          <button
            onClick={() => navigate('/delivery')}
            style={{ background: '#f3f4f6', border: 'none', borderRadius: 12, color: '#374151', width: 38, height: 38, cursor: 'pointer', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >←</button>

          {logoSrc && (
            <img src={logoSrc} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }} />
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#111', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{store.name}</div>
            {deliverySettings && (
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                🚚 {deliverySettings.fee > 0 ? `$${deliverySettings.fee}` : 'Gratis'} · ⏱ ~{deliverySettings.estimated_minutes || 45} min
              </div>
            )}
          </div>

          {customer ? (
            <button
              onClick={() => navigate('/delivery/account')}
              style={{ background: 'rgba(212,175,55,0.1)', border: '1.5px solid rgba(212,175,55,0.3)', borderRadius: 10, color: '#C49B1E', padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              👤 {customer.name?.split(' ')[0]}
            </button>
          ) : (
            <button
              onClick={() => { setPendingCheckout(false); setShowAuth(true); }}
              style={{ background: 'rgba(212,175,55,0.1)', border: '1.5px solid rgba(212,175,55,0.3)', borderRadius: 10, color: '#C49B1E', padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0 }}
            >Ingresar</button>
          )}
        </div>
      </header>

      {/* ── Store Info Bar ────────────────────────────────────────────────────── */}
      {deliverySettings && (
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ background: '#f3f4f6', color: '#374151', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>
            🚚 {deliverySettings.fee > 0 ? `Envío $${deliverySettings.fee}` : 'Envío gratis'}
          </span>
          <span style={{ background: '#f3f4f6', color: '#374151', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>
            ⏱ ~{deliverySettings.estimated_minutes || 45} min
          </span>
          {minOrder > 0 && (
            <span style={{ background: '#f3f4f6', color: '#374151', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>
              🛒 Mínimo ${minOrder}
            </span>
          )}
        </div>
      )}

      {/* ── Category Pills ────────────────────────────────────────────────────── */}
      {hasCategoryBar && (
        <div style={{
          background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)',
          position: 'sticky', top: 58, zIndex: 40,
          overflowX: 'auto', scrollbarWidth: 'none'
        }}>
          <style>{`.cat-bar::-webkit-scrollbar { display: none; }`}</style>
          <div className="cat-bar" style={{ display: 'flex', gap: 6, padding: '10px 16px', whiteSpace: 'nowrap', maxWidth: 700, margin: '0 auto' }}>
            {categoriesWithProducts.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  const el = document.getElementById(`cat-${cat.id}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                style={{
                  padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
                  background: activeCategory === cat.id ? '#D4AF37' : 'rgba(0,0,0,0.06)',
                  color: activeCategory === cat.id ? '#000' : '#374151',
                  transition: 'all 0.15s'
                }}
              >{cat.name}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Combos ───────────────────────────────────────────────────────────── */}
      {combos.length > 0 && (
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 4, height: 20, background: '#D4AF37', borderRadius: 2, flexShrink: 0 }} />
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111', margin: 0, letterSpacing: -0.3 }}>Combos</h2>
            <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {combos.map(combo => {
              const comboPrice = (combo.items || []).reduce((sum, ci) => {
                const p = products.find(pr => String(pr.id) === String(ci.product_id));
                return sum + (p ? Number(p.price) * (ci.quantity || 1) : 0);
              }, 0);
              const finalPrice = combo.fixed_price ? Number(combo.fixed_price) :
                combo.discount_type === 'percent' ? comboPrice * (1 - Number(combo.discount_value || 0) / 100) :
                combo.discount_type === 'fixed' ? Math.max(0, comboPrice - Number(combo.discount_value || 0)) :
                comboPrice;
              const hasDiscount = finalPrice < comboPrice;
              return (
                <div
                  key={combo.id}
                  onClick={() => startCombo(combo)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#fff', borderRadius: 16, padding: '14px 16px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.07)',
                    cursor: 'pointer', gap: 12, transition: 'all 0.15s'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 4 }}>{combo.name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.4 }}>
                      {(combo.items || []).map(ci => {
                        const p = products.find(pr => String(pr.id) === String(ci.product_id));
                        return p ? `${ci.quantity > 1 ? `${ci.quantity}× ` : ''}${p.name}` : null;
                      }).filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {hasDiscount && <div style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'line-through' }}>${comboPrice.toFixed(0)}</div>}
                    <div style={{ fontSize: 17, fontWeight: 900, color: '#D4AF37' }}>${finalPrice.toFixed(0)}</div>
                  </div>
                  <div style={{ background: '#D4AF37', color: '#000', width: 30, height: 30, borderRadius: '50%', fontSize: 20, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(212,175,55,0.4)' }}>+</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Menu ──────────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px 0' }}>
        {categoriesWithProducts.map(cat => (
          <div
            key={cat.id}
            id={`cat-${cat.id}`}
            style={{ marginBottom: 32, scrollMarginTop: hasCategoryBar ? 112 : 70 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 4, height: 20, background: '#D4AF37', borderRadius: 2, flexShrink: 0 }} />
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111', margin: 0, letterSpacing: -0.3 }}>{cat.name}</h2>
              <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cat.products.map(p => (
                <ProductCard key={p.id} product={p} cart={cart} onSelect={() => setSelectedProduct(p)} />
              ))}
            </div>
          </div>
        ))}

        {uncategorized.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 4, height: 20, background: '#D4AF37', borderRadius: 2, flexShrink: 0 }} />
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111', margin: 0 }}>Otros</h2>
              <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {uncategorized.map(p => (
                <ProductCard key={p.id} product={p} cart={cart} onSelect={() => setSelectedProduct(p)} />
              ))}
            </div>
          </div>
        )}

        {products.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🍽️</div>
            <p style={{ fontWeight: 700, color: '#374151', fontSize: 16, margin: '0 0 8px' }}>Sin productos disponibles</p>
            <p style={{ fontSize: 14, margin: 0 }}>El menú estará disponible próximamente</p>
          </div>
        )}
      </div>

      {/* ── Floating Cart ─────────────────────────────────────────────────────── */}
      {cart.length > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '8px 16px 32px', background: 'linear-gradient(to top, #f4f4f6 72%, transparent)', zIndex: 40 }}>
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <textarea
              placeholder="Comentario: sin cebolla, tocar timbre..."
              value={orderNotes}
              onChange={e => setOrderNotes(e.target.value)}
              rows={1}
              style={{ width: '100%', padding: '9px 14px', background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, color: '#111', fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit', marginBottom: 8 }}
            />
            <button
              onClick={handleCheckout}
              disabled={cartTotal < minOrder}
              style={{
                width: '100%', padding: '16px 20px', borderRadius: 16, border: 'none',
                background: cartTotal >= minOrder ? 'linear-gradient(135deg, #D4AF37 0%, #B8952D 100%)' : '#d1d5db',
                color: cartTotal >= minOrder ? '#000' : '#9ca3af',
                fontWeight: 800, fontSize: 15, cursor: cartTotal >= minOrder ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: cartTotal >= minOrder ? '0 6px 24px rgba(212,175,55,0.5)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: '4px 12px', fontSize: 13, fontWeight: 900 }}>
                {cartItemCount} {cartItemCount === 1 ? 'ítem' : 'ítems'}
              </div>
              <span>{cartTotal < minOrder ? `Mínimo $${minOrder}` : 'Ver pedido'}</span>
              <span style={{ fontWeight: 900, fontSize: 16 }}>${finalTotal.toFixed(0)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          comboName={comboFlowRef.current.name}
          complementsLabel={(store.complements_label || '').trim() || 'Ingredientes'}
          extrasLabel={(store.extras_label || '').trim() || 'Extras'}
          onAdd={(item) => {
            addToCart(item);
            if (comboFlowRef.current.name) {
              processNextComboItem();
            } else {
              setSelectedProduct(null);
            }
          }}
          onClose={() => {
            comboFlowRef.current = { name: null, queue: [] };
            setSelectedProduct(null);
          }}
        />
      )}

      {/* Auth Modal */}
      {showAuth && <DeliveryAuthModal onAuth={handleAuth} onClose={() => setShowAuth(false)} />}

      {/* ── Checkout Modal ────────────────────────────────────────────────────── */}
      {showCheckout && payStep !== 'success' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#f4f4f6', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 500, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>

            {/* Header */}
            <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '14px 20px 16px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 2 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#111' }}>Confirmar pedido</h2>
                <button onClick={() => setShowCheckout(false)} style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 34, height: 34, color: '#6b7280', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            </div>

            <div style={{ padding: '14px 14px 44px', display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Order summary */}
              <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <div style={{ padding: '14px 16px 0', fontWeight: 800, fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6 }}>Tu pedido</div>
                <div style={{ padding: '10px 16px 0' }}>
                  {cart.map(item => (
                    <div key={item.cartKey} style={{ padding: '9px 0', borderBottom: '1px solid #f3f4f6' }}>
                      {item.comboName && <div style={{ fontSize: 10, fontWeight: 700, color: '#D4AF37', marginBottom: 2 }}>📦 {item.comboName}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#111', fontWeight: 600 }}>
                        <span>{item.qty}× {item.name}</span>
                        <span>${(item.price * item.qty).toFixed(0)}</span>
                      </div>
                      {item.selectedExtras?.length > 0 && (
                        <div style={{ fontSize: 12, color: '#D4AF37', marginTop: 2, fontWeight: 500 }}>+ {item.selectedExtras.map(e => e.name).join(', ')}</div>
                      )}
                      {item.selectedComplements?.length > 0 && (
                        <div style={{ fontSize: 12, color: '#D4AF37', marginTop: 2, fontWeight: 500 }}>{item.selectedComplements.map(s => s.name).join(', ')}</div>
                      )}
                      {item.selectedIngredients?.length > 0 && (
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{item.selectedIngredients.map(i => i.name).join(', ')}</div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ padding: '12px 16px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', marginBottom: 5 }}>
                    <span>Subtotal</span><span>${cartTotal.toFixed(0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: deliveryFee === 0 ? '#16a34a' : '#6b7280', marginBottom: 8 }}>
                    <span>Envío</span><span>{deliveryFee > 0 ? `$${deliveryFee}` : '🎉 Gratis'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 19, fontWeight: 900, color: '#111', paddingTop: 8, borderTop: '1.5px solid #f0f0f0' }}>
                    <span>Total</span><span style={{ color: '#D4AF37' }}>${finalTotal.toFixed(0)}</span>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: '#9ca3af', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Dirección de entrega</div>
                <input
                  type="text" placeholder="Ej: Av. Siempre Viva 742, piso 3"
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  style={{ width: '100%', padding: '13px 14px', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 12, color: '#111', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
                />
                <button onClick={detectGPS} disabled={gpsLoading} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: customerCoords ? '#f0fdf4' : '#f9fafb',
                  border: customerCoords ? '1px solid #bbf7d0' : '1.5px solid #e5e7eb',
                  borderRadius: 10, padding: '9px 14px', cursor: gpsLoading ? 'default' : 'pointer',
                  color: customerCoords ? '#15803d' : '#6b7280', fontSize: 13, fontWeight: 600, transition: 'all 0.15s'
                }}>
                  📍 {gpsLoading ? 'Detectando...' : customerCoords ? '✓ Ubicación detectada' : 'Detectar mi ubicación GPS'}
                </button>
                {distanceKm !== null && (
                  <div style={{ marginTop: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: '#92400e' }}>
                    📏 Distancia al local: <strong>{distanceKm} km</strong>
                    {deliverySettings?.fee_type === 'per_km' && <span> · Envío calculado: <strong>${deliveryFee}</strong></span>}
                  </div>
                )}
              </div>

              {/* Customer info */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: '#9ca3af', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Datos de contacto</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: '#374151' }}>
                  <div>👤 <strong>{customer?.name}</strong></div>
                  {customer?.phone && <div>📞 {customer.phone}</div>}
                  <div>📧 {customer?.email}</div>
                </div>
              </div>

              {/* Payment */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: '#9ca3af', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 }}>Método de pago</div>
                {deliverySettings?.payment_cash !== false && deliverySettings?.payment_card ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { value: 'cash', label: '💵 Efectivo', desc: 'Al recibir' },
                      { value: 'card', label: '💳 Tarjeta Tuu', desc: 'Terminal contra entrega' }
                    ].map(opt => (
                      <div key={opt.value} onClick={() => setPaymentMethod(opt.value)} style={{
                        flex: 1, padding: '12px', borderRadius: 12, cursor: 'pointer',
                        border: paymentMethod === opt.value ? '2px solid #D4AF37' : '1.5px solid #e5e7eb',
                        background: paymentMethod === opt.value ? 'rgba(212,175,55,0.06)' : '#f9fafb',
                        transition: 'all 0.15s'
                      }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{opt.label}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{opt.desc}</div>
                      </div>
                    ))}
                  </div>
                ) : deliverySettings?.payment_card && deliverySettings?.payment_cash === false ? (
                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#0369a1', fontWeight: 600 }}>
                    💳 Tarjeta con terminal Tuu (contra entrega)
                  </div>
                ) : (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                    💵 Efectivo contra entrega
                  </div>
                )}
              </div>

              <button
                onClick={placeOrder}
                disabled={!deliveryAddress.trim() || placing}
                style={{
                  padding: '16px', marginTop: 4,
                  background: !deliveryAddress.trim() || placing ? '#d1d5db' : 'linear-gradient(135deg, #D4AF37 0%, #B8952D 100%)',
                  color: !deliveryAddress.trim() || placing ? '#9ca3af' : '#000',
                  border: 'none', borderRadius: 16, fontWeight: 800, fontSize: 16,
                  cursor: !deliveryAddress.trim() || placing ? 'not-allowed' : 'pointer',
                  boxShadow: deliveryAddress.trim() && !placing ? '0 6px 24px rgba(212,175,55,0.5)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                {placing ? '⏳ Enviando pedido...' : `🚀 Confirmar pedido · $${finalTotal.toFixed(0)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Screen ────────────────────────────────────────────────────── */}
      {payStep === 'success' && (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 24px 56px' }}>
          <div style={{ textAlign: 'center', maxWidth: 360, width: '100%' }}>
            <div style={{
              width: 104, height: 104,
              background: 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.04))',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 26px', fontSize: 50,
              border: '2px solid rgba(212,175,55,0.25)',
              boxShadow: '0 8px 40px rgba(212,175,55,0.18)'
            }}>🎉</div>

            <h2 style={{ color: '#111', fontSize: 26, fontWeight: 900, margin: '0 0 10px' }}>¡Pedido enviado!</h2>
            <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.7, margin: '0 0 28px' }}>
              Tu pedido llegó al restaurante.<br />En breve lo confirman y comienzan a prepararlo.
            </p>

            <div style={{ background: '#f4f4f6', borderRadius: 20, padding: '20px 24px', marginBottom: 24, border: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>Tiempo estimado de entrega</div>
              <div style={{ fontSize: 40, fontWeight: 900, color: '#D4AF37', lineHeight: 1 }}>
                ~{deliverySettings?.estimated_minutes || parseInt(localStorage.getItem('deliveryLastEstimated') || '45')} min
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              {localStorage.getItem('deliveryLastOrderId') && (
                <button
                  onClick={() => navigate(`/delivery/track/${localStorage.getItem('deliveryLastOrderId')}`)}
                  style={{
                    background: 'linear-gradient(135deg, #D4AF37 0%, #B8952D 100%)',
                    color: '#000', border: 'none', borderRadius: 16,
                    padding: '16px', fontWeight: 800, fontSize: 15, cursor: 'pointer',
                    boxShadow: '0 6px 24px rgba(212,175,55,0.4)', width: '100%'
                  }}
                >📍 Seguir mi pedido</button>
              )}
              <button
                onClick={() => { setPayStep('address'); setShowCheckout(false); navigate('/delivery'); }}
                style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 16, padding: '14px', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%' }}
              >Volver al inicio</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
