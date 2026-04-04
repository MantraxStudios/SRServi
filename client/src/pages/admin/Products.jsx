import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faBox } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

function Products() {
  const { selectedStore } = useStore();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [extras, setExtras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    image: '',
    ingredients: [],
    extras: []
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedStore) {
      setLoading(true);
      fetchAll();
    } else {
      setLoading(false);
      setProducts([]);
      setCategories([]);
      setIngredients([]);
      setExtras([]);
    }
  }, [selectedStore]);

  const fetchAll = async () => {
    if (!selectedStore) {
      setLoading(false);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const [productsRes, categoriesRes, ingredientsRes, extrasRes] = await Promise.all([
        fetch(`/api/products?store_id=${selectedStore.id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/categories?store_id=${selectedStore.id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/ingredients?store_id=${selectedStore.id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/extras?store_id=${selectedStore.id}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const [productsData, categoriesData, ingredientsData, extrasData] = await Promise.all([
        productsRes.json(),
        categoriesRes.json(),
        ingredientsRes.json(),
        extrasRes.json()
      ]);

      setProducts(productsData);
      setCategories(categoriesData);
      setIngredients(ingredientsData);
      setExtras(extrasData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const token = localStorage.getItem('token');
      const url = editingProduct 
        ? `/api/products/${editingProduct.id}` 
        : '/api/products';
      
      const formDataToSend = new FormData();
      formDataToSend.append('store_id', selectedStore.id);
      formDataToSend.append('name', formData.name);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('price', parseFloat(formData.price) || 0);
      formDataToSend.append('category_id', formData.category_id || '');
      formDataToSend.append('ingredients', JSON.stringify(formData.ingredients));
      formDataToSend.append('extras', JSON.stringify(formData.extras));
      
      if (formData.imageFile) {
        formDataToSend.append('image', formData.imageFile);
      }
      
      const response = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });

      if (!response.ok) {
        throw new Error('Error al guardar el producto');
      }

      setShowModal(false);
      setEditingProduct(null);
      resetForm();
      fetchAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price?.toString() || '0',
      category_id: product.category_id || '',
      image: product.image || '',
      ingredients: product.ingredients?.map(i => ({
        ingredient_id: i.id,
        is_required: i.is_required,
        max_selections: i.max_selections
      })) || [],
      extras: product.extras?.map(e => e.id) || []
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Estas seguro de eliminar este producto?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/products/${id}?store_id=${selectedStore.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Error al eliminar el producto');
      }

      fetchAll();
    } catch (error) {
      alert(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      category_id: '',
      image: '',
      ingredients: [],
      extras: []
    });
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const toggleIngredient = (ingredientId) => {
    setFormData(prev => {
      const exists = prev.ingredients.find(i => i.ingredient_id === ingredientId);
      if (exists) {
        return {
          ...prev,
          ingredients: prev.ingredients.filter(i => i.ingredient_id !== ingredientId)
        };
      } else {
        return {
          ...prev,
          ingredients: [...prev.ingredients, { ingredient_id: ingredientId, is_required: false, max_selections: 1 }]
        };
      }
    });
  };

  const toggleExtra = (extraId) => {
    setFormData(prev => {
      const exists = prev.extras.includes(extraId);
      if (exists) {
        return {
          ...prev,
          extras: prev.extras.filter(id => id !== extraId)
        };
      } else {
        return {
          ...prev,
          extras: [...prev.extras, extraId]
        };
      }
    });
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <>
      <header className="admin-header">
        <h1>Productos</h1>
        <button className="btn btn-primary" onClick={openModal}>
          <FontAwesomeIcon icon={faPlus} />
          Nuevo Producto
        </button>
      </header>
      <div className="admin-main">
        {error && <div className="error">{error}</div>}

        <div className="card">
          {products.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
              No hay productos. Crea tu primer producto.
            </p>
          ) : (
            <div className="admin-table-wrapper">
              <table className="table products-table">
                <thead>
                  <tr>
                    <th>Imagen</th>
                    <th>Nombre</th>
                    <th>Categoria</th>
                    <th>Precio</th>
                    <th>Ingredientes</th>
                    <th>Extras</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                {products.map(product => (
                  <tr key={product.id}>
                    <td>
                      {product.image ? (
                        <img 
                          src={product.image.startsWith('http') ? product.image : `http://localhost:3001${product.image}`}
                          alt={product.name}
                          style={{
                            width: '50px',
                            height: '50px',
                            objectFit: 'cover',
                            borderRadius: 'var(--radius-sm)',
                            border: '2px solid var(--gray)'
                          }}
                        />
                      ) : (
                        <FontAwesomeIcon icon={faBox} style={{ fontSize: '24px', color: '#ccc' }} />
                      )}
                    </td>
                    <td style={{ fontWeight: '600' }}>{product.name}</td>
                    <td>{product.category_name || '-'}</td>
                    <td>${Number(product.price).toFixed(2)}</td>
                    <td>{product.ingredients?.length || 0}</td>
                    <td>{product.extras?.length || 0}</td>
                    <td>
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleEdit(product)}
                        style={{ marginRight: '8px' }}
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(product.id)}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
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
                  placeholder="Nombre del producto"
                />
              </div>

              <div className="form-group">
                <label>Descripcion</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="2"
                  placeholder="Descripcion del producto"
                />
              </div>

              <div className="form-group">
                <label>Imagen del Producto</label>
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
                        width: '100px', 
                        height: '100px', 
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
                {editingProduct && !formData.imageFile && formData.image && (
                  <div style={{ marginTop: '10px' }}>
                    <img 
                      src={formData.image} 
                      alt="Imagen actual" 
                      style={{ 
                        width: '100px', 
                        height: '100px', 
                        objectFit: 'cover',
                        borderRadius: 'var(--radius-sm)',
                        border: '2px solid var(--gray)'
                      }} 
                    />
                    <p style={{ color: '#666', fontSize: '12px', marginTop: '5px' }}>Imagen actual</p>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label>Precio</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    placeholder="0.00"
                  />
                </div>

                <div className="form-group">
                  <label>Categoria</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  >
                    <option value="">Sin categoria</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {ingredients.length > 0 && (
                <div className="form-group">
                  <label>Ingredientes</label>
                  <div style={{ maxHeight: '250px', overflowY: 'auto', border: '2px solid #ccc', borderRadius: '4px', padding: '10px' }}>
                    {ingredients.map(ing => {
                      const selectedIng = formData.ingredients.find(i => i.ingredient_id === ing.id);
                      return (
                        <div 
                          key={ing.id}
                          className="option-item"
                          style={{ 
                            border: selectedIng 
                              ? '2px solid #D4AF37' 
                              : '2px solid #ccc',
                            backgroundColor: selectedIng
                              ? 'rgba(212, 175, 55, 0.1)'
                              : 'transparent',
                            padding: '12px',
                            marginBottom: '8px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input 
                              type="checkbox" 
                              checked={!!selectedIng}
                              onChange={() => toggleIngredient(ing.id)}
                              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                            />
                            <div className="option-item-info" style={{ flex: 1 }}>
                              <div className="option-item-name">{ing.name}</div>
                              {Number(ing.price) > 0 && (
                                <div className="option-item-price">+${Number(ing.price).toFixed(2)}</div>
                              )}
                            </div>
                            {selectedIng && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ fontSize: '14px', color: '#666', fontWeight: '600' }}>Max:</label>
                                <select
                                  value={selectedIng.max_selections || 1}
                                  onChange={(e) => {
                                    const newMax = parseInt(e.target.value);
                                    setFormData(prev => ({
                                      ...prev,
                                      ingredients: prev.ingredients.map(i => 
                                        i.ingredient_id === ing.id 
                                          ? { ...i, max_selections: newMax }
                                          : i
                                      )
                                    }));
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    border: '2px solid #D4AF37',
                                    backgroundColor: '#fff',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    minWidth: '60px'
                                  }}
                                >
                                  {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(num => (
                                    <option key={num} value={num}>{num}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                          {selectedIng && (
                            <div style={{ marginTop: '8px', marginLeft: '32px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input 
                                type="checkbox"
                                checked={selectedIng.is_required || false}
                                onChange={(e) => {
                                  setFormData(prev => ({
                                    ...prev,
                                    ingredients: prev.ingredients.map(i => 
                                      i.ingredient_id === ing.id 
                                        ? { ...i, is_required: e.target.checked }
                                        : i
                                    )
                                  }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                              <label style={{ fontSize: '13px', color: '#D35400', fontWeight: '600', cursor: 'pointer' }}>
                                Requerido
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {extras.length > 0 && (
                <div className="form-group">
                  <label>Extras</label>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '2px solid #ccc', borderRadius: '4px', padding: '10px' }}>
                    {extras.map(extra => (
                      <div 
                        key={extra.id}
                        className="option-item"
                        style={{ 
                          border: formData.extras.includes(extra.id) 
                            ? '2px solid #D4AF37' 
                            : '2px solid #ccc',
                          backgroundColor: formData.extras.includes(extra.id)
                            ? 'rgba(212, 175, 55, 0.1)'
                            : 'transparent'
                        }}
                        onClick={() => toggleExtra(extra.id)}
                      >
                        <input 
                          type="checkbox" 
                          checked={formData.extras.includes(extra.id)}
                          onChange={() => toggleExtra(extra.id)}
                        />
                        <div className="option-item-info">
                            <div className="option-item-name">{extra.name}</div>
                            {Number(extra.price) > 0 && (
                              <div className="option-item-price">+${Number(extra.price).toFixed(2)}</div>
                            )}
                          </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                {editingProduct ? 'Actualizar' : 'Crear'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Products;
