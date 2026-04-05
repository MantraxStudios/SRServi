import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faBox } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

function Products() {
  const { selectedStore } = useStore();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    barcode: '',
    name: '',
    description: '',
    price: '',
    category_id: '',
    image: '',
    stock: '',
    unlimited_stock: false
  });
  const [error, setError] = useState('');

  const fetchAllRef = useRef(false);

  useEffect(() => {
    if (!selectedStore) {
      setLoading(false);
      setProducts([]);
      setCategories([]);
      return;
    }

    if (fetchAllRef.current) return;
    fetchAllRef.current = true;
    setLoading(true);
    fetchAll();

    return () => {
      fetchAllRef.current = false;
    };
  }, [selectedStore]);

  const fetchAll = async () => {
    if (!selectedStore) {
      setLoading(false);
      return;
    }
    
    const abortController = new AbortController();
    
    try {
      const token = localStorage.getItem('token');
      const [productsRes, categoriesRes] = await Promise.all([
        fetch(`/api/products?store_id=${selectedStore.id}`, { 
          headers: { 'Authorization': `Bearer ${token}` },
          signal: abortController.signal 
        }),
        fetch(`/api/categories?store_id=${selectedStore.id}`, { 
          headers: { 'Authorization': `Bearer ${token}` },
          signal: abortController.signal 
        })
      ]);

      const [productsData, categoriesData] = await Promise.all([
        productsRes.json(),
        categoriesRes.json()
      ]);

      const uniqueProducts = productsData.filter((product, index, self) =>
        index === self.findIndex((p) => p.id === product.id)
      );

      setProducts(uniqueProducts);
      setCategories(categoriesData);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching data:', error);
      }
    } finally {
      setLoading(false);
    }

    return () => abortController.abort();
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
      formDataToSend.append('barcode', formData.barcode || '');
      formDataToSend.append('description', formData.description);
      formDataToSend.append('price', parseFloat(formData.price) || 0);
      formDataToSend.append('category_id', formData.category_id || '');
      
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

      const productData = await response.json();
      const productId = productData.id;

      await fetch(`/api/inventory/${productId}/unlimited`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ unlimited_stock: formData.unlimited_stock, store_id: selectedStore.id })
      });

      if (formData.stock !== '') {
        await fetch(`/api/inventory/${productId}/stock`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ stock: parseInt(formData.stock) || 0, store_id: selectedStore.id })
        });
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
      barcode: product.barcode || '',
      description: product.description || '',
      price: product.price?.toString() || '0',
      category_id: product.category_id || '',
      image: product.image || '',
      stock: product.stock?.toString() || '0',
      unlimited_stock: product.unlimited_stock || false
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
      barcode: '',
      name: '',
      description: '',
      price: '',
      category_id: '',
      image: '',
      stock: '',
      unlimited_stock: false
    });
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
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
                    <th>Barcode</th>
                    <th>Categoria</th>
                    <th>Precio</th>
                    <th>Stock</th>
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
                    <td style={{ fontFamily: 'monospace', fontSize: '14px' }}>{product.barcode || '-'}</td>
                    <td>{product.category_name || '-'}</td>
                    <td>${Number(product.price).toFixed(2)}</td>
                    <td>
                      {product.unlimited_stock ? (
                        <span style={{
                          fontWeight: '700',
                          color: '#28a745',
                          fontSize: '18px'
                        }}>
                          ∞
                        </span>
                      ) : (
                        <span style={{
                          fontWeight: '700',
                          color: product.stock === 0 ? '#dc3545' : product.stock < 10 ? '#ffc107' : '#28a745'
                        }}>
                          {product.stock}
                        </span>
                      )}
                    </td>
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
                <label>Codigo de Barras</label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="Escanea o escribe el codigo de barras"
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
                  <label>Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="0"
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
                    {formData.unlimited_stock ? '∞ Sin limite de ventas' : 'Con limite de stock'}
                  </span>
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
