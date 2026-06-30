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
  faUserSecret,
  faThLarge,
  faTv,
  faDesktop,
  faChair,
  faUserTie,
  faWifi,
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

function SuperadminDashboard() {
  const [activeTab, setActiveTab] = useState('users');
  const [presence, setPresence] = useState({ sessions: [] });
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
  const [sendingStats, setSendingStats] = useState(false);
  const [statsResult, setStatsResult] = useState(null);
  const [apkLogo, setApkLogo] = useState(null);
  const [apkUploading, setApkUploading] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [workshopTab, setWorkshopTab] = useState('pending');
  const [appStats, setAppStats] = useState(null);
  const [appStatsLoading, setAppStatsLoading] = useState(false);
  const [feedbackCampaigns, setFeedbackCampaigns] = useState([]);
  const [feedbackResponses, setFeedbackResponses] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSendResult, setFeedbackSendResult] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [totemRentals, setTotemRentals] = useState([]);
  const [totemLoading, setTotemLoading] = useState(false);
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
  const [notifyingPremiums, setNotifyingPremiums] = useState(false);
  const [notifyPremiumsMsg, setNotifyPremiumsMsg] = useState('');
  const [customEmailTo, setCustomEmailTo] = useState('');
  const [customEmailSubject, setCustomEmailSubject] = useState('');
  const [customEmailMessage, setCustomEmailMessage] = useState('');
  const [sendingCustomEmail, setSendingCustomEmail] = useState(false);
  const [customEmailResult, setCustomEmailResult] = useState(null);
  const navigate = useNavigate();
  const selectedTicketRef = useRef(null);
  const saMsgEndRef = useRef(null);
  const saMsgContainerRef = useRef(null);
  const [saMobileChat, setSaMobileChat] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // ── Notificaciones de pedidos nuevos ─────────────────────────────────────
  const [orderNotifs, setOrderNotifs] = useState([]); // [{id, order_number, store_name, total, payment_method}]

  const dismissNotif = (nid) => setOrderNotifs(p => p.filter(n => n.nid !== nid));

  // ── Pedidos (superadmin) ───────────────────────────────────────────────────
  const [saOrders, setSaOrders] = useState([]);
  const [saOrdersTotal, setSaOrdersTotal] = useState(0);
  const [saOrdersLoading, setSaOrdersLoading] = useState(false);
  const [saOrderFilter, setSaOrderFilter] = useState({ store_id: '', date_from: '', date_to: '', status: '' });
  const [saRevenue, setSaRevenue] = useState([]);
  const [saRevenueSummary, setSaRevenueSummary] = useState({ total_platform: 0, total_orders: 0 });
  const [saRevenueLoading, setSaRevenueLoading] = useState(false);
  const [saRevenueFilter, setSaRevenueFilter] = useState({ date_from: '', date_to: '', status: 'completed' });
  const [saOrderDetail, setSaOrderDetail] = useState(null);
  const [saOrderItems, setSaOrderItems] = useState([]);
  const [saDeleteConfirm, setSaDeleteConfirm] = useState(null);
  const [userApps, setUserApps] = useState([]);

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

  const fetchSaRevenue = async (filterOverride) => {
    setSaRevenueLoading(true);
    try {
      const token = localStorage.getItem('superadminToken');
      const f = filterOverride !== undefined ? filterOverride : saRevenueFilter;
      const q = new URLSearchParams(Object.fromEntries(Object.entries(f).filter(([, v]) => v)));
      const r = await fetch(`${API}/api/superadmin/revenue?${q}`, { headers: { Authorization: 'Bearer ' + token } });
      if (r.ok) { const d = await r.json(); setSaRevenue(d.stores || []); setSaRevenueSummary(d.summary || { total_platform: 0, total_orders: 0 }); }
    } catch {} finally { setSaRevenueLoading(false); }
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

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

    socket.on('presence_update', (data) => {
      setPresence(data || { sessions: [] });
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
      } else if (activeTab === 'app-stats') {
        setAppStatsLoading(true);
        try {
          const res = await fetch(API + '/api/superadmin/app-stats', { headers: { 'Authorization': 'Bearer ' + token } });
          const data = await res.json();
          setAppStats(data);
        } finally { setAppStatsLoading(false); }
      } else if (activeTab === 'feedback') {
        setFeedbackLoading(true);
        try {
          const [campRes, respRes] = await Promise.all([
            fetch(API + '/api/superadmin/feedback/campaigns', { headers: { 'Authorization': 'Bearer ' + token } }),
            fetch(API + '/api/superadmin/feedback/responses', { headers: { 'Authorization': 'Bearer ' + token } }),
          ]);
          if (campRes.ok) setFeedbackCampaigns(await campRes.json());
          if (respRes.ok) setFeedbackResponses(await respRes.json());
        } finally { setFeedbackLoading(false); }
      } else if (activeTab === 'totem-rentals') {
        setTotemLoading(true);
        try {
          const res = await fetch(API + '/api/superadmin/totem-rentals', { headers: { 'Authorization': 'Bearer ' + token } });
          if (res.ok) setTotemRentals(await res.json());
        } finally { setTotemLoading(false); }
      } else if (activeTab === 'orders') {
        await fetchSaOrders();
        return;
      } else if (activeTab === 'revenue') {
        await fetchSaRevenue();
        return;
      } else if (activeTab === 'apps') {
        const res = await fetch(API + '/api/superadmin/user-apps', { headers: { 'Authorization': 'Bearer ' + token } });
        if (res.ok) setUserApps(await res.json());
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

  const handleImpersonate = async (user) => {
    const token = localStorage.getItem('superadminToken');
    try {
      const res = await fetch(API + `/api/superadmin/impersonate/${user.id}`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) { alert('Error al obtener sesión'); return; }
      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.open('/admin', '_blank');
    } catch (error) {
      console.error('Error impersonating:', error);
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

  const notifyExistingPremiums = async () => {
    setNotifyingPremiums(true);
    setNotifyPremiumsMsg('');
    try {
      const token = localStorage.getItem('superadminToken');
      const res = await fetch(API + '/api/superadmin/notify-existing-premiums', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      if (res.ok) {
        setNotifyPremiumsMsg(`✔ Email enviado a ${data.sent} superadmin(s) con ${data.total_premiums} usuarios premium`);
      } else {
        setNotifyPremiumsMsg('Error: ' + (data.error || 'intenta de nuevo'));
      }
    } catch {
      setNotifyPremiumsMsg('Error de conexión');
    } finally {
      setNotifyingPremiums(false);
      setTimeout(() => setNotifyPremiumsMsg(''), 5000);
    }
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

  const premiumUserIds = new Set(
    subscriptions
      .filter(s => s.current_plan && s.current_plan !== 'Gratis' && s.current_is_active)
      .map(s => s.user_id)
  );

  const stats = {
    totalUsers: users.length,
    bannedUsers: users.filter(u => u.is_banned).length,
    totalStores: stores.length,
    bannedStores: stores.filter(s => s.is_banned).length,
    activeUsers: users.filter(u => !u.is_banned).length,
    activeStores: stores.filter(s => !s.is_banned).length,
    storesActive7d: stores.filter(isStoreActive7d).length,
    storesActive30d: stores.filter(isStoreActive30d).length,
    storesInactive: stores.filter(s => !s.last_order_at).length,
    usersActiveToday: users.filter(u => ['online', 'recent', 'today'].includes(getActivityStatus(u.last_active))).length,
    usersWithStores: users.filter(u => u.store_count > 0).length,
    usersPremium: users.filter(u => premiumUserIds.has(u.id)).length,
  };

  const getWhatsAppUrl = (phone) => {
    if (!phone) return null;
    const clean = phone.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
    const msg = encodeURIComponent('Hola, somos del equipo de SRAutomatic. ¿Cómo podemos ayudarte?');
    return `https://wa.me/${clean}?text=${msg}`;
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
            className={`sidebar-nav-item ${activeTab === 'app-stats' ? 'active' : ''}`}
            onClick={() => { setActiveTab('app-stats'); setMobileMenuOpen(false); }}
          >
            <FontAwesomeIcon icon={faChartBar} />
            {sidebarOpen && <span>Uso de Apps</span>}
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'feedback' ? 'active' : ''}`}
            onClick={() => { setActiveTab('feedback'); setMobileMenuOpen(false); }}
          >
            <FontAwesomeIcon icon={faEnvelope} />
            {sidebarOpen && <span>Feedback</span>}
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'totem-rentals' ? 'active' : ''}`}
            onClick={() => { setActiveTab('totem-rentals'); setMobileMenuOpen(false); }}
          >
            <FontAwesomeIcon icon={faChair} />
            {sidebarOpen && <span>Arriendo Tótem</span>}
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => { setActiveTab('orders'); setMobileMenuOpen(false); }}
          >
            <FontAwesomeIcon icon={faShoppingCart} />
            {sidebarOpen && <span>Pedidos</span>}
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'revenue' ? 'active' : ''}`}
            onClick={() => { setActiveTab('revenue'); setMobileMenuOpen(false); }}
          >
            <FontAwesomeIcon icon={faMoneyBillWave} />
            {sidebarOpen && <span>Ingresos</span>}
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'apps' ? 'active' : ''}`}
            onClick={() => { setActiveTab('apps'); setMobileMenuOpen(false); }}
          >
            <FontAwesomeIcon icon={faThLarge} />
            {sidebarOpen && <span>Aplicaciones</span>}
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'screens' ? 'active' : ''}`}
            onClick={() => { setActiveTab('screens'); setMobileMenuOpen(false); }}
            style={{ position: 'relative' }}
          >
            <FontAwesomeIcon icon={faDesktop} />
            {sidebarOpen && <span>Pantallas</span>}
            {presence.sessions.length > 0 && (
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: '#22c55e',
                boxShadow: '0 0 6px #22c55e', flexShrink: 0,
                marginLeft: sidebarOpen ? 'auto' : undefined,
                position: sidebarOpen ? 'static' : 'absolute',
                top: sidebarOpen ? undefined : 6, right: sidebarOpen ? undefined : 6
              }} />
            )}
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'product-stats' ? 'active' : ''}`}
            onClick={() => { setActiveTab('product-stats'); setMobileMenuOpen(false); }}
          >
            <FontAwesomeIcon icon={faChartBar} />
            {sidebarOpen && <span>Estadísticas</span>}
          </div>

          <div
            className={`sidebar-nav-item ${activeTab === 'emails' ? 'active' : ''}`}
            onClick={() => { setActiveTab('emails'); setMobileMenuOpen(false); }}
          >
            <FontAwesomeIcon icon={faPaperPlane} />
            {sidebarOpen && <span>Enviar Email</span>}
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
                {activeTab === 'users' ? 'Usuarios' : activeTab === 'stores' ? 'Tiendas' : activeTab === 'workshop' ? 'Workshop - Plugins' : activeTab === 'tickets' ? 'Tickets de Soporte' : activeTab === 'admins' ? 'Superadministradores' : activeTab === 'apks' ? 'APK Releases' : activeTab === 'orders' ? 'Pedidos' : activeTab === 'revenue' ? 'Ingresos por Tienda' : activeTab === 'apps' ? 'Aplicaciones por Cuenta' : activeTab === 'screens' ? 'Pantallas Activas' : activeTab === 'product-stats' ? 'Estadísticas de Productos' : activeTab === 'emails' ? 'Enviar Email' : 'Suscripciones'}
              </h1>
              <p className="admin-header-subtitle text-muted text-sm">
                {activeTab === 'users' ? 'Administra las cuentas de usuarios' : activeTab === 'stores' ? 'Administra todas las tiendas' : activeTab === 'workshop' ? 'Revisa y aprueba plugins del workshop' : activeTab === 'product-stats' ? 'Envía reportes de productos más y menos vendidos' : activeTab === 'emails' ? 'Redacta y envía un email a quien quieras' : 'Ver todas las suscripciones'}
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
            {activeTab !== 'emails' && (
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
            )}

            {loading ? (
              <div className="empty-state">
                <div>Cargando datos...</div>
              </div>
            ) : activeTab === 'users' ? (
              <>
                {/* Usage percentage summary */}
                {users.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px', padding: '0 0 4px' }}>
                    {[
                      {
                        label: 'Activos',
                        value: stats.activeUsers,
                        pct: Math.round(stats.activeUsers / stats.totalUsers * 100),
                        color: '#22c55e',
                        emoji: '✅',
                      },
                      {
                        label: 'Activos hoy',
                        value: stats.usersActiveToday,
                        pct: Math.round(stats.usersActiveToday / stats.totalUsers * 100),
                        color: '#3b82f6',
                        emoji: '🟢',
                      },
                      {
                        label: 'Con tiendas',
                        value: stats.usersWithStores,
                        pct: Math.round(stats.usersWithStores / stats.totalUsers * 100),
                        color: '#D4AF37',
                        emoji: '🏪',
                      },
                      {
                        label: 'Premium',
                        value: stats.usersPremium,
                        pct: Math.round(stats.usersPremium / stats.totalUsers * 100),
                        color: '#a855f7',
                        emoji: '⭐',
                      },
                      {
                        label: 'Baneados',
                        value: stats.bannedUsers,
                        pct: Math.round(stats.bannedUsers / stats.totalUsers * 100),
                        color: '#ef4444',
                        emoji: '🚫',
                      },
                    ].map(card => (
                      <div
                        key={card.label}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '12px',
                          padding: '14px 12px',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ fontSize: '16px', marginBottom: '2px' }}>{card.emoji}</div>
                        <div style={{ fontSize: '26px', fontWeight: '800', color: card.color, lineHeight: 1 }}>{card.value}</div>
                        <div style={{ fontSize: '11px', color: '#888', marginTop: '4px', fontWeight: '600' }}>{card.label}</div>
                        <div style={{ marginTop: '6px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${card.pct}%`, height: '100%', background: card.color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                        </div>
                        <div style={{ fontSize: '10px', color: card.color, fontWeight: '700', marginTop: '3px' }}>{card.pct}% del total</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="admin-table-wrapper">
                {isMobile ? (
                  <div className="sa-cards-list">
                    {filteredUsers.map(user => {
                      const actStatus = getActivityStatus(user.last_active);
                      const isOnline = actStatus === 'online';
                      return (
                        <div key={user.id} className="sa-item-card">
                          <div className="sa-item-card-top">
                            <div className="sa-item-card-info">
                              <div className="sa-item-card-title">{user.username}</div>
                              <div className="sa-item-card-sub">{user.email}</div>
                              {user.business_name && <div className="sa-item-card-sub">{user.business_name}</div>}
                              <div className="sa-item-card-sub" style={{ opacity: 0.5 }}>Code: {user.code}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', flexShrink: 0 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: isOnline ? 'rgba(34,197,94,0.15)' : 'rgba(156,163,175,0.12)', color: isOnline ? '#22c55e' : '#9ca3af' }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? '#22c55e' : '#9ca3af', boxShadow: isOnline ? '0 0 5px #22c55e' : 'none' }} />
                                {isOnline ? 'Online' : 'Offline'}
                              </span>
                              {user.is_banned ? <span className="badge badge-danger">Baneado</span> : <span className="badge badge-success">Activo</span>}
                            </div>
                          </div>
                          <div className="sa-item-card-stats">
                            <span><FontAwesomeIcon icon={faStore} style={{ marginRight: 4, opacity: 0.5 }} />{user.store_count} tienda{user.store_count !== 1 ? 's' : ''}</span>
                            {user.country && <span>🌍 {user.country}</span>}
                            <span style={{ color: '#aaa', marginLeft: 'auto' }}>{formatLastActive(user.last_active)}</span>
                          </div>
                          <div className="sa-item-card-actions">
                            <button className="btn btn-sm btn-icon" onClick={() => handleEditUser(user)} title="Editar"><FontAwesomeIcon icon={faEdit} /></button>
                            <button className={`btn btn-sm btn-icon ${user.is_banned ? 'btn-unban' : 'btn-ban'}`} onClick={() => handleToggleBanUser(user)} title={user.is_banned ? 'Desbanear' : 'Banear'}><FontAwesomeIcon icon={user.is_banned ? faCheck : faBan} /></button>
                            <button className="btn btn-sm btn-icon btn-delete" onClick={() => setShowDeleteConfirm({ type: 'user', id: user.id, name: user.username })} title="Eliminar"><FontAwesomeIcon icon={faTrash} /></button>
                            <button className="btn btn-sm btn-icon" onClick={() => handleImpersonate(user)} title="Ingresar como este usuario" style={{ background: '#7c3aed', color: '#fff', border: 'none' }}><FontAwesomeIcon icon={faUserSecret} /></button>
                            {getWhatsAppUrl(user.phone) && (
                              <a href={getWhatsAppUrl(user.phone)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-icon" title={`WhatsApp: ${user.phone}`} style={{ background: '#25D366', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FontAwesomeIcon icon={faWhatsapp} />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {filteredUsers.length === 0 && (
                      <div className="empty-state">
                        <FontAwesomeIcon icon={faUsers} className="empty-state-icon" />
                        <div>No se encontraron usuarios</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <table className="table admin-table">
                      <thead>
                        <tr>
                          <th>Usuario</th>
                          <th>Email</th>
                          <th>Empresa</th>
                          <th className="text-center">Tiendas</th>
                          <th className="text-center">Última Actividad</th>
                          <th className="text-center">País</th>
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
                              <td>{user.business_name || '-'}</td>
                              <td className="text-center"><span className="badge badge-gold">{user.store_count}</span></td>
                              <td className="text-center"><span className={`badge badge-activity-${actStatus}`}>{formatLastActive(user.last_active)}</span></td>
                              <td className="text-center" style={{ fontSize: '13px' }}>{user.country || '—'}</td>
                              <td className="text-center">
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: isOnline ? 'rgba(34,197,94,0.15)' : 'rgba(156,163,175,0.15)', color: isOnline ? '#22c55e' : '#9ca3af' }}>
                                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isOnline ? '#22c55e' : '#9ca3af', boxShadow: isOnline ? '0 0 6px #22c55e' : 'none' }} />
                                  {isOnline ? 'Online' : 'Offline'}
                                </span>
                              </td>
                              <td className="text-center">
                                {user.is_banned ? <span className="badge badge-danger">Baneado</span> : <span className="badge badge-success">Activo</span>}
                              </td>
                              <td className="text-center">
                                <button className="btn btn-sm btn-icon" onClick={() => handleEditUser(user)} title="Editar"><FontAwesomeIcon icon={faEdit} /></button>
                                <button className={`btn btn-sm btn-icon ${user.is_banned ? 'btn-unban' : 'btn-ban'}`} onClick={() => handleToggleBanUser(user)} title={user.is_banned ? 'Desbanear' : 'Banear'}><FontAwesomeIcon icon={user.is_banned ? faCheck : faBan} /></button>
                                <button className="btn btn-sm btn-icon btn-delete" onClick={() => setShowDeleteConfirm({ type: 'user', id: user.id, name: user.username })} title="Eliminar"><FontAwesomeIcon icon={faTrash} /></button>
                                <button className="btn btn-sm btn-icon" onClick={() => handleImpersonate(user)} title="Ingresar como este usuario" style={{ background: '#7c3aed', color: '#fff', border: 'none' }}><FontAwesomeIcon icon={faUserSecret} /></button>
                                {getWhatsAppUrl(user.phone) && (
                                  <a href={getWhatsAppUrl(user.phone)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-icon" title={`Contactar por WhatsApp: ${user.phone}`} style={{ background: '#25D366', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FontAwesomeIcon icon={faWhatsapp} />
                                  </a>
                                )}
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
                  </>
                )}
              </div>
              </>
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
                  {isMobile ? (
                    <div className="sa-cards-list">
                      {filteredStores.map(store => {
                        const lastOrder = store.last_order_at ? new Date(store.last_order_at) : null;
                        const diffDays = lastOrder ? Math.floor((now - lastOrder.getTime()) / DAY_MS) : null;
                        const actColor = diffDays === null ? '#6b7280' : diffDays < 7 ? '#22c55e' : diffDays < 30 ? '#3b82f6' : '#f59e0b';
                        const actLabel = diffDays === null ? 'Sin pedidos' : diffDays === 0 ? 'Hoy' : diffDays === 1 ? 'Ayer' : `Hace ${diffDays}d`;
                        return (
                          <div key={store.id} className="sa-item-card">
                            <div className="sa-item-card-top">
                              <div className="sa-item-card-info">
                                <div className="sa-item-card-title">{store.name}</div>
                                <div className="sa-item-card-sub">{store.user_email}</div>
                                {store.user_business && <div className="sa-item-card-sub">{store.user_business}</div>}
                                <div className="sa-item-card-sub" style={{ opacity: 0.5 }}>Code: {store.code}</div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', flexShrink: 0 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: actColor }}>{actLabel}</span>
                                {store.is_banned ? <span className="badge badge-danger">Baneada</span> : <span className="badge badge-success">Activa</span>}
                              </div>
                            </div>
                            <div className="sa-item-card-stats">
                              <span><FontAwesomeIcon icon={faStore} style={{ marginRight: 4, opacity: 0.5 }} />{store.product_count} prods</span>
                              <span>{store.order_count} pedidos{store.orders_30d > 0 ? ` (+${store.orders_30d} 30d)` : ''}</span>
                            </div>
                            <div className="sa-item-card-actions">
                              <button className={`btn btn-sm btn-icon ${store.is_banned ? 'btn-unban' : 'btn-ban'}`} onClick={() => handleToggleBanStore(store)} title={store.is_banned ? 'Desbanear' : 'Banear'}><FontAwesomeIcon icon={store.is_banned ? faCheck : faBan} /></button>
                              <button className="btn btn-sm btn-icon btn-delete" onClick={() => setShowDeleteConfirm({ type: 'store', id: store.id, name: store.name })} title="Eliminar"><FontAwesomeIcon icon={faTrash} /></button>
                            </div>
                          </div>
                        );
                      })}
                      {filteredStores.length === 0 && (
                        <div className="empty-state">
                          <FontAwesomeIcon icon={faStore} className="empty-state-icon" />
                          <div>No se encontraron tiendas</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <table className="table admin-table">
                        <thead>
                          <tr>
                            <th>Tienda</th>
                            <th>Propietario</th>
                            <th className="text-center">Prods.</th>
                            <th className="text-center">Pedidos</th>
                            <th className="text-center">Últ. pedido</th>
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
                                <td>
                                  <div className="font-bold">{store.name}</div>
                                  <div className="text-sm text-muted">Code: {store.code}</div>
                                </td>
                                <td>
                                  <div className="text-muted">{store.user_email}</div>
                                  <div className="text-sm text-muted">{store.user_business || '-'}</div>
                                </td>
                                <td className="text-center"><span className="badge badge-gold">{store.product_count}</span></td>
                                <td className="text-center">
                                  <div><span className="badge badge-dark">{store.order_count}</span></div>
                                  {store.orders_30d > 0 && <div style={{ fontSize: '10px', color: '#3b82f6', marginTop: '3px' }}>+{store.orders_30d} (30d)</div>}
                                </td>
                                <td className="text-center"><span style={{ fontSize: '12px', fontWeight: '700', color: actColor }}>{actLabel}</span></td>
                                <td className="text-center">
                                  {store.is_banned ? <span className="badge badge-danger">Baneada</span> : <span className="badge badge-success">Activa</span>}
                                </td>
                                <td className="text-center">
                                  <button className={`btn btn-sm btn-icon ${store.is_banned ? 'btn-unban' : 'btn-ban'}`} onClick={() => handleToggleBanStore(store)} title={store.is_banned ? 'Desbanear' : 'Banear'}><FontAwesomeIcon icon={store.is_banned ? faCheck : faBan} /></button>
                                  <button className="btn btn-sm btn-icon btn-delete" onClick={() => setShowDeleteConfirm({ type: 'store', id: store.id, name: store.name })} title="Eliminar"><FontAwesomeIcon icon={faTrash} /></button>
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
                    </>
                  )}
                </div>
              </div>
            ) : activeTab === 'subscriptions' ? (
              <div className="admin-table-wrapper">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 0 14px', flexWrap: 'wrap' }}>
                  <button
                    onClick={notifyExistingPremiums}
                    disabled={notifyingPremiums}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: notifyingPremiums ? '#f0f0f0' : '#111', color: notifyingPremiums ? '#aaa' : '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: notifyingPremiums ? 'not-allowed' : 'pointer' }}
                  >
                    📧 {notifyingPremiums ? 'Enviando...' : 'Enviar reporte de premiums por email'}
                  </button>
                  {notifyPremiumsMsg && (
                    <span style={{ fontSize: '13px', fontWeight: '600', color: notifyPremiumsMsg.startsWith('✔') ? '#16a34a' : '#dc2626' }}>
                      {notifyPremiumsMsg}
                    </span>
                  )}
                </div>
                {isMobile ? (
                  <div className="sa-cards-list">
                    {subscriptions.map(sub => {
                      const isActive = sub.current_is_active && sub.current_ends_at && new Date(sub.current_ends_at) > new Date();
                      const isCancelled = sub.current_is_active === false;
                      const isPaid = sub.current_plan && sub.current_plan !== 'Gratis';
                      return (
                        <div key={sub.email} className="sa-item-card" onClick={() => { setSelectedSubscription(sub); setShowSubscriptionModal(true); }} style={{ cursor: 'pointer' }}>
                          <div className="sa-item-card-top">
                            <div className="sa-item-card-info">
                              <div className="sa-item-card-title">{sub.username}</div>
                              <div className="sa-item-card-sub">{sub.email}</div>
                              {sub.business_name && <div className="sa-item-card-sub">{sub.business_name}</div>}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
                              <span className={`badge ${isPaid ? 'badge-gold' : 'badge-gray'}`}>{sub.current_plan || 'Gratis'}</span>
                              {isActive ? <span className="badge badge-success">Activo</span> : isCancelled ? <span className="badge badge-danger">Cancelado</span> : <span className="badge badge-gray">Gratis</span>}
                            </div>
                          </div>
                          <div className="sa-item-card-stats">
                            {isPaid && (
                              <span style={{ fontWeight: 700 }}>
                                {sub.current_billing_cycle === 'monthly' ? `$${sub.current_price_monthly}/mes` : `$${sub.current_price_yearly}/año`}
                              </span>
                            )}
                            {sub.current_ends_at && <span style={{ color: '#aaa' }}>Vence: {new Date(sub.current_ends_at).toLocaleDateString('es-ES')}</span>}
                          </div>
                          <div className="sa-item-card-actions">
                            <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); setSelectedSubscription(sub); setShowSubscriptionModal(true); }}>Ver</button>
                            <button className="btn btn-sm" style={{ background: '#D4AF37', color: '#fff', border: 'none' }} onClick={(e) => { e.stopPropagation(); openPremiumModal(sub); }}>Premium</button>
                          </div>
                        </div>
                      );
                    })}
                    {subscriptions.length === 0 && (
                      <div className="empty-state">
                        <FontAwesomeIcon icon={faCreditCard} className="empty-state-icon" />
                        <div>No hay suscripciones</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <table className="table admin-table">
                      <thead>
                        <tr>
                          <th>Usuario</th>
                          <th>Email</th>
                          <th>Plan Actual</th>
                          <th className="text-center">Precio</th>
                          <th className="text-center">Vencimiento</th>
                          <th className="text-center">Estado</th>
                          <th className="text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptions.map(sub => (
                          <tr key={sub.email} className="clickable-row" onClick={() => { setSelectedSubscription(sub); setShowSubscriptionModal(true); }}>
                            <td>
                              <div className="font-bold">{sub.username}</div>
                              <div className="text-sm text-muted">{sub.business_name || '-'}</div>
                            </td>
                            <td>{sub.email}</td>
                            <td>
                              <span className={`badge ${sub.current_plan === 'Gratis' || !sub.current_plan ? 'badge-gray' : 'badge-gold'}`}>{sub.current_plan || 'Gratis'}</span>
                            </td>
                            <td className="text-center">
                              <div className="font-bold">
                                {!sub.current_plan || sub.current_plan === 'Gratis' ? 'Gratis' : sub.current_billing_cycle === 'monthly' ? `$${sub.current_price_monthly}/mes` : `$${sub.current_price_yearly}/ano`}
                              </div>
                            </td>
                            <td className="text-center text-muted">{sub.current_ends_at ? new Date(sub.current_ends_at).toLocaleDateString('es-ES') : '-'}</td>
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
                              <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); setSelectedSubscription(sub); setShowSubscriptionModal(true); }} style={{ marginRight: '4px' }}>Ver</button>
                              <button className="btn btn-sm" style={{ background: '#D4AF37', color: '#fff', border: 'none' }} onClick={(e) => { e.stopPropagation(); openPremiumModal(sub); }}>Dar Premium</button>
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
                  </>
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
            ) : activeTab === 'app-stats' ? (
              <div>
                {appStatsLoading ? (
                  <div className="empty-state"><div>Cargando estadísticas...</div></div>
                ) : !appStats ? (
                  <div className="empty-state"><FontAwesomeIcon icon={faChartBar} className="empty-state-icon" /><div>Sin datos aún. Las apps reportan actividad al abrirse.</div></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Activos últimas 24h */}
                    <div>
                      <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '700', color: '#1a1a2e' }}>Activos en las últimas 24h</h3>
                      {appStats.active_now.length === 0 ? (
                        <div style={{ color: '#888', fontSize: '14px' }}>Sin actividad reciente</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                          {appStats.active_now.map(a => (
                            <div key={a.app_name} style={{ background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                              <div style={{ fontSize: '28px', fontWeight: '800', color: '#1a1a2e' }}>{a.active_devices}</div>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: '#555', marginTop: '4px', textTransform: 'capitalize' }}>{a.app_name}</div>
                              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{a.active_stores} tiendas</div>
                              <div style={{ fontSize: '10px', color: '#bbb', marginTop: '4px' }}>último: {new Date(a.last_seen).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Distribución de versiones */}
                    {appStats.versions.length > 0 && (
                      <div>
                        <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '700', color: '#1a1a2e' }}>Versiones en uso (últimos 7 días)</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {appStats.versions.map(v => (
                            <div key={`${v.app_name}-${v.app_version}`} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 14px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: '#888', textTransform: 'capitalize' }}>{v.app_name}</span>
                              <span style={{ background: '#1a1a2e', color: '#fff', borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: '700' }}>v{v.app_version}</span>
                              <span style={{ fontSize: '13px', fontWeight: '700', color: '#22c55e' }}>{v.devices} disp.</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top tiendas */}
                    {appStats.top_stores.length > 0 && (
                      <div>
                        <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '700', color: '#1a1a2e' }}>Tiendas más activas (últimos 7 días)</h3>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '700', color: '#555' }}>App</th>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '700', color: '#555' }}>Tienda</th>
                                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '700', color: '#555' }}>Dispositivos</th>
                                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '700', color: '#555' }}>Último uso</th>
                              </tr>
                            </thead>
                            <tbody>
                              {appStats.top_stores.slice(0, 20).map((s, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                  <td style={{ padding: '10px 16px', textTransform: 'capitalize', fontWeight: '600', color: '#333' }}>{s.app_name}</td>
                                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: '#1a1a2e', fontWeight: '700' }}>{s.store_code || '—'}</td>
                                  <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '700', color: '#22c55e' }}>{s.devices}</td>
                                  <td style={{ padding: '10px 16px', textAlign: 'right', color: '#888', fontSize: '12px' }}>{new Date(s.last_seen).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : activeTab === 'feedback' ? (
              <div>
                {/* Header + send button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: 800 }}>Feedback de Usuarios</h3>
                    <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>Envía encuestas de satisfacción por email (y WhatsApp si está conectado). Se envía automáticamente el 1° de cada mes.</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!window.confirm('¿Enviar encuesta de feedback a TODOS los usuarios activos ahora?')) return;
                      setFeedbackSending(true); setFeedbackSendResult(null);
                      try {
                        const res = await fetch(API + '/api/superadmin/feedback/send', { method: 'POST', headers: { Authorization: 'Bearer ' + localStorage.getItem('superadminToken') } });
                        const d = await res.json();
                        setFeedbackSendResult(d.success ? `✅ Encuesta enviada a ${d.total} usuarios` : `❌ ${d.error}`);
                        if (d.success) setTimeout(() => fetchData(), 2000);
                      } catch { setFeedbackSendResult('❌ Error de conexión'); }
                      setFeedbackSending(false);
                    }}
                    disabled={feedbackSending}
                    style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: feedbackSending ? '#d1d5db' : '#C8A415', color: '#fff', fontWeight: 700, fontSize: 14, cursor: feedbackSending ? 'not-allowed' : 'pointer' }}
                  >
                    {feedbackSending ? 'Enviando...' : '📨 Enviar encuesta ahora'}
                  </button>
                </div>
                {feedbackSendResult && <div style={{ background: feedbackSendResult.startsWith('✅') ? '#ecfdf5' : '#fef2f2', border: `1px solid ${feedbackSendResult.startsWith('✅') ? '#6ee7b7' : '#fca5a5'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontWeight: 600, fontSize: 14, color: feedbackSendResult.startsWith('✅') ? '#065f46' : '#dc2626' }}>{feedbackSendResult}</div>}

                {/* Stats */}
                {feedbackResponses.length > 0 && (() => {
                  const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '—';
                  const ratings = feedbackResponses.map(r => r.overall_rating).filter(Boolean);
                  const ease = feedbackResponses.map(r => r.ease_of_use).filter(Boolean);
                  const support = feedbackResponses.map(r => r.support_quality).filter(Boolean);
                  const rec = feedbackResponses.filter(r => r.would_recommend === 1 || r.would_recommend === true).length;
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
                      {[
                        ['⭐ Satisfacción', avg(ratings) + '/5', '#C8A415'],
                        ['🖱️ Facilidad', avg(ease) + '/5', '#3b82f6'],
                        ['🛠️ Soporte', avg(support) + '/5', '#8b5cf6'],
                        ['👍 Recomendarían', `${rec}/${feedbackResponses.length}`, '#10b981'],
                      ].map(([label, value, color]) => (
                        <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #f0f0f0', textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
                          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Campaigns */}
                {feedbackLoading ? <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>Cargando...</div> : (
                  <>
                    <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', fontWeight: 700 }}>Campañas</h4>
                    {feedbackCampaigns.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#888', padding: 32, background: '#f9fafb', borderRadius: 12 }}>No hay campañas aún. Envía la primera encuesta.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                        {feedbackCampaigns.map(c => (
                          <div key={c.id} onClick={() => setSelectedCampaign(selectedCampaign === c.id ? null : c.id)}
                            style={{ background: '#fff', border: `2px solid ${selectedCampaign === c.id ? '#C8A415' : '#f0f0f0'}`, borderRadius: 12, padding: '14px 18px', cursor: 'pointer', display: 'flex', gap: 16, alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: 14 }}>{c.type === 'monthly' ? '📅 Mensual automática' : '📨 Manual'}</div>
                              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{new Date(c.created_at).toLocaleString('es-CL')}</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 18, fontWeight: 900 }}>{c.total_responded}/{c.total_sent}</div>
                              <div style={{ fontSize: 11, color: '#888' }}>respuestas</div>
                            </div>
                            <div style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: c.status === 'done' ? '#ecfdf5' : '#fef9c3', color: c.status === 'done' ? '#065f46' : '#92400e' }}>
                              {c.status === 'done' ? 'Enviada' : 'Enviando...'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', fontWeight: 700 }}>
                      Respuestas {selectedCampaign ? `— Campaña #${selectedCampaign}` : '(todas)'}
                    </h4>
                    {feedbackResponses.filter(r => !selectedCampaign || feedbackCampaigns.find(c => c.id === selectedCampaign)).length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#888', padding: 32, background: '#f9fafb', borderRadius: 12 }}>Sin respuestas aún.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {feedbackResponses.slice(0, 50).map(r => (
                          <div key={r.id} style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 12, padding: '14px 18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>{r.business_name || r.username} <span style={{ color: '#888', fontSize: 12, fontWeight: 400 }}>({r.email})</span></div>
                                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{new Date(r.created_at).toLocaleDateString('es-CL')} · via {r.sent_via}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                {[['⭐', r.overall_rating], ['🖱️', r.ease_of_use], ['🛠️', r.support_quality]].filter(([, v]) => v).map(([icon, v]) => (
                                  <span key={icon} style={{ fontSize: 13, fontWeight: 700 }}>{icon} {v}/5</span>
                                ))}
                                {r.would_recommend !== null && <span style={{ fontSize: 13 }}>{r.would_recommend ? '👍' : '👎'}</span>}
                              </div>
                            </div>
                            {r.comment && <p style={{ margin: '10px 0 0', fontSize: 13, color: '#374151', background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>{r.comment}</p>}
                            {r.improvement_suggestions && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#374151', background: '#fef9c3', borderRadius: 8, padding: '8px 12px' }}>💡 {r.improvement_suggestions}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : activeTab === 'totem-rentals' ? (
              <div>
                <h3 style={{ margin: '0 0 4px', fontWeight: 800 }}>Arriendo de Tótems</h3>
                <p style={{ margin: '0 0 20px', color: '#888', fontSize: 13 }}>Gestiona las solicitudes de arriendo de tótem de autoservicio.</p>

                {totemLoading ? <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>Cargando...</div> : totemRentals.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#888', padding: 48, background: '#f9fafb', borderRadius: 16 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🖥️</div>
                    <div>No hay solicitudes de arriendo aún.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(() => {
                      const STATUS = {
                        pending_payment: { label: 'Pend. pago', color: '#f59e0b', bg: '#fffbeb' },
                        pending_install: { label: 'Pend. instalación', color: '#3b82f6', bg: '#eff6ff' },
                        active: { label: 'Activo', color: '#10b981', bg: '#ecfdf5' },
                        suspended: { label: 'Suspendido', color: '#6b7280', bg: '#f9fafb' },
                        cancelled: { label: 'Cancelado', color: '#ef4444', bg: '#fef2f2' },
                      };
                      const CLP = v => `$${Number(v).toLocaleString('es-CL')}`;
                      return totemRentals.map(r => (
                        <div key={r.id} style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 14, padding: '18px 20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 200 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                <span style={{ fontWeight: 800, fontSize: 15 }}>{r.business_name || r.username}</span>
                                <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: STATUS[r.status]?.color, background: STATUS[r.status]?.bg }}>
                                  {STATUS[r.status]?.label || r.status}
                                </span>
                              </div>
                              <div style={{ fontSize: 13, color: '#6b7280' }}>
                                📞 {r.contact_name} · {r.contact_phone}<br/>
                                📍 {r.address}
                              </div>
                              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                                Instalación: {CLP(r.installation_fee)} · Mensual: {CLP(r.monthly_fee)}/mes · Solicitado: {new Date(r.created_at).toLocaleDateString('es-CL')}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                              {r.status === 'pending_install' && (
                                <button
                                  onClick={async () => {
                                    if (!window.confirm(`¿Marcar como instalado el tótem para ${r.business_name || r.username}? Se intentará crear la suscripción mensual en Mercado Pago.`)) return;
                                    const token = localStorage.getItem('superadminToken');
                                    const res = await fetch(`${API}/api/superadmin/totem-rentals/${r.id}/install`, { method: 'PUT', headers: { Authorization: 'Bearer ' + token } });
                                    const d = await res.json();
                                    if (d.success) { alert('✅ Marcado como instalado' + (d.mp_subscription_id ? `. Suscripción MP: ${d.mp_subscription_id}` : '')); fetchData(); }
                                    else alert('❌ ' + d.error);
                                  }}
                                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                                >✅ Marcar instalado</button>
                              )}
                              {['pending_payment','active'].includes(r.status) && (
                                <select
                                  defaultValue=""
                                  onChange={async e => {
                                    const newStatus = e.target.value;
                                    if (!newStatus) return;
                                    if (!window.confirm(`¿Cambiar estado a "${STATUS[newStatus]?.label || newStatus}"?`)) { e.target.value = ''; return; }
                                    const token = localStorage.getItem('superadminToken');
                                    const res = await fetch(`${API}/api/superadmin/totem-rentals/${r.id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ status: newStatus }) });
                                    const d = await res.json();
                                    if (d.success) fetchData(); else alert('❌ ' + d.error);
                                    e.target.value = '';
                                  }}
                                  style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer' }}
                                >
                                  <option value="">Cambiar estado...</option>
                                  <option value="suspended">Suspender</option>
                                  <option value="cancelled">Cancelar</option>
                                </select>
                              )}
                            </div>
                          </div>
                          {r.mp_subscription_id && (
                            <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280', background: '#f9fafb', borderRadius: 8, padding: '6px 10px' }}>
                              🔄 Suscripción MP: <code>{r.mp_subscription_id}</code> · Estado: {r.mp_subscription_status || 'authorized'}
                            </div>
                          )}
                        </div>
                      ));
                    })()}
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

                {/* Tabla / Tarjetas */}
                {saOrdersLoading ? (
                  <div className="empty-state"><div>Cargando pedidos...</div></div>
                ) : saOrders.length === 0 ? (
                  <div className="empty-state"><div>No hay pedidos</div></div>
                ) : isMobile ? (
                  <div className="sa-cards-list">
                    {saOrders.map(o => (
                      <div key={o.id} className="sa-item-card">
                        <div className="sa-item-card-top">
                          <div className="sa-item-card-info">
                            <div className="sa-item-card-title">#{o.order_number || o.id} — {o.store_name || `#${o.store_id}`}{o.store_code ? ` [${o.store_code}]` : ''}</div>
                            <div className="sa-item-card-sub">{new Date(o.created_at).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {o.table_number != null ? `Mesa ${o.table_number}` : o.order_type === 'delivery' ? 'Delivery' : 'Para llevar'}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>${parseFloat(o.total).toLocaleString()}</div>
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: o.status === 'completed' ? '#dcfce7' : o.status === 'cancelled' ? '#fee2e2' : '#fef9c3', color: o.status === 'completed' ? '#166534' : o.status === 'cancelled' ? '#991b1b' : '#854d0e' }}>
                              {o.status === 'completed' ? 'Completado' : o.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                            </span>
                          </div>
                        </div>
                        <div className="sa-item-card-stats">
                          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: o.payment_method === 'cash' ? '#fef3c7' : o.payment_method === 'card' ? '#dbeafe' : '#f3e8ff', color: o.payment_method === 'cash' ? '#92400e' : o.payment_method === 'card' ? '#1e40af' : '#7e22ce' }}>
                            {o.payment_method === 'cash' ? 'Efectivo' : o.payment_method === 'card' ? 'Tarjeta' : o.payment_method || '—'}
                          </span>
                        </div>
                        <div className="sa-item-card-actions">
                          <button onClick={() => openSaOrderDetail(o)} style={{ flex: 1, background: '#3b82f6', border: 'none', borderRadius: 8, padding: '9px', cursor: 'pointer', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><FontAwesomeIcon icon={faInfoCircle} /> Ver</button>
                          {o.status !== 'completed' && (
                            <button onClick={() => saMarkPaid(o.id)} style={{ flex: 1, background: '#22c55e', border: 'none', borderRadius: 8, padding: '9px', cursor: 'pointer', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><FontAwesomeIcon icon={faMoneyBillWave} /> Pagar</button>
                          )}
                          <button onClick={() => setSaDeleteConfirm(o)} style={{ background: '#ef4444', border: 'none', borderRadius: 8, padding: '9px 14px', cursor: 'pointer', color: '#fff', fontSize: 13 }}><FontAwesomeIcon icon={faTrash} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
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
                        {saOrders.map(o => (
                          <tr key={o.id} style={{ borderBottom: '1px solid #eee', background: saOrderDetail?.id === o.id ? '#fffbe6' : 'white' }}>
                            <td style={{ padding: '9px 12px', fontWeight: 700 }}>{o.order_number || o.id}</td>
                            <td style={{ padding: '9px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.store_name || `#${o.store_id}`}{o.store_code ? ` [${o.store_code}]` : ''}</td>
                            <td style={{ padding: '9px 12px', fontWeight: 700, color: '#22c55e' }}>${parseFloat(o.total).toLocaleString()}</td>
                            <td style={{ padding: '9px 12px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: o.payment_method === 'cash' ? '#fef3c7' : o.payment_method === 'card' ? '#dbeafe' : '#f3e8ff', color: o.payment_method === 'cash' ? '#92400e' : o.payment_method === 'card' ? '#1e40af' : '#7e22ce' }}>
                                {o.payment_method === 'cash' ? 'Efectivo' : o.payment_method === 'card' ? 'Tarjeta' : o.payment_method || '—'}
                              </span>
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: o.status === 'completed' ? '#dcfce7' : o.status === 'cancelled' ? '#fee2e2' : '#fef9c3', color: o.status === 'completed' ? '#166534' : o.status === 'cancelled' ? '#991b1b' : '#854d0e' }}>
                                {o.status === 'completed' ? 'Completado' : o.status === 'cancelled' ? 'Cancelado' : 'Pendiente'}
                              </span>
                            </td>
                            <td style={{ padding: '9px 12px', fontSize: 12, color: '#555' }}>{o.table_number != null ? `Mesa ${o.table_number}` : o.order_type === 'delivery' ? 'Delivery' : 'Llevar'}</td>
                            <td style={{ padding: '9px 12px', fontSize: 12, color: '#555', whiteSpace: 'nowrap' }}>{new Date(o.created_at).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                            <td style={{ padding: '9px 12px' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button title="Ver detalle" onClick={() => openSaOrderDetail(o)} style={{ background: '#3b82f6', border: 'none', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: '#fff', fontSize: 12 }}><FontAwesomeIcon icon={faInfoCircle} /></button>
                                {o.status !== 'completed' && (
                                  <button title="Marcar pagado" onClick={() => saMarkPaid(o.id)} style={{ background: '#22c55e', border: 'none', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: '#fff', fontSize: 12 }}><FontAwesomeIcon icon={faMoneyBillWave} /></button>
                                )}
                                <button title="Eliminar" onClick={() => setSaDeleteConfirm(o)} style={{ background: '#ef4444', border: 'none', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: '#fff', fontSize: 12 }}><FontAwesomeIcon icon={faTrash} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : activeTab === 'revenue' ? (
              <div>
                {/* Filtros rápidos + fechas */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    {[
                      { label: 'Este mes', fn: () => { const n = new Date(); const f = { date_from: `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`, date_to: new Date().toISOString().slice(0,10), status: 'completed' }; setSaRevenueFilter(f); fetchSaRevenue(f); } },
                      { label: 'Mes pasado', fn: () => { const n = new Date(); const y = n.getMonth() === 0 ? n.getFullYear()-1 : n.getFullYear(); const m = n.getMonth() === 0 ? 12 : n.getMonth(); const last = new Date(y, m, 0).getDate(); const f = { date_from: `${y}-${String(m).padStart(2,'0')}-01`, date_to: `${y}-${String(m).padStart(2,'0')}-${last}`, status: 'completed' }; setSaRevenueFilter(f); fetchSaRevenue(f); } },
                      { label: 'Últimos 30 días', fn: () => { const n = new Date(); const from = new Date(n - 30*86400000); const f = { date_from: from.toISOString().slice(0,10), date_to: n.toISOString().slice(0,10), status: 'completed' }; setSaRevenueFilter(f); fetchSaRevenue(f); } },
                      { label: 'Todo el tiempo', fn: () => { const f = { date_from: '', date_to: '', status: 'completed' }; setSaRevenueFilter(f); fetchSaRevenue(f); } },
                    ].map(btn => (
                      <button key={btn.label} onClick={btn.fn}
                        style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#111'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#374151'; }}
                      >{btn.label}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 130px', minWidth: 120 }}>
                      <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Desde</label>
                      <input type="date" value={saRevenueFilter.date_from} onChange={e => setSaRevenueFilter(p => ({ ...p, date_from: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }} />
                    </div>
                    <div style={{ flex: '1 1 130px', minWidth: 120 }}>
                      <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Hasta</label>
                      <input type="date" value={saRevenueFilter.date_to} onChange={e => setSaRevenueFilter(p => ({ ...p, date_to: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }} />
                    </div>
                    <div style={{ flex: '1 1 130px', minWidth: 120 }}>
                      <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Incluir pedidos</label>
                      <select value={saRevenueFilter.status} onChange={e => setSaRevenueFilter(p => ({ ...p, status: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}>
                        <option value="completed">Solo completados</option>
                        <option value="all">Todos los estados</option>
                        <option value="pending">Solo pendientes</option>
                      </select>
                    </div>
                    <button onClick={() => fetchSaRevenue()} className="btn btn-primary" style={{ height: 36, padding: '0 18px', fontSize: 13 }}>
                      <FontAwesomeIcon icon={faFilter} /> Filtrar
                    </button>
                  </div>
                </div>

                {/* Summary cards */}
                {!saRevenueLoading && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'Total plataforma', value: `$${saRevenueSummary.total_platform.toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: '#22c55e', bg: '#f0fdf4' },
                      { label: 'Total pedidos', value: saRevenueSummary.total_orders.toLocaleString(), color: '#3b82f6', bg: '#eff6ff' },
                      { label: 'Tiendas activas', value: saRevenue.filter(s => s.total_orders > 0).length, color: '#f59e0b', bg: '#fffbeb' },
                      { label: 'Ticket promedio', value: saRevenueSummary.total_orders > 0 ? `$${(saRevenueSummary.total_platform / saRevenueSummary.total_orders).toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '$0', color: '#8b5cf6', bg: '#f5f3ff' },
                    ].map(c => (
                      <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '14px 16px', border: `1px solid ${c.color}22` }}>
                        <div style={{ fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: c.color }}>{c.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {saRevenueLoading ? (
                  <div className="empty-state"><div>Cargando ingresos...</div></div>
                ) : saRevenue.length === 0 ? (
                  <div className="empty-state"><div>No hay datos</div></div>
                ) : isMobile ? (
                  /* Mobile cards */
                  <div className="sa-cards-list">
                    {saRevenue.map((s, idx) => (
                      <div key={s.id} className="sa-item-card">
                        <div className="sa-item-card-top">
                          <div className="sa-item-card-info">
                            <div className="sa-item-card-title">
                              <span style={{ color: '#D4AF37', fontWeight: 900, marginRight: 8 }}>#{idx + 1}</span>
                              {s.name}
                            </div>
                            <div className="sa-item-card-sub">{s.code ? `[${s.code}]` : ''} {s.is_banned ? '🚫 Baneada' : ''}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color: '#22c55e' }}>${s.total_revenue.toLocaleString('es', { minimumFractionDigits: 0 })}</div>
                            <div style={{ fontSize: 11, color: '#888' }}>{s.total_orders} pedido{s.total_orders !== 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <div className="sa-item-card-stats">
                          <span>Ticket prom: <strong>${s.avg_order.toLocaleString('es', { minimumFractionDigits: 0 })}</strong></span>
                          {s.last_order && <span>Último: <strong>{new Date(s.last_order).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' })}</strong></span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Desktop table */
                  <div className="admin-table-wrapper">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Tienda</th>
                          <th>Código</th>
                          <th>Pedidos</th>
                          <th>Ingresos</th>
                          <th>Ticket prom.</th>
                          <th>Último pedido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {saRevenue.map((s, idx) => (
                          <tr key={s.id}>
                            <td style={{ fontWeight: 900, color: idx < 3 ? '#D4AF37' : '#aaa', fontSize: 15 }}>{idx + 1}</td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{s.name}{s.is_banned ? <span style={{ marginLeft: 6, fontSize: 11, color: '#ef4444', background: '#fef2f2', padding: '2px 6px', borderRadius: 4 }}>Baneada</span> : null}</div>
                            </td>
                            <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{s.code || '—'}</span></td>
                            <td style={{ fontWeight: 700 }}>{s.total_orders.toLocaleString()}</td>
                            <td style={{ fontWeight: 900, fontSize: 16, color: '#22c55e' }}>${s.total_revenue.toLocaleString('es', { minimumFractionDigits: 0 })}</td>
                            <td style={{ color: '#6b7280' }}>${s.avg_order.toLocaleString('es', { minimumFractionDigits: 0 })}</td>
                            <td style={{ fontSize: 12, color: s.last_order ? '#374151' : '#d1d5db' }}>
                              {s.last_order ? new Date(s.last_order).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : activeTab === 'apps' ? (() => {
              const APP_COLS = [
                { key: 'has_delivery', label: 'Delivery', emoji: '🛵' },
                { key: 'has_tables', label: 'Mesas', emoji: '🍽️' },
                { key: 'has_attendance', label: 'Asistencia', emoji: '📸' },
                { key: 'has_workers', label: 'Vendedores', emoji: '👤' },
                { key: 'has_cash_register', label: 'Caja', emoji: '💰' },
                { key: 'has_tasks', label: 'Tareas', emoji: '✅' },
                { key: 'has_procedures', label: 'Proced.', emoji: '📋' },
                { key: 'has_coupons', label: 'Cupones', emoji: '🎫' },
                { key: 'has_leon_ia', label: 'León IA', emoji: '🤖' },
                { key: 'has_aforo', label: 'Aforo', emoji: '👥' },
                { key: 'has_instagram', label: 'Instagram', emoji: '📷' },
                { key: 'has_rappi', label: 'Rappi', emoji: '🟠' },
                { key: 'has_pedidosya', label: 'PedidosYa', emoji: '🟡' },
                { key: 'has_ubereats', label: 'UberEats', emoji: '⚫' },
              ];

              const filteredApps = userApps.filter(u =>
                !searchTerm ||
                u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.business_name?.toLowerCase().includes(searchTerm.toLowerCase())
              );

              const getScore = (u) => APP_COLS.filter(c => u[c.key] == 1).length;

              return (
                <div>
                  {/* Summary bar */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
                    {APP_COLS.map(col => {
                      const count = userApps.filter(u => u[col.key] == 1).length;
                      const pct = userApps.length ? Math.round(count / userApps.length * 100) : 0;
                      return (
                        <div key={col.key} style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px' }}>
                          <div style={{ fontSize: 18 }}>{col.emoji}</div>
                          <div style={{ fontSize: 11, color: '#888', fontWeight: 600, marginTop: 2 }}>{col.label}</div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#111', lineHeight: 1.2 }}>{count}</div>
                          <div style={{ fontSize: 10, color: pct >= 50 ? '#16a34a' : '#6b7280', fontWeight: 600 }}>{pct}% de cuentas</div>
                        </div>
                      );
                    })}
                  </div>

                  {isMobile ? (
                    <div className="sa-cards-list">
                      {filteredApps.map(u => {
                        const score = getScore(u);
                        const active = APP_COLS.filter(c => u[c.key] == 1);
                        return (
                          <div key={u.user_id} className="sa-item-card">
                            <div className="sa-item-card-top">
                              <div className="sa-item-card-info">
                                <div className="sa-item-card-title">{u.username}</div>
                                <div className="sa-item-card-sub">{u.email}</div>
                                {u.business_name && <div className="sa-item-card-sub">{u.business_name}</div>}
                              </div>
                              <span className="sa-apps-score" style={{ background: score >= 8 ? '#dcfce7' : score >= 4 ? '#fef9c3' : '#f3f4f6', color: score >= 8 ? '#166534' : score >= 4 ? '#854d0e' : '#6b7280' }}>
                                {score}/{APP_COLS.length}
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                              {active.map(c => (
                                <span key={c.key} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(34,197,94,0.1)', color: '#16a34a', fontWeight: 600 }}>
                                  {c.emoji} {c.label}
                                </span>
                              ))}
                              {active.length === 0 && <span style={{ fontSize: 11, color: '#aaa' }}>Sin apps activas</span>}
                            </div>
                          </div>
                        );
                      })}
                      {filteredApps.length === 0 && (
                        <div className="empty-state">
                          <FontAwesomeIcon icon={faThLarge} className="empty-state-icon" />
                          <div>No se encontraron cuentas</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="sa-apps-table">
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', minWidth: 140 }}>Usuario</th>
                            <th style={{ textAlign: 'left', minWidth: 180 }}>Email</th>
                            <th style={{ minWidth: 60 }}>Score</th>
                            {APP_COLS.map(c => (
                              <th key={c.key} title={c.label}>{c.emoji}<br /><span style={{ fontWeight: 500 }}>{c.label}</span></th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredApps.map(u => {
                            const score = getScore(u);
                            return (
                              <tr key={u.user_id}>
                                <td>
                                  <div style={{ fontWeight: 700, fontSize: 13 }}>{u.username}</div>
                                  {u.business_name && <div style={{ fontSize: 11, color: '#888' }}>{u.business_name}</div>}
                                </td>
                                <td style={{ fontSize: 12, color: '#555' }}>{u.email}</td>
                                <td>
                                  <span className="sa-apps-score" style={{ background: score >= 8 ? '#dcfce7' : score >= 4 ? '#fef9c3' : '#f3f4f6', color: score >= 8 ? '#166534' : score >= 4 ? '#854d0e' : '#6b7280' }}>
                                    {score}/{APP_COLS.length}
                                  </span>
                                </td>
                                {APP_COLS.map(c => (
                                  <td key={c.key}>
                                    <span className={`sa-app-chip ${u[c.key] == 1 ? 'on' : 'off'}`}>
                                      {u[c.key] == 1 ? '✓' : '·'}
                                    </span>
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {filteredApps.length === 0 && (
                        <div className="empty-state">
                          <FontAwesomeIcon icon={faThLarge} className="empty-state-icon" />
                          <div>No se encontraron cuentas</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })() : activeTab === 'screens' ? (() => {
              const sessions = presence.sessions || [];
              const totalStores = stores.length || 1;

              const PANELS = [
                { key: 'store', label: 'Store / Totem', icon: faStore, color: '#D4AF37', desc: 'Página pública del cliente' },
                { key: 'worker', label: 'Worker Panel', icon: faUserTie, color: '#3b82f6', desc: 'Panel de trabajadores' },
                { key: 'tv', label: 'Pantalla TV', icon: faTv, color: '#a855f7', desc: 'Display de pedidos para cocina' },
                { key: 'totem', label: 'Tótem Asistencia', icon: faChair, color: '#22c55e', desc: 'Registro de asistencia facial' },
              ];

              // Count unique stores per panel
              const uniqueStoresByPanel = {};
              PANELS.forEach(p => {
                uniqueStoresByPanel[p.key] = new Set(sessions.filter(s => s.panel === p.key).map(s => s.store_code));
              });

              // All unique active store codes
              const allActiveStoreCodes = new Set(sessions.map(s => s.store_code));

              // For each store in the stores list, which panels does it have active?
              const storePresence = stores.map(store => {
                const code = store.code;
                const active = PANELS.filter(p => uniqueStoresByPanel[p.key].has(code)).map(p => p.key);
                return { ...store, active_panels: active };
              }).filter(s => s.active_panels.length > 0);

              const totalActiveSessions = sessions.length;
              const totalActiveStores = allActiveStoreCodes.size;

              return (
                <div>
                  {/* Header stats */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'pulse 2s infinite', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#aaa' }}>
                      <strong style={{ color: '#fff' }}>{totalActiveSessions}</strong> sesiones activas en <strong style={{ color: '#fff' }}>{totalActiveStores}</strong> tiendas ({totalStores > 0 ? Math.round(totalActiveStores / totalStores * 100) : 0}% del total)
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#555' }}>Actualización en tiempo real vía socket</span>
                  </div>

                  {/* Panel summary cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
                    {PANELS.map(panel => {
                      const count = uniqueStoresByPanel[panel.key].size;
                      const sessionCount = sessions.filter(s => s.panel === panel.key).length;
                      const pct = totalStores > 0 ? Math.round(count / totalStores * 100) : 0;
                      return (
                        <div key={panel.key} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${count > 0 ? panel.color + '44' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, padding: '16px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: count > 0 ? panel.color + '22' : '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FontAwesomeIcon icon={panel.icon} style={{ color: count > 0 ? panel.color : '#555', fontSize: 14 }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{panel.label}</div>
                              <div style={{ fontSize: 10, color: '#666' }}>{panel.desc}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 28, fontWeight: 900, color: count > 0 ? panel.color : '#444', lineHeight: 1 }}>{count}</div>
                          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>tiendas activas {sessionCount !== count && `(${sessionCount} sesiones)`}</div>
                          <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: panel.color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                          </div>
                          <div style={{ fontSize: 10, color: panel.color, fontWeight: 700, marginTop: 3 }}>{pct}% del total</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Live sessions list */}
                  {storePresence.length === 0 ? (
                    <div className="empty-state">
                      <FontAwesomeIcon icon={faWifi} className="empty-state-icon" />
                      <div>Sin pantallas activas en este momento</div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Se actualizará automáticamente cuando alguna pantalla se conecte</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Tiendas con actividad — {storePresence.length}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {storePresence.map(store => (
                          <div key={store.code} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{store.name || store.code}</div>
                              <div style={{ fontSize: 11, color: '#666' }}>{store.user_email || store.code}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {PANELS.map(panel => {
                                const active = store.active_panels.includes(panel.key);
                                const sessionCount = sessions.filter(s => s.panel === panel.key && s.store_code === store.code).length;
                                if (!active) return null;
                                return (
                                  <span key={panel.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: panel.color + '22', color: panel.color, border: `1px solid ${panel.color}44` }}>
                                    <FontAwesomeIcon icon={panel.icon} style={{ fontSize: 10 }} />
                                    {panel.label}{sessionCount > 1 ? ` ×${sessionCount}` : ''}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Stores without any active panel */}
                      {totalStores - storePresence.length > 0 && (
                        <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, fontSize: 12, color: '#555' }}>
                          {totalStores - storePresence.length} tienda{totalStores - storePresence.length !== 1 ? 's' : ''} sin actividad en este momento
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })() : activeTab === 'product-stats' ? (
              <div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28, marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesomeIcon icon={faChartBar} style={{ color: '#D4AF37', fontSize: 20 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Reporte de Productos</div>
                      <div style={{ fontSize: 12, color: '#888' }}>Envía a cada dueño de tienda un reporte con sus productos más y menos vendidos del día anterior</div>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: '#D4AF37' }}>
                    <strong>Nota:</strong> Este reporte también se envía automáticamente todos los días a las 8:00 AM a cada tienda con ventas del día anterior.
                  </div>

                  <button
                    onClick={async () => {
                      if (sendingStats) return;
                      setSendingStats(true);
                      setStatsResult(null);
                      try {
                        const res = await fetch(`${API}/api/superadmin/send-product-stats`, {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${localStorage.getItem('superadminToken')}`, 'Content-Type': 'application/json' },
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setStatsResult({ success: true, ...data });
                        } else {
                          setStatsResult({ success: false, error: data.error || 'Error desconocido' });
                        }
                      } catch (err) {
                        setStatsResult({ success: false, error: err.message });
                      } finally {
                        setSendingStats(false);
                      }
                    }}
                    disabled={sendingStats}
                    style={{
                      background: sendingStats ? '#555' : 'linear-gradient(135deg, #D4AF37, #B8952D)',
                      color: '#000', border: 'none', borderRadius: 10, padding: '12px 28px',
                      fontSize: 14, fontWeight: 700, cursor: sendingStats ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    {sendingStats ? (
                      <>
                        <FontAwesomeIcon icon={faClock} spin />
                        Enviando reportes...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faEnvelope} />
                        Enviar estadísticas a todos
                      </>
                    )}
                  </button>

                  {statsResult && (
                    <div style={{
                      marginTop: 16, padding: '14px 18px', borderRadius: 10,
                      background: statsResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${statsResult.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      color: statsResult.success ? '#22c55e' : '#ef4444',
                      fontSize: 13, fontWeight: 600,
                    }}>
                      {statsResult.success ? (
                        <div>
                          <div style={{ marginBottom: 4 }}>Reportes enviados exitosamente</div>
                          <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.8 }}>
                            {statsResult.sent} email{statsResult.sent !== 1 ? 's' : ''} enviado{statsResult.sent !== 1 ? 's' : ''} · {statsResult.skipped} tienda{statsResult.skipped !== 1 ? 's' : ''} sin ventas (omitidas) · {statsResult.total} tiendas totales
                          </div>
                        </div>
                      ) : (
                        <div>Error: {statsResult.error}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'emails' ? (
              <div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 28, maxWidth: 640 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(212,175,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FontAwesomeIcon icon={faPaperPlane} style={{ color: '#D4AF37', fontSize: 20 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Redactar Email</div>
                      <div style={{ fontSize: 12, color: '#888' }}>Envía toda la información y ventajas de SRServi a quien quieras</div>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: '#D4AF37' }}>
                    <strong>Nota:</strong> El email siempre incluye toda la información y ventajas del sistema SRServi. Asunto y mensaje son opcionales: si los dejas vacíos, se usa el contenido completo por defecto; si escribes algo, se agrega como extra junto con esa información.
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Destinatario(s)
                    </label>
                    <input
                      type="text"
                      value={customEmailTo}
                      onChange={e => setCustomEmailTo(e.target.value)}
                      placeholder="cliente@ejemplo.com (separa varios con coma)"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Asunto <span style={{ textTransform: 'none', fontWeight: 400, color: '#666' }}>(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={customEmailSubject}
                      onChange={e => setCustomEmailSubject(e.target.value)}
                      placeholder="Si lo dejas vacío se usa: “SRServi — El sistema todo-en-uno para tu negocio”"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Mensaje extra <span style={{ textTransform: 'none', fontWeight: 400, color: '#666' }}>(opcional)</span>
                    </label>
                    <textarea
                      value={customEmailMessage}
                      onChange={e => setCustomEmailMessage(e.target.value)}
                      rows={8}
                      placeholder="Si quieres agregar algo además de la info completa del sistema, escríbelo aquí. Separa los párrafos con una línea en blanco. Si lo dejas vacío, solo se envía la información completa de SRServi."
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, fontFamily: 'inherit' }}
                    />
                  </div>

                  <button
                    onClick={async () => {
                      if (sendingCustomEmail) return;
                      if (!customEmailTo.trim()) {
                        setCustomEmailResult({ success: false, error: 'Indica al menos un destinatario' });
                        return;
                      }
                      setSendingCustomEmail(true);
                      setCustomEmailResult(null);
                      try {
                        const res = await fetch(`${API}/api/superadmin/send-custom-email`, {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${localStorage.getItem('superadminToken')}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ to: customEmailTo.trim(), subject: customEmailSubject.trim(), message: customEmailMessage.trim() })
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setCustomEmailResult({ success: true, ...data });
                          setCustomEmailTo('');
                          setCustomEmailSubject('');
                          setCustomEmailMessage('');
                        } else {
                          setCustomEmailResult({ success: false, error: data.error || 'Error desconocido' });
                        }
                      } catch (err) {
                        setCustomEmailResult({ success: false, error: err.message });
                      } finally {
                        setSendingCustomEmail(false);
                      }
                    }}
                    disabled={sendingCustomEmail}
                    style={{
                      background: sendingCustomEmail ? '#555' : 'linear-gradient(135deg, #D4AF37, #B8952D)',
                      color: '#000', border: 'none', borderRadius: 10, padding: '12px 28px',
                      fontSize: 14, fontWeight: 700, cursor: sendingCustomEmail ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    {sendingCustomEmail ? (
                      <>
                        <FontAwesomeIcon icon={faClock} spin />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faPaperPlane} />
                        Enviar email
                      </>
                    )}
                  </button>

                  {customEmailResult && (
                    <div style={{
                      marginTop: 16, padding: '14px 18px', borderRadius: 10,
                      background: customEmailResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${customEmailResult.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      color: customEmailResult.success ? '#22c55e' : '#ef4444',
                      fontSize: 13, fontWeight: 600,
                    }}>
                      {customEmailResult.success ? (
                        <div>Email enviado a {customEmailResult.sent} destinatario{customEmailResult.sent !== 1 ? 's' : ''}</div>
                      ) : (
                        <div>Error: {customEmailResult.error}</div>
                      )}
                    </div>
                  )}
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
