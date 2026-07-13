import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faBox, faGripVertical, faCamera, faFileExcel, faDownload, faUpload, faCheckCircle, faTimesCircle, faSearch, faFire } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { getImageUrl } from '../../config.js';
import CameraModal from '../../components/CameraModal';
import RecipeEditor from '../../components/RecipeEditor';

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
  const { selectedStore, fetchStores } = useStore();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [extras, setExtras] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [complementGroups, setComplementGroups] = useState([]);
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
    image_url: '',
    stock: '',
    unlimited_stock: false,
    has_extras: false,
    has_ingredients: false,
    max_extras: '',
    max_ingredients: '',
    show_description: true,
    show_prep_time: true,
    complement_group_ids: []
  });
  const [error, setError] = useState('');
  // Edición inline de los textos personalizables (igual que en Settings)
  const [labelEdit, setLabelEdit] = useState(null); // 'complements' | 'extras' | null
  const [labelValue, setLabelValue] = useState('');
  const [labelSaving, setLabelSaving] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelStep, setExcelStep] = useState('upload'); // 'upload' | 'preview' | 'results'
  const [excelRows, setExcelRows] = useState([]);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelError, setExcelError] = useState('');
  const [excelResults, setExcelResults] = useState(null);
  const excelFileRef = useRef(null);
  const recipeEditorRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bestSellersMode, setBestSellersMode] = useState(false);
  const [bestSellersRange, setBestSellersRange] = useState('month');
  const [topProducts, setTopProducts] = useState([]);
  // Mini-modal para crear sección rápida desde el editor de producto
  const [showNewSectionModal, setShowNewSectionModal] = useState(false);
  const [newSectionData, setNewSectionData] = useState({ name: '', required: false, max_options: '', options: [{ name: '', price: '' }] });
  const [newSectionSaving, setNewSectionSaving] = useState(false);
  const [newSectionError, setNewSectionError] = useState('');

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
      const [productsRes, categoriesRes, extrasRes, ingredientsRes, groupsRes] = await Promise.all([
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
        }),
        fetch(`/api/complement-groups?store_id=${selectedStore.id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: abortController.signal
        })
      ]);

      const [productsData, categoriesData, extrasData, ingredientsData, groupsData] = await Promise.all([
        productsRes.json(),
        categoriesRes.json(),
        extrasRes.json(),
        ingredientsRes.json(),
        groupsRes.json()
      ]);

      const uniqueProducts = productsData.filter((product, index, self) =>
        index === self.findIndex((p) => p.id === product.id)
      );

      setProducts(uniqueProducts);
      setCategories(categoriesData);
      setExtras(Array.isArray(extrasData) ? extrasData : []);
      setIngredients(Array.isArray(ingredientsData) ? ingredientsData : []);
      setComplementGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching data:', error);
      }
    } finally {
      setLoading(false);
    }

    return () => abortController.abort();
  };

  const fetchTopProducts = async (range = bestSellersRange) => {
    if (!selectedStore) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/analytics/top-products?store_id=${selectedStore.id}&range=${range}&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setTopProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching top products:', err);
    }
  };

  useEffect(() => {
    if (bestSellersMode && selectedStore) {
      fetchTopProducts(bestSellersRange);
    }
  }, [bestSellersMode, bestSellersRange]);

  const getDisplayProducts = () => {
    if (bestSellersMode) {
      const salesMap = {};
      topProducts.forEach(tp => { salesMap[tp.id] = tp; });
      return products
        .filter(p => salesMap[p.id])
        .map(p => ({ ...p, total_sold: Number(salesMap[p.id].total_sold), revenue: Number(salesMap[p.id].revenue) }))
        .sort((a, b) => b.total_sold - a.total_sold);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return products.filter(p => p.name.toLowerCase().includes(q));
    }
    return products;
  };

  const displayProducts = getDisplayProducts();

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
      formDataToSend.append('show_description', formData.show_description);
      formDataToSend.append('show_prep_time', formData.show_prep_time);
      formDataToSend.append('complement_group_ids', JSON.stringify(formData.complement_group_ids || []));

      if (formData.imageFile) {
        formDataToSend.append('image', formData.imageFile);
      } else if (formData.image_url) {
        formDataToSend.append('image_url', formData.image_url);
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

      await recipeEditorRef.current?.save(productId);

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

      // Update products state immediately without waiting for fetchAll
      const stock = parseInt(formData.stock) || 0;
      const unlimited_stock = formData.unlimited_stock;
      if (editingProduct) {
        setProducts(prev => prev.map(p =>
          p.id === productId
            ? { ...p, ...productData, stock, unlimited_stock }
            : p
        ));
      } else {
        setProducts(prev => [...prev, { ...productData, stock, unlimited_stock }]);
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
      image_url: product.image?.startsWith('http') ? product.image : '',
      stock: product.stock?.toString() || '0',
      unlimited_stock: product.unlimited_stock || false,
      has_extras: product.has_extras || false,
      has_ingredients: product.has_ingredients || false,
      max_extras: product.max_extras?.toString() || '',
      max_ingredients: product.max_ingredients?.toString() || '',
      show_description: product.show_description !== false,
      show_prep_time: product.show_prep_time !== false,
      complement_group_ids: Array.isArray(product.complement_groups)
        ? product.complement_groups.map(g => g.id)
        : (Array.isArray(product.complement_group_ids) ? product.complement_group_ids : [])
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

      setProducts(prev => prev.filter(p => p.id !== id));
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
      max_ingredients: '',
      show_description: true,
      show_prep_time: true,
      complement_group_ids: []
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

  const openLabelEdit = (which) => {
    setError('');
    setLabelEdit(which);
    setLabelValue(
      which === 'extras'
        ? (selectedStore?.extras_label || '')
        : (selectedStore?.complements_label || '')
    );
  };

  const saveLabel = async () => {
    if (!selectedStore) return;
    setLabelSaving(true);
    try {
      const token = localStorage.getItem('token');
      // Enviamos todos los campos del store para no sobreescribir el resto
      const body = {
        name: selectedStore.name,
        primary_color: selectedStore.primary_color,
        secondary_color: selectedStore.secondary_color,
        accent_color: selectedStore.accent_color,
        header_color: selectedStore.header_color,
        currency_code: selectedStore.currency_code,
        currency_symbol: selectedStore.currency_symbol,
        currency_name: selectedStore.currency_name,
        smart_mode: selectedStore.smart_mode,
        inactivity_timeout: selectedStore.inactivity_timeout,
        hide_decimals: selectedStore.hide_decimals,
        show_top_selling: selectedStore.show_top_selling,
        paid_order_status: selectedStore.paid_order_status,
        complements_label: selectedStore.complements_label || '',
        extras_label: selectedStore.extras_label || '',
      };
      if (labelEdit === 'extras') body.extras_label = labelValue;
      else body.complements_label = labelValue;

      const res = await fetch(`/api/stores/${selectedStore.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Error al guardar el texto');
      await fetchStores();
      setLabelEdit(null);
    } catch (err) {
      setError(err.message || 'Error al guardar el texto');
    } finally {
      setLabelSaving(false);
    }
  };

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

  const handleDeleteSection = async (groupId) => {
    if (!confirm('¿Eliminar esta sección? Se quitará de todos los productos que la usen.')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/complement-groups/${groupId}?store_id=${selectedStore.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al eliminar la sección');
      setComplementGroups(prev => prev.filter(g => g.id !== groupId));
      setFormData(prev => ({
        ...prev,
        complement_group_ids: (prev.complement_group_ids || []).filter(id => id !== groupId)
      }));
    } catch (err) {
      alert(err.message || 'Error al eliminar la sección');
    }
  };

  const handleCreateSectionInline = async () => {
    if (!newSectionData.name.trim()) {
      setNewSectionError('El nombre de la sección es obligatorio.');
      return;
    }
    if (newSectionData.options.some(o => !o.name.trim())) {
      setNewSectionError('Todas las opciones deben tener nombre.');
      return;
    }
    setNewSectionSaving(true);
    setNewSectionError('');
    try {
      const token = localStorage.getItem('token');
      const body = {
        store_id: selectedStore.id,
        name: newSectionData.name.trim(),
        required: newSectionData.required,
        max_options: parseInt(newSectionData.max_options) || 0,
        options: newSectionData.options.filter(o => o.name.trim()).map(o => ({
          name: o.name.trim(),
          price: parseFloat(o.price) || 0
        }))
      };
      const res = await fetch('/api/complement-groups', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Error al crear la sección');
      const created = await res.json();
      // Add to local list and auto-check it for this product
      setComplementGroups(prev => [...prev, created]);
      setFormData(prev => ({
        ...prev,
        complement_group_ids: [...(prev.complement_group_ids || []), created.id]
      }));
      setShowNewSectionModal(false);
      setNewSectionData({ name: '', required: false, max_options: '', options: [{ name: '', price: '' }] });
    } catch (err) {
      setNewSectionError(err.message || 'Error al crear la sección');
    } finally {
      setNewSectionSaving(false);
    }
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
        const response = await fetch(API + '/api/products/order', {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        await response.json();
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

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
            <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); if (bestSellersMode) setBestSellersMode(false); }}
              style={{
                width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px',
                border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '14px', boxSizing: 'border-box'
              }}
            />
          </div>
          <button
            onClick={() => { setBestSellersMode(!bestSellersMode); if (!bestSellersMode) setSearchQuery(''); }}
            style={{
              padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '14px',
              background: bestSellersMode ? '#D4AF37' : '#2a2a2a', color: bestSellersMode ? '#000' : '#fff',
              transition: 'all 0.2s'
            }}
          >
            <FontAwesomeIcon icon={faFire} />
            Más vendidos
          </button>
          {bestSellersMode && (
            <div style={{ display: 'flex', gap: '4px' }}>
              {[{ key: 'week', label: 'Semana' }, { key: 'month', label: 'Mes' }, { key: 'year', label: 'Año' }].map(r => (
                <button
                  key={r.key}
                  onClick={() => setBestSellersRange(r.key)}
                  style={{
                    padding: '8px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px',
                    background: bestSellersRange === r.key ? '#D4AF37' : '#2a2a2a',
                    color: bestSellersRange === r.key ? '#000' : '#fff', fontWeight: bestSellersRange === r.key ? 600 : 400
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          {displayProducts.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-text">
                {searchQuery ? 'No se encontraron productos.' : bestSellersMode ? 'No hay ventas en este período.' : 'No hay productos. Crea tu primer producto.'}
              </p>
            </div>
          ) : bestSellersMode ? (
            <div className="product-grid-dnd">
              {displayProducts.map((product, idx) => (
                <div
                  key={product.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                    background: '#1a1a1a', borderRadius: '10px', marginBottom: '6px',
                    border: idx < 3 ? '1px solid #D4AF37' : '1px solid #333'
                  }}
                >
                  <span style={{
                    fontWeight: 700, fontSize: idx < 3 ? '20px' : '16px', minWidth: '32px', textAlign: 'center',
                    color: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : '#888'
                  }}>
                    #{idx + 1}
                  </span>
                  <div className="product-image-container" style={{ width: '50px', height: '50px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden' }}>
                    {product.image ? (
                      <img
                        src={product.image.startsWith('http') ? product.image : getImageUrl(product.image)}
                        alt={product.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2a2a2a' }}>
                        <FontAwesomeIcon icon={faBox} style={{ color: '#555' }} />
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
                    <div style={{ color: '#888', fontSize: '13px' }}>${Number(product.price || 0).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: '#D4AF37' }}>{product.total_sold} vendidos</div>
                    <div style={{ color: '#aaa', fontSize: '13px' }}>${Number(product.revenue || 0).toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button className="btn btn-sm" onClick={() => openEdit(product)} style={{ padding: '6px 10px', background: '#2a2a2a', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff' }}>
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="drag-hint-bar">
              {!searchQuery && (
                <div className="drag-hint">
                  <FontAwesomeIcon icon={faGripVertical} className="drag-handle-icon" />
                  <span className="drag-hint-text">
                    Arrastra los productos para cambiar su orden en la tienda
                  </span>
                </div>
              )}

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={displayProducts.map(p => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="product-grid-dnd">
                    {displayProducts.map(product => (
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
        <div className="product-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="product-modal-header">
              <h2 className="product-modal-title">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button className="product-modal-close" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>

            {/* Contenedor scrolleable */}
            <div className="product-modal-body">
              <form onSubmit={handleSubmit} className="product-form">
                
                {/* Sección de Imagen */}
                <div className="product-form-section">
                  <div className="product-image-box">
                    {(formData.imageFile || (editingProduct && formData.image) || formData.image_url) ? (
                      <>
                        <img
                          src={formData.imageFile ? URL.createObjectURL(formData.imageFile) : (formData.image || formData.image_url)}
                          alt="Preview"
                          className="product-image-preview"
                        />
                        <div className="product-image-actions">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) setFormData({ ...formData, imageFile: file });
                            }}
                            id="file-input-main"
                            style={{ display: 'none' }}
                          />
                          <button
                            type="button"
                            onClick={() => document.getElementById('file-input-main')?.click()}
                            className="btn-image-action"
                          >
                            <FontAwesomeIcon icon={faCamera} style={{ marginRight: '6px' }} />
                            Cambiar
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="product-image-placeholder">
                        <div style={{ display: 'flex', gap: 8, flexDirection: 'column', width: '100%' }}>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) setFormData({ ...formData, imageFile: file });
                            }}
                            id="file-input"
                            style={{ display: 'none' }}
                          />
                          <button
                            type="button"
                            onClick={() => document.getElementById('file-input')?.click()}
                            className="btn btn-outline btn-full"
                          >
                            <FontAwesomeIcon icon={faCamera} style={{ marginRight: '6px' }} />
                            Seleccionar imagen
                          </button>
                          <button
                            type="button"
                            onClick={() => setCameraOpen(true)}
                            className="btn btn-outline btn-full"
                          >
                            <FontAwesomeIcon icon={faCamera} style={{ marginRight: '6px' }} />
                            Tomar foto
                          </button>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>O URL:</span>
                            <input
                              type="url"
                              value={formData.image_url}
                              onChange={(e) => setFormData({ ...formData, image_url: e.target.value, imageFile: null })}
                              placeholder="https://ejemplo.com/imagen.jpg"
                              style={{ flex: 1, padding: '6px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13 }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sección Info Básica */}
                <div className="product-form-section">
                  <h3 className="form-section-title">Información Básica</h3>
                  
                  <div className="form-group">
                    <label>Nombre del Producto *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Ej: Pizza Napolitana"
                    />
                  </div>

                  <div className="form-group">
                    <label>Descripción</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows="3"
                      placeholder="Detalles del producto..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Código de Barras</label>
                    <input
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="Escanea o escribe el código"
                    />
                  </div>

                  <div className="form-toggle-card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ flex: 1, margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={formData.show_description}
                        onChange={(e) => setFormData({ ...formData, show_description: e.target.checked })}
                      />
                      <span className="toggle-card-title">Mostrar descripción en la tienda</span>
                    </label>
                  </div>

                  <div className="form-toggle-card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ flex: 1, margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={formData.show_prep_time}
                        onChange={(e) => setFormData({ ...formData, show_prep_time: e.target.checked })}
                      />
                      <span className="toggle-card-title">Mostrar tiempo de preparación en la tienda</span>
                    </label>
                  </div>
                </div>

                {/* Sección Complementos - ARRIBA */}
                <div className="product-form-section">
                  <h3 className="form-section-title">Complementos</h3>

                  <div className="form-toggle-card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ flex: 1, margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={formData.has_extras}
                        onChange={(e) => setFormData({ ...formData, has_extras: e.target.checked })}
                      />
                      <span className="toggle-card-title">Este producto lleva {selectedStore?.extras_label || 'Extras'}</span>
                    </label>
                    <button
                      type="button"
                      title="Editar el texto que ven los clientes (aplica a toda la tienda)"
                      onClick={() => openLabelEdit('extras')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 6, flexShrink: 0 }}
                    >
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                  </div>

                  {labelEdit === 'extras' && (
                    <div className="form-group" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        autoFocus
                        maxLength={100}
                        value={labelValue}
                        onChange={(e) => setLabelValue(e.target.value)}
                        placeholder="Extras"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); saveLabel(); }
                          if (e.key === 'Escape') setLabelEdit(null);
                        }}
                        style={{ flex: 1 }}
                      />
                      <button type="button" className="btn btn-primary" disabled={labelSaving} onClick={saveLabel}>
                        {labelSaving ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => setLabelEdit(null)}>Cancelar</button>
                    </div>
                  )}

                  {formData.has_extras && (
                    <>
                      <div className="form-group">
                        <label>Máx. extras por cliente (0 = ilimitado)</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.max_extras}
                          onChange={(e) => setFormData({ ...formData, max_extras: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      {extras.length > 0 && (
                        <div className="form-group">
                          <label style={{ fontSize: '13px' }}>Orden de extras (arrastra para reordenar)</label>
                          <div className="complementos-list">
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleExtrasDragEnd}>
                              <SortableContext items={extras.map(e => e.id)} strategy={verticalListSortingStrategy}>
                                {extras.map(item => <ComplementSortableRow key={item.id} item={item} />)}
                              </SortableContext>
                            </DndContext>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="form-toggle-card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ flex: 1, margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={formData.has_ingredients}
                        onChange={(e) => setFormData({ ...formData, has_ingredients: e.target.checked })}
                      />
                      <span className="toggle-card-title">Este producto lleva {selectedStore?.complements_label || 'Complementos'}</span>
                    </label>
                    <button
                      type="button"
                      title="Editar el texto que ven los clientes (aplica a toda la tienda)"
                      onClick={() => openLabelEdit('complements')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 6, flexShrink: 0 }}
                    >
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                  </div>

                  {labelEdit === 'complements' && (
                    <div className="form-group" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        autoFocus
                        maxLength={100}
                        value={labelValue}
                        onChange={(e) => setLabelValue(e.target.value)}
                        placeholder="Complementos"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); saveLabel(); }
                          if (e.key === 'Escape') setLabelEdit(null);
                        }}
                        style={{ flex: 1 }}
                      />
                      <button type="button" className="btn btn-primary" disabled={labelSaving} onClick={saveLabel}>
                        {labelSaving ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => setLabelEdit(null)}>Cancelar</button>
                    </div>
                  )}

                  {formData.has_ingredients && (
                    <>
                      <div className="form-group">
                        <label>Máx. complementos por cliente (0 = ilimitado)</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.max_ingredients}
                          onChange={(e) => setFormData({ ...formData, max_ingredients: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      {ingredients.length > 0 && (
                        <div className="form-group">
                          <label style={{ fontSize: '13px' }}>Orden de complementos (arrastra para reordenar)</label>
                          <div className="complementos-list">
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleIngredientsDragEnd}>
                              <SortableContext items={ingredients.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                {ingredients.map(item => <ComplementSortableRow key={item.id} item={item} />)}
                              </SortableContext>
                            </DndContext>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Secciones personalizadas - ARRIBA con botón + para crear */}
                <div className="product-form-section">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <h3 className="form-section-title" style={{ margin: 0 }}>Secciones personalizadas</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setNewSectionData({ name: '', required: false, max_options: '', options: [{ name: '', price: '' }] });
                        setNewSectionError('');
                        setShowNewSectionModal(true);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: '#4f46e5', color: '#fff',
                        border: 'none', borderRadius: 8,
                        padding: '5px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                      }}
                      title="Crear nueva sección"
                    >
                      <FontAwesomeIcon icon={faPlus} /> Nueva sección
                    </button>
                  </div>
                  {complementGroups.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
                      Aún no hay secciones. Presioná <strong>+ Nueva sección</strong> para crear una.
                    </p>
                  ) : (
                    <>
                      <p style={{ fontSize: 13, color: '#6b7280', marginTop: 0 }}>Elegí qué secciones aparecen en este producto:</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {complementGroups.map(g => {
                          const checked = (formData.complement_group_ids || []).includes(g.id);
                          return (
                            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <label className="form-toggle-card" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1, margin: 0 }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const cur = formData.complement_group_ids || [];
                                    setFormData({
                                      ...formData,
                                      complement_group_ids: e.target.checked ? [...cur, g.id] : cur.filter(id => id !== g.id)
                                    });
                                  }}
                                />
                                <span className="toggle-card-title">{g.name}</span>
                                <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>{g.options.length} opciones</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => handleDeleteSection(g.id)}
                                title="Eliminar sección"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '6px 8px', fontSize: 14, flexShrink: 0, borderRadius: 6 }}
                              >
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Sección Precio y Stock */}
                <div className="product-form-section">
                  <h3 className="form-section-title">Precio y Stock</h3>
                  
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Precio *</label>
                      <div className="input-with-prefix">
                        <span className="input-prefix">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          required
                          placeholder="0.00"
                        />
                      </div>
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

                  <div className="form-toggle-simple">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.unlimited_stock}
                        onChange={(e) => setFormData({ ...formData, unlimited_stock: e.target.checked })}
                      />
                      <span>Stock ilimitado</span>
                    </label>
                  </div>
                </div>

                {/* Receta */}
                <details className="product-form-section" style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <summary style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: '#fffbeb', color: '#92400e', borderBottom: '1px solid #e5e7eb', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                    ▶ Receta (Materias Primas)
                  </summary>
                  <div style={{ padding: '12px 14px' }}>
                    <RecipeEditor
                      key={editingProduct ? editingProduct.id : 'new'}
                      ref={recipeEditorRef}
                      storeId={selectedStore?.id}
                      itemType="product"
                      itemId={editingProduct?.id || null}
                    />
                  </div>
                </details>

                {/* Botones Acción */}
                <div className="product-form-actions">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn btn-secondary btn-full"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary btn-full">
                    {editingProduct ? 'Actualizar Producto' : 'Crear Producto'}
                  </button>
                </div>
              </form>
            </div>
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
                          {['Nombre *', 'Descripcion', 'Precio *', 'Categoria', 'Codigo_Barras', 'Imagen_URL'].map(h => (
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
                        {['Nombre', 'Precio', 'Categoria', 'Descripcion', 'Codigo Barras', 'Imagen URL'].map(h => (
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
                          <td style={{ padding: '6px 10px', color: '#6b7280', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.image_url || '—'}</td>
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

      {/* Modal rápido para crear nueva sección desde el editor de producto */}
      {showNewSectionModal && (
        <div className="product-modal-overlay" style={{ zIndex: 9999 }} onClick={() => setShowNewSectionModal(false)}>
          <div className="product-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="product-modal-header">
              <h2 className="product-modal-title">Nueva sección</h2>
              <button className="product-modal-close" onClick={() => setShowNewSectionModal(false)}>&times;</button>
            </div>
            <div className="product-modal-body" style={{ padding: '16px' }}>
              {newSectionError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
                  {newSectionError}
                </div>
              )}
              <div className="form-group">
                <label>Nombre de la sección *</label>
                <input
                  type="text"
                  autoFocus
                  value={newSectionData.name}
                  onChange={e => setNewSectionData({ ...newSectionData, name: e.target.value })}
                  placeholder="Ej: Salsas, Tamaños, Bebidas"
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Máx. opciones (0 = ilimitado)</label>
                  <input
                    type="number"
                    min="0"
                    value={newSectionData.max_options}
                    onChange={e => setNewSectionData({ ...newSectionData, max_options: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                  <label className="form-toggle-simple" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={newSectionData.required}
                      onChange={e => setNewSectionData({ ...newSectionData, required: e.target.checked })}
                    />
                    <span style={{ fontSize: 13 }}>Obligatoria</span>
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label>Opciones</label>
                {newSectionData.options.map((opt, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input
                      type="text"
                      value={opt.name}
                      onChange={e => {
                        const opts = [...newSectionData.options];
                        opts[idx] = { ...opts[idx], name: e.target.value };
                        setNewSectionData({ ...newSectionData, options: opts });
                      }}
                      placeholder={`Opción ${idx + 1}`}
                      style={{ flex: 2 }}
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={opt.price}
                      onChange={e => {
                        const opts = [...newSectionData.options];
                        opts[idx] = { ...opts[idx], price: e.target.value };
                        setNewSectionData({ ...newSectionData, options: opts });
                      }}
                      placeholder="$0.00"
                      style={{ flex: 1 }}
                    />
                    {newSectionData.options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const opts = newSectionData.options.filter((_, i) => i !== idx);
                          setNewSectionData({ ...newSectionData, options: opts });
                        }}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}
                      >×</button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setNewSectionData({ ...newSectionData, options: [...newSectionData.options, { name: '', price: '' }] })}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px dashed #d1d5db', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#6b7280', fontSize: 13, marginTop: 4 }}
                >
                  <FontAwesomeIcon icon={faPlus} /> Agregar opción
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-full"
                  disabled={newSectionSaving}
                  onClick={handleCreateSectionInline}
                >
                  {newSectionSaving ? 'Creando…' : 'Crear sección'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowNewSectionModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Products;
