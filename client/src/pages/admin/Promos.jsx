import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faBullhorn, faToggleOn, faToggleOff } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { getImageUrl } from '../../config.js';

const API = 'https://srservi2.srautomatic.com';

const emptyForm = {
  title: '',
  description: '',
  price: '',
  image: '',
  image_url: '',
  imageFile: null,
  is_active: true
};

function Promos() {
  const { selectedStore } = useStore();
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!selectedStore) { setLoading(false); setPromos([]); return; }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchPromos();
    return () => { fetchedRef.current = false; };
  }, [selectedStore]);

  const fetchPromos = async () => {
    if (!selectedStore) { setLoading(false); return; }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/promos?store_id=${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPromos(res.ok ? await res.json() : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setEditingPromo(null);
    setFormData(emptyForm);
    setError('');
    setShowModal(true);
  };

  const handleEdit = (promo) => {
    setEditingPromo(promo);
    setFormData({
      title: promo.title || '',
      description: promo.description || '',
      price: promo.price ? String(promo.price) : '',
      image: promo.image || '',
      image_url: promo.image?.startsWith('http') ? promo.image : '',
      imageFile: null,
      is_active: promo.is_active !== false
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.title.trim()) { setError('El título es requerido'); return; }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const url = editingPromo ? `${API}/api/promos/${editingPromo.id}` : `${API}/api/promos`;
      const fd = new FormData();
      fd.append('store_id', selectedStore.id);
      fd.append('title', formData.title.trim());
      fd.append('description', formData.description || '');
      fd.append('price', parseFloat(formData.price) || 0);
      fd.append('is_active', formData.is_active);
      if (formData.imageFile) fd.append('image', formData.imageFile);
      else if (formData.image_url) fd.append('image_url', formData.image_url);
      else if (editingPromo && formData.image) fd.append('existing_image', formData.image);

      const res = await fetch(url, {
        method: editingPromo ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al guardar la promoción');
      }
      const promo = await res.json();
      setPromos(prev => editingPromo ? prev.map(p => p.id === promo.id ? promo : p) : [...prev, promo]);
      setShowModal(false);
      setEditingPromo(null);
      setFormData(emptyForm);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta promoción?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/promos/${id}?store_id=${selectedStore.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al eliminar la promoción');
      setPromos(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleActive = async (promo) => {
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('store_id', selectedStore.id);
      fd.append('title', promo.title);
      fd.append('description', promo.description || '');
      fd.append('price', promo.price || 0);
      fd.append('is_active', !promo.is_active);
      if (promo.image) fd.append('existing_image', promo.image);
      const res = await fetch(`${API}/api/promos/${promo.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      if (!res.ok) throw new Error('Error al actualizar');
      const updated = await res.json();
      setPromos(prev => prev.map(p => p.id === updated.id ? updated : p));
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <>
      <header className="admin-header">
        <h1>Promociones</h1>
        <button className="btn btn-primary" onClick={openModal}>
          <FontAwesomeIcon icon={faPlus} />
          Nueva Promoción
        </button>
      </header>

      <div className="admin-main">
        {error && !showModal && <div className="error">{error}</div>}

        <div className="card">
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginTop: 0 }}>
            Las promociones aparecen como banners destacados en tu tienda (debajo de las categorías).
            Al hacer clic, el cliente ve una confirmación para añadirla al carrito con el precio indicado.
          </p>
          {promos.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-text">No hay promociones. Crea la primera para destacarla en tu tienda.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
              {promos.map(promo => (
                <div key={promo.id} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  opacity: promo.is_active ? 1 : 0.55
                }}>
                  <div style={{ height: '120px', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {promo.image ? (
                      <img src={getImageUrl(promo.image)} alt={promo.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <FontAwesomeIcon icon={faBullhorn} style={{ fontSize: '2.5rem', color: 'rgba(212,175,55,0.4)' }} />
                    )}
                  </div>
                  <div style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>{promo.title}</h3>
                      <button onClick={() => toggleActive(promo)}
                        title={promo.is_active ? 'Activa' : 'Oculta'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: promo.is_active ? '#22c55e' : 'rgba(255,255,255,0.3)', fontSize: '1.3rem', padding: 0 }}>
                        <FontAwesomeIcon icon={promo.is_active ? faToggleOn : faToggleOff} />
                      </button>
                    </div>
                    {promo.description && (
                      <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', margin: '6px 0 8px' }}>
                        {promo.description}
                      </div>
                    )}
                    <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: '1.1rem', marginBottom: '10px' }}>
                      ${Number(promo.price || 0).toFixed(0)}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEdit(promo)} className="btn btn-secondary btn-sm">
                        <FontAwesomeIcon icon={faEdit} /> Editar
                      </button>
                      <button onClick={() => handleDelete(promo.id)} className="btn btn-danger btn-sm">
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h2 style={{ marginTop: 0 }}>{editingPromo ? 'Editar Promoción' : 'Nueva Promoción'}</h2>
            {error && <div className="error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Título *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ej: Agrega más sabor"
                  maxLength={120}
                />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ej: Añade papas o bebida a tu combo"
                  maxLength={255}
                />
              </div>
              <div className="form-group">
                <label>Precio *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="Ej: 2500"
                />
              </div>
              <div className="form-group">
                <label>Imagen</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFormData({ ...formData, imageFile: e.target.files[0] || null })}
                />
                {(formData.imageFile || formData.image) && (
                  <img
                    src={formData.imageFile ? URL.createObjectURL(formData.imageFile) : getImageUrl(formData.image)}
                    alt="preview"
                    style={{ marginTop: '8px', width: '100%', maxHeight: '140px', objectFit: 'cover', borderRadius: '8px' }}
                  />
                )}
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ margin: 0 }}>Activa</label>
                <button type="button" onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: formData.is_active ? '#22c55e' : 'rgba(255,255,255,0.3)', fontSize: '1.6rem', padding: 0 }}>
                  <FontAwesomeIcon icon={formData.is_active ? faToggleOn : faToggleOff} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
                  {saving ? 'Guardando...' : (editingPromo ? 'Guardar' : 'Crear')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Promos;
