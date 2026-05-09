import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { io } from 'socket.io-client';

const API = 'https://srservi2.srautomatic.com';

// Notification sound
let _saNotifAudio = null;
function saPlaySound() {
  try {
    if (!_saNotifAudio) { _saNotifAudio = new Audio('/notification.mp3'); _saNotifAudio.volume = 1; }
    _saNotifAudio.currentTime = 0;
    _saNotifAudio.play().catch(() => {});
  } catch {}
}
if (typeof document !== 'undefined') {
  const u = () => { if (!_saNotifAudio) { _saNotifAudio = new Audio('/notification.mp3'); } _saNotifAudio.play().then(() => { _saNotifAudio.pause(); _saNotifAudio.currentTime = 0; }).catch(() => {}); document.removeEventListener('click', u); };
  document.addEventListener('click', u, { once: true });
}

import {
  faUsers,
  faStore,
  faSignOutAlt,
  faEdit,
  faTrash,
  faBan,
  faCheck,
  faSearch,
  faExclamationTriangle,
  faShieldAlt,
  faChartBar,
  faCreditCard,
  faTimes,
  faBars,
  faChevronLeft,
  faChevronRight,
  faPuzzlePiece,
  faClock,
  faEnvelope,
  faDownload,
  faEye,
  faTicketAlt,
  faPaperPlane,
  faImage,
  faLock,
  faCircle,
  faArrowLeft,
  faMobileAlt,
  faUpload,
  faPlus,
  faShoppingCart,
  faMoneyBillWave,
  faFilter,
  faSync,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons';

function SuperadminDashboard() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [storeActivityFilter, setStoreActivityFilter] = useState('all');
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ email: '', password: '', is_banned: false });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workshopPlugins, setWorkshopPlugins] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [ticketMessages, setTicketMessages] = useState([]);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [ticketMsg, setTicketMsg] = useState('');
  const [ticketImg, setTicketImg] = useState(null);
  const [ticketAdminOnly, setTicketAdminOnly] = useState(false);
  const [ticketSending, setTicketSending] = useState(false);
  const [superadmins, setSuperadmins] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [apkReleases, setApkReleases] = useState([]);
  const [showApkModal, setShowApkModal] = useState(false);
  const [apkForm, setApkForm] = useState({ name: '', description: '', version: '' });
  const [apkFile, setApkFile] = useState(null);
  const [apkLogo, setApkLogo] = useState(null);
  const [apkUploading, setApkUploading] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [workshopTab, setWorkshopTab] = useState('pending');
  const [selectedWorkshopPlugin, setSelectedWorkshopPlugin] = useState(null);
  const [premiumTarget, setPremiumTarget] = useState(null);
  const [premiumForever, setPremiumForever] = useState(true);
  const [premiumDate, setPremiumDate] = useState('');
  const [premiumPlans, setPremiumPlans] = useState([]);
  const [premiumPlanId, setPremiumPlanId] = useState('');
  const [myProfile, setMyProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileAvatar, setProfileAvatar] = useState(null);
  const navigate = useNavigate();
  const selectedTicketRef = useRef(null);
  const saMsgEndRef = useRef(null);
  const saMsgContainerRef = useRef(null);
  const [saMobileChat, setSaMobileChat] = useState(false);

  // ── Notificaciones de pedidos nuevos ─────────────────────────────────────
  const [orderNotifs, setOrderNotifs] = useState([]); // [{id, order_number, store_name, total, payment_method}]

  const dismissNotif = (nid) => setOrderNotifs(p => p.filter(n => n.nid !== nid));

  // ── Pedidos (superadmin) ───────────────────────────────────────────────────
  const [saOrders, setSaOrders] = useState([]);
  const [saOrdersTotal, setSaOrdersTotal] = useState(0);
  const [saOrdersLoading, setSaOrdersLoading] = useState(false);
  const [saOrderFilter, setSaOrderFilter] = useState({ store_id: '', date_from: '', date_to: '', status: '' });
  const [saOrderDetail, setSaOrderDetail] = useState(null);
  const [saOrderItems, setSaOrderItems] = useState([]);
  const [saDeleteConfirm, setSaDeleteConfirm] = useState(null);

  const fetchSaOrders = async (filterOverride) => {
    setSaOrdersLoading(true);
    try {
      const token = localStorage.getItem('superadminToken');
      const activeFilter = filterOverride !== undefined ? filterOverride : saOrderFilter;
      const q = new URLSearchParams(Object.fromEntries(Object.entries(activeFilter).filter(([, v]) => v)));
      const r = await fetch(`${API}/api/superadmin/orders?${q}`, { headers: { Authorization: 'Bearer ' + token } });
      if (!r.ok) {
        console.error('fetchSaOrders error:', r.status, await r.text());
        setSaOrders([]);
        setSaOrdersTotal(0);
        return;
      }
      const d = await r.json();
      setSaOrders(d.orders || []);
      setSaOrdersTotal(d.total || 0);
    } catch (err) {
      console.error('fetchSaOrders exception:', err);
      setSaOrders([]);
      setSaOrdersTotal(0);
    } finally { setSaOrdersLoading(false); }
  };

  const openSaOrderDetail = async (order) => {
    setSaOrderDetail(order);
    setSaOrderItems([]);
    const token = localStorage.getItem('superadminToken');
    const r = await fetch(`${API}/api/superadmin/orders/${order.id}/items`, { headers: { Authorization: 'Bearer ' + token } });
    if (r.ok) setSaOrderItems(await r.json());
  };

  const saMarkPaid = async (id) => {
    const token = localStorage.getItem('superadminToken');
    await fetch(`${API}/api/superadmin/orders/${id}/mark-paid`, { method: 'PUT', headers: { Authorization: 'Bearer ' + token } });
    setSaOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'completed', cash_approved: 1 } : o));
    if (saOrderDetail?.id === id) setSaOrderDetail(prev => ({ ...prev, status: 'completed', cash_approved: 1 }));
  };

  const saDeleteOrder = async (id) => {
    const token = localStorage.getItem('superadminToken');
    await fetch(`${API}/api/superadmin/orders/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    setSaOrders(prev => prev.filter(o => o.id !== id));
    setSaDeleteConfirm(null);
    if (saOrderDetail?.id === id) setSaOrderDetail(null);
  };

  const scrollChatToBottom = () => {
    if (saMsgContainerRef.current) {
      saMsgContainerRef.current.scrollTop = saMsgContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => { selectedTicketRef.current = selectedTicketId; }, [selectedTicketId]);

  useEffect(() => {
    const token = localStorage.getItem('superadminToken');
    if (!token) {
      navigate('/superadmin/login');
    } else {
      fetch(API + '/api/superadmin/profile', { headers: { Authorization: 'Bearer ' + token } })
        .then(r => r.json()).then(d => { if (d.id) setMyProfile(d); }).catch(() => {});
    }
  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Carga tiendas al inicio para tenerlas disponibles en el filtro de pedidos
  useEffect(() => {
    const token = localStorage.getItem('superadminToken');
    if (!token) return;
    fetch(API + '/api/superadmin/stores', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setStores(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab !== 'users') return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Socket.io for realtime ticket messages
  useEffect(() => {
    const socket = io(API);
    const tk = localStorage.getItem('superadminToken');
    const reloadTicketMsgs = async (ticketId) => {
      if (!tk) return;
      try {
        const res = await fetch(API + `/api/superadmin/tickets/${ticketId}/messages`, { headers: { Authorization: 'Bearer ' + tk } });
        if (res.ok) { const d = await res.json(); setTicketDetail(d.ticket); setTicketMessages(d.messages); setTimeout(scrollChatToBottom, 80); }
      } catch {}
    };
    socket.on('ticket_message', (data) => {
      if (data.sender_type === 'user') saPlaySound();
      const current = selectedTicketRef.current;
      if (current && data.ticket_id === current) reloadTicketMsgs(current);
      // Refresh ticket list
      if (tk) fetch(API + '/api/superadmin/tickets', { headers: { Authorization: 'Bearer ' + tk } }).then(r => r.json()).then(d => { if (Array.isArray(d)) setTickets(d); }).catch(() => {});
    });
    socket.on('ticket_created', () => {
      saPlaySound();
      if (tk) fetch(API + '/api/superadmin/tickets', { headers: { Authorization: 'Bearer ' + tk } }).then(r => r.json()).then(d => { if (Array.isArray(d)) setTickets(d); }).catch(() => {});
    });
    socket.on('ticket_updated', () => {
      if (tk) fetch(API + '/api/superadmin/tickets', { headers: { Authorization: 'Bearer ' + tk } }).then(r => r.json()).then(d => { if (Array.isArray(d)) setTickets(d); }).catch(() => {});
      const current = selectedTicketRef.current;
      if (current) reloadTicketMsgs(current);
    });

    socket.on('superadmin_new_order', (data) => {
      saPlaySound();
      const nid = Date.now() + Math.random();
      // resolve store name from loaded stores list
      setStores(currentStores => {
        const found = currentStores.find(s => s.id === data.store_id);
        const storeName = found?.name || `Tienda #${data.store_id}`;
        const storeCode = found?.code || null;
        setOrderNotifs(prev => [...prev, { nid, ...data, store_name: storeName, store_code: storeCode }]);
        return currentStores;
      });
      // auto-dismiss after 8 seconds
      setTimeout(() => setOrderNotifs(prev => prev.filter(n => n.nid !== nid)), 8000);
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('superadminToken');
    if (token) {
      fetch(API + '/api/superadmin/workshop', {
        headers: { 'Authorization': 'Bearer ' + token }
      }).then(r => r.json()).then(data => {
        if (Array.isArray(data)) setWorkshopPlugins(data);
      }).catch(() => {});
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('superadminToken');

    try {
      if (activeTab === 'users') {
        const res = await fetch(API + '/api/superadmin/users', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        setUsers(data);
      } else if (activeTab === 'stores') {
        const res = await fetch(API + '/api/superadmin/stores', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        setStores(data);
      } else if (activeTab === 'subscriptions') {
        const res = await fetch(API + '/api/superadmin/subscriptions', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        console.log('Datos de suscripciones:', data);
        setSubscriptions(Array.isArray(data) ? data : []);
      } else if (activeTab === 'admins') {
        const res = await fetch(API + '/api/superadmin/list', { headers: { 'Authorization': 'Bearer ' + token } });
        if (res.ok) setSuperadmins(await res.json());
      } else if (activeTab === 'tickets') {
        const res = await fetch(API + '/api/superadmin/tickets', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        setTickets(Array.isArray(data) ? data : []);
      } else if (activeTab === 'workshop') {
        const res = await fetch(API + '/api/superadmin/workshop', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        setWorkshopPlugins(Array.isArray(data) ? data : []);
      } else if (activeTab === 'apks') {
        const res = await fetch(API + '/api/superadmin/apks', { headers: { 'Authorization': 'Bearer ' + token } });
        const data = await res.json();
        setApkReleases(Array.isArray(data) ? data : []);
      } else if (activeTab === 'orders') {
        await fetchSaOrders();
        return;
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('superadminToken');
    localStorage.removeItem('superadmin');
    navigate('/superadmin/login');
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setEditForm({ email: user.email, password: '', is_banned: user.is_banned });
    setShowEditModal(true);
  };

  const handleSaveUser = async () => {
    const token = localStorage.getItem('superadminToken');
    try {
      const res = await fetch(API + '/api/superadmin/users/' + editingUser.id, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(editForm)
      });

      if (res.ok) {
        setShowEditModal(false);
        fetchData();
      }
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const handleToggleBanUser = async (user) => {
    const token = localStorage.getItem('superadminToken');
    try {
      const res = await fetch(API + '/api/superadmin/users/' + user.id, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          email: user.email,
          is_banned: !user.is_banned
        })
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error toggling ban:', error);
    }
  };

  const handleDeleteUser = async (userId) => {
    const token = localStorage.getItem('superadminToken');
    try {
      const res = await fetch(API + '/api/superadmin/users/' + userId, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });

      if (res.ok) {
        setShowDeleteConfirm(null);
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleToggleBanStore = async (store) => {
    const token = localStorage.getItem('superadminToken');
    try {
      const res = await fetch(API + '/api/superadmin/stores/' + store.id, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ is_banned: !store.is_banned })
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error toggling ban:', error);
    }
  };

  const handleDeleteStore = async (storeId) => {
    const token = localStorage.getItem('superadminToken');
    try {
      const res = await fetch(API + '/api/superadmin/stores/' + storeId, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });

      if (res.ok) {
        setShowDeleteConfirm(null);
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting store:', error);
    }
  };

  const openPremiumModal = async (sub) => {
    setPremiumTarget(sub);
    setPremiumForever(true);
    setPremiumDate('');
    setPremiumPlanId('');
    try {
      const token = localStorage.getItem('superadminToken');
      const res = await fetch(API + '/api/plans');
      if (res.ok) {
        const plans = await res.json();
        setPremiumPlans(plans.filter(p => p.name !== 'Gratis'));
        if (plans.filter(p => p.name !== 'Gratis').length > 0) {
          setPremiumPlanId(plans.filter(p => p.name !== 'Gratis')[0].id);
        }
      }
    } catch {}
    setShowPremiumModal(true);
  };

  const handleAssignPremium = async () => {
    if (!premiumTarget || !premiumPlanId) return;
    const token = localStorage.getItem('superadminToken');
    try {
      const res = await fetch(API + '/api/superadmin/assign-premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          user_id: premiumTarget.user_id,
          plan_id: premiumPlanId,
          forever: premiumForever,
          ends_at: premiumForever ? null : premiumDate
        })
      });
      if (res.ok) {
        setShowPremiumModal(false);
        fetchData();
      } else {
        const d = await res.json();
        alert(d.error || 'Error al asignar premium');
      }
    } catch (error) {
      console.error('Error asignando premium:', error);
    }
  };

  const handleUploadApk = async () => {
    if (!apkForm.name || !apkForm.version || !apkFile) return;
    setApkUploading(true);
    const token = localStorage.getItem('superadminToken');
    try {
      const fd = new FormData();
      fd.append('name', apkForm.name);
      fd.append('description', apkForm.description);
      fd.append('version', apkForm.version);
      fd.append('apk', apkFile);
      if (apkLogo) fd.append('logo', apkLogo);
      const res = await fetch(API + '/api/superadmin/apks', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: fd
      });
      if (res.ok) {
        setShowApkModal(false);
        setApkForm({ name: '', description: '', version: '' });
        setApkFile(null);
        setApkLogo(null);
        fetchData();
      } else {
        const d = await res.json();
        alert(d.error || 'Error al subir APK');
      }
    } catch (error) {
      console.error('Error subiendo APK:', error);
    } finally {
      setApkUploading(false);
    }
  };

  const handleDeleteApk = async (id) => {
    if (!confirm('Eliminar esta versión?')) return;
    const token = localStorage.getItem('superadminToken');
    try {
      await fetch(API + `/api/superadmin/apks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      fetchData();
    } catch (error) {
      console.error('Error eliminando APK:', error);
    }
  };

  const handleWorkshopVersionStatus = async (pluginId, version, status) => {
    const token = localStorage.getItem('superadminToken');
    try {
      const res = await fetch(API + `/api/superadmin/workshop/${pluginId}/version/${version}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) fetchData();
    } catch (error) {
      console.error('Error updating workshop version:', error);
    }
  };

  const filteredUsers = users.filter(user =>
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.business_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const now = Date.now();
  const DAY_MS = 86400000;
  const isStoreActive7d = (store) => store.last_order_at && (now - new Date(store.last_order_at).getTime()) < 7 * DAY_MS;
  const isStoreActive30d = (store) => store.last_order_at && (now - new Date(store.last_order_at).getTime()) < 30 * DAY_MS;

  const filteredStores = stores.filter(store => {
    const matchesSearch = store.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      store.user_email?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (storeActivityFilter === '7d') return isStoreActive7d(store);
    if (storeActivityFilter === '30d') return isStoreActive30d(store);
    if (storeActivityFilter === 'inactive') return !store.last_order_at;
    return true;
  });

  const stats = {
    totalUsers: users.length,
    bannedUsers: users.filter(u => u.is_banned).length,
    totalStores: stores.length,
    bannedStores: stores.filter(s => s.is_banned).length,
    activeUsers: users.filter(u => !u.is_banned).length,
    activeStores: stores.filter(s => !s.is_banned).length,
    storesActive7d: stores.filter(isStoreActive7d).length,
    storesActive30d: stores.filter(isStoreActive30d).length,
    storesInactive: stores.filter(s => !s.last_order_at).length
  };

  const formatLastActive = (date) => {
    if (!date) return 'Nunca';
    const now = new Date();
    const lastActive = new Date(date);
    const diffMs = now - lastActive;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return lastActive.toLocaleDateString('es-ES');
  };

  const getActivityStatus = (date) => {
    if (!date) return 'inactive';
    const now = new Date();
    const lastActive = new Date(date);
    const diffMs = now - lastActive;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 5) return 'online';
    if (diffMins < 60) return 'recent';
    if (diffMins < 1440) return 'today';
    return 'inactive';
  };

  return (
    <div className="flex admin-layout">
      {mobileMenuOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className={`admin-sidebar ${sidebarOpen ? 'open' : 'collapsed'} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <FontAwesomeIcon icon={faShieldAlt} />
          </div>
          {sidebarOpen && (
            <div>
              <div className="font-bold">Superadmin</div>
              <div className="text-sm sidebar-brand-subtitle">Panel de Control</div>
            </div>
          )}
        </div>

        <button
          className="sidebar-toggle-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <FontAwesomeIcon icon={sidebarOpen ? faChevronLeft : faChevronRight} />
          {sidebarOpen && <span className="text-sm">Colapsar</span>}
        </button>

        <nav className="sidebar-nav flex-1">
          <div
            className={`sidebar-nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => { setActiveTab('users'); setMobileMenuOpen(false); }}
          >
            <FontAwesomeIcon icon={faUsers} />
            {sidebarOpen && <span>Usuarios</span>}
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'stores' ? 'active' : ''}`}
            onClick={() => { setActiveTab('stores'); setMobileMenuOpen(false); }}
          >
            <FontAwesomeIcon icon={faStore} />
            {sidebarOpen && <span>Tiendas</span>}
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'subscriptions' ? 'active' : ''}`}
            onClick={() => { setActiveTab('subscriptions'); setMobileMenuOpen(false); }}
          >
            <FontAwesomeIcon icon={faCreditCard} />
            {sidebarOpen && <span>Suscripciones</span>}
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'workshop' ? 'active' : ''}`}
            onClick={() => { setActiveTab('workshop'); setMobileMenuOpen(false); }}
          >
            <FontAwesomeIcon icon={faPuzzlePiece} />
            {sidebarOpen && <span>Workshop</span>}
            {workshopPlugins.filter(p => p.status === 'pending').length > 0 && (
              <span style={{
                background: '#dc3545', color: '#fff', borderRadius: '50%',
                width: '20px', height: '20px', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '11px',
                fontWeight: '700', marginLeft: 'auto'
              }}>
                {workshopPlugins.filter(p => p.status === 'pending').length}
              </span>
            )}
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'tickets' ? 'active' : ''}`}
            onClick={() => { setActiveTab('tickets'); setMobileMenuOpen(false); }}
          >
            <FontAwesomeIcon icon={faTicketAlt} />
            {sidebarOpen && <span>Tickets</span>}
            {tickets.filter(t => t.status === 'open').length > 0 && (
              <span style={{
                background: '#e74c3c', color: '#fff', borderRadius: '50%',
                width: '20px', height: '20px', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '11px',
                fontWeight: '700', marginLeft: 'auto'
              }}>
                {tickets.filter(t => t.status === 'open').length}
              </span>
            )}
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'admins' ? 'active' : ''}`}
            onClick={() => { setActiveTab('admins'); setMobileMenuOpen(false); }}
          >
            <FontAwesomeIcon icon={faShieldAlt} />
            {sidebarOpen && <span>Superadmins</span>}
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'apks' ? 'active' : ''}`}
            onClick={() => { setActiveTab('apks'); setMobileMenuOpen(false); }}
          >
            <FontAwesomeIcon icon={faMobileAlt} />
            {sidebarOpen && <span>APK Releases</span>}
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => { setActiveTab('orders'); setMobileMenuOpen(false); }}
          >
            <FontAwesomeIcon icon={faShoppingCart} />
            {sidebarOpen && <span>Pedidos</span>}
          </div>
        </nav>

        <div className="sidebar-footer">
          {myProfile && sidebarOpen && (
            <div onClick={() => { setProfileName(myProfile.username || ''); setProfileAvatar(null); setShowProfileModal(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', cursor: 'pointer', borderRadius: '8px', marginBottom: '4px', background: 'rgba(255,255,255,0.05)' }}>
              {myProfile.avatar ? (
                <img src={API + myProfile.avatar} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#aaa' }}>
                  <FontAwesomeIcon icon={faShieldAlt} />
                </div>
              )}
              <div style={{ fontSize: '12px', lineHeight: '1.3' }}>
                <div style={{ fontWeight: '700', color: '#fff' }}>{myProfile.username || myProfile.email}</div>
                <div style={{ color: '#888', fontSize: '10px' }}>Editar perfil</div>
              </div>
            </div>
          )}
          <div className="sidebar-nav-item logout" onClick={handleLogout}>
            <FontAwesomeIcon icon={faSignOutAlt} />
            {sidebarOpen && <span>Cerrar Sesion</span>}
          </div>
        </div>
      </div>

      {/* Notificaciones de pedidos nuevos */}
      {orderNotifs.length > 0 && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320, width: '100%' }}>
          {orderNotifs.map(n => (
            <div key={n.nid} style={{
              background: '#18181b', border: '1px solid #D4AF37', borderRadius: 12,
              padding: '12px 14px', boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
              display: 'flex', alignItems: 'center', gap: 12, animation: 'slideIn 0.25s ease'
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FontAwesomeIcon icon={faShoppingCart} style={{ color: '#D4AF37', fontSize: 16 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Nuevo pedido — {n.store_name}{n.store_code ? ` [${n.store_code}]` : ''}
                </div>
                <div style={{ color: '#D4AF37', fontSize: 12, fontWeight: 600 }}>
                  #{n.order_number || n.id} · ${parseFloat(n.total).toLocaleString()} · {n.payment_method === 'cash' ? 'Efectivo' : n.payment_method === 'card' ? 'Tarjeta' : n.payment_method}
                </div>
              </div>
              <button onClick={() => dismissNotif(n.nid)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16, padding: 4, flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}

      <div className={`admin-main ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        <header className="admin-header">
          <div className="flex items-center gap-3">
            <button
              className="btn mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
            >
              <FontAwesomeIcon icon={faBars} />
            </button>
            <div>
              <h1 className="admin-header-title">
                {activeTab === 'users' ? 'Usuarios' : activeTab === 'stores' ? 'Tiendas' : activeTab === 'workshop' ? 'Workshop - Plugins' : activeTab === 'tickets' ? 'Tickets de Soporte' : activeTab === 'admins' ? 'Superadministradores' : activeTab === 'apks' ? 'APK Releases' : activeTab === 'orders' ? 'Pedidos' : 'Suscripciones'}
              </h1>
              <p className="admin-header-subtitle text-muted text-sm">
                {activeTab === 'users' ? 'Administra las cuentas de usuarios' : activeTab === 'stores' ? 'Administra todas las tiendas' : activeTab === 'workshop' ? 'Revisa y aprueba plugins del workshop' : 'Ver todas las suscripciones'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 stats-badges">
            <div className="stat-badge stat-badge-dark">
              <FontAwesomeIcon icon={faUsers} />
              <span className="font-bold">{stats.totalUsers}</span>
              <span className="stat-badge-label">Usuarios</span>
            </div>
            <div className="stat-badge stat-badge-gold">
              <FontAwesomeIcon icon={faStore} />
              <span className="font-bold">{stats.totalStores}</span>
              <span className="stat-badge-label">Tiendas</span>
            </div>
            <div className="stat-badge stat-badge-success">
              <FontAwesomeIcon icon={faCreditCard} />
              <span className="font-bold">{subscriptions.length}</span>
              <span className="stat-badge-label">Subs</span>
            </div>
          </div>
        </header>

        <div className="admin-content">
          <div className="card">
            <div className="flex justify-between items-center card-toolbar">
              <div className="flex gap-4 badge-group">
                <div className="badge badge-success">
                  {activeTab === 'users' ? stats.activeUsers : stats.activeStores} Activos
                </div>
                <div className="badge badge-danger">
                  {activeTab === 'users' ? stats.bannedUsers : stats.bannedStores} Baneados
                </div>
              </div>
              <div className="search-wrapper">
                <FontAwesomeIcon icon={faSearch} className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="empty-state">
                <div>Cargando datos...</div>
              </div>
            ) : activeTab === 'users' ? (
              <div className="admin-table-wrapper">
                <table className="table admin-table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Email</th>
                      <th className="hide-mobile">Empresa</th>
                      <th className="text-center">Tiendas</th>
                      <th className="text-center hide-mobile">Última Actividad</th>
                      <th className="text-center hide-mobile">País</th>
                      <th className="text-center">En línea</th>
                      <th className="text-center">Estado</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => {
                      const actStatus = getActivityStatus(user.last_active);
                      const isOnline = actStatus === 'online';
                      return (
                      <tr key={user.id}>
                        <td>
                          <div className="font-bold">{user.username}</div>
                          <div className="text-sm text-muted">Code: {user.code}</div>
                        </td>
                        <td>{user.email}</td>
                        <td className="hide-mobile">{user.business_name || '-'}</td>
                        <td className="text-center">
                          <span className="badge badge-gold">
                            {user.store_count}
                          </span>
                        </td>
                        <td className="text-center hide-mobile">
                          <span className={`badge badge-activity-${actStatus}`}>
                            {formatLastActive(user.last_active)}
                          </span>
                        </td>
                        <td className="text-center hide-mobile" style={{ fontSize: '13px' }}>
                          {user.country || '—'}
                        </td>
                        <td className="text-center">
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                            background: isOnline ? 'rgba(34,197,94,0.15)' : 'rgba(156,163,175,0.15)',
                            color: isOnline ? '#22c55e' : '#9ca3af'
                          }}>
                            <span style={{
                              width: '7px', height: '7px', borderRadius: '50%',
                              background: isOnline ? '#22c55e' : '#9ca3af',
                              boxShadow: isOnline ? '0 0 6px #22c55e' : 'none'
                            }} />
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td className="text-center">
                          {user.is_banned ? (
                            <span className="badge badge-danger">Baneado</span>
                          ) : (
                            <span className="badge badge-success">Activo</span>
                          )}
                        </td>
                        <td className="text-center">
                          <button
                            className="btn btn-sm btn-icon"
                            onClick={() => handleEditUser(user)}
                            title="Editar"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            className={`btn btn-sm btn-icon ${user.is_banned ? 'btn-unban' : 'btn-ban'}`}
                            onClick={() => handleToggleBanUser(user)}
                            title={user.is_banned ? 'Desbanear' : 'Banear'}
                          >
                            <FontAwesomeIcon icon={user.is_banned ? faCheck : faBan} />
                          </button>
                          <button
                            className="btn btn-sm btn-icon btn-delete"
                            onClick={() => setShowDeleteConfirm({ type: 'user', id: user.id, name: user.username })}
                            title="Eliminar"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className="empty-state">
                    <FontAwesomeIcon icon={faUsers} className="empty-state-icon" />
                    <div>No se encontraron usuarios</div>
                  </div>
                )}
              </div>
            ) : activeTab === 'stores' ? (
              <div>
                {/* Activity summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  {[
                    { label: 'Total tiendas', value: stats.totalStores, color: '#D4AF37', filter: 'all' },
                    { label: 'Activas 7 días', value: stats.storesActive7d, color: '#22c55e', filter: '7d' },
                    { label: 'Activas 30 días', value: stats.storesActive30d, color: '#3b82f6', filter: '30d' },
                    { label: 'Sin actividad', value: stats.storesInactive, color: '#6b7280', filter: 'inactive' },
                  ].map(card => (
                    <button
                      key={card.filter}
                      onClick={() => setStoreActivityFilter(storeActivityFilter === card.filter ? 'all' : card.filter)}
                      style={{
                        background: storeActivityFilter === card.filter ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${storeActivityFilter === card.filter ? card.color : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: '12px',
                        padding: '14px 12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontSize: '26px', fontWeight: '800', color: card.color, lineHeight: 1 }}>{card.value}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px', fontWeight: '600' }}>{card.label}</div>
                    </button>
                  ))}
                </div>

                <div className="admin-table-wrapper">
                  <table className="table admin-table">
                    <thead>
                      <tr>
                        <th className="hide-mobile">Tienda</th>
                        <th>Propietario</th>
                        <th className="text-center hide-mobile">Prods.</th>
                        <th className="text-center hide-mobile">Pedidos</th>
                        <th className="text-center hide-mobile">Últ. pedido</th>
                        <th className="text-center">Estado</th>
                        <th className="text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStores.map(store => {
                        const lastOrder = store.last_order_at ? new Date(store.last_order_at) : null;
                        const diffDays = lastOrder ? Math.floor((now - lastOrder.getTime()) / DAY_MS) : null;
                        const actColor = diffDays === null ? '#6b7280' : diffDays < 7 ? '#22c55e' : diffDays < 30 ? '#3b82f6' : '#f59e0b';
                        const actLabel = diffDays === null ? 'Sin pedidos' : diffDays === 0 ? 'Hoy' : diffDays === 1 ? 'Ayer' : `Hace ${diffDays}d`;
                        return (
                          <tr key={store.id}>
                            <td className="hide-mobile">
                              <div className="font-bold">{store.name}</div>
                              <div className="text-sm text-muted">Code: {store.code}</div>
                            </td>
                            <td>
                              <div className="text-muted">{store.user_email}</div>
                              <div className="text-sm text-muted hide-mobile">{store.user_business || '-'}</div>
                            </td>
                            <td className="text-center hide-mobile">
                              <span className="badge badge-gold">{store.product_count}</span>
                            </td>
                            <td className="text-center hide-mobile">
                              <div><span className="badge badge-dark">{store.order_count}</span></div>
                              {store.orders_30d > 0 && (
                                <div style={{ fontSize: '10px', color: '#3b82f6', marginTop: '3px' }}>+{store.orders_30d} (30d)</div>
                              )}
                            </td>
                            <td className="text-center hide-mobile">
                              <span style={{ fontSize: '12px', fontWeight: '700', color: actColor }}>{actLabel}</span>
                            </td>
                            <td className="text-center">
                              {store.is_banned ? (
                                <span className="badge badge-danger">Baneada</span>
                              ) : (
                                <span className="badge badge-success">Activa</span>
                              )}
                            </td>
                            <td className="text-center">
                              <button
                                className={`btn btn-sm btn-icon ${store.is_banned ? 'btn-unban' : 'btn-ban'}`}
                                onClick={() => handleToggleBanStore(store)}
                                title={store.is_banned ? 'Desbanear' : 'Banear'}
                              >
                                <FontAwesomeIcon icon={store.is_banned ? faCheck : faBan} />
                              </button>
                              <button
                                className="btn btn-sm btn-icon btn-delete"
                                onClick={() => setShowDeleteConfirm({ type: 'store', id: store.id, name: store.name })}
                                title="Eliminar"
                              >
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredStores.length === 0 && (
                    <div className="empty-state">
                      <FontAwesomeIcon icon={faStore} className="empty-state-icon" />
                      <div>No se encontraron tiendas</div>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'subscriptions' ? (
              <div className="admin-table-wrapper">
                <table className="table admin-table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th className="hide-mobile">Email</th>
                      <th className="hide-mobile">Plan Actual</th>
                      <th className="text-center hide-mobile">Precio</th>
                      <th className="text-center hide-mobile">Vencimiento</th>
                      <th className="text-center">Estado</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map(sub => (
                      <tr key={sub.email} className="clickable-row"
                          onClick={() => { setSelectedSubscription(sub); setShowSubscriptionModal(true); }}>
                        <td>
                          <div className="font-bold">{sub.username}</div>
                          <div className="text-sm text-muted hide-mobile">{sub.business_name || '-'}</div>
                        </td>
                        <td className="hide-mobile">{sub.email}</td>
                        <td className="hide-mobile">
                          <span className={`badge ${sub.current_plan === 'Gratis' || !sub.current_plan ? 'badge-gray' : 'badge-gold'}`}>
                            {sub.current_plan || 'Gratis'}
                          </span>
                        </td>
                        <td className="text-center hide-mobile">
                          <div className="font-bold">
                            {!sub.current_plan || sub.current_plan === 'Gratis' ? 'Gratis' :
                              sub.current_billing_cycle === 'monthly'
                                ? `$${sub.current_price_monthly}/mes`
                                : `$${sub.current_price_yearly}/ano`}
                          </div>
                        </td>
                        <td className="text-center hide-mobile text-muted">
                          {sub.current_ends_at ? new Date(sub.current_ends_at).toLocaleDateString('es-ES') : '-'}
                        </td>
                        <td className="text-center">
                          {sub.current_is_active && sub.current_ends_at && new Date(sub.current_ends_at) > new Date() ? (
                            <span className="badge badge-success">Activo</span>
                          ) : sub.current_is_active === false ? (
                            <span className="badge badge-danger">Cancelado</span>
                          ) : (
                            <span className="badge badge-gray">Gratis</span>
                          )}
                        </td>
                        <td className="text-center">
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={(e) => { e.stopPropagation(); setSelectedSubscription(sub); setShowSubscriptionModal(true); }}
                            style={{ marginRight: '4px' }}
                          >
                            Ver
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ background: '#D4AF37', color: '#fff', border: 'none' }}
                            onClick={(e) => { e.stopPropagation(); openPremiumModal(sub); }}
                          >
                            Dar Premium
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {subscriptions.length === 0 && (
                  <div className="empty-state">
                    <FontAwesomeIcon icon={faCreditCard} className="empty-state-icon" />
                    <div>No hay suscripciones</div>
                  </div>
                )}
              </div>
            ) : activeTab === 'workshop' ? (
              <div>
                {(() => {
                  const pluginsWithPending = workshopPlugins.filter(p => (p.versions || []).some(v => v.status === 'pending'));
                  const pluginsReviewed = workshopPlugins.filter(p => !(p.versions || []).some(v => v.status === 'pending'));
                  const visiblePlugins = workshopTab === 'pending' ? pluginsWithPending : pluginsReviewed;

                  return (
                    <>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '2px solid #e0e0e0' }}>
                        <button
                          onClick={() => setWorkshopTab('pending')}
                          style={{
                            background: 'transparent', border: 'none', padding: '12px 20px', cursor: 'pointer',
                            fontWeight: '700', fontSize: '14px', position: 'relative',
                            color: workshopTab === 'pending' ? '#000' : '#888',
                            borderBottom: workshopTab === 'pending' ? '3px solid #D4AF37' : '3px solid transparent',
                            marginBottom: '-2px'
                          }}
                        >
                          Pendientes
                          {pluginsWithPending.length > 0 && (
                            <span style={{ marginLeft: '8px', background: '#dc3545', color: '#fff', borderRadius: '10px', padding: '2px 8px', fontSize: '11px' }}>
                              {pluginsWithPending.length}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => setWorkshopTab('reviewed')}
                          style={{
                            background: 'transparent', border: 'none', padding: '12px 20px', cursor: 'pointer',
                            fontWeight: '700', fontSize: '14px',
                            color: workshopTab === 'reviewed' ? '#000' : '#888',
                            borderBottom: workshopTab === 'reviewed' ? '3px solid #D4AF37' : '3px solid transparent',
                            marginBottom: '-2px'
                          }}
                        >
                          Revisados
                          <span style={{ marginLeft: '8px', background: '#e0e0e0', color: '#666', borderRadius: '10px', padding: '2px 8px', fontSize: '11px' }}>
                            {pluginsReviewed.length}
                          </span>
                        </button>
                      </div>

                      {visiblePlugins.length === 0 ? (
                        <div className="empty-state">
                          <FontAwesomeIcon icon={faPuzzlePiece} className="empty-state-icon" />
                          <div>{workshopTab === 'pending' ? 'No hay plugins pendientes' : 'No hay plugins revisados'}</div>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                          {visiblePlugins.map(plugin => {
                            const pendingCount = (plugin.versions || []).filter(v => v.status === 'pending').length;
                            const latestVersion = (plugin.versions || [])[0];
                            return (
                              <div key={plugin.plugin_id} style={{
                                background: '#fff', border: '2px solid', borderRadius: '12px', padding: '14px',
                                borderColor: pendingCount > 0 ? '#ffc107' : (plugin.status === 'approved' ? '#28a745' : '#dc3545')
                              }}>
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                  {plugin.logo ? (
                                    <img src={API + plugin.logo} alt="" style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' }} />
                                  ) : (
                                    <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#ccc' }}>
                                      <FontAwesomeIcon icon={faPuzzlePiece} />
                                    </div>
                                  )}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: '700', fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plugin.name}</div>
                                    <div style={{ fontSize: '11px', color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plugin.plugin_id}</div>
                                    <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                                      <FontAwesomeIcon icon={faUsers} style={{ fontSize: '10px' }} /> {plugin.author}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                                  <div>
                                    <FontAwesomeIcon icon={faPuzzlePiece} /> {(plugin.versions || []).length} versiones
                                    {pendingCount > 0 && <span style={{ marginLeft: '6px', color: '#856404', fontWeight: '700' }}>({pendingCount} pendiente{pendingCount > 1 ? 's' : ''})</span>}
                                  </div>
                                  <div>
                                    <FontAwesomeIcon icon={faDownload} /> {plugin.downloads || 0}
                                  </div>
                                </div>

                                {latestVersion && (
                                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px', padding: '8px', background: '#fafafa', borderRadius: '6px' }}>
                                    Última: <strong>v{latestVersion.version}</strong>
                                    <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700',
                                      background: latestVersion.status === 'pending' ? '#fff3cd' : latestVersion.status === 'approved' ? '#d4edda' : '#f8d7da',
                                      color: latestVersion.status === 'pending' ? '#856404' : latestVersion.status === 'approved' ? '#155724' : '#721c24'
                                    }}>
                                      {latestVersion.status === 'pending' ? 'Pendiente' : latestVersion.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                                    </span>
                                  </div>
                                )}

                                <button
                                  onClick={() => setSelectedWorkshopPlugin(plugin)}
                                  className="btn btn-primary"
                                  style={{ width: '100%', padding: '8px', fontSize: '13px', borderRadius: '8px' }}
                                >
                                  <FontAwesomeIcon icon={faEye} /> Ver detalles
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : activeTab === 'admins' ? (
              <div>
                <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
                  <h3 style={{ margin: '0 0 12px' }}>Crear Superadmin</h3>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input type="text" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} placeholder="Nombre" style={{ flex: 1, padding: '8px', border: '2px solid #e0e0e0', borderRadius: '8px', minWidth: '120px' }} />
                    <input type="email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="Email" style={{ flex: 1, padding: '8px', border: '2px solid #e0e0e0', borderRadius: '8px', minWidth: '150px' }} />
                    <input type="password" value={newAdminPass} onChange={(e) => setNewAdminPass(e.target.value)} placeholder="Contraseña" style={{ flex: 1, padding: '8px', border: '2px solid #e0e0e0', borderRadius: '8px', minWidth: '120px' }} />
                    <button onClick={async () => {
                      if (!newAdminEmail || !newAdminPass) return alert('Email y contraseña requeridos');
                      const tk = localStorage.getItem('superadminToken');
                      const res = await fetch(API + '/api/superadmin/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk }, body: JSON.stringify({ email: newAdminEmail, password: newAdminPass, username: newAdminName }) });
                      if (res.ok) { setNewAdminEmail(''); setNewAdminPass(''); setNewAdminName(''); fetchData(); }
                      else { const d = await res.json(); alert(d.error || 'Error'); }
                    }} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                      <FontAwesomeIcon icon={faShieldAlt} /> Crear
                    </button>
                  </div>
                </div>
                <div className="admin-table-wrapper">
                  <table className="table">
                    <thead><tr><th>ID</th><th>Nombre</th><th>Email</th><th>Creado</th><th></th></tr></thead>
                    <tbody>
                      {superadmins.map(sa => (
                        <tr key={sa.id}>
                          <td>{sa.id}</td>
                          <td style={{ fontWeight: '600' }}>{sa.username || '-'}</td>
                          <td>{sa.email}</td>
                          <td>{new Date(sa.created_at).toLocaleDateString()}</td>
                          <td>
                            <button onClick={async () => {
                              if (!confirm(`Eliminar superadmin ${sa.email}?`)) return;
                              const tk = localStorage.getItem('superadminToken');
                              const res = await fetch(API + `/api/superadmin/account/${sa.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tk } });
                              if (res.ok) fetchData();
                              else { const d = await res.json(); alert(d.error); }
                            }} className="btn btn-sm btn-danger"><FontAwesomeIcon icon={faTrash} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === 'tickets' ? (
              <>
              <style>{`
                .sa-ticket-layout {
                  display: flex;
                  gap: 12px;
                  height: calc(100vh - 220px);
                  min-height: 400px;
                  overflow: hidden;
                  width: 100%;
                  box-sizing: border-box;
                }
                .sa-ticket-list {
                  width: 260px;
                  min-width: 200px;
                  flex-shrink: 0;
                  min-height: 0;
                  overflow-y: auto;
                  overflow-x: hidden;
                }
                .sa-ticket-chat {
                  flex: 1;
                  min-width: 0;
                  display: flex;
                  flex-direction: column;
                  background: #fff;
                  border-radius: 12px;
                  border: 1px solid #e0e0e0;
                  overflow: hidden;
                }
                .sa-ticket-back { display: none; }
                .sa-ticket-input-row {
                  display: flex;
                  gap: 8px;
                  align-items: center;
                  padding: 10px 12px;
                  border-top: 1px solid #e0e0e0;
                  flex-wrap: nowrap;
                }
                .sa-ticket-input-row input[type="text"] {
                  flex: 1;
                  min-width: 0;
                  padding: 10px;
                  border: 2px solid #e0e0e0;
                  border-radius: 10px;
                  outline: none;
                  font-size: 14px;
                }
                /* Tablet: sidebar visible (≥769px) + pantalla estrecha */
                @media (max-width: 1100px) and (min-width: 769px) {
                  .sa-ticket-list { width: 210px; min-width: 160px; }
                }
                /* Mobile: mostrar solo uno a la vez */
                @media (max-width: 768px) {
                  .sa-ticket-layout {
                    height: calc(100vh - 130px);
                    gap: 0;
                  }
                  .sa-ticket-list {
                    ${saMobileChat ? 'display: none !important;' : 'width: 100% !important; min-width: 0 !important;'}
                  }
                  .sa-ticket-chat {
                    ${saMobileChat ? 'display: flex !important; width: 100% !important;' : 'display: none !important;'}
                  }
                  .sa-ticket-back { display: inline-flex !important; }
                  .sa-ticket-input-row label { font-size: 10px; }
                }
              `}</style>

              <div className="sa-ticket-layout">
                {/* ── Lista de tickets ── */}
                <div className="sa-ticket-list">
                  {tickets.map(t => {
                    const prColors = { low: '#95a5a6', normal: '#3498db', important: '#f39c12', urgent: '#e74c3c' };
                    const prLabels = { low: 'Leve', normal: 'Normal', important: 'Importante', urgent: 'Urgente' };
                    return (
                      <div
                        key={t.id}
                        onClick={async () => {
                          setSelectedTicketId(t.id);
                          setSaMobileChat(true);
                          const token = localStorage.getItem('superadminToken');
                          const res = await fetch(API + `/api/superadmin/tickets/${t.id}/messages`, { headers: { Authorization: 'Bearer ' + token } });
                          if (res.ok) {
                            const d = await res.json();
                            setTicketDetail(d.ticket);
                            setTicketMessages(d.messages);
                            setTimeout(scrollChatToBottom, 80);
                          }
                        }}
                        style={{
                          padding: '10px 12px', borderRadius: '10px', marginBottom: '6px', cursor: 'pointer',
                          border: selectedTicketId === t.id ? '2px solid #333' : '2px solid transparent',
                          background: selectedTicketId === t.id ? '#f0f4ff' : '#fafafa'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '6px' }}>
                          <span style={{ fontWeight: '700', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>#{t.id} {t.username}</span>
                          <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '10px', fontWeight: '700', flexShrink: 0, background: (prColors[t.priority] || '#3498db') + '22', color: prColors[t.priority] || '#3498db' }}>
                            {prLabels[t.priority] || t.priority}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', marginTop: '4px', gap: '4px' }}>
                          <span style={{ color: t.status === 'open' ? '#2ecc71' : t.status === 'resolved' ? '#9b59b6' : '#95a5a6', flexShrink: 0 }}>
                            <FontAwesomeIcon icon={faCircle} style={{ fontSize: '6px', marginRight: '3px' }} />
                            {t.status === 'open' ? 'Abierto' : t.status === 'resolved' ? 'Resuelto' : 'Cerrado'}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.business_name || t.email}</span>
                        </div>
                      </div>
                    );
                  })}
                  {tickets.length === 0 && <p style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>Sin tickets</p>}
                </div>

                {/* ── Panel de chat ── */}
                <div className="sa-ticket-chat">
                  {!selectedTicketId ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', flexDirection: 'column', gap: '12px' }}>
                      <FontAwesomeIcon icon={faTicketAlt} style={{ fontSize: '48px' }} />
                      <span style={{ fontSize: '14px' }}>Selecciona un ticket</span>
                    </div>
                  ) : (
                    <>
                      {/* Header del chat */}
                      <div style={{ padding: '10px 14px', borderBottom: '1px solid #e0e0e0', background: '#fafafa', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <button
                          className="sa-ticket-back"
                          onClick={() => { setSaMobileChat(false); setSelectedTicketId(null); }}
                          style={{ background: '#eee', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', flexShrink: 0 }}
                        >
                          <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '700', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            #{ticketDetail?.id} - {ticketDetail?.subject}
                          </div>
                          <div style={{ fontSize: '11px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ticketDetail?.username} ({ticketDetail?.email}) | PIN: {ticketDetail?.support_pin}
                          </div>
                        </div>
                        {ticketDetail?.status !== 'resolved' && (
                          <button
                            onClick={async () => {
                              const token = localStorage.getItem('superadminToken');
                              await fetch(API + `/api/superadmin/tickets/${selectedTicketId}/resolve`, { method: 'PUT', headers: { Authorization: 'Bearer ' + token } });
                              fetchData();
                              const res = await fetch(API + `/api/superadmin/tickets/${selectedTicketId}/messages`, { headers: { Authorization: 'Bearer ' + token } });
                              if (res.ok) { const d = await res.json(); setTicketDetail(d.ticket); }
                            }}
                            className="btn btn-sm"
                            style={{ background: '#9b59b6', color: '#fff', border: 'none', whiteSpace: 'nowrap', flexShrink: 0, fontSize: '12px' }}
                          >
                            <FontAwesomeIcon icon={faCheck} /> Resolver
                          </button>
                        )}
                      </div>

                      {/* Mensajes */}
                      <div ref={saMsgContainerRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {ticketMessages.map(m => (
                          <div
                            key={m.id}
                            style={{
                              alignSelf: m.sender_type === 'admin' ? 'flex-end' : 'flex-start',
                              maxWidth: '78%',
                              display: 'flex',
                              gap: '6px',
                              flexDirection: m.sender_type === 'admin' ? 'row-reverse' : 'row'
                            }}
                          >
                            {m.sender_avatar && (
                              <div style={{ flexShrink: 0, marginTop: '2px' }}>
                                <img src={API + m.sender_avatar} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }} />
                              </div>
                            )}
                            {!m.sender_avatar && m.sender_type === 'admin' && (
                              <div style={{ flexShrink: 0, marginTop: '2px', width: '26px', height: '26px', borderRadius: '50%', background: m.sender_name === 'SRServi Bot' ? '#e8f5e9' : '#f3e5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: m.sender_name === 'SRServi Bot' ? '#4caf50' : '#9b59b6' }}>
                                <FontAwesomeIcon icon={faShieldAlt} />
                              </div>
                            )}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{
                                padding: '9px 13px',
                                borderRadius: m.sender_type === 'admin' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                background: m.sender_type === 'admin' ? '#333' : m.sender_name === 'SRServi Bot' ? '#e8f5e9' : '#f0f0f0',
                                color: m.sender_type === 'admin' ? '#fff' : '#333',
                                fontSize: '13px',
                                wordBreak: 'break-word'
                              }}>
                                {m.message}
                                {m.image && (
                                  <div style={{ marginTop: '6px' }}>
                                    <img src={API + m.image} alt="" style={{ maxWidth: '100%', borderRadius: '8px' }} />
                                    {m.image_admin_only && <span style={{ fontSize: '10px', color: '#ff6b6b' }}> (solo admin)</span>}
                                  </div>
                                )}
                              </div>
                              <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px', textAlign: m.sender_type === 'admin' ? 'right' : 'left' }}>
                                {m.sender_name} · {new Date(m.created_at).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div ref={saMsgEndRef} />
                      </div>

                      {/* Input de respuesta */}
                      {ticketDetail?.status !== 'resolved' && (
                        <div className="sa-ticket-input-row">
                          <label style={{ cursor: 'pointer', color: ticketImg ? '#D4AF37' : '#888', fontSize: '18px', flexShrink: 0 }}>
                            <FontAwesomeIcon icon={faImage} />
                            <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) setTicketImg(e.target.files[0]); }} style={{ display: 'none' }} />
                          </label>
                          <label style={{ fontSize: '11px', color: ticketAdminOnly ? '#e74c3c' : '#aaa', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            <input type="checkbox" checked={ticketAdminOnly} onChange={(e) => setTicketAdminOnly(e.target.checked)} style={{ marginRight: '3px' }} />
                            Solo admin
                          </label>
                          <input
                            type="text"
                            value={ticketMsg}
                            onChange={(e) => setTicketMsg(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (ticketMsg.trim() || ticketImg)) {
                                const token = localStorage.getItem('superadminToken');
                                const fd = new FormData();
                                fd.append('message', ticketMsg.trim());
                                if (ticketImg) fd.append('image', ticketImg);
                                fd.append('admin_only', ticketAdminOnly ? 'true' : 'false');
                                setTicketSending(true);
                                fetch(API + `/api/superadmin/tickets/${selectedTicketId}/messages`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd })
                                  .then(() => fetch(API + `/api/superadmin/tickets/${selectedTicketId}/messages`, { headers: { Authorization: 'Bearer ' + token } }))
                                  .then(r => r.json())
                                  .then(d => { setTicketMessages(d.messages); setTicketMsg(''); setTicketImg(null); setTicketAdminOnly(false); setTimeout(scrollChatToBottom, 80); })
                                  .finally(() => setTicketSending(false));
                              }
                            }}
                            placeholder="Responder..."
                          />
                          <button
                            disabled={ticketSending || (!ticketMsg.trim() && !ticketImg)}
                            onClick={() => {
                              const token = localStorage.getItem('superadminToken');
                              const fd = new FormData();
                              fd.append('message', ticketMsg.trim());
                              if (ticketImg) fd.append('image', ticketImg);
                              fd.append('admin_only', ticketAdminOnly ? 'true' : 'false');
                              setTicketSending(true);
                              fetch(API + `/api/superadmin/tickets/${selectedTicketId}/messages`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd })
                                .then(() => fetch(API + `/api/superadmin/tickets/${selectedTicketId}/messages`, { headers: { Authorization: 'Bearer ' + token } }))
                                .then(r => r.json())
                                .then(d => { setTicketMessages(d.messages); setTicketMsg(''); setTicketImg(null); setTicketAdminOnly(false); setTimeout(scrollChatToBottom, 80); })
                                .finally(() => setTicketSending(false));
                            }}
                            style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 14px', cursor: 'pointer', flexShrink: 0 }}
                          >
                            <FontAwesomeIcon icon={faPaperPlane} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              </>
            ) : activeTab === 'apks' ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                  <button className="btn btn-primary" onClick={() => { setApkForm({ name: '', description: '', version: '' }); setApkFile(null); setApkLogo(null); setShowApkModal(true); }}>
                    <FontAwesomeIcon icon={faPlus} /> Nueva Versión
                  </button>
                </div>
                {apkReleases.length === 0 ? (
                  <div className="empty-state">
                    <FontAwesomeIcon icon={faMobileAlt} className="empty-state-icon" />
                    <div>No hay versiones de APK</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                    {apkReleases.map((apk, idx) => (
                      <div key={apk.id} style={{
                        background: '#fff', border: '2px solid #e0e0e0', borderRadius: '12px', padding: '16px',
                        borderColor: idx === 0 ? '#22c55e' : '#e0e0e0'
                      }}>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                          {apk.logo ? (
                            <img src={API + apk.logo} alt="" style={{ width: '50px', height: '50px', borderRadius: '10px', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '50px', height: '50px', borderRadius: '10px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#ccc' }}>
                              <FontAwesomeIcon icon={faMobileAlt} />
                            </div>
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '700', fontSize: '16px' }}>{apk.name}</div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', background: idx === 0 ? '#dcfce7' : '#f0f0f0', color: idx === 0 ? '#166534' : '#666' }}>
                                v{apk.version}
                              </span>
                              <span style={{ fontSize: '12px', color: '#999' }}>Code: {apk.version_code}</span>
                              {idx === 0 && <span style={{ fontSize: '10px', fontWeight: '700', color: '#22c55e' }}>ÚLTIMA</span>}
                            </div>
                          </div>
                        </div>
                        {apk.description && <p style={{ fontSize: '14px', color: '#555', margin: '0 0 10px' }}>{apk.description}</p>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#999' }}>
                          <span>{new Date(apk.created_at).toLocaleDateString('es-ES')}</span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <a href={API + apk.apk_url} download style={{ padding: '4px 10px', borderRadius: '6px', background: '#333', color: '#fff', textDecoration: 'none', fontSize: '11px', fontWeight: '600' }}>
                              <FontAwesomeIcon icon={faDownload} /> APK
                            </a>
                            <button onClick={() => handleDeleteApk(apk.id)} className="btn btn-sm btn-danger" style={{ padding: '4px 8px', fontSize: '11px' }}>
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === 'orders' ? (
              <div>
                {/* Filtros */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18, alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                    <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Tienda</label>
                    <select value={saOrderFilter.store_id} onChange={e => setSaOrderFilter(p => ({ ...p, store_id: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}>
                      <option value="">Todas</option>
                      {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: '1 1 130px', minWidth: 120 }}>
                    <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Desde</label>
                    <input type="date" value={saOrderFilter.date_from} onChange={e => setSaOrderFilter(p => ({ ...p, date_from: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: '1 1 130px', minWidth: 120 }}>
                    <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Hasta</label>
                    <input type="date" value={saOrderFilter.date_to} onChange={e => setSaOrderFilter(p => ({ ...p, date_to: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: '1 1 130px', minWidth: 120 }}>
                    <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Estado</label>
                    <select value={saOrderFilter.status} onChange={e => setSaOrderFilter(p => ({ ...p, status: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}>
                      <option value="">Todos</option>
                      <option value="pending">Pendiente</option>
                      <option value="completed">Completado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                  <button onClick={() => fetchSaOrders()} className="btn btn-primary" style={{ height: 36, padding: '0 18px', fontSize: 13 }}>
                    <FontAwesomeIcon icon={faFilter} /> Filtrar
                  </button>
                  <button onClick={() => { const empty = { store_id: '', date_from: '', date_to: '', status: '' }; setSaOrderFilter(empty); fetchSaOrders(empty); }} className="btn btn-secondary" style={{ height: 36, padding: '0 14px', fontSize: 13 }}>
                    <FontAwesomeIcon icon={faSync} />
                  </button>
                </div>

                <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
                  {saOrdersLoading ? 'Cargando...' : `${saOrders.length} pedidos mostrados de ${saOrdersTotal} total`}
                </div>

                {/* Tabla */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                        {['#', 'Tienda', 'Total', 'Pago', 'Estado', 'Tipo', 'Hora', 'Acciones'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {saOrdersLoading ? (
                        <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#888' }}>Cargando pedidos...</td></tr>
                      ) : saOrders.length === 0 ? (
                        <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#888' }}>No hay pedidos</td></tr>
                      ) : saOrders.map(o => (
                        <tr key={o.id} style={{ borderBottom: '1px solid #eee', background: saOrderDetail?.id === o.id ? '#fffbe6' : 'white' }}>
                          <td style={{ padding: '9px 12px', fontWeight: 700 }}>{o.order_number || o.id}</td>
                          <td style={{ padding: '9px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.store_name || `#${o.store_id}`}{o.store_code ? ` [${o.store_code}]` : ''}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 700, color: '#22c55e' }}>${parseFloat(o.total).toLocaleString()}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                              background: o.payment_method === 'cash' ? '#fef3c7' : o.payment_method === 'card' ? '#dbeafe' : '#f3e8ff',
                              color: o.payment_method === 'cash' ? '#92400e' : o.payment_method === 'card' ? '#1e40af' : '#7e22ce' }}>
                              {o.payment_method === 'cash' ? 'Efectivo' : o.payment_method === 'card' ? 'Tarjeta' : o.payment_method || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                              background: o.status === 'completed' ? '#dcfce7' : o.status === 'cancelled' ? '#fee2e2' : '#fef9c3',
                              color: o.status === 'completed' ? '#166534' : o.status === 'cancelled' ? '#991b1b' : '#854d0e' }}>
                              {o.status === 'completed' ? 'Completado' : o.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                            </span>
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: '#555' }}>
                            {o.table_number != null ? `Mesa ${o.table_number}` : o.order_type === 'delivery' ? 'Delivery' : 'Llevar'}
                          </td>
                          <td style={{ padding: '9px 12px', fontSize: 12, color: '#555', whiteSpace: 'nowrap' }}>
                            {new Date(o.created_at).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button title="Ver detalle" onClick={() => openSaOrderDetail(o)}
                                style={{ background: '#3b82f6', border: 'none', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: '#fff', fontSize: 12 }}>
                                <FontAwesomeIcon icon={faInfoCircle} />
                              </button>
                              {o.status !== 'completed' && (
                                <button title="Marcar pagado" onClick={() => saMarkPaid(o.id)}
                                  style={{ background: '#22c55e', border: 'none', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: '#fff', fontSize: 12 }}>
                                  <FontAwesomeIcon icon={faMoneyBillWave} />
                                </button>
                              )}
                              <button title="Eliminar" onClick={() => setSaDeleteConfirm(o)}
                                style={{ background: '#ef4444', border: 'none', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: '#fff', fontSize: 12 }}>
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Modal detalle pedido */}
      {saOrderDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
          onClick={() => setSaOrderDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Pedido #{saOrderDetail.order_number || saOrderDetail.id}</h3>
              <button onClick={() => setSaOrderDetail(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 18, fontSize: 13 }}>
              <div><span style={{ color: '#888' }}>Tienda:</span> <strong>{saOrderDetail.store_name || `#${saOrderDetail.store_id}`}{saOrderDetail.store_code ? ` [${saOrderDetail.store_code}]` : ''}</strong></div>
              <div><span style={{ color: '#888' }}>Fecha:</span> <strong>{new Date(saOrderDetail.created_at).toLocaleString('es')}</strong></div>
              <div><span style={{ color: '#888' }}>Total:</span> <strong style={{ color: '#22c55e' }}>${parseFloat(saOrderDetail.total).toLocaleString()}</strong></div>
              <div><span style={{ color: '#888' }}>Método pago:</span> <strong>{saOrderDetail.payment_method === 'cash' ? 'Efectivo' : saOrderDetail.payment_method === 'card' ? 'Tarjeta' : saOrderDetail.payment_method}</strong></div>
              <div><span style={{ color: '#888' }}>Estado:</span> <strong>{saOrderDetail.status === 'completed' ? 'Completado' : saOrderDetail.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}</strong></div>
              <div><span style={{ color: '#888' }}>Efectivo aprobado:</span> <strong>{saOrderDetail.cash_approved ? 'Sí' : 'No'}</strong></div>
              <div><span style={{ color: '#888' }}>Tipo:</span> <strong>{saOrderDetail.table_number != null ? `Mesa ${saOrderDetail.table_number}` : saOrderDetail.order_type === 'delivery' ? 'Delivery' : 'Para llevar'}</strong></div>
              {saOrderDetail.coupon_code && <div><span style={{ color: '#888' }}>Cupón:</span> <strong>{saOrderDetail.coupon_code}</strong></div>}
              {saOrderDetail.completed_by_name && <div><span style={{ color: '#888' }}>Atendido por:</span> <strong>{saOrderDetail.completed_by_name}</strong></div>}
            </div>
            <div style={{ borderTop: '1px solid #eee', paddingTop: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>Productos</div>
              {saOrderItems.length === 0 ? (
                <div style={{ color: '#888', fontSize: 13 }}>Cargando...</div>
              ) : saOrderItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{item.quantity}× {item.product_name}</span>
                    {item.selected_extras?.length > 0 && <div style={{ fontSize: 11, color: '#888' }}>+ {item.selected_extras.map(e => e.name).join(', ')}</div>}
                  </div>
                  <span style={{ fontWeight: 700 }}>${parseFloat(item.total || item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              {saOrderDetail.status !== 'completed' && (
                <button onClick={() => saMarkPaid(saOrderDetail.id)} style={{ flex: 1, background: '#22c55e', border: 'none', borderRadius: 8, padding: '10px 0', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 13 }}>
                  <FontAwesomeIcon icon={faMoneyBillWave} style={{ marginRight: 6 }} />Marcar como pagado
                </button>
              )}
              <button onClick={() => setSaDeleteConfirm(saOrderDetail)} style={{ flex: 1, background: '#ef4444', border: 'none', borderRadius: 8, padding: '10px 0', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 13 }}>
                <FontAwesomeIcon icon={faTrash} style={{ marginRight: 6 }} />Eliminar pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminar */}
      {saDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}
          onClick={() => setSaDeleteConfirm(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 380, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>¿Eliminar pedido?</div>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>Pedido #{saDeleteConfirm.order_number || saDeleteConfirm.id} — ${parseFloat(saDeleteConfirm.total).toLocaleString()}<br />Esta acción no se puede deshacer.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSaDeleteConfirm(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => saDeleteOrder(saDeleteConfirm.id)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {showSubscriptionModal && selectedSubscription && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2 className="modal-title">Historial de Suscripciones</h2>
              <button
                className="modal-close"
                onClick={() => setShowSubscriptionModal(false)}
              >
                x
              </button>
            </div>

            <div className="subscription-user-info">
              <div className="font-bold">{selectedSubscription.username}</div>
              <div className="text-sm text-muted">{selectedSubscription.email}</div>
              {selectedSubscription.business_name && <div className="text-sm text-muted">{selectedSubscription.business_name}</div>}
              <div className="text-sm text-muted subscription-since">Usuario desde: {new Date(selectedSubscription.user_created_at).toLocaleDateString('es-ES')}</div>
            </div>

            {selectedSubscription.subscriptions.length > 0 ? (
              <div>
                <h3 className="font-bold subscription-history-title">Historial de Planes</h3>
                {selectedSubscription.subscriptions.map((sub, index) => (
                  <div key={sub.id} className={`subscription-card ${sub.is_active ? 'active' : ''}`}>
                    <div className="flex justify-between items-center subscription-card-header">
                      <div>
                        <span className={`badge ${sub.plan_name === 'Gratis' ? 'badge-gray' : 'badge-gold'}`}>
                          {sub.plan_name}
                        </span>
                        {sub.is_active && new Date(sub.ends_at) > new Date() && (
                          <span className="badge badge-success subscription-status-badge">Activo</span>
                        )}
                        {sub.is_active === false && (
                          <span className="badge badge-danger subscription-status-badge">Cancelado</span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold">
                          {sub.billing_cycle === 'monthly' ? `$${sub.price_monthly}/mes` : sub.billing_cycle === 'yearly' ? `$${sub.price_yearly}/ano` : 'Gratis'}
                        </div>
                        <div className="text-sm text-muted">{sub.billing_cycle === 'monthly' ? 'Mensual' : sub.billing_cycle === 'yearly' ? 'Anual' : '-'}</div>
                      </div>
                    </div>
                    <div className="subscription-card-details">
                      <div><strong>Inicio:</strong> {sub.starts_at ? new Date(sub.starts_at).toLocaleDateString('es-ES') : '-'}</div>
                      <div><strong>Vencimiento:</strong> {sub.ends_at ? new Date(sub.ends_at).toLocaleDateString('es-ES') : '-'}</div>
                      <div><strong>Suscrito:</strong> {sub.subscribed_at ? new Date(sub.subscribed_at).toLocaleDateString('es-ES') : '-'}</div>
                      <div><strong>ID:</strong> {sub.id}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <FontAwesomeIcon icon={faCreditCard} className="empty-state-icon" />
                <div>Este usuario no tiene suscripciones premium</div>
                <div className="text-sm">Plan actual: <strong>{selectedSubscription.current_plan || 'Gratis'}</strong></div>
              </div>
            )}
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Editar Usuario</h3>
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Nueva Contrasena</label>
              <input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="Dejar vacio para no cambiar"
              />
            </div>

            <div className="form-group form-group-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={editForm.is_banned}
                  onChange={(e) => setEditForm({ ...editForm, is_banned: e.target.checked })}
                />
                Usuario baneado
              </label>
            </div>

            <div className="flex gap-3 justify-end modal-actions">
              <button
                className="btn btn-secondary flex-1"
                onClick={() => setShowEditModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary flex-1"
                onClick={handleSaveUser}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header delete-header">
              <FontAwesomeIcon icon={faExclamationTriangle} className="delete-icon" />
              <h3 className="modal-title">Confirmar Eliminacion</h3>
            </div>

            <p className="delete-message text-muted">
              Estas seguro de eliminar {showDeleteConfirm.type === 'user' ? 'al usuario' : 'la tienda'}{' '}
              <strong>"{showDeleteConfirm.name}"</strong>?
              <br /><br />
              Esta accion no se puede deshacer y se eliminaran todos los datos asociados.
            </p>

            <div className="flex gap-3 justify-end modal-actions">
              <button
                className="btn btn-secondary flex-1"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-danger flex-1"
                onClick={() => {
                  if (showDeleteConfirm.type === 'user') {
                    handleDeleteUser(showDeleteConfirm.id);
                  } else {
                    handleDeleteStore(showDeleteConfirm.id);
                  }
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      {showProfileModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowProfileModal(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '360px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', textAlign: 'center' }}>Mi Perfil</h3>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <label style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }}>
                {profileAvatar ? (
                  <img src={URL.createObjectURL(profileAvatar)} alt="" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #333' }} />
                ) : myProfile?.avatar ? (
                  <img src={API + myProfile.avatar} alt="" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #333' }} />
                ) : (
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: '#bbb', border: '3px solid #333' }}>
                    <FontAwesomeIcon icon={faShieldAlt} />
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 0, right: 0, background: '#333', color: '#fff', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                  <FontAwesomeIcon icon={faEdit} />
                </div>
                <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) setProfileAvatar(e.target.files[0]); }} style={{ display: 'none' }} />
              </label>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px', display: 'block' }}>Nombre</label>
              <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Tu nombre" style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', boxSizing: 'border-box', fontSize: '14px' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowProfileModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid #e0e0e0', background: '#fff', fontSize: '14px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={async () => {
                const tk = localStorage.getItem('superadminToken');
                const fd = new FormData();
                if (profileName) fd.append('username', profileName);
                if (profileAvatar) fd.append('avatar', profileAvatar);
                const res = await fetch(API + '/api/superadmin/profile', { method: 'PUT', headers: { Authorization: 'Bearer ' + tk }, body: fd });
                if (res.ok) {
                  const data = await res.json();
                  setMyProfile(data);
                  setShowProfileModal(false);
                }
              }} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#333', color: '#fff', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
      {showPremiumModal && premiumTarget && (
        <div className="modal-overlay" onClick={() => setShowPremiumModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Asignar Premium</h3>
              <button className="modal-close" onClick={() => setShowPremiumModal(false)}>&times;</button>
            </div>

            <div style={{ marginBottom: '12px', padding: '10px', background: '#f9f9f9', borderRadius: '8px' }}>
              <div style={{ fontWeight: '700' }}>{premiumTarget.username}</div>
              <div style={{ fontSize: '13px', color: '#888' }}>{premiumTarget.email}</div>
              <div style={{ fontSize: '12px', color: '#aaa' }}>Plan actual: {premiumTarget.current_plan || 'Gratis'}</div>
            </div>

            <div className="form-group">
              <label>Plan</label>
              <select
                value={premiumPlanId}
                onChange={(e) => setPremiumPlanId(parseInt(e.target.value))}
                style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px' }}
              >
                {premiumPlans.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px' }}>
                <input
                  type="radio"
                  checked={premiumForever}
                  onChange={() => setPremiumForever(true)}
                />
                <span style={{ fontWeight: '600' }}>Para siempre</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={!premiumForever}
                  onChange={() => setPremiumForever(false)}
                />
                <span style={{ fontWeight: '600' }}>Hasta una fecha</span>
              </label>
            </div>

            {!premiumForever && (
              <div className="form-group">
                <label>Fecha de vencimiento</label>
                <input
                  type="date"
                  value={premiumDate}
                  onChange={(e) => setPremiumDate(e.target.value)}
                  style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px' }}
                />
              </div>
            )}

            <div className="flex gap-3 justify-end modal-actions">
              <button className="btn btn-secondary flex-1" onClick={() => setShowPremiumModal(false)}>
                Cancelar
              </button>
              <button
                className="btn flex-1"
                style={{ background: '#D4AF37', color: '#fff', border: 'none' }}
                onClick={handleAssignPremium}
                disabled={!premiumForever && !premiumDate}
              >
                Asignar Premium
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedWorkshopPlugin && (
        <div className="modal-overlay" onClick={() => setSelectedWorkshopPlugin(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Detalles del Plugin</h2>
              <button className="modal-close" onClick={() => setSelectedWorkshopPlugin(null)}>&times;</button>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', padding: '16px', background: '#fafafa', borderRadius: '12px' }}>
              {selectedWorkshopPlugin.logo ? (
                <img src={API + selectedWorkshopPlugin.logo} alt="" style={{ width: '70px', height: '70px', borderRadius: '12px', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '70px', height: '70px', borderRadius: '12px', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: '#999' }}>
                  <FontAwesomeIcon icon={faPuzzlePiece} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: '20px' }}>{selectedWorkshopPlugin.name}</h3>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '6px' }}>{selectedWorkshopPlugin.plugin_id}</div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  <FontAwesomeIcon icon={faUsers} /> {selectedWorkshopPlugin.author}
                  <span style={{ marginLeft: '12px' }}>
                    <FontAwesomeIcon icon={faEnvelope} /> {selectedWorkshopPlugin.contact_email}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                  <FontAwesomeIcon icon={faDownload} /> {selectedWorkshopPlugin.downloads || 0} descargas totales
                </div>
              </div>
            </div>

            {selectedWorkshopPlugin.description && (
              <div style={{ marginBottom: '20px', padding: '14px', background: '#fff8e1', borderLeft: '4px solid #D4AF37', borderRadius: '6px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#555', lineHeight: '1.6' }}>{selectedWorkshopPlugin.description}</p>
              </div>
            )}

            <h4 style={{ margin: '0 0 12px', fontSize: '15px' }}>Versiones ({(selectedWorkshopPlugin.versions || []).length})</h4>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {(selectedWorkshopPlugin.versions || []).map(v => {
                const sc = { pending: { bg: '#fff3cd', c: '#856404', border: '#ffc107' }, approved: { bg: '#d4edda', c: '#155724', border: '#28a745' }, rejected: { bg: '#f8d7da', c: '#721c24', border: '#dc3545' } }[v.status] || { bg: '#fff3cd', c: '#856404', border: '#ffc107' };
                return (
                  <div key={v.version} style={{
                    padding: '14px', marginBottom: '10px', borderRadius: '10px',
                    background: '#fff', border: '2px solid', borderColor: sc.border
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: '700' }}>v{v.version}</div>
                        <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                          <FontAwesomeIcon icon={faClock} /> {new Date(v.created_at).toLocaleString('es-ES')}
                        </div>
                      </div>
                      <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', background: sc.bg, color: sc.c }}>
                        {v.status === 'pending' ? 'Pendiente' : v.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                      </span>
                    </div>

                    {v.changelog && (
                      <div style={{ marginBottom: '10px', padding: '10px', background: '#fafafa', borderRadius: '6px', fontSize: '13px', color: '#555' }}>
                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px', fontWeight: '700' }}>CAMBIOS:</div>
                        {v.changelog}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {v.zip_path && (
                        <a
                          href={API + v.zip_path}
                          download
                          style={{
                            padding: '8px 14px', background: '#000', color: '#fff', textDecoration: 'none',
                            borderRadius: '8px', fontSize: '12px', fontWeight: '700',
                            display: 'inline-flex', alignItems: 'center', gap: '6px'
                          }}
                        >
                          <FontAwesomeIcon icon={faDownload} /> Descargar ZIP
                        </a>
                      )}
                      {v.status !== 'approved' && (
                        <button
                          onClick={async () => {
                            await handleWorkshopVersionStatus(selectedWorkshopPlugin.plugin_id, v.version, 'approved');
                            const updated = workshopPlugins.find(p => p.plugin_id === selectedWorkshopPlugin.plugin_id);
                            if (updated) setSelectedWorkshopPlugin(updated);
                          }}
                          style={{ padding: '8px 14px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          <FontAwesomeIcon icon={faCheck} /> Aprobar
                        </button>
                      )}
                      {v.status !== 'rejected' && (
                        <button
                          onClick={async () => {
                            await handleWorkshopVersionStatus(selectedWorkshopPlugin.plugin_id, v.version, 'rejected');
                            const updated = workshopPlugins.find(p => p.plugin_id === selectedWorkshopPlugin.plugin_id);
                            if (updated) setSelectedWorkshopPlugin(updated);
                          }}
                          style={{ padding: '8px 14px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          <FontAwesomeIcon icon={faTimes} /> Rechazar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showApkModal && (
        <div className="modal-overlay" onClick={() => setShowApkModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Subir Nueva Versión APK</h3>
              <button className="modal-close" onClick={() => setShowApkModal(false)}>&times;</button>
            </div>

            <div className="form-group">
              <label>Nombre de la App</label>
              <input type="text" value={apkForm.name} onChange={(e) => setApkForm({ ...apkForm, name: e.target.value })} placeholder="Ej: SRServi Totem" style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }} />
            </div>

            <div className="form-group">
              <label>Versión</label>
              <input type="text" value={apkForm.version} onChange={(e) => setApkForm({ ...apkForm, version: e.target.value })} placeholder="Ej: 1.0.0" style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }} />
            </div>

            <div className="form-group">
              <label>Descripción (cambios de esta versión)</label>
              <textarea value={apkForm.description} onChange={(e) => setApkForm({ ...apkForm, description: e.target.value })} rows="3" placeholder="Novedades de esta versión..." style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '16px', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div className="form-group">
              <label>Logo de la App</label>
              <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) setApkLogo(e.target.files[0]); }} style={{ width: '100%', padding: '10px', border: '2px dashed #e0e0e0', borderRadius: '8px', boxSizing: 'border-box' }} />
              {apkLogo && <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{apkLogo.name}</div>}
            </div>

            <div className="form-group">
              <label>Archivo APK *</label>
              <input type="file" accept=".apk,.aab" onChange={(e) => { if (e.target.files[0]) setApkFile(e.target.files[0]); }} style={{ width: '100%', padding: '10px', border: '2px dashed #e0e0e0', borderRadius: '8px', boxSizing: 'border-box' }} />
              {apkFile && <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{apkFile.name} ({(apkFile.size / 1024 / 1024).toFixed(1)} MB)</div>}
            </div>

            <div className="flex gap-3 justify-end modal-actions">
              <button className="btn btn-secondary flex-1" onClick={() => setShowApkModal(false)}>Cancelar</button>
              <button className="btn btn-primary flex-1" onClick={handleUploadApk} disabled={apkUploading || !apkForm.name || !apkForm.version || !apkFile}>
                {apkUploading ? 'Subiendo...' : 'Subir APK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SuperadminDashboard;
