import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { CATEGORY_ICON_LIST, getCategoryIcon } from '../../utils/categoryIcons';

function Categories() {
  const { selectedStore } = useStore();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedStore) {
      setLoading(true);
      fetchCategories();
    } else {
      setLoading(false);
      setCategories([]);
    }
  }, [selectedStore]);

  const fetchCategories = async () => {
    if (!selectedStore) {
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/categories?store_id=${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedStore?.id) {
      setError('Selecciona una tienda primero');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const url = editingCategory
        ? `/api/categories/${editingCategory.id}`
        : '/api/categories';

      const response = await fetch(url, {
        method: editingCategory ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...formData, store_id: selectedStore.id })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar la categoria');
      }

      setShowModal(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '', icon: '' });
      fetchCategories();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      icon: category.icon || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Estas seguro de eliminar esta categoria?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/categories/${id}?store_id=${selectedStore.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Error al eliminar la categoria');
      }

      fetchCategories();
    } catch (error) {
      alert(error.message);
    }
  };

  const openModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '', icon: '' });
    setShowModal(true);
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <>
      <header className="admin-header">
        <h1>Categorias</h1>
        <button className="btn btn-primary" onClick={openModal}>
          <FontAwesomeIcon icon={faPlus} />
          Nueva Categoria
        </button>
      </header>
      <div className="admin-main">
        {error && <div className="error">{error}</div>}

        <div className="card">
          {categories.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-text">No hay categorias. Crea tu primera categoria.</p>
            </div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Icono</th>
                    <th>Nombre</th>
                    <th>Descripcion</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                {categories.map(category => (
                  <tr key={category.id}>
                    <td style={{ fontSize: 18, color: '#555', width: 48, textAlign: 'center' }}>
                      {getCategoryIcon(category.icon)
                        ? <FontAwesomeIcon icon={getCategoryIcon(category.icon)} />
                        : <span style={{ color: '#bbb' }}>—</span>}
                    </td>
                    <td className="font-semibold">{category.name}</td>
                    <td>{category.description || '-'}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleEdit(category)}
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(category.id)}
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
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingCategory ? 'Editar Categoria' : 'Nueva Categoria'}
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
                  placeholder="Nombre de la categoria"
                />
              </div>
              <div className="form-group">
                <label>Descripcion</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                  placeholder="Descripcion opcional"
                />
              </div>
              <div className="form-group">
                <label>Icono</label>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))',
                  gap: 6, maxHeight: 200, overflowY: 'auto',
                  padding: 6, border: '1px solid #e0e0e0', borderRadius: 8
                }}>
                  {CATEGORY_ICON_LIST.map(({ key, label, icon }) => {
                    const selected = formData.icon === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        title={label}
                        onClick={() => setFormData(prev => ({ ...prev, icon: selected ? '' : key }))}
                        style={{
                          aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: selected ? '2px solid #D4AF37' : '2px solid transparent',
                          background: selected ? 'rgba(212,175,55,0.12)' : '#f5f5f5',
                          borderRadius: 8, cursor: 'pointer', fontSize: 18,
                          color: selected ? '#111' : '#555'
                        }}
                      >
                        <FontAwesomeIcon icon={icon} />
                      </button>
                    );
                  })}
                </div>
                <small style={{ color: '#888', display: 'block', marginTop: 6 }}>
                  {formData.icon ? 'Toca el icono seleccionado para quitarlo.' : 'Opcional. Si no eliges, se usa un icono automático según el nombre.'}
                </small>
              </div>
              <button type="submit" className="btn btn-primary btn-full">
                {editingCategory ? 'Actualizar' : 'Crear'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Categories;
