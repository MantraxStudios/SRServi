import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faPercent, faTimes, faCalendarDays, faCalendarWeek, faInfinity } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

// 0 = Domingo ... 6 = Sábado (coincide con Date.getDay())
const WEEK_DAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

const emptyForm = {
  code: '',
  name: '',
  discount_type: 'percent',
  discount_value: '0',
  min_order_total: '0',
  usage_limit: '',
  availability_mode: 'always', // 'always' | 'dates' | 'days'
  start_date: '',
  end_date: '',
  days_of_week: [],
  start_time: '',
  end_time: '',
  is_active: true,
};

function Coupons() {
  const { selectedStore } = useStore();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(emptyForm);

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
    setFormData(emptyForm);
    setEditingCoupon(null);
  };

  const openModal = (coupon = null) => {
    setError('');
    if (coupon) {
      const days = coupon.days_of_week
        ? String(coupon.days_of_week).split(',').map(d => parseInt(d, 10)).filter(d => Number.isInteger(d))
        : [];
      const hasDates = !!(coupon.start_date || coupon.end_date);
      const mode = days.length ? 'days' : (hasDates ? 'dates' : 'always');
      setEditingCoupon(coupon);
      setFormData({
        code: coupon.code || '',
        name: coupon.name || '',
        discount_type: coupon.discount_type || 'percent',
        discount_value: String(coupon.discount_value ?? 0),
        min_order_total: String(coupon.min_order_total ?? 0),
        usage_limit: coupon.usage_limit === null ? '' : String(coupon.usage_limit),
        availability_mode: mode,
        start_date: coupon.start_date ? String(coupon.start_date).slice(0, 10) : '',
        end_date: coupon.end_date ? String(coupon.end_date).slice(0, 10) : '',
        days_of_week: days,
        start_time: coupon.start_time ? String(coupon.start_time).slice(0, 5) : '',
        end_time: coupon.end_time ? String(coupon.end_time).slice(0, 5) : '',
        is_active: !!coupon.is_active
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const toggleDay = (value) => {
    setFormData(prev => {
      const set = new Set(prev.days_of_week);
      if (set.has(value)) set.delete(value); else set.add(value);
      return { ...prev, days_of_week: [...set] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const mode = formData.availability_mode;
    if (mode === 'days' && formData.days_of_week.length === 0) {
      setError('Selecciona al menos un día de la semana.');
      return;
    }

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
          start_date: mode === 'dates' ? (formData.start_date || null) : null,
          end_date: mode === 'dates' ? (formData.end_date || null) : null,
          days_of_week: mode === 'days' ? formData.days_of_week.join(',') : null,
          start_time: formData.start_time || null,
          end_time: formData.end_time || null,
          is_active: formData.is_active
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'No se pudo guardar el cupón');
      }

      closeModal();
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

  const describeAvailability = (coupon) => {
    const t1 = coupon.start_time ? String(coupon.start_time).slice(0, 5) : '';
    const t2 = coupon.end_time ? String(coupon.end_time).slice(0, 5) : '';
    const timePart = (t1 || t2) ? `${t1 || '00:00'}–${t2 || '23:59'}` : '';
    const parts = [];

    if (coupon.days_of_week) {
      const days = String(coupon.days_of_week).split(',').map(d => parseInt(d, 10));
      const labels = WEEK_DAYS.filter(d => days.includes(d.value)).map(d => d.label);
      parts.push(labels.join(', '));
    } else {
      const d1 = coupon.start_date ? String(coupon.start_date).slice(0, 10) : '';
      const d2 = coupon.end_date ? String(coupon.end_date).slice(0, 10) : '';
      if (d1 || d2) parts.push(`${d1 || '…'} → ${d2 || '…'}`);
    }
    if (timePart) parts.push(timePart);
    return parts.length ? parts.join(' · ') : 'Siempre';
  };

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  const modes = [
    { key: 'always', label: 'Siempre', icon: faInfinity },
    { key: 'dates', label: 'Por fechas', icon: faCalendarDays },
    { key: 'days', label: 'Por días', icon: faCalendarWeek },
  ];

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
        {error && !showModal && <div className="error">{error}</div>}

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
                    <th>Disponibilidad</th>
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
                    <td>{describeAvailability(coupon)}</td>
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
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0 }}>{editingCoupon ? 'Editar Cupón' : 'Nuevo Cupón'}</h2>
              <button type="button" className="btn btn-sm btn-secondary" onClick={closeModal} aria-label="Cerrar">
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {error && <div className="error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}

              {/* Datos básicos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Código</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="EJ: VERANO20"
                    required
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Nombre</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Descuento de verano"
                    required
                  />
                </div>
              </div>

              {/* Descuento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Tipo de descuento</label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, discount_type: e.target.value }))}
                  >
                    <option value="percent">Porcentaje (%)</option>
                    <option value="fixed">Monto fijo</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
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
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Monto mínimo de pedido</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.min_order_total}
                    onChange={(e) => setFormData(prev => ({ ...prev, min_order_total: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Límite de usos</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.usage_limit}
                    onChange={(e) => setFormData(prev => ({ ...prev, usage_limit: e.target.value }))}
                    placeholder="Vacío = sin límite"
                  />
                </div>
              </div>

              {/* Disponibilidad */}
              <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border)' }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3)' }}>
                  Disponibilidad
                </label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                  {modes.map(m => {
                    const active = formData.availability_mode === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, availability_mode: m.key }))}
                        style={{
                          flex: '1 1 auto',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: `1px solid ${active ? 'var(--foreground)' : 'var(--border)'}`,
                          background: active ? 'var(--foreground)' : 'var(--card)',
                          color: active ? 'var(--background)' : 'var(--foreground)',
                          fontWeight: 600, fontSize: 13, cursor: 'pointer',
                          transition: 'all var(--transition)'
                        }}
                      >
                        <FontAwesomeIcon icon={m.icon} /> {m.label}
                      </button>
                    );
                  })}
                </div>

                {formData.availability_mode === 'dates' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Desde</label>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Hasta</label>
                      <input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                {formData.availability_mode === 'days' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Días disponibles</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {WEEK_DAYS.map(d => {
                        const active = formData.days_of_week.includes(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => toggleDay(d.value)}
                            style={{
                              minWidth: 46,
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-md)',
                              border: `1px solid ${active ? 'var(--foreground)' : 'var(--border)'}`,
                              background: active ? 'var(--foreground)' : 'var(--card)',
                              color: active ? 'var(--background)' : 'var(--foreground)',
                              fontWeight: 600, fontSize: 13, cursor: 'pointer',
                              transition: 'all var(--transition)'
                            }}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {formData.availability_mode === 'always' && (
                  <small className="text-muted">El cupón estará disponible todos los días.</small>
                )}

                {/* Horario (aplica a cualquier modo) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Hora desde</label>
                    <input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Hora hasta</label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                    />
                  </div>
                </div>
                <small className="text-muted">Horario vacío = válido todo el día.</small>
              </div>

              {/* Estado */}
              <div className="form-group" style={{ marginTop: 'var(--space-5)', marginBottom: 0 }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  />
                  Cupón activo
                </label>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
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
