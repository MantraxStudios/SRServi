import { useState, useEffect, useCallback, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWarehouse, faSearch, faSync, faInfinity, faExclamationTriangle,
  faPlus, faEdit, faTrash, faTimes, faCheck, faBoxOpen, faFlask,
  faListUl, faSave, faArrowUp, faBox
} from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

const API = 'https://srservi2.srautomatic.com';

const UNITS = ['unidades', 'kg', 'g', 'mg', 'litros', 'ml', 'porciones', 'tazas', 'cucharadas'];

/** Formatea un número eliminando ceros decimales innecesarios. */
const fmt = (n, max = 4) => parseFloat(parseFloat(n || 0).toFixed(max));

function statusBadge(item) {
  if (item.unlimited_stock) return { label: 'Ilimitado', color: '#D4AF37', bg: 'rgba(212,175,55,0.12)', border: 'rgba(212,175,55,0.3)' };
  if (item.stock === 0)     return { label: 'Sin stock', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' };
  if (item.stock <= 5)      return { label: 'Stock bajo', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' };
  return                           { label: 'OK', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' };
}

function rmBadge(rm) {
  const qty = parseFloat(rm.quantity) || 0;
  const min = parseFloat(rm.min_quantity) || 0;
  if (qty <= 0)          return { label: 'Agotado', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' };
  if (qty <= min && min > 0)
                         return { label: 'Stock bajo', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' };
  return                        { label: 'OK', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' };
}

const inputStyle = {
  width: '100%', padding: '10px 12px', background: '#fff',
  border: '1px solid #d1d5db', borderRadius: 8,
  color: '#111', fontSize: 13, outline: 'none', boxSizing: 'border-box'
};
const labelStyle = { fontSize: 12, color: '#6b7280', marginBottom: 4, display: 'block' };
const btnGold = {
  background: '#D4AF37', border: 'none', borderRadius: 8, padding: '10px 18px',
  cursor: 'pointer', color: '#000', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6
};
const btnGhost = {
  background: 'transparent', border: '1px solid #d1d5db', borderRadius: 8,
  padding: '9px 14px', cursor: 'pointer', color: '#555', fontSize: 13
};

export default function Inventory() {
  const { selectedStore } = useStore();
  const { token } = useAuth();

  const [tab, setTab] = useState('raw');          // 'raw' | 'recipes' | 'direct'
  const [rawMats, setRawMats] = useState([]);
  const [directData, setDirectData] = useState({ products: [], ingredients: [], extras: [] });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Raw materials modal
  const [rmModal, setRmModal] = useState(null); // null | 'new' | item (edit)
  const [rmForm, setRmForm] = useState({ name: '', quantity: '', unit: 'unidades', min_quantity: '', cost_per_unit: '' });
  const [rmSaving, setRmSaving] = useState(false);

  // Restock modal
  const [restockItem, setRestockItem] = useState(null);
  const [restockAmount, setRestockAmount] = useState('');
  const [restockSaving, setRestockSaving] = useState(false);

  // Direct stock editing
  const [directTab, setDirectTab] = useState('products');
  const [editingDirect, setEditingDirect] = useState(null);
  const [editDirectVal, setEditDirectVal] = useState('');
  const [savingDirect, setSavingDirect] = useState(false);

  // Recipes
  const [recipeProduct, setRecipeProduct] = useState(null); // product being edited
  const [recipe, setRecipe] = useState([]);            // [{raw_material_id, quantity_used, name, unit}]
  const [recipeType, setRecipeType] = useState('product');
  const [recipeSaving, setRecipeSaving] = useState(false);
  const [addingRm, setAddingRm] = useState(false);
  const [newRmId, setNewRmId] = useState('');
  const [newRmQty, setNewRmQty] = useState('');

  const fetchAll = useCallback(async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      const [rmRes, dirRes, prodRes] = await Promise.all([
        fetch(`${API}/api/raw-materials/store/${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/inventory/store/${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/products?store_id=${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (rmRes.ok) setRawMats(await rmRes.json());
      if (dirRes.ok) setDirectData(await dirRes.json());
      if (prodRes.ok) {
        const d = await prodRes.json();
        setProducts(Array.isArray(d) ? d : (d.products || []));
      }
    } finally { setLoading(false); }
  }, [selectedStore?.id, token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Raw Materials CRUD ──────────────────────────────────────────────────────

  const openNewRm = () => {
    setRmForm({ name: '', quantity: '', unit: 'unidades', min_quantity: '', cost_per_unit: '' });
    setRmModal('new');
  };
  const openEditRm = (rm) => {
    setRmForm({ name: rm.name, quantity: String(parseFloat(rm.quantity) || ''), unit: rm.unit, min_quantity: rm.min_quantity > 0 ? String(parseFloat(rm.min_quantity)) : '', cost_per_unit: String(parseFloat(rm.cost_per_unit) || '') });
    setRmModal(rm);
  };

  const saveRm = async () => {
    if (!rmForm.name.trim()) return;
    setRmSaving(true);
    try {
      const body = {
        name: rmForm.name.trim(), quantity: parseFloat(rmForm.quantity) || 0,
        unit: rmForm.unit, min_quantity: parseFloat(rmForm.min_quantity) || 0,
        cost_per_unit: parseFloat(rmForm.cost_per_unit) || 0,
        store_id: selectedStore.id
      };
      if (rmModal === 'new') {
        await fetch(`${API}/api/raw-materials/store/${selectedStore.id}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body)
        });
      } else {
        await fetch(`${API}/api/raw-materials/${rmModal.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body)
        });
      }
      setRmModal(null);
      await fetchAll();
    } finally { setRmSaving(false); }
  };

  const deleteRm = async (rm) => {
    if (!confirm(`¿Eliminar "${rm.name}"? Se eliminarán sus recetas asociadas.`)) return;
    await fetch(`${API}/api/raw-materials/${rm.id}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ store_id: selectedStore.id })
    });
    await fetchAll();
  };

  const doRestock = async () => {
    if (restockAmount === '' || parseFloat(restockAmount) < 0) return;
    setRestockSaving(true);
    try {
      await fetch(`${API}/api/raw-materials/${restockItem.id}/restock`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantity: parseFloat(restockAmount), store_id: selectedStore.id })
      });
      setRestockItem(null);
      setRestockAmount('');
      await fetchAll();
    } finally { setRestockSaving(false); }
  };

  // ── Recipe editing ──────────────────────────────────────────────────────────

  const openRecipe = async (item, type = 'product') => {
    setRecipeProduct(item);
    setRecipeType(type);
    setAddingRm(false);
    setNewRmId(''); setNewRmQty('');
    const res = await fetch(`${API}/api/recipes/${type}/${item.id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setRecipe(await res.json());
    else setRecipe([]);
  };

  const saveRecipe = async () => {
    setRecipeSaving(true);
    try {
      await fetch(`${API}/api/recipes/${recipeType}/${recipeProduct.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: recipe.map(r => ({ raw_material_id: r.raw_material_id, quantity_used: r.quantity_used })), store_id: selectedStore.id })
      });
      setRecipeProduct(null);
      setRecipe([]);
    } finally { setRecipeSaving(false); }
  };

  const addToRecipe = () => {
    if (!newRmId || !newRmQty) return;
    const rm = rawMats.find(r => r.id === parseInt(newRmId));
    if (!rm) return;
    if (recipe.find(r => r.raw_material_id === rm.id)) {
      setRecipe(recipe.map(r => r.raw_material_id === rm.id ? { ...r, quantity_used: parseFloat(newRmQty) } : r));
    } else {
      setRecipe([...recipe, { raw_material_id: rm.id, quantity_used: parseFloat(newRmQty), name: rm.name, unit: rm.unit }]);
    }
    setNewRmId(''); setNewRmQty(''); setAddingRm(false);
  };

  // ── Direct stock editing ────────────────────────────────────────────────────

  const saveDirectStock = async (item, unlimited = null) => {
    setSavingDirect(true);
    try {
      if (directTab === 'products') {
        const isUnlimitedToggle = unlimited !== null;
        if (isUnlimitedToggle) {
          await fetch(`${API}/api/inventory/${item.id}/unlimited`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ unlimited_stock: unlimited, store_id: selectedStore.id })
          });
        } else {
          await fetch(`${API}/api/inventory/${item.id}/stock`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ stock: parseInt(editDirectVal) || 0, store_id: selectedStore.id })
          });
        }
      } else {
        const endpoint = directTab === 'ingredients' ? 'ingredient' : 'extra';
        const stockVal = unlimited !== null ? item.stock : parseInt(editDirectVal) || 0;
        const unlimitedVal = unlimited !== null ? unlimited : item.unlimited_stock;
        await fetch(`${API}/api/inventory/${endpoint}/${item.id}/stock`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ stock: stockVal, unlimited_stock: unlimitedVal, store_id: selectedStore.id })
        });
      }
      setEditingDirect(null);
      await fetchAll();
    } finally { setSavingDirect(false); }
  };

  // ── Derived data ────────────────────────────────────────────────────────────

  const filteredRm = rawMats.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));
  const rmAlerts = rawMats.filter(r => { const q = parseFloat(r.quantity) || 0, m = parseFloat(r.min_quantity) || 0; return q <= 0 || (m > 0 && q <= m); }).length;
  const directItems = directTab === 'products' ? directData.products : directTab === 'ingredients' ? directData.ingredients : directData.extras;
  const filteredDirect = directItems.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  const recipeItems = recipeType === 'product' ? (products.length > 0 ? products : directData.products)
    : recipeType === 'ingredient' ? directData.ingredients : directData.extras;
  const filteredRecipeItems = recipeItems.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  const estimatedCost = recipe.reduce((sum, r) => {
    const rm = rawMats.find(m => m.id === r.raw_material_id);
    return sum + (rm ? rm.cost_per_unit * r.quantity_used : 0);
  }, 0);

  // ── Render ──────────────────────────────────────────────────────────────────

  const TABS = [
    { key: 'raw',     label: 'Materias Primas', icon: faFlask },
    { key: 'recipes', label: 'Recetas',          icon: faListUl },
    { key: 'direct',  label: 'Stock Directo',    icon: faBox },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', color: '#111', padding: '24px', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesomeIcon icon={faWarehouse} style={{ color: '#D4AF37', fontSize: 16 }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Inventario</h1>
            {selectedStore && <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{selectedStore.name}</p>}
          </div>
        </div>
        <button onClick={fetchAll} disabled={loading} style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 7 }}>
          <FontAwesomeIcon icon={faSync} spin={loading} /> Actualizar
        </button>
      </div>

      {/* Alert banner */}
      {rmAlerts > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#ef4444' }} />
          <span style={{ color: '#fca5a5' }}><strong>{rmAlerts}</strong> materia(s) prima(s) con stock bajo o agotado</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f3f4f6', borderRadius: 10, padding: 4, border: '1px solid #e5e7eb' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); setEditingDirect(null); setRecipeProduct(null); }} style={{
            flex: 1, padding: '9px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === t.key ? '#D4AF37' : 'transparent',
            color: tab === t.key ? '#000' : '#6b7280',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.15s'
          }}>
            <FontAwesomeIcon icon={t.icon} /> {t.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 12 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ ...inputStyle, paddingLeft: 34 }} />
      </div>

      {/* ──── TAB: MATERIAS PRIMAS ──── */}
      {tab === 'raw' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={openNewRm} style={btnGold}>
              <FontAwesomeIcon icon={faPlus} /> Nueva Materia Prima
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Cargando...</div>
          ) : filteredRm.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              <FontAwesomeIcon icon={faBoxOpen} style={{ fontSize: 32, marginBottom: 12, display: 'block' }} />
              {search ? 'Sin resultados' : 'Aún no hay materias primas. Agrega harina, arroz, pollo, etc.'}
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 100px 110px 100px 110px', padding: '10px 16px', borderBottom: '1px solid #f3f4f6', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <span>Nombre</span><span>Cantidad</span><span>Unidad</span><span>Mínimo</span><span>Estado</span><span style={{ textAlign: 'right' }}>Acciones</span>
              </div>
              {filteredRm.map((rm, idx) => {
                const b = rmBadge(rm);
                return (
                  <div key={rm.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 100px 110px 100px 110px', padding: '12px 16px', borderBottom: idx < filteredRm.length - 1 ? '1px solid #f3f4f6' : 'none', alignItems: 'center', background: (parseFloat(rm.quantity)||0) <= 0 ? 'rgba(239,68,68,0.03)' : (parseFloat(rm.quantity)||0) <= (parseFloat(rm.min_quantity)||0) && (parseFloat(rm.min_quantity)||0) > 0 ? 'rgba(245,158,11,0.03)' : 'transparent' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{rm.name}</div>
                      {rm.cost_per_unit > 0 && <div style={{ fontSize: 11, color: '#9ca3af' }}>Costo: ${fmt(rm.cost_per_unit)}/{rm.unit}</div>}
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: b.color }}>{fmt(rm.quantity, 3)}</span>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>{rm.unit}</span>
                    <span style={{ fontSize: 13, color: '#9ca3af' }}>{rm.min_quantity > 0 ? `≥ ${fmt(rm.min_quantity)}` : '—'}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, background: b.bg, color: b.color, border: `1px solid ${b.border}`, padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap', display: 'inline-block' }}>{b.label}</span>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => { setRestockItem(rm); setRestockAmount(''); }} title="Reponer stock" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: '#22c55e', fontSize: 12 }}>
                        <FontAwesomeIcon icon={faArrowUp} />
                      </button>
                      <button onClick={() => openEditRm(rm)} style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: '#D4AF37', fontSize: 12 }}>
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button onClick={() => deleteRm(rm)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: '#ef4444', fontSize: 12 }}>
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ──── TAB: RECETAS ──── */}
      {tab === 'recipes' && !recipeProduct && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {['product', 'ingredient', 'extra'].map(t => (
              <button key={t} onClick={() => setRecipeType(t)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${recipeType === t ? '#D4AF37' : '#e5e7eb'}`, background: recipeType === t ? 'rgba(212,175,55,0.12)' : 'transparent', color: recipeType === t ? '#D4AF37' : '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {t === 'product' ? 'Productos' : t === 'ingredient' ? 'Complementos' : 'Extras'}
              </button>
            ))}
          </div>

          {rawMats.length === 0 && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 13, color: '#fbbf24' }}>
              <FontAwesomeIcon icon={faExclamationTriangle} style={{ marginRight: 8 }} />
              Primero carga tus materias primas en la pestaña "Materias Primas".
            </div>
          )}

          {filteredRecipeItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Sin ítems</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredRecipeItems.map(item => (
                <div key={item.id} onClick={() => openRecipe(item, recipeType)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#D4AF37'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</div>
                    {item.price > 0 && <div style={{ fontSize: 12, color: '#9ca3af' }}>${fmt(item.price, 2)}</div>}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    Click para editar receta →
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Recipe editor panel */}
      {tab === 'recipes' && recipeProduct && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(212,175,55,0.3)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Receta de</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#D4AF37' }}>{recipeProduct.name}</div>
            </div>
            <button onClick={() => { setRecipeProduct(null); setRecipe([]); }} style={btnGhost}>
              <FontAwesomeIcon icon={faTimes} /> Volver
            </button>
          </div>

          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 0, marginBottom: 16 }}>
            Define qué materias primas se consumen por cada unidad vendida de este ítem.
          </p>

          {recipe.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 13 }}>Sin ingredientes en la receta aún.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px 36px', fontSize: 11, color: '#9ca3af', fontWeight: 700, padding: '0 4px', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span>Materia Prima</span><span>Cantidad</span><span>Unidad</span><span></span>
              </div>
              {recipe.map((r, i) => {
                const rm = rawMats.find(m => m.id === r.raw_material_id);
                return (
                  <div key={r.raw_material_id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px 36px', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{r.name || rm?.name}</span>
                    <input
                      type="number" min="0.001" step="0.001"
                      value={r.quantity_used}
                      onChange={e => setRecipe(recipe.map((x, j) => j === i ? { ...x, quantity_used: parseFloat(e.target.value) || 0 } : x))}
                      style={{ ...inputStyle, textAlign: 'center', padding: '6px 8px' }}
                    />
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{r.unit || rm?.unit}</span>
                    <button onClick={() => setRecipe(recipe.filter((_, j) => j !== i))} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: '#ef4444' }}>
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {estimatedCost > 0 && (
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
              Costo estimado por unidad: <span style={{ color: '#D4AF37', fontWeight: 700 }}>${fmt(estimatedCost)}</span>
            </div>
          )}

          {/* Add raw material to recipe */}
          {rawMats.length > 0 && (
            addingRm ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: 2, minWidth: 140 }}>
                  <label style={labelStyle}>Materia Prima</label>
                  <select value={newRmId} onChange={e => setNewRmId(e.target.value)} style={{ ...inputStyle }}>
                    <option value="">Seleccionar...</option>
                    {rawMats.map(rm => <option key={rm.id} value={rm.id}>{rm.name} ({rm.unit})</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 90 }}>
                  <label style={labelStyle}>Cantidad</label>
                  <input type="number" min="0.001" step="0.001" placeholder="ej: 0.200" value={newRmQty} onChange={e => setNewRmQty(e.target.value)} style={inputStyle} />
                </div>
                <button onClick={addToRecipe} disabled={!newRmId || !newRmQty} style={{ ...btnGold, opacity: (!newRmId || !newRmQty) ? 0.5 : 1 }}>
                  <FontAwesomeIcon icon={faPlus} /> Agregar
                </button>
                <button onClick={() => { setAddingRm(false); setNewRmId(''); setNewRmQty(''); }} style={btnGhost}>Cancelar</button>
              </div>
            ) : (
              <button onClick={() => setAddingRm(true)} style={{ ...btnGhost, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6, color: '#D4AF37', borderColor: 'rgba(212,175,55,0.4)' }}>
                <FontAwesomeIcon icon={faPlus} /> Agregar Materia Prima
              </button>
            )
          )}

          <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
            <button onClick={() => { setRecipeProduct(null); setRecipe([]); }} style={btnGhost}>Cancelar</button>
            <button onClick={saveRecipe} disabled={recipeSaving} style={btnGold}>
              <FontAwesomeIcon icon={faSave} /> {recipeSaving ? 'Guardando...' : 'Guardar Receta'}
            </button>
          </div>
        </div>
      )}

      {/* ──── TAB: STOCK DIRECTO (minimarket) ──── */}
      {tab === 'direct' && (
        <>
          <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: '#f3f4f6', borderRadius: 8, padding: 4, border: '1px solid #e5e7eb' }}>
            {[
              { key: 'products', label: `Productos (${directData.products.length})` },
              { key: 'ingredients', label: `Complementos (${directData.ingredients.length})` },
              { key: 'extras', label: `Extras (${directData.extras.length})` },
            ].map(t => (
              <button key={t.key} onClick={() => { setDirectTab(t.key); setEditingDirect(null); }} style={{ flex: 1, padding: '7px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: directTab === t.key ? '#D4AF37' : 'transparent', color: directTab === t.key ? '#000' : '#6b7280', transition: 'all 0.15s' }}>
                {t.label}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 0, marginBottom: 14 }}>
            Para minimarket o ítems sin receta. Gestiona unidades de stock directamente.
          </p>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Cargando...</div>
          ) : filteredDirect.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              <FontAwesomeIcon icon={faBoxOpen} style={{ fontSize: 28, marginBottom: 10, display: 'block' }} />
              Sin ítems
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 110px 140px', padding: '10px 16px', borderBottom: '1px solid #f3f4f6', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <span>Nombre</span><span>Categoría</span><span style={{ textAlign: 'center' }}>Stock</span><span style={{ textAlign: 'center' }}>Estado</span>
              </div>
              {filteredDirect.map((item, idx) => {
                const b = statusBadge(item);
                const isEditing = editingDirect === item.id;
                return (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 150px 110px 140px', padding: '11px 16px', borderBottom: idx < filteredDirect.length - 1 ? '1px solid #f3f4f6' : 'none', alignItems: 'center', background: item.unlimited_stock ? 'transparent' : item.stock === 0 ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</span>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>{item.category_name || '—'}</span>
                    <div style={{ textAlign: 'center' }}>
                      {item.unlimited_stock ? (
                        <span style={{ color: '#D4AF37', fontSize: 14 }}><FontAwesomeIcon icon={faInfinity} /></span>
                      ) : isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <input type="number" min="0" value={editDirectVal} onChange={e => setEditDirectVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveDirectStock(item); if (e.key === 'Escape') setEditingDirect(null); }}
                            autoFocus style={{ width: 56, padding: '4px 6px', background: '#fff', border: '1px solid #D4AF37', borderRadius: 6, color: '#111', fontSize: 13, textAlign: 'center', outline: 'none' }} />
                          <button onClick={() => saveDirectStock(item)} disabled={savingDirect} style={{ background: '#D4AF37', border: 'none', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', color: '#000', fontSize: 12, fontWeight: 700 }}>✓</button>
                          <button onClick={() => setEditingDirect(null)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', color: '#374151', fontSize: 12 }}>✕</button>
                        </div>
                      ) : (
                        <span onClick={() => { setEditingDirect(item.id); setEditDirectVal(String(item.stock)); }} title="Click para editar"
                          style={{ cursor: 'pointer', fontSize: 14, fontWeight: 700, color: b.color, borderBottom: '1px dashed #d1d5db', paddingBottom: 1 }}>
                          {item.stock}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, background: b.bg, color: b.color, border: `1px solid ${b.border}`, padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                        {b.label}
                      </span>
                      <button onClick={() => saveDirectStock(item, !item.unlimited_stock)} disabled={savingDirect}
                        title={item.unlimited_stock ? 'Quitar ilimitado' : 'Marcar ilimitado'}
                        style={{ background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12, color: item.unlimited_stock ? '#D4AF37' : '#d1d5db' }}>
                        <FontAwesomeIcon icon={faInfinity} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ──── MODAL: Nueva / Editar Materia Prima ──── */}
      {rmModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
          onClick={() => setRmModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440 }}>
            <h3 style={{ margin: '0 0 18px', color: '#D4AF37', fontSize: 17, fontWeight: 700 }}>
              {rmModal === 'new' ? 'Nueva Materia Prima' : `Editar: ${rmModal.name}`}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nombre *</label>
                <input autoFocus value={rmForm.name} onChange={e => setRmForm({ ...rmForm, name: e.target.value })} placeholder="ej: Harina, Pollo, Arroz..." style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Cantidad actual</label>
                  <input type="number" min="0" step="0.001" value={rmForm.quantity} onChange={e => setRmForm({ ...rmForm, quantity: e.target.value })} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Unidad</label>
                  <select value={rmForm.unit} onChange={e => setRmForm({ ...rmForm, unit: e.target.value })} style={inputStyle}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Stock mínimo (alerta)</label>
                  <input type="number" min="0" step="0.001" value={rmForm.min_quantity} onChange={e => setRmForm({ ...rmForm, min_quantity: e.target.value })} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Costo por {rmForm.unit || 'unidad'}</label>
                  <input type="number" min="0" step="0.0001" value={rmForm.cost_per_unit} onChange={e => setRmForm({ ...rmForm, cost_per_unit: e.target.value })} placeholder="0.00" style={inputStyle} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setRmModal(null)} style={{ ...btnGhost, flex: 1, justifyContent: 'center' }}>Cancelar</button>
              <button onClick={saveRm} disabled={!rmForm.name.trim() || rmSaving} style={{ ...btnGold, flex: 1, justifyContent: 'center', opacity: !rmForm.name.trim() ? 0.5 : 1 }}>
                <FontAwesomeIcon icon={faSave} /> {rmSaving ? 'Guardando...' : (rmModal === 'new' ? 'Crear' : 'Guardar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──── MODAL: Reponer stock ──── */}
      {restockItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
          onClick={() => setRestockItem(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 360 }}>
            <h3 style={{ margin: '0 0 6px', color: '#22c55e', fontSize: 17, fontWeight: 700 }}>
              <FontAwesomeIcon icon={faArrowUp} style={{ marginRight: 8 }} /> Actualizar Stock
            </h3>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 18px' }}>
              {restockItem.name} — stock actual: <strong style={{ color: '#111' }}>{fmt(restockItem.quantity, 3)} {restockItem.unit}</strong>
            </p>
            <div>
              <label style={labelStyle}>Nueva cantidad ({restockItem.unit})</label>
              <input autoFocus type="number" min="0" step="0.001" value={restockAmount}
                onChange={e => setRestockAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doRestock()}
                placeholder={`Ej: ${fmt(restockItem.quantity, 3)}`}
                style={inputStyle} />
            </div>
            {restockAmount !== '' && parseFloat(restockAmount) >= 0 && (
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
                {fmt(restockItem.quantity, 3)} → <strong style={{ color: '#22c55e' }}>{fmt(restockAmount, 3)} {restockItem.unit}</strong>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setRestockItem(null)} style={{ ...btnGhost, flex: 1, justifyContent: 'center' }}>Cancelar</button>
              <button onClick={doRestock} disabled={restockAmount === '' || parseFloat(restockAmount) < 0 || restockSaving}
                style={{ background: '#22c55e', border: 'none', borderRadius: 8, padding: '10px 18px', cursor: 'pointer', color: '#000', fontWeight: 700, fontSize: 13, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: restockAmount === '' || parseFloat(restockAmount) < 0 ? 0.5 : 1 }}>
                <FontAwesomeIcon icon={faCheck} /> {restockSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
