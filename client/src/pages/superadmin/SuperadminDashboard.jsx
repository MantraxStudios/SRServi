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
  faCircle
} from '@fortawesome/free-solid-svg-icons';

function SuperadminDashboard() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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
  const [myProfile, setMyProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileAvatar, setProfileAvatar] = useState(null);
  const navigate = useNavigate();
  const selectedTicketRef = useRef(null);
  const saMsgEndRef = useRef(null);

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

  // Socket.io for realtime ticket messages
  useEffect(() => {
    const socket = io(API);
    const tk = localStorage.getItem('superadminToken');
    const reloadTicketMsgs = async (ticketId) => {
      if (!tk) return;
      try {
        const res = await fetch(API + `/api/superadmin/tickets/${ticketId}/messages`, { headers: { Authorization: 'Bearer ' + tk } });
        if (res.ok) { const d = await res.json(); setTicketDetail(d.ticket); setTicketMessages(d.messages); setTimeout(() => saMsgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }
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

  const filteredStores = stores.filter(store =>
    store.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.user_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalUsers: users.length,
    bannedUsers: users.filter(u => u.is_banned).length,
    totalStores: stores.length,
    bannedStores: stores.filter(s => s.is_banned).length,
    activeUsers: users.filter(u => !u.is_banned).length,
    activeStores: stores.filter(s => !s.is_banned).length
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
                {activeTab === 'users' ? 'Usuarios' : activeTab === 'stores' ? 'Tiendas' : activeTab === 'workshop' ? 'Workshop - Plugins' : activeTab === 'tickets' ? 'Tickets de Soporte' : activeTab === 'admins' ? 'Superadministradores' : 'Suscripciones'}
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
                      <th className="text-center hide-mobile">Ultima Actividad</th>
                      <th className="text-center">Estado</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
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
                          <span className={`badge badge-activity-${getActivityStatus(user.last_active)}`}>
                            {formatLastActive(user.last_active)}
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
                    ))}
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
              <div className="admin-table-wrapper">
                <table className="table admin-table">
                  <thead>
                    <tr>
                      <th className="hide-mobile">Tienda</th>
                      <th>Propietario</th>
                      <th className="text-center hide-mobile">Productos</th>
                      <th className="text-center hide-mobile">Ordenes</th>
                      <th className="text-center">Estado</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStores.map(store => (
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
                          <span className="badge badge-gold">
                            {store.product_count}
                          </span>
                        </td>
                        <td className="text-center hide-mobile">
                          <span className="badge badge-dark">
                            {store.order_count}
                          </span>
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
                    ))}
                  </tbody>
                </table>
                {filteredStores.length === 0 && (
                  <div className="empty-state">
                    <FontAwesomeIcon icon={faStore} className="empty-state-icon" />
                    <div>No se encontraron tiendas</div>
                  </div>
                )}
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
                          >
                            Ver
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
                {workshopPlugins.length === 0 ? (
                  <div className="empty-state">
                    <FontAwesomeIcon icon={faPuzzlePiece} className="empty-state-icon" />
                    <div>No hay plugins en el workshop</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
                    {workshopPlugins.map(plugin => (
                      <div key={plugin.plugin_id} style={{
                        background: '#fff', border: '2px solid #e0e0e0', borderRadius: '12px', padding: '16px',
                        borderColor: plugin.status === 'pending' ? '#ffc107' : plugin.status === 'approved' ? '#28a745' : '#dc3545'
                      }}>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                          {plugin.logo ? (
                            <img src={API + plugin.logo} alt="" style={{ width: '50px', height: '50px', borderRadius: '10px', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '50px', height: '50px', borderRadius: '10px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#ccc' }}>
                              <FontAwesomeIcon icon={faPuzzlePiece} />
                            </div>
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '700', fontSize: '16px' }}>{plugin.name}</div>
                            <div style={{ fontSize: '12px', color: '#999' }}>{plugin.plugin_id}</div>
                            <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>
                              <FontAwesomeIcon icon={faUsers} /> {plugin.author}
                            </div>
                          </div>
                        </div>

                        {plugin.description && <p style={{ fontSize: '14px', color: '#555', margin: '0 0 10px' }}>{plugin.description}</p>}

                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                          <div><FontAwesomeIcon icon={faEnvelope} /> {plugin.contact_email}</div>
                          <div><FontAwesomeIcon icon={faDownload} /> {plugin.downloads || 0} descargas</div>
                        </div>

                        <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>
                          Versiones ({(plugin.versions || []).length})
                        </div>

                        {(plugin.versions || []).map(v => {
                          const sc = { pending: { bg: '#fff3cd', c: '#856404' }, approved: { bg: '#d4edda', c: '#155724' }, rejected: { bg: '#f8d7da', c: '#721c24' } }[v.status] || { bg: '#fff3cd', c: '#856404' };
                          return (
                            <div key={v.version} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '8px', marginBottom: '6px', borderRadius: '8px', background: '#fafafa', border: '1px solid #eee'
                            }}>
                              <div>
                                <strong>v{v.version}</strong>
                                {v.changelog && <span style={{ color: '#666', marginLeft: '6px', fontSize: '12px' }}>— {v.changelog}</span>}
                                <div style={{ fontSize: '11px', color: '#999' }}>{new Date(v.created_at).toLocaleDateString('es-ES')}</div>
                                {v.zip_path && (
                                  <a href={API + v.zip_path} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#0066cc' }}>
                                    <FontAwesomeIcon icon={faEye} /> ZIP
                                  </a>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '700', background: sc.bg, color: sc.c }}>
                                  {v.status === 'pending' ? 'Pendiente' : v.status === 'approved' ? 'OK' : 'Rechazado'}
                                </span>
                                {v.status !== 'approved' && (
                                  <button className="btn btn-sm" style={{ background: '#28a745', color: '#fff', border: 'none', padding: '4px 8px', fontSize: '11px' }}
                                    onClick={() => handleWorkshopVersionStatus(plugin.plugin_id, v.version, 'approved')}>
                                    <FontAwesomeIcon icon={faCheck} />
                                  </button>
                                )}
                                {v.status !== 'rejected' && (
                                  <button className="btn btn-sm" style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '4px 8px', fontSize: '11px' }}
                                    onClick={() => handleWorkshopVersionStatus(plugin.plugin_id, v.version, 'rejected')}>
                                    <FontAwesomeIcon icon={faTimes} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
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
              <div style={{ display: 'flex', gap: '16px', height: 'calc(100vh - 200px)' }}>
                {/* Ticket list */}
                <div style={{ width: '320px', flexShrink: 0, overflowY: 'auto' }}>
                  {tickets.map(t => {
                    const prColors = { low: '#95a5a6', normal: '#3498db', important: '#f39c12', urgent: '#e74c3c' };
                    const prLabels = { low: 'Leve', normal: 'Normal', important: 'Importante', urgent: 'Urgente' };
                    return (
                      <div key={t.id} onClick={async () => {
                        setSelectedTicketId(t.id);
                        const token = localStorage.getItem('superadminToken');
                        const res = await fetch(API + `/api/superadmin/tickets/${t.id}/messages`, { headers: { Authorization: 'Bearer ' + token } });
                        if (res.ok) { const d = await res.json(); setTicketDetail(d.ticket); setTicketMessages(d.messages); setTimeout(() => saMsgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }
                      }} style={{ padding: '12px', borderRadius: '10px', marginBottom: '6px', cursor: 'pointer', border: selectedTicketId === t.id ? '2px solid #333' : '2px solid transparent', background: selectedTicketId === t.id ? '#f0f4ff' : '#fafafa' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontWeight: '700', fontSize: '13px' }}>#{t.id} - {t.username}</span>
                          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: '700', background: (prColors[t.priority] || '#3498db') + '22', color: prColors[t.priority] || '#3498db' }}>{prLabels[t.priority] || t.priority}</span>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{t.subject}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginTop: '4px' }}>
                          <span style={{ color: t.status === 'open' ? '#2ecc71' : t.status === 'resolved' ? '#9b59b6' : '#95a5a6' }}>
                            <FontAwesomeIcon icon={faCircle} style={{ fontSize: '6px', marginRight: '3px' }} />
                            {t.status === 'open' ? 'Abierto' : t.status === 'resolved' ? 'Resuelto' : 'Cerrado'}
                          </span>
                          <span>{t.business_name || t.email}</span>
                        </div>
                      </div>
                    );
                  })}
                  {tickets.length === 0 && <p style={{ textAlign: 'center', color: '#999' }}>Sin tickets</p>}
                </div>

                {/* Chat */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
                  {!selectedTicketId ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                      <FontAwesomeIcon icon={faTicketAlt} style={{ fontSize: '48px' }} />
                    </div>
                  ) : (
                    <>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: '700' }}>#{ticketDetail?.id} - {ticketDetail?.subject}</div>
                          <div style={{ fontSize: '11px', color: '#888' }}>{ticketDetail?.username} ({ticketDetail?.email}) | <FontAwesomeIcon icon={faLock} /> PIN: {ticketDetail?.support_pin}</div>
                        </div>
                        {ticketDetail?.status !== 'resolved' && (
                          <button onClick={async () => {
                            const token = localStorage.getItem('superadminToken');
                            await fetch(API + `/api/superadmin/tickets/${selectedTicketId}/resolve`, { method: 'PUT', headers: { Authorization: 'Bearer ' + token } });
                            fetchData();
                            const res = await fetch(API + `/api/superadmin/tickets/${selectedTicketId}/messages`, { headers: { Authorization: 'Bearer ' + token } });
                            if (res.ok) { const d = await res.json(); setTicketDetail(d.ticket); }
                          }} className="btn btn-sm" style={{ background: '#9b59b6', color: '#fff', border: 'none' }}>
                            <FontAwesomeIcon icon={faCheck} /> Resolver
                          </button>
                        )}
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {ticketMessages.map(m => (
                          <div key={m.id} style={{ alignSelf: m.sender_type === 'admin' ? 'flex-end' : 'flex-start', maxWidth: '80%', display: 'flex', gap: '8px', flexDirection: m.sender_type === 'admin' ? 'row-reverse' : 'row' }}>
                            {m.sender_avatar && (
                              <div style={{ flexShrink: 0, marginTop: '2px' }}>
                                <img src={API + m.sender_avatar} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                              </div>
                            )}
                            {!m.sender_avatar && m.sender_type === 'admin' && (
                              <div style={{ flexShrink: 0, marginTop: '2px', width: '28px', height: '28px', borderRadius: '50%', background: m.sender_name === 'SRServi Bot' ? '#e8f5e9' : '#f3e5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: m.sender_name === 'SRServi Bot' ? '#4caf50' : '#9b59b6' }}>
                                <FontAwesomeIcon icon={faShieldAlt} />
                              </div>
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ padding: '10px 14px', borderRadius: m.sender_type === 'admin' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.sender_type === 'admin' ? '#333' : m.sender_name === 'SRServi Bot' ? '#e8f5e9' : '#f0f0f0', color: m.sender_type === 'admin' ? '#fff' : '#333', fontSize: '14px' }}>
                                {m.message}
                                {m.image && (
                                  <div>
                                    <img src={API + m.image} alt="" style={{ maxWidth: '200px', borderRadius: '8px', marginTop: '6px' }} />
                                    {m.image_admin_only ? <span style={{ fontSize: '10px', color: '#ff6b6b' }}> (solo admin)</span> : null}
                                  </div>
                                )}
                              </div>
                              <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px', textAlign: m.sender_type === 'admin' ? 'right' : 'left' }}>
                                {m.sender_name} - {new Date(m.created_at).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div ref={saMsgEndRef} />
                      </div>
                      {ticketDetail?.status !== 'resolved' && (
                        <div style={{ padding: '12px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <label style={{ cursor: 'pointer', color: '#888', fontSize: '18px' }}>
                            <FontAwesomeIcon icon={faImage} />
                            <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) setTicketImg(e.target.files[0]); }} style={{ display: 'none' }} />
                          </label>
                          <label style={{ fontSize: '11px', color: ticketAdminOnly ? '#e74c3c' : '#aaa', cursor: 'pointer' }}>
                            <input type="checkbox" checked={ticketAdminOnly} onChange={(e) => setTicketAdminOnly(e.target.checked)} style={{ marginRight: '4px' }} />
                            Img solo admin
                          </label>
                          <input type="text" value={ticketMsg} onChange={(e) => setTicketMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') {
                            const token = localStorage.getItem('superadminToken');
                            const fd = new FormData();
                            fd.append('message', ticketMsg.trim());
                            if (ticketImg) fd.append('image', ticketImg);
                            fd.append('admin_only', ticketAdminOnly ? 'true' : 'false');
                            setTicketSending(true);
                            fetch(API + `/api/superadmin/tickets/${selectedTicketId}/messages`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd })
                              .then(() => fetch(API + `/api/superadmin/tickets/${selectedTicketId}/messages`, { headers: { Authorization: 'Bearer ' + token } }))
                              .then(r => r.json()).then(d => { setTicketMessages(d.messages); setTicketMsg(''); setTicketImg(null); setTicketAdminOnly(false); setTimeout(() => saMsgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); })
                              .finally(() => setTicketSending(false));
                          }}} placeholder="Responder..." style={{ flex: 1, padding: '10px', border: '2px solid #e0e0e0', borderRadius: '10px', outline: 'none' }} />
                          <button disabled={ticketSending || (!ticketMsg.trim() && !ticketImg)} onClick={() => {
                            const token = localStorage.getItem('superadminToken');
                            const fd = new FormData();
                            fd.append('message', ticketMsg.trim());
                            if (ticketImg) fd.append('image', ticketImg);
                            fd.append('admin_only', ticketAdminOnly ? 'true' : 'false');
                            setTicketSending(true);
                            fetch(API + `/api/superadmin/tickets/${selectedTicketId}/messages`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd })
                              .then(() => fetch(API + `/api/superadmin/tickets/${selectedTicketId}/messages`, { headers: { Authorization: 'Bearer ' + token } }))
                              .then(r => r.json()).then(d => { setTicketMessages(d.messages); setTicketMsg(''); setTicketImg(null); setTicketAdminOnly(false); setTimeout(() => saMsgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); })
                              .finally(() => setTicketSending(false));
                          }} style={{ background: '#333', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 16px', cursor: 'pointer' }}>
                            <FontAwesomeIcon icon={faPaperPlane} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

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
    </div>
  );
}

export default SuperadminDashboard;
