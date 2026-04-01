import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

function Extras() {
  const { selectedStore } = useStore();
  const [extras, setExtras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExtra, setEditingExtra] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedStore) {
      fetchExtras();
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
      setExtras(data);
    } catch (error) {
      console.error('Error fetching extras:', error);
    } finally {
      setLoading(false);
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
      
      const response = await fetch(url, {
        method: editingExtra ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          price: parseFloat(formData.price) || 0,
          store_id: selectedStore.id
        })
      });

      if (!response.ok) {
        throw new Error('Error al guardar el extra');
      }

      setShowModal(false);
      setEditingExtra(null);
      setFormData({ name: '', price: '' });
      fetchExtras();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (extra) => {
    setEditingExtra(extra);
    setFormData({
      name: extra.name,
      price: extra.price?.toString() || '0'
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Estas seguro de eliminar este extra?')) return;

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
    setFormData({ name: '', price: '' });
    setShowModal(true);
  };

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
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Precio</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {extras.map(extra => (
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
