import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { detectLanguage, t, LANGUAGES } from '../i18n';
import {
  faShoppingCart,
  faPlus,
  faMinus,
  faTimes,
  faTimesCircle,
  faBox,
  faArrowLeft,
  faCopy,
  faCreditCard,
  faMoneyBillWave,
  faCheck,
  faTags,
  faInfinity,
  faUtensils,
  faChevronRight,
  faCheckCircle,
  faGripVertical,
  faLock,
  faEdit,
  faTrash,
  faFolder,
  faFolderPlus,
  faPalette,
  faCode,
  faFire,
  faGlobe,
  faClock,
  faQrcode,
  faDownload,
  faInfoCircle,
  faCamera,
  faEye,
  faEyeSlash,
  faFileExcel,
  faUpload,
  faEllipsisV,
  faFlask,
  faTicketAlt,
  faCalendarAlt,
  faMapMarkerAlt,
  faEnvelope,
  faPhone,
  faUser,
  faSpinner,
  faSearch,
  faTicket,
  faStar,
  faLayerGroup,
} from '@fortawesome/free-solid-svg-icons';
import { io } from 'socket.io-client';
import { SOCKET_URL, getImageUrl, getProductImageUrl } from '../config.js';
import CameraModal from '../components/CameraModal';
const LoyaltyCheckModal = lazy(() => import('../components/LoyaltyCheckModal'));
import RecipeEditor from '../components/RecipeEditor';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PluginSlot from '../components/PluginSlot';
import { PluginProvider } from '../context/PluginContext';
import { useStore } from '../components/Layout';
import VirtualKeyboard from '../components/VirtualKeyboard';

const API = 'https://srservi2.srautomatic.com';

function SortableCategoryTab({ catObj, activeCategory, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: catObj.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <button
      ref={setNodeRef}
      style={style}
      className={`category-tab${activeCategory === catObj.name ? ' active' : ''}${isDragging ? ' is-dragging' : ''}`}
      data-category={catObj.name}
    >
      <span className="cat-drag-handle" {...attributes} {...listeners}>
        <FontAwesomeIcon icon={faGripVertical} />
      </span>
      {catObj.name}
      <span className="cat-tab-edit-icons">
        <span onClick={(e) => { e.stopPropagation(); onEdit(catObj); }}><FontAwesomeIcon icon={faEdit} /></span>
        <span onClick={(e) => { e.stopPropagation(); onDelete(catObj); }} className="cat-tab-del"><FontAwesomeIcon icon={faTrash} /></span>
      </span>
    </button>
  );
}

function SortableProductCard({ product, onEdit, onDelete, onRecipe, currencySymbol, hideDecimals, selectionMode, isSelected, onToggleSelect }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const [menuOpen, setMenuOpen] = useState(false);
  const [dropAlign, setDropAlign] = useState('right');
  const menuBtnRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const openMenu = (e) => {
    e.stopPropagation();
    if (menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      setDropAlign(rect.left < window.innerWidth / 2 ? 'left' : 'right');
    }
    setMenuOpen(o => !o);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
    position: 'relative',
  };

  const isUnlimited = product.unlimited_stock === true || product.unlimited_stock === 1 || product.unlimited_stock === '1';
  const isOutOfStock = !isUnlimited && product.stock === 0;

  return (
    <div ref={setNodeRef} style={{ ...style, zIndex: menuOpen ? 500 : (isDragging ? 1000 : 1) }}>
      <div className={`store-product-wrapper${isOutOfStock ? ' out-of-stock' : ''}`} style={{ position: 'relative' }}>
        {!selectionMode && (
          <div className="store-edit-drag-handle" {...attributes} {...listeners}>
            <FontAwesomeIcon icon={faGripVertical} />
          </div>
        )}
        <div
          className={`store-product-card${isOutOfStock ? ' out-of-stock' : ''}${selectionMode && isSelected ? ' selection-selected' : ''}`}
          onClick={selectionMode ? (e) => { e.stopPropagation(); onToggleSelect(product.id); } : undefined}
          style={selectionMode ? { cursor: 'pointer', outline: isSelected ? '3px solid #e53e3e' : '3px solid transparent', outlineOffset: '2px' } : {}}
        >
          {isOutOfStock && (
            <div className="out-of-stock-badge">Agotado</div>
          )}
          {selectionMode && (
            <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 20 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: isSelected ? '#e53e3e' : 'rgba(255,255,255,0.9)',
                border: isSelected ? '2px solid #e53e3e' : '2px solid #ccc',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {isSelected && <span style={{ color: '#fff', fontSize: 13, fontWeight: 900, lineHeight: 1 }}>✓</span>}
              </div>
            </div>
          )}
          <div className="store-product-image">
            <img
              src={getProductImageUrl(product.image)}
              alt={product.name}
              className={isOutOfStock ? 'grayscale' : ''}
            />
          </div>
        </div>

        {/* 3-dot menu — outside the card so it's not clipped by overflow:hidden */}
        {!selectionMode && (
        <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 10 }}>
          <button
            ref={menuBtnRef}
            onClick={openMenu}
            style={{
              width: 30, height: 30, borderRadius: 8, border: 'none',
              background: 'rgba(0,0,0,0.55)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 14, backdropFilter: 'blur(4px)'
            }}
          >
            <FontAwesomeIcon icon={faEllipsisV} />
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', top: '110%',
              ...(dropAlign === 'left' ? { left: 0 } : { right: 0 }),
              background: '#fff', borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
              minWidth: 165, overflow: 'hidden', zIndex: 9999
            }}>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(product); setMenuOpen(false); }}
                style={{ width: '100%', padding: '12px 14px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, color: '#111' }}
              >
                <FontAwesomeIcon icon={faEdit} style={{ color: '#555', width: 14 }} /> Editar
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(product); setMenuOpen(false); }}
                style={{ width: '100%', padding: '12px 14px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, color: '#e53e3e', borderTop: '1px solid #f0f0f0' }}
              >
                <FontAwesomeIcon icon={faTrash} style={{ width: 14 }} /> Eliminar
              </button>
            </div>
          )}
        </div>
        )}
        <div className="store-product-info">
          {product.description && (
            <p style={{ margin: '0 0 2px', fontSize: '10px', color: 'var(--store-primary)', opacity: 0.5, lineHeight: 1.3, textAlign: 'center', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{product.description}</p>
          )}
          <div className={`store-product-details${isOutOfStock ? ' out-of-stock' : ''}`}>
            <span className="store-product-name">{product.name}:</span>
            <span className="store-product-price">{currencySymbol}{hideDecimals && Number(product.price).toFixed(2).endsWith('.00') ? String(Math.round(Number(product.price))) : Number(product.price).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableComplementRow({ item, active, onToggle, onEdit, onDelete, showDefault, isDefault, onToggleDefault }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', marginBottom: '4px', background: active ? 'rgba(0,128,0,0.08)' : '#fafafa', border: active ? '2px solid #2ecc71' : '2px solid transparent' }}>
      <div {...attributes} {...listeners} style={{ cursor: 'grab', color: '#aaa', flexShrink: 0, padding: '0 2px' }}>
        <FontAwesomeIcon icon={faGripVertical} />
      </div>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={getProductImageUrl(item.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: '600' }}>{item.name}</div>
          {Number(item.price) > 0 && <div style={{ fontSize: '12px', color: '#888' }}>+${Number(item.price).toFixed(0)}</div>}
        </div>
        <FontAwesomeIcon icon={active ? faCheckCircle : faTimesCircle} style={{ fontSize: '20px', color: active ? '#2ecc71' : '#ddd' }} />
      </div>
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
        {showDefault && active && (
          <button
            onClick={(ev) => { ev.stopPropagation(); onToggleDefault(); }}
            title={isDefault ? 'Incluido por defecto (se puede quitar) — clic para quitar' : 'Marcar como incluido por defecto'}
            style={{ background: isDefault ? 'rgba(212,175,55,0.18)' : 'none', border: isDefault ? '1px solid #D4AF37' : '1px solid #ddd', color: isDefault ? '#b8860b' : '#bbb', cursor: 'pointer', padding: '3px 7px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', whiteSpace: 'nowrap' }}
          >
            <FontAwesomeIcon icon={faStar} /> Base
          </button>
        )}
        <button onClick={(ev) => { ev.stopPropagation(); onEdit(); }} style={{ background: 'none', border: 'none', color: 'var(--store-primary)', cursor: 'pointer', padding: '4px', fontSize: '13px' }}><FontAwesomeIcon icon={faEdit} /></button>
        <button onClick={(ev) => { ev.stopPropagation(); onDelete(); }} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '4px', fontSize: '13px' }}><FontAwesomeIcon icon={faTrash} /></button>
      </div>
    </div>
  );
}

const TICKET_API = 'https://srservi2.srautomatic.com';

function TicketPanel({ storeId, storeCode, terminalId, terminalProvider, terminalName, onClose }) {
  const [phase, setPhase] = useState('events'); // events|select|confirm|paying|waiting|success|error
  const [allEvents, setAllEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [qtys, setQtys] = useState({});
  const [payError, setPayError] = useState('');
  const [waitMsg, setWaitMsg] = useState('');
  const [successCode, setSuccessCode] = useState('');
  const [successUrl, setSuccessUrl] = useState('');

  // Filtros
  const [filterCfg, setFilterCfg] = useState({ show_search:1, show_genre:1, show_country:0, show_price:1, show_date:1, genres:[], countries:[] });
  const [search, setSearch] = useState('');
  const [activeGenre, setActiveGenre] = useState('');
  const [activeCountry, setActiveCountry] = useState('');
  const [priceFilter, setPriceFilter] = useState('all'); // all|free|low|medium|high
  const [dateFilter, setDateFilter] = useState('all'); // all|today|week|month
  const [vkbOpen, setVkbOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${TICKET_API}/api/ticketeria/public/events?store_id=${storeId}`).then(r => r.json()),
      fetch(`${TICKET_API}/api/ticketeria/filter-config?store_id=${storeId}`).then(r => r.json()),
    ]).then(([evs, cfg]) => {
      setAllEvents(Array.isArray(evs) ? evs : []);
      setFilterCfg(prev => ({ ...prev, ...cfg, genres: cfg.genres || [], countries: cfg.countries || [] }));
    }).catch(() => {}).finally(() => setLoadingEvents(false));
  }, [storeId]);

  // Filtrado en cliente
  const events = allEvents.filter(ev => {
    if (search && !ev.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeGenre && ev.genre !== activeGenre) return false;
    if (activeCountry && ev.country !== activeCountry) return false;
    if (dateFilter !== 'all') {
      const evDate = ev.event_date ? new Date(String(ev.event_date).slice(0,10) + 'T12:00:00') : null;
      if (!evDate) return false;
      const now = new Date(); now.setHours(0,0,0,0);
      if (dateFilter === 'today') {
        if (evDate.toDateString() !== now.toDateString()) return false;
      } else if (dateFilter === 'week') {
        const end = new Date(now); end.setDate(end.getDate() + 7);
        if (evDate < now || evDate > end) return false;
      } else if (dateFilter === 'month') {
        const end = new Date(now); end.setMonth(end.getMonth() + 1);
        if (evDate < now || evDate > end) return false;
      }
    }
    // price filter requires knowing min price of event — skip if no categories loaded
    return true;
  });

  const selectEvent = async (ev) => {
    setSelectedEvent(ev);
    const r = await fetch(`${TICKET_API}/api/ticketeria/public/events/${ev.id}`);
    const d = await r.json();
    const cats = d.categories || [];
    setCategories(cats);
    const init = {};
    cats.forEach(c => { init[c.id] = 0; });
    setQtys(init);
    setPhase('select');
  };

  const total = categories.reduce((s, c) => s + (qtys[c.id] || 0) * c.price, 0);
  const totalTickets = Object.values(qtys).reduce((a, b) => a + b, 0);
  const adj = (id, d) => setQtys(p => {
    const cat = categories.find(c => c.id === id);
    const v = Math.max(0, (p[id] || 0) + d);
    return { ...p, [id]: Math.min(v, cat?.max_qty ?? 20) };
  });

  const buildItems = () => categories.filter(c => qtys[c.id] > 0).map(c => ({ category_id: c.id, quantity: qtys[c.id] }));

  const confirmPurchase = async (reference) => {
    await fetch(`${TICKET_API}/api/ticketeria/purchase/${reference}/confirm`, { method: 'POST' });
    const r = await fetch(`${TICKET_API}/api/ticketeria/purchase/${reference}/status`);
    const d = await r.json();
    const code = d.viewer_code || reference;
    setSuccessCode(code);
    setSuccessUrl(`${TICKET_API.replace('https://srservi2.srautomatic.com', window.location.origin)}/ticket/${code}`);
    setPhase('success');
  };

  const pollTerminal = (reference, paymentKey, provider) => {
    let attempts = 0;
    const iv = setInterval(async () => {
      attempts++;
      if (attempts > 90) { clearInterval(iv); setPayError('Tiempo agotado.'); setPhase('error'); return; }
      try {
        let statusUrl = provider === 'tuu'
          ? `${TICKET_API}/api/tuu/status/${paymentKey}`
          : `${TICKET_API}/api/plugins/payments/status/${encodeURIComponent(paymentKey)}`;
        const r = await fetch(statusUrl);
        const d = await r.json();
        const done = d.status === 'Completed';
        const fail = ['Canceled', 'Failed', 'Timeout'].includes(d.status);
        if (done) { clearInterval(iv); await confirmPurchase(reference); }
        else if (fail) { clearInterval(iv); setPayError('Pago cancelado en el terminal.'); setPhase('error'); }
      } catch {}
    }, 2000);
  };

  const handlePay = async (method = 'terminal') => {
    setPayError('');
    setPhase('paying');
    try {
      const body = { store_id: storeId, event_id: selectedEvent.id, items: buildItems() };

      // Gratis o efectivo
      if (total === 0 || method === 'cash') {
        const r = await fetch(`${TICKET_API}/api/ticketeria/purchase/init`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const d = await r.json();
        if (!r.ok) { setPayError(d.error || 'Error'); setPhase('error'); return; }
        await confirmPurchase(d.reference);
        return;
      }

      // Terminal TUU o Square
      if (terminalId && (terminalProvider === 'tuu' || terminalProvider === 'square')) {
        const initR = await fetch(`${TICKET_API}/api/ticketeria/purchase/init`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const initD = await initR.json();
        if (!initR.ok) { setPayError(initD.error || 'Error'); setPhase('error'); return; }

        const chargeUrl = terminalProvider === 'tuu' ? `${TICKET_API}/api/tuu/charge` : `${TICKET_API}/api/plugins/payments/charge`;
        const chargeBody = terminalProvider === 'tuu'
          ? { store_id: storeId, amount: Math.round(initD.totalAmount), description: `Entradas: ${selectedEvent.name}`, terminal_id: parseInt(terminalId) }
          : { store_id: storeId, amount: initD.totalAmount, description: `Entradas: ${selectedEvent.name}`, terminal_id: parseInt(terminalId), terminal_provider: 'square' };

        const chargeR = await fetch(chargeUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(chargeBody) });
        const chargeD = await chargeR.json();
        if (!chargeD.success) { setPayError(chargeD.error || 'Error activando terminal'); setPhase('error'); return; }

        setWaitMsg(`Cobrando $${initD.totalAmount.toLocaleString('es-CL')} en ${terminalName || 'terminal'}…`);
        setPhase('waiting');
        pollTerminal(initD.reference, chargeD.paymentKey, terminalProvider);
        return;
      }

      // Haulmer online (sin terminal)
      const r = await fetch(`${TICKET_API}/api/ticketeria/purchase`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setPayError(d.error || 'Error'); setPhase('error'); return; }
      if (d.free) { await confirmPurchase(d.reference); return; }
      window.open(d.paymentUrl, '_blank');
      // Esperar confirmación del webhook
      setWaitMsg('Esperando confirmación de pago Haulmer…');
      setPhase('waiting');
      let att = 0;
      const iv = setInterval(async () => {
        att++;
        if (att > 150) { clearInterval(iv); setPhase('error'); setPayError('Tiempo agotado.'); return; }
        const sr = await fetch(`${TICKET_API}/api/ticketeria/purchase/${d.reference}/status`);
        const sd = await sr.json();
        if (sd.status === 'paid') { clearInterval(iv); await confirmPurchase(d.reference); }
      }, 3000);

    } catch (e) { setPayError(e.message); setPhase('error'); }
  };

  const formatDate = (raw) => {
    if (!raw) return '';
    return new Date(String(raw).slice(0,10) + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  };

  const overlay = { position: 'fixed', inset: 0, zIndex: 9999, background: '#080808', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
  const btn = (bg, color) => ({ padding: '14px 20px', background: bg, border: 'none', borderRadius: 12, color, fontWeight: 700, fontSize: 15, cursor: 'pointer', width: '100%' });

  const headerTitle = phase === 'events' ? null
    : phase === 'select' || phase === 'confirm' ? selectedEvent?.name
    : phase === 'waiting' ? 'Procesando pago'
    : phase === 'success' ? '¡Confirmado!'
    : 'Error';

  return (
    <div style={overlay}>
      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(180deg, #111 0%, #0d0d0d 100%)',
        borderBottom: '2px solid var(--store-accent, #D4AF37)',
        padding: '0',
        flexShrink: 0,
      }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--store-accent, #D4AF37)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <FontAwesomeIcon icon={faTicketAlt} style={{ color: '#000', fontSize: 17 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 18, lineHeight: 1.1, letterSpacing: 0.3 }}>
              {headerTitle || 'Ticketería'}
            </div>
            {phase === 'events' && (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
                Seleccioná un evento
              </div>
            )}
          </div>
        </div>
        {/* Breadcrumb strip */}
        {(phase === 'select' || phase === 'confirm') && (
          <div style={{ display: 'flex', borderTop: '1px solid #1e1e1e' }}>
            {[['events','Eventos'],['select','Entradas'],['confirm','Pago']].map(([p, label], i, arr) => {
              const steps = ['events','select','confirm'];
              const idx = steps.indexOf(phase);
              const stepIdx = steps.indexOf(p);
              const done = stepIdx < idx;
              const active = stepIdx === idx;
              return (
                <div key={p} style={{ flex: 1, padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 700,
                  borderRight: i < arr.length - 1 ? '1px solid #1e1e1e' : 'none',
                  color: active ? 'var(--store-accent, #D4AF37)' : done ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
                  borderBottom: active ? '2px solid var(--store-accent, #D4AF37)' : '2px solid transparent',
                }}>
                  {done ? '✓ ' : ''}{label}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#080808' }}>

        {/* ── VirtualKeyboard para búsqueda ── */}
        {vkbOpen && (
          <VirtualKeyboard
            value={search}
            onChange={setSearch}
            onClose={() => setVkbOpen(false)}
            placeholder="Buscar evento..."
          />
        )}

        {/* ── LISTA DE EVENTOS ── */}
        {phase === 'events' && (
          <>
          {/* Barra de filtros */}
          {!loadingEvents && allEvents.length > 0 && (
            <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* Búsqueda */}
              {!!filterCfg.show_search && (
                <button onClick={() => setVkbOpen(true)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '11px 14px', background: '#111', border: '1px solid #222',
                  borderRadius: 12, cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box'
                }}>
                  <FontAwesomeIcon icon={faSearch} style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }} />
                  <span style={{ flex: 1, fontSize: 14, color: search ? '#fff' : 'rgba(255,255,255,0.3)', fontWeight: search ? 600 : 400 }}>
                    {search || 'Buscar evento…'}
                  </span>
                  {search && (
                    <span onClick={e => { e.stopPropagation(); setSearch(''); }} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18, lineHeight: 1 }}>×</span>
                  )}
                </button>
              )}

              {/* Géneros */}
              {!!filterCfg.show_genre && filterCfg.genres?.length > 0 && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                  {['all', ...filterCfg.genres].map(g => {
                    const active = (g === 'all' && !activeGenre) || activeGenre === g;
                    return (
                      <button key={g} onClick={() => setActiveGenre(g === 'all' ? '' : g)}
                        style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: `1px solid ${active ? 'var(--store-accent, #D4AF37)' : '#2a2a2a'}`, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          background: active ? 'rgba(212,175,55,0.12)' : 'transparent',
                          color: active ? 'var(--store-accent, #D4AF37)' : 'rgba(255,255,255,0.4)',
                          letterSpacing: 0.3 }}>
                        {g === 'all' ? 'Todos' : g}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Países */}
              {!!filterCfg.show_country && filterCfg.countries?.length > 0 && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                  {['all', ...filterCfg.countries].map(c => {
                    const active = (c === 'all' && !activeCountry) || activeCountry === c;
                    return (
                      <button key={c} onClick={() => setActiveCountry(c === 'all' ? '' : c)}
                        style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: `1px solid ${active ? 'var(--store-accent, #D4AF37)' : '#2a2a2a'}`, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          background: active ? 'rgba(212,175,55,0.12)' : 'transparent',
                          color: active ? 'var(--store-accent, #D4AF37)' : 'rgba(255,255,255,0.4)' }}>
                        {c === 'all' ? 'Todos' : c}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Fecha */}
              {!!filterCfg.show_date && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                  {[['all','Todos'],['today','Hoy'],['week','Esta semana'],['month','Este mes']].map(([key, label]) => (
                    <button key={key} onClick={() => setDateFilter(key)}
                      style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: `1px solid ${dateFilter === key ? 'var(--store-accent, #D4AF37)' : '#2a2a2a'}`, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                        background: dateFilter === key ? 'rgba(212,175,55,0.12)' : 'transparent',
                        color: dateFilter === key ? 'var(--store-accent, #D4AF37)' : 'rgba(255,255,255,0.4)' }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {loadingEvents ? (
            <div style={{ textAlign: 'center', paddingTop: 80 }}>
              <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 36, color: 'var(--store-accent, #D4AF37)' }} />
              <div style={{ marginTop: 14, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Cargando eventos…</div>
            </div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 80 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(212,175,55,0.08)', border: '2px solid rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <FontAwesomeIcon icon={faTicketAlt} style={{ fontSize: 30, color: 'rgba(212,175,55,0.5)' }} />
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: 600 }}>
                {search || activeGenre || activeCountry || dateFilter !== 'all' ? 'Sin resultados' : 'No hay eventos disponibles'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {events.map(ev => {
                const evDate = ev.event_date ? new Date(String(ev.event_date).slice(0,10) + 'T12:00:00') : null;
                const dayNum  = evDate ? evDate.toLocaleDateString('es-CL', { day: '2-digit' }) : '';
                const month   = evDate ? evDate.toLocaleDateString('es-CL', { month: 'short' }).toUpperCase() : '';
                const weekday = evDate ? evDate.toLocaleDateString('es-CL', { weekday: 'long' }) : '';
                const year    = evDate ? evDate.getFullYear() : '';
                const timeStr = ev.time_start ? String(ev.time_start).slice(0,5) + (ev.time_end ? ` – ${String(ev.time_end).slice(0,5)}` : '') : '';
                return (
                  <div key={ev.id} onClick={() => selectEvent(ev)}
                    style={{ borderRadius: 14, overflow: 'hidden', cursor: 'pointer', position: 'relative', aspectRatio: '2/3', background: '#111', boxShadow: '0 4px 18px rgba(0,0,0,0.6)', transition: 'transform .12s', WebkitTapHighlightColor: 'transparent' }}
                    onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                    onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    {/* Imagen o fondo */}
                    {ev.image_url
                      ? <img src={ev.image_url} alt={ev.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #1e1e1e 0%, #0d0d0d 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FontAwesomeIcon icon={faTicketAlt} style={{ fontSize: 28, color: 'rgba(212,175,55,0.18)' }} />
                        </div>
                    }

                    {/* Gradiente bottom-up */}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 25%, rgba(0,0,0,0.5) 55%, rgba(0,0,0,0.96) 100%)' }} />

                    {/* Contenido superpuesto */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 8px 10px' }}>
                      {/* Badge fecha */}
                      {evDate && (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', background: 'var(--store-accent, #D4AF37)', borderRadius: 7, padding: '3px 7px', marginBottom: 6 }}>
                          <span style={{ fontSize: 15, fontWeight: 900, lineHeight: 1, color: '#000' }}>{dayNum}</span>
                          <span style={{ fontSize: 8, fontWeight: 900, color: 'rgba(0,0,0,0.65)', letterSpacing: '1px' }}>{month}</span>
                        </div>
                      )}
                      {/* Nombre */}
                      <div style={{
                        fontSize: 11, fontWeight: 800, color: '#fff', lineHeight: 1.3,
                        textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        marginBottom: timeStr ? 3 : 0,
                      }}>
                        {ev.name}
                      </div>
                      {/* Hora */}
                      {timeStr && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--store-accent, #D4AF37)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <FontAwesomeIcon icon={faClock} style={{ fontSize: 8 }} />
                          {timeStr}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
          }</>
        )}

        {/* ── SELECTOR DE ENTRADAS ── */}
        {phase === 'select' && (
          <div style={{ maxWidth: 500, margin: '0 auto' }}>
            {/* Cabecera con fecha/hora grande */}
            {selectedEvent && (() => {
              const evDate = selectedEvent.event_date ? new Date(String(selectedEvent.event_date).slice(0,10) + 'T12:00:00') : null;
              const dayNum  = evDate ? evDate.toLocaleDateString('es-CL', { day: '2-digit' }) : '';
              const month   = evDate ? evDate.toLocaleDateString('es-CL', { month: 'long' }) : '';
              const weekday = evDate ? evDate.toLocaleDateString('es-CL', { weekday: 'long' }) : '';
              const timeStr = selectedEvent.time_start ? String(selectedEvent.time_start).slice(0,5) + (selectedEvent.time_end ? ` – ${String(selectedEvent.time_end).slice(0,5)}` : '') : '';
              return (
                <div style={{ background: '#111', borderRadius: 16, overflow: 'hidden', marginBottom: 20, border: '1px solid #2a2a2a', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
                  {selectedEvent.image_url
                    ? <div style={{ position: 'relative' }}>
                        <img src={selectedEvent.image_url} alt={selectedEvent.name} style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.85) 100%)' }} />
                        <div style={{ position: 'absolute', bottom: 12, left: 14, right: 14 }}>
                          <div style={{ fontWeight: 900, fontSize: 18, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{selectedEvent.name}</div>
                        </div>
                      </div>
                    : <div style={{ padding: '16px 16px 0' }}>
                        <div style={{ fontWeight: 900, fontSize: 18, color: '#fff' }}>{selectedEvent.name}</div>
                      </div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px' }}>
                    <div style={{ background: 'var(--store-accent, #D4AF37)', borderRadius: 10, padding: '10px 14px', textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, color: '#000' }}>{dayNum}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#000', letterSpacing: 1 }}>{month?.toUpperCase()}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>{weekday}</div>
                      {timeStr && <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--store-accent, #D4AF37)', letterSpacing: '-0.5px' }}><FontAwesomeIcon icon={faClock} style={{ fontSize: 13, marginRight: 6, opacity: 0.8 }} />{timeStr}</div>}
                      {selectedEvent.location && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}><FontAwesomeIcon icon={faMapMarkerAlt} style={{ marginRight: 5 }} />{selectedEvent.location}</div>}
                    </div>
                  </div>
                </div>
              );
            })()}
            {categories.length === 0
              ? <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingTop: 30 }}>Este evento no tiene categorías configuradas</p>
              : categories.map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px', background: qtys[cat.id] > 0 ? 'rgba(212,175,55,0.06)' : '#111', borderRadius: 14, marginBottom: 10, border: `1.5px solid ${qtys[cat.id] > 0 ? 'var(--store-accent, #D4AF37)' : '#222'}`, transition: 'border-color 0.2s, background 0.2s' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>{cat.name}</div>
                    {cat.description && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{cat.description}</div>}
                    <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--store-accent, #D4AF37)', marginTop: 4 }}>
                      {cat.price === 0 ? 'Gratis' : `$${cat.price.toLocaleString('es-CL')}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a', overflow: 'hidden' }}>
                    <button type="button" onClick={() => adj(cat.id, -1)} disabled={!qtys[cat.id]}
                      style={{ width: 40, height: 40, border: 'none', background: 'transparent', color: qtys[cat.id] ? 'var(--store-accent, #D4AF37)' : 'rgba(255,255,255,0.2)', cursor: qtys[cat.id] ? 'pointer' : 'not-allowed', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesomeIcon icon={faMinus} />
                    </button>
                    <span style={{ minWidth: 36, textAlign: 'center', fontWeight: 900, fontSize: 18, color: '#fff', borderLeft: '1px solid #2a2a2a', borderRight: '1px solid #2a2a2a', padding: '0 4px', lineHeight: '40px' }}>{qtys[cat.id] || 0}</span>
                    <button type="button" onClick={() => adj(cat.id, 1)}
                      style={{ width: 40, height: 40, border: 'none', background: 'transparent', color: 'var(--store-accent, #D4AF37)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesomeIcon icon={faPlus} />
                    </button>
                  </div>
                </div>
              ))}

            {totalTickets > 0 && (
              <div style={{ marginTop: 12, padding: '16px 18px', background: 'rgba(212,175,55,0.08)', borderRadius: 14, border: '1.5px solid var(--store-accent, #D4AF37)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 600 }}>{totalTickets} entrada{totalTickets !== 1 ? 's' : ''}</span>
                <span style={{ color: 'var(--store-accent, #D4AF37)', fontWeight: 900, fontSize: 24 }}>{total === 0 ? 'Gratis' : `$${total.toLocaleString('es-CL')}`}</span>
              </div>
            )}
          </div>
        )}

        {/* ── RESUMEN DE COMPRA ── */}
        {phase === 'confirm' && (
          <div style={{ maxWidth: 500, margin: '0 auto' }}>
            {/* Info evento */}
            <div style={{ background: '#111', borderRadius: 16, overflow: 'hidden', marginBottom: 16, border: '1px solid #2a2a2a' }}>
              {selectedEvent?.image_url && (
                <div style={{ position: 'relative' }}>
                  <img src={selectedEvent.image_url} alt={selectedEvent.name} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 20%, rgba(0,0,0,0.7) 100%)' }} />
                </div>
              )}
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontWeight: 900, fontSize: 18, color: '#fff', marginBottom: 8 }}>{selectedEvent?.name}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {selectedEvent?.event_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                      <FontAwesomeIcon icon={faCalendarAlt} style={{ color: 'var(--store-accent, #D4AF37)', width: 14 }} />
                      {formatDate(selectedEvent.event_date)}
                    </div>
                  )}
                  {selectedEvent?.time_start && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                      <FontAwesomeIcon icon={faClock} style={{ color: 'var(--store-accent, #D4AF37)', width: 14 }} />
                      {String(selectedEvent.time_start).slice(0,5)}{selectedEvent.time_end ? ` – ${String(selectedEvent.time_end).slice(0,5)}` : ''}
                    </div>
                  )}
                  {selectedEvent?.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                      <FontAwesomeIcon icon={faMapMarkerAlt} style={{ color: 'var(--store-accent, #D4AF37)', width: 14 }} />
                      {selectedEvent.location}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Detalle de entradas */}
            <div style={{ background: '#111', borderRadius: 14, border: '1px solid #222', overflow: 'hidden', marginBottom: 14 }}>
              {categories.filter(c => qtys[c.id] > 0).map((cat, i, arr) => (
                <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{cat.name}</span>
                    <span style={{ marginLeft: 10, fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>× {qtys[cat.id]}</span>
                  </div>
                  <span style={{ fontWeight: 800, color: 'var(--store-accent, #D4AF37)', fontSize: 15 }}>
                    {cat.price === 0 ? 'Gratis' : `$${(cat.price * qtys[cat.id]).toLocaleString('es-CL')}`}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(212,175,55,0.06)', borderTop: '2px solid rgba(212,175,55,0.2)' }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>{totalTickets} persona{totalTickets !== 1 ? 's' : ''}</span>
                <span style={{ fontWeight: 900, fontSize: 26, color: 'var(--store-accent, #D4AF37)' }}>
                  {total === 0 ? 'Gratis' : `$${total.toLocaleString('es-CL')}`}
                </span>
              </div>
            </div>

            {/* Terminal */}
            {terminalId && (
              <div style={{ padding: '10px 14px', background: 'rgba(212,175,55,0.06)', borderRadius: 10, fontSize: 13, color: 'var(--store-accent, #D4AF37)', marginBottom: 8, border: '1px solid rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FontAwesomeIcon icon={faCreditCard} />
                Terminal: {terminalName || terminalProvider?.toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* ── ESPERANDO PAGO ── */}
        {phase === 'waiting' && (
          <div style={{ textAlign: 'center', paddingTop: 80, maxWidth: 340, margin: '0 auto' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', border: '3px solid rgba(212,175,55,0.3)', borderTopColor: 'var(--store-accent, #D4AF37)', animation: 'spin 1s linear infinite', margin: '0 auto 24px' }} />
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Esperando pago…</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 6 }}>{waitMsg}</div>
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>No cierres esta pantalla</div>
          </div>
        )}

        {/* ── PROCESANDO ── */}
        {phase === 'paying' && (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 44, color: 'var(--store-accent, #D4AF37)', marginBottom: 20, display: 'block' }} />
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>Procesando…</div>
          </div>
        )}

        {/* ── ÉXITO ── */}
        {phase === 'success' && (
          <div style={{ textAlign: 'center', paddingTop: 20, maxWidth: 440, margin: '0 auto' }}>
            {/* Checkmark */}
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <FontAwesomeIcon icon={faCheckCircle} style={{ color: '#22c55e', fontSize: 38 }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 4 }}>¡Confirmado!</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>
              {selectedEvent?.name} · {totalTickets} entrada{totalTickets !== 1 ? 's' : ''}
            </div>

            {/* QR Card */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '24px 20px', border: '3px solid var(--store-accent, #D4AF37)', marginBottom: 20, display: 'inline-block', boxShadow: '0 8px 40px rgba(212,175,55,0.25)' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(successUrl)}&bgcolor=ffffff&color=000000&margin=2`}
                alt="QR" width={220} height={220} style={{ display: 'block', borderRadius: 8 }}
              />
              <div style={{ marginTop: 14, fontFamily: 'monospace', fontSize: 24, fontWeight: 900, letterSpacing: 6, color: '#111', textAlign: 'center' }}>{successCode}</div>
              <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af', textAlign: 'center', letterSpacing: 0.5 }}>PRESENTAR EN EL INGRESO</div>
            </div>

            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginBottom: 24 }}>
              El cliente puede fotografiar el código
            </div>

            <button
              onClick={() => { setPhase('events'); setSelectedEvent(null); setQtys({}); setSuccessCode(''); setSuccessUrl(''); }}
              style={{ ...btn('var(--store-accent, #D4AF37)', '#000') }}
            >
              Nueva compra
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {phase === 'error' && (
          <div style={{ textAlign: 'center', paddingTop: 60, maxWidth: 400, margin: '0 auto' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <FontAwesomeIcon icon={faTimesCircle} style={{ fontSize: 38, color: '#ef4444' }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Error en el pago</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginBottom: 24 }}>{payError}</div>
            <button onClick={() => setPhase('confirm')} style={{ ...btn('#1a1a1a', '#fff'), border: '1px solid #333' }}>
              Intentar nuevamente
            </button>
          </div>
        )}
      </div>

      {/* Botones inferiores */}
      {(phase === 'select' || phase === 'confirm') && (
        <div style={{ padding: '14px 16px', background: '#0d0d0d', borderTop: '1px solid #1a1a1a', flexShrink: 0 }}>
          {phase === 'select' ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPhase('events')}
                style={{ ...btn('#1a1a1a', 'rgba(255,255,255,0.6)'), flex: '0 0 auto', width: 'auto', padding: '14px 18px', border: '1px solid #2a2a2a' }}>
                <FontAwesomeIcon icon={faArrowLeft} />
              </button>
              <button
                onClick={() => { if (totalTickets === 0) return; setPhase('confirm'); }}
                disabled={totalTickets === 0}
                style={{ ...btn(totalTickets === 0 ? '#1a1a1a' : 'var(--store-accent, #D4AF37)', totalTickets === 0 ? 'rgba(255,255,255,0.2)' : '#000'), flex: 1, cursor: totalTickets === 0 ? 'not-allowed' : 'pointer', fontSize: 14 }}>
                {totalTickets === 0 ? 'Seleccioná entradas' : `Ver resumen · ${totalTickets} entrada${totalTickets !== 1 ? 's' : ''} ${total > 0 ? `· $${total.toLocaleString('es-CL')}` : '· Gratis'}`}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => handlePay('terminal')} style={{ ...btn('var(--store-accent, #D4AF37)', '#000'), fontSize: 15 }}>
                {total === 0 ? '✓ Confirmar (Gratis)' : `Pagar $${total.toLocaleString('es-CL')}`}
              </button>
              <button onClick={() => setPhase('select')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer', padding: '8px', textAlign: 'center', width: '100%' }}>
                <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 5 }} />Volver
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Store() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const terminalFromUrl = searchParams.get('terminal');
  const configFromUrl = searchParams.get('config');
  const adminEditToken = searchParams.get('admin_edit');
  const { setMenuOpen } = useStore() || {};
  const deliveryMode = searchParams.get('delivery') === 'true';
  const tuuModePayFromUrl = searchParams.get('tuumodepay') === 'true';
  const qrReturnResult = searchParams.get('x_result');
  const qrReturnRef = searchParams.get('x_reference');
  const [qrPaymentResult, setQrPaymentResult] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cashRegisterOpen, setCashRegisterOpen] = useState(true);
  const [storeOpeningAmount, setStoreOpeningAmount] = useState('');
  const [storeOpeningLoading, setStoreOpeningLoading] = useState(false);
  const [storeOpeningError, setStoreOpeningError] = useState('');
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const selectedProductRef = useRef(null);
  const [orderType, setOrderType] = useState('serve');
  const [productConfig, setProductConfig] = useState({
    selectedIngredients: [],
    selectedExtras: [],
    selectedComplements: [],
    quantity: 1,
    notes: ''
  });
  const [ingredientsModalOpen, setIngredientsModalOpen] = useState(false);
  const [extrasModalOpen, setExtrasModalOpen] = useState(false);
  const [complementGroupsModalOpen, setComplementGroupsModalOpen] = useState(false);
  const [productModalStep, setProductModalStep] = useState('main');
  const [addingToCart, setAddingToCart] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [tipEnabled, setTipEnabled] = useState(false);
  const [tipPercent, setTipPercent] = useState(0);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState(null);
  const [lastOrderNumber, setLastOrderNumber] = useState(null);
  const [lastTableNumber, setLastTableNumber] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [availableTerminals, setAvailableTerminals] = useState([]);
  const [selectedTerminalId, setSelectedTerminalId] = useState(
    localStorage.getItem('srservi_last_terminal_id') || ''
  );
  const [selectedTerminalProvider, setSelectedTerminalProvider] = useState(
    localStorage.getItem('srservi_last_terminal_provider') || ''
  );
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [loyaltyModalOpen, setLoyaltyModalOpen] = useState(false);
  const [loyaltyCustomer, setLoyaltyCustomer] = useState(null);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const loyaltyDiscountRef = useRef(0);
  const [loyaltyConfig, setLoyaltyConfig] = useState(null);
  const [pendingOrderData, setPendingOrderData] = useState(null);
  const [comboModal, setComboModal] = useState(null);
  const [comboQty, setComboQty] = useState(1);
  const [activeCategory, setActiveCategory] = useState('all');
  const [configurations, setConfigurations] = useState([]);
  const [selectedConfiguration, setSelectedConfiguration] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [editDragActiveId, setEditDragActiveId] = useState(null);
  const [catDragActiveId, setCatDragActiveId] = useState(null);
  const [sessionPin, setSessionPin] = useState(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catModalFromProduct, setCatModalFromProduct] = useState(false);
  const [catName, setCatName] = useState('');
  const [tuuProvider, setTuuProvider] = useState(null);
  const [qrProvider, setQrProvider] = useState(null);
  const [qrPaymentUrl, setQrPaymentUrl] = useState(null);
  const [tuuPaymentKey, setTuuPaymentKey] = useState(null);
  const [squarePaymentKey, setSquarePaymentKey] = useState(null);
  const [androidBridgeAvailable, setAndroidBridgeAvailable] = useState(false);
  const [haulmerNative, setHaulmerNative] = useState(false);
  const [haulmerReference, setHaulmerReference] = useState(null);
  const [deviceUid] = useState(() => {
    let uid = localStorage.getItem('srservi_device_uid');
    if (!uid) {
      const rand = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
      uid = 'dev_' + rand;
      localStorage.setItem('srservi_device_uid', uid);
    }
    return uid;
  });
  const [adminToken, setAdminToken] = useState(null);
  const [editorTab, setEditorTab] = useState('products');
  const [editorCombos, setEditorCombos] = useState([]);
  const [editorCombosLoaded, setEditorCombosLoaded] = useState(false);
  const [editorComboModal, setEditorComboModal] = useState(null);
  const [editorComboForm, setEditorComboForm] = useState(null);
  const [editorComboProdSearch, setEditorComboProdSearch] = useState('');
  const [editorComboSaving, setEditorComboSaving] = useState(false);
  const [editorComboError, setEditorComboError] = useState('');
  const [liveOrders, setLiveOrders] = useState([]);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [extras, setExtras] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [showStoreDuplicatesModal, setShowStoreDuplicatesModal] = useState(false);
  const [storeDuplicateInfo, setStoreDuplicateInfo] = useState([]);
  const [storeDeduplicating, setStoreDeduplicating] = useState(false);
  const [complementModal, setComplementModal] = useState(null);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [restartingSending, setRestartingSending] = useState(false);
  const [pinOptionsModalOpen, setPinOptionsModalOpen] = useState(false);
  const [totemZoom, setTotemZoom] = useState(() => parseFloat(localStorage.getItem('srservi_totem_zoom') || '1'));
  const [localAcceptCash, setLocalAcceptCash] = useState(() => {
    const v = localStorage.getItem('srservi_accept_cash');
    return v === null ? null : v === 'true';
  });
  const [localAcceptCard, setLocalAcceptCard] = useState(() => {
    const v = localStorage.getItem('srservi_accept_card');
    return v === null ? null : v === 'true';
  });
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [productInfo, setProductInfo] = useState(null);
  const [posSelectModalOpen, setPosSelectModalOpen] = useState(false);
  const [ticketMode, setTicketMode] = useState(() => !searchParams.get('admin_edit') && localStorage.getItem('srservi_ticket_mode') === '1');
  const [posSelectList, setPosSelectList] = useState([]);
  const [posSelectLoading, setPosSelectLoading] = useState(false);
  const [complementForm, setComplementForm] = useState({ name: '', price: '', type: 'extra', category_id: '', stock: '', unlimited_stock: true, imageFile: null });
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState(null);
  const [prodForm, setProdForm] = useState({ name: '', price: '', category_id: '', description: '', barcode: '', stock: '0', unlimited_stock: true, has_extras: false, has_ingredients: false, max_extras: '', max_ingredients: '', image_url: '', complements_private: false, complement_group_ids: [] });
  const [storeComplementGroups, setStoreComplementGroups] = useState([]);
  // Edición de secciones dinámicas desde el editor del tótem
  const [sectionGroupModal, setSectionGroupModal] = useState(null); // { id?, name, min_select, max_select, required }
  const [sectionOptionModal, setSectionOptionModal] = useState(null); // { id?, group_id, name, price, stock, unlimited_stock, imageFile }
  const [sectionEditingGroup, setSectionEditingGroup] = useState(null); // grupo activo para agregar opciones inline
  const [sectionSaving, setSectionSaving] = useState(false);
  const [prodImageFile, setProdImageFile] = useState(null);
  const [prodCameraOpen, setProdCameraOpen] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [prodSaving, setProdSaving] = useState(false);
  const [bgRemoveDialog, setBgRemoveDialog] = useState(false);
  const [bgRemoving, setBgRemoving] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [showRatingStep, setShowRatingStep] = useState(false);
  const [orderRating, setOrderRating] = useState(null);
  const [orderComment, setOrderComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [pendingRatingOrderId, setPendingRatingOrderId] = useState(null);
  const [prodNewExtras, setProdNewExtras] = useState([]);
  const [prodNewComplements, setProdNewComplements] = useState([]);
  const [showComplementsModal, setShowComplementsModal] = useState(false);
  const [editCatFilter, setEditCatFilter] = useState('all');
  const [selectedIngredientIds, setSelectedIngredientIds] = useState([]);
  const [selectedDefaultIngredientIds, setSelectedDefaultIngredientIds] = useState([]);
  const [selectedExtraIds, setSelectedExtraIds] = useState([]);
  const [complementsTab, setComplementsTab] = useState('complements');
  const [editingComplement, setEditingComplement] = useState(null);
  const [editComplementModal, setEditComplementModal] = useState(null);
  const [prodRecipeModal, setProdRecipeModal] = useState(null);
  const [invTab, setInvTab] = useState('products');
  const [invEditingId, setInvEditingId] = useState(null);
  const [invEditValue, setInvEditValue] = useState('');
  const [invSaving, setInvSaving] = useState(false);
  const [rawMats, setRawMats] = useState([]);
  const [rmLoading, setRmLoading] = useState(false);
  const [rmEditingId, setRmEditingId] = useState(null);
  const [rmEditValue, setRmEditValue] = useState('');
  const [rmSaving, setRmSaving] = useState(false);
  const [rmModal, setRmModal] = useState(null); // null | 'new' | rmObject
  const [rmForm, setRmForm] = useState({ name: '', quantity: '', unit: 'unidades', min_quantity: '', cost_per_unit: '' });
  const [rmSearch, setRmSearch] = useState('');
  const [rmRestockId, setRmRestockId] = useState(null);
  const [rmRestockValue, setRmRestockValue] = useState('');
  const [styleEditorOpen, setStyleEditorOpen] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelStep, setExcelStep] = useState('upload');
  const [excelRows, setExcelRows] = useState([]);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelError, setExcelError] = useState('');
  const [excelResults, setExcelResults] = useState(null);
  const excelFileRef = useRef(null);
  const [styleTab, setStyleTab] = useState('visual');
  const [visualSettings, setVisualSettings] = useState({
    fontFamily: '', fontSize: '', titleSize: '', priceSize: '',
    fontWeight: '', textShadow: '', cardShadow: '', cardRadius: '',
    productNameColor: '', productPriceColor: '', cardBg: '', cardBorder: '',
    headerBg: '', headerTextColor: '', categoryBg: '', categoryActiveColor: '',
    cartBg: '', cartTextColor: ''
  });
  const [customCss, setCustomCss] = useState('');
  const [styleSaving, setStyleSaving] = useState(false);
  const [labelEditModal, setLabelEditModal] = useState(null); // { type: 'extras'|'complements', value }
  const [labelSaving, setLabelSaving] = useState(false);
  const [topSellingIds, setTopSellingIds] = useState([]);
  const [prepTimes, setPrepTimes] = useState({});
  const [lang, setLang] = useState(detectLanguage);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const [welcomeClosing, setWelcomeClosing] = useState(false);
  const [welcomeSelectedLang, setWelcomeSelectedLang] = useState(null);
  const [inactivityModalOpen, setInactivityModalOpen] = useState(false);
  const [inactivityCountdown, setInactivityCountdown] = useState(10);
  const [vkbOpen, setVkbOpen] = useState(false);
  const inactivityTimerRef = useRef(null);
  const inactivityCountdownRef = useRef(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteAllCountdown, setDeleteAllCountdown] = useState(5);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false);
  const [deleteSelectedCountdown, setDeleteSelectedCountdown] = useState(5);
  const [deletingSelected, setDeletingSelected] = useState(false);

  // Screensaver
  const [screensaverCfg, setScreensaverCfg] = useState(null);
  const [screensaverActive, setScreensaverActive] = useState(false);
  const screensaverTimerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const categoryRef = useRef(null);
  const productsAreaRef = useRef(null);
  const storeIdRef = useRef(null);
  const storeContainerRef = useRef(null);
  const prodRecipeRef = useRef(null);
  const compRecipeRef = useRef(null);
  const editCompRecipeRef = useRef(null);
  const prodRecipeSaveRef = useRef(null);
  const socketRef = useRef(null);
  const pendingOrderDataRef = useRef(null);
  const editModeRef = useRef(false);
  const adminTokenRef = useRef(null);
  const restartTriggeredRef = useRef(false);
  const anyModalOpenRef = useRef(false);

  useEffect(() => {
    setActiveCategory('all');
    storeIdRef.current = store?.store?.id || null;
  }, [store?.store?.id]);

  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);

  useEffect(() => {
    adminTokenRef.current = adminToken;
  }, [adminToken]);

  useEffect(() => {
    if (!editMode || !store?.store?.id || !adminToken) return;
    fetch(`/api/orders?store_id=${store.store.id}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setLiveOrders(Array.isArray(data) ? data.slice(0, 30) : []))
      .catch(() => {});
  }, [editMode, store?.store?.id, adminToken]);

  useEffect(() => {
    pendingOrderDataRef.current = pendingOrderData;
  }, [pendingOrderData]);

  useEffect(() => {
    if (!qrReturnRef) return;

    // Referencia nativa Haulmer (prefijo SRSN-) — confirmar y registrar orden
    if (qrReturnRef.startsWith('SRSN-')) {
      const xResult  = searchParams.get('x_result');
      const xAmount  = searchParams.get('x_amount');
      const xMessage = searchParams.get('x_message');

      if (xResult === 'completed') {
        // Recopilar todos los params x_* para enviar al confirm endpoint
        const xParams = {};
        for (const [key, val] of searchParams.entries()) {
          if (key.startsWith('x_')) xParams[key] = val;
        }
        fetch('/api/haulmer/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(xParams)
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            setQrPaymentResult({
              success: true,
              status: 'completed',
              reference: qrReturnRef,
              amount: xAmount,
              message: xMessage || 'Pago aprobado',
              order: data?.order_number ? { order_number: data.order_number } : null
            });
          })
          .catch(() => {
            setQrPaymentResult({ success: true, reference: qrReturnRef, amount: xAmount, message: xMessage || 'Pago aprobado' });
          });
      } else {
        setQrPaymentResult({ success: false, reference: qrReturnRef, message: xMessage || 'Pago no completado' });
      }
      return;
    }

    // Plugin QR verify (referencias SRS- u otras)
    const allParams = {};
    searchParams.forEach((v, k) => { allParams[k] = v; });
    fetch('/api/plugins/qr/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allParams)
    }).then(r => r.json()).then(data => {
      setQrPaymentResult(data);
    }).catch(() => {
      setQrPaymentResult({ success: false, message: 'Error verificando pago' });
    });
  }, [qrReturnRef]);

  // Auto-download receipt for successful delivery QR/Haulmer payments
  useEffect(() => {
    if (!qrPaymentResult?.success || !deliveryMode) return;
    const orderNum = qrPaymentResult.order?.order_number;
    if (orderNum) {
      downloadReceiptPng(orderNum, qrPaymentResult.amount);
    }
  }, [qrPaymentResult]);

  // Inactivity timer: only starts AFTER user interacts, then if idle → modal → reload
  useEffect(() => {
    if (editMode || deliveryMode) return;
    let userHasInteracted = false;
    const startInactivityTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (inactivityCountdownRef.current) clearInterval(inactivityCountdownRef.current);
      setInactivityModalOpen(false);
      setInactivityCountdown(10);
      const timeout = (store?.store?.inactivity_timeout || 120) * 1000;
      inactivityTimerRef.current = setTimeout(() => {
        setInactivityModalOpen(true);
        setInactivityCountdown(10);
        let count = 10;
        inactivityCountdownRef.current = setInterval(() => {
          count--;
          setInactivityCountdown(count);
          if (count <= 0) {
            clearInterval(inactivityCountdownRef.current);
            window.location.reload();
          }
        }, 1000);
      }, timeout);
    };
    const onUserActivity = () => {
      if (!userHasInteracted) {
        userHasInteracted = true;
      }
      if (userHasInteracted) {
        startInactivityTimer();
      }
    };
    const events = ['touchstart', 'mousedown', 'keydown', 'scroll'];
    events.forEach(e => document.addEventListener(e, onUserActivity, { passive: true }));
    // Don't start timer until user interacts
    return () => {
      events.forEach(e => document.removeEventListener(e, onUserActivity));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (inactivityCountdownRef.current) clearInterval(inactivityCountdownRef.current);
    };
  }, [editMode]);

  // Welcome/language modal disabled — just reset state after order completion
  const showWelcomeAfterOrder = () => {
    setCart([]);
    setCartOpen(false);
    setPaymentModalOpen(false);
    setCashPaymentSuccess(false);
  };

  // minimarket redirect removed — handled within the store view directly

  useEffect(() => {
    if (!selectedConfiguration) return;
    if (localStorage.getItem('srservi_accept_cash') === null) {
      setLocalAcceptCash(selectedConfiguration.accept_cash ?? false);
    }
    if (localStorage.getItem('srservi_accept_card') === null) {
      setLocalAcceptCard(selectedConfiguration.accept_card ?? false);
    }
  }, [selectedConfiguration]);

  // If only one order type is allowed, auto-select it (don't ask the user)
  useEffect(() => {
    if (!selectedConfiguration) return;
    const serveOnly = selectedConfiguration.allow_serve && !selectedConfiguration.allow_takeout;
    const takeoutOnly = !selectedConfiguration.allow_serve && selectedConfiguration.allow_takeout;
    if (serveOnly && orderType !== 'serve') setOrderType('serve');
    else if (takeoutOnly && orderType !== 'takeout') setOrderType('takeout');
  }, [selectedConfiguration]);

  useEffect(() => {
    const container = categoryRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cat = entry.target.dataset.category;
            if (cat) setActiveCategory(cat);
          }
        });
      },
      { root: container, threshold: 0.5 }
    );

    const reobserve = () => {
      const tabs = container.querySelectorAll('.category-tab');
      tabs.forEach((tab) => observer.observe(tab));
    };

    reobserve();
    const mutationObserver = new MutationObserver(reobserve);
    mutationObserver.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  // Touch drag-to-scroll en las categorías
  useEffect(() => {
    const container = categoryRef.current;
    if (!container) return;

    let startX = 0;
    let startScrollLeft = 0;
    let isDragging = false;
    let moved = false;

    const onTouchStart = (e) => {
      startX = e.touches[0].clientX;
      startScrollLeft = container.scrollLeft;
      isDragging = true;
      moved = false;
    };

    const onTouchMove = (e) => {
      if (!isDragging) return;
      const dx = startX - e.touches[0].clientX;
      if (Math.abs(dx) > 5) {
        moved = true;
        container.scrollLeft = startScrollLeft + dx;
      }
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    // Bloquear click en los tabs si fue un drag (no un tap)
    const onClickCapture = (e) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('click', onClickCapture, true);

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  // Swipe horizontal sobre el store container para cambiar categoría
  useEffect(() => {
    const el = storeContainerRef.current;
    if (!el || editMode) return;
    let startX = 0;
    let startY = 0;
    let startTime = 0;

    const onTouchStart = (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    };

    const onTouchEnd = (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      const elapsed = Date.now() - startTime;
      // Require: min 80px, clearly horizontal (2:1 ratio), within 600ms
      if (elapsed > 600 || Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2) return;

      setActiveCategory(prev => {
        const cats = ['all', ...(store?.categories || []).map(c => c.name)];
        const idx = cats.indexOf(prev);
        if (dx < 0) return cats[Math.min(idx + 1, cats.length - 1)];
        return cats[Math.max(idx - 1, 0)];
      });
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [store?.categories, editMode]);

  // Auto-scroll del tab de categoría activa al cambiar con swipe
  useEffect(() => {
    const container = categoryRef.current;
    if (!container) return;
    const activeTab = container.querySelector('.category-tab.active');
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeCategory]);

  const [paymentWaiting, setPaymentWaiting] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentCancelled, setPaymentCancelled] = useState(false);
  const [cashPaymentSuccess, setCashPaymentSuccess] = useState(false);
  const [paymentTimeLeft, setPaymentTimeLeft] = useState(60);
  const [paymentComment, setPaymentComment] = useState('');
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showCommentKb, setShowCommentKb] = useState(false);
  const [pendingCommentMethod, setPendingCommentMethod] = useState(null);
  const [pendingCommentTableNum, setPendingCommentTableNum] = useState(null);
  const skipCommentCheckRef = useRef(false);
  const [androidTuuWaiting, setAndroidTuuWaiting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [barcode, setBarcode] = useState('');
  const barcodeInputRef = useRef(null);
  const isTouchDevice = typeof window !== 'undefined' && (
    'ontouchstart' in window ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)
  );

  // Auto-advance to rating step after 10 seconds, then auto-close after 20 more seconds
  useEffect(() => {
    if (!paymentConfirmed) return;
    if (deliveryMode && lastOrderNumber) {
      downloadReceiptPng(lastOrderNumber, pendingOrderData?.order?.total);
    }
    // Record loyalty purchase
    if (loyaltyCustomer?.id) {
      fetch(`${API}/api/public/${code}/loyalty/purchase/${loyaltyCustomer.id}`, { method: 'POST' }).catch(() => {});
      setLoyaltyCustomer(null);
      loyaltyDiscountRef.current = 0;
      setLoyaltyDiscount(0);
    }
    setPaymentComment('');
    const toRatingTimer = setTimeout(() => {
      setPaymentConfirmed(false);
      setOrderRating(null);
      setOrderComment('');
      setShowRatingStep(true);
    }, 15000);
    return () => clearTimeout(toRatingTimer);
  }, [paymentConfirmed]);

  useEffect(() => {
    if (!cashPaymentSuccess) return;
    if (deliveryMode && lastOrderNumber) {
      downloadReceiptPng(lastOrderNumber, pendingOrderData?.order?.total, true);
    }
    // Record loyalty purchase
    if (loyaltyCustomer?.id) {
      fetch(`${API}/api/public/${code}/loyalty/purchase/${loyaltyCustomer.id}`, { method: 'POST' }).catch(() => {});
      setLoyaltyCustomer(null);
      loyaltyDiscountRef.current = 0;
      setLoyaltyDiscount(0);
    }
    setPaymentComment('');
    const toRatingTimer = setTimeout(() => {
      setCashPaymentSuccess(false);
      setCart([]);
      setCartOpen(false);
      setPaymentModalOpen(false);
      setOrderRating(null);
      setOrderComment('');
      setShowRatingStep(true);
    }, 15000);
    return () => clearTimeout(toRatingTimer);
  }, [cashPaymentSuccess]);

  // Auto-close rating step after 20 seconds
  useEffect(() => {
    if (!showRatingStep) return;
    const timer = setTimeout(() => {
      setShowRatingStep(false);
      setPendingOrderData(null);
      setLastOrderNumber(null);
      setOrderRating(null);
      setOrderComment('');
      showWelcomeAfterOrder();
    }, 20000);
    return () => clearTimeout(timer);
  }, [showRatingStep]);

  const downloadReceiptPng = useCallback((orderNum, total, isCash = false) => {
    const storeName = store?.store?.name || 'Tienda';
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 600, 800);

    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 12;
    ctx.strokeRect(20, 20, 560, 760);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('COMPROBANTE DE PAGO', 300, 130);

    ctx.fillStyle = '#D4AF37';
    const orderText = '#' + orderNum;
    let fontSize = 220;
    ctx.font = `bold ${fontSize}px Arial`;
    while (ctx.measureText(orderText).width > 480 && fontSize > 60) {
      fontSize -= 10;
      ctx.font = `bold ${fontSize}px Arial`;
    }
    ctx.fillText(orderText, 300, 420);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial';
    ctx.fillText(storeName, 300, 580);

    if (total) {
      ctx.font = 'bold 32px Arial';
      ctx.fillText('$' + total, 300, 640);
    }

    if (isCash) {
      // Pago en efectivo: aún no está pago, debe pagar en caja
      ctx.fillStyle = '#D4AF37';
      ctx.font = 'bold 24px Arial';
      ctx.fillText('PAGO EN EFECTIVO', 300, 695);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '20px Arial';
      ctx.fillText('Por favor pague con efectivo', 300, 730);
      ctx.fillText('justo en caja', 300, 758);
    } else {
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 22px Arial';
      ctx.fillText('PAGO CONFIRMADO', 300, 700);
    }

    const link = document.createElement('a');
    link.download = `pedido-${orderNum}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  }, [store]);

  // Fetch screensaver config (public, no auth needed)
  useEffect(() => {
    if (!code) return;
    fetch(`${API}/api/public/${code}/screensaver`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setScreensaverCfg(data); })
      .catch(() => {});
  }, [code]);

  // Screensaver timer — independent from the inactivity-reload timer
  useEffect(() => {
    if (!screensaverCfg?.enabled || !screensaverCfg?.timeout_seconds) return;
    const timeout = screensaverCfg.timeout_seconds * 1000;
    const startTimer = () => {
      clearTimeout(screensaverTimerRef.current);
      screensaverTimerRef.current = setTimeout(() => {
        setScreensaverActive(true);
        // Enter fullscreen when screensaver activates
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      }, timeout);
    };
    const onActivity = () => {
      if (screensaverActive) return; // handled by overlay click
      startTimer();
    };
    const events = ['touchstart', 'mousedown', 'keydown', 'scroll', 'mousemove'];
    events.forEach(e => document.addEventListener(e, onActivity, { passive: true }));
    startTimer();
    return () => {
      events.forEach(e => document.removeEventListener(e, onActivity));
      clearTimeout(screensaverTimerRef.current);
    };
  }, [screensaverCfg, screensaverActive]);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchStore();
    loadStoreStyles();

    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Conectado al servidor WebSocket:', socket.id);
      if (storeIdRef.current) {
        socket.emit('register_store', storeIdRef.current);
      }
      socket.emit('presence_join', { store_code: code, panel: 'store' });
    });

    socket.on('reconnect', () => {
      console.log('Reconectado al servidor WebSocket:', socket.id);
      if (storeIdRef.current) {
        socket.emit('register_store', storeIdRef.current);
      }
      socket.emit('presence_join', { store_code: code, panel: 'store' });
    });

    socket.on('product_created', (product) => {
      console.log('Producto creado en tiempo real:', product);
      setStore(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          products: [...prev.products, product]
        };
      });
    });

    socket.on('product_updated', (product) => {
      console.log('Producto actualizado en tiempo real:', product);
      setStore(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          products: prev.products.map(p => p.id === product.id ? product : p)
        };
      });
    });

    socket.on('product_deleted', (data) => {
      console.log('Producto eliminado en tiempo real:', data);
      setStore(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          products: prev.products.filter(p => p.id !== data.id)
        };
      });
    });

    socket.on('new_order', (order) => {
      setLiveOrders(prev => [order, ...prev].slice(0, 30));
      setNewOrderCount(prev => prev + 1);
    });

    socket.on('category_created', () => fetchStore());
    socket.on('category_updated', () => fetchStore());
    socket.on('category_deleted', () => fetchStore());
    socket.on('ingredient_created', () => fetchStore());
    socket.on('ingredient_updated', () => fetchStore());
    socket.on('ingredient_deleted', () => fetchStore());
    socket.on('extra_created', () => fetchStore());
    socket.on('extra_updated', () => fetchStore());
    socket.on('extra_deleted', () => fetchStore());
    socket.on('inventory_updated', (data) => {
      console.log('Inventario actualizado en tiempo real:', data);
      setStore(prev => {
        if (!prev) return prev;
        const updatedProducts = prev.products.map(product => {
          if (product.id === data.product_id) {
            return {
              ...product,
              stock: data.stock !== undefined ? data.stock : product.stock,
              unlimited_stock: data.unlimited_stock !== undefined ? data.unlimited_stock : product.unlimited_stock
            };
          }
          if (product.ingredients) {
            product.ingredients = product.ingredients.map(ing => {
              if (ing.id === data.product_id) {
                return {
                  ...ing,
                  stock: data.stock !== undefined ? data.stock : ing.stock,
                  unlimited_stock: data.unlimited_stock !== undefined ? data.unlimited_stock : ing.unlimited_stock
                };
              }
              return ing;
            });
          }
          if (product.extras) {
            product.extras = product.extras.map(ext => {
              if (ext.id === data.product_id) {
                return {
                  ...ext,
                  stock: data.stock !== undefined ? data.stock : ext.stock,
                  unlimited_stock: data.unlimited_stock !== undefined ? data.unlimited_stock : ext.unlimited_stock
                };
              }
              return ext;
            });
          }
          return product;
        });
        return { ...prev, products: updatedProducts };
      });
    });

    socket.on('qr_payment_completed', (data) => {
      if (data.order_id && pendingOrderDataRef?.current?.order?.id === data.order_id) {
        setPaymentWaiting(false); setQrPaymentUrl(null);
        setPaymentConfirmed(true);
        setLastOrderNumber(data.order_number || pendingOrderDataRef.current.order.order_number);
        setCart([]);
        setCartOpen(false);
      }
    });

    socket.on('tuu_payment_update', (data) => {
      if (data.orderId && pendingOrderDataRef?.current?.order?.id === data.orderId) {
        if (data.status === 'Completed') {
          setPaymentWaiting(false); setQrPaymentUrl(null); setTuuPaymentKey(null);
          setPaymentConfirmed(true);
          setLastOrderNumber(data.order_number || pendingOrderDataRef.current.order.order_number || null);
          setCart([]);
          setCartOpen(false);
        } else if (['Canceled', 'Failed', 'Timeout'].includes(data.status)) {
          setPaymentWaiting(false); setQrPaymentUrl(null); setTuuPaymentKey(null);
          setPaymentCancelled(true);
        }
      }
    });

    socket.on('square_payment_update', (data) => {
      if (data.orderId && pendingOrderDataRef?.current?.order?.id === data.orderId) {
        if (data.status === 'Completed') {
          setPaymentWaiting(false); setQrPaymentUrl(null); setSquarePaymentKey(null);
          setPaymentConfirmed(true);
          setLastOrderNumber(pendingOrderDataRef.current.order.order_number || null);
          setCart([]);
          setCartOpen(false);
        } else if (['Canceled', 'Timeout'].includes(data.status)) {
          setPaymentWaiting(false); setQrPaymentUrl(null); setSquarePaymentKey(null);
          setPaymentCancelled(true);
        }
      }
    });

    socket.on('totem_restart', (data) => {
      console.log('totem_restart received:', data, 'myStore:', storeIdRef.current, 'editMode:', editModeRef.current);
      // Only restart if this client is NOT in edit mode and the store matches
      if (!editModeRef.current && storeIdRef.current && String(data.store_id) === String(storeIdRef.current)) {
        // Clear the pending_restart DB flag so the page-load check and polling don't trigger a second restart
        fetch(`/api/public/device-config/${localStorage.getItem('srservi_device_uid')}/${storeIdRef.current}`, { cache: 'no-store' }).catch(() => {});
        showRestartNotification(5);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code, terminalFromUrl]);

  useEffect(() => {
    if (store?.store?.id && socketRef.current?.connected) {
      socketRef.current.emit('register_store', store.store.id);
    }
  }, [store?.store?.id]);

  // Poll pending_restart every 10 seconds so clients restart in real-time even if the socket event is missed
  useEffect(() => {
    if (!store?.store?.id) return;
    const storeId = store.store.id;
    const poll = setInterval(async () => {
      if (editModeRef.current) return; // never restart while in edit mode
      try {
        const res = await fetch(`/api/public/device-config/${deviceUid}/${storeId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const dc = await res.json();
        if (dc.pending_restart) {
          const delay = parseInt(dc.restart_time) || 5;
          showRestartNotification(delay);
        }
      } catch { /* ignore */ }
    }, 10000);
    return () => clearInterval(poll);
  }, [store?.store?.id]);

  useEffect(() => {
    if (!store?.store?.id) return;
    const storeId = store.store.id;
    const checkCaja = async () => {
      try {
        const res = await fetch(`/api/cash-register/status/${storeId}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setCashRegisterOpen(!!data.open);
        }
      } catch { /* ignore */ }
    };
    const interval = setInterval(checkCaja, 5000);
    return () => clearInterval(interval);
  }, [store?.store?.id]);

  const openCashFromStore = async () => {
    setStoreOpeningLoading(true);
    setStoreOpeningError('');
    const token = localStorage.getItem('workerToken') || localStorage.getItem('token') || adminToken;
    if (!token) { setStoreOpeningError('Iniciá sesión como vendedor primero'); setStoreOpeningLoading(false); return; }
    try {
      const res = await fetch('/api/cash-register/open', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ opening_amount: parseFloat(storeOpeningAmount) || 0 })
      });
      const data = await res.json();
      if (!res.ok) { setStoreOpeningError(data.error || 'Error al abrir caja'); return; }
      setCashRegisterOpen(true);
      setStoreOpeningAmount('');
    } catch { setStoreOpeningError('Error de conexión'); }
    finally { setStoreOpeningLoading(false); }
  };

  const fetchStore = async () => {
    try {
      const response = await fetch(`/api/public/${code}`, { cache: 'no-store' });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Código no encontrado');
        }
        if (response.status === 403) {
          const data = await response.json();
          throw new Error(data.error || 'Tienda suspendida');
        }
        throw new Error('Error al cargar la tienda');
      }

      const data = await response.json();
      const uniqueProducts = (data.products || []).filter((product, index, self) =>
        index === self.findIndex((p) => p.id === product.id)
      );
      const uniqueCategories = (data.categories || []).filter((cat, index, self) =>
        index === self.findIndex((c) => c.id === cat.id)
      );
      const uniqueIngredients = (data.ingredients || []).filter((ing, index, self) =>
        index === self.findIndex((i) => i.id === ing.id)
      );
      const uniqueExtras = (data.extras || []).filter((ext, index, self) =>
        index === self.findIndex((e) => e.id === ext.id)
      );
      const deduplicatedData = {
        ...data,
        products: uniqueProducts,
        categories: uniqueCategories,
        ingredients: uniqueIngredients,
        extras: uniqueExtras
      };
      console.log('Store data received:', deduplicatedData);
      console.log('Number of products:', deduplicatedData.products?.length || 0);
      setStore(deduplicatedData);
      setCashRegisterOpen(data.cash_register_open !== false);
      if (data.top_selling) setTopSellingIds(data.top_selling);

      // Tiempo promedio de preparación por producto
      fetch(`/api/public/${code}/prep-times`)
        .then(r => r.ok ? r.json() : {})
        .then(d => setPrepTimes(d || {}))
        .catch(() => {});

      // Fetch loyalty config (solo config, sin descargar modelos)
      fetch(`/api/public/${code}/loyalty`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.config) setLoyaltyConfig(d.config); })
        .catch(() => {});

      // Welcome/language modal disabled — no longer shown on page load

      const terminalsResponse = await fetch(`/api/public/${code}/pos-terminals`);
      if (terminalsResponse.ok) {
        const terminalsData = await terminalsResponse.json();
        const safeTerminals = Array.isArray(terminalsData) ? terminalsData : [];
        // Only MP terminals are relevant for the POS selector in the store
        const mpTerminals = safeTerminals.filter(t => t.provider === 'mercadopago');
        setAvailableTerminals(mpTerminals);
        const hasTerminalFromUrl = terminalFromUrl && safeTerminals.some(terminal => String(terminal.id) === String(terminalFromUrl));
        const savedProvider = localStorage.getItem('srservi_last_terminal_provider') || '';
        const savedTerminalId = localStorage.getItem('srservi_last_terminal_id') || '';
        setSelectedTerminalId(prev => {
          if (hasTerminalFromUrl) return String(terminalFromUrl);
          if (prev && safeTerminals.some(terminal => String(terminal.id) === String(prev))) return prev;
          if (savedProvider && savedProvider !== 'mercadopago' && savedTerminalId) return savedTerminalId;
          return mpTerminals[0]?.id ? String(mpTerminals[0].id) : '';
        });
      } else {
        setAvailableTerminals([]);
        const savedProvider = localStorage.getItem('srservi_last_terminal_provider') || '';
        if (!savedProvider || savedProvider === 'mercadopago') {
          setSelectedTerminalId('');
        }
      }

      let configsData = [];
      const configsResponse = await fetch(`/api/public/store-configurations/${data.store.id}`);
      if (configsResponse.ok) {
        configsData = await configsResponse.json();
        setConfigurations(configsData);

        if (configFromUrl) {
          const urlConfig = configsData.find(c => String(c.id) === String(configFromUrl));
          setSelectedConfiguration(urlConfig || null);
        } else {
          const defaultConfig = configsData.find(c => c.is_default) || configsData[0];
          setSelectedConfiguration(defaultConfig || null);
        }
      } else {
        setConfigurations([]);
        setSelectedConfiguration(null);
      }

      // Auto-enter edit mode if admin token
      if (adminEditToken) {
        try {
          const localToken = localStorage.getItem('token');
          if (!localToken || localToken !== adminEditToken) {
            // Token in URL doesn't match local session — strip it and redirect to login
            window.location.href = '/login';
            return;
          }
          const vRes = await fetch(`/api/public/${code}/validate-admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: adminEditToken })
          });
          const vData = await vRes.json();
          if (vData.valid) {
            setAdminToken(adminEditToken);
            setEditMode(true);
            setSessionPin('admin');
          }
        } catch { /* ignore */ }
      }

      // Register this device
      fetch(`/api/public/${code}/register-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_uid: deviceUid })
      }).catch(() => {});

      // Load device-specific config
      try {
        const dcRes = await fetch(`/api/public/device-config/${deviceUid}/${data.store.id}`);
        if (dcRes.ok) {
          const dc = await dcRes.json();
          // Apply assigned configuration
          if (dc.config_id && configsData) {
            const assigned = configsData.find(c => c.id === dc.config_id);
            if (assigned) setSelectedConfiguration(assigned);
          }
          // Pending restart (admin changed config)
          if (dc.pending_restart) {
            const delay = parseInt(dc.restart_time) || 10;
            showRestartNotification(delay);
          }
        }
      } catch { /* ignore */ }

      // Check if TUU POS is available (native)
      try {
        const lastTerminalId = localStorage.getItem('srservi_last_terminal_id') || '';
        const lastTerminalProvider = localStorage.getItem('srservi_last_terminal_provider') || '';
        if (!lastTerminalProvider || lastTerminalProvider === 'tuu' || deliveryMode) {
          const tuuRes = await fetch(`/api/tuu/provider?store_id=${data.store.id}&device_uid=${deviceUid}&terminal_id=${lastTerminalId}`);
          const tuuData = await tuuRes.json();
          if (tuuData.available) {
            setTuuProvider(tuuData);
            console.log('[Store] TUU provider SET:', tuuData);
          }
        }
      } catch (e) { console.error('[Store] TUU provider error:', e); }

      // Check native Haulmer availability
      try {
        const haulmerRes = await fetch(`/api/haulmer/available?store_id=${data.store.id}`);
        if (haulmerRes.ok) {
          const haulmerData = await haulmerRes.json();
          if (haulmerData.available) setHaulmerNative(true);
        }
      } catch { /* ignore */ }

      // Check QR provider availability (plugin fallback)
      try {
        const qrRes = await fetch(`/api/plugins/qr/provider?store_id=${data.store.id}`);
        if (qrRes.ok) {
          const qrData = await qrRes.json();
          if (qrData.available) setQrProvider(qrData);
        }
      } catch { /* no qr provider, ignore */ }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const colors = store?.store ? {
    primary: store.store.primary_color || '#000000',
    secondary: store.store.secondary_color || '#FFFFFF',
    accent: store.store.accent_color || '#D4AF37',
    header: store.store.header_color || '#000000',
    currency: {
      symbol: store.store.currency_symbol || '$',
      code: store.store.currency_code || 'USD',
      name: store.store.currency_name || 'Dólar Estadounidense'
    }
  } : {
    primary: '#000000',
    secondary: '#FFFFFF',
    accent: '#D4AF37',
    header: '#000000',
    currency: {
      symbol: '$',
      code: 'USD',
      name: 'Dólar Estadounidense'
    }
  };

  // Custom labels for the product personalization steps (admin-configurable)
  const complementsLabel = (store?.store?.complements_label || '').trim() || t('complements', lang);
  const extrasLabel = (store?.store?.extras_label || '').trim() || t('extras', lang);

  const openProductModal = (product) => {
    if (!product.unlimited_stock && product.stock === 0) {
      setNotification({ name: product.name, agotado: true });
      setTimeout(() => setNotification(null), 2000);
      return;
    }
    selectedProductRef.current = product;
    setSelectedProduct(product);
    setProductConfig({
      // Ingredientes base (incluidos por defecto) parten seleccionados; quitarlos = "Sin X"
      selectedIngredients: (product.ingredients || []).filter(i => i.included_by_default),
      selectedExtras: [],
      selectedComplements: [],
      quantity: 1,
      notes: ''
    });

    const hasIngredients = product.has_ingredients && product.ingredients && product.ingredients.length > 0;
    const hasExtras = product.has_extras && product.extras && product.extras.length > 0;
    const hasGroups = Array.isArray(product.complement_groups) && product.complement_groups.length > 0;

    if (hasIngredients) {
      setProductModalStep('complements');
      setTimeout(() => setIngredientsModalOpen(true), 100);
    } else if (hasExtras) {
      setProductModalStep('extras');
      setTimeout(() => setExtrasModalOpen(true), 100);
    } else if (hasGroups) {
      setProductModalStep('groups');
      setTimeout(() => setComplementGroupsModalOpen(true), 100);
    } else {
      setProductModalStep('main');
      setTimeout(() => addToCartRef(), 100);
    }
  };

  const closeProductModal = () => {
    selectedProductRef.current = null;
    setSelectedProduct(null);
    setProductModalStep('main');
    setAddingToCart(false);
    setIngredientsModalOpen(false);
    setExtrasModalOpen(false);
    setComplementGroupsModalOpen(false);
    setProductConfig({ selectedIngredients: [], selectedExtras: [], selectedComplements: [], quantity: 1, notes: '' });
  };

  const anyModalOpen = pinModalOpen || prodModalOpen || catModalOpen || complementModal || showRestartConfirm || editMode || ingredientsModalOpen || extrasModalOpen || complementGroupsModalOpen || paymentModalOpen || cartOpen || paymentConfirmed || cashPaymentSuccess || pinOptionsModalOpen || posSelectModalOpen || infoModalOpen || inactivityModalOpen || tableModalOpen || showRatingStep || !!editComplementModal || !!prodRecipeModal || !!labelEditModal || !!sectionGroupModal || !!sectionOptionModal || !!sectionEditingGroup || loyaltyModalOpen;

  useEffect(() => {
    anyModalOpenRef.current = anyModalOpen;
    if (anyModalOpen && longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, [anyModalOpen]);

  useEffect(() => {
    if (isTouchDevice) return;
    if (anyModalOpen) return;
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus({ preventScroll: true });
    }
    const interval = setInterval(() => {
      if (anyModalOpen) return;
      if (barcodeInputRef.current && document.activeElement !== barcodeInputRef.current) {
        barcodeInputRef.current.focus({ preventScroll: true });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [anyModalOpen, isTouchDevice]);

  // Global Bluetooth / USB-HID barcode scanner listener.
  // Works on tablets too (where the old auto-focus input path is skipped).
  // Heuristic: rapid keyboard input (<50 ms between keys) followed by Enter
  // is treated as a scanner read, not as the user typing. Input is ignored
  // when the focus is already on a text field (so admin editing isn't hijacked).
  useEffect(() => {
    if (anyModalOpen) return;
    // On non-touch devices the dedicated hidden input handles scanning — skip
    if (!isTouchDevice) return;
    let buffer = '';
    let lastTime = 0;
    const handleKey = (e) => {
      const active = document.activeElement;
      const tag = active?.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || active?.isContentEditable;
      if (isEditable) return;

      const now = Date.now();
      const gap = now - lastTime;
      lastTime = now;

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          handleBarcodeScan(buffer);
        }
        buffer = '';
        return;
      }
      // Reset buffer if gap too long (user typing manually)
      if (gap > 120) buffer = '';
      if (e.key.length === 1) buffer += e.key;
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [anyModalOpen, isTouchDevice, store]);

  const handleBarcodeScan = (barcodeValue) => {
    if (!store?.products) return;
    const found = store.products.find(p => p.barcode === barcodeValue);
    if (found) {
      if (!found.unlimited_stock && found.stock === 0) {
        setNotification({ name: found.name, agotado: true });
        setTimeout(() => setNotification(null), 2000);
        return;
      }
      setNotification({ name: found.name, image: found.image });
      setTimeout(() => setNotification(null), 2000);
      const unitPrice = found.price;
      setCart(prev => {
        const existingIndex = prev.findIndex(item => item.product_id === found.id);
        if (existingIndex !== -1) {
          return prev.map((item, idx) =>
            idx === existingIndex
              ? { ...item, quantity: item.quantity + 1, total: item.unit_price * (item.quantity + 1) }
              : item
          );
        }
        const cartItem = {
          id: Date.now(),
          product_id: found.id,
          product_name: found.name,
          product_image: found.image,
          unit_price: unitPrice,
          quantity: 1,
          total: unitPrice
        };
        return [...prev, cartItem];
      });
    } else if (barcodeValue.length > 0) {
      setNotification({ name: 'Producto no encontrado', image: null });
      setTimeout(() => setNotification(null), 2000);
    }
  };

  const toggleIngredient = (ingredient) => {
    const isOutOfStock = !ingredient.unlimited_stock && ingredient.stock === 0;
    if (isOutOfStock) {
      return;
    }
    setProductConfig(prev => {
      const exists = prev.selectedIngredients.find(i => i.id === ingredient.id);
      if (exists) {
        return {
          ...prev,
          selectedIngredients: prev.selectedIngredients.filter(i => i.id !== ingredient.id)
        };
      } else {
        const maxIngredients = parseInt(selectedProduct.max_ingredients) || 0;
        if (maxIngredients > 0 && prev.selectedIngredients.length >= maxIngredients) {
          alert(`${t('maxComplements', lang)} ${maxIngredients} ${t('complementWord', lang)}`);
          return prev;
        }
        return {
          ...prev,
          selectedIngredients: [...prev.selectedIngredients, ingredient]
        };
      }
    });
  };

  const toggleExtra = (extra) => {
    const isOutOfStock = !extra.unlimited_stock && extra.stock === 0;
    if (isOutOfStock) {
      return;
    }
    setProductConfig(prev => {
      const exists = prev.selectedExtras.find(e => e.id === extra.id);
      if (exists) {
        return {
          ...prev,
          selectedExtras: prev.selectedExtras.filter(e => e.id !== extra.id)
        };
      } else {
        const maxExtras = parseInt(selectedProduct.max_extras) || 0;
        if (maxExtras > 0 && prev.selectedExtras.length >= maxExtras) {
          alert(`${t('maxComplements', lang)} ${maxExtras} ${t('extraWord', lang)}`);
          return prev;
        }
        return {
          ...prev,
          selectedExtras: [...prev.selectedExtras, extra]
        };
      }
    });
  };

  const calculateProductPrice = () => {
    if (!selectedProduct) return 0;

    let price = selectedProduct.price;

    productConfig.selectedIngredients.forEach(ing => {
      // Los ingredientes base (incluidos por defecto) no se cobran
      if (!ing.included_by_default) price += ing.price || 0;
    });

    productConfig.selectedExtras.forEach(extra => {
      price += extra.price || 0;
    });

    (productConfig.selectedComplements || []).forEach(sel => {
      price += sel.price || 0;
    });

    return price;
  };

  const addToCart = () => {
    if (!selectedProduct) return;

    setIngredientsModalOpen(false);
    setExtrasModalOpen(false);
    setComplementGroupsModalOpen(false);

    const unitPrice = calculateProductPrice();
    const baseIngredients = (selectedProduct.ingredients || []).filter(i => i.included_by_default);
    const selectedIds = new Set(productConfig.selectedIngredients.map(i => i.id));
    const removed = baseIngredients.filter(i => !selectedIds.has(i.id)).map(i => `Sin ${i.name}`);
    const added = productConfig.selectedIngredients.filter(i => !i.included_by_default).map(i => i.name);
    const cartItem = {
      id: Date.now(),
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      product_image: selectedProduct.image,
      unit_price: unitPrice,
      quantity: productConfig.quantity,
      total: unitPrice * productConfig.quantity,
      selected_ingredients: [...removed, ...added],
      selected_extras: productConfig.selectedExtras.map(e => e.name),
      selected_complements: productConfig.selectedComplements || []
    };

    setCart([...cart, cartItem]);
    setNotification({ name: selectedProduct.name, image: selectedProduct.image });
    setProductModalStep('main');
    closeProductModal();
    setTimeout(() => setNotification(null), 1500);
  };

  // Ref-based version for use inside setTimeout callbacks where state closures are stale
  const addToCartRef = () => {
    const product = selectedProductRef.current;
    if (!product) return;

    setIngredientsModalOpen(false);
    setExtrasModalOpen(false);

    const unitPrice = Number(product.price);
    const cartItem = {
      id: Date.now(),
      product_id: product.id,
      product_name: product.name,
      product_image: product.image,
      unit_price: unitPrice,
      quantity: 1,
      total: unitPrice,
      selected_ingredients: [],
      selected_extras: [],
      selected_complements: []
    };

    setCart(prev => [...prev, cartItem]);
    setNotification({ name: product.name, image: product.image });
    setProductModalStep('main');
    selectedProductRef.current = null;
    setSelectedProduct(null);
    setAddingToCart(false);
    setTimeout(() => setNotification(null), 1500);
  };

  const handleNextToExtras = () => {
    const requiredIngredients = selectedProduct.ingredients.filter(ing => ing.is_required);
    const missingRequired = requiredIngredients.filter(req =>
      !productConfig.selectedIngredients.some(sel => sel.id === req.id)
    );

    if (missingRequired.length > 0) {
      alert(`${t('selectRequired', lang)}\n${missingRequired.map(i => '- ' + i.name).join('\n')}`);
      return;
    }
    setIngredientsModalOpen(false);

    if (selectedProduct.has_extras && selectedProduct.extras && selectedProduct.extras.length > 0) {
      setProductModalStep('extras');
      setTimeout(() => setExtrasModalOpen(true), 100);
    } else {
      proceedAfterExtras();
    }
  };

  // Después de Extras: si el producto tiene secciones personalizadas, mostrarlas; si no, al carrito
  const proceedAfterExtras = () => {
    setExtrasModalOpen(false);
    const hasGroups = Array.isArray(selectedProduct?.complement_groups) && selectedProduct.complement_groups.length > 0;
    if (hasGroups) {
      setProductModalStep('groups');
      setTimeout(() => setComplementGroupsModalOpen(true), 100);
    } else {
      setTimeout(() => addToCart(), 100);
    }
  };

  // Validación de reglas (mín/obligatorio) de las secciones personalizadas antes de agregar
  const finishGroupsStep = () => {
    const groups = selectedProduct?.complement_groups || [];
    for (const g of groups) {
      const count = (productConfig.selectedComplements || []).filter(s => s.group_id === g.id).length;
      const min = g.required ? Math.max(1, g.min_select || 0) : (g.min_select || 0);
      if (count < min) {
        alert(`Elegí al menos ${min} en "${g.name}".`);
        return;
      }
    }
    setComplementGroupsModalOpen(false);
    setTimeout(() => addToCart(), 100);
  };

  // Alterna una opción de una sección respetando el máximo del grupo
  const toggleComplementOption = (group, option) => {
    setProductConfig(prev => {
      const list = prev.selectedComplements || [];
      const exists = list.some(s => s.option_id === option.id);
      if (exists) {
        return { ...prev, selectedComplements: list.filter(s => s.option_id !== option.id) };
      }
      const inGroup = list.filter(s => s.group_id === group.id);
      // max_select 0 = sin límite
      if (group.max_select > 0 && inGroup.length >= group.max_select) {
        if (group.max_select === 1) {
          // reemplazar la selección previa del grupo
          const without = list.filter(s => s.group_id !== group.id);
          return { ...prev, selectedComplements: [...without, { group_id: group.id, group_name: group.name, option_id: option.id, name: option.name, price: Number(option.price) || 0 }] };
        }
        return prev; // alcanzó el máximo
      }
      return { ...prev, selectedComplements: [...list, { group_id: group.id, group_name: group.name, option_id: option.id, name: option.name, price: Number(option.price) || 0 }] };
    });
  };

  const handleBackToMain = () => {
    setIngredientsModalOpen(false);
    setExtrasModalOpen(false);
    setProductModalStep('main');
  };

  const handleBackToComplements = () => {
    setExtrasModalOpen(false);
    setProductModalStep('complements');
    setTimeout(() => setIngredientsModalOpen(true), 100);
  };

  const updateQuantity = (itemId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQuantity = item.quantity + delta;
        if (newQuantity > 0) {
          return {
            ...item,
            quantity: newQuantity,
            total: Number(item.unit_price) * newQuantity
          };
        }
      }
      return item;
    }));
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const openComboModal = (combo) => {
    const itemConfigs = (combo.items || []).map(it => ({
      product_id: it.product_id,
      product_name: it.product_name,
      product_image: it.product_image,
      quantity: it.quantity,
      product_price: it.product_price,
      selected_ingredients: [],
      selected_extras: [],
      selected_complements: [],
      ingredients: it.ingredients || [],
      extras: it.extras || [],
      complement_groups: it.complement_groups || []
    }));
    setComboModal({ combo, itemConfigs });
    setComboQty(1);
  };

  const updateComboItemConfig = (productId, field, value) => {
    setComboModal(prev => ({
      ...prev,
      itemConfigs: prev.itemConfigs.map(ic =>
        String(ic.product_id) === String(productId) ? { ...ic, [field]: value } : ic
      )
    }));
  };

  const addComboToCart = () => {
    if (!comboModal) return;
    const { combo, itemConfigs } = comboModal;
    const autoPrice = combo.auto_price || (combo.items || []).reduce((s, it) => s + it.product_price * it.quantity, 0);
    const comboPrice = combo.price;
    const _comboConfig = itemConfigs.map(ic => ({
      product_id: ic.product_id,
      product_name: ic.product_name,
      quantity: ic.quantity,
      unit_price: autoPrice > 0 ? ic.product_price * comboPrice / autoPrice : 0,
      selected_ingredients: ic.selected_ingredients,
      selected_extras: ic.selected_extras,
      selected_complements: ic.selected_complements
    }));
    const cartItem = {
      id: Date.now() + Math.random(),
      _isCombo: true,
      combo_id: combo.id,
      combo_label: combo.name,
      product_name: combo.name,
      product_image: combo.image,
      quantity: comboQty,
      unit_price: comboPrice,
      total: comboPrice * comboQty,
      _comboConfig,
      selected_ingredients: [],
      selected_extras: [],
      selected_complements: []
    };
    setCart(prev => [...prev, cartItem]);
    setComboModal(null);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.unit_price * item.quantity), 0);
  };

  const getTipAmount = () => {
    if (!tipEnabled || !tipPercent) return 0;
    const subtotal = getCartTotal();
    const discount = Number(appliedCoupon?.discount_total || 0);
    return Math.max(subtotal - discount, 0) * (tipPercent / 100);
  };

  const getLoyaltyDiscountAmount = () => {
    const disc = loyaltyDiscountRef.current;
    if (!disc) return 0;
    const subtotal = getCartTotal();
    const couponDiscount = Number(appliedCoupon?.discount_total || 0);
    return Math.round(Math.max(subtotal - couponDiscount, 0) * disc / 100);
  };

  const getCartSubtotal = () => {
    const subtotal = getCartTotal();
    const couponDiscount = Number(appliedCoupon?.discount_total || 0);
    const loyalDiscountAmt = getLoyaltyDiscountAmount();
    return Math.max(subtotal - couponDiscount - loyalDiscountAmt, 0);
  };

  const SQUARE_COMMISSION_RATE = 0.086;

  const getSquareCommission = () => {
    if (selectedTerminalProvider !== 'square') return 0;
    return (getCartSubtotal() + getTipAmount()) * SQUARE_COMMISSION_RATE;
  };

  const getFinalTotal = () => {
    const base = getCartSubtotal() + getTipAmount();
    return base + getSquareCommission();
  };

  const getCartCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    alert(t('qrCodeCopied', lang) + ' ' + code);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCartOpen(false);

    // Si solo hay un método de pago activo, ir directo sin propina
    if (!deliveryMode) {
      const methodCount = [localAcceptCard, localAcceptCash].filter(Boolean).length;
      if (methodCount === 1) {
        setTipEnabled(false);
        setTipPercent(0);
        const singleMethod = localAcceptCard ? 'card' : 'cash';
        if (loyaltyConfig?.enabled && !loyaltyCustomer && loyaltyDiscount === 0) {
          setLoyaltyModalOpen(true);
          setPendingPaymentMethod(singleMethod);
        } else {
          handlePaymentMethodSelect(singleMethod);
        }
        return;
      }
    }

    // Más de un método → mostrar modal con propina configurada
    const configTip = parseFloat(selectedConfiguration?.tip_percentage) || 0;
    setTipPercent(configTip);
    setTipEnabled(configTip > 0);

    if (!deliveryMode && loyaltyConfig?.enabled && !loyaltyCustomer && loyaltyDiscount === 0) {
      setLoyaltyModalOpen(true);
    } else {
      setPaymentModalOpen(true);
    }
  };

  const applyCoupon = async () => {
    if (!couponCodeInput.trim() || cart.length === 0) return;
    try {
      setCouponLoading(true);
      const response = await fetch(`/api/public/${code}/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupon_code: couponCodeInput.trim(),
          subtotal: getCartTotal()
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo aplicar el cupón');
      }
      setAppliedCoupon(data);
      setCouponCodeInput(data.coupon_code || couponCodeInput.trim().toUpperCase());
    } catch (err) {
      alert(err.message);
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput('');
  };

  const handlePaymentMethodSelect = (method) => {
    if (selectedConfiguration?.allow_table_service) {
      setPendingPaymentMethod(method);
      setTableNumber('');
      setTableModalOpen(true);
      setPaymentModalOpen(false);
    } else {
      processPayment(method);
    }
  };

  const processPayment = async (selectedMethod = paymentMethod, tableNum = null) => {
    if (cart.length === 0) return;

    if (selectedConfiguration?.require_order_comment && !skipCommentCheckRef.current) {
      setPendingCommentMethod(selectedMethod);
      setPendingCommentTableNum(tableNum);
      setPaymentComment('');
      setShowCommentModal(true);
      return;
    }
    skipCommentCheckRef.current = false;

    const lastTerminalProvider = localStorage.getItem('srservi_last_terminal_provider') || '';
    const isTuu = selectedMethod === 'card' && lastTerminalProvider === 'tuu';
    const isSquare = selectedMethod === 'card' && lastTerminalProvider === 'square';
    if (selectedMethod === 'card' && !isTuu && !isSquare && !selectedTerminalId) {
      alert(t('noTerminalAssigned', lang));
      return;
    }

    setLastTableNumber(tableNum ? parseInt(tableNum) : null);
    setPaymentMethod(selectedMethod);
    setProcessingPayment(true);
    setPaymentError(null);
    setPaymentConfirmed(false);
    setPaymentCancelled(false);

    const finalTotal = getFinalTotal();
    const storeId = store.store.id;
    const cartItems = cart.flatMap(item => {
      if (item._isCombo) {
        return (item._comboConfig || []).map(ci => ({
          product_id: ci.product_id,
          quantity: ci.quantity * item.quantity,
          unit_price: ci.unit_price,
          selected_ingredients: ci.selected_ingredients || [],
          selected_extras: ci.selected_extras || [],
          selected_complements: ci.selected_complements || [],
          combo_id: item.combo_id,
          combo_label: item.combo_label
        }));
      }
      return [{
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        selected_ingredients: item.selected_ingredients,
        selected_extras: item.selected_extras,
        selected_complements: item.selected_complements || []
      }];
    });

    try {
      // --- TUU POS nativo ---
      if (isTuu) {
        const orderRes = await fetch(API + '/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId, order_type: orderType, payment_method: 'card',
            items: cartItems, coupon_code: appliedCoupon?.coupon_code || null,
            total: Number(finalTotal).toFixed(2), delivery: deliveryMode,
            table_number: tableNum ? parseInt(tableNum) : null,
            terminal_id: selectedTerminalId ? parseInt(selectedTerminalId) : null,
            customer_comment: paymentComment || null
          })
        });
        if (!orderRes.ok) throw new Error((await orderRes.json()).error || 'Error al crear pedido');
        const order = await orderRes.json();
        setPendingOrderData({ order, storeId });

        const chargeRes = await fetch('/api/tuu/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId, order_id: order.id,
            amount: Math.round(Number(finalTotal)),
            description: `Pedido #${order.order_number || order.id}`,
            device_uid: tuuProvider?.deviceUid || deviceUid,
            terminal_id: localStorage.getItem('srservi_last_terminal_id') || null,
            tip_amount: Math.round(getTipAmount()),
            tip_percent: tipPercent
          })
        });
        const chargeData = await chargeRes.json();
        if (!chargeData.success) throw new Error(chargeData.error || 'Error al enviar cobro al POS');

        setTuuPaymentKey(chargeData.paymentKey);
        setPaymentWaiting(true);
        setPaymentTimeLeft(300);

      // --- Square Terminal ---
      } else if (isSquare) {
        const orderRes = await fetch(API + '/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId, order_type: orderType, payment_method: 'card',
            items: cartItems, coupon_code: appliedCoupon?.coupon_code || null,
            total: Number(finalTotal).toFixed(2), delivery: deliveryMode,
            table_number: tableNum ? parseInt(tableNum) : null,
            terminal_id: selectedTerminalId ? parseInt(selectedTerminalId) : null,
            customer_comment: paymentComment || null
          })
        });
        if (!orderRes.ok) throw new Error((await orderRes.json()).error || 'Error al crear pedido');
        const order = await orderRes.json();
        setPendingOrderData({ order, storeId });

        const chargeRes = await fetch(API + '/api/plugins/payments/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId, order_id: order.id,
            amount: Number(finalTotal),
            description: `Pedido #${order.order_number || order.id}`,
            terminal_id: selectedTerminalId ? parseInt(selectedTerminalId) : null,
            terminal_provider: 'square'
          })
        });
        const chargeData = await chargeRes.json();
        if (!chargeData.success) throw new Error(chargeData.error || 'Error al enviar cobro al terminal Square');

        setSquarePaymentKey(chargeData.paymentKey);
        setPaymentWaiting(true);
        setPaymentTimeLeft(300);

      // --- MercadoPago card ---
      } else if (selectedMethod === 'card') {
        const response = await fetch(API + '/api/orders/process-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId, order_type: orderType, payment_method: selectedMethod,
            items: cartItems, selected_terminal_id: selectedTerminalId ? parseInt(selectedTerminalId) : null,
            coupon_code: appliedCoupon?.coupon_code || null, total: Number(finalTotal).toFixed(2), delivery: deliveryMode,
            table_number: tableNum ? parseInt(tableNum) : null, customer_comment: paymentComment || null
          })
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Error al procesar');
        const result = await response.json();
        setPendingOrderData({ order: result.order || result, storeId });
        setPaymentWaiting(true);
        setPaymentTimeLeft(60);

      // --- MercadoPago card terminal (delivery, explicit MP) ---
      } else if (selectedMethod === 'mp_checkout') {
        const orderRes = await fetch(API + '/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId, order_type: orderType, payment_method: 'card',
            items: cartItems, coupon_code: appliedCoupon?.coupon_code || null,
            total: Number(finalTotal).toFixed(2), delivery: deliveryMode,
            table_number: tableNum ? parseInt(tableNum) : null, customer_comment: paymentComment || null
          })
        });
        if (!orderRes.ok) throw new Error((await orderRes.json()).error || 'Error al crear pedido');
        const order = await orderRes.json();
        setPendingOrderData({ order, storeId });

        const prefRes = await fetch(`/api/store/${code}/qr-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: order.id,
            amount: Math.round(Number(finalTotal)),
            description: `Pedido ${store.store.name || code}`
          })
        });
        const prefData = await prefRes.json();
        if (!prefRes.ok) throw new Error(prefData.error || 'Error generando link de pago');

        setQrPaymentUrl(prefData.init_point);
        setPaymentWaiting(true);
        setPaymentTimeLeft(600);
        window.open(prefData.init_point, '_blank', 'noopener,noreferrer');

      // --- Haulmer QR Nativo ---
      } else if (selectedMethod === 'haulmer_native') {
        const orderRes = await fetch(API + '/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId, order_type: orderType, payment_method: 'card',
            items: cartItems, coupon_code: appliedCoupon?.coupon_code || null,
            total: Number(finalTotal).toFixed(2), delivery: deliveryMode,
            table_number: tableNum ? parseInt(tableNum) : null, customer_comment: paymentComment || null
          })
        });
        if (!orderRes.ok) throw new Error((await orderRes.json()).error || 'Error al crear pedido');
        const order = await orderRes.json();
        setPendingOrderData({ order, storeId });

        const hRes = await fetch('/api/haulmer/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId, order_id: order.id,
            amount: Math.round(Number(finalTotal)),
            description: `Pedido #${order.order_number || order.id}`
          })
        });
        const hData = await hRes.json();
        if (!hData.success) throw new Error(hData.error || 'Error generando pago Haulmer');

        setHaulmerReference(hData.reference);
        setQrPaymentUrl(hData.paymentUrl);
        setPaymentWaiting(true);
        setPaymentTimeLeft(300);
        window.open(hData.paymentUrl, '_blank', 'noopener,noreferrer');

      // --- QR Provider (plugin) ---
      } else if (selectedMethod === 'qr') {
        const orderRes = await fetch(API + '/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId, order_type: orderType, payment_method: 'card',
            items: cartItems, coupon_code: appliedCoupon?.coupon_code || null,
            total: Number(finalTotal).toFixed(2), delivery: deliveryMode,
            table_number: tableNum ? parseInt(tableNum) : null, customer_comment: paymentComment || null
          })
        });
        if (!orderRes.ok) throw new Error((await orderRes.json()).error || 'Error al crear pedido');
        const order = await orderRes.json();
        setPendingOrderData({ order, storeId });

        const qrRes = await fetch('/api/plugins/qr/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId, order_id: order.id,
            amount: Math.round(Number(finalTotal)),
            description: `Pedido #${order.order_number || order.id}`
          })
        });
        const qrData = await qrRes.json();
        if (!qrData.success) throw new Error(qrData.error || 'Error generando QR');

        setQrPaymentUrl(qrData.paymentUrl);
        setPaymentWaiting(true);
        setPaymentTimeLeft(300);
        window.open(qrData.paymentUrl, '_blank');

      // --- Cash ---
      } else {
        const response = await fetch(API + '/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId, order_type: orderType, payment_method: selectedMethod,
            items: cartItems, coupon_code: appliedCoupon?.coupon_code || null,
            total: Number(finalTotal).toFixed(2), delivery: deliveryMode,
            table_number: tableNum ? parseInt(tableNum) : null,
            terminal_id: selectedTerminalId ? parseInt(selectedTerminalId) : null,
            customer_comment: paymentComment || null
          })
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Error al procesar');
        const order = await response.json();
        setPendingOrderData({ order, storeId });
        setLastOrderNumber(order.order_number);
        setCashPaymentSuccess(true);
        setPaymentModalOpen(false);

        setCart([]);
        setCartOpen(false);
      }
    } catch (err) {
      setPaymentError(err.message);
      alert(err.message);
    } finally {
      setProcessingPayment(false);
    }
  };

  // Detectar puente nativo Android (WebViewActivity)
  useEffect(() => {
    if (!tuuModePayFromUrl) return;
    const check = () => {
      if (window.AndroidBridge) {
        setAndroidBridgeAvailable(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    const interval = setInterval(() => { if (check()) clearInterval(interval); }, 300);
    const timeout = setTimeout(() => clearInterval(interval), 10000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [tuuModePayFromUrl]);

  // Pago con terminal TUU local (app Android → Intent → TUU)
  // method: 1 = crédito, 2 = débito
  const handleAndroidTuuPayment = async (method) => {
    if (!window.AndroidBridge || cart.length === 0) return;
    if (selectedConfiguration?.require_order_comment && !skipCommentCheckRef.current) {
      setPendingCommentMethod('android_tuu_' + method);
      setPendingCommentTableNum(null);
      setPaymentComment('');
      setShowCommentModal(true);
      return;
    }
    skipCommentCheckRef.current = false;
    setProcessingPayment(true);
    setPaymentError(null);
    const finalTotal = getFinalTotal();
    const storeId = store.store.id;
    const cartItems = cart.flatMap(item => {
      if (item._isCombo) {
        return (item._comboConfig || []).map(ci => ({
          product_id: ci.product_id,
          quantity: ci.quantity * item.quantity,
          unit_price: ci.unit_price,
          selected_ingredients: ci.selected_ingredients || [],
          selected_extras: ci.selected_extras || [],
          selected_complements: ci.selected_complements || [],
          combo_id: item.combo_id,
          combo_label: item.combo_label
        }));
      }
      return [{
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        selected_ingredients: item.selected_ingredients,
        selected_extras: item.selected_extras,
        selected_complements: item.selected_complements || []
      }];
    });
    try {
      const orderRes = await fetch(API + '/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId, order_type: orderType, payment_method: 'card',
          items: cartItems, coupon_code: appliedCoupon?.coupon_code || null,
          total: Number(finalTotal).toFixed(2), delivery: false, table_number: null, terminal_id: null,
          customer_comment: paymentComment || null
        })
      });
      if (!orderRes.ok) throw new Error((await orderRes.json()).error || 'Error al crear pedido');
      const order = await orderRes.json();
      const amount = Math.round(Number(finalTotal));
      const orderRef = String(order.order_number || order.id);
      setProcessingPayment(false);
      setPaymentModalOpen(false);
      setPendingOrderData({ order, storeId });
      setAndroidTuuWaiting(true);
      setPaymentWaiting(true);
      setPaymentTimeLeft(300);

      window.onTuuPaymentResult = async (result) => {
        const data = typeof result === 'string' ? JSON.parse(result) : result;
        if (data.approved) {
          try {
            await fetch(`${API}/api/orders/${order.id}/confirm-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ store_id: storeId })
            });
          } catch (e) { console.error('Error confirming payment:', e); }
          setAndroidTuuWaiting(false);
          setPaymentWaiting(false);
          setPaymentConfirmed(true);
          setLastOrderNumber(order.order_number);
          setCart([]);
          setCartOpen(false);
          setPaymentModalOpen(false);
        } else {
          fetch(`${API}/api/orders/${order.id}/cancel-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ store_id: storeId })
          }).catch(() => {});
          setAndroidTuuWaiting(false);
          setPaymentWaiting(false);
          setProcessingPayment(false);
          setPaymentCancelled(true);
        }
      };

      window.AndroidBridge.processTuuPayment(amount, method, orderRef);
    } catch (err) {
      setAndroidTuuWaiting(false);
      setPaymentWaiting(false);
      setPaymentError(err.message);
      setProcessingPayment(false);
      alert(err.message);
    }
  };

  useEffect(() => {
    if (!paymentWaiting || !pendingOrderData) return;
    if (androidTuuWaiting) {
      const timerInterval = setInterval(() => {
        setPaymentTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerInterval);
            setAndroidTuuWaiting(false);
            setPaymentWaiting(false);
            setPaymentCancelled(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerInterval);
    }

    const orderId = pendingOrderData.order.id;
    const storeId = pendingOrderData.storeId;
    const isTuuPayment = !!tuuPaymentKey;
    const isHaulmerNative = !!haulmerReference;
    const isSquarePayment = !!squarePaymentKey;
    const squareKey = squarePaymentKey;

    const onPaymentSuccess = (orderNumberOverride) => {
      setPaymentConfirmed(true);
      setLastOrderNumber(orderNumberOverride || pendingOrderData.order.order_number);
      setCart([]);
      setCartOpen(false);
      setPaymentModalOpen(false);
      setPaymentWaiting(false); setQrPaymentUrl(null);
      setTuuPaymentKey(null);
      setSquarePaymentKey(null);
      setHaulmerReference(null);
    };

    const onPaymentFail = () => {
      setPaymentWaiting(false); setQrPaymentUrl(null);
      setPaymentCancelled(true);
      setTuuPaymentKey(null);
      setSquarePaymentKey(null);
      setHaulmerReference(null);
    };

    const pollInterval = setInterval(async () => {
      try {
        if (isHaulmerNative) {
          // --- Haulmer QR nativo ---
          const res = await fetch(`/api/haulmer/payment/${encodeURIComponent(haulmerReference)}/status`);
          if (!res.ok) return;
          const data = await res.json();
          if (data.status === 'completed') {
            clearInterval(pollInterval);
            clearInterval(timerInterval);
            onPaymentSuccess(data.order_number || null);
          } else if (data.status === 'failed' || data.status === 'cancelled') {
            clearInterval(pollInterval);
            clearInterval(timerInterval);
            onPaymentFail();
          }
        } else if (isTuuPayment) {
          // --- TUU POS nativo ---
          const res = await fetch(`/api/tuu/status/${tuuPaymentKey}`);
          if (!res.ok) return;
          const data = await res.json();

          if (data.status === 'Completed') {
            clearInterval(pollInterval);
            clearInterval(timerInterval);
            onPaymentSuccess(data.order_number || null);
          } else if (['Canceled', 'Failed', 'Timeout'].includes(data.status)) {
            clearInterval(pollInterval);
            clearInterval(timerInterval);
            onPaymentFail();
          }
        } else if (isSquarePayment) {
          // --- Square Terminal polling ---
          const res = await fetch(`/api/plugins/payments/status/${encodeURIComponent(squareKey)}`);
          if (!res.ok) return;
          const data = await res.json();
          if (data.status === 'Completed') {
            clearInterval(pollInterval);
            clearInterval(timerInterval);
            onPaymentSuccess();
          } else if (['Canceled', 'Timeout'].includes(data.status)) {
            clearInterval(pollInterval);
            clearInterval(timerInterval);
            onPaymentFail();
          }
        } else {
          // --- MercadoPago polling ---
          const res = await fetch(`/api/orders/${orderId}/payment-status?store_id=${storeId}`);
          if (!res.ok) return;
          const data = await res.json();

          const mpStatus = data.mp_status || data.status;
          const payStatus = data.payment_status || data.status;
          const paidAmount = data.paid_amount || '0';

          const MP_APPROVED_STATUSES = ['approved', 'paid', 'processed', 'action_required'];
          const isApproved =
            (MP_APPROVED_STATUSES.includes(payStatus) || MP_APPROVED_STATUSES.includes(mpStatus)) &&
            (parseFloat(paidAmount) > 0 || payStatus === 'processed' || mpStatus === 'processed' || mpStatus === 'action_required');
          const isCancelled = mpStatus === 'canceled' ||
            mpStatus === 'expired' || mpStatus === 'failed' ||
            payStatus === 'canceled' ||
            data.order_status === 'canceled';

          if (isApproved) {
            clearInterval(pollInterval);
            clearInterval(timerInterval);
            await fetch(`/api/orders/${orderId}/confirm-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ store_id: storeId })
            });
            onPaymentSuccess();
          } else if (isCancelled) {
            clearInterval(pollInterval);
            clearInterval(timerInterval);
            onPaymentFail();
          }
        }
      } catch (err) {
        console.error('Error polling payment status:', err);
      }
    }, 5000);

    const timerInterval = setInterval(() => {
      setPaymentTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          clearInterval(pollInterval);
          if (isTuuPayment && tuuPaymentKey) {
            fetch(`/api/tuu/cancel/${tuuPaymentKey}`, { method: 'POST' });
          }
          onPaymentFail();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(timerInterval);
    };
  }, [paymentWaiting, pendingOrderData, tuuPaymentKey, squarePaymentKey, haulmerReference, androidTuuWaiting]);

  useEffect(() => {
    setAppliedCoupon(null);
    setCouponCodeInput('');
  }, [cart]);

  const checkComplementDuplicates = async () => {
    if (!adminToken || !store?.store?.id) return;
    try {
      const res = await fetch(`/api/complements/duplicate-info?store_id=${store.store.id}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      console.log('[duplicates] status:', res.status, 'data:', data);
      if (!res.ok) return;
      if (Array.isArray(data) && data.length > 0) {
        setStoreDuplicateInfo(data);
        setShowStoreDuplicatesModal(true);
      }
    } catch (e) { console.error('[duplicates] fetch error:', e); }
  };

  const handleStoreDeduplication = async () => {
    if (!adminToken || !store?.store?.id) return;
    setStoreDeduplicating(true);
    try {
      const storeId = store.store.id;
      await Promise.all([
        fetch(`/api/ingredients/duplicates?store_id=${storeId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${adminToken}` }
        }),
        fetch(`/api/extras/duplicates?store_id=${storeId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${adminToken}` }
        })
      ]);
      setShowStoreDuplicatesModal(false);
      setStoreDuplicateInfo([]);
      await fetchComplements();
    } catch (err) {
      alert('Error al eliminar duplicados: ' + err.message);
    } finally {
      setStoreDeduplicating(false);
    }
  };

  const fetchComplements = async () => {
    try {
      const [exRes, inRes, grRes] = await Promise.all([
        fetch(`/api/public/${code}/extras`, { cache: 'no-store' }),
        fetch(`/api/public/${code}/ingredients`, { cache: 'no-store' }),
        fetch(`/api/public/${code}/complement-groups`, { cache: 'no-store' })
      ]);
      if (exRes.ok) setExtras(await exRes.json());
      if (inRes.ok) setIngredients(await inRes.json());
      if (grRes.ok) setStoreComplementGroups(await grRes.json());
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (editMode) fetchComplements();
  }, [editMode, adminToken]);

  // Sincronizar sectionEditingGroup con los datos frescos de storeComplementGroups
  useEffect(() => {
    if (sectionEditingGroup) {
      const fresh = storeComplementGroups.find(g => g.id === sectionEditingGroup.id);
      if (fresh) setSectionEditingGroup(fresh);
    }
  }, [storeComplementGroups]);

  // ===== Secciones dinámicas (editor del tótem) =====
  const saveSectionGroup = async () => {
    const g = sectionGroupModal;
    if (!g || !g.name.trim()) return;
    setSectionSaving(true);
    try {
      const url = g.id ? `/api/public/${code}/complement-groups/${g.id}` : `/api/public/${code}/complement-groups`;
      const res = await fetch(url, {
        method: g.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...getAuthBody(),
          name: g.name.trim(),
          min_select: parseInt(g.min_select) || 0,
          max_select: parseInt(g.max_select) || 0,
          required: !!g.required
        })
      });
      // Si es creación desde el editor de producto, auto-asignar la sección y abrir panel de opciones
      if (!g.id && g._autoAssign) {
        try {
          const created = await res.json();
          if (created && created.id) {
            setProdForm(prev => ({
              ...prev,
              complement_group_ids: [...(prev.complement_group_ids || []), created.id]
            }));
            setSectionGroupModal(null);
            await fetchComplements();
            // Abrir panel de opciones para la sección recién creada
            setSectionEditingGroup({ ...created, options: [] });
            return;
          }
        } catch (_) {}
      }
      setSectionGroupModal(null);
      await fetchComplements();
    } catch (e) { console.error('Error guardando sección:', e); }
    finally { setSectionSaving(false); }
  };

  const deleteSectionGroup = async (id) => {
    if (!confirm('¿Eliminar esta sección y todas sus opciones?')) return;
    try {
      await fetch(`/api/public/${code}/complement-groups/${id}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getAuthBody())
      });
      await fetchComplements();
    } catch (e) { console.error(e); }
  };

  const saveSectionOption = async () => {
    const o = sectionOptionModal;
    if (!o || !o.name.trim()) return;
    setSectionSaving(true);
    try {
      const url = o.id ? `/api/public/${code}/complement-options/${o.id}` : `/api/public/${code}/complement-options`;
      const fd = new FormData();
      fd.append(adminToken ? 'token' : 'pin', adminToken || sessionPin);
      fd.append('group_id', o.group_id);
      fd.append('name', o.name.trim());
      fd.append('price', parseFloat(o.price) || 0);
      fd.append('stock', parseInt(o.stock) || 0);
      fd.append('unlimited_stock', o.unlimited_stock ? 'true' : 'false');
      if (o.imageFile) fd.append('image', o.imageFile);
      await fetch(url, { method: o.id ? 'PUT' : 'POST', body: fd });
      setSectionOptionModal(null);
      await fetchComplements();
      // Si hay un panel de edición inline abierto, refrescarlo con las opciones actualizadas
      if (sectionEditingGroup && sectionEditingGroup.id === o.group_id) {
        setSectionEditingGroup(prev => {
          const updated = storeComplementGroups.find(g => g.id === o.group_id);
          return updated ? { ...updated } : prev;
        });
      }
    } catch (e) { console.error('Error guardando opción:', e); }
    finally { setSectionSaving(false); }
  };

  const deleteSectionOption = async (id) => {
    if (!confirm('¿Eliminar esta opción?')) return;
    try {
      await fetch(`/api/public/${code}/complement-options/${id}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getAuthBody())
      });
      await fetchComplements();
    } catch (e) { console.error(e); }
  };

  const saveComplement = async () => {
    if (!complementForm.name.trim()) return;
    const type = complementForm.type;
    const formData = new FormData();
    formData.append(adminToken ? 'token' : 'pin', adminToken || sessionPin);
    formData.append('name', complementForm.name.trim());
    formData.append('price', parseFloat(complementForm.price) || 0);
    formData.append('category_id', complementForm.category_id || '');
    formData.append('stock', parseInt(complementForm.stock) || 0);
    formData.append('unlimited_stock', complementForm.unlimited_stock);
    if (complementForm.imageFile) formData.append('image', complementForm.imageFile);

    const compRes = await fetch(`/api/public/${code}/${type === 'extra' ? 'extras' : 'ingredients'}`, {
      method: 'POST',
      body: formData
    });
    if (compRes.ok) {
      const savedComp = await compRes.json();
      await compRecipeRef.current?.save(savedComp.id);
    }
    setComplementModal(null);
    setComplementForm({ name: '', price: '', type: 'extra', category_id: '', stock: '', unlimited_stock: true, imageFile: null });
    fetchComplements();
    fetchStore();
  };

  const deleteComplement = async (type, id) => {
    if (!confirm('¿Eliminar?')) return;
    await fetch(`/api/public/${code}/${type === 'extra' ? 'extras' : 'ingredients'}/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getAuthBody())
    });
    fetchComplements();
    fetchStore();
  };

  const loadStoreStyles = async () => {
    try {
      const res = await fetch(`/api/public/${code}/styles`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const vs = typeof data.visual_settings === 'string' ? JSON.parse(data.visual_settings) : (data.visual_settings || {});
        setVisualSettings(prev => ({ ...prev, ...vs }));
        setCustomCss(data.custom_css || '');
        applyStyles(vs, data.custom_css || '');
      }
    } catch { /* ignore */ }
  };

  const applyStyles = (vs, css) => {
    let old = document.getElementById('store-custom-styles');
    if (old) old.remove();
    const parts = [];
    if (vs.fontFamily) parts.push('.store-container { font-family: ' + vs.fontFamily + ' !important; }');
    if (vs.fontSize) parts.push('.store-container { font-size: ' + vs.fontSize + ' !important; }');
    if (vs.titleSize) parts.push('.store-product-name { font-size: ' + vs.titleSize + ' !important; }');
    if (vs.priceSize) parts.push('.store-product-price { font-size: ' + vs.priceSize + ' !important; }');
    if (vs.fontWeight) parts.push('.store-container { font-weight: ' + vs.fontWeight + ' !important; }');
    if (vs.textShadow) parts.push('.store-product-name, .store-product-price { text-shadow: ' + vs.textShadow + ' !important; }');
    if (vs.cardShadow) parts.push('.store-product-card { box-shadow: ' + vs.cardShadow + ' !important; }');
    if (vs.cardRadius) parts.push('.store-product-card { border-radius: ' + vs.cardRadius + ' !important; }');
    if (vs.productNameColor) parts.push('.store-product-name { color: ' + vs.productNameColor + ' !important; }');
    if (vs.productPriceColor) parts.push('.store-product-price { color: ' + vs.productPriceColor + ' !important; }');
    if (vs.cardBg) parts.push('.store-product-card { background: ' + vs.cardBg + ' !important; }');
    if (vs.cardBorder) parts.push('.store-product-card { border: ' + vs.cardBorder + ' !important; }');
    if (vs.headerBg) parts.push('.store-header { background: ' + vs.headerBg + ' !important; }');
    if (vs.headerTextColor) parts.push('.store-header, .store-header * { color: ' + vs.headerTextColor + ' !important; }');
    if (vs.categoryBg) parts.push('.category-tab { background: ' + vs.categoryBg + ' !important; }');
    if (vs.categoryActiveColor) parts.push('.category-tab.active { background: ' + vs.categoryActiveColor + ' !important; }');
    if (vs.cartBg) parts.push('.cart-bar { background: ' + vs.cartBg + ' !important; }');
    if (vs.cartTextColor) parts.push('.cart-bar, .cart-bar *, .cart-bar-text, .cart-bar-total, .cart-bar-pay-btn { color: ' + vs.cartTextColor + ' !important; }');
    if (css) parts.push(css);
    if (parts.length > 0) {
      const el = document.createElement('style');
      el.id = 'store-custom-styles';
      el.textContent = parts.join('\n');
      document.head.appendChild(el);
    }
  };

  const saveStoreLabels = async () => {
    if (!labelEditModal) return;
    setLabelSaving(true);
    try {
      const body = { ...getAuthBody() };
      const v = (labelEditModal.value || '').trim();
      if (labelEditModal.type === 'extras') body.extras_label = v;
      else body.complements_label = v;
      const res = await fetch(`/api/public/${code}/labels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setStore(prev => prev ? { ...prev, store: { ...prev.store, [labelEditModal.type === 'extras' ? 'extras_label' : 'complements_label']: v } } : prev);
        setLabelEditModal(null);
      }
    } catch (err) { console.error('Error saving labels:', err); }
    finally { setLabelSaving(false); }
  };

  const saveStoreStyles = async () => {
    setStyleSaving(true);
    try {
      await fetch(`/api/public/${code}/styles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...getAuthBody(), visual_settings: visualSettings, custom_css: customCss })
      });
      applyStyles(visualSettings, customCss);
    } catch (err) { console.error('Error saving styles:', err); }
    finally { setStyleSaving(false); }
  };

  const deleteComplementFromModal = async (type, id) => {
    if (!confirm('¿Eliminar?')) return;
    await fetch(`/api/public/${code}/${type === 'extra' ? 'extras' : 'ingredients'}/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: adminToken })
    });
    if (type === 'extra') setSelectedExtraIds(prev => prev.filter(eid => eid !== id));
    else setSelectedIngredientIds(prev => prev.filter(iid => iid !== id));
    fetchComplements();
  };

  const saveEditComplement = async () => {
    if (!editingComplement || !editingComplement.name.trim()) return;
    const { id, type, name, price, imageFile, stock, unlimited_stock } = editingComplement;
    const formData = new FormData();
    formData.append('token', adminToken);
    formData.append('name', name.trim());
    formData.append('price', parseFloat(price) || 0);
    formData.append('category_id', '');
    formData.append('stock', parseInt(stock) || 0);
    formData.append('unlimited_stock', unlimited_stock ? 'true' : 'false');
    if (imageFile) formData.append('image', imageFile);
    await fetch(`/api/public/${code}/${type === 'extra' ? 'extras' : 'ingredients'}/${id}`, {
      method: 'PUT',
      body: formData
    });
    setEditingComplement(null);
    fetchComplements();
    fetchStore();
  };

  const saveEditComplementModal = async () => {
    if (!editComplementModal || !editComplementModal.name.trim()) return;
    const { id, type, name, price, imageFile, stock, unlimited_stock } = editComplementModal;
    const formData = new FormData();
    formData.append('token', adminToken);
    formData.append('name', name.trim());
    formData.append('price', parseFloat(price) || 0);
    formData.append('category_id', '');
    formData.append('stock', parseInt(stock) || 0);
    formData.append('unlimited_stock', unlimited_stock ? 'true' : 'false');
    if (imageFile) formData.append('image', imageFile);
    await fetch(`/api/public/${code}/${type === 'extra' ? 'extras' : 'ingredients'}/${id}`, {
      method: 'PUT',
      body: formData
    });
    await editCompRecipeRef.current?.save(id);
    setEditComplementModal(null);
    fetchComplements();
    fetchStore();
  };

  const updateProductStock = async (productId, stock, unlimitedStock) => {
    await fetch(`/api/public/${code}/products/${productId}/stock`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: adminToken, stock, unlimited_stock: unlimitedStock })
    });
    fetchStore();
  };

  const updateComplementStock = async (type, id, stock, unlimitedStock) => {
    const endpoint = type === 'extra' ? 'extra' : 'ingredient';
    await fetch(`/api/inventory/${endpoint}/${id}/stock`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ stock, unlimited_stock: unlimitedStock, store_id: store?.store?.id })
    });
    fetchComplements();
  };

  const RM_UNITS = ['unidades', 'kg', 'g', 'mg', 'litros', 'ml', 'porciones', 'tazas', 'cucharadas'];

  const fetchRawMats = useCallback(async () => {
    if (!store?.store?.id || !adminToken) return;
    setRmLoading(true);
    try {
      const res = await fetch(`/api/raw-materials/store/${store.store.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) setRawMats(await res.json());
    } finally { setRmLoading(false); }
  }, [store?.store?.id, adminToken]);

  useEffect(() => {
    if (editMode && invTab === 'raw') fetchRawMats();
  }, [editMode, invTab, fetchRawMats]);

  const saveRm = async () => {
    if (!rmForm.name.trim()) return;
    setRmSaving(true);
    try {
      const body = {
        name: rmForm.name.trim(),
        quantity: parseFloat(rmForm.quantity) || 0,
        unit: rmForm.unit,
        min_quantity: parseFloat(rmForm.min_quantity) || 0,
        cost_per_unit: parseFloat(rmForm.cost_per_unit) || 0,
        store_id: store.store.id
      };
      if (rmModal === 'new') {
        await fetch(`/api/raw-materials/store/${store.store.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify(body)
        });
      } else {
        await fetch(`/api/raw-materials/${rmModal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify(body)
        });
      }
      setRmModal(null);
      await fetchRawMats();
    } finally { setRmSaving(false); }
  };

  const deleteRm = async (rm) => {
    if (!confirm(`¿Eliminar "${rm.name}"?`)) return;
    await fetch(`/api/raw-materials/${rm.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ store_id: store.store.id })
    });
    await fetchRawMats();
  };

  const updateRmQty = async (rm, newQty) => {
    setRmSaving(true);
    try {
      await fetch(`/api/raw-materials/${rm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ name: rm.name, quantity: newQty, unit: rm.unit, min_quantity: rm.min_quantity, cost_per_unit: rm.cost_per_unit, store_id: store.store.id })
      });
      await fetchRawMats();
    } finally { setRmSaving(false); }
  };

  const getAuthBody = () => adminToken ? { token: adminToken } : { pin: sessionPin };

  const showRestartNotification = (delaySec) => {
    // Never show on admin sessions (edit mode or any active admin token/URL param)
    if (editModeRef.current || adminTokenRef.current || adminEditToken) return;
    // Prevent multiple concurrent restart notifications
    if (restartTriggeredRef.current) return;
    restartTriggeredRef.current = true;

    // Inject keyframe animations once
    if (!document.getElementById('srservi-restart-styles')) {
      const style = document.createElement('style');
      style.id = 'srservi-restart-styles';
      style.textContent = `
        @keyframes _srFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes _srSlideUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
        @keyframes _srSpin { to { transform:rotate(360deg) } }
        @keyframes _srPulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes _srScaleIn { from { transform:scale(0.7); opacity:0 } to { transform:scale(1); opacity:1 } }
      `;
      document.head.appendChild(style);
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:999999;
      background:rgba(0,0,0,0.88);backdrop-filter:blur(10px);
      display:flex;align-items:center;justify-content:center;
      animation:_srFadeIn 0.35s ease;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      display:flex;flex-direction:column;align-items:center;gap:18px;
      animation:_srSlideUp 0.4s cubic-bezier(0.34,1.56,0.64,1);
    `;

    // Spinner ring + countdown number in center
    const spinnerWrapper = document.createElement('div');
    spinnerWrapper.style.cssText = 'position:relative;width:130px;height:130px;';

    const ring = document.createElement('div');
    ring.style.cssText = `
      position:absolute;inset:0;border-radius:50%;
      border:5px solid rgba(212,175,55,0.18);
      border-top-color:#D4AF37;border-right-color:#D4AF37;
      animation:_srSpin 1s linear infinite;
    `;

    const ringOuter = document.createElement('div');
    ringOuter.style.cssText = `
      position:absolute;inset:-10px;border-radius:50%;
      border:2px solid rgba(212,175,55,0.08);
      border-bottom-color:rgba(212,175,55,0.35);
      animation:_srSpin 2.5s linear infinite reverse;
    `;

    const countdownEl = document.createElement('div');
    countdownEl.style.cssText = `
      position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
      font-size:46px;font-weight:800;color:#D4AF37;font-family:sans-serif;
      animation:_srScaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1);
    `;
    countdownEl.textContent = delaySec;

    spinnerWrapper.appendChild(ringOuter);
    spinnerWrapper.appendChild(ring);
    spinnerWrapper.appendChild(countdownEl);

    const title = document.createElement('h2');
    title.style.cssText = 'margin:0;font-size:20px;font-weight:700;color:#fff;font-family:sans-serif;letter-spacing:0.3px;';
    title.textContent = 'Aplicando cambios';

    const subtitle = document.createElement('p');
    subtitle.style.cssText = 'margin:0;font-size:14px;color:rgba(255,255,255,0.5);font-family:sans-serif;animation:_srPulse 1.6s ease infinite;';
    subtitle.textContent = 'Reiniciando pantalla...';

    card.appendChild(spinnerWrapper);
    card.appendChild(title);
    card.appendChild(subtitle);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    let remaining = delaySec;
    const interval = setInterval(() => {
      remaining--;
      countdownEl.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(interval);
        window.location.reload();
      }
    }, 1000);
  };

  const formatPrice = (price) => {
    const num = Number(price);
    if (selectedConfiguration?.hide_decimals || store?.store?.hide_decimals) {
      const formatted = num.toFixed(2);
      return formatted.endsWith('.00') ? String(Math.round(num)) : formatted;
    }
    return num.toFixed(2);
  };

  const groupProductsByCategory = () => {
    if (!store?.products) return {};

    const grouped = {};
    store.products.forEach(product => {
      if (!product.category_name) return;
      if (!grouped[product.category_name]) {
        grouped[product.category_name] = [];
      }
      grouped[product.category_name].push(product);
    });

    const categoryOrder = (store?.categories || []).map(c => c.name);
    const sortedEntries = Object.entries(grouped).sort(([a], [b]) => {
      const ia = categoryOrder.indexOf(a);
      const ib = categoryOrder.indexOf(b);
      return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
    });

    return Object.fromEntries(sortedEntries);
  };

  // Long-press en cualquier parte: mousedown/touchstart en document → 15s → abre PIN
  useEffect(() => {
    let timer = null;
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const start = () => {
      if (anyModalOpenRef.current) return;
      cancel();
      console.log('[PIN] press inicio — timer 15s');
      timer = setTimeout(() => {
        timer = null;
        if (anyModalOpenRef.current) return;
        console.log('[PIN] 15s cumplidos — abriendo modal PIN');
        setPinInput('');
        setPinError('');
        setPinModalOpen(true);
      }, 15000);
    };
    document.addEventListener('mousedown', start);
    document.addEventListener('mouseup', cancel);
    document.addEventListener('mouseleave', cancel);
    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchend', cancel);
    document.addEventListener('touchcancel', cancel);
    return () => {
      cancel();
      document.removeEventListener('mousedown', start);
      document.removeEventListener('mouseup', cancel);
      document.removeEventListener('mouseleave', cancel);
      document.removeEventListener('touchstart', start);
      document.removeEventListener('touchend', cancel);
      document.removeEventListener('touchcancel', cancel);
    };
  }, []);

  const handleLongPressEnd = () => {};

  const handlePinSubmit = async (pinValue) => {
    const pin = pinValue || pinInput;
    if (!pin || pin.length < 4) return;
    try {
      const response = await fetch(`/api/public/${code}/verify-edit-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await response.json();
      if (data.valid) {
        setSessionPin(pin);
        setPinModalOpen(false);
        setPinInput('');
        setPinError('');
        if (!tuuModePayFromUrl) setPinOptionsModalOpen(true);
      } else {
        setPinError('PIN incorrecto');
        setPinInput('');
      }
    } catch {
      setPinError('Error al verificar PIN');
      setPinInput('');
    }
  };

  const editSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const handleComplementsDragEnd = async (event, type) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const authToken = adminToken || localStorage.getItem('token');
    if (type === 'ingredient') {
      const oldIndex = ingredients.findIndex(i => i.id === active.id);
      const newIndex = ingredients.findIndex(i => i.id === over.id);
      const reordered = arrayMove(ingredients, oldIndex, newIndex);
      setIngredients(reordered);
      try {
        await fetch('/api/ingredients/reorder', {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ store_id: store?.store?.id, items: reordered.map((item, idx) => ({ id: item.id, sort_order: idx })) }),
        });
      } catch (err) { console.error(err); }
    } else {
      const oldIndex = extras.findIndex(e => e.id === active.id);
      const newIndex = extras.findIndex(e => e.id === over.id);
      const reordered = arrayMove(extras, oldIndex, newIndex);
      setExtras(reordered);
      try {
        await fetch('/api/extras/reorder', {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ store_id: store?.store?.id, items: reordered.map((item, idx) => ({ id: item.id, sort_order: idx })) }),
        });
      } catch (err) { console.error(err); }
    }
  };

  const handleEditDragStart = (event) => {
    setEditDragActiveId(event.active.id);
  };

  const handleEditDragEnd = async (event) => {
    const { active, over } = event;
    setEditDragActiveId(null);

    if (!over || active.id === over.id || !store?.products) return;

    const allProducts = [...store.products];
    const oldIndex = allProducts.findIndex(p => p.id === active.id);
    const newIndex = allProducts.findIndex(p => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newProducts = arrayMove(allProducts, oldIndex, newIndex);
    setStore(prev => ({ ...prev, products: newProducts }));

    try {
      await fetch(`/api/public/${code}/products/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...getAuthBody(),
          products: newProducts.map(p => ({ id: p.id }))
        })
      });
    } catch (error) {
      console.error('Error saving order:', error);
    }
  };

  const handleCatDragStart = (event) => {
    setCatDragActiveId(event.active.id);
  };

  const handleCatDragEnd = async (event) => {
    const { active, over } = event;
    setCatDragActiveId(null);
    if (!over || active.id === over.id || !store?.categories) return;

    const allCats = [...store.categories];
    const oldIndex = allCats.findIndex(c => c.id === active.id);
    const newIndex = allCats.findIndex(c => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newCats = arrayMove(allCats, oldIndex, newIndex);
    setStore(prev => ({ ...prev, categories: newCats }));

    try {
      await fetch(`/api/public/${code}/categories/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...getAuthBody(), categories: newCats.map(c => ({ id: c.id })) })
      });
    } catch (error) {
      console.error('Error saving category order:', error);
    }
  };

  const openCatModal = (cat = null, fromProduct = false) => {
    setEditingCat(cat);
    setCatName(cat ? cat.name : '');
    setCatModalFromProduct(fromProduct);
    setCatModalOpen(true);
  };

  const saveCat = async () => {
    if (!catName.trim()) return;
    try {
      const url = editingCat
        ? `/api/public/${code}/categories/${editingCat.id}`
        : `/api/public/${code}/categories`;
      const res = await fetch(url, {
        method: editingCat ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...getAuthBody(), name: catName.trim() })
      });
      const savedCat = await res.json();
      if (catModalFromProduct && !editingCat && savedCat?.id) {
        setProdForm(prev => ({ ...prev, category_id: savedCat.id.toString() }));
      }
      setCatModalOpen(false);
      setCatName('');
      setEditingCat(null);
      setCatModalFromProduct(false);
      fetchStore();
    } catch (err) {
      console.error('Error saving category:', err);
    }
  };

  const deleteCat = async (cat) => {
    if (!confirm(`¿Eliminar "${cat.name}"? Los productos quedarán sin categoría.`)) return;
    try {
      await fetch(`/api/public/${code}/categories/${cat.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getAuthBody())
      });
      fetchStore();
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  const openExcelModal = () => {
    setExcelStep('upload');
    setExcelRows([]);
    setExcelError('');
    setExcelResults(null);
    setShowExcelModal(true);
  };

  const downloadTemplate = () => {
    fetch('/api/products/excel-template', { headers: { 'Authorization': `Bearer ${adminToken}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_productos.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
  };

  const handleExcelFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setExcelError('');
    setExcelLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('store_id', store?.store?.id);
      const res = await fetch('/api/products/excel-preview', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: fd
      });
      const data = await res.json();
      if (!res.ok) { setExcelError(data.error || 'Error al leer el archivo'); return; }
      setExcelRows(data.rows);
      setExcelStep('preview');
    } catch {
      setExcelError('Error de conexión al leer el archivo');
    } finally {
      setExcelLoading(false);
      if (excelFileRef.current) excelFileRef.current.value = '';
    }
  };

  const handleExcelImport = async () => {
    setExcelLoading(true);
    setExcelError('');
    try {
      const res = await fetch('/api/products/excel-import', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: store?.store?.id, rows: excelRows })
      });
      const data = await res.json();
      if (!res.ok) { setExcelError(data.error || 'Error al importar'); return; }
      setExcelResults(data);
      setExcelStep('results');
      fetchStore();
    } catch {
      setExcelError('Error de conexión al importar');
    } finally {
      setExcelLoading(false);
    }
  };

  const openProdModal = (product = null) => {
    setEditingProd(product);
    setProdForm({
      name: product?.name || '',
      price: product?.price?.toString() || '',
      category_id: product?.category_id?.toString() || '',
      description: product?.description || '',
      barcode: product?.barcode || '',
      stock: product?.stock?.toString() || '0',
      unlimited_stock: product?.unlimited_stock ?? true,
      has_extras: product?.has_extras || false,
      has_ingredients: product?.has_ingredients || false,
      max_extras: product?.max_extras?.toString() || '',
      max_ingredients: product?.max_ingredients?.toString() || '',
      image_url: (product?.image?.startsWith('http') ? product.image : '') || '',
      complements_private: !!product?.complements_private,
      complement_group_ids: Array.isArray(product?.complement_groups) ? product.complement_groups.map(g => g.id) : []
    });
    setProdImageFile(null);
    setProdNewExtras([]);
    setProdNewComplements([]);
    if (adminToken) {
      if (product && product.complements_private) {
        // Lista única: el producto tiene sus propios complementos privados → editar aquí solo lo afecta a él
        fetch(`/api/public/${code}/products/${product.id}/own-complements`, { cache: 'no-store' })
          .then(r => r.json())
          .then(data => {
            const ings = data.ingredients || [];
            const exts = data.extras || [];
            setIngredients(ings);
            setExtras(exts);
            setSelectedIngredientIds(ings.map(i => i.id));
            setSelectedDefaultIngredientIds(ings.filter(i => i.included_by_default).map(i => i.id));
            setSelectedExtraIds(exts.map(e => e.id));
          })
          .catch(() => {});
      } else {
        fetchComplements();
        if (product) {
          fetch(`/api/public/${code}/products/${product.id}/complements`, { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
              setSelectedIngredientIds(data.ingredient_ids || []);
              setSelectedDefaultIngredientIds(data.default_ingredient_ids || []);
              setSelectedExtraIds(data.extra_ids || []);
            })
            .catch(() => {
              setSelectedIngredientIds(ingredients.map(i => i.id));
              setSelectedDefaultIngredientIds([]);
              setSelectedExtraIds(extras.map(e => e.id));
            });
        } else {
          // New product: all enabled by default
          setSelectedIngredientIds(ingredients.map(i => i.id));
          setSelectedDefaultIngredientIds([]);
          setSelectedExtraIds(extras.map(e => e.id));
        }
      }
    }
    setProdModalOpen(true);
  };

  const loadEditorCombos = async () => {
    if (!store?.store?.id || !adminToken) return;
    try {
      const res = await fetch(`/api/combos?store_id=${store.store.id}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) setEditorCombos(await res.json());
    } catch {}
    setEditorCombosLoaded(true);
  };

  const openEditorComboCreate = () => {
    setEditorComboForm({ name: '', description: '', imageFile: null, image: '', is_active: true, discount_type: 'auto', discount_value: '', fixed_price: '', items: [] });
    setEditorComboModal({ editing: null });
    setEditorComboProdSearch('');
    setEditorComboError('');
  };

  const openEditorComboEdit = (combo) => {
    setEditorComboForm({
      name: combo.name, description: combo.description || '',
      imageFile: null, image: combo.image || '',
      is_active: combo.is_active !== false,
      discount_type: combo.discount_type || 'auto',
      discount_value: combo.discount_value ? String(combo.discount_value) : '',
      fixed_price: combo.fixed_price ? String(combo.fixed_price) : '',
      items: (combo.items || []).map(it => ({ product_id: it.product_id, quantity: it.quantity }))
    });
    setEditorComboModal({ editing: combo });
    setEditorComboProdSearch('');
    setEditorComboError('');
  };

  const submitEditorCombo = async () => {
    if (!editorComboForm.name.trim()) { setEditorComboError('El nombre es requerido'); return; }
    if (editorComboForm.items.length === 0) { setEditorComboError('Agrega al menos un producto'); return; }
    setEditorComboSaving(true);
    try {
      const fd = new FormData();
      fd.append('store_id', store.store.id);
      fd.append('name', editorComboForm.name.trim());
      fd.append('description', editorComboForm.description || '');
      fd.append('is_active', editorComboForm.is_active);
      fd.append('discount_type', editorComboForm.discount_type);
      fd.append('discount_value', parseFloat(editorComboForm.discount_value) || 0);
      fd.append('fixed_price', parseFloat(editorComboForm.fixed_price) || 0);
      fd.append('items', JSON.stringify(editorComboForm.items));
      if (editorComboForm.imageFile) fd.append('image', editorComboForm.imageFile);
      else if (editorComboForm.image) fd.append('existing_image', editorComboForm.image);
      const isEdit = editorComboModal.editing;
      const res = await fetch(isEdit ? `/api/combos/${isEdit.id}` : '/api/combos', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: fd
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error al guardar');
      const combo = await res.json();
      setEditorCombos(prev => isEdit ? prev.map(c => c.id === combo.id ? combo : c) : [...prev, combo]);
      setEditorComboModal(null);
    } catch (e) {
      setEditorComboError(e.message);
    } finally {
      setEditorComboSaving(false);
    }
  };

  const deleteEditorCombo = async (id) => {
    if (!confirm('¿Eliminar este combo?')) return;
    try {
      const res = await fetch(`/api/combos/${id}?store_id=${store.store.id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (!res.ok) throw new Error('Error al eliminar');
      setEditorCombos(prev => prev.filter(c => c.id !== id));
    } catch (e) { alert(e.message); }
  };

  const toggleEditorComboActive = async (combo) => {
    try {
      const fd = new FormData();
      fd.append('store_id', store.store.id);
      fd.append('name', combo.name);
      fd.append('description', combo.description || '');
      fd.append('is_active', !combo.is_active);
      fd.append('discount_type', combo.discount_type || 'auto');
      fd.append('discount_value', combo.discount_value || 0);
      fd.append('fixed_price', combo.fixed_price || 0);
      fd.append('items', JSON.stringify((combo.items || []).map(it => ({ product_id: it.product_id, quantity: it.quantity }))));
      if (combo.image) fd.append('existing_image', combo.image);
      const res = await fetch(`/api/combos/${combo.id}`, {
        method: 'PUT', headers: { 'Authorization': `Bearer ${adminToken}` }, body: fd
      });
      if (!res.ok) throw new Error('Error');
      const updated = await res.json();
      setEditorCombos(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch (e) { alert(e.message); }
  };

  const addProductToEditorCombo = (product) => {
    setEditorComboForm(prev => {
      const existing = prev.items.find(it => String(it.product_id) === String(product.id));
      if (existing) return { ...prev, items: prev.items.map(it => String(it.product_id) === String(product.id) ? { ...it, quantity: it.quantity + 1 } : it) };
      return { ...prev, items: [...prev.items, { product_id: product.id, quantity: 1 }] };
    });
  };

  const saveProd = async () => {
    if (!prodForm.name.trim() || !prodForm.price) return;
    setProdSaving(true);
    try {
      const formData = new FormData();
      if (adminToken) formData.append('token', adminToken);
      else formData.append('pin', sessionPin);
      formData.append('name', prodForm.name.trim());
      formData.append('price', parseFloat(prodForm.price));
      formData.append('category_id', prodForm.category_id || '');
      formData.append('description', prodForm.description || '');
      formData.append('barcode', prodForm.barcode || '');
      formData.append('has_extras', prodForm.has_extras);
      formData.append('has_ingredients', prodForm.has_ingredients);
      formData.append('max_extras', prodForm.has_extras ? (parseInt(prodForm.max_extras) || 0) : 0);
      formData.append('max_ingredients', prodForm.has_ingredients ? (parseInt(prodForm.max_ingredients) || 0) : 0);
      if (prodImageFile) {
        formData.append('image', prodImageFile);
      } else if (prodForm.image_url) {
        formData.append('image_url', prodForm.image_url);
      } else if (editingProd) {
        formData.append('keep_image', 'true');
      }

      const url = editingProd
        ? `/api/public/${code}/products/${editingProd.id}`
        : `/api/public/${code}/products`;

      await fetch(url, {
        method: editingProd ? 'PUT' : 'POST',
        body: formData
      });

      // Update stock if admin editor
      if (adminToken) {
        const prodData = await (await fetch(`/api/public/${code}`, { cache: 'no-store' })).json();
        const lastProd = editingProd ? editingProd : prodData.products?.[prodData.products.length - 1];
        if (lastProd?.id) {
          await updateProductStock(lastProd.id, parseInt(prodForm.stock) || 0, prodForm.unlimited_stock);
        }
      }

      // Create new complements & extras, then sync associations
      if (adminToken) {
        const categoryId = prodForm.category_id || '';
        const isPrivate = !!prodForm.complements_private;
        const wasPrivate = !!editingProd?.complements_private;

        // Resolver el producto destino primero (necesario para complementos privados)
        const prodData2 = await (await fetch(`/api/public/${code}`, { cache: 'no-store' })).json();
        const targetProd = editingProd ? editingProd : prodData2.products?.[prodData2.products.length - 1];
        const targetId = targetProd?.id;

        const newIngIds = [];
        const newExtIds = [];

        for (const comp of prodNewComplements) {
          if (!comp.name.trim()) continue;
          const compData = new FormData();
          compData.append('token', adminToken);
          compData.append('name', comp.name.trim());
          compData.append('price', parseFloat(comp.price) || 0);
          compData.append('category_id', categoryId);
          compData.append('stock', 0);
          compData.append('unlimited_stock', 'true');
          compData.append('is_active', 'true');
          if (isPrivate && targetId) compData.append('owner_product_id', targetId);
          if (comp.imageFile) compData.append('image', comp.imageFile);
          const res = await fetch(`/api/public/${code}/ingredients`, { method: 'POST', body: compData });
          if (res.ok) { const d = await res.json(); newIngIds.push(d.id); }
        }
        for (const ext of prodNewExtras) {
          if (!ext.name.trim()) continue;
          const extData = new FormData();
          extData.append('token', adminToken);
          extData.append('name', ext.name.trim());
          extData.append('price', parseFloat(ext.price) || 0);
          extData.append('category_id', categoryId);
          extData.append('stock', 0);
          extData.append('unlimited_stock', 'true');
          extData.append('is_active', 'true');
          if (isPrivate && targetId) extData.append('owner_product_id', targetId);
          if (ext.imageFile) extData.append('image', ext.imageFile);
          const res = await fetch(`/api/public/${code}/extras`, { method: 'POST', body: extData });
          if (res.ok) { const d = await res.json(); newExtIds.push(d.id); }
        }

        if (targetId) {
          if (!isPrivate && wasPrivate) {
            // Se desactivó lista única → limpiar copias privadas y volver a la biblioteca compartida
            await fetch(`/api/public/${code}/products/${targetId}/complements-private`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...getAuthBody(), private: false })
            });
          } else {
            // Sincronizar asociaciones (selección + nuevos), deduplicando IDs
            const allIngIds = [...new Set([...selectedIngredientIds, ...newIngIds].map(Number))];
            const allExtIds = [...new Set([...selectedExtraIds, ...newExtIds].map(Number))];
            await fetch(`/api/public/${code}/products/${targetId}/complements`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...getAuthBody(), ingredient_ids: allIngIds, extra_ids: allExtIds, default_ingredient_ids: selectedDefaultIngredientIds })
            });
            // Lista única activada → clonar los vinculados a copias privadas
            if (isPrivate) {
              await fetch(`/api/public/${code}/products/${targetId}/complements-private`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...getAuthBody(), private: true })
              });
            }
          }
        }

        fetchComplements();
      }

      // Asignar secciones dinámicas al producto (funciona con token o pin)
      try {
        let pid = editingProd?.id;
        if (!pid) {
          const pd = await (await fetch(`/api/public/${code}`, { cache: 'no-store' })).json();
          pid = pd.products?.[pd.products.length - 1]?.id;
        }
        if (pid) {
          await fetch(`/api/public/${code}/products/${pid}/complement-groups`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...getAuthBody(), group_ids: prodForm.complement_group_ids || [] })
          });
        }
      } catch (e) { console.error('Error asignando secciones:', e); }

      setProdModalOpen(false);
      setEditingProd(null);
      setProdImageFile(null);
      setProdNewExtras([]);
      setProdNewComplements([]);
      fetchStore();
    } catch (err) {
      console.error('Error saving product:', err);
    } finally {
      setProdSaving(false);
    }
  };

  const deleteProd = async (product) => {
    if (!confirm(`¿Eliminar "${product.name}"?`)) return;
    try {
      await fetch(`/api/public/${code}/products/${product.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getAuthBody())
      });
      fetchStore();
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  useEffect(() => {
    if (!showDeleteAllModal) { setDeleteAllCountdown(5); return; }
    setDeleteAllCountdown(5);
    const interval = setInterval(() => {
      setDeleteAllCountdown(prev => { if (prev <= 1) { clearInterval(interval); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(interval);
  }, [showDeleteAllModal]);

  useEffect(() => {
    if (!showDeleteSelectedModal) { setDeleteSelectedCountdown(5); return; }
    setDeleteSelectedCountdown(5);
    const interval = setInterval(() => {
      setDeleteSelectedCountdown(prev => { if (prev <= 1) { clearInterval(interval); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(interval);
  }, [showDeleteSelectedModal]);

  const deleteAllProducts = async () => {
    const all = store?.products || [];
    setDeletingAll(true);
    for (const product of all) {
      try {
        await fetch(`/api/public/${code}/products/${product.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(getAuthBody())
        });
      } catch (err) {
        console.error('Error deleting product:', err);
      }
    }
    setDeletingAll(false);
    setShowDeleteAllModal(false);
    fetchStore();
  };

  const deleteSelectedProducts = async () => {
    const ids = Array.from(selectedProductIds);
    setDeletingSelected(true);
    for (const id of ids) {
      try {
        await fetch(`/api/public/${code}/products/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(getAuthBody())
        });
      } catch (err) {
        console.error('Error deleting product:', err);
      }
    }
    setDeletingSelected(false);
    setShowDeleteSelectedModal(false);
    setSelectionMode(false);
    setSelectedProductIds(new Set());
    fetchStore();
  };

  if (loading) {
    return (
      <div className="loading">
        {t('loading', lang)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="index-container">
        <div className="index-card">
          <h1 className="index-title" style={{ color: '#DC3545' }}>{t('error', lang)}</h1>
          <p className="index-subtitle">{error}</p>
          <button
            className="btn btn-secondary w-full"
            onClick={() => navigate('/')}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            {t('backToHome', lang)}
          </button>
        </div>
      </div>
    );
  }


  if (deliveryMode && selectedConfiguration && !selectedConfiguration?.delivery_enabled) {
    selectedConfiguration.delivery_enabled = true;
  }

  const groupedProducts = groupProductsByCategory();
  const hasProducts = (store?.products || []).length > 0;

  // Smart mode: reorder products putting top sellers first
  const getSmartProducts = () => {
    const prods = store?.products || [];
    if (topSellingIds.length === 0 || store?.store?.show_top_selling === false) return prods;
    const top = [];
    const rest = [];
    for (const p of prods) {
      if (topSellingIds.includes(p.id)) top.push(p);
      else rest.push(p);
    }
    // Sort top by their position in topSellingIds (most sold first)
    top.sort((a, b) => topSellingIds.indexOf(a.id) - topSellingIds.indexOf(b.id));
    return [...top, ...rest];
  };

  const renderProductCard = (product) => {
    const isUnlimited = product.unlimited_stock === true || product.unlimited_stock === 1 || product.unlimited_stock === '1';
    const isOutOfStock = !isUnlimited && product.stock === 0;
    const isTopSelling = topSellingIds.includes(product.id) && store?.store?.show_top_selling !== false;
    return (
      <div
        key={product.id}
        className={`store-product-wrapper${isOutOfStock ? ' out-of-stock' : ''}${isTopSelling ? ' top-selling' : ''}`}
      >
        <div
          className={`store-product-card${isOutOfStock ? ' out-of-stock' : ''}${isTopSelling ? ' top-selling-card' : ''}`}
          onClick={() => !editMode && openProductModal(product)}
        >
          {isTopSelling && !isOutOfStock && (
            <div className="top-selling-badge">
              <FontAwesomeIcon icon={faFire} /> {t('topSelling', lang)}
            </div>
          )}
          {isOutOfStock && (
            <div className="out-of-stock-badge">
              {t('soldOut', lang)}
            </div>
          )}
          {editMode && (
            <div className="store-prod-edit-overlay">
              <button onClick={(e) => { e.stopPropagation(); openProdModal(product); }} className="store-prod-edit-btn">
                <FontAwesomeIcon icon={faEdit} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); deleteProd(product); }} className="store-prod-edit-btn danger">
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          )}
          <div className="store-product-image">
            <img
              src={getProductImageUrl(product.image)}
              alt={product.name}
              className={isOutOfStock ? 'grayscale' : ''}
            />
            {product.description && (
              <button
                className="store-product-info-btn"
                onClick={(e) => { e.stopPropagation(); setProductInfo(product); }}
                aria-label={t('moreInfo', lang)}
                title={t('moreInfo', lang)}
              >
                <FontAwesomeIcon icon={faInfoCircle} />
              </button>
            )}
          </div>
        </div>
        <div className="store-product-info">
          {prepTimes[product.id] > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              marginBottom: 3,
              fontSize: '11px', fontWeight: 800, letterSpacing: '0.2px',
              color: 'var(--store-primary)', opacity: 0.75
            }}>
              <FontAwesomeIcon icon={faClock} style={{ fontSize: 10 }} />
              ~{prepTimes[product.id]} min
            </div>
          )}
          {product.description && (
            <p style={{ margin: '0 0 2px', fontSize: '10px', color: 'var(--store-primary)', opacity: 0.5, lineHeight: 1.3, textAlign: 'center', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{product.description}</p>
          )}
          <div className={`store-product-details${isOutOfStock ? ' out-of-stock' : ''}`}>
            <span className="store-product-name">{product.name}:</span>
            <span className="store-product-price">{colors.currency.symbol}{formatPrice(product.price)}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderAddProductCard = () => (
    <div className="store-product-wrapper" key="add-product">
      <div className="store-product-card store-add-card" onClick={() => openProdModal()}>
        <FontAwesomeIcon icon={faPlus} className="store-add-icon" />
      </div>
      <div className="store-product-info">
        <div className="store-product-details">
          <span className="store-product-name">Nuevo producto</span>
        </div>
      </div>
    </div>
  );

  return (
    <PluginProvider mode="store">
    {ticketMode && (
      <TicketPanel
        storeId={store?.store?.id}
        storeCode={code}
        terminalId={selectedTerminalId}
        terminalProvider={selectedTerminalProvider}
        terminalName={localStorage.getItem('srservi_last_terminal_name') || ''}
        onClose={() => { setTicketMode(false); localStorage.removeItem('srservi_ticket_mode'); }}
      />
    )}
    <div
      ref={storeContainerRef}
      className="store-container"
      style={{ '--store-primary': colors.primary, '--store-secondary': colors.secondary, '--store-accent': colors.accent, '--store-header': colors.header || colors.primary, zoom: totemZoom }}
      onClick={() => { if (adminEditToken && setMenuOpen) setMenuOpen(false); }}
    >
      <header className="store-header">
        <div className="store-header-content">
          <div className="store-header-brand">
            {store?.store?.logo_url && (
              <img
                src={store.store.logo_url}
                alt={store?.store?.name}
                className="store-header-logo"
              />
            )}
            <h1 className="store-header-name">
              {store?.store?.name}
            </h1>
          </div>
          <div className="store-header-spacer" />
          <div className="store-header-actions">
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowLangPicker(!showLangPicker)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '5px 9px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', color: 'rgba(255,255,255,0.75)', fontSize: '13px' }}>
                <FontAwesomeIcon icon={faGlobe} style={{ fontSize: '11px' }} />
                <span>{LANGUAGES.find(l => l.code === lang)?.flag || '🌐'}</span>
              </button>
              {showLangPicker && (
                <>
                <div onClick={() => setShowLangPicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
                <div style={{ position: 'fixed', top: '58px', right: '12px', background: '#fff', borderRadius: '10px', boxShadow: '0 4px 24px rgba(0,0,0,0.25)', overflow: 'hidden', minWidth: '150px', zIndex: 9999 }}>
                  {LANGUAGES.map(l => (
                    <button key={l.code} onClick={() => { setLang(l.code); localStorage.setItem('srservi_lang', l.code); setShowLangPicker(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', border: 'none', background: lang === l.code ? '#f5f5f5' : '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: lang === l.code ? '700' : '400', borderBottom: '1px solid #f0f0f0' }}>
                      <span style={{ fontSize: '18px' }}>{l.flag}</span> {l.label}
                    </button>
                  ))}
                </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div style={{ background: '#f0f0f0', textAlign: 'center', padding: '3px 0', fontSize: 10, color: '#aaa', letterSpacing: '0.4px', lineHeight: 1 }}>
        {t('poweredBy', lang)}
      </div>

      <PluginSlot name="store-header" context={{ storeId: store?.store?.id, code }} />

      <div className="category-tabs">
        <div
          ref={categoryRef}
          className="category-tabs-list"
        >
        <button
          className={`category-tab${activeCategory === 'all' ? ' active' : ''}`}
          data-category="all"
          onClick={() => setActiveCategory('all')}
        >
          {t('all', lang)}
        </button>
        {editMode ? (
          <DndContext
            sensors={editSensors}
            collisionDetection={closestCenter}
            onDragStart={handleCatDragStart}
            onDragEnd={handleCatDragEnd}
          >
            <SortableContext
              items={(store?.categories || []).map(c => c.id)}
              strategy={rectSortingStrategy}
            >
              {(store?.categories || []).map(catObj => (
                <SortableCategoryTab
                  key={catObj.id}
                  catObj={catObj}
                  activeCategory={activeCategory}
                  onEdit={openCatModal}
                  onDelete={deleteCat}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          (store?.categories || []).map(catObj => (
            <button
              key={catObj.id}
              className={`category-tab${activeCategory === catObj.name ? ' active' : ''}`}
              data-category={catObj.name}
              onClick={() => setActiveCategory(catObj.name)}
            >
              {catObj.name}
            </button>
          ))
        )}
        {editMode && (
          <button className="category-tab cat-tab-add" onClick={() => openCatModal()}>
            <FontAwesomeIcon icon={faFolderPlus} />
          </button>
        )}
        </div>
      </div>

      {!hasProducts && (
        <div className="store-empty">
          <div className="store-empty-icon" style={{ background: `linear-gradient(135deg, ${colors.accent}20, ${colors.accent}40)` }}>
            <FontAwesomeIcon icon={faBox} style={{ color: colors.accent }} />
          </div>
          <h2>
            {t('noProducts', lang)}
          </h2>
          <p>
            {t('noProductsDesc', lang)}
          </p>
        </div>
      )}

      {editMode && (
        <div className="store-editor-bar">
          <div className="store-editor-tabs">
            <button className={`store-editor-tab${editorTab === 'products' ? ' active' : ''}`} onClick={() => setEditorTab('products')}>
              <FontAwesomeIcon icon={faBox} /><span className="editor-tab-label">Productos</span>
            </button>
            <button className={`store-editor-tab${editorTab === 'complements' ? ' active' : ''}`} onClick={() => { setEditorTab('complements'); checkComplementDuplicates(); }} style={{ display: 'none' }}>
              <FontAwesomeIcon icon={faPlus} /><span className="editor-tab-label">Complementos</span>
            </button>
            <button className={`store-editor-tab${editorTab === 'inventory' ? ' active' : ''}`} onClick={() => { setEditorTab('inventory'); setInvEditingId(null); }} style={{ display: 'none' }}>
              <FontAwesomeIcon icon={faInfinity} /><span className="editor-tab-label">Inventario</span>
            </button>
            <button
              className={`store-editor-tab${editorTab === 'orders' ? ' active' : ''}`}
              onClick={() => { setEditorTab('orders'); setNewOrderCount(0); }}
              style={{ position: 'relative', display: 'none' }}
            >
              <FontAwesomeIcon icon={faShoppingCart} /><span className="editor-tab-label">Pedidos</span>
              {newOrderCount > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#e53e3e', color: '#fff', borderRadius: '50%', fontSize: '10px', fontWeight: '700', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {newOrderCount > 9 ? '9+' : newOrderCount}
                </span>
              )}
            </button>
            <button className="store-editor-tab" onClick={() => { loadStoreStyles(); setStyleEditorOpen(true); }}>
              <FontAwesomeIcon icon={faPalette} /><span className="editor-tab-label">Estilos</span>
            </button>
            <button className="store-editor-tab" onClick={openExcelModal}>
              <FontAwesomeIcon icon={faFileExcel} style={{ color: '#4ade80' }} /><span className="editor-tab-label">Excel</span>
            </button>
            <button className={`store-editor-tab${editorTab === 'combos' ? ' active' : ''}`} onClick={() => { setEditorTab('combos'); if (!editorCombosLoaded) loadEditorCombos(); }}>
              <FontAwesomeIcon icon={faLayerGroup} /><span className="editor-tab-label">Combos</span>
            </button>
          </div>
          <div className="store-editor-actions">
            <button
              className="store-editor-done"
              style={{ background: previewMode ? '#28a745' : 'rgba(255,255,255,0.1)', color: previewMode ? '#fff' : 'rgba(255,255,255,0.8)' }}
              onClick={() => setPreviewMode(p => !p)}
            >
              <FontAwesomeIcon icon={previewMode ? faEyeSlash : faEye} />
              <span className="editor-btn-label">{previewMode ? 'Salir' : 'Preview'}</span>
            </button>
            <button className="store-editor-done" onClick={() => setShowRestartConfirm(true)}>
              <span className="editor-btn-label">Guardar</span>
            </button>
          </div>
        </div>
      )}

      {editMode && !previewMode && editorTab === 'complements' && (
        <div className="store-editor-complements">
          <div className="store-editor-comp-header">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {extrasLabel} ({extras.length})
              <button onClick={() => setLabelEditModal({ type: 'extras', value: (store?.store?.extras_label || '').trim() })} title="Cambiar nombre" style={{ background: 'none', border: 'none', color: 'var(--store-primary)', cursor: 'pointer', padding: '2px', fontSize: '13px' }}>
                <FontAwesomeIcon icon={faEdit} />
              </button>
            </span>
            <button className="store-edit-cat-add-btn" onClick={() => { setComplementForm({ ...complementForm, type: 'extra' }); setComplementModal('extra'); }}>
              <FontAwesomeIcon icon={faPlus} /> Nuevo
            </button>
          </div>
          <div className="store-editor-comp-list">
            {extras.map(e => (
              <div key={e.id} className="store-editor-comp-item">
                <img src={getProductImageUrl(e.image)} alt="" className="store-editor-comp-img" />
                <div className="store-editor-comp-info">
                  <strong>{e.name}</strong>
                  {Number(e.price) > 0 && <span className="store-editor-comp-price">+${Number(e.price).toFixed(0)}</span>}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => setEditComplementModal({ id: e.id, type: 'extra', name: e.name, price: e.price?.toString() || '', stock: String(e.stock ?? 0), unlimited_stock: !!(e.unlimited_stock === true || e.unlimited_stock === 1 || e.unlimited_stock === '1'), imageFile: null })} className="store-prod-edit-btn" style={{ width: '24px', height: '24px', fontSize: '11px' }}>
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button onClick={() => deleteComplement('extra', e.id)} className="store-prod-edit-btn danger" style={{ width: '24px', height: '24px', fontSize: '11px' }}>
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            ))}
            {extras.length === 0 && <span style={{ color: '#999', fontSize: '13px', padding: '8px' }}>Sin extras</span>}
          </div>

          <div className="store-editor-comp-header" style={{ marginTop: '12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {complementsLabel} ({ingredients.length})
              <button onClick={() => setLabelEditModal({ type: 'complements', value: (store?.store?.complements_label || '').trim() })} title="Cambiar nombre" style={{ background: 'none', border: 'none', color: 'var(--store-primary)', cursor: 'pointer', padding: '2px', fontSize: '13px' }}>
                <FontAwesomeIcon icon={faEdit} />
              </button>
            </span>
            <button className="store-edit-cat-add-btn" onClick={() => { setComplementForm({ ...complementForm, type: 'ingredient' }); setComplementModal('ingredient'); }}>
              <FontAwesomeIcon icon={faPlus} /> Nuevo
            </button>
          </div>
          <div className="store-editor-comp-list">
            {ingredients.map(i => (
              <div key={i.id} className="store-editor-comp-item">
                <img src={getProductImageUrl(i.image)} alt="" className="store-editor-comp-img" />
                <div className="store-editor-comp-info">
                  <strong>{i.name}</strong>
                  {Number(i.price) > 0 && <span className="store-editor-comp-price">+${Number(i.price).toFixed(0)}</span>}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => setEditComplementModal({ id: i.id, type: 'ingredient', name: i.name, price: i.price?.toString() || '', stock: String(i.stock ?? 0), unlimited_stock: !!(i.unlimited_stock === true || i.unlimited_stock === 1 || i.unlimited_stock === '1'), imageFile: null })} className="store-prod-edit-btn" style={{ width: '24px', height: '24px', fontSize: '11px' }}>
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button onClick={() => deleteComplement('ingredient', i.id)} className="store-prod-edit-btn danger" style={{ width: '24px', height: '24px', fontSize: '11px' }}>
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            ))}
            {ingredients.length === 0 && <span style={{ color: '#999', fontSize: '13px', padding: '8px' }}>Sin complementos</span>}
          </div>

          {/* ── Secciones personalizadas ── */}
          <div className="store-editor-comp-header" style={{ marginTop: '18px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
              Mis secciones ({storeComplementGroups.length})
            </span>
            <button className="store-edit-cat-add-btn" onClick={() => setSectionGroupModal({ name: '', min_select: '0', max_select: '0', required: false })}>
              <FontAwesomeIcon icon={faPlus} /> Nueva sección
            </button>
          </div>
          {storeComplementGroups.length === 0 && (
            <span style={{ color: '#999', fontSize: '13px', padding: '8px', display: 'block' }}>
              Creá tus propias secciones (ej: Salsas, Bebidas) y luego asignalas a cada producto.
            </span>
          )}
          {storeComplementGroups.map(group => (
            <div key={group.id} style={{ border: '1px solid #eee', borderRadius: 10, padding: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
                <div>
                  <strong style={{ color: 'var(--store-primary)' }}>{group.name}</strong>
                  <span style={{ fontSize: 11, color: '#999', marginLeft: 6 }}>
                    {group.required ? 'Obligatorio · ' : ''}{group.min_select > 0 ? `mín ${group.min_select} · ` : ''}{group.max_select > 0 ? `máx ${group.max_select}` : 'sin límite'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setSectionOptionModal({ group_id: group.id, name: '', price: '', stock: '', unlimited_stock: true, imageFile: null })} className="store-edit-cat-add-btn" style={{ fontSize: 12 }}>
                    <FontAwesomeIcon icon={faPlus} /> Opción
                  </button>
                  <button onClick={() => setSectionGroupModal({ id: group.id, name: group.name, min_select: String(group.min_select ?? 0), max_select: String(group.max_select ?? 0), required: !!group.required })} className="store-prod-edit-btn" style={{ width: 28, height: 28, fontSize: 12 }}>
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button onClick={() => deleteSectionGroup(group.id)} className="store-prod-edit-btn danger" style={{ width: 28, height: 28, fontSize: 12 }}>
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
              <div className="store-editor-comp-list">
                {group.options.map(opt => (
                  <div key={opt.id} className="store-editor-comp-item">
                    {opt.image && <img src={getProductImageUrl(opt.image)} alt="" className="store-editor-comp-img" />}
                    <div className="store-editor-comp-info">
                      <strong>{opt.name}</strong>
                      {Number(opt.price) > 0 && <span className="store-editor-comp-price">+${Number(opt.price).toFixed(0)}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => setSectionOptionModal({ id: opt.id, group_id: group.id, name: opt.name, price: opt.price?.toString() || '', stock: String(opt.stock ?? 0), unlimited_stock: !!opt.unlimited_stock, imageFile: null })} className="store-prod-edit-btn" style={{ width: '24px', height: '24px', fontSize: '11px' }}>
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button onClick={() => deleteSectionOption(opt.id)} className="store-prod-edit-btn danger" style={{ width: '24px', height: '24px', fontSize: '11px' }}>
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </div>
                ))}
                {group.options.length === 0 && <span style={{ color: '#999', fontSize: '12px', padding: '6px' }}>Sin opciones</span>}
              </div>
            </div>
          ))}

        </div>
      )}


      {(!editMode || previewMode) && activeCategory === 'all' && (store?.combos || []).filter(c => c.is_active && c.items?.length > 0).length > 0 && (
        <div className="category-section">
          <div className="category-section-header">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faLayerGroup} className="category-section-icon" />
              <h3 className="category-section-title">Combos y Promociones</h3>
            </div>
            <div className="category-section-line" />
          </div>
          <div className="products-grid">
            {(store.combos || []).filter(c => c.is_active && c.items?.length > 0).map(combo => {
              const hasDiscount = combo.discount_type !== 'auto' && combo.auto_price > 0 && combo.auto_price !== combo.price;
              const includedText = (combo.items || []).map(it => `${it.quantity}× ${it.product_name}`).join(' + ');
              return (
                <div key={combo.id} className="store-product-wrapper" onClick={() => openComboModal(combo)}>
                  <div className={`store-product-card${hasDiscount ? ' combo-promo-card' : ''}`}>
                    {hasDiscount && (
                      <div className="combo-promo-badge">
                        <span className="combo-promo-label">✦ Promoción ✦</span>
                        <span className="combo-promo-discount">
                          {combo.discount_type === 'percent' ? `-${combo.discount_value}%` : 'Precio especial'}
                        </span>
                      </div>
                    )}
                    <div className="store-product-image">
                      <img src={getProductImageUrl(combo.image)} alt={combo.name} />
                    </div>
                  </div>
                  <div className="store-product-info">
                    <p style={{ margin: '0 0 2px', fontSize: '10px', color: 'var(--store-primary)', opacity: 0.5, lineHeight: 1.3, textAlign: 'center', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {combo.description || includedText}
                    </p>
                    <div className="store-product-details">
                      <span className="store-product-name">{combo.name}:</span>
                      <span className="store-product-price">
                        {colors.currency.symbol}{formatPrice(combo.price)}
                        {hasDiscount && (
                          <span style={{ marginLeft: '4px', fontSize: '0.75em', opacity: 0.5, textDecoration: 'line-through' }}>
                            {colors.currency.symbol}{formatPrice(combo.auto_price)}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(!editMode || previewMode) && activeCategory === 'all' && hasProducts && (
        <div className="category-sections" ref={productsAreaRef}>
          {(() => {
            const uncategorized = getSmartProducts().filter(p => !p.category_name);
            return uncategorized.length > 0 ? (
              <div className="products-grid">
                {uncategorized.map(product => renderProductCard(product))}
              </div>
            ) : null;
          })()}
          {Object.entries(groupedProducts).map(([category, products]) => (
            <div key={category} className="category-section">
              <div className="category-section-header">
                <div className="flex items-center gap-3">
                  <FontAwesomeIcon
                    icon={faTags}
                    className="category-section-icon"
                  />
                  <h3 className="category-section-title">
                    {category}
                  </h3>
                </div>
                <div className="category-section-line" />
              </div>
              <div className="products-grid">
                {products.map(product => renderProductCard(product))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(!editMode || previewMode) && activeCategory !== 'all' && hasProducts && (
        <div className="products-grid">
          {(store?.products || [])
            .filter(product => product.category_name === activeCategory)
            .map(product => renderProductCard(product))}
        </div>
      )}

      {editMode && !previewMode && editorTab === 'products' && (
        <>
          <div className="store-edit-cat-filter-bar">
            <button
              className={`store-edit-cat-filter-btn${editCatFilter === 'all' ? ' active' : ''}`}
              onClick={() => setEditCatFilter('all')}
            >
              Todas
            </button>
            {(store?.categories || []).map(cat => (
              <button
                key={cat.id}
                className={`store-edit-cat-filter-btn${editCatFilter === cat.name ? ' active' : ''}`}
                onClick={() => setEditCatFilter(cat.name)}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', padding: '6px 16px 0', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => {
                setSelectionMode(s => {
                  if (s) setSelectedProductIds(new Set());
                  return !s;
                });
              }}
              style={{
                padding: '6px 14px', borderRadius: '8px', border: selectionMode ? '2px solid #e53e3e' : '2px solid #ccc',
                background: selectionMode ? '#fff0f0' : '#fff', color: selectionMode ? '#e53e3e' : '#555',
                fontSize: '13px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              {selectionMode ? 'Cancelar selección' : 'Seleccionar'}
            </button>
            {selectionMode && (store?.products || []).length > 0 && (
              <button
                onClick={() => {
                  const allIds = new Set((store?.products || []).map(p => p.id));
                  setSelectedProductIds(prev => prev.size === allIds.size ? new Set() : allIds);
                }}
                style={{ padding: '6px 14px', borderRadius: '8px', border: '2px solid #ccc', background: '#fff', color: '#555', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                {selectedProductIds.size === (store?.products || []).length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            )}
            {selectionMode && selectedProductIds.size > 0 && (
              <button
                onClick={() => setShowDeleteSelectedModal(true)}
                style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', background: '#e53e3e', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                <FontAwesomeIcon icon={faTrash} style={{ marginRight: 6 }} />
                Eliminar {selectedProductIds.size} seleccionado{selectedProductIds.size !== 1 ? 's' : ''}
              </button>
            )}
            {!selectionMode && (store?.products || []).length > 0 && (
              <button
                onClick={() => setShowDeleteAllModal(true)}
                style={{ padding: '6px 14px', borderRadius: '8px', border: '2px solid #e53e3e', background: '#fff', color: '#e53e3e', fontSize: '13px', fontWeight: '600', cursor: 'pointer', marginLeft: 'auto' }}
              >
                <FontAwesomeIcon icon={faTrash} style={{ marginRight: 6 }} />
                Eliminar todos
              </button>
            )}
          </div>
        <DndContext
          sensors={editSensors}
          collisionDetection={closestCenter}
          onDragStart={handleEditDragStart}
          onDragEnd={handleEditDragEnd}
        >
          <SortableContext
            items={(store?.products || []).map(p => p.id)}
            strategy={rectSortingStrategy}
          >
            <div className="category-sections" ref={productsAreaRef}>
              {(() => {
                if (editCatFilter !== 'all') return null;
                const uncategorized = (store?.products || []).filter(p => !p.category_name);
                return uncategorized.length > 0 ? (
                  <div className="products-grid" style={{ padding: '0 16px' }}>
                    {uncategorized.map(product => (
                      <SortableProductCard key={product.id} product={product} onEdit={openProdModal} onDelete={deleteProd} onRecipe={setProdRecipeModal} currencySymbol={colors.currency.symbol} hideDecimals={!!(selectedConfiguration?.hide_decimals || store?.store?.hide_decimals)} selectionMode={selectionMode} isSelected={selectedProductIds.has(product.id)} onToggleSelect={(id) => setSelectedProductIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; })} />
                    ))}
                  </div>
                ) : null;
              })()}
              {Object.entries(groupedProducts)
                .filter(([category]) => editCatFilter === 'all' || editCatFilter === category)
                .map(([category, products]) => (
                <div key={category} className="category-section">
                  <div className="category-section-header">
                    <div className="flex items-center gap-3">
                      <FontAwesomeIcon icon={faTags} className="category-section-icon" />
                      <h3 className="category-section-title">{category}</h3>
                    </div>
                    <div className="category-section-line" />
                  </div>
                  <div className="products-grid" style={{ padding: '0 16px' }}>
                    {products.map(product => (
                      <SortableProductCard key={product.id} product={product} onEdit={openProdModal} onDelete={deleteProd} onRecipe={setProdRecipeModal} currencySymbol={colors.currency.symbol} hideDecimals={!!(selectedConfiguration?.hide_decimals || store?.store?.hide_decimals)} selectionMode={selectionMode} isSelected={selectedProductIds.has(product.id)} onToggleSelect={(id) => setSelectedProductIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; })} />
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ padding: '0 16px' }}>
                {renderAddProductCard()}
              </div>
            </div>
          </SortableContext>
          <DragOverlay>
            {editDragActiveId ? (() => {
              const product = store?.products?.find(p => p.id === editDragActiveId);
              if (!product) return null;
              return (
                <div className="store-product-wrapper" style={{ opacity: 0.8 }}>
                  <div className="store-product-card">
                    <div className="store-product-image">
                      <img src={getProductImageUrl(product.image)} alt={product.name} />
                    </div>
                  </div>
                </div>
              );
            })() : null}
          </DragOverlay>
        </DndContext>
        </>
      )}

      {editMode && !previewMode && editorTab === 'inventory' && (() => {
        const invItems = invTab === 'products'
          ? (store?.products || [])
          : invTab === 'extras'
          ? extras
          : ingredients;

        const badge = (item) => {
          const isUnlimited = item.unlimited_stock === true || item.unlimited_stock === 1 || item.unlimited_stock === '1';
          if (isUnlimited) return { label: '∞', color: '#D4AF37' };
          if (item.stock === 0) return { label: 'Agotado', color: '#ef4444' };
          if (item.stock <= 5) return { label: 'Bajo', color: '#f59e0b' };
          return { label: 'OK', color: '#22c55e' };
        };

        const rmBadge = (rm) => {
          const qty = parseFloat(rm.quantity) || 0;
          const min = parseFloat(rm.min_quantity) || 0;
          if (qty <= 0) return { label: 'Agotado', color: '#ef4444' };
          if (min > 0 && qty <= min) return { label: 'Stock bajo', color: '#f59e0b' };
          return { label: 'OK', color: '#22c55e' };
        };

        return (
          <div className="store-editor-complements">
            <div className="store-editor-comp-header">
              <span>Inventario</span>
            </div>

            <div style={{ display: 'flex', gap: '3px', margin: '8px 0', background: '#f5f5f5', borderRadius: '8px', padding: '4px', flexWrap: 'wrap' }}>
              {[
                { key: 'products', label: `Prod. (${(store?.products || []).length})` },
                { key: 'extras', label: `Extras (${extras.length})` },
                { key: 'ingredients', label: `Comp. (${ingredients.length})` },
                { key: 'raw', label: `Mat. Primas (${rawMats.length})` },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => { setInvTab(t.key); setInvEditingId(null); setRmEditingId(null); }}
                  style={{ flex: 1, padding: '6px 3px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: '700', background: invTab === t.key ? 'var(--store-primary)' : 'transparent', color: invTab === t.key ? 'var(--store-secondary)' : '#666', transition: 'all 0.15s', minWidth: '60px' }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {invTab === 'raw' ? (() => {
              const rmAlerts = rawMats.filter(rm => {
                const q = parseFloat(rm.quantity) || 0, m = parseFloat(rm.min_quantity) || 0;
                return q <= 0 || (m > 0 && q <= m);
              }).length;
              const filteredRm = rawMats.filter(rm => !rmSearch || rm.name.toLowerCase().includes(rmSearch.toLowerCase()));

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Alert banner */}
                  {rmAlerts > 0 && (
                    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FontAwesomeIcon icon={faExclamationTriangle} />
                      <span><strong>{rmAlerts}</strong> materia{rmAlerts > 1 ? 's' : ''} prima{rmAlerts > 1 ? 's' : ''} con stock bajo o agotado</span>
                    </div>
                  )}

                  {/* Search + New button */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      value={rmSearch}
                      onChange={e => setRmSearch(e.target.value)}
                      placeholder="Buscar materia prima…"
                      style={{ flex: 1, padding: '6px 10px', border: '1px solid #ddd', borderRadius: '7px', fontSize: '12px', outline: 'none', minWidth: 0 }}
                    />
                    <button
                      onClick={() => { setRmForm({ name: '', quantity: '', unit: 'unidades', min_quantity: '', cost_per_unit: '' }); setRmModal('new'); }}
                      style={{ background: 'var(--store-primary)', border: 'none', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer', color: 'var(--store-secondary)', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                    >
                      <FontAwesomeIcon icon={faPlus} /> Nueva
                    </button>
                  </div>

                  {/* List */}
                  {rmLoading ? (
                    <span style={{ color: '#999', fontSize: '13px', padding: '16px 8px', display: 'block', textAlign: 'center' }}>Cargando…</span>
                  ) : filteredRm.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 8px', color: '#aaa' }}>
                      <FontAwesomeIcon icon={faFlask} style={{ fontSize: '22px', marginBottom: '8px', display: 'block' }} />
                      <span style={{ fontSize: '12px' }}>{rawMats.length === 0 ? 'Sin materias primas. Crea la primera.' : 'Sin resultados'}</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {filteredRm.map(rm => {
                        const b = rmBadge(rm);
                        const isEditing = rmEditingId === rm.id;
                        const isRestock = rmRestockId === rm.id;
                        const qty = parseFloat(rm.quantity) || 0;
                        return (
                          <div key={rm.id} style={{ borderRadius: '10px', background: qty <= 0 ? 'rgba(239,68,68,0.04)' : '#fafafa', border: `1px solid ${qty <= 0 ? 'rgba(239,68,68,0.2)' : '#eee'}`, overflow: 'hidden' }}>
                            {/* Main row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 10px' }}>
                              <FontAwesomeIcon icon={faFlask} style={{ color: '#D4AF37', fontSize: '12px', flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rm.name}</div>
                                {rm.cost_per_unit > 0 && (
                                  <div style={{ fontSize: '10px', color: '#999' }}>${parseFloat(rm.cost_per_unit).toFixed(2)}/{rm.unit}</div>
                                )}
                              </div>

                              {/* Quantity — click to edit */}
                              {isEditing ? (
                                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                                  <input type="number" min="0" step="0.01" value={rmEditValue}
                                    onChange={e => setRmEditValue(e.target.value)}
                                    onKeyDown={async e => {
                                      if (e.key === 'Enter') { await updateRmQty(rm, parseFloat(rmEditValue) || 0); setRmEditingId(null); }
                                      if (e.key === 'Escape') setRmEditingId(null);
                                    }}
                                    autoFocus
                                    style={{ width: '60px', padding: '3px 5px', border: '1px solid var(--store-primary)', borderRadius: '5px', fontSize: '12px', textAlign: 'center', outline: 'none' }}
                                  />
                                  <button onClick={async () => { await updateRmQty(rm, parseFloat(rmEditValue) || 0); setRmEditingId(null); }} disabled={rmSaving}
                                    style={{ background: '#22c55e', border: 'none', borderRadius: '4px', padding: '3px 7px', cursor: 'pointer', color: '#fff', fontSize: '11px' }}>✓</button>
                                  <button onClick={() => setRmEditingId(null)}
                                    style={{ background: '#eee', border: 'none', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setRmEditingId(rm.id); setRmEditValue(String(qty)); setRmRestockId(null); }}
                                  title="Clic para ajustar cantidad"
                                  style={{ background: 'none', border: '1px dashed #bbb', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: b.color, minWidth: '42px', textAlign: 'center' }}
                                >
                                  {qty % 1 === 0 ? qty : qty.toFixed(2)}
                                </button>
                              )}

                              <span style={{ fontSize: '10px', color: '#888', flexShrink: 0 }}>{rm.unit}</span>

                              {/* Status badge */}
                              <span style={{ fontSize: '10px', fontWeight: '700', color: b.color, background: b.color + '18', borderRadius: '20px', padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>{b.label}</span>

                              {/* Actions */}
                              <button onClick={() => { setRmRestockId(isRestock ? null : rm.id); setRmRestockValue(''); setRmEditingId(null); }}
                                title="Reponer stock"
                                style={{ background: isRestock ? '#16a34a' : 'rgba(34,197,94,0.12)', border: `1px solid ${isRestock ? '#16a34a' : 'rgba(34,197,94,0.3)'}`, borderRadius: '5px', padding: '3px 6px', cursor: 'pointer', color: isRestock ? '#fff' : '#16a34a', fontSize: '11px', flexShrink: 0 }}>
                                <FontAwesomeIcon icon={faPlus} />
                              </button>
                              <button onClick={() => { setRmForm({ name: rm.name, quantity: String(qty), unit: rm.unit, min_quantity: rm.min_quantity > 0 ? String(rm.min_quantity) : '', cost_per_unit: rm.cost_per_unit > 0 ? String(rm.cost_per_unit) : '' }); setRmModal(rm); }}
                                title="Editar"
                                style={{ background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '5px', padding: '3px 6px', cursor: 'pointer', fontSize: '11px', color: '#b45309', flexShrink: 0 }}>
                                <FontAwesomeIcon icon={faEdit} /></button>
                              <button onClick={() => deleteRm(rm)} title="Eliminar"
                                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '5px', padding: '3px 6px', cursor: 'pointer', fontSize: '11px', color: '#ef4444', flexShrink: 0 }}>
                                <FontAwesomeIcon icon={faTrash} /></button>
                            </div>

                            {/* Restock row */}
                            {isRestock && (
                              <div style={{ display: 'flex', gap: '5px', padding: '8px 10px', borderTop: '1px solid #e5e7eb', background: '#f0fdf4', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '700', flexShrink: 0 }}>+ Reponer:</span>
                                <input type="number" min="0" step="0.01" autoFocus value={rmRestockValue}
                                  onChange={e => setRmRestockValue(e.target.value)}
                                  onKeyDown={async e => {
                                    if (e.key === 'Enter') {
                                      const add = parseFloat(rmRestockValue) || 0;
                                      await updateRmQty(rm, qty + add);
                                      setRmRestockId(null); setRmRestockValue('');
                                    }
                                    if (e.key === 'Escape') setRmRestockId(null);
                                  }}
                                  placeholder={`Agregar a ${qty % 1 === 0 ? qty : qty.toFixed(2)} ${rm.unit}`}
                                  style={{ flex: 1, padding: '5px 8px', border: '1px solid #86efac', borderRadius: '6px', fontSize: '12px', outline: 'none', minWidth: 0 }}
                                />
                                <button onClick={async () => { const add = parseFloat(rmRestockValue) || 0; await updateRmQty(rm, qty + add); setRmRestockId(null); setRmRestockValue(''); }}
                                  disabled={rmSaving || !rmRestockValue}
                                  style={{ background: '#16a34a', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', color: '#fff', fontSize: '12px', fontWeight: '700', flexShrink: 0, opacity: !rmRestockValue ? 0.5 : 1 }}>
                                  Agregar
                                </button>
                                <button onClick={() => setRmRestockId(null)}
                                  style={{ background: '#eee', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontSize: '11px', flexShrink: 0 }}>✕</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })() : invItems.length === 0 ? (
              <span style={{ color: '#999', fontSize: '13px', padding: '16px 8px', display: 'block', textAlign: 'center' }}>Sin ítems</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {invItems.map(item => {
                  const isUnlimited = item.unlimited_stock === true || item.unlimited_stock === 1 || item.unlimited_stock === '1';
                  const b = badge(item);
                  const isEditing = invEditingId === item.id;
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', background: '#fafafa', border: '1px solid #eee' }}>
                      {item.image && <img src={getImageUrl(item.image)} alt="" style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />}
                      <span style={{ flex: 1, fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: b.color, minWidth: '40px', textAlign: 'center' }}>{b.label}</span>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input
                            type="number" min="0" value={invEditValue}
                            onChange={e => setInvEditValue(e.target.value)}
                            onKeyDown={async e => {
                              if (e.key === 'Enter') {
                                setInvSaving(true);
                                if (invTab === 'products') await updateProductStock(item.id, parseInt(invEditValue) || 0, isUnlimited);
                                else await updateComplementStock(invTab === 'extras' ? 'extra' : 'ingredient', item.id, parseInt(invEditValue) || 0, isUnlimited);
                                setInvEditingId(null);
                                setInvSaving(false);
                              }
                              if (e.key === 'Escape') setInvEditingId(null);
                            }}
                            autoFocus
                            style={{ width: '52px', padding: '4px 6px', border: '1px solid var(--store-primary)', borderRadius: '6px', fontSize: '13px', textAlign: 'center', outline: 'none' }}
                          />
                          <button
                            onClick={async () => {
                              setInvSaving(true);
                              if (invTab === 'products') await updateProductStock(item.id, parseInt(invEditValue) || 0, isUnlimited);
                              else await updateComplementStock(invTab === 'extras' ? 'extra' : 'ingredient', item.id, parseInt(invEditValue) || 0, isUnlimited);
                              setInvEditingId(null);
                              setInvSaving(false);
                            }}
                            disabled={invSaving}
                            style={{ background: 'var(--store-primary)', border: 'none', borderRadius: '5px', padding: '4px 7px', cursor: 'pointer', color: 'var(--store-secondary)', fontSize: '12px', fontWeight: '700' }}
                          >✓</button>
                          <button onClick={() => setInvEditingId(null)} style={{ background: '#eee', border: 'none', borderRadius: '5px', padding: '4px 7px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                        </div>
                      ) : (
                        <span
                          onClick={() => { setInvEditingId(item.id); setInvEditValue(isUnlimited ? '0' : String(item.stock)); }}
                          title="Click para editar stock"
                          style={{ cursor: 'pointer', fontSize: '13px', fontWeight: '700', minWidth: '32px', textAlign: 'center', borderBottom: '1px dashed #bbb' }}
                        >
                          {isUnlimited ? <FontAwesomeIcon icon={faInfinity} style={{ color: '#D4AF37' }} /> : item.stock}
                        </span>
                      )}
                      <button
                        onClick={async () => {
                          const newUnlimited = !isUnlimited;
                          if (invTab === 'products') await updateProductStock(item.id, item.stock, newUnlimited);
                          else await updateComplementStock(invTab === 'extras' ? 'extra' : 'ingredient', item.id, item.stock, newUnlimited);
                        }}
                        title={isUnlimited ? 'Quitar ilimitado' : 'Marcar ilimitado'}
                        style={{ background: isUnlimited ? 'rgba(212,175,55,0.15)' : '#eee', border: isUnlimited ? '1px solid #D4AF37' : '1px solid #ddd', borderRadius: '6px', padding: '3px 7px', cursor: 'pointer', fontSize: '11px', color: isUnlimited ? '#D4AF37' : '#888', fontWeight: '700', flexShrink: 0 }}
                      >
                        <FontAwesomeIcon icon={faInfinity} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {editMode && !previewMode && editorTab === 'orders' && (
        <div className="store-editor-complements">
          <div className="store-editor-comp-header">
            <span>Pedidos en vivo ({liveOrders.length})</span>
          </div>
          {liveOrders.length === 0 ? (
            <span style={{ color: '#999', fontSize: '13px', padding: '12px 8px', display: 'block', textAlign: 'center' }}>Sin pedidos aún</span>
          ) : (
            liveOrders.map(order => (
              <div key={order.id} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--store-primary)' }}>
                      {order.order_number ? `#${order.order_number}` : `Pedido ${order.id}`}
                    </span>
                    {order.table_number != null && (
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>Mesa {order.table_number}</span>
                    )}
                  </div>
                  <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--store-accent)' }}>
                    {colors.currency.symbol}{Number(order.total).toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  {order.payment_method === 'cash' ? '💵 Efectivo' : order.payment_method === 'card' ? '💳 Tarjeta' : order.payment_method}
                  {' · '}
                  {order.order_type === 'takeout' ? '🛍 Para llevar' : '🍽 Servir'}
                </div>
                {(order.items || []).length > 0 && (
                  <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {(order.items || []).map((item, i) => (
                      <div key={i} style={{ fontSize: '12px', color: '#444', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{item.quantity}× {item.product_name || item.name || `Producto ${item.product_id}`}</span>
                        <span>{colors.currency.symbol}{Number(item.unit_price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {editMode && !previewMode && editorTab === 'combos' && (() => {
        const storeProds = store?.products || [];
        const autoTotal = (editorComboForm?.items || []).reduce((s, it) => {
          const p = storeProds.find(p => String(p.id) === String(it.product_id));
          return s + (p ? Number(p.price) * it.quantity : 0);
        }, 0);
        const previewPrice = () => {
          if (!editorComboForm) return 0;
          if (editorComboForm.discount_type === 'fixed') return parseFloat(editorComboForm.fixed_price) || 0;
          if (editorComboForm.discount_type === 'percent') return autoTotal * (1 - (parseFloat(editorComboForm.discount_value) || 0) / 100);
          return autoTotal;
        };
        const filteredProds = storeProds.filter(p => !editorComboProdSearch || p.name.toLowerCase().includes(editorComboProdSearch.toLowerCase()));

        return (
          <div className="store-editor-complements" style={{ overflowY: 'auto' }}>
            <div className="store-editor-comp-header">
              <span>Combos y Promociones ({editorCombos.length})</span>
              <button
                onClick={openEditorComboCreate}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', border: 'none', borderRadius: '8px', background: 'var(--store-primary, #1a1a2e)', color: 'var(--store-secondary, #fff)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                <FontAwesomeIcon icon={faPlus} /> Nuevo combo
              </button>
            </div>

            {!editorCombosLoaded ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#999', fontSize: '13px' }}>Cargando...</div>
            ) : editorCombos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#999', fontSize: '13px' }}>No hay combos todavía.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0' }}>
                {editorCombos.map(combo => (
                  <div key={combo.id} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden', opacity: combo.is_active ? 1 : 0.6 }}>
                    <div style={{ display: 'flex', gap: '10px', padding: '10px' }}>
                      <div style={{ width: '52px', height: '52px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {combo.image
                          ? <img src={getProductImageUrl(combo.image)} alt={combo.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <FontAwesomeIcon icon={faLayerGroup} style={{ color: '#D4AF37', fontSize: '1.2rem' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#111', lineHeight: 1.2 }}>{combo.name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {(combo.items || []).map(it => `${it.quantity}× ${it.product_name}`).join(' + ')}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--store-accent, #D4AF37)' }}>${formatPrice(combo.price)}</span>
                          {combo.discount_type !== 'auto' && combo.auto_price > 0 && combo.auto_price !== combo.price && (
                            <span style={{ fontSize: '0.72rem', color: '#bbb', textDecoration: 'line-through' }}>${formatPrice(combo.auto_price)}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                        <button onClick={() => openEditorComboEdit(combo)} className="store-prod-edit-btn" style={{ width: 30, height: 30, fontSize: 12 }}>
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button onClick={() => toggleEditorComboActive(combo)} style={{ width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer', background: combo.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(0,0,0,0.06)', color: combo.is_active ? '#16a34a' : '#999', fontSize: 14 }}>
                          {combo.is_active ? '✓' : '○'}
                        </button>
                        <button onClick={() => deleteEditorCombo(combo.id)} className="store-prod-edit-btn danger" style={{ width: 30, height: 30, fontSize: 12 }}>
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {editorComboModal && editorComboForm && (
              <div className="store-modal-overlay" onClick={() => setEditorComboModal(null)}>
                <div className="store-prod-modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: '0 0 14px', color: 'var(--store-primary)', textAlign: 'center' }}>
                    {editorComboModal.editing ? 'Editar Combo' : 'Nuevo Combo'}
                  </h3>

                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {editorComboError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}>{editorComboError}</div>}

                    {/* Imagen */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', background: '#f3f4f6', border: '2px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {editorComboForm.imageFile
                            ? <img src={URL.createObjectURL(editorComboForm.imageFile)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : editorComboForm.image
                              ? <img src={getProductImageUrl(editorComboForm.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <FontAwesomeIcon icon={faCamera} style={{ color: '#9ca3af', fontSize: '1.5rem' }} />}
                        </div>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>Imagen (opcional)</span>
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files[0]; if (f) setEditorComboForm(prev => ({ ...prev, imageFile: f })); }} />
                      </label>
                    </div>

                    {/* Nombre */}
                    <input className="store-prod-modal-input main" placeholder="Nombre del combo *"
                      value={editorComboForm.name}
                      onChange={e => setEditorComboForm(prev => ({ ...prev, name: e.target.value }))} />

                    <input className="store-prod-modal-input" placeholder="Descripción (opcional)"
                      value={editorComboForm.description}
                      onChange={e => setEditorComboForm(prev => ({ ...prev, description: e.target.value }))} />

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={editorComboForm.is_active}
                        onChange={e => setEditorComboForm(prev => ({ ...prev, is_active: e.target.checked }))} />
                      Visible en la tienda
                    </label>

                    {/* Productos */}
                    <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>Productos incluidos</div>

                      {editorComboForm.items.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                          {editorComboForm.items.map(it => {
                            const p = storeProds.find(p => String(p.id) === String(it.product_id));
                            if (!p) return null;
                            return (
                              <div key={it.product_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '8px', padding: '6px 8px' }}>
                                <span style={{ flex: 1, fontSize: '0.83rem', color: '#222' }}>{p.name}</span>
                                <span style={{ fontSize: '0.75rem', color: '#888' }}>${Number(p.price).toFixed(0)}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <button type="button" onClick={() => setEditorComboForm(prev => ({ ...prev, items: prev.items.map(i => String(i.product_id) === String(it.product_id) ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i).filter(i => i.quantity > 0) }))}
                                    style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: 'rgba(0,0,0,0.08)', cursor: 'pointer', fontSize: 13 }}>−</button>
                                  <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 700, fontSize: '0.85rem' }}>{it.quantity}</span>
                                  <button type="button" onClick={() => setEditorComboForm(prev => ({ ...prev, items: prev.items.map(i => String(i.product_id) === String(it.product_id) ? { ...i, quantity: i.quantity + 1 } : i) }))}
                                    style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: 'rgba(212,175,55,0.2)', cursor: 'pointer', color: '#D4AF37', fontSize: 13 }}>+</button>
                                </div>
                                <button type="button" onClick={() => setEditorComboForm(prev => ({ ...prev, items: prev.items.filter(i => String(i.product_id) !== String(it.product_id)) }))}
                                  style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: 'rgba(239,68,68,0.12)', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>✕</button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <input className="store-prod-modal-input" placeholder="Buscar producto..."
                        value={editorComboProdSearch}
                        onChange={e => setEditorComboProdSearch(e.target.value)} />
                      <div style={{ maxHeight: '150px', overflowY: 'auto', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {filteredProds.slice(0, 30).map(p => (
                          <button key={p.id} type="button" onClick={() => addProductToEditorCombo(p)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer' }}>
                            <span style={{ flex: 1, fontSize: '0.82rem', color: '#222' }}>{p.name}</span>
                            <span style={{ fontSize: '0.72rem', color: '#888' }}>${Number(p.price).toFixed(0)}</span>
                            <span style={{ color: '#D4AF37', fontWeight: 700, fontSize: '1rem' }}>+</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Precio */}
                    {editorComboForm.items.length > 0 && (
                      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '10px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>Precio del combo</div>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                          {[{ v: 'auto', l: 'Automático' }, { v: 'percent', l: '% Descuento' }, { v: 'fixed', l: 'Precio fijo' }].map(opt => (
                            <button key={opt.v} type="button" onClick={() => setEditorComboForm(prev => ({ ...prev, discount_type: opt.v }))}
                              style={{ flex: 1, padding: '5px 2px', fontSize: '0.72rem', fontWeight: 600, borderRadius: '7px', cursor: 'pointer',
                                border: `1px solid ${editorComboForm.discount_type === opt.v ? 'var(--store-primary)' : '#e5e7eb'}`,
                                background: editorComboForm.discount_type === opt.v ? 'var(--store-primary)' : '#f9fafb',
                                color: editorComboForm.discount_type === opt.v ? 'var(--store-secondary)' : '#555' }}>
                              {opt.l}
                            </button>
                          ))}
                        </div>
                        {editorComboForm.discount_type === 'percent' && (
                          <input type="number" min="0" max="100" step="0.1" className="store-prod-modal-input" placeholder="Descuento %" value={editorComboForm.discount_value} onChange={e => setEditorComboForm(prev => ({ ...prev, discount_value: e.target.value }))} />
                        )}
                        {editorComboForm.discount_type === 'fixed' && (
                          <input type="number" min="0" step="0.01" className="store-prod-modal-input" placeholder="Precio fijo del combo" value={editorComboForm.fixed_price} onChange={e => setEditorComboForm(prev => ({ ...prev, fixed_price: e.target.value }))} />
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(212,175,55,0.08)', borderRadius: '8px', marginTop: '8px' }}>
                          {editorComboForm.discount_type !== 'auto' && <span style={{ fontSize: '0.78rem', color: '#bbb', textDecoration: 'line-through' }}>${autoTotal.toFixed(0)}</span>}
                          {editorComboForm.discount_type === 'auto' && <span style={{ fontSize: '0.78rem', color: '#888' }}>Total automático</span>}
                          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#D4AF37', marginLeft: 'auto' }}>${Math.max(0, previewPrice()).toFixed(0)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
                    <button onClick={() => setEditorComboModal(null)} className="store-prod-modal-btn cancel">Cancelar</button>
                    <button onClick={submitEditorCombo} disabled={editorComboSaving} className={`store-prod-modal-btn confirm${editorComboSaving ? ' disabled' : ''}`}>
                      {editorComboSaving ? 'Guardando...' : (editorComboModal.editing ? 'Guardar' : 'Crear combo')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <PluginSlot name="store-footer" context={{ storeId: store?.store?.id, code }} />

      {hasProducts && !adminEditToken && (
      <div className="cart-bar">
        <div className="cart-bar-left" onClick={() => setCartOpen(true)}>
          <div className="cart-bar-icon">
            <FontAwesomeIcon icon={faShoppingCart} />
            <span className="cart-bar-count">{getCartCount()}</span>
          </div>
          <span className="cart-bar-text">{t('viewCart', lang)}</span>
        </div>
        <div className="cart-bar-right">
          <span className="cart-bar-total">
            {colors.currency.symbol}{formatPrice(getCartTotal())}
          </span>
          <button
            onClick={() => setCartOpen(true)}
            className="cart-bar-pay-btn store-glow-pulse"
          >
            {t('pay', lang)}
          </button>
        </div>
      </div>
      )}

      {notification && (
        <div className="toast">
          <img
            src={getProductImageUrl(notification.image)}
            alt={notification.name}
            className="toast-image"
          />
          <div>
            <div className="toast-name">{notification.name}</div>
            {notification.agotado ? (
              <div className="toast-status-soldout">{t('soldOut', lang)}</div>
            ) : (
              <div className="toast-status-added">{t('added', lang)} <FontAwesomeIcon icon={faCheck} /></div>
            )}
          </div>
        </div>
      )}

      {!isTouchDevice && (
        <input
          ref={barcodeInputRef}
          type="text"
          inputMode="none"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && barcode) {
              e.preventDefault();
              handleBarcodeScan(barcode);
              setBarcode('');
            }
          }}
          className="barcode-input"
        />
      )}

      {ingredientsModalOpen && selectedProduct && (
        <div
          className="store-modal-overlay"
          onClick={() => setIngredientsModalOpen(false)}
        >
          <div
            className="store-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="store-modal-header">
              <button
                onClick={() => {
                  setIngredientsModalOpen(false);
                  setProductModalStep('main');
                }}
                className="store-modal-close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
              <h2 style={{ margin: 0, padding: '10px 40px 0 40px' }}>
                {productModalStep === 'main' ? complementsLabel : '1. ' + complementsLabel}
              </h2>
            </div>

            <div className="flex justify-center items-center gap-3" style={{
              padding: '12px 20px',
              borderBottom: '2px solid var(--store-primary)'
            }}>
              <span className="font-bold" style={{ fontSize: '16px', color: 'var(--store-primary)' }}>
                {t('selected', lang)}:
              </span>
              <span className="font-bold" style={{
                fontSize: '20px',
                color: productConfig.selectedIngredients.length > 0 ? 'var(--store-accent)' : 'var(--store-primary)'
              }}>
                {productConfig.selectedIngredients.length}
              </span>
              {selectedProduct.max_ingredients > 0 && (
                <>
                  <span style={{ color: 'var(--store-primary)' }}>/</span>
                  <span className="font-bold" style={{ fontSize: '20px', color: 'var(--store-primary)' }}>
                    {selectedProduct.max_ingredients}
                  </span>
                </>
              )}
            </div>

            <div className="store-modal-body">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px'
              }}>
                {selectedProduct.ingredients.map(ingredient => {
                  const ingredientIsOutOfStock = !ingredient.unlimited_stock && ingredient.stock === 0;
                  const ingredientStockLabel = !ingredient.unlimited_stock && ingredient.stock > 0 ? `${ingredient.stock} ${ingredient.stock_unit || 'un.'}` : null;
                  const isSelected = productConfig.selectedIngredients.find(i => i.id === ingredient.id);
                  return (
                  <div
                    key={ingredient.id}
                    className={`option-item${isSelected ? ' selected' : ''}`}
                    style={{
                      flexDirection: 'column',
                      padding: 0,
                      backgroundColor: ingredientIsOutOfStock ? '#f8f9fa' : (isSelected ? 'var(--store-accent)' : '#fff'),
                      borderColor: isSelected ? 'var(--store-accent)' : ingredientIsOutOfStock ? '#dc3545' : '#e0e0e0',
                      borderWidth: '2px',
                      cursor: ingredientIsOutOfStock ? 'not-allowed' : 'pointer',
                      overflow: 'hidden',
                      position: 'relative',
                      opacity: ingredientIsOutOfStock ? 0.6 : 1
                    }}
                    onClick={() => toggleIngredient(ingredient)}
                  >
                    {ingredientIsOutOfStock && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        zIndex: 2,
                      }}>
                        {t('soldOut', lang)}
                      </div>
                    )}
                    {ingredient.included_by_default && (
                      <div style={{
                        position: 'absolute', top: '6px', right: '6px', zIndex: 2,
                        backgroundColor: isSelected ? '#16a34a' : '#dc3545',
                        color: '#fff', padding: '2px 8px', borderRadius: '6px',
                        fontSize: '10px', fontWeight: 800, letterSpacing: '0.3px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.25)'
                      }}>
                        {isSelected ? 'INCLUIDO' : `SIN ${ingredient.name.toUpperCase()}`}
                      </div>
                    )}
                    <img
                      src={getProductImageUrl(ingredient.image)}
                      alt={ingredient.name}
                      style={{
                        width: '100%',
                        height: '110px',
                        objectFit: 'cover',
                        borderBottom: `1px solid ${isSelected ? 'var(--store-accent)' : '#e0e0e0'}`
                      }}
                    />
                    <div className="text-center" style={{ padding: '8px' }}>
                      <div style={{
                        fontWeight: '600',
                        fontSize: '12px',
                        color: isSelected ? '#fff' : 'var(--store-primary)',
                        marginBottom: '2px',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: '1.3'
                      }}>
                        {ingredient.name}
                      </div>
                      {Number(ingredient.price) > 0 && !ingredient.included_by_default && (
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: isSelected ? '#fff' : 'var(--store-accent)'
                        }}>
                          +{colors.currency.symbol}{formatPrice(ingredient.price)}
                        </div>
                      )}
                      {ingredientStockLabel && (
                        <div style={{
                          fontSize: '10px',
                          color: isSelected ? 'rgba(255,255,255,0.7)' : ingredient.stock <= 5 ? '#f59e0b' : '#888',
                          marginTop: '2px',
                          fontWeight: ingredient.stock <= 5 ? '700' : '400',
                        }}>
                          {ingredient.stock <= 5 ? '⚠ ' : ''}{ingredientStockLabel}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--store-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <FontAwesomeIcon icon={faCheck} style={{ fontSize: '12px', color: 'var(--store-accent)' }} />
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            </div>

            <div className="store-modal-footer">
              {productModalStep === 'main' ? (
                <button
                  onClick={() => setIngredientsModalOpen(false)}
                  className="btn btn-lg btn-full store-glow-pulse"
                  style={{
                    backgroundColor: 'var(--store-accent)',
                    color: 'var(--store-primary)',
                    fontWeight: '700'
                  }}
                >
                  {t('done', lang)}
                </button>
              ) : (
                <button
                  onClick={handleNextToExtras}
                  disabled={addingToCart}
                  className="btn btn-lg btn-full store-glow-pulse"
                  style={{
                    backgroundColor: addingToCart ? '#28a745' : 'var(--store-accent)',
                    color: 'var(--store-primary)',
                    fontWeight: '700'
                  }}
                >
                  {((selectedProduct.extras?.length > 0) || (selectedProduct.complement_groups?.length > 0)) ? <>{t('next', lang)} <FontAwesomeIcon icon={faChevronRight} /></> : (addingToCart ? t('addedExclaim', lang) : `${t('addBtn', lang)} - ${colors.currency.symbol}${formatPrice(calculateProductPrice() * productConfig.quantity)}`)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {extrasModalOpen && selectedProduct && (
        <div
          className="store-modal-overlay"
          onClick={() => setExtrasModalOpen(false)}
        >
          <div
            className="store-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="store-modal-header">
              <button
                onClick={() => {
                  setExtrasModalOpen(false);
                  setProductModalStep('main');
                }}
                className="store-modal-close"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
              <h2 style={{ margin: 0, padding: '10px 40px 0 40px' }}>
                {productModalStep === 'main' ? extrasLabel : '2. ' + extrasLabel}
              </h2>
            </div>

            <div className="flex justify-center items-center gap-3" style={{
              padding: '12px 20px',
              borderBottom: '2px solid var(--store-primary)'
            }}>
              <span className="font-bold" style={{ fontSize: '16px', color: 'var(--store-primary)' }}>
                {t('selected', lang)}:
              </span>
              <span className="font-bold" style={{
                fontSize: '20px',
                color: productConfig.selectedExtras.length > 0 ? 'var(--store-accent)' : 'var(--store-primary)'
              }}>
                {productConfig.selectedExtras.length}
              </span>
              {selectedProduct.max_extras > 0 && (
                <>
                  <span style={{ color: 'var(--store-primary)' }}>/</span>
                  <span className="font-bold" style={{ fontSize: '20px', color: 'var(--store-primary)' }}>
                    {selectedProduct.max_extras}
                  </span>
                </>
              )}
            </div>

            <div className="store-modal-body">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px'
              }}>
                {selectedProduct.extras.map(extra => {
                  const extraIsOutOfStock = !extra.unlimited_stock && extra.stock === 0;
                  const extraStockLabel = !extra.unlimited_stock && extra.stock > 0 ? `${extra.stock} ${extra.stock_unit || 'un.'}` : null;
                  const isSelected = productConfig.selectedExtras.find(e => e.id === extra.id);
                  return (
                  <div
                    key={extra.id}
                    className={`option-item${isSelected ? ' selected' : ''}`}
                    style={{
                      flexDirection: 'column',
                      padding: 0,
                      backgroundColor: extraIsOutOfStock ? '#f8f9fa' : (isSelected ? 'var(--store-accent)' : '#fff'),
                      borderColor: isSelected ? 'var(--store-accent)' : extraIsOutOfStock ? '#dc3545' : '#e0e0e0',
                      borderWidth: '2px',
                      cursor: extraIsOutOfStock ? 'not-allowed' : 'pointer',
                      overflow: 'hidden',
                      position: 'relative',
                      opacity: extraIsOutOfStock ? 0.6 : 1
                    }}
                    onClick={() => toggleExtra(extra)}
                  >
                    {extraIsOutOfStock && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        zIndex: 2,
                      }}>
                        {t('soldOut', lang)}
                      </div>
                    )}
                    <img
                      src={getProductImageUrl(extra.image)}
                      alt={extra.name}
                      style={{
                        width: '100%',
                        height: '110px',
                        objectFit: 'cover',
                        borderBottom: `1px solid ${isSelected ? 'var(--store-accent)' : '#e0e0e0'}`
                      }}
                    />
                    <div className="text-center" style={{ padding: '8px' }}>
                      <div style={{
                        fontWeight: '600',
                        fontSize: '12px',
                        color: isSelected ? '#fff' : 'var(--store-primary)',
                        marginBottom: '2px',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: '1.3'
                      }}>
                        {extra.name}
                      </div>
                      {Number(extra.price) > 0 && (
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: isSelected ? '#fff' : 'var(--store-accent)'
                        }}>
                          +{colors.currency.symbol}{formatPrice(extra.price)}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--store-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <FontAwesomeIcon icon={faCheck} style={{ fontSize: '12px', color: 'var(--store-accent)' }} />
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            </div>

            <div className="store-modal-footer">
              {productModalStep === 'main' ? (
                <button
                  onClick={() => setExtrasModalOpen(false)}
                  className="btn btn-lg btn-full store-glow-pulse"
                  style={{
                    backgroundColor: 'var(--store-accent)',
                    color: 'var(--store-primary)',
                    fontWeight: '700'
                  }}
                >
                  {t('done', lang)}
                </button>
              ) : (
                <button
                  onClick={proceedAfterExtras}
                  disabled={addingToCart}
                  className="btn btn-lg btn-full store-glow-pulse"
                  style={{
                    backgroundColor: addingToCart ? '#28a745' : 'var(--store-accent)',
                    color: 'var(--store-primary)',
                    fontWeight: '700'
                  }}
                >
                  {(selectedProduct.complement_groups?.length > 0)
                    ? <>{t('next', lang)} <FontAwesomeIcon icon={faChevronRight} /></>
                    : (addingToCart ? t('addedExclaim', lang) : `${t('addBtn', lang)} - ${colors.currency.symbol}${formatPrice(calculateProductPrice() * productConfig.quantity)}`)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Secciones personalizadas (cliente) ── */}
      {complementGroupsModalOpen && selectedProduct && (
        <div className="store-modal-overlay" onClick={() => setComplementGroupsModalOpen(false)}>
          <div className="store-modal" onClick={(e) => e.stopPropagation()}>
            <div className="store-modal-header">
              <button onClick={() => setComplementGroupsModalOpen(false)} className="store-modal-close">
                <FontAwesomeIcon icon={faTimes} />
              </button>
              <h2 style={{ margin: 0, padding: '10px 40px 0 40px' }}>Personalizá tu pedido</h2>
            </div>

            <div className="store-modal-body">
              {(selectedProduct.complement_groups || []).map(group => {
                const selInGroup = (productConfig.selectedComplements || []).filter(s => s.group_id === group.id);
                return (
                  <div key={group.id} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: '2px solid var(--store-primary)', paddingBottom: 6, marginBottom: 10 }}>
                      <span className="font-bold" style={{ fontSize: 17, color: 'var(--store-primary)' }}>
                        {group.name} {group.required && <span style={{ color: '#dc3545', fontSize: 13 }}>*</span>}
                      </span>
                      <span style={{ fontSize: 12, color: '#888' }}>
                        {selInGroup.length}{group.max_select > 0 ? `/${group.max_select}` : ''} elegido(s)
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                      {group.options.map(opt => {
                        const outOfStock = !opt.unlimited_stock && opt.stock === 0;
                        const isSel = selInGroup.some(s => s.option_id === opt.id);
                        return (
                          <div
                            key={opt.id}
                            className={`option-item${isSel ? ' selected' : ''}`}
                            onClick={() => { if (!outOfStock) toggleComplementOption(group, opt); }}
                            style={{
                              flexDirection: 'column', padding: 0,
                              backgroundColor: outOfStock ? '#f8f9fa' : (isSel ? 'var(--store-accent)' : '#fff'),
                              borderColor: isSel ? 'var(--store-accent)' : outOfStock ? '#dc3545' : '#e0e0e0',
                              borderWidth: '2px', cursor: outOfStock ? 'not-allowed' : 'pointer',
                              overflow: 'hidden', position: 'relative', opacity: outOfStock ? 0.6 : 1, borderStyle: 'solid', borderRadius: 12
                            }}
                          >
                            {opt.image && (
                              <img src={getProductImageUrl(opt.image)} alt={opt.name} style={{ width: '100%', height: 70, objectFit: 'cover' }} />
                            )}
                            <div style={{ padding: '8px 6px', textAlign: 'center', width: '100%' }}>
                              <div className="font-bold" style={{ fontSize: 13, color: isSel ? 'var(--store-primary)' : '#333' }}>{opt.name}</div>
                              {Number(opt.price) > 0 && (
                                <div style={{ fontSize: 12, color: isSel ? 'var(--store-primary)' : 'var(--store-accent)', fontWeight: 700 }}>
                                  +{colors.currency.symbol}{formatPrice(opt.price)}
                                </div>
                              )}
                              {outOfStock && <div style={{ fontSize: 10, color: '#dc3545' }}>Agotado</div>}
                            </div>
                            {isSel && (
                              <div style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', backgroundColor: 'var(--store-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FontAwesomeIcon icon={faCheck} style={{ fontSize: 12, color: 'var(--store-accent)' }} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="store-modal-footer">
              <button
                onClick={finishGroupsStep}
                disabled={addingToCart}
                className="btn btn-lg btn-full store-glow-pulse"
                style={{ backgroundColor: addingToCart ? '#28a745' : 'var(--store-accent)', color: 'var(--store-primary)', fontWeight: '700' }}
              >
                {addingToCart ? t('addedExclaim', lang) : `${t('addBtn', lang)} - ${colors.currency.symbol}${formatPrice(calculateProductPrice() * productConfig.quantity)}`}
              </button>
            </div>
          </div>
        </div>
      )}


      {cartOpen && (
        <div className="cart-overlay" onClick={() => { setCartOpen(false); setTipEnabled(false); setTipPercent(0); }} />
      )}

      <div className={`store-cart-sheet${cartOpen ? ' open' : ''}`}>
        <div className="store-cart-handle" onClick={() => setCartOpen(false)}>
          <div className="store-cart-handle-bar" />
        </div>

        <div className="store-cart-header">
          <div className="store-cart-header-left">
            <FontAwesomeIcon icon={faShoppingCart} />
            <h2>{t('myOrder', lang)}</h2>
          </div>
          <button className="store-cart-close" onClick={() => setCartOpen(false)}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="store-cart-body">
          {cart.length === 0 ? (
            <div className="store-cart-empty">
              <FontAwesomeIcon icon={faShoppingCart} className="store-cart-empty-icon" />
              <p className="store-cart-empty-title">{t('cartEmpty', lang)}</p>
              <p className="store-cart-empty-text">{t('cartEmptyDesc', lang)}</p>
            </div>
          ) : (
            <>
              {cart.map(item => (
                <div className="store-cart-item" key={item.id}>
                  <div className="store-cart-item-thumb">
                    {item._isCombo ? (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(212,175,55,0.15)', borderRadius: '8px' }}>
                        {item.product_image
                          ? <img src={getProductImageUrl(item.product_image)} alt={item.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                          : <FontAwesomeIcon icon={faLayerGroup} style={{ color: 'var(--store-accent)', fontSize: '1.4rem' }} />}
                      </div>
                    ) : (
                      <img src={getProductImageUrl(item.product_image)} alt={item.product_name} />
                    )}
                  </div>
                  <div className="store-cart-item-content">
                    <div className="store-cart-item-top">
                      <h4 className="store-cart-item-name">{item.product_name}</h4>
                      <button className="store-cart-item-remove" onClick={() => removeFromCart(item.id)}>
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </div>

                    {item._isCombo && (item._comboConfig || []).map(ci => (
                      <div key={ci.product_id} style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.55)', lineHeight: 1.4 }}>
                        {ci.quantity}× {ci.product_name}
                        {ci.selected_extras?.length > 0 && <span> +{ci.selected_extras.map(x => x?.name || x).join(', ')}</span>}
                        {ci.selected_complements?.length > 0 && <span> +{ci.selected_complements.map(x => x?.name || x).join(', ')}</span>}
                      </div>
                    ))}

                    {!item._isCombo && item.selected_ingredients && item.selected_ingredients.length > 0 && (
                      <div className="store-cart-item-extras">{item.selected_ingredients.map(x => typeof x === 'string' ? x : x?.name).filter(Boolean).join(', ')}</div>
                    )}
                    {!item._isCombo && item.selected_extras && item.selected_extras.length > 0 && (
                      <div className="store-cart-item-extras">+ {item.selected_extras.map(x => typeof x === 'string' ? x : x?.name).filter(Boolean).join(', ')}</div>
                    )}
                    {!item._isCombo && item.selected_complements && item.selected_complements.length > 0 && (
                      <div className="store-cart-item-extras">+ {item.selected_complements.map(x => typeof x === 'string' ? x : x?.name).filter(Boolean).join(', ')}</div>
                    )}

                    <div className="store-cart-item-bottom">
                      <div className="store-cart-qty">
                        <button className="store-cart-qty-btn" onClick={() => updateQuantity(item.id, -1)}>
                          <FontAwesomeIcon icon={faMinus} />
                        </button>
                        <span className="store-cart-qty-value">{item.quantity}</span>
                        <button className="store-cart-qty-btn" onClick={() => updateQuantity(item.id, 1)}>
                          <FontAwesomeIcon icon={faPlus} />
                        </button>
                      </div>
                      <div className="store-cart-item-total">
                        {colors.currency.symbol}{formatPrice(item.total)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="store-cart-summary">
                {appliedCoupon && (
                  <div className="store-cart-summary-row store-cart-discount">
                    <span>{t('discount', lang)} ({appliedCoupon.coupon_code})</span>
                    <span>-{colors.currency.symbol}{formatPrice(appliedCoupon.discount_total || 0)}</span>
                  </div>
                )}
                {loyaltyDiscount > 0 && loyaltyCustomer && (
                  <div className="store-cart-summary-row store-cart-discount" style={{ color: '#16a34a' }}>
                    <span>⭐ Descuento cliente habitual ({loyaltyDiscount}%)</span>
                    <span>-{colors.currency.symbol}{formatPrice(getLoyaltyDiscountAmount())}</span>
                  </div>
                )}
                <div className="store-cart-summary-total">
                  <span>{selectedTerminalProvider === 'square' ? t('subtotal', lang) : t('total', lang)}</span>
                  <span>{colors.currency.symbol}{formatPrice(getCartSubtotal())}</span>
                </div>
                {selectedTerminalProvider === 'square' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#92400e', padding: '4px 0' }}>
                      <span>{t('squareCommission', lang)}</span>
                      <span>+{colors.currency.symbol}{formatPrice(getSquareCommission())}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '15px', color: 'var(--store-primary)', padding: '6px 0', borderTop: '1.5px solid #f59e0b' }}>
                      <span>{t('total', lang)}</span>
                      <span>{colors.currency.symbol}{formatPrice(getFinalTotal())}</span>
                    </div>
                    <div style={{
                      marginTop: '6px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: '#fff8e1',
                      border: '1.5px solid #f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      color: '#92400e',
                    }}>
                      <span style={{ flexShrink: 0 }}>⚠️</span>
                      <span>{t('squareCommissionNote', lang)}</span>
                    </div>
                  </>
                )}
                <div className="store-cart-coupon">
                  <div
                    onClick={() => !appliedCoupon && setVkbOpen(true)}
                    className="store-cart-coupon-input"
                    style={{
                      cursor: appliedCoupon ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center',
                      color: couponCodeInput ? 'inherit' : '#aaa',
                      letterSpacing: couponCodeInput ? '2px' : 'normal',
                      fontWeight: couponCodeInput ? '700' : '400',
                    }}
                  >
                    {couponCodeInput || t('couponCode', lang)}
                  </div>
                  {appliedCoupon ? (
                    <button onClick={removeCoupon} className="btn btn-danger btn-sm">{t('quit', lang)}</button>
                  ) : (
                    <button onClick={applyCoupon} disabled={couponLoading || !couponCodeInput.trim()} className="btn btn-secondary btn-sm">
                      {couponLoading ? '...' : t('apply', lang)}
                    </button>
                  )}
                </div>
                {vkbOpen && (
                  <VirtualKeyboard
                    value={couponCodeInput}
                    onChange={(v) => setCouponCodeInput(v.toUpperCase())}
                    onClose={() => setVkbOpen(false)}
                    placeholder={t('couponCode', lang)}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {cart.length > 0 && (
          <div className="store-cart-footer">
            {selectedConfiguration?.allow_serve && selectedConfiguration?.allow_takeout && (
              <div className="store-cart-order-type">
                <label className="store-cart-order-label">{t('orderType', lang)}</label>
                <div className="store-cart-type-grid">
                  <button
                    onClick={() => setOrderType('serve')}
                    className={`store-cart-type-btn${orderType === 'serve' ? ' active store-glow-pulse' : ''}`}
                  >
                    <FontAwesomeIcon icon={faBox} />
                    <span>{t('serveHere', lang)}</span>
                  </button>
                  <button
                    onClick={() => setOrderType('takeout')}
                    className={`store-cart-type-btn${orderType === 'takeout' ? ' active store-glow-pulse' : ''}`}
                  >
                    <FontAwesomeIcon icon={faShoppingCart} />
                    <span>{t('takeoutShort', lang)}</span>
                  </button>
                </div>
              </div>
            )}

            <button onClick={handleCheckout} className="store-cart-checkout-btn store-glow-pulse">
              <FontAwesomeIcon icon={faCheck} />
              {t('confirmOrder', lang)} - {colors.currency.symbol}{formatPrice(selectedTerminalProvider === 'square' ? getFinalTotal() : getCartSubtotal())}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); handleLongPressEnd(); setCart([]); setAppliedCoupon(null); setCouponCodeInput(''); }}
              onMouseDown={(e) => { e.stopPropagation(); handleLongPressEnd(); }}
              onTouchStart={(e) => { e.stopPropagation(); handleLongPressEnd(); }}
              className="store-cart-clear-btn"
            >
              <FontAwesomeIcon icon={faTimesCircle} />
              {t('clearCart', lang)}
            </button>
          </div>
        )}
      </div>

      {loyaltyModalOpen && (
        <Suspense fallback={null}>
          <LoyaltyCheckModal
            storeCode={code}
            primaryColor={colors.primary}
            accentColor={colors.accent}
            onClose={() => {
              setLoyaltyModalOpen(false);
              if (pendingPaymentMethod) {
                const m = pendingPaymentMethod;
                setPendingPaymentMethod(null);
                handlePaymentMethodSelect(m);
              } else {
                setPaymentModalOpen(true);
              }
            }}
            onResult={({ customer, discountPercent }) => {
              setLoyaltyModalOpen(false);
              setLoyaltyCustomer(customer || null);
              loyaltyDiscountRef.current = discountPercent || 0;
              setLoyaltyDiscount(discountPercent || 0);
              if (pendingPaymentMethod) {
                const m = pendingPaymentMethod;
                setPendingPaymentMethod(null);
                handlePaymentMethodSelect(m);
              } else {
                setPaymentModalOpen(true);
              }
            }}
          />
        </Suspense>
      )}

      {showCommentModal && (
        <div className="modal-overlay" style={{ zIndex: 3100 }}>
          <div className="modal text-center" style={{ maxWidth: '400px' }}>
            <h2 style={{ color: 'var(--store-primary)', marginBottom: '8px', fontSize: '22px' }}>
              Agregar comentario
            </h2>
            <p className="text-muted" style={{ marginBottom: '18px', fontSize: '14px' }}>
              Puedes dejar una nota para el pedido (opcional)
            </p>
            <div
              onClick={() => setShowCommentKb(true)}
              style={{
                background: 'var(--store-secondary)', borderRadius: '12px', padding: '14px 16px',
                border: '2px solid var(--store-primary)', marginBottom: '20px', textAlign: 'left',
                minHeight: '52px', cursor: 'text', display: 'flex', alignItems: 'center'
              }}
            >
              <span style={{ color: paymentComment ? 'var(--store-primary)' : '#aaa', fontSize: '16px', fontWeight: paymentComment ? '600' : '400', wordBreak: 'break-word' }}>
                {paymentComment || 'Toca aquí para escribir…'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                className="btn btn-lg btn-full store-glow-pulse"
                style={{ backgroundColor: 'var(--store-secondary)', color: 'var(--store-primary)', border: '2px solid var(--store-primary)', borderRadius: '12px' }}
                onClick={() => setShowCommentKb(true)}
              >
                ✏️ {paymentComment ? 'Editar comentario' : 'Escribir comentario'}
              </button>
              <button
                className="btn btn-lg btn-full"
                style={{ backgroundColor: 'var(--store-accent)', color: 'var(--store-primary)', border: 'none', borderRadius: '12px', fontWeight: '700' }}
                onClick={() => {
                  const method = pendingCommentMethod;
                  const tNum = pendingCommentTableNum;
                  setPendingCommentMethod(null);
                  setPendingCommentTableNum(null);
                  setShowCommentModal(false);
                  skipCommentCheckRef.current = true;
                  if (typeof method === 'string' && method.startsWith('android_tuu_')) {
                    handleAndroidTuuPayment(parseInt(method.replace('android_tuu_', '')));
                  } else {
                    processPayment(method, tNum);
                  }
                }}
              >
                {paymentComment ? '✓ Confirmar y pagar' : 'Continuar sin comentario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCommentKb && (
        <VirtualKeyboard
          value={paymentComment}
          onChange={setPaymentComment}
          placeholder="Comentario del pedido"
          onClose={() => setShowCommentKb(false)}
        />
      )}

      {paymentModalOpen && (
        <div className="modal-overlay">
          <div className="modal text-center" style={{ maxWidth: '400px' }}>
            <h2 style={{
              color: 'var(--store-primary)',
              marginBottom: '10px',
              fontSize: '24px'
            }}>
              {processingPayment ? t('processingPayment', lang) : t('paymentMethod', lang)}
            </h2>
            <p className="text-muted" style={{ marginBottom: '25px', fontSize: '14px' }}>
              {processingPayment
                ? (paymentMethod === 'card'
                    ? t('tapCardTerminal', lang)
                    : t('processing', lang))
                : t('selectPaymentMethod', lang)
              }
            </p>

            {processingPayment ? (
              <div className="flex flex-col items-center" style={{ padding: '40px', gap: '20px' }}>
                <div style={{ animation: 'pulse 2s infinite' }}>
                  <svg viewBox="0 0 100 130" width="80" height="104" xmlns="http://www.w3.org/2000/svg" fill="none">
                    <rect x="15" y="5" width="70" height="115" rx="9" stroke="var(--store-primary)" strokeWidth="2.5" fill="var(--store-accent)" fillOpacity="0.15"/>
                    <rect x="23" y="13" width="54" height="36" rx="5" stroke="var(--store-primary)" strokeWidth="1.5" fill="var(--store-accent)" fillOpacity="0.25"/>
                    <rect x="23" y="56" width="54" height="7" rx="3.5" stroke="var(--store-primary)" strokeWidth="1.5" fill="var(--store-accent)" fillOpacity="0.2"/>
                    <rect x="23" y="70" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.4"/>
                    <rect x="43" y="70" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.4"/>
                    <rect x="63" y="70" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.4"/>
                    <rect x="23" y="84" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.4"/>
                    <rect x="43" y="84" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.4"/>
                    <rect x="63" y="84" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.4"/>
                    <rect x="23" y="98" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.3"/>
                    <rect x="43" y="98" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.7"/>
                    <rect x="63" y="98" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.3"/>
                    <rect x="2" y="54" width="22" height="11" rx="2.5" fill="var(--store-primary)" fillOpacity="0.8"/>
                    <line x1="6" y1="58.5" x2="20" y2="58.5" stroke="var(--store-accent)" strokeWidth="1.5" opacity="0.6"/>
                    <line x1="6" y1="62" x2="17" y2="62" stroke="var(--store-accent)" strokeWidth="1" opacity="0.4"/>
                  </svg>
                </div>
                <p className="text-muted" style={{ fontSize: '14px' }}>
                  {t('waitingTerminal', lang)}
                </p>
              </div>
            ) : (
              <>
                {(parseFloat(selectedConfiguration?.tip_percentage) > 0) && (
                  <div style={{ marginBottom: '20px', padding: '16px', borderRadius: '14px', background: 'var(--store-secondary)', border: '2px solid var(--store-primary)', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <span style={{ fontWeight: '700', fontSize: '15px', color: 'var(--store-primary)' }}>{t('tip', lang)}</span>
                      <button
                        onClick={() => { setTipEnabled(p => !p); setTipPercent(tipEnabled ? 0 : 5); }}
                        style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', background: tipEnabled ? 'var(--store-accent)' : '#e0e0e0', color: tipEnabled ? 'var(--store-primary)' : '#999', transition: 'all 0.2s' }}
                      >
                        {tipEnabled ? t('tipIncluded', lang) : t('tipExclude', lang)}
                      </button>
                    </div>
                    {tipEnabled && (
                      <>
                        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '32px', fontWeight: '800', color: 'var(--store-accent)' }}>{tipPercent}%</span>
                          <span style={{ fontSize: '13px', color: '#888', marginLeft: '8px' }}>{colors.currency.symbol}{formatPrice(getTipAmount())}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="20"
                          step="5"
                          value={tipPercent}
                          onChange={e => setTipPercent(parseInt(e.target.value))}
                          style={{ width: '100%', accentColor: 'var(--store-accent)', height: '6px', cursor: 'pointer', marginBottom: '8px' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                          {[0, 5, 10, 15, 20].map(v => <span key={v}>{v}%</span>)}
                        </div>
                      </>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '700', color: 'var(--store-primary)', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e0e0e0' }}>
                      <span>{t('total', lang)}</span>
                      <span>{colors.currency.symbol}{formatPrice(getFinalTotal())}</span>
                    </div>
                  </div>
                )}
                <div className="flex flex-col" style={{ gap: '15px' }}>
                  {tuuModePayFromUrl && androidBridgeAvailable && (
                    <>
                      <button
                        onClick={() => handleAndroidTuuPayment(2)}
                        disabled={processingPayment}
                        className="btn btn-lg btn-full store-glow-pulse"
                        style={{ backgroundColor: '#1a1a1a', color: '#D4AF37', border: '3px solid #D4AF37', borderRadius: '15px' }}
                      >
                        <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: '26px' }} />
                        <span className="font-bold" style={{ fontSize: '18px' }}>DÉBITO TUU</span>
                      </button>
                      <button
                        onClick={() => handleAndroidTuuPayment(1)}
                        disabled={processingPayment}
                        className="btn btn-lg btn-full store-glow-pulse"
                        style={{ backgroundColor: '#1a1a1a', color: '#D4AF37', border: '3px solid #D4AF37', borderRadius: '15px' }}
                      >
                        <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: '26px' }} />
                        <span className="font-bold" style={{ fontSize: '18px' }}>CRÉDITO TUU</span>
                      </button>
                    </>
                  )}
                  {!tuuModePayFromUrl && (() => {
                    const delivMethods = (selectedConfiguration?.delivery_payment_methods || 'tuu,mercadopago').split(',').map(m => m.trim());
                    const delivAllowsTuu = delivMethods.includes('tuu');
                    const delivAllowsMP = delivMethods.includes('mercadopago');
                    const delivAllowsCash = delivMethods.includes('efectivo');

                    if (deliveryMode) {
                      return (
                        <>
                          {delivAllowsTuu && haulmerNative && (
                            <button
                              onClick={() => processPayment('haulmer_native')}
                              className="btn btn-lg btn-full store-glow-pulse"
                              style={{ backgroundColor: 'var(--store-secondary)', color: 'var(--store-primary)', border: '3px solid #2563eb', borderRadius: '15px' }}
                            >
                              <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: '28px' }} />
                              <span className="font-bold" style={{ fontSize: '18px' }}>{t('payWithTuu', lang)}</span>
                            </button>
                          )}
                          {delivAllowsCash && (
                            <button
                              onClick={() => processPayment('cash')}
                              className="btn btn-lg btn-full store-glow-pulse"
                              style={{ backgroundColor: 'var(--store-secondary)', color: 'var(--store-primary)', border: '3px solid #16a34a', borderRadius: '15px' }}
                            >
                              <FontAwesomeIcon icon={faMoneyBillWave} style={{ fontSize: '28px' }} />
                              <span className="font-bold" style={{ fontSize: '18px' }}>{t('cash', lang)}</span>
                            </button>
                          )}
                          {delivAllowsMP && (
                            <button
                              onClick={() => processPayment('mp_checkout')}
                              className="btn btn-lg btn-full store-glow-pulse"
                              style={{ backgroundColor: '#009ee3', color: '#fff', border: '3px solid #009ee3', borderRadius: '15px' }}
                            >
                              <FontAwesomeIcon icon={faQrcode} style={{ fontSize: '28px' }} />
                              <span className="font-bold" style={{ fontSize: '18px' }}>{t('payWithMercadopago', lang)}</span>
                            </button>
                          )}
                          {!delivAllowsTuu && !delivAllowsMP && !delivAllowsCash && (
                            <p className="text-muted">{t('noPaymentMethods', lang)}</p>
                          )}
                        </>
                      );
                    }

                    return (
                      <>
                        {localAcceptCard && (
                          <button
                            onClick={() => handlePaymentMethodSelect('card')}
                            className="btn btn-lg btn-full store-glow-pulse"
                            style={{ backgroundColor: 'var(--store-secondary)', color: 'var(--store-primary)', border: '3px solid #ddd', borderRadius: '15px' }}
                          >
                            <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: '28px' }} />
                            <span className="font-bold" style={{ fontSize: '18px' }}>{t('card', lang)}</span>
                          </button>
                        )}
                        {localAcceptCash && (
                          <button
                            onClick={() => handlePaymentMethodSelect('cash')}
                            className="btn btn-lg btn-full store-glow-pulse"
                            style={{ backgroundColor: 'var(--store-secondary)', color: 'var(--store-primary)', border: '3px solid #ddd', borderRadius: '15px' }}
                          >
                            <FontAwesomeIcon icon={faMoneyBillWave} style={{ fontSize: '28px' }} />
                            <span className="font-bold" style={{ fontSize: '18px' }}>{t('cash', lang)}</span>
                          </button>
                        )}
                        {!localAcceptCash && !localAcceptCard && !qrProvider && !haulmerNative && (
                          <p className="text-muted">{t('noPaymentMethods', lang)}</p>
                        )}
                      </>
                    );
                  })()}
                </div>


                <button
                  onClick={() => setPaymentModalOpen(false)}
                  className="btn btn-lg btn-full"
                  style={{
                    marginTop: '8px',
                    backgroundColor: 'transparent',
                    color: 'var(--store-primary)',
                    border: '2px solid var(--store-primary)',
                    borderRadius: '15px',
                    opacity: 0.7
                  }}
                >
                  {t('cancel', lang)}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {tableModalOpen && (
        <div className="modal-overlay">
          <div className="modal text-center" style={{ maxWidth: '360px' }}>
            <h2 style={{ color: 'var(--store-primary)', marginBottom: '6px', fontSize: '22px', fontWeight: 800 }}>
              {t('whichTable', lang)}
            </h2>
            <p className="text-muted" style={{ marginBottom: '18px', fontSize: '14px' }}>
              {t('enterTableNumber', lang)}
            </p>

            <div style={{
              fontSize: '48px', fontWeight: 900, letterSpacing: '4px', minHeight: '64px',
              color: 'var(--store-primary)', marginBottom: '16px',
              background: 'var(--store-secondary)', borderRadius: '12px', padding: '8px 16px',
              border: '2px solid var(--store-primary)'
            }}>
              {tableNumber || <span style={{ opacity: 0.25 }}>—</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button
                  key={n}
                  onClick={() => setTableNumber(prev => prev.length < 3 ? prev + String(n) : prev)}
                  style={{
                    fontSize: '24px', fontWeight: 700, padding: '16px',
                    borderRadius: '12px', border: '2px solid var(--store-primary)',
                    background: 'var(--store-secondary)', color: 'var(--store-primary)',
                    cursor: 'pointer'
                  }}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setTableNumber(prev => prev.slice(0, -1))}
                style={{
                  fontSize: '20px', fontWeight: 700, padding: '16px',
                  borderRadius: '12px', border: '2px solid #e0e0e0',
                  background: '#fafafa', color: '#666', cursor: 'pointer'
                }}
              >
                ⌫
              </button>
              <button
                onClick={() => setTableNumber(prev => prev.length < 3 ? prev + '0' : prev)}
                style={{
                  fontSize: '24px', fontWeight: 700, padding: '16px',
                  borderRadius: '12px', border: '2px solid var(--store-primary)',
                  background: 'var(--store-secondary)', color: 'var(--store-primary)',
                  cursor: 'pointer'
                }}
              >
                0
              </button>
              <div />
            </div>

            <button
              onClick={() => {
                if (!tableNumber) return;
                setTableModalOpen(false);
                processPayment(pendingPaymentMethod, tableNumber);
              }}
              disabled={!tableNumber}
              className="btn btn-lg btn-full"
              style={{
                backgroundColor: tableNumber ? 'var(--store-primary)' : '#ccc',
                color: tableNumber ? 'var(--store-secondary)' : '#fff',
                borderRadius: '12px', fontWeight: 800, fontSize: '18px',
                marginBottom: '10px', opacity: tableNumber ? 1 : 0.5
              }}
            >
              {t('confirmTable', lang)} {tableNumber}
            </button>

            <button
              onClick={() => { setTableModalOpen(false); setPaymentModalOpen(true); }}
              style={{
                background: 'transparent', border: 'none', color: 'var(--store-primary)',
                fontSize: '14px', cursor: 'pointer', opacity: 0.6
              }}
            >
              {t('back', lang)}
            </button>
          </div>
        </div>
      )}

      {paymentWaiting && (
        <div className="modal-overlay">
          <div className="modal text-center" style={{ maxWidth: '400px', padding: '40px' }}>
            <h2 style={{ color: 'var(--store-primary)', marginBottom: '10px', fontSize: '24px' }}>
              {qrPaymentUrl && !deliveryMode ? t('scanQRToPay', lang) : t('waitingPayment', lang)}
            </h2>

            {qrPaymentUrl ? (
              <>
                {!deliveryMode && (
                  <p className="text-muted" style={{ marginBottom: '15px', fontSize: '14px' }}>
                    {t('scanQRDesc', lang)}
                  </p>
                )}
                {!deliveryMode && (
                  <div style={{ margin: '0 auto 15px', display: 'flex', justifyContent: 'center' }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrPaymentUrl)}`}
                      alt="QR"
                      style={{ width: '200px', height: '200px', borderRadius: '12px', border: '2px solid #e0e0e0' }}
                    />
                  </div>
                )}
                <a
                  href={qrPaymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ display: 'inline-block', marginBottom: '15px', padding: '12px 24px', borderRadius: '10px', textDecoration: 'none', background: 'var(--store-accent)', color: 'var(--store-primary)', fontWeight: '700' }}
                >
                  {t('openPaymentLink', lang)}
                </a>
              </>
            ) : (
              <>
                <p className="text-muted" style={{ marginBottom: '20px', fontSize: '14px' }}>
                  {t('tapCardTerminal', lang)}
                </p>
                <div style={{ margin: '0 auto 20px', animation: 'pulse 2s infinite' }}>
                  <svg viewBox="0 0 100 130" width="90" height="117" xmlns="http://www.w3.org/2000/svg" fill="none">
                    <rect x="15" y="5" width="70" height="115" rx="9" stroke="var(--store-primary)" strokeWidth="2.5" fill="var(--store-accent)" fillOpacity="0.15"/>
                    <rect x="23" y="13" width="54" height="36" rx="5" stroke="var(--store-primary)" strokeWidth="1.5" fill="var(--store-accent)" fillOpacity="0.25"/>
                    <rect x="23" y="56" width="54" height="7" rx="3.5" stroke="var(--store-primary)" strokeWidth="1.5" fill="var(--store-accent)" fillOpacity="0.2"/>
                    <rect x="23" y="70" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.4"/>
                    <rect x="43" y="70" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.4"/>
                    <rect x="63" y="70" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.4"/>
                    <rect x="23" y="84" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.4"/>
                    <rect x="43" y="84" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.4"/>
                    <rect x="63" y="84" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.4"/>
                    <rect x="23" y="98" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.3"/>
                    <rect x="43" y="98" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.7"/>
                    <rect x="63" y="98" width="14" height="10" rx="2.5" fill="var(--store-accent)" fillOpacity="0.3"/>
                    <rect x="2" y="54" width="22" height="11" rx="2.5" fill="var(--store-primary)" fillOpacity="0.8"/>
                    <line x1="6" y1="58.5" x2="20" y2="58.5" stroke="var(--store-accent)" strokeWidth="1.5" opacity="0.6"/>
                    <line x1="6" y1="62" x2="17" y2="62" stroke="var(--store-accent)" strokeWidth="1" opacity="0.4"/>
                  </svg>
                </div>
              </>
            )}
            <p className="text-muted" style={{ fontSize: '14px', marginBottom: '10px' }}>
              {t('waitingPaymentConfirm', lang)}
            </p>
            <p className="font-bold" style={{
              color: paymentTimeLeft <= 30 ? '#DC3545' : 'var(--store-primary)',
              fontSize: '24px',
              marginBottom: '10px'
            }}>
              {Math.floor(paymentTimeLeft / 60)}:{String(paymentTimeLeft % 60).padStart(2, '0')}
            </p>
            {!qrPaymentUrl && (
              <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px', fontStyle: 'italic' }}>
                Si desea cancelar debe hacerlo en el POS
              </p>
            )}
            {qrPaymentUrl && (
              <button
                onClick={async () => {
                  if (!pendingOrderData) return;
                  try {
                    await fetch(`/api/orders/${pendingOrderData.order.id}/cancel-payment`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ store_id: pendingOrderData.storeId })
                    });
                    if (tuuPaymentKey) {
                      await fetch(`/api/tuu/cancel/${tuuPaymentKey}`, { method: 'POST' });
                    }
                  } catch (e) { console.error(e); }
                  setPaymentWaiting(false); setQrPaymentUrl(null); setTuuPaymentKey(null);
                  setPaymentCancelled(true);
                }}
                className="btn btn-danger"
                style={{ padding: '12px 24px', borderRadius: '10px' }}
              >
                {t('cancelPayment', lang)}
              </button>
            )}
          </div>
        </div>
      )}

      {qrPaymentResult && (
        <div className="modal-overlay">
          <div className="modal text-center" style={{ maxWidth: '400px', padding: '30px 24px' }}>
            {qrPaymentResult.success ? (
              <>
                <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '50px', marginBottom: '12px', color: 'var(--success)' }} />
                <h2 style={{ color: 'var(--store-primary)', marginBottom: '4px', fontSize: '22px' }}>
                  {t('paymentSuccess', lang)}
                </h2>
                <p className="text-muted" style={{ marginBottom: '16px', fontSize: '13px' }}>
                  {qrPaymentResult.message}
                </p>

                {qrPaymentResult.order?.order_number && (
                  <div id="qr-order-card" style={{
                    background: 'var(--store-primary)',
                    color: 'var(--store-secondary)',
                    borderRadius: '20px',
                    padding: '24px 20px',
                    marginBottom: '16px',
                    border: '4px solid var(--store-accent)'
                  }}>
                    <p style={{ fontSize: '13px', margin: '0 0 8px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '2px' }}>{t('yourOrder', lang)}</p>
                    <p style={{ fontSize: '90px', fontWeight: '900', margin: '0', lineHeight: '1', color: 'var(--store-accent)' }}>
                      #{qrPaymentResult.order.order_number}
                    </p>
                    <p style={{ fontSize: '12px', marginTop: '12px', marginBottom: 0, opacity: 0.7 }}>
                      {store?.store?.name}
                    </p>
                  </div>
                )}

                <div style={{ background: '#f8f8f8', borderRadius: '10px', padding: '12px', marginBottom: '14px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ color: '#888' }}>{t('amount', lang)}</span>
                    <span style={{ fontWeight: '700' }}>${qrPaymentResult.amount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid #eee' }}>
                    <span style={{ color: '#888' }}>{t('reference', lang)}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#555' }}>{qrPaymentResult.reference}</span>
                  </div>
                </div>

                {qrPaymentResult.order?.order_number && (
                  <button
                    onClick={() => downloadReceiptPng(qrPaymentResult.order.order_number, qrPaymentResult.amount)}
                    className="btn"
                    style={{ background: 'var(--store-accent)', color: 'var(--store-primary)', border: 'none', borderRadius: '10px', padding: '12px 20px', fontWeight: '700', marginBottom: '10px', width: '100%' }}
                  >
                    <FontAwesomeIcon icon={faDownload} /> {t('downloadReceipt', lang)}
                  </button>
                )}
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faTimesCircle} style={{ fontSize: '60px', marginBottom: '20px', color: '#dc3545' }} />
                <h2 style={{ color: '#dc3545', marginBottom: '10px', fontSize: '24px' }}>
                  {t('paymentNotCompleted', lang)}
                </h2>
                <p className="text-muted" style={{ marginBottom: '15px', fontSize: '14px' }}>
                  {qrPaymentResult.message || t('paymentNotProcessed', lang)}
                </p>
              </>
            )}
            <button
              onClick={() => {
                setQrPaymentResult(null);
                window.history.replaceState({}, '', `/store/${code}${deliveryMode ? '?delivery=true' : ''}`);
              }}
              className="btn btn-primary btn-lg"
              style={{ borderRadius: '10px', padding: '12px 30px' }}
            >
              {t('continueText', lang)}
            </button>
          </div>
        </div>
      )}

      {paymentConfirmed && (
        <div className="modal-overlay">
          <div className="modal text-center" style={{ maxWidth: '400px', padding: '40px' }}>
            <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '60px', marginBottom: '20px', color: 'var(--success)' }} />
            <h2 style={{ color: 'var(--store-primary)', marginBottom: '10px', fontSize: '24px' }}>
              {lastTableNumber != null ? `${t('serveAtTable', lang)} #${lastTableNumber}` : t('takeout', lang)}
            </h2>
            <p className="text-muted" style={{ marginBottom: '20px', fontSize: '16px' }}>
              {t('pleaseWait', lang)}
            </p>
            {lastOrderNumber && (
              <div style={{
                backgroundColor: 'var(--store-primary)',
                color: 'var(--store-secondary)',
                padding: '20px',
                borderRadius: '15px',
                marginBottom: '20px'
              }}>
                <p style={{ fontSize: '14px', marginBottom: '5px', opacity: 0.8 }}>{t('orderNumberLabel', lang)}</p>
                <p className="font-bold" style={{ fontSize: '48px', margin: 0 }}>{lastOrderNumber}</p>
              </div>
            )}
            {deliveryMode && lastOrderNumber && (
              <button
                onClick={() => downloadReceiptPng(lastOrderNumber, pendingOrderData?.order?.total)}
                className="btn btn-full"
                style={{ marginBottom: '12px', background: 'var(--store-primary)', color: 'var(--store-secondary)', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: '700' }}
              >
                <FontAwesomeIcon icon={faDownload} /> {t('downloadReceipt', lang)}
              </button>
            )}
            <button
              onClick={() => {
                setPaymentConfirmed(false);
                setOrderRating(null);
                setOrderComment('');
                setShowRatingStep(true);
              }}
              className="btn btn-lg btn-full"
              style={{
                marginTop: '4px',
                backgroundColor: 'var(--store-accent)',
                color: 'var(--store-primary)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <style>{`@keyframes continue-fill { from { width: 0%; } to { width: 100%; } }`}</style>
              <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: 'rgba(0,0,0,0.18)', animation: 'continue-fill 15s linear forwards', zIndex: 0 }} />
              <span style={{ position: 'relative', zIndex: 1 }}>{t('confirm', lang)}</span>
            </button>
          </div>
        </div>
      )}

      {showRatingStep && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: `linear-gradient(145deg, ${colors.primary} 0%, #0d0d1a 100%)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {/* círculos decorativos */}
          <div style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', background: colors.accent, opacity: 0.06, top: -60, left: -60, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', background: colors.accent, opacity: 0.05, bottom: -40, right: -40, pointerEvents: 'none' }} />

          {/* línea dorada superior */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: colors.accent }} />

          {/* contenido */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '0 16px', zIndex: 1, width: '100%', maxWidth: 520, boxSizing: 'border-box' }}>
            {/* logo / inicial */}
            {store?.store?.logo_url ? (
              <img
                src={store.store.logo_url}
                alt={store.store.name}
                style={{
                  width: 70, height: 70, borderRadius: 18,
                  objectFit: 'cover',
                  border: `3px solid ${colors.accent}`,
                  boxShadow: `0 4px 24px ${colors.accent}66`,
                }}
              />
            ) : (
              <div style={{
                width: 60, height: 60, borderRadius: 16,
                background: colors.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 900, color: colors.primary,
                boxShadow: `0 4px 24px ${colors.accent}66`,
              }}>
                {(store?.store?.name || '★')[0]?.toUpperCase() || '★'}
              </div>
            )}

            <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 900, margin: 0, textAlign: 'center', lineHeight: 1.2 }}>
              ¿Cómo fue tu experiencia?
            </h2>
            <p style={{ color: colors.accent, fontSize: 18, margin: 0, letterSpacing: 5 }}>★ ★ ★ ★ ★</p>

            {/* tarjeta de emojis */}
            <div style={{
              background: '#fff',
              borderRadius: 28,
              padding: '28px 20px 24px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
              display: 'flex', gap: 4, justifyContent: 'space-between',
              width: '100%', boxSizing: 'border-box',
            }}>
              {[
                { emoji: '😡', label: 'Muy malo',  value: 2  },
                { emoji: '😕', label: 'Malo',      value: 4  },
                { emoji: '😐', label: 'Regular',   value: 6  },
                { emoji: '😊', label: 'Bueno',     value: 8  },
                { emoji: '🤩', label: 'Excelente', value: 10 },
              ].map(({ emoji, label, value }) => (
                <button
                  key={value}
                  disabled={ratingSubmitting}
                  onClick={async () => {
                    setRatingSubmitting(true);
                    try {
                      await fetch(`/api/public/${code}/ratings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          rating: value,
                          order_id: pendingOrderData?.order?.id || null,
                          source: 'post_order',
                        }),
                      });
                    } catch { /* silent */ }
                    setRatingSubmitting(false);
                    setShowRatingStep(false);
                    setPendingOrderData(null);
                    setLastOrderNumber(null);
                    showWelcomeAfterOrder();
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    background: 'transparent', border: '2.5px solid transparent', borderRadius: 16,
                    cursor: ratingSubmitting ? 'not-allowed' : 'pointer',
                    opacity: ratingSubmitting ? 0.5 : 1,
                    padding: '12px 6px', transition: 'all 0.15s', outline: 'none', flex: 1,
                    minWidth: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${colors.primary}12`; e.currentTarget.style.borderColor = colors.primary; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                >
                  <span style={{
                    fontSize: 'clamp(36px, 8vw, 56px)', lineHeight: 1, display: 'block',
                    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))',
                    transition: 'transform 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >{emoji}</span>
                  <span style={{ fontSize: 'clamp(9px, 2vw, 11px)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, color: '#6b7280', textAlign: 'center' }}>{label}</span>
                </button>
              ))}
            </div>

            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, margin: 0, letterSpacing: 1 }}>
              Powered by SRAutomatic.cl
            </p>
          </div>

          {/* línea dorada inferior */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 5, background: colors.accent }} />
        </div>
      )}

      {paymentCancelled && (
        <div className="modal-overlay">
          <div className="modal text-center" style={{ maxWidth: '400px', padding: '40px' }}>
            <FontAwesomeIcon icon={faTimesCircle} style={{ fontSize: '60px', marginBottom: '20px', color: 'var(--danger)' }} />
            <h2 style={{ color: '#DC3545', marginBottom: '10px', fontSize: '24px' }}>
              {t('paymentNotCompleted', lang)}
            </h2>
            {pendingOrderData?.order?.order_number && (
              <p className="font-bold" style={{ color: '#DC3545', marginBottom: '10px', fontSize: '18px' }}>
                {t('orderNumberLabel', lang)} #{pendingOrderData.order.order_number}
              </p>
            )}
            <p className="text-muted" style={{ marginBottom: '25px', fontSize: '14px' }}>
              {t('paymentNotCompletedDesc', lang)}
            </p>
            <div className="flex flex-col" style={{ gap: '15px' }}>
              {localAcceptCard && (
                <button
                  onClick={() => {
                    setPaymentCancelled(false);
                    setPendingOrderData(null);
                    setProcessingPayment(true);
                    processPayment('card');
                  }}
                  className="btn btn-lg btn-full"
                  style={{
                    backgroundColor: 'var(--store-primary)',
                    color: 'var(--store-secondary)',
                    borderRadius: '15px'
                  }}
                >
                  <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: '22px' }} />
                  <span className="font-bold" style={{ fontSize: '18px' }}>{t('retryCard', lang)}</span>
                </button>
              )}
              {localAcceptCash && (
                <button
                  onClick={() => {
                    setPaymentCancelled(false);
                    setPaymentModalOpen(true);
                  }}
                  className="btn btn-lg btn-full"
                  style={{
                    backgroundColor: 'var(--store-accent)',
                    color: 'var(--store-primary)',
                    borderRadius: '15px'
                  }}
                >
                  <FontAwesomeIcon icon={faMoneyBillWave} style={{ fontSize: '22px' }} />
                  <span className="font-bold" style={{ fontSize: '18px' }}>{t('payCash', lang)}</span>
                </button>
              )}
              <button
                onClick={async () => {
                  try {
                    await fetch(`/api/orders/${pendingOrderData.order.id}/cancel-payment`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ store_id: pendingOrderData.storeId })
                    });
                    if (tuuPaymentKey) {
                      await fetch(`/api/tuu/cancel/${tuuPaymentKey}`, { method: 'POST' });
                    }
                  } catch (e) { console.error(e); }
                  setPaymentCancelled(false);
                  setPendingOrderData(null);
                  setPaymentWaiting(false); setQrPaymentUrl(null); setTuuPaymentKey(null);
                  setCart([]);
                  setCartOpen(false);
                  setPaymentModalOpen(false);
                }}
                className="btn btn-danger btn-lg btn-full"
                style={{ borderRadius: '15px' }}
              >
                <FontAwesomeIcon icon={faTimesCircle} style={{ fontSize: '22px' }} />
                <span className="font-bold" style={{ fontSize: '18px' }}>{t('cancelOrder', lang)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {cashPaymentSuccess && (
        <div className="modal-overlay">
          <div className="modal text-center" style={{ maxWidth: '400px', padding: '40px' }}>
            <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '60px', marginBottom: '20px', color: 'var(--success)' }} />
            <h2 style={{ color: 'var(--store-primary)', marginBottom: '10px', fontSize: '24px' }}>
              {lastTableNumber != null ? `${t('serveAtTable', lang)} #${lastTableNumber}` : t('takeout', lang)}
            </h2>
            <p className="text-muted" style={{ marginBottom: '20px', fontSize: '16px' }}>
              {t('cashAtCounter', lang)}
            </p>
            {lastOrderNumber && (
              <div style={{
                backgroundColor: 'var(--store-primary)',
                color: 'var(--store-secondary)',
                padding: '20px',
                borderRadius: '15px',
                marginBottom: '20px'
              }}>
                <p style={{ fontSize: '14px', marginBottom: '5px', opacity: 0.8 }}>{t('orderNumberLabel', lang)}</p>
                <p className="font-bold" style={{ fontSize: '48px', margin: 0 }}>{lastOrderNumber}</p>
              </div>
            )}
            {deliveryMode && lastOrderNumber && (
              <button
                onClick={() => downloadReceiptPng(lastOrderNumber, pendingOrderData?.order?.total, true)}
                className="btn btn-full"
                style={{ marginBottom: '12px', background: 'var(--store-primary)', color: 'var(--store-secondary)', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: '700' }}
              >
                <FontAwesomeIcon icon={faDownload} /> {t('downloadReceipt', lang)}
              </button>
            )}
            <p style={{
              color: '#999',
              fontSize: '13px',
              fontStyle: 'italic'
            }}>
              {t('cashAtCounter', lang)}
            </p>
            <button
              onClick={() => {
                setCashPaymentSuccess(false);
                setOrderRating(null);
                setShowRatingStep(true);
              }}
              className="btn btn-lg btn-full"
              style={{
                marginTop: '25px',
                backgroundColor: 'var(--store-accent)',
                color: 'var(--store-primary)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <style>{`@keyframes continue-fill { from { width: 0%; } to { width: 100%; } }`}</style>
              <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: 'rgba(0,0,0,0.18)', animation: 'continue-fill 15s linear forwards', zIndex: 0 }} />
              <span style={{ position: 'relative', zIndex: 1 }}>{t('confirm', lang)}</span>
            </button>
          </div>
        </div>
      )}
      {prodModalOpen && (
        <div className="store-modal-overlay" onClick={() => setProdModalOpen(false)} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <div className="store-prod-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', color: 'var(--store-primary)', textAlign: 'center' }}>
              {editingProd ? 'Editar Producto' : 'Nuevo Producto'}
            </h3>

            <div className="store-prod-modal-image-area">
              {/* Foto */}
              {prodImageFile ? (
                <img src={URL.createObjectURL(prodImageFile)} alt="Preview" className="store-prod-modal-preview" />
              ) : prodForm.image_url ? (
                <img src={prodForm.image_url} alt="Preview URL" className="store-prod-modal-preview" />
              ) : (
                <img src={getProductImageUrl(editingProd?.image)} alt="Actual" className="store-prod-modal-preview" />
              )}

              {/* Botón Cambiar + O URL en la misma fila */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowImagePicker(true)}
                  className="store-prod-modal-image-btn"
                  style={{ flexShrink: 0 }}
                >
                  <FontAwesomeIcon icon={faEdit} /> {prodImageFile || prodForm.image_url || editingProd?.image ? 'Cambiar' : 'Agregar'}
                </button>
                <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>O URL:</span>
                <input
                  type="url"
                  value={prodForm.image_url}
                  onChange={(e) => { setProdForm({ ...prodForm, image_url: e.target.value }); setProdImageFile(null); }}
                  placeholder="https://..."
                  className="store-prod-modal-input"
                  style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                />
              </div>
            </div>

            {/* Mini-modal selector de imagen */}
            {showImagePicker && (
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
                onClick={() => setShowImagePicker(false)}
              >
                <div
                  style={{ background: '#fff', borderRadius: '18px 18px 0 0', padding: '20px 16px 32px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 10 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ width: 36, height: 4, background: '#ddd', borderRadius: 2, margin: '0 auto 8px' }} />
                  <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 16, textAlign: 'center', color: '#222' }}>Seleccionar imagen</p>

                  {/* Tomar foto */}
                  <button
                    type="button"
                    onClick={() => { setShowImagePicker(false); setProdCameraOpen(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, border: '2px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: '#222' }}
                  >
                    <span style={{ width: 40, height: 40, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📷</span>
                    Tomar foto
                  </button>

                  {/* Elegir archivo */}
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, border: '2px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: '#222' }}
                  >
                    <span style={{ width: 40, height: 40, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🖼️</span>
                    Elegir archivo
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => { if (e.target.files[0]) { setShowImagePicker(false); setProdForm({ ...prodForm, image_url: '' }); setPendingImageFile(e.target.files[0]); setBgRemoveDialog(true); } }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowImagePicker(false)}
                    style={{ marginTop: 4, padding: '12px', borderRadius: 12, border: 'none', background: '#f3f4f6', color: '#666', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                  >Cancelar</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {/* 1. Nombre */}
              <input
                type="text"
                value={prodForm.name}
                onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                placeholder="Nombre del producto"
                autoFocus={false}
                className="store-prod-modal-input main"
              />

              {/* 2. Precio + Categoría */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  step="0.01"
                  value={prodForm.price}
                  onChange={(e) => setProdForm({ ...prodForm, price: e.target.value })}
                  placeholder="Precio"
                  className="store-prod-modal-input"
                  style={{ flex: '1 1 48%', minWidth: '120px' }}
                />
                <div style={{ display: 'flex', gap: 6, flex: '1 1 48%', minWidth: '120px' }}>
                  <select
                    value={prodForm.category_id}
                    onChange={(e) => setProdForm({ ...prodForm, category_id: e.target.value })}
                    className="store-prod-modal-input"
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <option value="">Sin categoría</option>
                    {(store?.categories || []).map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => openCatModal(null, true)}
                    title="Crear categoría"
                    style={{
                      flexShrink: 0, width: 38, borderRadius: 8, border: '2px solid var(--store-primary)',
                      background: 'var(--store-secondary)', color: 'var(--store-primary)',
                      fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                </div>
              </div>

              {/* 3. Descripción */}
              <input
                type="text"
                value={prodForm.description}
                onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                placeholder="Descripción (opcional)"
                className="store-prod-modal-input"
              />

              {/* 4. Código de barras */}
              <input
                type="text"
                value={prodForm.barcode}
                onChange={(e) => setProdForm({ ...prodForm, barcode: e.target.value })}
                placeholder="Código de barras (escanear o escribir)"
                className="store-prod-modal-input"
                style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
              />

              {/* 5. Stock */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 10, border: `2px solid ${prodForm.unlimited_stock ? '#22c55e' : '#e0e0e0'}`, background: prodForm.unlimited_stock ? '#f0fdf4' : '#fafafa', transition: 'all 0.2s' }}>
                <div
                  onClick={() => setProdForm({ ...prodForm, unlimited_stock: !prodForm.unlimited_stock })}
                  style={{ width: 40, height: 22, borderRadius: 11, background: prodForm.unlimited_stock ? '#22c55e' : '#ccc', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}
                >
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: prodForm.unlimited_stock ? 20 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </div>
                <span onClick={() => setProdForm({ ...prodForm, unlimited_stock: !prodForm.unlimited_stock })} style={{ fontSize: 13, fontWeight: 600, color: prodForm.unlimited_stock ? '#15803d' : '#666', cursor: 'pointer', flex: 1 }}>
                  {prodForm.unlimited_stock ? '∞ Stock ilimitado' : 'Stock limitado'}
                </span>
                {!prodForm.unlimited_stock && (
                  <input
                    type="number"
                    min="0"
                    value={prodForm.stock}
                    onChange={(e) => setProdForm({ ...prodForm, stock: e.target.value })}
                    placeholder="0"
                    className="store-prod-modal-input"
                    style={{ width: 70, textAlign: 'center', fontSize: 14, fontWeight: 700 }}
                  />
                )}
              </div>

              {/* 6. Extras / Complementos / Secciones */}
              {editMode && (
                <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '12px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: 6 }}>

                  {/* Fila: Complementos */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `2px solid ${prodForm.has_ingredients ? '#22c55e' : '#e0e0e0'}`, background: prodForm.has_ingredients ? '#dcfce7' : '#fafafa' }}>
                    <input type="checkbox" checked={prodForm.has_ingredients} onChange={(e) => setProdForm({ ...prodForm, has_ingredients: e.target.checked })} style={{ width: 18, height: 18, flexShrink: 0, cursor: 'pointer' }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={() => setProdForm({ ...prodForm, has_ingredients: !prodForm.has_ingredients })}>
                      {complementsLabel}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setLabelEditModal({ type: 'complements', value: (store?.store?.complements_label || '').trim() }); }}
                      title="Editar nombre"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px 5px', fontSize: 13, flexShrink: 0 }}
                    ><FontAwesomeIcon icon={faEdit} /></button>
                    <button
                      onClick={() => { setComplementsTab('complements'); setShowComplementsModal(true); checkComplementDuplicates(); }}
                      style={{ flexShrink: 0, padding: '4px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1.5px solid var(--store-primary)', background: 'var(--store-secondary)', color: 'var(--store-primary)', cursor: 'pointer' }}
                    >
                      Editar {selectedIngredientIds.length > 0 && <span style={{ opacity: 0.7 }}>({selectedIngredientIds.length})</span>}
                    </button>
                  </div>
                  {prodForm.has_ingredients && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Máx. a elegir:</span>
                      <input type="number" min="0" value={prodForm.max_ingredients} onChange={(e) => setProdForm({ ...prodForm, max_ingredients: e.target.value })} placeholder="0 = ilimitado" className="store-prod-modal-input" style={{ fontSize: 13, flex: 1 }} />
                    </div>
                  )}

                  {/* Fila: Extras */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: `2px solid ${prodForm.has_extras ? '#22c55e' : '#e0e0e0'}`, background: prodForm.has_extras ? '#dcfce7' : '#fafafa' }}>
                    <input type="checkbox" checked={prodForm.has_extras} onChange={(e) => setProdForm({ ...prodForm, has_extras: e.target.checked })} style={{ width: 18, height: 18, flexShrink: 0, cursor: 'pointer' }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={() => setProdForm({ ...prodForm, has_extras: !prodForm.has_extras })}>
                      {extrasLabel}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setLabelEditModal({ type: 'extras', value: (store?.store?.extras_label || '').trim() }); }}
                      title="Editar nombre"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px 5px', fontSize: 13, flexShrink: 0 }}
                    ><FontAwesomeIcon icon={faEdit} /></button>
                    <button
                      onClick={() => { setComplementsTab('extras'); setShowComplementsModal(true); checkComplementDuplicates(); }}
                      style={{ flexShrink: 0, padding: '4px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1.5px solid var(--store-primary)', background: 'var(--store-secondary)', color: 'var(--store-primary)', cursor: 'pointer' }}
                    >
                      Editar {selectedExtraIds.length > 0 && <span style={{ opacity: 0.7 }}>({selectedExtraIds.length})</span>}
                    </button>
                  </div>
                  {prodForm.has_extras && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Máx. a elegir:</span>
                      <input type="number" min="0" value={prodForm.max_extras} onChange={(e) => setProdForm({ ...prodForm, max_extras: e.target.value })} placeholder="0 = ilimitado" className="store-prod-modal-input" style={{ fontSize: 13, flex: 1 }} />
                    </div>
                  )}

                  {/* Secciones personalizadas */}
                  <div style={{ borderTop: '1px solid #eee', paddingTop: 10, marginTop: 2 }}>
                    {storeComplementGroups.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {storeComplementGroups.map(g => {
                          const checked = (prodForm.complement_group_ids || []).includes(g.id);
                          return (
                            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: `2px solid ${checked ? 'var(--store-primary)' : '#e0e0e0'}`, background: checked ? 'var(--store-secondary)' : '#fafafa' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const cur = prodForm.complement_group_ids || [];
                                  setProdForm({ ...prodForm, complement_group_ids: checked ? cur.filter(id => id !== g.id) : [...cur, g.id] });
                                }}
                                style={{ width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
                              />
                              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: checked ? 'var(--store-primary)' : '#444', cursor: 'pointer' }}
                                onClick={() => {
                                  const cur = prodForm.complement_group_ids || [];
                                  setProdForm({ ...prodForm, complement_group_ids: checked ? cur.filter(id => id !== g.id) : [...cur, g.id] });
                                }}
                              >{g.name}</span>
                              <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{(g.options || []).length} opc.</span>
                              <button
                                type="button"
                                onClick={() => setSectionGroupModal({ id: g.id, name: g.name, min_select: String(g.min_select ?? 0), max_select: String(g.max_select ?? 0), required: !!g.required })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px 4px', fontSize: 13, flexShrink: 0 }}
                                title="Editar nombre y configuración"
                              ><FontAwesomeIcon icon={faEdit} /></button>
                              <button
                                type="button"
                                onClick={() => deleteSectionGroup(g.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px 4px', fontSize: 13, flexShrink: 0 }}
                                title="Eliminar sección"
                              ><FontAwesomeIcon icon={faTrash} /></button>
                              <button
                                type="button"
                                onClick={() => setSectionEditingGroup(g)}
                                style={{ flexShrink: 0, padding: '3px 9px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: `1.5px solid ${checked ? 'var(--store-primary)' : '#ccc'}`, background: 'transparent', color: checked ? 'var(--store-primary)' : '#777', cursor: 'pointer' }}
                                title="Editar opciones"
                              >Editar</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Lista única */}
                    {(prodForm.has_ingredients || prodForm.has_extras) && (
                      <div style={{ padding: '7px 10px', borderRadius: 8, border: `2px solid ${prodForm.complements_private ? '#D4AF37' : '#e0e0e0'}`, background: prodForm.complements_private ? '#fffbeb' : '#fafafa', marginTop: storeComplementGroups.length > 0 ? 8 : 0 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, margin: 0 }}>
                          <input type="checkbox" checked={prodForm.complements_private} onChange={(e) => setProdForm({ ...prodForm, complements_private: e.target.checked })} style={{ width: 16, height: 16 }} />
                          <FontAwesomeIcon icon={faStar} style={{ color: '#D4AF37' }} /> Lista única (solo de este producto)
                        </label>
                      </div>
                    )}

                    {/* + Nueva siempre debajo */}
                    <button
                      type="button"
                      onClick={() => setSectionGroupModal({ name: '', min_select: 0, max_select: 0, required: false, _autoAssign: true })}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, background: 'none', border: '2px dashed #ccc', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, color: '#888', cursor: 'pointer', width: '100%', justifyContent: 'center' }}
                    >+ Nueva sección</button>
                  </div>

                </div>
              )}

              {/* Materias Primas + Combo en la misma fila */}
              {(editMode && editingProd) && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setProdRecipeModal(editingProd)}
                    style={{ flex: 1, padding: '10px 8px', borderRadius: '8px', border: '2px solid #D4AF37', background: '#fffbeb', color: '#92400e', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <FontAwesomeIcon icon={faUtensils} /> Materias Primas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProdModalOpen(false);
                      setEditorTab('combos');
                      if (!editorCombosLoaded) loadEditorCombos();
                      setEditorComboForm({
                        name: '', description: '', imageFile: null, image: '',
                        is_active: true, discount_type: 'auto', discount_value: '', fixed_price: '',
                        items: [{ product_id: editingProd.id, quantity: 1 }]
                      });
                      setEditorComboModal({ editing: null });
                      setEditorComboProdSearch('');
                      setEditorComboError('');
                    }}
                    style={{ flex: 1, padding: '10px 8px', border: '2px solid var(--store-primary)', borderRadius: '8px', background: 'transparent', color: 'var(--store-primary)', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <FontAwesomeIcon icon={faLayerGroup} /> Crear combo
                  </button>
                </div>
              )}

              {/* 9. Cancelar / Guardar */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  onClick={() => { setProdModalOpen(false); setProdImageFile(null); setProdNewExtras([]); setProdNewComplements([]); if (adminToken) fetchComplements(); }}
                  className="store-prod-modal-btn cancel"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveProd}
                  disabled={!prodForm.name.trim() || !prodForm.price || prodSaving}
                  className={`store-prod-modal-btn confirm${!prodForm.name.trim() || !prodForm.price || prodSaving ? ' disabled' : ''}`}
                >
                  {prodSaving ? 'Guardando...' : editingProd ? 'Guardar' : 'Crear'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {prodCameraOpen && (
        <CameraModal
          onCapture={(file) => { setProdCameraOpen(false); setPendingImageFile(file); setBgRemoveDialog(true); }}
          onClose={() => setProdCameraOpen(false)}
        />
      )}

      {bgRemoveDialog && pendingImageFile && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999998, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
            <img src={URL.createObjectURL(pendingImageFile)} alt="Preview" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 10, marginBottom: 16 }} />
            <p style={{ fontWeight: '700', fontSize: 17, margin: '0 0 6px' }}>¿Remover el fondo?</p>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 20px' }}>Puedes eliminar el fondo de la imagen automáticamente con IA.</p>
            {bgRemoving ? (
              <p style={{ color: '#888', fontSize: 14 }}>Procesando...</p>
            ) : (
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  onClick={() => { setProdImageFile(pendingImageFile); setPendingImageFile(null); setBgRemoveDialog(false); }}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '2px solid #e0e0e0', background: '#fff', color: '#444', fontWeight: '700', fontSize: 14, cursor: 'pointer' }}
                >
                  No, usar tal cual
                </button>
                <button
                  onClick={async () => {
                    setBgRemoving(true);
                    try {
                      const fd = new FormData();
                      fd.append('image', pendingImageFile);
                      const res = await fetch('/api/remove-background', { method: 'POST', body: fd });
                      if (!res.ok) throw new Error('Error del servidor');
                      const data = await res.json();
                      const imgRes = await fetch(data.url);
                      const blob = await imgRes.blob();
                      const file = new File([blob], 'sin_fondo.png', { type: 'image/png' });
                      setProdImageFile(file);
                    } catch {
                      alert('No se pudo remover el fondo. Se usará la imagen original.');
                      setProdImageFile(pendingImageFile);
                    } finally {
                      setBgRemoving(false);
                      setPendingImageFile(null);
                      setBgRemoveDialog(false);
                    }
                  }}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: 'var(--store-primary, #D4AF37)', color: '#fff', fontWeight: '700', fontSize: 14, cursor: 'pointer' }}
                >
                  Sí, remover fondo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showComplementsModal && (
        <div className="store-modal-overlay" onClick={() => setShowComplementsModal(false)} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <div className="store-prod-modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '0', marginBottom: '14px', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--store-primary)' }}>
              <button
                onClick={() => setComplementsTab('complements')}
                style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: '700', border: 'none', cursor: 'pointer', background: complementsTab === 'complements' ? 'var(--store-primary)' : 'var(--store-secondary)', color: complementsTab === 'complements' ? 'var(--store-secondary)' : 'var(--store-primary)' }}
              >
                Complementos
              </button>
              <button
                onClick={() => setComplementsTab('extras')}
                style={{ flex: 1, padding: '10px', fontSize: '13px', fontWeight: '700', border: 'none', cursor: 'pointer', background: complementsTab === 'extras' ? 'var(--store-primary)' : 'var(--store-secondary)', color: complementsTab === 'extras' ? 'var(--store-secondary)' : 'var(--store-primary)' }}
              >
                Extras
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {complementsTab === 'complements' && (
                <>
                  {ingredients.length === 0 && prodNewComplements.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#999', fontSize: '13px', padding: '16px 0' }}>No hay complementos creados</p>
                  )}
                  <DndContext sensors={editSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleComplementsDragEnd(e, 'ingredient')}>
                    <SortableContext items={ingredients.map(i => i.id)} strategy={verticalListSortingStrategy}>
                      {ingredients.map(ing => {
                        const active = selectedIngredientIds.includes(ing.id);
                        return (
                          <SortableComplementRow
                            key={ing.id}
                            item={ing}
                            active={active}
                            onToggle={() => setSelectedIngredientIds(active ? selectedIngredientIds.filter(id => id !== ing.id) : [...selectedIngredientIds, ing.id])}
                            showDefault
                            isDefault={selectedDefaultIngredientIds.includes(ing.id)}
                            onToggleDefault={() => setSelectedDefaultIngredientIds(prev => prev.includes(ing.id) ? prev.filter(id => id !== ing.id) : [...prev, ing.id])}
                            onEdit={() => setEditComplementModal({ id: ing.id, type: 'ingredient', name: ing.name, price: ing.price?.toString() || '', stock: String(ing.stock ?? 0), unlimited_stock: !!(ing.unlimited_stock === true || ing.unlimited_stock === 1 || ing.unlimited_stock === '1'), imageFile: null })}
                            onDelete={() => deleteComplementFromModal('ingredient', ing.id)}
                          />
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                  {prodNewComplements.map((comp, i) => (
                    <div key={`new-${i}`} style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center', padding: '6px', background: '#fffbe6', borderRadius: '8px', border: '1px dashed #e6c200' }}>
                      <label style={{ width: '32px', height: '32px', borderRadius: '6px', background: comp.imageFile ? 'transparent' : '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, overflow: 'hidden', border: '1px solid #ddd' }}>
                        {comp.imageFile ? <img src={URL.createObjectURL(comp.imageFile)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <FontAwesomeIcon icon={faBox} style={{ fontSize: '12px', color: '#bbb' }} />}
                        <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) { const arr = [...prodNewComplements]; arr[i] = { ...arr[i], imageFile: e.target.files[0] }; setProdNewComplements(arr); } }} style={{ display: 'none' }} />
                      </label>
                      <input type="text" value={comp.name} onChange={(e) => { const arr = [...prodNewComplements]; arr[i] = { ...arr[i], name: e.target.value }; setProdNewComplements(arr); }} placeholder="Nombre" className="store-prod-modal-input" style={{ flex: 2, padding: '8px', fontSize: '13px' }} />
                      <input type="number" step="0.01" value={comp.price} onChange={(e) => { const arr = [...prodNewComplements]; arr[i] = { ...arr[i], price: e.target.value }; setProdNewComplements(arr); }} placeholder="$" className="store-prod-modal-input" style={{ flex: 1, padding: '8px', fontSize: '13px' }} />
                      <button onClick={() => setProdNewComplements(prodNewComplements.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '4px' }}><FontAwesomeIcon icon={faTimes} /></button>
                    </div>
                  ))}
                  <button onClick={() => setProdNewComplements([...prodNewComplements, { name: '', price: '', imageFile: null }])} style={{ fontSize: '13px', color: 'var(--store-primary)', background: '#fff', border: '2px dashed #ccc', borderRadius: '8px', padding: '10px', cursor: 'pointer', width: '100%', marginTop: '8px', fontWeight: '600' }}>
                    <FontAwesomeIcon icon={faPlus} /> Crear nuevo complemento
                  </button>
                </>
              )}

              {complementsTab === 'extras' && (
                <>
                  {extras.length === 0 && prodNewExtras.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#999', fontSize: '13px', padding: '16px 0' }}>No hay extras creados</p>
                  )}
                  <DndContext sensors={editSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleComplementsDragEnd(e, 'extra')}>
                    <SortableContext items={extras.map(e => e.id)} strategy={verticalListSortingStrategy}>
                      {extras.map(ex => {
                        const active = selectedExtraIds.includes(ex.id);
                        return (
                          <SortableComplementRow
                            key={ex.id}
                            item={ex}
                            active={active}
                            onToggle={() => setSelectedExtraIds(active ? selectedExtraIds.filter(id => id !== ex.id) : [...selectedExtraIds, ex.id])}
                            onEdit={() => setEditComplementModal({ id: ex.id, type: 'extra', name: ex.name, price: ex.price?.toString() || '', stock: String(ex.stock ?? 0), unlimited_stock: !!(ex.unlimited_stock === true || ex.unlimited_stock === 1 || ex.unlimited_stock === '1'), imageFile: null })}
                            onDelete={() => deleteComplementFromModal('extra', ex.id)}
                          />
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                  {prodNewExtras.map((ext, i) => (
                    <div key={`new-${i}`} style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center', padding: '6px', background: '#fffbe6', borderRadius: '8px', border: '1px dashed #e6c200' }}>
                      <label style={{ width: '32px', height: '32px', borderRadius: '6px', background: ext.imageFile ? 'transparent' : '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, overflow: 'hidden', border: '1px solid #ddd' }}>
                        {ext.imageFile ? <img src={URL.createObjectURL(ext.imageFile)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <FontAwesomeIcon icon={faBox} style={{ fontSize: '12px', color: '#bbb' }} />}
                        <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) { const arr = [...prodNewExtras]; arr[i] = { ...arr[i], imageFile: e.target.files[0] }; setProdNewExtras(arr); } }} style={{ display: 'none' }} />
                      </label>
                      <input type="text" value={ext.name} onChange={(e) => { const arr = [...prodNewExtras]; arr[i] = { ...arr[i], name: e.target.value }; setProdNewExtras(arr); }} placeholder="Nombre" className="store-prod-modal-input" style={{ flex: 2, padding: '8px', fontSize: '13px' }} />
                      <input type="number" step="0.01" value={ext.price} onChange={(e) => { const arr = [...prodNewExtras]; arr[i] = { ...arr[i], price: e.target.value }; setProdNewExtras(arr); }} placeholder="$" className="store-prod-modal-input" style={{ flex: 1, padding: '8px', fontSize: '13px' }} />
                      <button onClick={() => setProdNewExtras(prodNewExtras.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '4px' }}><FontAwesomeIcon icon={faTimes} /></button>
                    </div>
                  ))}
                  <button onClick={() => setProdNewExtras([...prodNewExtras, { name: '', price: '', imageFile: null }])} style={{ fontSize: '13px', color: 'var(--store-primary)', background: '#fff', border: '2px dashed #ccc', borderRadius: '8px', padding: '10px', cursor: 'pointer', width: '100%', marginTop: '8px', fontWeight: '600' }}>
                    <FontAwesomeIcon icon={faPlus} /> Crear nuevo extra
                  </button>
                </>
              )}
            </div>

            {editingComplement && (
              <div style={{ marginTop: '10px', padding: '12px', background: '#fffbe6', borderRadius: '8px', border: '2px solid #e6c200' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#333', marginBottom: '8px' }}>Editando: {editingComplement.name}</div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <label style={{ width: '32px', height: '32px', borderRadius: '6px', background: editingComplement.imageFile ? 'transparent' : '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, overflow: 'hidden', border: '1px solid #ddd' }}>
                    {editingComplement.imageFile ? <img src={URL.createObjectURL(editingComplement.imageFile)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <FontAwesomeIcon icon={faBox} style={{ fontSize: '12px', color: '#bbb' }} />}
                    <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) setEditingComplement({ ...editingComplement, imageFile: e.target.files[0] }); }} style={{ display: 'none' }} />
                  </label>
                  <input type="text" value={editingComplement.name} onChange={(e) => setEditingComplement({ ...editingComplement, name: e.target.value })} placeholder="Nombre" className="store-prod-modal-input" style={{ flex: 2, padding: '8px', fontSize: '13px' }} />
                  <input type="number" step="0.01" value={editingComplement.price} onChange={(e) => setEditingComplement({ ...editingComplement, price: e.target.value })} placeholder="Precio +$" className="store-prod-modal-input" style={{ flex: 1, padding: '8px', fontSize: '13px' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={!!editingComplement.unlimited_stock}
                      onChange={(e) => setEditingComplement({ ...editingComplement, unlimited_stock: e.target.checked })}
                    />
                    Stock ilimitado
                  </label>
                  {!editingComplement.unlimited_stock && (
                    <input
                      type="number" min="0"
                      value={editingComplement.stock ?? ''}
                      onChange={(e) => setEditingComplement({ ...editingComplement, stock: e.target.value })}
                      placeholder="Cantidad"
                      className="store-prod-modal-input"
                      style={{ width: '90px', padding: '7px 8px', fontSize: '13px' }}
                    />
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <button onClick={() => setEditingComplement(null)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ccc', background: '#fff', fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={saveEditComplement} disabled={!editingComplement.name.trim()} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', background: 'var(--store-primary)', color: 'var(--store-secondary)', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Guardar</button>
                </div>
              </div>
            )}

            <button
              onClick={() => { setShowComplementsModal(false); setEditingComplement(null); }}
              style={{ marginTop: '14px', padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--store-primary)', color: 'var(--store-secondary)', fontSize: '14px', fontWeight: '700', cursor: 'pointer', width: '100%' }}
            >
              Listo
            </button>
          </div>
        </div>
      )}

      {styleEditorOpen && (
        <div className="store-modal-overlay" onClick={() => setStyleEditorOpen(false)} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <div className="store-prod-modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column', maxWidth: '420px' }}>
            <h3 style={{ margin: '0 0 12px', color: 'var(--store-primary)', textAlign: 'center' }}>
              <FontAwesomeIcon icon={faPalette} /> Editor de Estilos
              <span style={{ fontSize: '10px', display: 'block', color: '#999', marginTop: '2px' }}>PREMIUM</span>
            </h3>

            <div style={{ display: 'flex', gap: '0', marginBottom: '12px', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--store-primary)' }}>
              <button onClick={() => setStyleTab('visual')} style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', background: styleTab === 'visual' ? 'var(--store-primary)' : 'var(--store-secondary)', color: styleTab === 'visual' ? 'var(--store-secondary)' : 'var(--store-primary)' }}>
                <FontAwesomeIcon icon={faPalette} /> Visual
              </button>
              <button onClick={() => setStyleTab('css')} style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', background: styleTab === 'css' ? 'var(--store-primary)' : 'var(--store-secondary)', color: styleTab === 'css' ? 'var(--store-secondary)' : 'var(--store-primary)' }}>
                <FontAwesomeIcon icon={faCode} /> CSS Pro
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {styleTab === 'visual' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#555', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>Tipografia</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>Fuente</label>
                      <select value={visualSettings.fontFamily} onChange={(e) => { const v = { ...visualSettings, fontFamily: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} className="store-prod-modal-input" style={{ padding: '8px', fontSize: '12px', width: '100%' }}>
                        <option value="">Por defecto</option>
                        <option value="'Inter', sans-serif">Inter</option>
                        <option value="'Roboto', sans-serif">Roboto</option>
                        <option value="'Poppins', sans-serif">Poppins</option>
                        <option value="'Montserrat', sans-serif">Montserrat</option>
                        <option value="'Playfair Display', serif">Playfair Display</option>
                        <option value="'Lato', sans-serif">Lato</option>
                        <option value="'Oswald', sans-serif">Oswald</option>
                        <option value="'Raleway', sans-serif">Raleway</option>
                        <option value="monospace">Monospace</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>Peso</label>
                      <select value={visualSettings.fontWeight} onChange={(e) => { const v = { ...visualSettings, fontWeight: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} className="store-prod-modal-input" style={{ padding: '8px', fontSize: '12px', width: '100%' }}>
                        <option value="">Normal</option>
                        <option value="300">Light (300)</option>
                        <option value="400">Regular (400)</option>
                        <option value="500">Medium (500)</option>
                        <option value="600">Semi Bold (600)</option>
                        <option value="700">Bold (700)</option>
                        <option value="800">Extra Bold (800)</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>Tamaño general</label>
                      <input type="text" value={visualSettings.fontSize} onChange={(e) => { const v = { ...visualSettings, fontSize: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} placeholder="ej: 14px" className="store-prod-modal-input" style={{ padding: '8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>Tamaño titulo</label>
                      <input type="text" value={visualSettings.titleSize} onChange={(e) => { const v = { ...visualSettings, titleSize: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} placeholder="ej: 16px" className="store-prod-modal-input" style={{ padding: '8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>Tamaño precio</label>
                      <input type="text" value={visualSettings.priceSize} onChange={(e) => { const v = { ...visualSettings, priceSize: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} placeholder="ej: 18px" className="store-prod-modal-input" style={{ padding: '8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#888' }}>Sombra de texto</label>
                    <select value={visualSettings.textShadow} onChange={(e) => { const v = { ...visualSettings, textShadow: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} className="store-prod-modal-input" style={{ padding: '8px', fontSize: '12px', width: '100%' }}>
                      <option value="">Sin sombra</option>
                      <option value="1px 1px 2px rgba(0,0,0,0.3)">Suave</option>
                      <option value="2px 2px 4px rgba(0,0,0,0.5)">Media</option>
                      <option value="3px 3px 6px rgba(0,0,0,0.7)">Fuerte</option>
                      <option value="0 0 10px rgba(255,255,255,0.8)">Glow claro</option>
                      <option value="0 0 10px rgba(0,0,0,0.8)">Glow oscuro</option>
                    </select>
                  </div>

                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#555', borderBottom: '1px solid #eee', paddingBottom: '4px', marginTop: '6px' }}>Colores</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>Nombre producto</label>
                      <input type="color" value={visualSettings.productNameColor || '#000000'} onChange={(e) => { const v = { ...visualSettings, productNameColor: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} style={{ width: '100%', height: '32px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>Precio producto</label>
                      <input type="color" value={visualSettings.productPriceColor || '#000000'} onChange={(e) => { const v = { ...visualSettings, productPriceColor: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} style={{ width: '100%', height: '32px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>Header fondo</label>
                      <input type="color" value={visualSettings.headerBg || '#000000'} onChange={(e) => { const v = { ...visualSettings, headerBg: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} style={{ width: '100%', height: '32px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>Header texto</label>
                      <input type="color" value={visualSettings.headerTextColor || '#ffffff'} onChange={(e) => { const v = { ...visualSettings, headerTextColor: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} style={{ width: '100%', height: '32px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#555', borderBottom: '1px solid #eee', paddingBottom: '4px', marginTop: '6px' }}>Tarjetas de producto</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>Fondo tarjeta</label>
                      <input type="color" value={visualSettings.cardBg || '#ffffff'} onChange={(e) => { const v = { ...visualSettings, cardBg: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} style={{ width: '100%', height: '32px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>Borde tarjeta</label>
                      <input type="text" value={visualSettings.cardBorder} onChange={(e) => { const v = { ...visualSettings, cardBorder: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} placeholder="ej: 2px solid gold" className="store-prod-modal-input" style={{ padding: '8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>Sombra tarjeta</label>
                      <select value={visualSettings.cardShadow} onChange={(e) => { const v = { ...visualSettings, cardShadow: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} className="store-prod-modal-input" style={{ padding: '8px', fontSize: '12px', width: '100%' }}>
                        <option value="">Sin sombra</option>
                        <option value="0 2px 8px rgba(0,0,0,0.1)">Suave</option>
                        <option value="0 4px 16px rgba(0,0,0,0.15)">Media</option>
                        <option value="0 8px 32px rgba(0,0,0,0.2)">Grande</option>
                        <option value="0 0 20px rgba(212,175,55,0.3)">Glow dorado</option>
                        <option value="0 0 20px rgba(0,0,0,0.4)">Glow oscuro</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>Radio bordes</label>
                      <select value={visualSettings.cardRadius} onChange={(e) => { const v = { ...visualSettings, cardRadius: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} className="store-prod-modal-input" style={{ padding: '8px', fontSize: '12px', width: '100%' }}>
                        <option value="">Por defecto</option>
                        <option value="0">Sin bordes (0)</option>
                        <option value="4px">Poco (4px)</option>
                        <option value="8px">Normal (8px)</option>
                        <option value="16px">Redondeado (16px)</option>
                        <option value="24px">Muy redondeado (24px)</option>
                        <option value="50%">Circular</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#555', borderBottom: '1px solid #eee', paddingBottom: '4px', marginTop: '6px' }}>Categorias</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>Fondo tab</label>
                      <input type="color" value={visualSettings.categoryBg || '#ffffff'} onChange={(e) => { const v = { ...visualSettings, categoryBg: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} style={{ width: '100%', height: '32px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>Tab activo</label>
                      <input type="color" value={visualSettings.categoryActiveColor || '#000000'} onChange={(e) => { const v = { ...visualSettings, categoryActiveColor: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} style={{ width: '100%', height: '32px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#555', borderBottom: '1px solid #eee', paddingBottom: '4px', marginTop: '6px' }}>Barra del carrito</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>Fondo carrito</label>
                      <input type="color" value={visualSettings.cartBg || '#000000'} onChange={(e) => { const v = { ...visualSettings, cartBg: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} style={{ width: '100%', height: '32px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#888' }}>Texto carrito</label>
                      <input type="color" value={visualSettings.cartTextColor || '#ffffff'} onChange={(e) => { const v = { ...visualSettings, cartTextColor: e.target.value }; setVisualSettings(v); applyStyles(v, customCss); }} style={{ width: '100%', height: '32px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
                    </div>
                  </div>
                </div>
              )}

              {styleTab === 'css' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>CSS personalizado. Usa selectores como <code>.store-container</code>, <code>.store-product-card</code>, <code>.store-header</code>, etc.</p>
                  <textarea
                    value={customCss}
                    onChange={(e) => { setCustomCss(e.target.value); applyStyles(visualSettings, e.target.value); }}
                    placeholder={`.store-product-card {\n  border: 2px solid gold;\n  transform: scale(1.02);\n}\n\n.store-header {\n  background: linear-gradient(135deg, #1a1a2e, #16213e);\n}`}
                    style={{ width: '100%', minHeight: '250px', padding: '12px', fontSize: '12px', fontFamily: 'monospace', border: '2px solid #e0e0e0', borderRadius: '8px', resize: 'vertical', boxSizing: 'border-box', lineHeight: '1.5', background: '#1e1e1e', color: '#d4d4d4' }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={() => setStyleEditorOpen(false)} className="store-prod-modal-btn cancel">Cerrar</button>
              <button onClick={() => {
                if (!confirm('Reiniciar todos los estilos a los valores por defecto?')) return;
                const defaults = { fontFamily: '', fontSize: '', titleSize: '', priceSize: '', fontWeight: '', textShadow: '', cardShadow: '', cardRadius: '', productNameColor: '', productPriceColor: '', cardBg: '', cardBorder: '', headerBg: '', headerTextColor: '', categoryBg: '', categoryActiveColor: '', cartBg: '', cartTextColor: '' };
                setVisualSettings(defaults);
                setCustomCss('');
                applyStyles(defaults, '');
              }} className="store-prod-modal-btn cancel" style={{ flex: 'none', padding: '10px', fontSize: '12px' }}>
                Reiniciar
              </button>
              <button onClick={saveStoreStyles} disabled={styleSaving} className="store-prod-modal-btn confirm" style={{ background: 'var(--store-accent)', color: 'var(--store-primary)' }}>
                {styleSaving ? 'Guardando...' : 'Guardar estilos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {complementModal && (
        <div className="store-modal-overlay" onClick={() => setComplementModal(null)} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <div className="store-prod-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', color: 'var(--store-primary)', textAlign: 'center' }}>
              Nuevo {complementModal === 'extra' ? 'Extra' : 'Ingrediente'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="text" value={complementForm.name} onChange={(e) => setComplementForm({ ...complementForm, name: e.target.value })} placeholder="Nombre" autoFocus className="store-prod-modal-input main" />
              <input type="number" step="0.01" value={complementForm.price} onChange={(e) => setComplementForm({ ...complementForm, price: e.target.value })} placeholder="Precio adicional" className="store-prod-modal-input" />
              <select value={complementForm.category_id} onChange={(e) => setComplementForm({ ...complementForm, category_id: e.target.value })} className="store-prod-modal-input">
                <option value="">Sin categoría</option>
                {(store?.categories || []).map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
              </select>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer', flex: 1 }}>
                  <input type="checkbox" checked={complementForm.unlimited_stock} onChange={(e) => setComplementForm({ ...complementForm, unlimited_stock: e.target.checked })} />
                  Stock ilimitado
                </label>
                {!complementForm.unlimited_stock && (
                  <input type="number" min="0" value={complementForm.stock} onChange={(e) => setComplementForm({ ...complementForm, stock: e.target.value })} placeholder="Stock" className="store-prod-modal-input" style={{ width: '80px' }} />
                )}
              </div>
              <label className="store-prod-modal-image-btn" style={{ alignSelf: 'flex-start' }}>
                <FontAwesomeIcon icon={faEdit} /> {complementForm.imageFile ? complementForm.imageFile.name : 'Imagen'}
                <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) setComplementForm({ ...complementForm, imageFile: e.target.files[0] }); }} style={{ display: 'none' }} />
              </label>
            </div>
            <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '12px', marginTop: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 8 }}>Receta (Materias Primas)</div>
              <RecipeEditor
                key={`new-${complementModal}`}
                ref={compRecipeRef}
                storeId={store?.store?.id}
                itemType={complementModal === 'extra' ? 'extra' : 'ingredient'}
                itemId={null}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setComplementModal(null)} className="store-prod-modal-btn cancel">Cancelar</button>
              <button onClick={saveComplement} disabled={!complementForm.name.trim()} className={`store-prod-modal-btn confirm${!complementForm.name.trim() ? ' disabled' : ''}`}>Crear</button>
            </div>
          </div>
        </div>
      )}

      {catModalOpen && (
        <div className="store-modal-overlay" onClick={() => { setCatModalOpen(false); setCatModalFromProduct(false); }} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <div className="store-pin-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--store-primary)', textAlign: 'center' }}>
              {editingCat ? 'Editar Categoría' : 'Nueva Categoría'}
            </h3>
            <input
              type="text"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveCat(); }}
              placeholder="Nombre de la categoría"
              autoFocus
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '2px solid var(--store-primary)',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={() => { setCatModalOpen(false); setCatModalFromProduct(false); }}
                style={{
                  flex: 1, padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px',
                  background: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: '600'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={saveCat}
                disabled={!catName.trim()}
                style={{
                  flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
                  background: catName.trim() ? 'var(--store-accent)' : '#ccc',
                  color: catName.trim() ? 'var(--store-primary)' : '#666',
                  fontSize: '14px', cursor: catName.trim() ? 'pointer' : 'default', fontWeight: '700'
                }}
              >
                {editingCat ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editComplementModal && (
        <div className="store-modal-overlay" onClick={() => setEditComplementModal(null)} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <div className="store-prod-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px', color: 'var(--store-primary)', textAlign: 'center' }}>
              Editar {editComplementModal.type === 'extra' ? 'Extra' : 'Complemento'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                value={editComplementModal.name}
                onChange={(e) => setEditComplementModal({ ...editComplementModal, name: e.target.value })}
                placeholder="Nombre"
                autoFocus
                className="store-prod-modal-input main"
              />
              <input
                type="number"
                step="0.01"
                value={editComplementModal.price}
                onChange={(e) => setEditComplementModal({ ...editComplementModal, price: e.target.value })}
                placeholder="Precio adicional"
                className="store-prod-modal-input"
              />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={!!editComplementModal.unlimited_stock}
                    onChange={(e) => setEditComplementModal({ ...editComplementModal, unlimited_stock: e.target.checked })}
                  />
                  Stock ilimitado
                </label>
                {!editComplementModal.unlimited_stock && (
                  <input
                    type="number" min="0"
                    value={editComplementModal.stock ?? ''}
                    onChange={(e) => setEditComplementModal({ ...editComplementModal, stock: e.target.value })}
                    placeholder="Stock"
                    className="store-prod-modal-input"
                    style={{ width: '80px' }}
                  />
                )}
              </div>
              <label className="store-prod-modal-image-btn" style={{ alignSelf: 'flex-start' }}>
                <FontAwesomeIcon icon={faEdit} /> {editComplementModal.imageFile ? editComplementModal.imageFile.name : 'Cambiar imagen'}
                <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) setEditComplementModal({ ...editComplementModal, imageFile: e.target.files[0] }); }} style={{ display: 'none' }} />
              </label>
              <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '12px' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 8 }}>Receta (Materias Primas)</div>
                <RecipeEditor
                  key={`edit-comp-${editComplementModal.id}`}
                  ref={editCompRecipeRef}
                  storeId={store?.store?.id}
                  itemType={editComplementModal.type}
                  itemId={editComplementModal.id}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setEditComplementModal(null)} className="store-prod-modal-btn cancel">Cancelar</button>
              <button onClick={saveEditComplementModal} disabled={!editComplementModal.name.trim()} className={`store-prod-modal-btn confirm${!editComplementModal.name.trim() ? ' disabled' : ''}`}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {labelEditModal && (
        <div className="store-modal-overlay" onClick={() => setLabelEditModal(null)} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <div className="store-prod-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 6px', color: 'var(--store-primary)', textAlign: 'center' }}>
              Cambiar nombre
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#888', textAlign: 'center' }}>
              Texto que ven los clientes en el paso de {labelEditModal.type === 'extras' ? '"Extras"' : '"Complementos"'} al pedir.
            </p>
            <input
              type="text"
              value={labelEditModal.value}
              onChange={(e) => setLabelEditModal({ ...labelEditModal, value: e.target.value })}
              maxLength={100}
              placeholder={labelEditModal.type === 'extras' ? 'Extras' : 'Complementos'}
              className="store-prod-modal-input"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') saveStoreLabels(); }}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#aaa' }}>Déjalo vacío para usar el nombre por defecto.</p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setLabelEditModal(null)} className="store-prod-modal-btn cancel">Cancelar</button>
              <button onClick={saveStoreLabels} disabled={labelSaving} className="store-prod-modal-btn confirm">{labelSaving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear/editar sección (tótem) */}
      {sectionGroupModal && (
        <div className="store-modal-overlay" onClick={() => setSectionGroupModal(null)} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <div className="store-prod-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <h3 style={{ margin: '0 0 12px', color: 'var(--store-primary)', textAlign: 'center' }}>
              {sectionGroupModal.id ? 'Editar sección' : 'Nueva sección'}
            </h3>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>Nombre</label>
            <input type="text" value={sectionGroupModal.name} autoFocus placeholder="Ej: Salsas"
              className="store-prod-modal-input" style={{ width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
              onChange={(e) => setSectionGroupModal({ ...sectionGroupModal, name: e.target.value })} />
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>Mínimo</label>
                <input type="number" min="0" value={sectionGroupModal.min_select}
                  className="store-prod-modal-input" style={{ width: '100%', boxSizing: 'border-box' }}
                  onChange={(e) => setSectionGroupModal({ ...sectionGroupModal, min_select: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>Máximo (0=∞)</label>
                <input type="number" min="0" value={sectionGroupModal.max_select}
                  className="store-prod-modal-input" style={{ width: '100%', boxSizing: 'border-box' }}
                  onChange={(e) => setSectionGroupModal({ ...sectionGroupModal, max_select: e.target.value })} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={sectionGroupModal.required}
                onChange={(e) => setSectionGroupModal({ ...sectionGroupModal, required: e.target.checked })} />
              Obligatorio (el cliente debe elegir)
            </label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setSectionGroupModal(null)} className="store-prod-modal-btn cancel">Cancelar</button>
              <button onClick={saveSectionGroup} disabled={sectionSaving || !sectionGroupModal.name.trim()} className="store-prod-modal-btn confirm">
                {sectionSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear/editar opción de sección (tótem) */}
      {sectionOptionModal && (
        <div className="store-modal-overlay" onClick={() => setSectionOptionModal(null)} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <div className="store-prod-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <h3 style={{ margin: '0 0 12px', color: 'var(--store-primary)', textAlign: 'center' }}>
              {sectionOptionModal.id ? 'Editar opción' : 'Nueva opción'}
            </h3>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>Nombre</label>
            <input type="text" value={sectionOptionModal.name} autoFocus placeholder="Ej: Ketchup"
              className="store-prod-modal-input" style={{ width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
              onChange={(e) => setSectionOptionModal({ ...sectionOptionModal, name: e.target.value })} />
            <label style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>Precio extra</label>
            <input type="number" step="0.01" value={sectionOptionModal.price} placeholder="0.00"
              className="store-prod-modal-input" style={{ width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
              onChange={(e) => setSectionOptionModal({ ...sectionOptionModal, price: e.target.value })} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={sectionOptionModal.unlimited_stock}
                onChange={(e) => setSectionOptionModal({ ...sectionOptionModal, unlimited_stock: e.target.checked })} />
              Stock ilimitado
            </label>
            {!sectionOptionModal.unlimited_stock && (
              <>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>Stock</label>
                <input type="number" min="0" value={sectionOptionModal.stock} placeholder="0"
                  className="store-prod-modal-input" style={{ width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
                  onChange={(e) => setSectionOptionModal({ ...sectionOptionModal, stock: e.target.value })} />
              </>
            )}
            <label style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>Imagen (opcional)</label>
            <input type="file" accept="image/*" style={{ width: '100%', marginBottom: 10 }}
              onChange={(e) => { const f = e.target.files[0]; if (f) setSectionOptionModal({ ...sectionOptionModal, imageFile: f }); }} />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button onClick={() => setSectionOptionModal(null)} className="store-prod-modal-btn cancel">Cancelar</button>
              <button onClick={saveSectionOption} disabled={sectionSaving || !sectionOptionModal.name.trim()} className="store-prod-modal-btn confirm">
                {sectionSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal gestión de opciones de sección (se abre automáticamente al crear desde editor de producto) */}
      {sectionEditingGroup && !sectionOptionModal && (
        <div className="store-modal-overlay" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <div className="store-prod-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h3 style={{ margin: '0 0 4px', color: 'var(--store-primary)', textAlign: 'center' }}>
              {sectionEditingGroup.name}
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#888', textAlign: 'center' }}>
              Agregá las opciones que verá el cliente
            </p>

            {/* Lista de opciones existentes */}
            {(sectionEditingGroup.options || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#bbb', fontSize: 13 }}>
                Aún no hay opciones. Presioná <strong>+ Agregar opción</strong>.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {(sectionEditingGroup.options || []).map(opt => (
                  <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                    {opt.image && <img src={opt.image} alt={opt.name} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6 }} />}
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{opt.name}</span>
                    {Number(opt.price) > 0 && <span style={{ fontSize: 12, color: '#6b7280' }}>+${Number(opt.price).toFixed(2)}</span>}
                    <button
                      onClick={() => setSectionOptionModal({ id: opt.id, group_id: sectionEditingGroup.id, name: opt.name, price: opt.price?.toString() || '', stock: String(opt.stock ?? 0), unlimited_stock: !!opt.unlimited_stock, imageFile: null })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px 5px', fontSize: 13 }}
                      title="Editar opción"
                    >✏️</button>
                    <button
                      onClick={async () => { if (confirm('¿Eliminar esta opción?')) { await deleteSectionOption(opt.id); } }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px 5px', fontSize: 13 }}
                      title="Eliminar opción"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Botón agregar opción */}
            <button
              onClick={() => setSectionOptionModal({ group_id: sectionEditingGroup.id, name: '', price: '', stock: '', unlimited_stock: true, imageFile: null })}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '2px dashed var(--store-primary)', background: 'transparent', color: 'var(--store-primary)', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}
            >
              + Agregar opción
            </button>

            <button
              onClick={() => setSectionEditingGroup(null)}
              className="store-prod-modal-btn confirm"
              style={{ width: '100%' }}
            >
              Listo
            </button>
          </div>
        </div>
      )}

      {prodRecipeModal && (
        <div className="store-modal-overlay" onClick={() => setProdRecipeModal(null)} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <div className="store-prod-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 6px', color: 'var(--store-primary)', textAlign: 'center' }}>
              Materias Primas
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#888', textAlign: 'center' }}>{prodRecipeModal.name}</p>
            <RecipeEditor
              key={`prod-recipe-${prodRecipeModal.id}`}
              ref={prodRecipeSaveRef}
              storeId={store?.store?.id}
              itemType="product"
              itemId={prodRecipeModal.id}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setProdRecipeModal(null)} className="store-prod-modal-btn cancel">Cancelar</button>
              <button
                onClick={async () => { await prodRecipeSaveRef.current?.save(prodRecipeModal.id); setProdRecipeModal(null); }}
                className="store-prod-modal-btn confirm"
              >
                Guardar receta
              </button>
            </div>
          </div>
        </div>
      )}

      {rmModal && (
        <div className="store-modal-overlay" onClick={() => setRmModal(null)} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
          <div className="store-prod-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h3 style={{ margin: '0 0 14px', color: 'var(--store-primary)' }}>
              {rmModal === 'new' ? 'Nueva Materia Prima' : 'Editar Materia Prima'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Nombre *</label>
                <input value={rmForm.name} onChange={e => setRmForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Harina" style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} autoFocus />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Cantidad</label>
                  <input type="number" min="0" step="0.01" value={rmForm.quantity} onChange={e => setRmForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div style={{ flex: 3 }}>
                  <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Unidad</label>
                  <select value={rmForm.unit} onChange={e => setRmForm(f => ({ ...f, unit: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }}>
                    {RM_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Stock mínimo (alerta)</label>
                  <input type="number" min="0" step="0.01" value={rmForm.min_quantity} onChange={e => setRmForm(f => ({ ...f, min_quantity: e.target.value }))} placeholder="0" style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Costo por unidad</label>
                  <input type="number" min="0" step="0.01" value={rmForm.cost_per_unit} onChange={e => setRmForm(f => ({ ...f, cost_per_unit: e.target.value }))} placeholder="0" style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setRmModal(null)} className="store-prod-modal-btn cancel">Cancelar</button>
              <button onClick={saveRm} disabled={rmSaving || !rmForm.name.trim()} className={`store-prod-modal-btn confirm${(!rmForm.name.trim() || rmSaving) ? ' disabled' : ''}`}>
                {rmSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAllModal && (
        <div className="store-modal-overlay" onClick={() => !deletingAll && setShowDeleteAllModal(false)}>
          <div className="store-pin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px', textAlign: 'center' }}>
            <div style={{ fontSize: '44px', marginBottom: '10px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px', color: '#e53e3e' }}>Eliminar todos los productos</h3>
            <p style={{ margin: '0 0 6px', fontSize: '14px', color: '#444' }}>
              Esta acción eliminará <strong>todos los {(store?.products || []).length} productos</strong> de tu tienda.
            </p>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#e53e3e', fontWeight: '600' }}>
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={deleteAllProducts}
                disabled={deleteAllCountdown > 0 || deletingAll}
                style={{
                  padding: '13px', border: 'none', borderRadius: '10px',
                  background: deleteAllCountdown > 0 ? '#ccc' : '#e53e3e',
                  color: '#fff', fontSize: '14px', fontWeight: '700',
                  cursor: deleteAllCountdown > 0 || deletingAll ? 'not-allowed' : 'pointer',
                  transition: 'background 0.3s'
                }}
              >
                {deletingAll ? 'Eliminando...' : deleteAllCountdown > 0 ? `Confirmar (${deleteAllCountdown}s)` : 'Sí, eliminar todo'}
              </button>
              <button
                onClick={() => setShowDeleteAllModal(false)}
                disabled={deletingAll}
                style={{ padding: '13px', border: '2px solid #e0e0e0', borderRadius: '10px', background: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteSelectedModal && (
        <div className="store-modal-overlay" onClick={() => !deletingSelected && setShowDeleteSelectedModal(false)}>
          <div className="store-pin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px', textAlign: 'center' }}>
            <div style={{ fontSize: '44px', marginBottom: '10px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px', color: '#e53e3e' }}>Eliminar productos seleccionados</h3>
            <p style={{ margin: '0 0 6px', fontSize: '14px', color: '#444' }}>
              Vas a eliminar <strong>{selectedProductIds.size} producto{selectedProductIds.size !== 1 ? 's' : ''}</strong> seleccionado{selectedProductIds.size !== 1 ? 's' : ''}.
            </p>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#e53e3e', fontWeight: '600' }}>
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={deleteSelectedProducts}
                disabled={deleteSelectedCountdown > 0 || deletingSelected}
                style={{
                  padding: '13px', border: 'none', borderRadius: '10px',
                  background: deleteSelectedCountdown > 0 ? '#ccc' : '#e53e3e',
                  color: '#fff', fontSize: '14px', fontWeight: '700',
                  cursor: deleteSelectedCountdown > 0 || deletingSelected ? 'not-allowed' : 'pointer',
                  transition: 'background 0.3s'
                }}
              >
                {deletingSelected ? 'Eliminando...' : deleteSelectedCountdown > 0 ? `Confirmar (${deleteSelectedCountdown}s)` : 'Sí, eliminar seleccionados'}
              </button>
              <button
                onClick={() => setShowDeleteSelectedModal(false)}
                disabled={deletingSelected}
                style={{ padding: '13px', border: '2px solid #e0e0e0', borderRadius: '10px', background: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showRestartConfirm && (
        <div className="store-modal-overlay" onClick={() => {}}>
          <div className="store-pin-modal" style={{ maxWidth: '340px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>&#x1F504;</div>
            <h3 style={{ margin: '0 0 8px', color: 'var(--store-primary)' }}>Edición completada</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#666' }}>
              ¿Deseas reiniciar todos los totems para que apliquen los cambios?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={async () => {
                  setRestartingSending(true);
                  try {
                    await fetch(`/api/public/${code}/restart-all`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(getAuthBody())
                    });
                  } catch {}
                  setRestartingSending(false);
                  setShowRestartConfirm(false);
                }}
                disabled={restartingSending}
                style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '8px', background: 'var(--store-accent)', color: 'var(--store-primary)', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
              >
                {restartingSending ? 'Enviando...' : 'Reiniciar totems y regresar al editor'}
              </button>
              <button
                onClick={() => { setShowRestartConfirm(false); setEditMode(false); if (adminToken) navigate('/admin'); }}
                style={{ flex: 1, padding: '12px', border: '2px solid #e0e0e0', borderRadius: '8px', background: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
              >
                Reiniciar totems y salir
              </button>
            </div>
          </div>
        </div>
      )}

      {infoModalOpen && (
        <div className="store-modal-overlay" onClick={() => setInfoModalOpen(false)}>
          <div className="store-pin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '340px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FontAwesomeIcon icon={faInfoCircle} style={{ color: 'var(--store-accent)', fontSize: '18px' }} />
                <span style={{ fontWeight: '700', fontSize: '15px', color: 'var(--store-primary)' }}>Info del Tótem</span>
              </div>
              <button onClick={() => setInfoModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '18px' }}>&times;</button>
            </div>
            <div style={{ fontSize: '12px', color: '#555', lineHeight: '2', background: '#f8f8f8', borderRadius: '8px', padding: '12px' }}>
              <div><strong>Device UID:</strong> <span style={{ fontFamily: 'monospace', fontSize: '10px', wordBreak: 'break-all' }}>{deviceUid}</span></div>
              <div><strong>Tienda:</strong> {store?.store?.name || '-'} ({code})</div>
              <div><strong>Store ID:</strong> {store?.store?.id || '-'}</div>
              <div><strong>Config:</strong> {selectedConfiguration?.name || 'Ninguna'}{selectedConfiguration?.id ? ` (#${selectedConfiguration.id})` : ''}</div>
              <div><strong>Terminal:</strong> {selectedTerminalId || 'Ninguna'}</div>
              <div><strong>Socket:</strong> {socketRef.current?.connected ? '🟢 Conectado' : '🔴 Desconectado'}{socketRef.current?.id ? ` (${socketRef.current.id})` : ''}</div>
            </div>
            <p style={{ fontSize: '11px', color: '#bbb', textAlign: 'center', marginTop: '12px', marginBottom: 0 }}>Mantén presionado 2 segundos en cualquier parte de la pantalla para acceder al PIN de edición</p>
          </div>
        </div>
      )}

      {productInfo && (
        <div className="store-modal-overlay" onClick={() => setProductInfo(null)}>
          <div className="store-product-info-modal" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setProductInfo(null)} className="store-product-info-modal-close">&times;</button>
            <div className="store-product-info-modal-img">
              <img src={getProductImageUrl(productInfo.image)} alt={productInfo.name} />
            </div>
            <div className="store-product-info-modal-body">
              <div className="store-product-info-modal-head">
                <h3>{productInfo.name}</h3>
                <span className="store-product-info-modal-price">{colors.currency.symbol}{formatPrice(productInfo.price)}</span>
              </div>
              <p className="store-product-info-modal-desc">{productInfo.description}</p>
            </div>
          </div>
        </div>
      )}

      {pinModalOpen && (
        <div className="store-modal-overlay" onClick={() => setPinModalOpen(false)} style={ticketMode ? { zIndex: 10001 } : undefined}>
          <div className="store-pin-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <FontAwesomeIcon icon={faLock} style={{ fontSize: '28px', color: 'var(--store-accent)', marginBottom: '8px' }} />
              <h3 style={{ margin: 0, color: 'var(--store-primary)' }}>Ingresa el PIN</h3>
            </div>

            <div className="pin-dots">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`pin-dot${pinInput.length > i ? ' filled' : ''}`}
                  style={{
                    borderColor: pinError ? '#dc3545' : 'var(--store-primary)'
                  }}
                />
              ))}
            </div>

            {pinError && (
              <p style={{ color: '#dc3545', textAlign: 'center', margin: '8px 0 0', fontSize: '14px' }}>
                {pinError}
              </p>
            )}

            <div className="pin-numpad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((key, idx) => (
                <button
                  key={idx}
                  className={`pin-numpad-btn${key === null ? ' pin-numpad-empty' : ''}${key === 'del' ? ' pin-numpad-del' : ''}`}
                  onClick={() => {
                    if (key === null) return;
                    if (key === 'del') {
                      setPinInput(prev => prev.slice(0, -1));
                      setPinError('');
                      return;
                    }
                    if (pinInput.length >= 4) return;
                    const newPin = pinInput + key;
                    setPinInput(newPin);
                    setPinError('');
                    if (newPin.length === 4) {
                      setTimeout(() => {
                        handlePinSubmit(newPin);
                      }, 200);
                    }
                  }}
                  disabled={key === null}
                >
                  {key === 'del' ? (
                    <FontAwesomeIcon icon={faArrowLeft} />
                  ) : key !== null ? key : ''}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPinModalOpen(false)}
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '12px',
                backgroundColor: 'transparent',
                color: '#999',
                border: 'none',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {/* PIN Options modal - shown after correct PIN entry */}
      {pinOptionsModalOpen && (
        <div className="store-modal-overlay" onClick={() => setPinOptionsModalOpen(false)} style={ticketMode ? { zIndex: 10001 } : undefined}>
          <div className="store-pin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '320px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <FontAwesomeIcon icon={faLock} style={{ fontSize: '28px', color: 'var(--store-accent)', marginBottom: '8px' }} />
              <h3 style={{ margin: 0, color: 'var(--store-primary)' }}>¿Qué deseas hacer?</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {ticketMode && (
                <button
                  onClick={() => {
                    setPinOptionsModalOpen(false);
                    setTicketMode(false); localStorage.removeItem('srservi_ticket_mode');
                  }}
                  style={{ padding: '14px', borderRadius: '10px', border: '2px solid #2563eb', background: '#eff6ff', color: '#1d4ed8', fontSize: '15px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  🏪 Salir del modo Ticketería
                </button>
              )}
              <button
                onClick={async () => {
                  setPinOptionsModalOpen(false);
                  setPosSelectLoading(true);
                  setPosSelectModalOpen(true);
                  try {
                    const res = await fetch(`/api/public/pos-devices/${code}`);
                    const list = res.ok ? await res.json() : [];
                    setPosSelectList(Array.isArray(list) ? list : []);
                  } catch { setPosSelectList([]); }
                  setPosSelectLoading(false);
                }}
                style={{ padding: '14px', borderRadius: '10px', border: '2px solid var(--store-primary)', background: '#fff', color: 'var(--store-primary)', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
              >
                Cambiar POS
              </button>
              <button
                onClick={() => {
                  setPinOptionsModalOpen(false);
                  setTicketMode(true); localStorage.setItem('srservi_ticket_mode', '1');
                }}
                style={{ padding: '14px', borderRadius: '10px', border: '2px solid #C8A415', background: '#fffbeb', color: '#92760a', fontSize: '15px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                🎟️ Modo Ticketería
              </button>
              <button
                onClick={() => {
                  setPinOptionsModalOpen(false);
                  setEditMode(true);
                }}
                style={{ padding: '14px', borderRadius: '10px', border: '2px solid var(--store-accent)', background: 'var(--store-primary)', color: 'var(--store-secondary)', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
              >
                Editar tótem
              </button>
              <div style={{ marginTop: '8px', padding: '14px', borderRadius: '10px', border: '1px solid #e0e0e0', background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--store-primary)' }}>Zoom del tótem</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--store-accent)', minWidth: '42px', textAlign: 'right' }}>{Math.round(totemZoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="200"
                  step="5"
                  value={Math.round(totemZoom * 100)}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) / 100;
                    setTotemZoom(val);
                    localStorage.setItem('srservi_totem_zoom', String(val));
                  }}
                  style={{ width: '100%', accentColor: 'var(--store-accent)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                  <span>20%</span><span>100%</span><span>200%</span>
                </div>
              </div>
              <div style={{ padding: '14px', borderRadius: '10px', border: '1px solid #e0e0e0', background: '#fafafa' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--store-primary)', marginBottom: '10px' }}>Métodos de pago</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#555' }}>Tarjeta</span>
                    <button
                      onClick={() => {
                        const next = !localAcceptCard;
                        setLocalAcceptCard(next);
                        localStorage.setItem('srservi_accept_card', String(next));
                      }}
                      style={{
                        width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                        background: localAcceptCard ? 'var(--store-primary)' : '#ccc',
                        position: 'relative', transition: 'background 0.2s'
                      }}
                    >
                      <span style={{
                        display: 'block', width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: '3px', transition: 'left 0.2s',
                        left: localAcceptCard ? '25px' : '3px'
                      }} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#555' }}>Efectivo</span>
                    <button
                      onClick={() => {
                        const next = !localAcceptCash;
                        setLocalAcceptCash(next);
                        localStorage.setItem('srservi_accept_cash', String(next));
                      }}
                      style={{
                        width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                        background: localAcceptCash ? 'var(--store-primary)' : '#ccc',
                        position: 'relative', transition: 'background 0.2s'
                      }}
                    >
                      <span style={{
                        display: 'block', width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: '3px', transition: 'left 0.2s',
                        left: localAcceptCash ? '25px' : '3px'
                      }} />
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setPinOptionsModalOpen(false)}
                style={{ padding: '10px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#999', fontSize: '14px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS selection modal - from within the totem */}
      {posSelectModalOpen && (
        <div className="store-modal-overlay" onClick={() => setPosSelectModalOpen(false)} style={ticketMode ? { zIndex: 10001 } : undefined}>
          <div className="store-pin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px' }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--store-primary)' }}>Seleccionar POS</h3>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#888' }}>Elige el terminal de pago para este tótem</p>
            </div>
            {posSelectLoading ? (
              <p style={{ textAlign: 'center', color: '#888', padding: '20px 0' }}>Buscando terminales...</p>
            ) : posSelectList.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#d97706', padding: '20px 0' }}>No hay terminales disponibles</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                {posSelectList.map(pos => (
                  <button
                    key={pos.id}
                    onClick={() => {
                      localStorage.setItem('srservi_last_terminal_id', pos.id);
                      localStorage.setItem('srservi_last_terminal_name', pos.name || '');
                      localStorage.setItem('srservi_last_terminal_provider', pos.provider || '');
                      setSelectedTerminalId(String(pos.id));
                      setSelectedTerminalProvider(pos.provider || '');
                      if (pos.provider === 'tuu' && tuuProvider) {
                        setTuuProvider({ ...tuuProvider, deviceUid: pos.id });
                      }
                      setPosSelectModalOpen(false);
                    }}
                    style={{
                      padding: '12px 16px', borderRadius: '10px',
                      border: `2px solid ${String(selectedTerminalId) === String(pos.id) ? 'var(--store-primary)' : '#e0e0e0'}`,
                      background: String(selectedTerminalId) === String(pos.id) ? 'var(--store-accent)' : '#fff',
                      color: 'var(--store-primary)', fontSize: '14px', fontWeight: '600',
                      cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                  >
                    <span>{pos.name}</span>
                    <span style={{ fontSize: '12px', color: '#888', fontWeight: '400' }}>
                      {pos.provider === 'mercadopago' ? 'MercadoPago' : pos.provider === 'square' ? 'Square' : 'TUU'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setPosSelectModalOpen(false)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#999', fontSize: '14px', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Welcome modal - language selection with explosion animation */}
      {welcomeModalOpen && (
        <div className="store-modal-overlay" style={{ zIndex: 99999, transition: 'opacity 0.4s', opacity: welcomeClosing ? 0 : 1 }}>
          <style>{`
            @keyframes welcome-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
            @keyframes welcome-card-in { from{opacity:0;transform:scale(0.8) translateY(30px)} to{opacity:1;transform:scale(1) translateY(0)} }
            @keyframes welcome-btn-in { from{opacity:0;transform:translateX(-20px)} to{opacity:1;transform:translateX(0)} }
            @keyframes welcome-pulse { 0%,100%{box-shadow:0 0 0 0 var(--store-accent)} 50%{box-shadow:0 0 0 12px transparent} }
            @keyframes welcome-selected-zoom { 0%{transform:scale(1)} 40%{transform:scale(1.15)} 100%{transform:scale(30);opacity:0} }
            @keyframes welcome-check-pop { 0%{transform:scale(0) rotate(-45deg);opacity:0} 50%{transform:scale(1.3) rotate(10deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:1} }
            @keyframes welcome-particles { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{opacity:0} }
            @keyframes welcome-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
          `}</style>
          <div style={{ background: 'var(--store-primary)', borderRadius: '24px', padding: '36px 28px', maxWidth: '380px', width: '92%', textAlign: 'center', color: 'var(--store-secondary)', animation: 'welcome-card-in 0.6s cubic-bezier(0.34,1.56,0.64,1) both', position: 'relative', overflow: 'hidden' }}>

            {/* Particles on selection */}
            {welcomeSelectedLang && (
              <>
                {Array.from({ length: 12 }).map((_, i) => {
                  const angle = (i / 12) * 360;
                  const dist = 80 + Math.random() * 60;
                  const dx = Math.cos(angle * Math.PI / 180) * dist;
                  const dy = Math.sin(angle * Math.PI / 180) * dist;
                  return <div key={i} style={{ position: 'absolute', top: '50%', left: '50%', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--store-accent)', animation: `welcome-particles 0.7s ease-out ${i * 0.03}s both`, transform: `translate(${dx}px, ${dy}px)`, zIndex: 10 }} />;
                })}
              </>
            )}

            <div style={{ fontSize: '42px', marginBottom: '12px', animation: 'welcome-float 2s ease-in-out infinite', color: 'var(--store-accent)' }}>
              <FontAwesomeIcon icon={faGlobe} />
            </div>
            <h2 style={{ margin: '0 0 4px', fontSize: '26px', fontWeight: '800', background: `linear-gradient(90deg, var(--store-secondary), var(--store-accent), var(--store-secondary))`, backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', animation: 'welcome-shimmer 3s linear infinite' }}>
              {lang === 'en' ? 'Welcome!' : lang === 'pt' ? 'Bem-vindo!' : 'Bienvenido!'}
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: '14px', opacity: 0.7 }}>
              {lang === 'en' ? 'Select your language' : lang === 'pt' ? 'Selecione seu idioma' : 'Selecciona tu idioma'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {LANGUAGES.map((l, idx) => {
                const isSelected = welcomeSelectedLang === l.code;
                return (
                  <button
                    key={l.code}
                    disabled={!!welcomeSelectedLang}
                    onClick={() => {
                      setWelcomeSelectedLang(l.code);
                      setLang(l.code);
                      localStorage.setItem('srservi_lang', l.code);
                      setTimeout(() => setWelcomeClosing(true), 600);
                      setTimeout(() => { setWelcomeModalOpen(false); setWelcomeClosing(false); setWelcomeSelectedLang(null); }, 1000);
                    }}
                    style={{
                      padding: '16px', borderRadius: '14px', border: 'none', fontSize: '17px', fontWeight: '700', cursor: welcomeSelectedLang ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                      background: isSelected ? 'var(--store-accent)' : 'rgba(255,255,255,0.1)',
                      color: isSelected ? 'var(--store-primary)' : 'var(--store-secondary)',
                      animation: isSelected ? 'welcome-selected-zoom 0.8s cubic-bezier(0.22,1,0.36,1) 0.2s both' : `welcome-btn-in 0.4s ease ${0.2 + idx * 0.1}s both`,
                      transition: 'background 0.2s, transform 0.2s, box-shadow 0.2s',
                      position: 'relative', zIndex: isSelected ? 5 : 1,
                      ...(welcomeSelectedLang && !isSelected ? { opacity: 0, transform: 'scale(0.8)', transition: 'all 0.3s ease' } : {})
                    }}
                  >
                    <FontAwesomeIcon icon={faGlobe} style={{ fontSize: '20px' }} />
                    {l.label}
                    {isSelected && (
                      <FontAwesomeIcon icon={faCheck} style={{ fontSize: '20px', animation: 'welcome-check-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Screensaver overlay */}
      {screensaverActive && screensaverCfg?.enabled && (() => {
        const dismissSS = (e) => {
          if (e) { e.stopPropagation(); e.preventDefault(); }
          setScreensaverActive(false);
          clearTimeout(screensaverTimerRef.current);
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        };
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99990, background: '#000', overflow: 'hidden' }}>

            {/* Full-screen background image */}
            {screensaverCfg.media_url && (
              <img
                src={API + screensaverCfg.media_url}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
              />
            )}

            {/* Dark overlay gradient */}
            <div style={{ position: 'absolute', inset: 0, background: screensaverCfg.media_url ? 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%)' : 'linear-gradient(160deg, #0a0a0a 0%, #111 100%)' }} />

            {/* ══════════ Layout principal centrado ══════════ */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '40px 48px 160px' }}>

              {/* Logo circular flotante */}
              <div style={{ width: 110, height: 110, borderRadius: '50%', overflow: 'hidden', border: '3px solid #D4AF37', flexShrink: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'ss-float 4s ease-in-out infinite', boxShadow: '0 0 0 6px rgba(212,175,55,0.12)', marginBottom: 24 }}>
                {screensaverCfg.store_logo
                  ? <img src={API + screensaverCfg.store_logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <FontAwesomeIcon icon={faShoppingCart} style={{ fontSize: 40, color: '#D4AF37' }} />
                }
              </div>

              {/* Nombre tienda */}
              {screensaverCfg.store_name && (
                <div style={{ fontSize: 'clamp(28px,5.5vw,62px)', fontWeight: '900', color: '#fff', textAlign: 'center', lineHeight: 1.1, letterSpacing: '-0.5px', marginBottom: 18 }}>
                  {screensaverCfg.store_name}
                </div>
              )}

              {/* Línea dorada */}
              <div style={{ width: 64, height: 2, background: 'linear-gradient(90deg,transparent,#D4AF37,transparent)', borderRadius: 2, marginBottom: 28 }} />

              {/* Carrito FA + créditos */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <FontAwesomeIcon icon={faShoppingCart} style={{ fontSize: 'clamp(28px,4vw,40px)', color: '#D4AF37', animation: 'ss-cart 2s ease-in-out infinite', marginBottom: 4 }} />
                <span style={{ fontSize: 'clamp(17px,2.8vw,26px)', fontWeight: '800', color: '#D4AF37', letterSpacing: '1px' }}>
                  Auto Servicio
                </span>
                <span style={{ fontSize: 'clamp(10px,1.3vw,13px)', color: 'rgba(255,255,255,0.35)', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 500 }}>
                  Desarrollado por SRAutomatic CL
                </span>
              </div>
            </div>

            {/* ══════════ Footer CTA centrado ══════════ */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}>
              <button
                onClick={dismissSS}
                onTouchStart={dismissSS}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  background: 'rgba(10,10,10,0.85)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1.5px solid rgba(212,175,55,0.6)',
                  borderRadius: 50,
                  padding: '0 26px 0 10px',
                  height: 70,
                  cursor: 'pointer',
                  boxShadow: '0 0 0 4px rgba(212,175,55,0.08), 0 8px 32px rgba(0,0,0,0.5)',
                  animation: 'ss-glow 2.5s ease-in-out infinite',
                }}
              >
                {/* Logo mini circular */}
                <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', border: '2px solid #D4AF37', flexShrink: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {screensaverCfg.store_logo
                    ? <img src={API + screensaverCfg.store_logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <FontAwesomeIcon icon={faShoppingCart} style={{ fontSize: 15, color: '#D4AF37' }} />
                  }
                </div>

                {/* Texto subrayado dorado */}
                <span style={{ fontSize: 'clamp(18px,3vw,28px)', fontWeight: '800', color: '#fff', letterSpacing: '0.4px', borderBottom: '2.5px solid #D4AF37', paddingBottom: 3, whiteSpace: 'nowrap' }}>
                  Toca aquí para continuar
                </span>

                {/* Chevron animado */}
                <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 13, color: '#D4AF37', animation: 'ss-arrow 0.9s ease-in-out infinite', flexShrink: 0 }} />
              </button>
            </div>

            <style>{`
              @keyframes ss-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
              @keyframes ss-cart  { 0%,100%{transform:translateX(0) scale(1)} 45%{transform:translateX(8px) scale(1.04)} }
              @keyframes ss-arrow { 0%,100%{transform:translateX(0)} 50%{transform:translateX(5px)} }
              @keyframes ss-glow  { 0%,100%{box-shadow:0 0 0 4px rgba(212,175,55,0.08),0 8px 32px rgba(0,0,0,0.5)} 50%{box-shadow:0 0 0 6px rgba(212,175,55,0.18),0 8px 40px rgba(212,175,55,0.2)} }
            `}</style>
          </div>
        );
      })()}

      {/* Inactivity modal - auto restart */}
      {inactivityModalOpen && (
        <div
          className="store-modal-overlay"
          style={{ zIndex: 99998 }}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onPointerUp={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); }}
        >
          <div
            style={{ background: '#fff', borderRadius: '20px', padding: '32px 24px', maxWidth: '360px', width: '90%', textAlign: 'center' }}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
            onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
            onPointerUp={(e) => { e.stopPropagation(); e.preventDefault(); }}
            onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); }}
            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); }}
          >
            <h2 style={{ margin: '0 0 8px', fontSize: '22px', color: '#333' }}>
              {lang === 'en' ? 'Are you still there?' : lang === 'pt' ? 'Voce ainda esta ai?' : 'Sigues ahi?'}
            </h2>
            <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#888' }}>
              {lang === 'en' ? 'The screen will restart in' : lang === 'pt' ? 'A tela sera reiniciada em' : 'La pantalla se reiniciara en'}
            </p>
            <div style={{ fontSize: '48px', fontWeight: '800', color: inactivityCountdown <= 3 ? '#e74c3c' : 'var(--store-primary)', margin: '8px 0 16px' }}>
              {inactivityCountdown}
            </div>
            <button
              className="store-glow-pulse-green"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
              onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
              onPointerUp={(e) => {
                e.stopPropagation(); e.preventDefault();
                setInactivityModalOpen(false);
                setInactivityCountdown(10);
                if (inactivityCountdownRef.current) clearInterval(inactivityCountdownRef.current);
              }}
              onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); }}
              onTouchEnd={(e) => {
                e.stopPropagation(); e.preventDefault();
                setInactivityModalOpen(false);
                setInactivityCountdown(10);
                if (inactivityCountdownRef.current) clearInterval(inactivityCountdownRef.current);
              }}
              style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: '#2ecc71', color: '#fff', fontSize: '18px', fontWeight: '700', cursor: 'pointer' }}
            >
              {lang === 'en' ? 'Yes, I\'m here!' : lang === 'pt' ? 'Sim, estou aqui!' : 'Si, estoy aqui!'}
            </button>
          </div>
        </div>
      )}
    </div>

      {comboModal && (
        <div className="store-modal-overlay" onClick={() => setComboModal(null)}>
          <div className="store-prod-modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column', maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--store-primary)', fontSize: '1.1rem' }}>
                  <FontAwesomeIcon icon={faLayerGroup} style={{ marginRight: '8px', color: 'var(--store-accent)' }} />
                  {comboModal.combo.name}
                </h3>
                {comboModal.combo.description && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#888' }}>{comboModal.combo.description}</p>
                )}
              </div>
              <button onClick={() => setComboModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#888', padding: 0, marginLeft: '8px' }}>&times;</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {comboModal.itemConfigs.map(ic => (
                <div key={ic.product_id} style={{ background: '#f9f9f9', borderRadius: '12px', padding: '12px', border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {ic.product_image
                        ? <img src={getProductImageUrl(ic.product_image)} alt={ic.product_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <FontAwesomeIcon icon={faBox} style={{ color: '#bbb' }} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#222' }}>{ic.quantity}× {ic.product_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#888' }}>{colors?.currency?.symbol || '$'}{formatPrice(ic.product_price)}</div>
                    </div>
                  </div>

                  {ic.ingredients.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#444', marginBottom: '6px' }}>Ingredientes</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {ic.ingredients.map(ing => {
                          const sel = ic.selected_ingredients.includes(ing.name);
                          return (
                            <button key={ing.id} type="button"
                              onClick={() => updateComboItemConfig(ic.product_id, 'selected_ingredients',
                                sel ? ic.selected_ingredients.filter(x => x !== ing.name) : [...ic.selected_ingredients, ing.name])}
                              style={{
                                padding: '4px 10px', fontSize: '0.75rem', borderRadius: '20px', cursor: 'pointer',
                                border: `1px solid ${sel ? '#e53e3e' : '#e5e7eb'}`,
                                background: sel ? '#fee2e2' : '#fff',
                                color: sel ? '#e53e3e' : '#444',
                                textDecoration: sel ? 'line-through' : 'none'
                              }}>
                              {ing.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {ic.extras.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#444', marginBottom: '6px' }}>Extras</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {ic.extras.map(ex => {
                          const sel = ic.selected_extras.some(x => (x?.id || x) === ex.id);
                          return (
                            <button key={ex.id} type="button"
                              onClick={() => updateComboItemConfig(ic.product_id, 'selected_extras',
                                sel ? ic.selected_extras.filter(x => (x?.id || x) !== ex.id) : [...ic.selected_extras, { id: ex.id, name: ex.name, price: ex.price }])}
                              style={{
                                padding: '4px 10px', fontSize: '0.75rem', borderRadius: '20px', cursor: 'pointer',
                                border: `1px solid ${sel ? 'var(--store-primary)' : '#e5e7eb'}`,
                                background: sel ? 'var(--store-primary)' : '#fff',
                                color: sel ? 'var(--store-secondary)' : '#444'
                              }}>
                              + {ex.name}{Number(ex.price) > 0 ? ` (+${colors?.currency?.symbol || '$'}${formatPrice(ex.price)})` : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {ic.complement_groups.length > 0 && ic.complement_groups.map(group => (
                    <div key={group.id} style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#444', marginBottom: '6px' }}>
                        {group.name}{group.required ? ' *' : ''}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {(group.options || []).filter(o => o.is_active !== false).map(opt => {
                          const sel = ic.selected_complements.some(x => (x?.id || x) === opt.id);
                          return (
                            <button key={opt.id} type="button"
                              onClick={() => {
                                const maxSel = group.max_select || 0;
                                const curSel = ic.selected_complements.filter(x => x?.group_id === group.id);
                                if (sel) {
                                  updateComboItemConfig(ic.product_id, 'selected_complements',
                                    ic.selected_complements.filter(x => (x?.id || x) !== opt.id));
                                } else if (maxSel === 0 || curSel.length < maxSel) {
                                  updateComboItemConfig(ic.product_id, 'selected_complements',
                                    [...ic.selected_complements, { id: opt.id, name: opt.name, price: opt.price, group_id: group.id }]);
                                }
                              }}
                              style={{
                                padding: '4px 10px', fontSize: '0.75rem', borderRadius: '20px', cursor: 'pointer',
                                border: `1px solid ${sel ? 'var(--store-accent)' : '#e5e7eb'}`,
                                background: sel ? 'rgba(212,175,55,0.15)' : '#fff',
                                color: sel ? 'var(--store-primary)' : '#444',
                                fontWeight: sel ? 700 : 400
                              }}>
                              {opt.name}{Number(opt.price) > 0 ? ` (+${colors?.currency?.symbol || '$'}${formatPrice(opt.price)})` : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '14px', marginTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button onClick={() => setComboQty(q => Math.max(1, q - 1))}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid var(--store-primary)', background: '#fff', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--store-primary)', fontWeight: 700 }}>−</button>
                  <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--store-primary)' }}>{comboQty}</span>
                  <button onClick={() => setComboQty(q => q + 1)}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: 'var(--store-primary)', color: 'var(--store-secondary)', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 700 }}>+</button>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>Total</div>
                  <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--store-accent)' }}>
                    {colors?.currency?.symbol || '$'}{formatPrice(comboModal.combo.price * comboQty)}
                  </div>
                </div>
              </div>
              <button onClick={addComboToCart}
                style={{ width: '100%', padding: '14px', border: 'none', borderRadius: '12px', background: 'var(--store-primary)', color: 'var(--store-secondary)', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
                <FontAwesomeIcon icon={faShoppingCart} style={{ marginRight: '8px' }} />
                Agregar combo al pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {showExcelModal && (
        <div className="modal-overlay" onClick={() => setShowExcelModal(false)}>
          <div className="modal" style={{ maxWidth: '680px', width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <FontAwesomeIcon icon={faFileExcel} style={{ marginRight: '8px', color: '#16a34a' }} />
                Importar Productos desde Excel
              </h2>
              <button className="modal-close" onClick={() => setShowExcelModal(false)}>&times;</button>
            </div>

            {excelError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px' }}>
                {excelError}
              </div>
            )}

            {excelStep === 'upload' && (
              <div>
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '600', color: '#15803d' }}>Formato del archivo Excel:</p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#16a34a', color: '#fff' }}>
                          {['Nombre *', 'Descripcion', 'Precio *', 'Categoria', 'Codigo_Barras', 'Imagen_URL'].map(h => (
                            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: '700' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ background: '#f0fdf4' }}>
                          <td style={{ padding: '5px 10px', color: '#374151' }}>Pizza napolitana</td>
                          <td style={{ padding: '5px 10px', color: '#6b7280' }}>Grande con mozzarella</td>
                          <td style={{ padding: '5px 10px', color: '#374151' }}>10.99</td>
                          <td style={{ padding: '5px 10px', color: '#6b7280' }}>Comidas</td>
                          <td style={{ padding: '5px 10px', color: '#6b7280' }}></td>
                          <td style={{ padding: '5px 10px', color: '#6b7280' }}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#15803d' }}>* Columnas requeridas. La categoría debe coincidir con una existente en tu tienda.</p>
                </div>

                <button
                  onClick={downloadTemplate}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#fff', border: '1.5px solid #16a34a', color: '#16a34a', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', marginBottom: '20px' }}
                >
                  <FontAwesomeIcon icon={faDownload} />
                  Descargar plantilla Excel
                </button>

                <div
                  style={{ border: '2px dashed #d1d5db', borderRadius: '12px', padding: '32px', textAlign: 'center', cursor: 'pointer', background: excelLoading ? '#f9fafb' : '#fff' }}
                  onClick={() => !excelLoading && excelFileRef.current?.click()}
                >
                  {excelLoading ? (
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Leyendo archivo...</p>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faUpload} style={{ fontSize: '28px', color: '#9ca3af', marginBottom: '10px', display: 'block' }} />
                      <p style={{ margin: '0 0 4px', fontWeight: '600', color: '#374151' }}>Haz clic para seleccionar tu archivo</p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>.xlsx, .xls o .csv</p>
                    </>
                  )}
                  <input ref={excelFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleExcelFileChange} />
                </div>
              </div>
            )}

            {excelStep === 'preview' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <p style={{ margin: 0, fontWeight: '600', color: '#374151' }}>
                    {excelRows.length} producto{excelRows.length !== 1 ? 's' : ''} encontrado{excelRows.length !== 1 ? 's' : ''}
                  </p>
                  <button onClick={() => { setExcelStep('upload'); setExcelRows([]); }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>
                    Cambiar archivo
                  </button>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '16px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
                      <tr>
                        {['Nombre', 'Precio', 'Categoria', 'Descripcion', 'Codigo Barras', 'Imagen URL'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '700', color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {excelRows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                          <td style={{ padding: '6px 10px', fontWeight: '600', color: '#111' }}>{row.name}</td>
                          <td style={{ padding: '6px 10px', color: '#16a34a', fontWeight: '700' }}>${Number(row.price).toFixed(2)}</td>
                          <td style={{ padding: '6px 10px', color: '#6b7280' }}>{row.category || '—'}</td>
                          <td style={{ padding: '6px 10px', color: '#6b7280', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description || '—'}</td>
                          <td style={{ padding: '6px 10px', color: '#6b7280' }}>{row.barcode || '—'}</td>
                          <td style={{ padding: '6px 10px', color: '#6b7280', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.image_url || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={handleExcelImport}
                  disabled={excelLoading}
                  style={{ width: '100%', padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: excelLoading ? 'default' : 'pointer', opacity: excelLoading ? 0.6 : 1 }}
                >
                  {excelLoading ? 'Importando...' : `Importar ${excelRows.length} producto${excelRows.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}

            {excelStep === 'results' && excelResults && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '12px', padding: '20px 28px' }}>
                    <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '28px', color: '#16a34a', marginBottom: '6px', display: 'block' }} />
                    <div style={{ fontSize: '32px', fontWeight: '800', color: '#15803d' }}>{excelResults.created}</div>
                    <div style={{ fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>Importados</div>
                  </div>
                  {excelResults.skipped > 0 && (
                    <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: '12px', padding: '20px 28px' }}>
                      <FontAwesomeIcon icon={faTimesCircle} style={{ fontSize: '28px', color: '#ca8a04', marginBottom: '6px', display: 'block' }} />
                      <div style={{ fontSize: '32px', fontWeight: '800', color: '#a16207' }}>{excelResults.skipped}</div>
                      <div style={{ fontSize: '13px', color: '#ca8a04', fontWeight: '600' }}>Omitidos</div>
                    </div>
                  )}
                </div>
                {excelResults.errors?.length > 0 && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px', marginBottom: '16px', textAlign: 'left' }}>
                    <p style={{ margin: '0 0 8px', fontWeight: '700', color: '#b91c1c', fontSize: '13px' }}>Errores:</p>
                    {excelResults.errors.map((e, i) => (
                      <p key={i} style={{ margin: '0 0 4px', fontSize: '12px', color: '#b91c1c' }}>
                        <strong>{e.name}</strong>: {e.error}
                      </p>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowExcelModal(false)}
                  style={{ padding: '11px 32px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
                >
                  Listo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showStoreDuplicatesModal && (
        <div className="store-modal-overlay" onClick={() => setShowStoreDuplicatesModal(false)}>
          <div className="store-prod-modal" style={{ maxWidth: 460, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--store-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>⚠️</span> Duplicados detectados
              </h3>
              <button onClick={() => setShowStoreDuplicatesModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>&times;</button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <p style={{ marginBottom: 12, color: '#374151', fontSize: 14 }}>
                Detectamos <strong>{storeDuplicateInfo.reduce((s, d) => s + d.count - 1, 0)}</strong> elemento(s) duplicado(s) en tu tienda. ¿Deseas eliminar los duplicados?
              </p>
              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 14 }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600 }}>Nombre</th>
                      <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600 }}>Tipo</th>
                      <th style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 600 }}>Copias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeDuplicateInfo.map((d, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '5px 12px' }}>{d.name}</td>
                        <td style={{ padding: '5px 12px', color: '#6b7280' }}>{d.type === 'extra' ? 'Extra' : 'Ingrediente'}</td>
                        <td style={{ padding: '5px 12px', textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>{d.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
                Se conservará una copia de cada nombre y se eliminarán las demás.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowStoreDuplicatesModal(false)}
                  disabled={storeDeduplicating}
                  style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                >
                  Ignorar
                </button>
                <button
                  onClick={handleStoreDeduplication}
                  disabled={storeDeduplicating}
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                >
                  {storeDeduplicating ? 'Eliminando...' : 'Eliminar duplicados'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </PluginProvider>
  );
}

export default Store;
