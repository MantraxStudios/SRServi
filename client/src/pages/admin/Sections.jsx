import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faInfinity, faLayerGroup, faListUl } from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';

// Gestión de secciones dinámicas (grupos de complementos personalizados)
function Sections() {
  const { selectedStore } = useStore();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal de grupo
  const [groupModal, setGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupForm, setGroupForm] = useState({ name: '', min_select: '0', max_select: '0', required: false });

  // Modal de opción
  const [optionModal, setOptionModal] = useState(false);
  const [editingOption, setEditingOption] = useState(null);
  const [optionGroupId, setOptionGroupId] = useState(null);
  const [optionForm, setOptionForm] = useState({ name: '', price: '', stock: '', unlimited_stock: true, imageFile: null });

  useEffect(() => {
    if (selectedStore) { fetchGroups(); }
    else { setGroups([]); setLoading(false); }
  }, [selectedStore]);

  const fetchGroups = async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/complement-groups?store_id=${selectedStore.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching groups:', err);
    } finally {
      setLoading(false);
    }
  };

  // ===== Grupos =====
  const openGroupModal = (group = null) => {
    setEditingGroup(group);
    setGroupForm(group
      ? { name: group.name, min_select: String(group.min_select ?? 0), max_select: String(group.max_select ?? 0), required: !!group.required }
      : { name: '', min_select: '0', max_select: '0', required: false });
    setGroupModal(true);
  };

  const saveGroup = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const token = localStorage.getItem('token');
      const url = editingGroup ? `/api/complement-groups/${editingGroup.id}` : '/api/complement-groups';
      const res = await fetch(url, {
        method: editingGroup ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: selectedStore.id,
          name: groupForm.name.trim(),
          min_select: parseInt(groupForm.min_select) || 0,
          max_select: parseInt(groupForm.max_select) || 0,
          required: groupForm.required
        })
      });
      if (!res.ok) throw new Error('Error al guardar la sección');
      setGroupModal(false);
      setEditingGroup(null);
      fetchGroups();
    } catch (err) { setError(err.message); }
  };

  const deleteGroup = async (id) => {
    if (!confirm('¿Eliminar esta sección y todas sus opciones?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/complement-groups/${id}?store_id=${selectedStore.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      fetchGroups();
    } catch (err) { alert(err.message); }
  };

  // ===== Opciones =====
  const openOptionModal = (groupId, option = null) => {
    setOptionGroupId(groupId);
    setEditingOption(option);
    setOptionForm(option
      ? { name: option.name, price: String(option.price ?? ''), stock: String(option.stock ?? ''), unlimited_stock: !!option.unlimited_stock, imageFile: null }
      : { name: '', price: '', stock: '', unlimited_stock: true, imageFile: null });
    setOptionModal(true);
  };

  const saveOption = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const token = localStorage.getItem('token');
      const url = editingOption ? `/api/complement-options/${editingOption.id}` : '/api/complement-options';
      const fd = new FormData();
      fd.append('store_id', selectedStore.id);
      fd.append('group_id', optionGroupId);
      fd.append('name', optionForm.name.trim());
      fd.append('price', parseFloat(optionForm.price) || 0);
      fd.append('stock', parseInt(optionForm.stock) || 0);
      fd.append('unlimited_stock', optionForm.unlimited_stock);
      if (optionForm.imageFile) fd.append('image', optionForm.imageFile);
      const res = await fetch(url, {
        method: editingOption ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      if (!res.ok) throw new Error('Error al guardar la opción');
      setOptionModal(false);
      setEditingOption(null);
      fetchGroups();
    } catch (err) { setError(err.message); }
  };

  const deleteOption = async (id) => {
    if (!confirm('¿Eliminar esta opción?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/complement-options/${id}?store_id=${selectedStore.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      fetchGroups();
    } catch (err) { alert(err.message); }
  };

  const ruleLabel = (g) => {
    const parts = [];
    if (g.required) parts.push('Obligatorio');
    if (g.min_select > 0) parts.push(`mín ${g.min_select}`);
    parts.push(g.max_select > 0 ? `máx ${g.max_select}` : 'sin límite');
    return parts.join(' · ');
  };

  if (loading) return <div className="loading">Cargando...</div>;

  if (!selectedStore) {
    return <div className="admin-main"><div className="empty-state"><p className="empty-state-text">Seleccioná una tienda.</p></div></div>;
  }

  return (
    <>
      <header className="admin-header">
        <h1><FontAwesomeIcon icon={faLayerGroup} /> Secciones</h1>
        <button className="btn btn-primary" onClick={() => openGroupModal()}>
          <FontAwesomeIcon icon={faPlus} /> Nueva sección
        </button>
      </header>
      <div className="admin-main">
        {error && <div className="error">{error}</div>}
        <p style={{ color: '#6b7280', fontSize: 14, marginTop: 0 }}>
          Creá tus propias secciones (ej: "Salsas", "Bebidas", "Punto de cocción") con sus opciones y reglas.
          Luego asignalas a cada producto desde la pantalla de Productos.
        </p>

        {groups.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <p className="empty-state-text">No hay secciones todavía. Creá la primera.</p>
            </div>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.id} className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FontAwesomeIcon icon={faListUl} style={{ color: '#D4AF37' }} /> {group.name}
                  </h3>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{ruleLabel(group)} · {group.options.length} opciones</span>
                </div>
                <div className="action-buttons">
                  <button className="btn btn-sm btn-primary" onClick={() => openOptionModal(group.id)}>
                    <FontAwesomeIcon icon={faPlus} /> Opción
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => openGroupModal(group)}>
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteGroup(group.id)}>
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>

              {group.options.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: 13, margin: '8px 0' }}>Sin opciones. Agregá una con el botón "Opción".</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr><th>Opción</th><th>Precio</th><th>Stock</th><th>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {group.options.map(opt => (
                      <tr key={opt.id}>
                        <td className="font-semibold">{opt.name}</td>
                        <td>{Number(opt.price) > 0 ? `$${Number(opt.price).toFixed(2)}` : '-'}</td>
                        <td>
                          {opt.unlimited_stock
                            ? <span className="stock-unlimited"><FontAwesomeIcon icon={faInfinity} /></span>
                            : <span className={`stock-value ${opt.stock === 0 ? 'stock-danger' : opt.stock < 10 ? 'stock-warning' : 'stock-ok'}`}>{opt.stock}</span>}
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn btn-sm btn-secondary" onClick={() => openOptionModal(group.id, opt)}>
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={() => deleteOption(opt.id)}>
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal de grupo */}
      {groupModal && (
        <div className="modal-overlay" onClick={() => setGroupModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingGroup ? 'Editar sección' : 'Nueva sección'}</h2>
              <button className="modal-close" onClick={() => setGroupModal(false)}>&times;</button>
            </div>
            <form onSubmit={saveGroup}>
              <div className="form-group">
                <label>Nombre</label>
                <input type="text" value={groupForm.name} required placeholder="Ej: Salsas"
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Mínimo a elegir</label>
                  <input type="number" min="0" value={groupForm.min_select}
                    onChange={(e) => setGroupForm({ ...groupForm, min_select: e.target.value })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Máximo (0 = sin límite)</label>
                  <input type="number" min="0" value={groupForm.max_select}
                    onChange={(e) => setGroupForm({ ...groupForm, max_select: e.target.value })} />
                </div>
              </div>
              <div className={`unlimited-stock-toggle ${groupForm.required ? 'active' : ''}`}>
                <label>
                  <input type="checkbox" checked={groupForm.required}
                    onChange={(e) => setGroupForm({ ...groupForm, required: e.target.checked })} />
                  <span className="toggle-label">Obligatorio (el cliente debe elegir)</span>
                </label>
              </div>
              <button type="submit" className="btn btn-primary btn-full">{editingGroup ? 'Actualizar' : 'Crear'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de opción */}
      {optionModal && (
        <div className="modal-overlay" onClick={() => setOptionModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingOption ? 'Editar opción' : 'Nueva opción'}</h2>
              <button className="modal-close" onClick={() => setOptionModal(false)}>&times;</button>
            </div>
            <form onSubmit={saveOption}>
              <div className="form-group">
                <label>Nombre</label>
                <input type="text" value={optionForm.name} required placeholder="Ej: Ketchup"
                  onChange={(e) => setOptionForm({ ...optionForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Precio extra</label>
                <input type="number" step="0.01" value={optionForm.price} placeholder="0.00"
                  onChange={(e) => setOptionForm({ ...optionForm, price: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Stock</label>
                <input type="number" min="0" value={optionForm.stock} placeholder="0" disabled={optionForm.unlimited_stock}
                  onChange={(e) => setOptionForm({ ...optionForm, stock: e.target.value })} />
              </div>
              <div className={`unlimited-stock-toggle ${optionForm.unlimited_stock ? 'active' : ''}`}>
                <label>
                  <input type="checkbox" checked={optionForm.unlimited_stock}
                    onChange={(e) => setOptionForm({ ...optionForm, unlimited_stock: e.target.checked })} />
                  <span className="toggle-label">Stock ilimitado</span>
                </label>
                <span className="toggle-status">
                  {optionForm.unlimited_stock ? <><FontAwesomeIcon icon={faInfinity} /> Ilimitado</> : 'Limitado'}
                </span>
              </div>
              <div className="form-group">
                <label>Imagen (opcional)</label>
                <input type="file" accept="image/*" className="file-upload-input"
                  onChange={(e) => { const f = e.target.files[0]; if (f) setOptionForm({ ...optionForm, imageFile: f }); }} />
                {optionForm.imageFile && (
                  <div className="image-preview">
                    <img src={URL.createObjectURL(optionForm.imageFile)} alt="Preview" className="image-preview-img" />
                  </div>
                )}
                {editingOption && !optionForm.imageFile && editingOption.image && (
                  <div className="image-preview">
                    <img src={editingOption.image} alt="Actual" className="image-preview-img image-preview-img--current" />
                    <span className="text-muted text-sm">Imagen actual</span>
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-primary btn-full">{editingOption ? 'Actualizar' : 'Crear'}</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Sections;
