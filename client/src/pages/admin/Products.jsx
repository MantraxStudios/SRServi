import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faBox, faGripVertical } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { getImageUrl } from '../../config.js';

const API = 'https://srservi2.srautomatic.com';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
    unlimited_stock: false,
    has_extras: false,
    has_ingredients: false,
    max_extras: '',
    max_ingredients: ''
  });
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState(null);

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
      formDataToSend.append('has_extras', formData.has_extras);
      formDataToSend.append('has_ingredients', formData.has_ingredients);
      formDataToSend.append('max_extras', formData.has_extras ? (parseInt(formData.max_extras) || 0) : 0);
      formDataToSend.append('max_ingredients', formData.has_ingredients ? (parseInt(formData.max_ingredients) || 0) : 0);

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
      unlimited_stock: product.unlimited_stock || false,
      has_extras: product.has_extras || false,
      has_ingredients: product.has_ingredients || false,
      max_extras: product.max_extras?.toString() || '',
      max_ingredients: product.max_ingredients?.toString() || ''
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
      unlimited_stock: false,
      has_extras: false,
      has_ingredients: false,
      max_extras: '',
      max_ingredients: ''
    });
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (active.id !== over?.id) {
      const oldIndex = products.findIndex(p => p.id === active.id);
      const newIndex = products.findIndex(p => p.id === over.id);

      const newProducts = arrayMove(products, oldIndex, newIndex);
      setProducts(newProducts);

      try {
        const token = localStorage.getItem('token');
        const payload = {
          store_id: selectedStore.id,
          products: newProducts.map(p => ({ id: p.id }))
        };
        console.log('Sending order update:', payload);

        const response = await fetch(API + '/api/products/order', {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Response:', response.status, data);
      } catch (error) {
        console.error('Error saving order:', error);
      }
    }
  };

  function SortableProduct({ product }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
      isOver
    } = useSortable({ id: product.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      zIndex: isDragging ? 1000 : 1
    };

    const isOutOfStock = !product.unlimited_stock && product.stock === 0;

    const cardClass = [
      'product-card-dnd',
      isOutOfStock ? 'is-out-of-stock' : '',
      isOver ? 'is-over' : ''
    ].filter(Boolean).join(' ');

    return (
      <div
        ref={setNodeRef}
        style={style}
      >
        <div className={cardClass}>
          <div
            className="drag-handle"
            {...attributes}
            {...listeners}
          >
            <FontAwesomeIcon icon={faGripVertical} className="drag-handle-icon" />
          </div>

          {isOutOfStock && (
            <div className="out-of-stock-badge">
              Agotado
            </div>
          )}

          <div className="product-image-container">
            {product.image ? (
              <img
                src={getImageUrl(product.image)}
                alt={product.name}
              />
            ) : (
              <FontAwesomeIcon icon={faBox} className="product-image-placeholder" />
            )}
          </div>

          <div className="product-card-body">
            <h3 className="product-card-name">
              {product.name}
            </h3>
            <p className="product-card-price">
              ${Number(product.price).toFixed(2)}
            </p>

            <div className="product-card-actions">
              <button
                onClick={() => handleEdit(product)}
                className="btn btn-secondary btn-sm"
              >
                <FontAwesomeIcon icon={faEdit} />
                Editar
              </button>
              <button
                onClick={() => handleDelete(product.id)}
                className="btn btn-danger btn-sm"
              >
                <FontAwesomeIcon icon={faTrash} />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            <div className="empty-state">
              <p className="empty-state-text">
                No hay productos. Crea tu primer producto.
              </p>
            </div>
          ) : (
            <div className="drag-hint-bar">
              <div className="drag-hint">
                <FontAwesomeIcon icon={faGripVertical} className="drag-handle-icon" />
                <span className="drag-hint-text">
                  Arrastra los productos para cambiar su orden en la tienda
                </span>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={products.map(p => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="product-grid-dnd">
                    {products.map(product => (
                      <SortableProduct key={product.id} product={product} />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeId ? (
                    <div className="drag-overlay-card">
                      <div className="product-image-container">
                        {products.find(p => p.id === activeId)?.image ? (
                          <img
                            src={products.find(p => p.id === activeId).image.startsWith('http')
                              ? products.find(p => p.id === activeId).image
                              : getImageUrl(products.find(p => p.id === activeId).image)}
                            alt={products.find(p => p.id === activeId)?.name}
                          />
                        ) : (
                          <FontAwesomeIcon icon={faBox} className="product-image-placeholder" />
                        )}
                      </div>
                      <div className="product-card-body">
                        <h3 className="product-card-name">
                          {products.find(p => p.id === activeId)?.name}
                        </h3>
                        <p className="product-card-price">
                          ${Number(products.find(p => p.id === activeId)?.price || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
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
                  className="file-input"
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
                {editingProduct && !formData.imageFile && formData.image && (
                  <div className="image-preview">
                    <img
                      src={formData.image}
                      alt="Imagen actual"
                      className="image-preview-img--current"
                    />
                    <p className="text-muted text-xs">Imagen actual</p>
                  </div>
                )}
              </div>

              <div className="form-grid-2">
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

                <div className={`stock-toggle ${formData.unlimited_stock ? 'active' : 'inactive'}`}>
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.unlimited_stock}
                      onChange={(e) => setFormData({ ...formData, unlimited_stock: e.target.checked })}
                    />
                    <span className="stock-toggle-label">
                      Stock Ilimitado
                    </span>
                  </label>
                  <span className="stock-toggle-status">
                    {formData.unlimited_stock ? 'Stock Ilimitado' : 'Con limite de stock'}
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

              <div style={{ border: '2px solid #e0e0e0', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '700' }}>Complementos del producto</h4>

                <div className={`stock-toggle ${formData.has_extras ? 'active' : 'inactive'}`} style={{ marginBottom: '8px' }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.has_extras}
                      onChange={(e) => setFormData({ ...formData, has_extras: e.target.checked })}
                    />
                    <span className="stock-toggle-label">Lleva Extras</span>
                  </label>
                  <span className="stock-toggle-status">
                    {formData.has_extras ? 'Activado' : 'Desactivado'}
                  </span>
                </div>
                {formData.has_extras && (
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label>Max. extras por cliente (0 = ilimitado)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.max_extras}
                      onChange={(e) => setFormData({ ...formData, max_extras: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                )}

                <div className={`stock-toggle ${formData.has_ingredients ? 'active' : 'inactive'}`} style={{ marginBottom: '8px' }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.has_ingredients}
                      onChange={(e) => setFormData({ ...formData, has_ingredients: e.target.checked })}
                    />
                    <span className="stock-toggle-label">Lleva Complementos</span>
                  </label>
                  <span className="stock-toggle-status">
                    {formData.has_ingredients ? 'Activado' : 'Desactivado'}
                  </span>
                </div>
                {formData.has_ingredients && (
                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label>Max. complementos por cliente (0 = ilimitado)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.max_ingredients}
                      onChange={(e) => setFormData({ ...formData, max_ingredients: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary btn-full">
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
