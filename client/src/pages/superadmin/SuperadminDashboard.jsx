import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { API_URL } from '../../config.js';
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
  faChevronRight
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

function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
}

function SuperadminDashboard() {
  const { width } = useWindowSize();
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
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
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
        const res = await fetch(`${API_URL}/api/superadmin/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setUsers(data);
      } else if (activeTab === 'stores') {
        const res = await fetch(`${API_URL}/api/superadmin/stores`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setStores(data);
      } else if (activeTab === 'subscriptions') {
        const res = await fetch(`${API_URL}/api/superadmin/subscriptions`, {
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
      const res = await fetch(`${API_URL}/api/superadmin/users/${editingUser.id}`, {
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
      const res = await fetch(`${API_URL}/api/superadmin/users/${user.id}`, {
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
      const res = await fetch(`${API_URL}/api/superadmin/users/${userId}`, {
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
      const res = await fetch(`${API_URL}/api/superadmin/stores/${store.id}`, {
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
      const res = await fetch(`${API_URL}/api/superadmin/stores/${storeId}`, {
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

  const sidebarWidth = isMobile ? (mobileMenuOpen ? '280px' : '0px') : (sidebarOpen ? '260px' : '70px');
  
  const sidebarStyle = {
    width: sidebarWidth,
    minHeight: '100vh',
    backgroundColor: COLORS.black,
    color: COLORS.white,
    transition: 'width 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    left: 0,
    top: 0,
    zIndex: 100,
    overflow: 'hidden'
  };

  const mainStyle = {
    marginLeft: isMobile ? '0px' : (sidebarOpen ? '260px' : '70px'),
    transition: 'margin-left 0.3s ease',
    minHeight: '100vh',
    backgroundColor: COLORS.grayLight,
    width: isMobile ? '100%' : 'auto'
  };

  const thStyle = {
    textAlign: 'left',
    padding: isMobile ? '10px 8px' : '14px 12px',
    color: COLORS.grayDark,
    fontSize: isMobile ? '10px' : '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    borderBottom: `2px solid ${COLORS.grayLight}`
  };

  const tdStyle = {
    padding: isMobile ? '12px 8px' : '16px 12px',
    fontSize: isMobile ? '13px' : '14px'
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {isMobile && mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 99
          }}
        />
      )}
      
      <div style={sidebarStyle}>
        <div style={{
          padding: isMobile ? '16px' : '20px',
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
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <FontAwesomeIcon icon={faShieldAlt} style={{ color: COLORS.black, fontSize: '20px' }} />
          </div>
          {sidebarOpen && !isMobile && (
            <div>
              <div style={{ fontWeight: '700', fontSize: '16px' }}>Superadmin</div>
              <div style={{ fontSize: '11px', color: COLORS.gold }}>Panel de Control</div>
            </div>
          )}
        </div>

        <button
          onClick={() => isMobile ? setMobileMenuOpen(!mobileMenuOpen) : setSidebarOpen(!sidebarOpen)}
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
          <FontAwesomeIcon icon={isMobile ? faBars : (sidebarOpen ? faChevronLeft : faChevronRight)} />
          {sidebarOpen && !isMobile && <span style={{ fontSize: '14px' }}>Colapsar</span>}
        </button>

        <nav style={{ flex: 1, padding: '10px' }}>
          <div 
            onClick={() => { setActiveTab('users'); isMobile && setMobileMenuOpen(false); }}
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
            {(!isMobile || mobileMenuOpen) && <span>Usuarios</span>}
          </div>

          <div 
            onClick={() => { setActiveTab('stores'); isMobile && setMobileMenuOpen(false); }}
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
            {(!isMobile || mobileMenuOpen) && <span>Tiendas</span>}
          </div>

          <div 
            onClick={() => { setActiveTab('subscriptions'); isMobile && setMobileMenuOpen(false); }}
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
            {(!isMobile || mobileMenuOpen) && <span>Suscripciones</span>}
          </div>
        </nav>

        <div style={{ padding: '20px', borderTop: `1px solid ${COLORS.gold}`, marginTop: 'auto' }}>
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
            {(!isMobile || mobileMenuOpen) && <span>Cerrar Sesión</span>}
          </div>
        </div>
      </div>

      <div style={mainStyle}>
        <header style={{
          backgroundColor: COLORS.white,
          padding: isMobile ? '16px' : '20px 30px',
          borderBottom: `2px solid ${COLORS.grayLight}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isMobile && (
              <button
                onClick={() => setMobileMenuOpen(true)}
                style={{
                  backgroundColor: COLORS.black,
                  border: 'none',
                  color: COLORS.white,
                  cursor: 'pointer',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <FontAwesomeIcon icon={faBars} />
              </button>
            )}
            <div>
              <h1 style={{ 
                fontSize: isMobile ? '18px' : '24px', 
                fontWeight: '700', 
                color: COLORS.black,
                marginBottom: '4px'
              }}>
                {activeTab === 'users' ? 'Usuarios' : activeTab === 'stores' ? 'Tiendas' : 'Suscripciones'}
              </h1>
              <p style={{ color: COLORS.grayDark, fontSize: '13px', display: isMobile ? 'none' : 'block' }}>
                {activeTab === 'users' ? 'Administra las cuentas de usuarios' : activeTab === 'stores' ? 'Administra todas las tiendas' : 'Ver todas las suscripciones'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{
              backgroundColor: COLORS.black,
              color: COLORS.white,
              padding: isMobile ? '8px 12px' : '10px 20px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: isMobile ? '12px' : '14px'
            }}>
              <FontAwesomeIcon icon={faUsers} style={{ fontSize: isMobile ? '14px' : '16px' }} />
              <span style={{ fontWeight: '600' }}>{stats.totalUsers}</span>
              {!isMobile && <span style={{ color: COLORS.gray }}>Usuarios</span>}
            </div>
            <div style={{
              backgroundColor: COLORS.gold,
              color: COLORS.black,
              padding: isMobile ? '8px 12px' : '10px 20px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: isMobile ? '12px' : '14px'
            }}>
              <FontAwesomeIcon icon={faStore} style={{ fontSize: isMobile ? '14px' : '16px' }} />
              <span style={{ fontWeight: '600' }}>{stats.totalStores}</span>
              {!isMobile && <span style={{ color: COLORS.black, opacity: 0.7 }}>Tiendas</span>}
            </div>
            <div style={{
              backgroundColor: COLORS.success,
              color: COLORS.white,
              padding: isMobile ? '8px 12px' : '10px 20px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: isMobile ? '12px' : '14px'
            }}>
              <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: isMobile ? '14px' : '16px' }} />
              <span style={{ fontWeight: '600' }}>{subscriptions.length}</span>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Subs</span>
            </div>
          </div>
        </header>

        <div style={{ padding: isMobile ? '16px' : '30px' }}>
          <div style={{
            backgroundColor: COLORS.white,
            borderRadius: isMobile ? '12px' : '16px',
            padding: isMobile ? '16px' : '24px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', gap: isMobile ? '8px' : '16px', flexWrap: 'wrap' }}>
                <div style={{
                  padding: isMobile ? '6px 12px' : '8px 16px',
                  backgroundColor: COLORS.success,
                  color: COLORS.white,
                  borderRadius: '20px',
                  fontSize: isMobile ? '11px' : '13px',
                  fontWeight: '600'
                }}>
                  {activeTab === 'users' ? stats.activeUsers : stats.activeStores} Activos
                </div>
                <div style={{
                  padding: isMobile ? '6px 12px' : '8px 16px',
                  backgroundColor: COLORS.danger,
                  color: COLORS.white,
                  borderRadius: '20px',
                  fontSize: isMobile ? '11px' : '13px',
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
                    left: isMobile ? '10px' : '14px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: COLORS.grayDark,
                    fontSize: '14px'
                  }} 
                />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: isMobile ? '10px 12px' : '12px 16px',
                    paddingLeft: isMobile ? '36px' : '44px',
                    borderRadius: '12px',
                    border: `2px solid ${COLORS.grayLight}`,
                    width: isMobile ? '100%' : '300px',
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
                      <th style={thStyle}>Usuario</th>
                      <th style={thStyle}>Email</th>
                      <th style={{ ...thStyle, display: isMobile ? 'none' : 'table-cell' }}>Empresa</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Tiendas</th>
                      <th style={{ ...thStyle, textAlign: 'center', display: isMobile ? 'none' : 'table-cell' }}>Última Actividad</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.id} style={{ borderBottom: `1px solid ${COLORS.grayLight}`, transition: 'background-color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.grayLight}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: '600', color: COLORS.black, fontSize: '14px' }}>{user.username}</div>
                          <div style={{ fontSize: '11px', color: COLORS.grayDark }}>Code: {user.code}</div>
                        </td>
                        <td style={tdStyle}>{user.email}</td>
                        <td style={{ ...tdStyle, display: isMobile ? 'none' : 'table-cell' }}>{user.business_name || '-'}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span style={{
                            backgroundColor: COLORS.gold,
                            color: COLORS.black,
                            padding: isMobile ? '4px 10px' : '6px 14px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {user.store_count}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', display: isMobile ? 'none' : 'table-cell' }}>
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
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {user.is_banned ? (
                            <span style={{
                              backgroundColor: COLORS.danger,
                              color: COLORS.white,
                              padding: isMobile ? '4px 10px' : '6px 14px',
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
                              padding: isMobile ? '4px 10px' : '6px 14px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              Activo
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button
                            onClick={() => handleEditUser(user)}
                            style={{
                              backgroundColor: COLORS.grayLight,
                              border: 'none',
                              color: COLORS.black,
                              cursor: 'pointer',
                              padding: isMobile ? '8px' : '10px',
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
                              padding: isMobile ? '8px' : '10px',
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
                              padding: isMobile ? '8px' : '10px',
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
                  <div style={{ textAlign: 'center', padding: isMobile ? '40px' : '60px', color: COLORS.grayDark }}>
                    <FontAwesomeIcon icon={faUsers} style={{ fontSize: isMobile ? '36px' : '48px', marginBottom: '16px', opacity: 0.3 }} />
                    <div style={{ fontSize: isMobile ? '14px' : '16px' }}>No se encontraron usuarios</div>
                  </div>
                )}
              </div>
            ) : activeTab === 'stores' ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${COLORS.grayLight}` }}>
                      <th style={{ ...thStyle, display: isMobile ? 'none' : 'table-cell' }}>Tienda</th>
                      <th style={thStyle}>Propietario</th>
                      <th style={{ ...thStyle, textAlign: 'center', display: isMobile ? 'none' : 'table-cell' }}>Productos</th>
                      <th style={{ ...thStyle, textAlign: 'center', display: isMobile ? 'none' : 'table-cell' }}>Órdenes</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStores.map(store => (
                      <tr key={store.id} style={{ borderBottom: `1px solid ${COLORS.grayLight}`, transition: 'background-color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.grayLight}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={{ ...tdStyle, display: isMobile ? 'none' : 'table-cell' }}>
                          <div style={{ fontWeight: '600', color: COLORS.black }}>{store.name}</div>
                          <div style={{ fontSize: '11px', color: COLORS.grayDark }}>Code: {store.code}</div>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ color: COLORS.grayDark }}>{store.user_email}</div>
                          <div style={{ fontSize: '11px', color: COLORS.grayDark, display: isMobile ? 'none' : 'block' }}>{store.user_business || '-'}</div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', display: isMobile ? 'none' : 'table-cell' }}>
                          <span style={{
                            backgroundColor: COLORS.gold,
                            color: COLORS.black,
                            padding: isMobile ? '4px 10px' : '6px 14px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {store.product_count}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', display: isMobile ? 'none' : 'table-cell' }}>
                          <span style={{
                            backgroundColor: COLORS.black,
                            color: COLORS.white,
                            padding: isMobile ? '4px 10px' : '6px 14px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {store.order_count}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {store.is_banned ? (
                            <span style={{
                              backgroundColor: COLORS.danger,
                              color: COLORS.white,
                              padding: isMobile ? '4px 10px' : '6px 14px',
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
                              padding: isMobile ? '4px 10px' : '6px 14px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              Activa
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button
                            onClick={() => handleToggleBanStore(store)}
                            style={{
                              backgroundColor: store.is_banned ? 'rgba(40,167,69,0.1)' : 'rgba(245,124,0,0.1)',
                              border: 'none',
                              color: store.is_banned ? COLORS.success : COLORS.warning,
                              cursor: 'pointer',
                              padding: isMobile ? '8px' : '10px',
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
                              padding: isMobile ? '8px' : '10px',
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
                  <div style={{ textAlign: 'center', padding: isMobile ? '40px' : '60px', color: COLORS.grayDark }}>
                    <FontAwesomeIcon icon={faStore} style={{ fontSize: isMobile ? '36px' : '48px', marginBottom: '16px', opacity: 0.3 }} />
                    <div style={{ fontSize: isMobile ? '14px' : '16px' }}>No se encontraron tiendas</div>
                  </div>
                )}
              </div>
            ) : activeTab === 'subscriptions' ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${COLORS.grayLight}` }}>
                      <th style={thStyle}>Usuario</th>
                      <th style={{ ...thStyle, display: isMobile ? 'none' : 'table-cell' }}>Email</th>
                      <th style={{ ...thStyle, display: isMobile ? 'none' : 'table-cell' }}>Plan Actual</th>
                      <th style={{ ...thStyle, textAlign: 'center', display: isMobile ? 'none' : 'table-cell' }}>Precio</th>
                      <th style={{ ...thStyle, textAlign: 'center', display: isMobile ? 'none' : 'table-cell' }}>Vencimiento</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map(sub => (
                      <tr key={sub.email} style={{ borderBottom: `1px solid ${COLORS.grayLight}`, transition: 'background-color 0.2s', cursor: 'pointer' }}
                          onClick={() => { setSelectedSubscription(sub); setShowSubscriptionModal(true); }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.grayLight}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: '600', color: COLORS.black }}>{sub.username}</div>
                          <div style={{ fontSize: '11px', color: COLORS.grayDark, display: isMobile ? 'none' : 'block' }}>{sub.business_name || '-'}</div>
                        </td>
                        <td style={{ ...tdStyle, display: isMobile ? 'none' : 'table-cell' }}>{sub.email}</td>
                        <td style={{ ...tdStyle, display: isMobile ? 'none' : 'table-cell' }}>
                          <span style={{
                            backgroundColor: sub.current_plan === 'Gratis' || !sub.current_plan ? COLORS.gray : COLORS.gold,
                            color: COLORS.black,
                            padding: isMobile ? '4px 10px' : '6px 14px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {sub.current_plan || 'Gratis'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', display: isMobile ? 'none' : 'table-cell' }}>
                          <div style={{ fontWeight: '600', color: COLORS.black }}>
                            {!sub.current_plan || sub.current_plan === 'Gratis' ? 'Gratis' : 
                              sub.current_billing_cycle === 'monthly' 
                                ? `$${sub.current_price_monthly}/mes` 
                                : `$${sub.current_price_yearly}/año`}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', display: isMobile ? 'none' : 'table-cell', color: COLORS.grayDark }}>
                          {sub.current_ends_at ? new Date(sub.current_ends_at).toLocaleDateString('es-ES') : '-'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {sub.current_is_active && sub.current_ends_at && new Date(sub.current_ends_at) > new Date() ? (
                            <span style={{
                              backgroundColor: COLORS.success,
                              color: COLORS.white,
                              padding: isMobile ? '4px 10px' : '6px 14px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              Activo
                            </span>
                          ) : sub.current_is_active === false ? (
                            <span style={{
                              backgroundColor: COLORS.danger,
                              color: COLORS.white,
                              padding: isMobile ? '4px 10px' : '6px 14px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              Cancelado
                            </span>
                          ) : (
                            <span style={{
                              backgroundColor: COLORS.gray,
                              color: COLORS.black,
                              padding: isMobile ? '4px 10px' : '6px 14px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              Gratis
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedSubscription(sub); setShowSubscriptionModal(true); }}
                            style={{
                              backgroundColor: COLORS.gold,
                              border: 'none',
                              color: COLORS.black,
                              cursor: 'pointer',
                              padding: isMobile ? '6px 12px' : '8px 16px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {subscriptions.length === 0 && (
                  <div style={{ textAlign: 'center', padding: isMobile ? '40px' : '60px', color: COLORS.grayDark }}>
                    <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: isMobile ? '36px' : '48px', marginBottom: '16px', opacity: 0.3 }} />
                    <div style={{ fontSize: isMobile ? '14px' : '16px' }}>No hay suscripciones</div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {showSubscriptionModal && selectedSubscription && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: isMobile ? '16px' : '0'
        }}>
          <div style={{
            backgroundColor: COLORS.white,
            borderRadius: isMobile ? '12px' : '16px',
            padding: isMobile ? '16px' : '24px',
            maxWidth: '700px',
            width: '100%',
            maxHeight: isMobile ? '90vh' : '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '700', color: COLORS.black }}>Historial de Suscripciones</h2>
              <button
                onClick={() => setShowSubscriptionModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '24px',
                  color: COLORS.grayDark,
                  padding: '4px 8px'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ backgroundColor: COLORS.grayLight, padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
              <div style={{ fontWeight: '600', fontSize: '16px', color: COLORS.black }}>{selectedSubscription.username}</div>
              <div style={{ fontSize: '14px', color: COLORS.grayDark }}>{selectedSubscription.email}</div>
              {selectedSubscription.business_name && <div style={{ fontSize: '14px', color: COLORS.grayDark }}>{selectedSubscription.business_name}</div>}
              <div style={{ fontSize: '12px', color: COLORS.grayDark, marginTop: '8px' }}>Usuario desde: {new Date(selectedSubscription.user_created_at).toLocaleDateString('es-ES')}</div>
            </div>

            {selectedSubscription.subscriptions.length > 0 ? (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: COLORS.black }}>Historial de Planes</h3>
                {selectedSubscription.subscriptions.map((sub, index) => (
                  <div key={sub.id} style={{ 
                    border: `2px solid ${sub.is_active ? COLORS.success : COLORS.grayLight}`,
                    borderRadius: '12px',
                    padding: isMobile ? '12px' : '16px',
                    marginBottom: '12px',
                    backgroundColor: sub.is_active ? 'rgba(40,167,69,0.05)' : COLORS.white
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <span style={{
                          backgroundColor: sub.plan_name === 'Gratis' ? COLORS.gray : COLORS.gold,
                          color: COLORS.black,
                          padding: '4px 12px',
                          borderRadius: '16px',
                          fontSize: '14px',
                          fontWeight: '600'
                        }}>
                          {sub.plan_name}
                        </span>
                        {sub.is_active && new Date(sub.ends_at) > new Date() && (
                          <span style={{
                            backgroundColor: COLORS.success,
                            color: COLORS.white,
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: '600',
                            marginLeft: '8px'
                          }}>
                            Activo
                          </span>
                        )}
                        {sub.is_active === false && (
                          <span style={{
                            backgroundColor: COLORS.danger,
                            color: COLORS.white,
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: '600',
                            marginLeft: '8px'
                          }}>
                            Cancelado
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '600', color: COLORS.black }}>
                          {sub.billing_cycle === 'monthly' ? `$${sub.price_monthly}/mes` : sub.billing_cycle === 'yearly' ? `$${sub.price_yearly}/año` : 'Gratis'}
                        </div>
                        <div style={{ fontSize: '12px', color: COLORS.grayDark, textTransform: 'capitalize' }}>{sub.billing_cycle === 'monthly' ? 'Mensual' : sub.billing_cycle === 'yearly' ? 'Anual' : '-'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px', fontSize: '13px', color: COLORS.grayDark }}>
                      <div><strong>Inicio:</strong> {sub.starts_at ? new Date(sub.starts_at).toLocaleDateString('es-ES') : '-'}</div>
                      <div><strong>Vencimiento:</strong> {sub.ends_at ? new Date(sub.ends_at).toLocaleDateString('es-ES') : '-'}</div>
                      <div><strong>Suscrito:</strong> {sub.subscribed_at ? new Date(sub.subscribed_at).toLocaleDateString('es-ES') : '-'}</div>
                      <div><strong>ID:</strong> {sub.id}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: COLORS.grayDark }}>
                <FontAwesomeIcon icon={faCreditCard} style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }} />
                <div>Este usuario no tiene suscripciones premium</div>
                <div style={{ fontSize: '14px', marginTop: '8px' }}>Plan actual: <strong>{selectedSubscription.current_plan || 'Gratis'}</strong></div>
              </div>
            )}
          </div>
        </div>
      )}

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
          zIndex: 1000,
          padding: isMobile ? '16px' : '0'
        }}>
          <div style={{
            backgroundColor: COLORS.white,
            borderRadius: isMobile ? '16px' : '20px',
            padding: isMobile ? '20px' : '32px',
            width: '100%',
            maxWidth: '450px'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: isMobile ? '16px' : '24px', fontSize: isMobile ? '18px' : '20px', fontWeight: '700' }}>Editar Usuario</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                style={{
                  width: '100%',
                  padding: isMobile ? '12px 14px' : '14px 16px',
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
                  padding: isMobile ? '12px 14px' : '14px 16px',
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

            <div style={{ marginBottom: isMobile ? '20px' : '28px' }}>
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

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowEditModal(false)}
                style={{
                  padding: isMobile ? '12px 20px' : '14px 28px',
                  borderRadius: '12px',
                  border: `2px solid ${COLORS.gray}`,
                  backgroundColor: COLORS.white,
                  color: COLORS.black,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  flex: 1
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveUser}
                style={{
                  padding: isMobile ? '12px 20px' : '14px 28px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: COLORS.gold,
                  color: COLORS.black,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  flex: 1
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
          zIndex: 1000,
          padding: isMobile ? '16px' : '0'
        }}>
          <div style={{
            backgroundColor: COLORS.white,
            borderRadius: isMobile ? '16px' : '20px',
            padding: isMobile ? '20px' : '32px',
            width: '100%',
            maxWidth: '450px'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px',
              marginBottom: '20px',
              color: COLORS.danger
            }}>
              <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: isMobile ? '28px' : '32px' }} />
              <h3 style={{ margin: 0, fontSize: isMobile ? '18px' : '20px', fontWeight: '700' }}>Confirmar Eliminación</h3>
            </div>
            
            <p style={{ marginBottom: isMobile ? '20px' : '28px', color: COLORS.grayDark, fontSize: '14px', lineHeight: '1.6' }}>
              ¿Estás seguro de eliminar {showDeleteConfirm.type === 'user' ? 'al usuario' : 'la tienda'}{' '}
              <strong>"{showDeleteConfirm.name}"</strong>?
              <br /><br />
              Esta acción no se puede deshacer y se eliminarán todos los datos asociados.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                style={{
                  padding: isMobile ? '12px 20px' : '14px 28px',
                  borderRadius: '12px',
                  border: `2px solid ${COLORS.gray}`,
                  backgroundColor: COLORS.white,
                  color: COLORS.black,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  flex: 1
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
                  padding: isMobile ? '12px 20px' : '14px 28px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: COLORS.danger,
                  color: COLORS.white,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  flex: 1
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
