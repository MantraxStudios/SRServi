import { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChair, faPlus, faMinus, faTrash, faArrowLeft,
  faSearch, faUsers, faCheck, faUtensils, faSpinner,
  faRefresh, faCheckCircle
} from '@fortawesome/free-solid-svg-icons';
import { getImageUrl } from '../config.js';

const API = 'https://srservi2.srautomatic.com';
const CANVAS_W = 900;
const CANVAS_H = 540;

// ── Table shape (read-only, same visual as admin) ──────────────────────────────
function WorkerTableShape({ table, onClick }) {
  const isCircle = table.shape === 'circle';
  const occupied  = !!table.occupied;
  const w = table.w || 80;
  const h = isCircle ? w : (table.h || 60);

  const borderColor = occupied ? '#f87171' : '#4ade80';
  const bgColor     = occupied ? 'rgba(248,113,113,0.12)' : 'rgba(74,222,128,0.08)';
  const glowColor   = occupied ? 'rgba(248,113,113,0.30)' : 'rgba(74,222,128,0.20)';
  const labelSize   = Math.min(14, Math.max(9, w / 9));

  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        left: table.x ?? 0,
        top: table.y ?? 0,
        width: w,
        height: h,
        cursor: 'pointer',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        borderRadius: isCircle ? '50%' : '12px',
        border: `2px solid ${borderColor}`,
        background: bgColor,
        boxShadow: `0 0 12px ${glowColor}, 0 3px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)`,
        transition: 'transform 0.1s, box-shadow 0.15s',
        zIndex: 1,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.07)'; e.currentTarget.style.zIndex = 5; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';    e.currentTarget.style.zIndex = 1; }}
    >
      {/* Status glow dot */}
      <div style={{
        position: 'absolute', top: 7, right: 8,
        width: 7, height: 7, borderRadius: '50%',
        background: occupied ? '#f87171' : '#4ade80',
        boxShadow: `0 0 8px ${occupied ? '#f87171' : '#4ade80'}, 0 0 3px ${occupied ? '#f87171' : '#4ade80'}`,
      }} />

      <span style={{
        fontSize: labelSize, fontWeight: 800, color: '#fff',
        lineHeight: 1.2, textAlign: 'center', padding: '0 6px',
        letterSpacing: 0.3, textShadow: '0 1px 4px rgba(0,0,0,0.6)',
      }}>
        {table.label}
      </span>
      <span style={{
        fontSize: Math.max(9, labelSize - 2),
        color: occupied ? '#fca5a5' : 'rgba(255,255,255,0.5)',
        marginTop: 3, fontWeight: 600,
      }}>
        {occupied ? 'OCUPADA' : `${table.capacity}p`}
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function WorkerTableMap({ worker, storeId, storeCode, onOrderCreated }) {
  // ── Tables ──
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(true);

  // ── Canvas scale ──
  const canvasWrapRef = useRef(null);
  const [canvasScale, setCanvasScale] = useState(1);

  // ── Selected table + its active order ──
  const [selectedTable, setSelectedTable] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  // ── Persons at table ──
  const [persons, setPersons] = useState('');

  // ── Product data ──
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [hideDecimals, setHideDecimals] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  // ── Cart ──
  const [cart, setCart] = useState([]);

  // ── Product picker ──
  const [showPicker, setShowPicker] = useState(false);
  const [pickerCategory, setPickerCategory] = useState('all');
  const [pickerSearch, setPickerSearch] = useState('');

  // ── Ingredient/extra config modal ──
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [configStep, setConfigStep] = useState('ingredients');
  const [selIngredients, setSelIngredients] = useState([]);
  const [selExtras, setSelExtras] = useState([]);
  const [qty, setQty] = useState(1);

  // ── Actions ──
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const fmt = (n) => hideDecimals ? Math.round(n) : Number(n).toFixed(2);

  // ── Fetch tables ──
  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch(API + `/api/public/restaurant-tables/${storeCode}`);
      if (res.ok) setTables(await res.json());
    } catch {}
    setLoadingTables(false);
  }, [storeCode]);

  useEffect(() => {
    fetchTables();
    const iv = setInterval(fetchTables, 15000);
    return () => clearInterval(iv);
  }, [fetchTables]);

  // ── Scale canvas to fit container ──
  useEffect(() => {
    if (!canvasWrapRef.current) return;
    const calc = () => {
      const w = canvasWrapRef.current?.offsetWidth ?? CANVAS_W;
      setCanvasScale(Math.min(1, (w - 24) / CANVAS_W));
    };
    calc();
    const obs = new ResizeObserver(calc);
    obs.observe(canvasWrapRef.current);
    return () => obs.disconnect();
  }, [tables]); // recalc when tables load so ref is mounted

  // ── Auto-layout tables that have no saved coordinates ──
  const positionedTables = tables.map((t, i) => {
    if (t.x != null && t.y != null) return t;
    const cols = Math.ceil(Math.sqrt(tables.length));
    const col  = i % cols;
    const row  = Math.floor(i / cols);
    return { ...t, x: 40 + col * 130, y: 40 + row * 110, w: 80, h: 60, shape: 'rect' };
  });

  // ── Load product data (once) ──
  const loadData = async () => {
    if (dataLoaded) return;
    try {
      const [storeRes, cfgRes] = await Promise.all([
        fetch(API + `/api/public/${storeCode}`),
        fetch(API + `/api/public/store-configurations/${storeId}`)
      ]);
      if (storeRes.ok) {
        const d = await storeRes.json();
        setProducts((d.products || []).filter((p, i, s) => i === s.findIndex(x => x.id === p.id)));
        setCategories(d.categories || []);
        if (d.store?.currency_symbol) setCurrencySymbol(d.store.currency_symbol);
      }
      if (cfgRes.ok) {
        const cfgArr = await cfgRes.json();
        const cfg = Array.isArray(cfgArr) ? (cfgArr.find(c => c.is_default) || cfgArr[0]) : null;
        if (cfg) setHideDecimals(!!cfg.hide_decimals);
      }
      setDataLoaded(true);
    } catch {}
  };

  // ── Select a table ──
  const handleSelectTable = async (table) => {
    setSelectedTable(table);
    setActiveOrder(null);
    setCart([]);
    setPersons('');
    setSaveError('');
    setSavedMsg('');
    setShowPicker(false);
    await loadData();

    if (table.occupied) {
      setLoadingOrder(true);
      try {
        const res = await fetch(API + `/api/public/table-order/${storeCode}/${table.id}`);
        if (res.ok) {
          const order = await res.json();
          setActiveOrder(order);
          if (order?.persons) setPersons(String(order.persons));
        }
      } catch {}
      setLoadingOrder(false);
    }
  };

  // ── Product config ──
  const openProduct = (product) => {
    setSelectedProduct(product);
    setSelIngredients([]);
    setSelExtras([]);
    setQty(1);
    const hasIngredients = (product.ingredients || []).length > 0;
    setConfigStep(hasIngredients ? 'ingredients' : 'extras');
  };

  const toggleIngredient = (ing) => {
    setSelIngredients(prev =>
      prev.find(i => i.name === ing.name)
        ? prev.filter(i => i.name !== ing.name)
        : [...prev, { name: ing.name, price: ing.price }]
    );
  };

  const toggleExtra = (ex) => {
    setSelExtras(prev =>
      prev.find(e => e.name === ex.name)
        ? prev.filter(e => e.name !== ex.name)
        : [...prev, { name: ex.name, price: ex.price }]
    );
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    const ingTotal = selIngredients.reduce((s, i) => s + parseFloat(i.price || 0), 0);
    const exTotal  = selExtras.reduce((s, e) => s + parseFloat(e.price || 0), 0);
    const unitPrice = parseFloat(selectedProduct.price) + ingTotal + exTotal;
    setCart(prev => [...prev, {
      id: Date.now(),
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      unit_price: unitPrice,
      quantity: qty,
      selected_ingredients: selIngredients.map(i => i.name),
      selected_extras:      selExtras.map(e => e.name)
    }]);
    setSelectedProduct(null);
  };

  const removeCartItem = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const cartTotal  = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const orderTotal = activeOrder ? parseFloat(activeOrder.total || 0) : 0;

  // ── Create new order for table ──
  const handleCreateOrder = async () => {
    if (cart.length === 0) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(API + '/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          order_type: 'serve',
          payment_method: 'cash',
          items: cart.map(i => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            selected_ingredients: i.selected_ingredients,
            selected_extras: i.selected_extras
          })),
          table_number: selectedTable.id,
          persons: persons ? parseInt(persons) : null,
          from_worker: true,
          total: cartTotal.toFixed(2)
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al crear pedido');
      const order = await res.json();
      setActiveOrder({ ...order, items: cart.map(i => ({ ...i, product_name: i.product_name })) });
      setCart([]);
      setSavedMsg('¡Mesa abierta! Pedido creado.');
      setSelectedTable(prev => prev ? { ...prev, occupied: true } : prev);
      setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, occupied: true } : t));
      onOrderCreated?.();
    } catch (err) {
      setSaveError(err.message);
    }
    setSaving(false);
  };

  // ── Add items to existing order ──
  const handleAddItems = async () => {
    if (cart.length === 0 || !activeOrder) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(API + `/api/orders/${activeOrder.id}/add-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          items: cart.map(i => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            selected_ingredients: i.selected_ingredients,
            selected_extras: i.selected_extras
          }))
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al agregar items');
      const updated = await res.json();
      setActiveOrder(prev => ({
        ...updated,
        items: [...(prev?.items || []), ...cart.map(i => ({ ...i, product_name: i.product_name }))]
      }));
      setCart([]);
      setSavedMsg('Productos agregados al pedido.');
      onOrderCreated?.();
    } catch (err) {
      setSaveError(err.message);
    }
    setSaving(false);
  };

  // ── Complete table ──
  const handleCompleteTable = async () => {
    if (!activeOrder) return;
    const token = localStorage.getItem('workerToken');
    setSaving(true);
    try {
      await fetch(API + `/api/orders/${activeOrder.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ status: 'completed', worker_name: worker?.name || '' })
      });
      setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, occupied: false } : t));
      setSelectedTable(null);
      setActiveOrder(null);
      onOrderCreated?.();
    } catch {}
    setSaving(false);
  };

  // ── Filtered products for picker ──
  const filteredProducts = products.filter(p => {
    const matchCat    = pickerCategory === 'all' || p.category_id === pickerCategory;
    const matchSearch = !pickerSearch || p.name.toLowerCase().includes(pickerSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  // ── Stats ──
  const freeCount     = tables.filter(t => !t.occupied).length;
  const occupiedCount = tables.filter(t =>  t.occupied).length;

  // ─────────────────────────────────────────────
  // RENDER: no table selected → canvas floor plan
  // ─────────────────────────────────────────────
  if (!selectedTable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #1a1a1a',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#0d0d0d', flexShrink: 0
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: 0.3 }}>
            Mapa de Mesas
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#4ade80' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 5px #4ade80' }} />
              <span>{freeCount} libre{freeCount !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#f87171' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', display: 'inline-block', boxShadow: '0 0 5px #f87171' }} />
              <span>{occupiedCount} ocupada{occupiedCount !== 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={() => { setLoadingTables(true); fetchTables(); }}
              style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: 4, lineHeight: 1 }}
            >
              <FontAwesomeIcon icon={faRefresh} />
            </button>
          </div>
        </div>

        {/* ── Canvas area ── */}
        <div ref={canvasWrapRef} style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          {loadingTables ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>
              <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 28 }} />
            </div>
          ) : tables.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>
              <FontAwesomeIcon icon={faChair} style={{ fontSize: 36, marginBottom: 14, display: 'block' }} />
              <div style={{ fontSize: 14, color: '#666' }}>No hay mesas configuradas</div>
              <div style={{ fontSize: 12, color: '#444', marginTop: 4 }}>
                Configúralas desde el panel de administración
              </div>
            </div>
          ) : (
            /* Scaled canvas wrapper */
            <div style={{
              position: 'relative',
              width: CANVAS_W * canvasScale,
              height: CANVAS_H * canvasScale,
              margin: '0 auto',
            }}>
              {/* Inner canvas at native size, scaled down */}
              <div style={{
                position: 'absolute',
                top: 0, left: 0,
                width: CANVAS_W,
                height: CANVAS_H,
                transformOrigin: 'top left',
                transform: `scale(${canvasScale})`,
                background: '#0c0c14',
                backgroundImage: 'radial-gradient(circle, #2a2a4a 1px, transparent 1px)',
                backgroundSize: '32px 32px',
                borderRadius: 14,
                border: '1px solid #1a1a2e',
                boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
                overflow: 'hidden',
              }}>
                {positionedTables.map(table => (
                  <WorkerTableShape
                    key={table.id}
                    table={table}
                    onClick={() => handleSelectTable(table)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Stats bar ── */}
        {!loadingTables && tables.length > 0 && (
          <div style={{
            padding: '8px 16px',
            borderTop: '1px solid #1a1a1a',
            background: '#0d0d0d',
            display: 'flex', gap: 20, flexShrink: 0,
            fontSize: 12, color: '#666'
          }}>
            <span>Total: <strong style={{ color: '#aaa' }}>{tables.length}</strong></span>
            <span style={{ color: '#4ade80' }}>Libres: <strong>{freeCount}</strong></span>
            <span style={{ color: '#f87171' }}>Ocupadas: <strong>{occupiedCount}</strong></span>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER: Product picker overlay
  // ─────────────────────────────────────────────
  if (showPicker && !selectedProduct) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: 10, background: '#0d0d0d', flexShrink: 0 }}>
          <button onClick={() => setShowPicker(false)} style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer', fontSize: 18 }}>
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <div style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>Agregar productos — {selectedTable.label}</div>
        </div>

        {/* Search + category filters */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <FontAwesomeIcon icon={faSearch} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: 13 }} />
            <input
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              placeholder="Buscar producto..."
              style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '8px 12px 8px 32px', color: '#fff', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            <button
              onClick={() => setPickerCategory('all')}
              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', background: pickerCategory === 'all' ? '#D4AF37' : '#1e1e1e', color: pickerCategory === 'all' ? '#000' : '#aaa' }}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setPickerCategory(cat.id)}
                style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', background: pickerCategory === cat.id ? '#D4AF37' : '#1e1e1e', color: pickerCategory === cat.id ? '#000' : '#aaa' }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {filteredProducts.map(product => {
              const outOfStock = !product.unlimited_stock && product.stock === 0;
              return (
                <button
                  key={product.id}
                  onClick={() => !outOfStock && openProduct(product)}
                  disabled={outOfStock}
                  style={{
                    background: '#111', border: '1px solid #222', borderRadius: 12,
                    padding: 0, cursor: outOfStock ? 'not-allowed' : 'pointer',
                    textAlign: 'left', opacity: outOfStock ? 0.5 : 1, overflow: 'hidden'
                  }}
                >
                  {product.image && (
                    <img
                      src={getImageUrl(product.image)}
                      alt={product.name}
                      style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }}
                    />
                  )}
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 3 }}>{product.name}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#D4AF37' }}>{currencySymbol}{fmt(product.price)}</div>
                    {outOfStock && <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, marginTop: 2 }}>AGOTADO</div>}
                  </div>
                </button>
              );
            })}
            {filteredProducts.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 30, color: '#666' }}>Sin productos</div>
            )}
          </div>
        </div>

        {/* Cart summary at bottom */}
        {cart.length > 0 && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid #222', background: '#0d0d0d', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: '#aaa' }}>{cart.reduce((s, i) => s + i.quantity, 0)} items en carrito</div>
              <button
                onClick={() => setShowPicker(false)}
                style={{ background: '#D4AF37', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#000', cursor: 'pointer' }}
              >
                Ver carrito ({currencySymbol}{fmt(cartTotal)})
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER: Ingredient/extra config modal
  // ─────────────────────────────────────────────
  if (selectedProduct) {
    const hasIngredients  = (selectedProduct.ingredients || []).length > 0;
    const hasExtras       = (selectedProduct.extras || []).length > 0;
    const ingPrice        = selIngredients.reduce((s, i) => s + parseFloat(i.price || 0), 0);
    const exPrice         = selExtras.reduce((s, e) => s + parseFloat(e.price || 0), 0);
    const totalUnitPrice  = parseFloat(selectedProduct.price) + ingPrice + exPrice;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: 10, background: '#0d0d0d', flexShrink: 0 }}>
          <button onClick={() => setSelectedProduct(null)} style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer', fontSize: 18 }}>
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <div>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>{selectedProduct.name}</div>
            <div style={{ fontSize: 12, color: '#D4AF37' }}>{currencySymbol}{fmt(totalUnitPrice)} c/u</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {hasIngredients && hasExtras && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['ingredients', 'extras'].map(step => (
                <button
                  key={step}
                  onClick={() => setConfigStep(step)}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: configStep === step ? '#D4AF37' : '#1e1e1e', color: configStep === step ? '#000' : '#888' }}
                >
                  {step === 'ingredients' ? 'Complementos' : 'Extras'}
                </button>
              ))}
            </div>
          )}

          {(configStep === 'ingredients' || !hasIngredients) && hasIngredients && (
            <div>
              <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Complementos</div>
              {(selectedProduct.ingredients || []).map(ing => {
                const selected   = selIngredients.find(i => i.name === ing.name);
                const outOfStock = !ing.unlimited_stock && ing.stock === 0;
                return (
                  <button
                    key={ing.id}
                    onClick={() => !outOfStock && toggleIngredient(ing)}
                    disabled={outOfStock}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      background: selected ? 'rgba(212,175,55,0.1)' : '#111',
                      border: `1px solid ${selected ? '#D4AF37' : '#222'}`,
                      borderRadius: 10, padding: '10px 12px', marginBottom: 8,
                      cursor: outOfStock ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: outOfStock ? 0.5 : 1
                    }}
                  >
                    {ing.image && <img src={getImageUrl(ing.image)} alt={ing.name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{ing.name}</div>
                      {parseFloat(ing.price) > 0 && <div style={{ fontSize: 12, color: '#D4AF37' }}>+{currencySymbol}{fmt(ing.price)}</div>}
                      {outOfStock && <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>Agotado</div>}
                    </div>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selected ? '#D4AF37' : '#444'}`, background: selected ? '#D4AF37' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {selected && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10, color: '#000' }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {(configStep === 'extras' || !hasIngredients) && hasExtras && (
            <div>
              <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Extras</div>
              {(selectedProduct.extras || []).map(ex => {
                const selected   = selExtras.find(e => e.name === ex.name);
                const outOfStock = !ex.unlimited_stock && ex.stock === 0;
                return (
                  <button
                    key={ex.id}
                    onClick={() => !outOfStock && toggleExtra(ex)}
                    disabled={outOfStock}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      background: selected ? 'rgba(212,175,55,0.1)' : '#111',
                      border: `1px solid ${selected ? '#D4AF37' : '#222'}`,
                      borderRadius: 10, padding: '10px 12px', marginBottom: 8,
                      cursor: outOfStock ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: outOfStock ? 0.5 : 1
                    }}
                  >
                    {ex.image && <img src={getImageUrl(ex.image)} alt={ex.name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{ex.name}</div>
                      {parseFloat(ex.price) > 0 && <div style={{ fontSize: 12, color: '#D4AF37' }}>+{currencySymbol}{fmt(ex.price)}</div>}
                      {outOfStock && <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>Agotado</div>}
                    </div>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selected ? '#D4AF37' : '#444'}`, background: selected ? '#D4AF37' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {selected && <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10, color: '#000' }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!hasIngredients && !hasExtras && (
            <div style={{ textAlign: 'center', padding: 30, color: '#666' }}>Sin complementos ni extras</div>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #222', background: '#0d0d0d', flexShrink: 0 }}>
          {hasIngredients && hasExtras && configStep === 'ingredients' && (
            <button
              onClick={() => setConfigStep('extras')}
              style={{ width: '100%', padding: '10px', background: '#1e1e1e', border: '1px solid #D4AF37', borderRadius: 10, color: '#D4AF37', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 10 }}
            >
              Siguiente: Extras →
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#1a1a1a', borderRadius: 10, padding: '6px 10px' }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>
                <FontAwesomeIcon icon={faMinus} />
              </button>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', minWidth: 24, textAlign: 'center' }}>{qty}</span>
              <button onClick={() => setQty(q => q + 1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </div>
            <button
              onClick={addToCart}
              style={{ flex: 1, padding: '10px', background: '#D4AF37', border: 'none', borderRadius: 10, color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              Agregar — {currencySymbol}{fmt(totalUnitPrice * qty)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER: Table order panel
  // ─────────────────────────────────────────────
  const occupied = selectedTable.occupied || !!activeOrder;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: 10, background: '#0d0d0d', flexShrink: 0 }}>
        <button onClick={() => { setSelectedTable(null); setActiveOrder(null); setCart([]); }} style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer', fontSize: 18 }}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: '#fff', fontSize: 16 }}>
            {selectedTable.label}
            <span style={{ fontSize: 11, color: occupied ? '#ef4444' : '#22c55e', background: occupied ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', borderRadius: 20, padding: '2px 8px', marginLeft: 8 }}>
              {occupied ? 'Ocupada' : 'Libre'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>
            <FontAwesomeIcon icon={faUsers} style={{ marginRight: 4 }} />
            Capacidad: {selectedTable.capacity} personas
          </div>
        </div>
        {occupied && activeOrder && (
          <button
            onClick={handleCompleteTable}
            disabled={saving}
            style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', borderRadius: 10, padding: '6px 12px', color: '#22c55e', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            <FontAwesomeIcon icon={faCheckCircle} style={{ marginRight: 4 }} />
            Completar
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Persons input */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            <FontAwesomeIcon icon={faUsers} style={{ marginRight: 4 }} />
            Personas en mesa
          </div>
          <input
            type="number"
            min="1"
            value={persons}
            onChange={e => setPersons(e.target.value)}
            placeholder="Cantidad de personas"
            style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>

        {loadingOrder && (
          <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>
            <FontAwesomeIcon icon={faSpinner} spin />
            <span style={{ marginLeft: 8 }}>Cargando pedido...</span>
          </div>
        )}

        {!loadingOrder && activeOrder && (activeOrder.items || []).length > 0 && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a' }}>
            <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              <FontAwesomeIcon icon={faUtensils} style={{ marginRight: 4 }} />
              Pedido activo — #{activeOrder.order_number || activeOrder.id}
            </div>
            {(activeOrder.items || []).map((item, idx) => (
              <div key={item.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid #111' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#D4AF37', flexShrink: 0 }}>
                  {item.quantity}x
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{item.product_name}</div>
                  {(Array.isArray(item.selected_ingredients) ? item.selected_ingredients : []).length > 0 && (
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{item.selected_ingredients.join(', ')}</div>
                  )}
                  {(Array.isArray(item.selected_extras) ? item.selected_extras : []).length > 0 && (
                    <div style={{ fontSize: 11, color: '#888' }}>+ {item.selected_extras.join(', ')}</div>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#D4AF37', flexShrink: 0 }}>
                  {currencySymbol}{fmt(item.unit_price * item.quantity)}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, fontSize: 15, fontWeight: 700, color: '#fff' }}>
              <span>Total pedido</span>
              <span style={{ color: '#D4AF37' }}>{currencySymbol}{fmt(orderTotal)}</span>
            </div>
          </div>
        )}

        {cart.length > 0 && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a' }}>
            <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Nuevos items
            </div>
            {cart.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid #111' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(212,175,55,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#D4AF37', flexShrink: 0 }}>
                  {item.quantity}x
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{item.product_name}</div>
                  {item.selected_ingredients.length > 0 && (
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{item.selected_ingredients.join(', ')}</div>
                  )}
                  {item.selected_extras.length > 0 && (
                    <div style={{ fontSize: 11, color: '#888' }}>+ {item.selected_extras.join(', ')}</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#D4AF37' }}>{currencySymbol}{fmt(item.unit_price * item.quantity)}</span>
                  <button onClick={() => removeCartItem(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}>
                    <FontAwesomeIcon icon={faTrash} style={{ fontSize: 12 }} />
                  </button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, fontSize: 14, fontWeight: 700, color: '#fff' }}>
              <span>Subtotal nuevos</span>
              <span style={{ color: '#D4AF37' }}>{currencySymbol}{fmt(cartTotal)}</span>
            </div>
          </div>
        )}

        {!loadingOrder && !activeOrder && cart.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: '#555' }}>
            <FontAwesomeIcon icon={faUtensils} style={{ fontSize: 28, marginBottom: 10, display: 'block' }} />
            <div>Agrega productos para abrir la mesa</div>
          </div>
        )}

        {savedMsg && (
          <div style={{ margin: '12px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FontAwesomeIcon icon={faCheckCircle} />
            {savedMsg}
          </div>
        )}
        {saveError && (
          <div style={{ margin: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ef4444' }}>
            {saveError}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #222', background: '#0d0d0d', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={() => { setShowPicker(true); setPickerSearch(''); setPickerCategory('all'); setSavedMsg(''); }}
          style={{ width: '100%', padding: '11px', background: '#1a1a1a', border: '1px solid #D4AF37', borderRadius: 10, color: '#D4AF37', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <FontAwesomeIcon icon={faPlus} />
          Agregar productos
        </button>

        {cart.length > 0 && (
          <button
            onClick={activeOrder ? handleAddItems : handleCreateOrder}
            disabled={saving}
            style={{ width: '100%', padding: '12px', background: '#D4AF37', border: 'none', borderRadius: 10, color: '#000', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCheck} />}
            {activeOrder
              ? `Agregar al pedido — ${currencySymbol}${fmt(cartTotal)}`
              : `Abrir mesa — ${currencySymbol}${fmt(cartTotal)}`}
          </button>
        )}

        {activeOrder && cart.length > 0 && (
          <div style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>
            Total acumulado: {currencySymbol}{fmt(orderTotal + cartTotal)}
          </div>
        )}
      </div>
    </div>
  );
}
