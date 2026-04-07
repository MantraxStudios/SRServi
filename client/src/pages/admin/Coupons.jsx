import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faPercent } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

function Coupons() {
  const { selectedStore } = useStore();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    discount_type: 'percent',
    discount_value: '0',
    min_order_total: '0',
    usage_limit: '',
    is_active: true
  });

  useEffect(() => {
    if (selectedStore) {
      setLoading(true);
      fetchCoupons();
    } else {
      setLoading(false);
      setCoupons([]);
    }
  }, [selectedStore]);

  const fetchCoupons = async () => {
    if (!selectedStore) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/coupons?store_id=${selectedStore.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setCoupons(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Error cargando cupones');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      discount_type: 'percent',
      discount_value: '0',
      min_order_total: '0',
      usage_limit: '',
      is_active: true
    });
    setEditingCoupon(null);
  };

  const openModal = (coupon = null) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setFormData({
        code: coupon.code || '',
        name: coupon.name || '',
        discount_type: coupon.discount_type || 'percent',
        discount_value: String(coupon.discount_value ?? 0),
        min_order_total: String(coupon.min_order_total ?? 0),
        usage_limit: coupon.usage_limit === null ? '' : String(coupon.usage_limit),
        is_active: !!coupon.is_active
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const token = localStorage.getItem('token');
      const url = editingCoupon ? `/api/coupons/${editingCoupon.id}` : '/api/coupons';
      const response = await fetch(url, {
        method: editingCoupon ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          store_id: selectedStore.id,
          code: formData.code.toUpperCase().trim(),
          name: formData.name,
          discount_type: formData.discount_type,
          discount_value: parseFloat(formData.discount_value) || 0,
          min_order_total: parseFloat(formData.min_order_total) || 0,
          usage_limit: formData.usage_limit === '' ? null : parseInt(formData.usage_limit),
          is_active: formData.is_active
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'No se pudo guardar el cupón');
      }

      setShowModal(false);
      resetForm();
      fetchCoupons();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (couponId) => {
    if (!confirm('¿Eliminar este cupón?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/coupons/${couponId}?store_id=${selectedStore.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'No se pudo eliminar');
      }
      fetchCoupons();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <>
      <header className="admin-header">
        <h1>
          <FontAwesomeIcon icon={faPercent} />
          {' '}Cupones
        </h1>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <FontAwesomeIcon icon={faPlus} />
          Nuevo Cupón
        </button>
      </header>

      <div className="admin-main">
        {error && <div className="error">{error}</div>}

        <div className="card">
          {coupons.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-text">
                No hay cupones. Crea tu primer cupón.
              </p>
            </div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Descuento</th>
                    <th>Límite</th>
                    <th>Usados</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                {coupons.map(coupon => (
                  <tr key={coupon.id}>
                    <td className="font-bold">{coupon.code}</td>
                    <td>{coupon.name}</td>
                    <td>
                      {coupon.discount_type === 'percent'
                        ? `${Number(coupon.discount_value).toFixed(2)}%`
                        : `$${Number(coupon.discount_value).toFixed(2)}`}
                    </td>
                    <td>{coupon.usage_limit === null ? 'Sin límite' : coupon.usage_limit}</td>
                    <td>{coupon.usage_count}</td>
                    <td>
                      <span className={coupon.is_active ? 'badge badge-success' : 'badge badge-danger'}>
                        {coupon.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-secondary" onClick={() => openModal(coupon)}>
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(coupon.id)}>
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
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editingCoupon ? 'Editar Cupón' : 'Nuevo Cupón'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Código</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Tipo de descuento</label>
                <select
                  value={formData.discount_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount_type: e.target.value }))}
                >
                  <option value="percent">Porcentaje (%)</option>
                  <option value="fixed">Monto fijo</option>
                </select>
              </div>
              <div className="form-group">
                <label>Valor de descuento</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.discount_value}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount_value: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Monto mínimo de pedido</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.min_order_total}
                  onChange={(e) => setFormData(prev => ({ ...prev, min_order_total: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Límite de usos</label>
                <input
                  type="number"
                  min="1"
                  value={formData.usage_limit}
                  onChange={(e) => setFormData(prev => ({ ...prev, usage_limit: e.target.value }))}
                  placeholder="Vacío = sin límite"
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  />
                  Activo
                </label>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCoupon ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Coupons;
