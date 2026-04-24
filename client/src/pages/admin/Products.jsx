import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faBox, faGripVertical, faCamera, faFileExcel, faDownload, faUpload, faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { getImageUrl } from '../../config.js';
import CameraModal from '../../components/CameraModal';

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
  const [extras, setExtras] = useState([]);
  const [ingredients, setIngredients] = useState([]);
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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelStep, setExcelStep] = useState('upload'); // 'upload' | 'preview' | 'results'
  const [excelRows, setExcelRows] = useState([]);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelError, setExcelError] = useState('');
  const [excelResults, setExcelResults] = useState(null);
  const excelFileRef = useRef(null);

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
      const [productsRes, categoriesRes, extrasRes, ingredientsRes] = await Promise.all([
        fetch(`/api/products?store_id=${selectedStore.id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: abortController.signal
        }),
        fetch(`/api/categories?store_id=${selectedStore.id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: abortController.signal
        }),
        fetch(`/api/extras?store_id=${selectedStore.id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: abortController.signal
        }),
        fetch(`/api/ingredients?store_id=${selectedStore.id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: abortController.signal
        })
      ]);

      const [productsData, categoriesData, extrasData, ingredientsData] = await Promise.all([
        productsRes.json(),
        categoriesRes.json(),
        extrasRes.json(),
        ingredientsRes.json()
      ]);

      const uniqueProducts = productsData.filter((product, index, self) =>
        index === self.findIndex((p) => p.id === product.id)
      );

      setProducts(uniqueProducts);
      setCategories(categoriesData);
      setExtras(Array.isArray(extrasData) ? extrasData : []);
      setIngredients(Array.isArray(ingredientsData) ? ingredientsData : []);
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

  const openExcelModal = () => {
    setExcelStep('upload');
    setExcelRows([]);
    setExcelError('');
    setExcelResults(null);
    setShowExcelModal(true);
  };

  const downloadTemplate = () => {
    const token = localStorage.getItem('token');
    const a = document.createElement('a');
    a.href = `/api/products/excel-template`;
    a.download = 'plantilla_productos.xlsx';
    // Need auth header — fetch and blob it
    fetch('/api/products/excel-template', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
  };

  const handleExcelFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setExcelError('');
    setExcelLoading(true);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('store_id', selectedStore.id);
      const res = await fetch('/api/products/excel-preview', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      const data = await res.json();
      if (!res.ok) { setExcelError(data.error || 'Error al leer el archivo'); return; }
      setExcelRows(data.rows);
      setExcelStep('preview');
    } catch {
      setExcelError('Error de conexión al leer el archivo');
    } finally {
      setExcelLoading(false);
      if (excelFileRef.current) excelFileRef.current.value = '';
    }
  };

  const handleExcelImport = async () => {
    setExcelLoading(true);
    setExcelError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/products/excel-import', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStore.id, rows: excelRows })
      });
      const data = await res.json();
      if (!res.ok) { setExcelError(data.error || 'Error al importar'); return; }
      setExcelResults(data);
      setExcelStep('results');
      fetchAll();
    } catch {
      setExcelError('Error de conexión al importar');
    } finally {
      setExcelLoading(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleExtrasDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = extras.findIndex(e => e.id === active.id);
    const newIndex = extras.findIndex(e => e.id === over.id);
    const reordered = arrayMove(extras, oldIndex, newIndex);
    setExtras(reordered);
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/extras/reorder', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStore.id, items: reordered.map((item, idx) => ({ id: item.id, sort_order: idx })) }),
      });
    } catch (err) { console.error('Error guardando orden extras:', err); }
  };

  const handleIngredientsDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ingredients.findIndex(i => i.id === active.id);
    const newIndex = ingredients.findIndex(i => i.id === over.id);
    const reordered = arrayMove(ingredients, oldIndex, newIndex);
    setIngredients(reordered);
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/ingredients/reorder', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: selectedStore.id, items: reordered.map((item, idx) => ({ id: item.id, sort_order: idx })) }),
      });
    } catch (err) { console.error('Error guardando orden ingredientes:', err); }
  };

  function ComplementSortableRow({ item }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
    return (
      <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: '#f9f9f9', borderRadius: '8px', marginBottom: '4px', border: '1px solid #e0e0e0' }}>
        <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#aaa', padding: '0 2px', flexShrink: 0 }}>
          <FontAwesomeIcon icon={faGripVertical} />
        </div>
        <span style={{ flex: 1, fontSize: '13px', fontWeight: '600' }}>{item.name}</span>
        {Number(item.price) > 0 && <span style={{ fontSize: '12px', color: '#888' }}>${Number(item.price).toFixed(2)}</span>}
      </div>
    );
  }

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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={openExcelModal} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FontAwesomeIcon icon={faFileExcel} />
            Importar Excel
          </button>
          <button className="btn btn-primary" onClick={openModal}>
            <FontAwesomeIcon icon={faPlus} />
            Nuevo Producto
          </button>
        </div>
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
          <div className="modal" onClick={(e) => e.stopPropagation()} ref={(el) => { if (el) setTimeout(() => { if (document.activeElement) document.activeElement.blur(); }, 50); }}>
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
                  autoFocus={false}
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
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) setFormData({ ...formData, imageFile: file });
                    }}
                    className="file-input"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => setCameraOpen(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: '700', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    <FontAwesomeIcon icon={faCamera} />
                    Tomar foto
                  </button>
                </div>
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
                  <>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label>Max. extras por cliente (0 = ilimitado)</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.max_extras}
                        onChange={(e) => setFormData({ ...formData, max_extras: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    {extras.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', color: '#666', marginBottom: '6px', display: 'block' }}>Orden de extras (arrastra para reordenar)</label>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleExtrasDragEnd}>
                          <SortableContext items={extras.map(e => e.id)} strategy={verticalListSortingStrategy}>
                            {extras.map(item => <ComplementSortableRow key={item.id} item={item} />)}
                          </SortableContext>
                        </DndContext>
                      </div>
                    )}
                  </>
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
                  <>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label>Max. complementos por cliente (0 = ilimitado)</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.max_ingredients}
                        onChange={(e) => setFormData({ ...formData, max_ingredients: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    {ingredients.length > 0 && (
                      <div style={{ marginBottom: '4px' }}>
                        <label style={{ fontSize: '12px', color: '#666', marginBottom: '6px', display: 'block' }}>Orden de complementos (arrastra para reordenar)</label>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleIngredientsDragEnd}>
                          <SortableContext items={ingredients.map(i => i.id)} strategy={verticalListSortingStrategy}>
                            {ingredients.map(item => <ComplementSortableRow key={item.id} item={item} />)}
                          </SortableContext>
                        </DndContext>
                      </div>
                    )}
                  </>
                )}
              </div>

              <button type="submit" className="btn btn-primary btn-full">
                {editingProduct ? 'Actualizar' : 'Crear'}
              </button>
            </form>
          </div>
        </div>
      )}

      {cameraOpen && (
        <CameraModal
          onCapture={(file) => { setFormData(prev => ({ ...prev, imageFile: file })); setCameraOpen(false); }}
          onClose={() => setCameraOpen(false)}
        />
      )}

      {showExcelModal && (
        <div className="modal-overlay" onClick={() => setShowExcelModal(false)}>
          <div className="modal" style={{ maxWidth: '680px', width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <FontAwesomeIcon icon={faFileExcel} style={{ marginRight: '8px', color: '#16a34a' }} />
                Importar Productos desde Excel
              </h2>
              <button className="modal-close" onClick={() => setShowExcelModal(false)}>&times;</button>
            </div>

            {excelError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px' }}>
                {excelError}
              </div>
            )}

            {excelStep === 'upload' && (
              <div>
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '600', color: '#15803d' }}>Formato del archivo Excel:</p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#16a34a', color: '#fff' }}>
                          {['Nombre *', 'Descripcion', 'Precio *', 'Categoria', 'Codigo_Barras'].map(h => (
                            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: '700' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ background: '#f0fdf4' }}>
                          <td style={{ padding: '5px 10px', color: '#374151' }}>Pizza napolitana</td>
                          <td style={{ padding: '5px 10px', color: '#6b7280' }}>Grande con mozzarella</td>
                          <td style={{ padding: '5px 10px', color: '#374151' }}>10.99</td>
                          <td style={{ padding: '5px 10px', color: '#6b7280' }}>Comidas</td>
                          <td style={{ padding: '5px 10px', color: '#6b7280' }}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#15803d' }}>* Columnas requeridas. La categoría debe coincidir exactamente con una existente en tu tienda.</p>
                </div>

                <button
                  onClick={downloadTemplate}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#fff', border: '1.5px solid #16a34a', color: '#16a34a', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', marginBottom: '20px' }}
                >
                  <FontAwesomeIcon icon={faDownload} />
                  Descargar plantilla Excel
                </button>

                <div
                  style={{ border: '2px dashed #d1d5db', borderRadius: '12px', padding: '32px', textAlign: 'center', cursor: 'pointer', background: excelLoading ? '#f9fafb' : '#fff' }}
                  onClick={() => !excelLoading && excelFileRef.current?.click()}
                >
                  {excelLoading ? (
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Leyendo archivo...</p>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faUpload} style={{ fontSize: '28px', color: '#9ca3af', marginBottom: '10px', display: 'block' }} />
                      <p style={{ margin: '0 0 4px', fontWeight: '600', color: '#374151' }}>Haz clic para seleccionar tu archivo</p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>.xlsx, .xls o .csv</p>
                    </>
                  )}
                  <input
                    ref={excelFileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                    onChange={handleExcelFileChange}
                  />
                </div>
              </div>
            )}

            {excelStep === 'preview' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <p style={{ margin: 0, fontWeight: '600', color: '#374151' }}>
                    {excelRows.length} producto{excelRows.length !== 1 ? 's' : ''} encontrado{excelRows.length !== 1 ? 's' : ''}
                  </p>
                  <button onClick={() => { setExcelStep('upload'); setExcelRows([]); }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>
                    Cambiar archivo
                  </button>
                </div>
                <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '16px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
                      <tr>
                        {['Nombre', 'Precio', 'Categoria', 'Descripcion', 'Codigo Barras'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {excelRows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                          <td style={{ padding: '6px 10px', fontWeight: '600', color: '#111' }}>{row.name}</td>
                          <td style={{ padding: '6px 10px', color: '#16a34a', fontWeight: '700' }}>${Number(row.price).toFixed(2)}</td>
                          <td style={{ padding: '6px 10px', color: '#6b7280' }}>{row.category || '—'}</td>
                          <td style={{ padding: '6px 10px', color: '#6b7280', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description || '—'}</td>
                          <td style={{ padding: '6px 10px', color: '#6b7280' }}>{row.barcode || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={handleExcelImport}
                  disabled={excelLoading}
                  className="btn btn-primary btn-full"
                  style={{ opacity: excelLoading ? 0.6 : 1 }}
                >
                  {excelLoading ? 'Importando...' : `Importar ${excelRows.length} producto${excelRows.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}

            {excelStep === 'results' && excelResults && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '24px' }}>
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '12px', padding: '20px 28px' }}>
                    <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '28px', color: '#16a34a', marginBottom: '6px', display: 'block' }} />
                    <div style={{ fontSize: '32px', fontWeight: '800', color: '#15803d' }}>{excelResults.created}</div>
                    <div style={{ fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>Importados</div>
                  </div>
                  {excelResults.skipped > 0 && (
                    <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: '12px', padding: '20px 28px' }}>
                      <FontAwesomeIcon icon={faTimesCircle} style={{ fontSize: '28px', color: '#ca8a04', marginBottom: '6px', display: 'block' }} />
                      <div style={{ fontSize: '32px', fontWeight: '800', color: '#a16207' }}>{excelResults.skipped}</div>
                      <div style={{ fontSize: '13px', color: '#ca8a04', fontWeight: '600' }}>Omitidos</div>
                    </div>
                  )}
                </div>
                {excelResults.errors.length > 0 && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px', marginBottom: '16px', textAlign: 'left' }}>
                    <p style={{ margin: '0 0 8px', fontWeight: '700', color: '#b91c1c', fontSize: '13px' }}>Errores:</p>
                    {excelResults.errors.map((e, i) => (
                      <p key={i} style={{ margin: '0 0 4px', fontSize: '12px', color: '#b91c1c' }}>
                        <strong>{e.name}</strong>: {e.error}
                      </p>
                    ))}
                  </div>
                )}
                <button className="btn btn-primary" onClick={() => setShowExcelModal(false)}>
                  Listo
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default Products;
