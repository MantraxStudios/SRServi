import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';

const RecipeEditor = forwardRef(function RecipeEditor({ storeId, itemType, itemId }, ref) {
  const [rawMats, setRawMats] = useState([]);
  const [recipe, setRecipe] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newRmId, setNewRmId] = useState('');
  const [newRmQty, setNewRmQty] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    const token = localStorage.getItem('token');
    fetch(`/api/raw-materials/store/${storeId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setRawMats(Array.isArray(data) ? data : []))
      .catch(() => setRawMats([]));
  }, [storeId]);

  useEffect(() => {
    if (!itemId) { setRecipe([]); return; }
    setLoading(true);
    const token = localStorage.getItem('token');
    fetch(`/api/recipes/${itemType}/${itemId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setRecipe(Array.isArray(data) ? data : []))
      .catch(() => setRecipe([]))
      .finally(() => setLoading(false));
  }, [itemId, itemType]);

  useImperativeHandle(ref, () => ({
    async save(newItemId) {
      const id = newItemId || itemId;
      if (!id || !storeId) return;
      const token = localStorage.getItem('token');
      await fetch(`/api/recipes/${itemType}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: recipe.map(r => ({ raw_material_id: r.raw_material_id, quantity_used: r.quantity_used })),
          store_id: storeId
        })
      });
    }
  }), [recipe, itemType, itemId, storeId]);

  const add = () => {
    if (!newRmId || !newRmQty || parseFloat(newRmQty) <= 0) return;
    const rm = rawMats.find(r => r.id === parseInt(newRmId));
    if (!rm) return;
    const exists = recipe.find(r => r.raw_material_id === rm.id);
    if (exists) {
      setRecipe(recipe.map(r => r.raw_material_id === rm.id ? { ...r, quantity_used: parseFloat(newRmQty) } : r));
    } else {
      setRecipe([...recipe, { raw_material_id: rm.id, quantity_used: parseFloat(newRmQty), name: rm.name, unit: rm.unit }]);
    }
    setNewRmId(''); setNewRmQty(''); setAdding(false);
  };

  const remove = (rmId) => setRecipe(recipe.filter(r => r.raw_material_id !== rmId));

  const estimatedCost = recipe.reduce((sum, r) => {
    const rm = rawMats.find(m => m.id === r.raw_material_id);
    return sum + (rm ? parseFloat(rm.cost_per_unit || 0) * r.quantity_used : 0);
  }, 0);

  const available = rawMats.filter(rm => !recipe.find(r => r.raw_material_id === rm.id));

  if (rawMats.length === 0) {
    return (
      <p style={{ fontSize: 12, color: '#aaa', margin: 0, padding: '4px 0' }}>
        Sin materias primas disponibles. Agrégalas en Inventario → Materias Primas.
      </p>
    );
  }

  if (loading) {
    return <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>Cargando receta...</p>;
  }

  return (
    <div>
      {recipe.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
          {recipe.map(r => (
            <div key={r.raw_material_id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: 8,
              background: '#f0fdf4', border: '1px solid #bbf7d0'
            }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111' }}>{r.name}</span>
              <span style={{ fontSize: 12, color: '#555', whiteSpace: 'nowrap' }}>
                {r.quantity_used} {r.unit}
              </span>
              <button
                type="button"
                onClick={() => remove(r.raw_material_id)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', padding: '0 2px', display: 'flex', alignItems: 'center' }}
              >
                <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11 }} />
              </button>
            </div>
          ))}
          <div style={{ fontSize: 12, color: '#555', paddingLeft: 2 }}>
            Costo estimado: <strong>${estimatedCost.toFixed(2)}</strong>
          </div>
        </div>
      )}

      {adding ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={newRmId}
            onChange={e => setNewRmId(e.target.value)}
            style={{ flex: '2 1 130px', padding: '6px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13 }}
            autoFocus
          >
            <option value="">Materia prima...</option>
            {available.map(r => (
              <option key={r.id} value={r.id}>{r.name} ({r.unit})</option>
            ))}
          </select>
          <input
            type="number"
            step="0.001"
            min="0"
            value={newRmQty}
            onChange={e => setNewRmQty(e.target.value)}
            placeholder="Cant."
            style={{ flex: '1 1 70px', padding: '6px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13 }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          />
          <button
            type="button"
            onClick={add}
            style={{ padding: '6px 11px', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            <FontAwesomeIcon icon={faCheck} />
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setNewRmId(''); setNewRmQty(''); }}
            style={{ padding: '6px 11px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer' }}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', padding: '7px 14px', borderRadius: 8,
            border: '1.5px dashed #d1d5db', background: '#fafafa',
            color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}
        >
          <FontAwesomeIcon icon={faPlus} style={{ fontSize: 11 }} /> Agregar materia prima
        </button>
      )}
    </div>
  );
});

export default RecipeEditor;
