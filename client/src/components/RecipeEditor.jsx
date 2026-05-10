import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faCheck, faTimes, faFlask } from '@fortawesome/free-solid-svg-icons';

const RM_UNITS = ['unidades', 'kg', 'g', 'mg', 'litros', 'ml', 'porciones', 'tazas', 'cucharadas'];

const RecipeEditor = forwardRef(function RecipeEditor({ storeId, itemType, itemId }, ref) {
  const [rawMats, setRawMats]   = useState([]);
  const [recipe, setRecipe]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [newRmId, setNewRmId]   = useState('');
  const [newRmQty, setNewRmQty] = useState('');
  const [adding, setAdding]     = useState(false);

  // Quick-create new raw material inline
  const [qcOpen, setQcOpen]     = useState(false);
  const [qcName, setQcName]     = useState('');
  const [qcUnit, setQcUnit]     = useState('unidades');
  const [qcQty, setQcQty]       = useState('');
  const [qcSaving, setQcSaving] = useState(false);

  const token = () => localStorage.getItem('token');

  const fetchRawMats = () => {
    if (!storeId) return;
    fetch(`/api/raw-materials/store/${storeId}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setRawMats(Array.isArray(data) ? data : []))
      .catch(() => setRawMats([]));
  };

  useEffect(fetchRawMats, [storeId]);

  useEffect(() => {
    if (!itemId) { setRecipe([]); return; }
    setLoading(true);
    fetch(`/api/recipes/${itemType}/${itemId}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setRecipe(Array.isArray(data) ? data : []))
      .catch(() => setRecipe([]))
      .finally(() => setLoading(false));
  }, [itemId, itemType]);

  useImperativeHandle(ref, () => ({
    async save(newItemId) {
      const id = newItemId || itemId;
      if (!id || !storeId) return;
      await fetch(`/api/recipes/${itemType}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
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

  const quickCreate = async () => {
    if (!qcName.trim()) return;
    setQcSaving(true);
    try {
      const res = await fetch(`/api/raw-materials/store/${storeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ name: qcName.trim(), quantity: parseFloat(qcQty) || 0, unit: qcUnit, min_quantity: 0, cost_per_unit: 0 }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      await fetchRawMats();
      // pre-select the new one
      const newId = created?.id || created?.raw_material?.id;
      if (newId) { setNewRmId(String(newId)); setAdding(true); }
      setQcOpen(false); setQcName(''); setQcUnit('unidades'); setQcQty('');
    } catch {
      alert('Error al crear la materia prima');
    } finally {
      setQcSaving(false);
    }
  };

  const estimatedCost = recipe.reduce((sum, r) => {
    const rm = rawMats.find(m => m.id === r.raw_material_id);
    return sum + (rm ? parseFloat(rm.cost_per_unit || 0) * r.quantity_used : 0);
  }, 0);

  const available = rawMats.filter(rm => !recipe.find(r => r.raw_material_id === rm.id));

  if (loading) return <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>Cargando receta...</p>;

  return (
    <div>
      {/* Recipe items */}
      {recipe.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
          {recipe.map(r => (
            <div key={r.raw_material_id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: 8,
              background: '#f0fdf4', border: '1px solid #bbf7d0'
            }}>
              <FontAwesomeIcon icon={faFlask} style={{ color: '#16a34a', fontSize: 11, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111' }}>{r.name}</span>
              <span style={{ fontSize: 12, color: '#555', whiteSpace: 'nowrap' }}>{r.quantity_used} {r.unit}</span>
              <button type="button" onClick={() => remove(r.raw_material_id)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', padding: '0 2px', display: 'flex', alignItems: 'center' }}>
                <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11 }} />
              </button>
            </div>
          ))}
          {estimatedCost > 0 && (
            <div style={{ fontSize: 12, color: '#555', paddingLeft: 2 }}>
              Costo estimado: <strong>${estimatedCost.toFixed(2)}</strong>
            </div>
          )}
        </div>
      )}

      {/* Quick-create new raw material */}
      {qcOpen && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 2 }}>
            <FontAwesomeIcon icon={faFlask} style={{ marginRight: 5 }} />
            Nueva Materia Prima
          </div>
          <input
            autoFocus
            value={qcName}
            onChange={e => setQcName(e.target.value)}
            placeholder="Nombre (ej: Harina, Pollo…)"
            style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #fcd34d', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
            onKeyDown={e => { if (e.key === 'Enter') quickCreate(); if (e.key === 'Escape') setQcOpen(false); }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="number" min="0" step="0.01"
              value={qcQty}
              onChange={e => setQcQty(e.target.value)}
              placeholder="Cantidad inicial"
              style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid #fcd34d', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            <select value={qcUnit} onChange={e => setQcUnit(e.target.value)}
              style={{ flex: 1, padding: '7px 8px', borderRadius: 7, border: '1px solid #fcd34d', fontSize: 13, outline: 'none', background: '#fff' }}>
              {RM_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={quickCreate} disabled={!qcName.trim() || qcSaving}
              style={{ flex: 1, padding: '7px', borderRadius: 7, border: 'none', background: '#D4AF37', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: !qcName.trim() ? 0.5 : 1 }}>
              {qcSaving ? 'Creando…' : 'Crear y agregar'}
            </button>
            <button type="button" onClick={() => { setQcOpen(false); setQcName(''); setQcUnit('unidades'); setQcQty(''); }}
              style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer' }}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        </div>
      )}

      {/* Add existing raw material row */}
      {adding && !qcOpen ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
          <select value={newRmId} onChange={e => setNewRmId(e.target.value)}
            style={{ flex: '2 1 130px', padding: '6px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13 }} autoFocus>
            <option value="">Materia prima…</option>
            {available.map(r => <option key={r.id} value={r.id}>{r.name} ({r.unit})</option>)}
          </select>
          <input type="number" step="0.001" min="0" value={newRmQty} onChange={e => setNewRmQty(e.target.value)}
            placeholder="Cant." onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            style={{ flex: '1 1 70px', padding: '6px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13 }} />
          <button type="button" onClick={add}
            style={{ padding: '6px 11px', borderRadius: 7, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            <FontAwesomeIcon icon={faCheck} />
          </button>
          <button type="button" onClick={() => { setAdding(false); setNewRmId(''); setNewRmQty(''); }}
            style={{ padding: '6px 11px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer' }}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      ) : null}

      {/* Action buttons */}
      {!adding && !qcOpen && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => setAdding(true)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '7px 10px', borderRadius: 8, border: '1.5px dashed #d1d5db',
              background: '#fafafa', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} /> Agregar Ingrediente
          </button>
          <button type="button" onClick={() => { setQcOpen(true); setAdding(false); }}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '7px 10px', borderRadius: 8, border: '1.5px dashed #fcd34d',
              background: '#fffbeb', color: '#92400e', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <FontAwesomeIcon icon={faFlask} style={{ fontSize: 10 }} /> Nuevo Ingrediente
          </button>
        </div>
      )}

      {/* If adding but no available mats, show create button */}
      {adding && available.length === 0 && !qcOpen && (
        <div style={{ marginTop: 6 }}>
          <button type="button" onClick={() => { setQcOpen(true); setAdding(false); }}
            style={{ width: '100%', padding: '7px', borderRadius: 8, border: '1.5px dashed #fcd34d',
              background: '#fffbeb', color: '#92400e', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <FontAwesomeIcon icon={faFlask} style={{ marginRight: 5 }} /> No hay ingredientes — crear nuevo
          </button>
        </div>
      )}
    </div>
  );
});

export default RecipeEditor;
