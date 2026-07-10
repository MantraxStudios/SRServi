import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faLayerGroup, faCamera, faSearch, faMinus, faBox, faToggleOn, faToggleOff, faTag } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { getImageUrl } from '../../config.js';

const API = 'https://mantraxtools.store';

const emptyForm = {
  name: '',
  description: '',
  image: '',
  image_url: '',
  imageFile: null,
  is_active: true,
  discount_type: 'auto',
  discount_value: '',
  fixed_price: '',
  items: []
};

function Combos() {
  const { selectedStore } = useStore();
  const [combos, setCombos] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [productSearch, setProductSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!selectedStore) { setLoading(false); setCombos([]); setProducts([]); return; }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchAll();
    return () => { fetchedRef.current = false; };
  }, [selectedStore]);

  const fetchAll = async () => {
    if (!selectedStore) { setLoading(false); return; }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const [combosRes, productsRes] = await Promise.all([
        fetch(`${API}/api/combos?store_id=${selectedStore.id}`, { headers }),
        fetch(`${API}/api/products?store_id=${selectedStore.id}`, { headers })
      ]);
      setCombos(combosRes.ok ? await combosRes.json() : []);
      setProducts(productsRes.ok ? await productsRes.json() : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const productById = (id) => products.find(p => String(p.id) === String(id));

  const autoTotal = formData.items.reduce((sum, it) => {
    const p = productById(it.product_id);
    return sum + (p ? Number(p.price) * it.quantity : 0);
  }, 0);

  const previewPrice = () => {
    if (formData.discount_type === 'fixed') return parseFloat(formData.fixed_price) || 0;
    if (formData.discount_type === 'percent') {
      const pct = parseFloat(formData.discount_value) || 0;
      return autoTotal * (1 - pct / 100);
    }
    return autoTotal;
  };

  const openModal = () => {
    setEditingCombo(null);
    setFormData(emptyForm);
    setProductSearch('');
    setError('');
    setShowModal(true);
  };

  const handleEdit = (combo) => {
    setEditingCombo(combo);
    setFormData({
      name: combo.name || '',
      description: combo.description || '',
      image: combo.image || '',
      image_url: combo.image?.startsWith('http') ? combo.image : '',
      imageFile: null,
      is_active: combo.is_active !== false,
      discount_type: combo.discount_type || 'auto',
      discount_value: combo.discount_value ? String(combo.discount_value) : '',
      fixed_price: combo.fixed_price ? String(combo.fixed_price) : '',
      items: (combo.items || []).map(it => ({ product_id: it.product_id, quantity: it.quantity }))
    });
    setProductSearch('');
    setError('');
    setShowModal(true);
  };

  const addProductToCombo = (product) => {
    setFormData(prev => {
      const existing = prev.items.find(it => String(it.product_id) === String(product.id));
      if (existing) {
        return { ...prev, items: prev.items.map(it => String(it.product_id) === String(product.id) ? { ...it, quantity: it.quantity + 1 } : it) };
      }
      return { ...prev, items: [...prev.items, { product_id: product.id, quantity: 1 }] };
    });
  };

  const changeItemQty = (productId, delta) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items
        .map(it => String(it.product_id) === String(productId) ? { ...it, quantity: it.quantity + delta } : it)
        .filter(it => it.quantity > 0)
    }));
  };

  const removeItem = (productId) => {
    setFormData(prev => ({ ...prev, items: prev.items.filter(it => String(it.product_id) !== String(productId)) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.name.trim()) { setError('El nombre es requerido'); return; }
    if (formData.items.length === 0) { setError('Agrega al menos un producto al combo'); return; }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const url = editingCombo ? `${API}/api/combos/${editingCombo.id}` : `${API}/api/combos`;
      const fd = new FormData();
      fd.append('store_id', selectedStore.id);
      fd.append('name', formData.name.trim());
      fd.append('description', formData.description || '');
      fd.append('is_active', formData.is_active);
      fd.append('items', JSON.stringify(formData.items));
      fd.append('discount_type', formData.discount_type);
      fd.append('discount_value', parseFloat(formData.discount_value) || 0);
      fd.append('fixed_price', parseFloat(formData.fixed_price) || 0);
      if (formData.imageFile) fd.append('image', formData.imageFile);
      else if (formData.image_url) fd.append('image_url', formData.image_url);
      else if (editingCombo && formData.image) fd.append('existing_image', formData.image);

      const res = await fetch(url, {
        method: editingCombo ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al guardar el combo');
      }
      const combo = await res.json();
      setCombos(prev => editingCombo ? prev.map(c => c.id === combo.id ? combo : c) : [...prev, combo]);
      setShowModal(false);
      setEditingCombo(null);
      setFormData(emptyForm);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este combo?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/combos/${id}?store_id=${selectedStore.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al eliminar el combo');
      setCombos(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleActive = async (combo) => {
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('store_id', selectedStore.id);
      fd.append('name', combo.name);
      fd.append('description', combo.description || '');
      fd.append('is_active', !combo.is_active);
      fd.append('discount_type', combo.discount_type || 'auto');
      fd.append('discount_value', combo.discount_value || 0);
      fd.append('fixed_price', combo.fixed_price || 0);
      fd.append('items', JSON.stringify((combo.items || []).map(it => ({ product_id: it.product_id, quantity: it.quantity }))));
      if (combo.image) fd.append('existing_image', combo.image);
      const res = await fetch(`${API}/api/combos/${combo.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      if (!res.ok) throw new Error('Error al actualizar');
      const updated = await res.json();
      setCombos(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredProducts = products.filter(p =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const discountLabel = (combo) => {
    if (combo.discount_type === 'percent' && combo.discount_value > 0)
      return `-${combo.discount_value}%`;
    if (combo.discount_type === 'fixed' && combo.fixed_price > 0)
      return 'Precio fijo';
    return null;
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <>
      <header className="admin-header">
        <h1>Combos</h1>
        <button className="btn btn-primary" onClick={openModal}>
          <FontAwesomeIcon icon={faPlus} />
          Nuevo Combo
        </button>
      </header>

      <div className="admin-main">
        {error && !showModal && <div className="error">{error}</div>}

        <div className="card">
          {combos.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-text">No hay combos. Crea tu primer combo o promoción.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
              {combos.map(combo => {
                const badge = discountLabel(combo);
                return (
                  <div key={combo.id} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    opacity: combo.is_active ? 1 : 0.55,
                    position: 'relative'
                  }}>
                    {badge && (
                      <div style={{
                        position: 'absolute', top: '8px', left: '8px', zIndex: 2,
                        background: '#D4AF37', color: '#000', fontWeight: 700,
                        fontSize: '0.75rem', padding: '2px 8px', borderRadius: '20px'
                      }}>{badge}</div>
                    )}
                    <div style={{ height: '140px', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {combo.image ? (
                        <img src={getImageUrl(combo.image)} alt={combo.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <FontAwesomeIcon icon={faLayerGroup} style={{ fontSize: '2.5rem', color: 'rgba(212,175,55,0.4)' }} />
                      )}
                    </div>
                    <div style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>{combo.name}</h3>
                        <button onClick={() => toggleActive(combo)}
                          title={combo.is_active ? 'Activo' : 'Oculto'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: combo.is_active ? '#22c55e' : 'rgba(255,255,255,0.3)', fontSize: '1.3rem', padding: 0 }}>
                          <FontAwesomeIcon icon={combo.is_active ? faToggleOn : faToggleOff} />
                        </button>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', margin: '6px 0 8px', minHeight: '14px' }}>
                        {(combo.items || []).map(it => `${it.quantity}× ${it.product_name}`).join(', ')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '10px' }}>
                        <span style={{ color: '#D4AF37', fontWeight: 700, fontSize: '1.1rem' }}>
                          ${Number(combo.price || 0).toFixed(2)}
                        </span>
                        {combo.discount_type !== 'auto' && combo.auto_price > 0 && combo.auto_price !== combo.price && (
                          <span style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through', fontSize: '0.82rem' }}>
                            ${Number(combo.auto_price).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleEdit(combo)} className="btn btn-secondary btn-sm">
                          <FontAwesomeIcon icon={faEdit} /> Editar
                        </button>
                        <button onClick={() => handleDelete(combo.id)} className="btn btn-danger btn-sm">
                          <FontAwesomeIcon icon={faTrash} /> Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="product-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="product-modal-header">
              <h2 className="product-modal-title">{editingCombo ? 'Editar Combo' : 'Nuevo Combo'}</h2>
              <button className="product-modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            <div className="product-modal-body">
              {error && <div className="error" style={{ marginBottom: '12px' }}>{error}</div>}
              <form onSubmit={handleSubmit} className="product-form">

                {/* Imagen */}
                <div className="product-form-section">
                  <div className="product-image-box">
                    {(formData.imageFile || formData.image || formData.image_url) ? (
                      <>
                        <img
                          src={formData.imageFile ? URL.createObjectURL(formData.imageFile) : (formData.image || formData.image_url)}
                          alt="Preview"
                          className="product-image-preview"
                        />
                        <div className="product-image-actions">
                          <input type="file" accept="image/*" id="combo-file-change" style={{ display: 'none' }}
                            onChange={(e) => { const f = e.target.files[0]; if (f) setFormData(prev => ({ ...prev, imageFile: f })); }} />
                          <button type="button" className="btn-image-action" onClick={() => document.getElementById('combo-file-change')?.click()}>
                            <FontAwesomeIcon icon={faCamera} style={{ marginRight: '6px' }} /> Cambiar
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="product-image-placeholder">
                        <input type="file" accept="image/*" id="combo-file" style={{ display: 'none' }}
                          onChange={(e) => { const f = e.target.files[0]; if (f) setFormData(prev => ({ ...prev, imageFile: f })); }} />
                        <button type="button" className="btn btn-outline btn-full" onClick={() => document.getElementById('combo-file')?.click()}>
                          <FontAwesomeIcon icon={faCamera} style={{ marginRight: '6px' }} /> Seleccionar imagen
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Nombre del combo</label>
                  <input type="text" value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Combo Familiar" required />
                </div>

                <div className="form-group">
                  <label>Descripción (opcional)</label>
                  <textarea value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe el combo" rows={2} />
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" id="combo-active" checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    style={{ width: 'auto' }} />
                  <label htmlFor="combo-active" style={{ margin: 0 }}>Visible en la tienda</label>
                </div>

                {/* Productos del combo */}
                <div className="product-form-section">
                  <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>Productos incluidos</label>

                  {formData.items.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                      {formData.items.map(it => {
                        const p = productById(it.product_id);
                        if (!p) return null;
                        const badges = [];
                        if (p.has_ingredients) badges.push('Ingredientes');
                        if (p.has_extras) badges.push('Extras');
                        return (
                          <div key={it.product_id} style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)',
                            borderRadius: '8px', padding: '6px 10px'
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: '#fff', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                              {badges.length > 0 && (
                                <div style={{ fontSize: '0.68rem', color: '#D4AF37', marginTop: '2px' }}>{badges.join(' · ')}</div>
                              )}
                            </div>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', flexShrink: 0 }}>${Number(p.price).toFixed(2)}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                              <button type="button" onClick={() => changeItemQty(it.product_id, -1)}
                                style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer' }}>
                                <FontAwesomeIcon icon={faMinus} />
                              </button>
                              <span style={{ minWidth: '22px', textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>{it.quantity}</span>
                              <button type="button" onClick={() => changeItemQty(it.product_id, 1)}
                                style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', background: 'rgba(212,175,55,0.2)', color: '#D4AF37', cursor: 'pointer' }}>
                                <FontAwesomeIcon icon={faPlus} />
                              </button>
                            </div>
                            <button type="button" onClick={() => removeItem(it.product_id)}
                              style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', background: 'rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}>
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Buscador de productos */}
                  <div style={{ position: 'relative', marginBottom: '8px' }}>
                    <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }} />
                    <input type="text" placeholder="Buscar producto para agregar..." value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      style={{ width: '100%', padding: '8px 8px 8px 30px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {filteredProducts.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '16px', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>No hay productos</div>
                    )}
                    {filteredProducts.map(p => (
                      <button key={p.id} type="button" onClick={() => addProductToCombo(p)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left',
                          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#fff'
                        }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {p.image ? <img src={getImageUrl(p.image)} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <FontAwesomeIcon icon={faBox} style={{ color: 'rgba(255,255,255,0.3)' }} />}
                        </div>
                        <span style={{ flex: 1, fontSize: '0.85rem' }}>{p.name}</span>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>${Number(p.price).toFixed(2)}</span>
                        <FontAwesomeIcon icon={faPlus} style={{ color: '#D4AF37' }} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Precio / Descuento */}
                {formData.items.length > 0 && (
                  <div className="product-form-section">
                    <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                      <FontAwesomeIcon icon={faTag} style={{ marginRight: '6px', color: '#D4AF37' }} />
                      Precio del combo
                    </label>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      {[
                        { value: 'auto', label: 'Suma automática' },
                        { value: 'percent', label: '% Descuento' },
                        { value: 'fixed', label: 'Precio fijo' }
                      ].map(opt => (
                        <button key={opt.value} type="button"
                          onClick={() => setFormData(prev => ({ ...prev, discount_type: opt.value }))}
                          style={{
                            flex: 1, padding: '6px 4px', fontSize: '0.78rem', fontWeight: 600,
                            borderRadius: '8px', border: `1px solid ${formData.discount_type === opt.value ? '#D4AF37' : 'rgba(255,255,255,0.1)'}`,
                            background: formData.discount_type === opt.value ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
                            color: formData.discount_type === opt.value ? '#D4AF37' : 'rgba(255,255,255,0.5)',
                            cursor: 'pointer'
                          }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {formData.discount_type === 'percent' && (
                      <div className="form-group">
                        <label>Descuento (%)</label>
                        <input type="number" min="0" max="100" step="0.1"
                          value={formData.discount_value}
                          onChange={(e) => setFormData(prev => ({ ...prev, discount_value: e.target.value }))}
                          placeholder="Ej: 10" />
                      </div>
                    )}

                    {formData.discount_type === 'fixed' && (
                      <div className="form-group">
                        <label>Precio fijo del combo</label>
                        <input type="number" min="0" step="0.01"
                          value={formData.fixed_price}
                          onChange={(e) => setFormData(prev => ({ ...prev, fixed_price: e.target.value }))}
                          placeholder="Ej: 9990" />
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(212,175,55,0.06)', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.15)' }}>
                      {formData.discount_type !== 'auto' && (
                        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem', textDecoration: 'line-through' }}>
                          ${autoTotal.toFixed(2)}
                        </span>
                      )}
                      {formData.discount_type === 'auto' && (
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>Precio total</span>
                      )}
                      <span style={{ color: '#D4AF37', fontWeight: 700, fontSize: '1.1rem', marginLeft: 'auto' }}>
                        ${Math.max(0, previewPrice()).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button type="button" className="btn btn-secondary btn-full" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
                    {saving ? 'Guardando...' : (editingCombo ? 'Guardar cambios' : 'Crear combo')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Combos;
