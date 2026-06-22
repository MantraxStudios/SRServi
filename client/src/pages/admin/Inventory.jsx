import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWarehouse, faSearch, faSync, faInfinity, faExclamationTriangle,
  faPlus, faTrash, faTimes, faCheck, faBoxOpen, faFlask,
  faListUl, faSave, faBox, faBell, faHistory, faChartBar,
  faChevronLeft, faChevronRight, faFolderOpen, faExchangeAlt, faTruck,
  faPaperPlane, faEdit, faClock
} from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

const API = 'https://srservi2.srautomatic.com';
const UNITS = ['unidades', 'kg', 'g', 'mg', 'litros', 'ml', 'porciones', 'tazas', 'cucharadas'];
const fmt = (n, max = 4) => parseFloat(parseFloat(n || 0).toFixed(max));

const RM_COLS = ['name', 'quantity', 'unit', 'min_quantity', 'cost_per_unit'];

function rmBadge(rm) {
  const qty = parseFloat(rm.quantity) || 0, min = parseFloat(rm.min_quantity) || 0;
  if (qty <= 0) return { label: 'Agotado', color: '#ef4444', bg: 'rgba(239,68,68,0.10)' };
  if (qty <= min && min > 0) return { label: 'Bajo', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' };
  return { label: 'OK', color: '#22c55e', bg: 'rgba(34,197,94,0.10)' };
}
function statusBadge(item) {
  if (item.unlimited_stock) return { label: '∞', color: '#D4AF37', bg: 'rgba(212,175,55,0.10)' };
  if (item.stock === 0) return { label: 'Sin stock', color: '#ef4444', bg: 'rgba(239,68,68,0.10)' };
  if (item.stock <= 5) return { label: 'Bajo', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' };
  return { label: 'OK', color: '#22c55e', bg: 'rgba(34,197,94,0.10)' };
}

const TH = { padding: '7px 12px', background: '#f8f9fa', borderBottom: '2px solid #dadce0', borderRight: '1px solid #e8eaed', fontWeight: 600, fontSize: 12, color: '#5f6368', textAlign: 'left', whiteSpace: 'nowrap' };
const TD = { padding: 0, borderBottom: '1px solid #e8eaed', borderRight: '1px solid #e8eaed', height: 36, position: 'relative', fontSize: 13 };
const CELL = { padding: '6px 12px', cursor: 'pointer', height: '100%', display: 'flex', alignItems: 'center', minHeight: 36 };
const CELL_INPUT = { width: '100%', height: '100%', padding: '6px 12px', border: '2px solid #D4AF37', outline: 'none', fontSize: 13, boxSizing: 'border-box', background: '#fff', position: 'absolute', inset: 0, zIndex: 2 };
const ROW_NUM = { ...TD, padding: '6px 8px', background: '#f8f9fa', color: '#80868b', fontSize: 12, textAlign: 'center', width: 40, cursor: 'default' };
const BADGE = (b) => ({ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: b.bg, color: b.color, whiteSpace: 'nowrap' });
const INPUT = { width: '100%', padding: '8px 12px', background: '#fff', border: '1px solid #dadce0', borderRadius: 6, color: '#111', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const BTN_GOLD = { background: '#D4AF37', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', color: '#000', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 };
const BTN_GHOST = { background: 'transparent', border: '1px solid #dadce0', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', color: '#5f6368', fontSize: 13 };

export default function Inventory() {
  const { selectedStore } = useStore();
  const { token } = useAuth();

  const [sheet, setSheet] = useState('sections');
  const [rawMats, setRawMats] = useState([]);
  const [directData, setDirectData] = useState({ products: [], ingredients: [], extras: [] });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Inline editing
  const [editCell, setEditCell] = useState(null);
  const [newRmRow, setNewRmRow] = useState(null);

  // Direct stock
  const [directTab, setDirectTab] = useState('products');
  const [editingStock, setEditingStock] = useState(null);
  const [editStockVal, setEditStockVal] = useState('');
  const [savingStock, setSavingStock] = useState(false);

  // Recipes
  const [recipeProduct, setRecipeProduct] = useState(null);
  const [recipe, setRecipe] = useState([]);
  const [recipeType, setRecipeType] = useState('product');
  const [recipeSaving, setRecipeSaving] = useState(false);
  const [addingRm, setAddingRm] = useState(false);
  const [newRmId, setNewRmId] = useState('');
  const [newRmQty, setNewRmQty] = useState('');

  // Alerts
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // History
  const [movements, setMovements] = useState([]);
  const [movementsTotal, setMovementsTotal] = useState(0);
  const [movPage, setMovPage] = useState(1);
  const [movTotalPages, setMovTotalPages] = useState(1);
  const [movFilter, setMovFilter] = useState({ item_type: '', reason: '', from: '', to: '' });
  const [movLoading, setMovLoading] = useState(false);

  // Reports
  const [stats, setStats] = useState(null);
  const [consumption, setConsumption] = useState([]);
  const [reportRange, setReportRange] = useState({ from: '', to: '' });
  const [reportLoading, setReportLoading] = useState(false);

  // Sections
  const [sections, setSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionModal, setSectionModal] = useState(null);
  const [sectionForm, setSectionForm] = useState({ name: '', color: '#D4AF37' });
  const [sectionSaving, setSectionSaving] = useState(false);
  const [addItemModal, setAddItemModal] = useState(null);
  const [addItemType, setAddItemType] = useState('product');
  const [addItemSearch, setAddItemSearch] = useState('');

  // Movements
  const [movReason, setMovReason] = useState('purchase');
  const [movItems, setMovItems] = useState([]);
  const [movItemType, setMovItemType] = useState('raw_material');
  const [movItemSearch, setMovItemSearch] = useState('');
  const [movSaving, setMovSaving] = useState(false);

  // Transfers
  const [transfers, setTransfers] = useState([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [userStores, setUserStores] = useState([]);
  const [transferModal, setTransferModal] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [transferItems, setTransferItems] = useState([]);
  const [transferItemType, setTransferItemType] = useState('raw_material');
  const [transferItemSearch, setTransferItemSearch] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [transferSaving, setTransferSaving] = useState(false);

  /* ─── Fetch functions ─────────────────────────────────────────────── */

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
      if (prodRes.ok) { const d = await prodRes.json(); setProducts(Array.isArray(d) ? d : (d.products || [])); }
    } finally { setLoading(false); }
  }, [selectedStore?.id, token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchAlerts = useCallback(async () => {
    if (!selectedStore) return;
    setAlertsLoading(true);
    try {
      const res = await fetch(`${API}/api/inventory/alerts/${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAlerts(await res.json());
    } finally { setAlertsLoading(false); }
  }, [selectedStore?.id, token]);

  const fetchMovements = useCallback(async (page = 1) => {
    if (!selectedStore) return;
    setMovLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (movFilter.item_type) params.append('item_type', movFilter.item_type);
      if (movFilter.reason) params.append('reason', movFilter.reason);
      if (movFilter.from) params.append('from', movFilter.from);
      if (movFilter.to) params.append('to', movFilter.to);
      const res = await fetch(`${API}/api/inventory/movements/${selectedStore.id}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setMovements(data.movements || []); setMovementsTotal(data.total || 0);
        setMovPage(data.page || 1); setMovTotalPages(data.totalPages || 1);
      }
    } finally { setMovLoading(false); }
  }, [selectedStore?.id, token, movFilter]);

  const fetchStats = useCallback(async () => {
    if (!selectedStore) return;
    setReportLoading(true);
    try {
      const [sR, cR] = await Promise.all([
        fetch(`${API}/api/inventory/stats/${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/inventory/reports/consumption/${selectedStore.id}?from=${reportRange.from}&to=${reportRange.to}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (sR.ok) setStats(await sR.json());
      if (cR.ok) setConsumption(await cR.json());
    } finally { setReportLoading(false); }
  }, [selectedStore?.id, token, reportRange]);

  const fetchSections = useCallback(async () => {
    if (!selectedStore) return;
    setSectionsLoading(true);
    try {
      const res = await fetch(`${API}/api/inventory/sections/${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSections(await res.json());
    } finally { setSectionsLoading(false); }
  }, [selectedStore?.id, token]);

  const fetchTransfers = useCallback(async () => {
    if (!selectedStore) return;
    setTransfersLoading(true);
    try {
      const res = await fetch(`${API}/api/inventory/transfers/${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setTransfers(await res.json());
    } finally { setTransfersLoading(false); }
  }, [selectedStore?.id, token]);

  const fetchUserStores = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/stores`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setUserStores(Array.isArray(d) ? d : []); }
    } catch (e) { console.error(e); }
  }, [token]);

  useEffect(() => { if (sheet === 'alerts') fetchAlerts(); }, [sheet, fetchAlerts]);
  useEffect(() => { if (sheet === 'history') fetchMovements(1); }, [sheet, fetchMovements]);
  useEffect(() => { if (sheet === 'reports') fetchStats(); }, [sheet, fetchStats]);
  useEffect(() => { if (sheet === 'sections') fetchSections(); }, [sheet, fetchSections]);
  useEffect(() => { if (sheet === 'transfers') { fetchTransfers(); fetchUserStores(); } }, [sheet, fetchTransfers, fetchUserStores]);

  /* ─── Raw Materials CRUD ──────────────────────────────────────────── */

  const saveRmCell = async (rm, col, value) => {
    const body = {
      name: col === 'name' ? value.trim() : rm.name,
      quantity: col === 'quantity' ? (parseFloat(value) || 0) : (parseFloat(rm.quantity) || 0),
      unit: col === 'unit' ? value : rm.unit,
      min_quantity: col === 'min_quantity' ? (parseFloat(value) || 0) : (parseFloat(rm.min_quantity) || 0),
      cost_per_unit: col === 'cost_per_unit' ? (parseFloat(value) || 0) : (parseFloat(rm.cost_per_unit) || 0),
      store_id: selectedStore.id
    };
    if (!body.name) return;
    await fetch(`${API}/api/raw-materials/${rm.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    fetchAll();
  };

  const createRm = async (row) => {
    if (!row.name?.trim()) return;
    await fetch(`${API}/api/raw-materials/store/${selectedStore.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: row.name.trim(), quantity: parseFloat(row.quantity) || 0,
        unit: row.unit || 'unidades', min_quantity: parseFloat(row.min_quantity) || 0,
        cost_per_unit: parseFloat(row.cost_per_unit) || 0, store_id: selectedStore.id
      })
    });
    setNewRmRow(null);
    fetchAll();
  };

  const deleteRm = async (rm) => {
    if (!confirm(`¿Eliminar "${rm.name}"?`)) return;
    await fetch(`${API}/api/raw-materials/${rm.id}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ store_id: selectedStore.id })
    });
    fetchAll();
  };

  /* ─── Inline edit handlers ────────────────────────────────────────── */

  const startEdit = (id, col, val) => setEditCell({ id, col, value: String(val ?? '') });

  const finishEdit = async () => {
    if (!editCell) return;
    const { id, col, value } = editCell;
    setEditCell(null);
    const rm = rawMats.find(r => r.id === id);
    if (!rm) return;
    const oldVal = col === 'quantity' || col === 'min_quantity' || col === 'cost_per_unit'
      ? String(fmt(rm[col], col === 'cost_per_unit' ? 4 : 3))
      : String(rm[col] ?? '');
    if (value === oldVal) return;
    await saveRmCell(rm, col, value);
  };

  const handleCellKey = (e, id, col) => {
    if (e.key === 'Enter') { finishEdit(); return; }
    if (e.key === 'Escape') { setEditCell(null); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const curIdx = RM_COLS.indexOf(col);
      if (e.shiftKey) {
        if (curIdx > 0) {
          finishEdit();
          const prev = RM_COLS[curIdx - 1];
          const rm = rawMats.find(r => r.id === id);
          if (rm) startEdit(id, prev, rm[prev]);
        }
      } else {
        if (curIdx < RM_COLS.length - 1) {
          finishEdit();
          const next = RM_COLS[curIdx + 1];
          const rm = rawMats.find(r => r.id === id);
          if (rm) startEdit(id, next, rm[next]);
        } else {
          finishEdit();
          const rowIdx = rawMats.findIndex(r => r.id === id);
          if (rowIdx < rawMats.length - 1) {
            const nr = rawMats[rowIdx + 1];
            startEdit(nr.id, 'name', nr.name);
          }
        }
      }
    }
  };

  /* ─── New row key handler ─────────────────────────────────────────── */

  const handleNewRowKey = (e, col) => {
    if (e.key === 'Enter') { if (newRmRow?.name?.trim()) createRm(newRmRow); return; }
    if (e.key === 'Escape') { setNewRmRow(null); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const curIdx = RM_COLS.indexOf(col);
      if (!e.shiftKey && curIdx === RM_COLS.length - 1 && newRmRow?.name?.trim()) {
        createRm(newRmRow);
      }
    }
  };

  /* ─── Direct stock ────────────────────────────────────────────────── */

  const saveDirectStock = async (item, unlimited = null) => {
    setSavingStock(true);
    try {
      if (directTab === 'products') {
        if (unlimited !== null) {
          await fetch(`${API}/api/inventory/${item.id}/unlimited`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ unlimited_stock: unlimited, store_id: selectedStore.id })
          });
        } else {
          await fetch(`${API}/api/inventory/${item.id}/stock`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ stock: parseInt(editStockVal) || 0, store_id: selectedStore.id })
          });
        }
      } else {
        const endpoint = directTab === 'ingredients' ? 'ingredient' : 'extra';
        await fetch(`${API}/api/inventory/${endpoint}/${item.id}/stock`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            stock: unlimited !== null ? item.stock : (parseInt(editStockVal) || 0),
            unlimited_stock: unlimited !== null ? unlimited : item.unlimited_stock,
            store_id: selectedStore.id
          })
        });
      }
      setEditingStock(null);
      fetchAll();
    } finally { setSavingStock(false); }
  };

  /* ─── Recipes ─────────────────────────────────────────────────────── */

  const openRecipe = async (item, type = 'product') => {
    setRecipeProduct(item); setRecipeType(type);
    setAddingRm(false); setNewRmId(''); setNewRmQty('');
    const res = await fetch(`${API}/api/recipes/${type}/${item.id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setRecipe(await res.json()); else setRecipe([]);
  };

  const saveRecipe = async () => {
    setRecipeSaving(true);
    try {
      await fetch(`${API}/api/recipes/${recipeType}/${recipeProduct.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: recipe.map(r => ({ raw_material_id: r.raw_material_id, quantity_used: r.quantity_used })), store_id: selectedStore.id })
      });
      setRecipeProduct(null); setRecipe([]);
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

  /* ─── Sections ────────────────────────────────────────────────────── */

  const saveSection = async () => {
    if (!sectionForm.name.trim()) return;
    setSectionSaving(true);
    try {
      if (sectionModal === 'new') {
        await fetch(`${API}/api/inventory/sections/${selectedStore.id}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: sectionForm.name, color: sectionForm.color })
        });
      } else {
        await fetch(`${API}/api/inventory/sections/${sectionModal.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: sectionForm.name, color: sectionForm.color, store_id: selectedStore.id })
        });
      }
      setSectionModal(null); fetchSections();
    } finally { setSectionSaving(false); }
  };

  const deleteSection = async (s) => {
    if (!confirm(`¿Eliminar sección "${s.name}"?`)) return;
    await fetch(`${API}/api/inventory/sections/${s.id}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ store_id: selectedStore.id })
    });
    fetchSections();
  };

  const addItemToSec = async (sectionId, itemType, itemId) => {
    await fetch(`${API}/api/inventory/sections/${sectionId}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ item_type: itemType, item_id: itemId, store_id: selectedStore.id })
    });
    setAddItemModal(null); fetchSections();
  };

  const removeItemFromSec = async (sectionId, itemType, itemId) => {
    await fetch(`${API}/api/inventory/sections/${sectionId}/items/${itemType}/${itemId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ store_id: selectedStore.id })
    });
    fetchSections();
  };

  /* ─── Movements ───────────────────────────────────────────────────── */

  const submitMovement = async () => {
    if (movItems.length === 0) return;
    setMovSaving(true);
    try {
      const items = movItems.map(m => {
        const item = { item_type: m.item_type, item_id: m.item_id, item_name: m.item_name, quantity: m.quantity };
        if (movReason === 'purchase' && m.unit_cost) item.unit_cost = parseFloat(m.unit_cost) || 0;
        return item;
      });
      await fetch(`${API}/api/inventory/movement`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ store_id: selectedStore.id, reason: movReason, items })
      });
      setMovItems([]); fetchAll();
    } finally { setMovSaving(false); }
  };

  /* ─── Transfers ───────────────────────────────────────────────────── */

  const submitTransfer = async () => {
    if (!transferTo || transferItems.length === 0) return;
    setTransferSaving(true);
    try {
      await fetch(`${API}/api/inventory/transfers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ from_store_id: selectedStore.id, to_store_id: parseInt(transferTo), items: transferItems, notes: transferNotes })
      });
      setTransferModal(false); setTransferItems([]); setTransferNotes(''); setTransferTo(''); fetchTransfers();
    } finally { setTransferSaving(false); }
  };

  const handleTransferAction = async (transferId, action) => {
    await fetch(`${API}/api/inventory/transfers/${transferId}/${action}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ store_id: selectedStore.id })
    });
    fetchTransfers(); fetchAll();
  };

  const acknowledgeAlert = async (id) => {
    await fetch(`${API}/api/inventory/alerts/${id}/acknowledge`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    fetchAlerts();
  };

  /* ─── Derived data ────────────────────────────────────────────────── */

  const filteredRm = rawMats.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));
  const rmAlerts = rawMats.filter(r => { const q = parseFloat(r.quantity) || 0, m = parseFloat(r.min_quantity) || 0; return q <= 0 || (m > 0 && q <= m); }).length;
  const directItems = directTab === 'products' ? directData.products : directTab === 'ingredients' ? directData.ingredients : directData.extras;
  const filteredDirect = directItems.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));
  const recipeItems = recipeType === 'product' ? (products.length > 0 ? products : directData.products) : recipeType === 'ingredient' ? directData.ingredients : directData.extras;
  const filteredRecipeItems = recipeItems.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));
  const estimatedCost = recipe.reduce((sum, r) => { const rm = rawMats.find(m => m.id === r.raw_material_id); return sum + (rm ? rm.cost_per_unit * r.quantity_used : 0); }, 0);

  /* ─── Cell renderer ───────────────────────────────────────────────── */

  const renderRmCell = (rm, col) => {
    const isEditing = editCell?.id === rm.id && editCell?.col === col;
    let displayVal;
    if (col === 'name') displayVal = rm.name;
    else if (col === 'quantity') displayVal = fmt(rm.quantity, 3);
    else if (col === 'unit') displayVal = rm.unit;
    else if (col === 'min_quantity') displayVal = rm.min_quantity > 0 ? fmt(rm.min_quantity) : '—';
    else if (col === 'cost_per_unit') displayVal = rm.cost_per_unit > 0 ? `$${fmt(rm.cost_per_unit)}` : '—';

    if (isEditing) {
      if (col === 'unit') {
        return (
          <td style={TD}>
            <select autoFocus value={editCell.value}
              onChange={e => setEditCell({ ...editCell, value: e.target.value })}
              onBlur={finishEdit}
              onKeyDown={e => handleCellKey(e, rm.id, col)}
              style={{ ...CELL_INPUT, cursor: 'pointer' }}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </td>
        );
      }
      return (
        <td style={TD}>
          <input autoFocus
            type={col === 'name' ? 'text' : 'number'}
            step={col === 'name' ? undefined : '0.001'}
            min={col === 'name' ? undefined : '0'}
            value={editCell.value}
            onChange={e => setEditCell({ ...editCell, value: e.target.value })}
            onBlur={finishEdit}
            onKeyDown={e => handleCellKey(e, rm.id, col)}
            style={CELL_INPUT} />
        </td>
      );
    }

    const rawVal = col === 'cost_per_unit' ? (rm.cost_per_unit > 0 ? fmt(rm.cost_per_unit) : '') : (col === 'min_quantity' ? (rm.min_quantity > 0 ? fmt(rm.min_quantity) : '') : rm[col]);
    return (
      <td style={TD} onClick={() => startEdit(rm.id, col, rawVal)}>
        <div style={{ ...CELL, color: (col === 'quantity') ? rmBadge(rm).color : undefined, fontWeight: col === 'quantity' ? 700 : undefined }}>
          {displayVal}
        </div>
      </td>
    );
  };

  /* ─── Sheets config ───────────────────────────────────────────────── */

  const SHEETS = [
    { key: 'sections',   label: 'Secciones',       icon: faFolderOpen },
    { key: 'movements',  label: 'Compras/Mov.',    icon: faExchangeAlt },
    { key: 'raw',        label: 'Materias Primas', icon: faFlask },
    { key: 'direct',     label: 'Stock Directo',   icon: faBox },
    { key: 'recipes',    label: 'Recetas',         icon: faListUl },
    { key: 'transfers',  label: 'Transferencias',  icon: faTruck },
    { key: 'alerts',     label: 'Alertas',         icon: faBell },
    { key: 'history',    label: 'Historial',       icon: faHistory },
    { key: 'reports',    label: 'Reportes',        icon: faChartBar },
  ];

  /* ─── RENDER ──────────────────────────────────────────────────────── */

  return (
    <div style={{ height: 'calc(100dvh - 62px)', background: '#fff', color: '#202124', fontFamily: "'Google Sans', Roboto, sans-serif", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ═══ Toolbar ═══ */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8eaed', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 'auto' }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, #D4AF37, #b8960c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesomeIcon icon={faWarehouse} style={{ color: '#fff', fontSize: 15 }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Inventario</div>
            {selectedStore && <div style={{ fontSize: 11, color: '#80868b' }}>{selectedStore.name}</div>}
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', minWidth: 180 }}>
          <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#80868b', fontSize: 12 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            style={{ ...INPUT, paddingLeft: 32, height: 34, fontSize: 12, borderRadius: 20, background: '#f8f9fa', border: '1px solid #e8eaed' }} />
        </div>

        {/* Alert indicator */}
        {rmAlerts > 0 && (
          <div onClick={() => setSheet('alerts')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 20, cursor: 'pointer', fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
            <FontAwesomeIcon icon={faExclamationTriangle} /> {rmAlerts}
          </div>
        )}

        <button onClick={fetchAll} disabled={loading} style={{ ...BTN_GHOST, borderRadius: 20, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <FontAwesomeIcon icon={faSync} spin={loading} />
        </button>
      </div>

      {/* ═══ Sheet tabs ═══ */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8eaed', display: 'flex', gap: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', flexShrink: 0, padding: '0 4px', position: 'sticky', top: 0, zIndex: 10 }}>
        {SHEETS.map(s => (
          <button key={s.key} onClick={() => { setSheet(s.key); setSearch(''); setEditCell(null); setNewRmRow(null); setEditingStock(null); setRecipeProduct(null); }}
            style={{
              padding: '11px 16px', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
              background: 'transparent',
              color: sheet === s.key ? '#D4AF37' : '#80868b',
              fontWeight: sheet === s.key ? 700 : 400,
              borderBottom: sheet === s.key ? '3px solid #D4AF37' : '3px solid transparent',
              transition: 'all 0.15s',
              marginBottom: -1
            }}>
            <FontAwesomeIcon icon={s.icon} style={{ fontSize: 11 }} /> {s.label}
          </button>
        ))}
      </div>

      {/* ═══ Sheet content ═══ */}
      <div style={{ flex: 1, padding: '0', overflow: 'auto' }}>

        {/* ──── MATERIAS PRIMAS ──── */}
        {sheet === 'raw' && (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ ...TH, width: 40, textAlign: 'center' }}>#</th>
                  <th style={{ ...TH, minWidth: 180 }}>Nombre</th>
                  <th style={{ ...TH, width: 110 }}>Cantidad</th>
                  <th style={{ ...TH, width: 110 }}>Unidad</th>
                  <th style={{ ...TH, width: 100 }}>Mínimo</th>
                  <th style={{ ...TH, width: 110 }}>Costo/Ud</th>
                  <th style={{ ...TH, width: 70, textAlign: 'center' }}>Estado</th>
                  <th style={{ ...TH, width: 50, textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {loading && filteredRm.length === 0 ? (
                  <tr><td colSpan={8} style={{ ...TD, textAlign: 'center', padding: 40, color: '#80868b' }}>Cargando...</td></tr>
                ) : filteredRm.length === 0 && !newRmRow ? (
                  <tr><td colSpan={8} style={{ ...TD, textAlign: 'center', padding: 40, color: '#80868b' }}>
                    <FontAwesomeIcon icon={faBoxOpen} style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
                    {search ? 'Sin resultados' : 'Sin materias primas. Click "+ Agregar fila" para empezar.'}
                  </td></tr>
                ) : filteredRm.map((rm, idx) => {
                  const b = rmBadge(rm);
                  return (
                    <tr key={rm.id} style={{ background: (parseFloat(rm.quantity) || 0) <= 0 ? 'rgba(239,68,68,0.03)' : undefined }}>
                      <td style={ROW_NUM}>{idx + 1}</td>
                      {renderRmCell(rm, 'name')}
                      {renderRmCell(rm, 'quantity')}
                      {renderRmCell(rm, 'unit')}
                      {renderRmCell(rm, 'min_quantity')}
                      {renderRmCell(rm, 'cost_per_unit')}
                      <td style={{ ...TD, textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 4px' }}>
                          <span style={BADGE(b)}>{b.label}</span>
                        </div>
                      </td>
                      <td style={{ ...TD, textAlign: 'center' }}>
                        <button onClick={() => deleteRm(rm)} title="Eliminar"
                          style={{ background: 'none', border: 'none', color: '#dadce0', cursor: 'pointer', fontSize: 13, padding: 4 }}
                          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={e => e.currentTarget.style.color = '#dadce0'}>
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* New row */}
                {newRmRow !== null && (
                  <tr style={{ background: '#fffbeb' }}>
                    <td style={ROW_NUM}><FontAwesomeIcon icon={faPlus} style={{ fontSize: 10 }} /></td>
                    <td style={TD}>
                      <input autoFocus placeholder="Nombre..." value={newRmRow.name}
                        onChange={e => setNewRmRow({ ...newRmRow, name: e.target.value })}
                        onKeyDown={e => handleNewRowKey(e, 'name')}
                        style={CELL_INPUT} />
                    </td>
                    <td style={TD}>
                      <input type="number" min="0" step="0.001" placeholder="0" value={newRmRow.quantity}
                        onChange={e => setNewRmRow({ ...newRmRow, quantity: e.target.value })}
                        onKeyDown={e => handleNewRowKey(e, 'quantity')}
                        style={CELL_INPUT} />
                    </td>
                    <td style={TD}>
                      <select value={newRmRow.unit}
                        onChange={e => setNewRmRow({ ...newRmRow, unit: e.target.value })}
                        onKeyDown={e => handleNewRowKey(e, 'unit')}
                        style={{ ...CELL_INPUT, cursor: 'pointer' }}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td style={TD}>
                      <input type="number" min="0" step="0.001" placeholder="0" value={newRmRow.min_quantity}
                        onChange={e => setNewRmRow({ ...newRmRow, min_quantity: e.target.value })}
                        onKeyDown={e => handleNewRowKey(e, 'min_quantity')}
                        style={CELL_INPUT} />
                    </td>
                    <td style={TD}>
                      <input type="number" min="0" step="0.0001" placeholder="0.00" value={newRmRow.cost_per_unit}
                        onChange={e => setNewRmRow({ ...newRmRow, cost_per_unit: e.target.value })}
                        onKeyDown={e => handleNewRowKey(e, 'cost_per_unit')}
                        style={CELL_INPUT} />
                    </td>
                    <td style={TD}></td>
                    <td style={{ ...TD, textAlign: 'center' }}>
                      <button onClick={() => setNewRmRow(null)} style={{ background: 'none', border: 'none', color: '#80868b', cursor: 'pointer', fontSize: 12 }}>
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Add row bar */}
            <div onClick={() => !newRmRow && setNewRmRow({ name: '', quantity: '', unit: 'unidades', min_quantity: '', cost_per_unit: '' })}
              style={{ padding: '10px 20px', borderTop: '1px solid #e8eaed', color: '#1a73e8', fontSize: 13, cursor: newRmRow ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: newRmRow ? 0.4 : 1, userSelect: 'none' }}
              onMouseEnter={e => { if (!newRmRow) e.currentTarget.style.background = '#f8f9fa'; }}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <FontAwesomeIcon icon={faPlus} style={{ fontSize: 11 }} /> Agregar fila
            </div>
          </div>
        )}

        {/* ──── STOCK DIRECTO ──── */}
        {sheet === 'direct' && (
          <div>
            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #dadce0', background: '#f8f9fa', paddingLeft: 12 }}>
              {[
                { key: 'products', label: `Productos (${directData.products.length})` },
                { key: 'ingredients', label: `Complementos (${directData.ingredients.length})` },
                { key: 'extras', label: `Extras (${directData.extras.length})` },
              ].map(t => (
                <button key={t.key} onClick={() => { setDirectTab(t.key); setEditingStock(null); }}
                  style={{ padding: '10px 18px', border: 'none', borderBottom: directTab === t.key ? '3px solid #D4AF37' : '3px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: directTab === t.key ? 600 : 400, background: 'transparent', color: directTab === t.key ? '#D4AF37' : '#5f6368' }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, width: 40, textAlign: 'center' }}>#</th>
                    <th style={{ ...TH, minWidth: 200 }}>Nombre</th>
                    <th style={{ ...TH, width: 140 }}>Categoría</th>
                    <th style={{ ...TH, width: 100, textAlign: 'center' }}>Stock</th>
                    <th style={{ ...TH, width: 80, textAlign: 'center' }}>Estado</th>
                    <th style={{ ...TH, width: 80, textAlign: 'center' }}>Ilimitado</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && filteredDirect.length === 0 ? (
                    <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', padding: 40, color: '#80868b' }}>Cargando...</td></tr>
                  ) : filteredDirect.length === 0 ? (
                    <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', padding: 40, color: '#80868b' }}>
                      <FontAwesomeIcon icon={faBoxOpen} style={{ fontSize: 24, marginBottom: 8, display: 'block' }} /> Sin ítems
                    </td></tr>
                  ) : filteredDirect.map((item, idx) => {
                    const b = statusBadge(item);
                    const isEditing = editingStock === item.id;
                    return (
                      <tr key={item.id} style={{ background: !item.unlimited_stock && item.stock === 0 ? 'rgba(239,68,68,0.03)' : undefined }}>
                        <td style={ROW_NUM}>{idx + 1}</td>
                        <td style={TD}><div style={CELL}>{item.name}</div></td>
                        <td style={TD}><div style={{ ...CELL, color: '#5f6368' }}>{item.category_name || '—'}</div></td>
                        <td style={{ ...TD, textAlign: 'center' }}>
                          {item.unlimited_stock ? (
                            <div style={{ ...CELL, justifyContent: 'center', color: '#D4AF37' }}><FontAwesomeIcon icon={faInfinity} /></div>
                          ) : isEditing ? (
                            <input autoFocus type="number" min="0" value={editStockVal}
                              onChange={e => setEditStockVal(e.target.value)}
                              onBlur={() => saveDirectStock(item)}
                              onKeyDown={e => { if (e.key === 'Enter') saveDirectStock(item); if (e.key === 'Escape') setEditingStock(null); }}
                              style={{ ...CELL_INPUT, textAlign: 'center' }} />
                          ) : (
                            <div onClick={() => { setEditingStock(item.id); setEditStockVal(String(item.stock)); }}
                              style={{ ...CELL, justifyContent: 'center', fontWeight: 700, color: b.color, cursor: 'pointer' }}>
                              {item.stock}
                            </div>
                          )}
                        </td>
                        <td style={{ ...TD, textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 4px' }}>
                            <span style={BADGE(b)}>{b.label}</span>
                          </div>
                        </td>
                        <td style={{ ...TD, textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 4px' }}>
                            <button onClick={() => saveDirectStock(item, !item.unlimited_stock)} disabled={savingStock}
                              style={{ background: 'none', border: `1px solid ${item.unlimited_stock ? '#D4AF37' : '#dadce0'}`, borderRadius: 4, padding: '3px 8px', cursor: 'pointer', color: item.unlimited_stock ? '#D4AF37' : '#dadce0', fontSize: 12 }}>
                              <FontAwesomeIcon icon={faInfinity} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ──── RECETAS ──── */}
        {sheet === 'recipes' && !recipeProduct && (
          <div>
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #dadce0', background: '#f8f9fa', paddingLeft: 12 }}>
              {['product', 'ingredient', 'extra'].map(t => (
                <button key={t} onClick={() => setRecipeType(t)}
                  style={{ padding: '10px 18px', border: 'none', borderBottom: recipeType === t ? '3px solid #D4AF37' : '3px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: recipeType === t ? 600 : 400, background: 'transparent', color: recipeType === t ? '#D4AF37' : '#5f6368' }}>
                  {t === 'product' ? 'Productos' : t === 'ingredient' ? 'Complementos' : 'Extras'}
                </button>
              ))}
            </div>

            {rawMats.length === 0 && (
              <div style={{ padding: '12px 20px', background: '#fef3cd', borderBottom: '1px solid #ffc107', fontSize: 13, color: '#856404', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FontAwesomeIcon icon={faExclamationTriangle} /> Primero carga materias primas en la hoja "Materias Primas".
              </div>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, width: 40, textAlign: 'center' }}>#</th>
                  <th style={TH}>Nombre</th>
                  <th style={{ ...TH, width: 100 }}>Precio</th>
                  <th style={{ ...TH, width: 140, textAlign: 'center' }}>Receta</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecipeItems.length === 0 ? (
                  <tr><td colSpan={4} style={{ ...TD, textAlign: 'center', padding: 40, color: '#80868b' }}>Sin ítems</td></tr>
                ) : filteredRecipeItems.map((item, idx) => (
                  <tr key={item.id} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={ROW_NUM}>{idx + 1}</td>
                    <td style={TD}><div style={CELL}>{item.name}</div></td>
                    <td style={TD}><div style={{ ...CELL, color: '#5f6368' }}>{item.price > 0 ? `$${fmt(item.price, 2)}` : '—'}</div></td>
                    <td style={{ ...TD, textAlign: 'center' }}>
                      <div style={{ ...CELL, justifyContent: 'center' }}>
                        <button onClick={() => openRecipe(item, recipeType)}
                          style={{ ...BTN_GHOST, padding: '4px 12px', fontSize: 12, borderRadius: 4, color: '#1a73e8', borderColor: '#1a73e8' }}>
                          <FontAwesomeIcon icon={faEdit} style={{ marginRight: 4 }} /> Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recipe editor */}
        {sheet === 'recipes' && recipeProduct && (
          <div style={{ padding: 24, maxWidth: 700 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Receta de</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#D4AF37' }}>{recipeProduct.name}</div>
              </div>
              <button onClick={() => { setRecipeProduct(null); setRecipe([]); }} style={BTN_GHOST}>
                <FontAwesomeIcon icon={faTimes} /> Volver
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
              <thead>
                <tr>
                  <th style={{ ...TH, width: 40, textAlign: 'center' }}>#</th>
                  <th style={TH}>Materia Prima</th>
                  <th style={{ ...TH, width: 120 }}>Cantidad</th>
                  <th style={{ ...TH, width: 80 }}>Unidad</th>
                  <th style={{ ...TH, width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {recipe.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...TD, textAlign: 'center', padding: 30, color: '#80868b', fontSize: 13 }}>Sin ingredientes aún</td></tr>
                ) : recipe.map((r, i) => {
                  const rm = rawMats.find(m => m.id === r.raw_material_id);
                  return (
                    <tr key={r.raw_material_id}>
                      <td style={ROW_NUM}>{i + 1}</td>
                      <td style={TD}><div style={CELL}>{r.name || rm?.name}</div></td>
                      <td style={TD}>
                        <input type="number" min="0.001" step="0.001" value={r.quantity_used}
                          onChange={e => setRecipe(recipe.map((x, j) => j === i ? { ...x, quantity_used: parseFloat(e.target.value) || 0 } : x))}
                          style={{ ...CELL_INPUT, position: 'relative', inset: 'unset', border: '1px solid #e8eaed', width: '100%' }} />
                      </td>
                      <td style={TD}><div style={{ ...CELL, color: '#5f6368' }}>{r.unit || rm?.unit}</div></td>
                      <td style={{ ...TD, textAlign: 'center' }}>
                        <button onClick={() => setRecipe(recipe.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13 }}>
                          <FontAwesomeIcon icon={faTimes} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {estimatedCost > 0 && (
              <div style={{ fontSize: 13, color: '#5f6368', marginBottom: 14 }}>
                Costo estimado: <strong style={{ color: '#D4AF37' }}>${fmt(estimatedCost)}</strong>
              </div>
            )}

            {rawMats.length > 0 && (
              addingRm ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 2, minWidth: 140 }}>
                    <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Materia Prima</label>
                    <select value={newRmId} onChange={e => setNewRmId(e.target.value)} style={INPUT}>
                      <option value="">Seleccionar...</option>
                      {rawMats.map(rm => <option key={rm.id} value={rm.id}>{rm.name} ({rm.unit})</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 80 }}>
                    <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Cantidad</label>
                    <input type="number" min="0.001" step="0.001" value={newRmQty} onChange={e => setNewRmQty(e.target.value)} placeholder="0.000" style={INPUT} />
                  </div>
                  <button onClick={addToRecipe} disabled={!newRmId || !newRmQty} style={{ ...BTN_GOLD, opacity: (!newRmId || !newRmQty) ? 0.5 : 1 }}>
                    <FontAwesomeIcon icon={faPlus} /> Agregar
                  </button>
                  <button onClick={() => { setAddingRm(false); setNewRmId(''); setNewRmQty(''); }} style={BTN_GHOST}>Cancelar</button>
                </div>
              ) : (
                <div onClick={() => setAddingRm(true)}
                  style={{ padding: '10px 20px', borderTop: '1px solid #e8eaed', color: '#1a73e8', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <FontAwesomeIcon icon={faPlus} style={{ fontSize: 11 }} /> Agregar materia prima
                </div>
              )
            )}

            <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid #e8eaed' }}>
              <button onClick={() => { setRecipeProduct(null); setRecipe([]); }} style={BTN_GHOST}>Cancelar</button>
              <button onClick={saveRecipe} disabled={recipeSaving} style={BTN_GOLD}>
                <FontAwesomeIcon icon={faSave} /> {recipeSaving ? 'Guardando...' : 'Guardar Receta'}
              </button>
            </div>
          </div>
        )}

        {/* ──── SECCIONES ──── */}
        {sheet === 'sections' && (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Secciones</div>
                <div style={{ fontSize: 12, color: '#80868b', marginTop: 2 }}>Organiza tu inventario por áreas</div>
              </div>
              <button onClick={() => { setSectionForm({ name: '', color: '#D4AF37' }); setSectionModal('new'); }} style={BTN_GOLD}>
                <FontAwesomeIcon icon={faPlus} /> Nueva
              </button>
            </div>

            {sectionsLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#80868b' }}>Cargando...</div>
            ) : sections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 80, color: '#80868b' }}>
                <FontAwesomeIcon icon={faFolderOpen} style={{ fontSize: 36, marginBottom: 12, display: 'block', color: '#dadce0' }} />
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Sin secciones</div>
                <div style={{ fontSize: 12 }}>Crea secciones para organizar tu inventario por áreas</div>
              </div>
            ) : (
              <>
                {/* ── Summary cards ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
                  {sections.map(sec => {
                    const total = sec.items.length;
                    const ok = sec.items.filter(i => parseFloat(i.current_stock) > 5).length;
                    const low = sec.items.filter(i => { const s = parseFloat(i.current_stock); return s > 0 && s <= 5; }).length;
                    const out = sec.items.filter(i => parseFloat(i.current_stock) <= 0).length;
                    const pct = total > 0 ? Math.round((ok / total) * 100) : 100;
                    const barColor = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
                    return (
                      <div key={sec.id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: '16px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: sec.color }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#202124' }}>{sec.name}</span>
                          <span style={{ fontSize: 22, fontWeight: 800, color: barColor }}>{pct}%</span>
                        </div>
                        <div style={{ height: 5, background: '#f1f3f4', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`, borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                            <span style={{ color: '#5f6368' }}>{ok}</span>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                            <span style={{ color: '#5f6368' }}>{low}</span>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                            <span style={{ color: '#5f6368' }}>{out}</span>
                          </span>
                          <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#80868b' }}>{total}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Section detail list ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {sections.map(sec => (
                    <div key={sec.id} style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: sec.items.length > 0 ? '1px solid #f1f3f4' : 'none', background: '#fafafa' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 4, height: 24, borderRadius: 2, background: sec.color }} />
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{sec.name}</span>
                          <span style={{ fontSize: 11, color: '#80868b', background: '#f1f3f4', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{sec.items.length}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => { setAddItemType('product'); setAddItemSearch(''); setAddItemModal(sec.id); }}
                            style={{ background: 'none', border: '1px solid #e8eaed', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: '#5f6368', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FontAwesomeIcon icon={faPlus} /> Agregar
                          </button>
                          <button onClick={() => { setSectionForm({ name: sec.name, color: sec.color }); setSectionModal(sec); }}
                            style={{ background: 'none', border: '1px solid #e8eaed', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#5f6368', fontSize: 11 }}>
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button onClick={() => deleteSection(sec)}
                            style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#ef4444', fontSize: 11 }}>
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </div>
                      {sec.items.length > 0 && (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                            <thead>
                              <tr style={{ background: '#f8f9fa' }}>
                                <th style={{ ...TH, minWidth: 160, paddingLeft: 20 }}>Item</th>
                                <th style={{ ...TH, width: 90, textAlign: 'center' }}>Stock</th>
                                <th style={{ ...TH, width: 120, textAlign: 'center' }}>Sector</th>
                                <th style={{ ...TH, width: 150, textAlign: 'center' }}>
                                  <FontAwesomeIcon icon={faClock} style={{ marginRight: 4, fontSize: 10 }} />
                                  Últ. Actualización
                                </th>
                                <th style={{ ...TH, width: 40, textAlign: 'center' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {sec.items.map((item, rowIdx) => {
                                const stock = parseFloat(item.current_stock) || 0;
                                const stockColor = stock <= 0 ? '#ef4444' : stock <= 5 ? '#f59e0b' : '#22c55e';
                                const stockBg = stock <= 0 ? 'rgba(239,68,68,0.08)' : stock <= 5 ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)';
                                const rawDate = item.updated_at || item.created_at || '';
                                let dateStr = '—', timeStr = '';
                                if (rawDate) {
                                  const d = new Date(rawDate);
                                  dateStr = d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                  timeStr = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
                                }
                                return (
                                  <tr key={`${item.item_type}-${item.item_id}`}
                                    style={{ background: rowIdx % 2 === 0 ? '#fff' : '#fafafa' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
                                    onMouseLeave={e => e.currentTarget.style.background = rowIdx % 2 === 0 ? '#fff' : '#fafafa'}>
                                    <td style={{ ...TD, paddingLeft: 20 }}>
                                      <div style={{ ...CELL, gap: 6, paddingLeft: 8 }}>
                                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#f1f3f4', color: '#80868b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                          {item.item_type === 'raw_material' ? 'MP' : item.item_type === 'product' ? 'Prod' : item.item_type === 'ingredient' ? 'Comp' : 'Extra'}
                                        </span>
                                        <span style={{ fontWeight: 500, color: '#202124' }}>{item.item_name}</span>
                                      </div>
                                    </td>
                                    <td style={TD}>
                                      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 8px' }}>
                                        <span style={{ fontWeight: 700, fontSize: 13, color: stockColor, background: stockBg, padding: '3px 10px', borderRadius: 20, minWidth: 40, textAlign: 'center' }}>
                                          {stock % 1 === 0 ? stock : fmt(stock, 2)}
                                        </span>
                                      </div>
                                    </td>
                                    <td style={TD}>
                                      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 8px' }}>
                                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: sec.color + '18', color: sec.color, fontWeight: 600 }}>
                                          {sec.name}
                                        </span>
                                      </div>
                                    </td>
                                    <td style={TD}>
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', lineHeight: 1.3 }}>
                                        {rawDate ? (
                                          <>
                                            <span style={{ fontSize: 12, fontWeight: 500, color: '#202124' }}>{dateStr}</span>
                                            <span style={{ fontSize: 10, color: '#80868b' }}>{timeStr}</span>
                                          </>
                                        ) : (
                                          <span style={{ fontSize: 12, color: '#80868b' }}>—</span>
                                        )}
                                      </div>
                                    </td>
                                    <td style={{ ...TD, textAlign: 'center' }}>
                                      <button onClick={() => removeItemFromSec(sec.id, item.item_type, item.item_id)}
                                        style={{ background: 'none', border: 'none', color: '#dadce0', cursor: 'pointer', fontSize: 13, padding: 4 }}
                                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                        onMouseLeave={e => e.currentTarget.style.color = '#dadce0'}>
                                        <FontAwesomeIcon icon={faTimes} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ──── COMPRAS / MOVIMIENTOS ──── */}
        {sheet === 'movements' && (
          <div style={{ padding: 0 }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#202124' }}>Registrar Movimiento</div>
                <div style={{ fontSize: 12, color: '#80868b', marginTop: 2 }}>Compras, entradas y salidas de inventario</div>
              </div>
              <button onClick={submitMovement} disabled={movItems.length === 0 || movSaving}
                style={{ ...BTN_GOLD, opacity: movItems.length === 0 ? 0.5 : 1 }}>
                <FontAwesomeIcon icon={faCheck} /> {movSaving ? 'Registrando...' : 'Registrar'}
              </button>
            </div>

            <div style={{ padding: '16px 20px' }}>
              {/* Reason selector */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[
                  { key: 'purchase', label: 'Compra', icon: faTruck, color: '#1a73e8' },
                  { key: 'entry', label: 'Entrada', icon: faPlus, color: '#34a853' },
                  { key: 'exit', label: 'Salida', icon: faExchangeAlt, color: '#ea4335' },
                ].map(r => (
                  <button key={r.key} onClick={() => setMovReason(r.key)} style={{
                    flex: 1, padding: '12px 16px', borderRadius: 10, border: `2px solid ${movReason === r.key ? r.color : '#e8eaed'}`,
                    cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: movReason === r.key ? r.color + '0A' : '#fff', color: movReason === r.key ? r.color : '#5f6368',
                    transition: 'all 0.15s'
                  }}>
                    <FontAwesomeIcon icon={r.icon} style={{ fontSize: 14 }} />
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Item type tabs + search */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '2px solid #e8eaed' }}>
                {['raw_material', 'product', 'ingredient', 'extra'].map(t => (
                  <button key={t} onClick={() => setMovItemType(t)} style={{
                    padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: 'transparent', color: movItemType === t ? '#D4AF37' : '#5f6368',
                    borderBottom: movItemType === t ? '2px solid #D4AF37' : '2px solid transparent',
                    marginBottom: -2, transition: 'all 0.15s'
                  }}>
                    {t === 'raw_material' ? 'Mat. Prima' : t === 'product' ? 'Productos' : t === 'ingredient' ? 'Ingredientes' : 'Extras'}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', marginBottom: 12 }}>
                <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#80868b', fontSize: 13 }} />
                <input value={movItemSearch} onChange={e => setMovItemSearch(e.target.value)} placeholder="Buscar item para agregar..."
                  style={{ ...INPUT, paddingLeft: 36 }} />
              </div>

              {movItemSearch && (() => {
                const source = movItemType === 'product' ? directData.products : movItemType === 'ingredient' ? directData.ingredients : movItemType === 'extra' ? directData.extras : rawMats;
                const filtered = source.filter(i => i.name.toLowerCase().includes(movItemSearch.toLowerCase())).slice(0, 8);
                return filtered.length > 0 ? (
                  <div style={{ border: '1px solid #dadce0', borderRadius: 8, marginBottom: 12, maxHeight: 200, overflowY: 'auto', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                    {filtered.map(item => {
                      const section = sections.find(s => s.items?.some(si => si.item_id === item.id && si.item_type === movItemType));
                      return (
                        <div key={item.id} onClick={() => {
                          if (!movItems.find(m => m.item_id === item.id && m.item_type === movItemType))
                            setMovItems([...movItems, { item_type: movItemType, item_id: item.id, item_name: item.name, quantity: 1, unit_cost: '', section_name: section?.name || '—', stock: movItemType === 'raw_material' ? (parseFloat(item.quantity) || 0) : (item.stock ?? 0), updated_at: item.updated_at || item.created_at || '' }]);
                          setMovItemSearch('');
                        }}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f3f4', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <span style={{ fontWeight: 500 }}>{item.name}</span>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {section && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: section.color + '15', color: section.color, fontWeight: 600 }}>{section.name}</span>}
                            <span style={{ fontSize: 11, color: '#80868b' }}>Stock: {movItemType === 'raw_material' ? fmt(item.quantity, 2) : item.stock ?? 0}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null;
              })()}

              {/* Items table */}
              {movItems.length > 0 && (
                <div style={{ border: '1px solid #e8eaed', borderRadius: 10, overflowX: 'auto', overflowY: 'visible', marginBottom: 16, WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 540 }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ ...TH, minWidth: 140 }}>Item</th>
                        <th style={{ ...TH, width: 80, textAlign: 'center' }}>Cantidad</th>
                        {movReason === 'purchase' && <th style={{ ...TH, width: 95, textAlign: 'center' }}>P. Unitario</th>}
                        {movReason === 'purchase' && <th style={{ ...TH, width: 95, textAlign: 'center' }}>Valor Total</th>}
                        <th style={{ ...TH, width: 70, textAlign: 'center' }}>Stock</th>
                        <th style={{ ...TH, width: 90, textAlign: 'center' }}>Sector</th>
                        <th style={{ ...TH, width: 100, textAlign: 'center' }}>
                          <FontAwesomeIcon icon={faClock} style={{ marginRight: 4, fontSize: 10 }} />
                          Últ. Actualiz.
                        </th>
                        <th style={{ ...TH, width: 36, textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {movItems.map((item, idx) => (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={TD}>
                            <div style={{ ...CELL, fontWeight: 500 }}>{item.item_name}</div>
                          </td>
                          <td style={TD}>
                            <input type="number" min="0.001" step="0.001" value={item.quantity}
                              onChange={e => setMovItems(movItems.map((m, i) => i === idx ? { ...m, quantity: parseFloat(e.target.value) || 0 } : m))}
                              style={{ width: '100%', padding: '6px 8px', border: '1px solid #e8eaed', borderRadius: 4, textAlign: 'center', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                          </td>
                          {movReason === 'purchase' && (
                            <td style={TD}>
                              <input type="number" min="0" step="0.01" placeholder="$0" value={item.unit_cost || ''}
                                onChange={e => setMovItems(movItems.map((m, i) => i === idx ? { ...m, unit_cost: e.target.value } : m))}
                                style={{ width: '100%', padding: '6px 8px', border: '1px solid #e8eaed', borderRadius: 4, textAlign: 'center', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                            </td>
                          )}
                          {movReason === 'purchase' && (
                            <td style={TD}>
                              <div style={{ ...CELL, justifyContent: 'center', fontWeight: 700, color: '#D4AF37' }}>
                                ${fmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0), 2)}
                              </div>
                            </td>
                          )}
                          <td style={TD}>
                            {(() => {
                              const s = item.stock || 0;
                              const sc = s <= 0 ? '#ef4444' : s <= 5 ? '#f59e0b' : '#22c55e';
                              const sb = s <= 0 ? 'rgba(239,68,68,0.08)' : s <= 5 ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)';
                              return (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 8px' }}>
                                  <span style={{ fontWeight: 700, fontSize: 13, color: sc, background: sb, padding: '3px 10px', borderRadius: 20, minWidth: 40, textAlign: 'center' }}>
                                    {fmt(s, 2)}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                          <td style={TD}>
                            {(() => {
                              const sec = sections.find(s => s.name === item.section_name);
                              const color = sec?.color || '#80868b';
                              return (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 8px' }}>
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: color + '18', color: color, fontWeight: 600 }}>
                                    {item.section_name || '—'}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                          <td style={TD}>
                            {(() => {
                              const rawDate = item.updated_at;
                              if (!rawDate) return <div style={{ ...CELL, justifyContent: 'center', color: '#80868b', fontSize: 12 }}>—</div>;
                              const d = new Date(rawDate);
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', lineHeight: 1.3 }}>
                                  <span style={{ fontSize: 12, fontWeight: 500, color: '#202124' }}>
                                    {d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                  </span>
                                  <span style={{ fontSize: 10, color: '#80868b' }}>
                                    {d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                          <td style={{ ...TD, textAlign: 'center' }}>
                            <button onClick={() => setMovItems(movItems.filter((_, i) => i !== idx))}
                              style={{ background: 'none', border: 'none', color: '#dadce0', cursor: 'pointer', fontSize: 13, padding: 4 }}
                              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={e => e.currentTarget.style.color = '#dadce0'}>
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {movItems.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#80868b', border: '2px dashed #e8eaed', borderRadius: 10 }}>
                  <FontAwesomeIcon icon={faBoxOpen} style={{ fontSize: 28, marginBottom: 10, display: 'block', color: '#dadce0' }} />
                  <div style={{ fontSize: 13 }}>Busca y agrega items para registrar el movimiento</div>
                </div>
              )}

              {/* Purchase total */}
              {movReason === 'purchase' && movItems.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, padding: '14px 20px', background: 'linear-gradient(135deg, #fffbeb, #fef3cd)', borderRadius: 10, border: '1px solid #f5e6a3' }}>
                  <span style={{ fontSize: 14, color: '#5f6368', fontWeight: 500 }}>Total compra:</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color: '#D4AF37' }}>
                    ${fmt(movItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0), 0), 2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──── TRANSFERENCIAS ──── */}
        {sheet === 'transfers' && (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Transferencias entre Locales</span>
              <button onClick={() => { setTransferModal(true); setTransferItems([]); setTransferTo(''); setTransferNotes(''); }} style={BTN_GOLD}
                disabled={userStores.filter(s => s.id !== selectedStore?.id).length === 0}>
                <FontAwesomeIcon icon={faPaperPlane} /> Nueva
              </button>
            </div>

            {userStores.filter(s => s.id !== selectedStore?.id).length === 0 && (
              <div style={{ padding: '10px 16px', background: '#fef3cd', border: '1px solid #ffc107', borderRadius: 6, marginBottom: 14, fontSize: 13, color: '#856404' }}>
                Necesitas más de una tienda para usar transferencias.
              </div>
            )}

            {transfersLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#80868b' }}>Cargando...</div>
            ) : transfers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#80868b' }}>
                <FontAwesomeIcon icon={faTruck} style={{ fontSize: 28, marginBottom: 10, display: 'block' }} /> Sin transferencias
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {transfers.map(t => {
                  const isSender = t.from_store_id === selectedStore?.id;
                  const sc = { pending: '#f59e0b', accepted: '#34a853', rejected: '#ea4335', cancelled: '#80868b' };
                  const sl = { pending: 'Pendiente', accepted: 'Aceptada', rejected: 'Rechazada', cancelled: 'Cancelada' };
                  return (
                    <div key={t.id} style={{ background: '#fff', border: '1px solid #dadce0', borderRadius: 8, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                          <FontAwesomeIcon icon={isSender ? faPaperPlane : faTruck} style={{ color: isSender ? '#1a73e8' : '#34a853', fontSize: 12 }} />
                          {isSender ? `Enviada a ${t.to_store_name}` : `Recibida de ${t.from_store_name}`}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 12, background: sc[t.status] + '15', color: sc[t.status] }}>
                          {sl[t.status]}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#80868b', marginBottom: 8 }}>
                        {new Date(t.created_at).toLocaleString('es-CL')}{t.notes && ` — ${t.notes}`}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: t.status === 'pending' ? 10 : 0 }}>
                        {t.items.map((item, i) => (
                          <span key={i} style={{ fontSize: 11, padding: '3px 8px', background: '#f1f3f4', borderRadius: 4, fontWeight: 500 }}>
                            {item.item_name} × {parseFloat(item.quantity)}
                          </span>
                        ))}
                      </div>
                      {t.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          {!isSender && (
                            <>
                              <button onClick={() => handleTransferAction(t.id, 'accept')}
                                style={{ background: '#34a853', border: 'none', borderRadius: 4, padding: '6px 14px', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                                <FontAwesomeIcon icon={faCheck} /> Aceptar
                              </button>
                              <button onClick={() => handleTransferAction(t.id, 'reject')}
                                style={{ background: '#ea4335', border: 'none', borderRadius: 4, padding: '6px 14px', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                                <FontAwesomeIcon icon={faTimes} /> Rechazar
                              </button>
                            </>
                          )}
                          {isSender && (
                            <button onClick={() => handleTransferAction(t.id, 'cancel')}
                              style={{ ...BTN_GHOST, padding: '6px 14px', fontSize: 12, color: '#ea4335' }}>Cancelar</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ──── ALERTAS ──── */}
        {sheet === 'alerts' && (
          <div style={{ padding: 20 }}>
            {alertsLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#80868b' }}>Cargando alertas...</div>
            ) : alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#34a853' }}>
                <FontAwesomeIcon icon={faCheck} style={{ fontSize: 28, marginBottom: 10, display: 'block' }} />
                No hay alertas. Inventario en orden.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, width: 40, textAlign: 'center' }}>#</th>
                    <th style={TH}>Item</th>
                    <th style={{ ...TH, width: 100 }}>Tipo</th>
                    <th style={{ ...TH, width: 80, textAlign: 'center' }}>Stock</th>
                    <th style={{ ...TH, width: 80, textAlign: 'center' }}>Mínimo</th>
                    <th style={{ ...TH, width: 90, textAlign: 'center' }}>Estado</th>
                    <th style={{ ...TH, width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a, idx) => (
                    <tr key={a.id} style={{ background: a.alert_type === 'out_of_stock' ? 'rgba(239,68,68,0.03)' : 'rgba(245,158,11,0.03)' }}>
                      <td style={ROW_NUM}>{idx + 1}</td>
                      <td style={TD}><div style={{ ...CELL, fontWeight: 600 }}>{a.item_name}</div></td>
                      <td style={TD}><div style={{ ...CELL, color: '#5f6368', fontSize: 12 }}>
                        {a.item_type === 'raw_material' ? 'Mat. prima' : a.item_type === 'product' ? 'Producto' : a.item_type === 'ingredient' ? 'Ingrediente' : 'Extra'}
                      </div></td>
                      <td style={{ ...TD, textAlign: 'center' }}>
                        <div style={{ ...CELL, justifyContent: 'center', fontWeight: 700, color: a.alert_type === 'out_of_stock' ? '#ef4444' : '#f59e0b' }}>{fmt(a.current_stock)}</div>
                      </td>
                      <td style={{ ...TD, textAlign: 'center' }}><div style={{ ...CELL, justifyContent: 'center', color: '#5f6368' }}>{a.threshold > 0 ? fmt(a.threshold) : '—'}</div></td>
                      <td style={{ ...TD, textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 4px' }}>
                          <span style={BADGE({ color: a.alert_type === 'out_of_stock' ? '#ef4444' : '#f59e0b', bg: a.alert_type === 'out_of_stock' ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)' })}>
                            {a.alert_type === 'out_of_stock' ? 'Agotado' : 'Bajo'}
                          </span>
                        </div>
                      </td>
                      <td style={{ ...TD, textAlign: 'center' }}>
                        <button onClick={() => acknowledgeAlert(a.id)}
                          style={{ ...BTN_GHOST, padding: '4px 10px', fontSize: 11, borderRadius: 4 }}>Enterado</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ──── HISTORIAL ──── */}
        {sheet === 'history' && (
          <div>
            {/* Filters bar */}
            <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid #dadce0', background: '#f8f9fa', flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={movFilter.item_type} onChange={e => setMovFilter(f => ({ ...f, item_type: e.target.value }))} style={{ ...INPUT, width: 'auto', minWidth: 120, padding: '6px 10px', fontSize: 12 }}>
                <option value="">Todos los tipos</option>
                <option value="product">Productos</option>
                <option value="ingredient">Ingredientes</option>
                <option value="extra">Extras</option>
                <option value="raw_material">Materias primas</option>
              </select>
              <select value={movFilter.reason} onChange={e => setMovFilter(f => ({ ...f, reason: e.target.value }))} style={{ ...INPUT, width: 'auto', minWidth: 120, padding: '6px 10px', fontSize: 12 }}>
                <option value="">Todas las razones</option>
                <option value="order">Orden</option><option value="manual">Manual</option>
                <option value="restock">Restock</option><option value="recipe">Receta</option>
                <option value="purchase">Compra</option><option value="entry">Entrada</option>
                <option value="exit">Salida</option><option value="transfer">Transferencia</option>
              </select>
              <input type="date" value={movFilter.from} onChange={e => setMovFilter(f => ({ ...f, from: e.target.value }))} style={{ ...INPUT, width: 'auto', padding: '6px 10px', fontSize: 12 }} />
              <input type="date" value={movFilter.to} onChange={e => setMovFilter(f => ({ ...f, to: e.target.value }))} style={{ ...INPUT, width: 'auto', padding: '6px 10px', fontSize: 12 }} />
              {movementsTotal > 0 && <span style={{ fontSize: 12, color: '#80868b' }}>{movementsTotal} mov.</span>}
            </div>

            {movLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#80868b' }}>Cargando...</div>
            ) : movements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#80868b' }}>
                <FontAwesomeIcon icon={faHistory} style={{ fontSize: 28, marginBottom: 10, display: 'block' }} /> Sin movimientos
              </div>
            ) : (
              <>
                <div style={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                    <thead>
                      <tr>
                        <th style={{ ...TH, width: 40, textAlign: 'center' }}>#</th>
                        <th style={{ ...TH, width: 130 }}>Fecha</th>
                        <th style={TH}>Item</th>
                        <th style={{ ...TH, width: 90 }}>Tipo</th>
                        <th style={{ ...TH, width: 80, textAlign: 'right' }}>Anterior</th>
                        <th style={{ ...TH, width: 80, textAlign: 'right' }}>Cambio</th>
                        <th style={{ ...TH, width: 80, textAlign: 'right' }}>Nuevo</th>
                        <th style={{ ...TH, width: 90 }}>Razón</th>
                        <th style={{ ...TH, width: 100 }}>Usuario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m, idx) => {
                        const reasonColors = { order: '#1a73e8', restock: '#34a853', recipe: '#ab47bc', manual: '#5f6368', purchase: '#1a73e8', entry: '#34a853', exit: '#ea4335', transfer: '#ab47bc' };
                        const reasonLabels = { order: 'Orden', restock: 'Restock', recipe: 'Receta', manual: 'Manual', purchase: 'Compra', entry: 'Entrada', exit: 'Salida', transfer: 'Transfer.' };
                        return (
                          <tr key={m.id}>
                            <td style={ROW_NUM}>{(movPage - 1) * 30 + idx + 1}</td>
                            <td style={TD}><div style={{ ...CELL, color: '#5f6368', fontSize: 12 }}>{new Date(m.created_at).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div></td>
                            <td style={TD}><div style={{ ...CELL, fontWeight: 500 }}>{m.item_name}</div></td>
                            <td style={TD}><div style={{ ...CELL, color: '#80868b', fontSize: 12 }}>
                              {m.item_type === 'raw_material' ? 'Mat. prima' : m.item_type === 'product' ? 'Producto' : m.item_type === 'ingredient' ? 'Ingrediente' : 'Extra'}
                            </div></td>
                            <td style={TD}><div style={{ ...CELL, justifyContent: 'flex-end', color: '#5f6368' }}>{fmt(m.previous_qty, 2)}</div></td>
                            <td style={TD}><div style={{ ...CELL, justifyContent: 'flex-end', fontWeight: 600, color: parseFloat(m.change_qty) >= 0 ? '#34a853' : '#ea4335' }}>
                              {parseFloat(m.change_qty) >= 0 ? '+' : ''}{fmt(m.change_qty, 2)}
                            </div></td>
                            <td style={TD}><div style={{ ...CELL, justifyContent: 'flex-end', fontWeight: 600 }}>{fmt(m.new_qty, 2)}</div></td>
                            <td style={TD}><div style={{ ...CELL }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: (reasonColors[m.reason] || '#5f6368') + '12', color: reasonColors[m.reason] || '#5f6368' }}>
                                {reasonLabels[m.reason] || m.reason}
                              </span>
                            </div></td>
                            <td style={TD}><div style={{ ...CELL, color: '#80868b', fontSize: 12 }}>{m.user_name || '—'}</div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {movTotalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: '1px solid #e8eaed' }}>
                    <button disabled={movPage <= 1} onClick={() => fetchMovements(movPage - 1)}
                      style={{ ...BTN_GHOST, padding: '5px 12px', opacity: movPage <= 1 ? 0.4 : 1 }}>
                      <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                    <span style={{ fontSize: 13, color: '#5f6368' }}>{movPage} / {movTotalPages}</span>
                    <button disabled={movPage >= movTotalPages} onClick={() => fetchMovements(movPage + 1)}
                      style={{ ...BTN_GHOST, padding: '5px 12px', opacity: movPage >= movTotalPages ? 0.4 : 1 }}>
                      <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ──── REPORTES ──── */}
        {sheet === 'reports' && (
          <div style={{ padding: 20 }}>
            {reportLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#80868b' }}>Cargando...</div>
            ) : (
              <>
                {stats && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
                    {[
                      { label: 'Total MP', value: stats.raw_materials?.total || 0, color: '#1a73e8' },
                      { label: 'Sin stock (MP)', value: stats.raw_materials?.out_of_stock || 0, color: '#ea4335' },
                      { label: 'Stock bajo (MP)', value: stats.raw_materials?.low_stock || 0, color: '#f59e0b' },
                      { label: 'Valor inv. (MP)', value: `$${(stats.raw_materials?.total_value || 0).toLocaleString()}`, color: '#34a853' },
                      { label: 'Total productos', value: stats.products?.total || 0, color: '#1a73e8' },
                      { label: 'Sin stock (Prod)', value: stats.products?.out_of_stock || 0, color: '#ea4335' },
                    ].map((c, i) => (
                      <div key={i} style={{ background: '#fff', border: '1px solid #dadce0', borderRadius: 8, padding: '14px 16px', borderTop: `3px solid ${c.color}` }}>
                        <div style={{ fontSize: 11, color: '#5f6368', marginBottom: 4 }}>{c.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 700 }}>{c.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ background: '#fff', border: '1px solid #dadce0', borderRadius: 8, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Top consumo de materias primas</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="date" value={reportRange.from} onChange={e => setReportRange(r => ({ ...r, from: e.target.value }))} style={{ ...INPUT, width: 'auto', padding: '6px 10px', fontSize: 12 }} />
                      <span style={{ color: '#80868b', fontSize: 12 }}>a</span>
                      <input type="date" value={reportRange.to} onChange={e => setReportRange(r => ({ ...r, to: e.target.value }))} style={{ ...INPUT, width: 'auto', padding: '6px 10px', fontSize: 12 }} />
                    </div>
                  </div>
                  {consumption.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 30, color: '#80868b', fontSize: 13 }}>Sin datos de consumo</div>
                  ) : (() => {
                    const maxVal = Math.max(...consumption.map(c => parseFloat(c.total_consumed) || 0), 1);
                    return consumption.map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ minWidth: 130, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.item_name}</span>
                        <div style={{ flex: 1, height: 18, background: '#f1f3f4', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 4, width: `${(parseFloat(c.total_consumed) / maxVal * 100)}%`, background: 'linear-gradient(90deg, #D4AF37, #f59e0b)' }} />
                        </div>
                        <span style={{ minWidth: 60, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{fmt(c.total_consumed, 2)}</span>
                        <span style={{ fontSize: 11, color: '#80868b', minWidth: 36 }}>{c.movement_count} mov</span>
                      </div>
                    ));
                  })()}
                </div>
              </>
            )}
          </div>
        )}
      </div>



      {/* ═══ MODALS ═══ */}

      {/* Section modal */}
      {sectionModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
          onClick={() => setSectionModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, color: '#202124' }}>
              {sectionModal === 'new' ? 'Nueva Sección' : 'Editar Sección'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Nombre *</label>
                <input autoFocus value={sectionForm.name} onChange={e => setSectionForm({ ...sectionForm, name: e.target.value })} placeholder="ej: Bebidas" style={INPUT} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Color</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={sectionForm.color} onChange={e => setSectionForm({ ...sectionForm, color: e.target.value })} style={{ width: 36, height: 32, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
                  <span style={{ fontSize: 12, color: '#80868b' }}>{sectionForm.color}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setSectionModal(null)} style={{ ...BTN_GHOST, flex: 1, textAlign: 'center' }}>Cancelar</button>
              <button onClick={saveSection} disabled={!sectionForm.name.trim() || sectionSaving} style={{ ...BTN_GOLD, flex: 1, justifyContent: 'center', opacity: !sectionForm.name.trim() ? 0.5 : 1 }}>
                {sectionSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add item to section modal */}
      {addItemModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
          onClick={() => setAddItemModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, padding: 24, width: '100%', maxWidth: 440, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Agregar Item a Sección</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {['product', 'ingredient', 'extra', 'raw_material'].map(t => (
                <button key={t} onClick={() => setAddItemType(t)} style={{
                  flex: 1, padding: '7px 6px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  background: addItemType === t ? '#e8f0fe' : '#f1f3f4', color: addItemType === t ? '#1a73e8' : '#5f6368'
                }}>
                  {t === 'product' ? 'Productos' : t === 'ingredient' ? 'Ingredientes' : t === 'extra' ? 'Extras' : 'Mat. Prima'}
                </button>
              ))}
            </div>
            <input value={addItemSearch} onChange={e => setAddItemSearch(e.target.value)} placeholder="Buscar..." style={{ ...INPUT, marginBottom: 10 }} />
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {(() => {
                const source = addItemType === 'product' ? directData.products : addItemType === 'ingredient' ? directData.ingredients : addItemType === 'extra' ? directData.extras : rawMats;
                const filtered = source.filter(i => !addItemSearch || i.name.toLowerCase().includes(addItemSearch.toLowerCase()));
                return filtered.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#80868b', fontSize: 13 }}>Sin resultados</div>
                ) : filtered.map(item => (
                  <div key={item.id} onClick={() => addItemToSec(addItemModal, addItemType, item.id)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f3f4', borderRadius: 4 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <span style={{ fontSize: 13 }}>{item.name}</span>
                    <FontAwesomeIcon icon={faPlus} style={{ color: '#1a73e8', fontSize: 12 }} />
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {transferModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
          onClick={() => setTransferModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, padding: 24, width: '100%', maxWidth: 500, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>
              <FontAwesomeIcon icon={faTruck} style={{ marginRight: 8, color: '#D4AF37' }} /> Nueva Transferencia
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Tienda destino *</label>
              <select value={transferTo} onChange={e => setTransferTo(e.target.value)} style={INPUT}>
                <option value="">Seleccionar tienda...</option>
                {userStores.filter(s => s.id !== selectedStore?.id).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Agregar items</label>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {['raw_material', 'product', 'ingredient', 'extra'].map(t => (
                  <button key={t} onClick={() => setTransferItemType(t)} style={{
                    flex: 1, padding: '6px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    background: transferItemType === t ? '#e8f0fe' : '#f1f3f4', color: transferItemType === t ? '#1a73e8' : '#5f6368'
                  }}>
                    {t === 'raw_material' ? 'Mat. Prima' : t === 'product' ? 'Productos' : t === 'ingredient' ? 'Ingredientes' : 'Extras'}
                  </button>
                ))}
              </div>
              <input value={transferItemSearch} onChange={e => setTransferItemSearch(e.target.value)} placeholder="Buscar item..." style={{ ...INPUT, marginBottom: 6 }} />
              {transferItemSearch && (() => {
                const source = transferItemType === 'product' ? directData.products : transferItemType === 'ingredient' ? directData.ingredients : transferItemType === 'extra' ? directData.extras : rawMats;
                const filtered = source.filter(i => i.name.toLowerCase().includes(transferItemSearch.toLowerCase())).slice(0, 6);
                return filtered.length > 0 ? (
                  <div style={{ border: '1px solid #dadce0', borderRadius: 6, marginBottom: 8, maxHeight: 180, overflowY: 'auto' }}>
                    {filtered.map(item => (
                      <div key={item.id} onClick={() => {
                        if (!transferItems.find(m => m.item_id === item.id && m.item_type === transferItemType))
                          setTransferItems([...transferItems, { item_type: transferItemType, item_id: item.id, item_name: item.name, quantity: 1 }]);
                        setTransferItemSearch('');
                      }}
                        style={{ padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f3f4', fontSize: 12 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                        {item.name}
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>
            {transferItems.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                {transferItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f1f3f4' }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{item.item_name}</span>
                    <input type="number" min="0.001" step="0.001" value={item.quantity}
                      onChange={e => setTransferItems(transferItems.map((m, i) => i === idx ? { ...m, quantity: parseFloat(e.target.value) || 0 } : m))}
                      style={{ ...INPUT, width: 80, padding: '5px 8px', textAlign: 'center' }} />
                    <button onClick={() => setTransferItems(transferItems.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#5f6368', display: 'block', marginBottom: 4 }}>Notas (opcional)</label>
              <input value={transferNotes} onChange={e => setTransferNotes(e.target.value)} placeholder="ej: Pedido urgente..." style={INPUT} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setTransferModal(false)} style={{ ...BTN_GHOST, flex: 1, textAlign: 'center' }}>Cancelar</button>
              <button onClick={submitTransfer} disabled={!transferTo || transferItems.length === 0 || transferSaving}
                style={{ ...BTN_GOLD, flex: 1, justifyContent: 'center', opacity: (!transferTo || transferItems.length === 0) ? 0.5 : 1 }}>
                <FontAwesomeIcon icon={faPaperPlane} /> {transferSaving ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}