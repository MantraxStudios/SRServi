import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faInfinity, faCubes, faFlask, faGripVertical } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import RecipeEditor from '../../components/RecipeEditor';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function Complements() {
  const { selectedStore } = useStore();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [activeTab, setActiveTab] = useState('ingredient');
  const UNITS = [
    { value: 'unidades', label: 'Unidades' },
    { value: 'g',        label: 'Gramos (g)' },
    { value: 'kg',       label: 'Kilogramos (kg)' },
    { value: 'mg',       label: 'Miligramos (mg)' },
  ];

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category_id: '',
    imageFile: null,
    stock: '',
    unlimited_stock: false,
    stock_unit: 'unidades',
    type: 'ingredient'
  });
  const [error, setError] = useState('');
  const recipeEditorRef = useRef(null);

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
      formDataToSend.append('stock_unit', formData.stock_unit || 'unidades');
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

      const savedItem = await response.json();
      await recipeEditorRef.current?.save(savedItem.id);

      // Update items state immediately without waiting for fetchAll
      const cat = categories.find(c => c.id === parseInt(savedItem.category_id));
      const itemWithType = {
        ...savedItem,
        _type: type,
        unlimited_stock: savedItem.unlimited_stock,
        category_name: cat?.name || null,
      };
      if (editingItem) {
        setItems(prev => prev.map(i =>
          i.id === editingItem.id && i._type === type
            ? { ...i, ...itemWithType }
            : i
        ));
      } else {
        setItems(prev => [...prev, itemWithType]);
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
      stock_unit: item.stock_unit || 'unidades',
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

      setItems(prev => prev.filter(i => !(i.id === item.id && i._type === item._type)));
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
      stock_unit: 'unidades',
      type: activeTab
    });
  };

  const openModal = () => {
    setEditingItem(null);
    resetForm();
    setShowModal(true);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const filteredItems = items.filter(i => i._type === activeTab);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filteredItems.findIndex(i => i.id === active.id);
    const newIndex = filteredItems.findIndex(i => i.id === over.id);
    const reordered = arrayMove(filteredItems, oldIndex, newIndex);

    const otherItems = items.filter(i => i._type !== activeTab);
    setItems([...otherItems, ...reordered]);

    try {
      const token = localStorage.getItem('token');
      const apiPath = activeTab === 'extra' ? '/api/extras/reorder' : '/api/ingredients/reorder';
      await fetch(apiPath, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: selectedStore.id,
          items: reordered.map((item, idx) => ({ id: item.id, sort_order: idx })),
        }),
      });
    } catch (err) {
      console.error('Error guardando orden:', err);
    }
  };

  function SortableRow({ item }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
    return (
      <tr ref={setNodeRef} style={style}>
        <td>
          <div className="drag-handle" style={{ cursor: 'grab', display: 'flex', alignItems: 'center', padding: '0 4px' }} {...attributes} {...listeners}>
            <FontAwesomeIcon icon={faGripVertical} style={{ color: '#aaa', fontSize: 14 }} />
          </div>
        </td>
        <td className="font-semibold">{item.name}</td>
        <td>{item.category_name || 'Sin categoría'}</td>
        <td>{Number(item.price) > 0 ? `$${Number(item.price).toFixed(2)}` : '-'}</td>
        <td>
          {item.unlimited_stock ? (
            <span className="stock-unlimited"><FontAwesomeIcon icon={faInfinity} /></span>
          ) : (
            <span className={`stock-value ${item.stock === 0 ? 'stock-danger' : item.stock < 10 ? 'stock-warning' : 'stock-ok'}`}>
              {item.stock} <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.7 }}>{item.stock_unit || 'un.'}</span>
            </span>
          )}
        </td>
        <td>
          <div className="action-buttons">
            <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(item)}>
              <FontAwesomeIcon icon={faEdit} />
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item)}>
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

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
              <div className="drag-hint-bar" style={{ padding: '8px 0 4px' }}>
                <div className="drag-hint">
                  <FontAwesomeIcon icon={faGripVertical} className="drag-handle-icon" />
                  <span className="drag-hint-text">Arrastra para cambiar el orden</span>
                </div>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filteredItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 32 }}></th>
                        <th>Nombre</th>
                        <th>Categoría</th>
                        <th>{activeTab === 'extra' ? 'Precio' : 'Precio Adicional'}</th>
                        <th>Stock</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map(item => (
                        <SortableRow key={item.id} item={item} />
                      ))}
                    </tbody>
                  </table>
                </SortableContext>
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
                <label>Unidad de medida</label>
                <select
                  value={formData.stock_unit}
                  onChange={(e) => setFormData({ ...formData, stock_unit: e.target.value })}
                >
                  {UNITS.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>
                  Stock disponible
                  {!formData.unlimited_stock && (
                    <span style={{ marginLeft: 6, fontSize: '12px', color: '#888', fontWeight: 400 }}>
                      (en {UNITS.find(u => u.value === formData.stock_unit)?.label.toLowerCase() || 'unidades'})
                    </span>
                  )}
                </label>
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
              <details style={{ marginTop: 14, borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <summary style={{ padding: '9px 12px', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: '#fffbeb', color: '#92400e', borderBottom: '1px solid #e5e7eb', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                  ▶ Receta (Materias Primas)
                </summary>
                <div style={{ padding: '12px' }}>
                  <RecipeEditor
                    key={editingItem ? `${editingItem._type}-${editingItem.id}` : `new-${formData.type}`}
                    ref={recipeEditorRef}
                    storeId={selectedStore?.id}
                    itemType={formData.type === 'extra' ? 'extra' : 'ingredient'}
                    itemId={editingItem?.id || null}
                  />
                </div>
              </details>
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
