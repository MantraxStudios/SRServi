import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faInfinity, faCubes, faFlask } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

function Complements() {
  const { selectedStore } = useStore();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [activeTab, setActiveTab] = useState('ingredient');
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category_id: '',
    imageFile: null,
    stock: '',
    unlimited_stock: false,
    type: 'ingredient'
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedStore) {
      setLoading(true);
      fetchAll().finally(() => setLoading(false));
    } else {
      setLoading(false);
      setItems([]);
      setCategories([]);
    }
  }, [selectedStore]);

  const fetchAll = async () => {
    if (!selectedStore) return;
    try {
      const token = localStorage.getItem('token');
      const [ingredientsRes, extrasRes, categoriesRes] = await Promise.all([
        fetch(`/api/ingredients?store_id=${selectedStore.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/extras?store_id=${selectedStore.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/categories?store_id=${selectedStore.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      const [ingredientsData, extrasData, categoriesData] = await Promise.all([
        ingredientsRes.json(),
        extrasRes.json(),
        categoriesRes.json()
      ]);

      const ingredients = (Array.isArray(ingredientsData) ? ingredientsData : []).map(i => ({ ...i, _type: 'ingredient' }));
      const extras = (Array.isArray(extrasData) ? extrasData : []).map(e => ({ ...e, _type: 'extra' }));

      setItems([...ingredients, ...extras]);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (error) {
      console.error('Error fetching complements:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const type = formData.type;
    const apiBase = type === 'extra' ? '/api/extras' : '/api/ingredients';

    try {
      const token = localStorage.getItem('token');
      const url = editingItem
        ? `${apiBase}/${editingItem.id}`
        : apiBase;

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
        method: editingItem ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });

      if (!response.ok) {
        throw new Error('Error al guardar');
      }

      setShowModal(false);
      setEditingItem(null);
      resetForm();
      fetchAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      price: item.price?.toString() || '0',
      category_id: item.category_id?.toString() || '',
      imageFile: null,
      stock: item.stock?.toString() || '0',
      unlimited_stock: item.unlimited_stock || false,
      type: item._type
    });
    setShowModal(true);
  };

  const handleDelete = async (item) => {
    const label = item._type === 'extra' ? 'extra' : 'ingrediente';
    if (!confirm(`¿Estás seguro de eliminar este ${label}?`)) return;

    const apiBase = item._type === 'extra' ? '/api/extras' : '/api/ingredients';

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiBase}/${item.id}?store_id=${selectedStore.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`Error al eliminar el ${label}`);
      }

      fetchAll();
    } catch (error) {
      alert(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      category_id: '',
      imageFile: null,
      stock: '',
      unlimited_stock: false,
      type: activeTab
    });
  };

  const openModal = () => {
    setEditingItem(null);
    resetForm();
    setShowModal(true);
  };

  const filteredItems = items.filter(i => i._type === activeTab);

  const groupedItems = filteredItems.reduce((acc, item) => {
    const key = item.category_id ? (item.category_name || `Categoría ${item.category_id}`) : 'Sin categoría';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
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
          Nuevo
        </button>
      </header>
      <div className="admin-main">
        {error && <div className="error">{error}</div>}

        <div className="complements-tabs">
          <button
            className={`complement-tab${activeTab === 'ingredient' ? ' active' : ''}`}
            onClick={() => setActiveTab('ingredient')}
          >
            <FontAwesomeIcon icon={faFlask} />
            Ingredientes
            <span className="complement-tab-count">{items.filter(i => i._type === 'ingredient').length}</span>
          </button>
          <button
            className={`complement-tab${activeTab === 'extra' ? ' active' : ''}`}
            onClick={() => setActiveTab('extra')}
          >
            <FontAwesomeIcon icon={faCubes} />
            Extras
            <span className="complement-tab-count">{items.filter(i => i._type === 'extra').length}</span>
          </button>
        </div>

        <div className="card">
          {filteredItems.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-text">
                No hay {activeTab === 'extra' ? 'extras' : 'ingredientes'}. Crea el primero.
              </p>
            </div>
          ) : (
            <div className="admin-table-wrapper">
              {Object.entries(groupedItems).map(([categoryName, categoryItems]) => (
                <div key={categoryName} className="category-group">
                  <h3 className="category-group-title">
                    {categoryName}
                  </h3>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>{activeTab === 'extra' ? 'Precio' : 'Precio Adicional'}</th>
                        <th>Stock</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryItems.map(item => (
                        <tr key={`${item._type}-${item.id}`}>
                          <td className="font-semibold">{item.name}</td>
                          <td>
                            {Number(item.price) > 0 ? `$${Number(item.price).toFixed(2)}` : '-'}
                          </td>
                          <td>
                            {item.unlimited_stock ? (
                              <span className="stock-unlimited"><FontAwesomeIcon icon={faInfinity} /></span>
                            ) : (
                              <span className={`stock-value ${item.stock === 0 ? 'stock-danger' : item.stock < 10 ? 'stock-warning' : 'stock-ok'}`}>
                                {item.stock}
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => handleEdit(item)}
                              >
                                <FontAwesomeIcon icon={faEdit} />
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDelete(item)}
                              >
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            </div>
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
                {editingItem ? 'Editar' : 'Nuevo'} {formData.type === 'extra' ? 'Extra' : 'Ingrediente'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              {!editingItem && (
                <div className="form-group">
                  <label>Tipo</label>
                  <div className="complements-type-selector">
                    <button
                      type="button"
                      className={`type-btn${formData.type === 'ingredient' ? ' active' : ''}`}
                      onClick={() => setFormData({ ...formData, type: 'ingredient' })}
                    >
                      <FontAwesomeIcon icon={faFlask} />
                      Ingrediente
                    </button>
                    <button
                      type="button"
                      className={`type-btn${formData.type === 'extra' ? ' active' : ''}`}
                      onClick={() => setFormData({ ...formData, type: 'extra' })}
                    >
                      <FontAwesomeIcon icon={faCubes} />
                      Extra
                    </button>
                  </div>
                </div>
              )}
              <div className="form-group">
                <label>Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Nombre"
                />
              </div>
              <div className="form-group">
                <label>{formData.type === 'extra' ? 'Precio' : 'Precio Adicional'}</label>
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
              <div className={`unlimited-stock-toggle ${formData.unlimited_stock ? 'active' : ''}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={formData.unlimited_stock}
                    onChange={(e) => setFormData({ ...formData, unlimited_stock: e.target.checked })}
                  />
                  <span className="toggle-label">
                    Stock Ilimitado
                  </span>
                </label>
                <span className="toggle-status">
                  {formData.unlimited_stock ? <><FontAwesomeIcon icon={faInfinity} /> Stock Ilimitado</> : 'Completo'}
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
                  className="file-upload-input"
                />
                {formData.imageFile && (
                  <div className="image-preview">
                    <img
                      src={URL.createObjectURL(formData.imageFile)}
                      alt="Preview"
                      className="image-preview-img"
                    />
                    <span className="text-muted text-sm">
                      {formData.imageFile.name}
                    </span>
                  </div>
                )}
                {editingItem && !formData.imageFile && editingItem.image && (
                  <div className="image-preview">
                    <img
                      src={editingItem.image}
                      alt="Imagen actual"
                      className="image-preview-img image-preview-img--current"
                    />
                    <span className="text-muted text-sm">Imagen actual</span>
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-primary btn-full">
                {editingItem ? 'Actualizar' : 'Crear'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Complements;
