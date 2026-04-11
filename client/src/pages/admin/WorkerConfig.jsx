import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserCog, faPlus, faTrash, faEdit, faCheck } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../components/Layout';

const PRESET_COLORS = ['#22c55e', '#D4AF37', '#3b82f6', '#ef4444', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#0a0a0a', '#6b7280'];

function WorkerConfig() {
  const { token } = useAuth();
  const { selectedStore } = useStore();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#D4AF37');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (selectedStore) {
      fetchMethods();
    } else {
      setLoading(false);
      setMethods([]);
    }
  }, [selectedStore]);

  const fetchMethods = async () => {
    try {
      const response = await fetch(`/api/worker-payment-methods?store_id=${selectedStore.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMethods(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openForm = (method = null) => {
    if (method) {
      setEditingMethod(method);
      setFormName(method.name);
      setFormColor(method.color);
    } else {
      setEditingMethod(null);
      setFormName('');
      setFormColor('#D4AF37');
    }
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      setError('El nombre es requerido');
      return;
    }

    try {
      const url = editingMethod
        ? `/api/worker-payment-methods/${editingMethod.id}`
        : '/api/worker-payment-methods';

      const response = await fetch(url, {
        method: editingMethod ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          store_id: selectedStore.id,
          name: formName.trim(),
          color: formColor
        })
      });

      if (!response.ok) throw new Error('Error al guardar');

      setShowForm(false);
      setSuccess(editingMethod ? 'Metodo actualizado' : 'Metodo creado');
      setTimeout(() => setSuccess(''), 3000);
      fetchMethods();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminar este metodo de pago?')) return;
    try {
      await fetch(`/api/worker-payment-methods/${id}?store_id=${selectedStore.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchMethods();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  if (!selectedStore) {
    return (
      <>
        <header className="admin-header"><h1>Pago manual</h1></header>
        <div className="admin-main">
          <div className="card empty-state">
            <p className="empty-state-text">Selecciona una tienda</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="admin-header">
        <h1>Pago manual</h1>
        <button className="btn btn-primary" onClick={() => openForm()}>
          <FontAwesomeIcon icon={faPlus} /> Nuevo método
        </button>
      </header>
      <div className="admin-main">
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <FontAwesomeIcon icon={faUserCog} /> Métodos de pago manual
            </h3>
          </div>
          <p className="text-muted text-sm" style={{ marginBottom: '20px' }}>
            Configura el método de pago manual cuando el vendedor no use el tótem y necesite registrar la venta en el sistema.
          </p>

          {loading ? (
            <div className="empty-state"><p>Cargando...</p></div>
          ) : methods.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-text">No hay metodos de pago. Crea el primero.</p>
            </div>
          ) : (
            <div className="worker-config-methods-grid">
              {methods.map(method => (
                <div key={method.id} className="worker-config-method-card">
                  <div className="worker-config-method-color" style={{ backgroundColor: method.color }} />
                  <div className="worker-config-method-info">
                    <span className="worker-config-method-name">{method.name}</span>
                  </div>
                  <div className="worker-config-method-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => openForm(method)}>
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(method.id)}>
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">{editingMethod ? 'Editar metodo' : 'Nuevo metodo de pago'}</h3>
                <button className="modal-close" onClick={() => setShowForm(false)}>
                  <FontAwesomeIcon icon={faPlus} style={{ transform: 'rotate(45deg)' }} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Nombre</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej: Efectivo, Tarjeta, Transferencia, Nequi..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Color</label>
                  <div className="worker-config-color-picker">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`worker-config-color-dot${formColor === color ? ' active' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormColor(color)}
                      >
                        {formColor === color && <FontAwesomeIcon icon={faCheck} />}
                      </button>
                    ))}
                    <input
                      type="color"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="worker-config-color-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Vista previa</label>
                  <div className="worker-config-preview">
                    <div className="worker-config-preview-btn" style={{ backgroundColor: formColor }}>
                      {formName || 'Metodo de pago'}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3" style={{ marginTop: '20px' }}>
                  <button type="button" className="btn btn-secondary flex-1" onClick={() => setShowForm(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary flex-1">
                    {editingMethod ? 'Guardar' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default WorkerConfig;
