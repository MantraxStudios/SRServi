import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

function Extras() {
  const { selectedStore } = useStore();
  const [extras, setExtras] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExtra, setEditingExtra] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category_id: '',
    imageFile: null
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedStore) {
      setLoading(true);
      Promise.all([
        fetchExtras(),
        fetchCategories()
      ]).finally(() => setLoading(false));
    } else {
      setLoading(false);
      setExtras([]);
      setCategories([]);
    }
  }, [selectedStore]);

  const fetchExtras = async () => {
    if (!selectedStore) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/extras?store_id=${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setExtras(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching extras:', error);
    }
  };

  const fetchCategories = async () => {
    if (!selectedStore) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/categories?store_id=${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const token = localStorage.getItem('token');
      const url = editingExtra
        ? `/api/extras/${editingExtra.id}`
        : '/api/extras';

      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('price', parseFloat(formData.price) || 0);
      formDataToSend.append('category_id', formData.category_id || '');
      formDataToSend.append('store_id', selectedStore.id);
      if (formData.imageFile) {
        formDataToSend.append('image', formData.imageFile);
      }

      const response = await fetch(url, {
        method: editingExtra ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });

      if (!response.ok) {
        throw new Error('Error al guardar el extra');
      }

      setShowModal(false);
      setEditingExtra(null);
      setFormData({ name: '', price: '', category_id: '', imageFile: null });
      fetchExtras();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (extra) => {
    setEditingExtra(extra);
    setFormData({
      name: extra.name,
      price: extra.price?.toString() || '0',
      category_id: extra.category_id?.toString() || '',
      imageFile: null
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este extra?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/extras/${id}?store_id=${selectedStore.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Error al eliminar el extra');
      }

      fetchExtras();
    } catch (error) {
      alert(error.message);
    }
  };

  const openModal = () => {
    setEditingExtra(null);
    setFormData({ name: '', price: '', category_id: '', imageFile: null });
    setShowModal(true);
  };

  const groupedExtras = extras.reduce((acc, ext) => {
    const key = ext.category_id ? (ext.category_name || `Categoría ${ext.category_id}`) : 'Sin categoría';
    if (!acc[key]) acc[key] = [];
    acc[key].push(ext);
    return acc;
  }, {});

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <>
      <header className="admin-header">
        <h1>Extras</h1>
        <button className="btn btn-primary" onClick={openModal}>
          <FontAwesomeIcon icon={faPlus} />
          Nuevo Extra
        </button>
      </header>
      <div className="admin-main">
        {error && <div className="error">{error}</div>}

        <div className="card">
          {extras.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
              No hay extras. Crea tu primer extra.
            </p>
          ) : (
            <div className="admin-table-wrapper">
              {Object.entries(groupedExtras).map(([categoryName, items]) => (
                <div key={categoryName} style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: '#666', letterSpacing: '0.05em', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #eee' }}>
                    {categoryName}
                  </h3>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Precio</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                    {items.map(extra => (
                      <tr key={extra.id}>
                        <td style={{ fontWeight: '600' }}>{extra.name}</td>
                        <td>
                          {Number(extra.price) > 0 ? `$${Number(extra.price).toFixed(2)}` : '-'}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleEdit(extra)}
                            style={{ marginRight: '8px' }}
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(extra.id)}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingExtra ? 'Editar Extra' : 'Nuevo Extra'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Nombre del extra"
                />
              </div>
              <div className="form-group">
                <label>Precio</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label>Categoría</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                >
                  <option value="">Sin categoría</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Imagen</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setFormData({ ...formData, imageFile: file });
                    }
                  }}
                  style={{
                    padding: '10px',
                    border: '2px dashed #ccc',
                    borderRadius: 'var(--radius-md)',
                    width: '100%',
                    cursor: 'pointer'
                  }}
                />
                {formData.imageFile && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={URL.createObjectURL(formData.imageFile)}
                      alt="Preview"
                      style={{
                        width: '80px',
                        height: '80px',
                        objectFit: 'cover',
                        borderRadius: 'var(--radius-sm)',
                        border: '2px solid var(--gold)'
                      }}
                    />
                    <span style={{ color: '#666', fontSize: '14px' }}>
                      {formData.imageFile.name}
                    </span>
                  </div>
                )}
                {editingExtra && !formData.imageFile && editingExtra.image && (
                  <div style={{ marginTop: '10px' }}>
                    <img
                      src={editingExtra.image}
                      alt="Imagen actual"
                      style={{
                        width: '80px',
                        height: '80px',
                        objectFit: 'cover',
                        borderRadius: 'var(--radius-sm)',
                        border: '2px solid var(--gray)'
                      }}
                    />
                    <p style={{ color: '#666', fontSize: '12px', marginTop: '5px' }}>Imagen actual</p>
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                {editingExtra ? 'Actualizar' : 'Crear'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Extras;
