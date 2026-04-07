import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const API = 'https://srservi2.srautomatic.com';

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
  faEye
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
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('superadminToken');
    if (!token) {
      navigate('/superadmin/login');
    }
  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

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
        </nav>

        <div className="sidebar-footer">
          <div
            className="sidebar-nav-item logout"
            onClick={handleLogout}
          >
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
                {activeTab === 'users' ? 'Usuarios' : activeTab === 'stores' ? 'Tiendas' : activeTab === 'workshop' ? 'Workshop - Plugins' : 'Suscripciones'}
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
    </div>
  );
}

export default SuperadminDashboard;
