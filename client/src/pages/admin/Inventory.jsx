import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBoxOpen, faSearch, faSync, faInfinity, faExclamationTriangle,
  faWarehouse
} from '@fortawesome/free-solid-svg-icons';
import { useStore } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

const API = 'https://srservi2.srautomatic.com';

const TABS = [
  { key: 'products',     label: 'Productos',    type: 'product' },
  { key: 'ingredients',  label: 'Complementos', type: 'ingredient' },
  { key: 'extras',       label: 'Extras',       type: 'extra' },
];

const FILTERS = [
  { key: 'all',       label: 'Todos' },
  { key: 'out',       label: 'Sin stock' },
  { key: 'low',       label: 'Stock bajo' },
  { key: 'unlimited', label: 'Ilimitado' },
];

function badge(item) {
  if (item.unlimited_stock) return { label: 'Ilimitado', color: '#D4AF37', bg: 'rgba(212,175,55,0.12)', border: 'rgba(212,175,55,0.3)' };
  if (item.stock === 0)     return { label: 'Sin stock', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)' };
  if (item.stock <= 5)      return { label: 'Bajo',      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' };
  return                           { label: 'OK',        color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)' };
}

export default function Inventory() {
  const { selectedStore } = useStore();
  const { token } = useAuth();

  const [tab, setTab]         = useState('products');
  const [data, setData]       = useState({ products: [], ingredients: [], extras: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving]   = useState(false);

  const fetchInventory = useCallback(async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/inventory/store/${selectedStore.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [selectedStore, token]);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const currentTab = TABS.find(t => t.key === tab);

  const items = (() => {
    const list = tab === 'products' ? data.products
      : tab === 'ingredients' ? data.ingredients
      : data.extras;
    return list.filter(item => {
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === 'out')       return !item.unlimited_stock && item.stock === 0;
      if (filter === 'low')       return !item.unlimited_stock && item.stock > 0 && item.stock <= 5;
      if (filter === 'unlimited') return !!item.unlimited_stock;
      return true;
    });
  })();

  const alertCount = (list) => list.filter(x => !x.unlimited_stock && x.stock === 0).length;

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditValue(String(item.stock));
  };

  const cancelEdit = () => { setEditingId(null); setEditValue(''); };

  const saveStock = async (item, newUnlimited = null) => {
    if (!selectedStore) return;
    setSaving(true);
    try {
      const type = currentTab.type;
      const isUnlimitedToggle = newUnlimited !== null;

      if (type === 'product') {
        if (isUnlimitedToggle) {
          await fetch(`${API}/api/inventory/${item.id}/unlimited`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ unlimited_stock: newUnlimited, store_id: selectedStore.id })
          });
        } else {
          await fetch(`${API}/api/inventory/${item.id}/stock`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ stock: parseInt(editValue) || 0, store_id: selectedStore.id })
          });
        }
      } else {
        const endpoint = type === 'ingredient' ? 'ingredient' : 'extra';
        const stockVal     = isUnlimitedToggle ? item.stock : parseInt(editValue) || 0;
        const unlimitedVal = isUnlimitedToggle ? newUnlimited : item.unlimited_stock;
        await fetch(`${API}/api/inventory/${endpoint}/${item.id}/stock`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ stock: stockVal, unlimited_stock: unlimitedVal, store_id: selectedStore.id })
        });
      }

      await fetchInventory();
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const totalAlerts = alertCount(data.products) + alertCount(data.ingredients) + alertCount(data.extras);
  const totalLow    = data.products.filter(p => !p.unlimited_stock && p.stock > 0 && p.stock <= 5).length
                    + data.ingredients.filter(i => !i.unlimited_stock && i.stock > 0 && i.stock <= 5).length
                    + data.extras.filter(e => !e.unlimited_stock && e.stock > 0 && e.stock <= 5).length;

  return (
    <div style={{ background: '#0a0a0a', color: '#fff', padding: '24px', fontFamily: 'sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesomeIcon icon={faWarehouse} style={{ color: '#D4AF37', fontSize: 16 }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Inventario</h1>
            {selectedStore && <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>{selectedStore.name}</p>}
          </div>
        </div>
        <button onClick={fetchInventory} disabled={loading} style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)', color: '#D4AF37', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: '13px', fontWeight: 600 }}>
          <FontAwesomeIcon icon={faSync} spin={loading} />
          Actualizar
        </button>
      </div>

      {/* Global alert banner */}
      {totalAlerts > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#ef4444' }} />
          <span style={{ color: '#fca5a5' }}>
            <strong>{totalAlerts}</strong> ítem(s) sin stock
            {totalLow > 0 && <> · <strong>{totalLow}</strong> con stock bajo (≤5)</>}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#141414', borderRadius: 10, padding: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
        {TABS.map(t => {
          const list = t.key === 'products' ? data.products : t.key === 'ingredients' ? data.ingredients : data.extras;
          const alerts = alertCount(list);
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); setFilter('all'); setEditingId(null); }} style={{
              flex: 1, padding: '8px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              background: active ? '#D4AF37' : 'transparent',
              color: active ? '#000' : 'rgba(255,255,255,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}>
              {t.label}
              <span style={{ fontSize: 11, background: active ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 10 }}>{list.length}</span>
              {alerts > 0 && <span style={{ fontSize: 10, background: '#ef4444', color: '#fff', padding: '1px 5px', borderRadius: 10 }}>{alerts}</span>}
            </button>
          );
        })}
      </div>

      {/* Search + Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
          <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.28)', fontSize: 12 }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            style={{ width: '100%', padding: '9px 12px 9px 32px', background: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: '8px 13px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
              background: filter === f.key ? 'rgba(212,175,55,0.12)' : 'transparent',
              border: `1px solid ${filter === f.key ? '#D4AF37' : 'rgba(255,255,255,0.1)'}`,
              color: filter === f.key ? '#D4AF37' : 'rgba(255,255,255,0.45)',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>Cargando inventario...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
          <FontAwesomeIcon icon={faBoxOpen} style={{ fontSize: 32, marginBottom: 12, display: 'block' }} />
          Sin resultados
        </div>
      ) : (
        <div style={{ background: '#141414', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: tab === 'products' ? '1fr 150px 110px 70px 130px' : '1fr 150px 110px 130px',
            padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)',
            fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.06em'
          }}>
            <span>Nombre</span>
            <span>Categoría</span>
            <span style={{ textAlign: 'center' }}>Stock</span>
            {tab === 'products' && <span style={{ textAlign: 'center' }}>Mín.</span>}
            <span style={{ textAlign: 'center' }}>Estado</span>
          </div>

          {items.map((item, idx) => {
            const b = badge(item);
            const isEditing = editingId === item.id;
            const rowBg = item.unlimited_stock ? 'transparent'
              : item.stock === 0 ? 'rgba(239,68,68,0.04)'
              : item.stock <= 5  ? 'rgba(245,158,11,0.04)'
              : 'transparent';

            return (
              <div key={item.id} style={{
                display: 'grid',
                gridTemplateColumns: tab === 'products' ? '1fr 150px 110px 70px 130px' : '1fr 150px 110px 130px',
                padding: '11px 16px', borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                alignItems: 'center', background: rowBg, transition: 'background 0.1s'
              }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>{item.category_name || '—'}</span>

                {/* Stock — inline edit */}
                <div style={{ textAlign: 'center' }}>
                  {item.unlimited_stock ? (
                    <span style={{ color: '#D4AF37', fontSize: 14 }}><FontAwesomeIcon icon={faInfinity} /></span>
                  ) : isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <input
                        type="number" min="0" value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveStock(item); if (e.key === 'Escape') cancelEdit(); }}
                        autoFocus
                        style={{ width: 56, padding: '4px 6px', background: '#0a0a0a', border: '1px solid #D4AF37', borderRadius: 6, color: '#fff', fontSize: 13, textAlign: 'center', outline: 'none' }}
                      />
                      <button onClick={() => saveStock(item)} disabled={saving} style={{ background: '#D4AF37', border: 'none', borderRadius: 5, padding: '4px 7px', cursor: 'pointer', color: '#000', fontSize: 12, fontWeight: 700 }}>✓</button>
                      <button onClick={cancelEdit} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 5, padding: '4px 7px', cursor: 'pointer', color: '#fff', fontSize: 12 }}>✕</button>
                    </div>
                  ) : (
                    <span
                      onClick={() => startEdit(item)}
                      title="Click para editar"
                      style={{ cursor: 'pointer', fontSize: 14, fontWeight: 700, color: b.color, borderBottom: '1px dashed rgba(255,255,255,0.18)', paddingBottom: 1 }}
                    >
                      {item.stock}
                    </span>
                  )}
                </div>

                {/* Min stock (products only) */}
                {tab === 'products' && (
                  <span style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{item.min_stock ?? 0}</span>
                )}

                {/* Status badge + unlimited toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, background: b.bg, color: b.color, border: `1px solid ${b.border}`, padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                    {b.label}
                  </span>
                  <button
                    onClick={() => saveStock(item, !item.unlimited_stock)}
                    title={item.unlimited_stock ? 'Quitar ilimitado' : 'Marcar ilimitado'}
                    disabled={saving}
                    style={{
                      background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                      padding: '3px 7px', cursor: 'pointer', fontSize: 12, transition: 'all 0.15s',
                      color: item.unlimited_stock ? '#D4AF37' : 'rgba(255,255,255,0.25)',
                    }}
                  >
                    <FontAwesomeIcon icon={faInfinity} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
