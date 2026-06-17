import { useState, useEffect, useCallback, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWarehouse, faSearch, faSync, faInfinity, faExclamationTriangle,
  faPlus, faEdit, faTrash, faTimes, faCheck, faBoxOpen, faFlask,
  faListUl, faSave, faArrowUp, faBox, faBell, faHistory, faChartBar,
  faChevronLeft, faChevronRight, faFolderOpen, faExchangeAlt, faTruck,
  faPaperPlane
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

  // Movements (purchase/entry/exit)
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
        setMovements(data.movements || []);
        setMovementsTotal(data.total || 0);
        setMovPage(data.page || 1);
        setMovTotalPages(data.totalPages || 1);
      }
    } finally { setMovLoading(false); }
  }, [selectedStore?.id, token, movFilter]);

  const fetchStats = useCallback(async () => {
    if (!selectedStore) return;
    setReportLoading(true);
    try {
      const [statsRes, consRes] = await Promise.all([
        fetch(`${API}/api/inventory/stats/${selectedStore.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/inventory/reports/consumption/${selectedStore.id}?from=${reportRange.from}&to=${reportRange.to}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (consRes.ok) setConsumption(await consRes.json());
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
      if (res.ok) {
        const data = await res.json();
        setUserStores(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error(e); }
  }, [token]);

  useEffect(() => { if (tab === 'alerts') fetchAlerts(); }, [tab, fetchAlerts]);
  useEffect(() => { if (tab === 'history') fetchMovements(1); }, [tab, fetchMovements]);
  useEffect(() => { if (tab === 'reports') fetchStats(); }, [tab, fetchStats]);
  useEffect(() => { if (tab === 'sections') fetchSections(); }, [tab, fetchSections]);
  useEffect(() => { if (tab === 'transfers') { fetchTransfers(); fetchUserStores(); } }, [tab, fetchTransfers, fetchUserStores]);

  const acknowledgeAlert = async (id) => {
    await fetch(`${API}/api/inventory/alerts/${id}/acknowledge`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    fetchAlerts();
  };

  // ── Sections CRUD ────────────────────────────────────────────────────────
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
      setSectionModal(null);
      fetchSections();
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
    setAddItemModal(null);
    fetchSections();
  };

  const removeItemFromSec = async (sectionId, itemType, itemId) => {
    await fetch(`${API}/api/inventory/sections/${sectionId}/items/${itemType}/${itemId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ store_id: selectedStore.id })
    });
    fetchSections();
  };

  // ── Movements (purchase/entry/exit) ──────────────────────────────────────
  const submitMovement = async () => {
    if (movItems.length === 0) return;
    setMovSaving(true);
    try {
      await fetch(`${API}/api/inventory/movement`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ store_id: selectedStore.id, reason: movReason, items: movItems })
      });
      setMovItems([]);
      fetchAll();
    } finally { setMovSaving(false); }
  };

  // ── Transfers ────────────────────────────────────────────────────────────
  const submitTransfer = async () => {
    if (!transferTo || transferItems.length === 0) return;
    setTransferSaving(true);
    try {
      await fetch(`${API}/api/inventory/transfers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ from_store_id: selectedStore.id, to_store_id: parseInt(transferTo), items: transferItems, notes: transferNotes })
      });
      setTransferModal(false);
      setTransferItems([]);
      setTransferNotes('');
      setTransferTo('');
      fetchTransfers();
    } finally { setTransferSaving(false); }
  };

  const handleTransferAction = async (transferId, action) => {
    await fetch(`${API}/api/inventory/transfers/${transferId}/${action}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ store_id: selectedStore.id })
    });
    fetchTransfers();
    fetchAll();
  };

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
    { key: 'raw',       label: 'Materias Primas', icon: faFlask },
    { key: 'recipes',   label: 'Recetas',         icon: faListUl },
    { key: 'direct',    label: 'Stock Directo',   icon: faBox },
    { key: 'sections',  label: 'Secciones',       icon: faFolderOpen },
    { key: 'movements', label: 'Compras/Mov.',    icon: faExchangeAlt },
    { key: 'transfers', label: 'Transferencias',  icon: faTruck },
    { key: 'alerts',    label: 'Alertas',         icon: faBell },
    { key: 'history',   label: 'Historial',       icon: faHistory },
    { key: 'reports',   label: 'Reportes',        icon: faChartBar },
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

      {/* ──── TAB: ALERTAS ──── */}
      {tab === 'alerts' && (
        <div>
          {alertsLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Cargando alertas...</div>
          ) : alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#22c55e' }}>
              <FontAwesomeIcon icon={faCheck} style={{ fontSize: 28, marginBottom: 10, display: 'block' }} />
              No hay alertas activas. Todo el inventario está en orden.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.map(a => (
                <div key={a.id} style={{
                  background: a.alert_type === 'out_of_stock' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                  border: `1px solid ${a.alert_type === 'out_of_stock' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
                  borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12
                }}>
                  <FontAwesomeIcon icon={faExclamationTriangle}
                    style={{ color: a.alert_type === 'out_of_stock' ? '#ef4444' : '#f59e0b', fontSize: 16 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{a.item_name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {a.item_type === 'raw_material' ? 'Materia prima' : a.item_type === 'product' ? 'Producto' : a.item_type === 'ingredient' ? 'Ingrediente' : 'Extra'}
                      {' · '}Stock: <strong style={{ color: a.alert_type === 'out_of_stock' ? '#ef4444' : '#f59e0b' }}>{fmt(a.current_stock)}</strong>
                      {a.threshold > 0 && <> · Mínimo: {fmt(a.threshold)}</>}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                    background: a.alert_type === 'out_of_stock' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                    color: a.alert_type === 'out_of_stock' ? '#ef4444' : '#f59e0b',
                    border: `1px solid ${a.alert_type === 'out_of_stock' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`
                  }}>
                    {a.alert_type === 'out_of_stock' ? 'Agotado' : 'Stock bajo'}
                  </span>
                  <button onClick={() => acknowledgeAlert(a.id)}
                    style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: '#374151', fontWeight: 500 }}>
                    Enterado
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ──── TAB: HISTORIAL ──── */}
      {tab === 'history' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={movFilter.item_type} onChange={e => setMovFilter(f => ({ ...f, item_type: e.target.value }))} style={{ ...inputStyle, width: 'auto', minWidth: 130 }}>
              <option value="">Todos los tipos</option>
              <option value="product">Productos</option>
              <option value="ingredient">Ingredientes</option>
              <option value="extra">Extras</option>
              <option value="raw_material">Materias primas</option>
            </select>
            <select value={movFilter.reason} onChange={e => setMovFilter(f => ({ ...f, reason: e.target.value }))} style={{ ...inputStyle, width: 'auto', minWidth: 130 }}>
              <option value="">Todas las razones</option>
              <option value="order">Orden</option>
              <option value="manual">Manual</option>
              <option value="restock">Restock</option>
              <option value="recipe">Receta</option>
              <option value="purchase">Compra</option>
              <option value="entry">Entrada</option>
              <option value="exit">Salida</option>
              <option value="transfer">Transferencia</option>
            </select>
            <input type="date" value={movFilter.from} onChange={e => setMovFilter(f => ({ ...f, from: e.target.value }))} style={{ ...inputStyle, width: 'auto' }} />
            <input type="date" value={movFilter.to} onChange={e => setMovFilter(f => ({ ...f, to: e.target.value }))} style={{ ...inputStyle, width: 'auto' }} />
          </div>

          {movLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Cargando historial...</div>
          ) : movements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              <FontAwesomeIcon icon={faHistory} style={{ fontSize: 28, marginBottom: 10, display: 'block' }} />
              Sin movimientos registrados
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>{movementsTotal} movimiento(s) encontrado(s)</div>
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 90px 80px 80px 80px 90px 100px', padding: '10px 12px', borderBottom: '1px solid #f3f4f6', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', gap: 4 }}>
                  <span>Fecha</span><span>Item</span><span>Tipo</span><span style={{ textAlign: 'right' }}>Anterior</span><span style={{ textAlign: 'right' }}>Cambio</span><span style={{ textAlign: 'right' }}>Nuevo</span><span>Razón</span><span>Usuario</span>
                </div>
                {movements.map((m, idx) => (
                  <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 90px 80px 80px 80px 90px 100px', padding: '9px 12px', borderBottom: idx < movements.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: 12, alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#6b7280', fontSize: 11 }}>{new Date(m.created_at).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.item_name}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                      {m.item_type === 'raw_material' ? 'Mat. prima' : m.item_type === 'product' ? 'Producto' : m.item_type === 'ingredient' ? 'Ingrediente' : 'Extra'}
                    </span>
                    <span style={{ textAlign: 'right', color: '#6b7280' }}>{fmt(m.previous_qty, 2)}</span>
                    <span style={{ textAlign: 'right', fontWeight: 600, color: parseFloat(m.change_qty) >= 0 ? '#22c55e' : '#ef4444' }}>
                      {parseFloat(m.change_qty) >= 0 ? '+' : ''}{fmt(m.change_qty, 2)}
                    </span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(m.new_qty, 2)}</span>
                    <span style={{ fontSize: 11 }}>
                      <span style={{
                        padding: '2px 7px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                        background: m.reason === 'order' ? 'rgba(59,130,246,0.1)' : m.reason === 'restock' ? 'rgba(34,197,94,0.1)' : m.reason === 'recipe' ? 'rgba(168,85,247,0.1)' : m.reason === 'purchase' ? 'rgba(59,130,246,0.1)' : m.reason === 'entry' ? 'rgba(34,197,94,0.1)' : m.reason === 'exit' ? 'rgba(239,68,68,0.1)' : m.reason === 'transfer' ? 'rgba(168,85,247,0.1)' : 'rgba(107,114,128,0.1)',
                        color: m.reason === 'order' ? '#3b82f6' : m.reason === 'restock' ? '#22c55e' : m.reason === 'recipe' ? '#a855f7' : m.reason === 'purchase' ? '#3b82f6' : m.reason === 'entry' ? '#22c55e' : m.reason === 'exit' ? '#ef4444' : m.reason === 'transfer' ? '#a855f7' : '#6b7280'
                      }}>
                        {m.reason === 'order' ? 'Orden' : m.reason === 'restock' ? 'Restock' : m.reason === 'recipe' ? 'Receta' : m.reason === 'manual' ? 'Manual' : m.reason === 'purchase' ? 'Compra' : m.reason === 'entry' ? 'Entrada' : m.reason === 'exit' ? 'Salida' : m.reason === 'transfer' ? 'Transfer.' : m.reason}
                      </span>
                    </span>
                    <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.user_name || '—'}</span>
                  </div>
                ))}
              </div>
              {movTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
                  <button disabled={movPage <= 1} onClick={() => fetchMovements(movPage - 1)}
                    style={{ ...btnGhost, padding: '6px 12px', opacity: movPage <= 1 ? 0.4 : 1 }}>
                    <FontAwesomeIcon icon={faChevronLeft} />
                  </button>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Página {movPage} de {movTotalPages}</span>
                  <button disabled={movPage >= movTotalPages} onClick={() => fetchMovements(movPage + 1)}
                    style={{ ...btnGhost, padding: '6px 12px', opacity: movPage >= movTotalPages ? 0.4 : 1 }}>
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ──── TAB: REPORTES ──── */}
      {tab === 'reports' && (
        <div>
          {reportLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Cargando reportes...</div>
          ) : (
            <>
              {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
                  {[
                    { label: 'Total materias primas', value: stats.raw_materials?.total || 0, color: '#6366f1' },
                    { label: 'Sin stock (MP)', value: stats.raw_materials?.out_of_stock || 0, color: '#ef4444' },
                    { label: 'Stock bajo (MP)', value: stats.raw_materials?.low_stock || 0, color: '#f59e0b' },
                    { label: 'Valor inventario (MP)', value: `$${(stats.raw_materials?.total_value || 0).toLocaleString()}`, color: '#22c55e' },
                    { label: 'Total productos', value: stats.products?.total || 0, color: '#6366f1' },
                    { label: 'Sin stock (Prod)', value: stats.products?.out_of_stock || 0, color: '#ef4444' },
                  ].map((c, i) => (
                    <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px', borderLeft: `4px solid ${c.color}` }}>
                      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#111' }}>{c.value}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111' }}>Top consumo de materias primas</h3>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="date" value={reportRange.from} onChange={e => setReportRange(r => ({ ...r, from: e.target.value }))} style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 12 }} />
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>a</span>
                    <input type="date" value={reportRange.to} onChange={e => setReportRange(r => ({ ...r, to: e.target.value }))} style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 12 }} />
                  </div>
                </div>
                {consumption.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>Sin datos de consumo en este período</div>
                ) : (
                  <div>
                    {(() => {
                      const maxVal = Math.max(...consumption.map(c => parseFloat(c.total_consumed) || 0), 1);
                      return consumption.map((c, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span style={{ minWidth: 140, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.item_name}</span>
                          <div style={{ flex: 1, height: 20, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 6,
                              width: `${(parseFloat(c.total_consumed) / maxVal * 100)}%`,
                              background: 'linear-gradient(90deg, #D4AF37, #f59e0b)',
                              transition: 'width 0.3s'
                            }} />
                          </div>
                          <span style={{ minWidth: 70, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{fmt(c.total_consumed, 2)}</span>
                          <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 40 }}>{c.movement_count} mov</span>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ──── TAB: SECCIONES ──── */}
      {tab === 'sections' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Secciones de Inventario</h3>
            <button onClick={() => { setSectionForm({ name: '', color: '#D4AF37' }); setSectionModal('new'); }} style={btnGold}>
              <FontAwesomeIcon icon={faPlus} /> Nueva Sección
            </button>
          </div>
          {sectionsLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Cargando secciones...</div>
          ) : sections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              <FontAwesomeIcon icon={faFolderOpen} style={{ fontSize: 28, marginBottom: 10, display: 'block' }} />
              Crea secciones para organizar tu inventario
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sections.map(sec => (
                <div key={sec.id} style={{ background: '#fff', border: `1px solid ${sec.color}33`, borderLeft: `4px solid ${sec.color}`, borderRadius: 12, padding: 16, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sec.items.length > 0 ? 12 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: sec.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{sec.name}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: 10 }}>{sec.items.length} items</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setAddItemType('product'); setAddItemSearch(''); setAddItemModal(sec.id); }} style={{ ...btnGhost, padding: '5px 10px', fontSize: 11 }}>
                        <FontAwesomeIcon icon={faPlus} /> Agregar
                      </button>
                      <button onClick={() => { setSectionForm({ name: sec.name, color: sec.color }); setSectionModal(sec); }} style={{ ...btnGhost, padding: '5px 10px', fontSize: 11 }}>
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button onClick={() => deleteSection(sec)} style={{ ...btnGhost, padding: '5px 10px', fontSize: 11, color: '#ef4444', borderColor: '#fecaca' }}>
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </div>
                  {sec.items.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {sec.items.map(item => {
                        const stock = parseFloat(item.current_stock) || 0;
                        const isLow = stock <= 5 && stock > 0;
                        const isOut = stock <= 0;
                        return (
                          <div key={`${item.item_type}-${item.item_id}`} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                            background: isOut ? 'rgba(239,68,68,0.06)' : isLow ? 'rgba(245,158,11,0.06)' : '#f9fafb',
                            border: `1px solid ${isOut ? '#fecaca' : isLow ? '#fde68a' : '#e5e7eb'}`,
                            borderRadius: 8, fontSize: 12
                          }}>
                            <span style={{ fontWeight: 600, color: '#111' }}>{item.item_name}</span>
                            <span style={{ color: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e', fontWeight: 700, fontSize: 11 }}>{stock}</span>
                            <button onClick={() => removeItemFromSec(sec.id, item.item_type, item.item_id)}
                              style={{ background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: 10, padding: 0 }}>
                              <FontAwesomeIcon icon={faTimes} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {sectionModal !== null && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
              onClick={() => setSectionModal(null)}>
              <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400 }}>
                <h3 style={{ margin: '0 0 18px', color: '#D4AF37', fontSize: 17, fontWeight: 700 }}>
                  {sectionModal === 'new' ? 'Nueva Sección' : 'Editar Sección'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Nombre *</label>
                    <input autoFocus value={sectionForm.name} onChange={e => setSectionForm({ ...sectionForm, name: e.target.value })} placeholder="ej: Bebidas, Limpieza..." style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Color</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={sectionForm.color} onChange={e => setSectionForm({ ...sectionForm, color: e.target.value })} style={{ width: 40, height: 36, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>{sectionForm.color}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button onClick={() => setSectionModal(null)} style={{ ...btnGhost, flex: 1, justifyContent: 'center' }}>Cancelar</button>
                  <button onClick={saveSection} disabled={!sectionForm.name.trim() || sectionSaving} style={{ ...btnGold, flex: 1, justifyContent: 'center', opacity: !sectionForm.name.trim() ? 0.5 : 1 }}>
                    <FontAwesomeIcon icon={faSave} /> {sectionSaving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {addItemModal !== null && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
              onClick={() => setAddItemModal(null)}>
              <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 440, maxHeight: '80vh', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 14px', color: '#D4AF37', fontSize: 17, fontWeight: 700 }}>Agregar Item a Sección</h3>
                <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                  {['product', 'ingredient', 'extra', 'raw_material'].map(t => (
                    <button key={t} onClick={() => setAddItemType(t)} style={{
                      flex: 1, padding: '7px 6px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                      background: addItemType === t ? '#D4AF37' : '#f3f4f6', color: addItemType === t ? '#000' : '#6b7280'
                    }}>
                      {t === 'product' ? 'Productos' : t === 'ingredient' ? 'Ingredientes' : t === 'extra' ? 'Extras' : 'Mat. Prima'}
                    </button>
                  ))}
                </div>
                <input value={addItemSearch} onChange={e => setAddItemSearch(e.target.value)} placeholder="Buscar..." style={{ ...inputStyle, marginBottom: 10 }} />
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {(() => {
                    const source = addItemType === 'product' ? directData.products
                      : addItemType === 'ingredient' ? directData.ingredients
                      : addItemType === 'extra' ? directData.extras : rawMats;
                    const filtered = source.filter(i => !addItemSearch || i.name.toLowerCase().includes(addItemSearch.toLowerCase()));
                    return filtered.length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Sin resultados</div>
                    ) : filtered.map(item => (
                      <div key={item.id} onClick={() => addItemToSec(addItemModal, addItemType, item.id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', borderRadius: 6 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</span>
                        <FontAwesomeIcon icon={faPlus} style={{ color: '#D4AF37', fontSize: 12 }} />
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──── TAB: COMPRAS / MOVIMIENTOS ──── */}
      {tab === 'movements' && (
        <div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Registrar Movimiento</h3>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[
                { key: 'purchase', label: 'Compra', color: '#3b82f6' },
                { key: 'entry', label: 'Entrada', color: '#22c55e' },
                { key: 'exit', label: 'Salida', color: '#ef4444' },
              ].map(r => (
                <button key={r.key} onClick={() => setMovReason(r.key)} style={{
                  flex: 1, padding: '9px 10px', borderRadius: 8, border: `1.5px solid ${movReason === r.key ? r.color : '#e5e7eb'}`,
                  cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  background: movReason === r.key ? r.color + '15' : '#fff', color: movReason === r.key ? r.color : '#6b7280'
                }}>
                  {r.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {['raw_material', 'product', 'ingredient', 'extra'].map(t => (
                <button key={t} onClick={() => setMovItemType(t)} style={{
                  padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  background: movItemType === t ? '#D4AF37' : '#f3f4f6', color: movItemType === t ? '#000' : '#6b7280'
                }}>
                  {t === 'raw_material' ? 'Mat. Prima' : t === 'product' ? 'Productos' : t === 'ingredient' ? 'Ingredientes' : 'Extras'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <input value={movItemSearch} onChange={e => setMovItemSearch(e.target.value)} placeholder="Buscar item..." style={{ ...inputStyle, flex: 1 }} />
            </div>
            {movItemSearch && (() => {
              const source = movItemType === 'product' ? directData.products : movItemType === 'ingredient' ? directData.ingredients : movItemType === 'extra' ? directData.extras : rawMats;
              const filtered = source.filter(i => i.name.toLowerCase().includes(movItemSearch.toLowerCase())).slice(0, 8);
              return filtered.length > 0 ? (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 10, maxHeight: 200, overflowY: 'auto' }}>
                  {filtered.map(item => (
                    <div key={item.id} onClick={() => {
                      if (!movItems.find(m => m.item_id === item.id && m.item_type === movItemType)) {
                        setMovItems([...movItems, { item_type: movItemType, item_id: item.id, item_name: item.name, quantity: 1 }]);
                      }
                      setMovItemSearch('');
                    }}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                      {item.name}
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
            {movItems.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>Items seleccionados:</div>
                {movItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{item.item_name}</span>
                    <input type="number" min="0.001" step="0.001" value={item.quantity}
                      onChange={e => setMovItems(movItems.map((m, i) => i === idx ? { ...m, quantity: parseFloat(e.target.value) || 0 } : m))}
                      style={{ ...inputStyle, width: 80, padding: '5px 8px', textAlign: 'center' }} />
                    <button onClick={() => setMovItems(movItems.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={submitMovement} disabled={movItems.length === 0 || movSaving}
              style={{ ...btnGold, width: '100%', justifyContent: 'center', opacity: movItems.length === 0 ? 0.5 : 1 }}>
              <FontAwesomeIcon icon={faCheck} /> {movSaving ? 'Registrando...' : `Registrar ${movReason === 'purchase' ? 'Compra' : movReason === 'entry' ? 'Entrada' : 'Salida'}`}
            </button>
          </div>
        </div>
      )}

      {/* ──── TAB: TRANSFERENCIAS ──── */}
      {tab === 'transfers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Transferencias entre Locales</h3>
            <button onClick={() => { setTransferModal(true); setTransferItems([]); setTransferTo(''); setTransferNotes(''); }} style={btnGold}
              disabled={userStores.filter(s => s.id !== selectedStore?.id).length === 0}>
              <FontAwesomeIcon icon={faPaperPlane} /> Nueva Transferencia
            </button>
          </div>

          {userStores.filter(s => s.id !== selectedStore?.id).length === 0 && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#f59e0b' }}>
              Necesitas más de una tienda en tu cuenta para usar transferencias.
            </div>
          )}

          {transfersLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Cargando transferencias...</div>
          ) : transfers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              <FontAwesomeIcon icon={faTruck} style={{ fontSize: 28, marginBottom: 10, display: 'block' }} />
              No hay transferencias registradas
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {transfers.map(t => {
                const isSender = t.from_store_id === selectedStore?.id;
                const statusColors = { pending: '#f59e0b', accepted: '#22c55e', rejected: '#ef4444', cancelled: '#9ca3af' };
                const statusLabels = { pending: 'Pendiente', accepted: 'Aceptada', rejected: 'Rechazada', cancelled: 'Cancelada' };
                return (
                  <div key={t.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FontAwesomeIcon icon={isSender ? faPaperPlane : faTruck} style={{ color: isSender ? '#3b82f6' : '#22c55e', fontSize: 13 }} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {isSender ? `Enviada a ${t.to_store_name}` : `Recibida de ${t.from_store_name}`}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: statusColors[t.status] + '15', color: statusColors[t.status] }}>
                        {statusLabels[t.status]}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
                      {new Date(t.created_at).toLocaleString('es-CL')}
                      {t.notes && <span> — {t.notes}</span>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: t.status === 'pending' ? 10 : 0 }}>
                      {t.items.map((item, i) => (
                        <span key={i} style={{ fontSize: 11, padding: '3px 8px', background: '#f3f4f6', borderRadius: 6, fontWeight: 500 }}>
                          {item.item_name} × {parseFloat(item.quantity)}
                        </span>
                      ))}
                    </div>
                    {t.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        {!isSender && (
                          <>
                            <button onClick={() => handleTransferAction(t.id, 'accept')}
                              style={{ background: '#22c55e', border: 'none', borderRadius: 6, padding: '6px 14px', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                              <FontAwesomeIcon icon={faCheck} /> Aceptar
                            </button>
                            <button onClick={() => handleTransferAction(t.id, 'reject')}
                              style={{ background: '#ef4444', border: 'none', borderRadius: 6, padding: '6px 14px', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                              <FontAwesomeIcon icon={faTimes} /> Rechazar
                            </button>
                          </>
                        )}
                        {isSender && (
                          <button onClick={() => handleTransferAction(t.id, 'cancel')}
                            style={{ ...btnGhost, padding: '6px 14px', fontSize: 12, color: '#ef4444', borderColor: '#fecaca' }}>
                            Cancelar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {transferModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
              onClick={() => setTransferModal(false)}>
              <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 500, maxHeight: '85vh', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 18px', color: '#D4AF37', fontSize: 17, fontWeight: 700 }}>
                  <FontAwesomeIcon icon={faTruck} style={{ marginRight: 8 }} /> Nueva Transferencia
                </h3>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Tienda destino *</label>
                  <select value={transferTo} onChange={e => setTransferTo(e.target.value)} style={inputStyle}>
                    <option value="">Seleccionar tienda...</option>
                    {userStores.filter(s => s.id !== selectedStore?.id).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Agregar items</label>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                    {['raw_material', 'product', 'ingredient', 'extra'].map(t => (
                      <button key={t} onClick={() => setTransferItemType(t)} style={{
                        flex: 1, padding: '5px 6px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        background: transferItemType === t ? '#D4AF37' : '#f3f4f6', color: transferItemType === t ? '#000' : '#6b7280'
                      }}>
                        {t === 'raw_material' ? 'Mat. Prima' : t === 'product' ? 'Productos' : t === 'ingredient' ? 'Ingredientes' : 'Extras'}
                      </button>
                    ))}
                  </div>
                  <input value={transferItemSearch} onChange={e => setTransferItemSearch(e.target.value)} placeholder="Buscar item..." style={{ ...inputStyle, marginBottom: 6 }} />
                  {transferItemSearch && (() => {
                    const source = transferItemType === 'product' ? directData.products : transferItemType === 'ingredient' ? directData.ingredients : transferItemType === 'extra' ? directData.extras : rawMats;
                    const filtered = source.filter(i => i.name.toLowerCase().includes(transferItemSearch.toLowerCase())).slice(0, 6);
                    return filtered.length > 0 ? (
                      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, maxHeight: 180, overflowY: 'auto' }}>
                        {filtered.map(item => (
                          <div key={item.id} onClick={() => {
                            if (!transferItems.find(m => m.item_id === item.id && m.item_type === transferItemType)) {
                              setTransferItems([...transferItems, { item_type: transferItemType, item_id: item.id, item_name: item.name, quantity: 1 }]);
                            }
                            setTransferItemSearch('');
                          }}
                            style={{ padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = ''}>
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
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{item.item_name}</span>
                        <input type="number" min="0.001" step="0.001" value={item.quantity}
                          onChange={e => setTransferItems(transferItems.map((m, i) => i === idx ? { ...m, quantity: parseFloat(e.target.value) || 0 } : m))}
                          style={{ ...inputStyle, width: 80, padding: '5px 8px', textAlign: 'center' }} />
                        <button onClick={() => setTransferItems(transferItems.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                          <FontAwesomeIcon icon={faTimes} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Notas (opcional)</label>
                  <input value={transferNotes} onChange={e => setTransferNotes(e.target.value)} placeholder="ej: Pedido urgente para evento..." style={inputStyle} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setTransferModal(false)} style={{ ...btnGhost, flex: 1, justifyContent: 'center' }}>Cancelar</button>
                  <button onClick={submitTransfer} disabled={!transferTo || transferItems.length === 0 || transferSaving}
                    style={{ ...btnGold, flex: 1, justifyContent: 'center', opacity: (!transferTo || transferItems.length === 0) ? 0.5 : 1 }}>
                    <FontAwesomeIcon icon={faPaperPlane} /> {transferSaving ? 'Enviando...' : 'Enviar Transferencia'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
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
