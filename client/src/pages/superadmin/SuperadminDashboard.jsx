import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
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
  faTimes
} from '@fortawesome/free-solid-svg-icons';

const COLORS = {
  black: '#000000',
  white: '#FFFFFF',
  gold: '#D4AF37',
  goldLight: '#E5C158',
  goldDark: '#B8962E',
  grayLight: '#F5F5F5',
  gray: '#CCCCCC',
  grayDark: '#666666',
  success: '#28a745',
  danger: '#DC3545',
  warning: '#f57c00'
};

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

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('superadminToken');
    
    try {
      if (activeTab === 'users') {
        const res = await fetch('http://localhost:3001/api/superadmin/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setUsers(data);
      } else if (activeTab === 'stores') {
        const res = await fetch('http://localhost:3001/api/superadmin/stores', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setStores(data);
      } else if (activeTab === 'subscriptions') {
        const res = await fetch('http://localhost:3001/api/superadmin/subscriptions', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        console.log('📋 Datos de suscripciones:', data);
        setSubscriptions(Array.isArray(data) ? data : []);
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
      const res = await fetch(`http://localhost:3001/api/superadmin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      const res = await fetch(`http://localhost:3001/api/superadmin/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      const res = await fetch(`http://localhost:3001/api/superadmin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
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
      const res = await fetch(`http://localhost:3001/api/superadmin/stores/${store.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      const res = await fetch(`http://localhost:3001/api/superadmin/stores/${storeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        setShowDeleteConfirm(null);
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting store:', error);
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
    if (!date) return { color: COLORS.grayDark, bg: COLORS.grayLight };
    const now = new Date();
    const lastActive = new Date(date);
    const diffMs = now - lastActive;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 5) return { color: COLORS.success, bg: 'rgba(40,167,69,0.1)' };
    if (diffMins < 60) return { color: COLORS.gold, bg: 'rgba(212,175,55,0.2)' };
    if (diffMins < 1440) return { color: '#1976d2', bg: 'rgba(25,118,210,0.1)' };
    return { color: COLORS.grayDark, bg: COLORS.grayLight };
  };

  const sidebarStyle = {
    width: sidebarOpen ? '260px' : '70px',
    minHeight: '100vh',
    backgroundColor: COLORS.black,
    color: COLORS.white,
    transition: 'width 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    left: 0,
    top: 0,
    zIndex: 100
  };

  const mainStyle = {
    marginLeft: sidebarOpen ? '260px' : '70px',
    transition: 'margin-left 0.3s ease',
    minHeight: '100vh',
    backgroundColor: COLORS.grayLight
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div style={sidebarStyle}>
        <div style={{
          padding: '20px',
          borderBottom: `1px solid ${COLORS.gold}`,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            backgroundColor: COLORS.gold,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FontAwesomeIcon icon={faShieldAlt} style={{ color: COLORS.black, fontSize: '20px' }} />
          </div>
          {sidebarOpen && (
            <div>
              <div style={{ fontWeight: '700', fontSize: '16px' }}>Superadmin</div>
              <div style={{ fontSize: '11px', color: COLORS.gold }}>Panel de Control</div>
            </div>
          )}
        </div>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: COLORS.gold,
            padding: '12px 20px',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '18px'
          }}
        >
          <FontAwesomeIcon icon={sidebarOpen ? faTimes : faBars} />
          {sidebarOpen && <span style={{ fontSize: '14px' }}>Cerrar</span>}
        </button>

        <nav style={{ flex: 1, padding: '10px' }}>
          <div 
            onClick={() => setActiveTab('users')}
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: activeTab === 'users' ? COLORS.gold : 'transparent',
              color: activeTab === 'users' ? COLORS.black : COLORS.white,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px',
              transition: 'all 0.2s ease',
              fontWeight: activeTab === 'users' ? '600' : '400'
            }}
          >
            <FontAwesomeIcon icon={faUsers} style={{ fontSize: '18px' }} />
            {sidebarOpen && <span>Usuarios</span>}
          </div>

          <div 
            onClick={() => setActiveTab('stores')}
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: activeTab === 'stores' ? COLORS.gold : 'transparent',
              color: activeTab === 'stores' ? COLORS.black : COLORS.white,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.2s ease',
              fontWeight: activeTab === 'stores' ? '600' : '400'
            }}
          >
            <FontAwesomeIcon icon={faStore} style={{ fontSize: '18px' }} />
            {sidebarOpen && <span>Tiendas</span>}
          </div>

          <div 
            onClick={() => setActiveTab('subscriptions')}
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: activeTab === 'subscriptions' ? COLORS.gold : 'transparent',
              color: activeTab === 'subscriptions' ? COLORS.black : COLORS.white,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.2s ease',
              fontWeight: activeTab === 'subscriptions' ? '600' : '400'
            }}
          >
            <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: '18px' }} />
            {sidebarOpen && <span>Suscripciones</span>}
          </div>
        </nav>

        <div style={{ padding: '20px', borderTop: `1px solid ${COLORS.gold}` }}>
          <div 
            onClick={handleLogout}
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: 'transparent',
              color: COLORS.danger,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.2s ease'
            }}
          >
            <FontAwesomeIcon icon={faSignOutAlt} style={{ fontSize: '18px' }} />
            {sidebarOpen && <span>Cerrar Sesión</span>}
          </div>
        </div>
      </div>

      <div style={mainStyle}>
        <header style={{
          backgroundColor: COLORS.white,
          padding: '20px 30px',
          borderBottom: `2px solid ${COLORS.grayLight}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              color: COLORS.black,
              marginBottom: '4px'
            }}>
              {activeTab === 'users' ? 'Gestión de Usuarios' : activeTab === 'stores' ? 'Gestión de Tiendas' : 'Suscripciones'}
            </h1>
            <p style={{ color: COLORS.grayDark, fontSize: '14px' }}>
              {activeTab === 'users' ? 'Administra las cuentas de usuarios' : activeTab === 'stores' ? 'Administra todas las tiendas' : 'Ver todas las suscripciones de usuarios'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{
              backgroundColor: COLORS.black,
              color: COLORS.white,
              padding: '10px 20px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FontAwesomeIcon icon={faUsers} />
              <span style={{ fontWeight: '600' }}>{stats.totalUsers}</span>
              <span style={{ color: COLORS.gray }}>Usuarios</span>
            </div>
            <div style={{
              backgroundColor: COLORS.gold,
              color: COLORS.black,
              padding: '10px 20px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FontAwesomeIcon icon={faStore} />
              <span style={{ fontWeight: '600' }}>{stats.totalStores}</span>
              <span style={{ color: COLORS.black, opacity: 0.7 }}>Tiendas</span>
            </div>
            <div style={{
              backgroundColor: COLORS.success,
              color: COLORS.white,
              padding: '10px 20px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FontAwesomeIcon icon={faCreditCard} />
              <span style={{ fontWeight: '600' }}>{subscriptions.length}</span>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Subs</span>
            </div>
          </div>
        </header>

        <div style={{ padding: '30px' }}>
          <div style={{
            backgroundColor: COLORS.white,
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{
                  padding: '8px 16px',
                  backgroundColor: COLORS.success,
                  color: COLORS.white,
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '600'
                }}>
                  {activeTab === 'users' ? stats.activeUsers : stats.activeStores} Activos
                </div>
                <div style={{
                  padding: '8px 16px',
                  backgroundColor: COLORS.danger,
                  color: COLORS.white,
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '600'
                }}>
                  {activeTab === 'users' ? stats.bannedUsers : stats.bannedStores} Baneados
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <FontAwesomeIcon 
                  icon={faSearch} 
                  style={{ 
                    position: 'absolute', 
                    left: '14px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: COLORS.grayDark
                  }} 
                />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '12px 16px',
                    paddingLeft: '44px',
                    borderRadius: '12px',
                    border: `2px solid ${COLORS.grayLight}`,
                    width: '300px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = COLORS.gold}
                  onBlur={(e) => e.target.style.borderColor = COLORS.grayLight}
                />
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: COLORS.grayDark }}>
                <div style={{ fontSize: '18px' }}>Cargando datos...</div>
              </div>
            ) : activeTab === 'users' ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${COLORS.grayLight}` }}>
                      <th style={{ textAlign: 'left', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Usuario</th>
                      <th style={{ textAlign: 'left', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Empresa</th>
                      <th style={{ textAlign: 'center', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Tiendas</th>
                      <th style={{ textAlign: 'center', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Última Actividad</th>
                      <th style={{ textAlign: 'center', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Estado</th>
                      <th style={{ textAlign: 'center', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.id} style={{ borderBottom: `1px solid ${COLORS.grayLight}`, transition: 'background-color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.grayLight}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={{ padding: '16px 12px' }}>
                          <div style={{ fontWeight: '600', color: COLORS.black }}>{user.username}</div>
                          <div style={{ fontSize: '12px', color: COLORS.grayDark }}>Code: {user.code}</div>
                        </td>
                        <td style={{ padding: '16px 12px', color: COLORS.grayDark }}>{user.email}</td>
                        <td style={{ padding: '16px 12px', color: COLORS.grayDark }}>{user.business_name || '-'}</td>
                        <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                          <span style={{
                            backgroundColor: COLORS.gold,
                            color: COLORS.black,
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {user.store_count}
                          </span>
                        </td>
                        <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                          {(() => {
                            const status = getActivityStatus(user.last_active);
                            return (
                              <span style={{
                                backgroundColor: status.bg,
                                color: status.color,
                                padding: '6px 14px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}>
                                {formatLastActive(user.last_active)}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                          {user.is_banned ? (
                            <span style={{
                              backgroundColor: COLORS.danger,
                              color: COLORS.white,
                              padding: '6px 14px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              Baneado
                            </span>
                          ) : (
                            <span style={{
                              backgroundColor: COLORS.success,
                              color: COLORS.white,
                              padding: '6px 14px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              Activo
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleEditUser(user)}
                            style={{
                              backgroundColor: COLORS.grayLight,
                              border: 'none',
                              color: COLORS.black,
                              cursor: 'pointer',
                              padding: '10px',
                              borderRadius: '10px',
                              marginRight: '8px',
                              transition: 'all 0.2s'
                            }}
                            title="Editar"
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.gold; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = COLORS.grayLight; }}
                          >
                            <FontAwesomeIcon icon={faEdit} style={{ fontSize: '14px' }} />
                          </button>
                          <button
                            onClick={() => handleToggleBanUser(user)}
                            style={{
                              backgroundColor: user.is_banned ? 'rgba(40,167,69,0.1)' : 'rgba(245,124,0,0.1)',
                              border: 'none',
                              color: user.is_banned ? COLORS.success : COLORS.warning,
                              cursor: 'pointer',
                              padding: '10px',
                              borderRadius: '10px',
                              marginRight: '8px',
                              transition: 'all 0.2s'
                            }}
                            title={user.is_banned ? 'Desbanear' : 'Banear'}
                          >
                            <FontAwesomeIcon icon={user.is_banned ? faCheck : faBan} style={{ fontSize: '14px' }} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm({ type: 'user', id: user.id, name: user.username })}
                            style={{
                              backgroundColor: 'rgba(220,53,69,0.1)',
                              border: 'none',
                              color: COLORS.danger,
                              cursor: 'pointer',
                              padding: '10px',
                              borderRadius: '10px',
                              transition: 'all 0.2s'
                            }}
                            title="Eliminar"
                          >
                            <FontAwesomeIcon icon={faTrash} style={{ fontSize: '14px' }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px', color: COLORS.grayDark }}>
                    <FontAwesomeIcon icon={faUsers} style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }} />
                    <div style={{ fontSize: '16px' }}>No se encontraron usuarios</div>
                  </div>
                )}
              </div>
            ) : activeTab === 'stores' ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${COLORS.grayLight}` }}>
                      <th style={{ textAlign: 'left', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Tienda</th>
                      <th style={{ textAlign: 'left', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Propietario</th>
                      <th style={{ textAlign: 'center', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Productos</th>
                      <th style={{ textAlign: 'center', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Órdenes</th>
                      <th style={{ textAlign: 'center', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Estado</th>
                      <th style={{ textAlign: 'center', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStores.map(store => (
                      <tr key={store.id} style={{ borderBottom: `1px solid ${COLORS.grayLight}`, transition: 'background-color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.grayLight}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={{ padding: '16px 12px' }}>
                          <div style={{ fontWeight: '600', color: COLORS.black }}>{store.name}</div>
                          <div style={{ fontSize: '12px', color: COLORS.grayDark }}>Code: {store.code}</div>
                        </td>
                        <td style={{ padding: '16px 12px' }}>
                          <div style={{ color: COLORS.grayDark }}>{store.user_email}</div>
                          <div style={{ fontSize: '12px', color: COLORS.grayDark }}>{store.user_business || '-'}</div>
                        </td>
                        <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                          <span style={{
                            backgroundColor: COLORS.gold,
                            color: COLORS.black,
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {store.product_count}
                          </span>
                        </td>
                        <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                          <span style={{
                            backgroundColor: COLORS.black,
                            color: COLORS.white,
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {store.order_count}
                          </span>
                        </td>
                        <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                          {store.is_banned ? (
                            <span style={{
                              backgroundColor: COLORS.danger,
                              color: COLORS.white,
                              padding: '6px 14px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              Baneada
                            </span>
                          ) : (
                            <span style={{
                              backgroundColor: COLORS.success,
                              color: COLORS.white,
                              padding: '6px 14px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              Activa
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleToggleBanStore(store)}
                            style={{
                              backgroundColor: store.is_banned ? 'rgba(40,167,69,0.1)' : 'rgba(245,124,0,0.1)',
                              border: 'none',
                              color: store.is_banned ? COLORS.success : COLORS.warning,
                              cursor: 'pointer',
                              padding: '10px',
                              borderRadius: '10px',
                              marginRight: '8px',
                              transition: 'all 0.2s'
                            }}
                            title={store.is_banned ? 'Desbanear' : 'Banear'}
                          >
                            <FontAwesomeIcon icon={store.is_banned ? faCheck : faBan} style={{ fontSize: '14px' }} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm({ type: 'store', id: store.id, name: store.name })}
                            style={{
                              backgroundColor: 'rgba(220,53,69,0.1)',
                              border: 'none',
                              color: COLORS.danger,
                              cursor: 'pointer',
                              padding: '10px',
                              borderRadius: '10px',
                              transition: 'all 0.2s'
                            }}
                            title="Eliminar"
                          >
                            <FontAwesomeIcon icon={faTrash} style={{ fontSize: '14px' }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredStores.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px', color: COLORS.grayDark }}>
                    <FontAwesomeIcon icon={faStore} style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }} />
                    <div style={{ fontSize: '16px' }}>No se encontraron tiendas</div>
                  </div>
                )}
              </div>
            ) : activeTab === 'subscriptions' ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${COLORS.grayLight}` }}>
                      <th style={{ textAlign: 'left', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Usuario</th>
                      <th style={{ textAlign: 'left', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Plan</th>
                      <th style={{ textAlign: 'center', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Ciclo</th>
                      <th style={{ textAlign: 'center', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Precio</th>
                      <th style={{ textAlign: 'center', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Inicio</th>
                      <th style={{ textAlign: 'center', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Vencimiento</th>
                      <th style={{ textAlign: 'center', padding: '14px 12px', color: COLORS.grayDark, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map(sub => (
                      <tr key={sub.user_id} style={{ borderBottom: `1px solid ${COLORS.grayLight}`, transition: 'background-color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.grayLight}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={{ padding: '16px 12px' }}>
                          <div style={{ fontWeight: '600', color: COLORS.black }}>{sub.username}</div>
                          <div style={{ fontSize: '12px', color: COLORS.grayDark }}>{sub.business_name || '-'}</div>
                        </td>
                        <td style={{ padding: '16px 12px', color: COLORS.grayDark }}>{sub.email}</td>
                        <td style={{ padding: '16px 12px' }}>
                          <span style={{
                            backgroundColor: sub.plan_name === 'Gratis' || !sub.plan_name ? COLORS.gray : COLORS.gold,
                            color: COLORS.black,
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {sub.plan_name || 'Gratis'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                          <span style={{
                            backgroundColor: COLORS.black,
                            color: COLORS.white,
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600',
                            textTransform: 'capitalize'
                          }}>
                            {sub.billing_cycle === 'monthly' ? 'Mensual' : sub.billing_cycle === 'yearly' ? 'Anual' : '-'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                          <div style={{ fontWeight: '600', color: COLORS.black }}>
                            {!sub.plan_name || sub.plan_name === 'Gratis' ? 'Gratis' : 
                              sub.billing_cycle === 'monthly' 
                                ? `$${sub.price_monthly}/mes` 
                                : `$${sub.price_yearly}/año`}
                          </div>
                        </td>
                        <td style={{ padding: '16px 12px', textAlign: 'center', color: COLORS.grayDark, fontSize: '13px' }}>
                          {sub.starts_at ? new Date(sub.starts_at).toLocaleDateString('es-ES') : sub.user_created_at ? new Date(sub.user_created_at).toLocaleDateString('es-ES') : '-'}
                        </td>
                        <td style={{ padding: '16px 12px', textAlign: 'center', color: COLORS.grayDark, fontSize: '13px' }}>
                          {sub.ends_at ? new Date(sub.ends_at).toLocaleDateString('es-ES') : '-'}
                        </td>
                        <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                          {sub.is_active && sub.ends_at && new Date(sub.ends_at) > new Date() ? (
                            <span style={{
                              backgroundColor: COLORS.success,
                              color: COLORS.white,
                              padding: '6px 14px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              Activa
                            </span>
                          ) : (
                            <span style={{
                              backgroundColor: COLORS.danger,
                              color: COLORS.white,
                              padding: '6px 14px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              Vencida
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {subscriptions.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px', color: COLORS.grayDark }}>
                    <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }} />
                    <div style={{ fontSize: '16px' }}>No hay suscripciones</div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {showEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: COLORS.white,
            borderRadius: '20px',
            padding: '32px',
            width: '450px',
            maxWidth: '90%'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '20px', fontWeight: '700' }}>Editar Usuario</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: `2px solid ${COLORS.grayLight}`,
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = COLORS.gold}
                onBlur={(e) => e.target.style.borderColor = COLORS.grayLight}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Nueva Contraseña</label>
              <input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="Dejar vacío para no cambiar"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: `2px solid ${COLORS.grayLight}`,
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = COLORS.gold}
                onBlur={(e) => e.target.style.borderColor = COLORS.grayLight}
              />
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '14px' }}>
                <input
                  type="checkbox"
                  checked={editForm.is_banned}
                  onChange={(e) => setEditForm({ ...editForm, is_banned: e.target.checked })}
                  style={{ width: '20px', height: '20px', accentColor: COLORS.gold }}
                />
                Usuario baneado
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowEditModal(false)}
                style={{
                  padding: '14px 28px',
                  borderRadius: '12px',
                  border: `2px solid ${COLORS.gray}`,
                  backgroundColor: COLORS.white,
                  color: COLORS.black,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveUser}
                style={{
                  padding: '14px 28px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: COLORS.gold,
                  color: COLORS.black,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: COLORS.white,
            borderRadius: '20px',
            padding: '32px',
            width: '450px',
            maxWidth: '90%'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px',
              marginBottom: '20px',
              color: COLORS.danger
            }}>
              <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: '32px' }} />
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Confirmar Eliminación</h3>
            </div>
            
            <p style={{ marginBottom: '28px', color: COLORS.grayDark, fontSize: '14px', lineHeight: '1.6' }}>
              ¿Estás seguro de eliminar {showDeleteConfirm.type === 'user' ? 'al usuario' : 'la tienda'}{' '}
              <strong>"{showDeleteConfirm.name}"</strong>?
              <br /><br />
              Esta acción no se puede deshacer y se eliminarán todos los datos asociados.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                style={{
                  padding: '14px 28px',
                  borderRadius: '12px',
                  border: `2px solid ${COLORS.gray}`,
                  backgroundColor: COLORS.white,
                  color: COLORS.black,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (showDeleteConfirm.type === 'user') {
                    handleDeleteUser(showDeleteConfirm.id);
                  } else {
                    handleDeleteStore(showDeleteConfirm.id);
                  }
                }}
                style={{
                  padding: '14px 28px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: COLORS.danger,
                  color: COLORS.white,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
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
