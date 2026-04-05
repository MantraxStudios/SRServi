import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

function Ingredients() {
  const { selectedStore } = useStore();
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category_id: '',
    imageFile: null,
    stock: '',
    unlimited_stock: false
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedStore) {
      setLoading(true);
      Promise.all([
        fetchIngredients(),
        fetchCategories()
      ]).finally(() => setLoading(false));
    } else {
      setLoading(false);
      setIngredients([]);
      setCategories([]);
    }
  }, [selectedStore]);

  const fetchIngredients = async () => {
    if (!selectedStore) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/ingredients?store_id=${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setIngredients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching ingredients:', error);
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
      const url = editingIngredient
        ? `/api/ingredients/${editingIngredient.id}`
        : '/api/ingredients';

      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('price', parseFloat(formData.price) || 0);
      formDataToSend.append('category_id', formData.category_id || '');
      formDataToSend.append('store_id', selectedStore.id);
      formDataToSend.append('stock', parseInt(formData.stock) || 0);
      formDataToSend.append('unlimited_stock', formData.unlimited_stock);
      if (formData.imageFile) {
        formDataToSend.append('image', formData.imageFile);
      }

      const response = await fetch(url, {
        method: editingIngredient ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });

      if (!response.ok) {
        throw new Error('Error al guardar el ingrediente');
      }

      setShowModal(false);
      setEditingIngredient(null);
      setFormData({ name: '', price: '', category_id: '', imageFile: null, stock: '', unlimited_stock: false });
      fetchIngredients();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (ingredient) => {
    setEditingIngredient(ingredient);
    setFormData({
      name: ingredient.name,
      price: ingredient.price?.toString() || '0',
      category_id: ingredient.category_id?.toString() || '',
      imageFile: null,
      stock: ingredient.stock?.toString() || '0',
      unlimited_stock: ingredient.unlimited_stock || false
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este ingrediente?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/ingredients/${id}?store_id=${selectedStore.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Error al eliminar el ingrediente');
      }

      fetchIngredients();
    } catch (error) {
      alert(error.message);
    }
  };

  const openModal = () => {
    setEditingIngredient(null);
    setFormData({ name: '', price: '', category_id: '', imageFile: null, stock: '', unlimited_stock: false });
    setShowModal(true);
  };

  const groupedIngredients = ingredients.reduce((acc, ing) => {
    const key = ing.category_id ? (ing.category_name || `Categoría ${ing.category_id}`) : 'Sin categoría';
    if (!acc[key]) acc[key] = [];
    acc[key].push(ing);
    return acc;
  }, {});

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <>
      <header className="admin-header">
        <h1>Complementos</h1>
        <button className="btn btn-primary" onClick={openModal}>
          <FontAwesomeIcon icon={faPlus} />
          Nuevo Ingrediente
        </button>
      </header>
      <div className="admin-main">
        {error && <div className="error">{error}</div>}

        <div className="card">
          {ingredients.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
              No hay ingredientes. Crea tu primer ingrediente.
            </p>
          ) : (
            <div className="admin-table-wrapper">
              {Object.entries(groupedIngredients).map(([categoryName, items]) => (
                <div key={categoryName} style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: '#666', letterSpacing: '0.05em', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #eee' }}>
                    {categoryName}
                  </h3>
                  <table className="table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Precio Adicional</th>
                      <th>Stock</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(ingredient => (
                      <tr key={ingredient.id}>
                        <td style={{ fontWeight: '600' }}>{ingredient.name}</td>
                        <td>
                          {Number(ingredient.price) > 0 ? `$${Number(ingredient.price).toFixed(2)}` : '-'}
                        </td>
                        <td>
                          {ingredient.unlimited_stock ? (
                            <span style={{ fontWeight: '700', color: '#28a745', fontSize: '18px' }}>∞</span>
                          ) : (
                            <span style={{ fontWeight: '700', color: ingredient.stock === 0 ? '#dc3545' : ingredient.stock < 10 ? '#ffc107' : '#28a745' }}>
                              {ingredient.stock}
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleEdit(ingredient)}
                            style={{ marginRight: '8px' }}
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(ingredient.id)}
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
                {editingIngredient ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}
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
                  placeholder="Nombre del ingrediente"
                />
              </div>
              <div className="form-group">
                <label>Precio Adicional</label>
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
                <label>Stock</label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  placeholder="0"
                  disabled={formData.unlimited_stock}
                />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px', padding: '16px', background: formData.unlimited_stock ? '#d4edda' : '#fff3cd', borderRadius: '12px', border: `2px solid ${formData.unlimited_stock ? '#28a745' : '#ffc107'}` }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={formData.unlimited_stock}
                    onChange={(e) => setFormData({ ...formData, unlimited_stock: e.target.checked })}
                    style={{ width: '22px', height: '22px', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: '600', color: formData.unlimited_stock ? '#155724' : '#856404' }}>
                    Stock Ilimitado
                  </span>
                </label>
                <span style={{ fontSize: '13px', color: formData.unlimited_stock ? '#28a745' : '#856404', marginLeft: 'auto' }}>
                  {formData.unlimited_stock ? '∞ Stock Ilimitado' : 'Completo'}
                </span>
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
                {editingIngredient && !formData.imageFile && editingIngredient.image && (
                  <div style={{ marginTop: '10px' }}>
                    <img
                      src={editingIngredient.image}
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
                {editingIngredient ? 'Actualizar' : 'Crear'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Ingredients;
