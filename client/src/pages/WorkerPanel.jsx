import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBox, faClock, faCheck, faTimes, faSearch, faSignOutAlt, faUserCog,
  faMoneyBillWave, faPlus, faExternalLinkAlt, faUtensils, faShoppingBag,
  faMotorcycle, faConciergeBell, faFilePdf, faSync, faBell, faListAlt,
  faBuilding, faFire, faCheckCircle, faBoxOpen
} from '@fortawesome/free-solid-svg-icons';
import { SOCKET_URL } from '../config.js';
import WorkerNewOrder from '../components/WorkerNewOrder';

function WorkerPanel() {
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [pendingCashOrders, setPendingCashOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [storeColors, setStoreColors] = useState(null);
  const [showWorkerSwitch, setShowWorkerSwitch] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [storeCode, setStoreCode] = useState(() => {
    try { return JSON.parse(localStorage.getItem('worker') || '{}').store_code || ''; } catch { return ''; }
  });
  const [showPayModal, setShowPayModal] = useState(false);
  const [paySearch, setPaySearch] = useState('');
  const [payResult, setPayResult] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const colors = storeColors || { primary: '#0a0a0a', secondary: '#ffffff', accent: '#D4AF37' };

  useEffect(() => {
    const workerData = localStorage.getItem('worker');
    if (!workerData) { navigate('/worker-login'); return; }
    const parsedWorker = JSON.parse(workerData);
    setWorker(parsedWorker);
    fetchStoreColors(parsedWorker.store_id);
    fetchOrders(parsedWorker.store_id);
    fetchWorkers(parsedWorker.store_id);

    const socket = io(SOCKET_URL, { reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 10000 });
    socket.on('connect', () => {
      socket.emit('register_store', parsedWorker.store_id);
      fetchOrders(parsedWorker.store_id);
    });
    socket.on('new_order', (order) => {
      if (order.payment_method === 'cash' && !order.cash_approved) {
        setPendingCashOrders(prev => [order, ...prev]);
      } else if (order.payment_process === 1) {
        setOrders(prev => [order, ...prev]);
      }
    });
    socket.on('cash_approved', (order) => {
      setPendingCashOrders(prev => prev.filter(o => o.id !== order.id));
      if (order.payment_process === 1) setOrders(prev => [order, ...prev]);
    });
    socket.on('payment_confirmed', (order) => {
      if (order.payment_process === 1) setOrders(prev => prev.find(o => o.id === order.id) ? prev : [order, ...prev]);
    });
    socket.on('order_updated', () => fetchOrders(parsedWorker.store_id));
    socket.on('order_deleted', () => fetchOrders(parsedWorker.store_id));

    const pollInterval = setInterval(() => fetchOrders(parsedWorker.store_id), 30000);
    const handleFocus = () => fetchOrders(parsedWorker.store_id);
    window.addEventListener('focus', handleFocus);
    return () => { socket.disconnect(); clearInterval(pollInterval); window.removeEventListener('focus', handleFocus); };
  }, [navigate]);

  const fetchStoreColors = async (storeId) => {
    try {
      const token = localStorage.getItem('workerToken');
      const response = await fetch(`/api/stores/${storeId}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error('Store not found');
      const data = await response.json();
      setStoreColors({ primary: data.primary_color || '#0a0a0a', secondary: data.secondary_color || '#ffffff', accent: data.accent_color || '#D4AF37' });
      if (data.code) setStoreCode(data.code);
    } catch {}
  };

  const fetchOrders = async (storeId, showRef = false) => {
    if (showRef) setRefreshing(true);
    try {
      const token = localStorage.getItem('workerToken');
      const response = await fetch(`/api/orders/store/${storeId}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.status === 403) { navigate('/worker-login'); return; }
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayOrders = data.filter(o => new Date(o.created_at) >= today);
      setOrders(todayOrders.filter(o => o.status !== 'completed' && o.payment_process === 1));
      setCompletedOrders(todayOrders.filter(o => o.status === 'completed'));
      setPendingCashOrders(todayOrders.filter(o => o.payment_method === 'cash' && !o.cash_approved && o.payment_process === 0));
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  const fetchWorkers = async (storeId) => {
    try {
      const token = localStorage.getItem('workerToken');
      const response = await fetch(`/api/workers?store_id=${storeId}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) setWorkers(await response.json());
    } catch {}
  };

  const switchWorker = (newWorker) => {
    const workerData = { ...newWorker, store_name: worker.store_name };
    localStorage.setItem('worker', JSON.stringify(workerData));
    setWorker(workerData);
    setShowWorkerSwitch(false);
    fetchOrders(newWorker.store_id);
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      const token = localStorage.getItem('workerToken');
      const body = { status };
      if (status === 'completed') { body.worker_id = worker.id; body.worker_name = worker.name; }
      const response = await fetch(`/api/orders/${orderId}/status?store_id=${worker.store_id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body)
      });
      if (response.ok) {
        const updatedOrder = await response.json();
        if (status === 'completed') {
          const orig = orders.find(o => o.id === orderId);
          setOrders(prev => prev.filter(o => o.id !== orderId));
          setCompletedOrders(prev => [{ ...orig, ...updatedOrder, status: 'completed' }, ...prev]);
        } else {
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
        }
      }
      setSelectedOrder(null);
    } catch {}
  };

  const handleLogout = () => {
    localStorage.removeItem('workerToken');
    localStorage.removeItem('worker');
    navigate('/worker-login');
  };

  const approveCashPayment = async (orderId) => {
    try {
      const token = localStorage.getItem('workerToken');
      const response = await fetch(`/api/orders/${orderId}/approve-cash?store_id=${worker.store_id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ worker_id: worker.id, worker_name: worker.name })
      });
      if (response.ok) {
        const updatedOrder = await response.json();
        setPendingCashOrders(prev => prev.filter(o => o.id !== orderId));
        setOrders(prev => [{ ...updatedOrder, ...pendingCashOrders.find(o => o.id === orderId) }, ...prev]);
      }
    } catch {}
  };

  const getOrderDisplayNumber = (order) => {
    if (order.order_number) return order.order_number;
    const id = order.id || 0;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return `${letters[id % 26]}${((id % 99) + 1).toString().padStart(2, '0')}`;
  };

  const getOrderTypeInfo = (type) => {
    const map = {
      serve:      { label: 'Mesa',      icon: faUtensils,      cls: 'serve',      color: '#22c55e' },
      takeout:    { label: 'Para llevar', icon: faShoppingBag, cls: 'takeout',    color: '#3b82f6' },
      delivery:   { label: 'Delivery',  icon: faMotorcycle,    cls: 'delivery',   color: '#a855f7' },
      pedidosya:  { label: 'PedidosYa', icon: faMotorcycle,    cls: 'pedidosya',  color: '#ef4444' },
      rappi:      { label: 'Rappi',     icon: faMotorcycle,    cls: 'rappi',      color: '#f97316' },
      mostrador:  { label: 'Mostrador', icon: faBuilding,      cls: 'mostrador',  color: '#D4AF37' },
      room_service:{ label: 'Room Svc', icon: faConciergeBell, cls: 'serve',      color: '#8b5cf6' },
    };
    return map[type] || { label: type || 'Mesa', icon: faUtensils, cls: 'serve', color: '#888' };
  };

  const STATUS_MAP = {
    pending:     { label: 'Pendiente',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  icon: faClock },
    preparing:   { label: 'Preparando', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  icon: faFire },
    ready:       { label: 'Listo',      color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   icon: faCheckCircle },
    completed:   { label: 'Completado', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: faCheck },
    cancelled:   { label: 'Cancelado',  color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   icon: faTimes },
    cash_pending:{ label: 'Ef. pendiente', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: faClock },
  };

  const getNextAction = (status) => {
    if (status === 'pending') return { status: 'preparing', label: '▶ Preparar', color: '#3b82f6' };
    if (status === 'preparing') return { status: 'ready', label: '✓ Listo', color: '#22c55e' };
    if (status === 'ready') return { status: 'completed', label: '✓ Entregar', color: '#D4AF37' };
    return null;
  };

  // PDF (reemplaza Excel)
  const downloadTodayPDF = () => {
    const all = [...(orders||[]), ...(completedOrders||[]), ...(pendingCashOrders||[])];
    if (!all.length) { alert('No hay pedidos hoy para exportar.'); return; }
    const seen = new Set();
    const todayOrders = all.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true; })
      .sort((a,b) => new Date(a.created_at)-new Date(b.created_at));
    const sl = s => ({pending:'Pendiente',preparing:'En preparación',ready:'Listo',completed:'Completado'})[s]||s||'';
    const tl = t => ({serve:'Aquí',takeout:'Para llevar',delivery:'Delivery',pedidosya:'PedidosYa',rappi:'Rappi',mostrador:'Mostrador'})[t]||'Aquí';
    const fmt = d => d ? new Date(d).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : '—';
    const fmtPrep = (c,x) => { if(!c||!x) return '—'; const m=Math.round((new Date(x)-new Date(c))/60000); return m<1?'<1 min':m+' min'; };
    const done = todayOrders.filter(o=>o.status==='completed');
    const total = todayOrders.reduce((s,o)=>s+Number(o.total||0),0);
    const pts = done.filter(o=>o.created_at&&o.completed_at).map(o=>(new Date(o.completed_at)-new Date(o.created_at))/60000);
    const avg = pts.length ? Math.round(pts.reduce((a,b)=>a+b,0)/pts.length) : null;
    const byW = {};
    done.forEach(o => { const w=o.completed_by_name||'Sin asignar'; if(!byW[w])byW[w]={count:0,total:0}; byW[w].count++; byW[w].total+=Number(o.total||0); });
    const wRows = Object.entries(byW).map(([n,d])=>`<tr><td>${n}</td><td style="text-align:center">${d.count}</td><td style="text-align:right;font-weight:700">$${d.total.toFixed(2)}</td></tr>`).join('');
    const oRows = todayOrders.map(o => {
      const items = (o.items||[]).map(i => {
        const ings = Array.isArray(i.selected_ingredients)?i.selected_ingredients.map(x=>x.name||x).join(', '):'';
        const exts = Array.isArray(i.selected_extras)?i.selected_extras.map(x=>x.name||x).join(', '):'';
        return `<div style="margin-bottom:3px"><strong>${i.quantity}x</strong> ${i.product_name||i.name||'Producto'}${ings?`<br><span style="color:#666;font-size:11px">${ings}</span>`:''}${exts?`<br><span style="color:#888;font-size:11px">+ ${exts}</span>`:''}</div>`;
      }).join('');
      const bg = o.status==='completed'?'#f0fff4':o.status==='preparing'?'#fffbeb':'#fff';
      return `<tr style="background:${bg}"><td style="font-weight:800;font-size:15px">${getOrderDisplayNumber(o)}</td><td>${tl(o.order_type)}${o.table_number!=null?`<br><small>Mesa ${o.table_number}</small>`:''}</td><td>${fmt(o.created_at)}</td><td>${o.completed_at?fmt(o.completed_at):'—'}</td><td style="font-weight:700">${fmtPrep(o.created_at,o.completed_at)}</td><td>${sl(o.status)}</td><td style="font-weight:600">${o.completed_by_name||'—'}</td><td style="font-size:12px">${items||'—'}</td><td style="font-weight:800;text-align:right">$${Number(o.total||0).toFixed(2)}</td></tr>`;
    }).join('');
    const ds = new Date().toLocaleDateString('es-ES',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    const sn = worker?.store_name||'Tienda';
    const wn = worker?.name||worker?.username||'Trabajador';
    const css = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:20px}.top{display:flex;justify-content:space-between;margin-bottom:18px;padding-bottom:14px;border-bottom:3px solid #D4AF37}.top h1{font-size:22px;font-weight:800}.top p{color:#555;font-size:12px;margin-top:3px}.top-right{text-align:right;font-size:12px;color:#555}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}.stat{background:#f5f5f5;border-radius:8px;padding:10px 14px;border-left:4px solid #D4AF37}.stat-label{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.5px}.stat-value{font-size:20px;font-weight:800;margin-top:2px}h2{font-size:13px;font-weight:800;text-transform:uppercase;margin:20px 0 8px;padding-bottom:5px;border-bottom:2px solid #D4AF37}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px}th{background:#111;color:#fff;padding:8px;text-align:left;font-size:11px}td{padding:7px 8px;border-bottom:1px solid #e5e5e5;vertical-align:top}.footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#888;text-align:center}@media print{body{padding:8px}@page{margin:12mm;size:A4 landscape}}`;
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Informe ${sn}</title><style>${css}</style></head><body><div class="top"><div><h1>${sn}</h1><p>Informe de pedidos del día</p><p>${ds}</p></div><div class="top-right"><p>Generado por: <strong>${wn}</strong></p><p>Hora: ${new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</p></div></div><div class="stats"><div class="stat"><div class="stat-label">Total pedidos</div><div class="stat-value">${todayOrders.length}</div></div><div class="stat"><div class="stat-label">Completados</div><div class="stat-value">${done.length}</div></div><div class="stat"><div class="stat-label">Ingresos totales</div><div class="stat-value">$${total.toFixed(2)}</div></div><div class="stat"><div class="stat-label">Tiempo prom. prep.</div><div class="stat-value">${avg!=null?avg+' min':'—'}</div></div></div>${wRows?`<h2>Rendimiento por Trabajador</h2><table><thead><tr><th>Trabajador</th><th>Pedidos</th><th>Total gestionado</th></tr></thead><tbody>${wRows}</tbody></table>`:''}<h2>Detalle de Pedidos</h2><table><thead><tr><th>#</th><th>Tipo</th><th>Entrada</th><th>Salida</th><th>Tiempo prep.</th><th>Estado</th><th>Atendido por</th><th>Productos</th><th>Total</th></tr></thead><tbody>${oRows}</tbody></table><div class="footer">SRServi — ${sn} — ${new Date().toLocaleString('es-ES')}</div></body></html>`;
    const win = window.open('','_blank','width=1050,height=750');
    if (!win) { alert('Permite ventanas emergentes para generar el PDF.'); return; }
    win.document.write(html); win.document.close();
    setTimeout(() => win.print(), 600);
  };

  const closePayModal = () => { setShowPayModal(false); setPaySearch(''); setPayResult(null); };

  const handlePaySearch = async (term) => {
    setPaySearch(term);
    if (!term.trim()) { setPayResult(null); return; }
    const t = term.trim().toUpperCase();
    const inPending = pendingCashOrders.find(o => (o.order_number||'').toUpperCase()===t || getOrderDisplayNumber(o).toUpperCase()===t);
    if (inPending) { setPayResult({...inPending,_isPendingCash:true}); return; }
    const inActive = orders.find(o => (o.order_number||'').toUpperCase()===t || getOrderDisplayNumber(o).toUpperCase()===t);
    if (inActive) { setPayResult({...inActive,_isPendingCash:false}); return; }
    try {
      const token = localStorage.getItem('workerToken');
      const resp = await fetch(`/api/orders/store/${worker.store_id}/find?q=${encodeURIComponent(term.trim())}`,{headers:{'Authorization':`Bearer ${token}`}});
      if (resp.ok) { const found = await resp.json(); if (found) { setPayResult({...found,_isPendingCash:found.payment_method==='cash'&&!found.cash_approved}); return; } }
    } catch {}
    setPayResult(undefined);
  };

  const handleApprovePay = async () => {
    if (!payResult?._isPendingCash) return;
    await approveCashPayment(payResult.id);
    closePayModal();
  };

  const filteredOrders = (orders||[]).filter(o => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (searchTerm) { const q = searchTerm.toLowerCase(); return (o.order_number||'').toLowerCase().includes(q)||(o.order_type||'').toLowerCase().includes(q); }
    return true;
  });
  const filteredCompleted = (completedOrders||[]).filter(o => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (o.order_number||'').toLowerCase().includes(q)||(o.order_type||'').toLowerCase().includes(q);
  });

  const stats = {
    pending: (orders||[]).filter(o=>o.status==='pending').length,
    preparing: (orders||[]).filter(o=>o.status==='preparing').length,
    ready: (orders||[]).filter(o=>o.status==='ready').length,
    total: (orders||[]).length,
  };

  // ─── styles ───
  const s = {
    container: { minHeight:'100vh', background:'#0a0a0f', color:'#e4e4e7', fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif', display:'flex', flexDirection:'column' },
    header: { background:'linear-gradient(135deg,#0a0a0a,#111)', borderBottom:'1px solid rgba(212,175,55,0.2)', padding:'12px 16px', position:'sticky', top:0, zIndex:50 },
    headerRow1: { display:'flex', alignItems:'center', gap:10, marginBottom:10 },
    logo: { width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#D4AF37,#b8962e)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:900, color:'#0a0a0a', flexShrink:0 },
    headerTitle: { flex:1, minWidth:0 },
    titleText: { fontSize:15, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
    subtitleText: { fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:1 },
    iconBtn: (bg,color,border) => ({ background:bg, border:`1px solid ${border}`, borderRadius:8, color, width:36, height:36, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }),
    statsBar: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:'rgba(255,255,255,0.04)' },
    statCell: (col) => ({ padding:'10px 4px', textAlign:'center', background:'#0a0a0a' }),
    statNum: (col) => ({ fontSize:18, fontWeight:800, color:col, lineHeight:1 }),
    statLbl: { fontSize:9, color:'rgba(255,255,255,0.4)', marginTop:2, textTransform:'uppercase', letterSpacing:'0.5px' },
    actionsRow: { display:'flex', gap:6, marginTop:10 },
    actionBtn: (main) => ({ flex:1, padding:'9px 6px', borderRadius:10, border:`1px solid ${main?'rgba(212,175,55,0.3)':'rgba(255,255,255,0.1)'}`, background:main?'rgba(212,175,55,0.12)':'rgba(255,255,255,0.05)', color:main?'#D4AF37':'rgba(255,255,255,0.6)', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }),
    tabs: { display:'flex', background:'#0d0d0d', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 16px' },
    tab: (active) => ({ flex:1, padding:'11px 0', border:'none', background:'transparent', color:active?'#D4AF37':'rgba(255,255,255,0.4)', fontWeight:700, fontSize:13, cursor:'pointer', borderBottom:`2px solid ${active?'#D4AF37':'transparent'}`, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }),
    filterBar: { padding:'8px 16px', background:'#0a0a0a', display:'flex', gap:8, borderBottom:'1px solid rgba(255,255,255,0.05)', overflowX:'auto' },
    chip: (active) => ({ padding:'6px 12px', borderRadius:20, border:`1px solid ${active?'#D4AF37':'rgba(255,255,255,0.1)'}`, background:active?'#D4AF37':'rgba(255,255,255,0.05)', color:active?'#000':'rgba(255,255,255,0.6)', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }),
    ordersList: { flex:1, overflowY:'auto', padding:'12px 16px 90px' },
    card: (completed) => ({ background:completed?'#0f0f14':'#fff', borderRadius:14, overflow:'hidden', border:`1px solid ${completed?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'}`, cursor:'pointer', boxShadow:completed?'none':'0 2px 12px rgba(0,0,0,0.12)', marginBottom:10 }),
    fab: { position:'fixed', bottom:24, right:20, width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,#D4AF37,#b8962e)', border:'none', color:'#000', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 6px 24px rgba(212,175,55,0.5)', zIndex:40 },
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' },
    sheet: { background:'#111', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:560, maxHeight:'88vh', overflowY:'auto', border:'1px solid rgba(212,175,55,0.15)', borderBottom:'none' },
    modalOverlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
    modal: { background:'#111', border:'1px solid rgba(212,175,55,0.15)', borderRadius:20, padding:24, width:'100%', maxWidth:480, maxHeight:'82vh', overflow:'auto' },
  };

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#0a0a0f',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:40,height:40,border:'3px solid rgba(212,175,55,0.2)',borderTopColor:'#D4AF37',borderRadius:'50%',animation:'wSpin 0.8s linear infinite'}}/>
      <style>{`@keyframes wSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const renderOrderCard = (order, isCompleted=false) => {
    const sc = STATUS_MAP[order.status] || STATUS_MAP.pending;
    const tc = getOrderTypeInfo(order.order_type);
    const nextAction = !isCompleted ? getNextAction(order.status) : null;
    return (
      <div key={order.id} style={s.card(isCompleted)} onClick={() => setSelectedOrder(order)}>
        <div style={{height:3, background:sc.color, opacity:isCompleted?0.4:1}}/>
        <div style={{padding:'12px 14px'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
            <span style={{fontSize:17,fontWeight:800,color:isCompleted?'#fff':'#0a0a0a'}}>#{getOrderDisplayNumber(order)}</span>
            {order.table_number!=null && <span style={{fontSize:11,fontWeight:700,color:'#D4AF37',background:'rgba(212,175,55,0.12)',padding:'2px 8px',borderRadius:20,border:'1px solid rgba(212,175,55,0.25)'}}>Mesa {order.table_number}</span>}
            <span style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:20,background:isCompleted?'rgba(255,255,255,0.06)':`${tc.color}15`,color:tc.color,fontSize:10,fontWeight:700,marginLeft:'auto',flexShrink:0,border:`1px solid ${tc.color}30`}}>
              <FontAwesomeIcon icon={tc.icon}/>{tc.label}
            </span>
            <span style={{fontSize:15,fontWeight:800,color:isCompleted?'#D4AF37':'#0a0a0a',flexShrink:0}}>
              ${Number(order.total||0).toFixed(2)}
            </span>
          </div>
          {(order.items||[]).length>0 && (
            <div style={{fontSize:12,color:isCompleted?'rgba(255,255,255,0.4)':'#555',background:isCompleted?'rgba(255,255,255,0.04)':'#f8f8f8',borderRadius:8,padding:'7px 10px',marginBottom:10}}>
              {(order.items||[]).slice(0,2).map((item,i)=>(
                <div key={i} style={{display:'flex',gap:6}}>
                  <span style={{fontWeight:700,minWidth:22,color:isCompleted?'#D4AF37':'#000'}}>{item.quantity}×</span>
                  <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.product_name||item.name||'Producto'}</span>
                </div>
              ))}
              {(order.items||[]).length>2 && <div style={{color:isCompleted?'rgba(255,255,255,0.3)':'#999',marginTop:2}}>+{(order.items||[]).length-2} más...</div>}
            </div>
          )}
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:20,background:sc.bg,color:sc.color,fontSize:11,fontWeight:700,flex:1,border:`1px solid ${sc.color}40`}}>
              <FontAwesomeIcon icon={sc.icon} style={{fontSize:10}}/>{sc.label}
            </span>
            <span style={{fontSize:11,color:isCompleted?'rgba(255,255,255,0.3)':'#999',flexShrink:0}}>
              {new Date(isCompleted?(order.completed_at||order.created_at):order.created_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}
            </span>
            {nextAction && (
              <button onClick={e=>{e.stopPropagation();updateOrderStatus(order.id,nextAction.status);}} style={{padding:'7px 14px',borderRadius:20,border:'none',background:nextAction.color==='#D4AF37'?'linear-gradient(135deg,#D4AF37,#b8962e)':nextAction.color,color:nextAction.color==='#D4AF37'?'#000':'#fff',fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0}}>
                {nextAction.label}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={s.container}>
      {/* HEADER */}
      <div style={s.header}>
        <div style={s.headerRow1}>
          <div style={s.logo}>SR</div>
          <div style={s.headerTitle}>
            <div style={s.titleText}>{worker?.store_name||'Tienda'}</div>
            <div style={s.subtitleText}>{worker?.name||worker?.username||'Trabajador'}</div>
          </div>
          <button onClick={()=>fetchOrders(worker.store_id,true)} style={s.iconBtn('rgba(255,255,255,0.07)','#fff','rgba(255,255,255,0.1)')} title="Actualizar">
            <FontAwesomeIcon icon={faSync} style={{fontSize:13,animation:refreshing?'wSpin 0.8s linear infinite':'none'}}/>
          </button>
          <button onClick={()=>setShowWorkerSwitch(true)} style={s.iconBtn('rgba(255,255,255,0.07)','rgba(255,255,255,0.6)','rgba(255,255,255,0.1)')} title="Cambiar usuario">
            <FontAwesomeIcon icon={faUserCog} style={{fontSize:13}}/>
          </button>
          <button onClick={handleLogout} style={s.iconBtn('rgba(239,68,68,0.1)','#f87171','rgba(239,68,68,0.2)')} title="Cerrar sesión">
            <FontAwesomeIcon icon={faSignOutAlt} style={{fontSize:13}}/>
          </button>
        </div>

        {/* Stats mini */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:10}}>
          {[{v:stats.pending,l:'Pendientes',c:'#f59e0b'},{v:stats.preparing,l:'Cocina',c:'#3b82f6'},{v:stats.ready,l:'Listos',c:'#22c55e'},{v:stats.total,l:'Activos',c:'rgba(255,255,255,0.6)'}].map((x,i)=>(
            <div key={i} style={{background:'rgba(255,255,255,0.05)',borderRadius:8,padding:'6px 4px',textAlign:'center',border:'1px solid rgba(255,255,255,0.06)'}}>
              <div style={{fontSize:16,fontWeight:800,color:x.c,lineHeight:1}}>{x.v}</div>
              <div style={{fontSize:9,color:'rgba(255,255,255,0.35)',marginTop:2,textTransform:'uppercase',letterSpacing:'0.5px'}}>{x.l}</div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={s.actionsRow}>
          <button style={s.actionBtn(true)} onClick={()=>setShowNewOrder(true)}>
            <FontAwesomeIcon icon={faPlus}/> Nuevo pedido
          </button>
          <button style={{...s.actionBtn(false),color:'#4ade80',borderColor:'rgba(34,197,94,0.25)',background:'rgba(34,197,94,0.08)'}} onClick={()=>setShowPayModal(true)}>
            <FontAwesomeIcon icon={faMoneyBillWave}/> Cobrar
          </button>
          <button style={{...s.actionBtn(false),color:'#f87171',borderColor:'rgba(239,68,68,0.2)',background:'rgba(239,68,68,0.06)'}} onClick={downloadTodayPDF} title="PDF del día">
            <FontAwesomeIcon icon={faFilePdf}/> PDF
          </button>
          {storeCode && (
            <button style={s.actionBtn(false)} onClick={()=>window.open(`/store/${storeCode}`,'_blank')} title="Ver tienda">
              <FontAwesomeIcon icon={faExternalLinkAlt}/>
            </button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div style={s.tabs}>
        {[{k:'active',l:'Activos',ic:faBell,badge:stats.pending},{k:'completed',l:'Historial',ic:faListAlt,badge:0}].map(t=>(
          <button key={t.k} style={s.tab(activeTab===t.k)} onClick={()=>setActiveTab(t.k)}>
            <FontAwesomeIcon icon={t.ic} style={{fontSize:12}}/>{t.l}
            {t.badge>0 && <span style={{background:'#D4AF37',color:'#000',borderRadius:'50%',width:16,height:16,fontSize:9,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center'}}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* SEARCH + FILTERS */}
      <div style={{...s.filterBar, flexWrap:'nowrap'}}>
        <div style={{position:'relative',flexShrink:0,flex:1,minWidth:100}}>
          <FontAwesomeIcon icon={faSearch} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,0.3)',fontSize:12}}/>
          <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
            style={{width:'100%',padding:'7px 8px 7px 28px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#fff',fontSize:12,outline:'none',boxSizing:'border-box'}}/>
        </div>
        {activeTab==='active' && (
          <>
            {[{k:'all',l:'Todos'},{k:'pending',l:'Pendiente'},{k:'preparing',l:'Cocina'},{k:'ready',l:'Listo'}].map(f=>(
              <button key={f.k} style={s.chip(filter===f.k)} onClick={()=>setFilter(f.k)}>{f.l}</button>
            ))}
          </>
        )}
      </div>

      {/* ORDERS */}
      <div style={s.ordersList}>
        {activeTab==='active' ? (
          filteredOrders.length===0
            ? <div style={{textAlign:'center',padding:'48px 16px',color:'rgba(255,255,255,0.25)'}}>
                <FontAwesomeIcon icon={faBoxOpen} style={{fontSize:40,marginBottom:12,display:'block'}}/> Sin pedidos activos
              </div>
            : filteredOrders.map(o=>renderOrderCard(o,false))
        ) : (
          filteredCompleted.length===0
            ? <div style={{textAlign:'center',padding:'48px 16px',color:'rgba(255,255,255,0.25)'}}>
                <FontAwesomeIcon icon={faBoxOpen} style={{fontSize:40,marginBottom:12,display:'block'}}/> Sin historial hoy
              </div>
            : filteredCompleted.map(o=>renderOrderCard(o,true))
        )}
      </div>

      {/* FAB */}
      <button style={s.fab} onClick={()=>setShowNewOrder(true)} title="Nuevo pedido">
        <FontAwesomeIcon icon={faPlus}/>
      </button>

      {/* ORDER DETAIL SHEET */}
      {selectedOrder && (
        <div style={s.overlay} onClick={()=>setSelectedOrder(null)}>
          <div style={s.sheet} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'center',padding:'12px 0 4px'}}>
              <div style={{width:40,height:4,background:'rgba(255,255,255,0.15)',borderRadius:2}}/>
            </div>
            <div style={{padding:'4px 20px 16px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
              <div>
                <div style={{fontSize:22,fontWeight:800,color:'#D4AF37'}}>#{getOrderDisplayNumber(selectedOrder)}</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:2}}>
                  {new Date(selectedOrder.created_at).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'})}
                </div>
                {selectedOrder.table_number!=null && <div style={{fontSize:13,color:'#D4AF37',fontWeight:700,marginTop:4}}>Mesa {selectedOrder.table_number}</div>}
              </div>
              <button onClick={()=>setSelectedOrder(null)} style={{background:'rgba(255,255,255,0.08)',border:'none',color:'rgba(255,255,255,0.6)',width:36,height:36,borderRadius:8,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <FontAwesomeIcon icon={faTimes}/>
              </button>
            </div>
            <div style={{padding:'16px 20px'}}>
              {/* type + status */}
              <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
                {(()=>{const tc=getOrderTypeInfo(selectedOrder.order_type);const sc=STATUS_MAP[selectedOrder.status]||STATUS_MAP.pending;return(<>
                  <span style={{display:'flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:20,background:`${tc.color}15`,color:tc.color,fontSize:12,fontWeight:700,border:`1px solid ${tc.color}30`}}><FontAwesomeIcon icon={tc.icon}/>{tc.label}</span>
                  <span style={{display:'flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:20,background:sc.bg,color:sc.color,fontSize:12,fontWeight:700,border:`1px solid ${sc.color}40`}}><FontAwesomeIcon icon={sc.icon} style={{fontSize:10}}/>{sc.label}</span>
                </>);})()}
              </div>
              {/* items */}
              <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>Productos</div>
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
                {(selectedOrder.items||[]).map((item,i)=>(
                  <div key={i} style={{background:'rgba(255,255,255,0.05)',borderRadius:10,padding:'10px 12px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',border:'1px solid rgba(255,255,255,0.06)'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <span style={{background:'#D4AF37',color:'#000',fontSize:10,fontWeight:800,padding:'2px 6px',borderRadius:6}}>{item.quantity}×</span>
                        <span style={{fontSize:14,fontWeight:600,color:'#fff'}}>{item.product_name||item.name||'Producto'}</span>
                      </div>
                      {item.selected_ingredients?.length>0 && <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:4,marginLeft:34}}>{Array.isArray(item.selected_ingredients)?item.selected_ingredients.map(x=>x.name||x).join(', '):item.selected_ingredients}</div>}
                      {item.selected_extras?.length>0 && <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:2,marginLeft:34}}>+ {Array.isArray(item.selected_extras)?item.selected_extras.map(x=>x.name||x).join(', '):item.selected_extras}</div>}
                    </div>
                    <span style={{color:'#D4AF37',fontSize:14,fontWeight:700,flexShrink:0,marginLeft:8}}>${(Number(item.unit_price)*Number(item.quantity)).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              {/* total */}
              <div style={{background:'rgba(212,175,55,0.08)',border:'1px solid rgba(212,175,55,0.2)',borderRadius:12,padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <span style={{fontSize:15,fontWeight:700,color:'rgba(255,255,255,0.8)'}}>Total</span>
                <span style={{fontSize:22,fontWeight:800,color:'#D4AF37'}}>${Number(selectedOrder.total||0).toFixed(2)}</span>
              </div>
              {/* completed by */}
              {selectedOrder.completed_by_name && (
                <div style={{background:'rgba(34,197,94,0.08)',border:'1px solid rgba(34,197,94,0.15)',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#4ade80'}}>
                  ✓ Completado por <strong>{selectedOrder.completed_by_name}</strong>
                  {selectedOrder.completed_at && <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:2}}>{new Date(selectedOrder.completed_at).toLocaleString('es-ES')}</div>}
                </div>
              )}
              {/* actions */}
              {selectedOrder.status!=='completed' && selectedOrder.status!=='cancelled' && (
                <button onClick={()=>updateOrderStatus(selectedOrder.id,'completed')} style={{width:'100%',padding:'15px',borderRadius:12,border:'none',background:'linear-gradient(135deg,#D4AF37,#b8962e)',color:'#000',fontSize:15,fontWeight:800,cursor:'pointer',marginBottom:8}}>
                  ✓ Marcar como completado
                </button>
              )}
              <button onClick={()=>setSelectedOrder(null)} style={{width:'100%',padding:'13px',borderRadius:12,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.4)',fontSize:14,fontWeight:600,cursor:'pointer'}}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WORKER SWITCH MODAL */}
      {showWorkerSwitch && (
        <div style={s.modalOverlay} onClick={()=>setShowWorkerSwitch(false)}>
          <div style={s.modal} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,paddingBottom:14,borderBottom:'1px solid rgba(212,175,55,0.15)'}}>
              <h2 style={{margin:0,color:'#D4AF37',fontSize:18,fontWeight:700}}>Cambiar Usuario</h2>
              <button onClick={()=>setShowWorkerSwitch(false)} style={{background:'rgba(255,255,255,0.08)',border:'none',color:'rgba(255,255,255,0.6)',width:34,height:34,borderRadius:8,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><FontAwesomeIcon icon={faTimes}/></button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:300,overflowY:'auto'}}>
              {workers.map(w=>(
                <div key={w.id} onClick={()=>w.id!==worker.id&&switchWorker(w)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:12,background:'rgba(255,255,255,0.06)',cursor:w.id===worker.id?'default':'pointer',border:`1px solid ${w.id===worker.id?'rgba(212,175,55,0.3)':'rgba(255,255,255,0.06)'}`,opacity:w.id===worker.id?1:0.85}}>
                  <div style={{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#b8962e,#D4AF37)',color:'#0a0a0a',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:16,flexShrink:0}}>{(w.username||'?').charAt(0).toUpperCase()}</div>
                  <span style={{color:'rgba(255,255,255,0.9)',fontWeight:500,flex:1}}>{w.username}</span>
                  {w.id===worker.id && <span style={{background:'rgba(34,197,94,0.15)',color:'#4ade80',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,border:'1px solid rgba(34,197,94,0.25)'}}>Actual</span>}
                </div>
              ))}
            </div>
            <button onClick={()=>setShowWorkerSwitch(false)} style={{width:'100%',marginTop:16,padding:'13px',borderRadius:12,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.4)',fontSize:14,fontWeight:600,cursor:'pointer'}}>Cerrar</button>
          </div>
        </div>
      )}

      {/* PAY MODAL */}
      {showPayModal && (
        <div style={s.modalOverlay} onClick={closePayModal}>
          <div style={s.modal} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,paddingBottom:14,borderBottom:'1px solid rgba(212,175,55,0.15)'}}>
              <h2 style={{margin:0,color:'#D4AF37',fontSize:18,fontWeight:700}}>Cobrar Pedido</h2>
              <button onClick={closePayModal} style={{background:'rgba(255,255,255,0.08)',border:'none',color:'rgba(255,255,255,0.6)',width:34,height:34,borderRadius:8,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><FontAwesomeIcon icon={faTimes}/></button>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{display:'block',marginBottom:8,color:'rgba(255,255,255,0.6)',fontSize:13}}>Número de Pedido</label>
              <input type="text" inputMode="text" value={paySearch} onChange={e=>handlePaySearch(e.target.value)} placeholder="Ej: A01, B12..." autoFocus
                style={{width:'100%',padding:'13px 14px',fontSize:18,background:'rgba(255,255,255,0.07)',color:'#fff',border:'1px solid rgba(212,175,55,0.4)',borderRadius:12,outline:'none',boxSizing:'border-box',letterSpacing:'0.05em'}}/>
            </div>
            {paySearch.trim() && payResult===undefined && (
              <div style={{color:'#f87171',textAlign:'center',padding:12,background:'rgba(239,68,68,0.08)',borderRadius:10,marginBottom:12}}>No se encontró ningún pedido</div>
            )}
            {payResult && (
              <div style={{background:'rgba(255,255,255,0.05)',borderRadius:12,padding:16,marginBottom:16,border:'1px solid rgba(255,255,255,0.08)'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                  <span style={{color:'rgba(255,255,255,0.5)',fontSize:13}}>Pedido:</span>
                  <span style={{fontSize:20,fontWeight:800,color:'#D4AF37'}}>#{getOrderDisplayNumber(payResult)}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                  <span style={{color:'rgba(255,255,255,0.5)',fontSize:13}}>Tipo:</span>
                  <span style={{color:'#fff',fontWeight:600,fontSize:13,display:'flex',alignItems:'center',gap:6}}>
                    <FontAwesomeIcon icon={getOrderTypeInfo(payResult.order_type).icon}/> {getOrderTypeInfo(payResult.order_type).label}
                  </span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{color:'rgba(255,255,255,0.5)',fontSize:13}}>Total:</span>
                  <span style={{color:'#4ade80',fontWeight:800,fontSize:20}}>${Number(payResult.total||0).toFixed(2)}</span>
                </div>
                {payResult.items?.length>0 && (
                  <div style={{marginTop:10,borderTop:'1px solid rgba(255,255,255,0.08)',paddingTop:10}}>
                    {payResult.items.map((item,idx)=>(
                      <div key={idx} style={{display:'flex',gap:8,padding:'3px 0',fontSize:13}}>
                        <span style={{color:'#D4AF37',fontWeight:700,minWidth:22}}>{item.quantity}×</span>
                        <span style={{color:'#fff'}}>{item.product_name||item.name||'Producto'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {payResult && (
              payResult._isPendingCash
                ? <button onClick={handleApprovePay} style={{width:'100%',padding:14,background:'linear-gradient(135deg,#22c55e,#16a34a)',color:'#fff',border:'none',borderRadius:12,fontSize:15,fontWeight:800,cursor:'pointer',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><FontAwesomeIcon icon={faCheck}/> Marcar como Pagado</button>
                : <div style={{color:'#f59e0b',textAlign:'center',padding:10,marginBottom:8,background:'rgba(245,158,11,0.08)',borderRadius:10,fontSize:13}}>Este pedido ya está procesado ({payResult.status})</div>
            )}
            <button onClick={closePayModal} style={{width:'100%',padding:13,borderRadius:12,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.4)',fontSize:14,fontWeight:600,cursor:'pointer'}}>Cerrar</button>
          </div>
        </div>
      )}

      {/* NEW ORDER */}
      {showNewOrder && (
        <WorkerNewOrder
          worker={worker}
          storeId={worker.store_id}
          storeCode={storeCode}
          onClose={()=>setShowNewOrder(false)}
          onOrderCreated={()=>fetchOrders(worker.store_id)}
        />
      )}

      <style>{`@keyframes wSpin{to{transform:rotate(360deg)}} *{-webkit-tap-highlight-color:transparent} ::-webkit-scrollbar{display:none} input::placeholder{color:rgba(255,255,255,0.3)}`}</style>
    </div>
  );
}

export default WorkerPanel;
