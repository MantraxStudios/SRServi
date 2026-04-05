import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers, 
  faStore, 
  faSignOut, 
  faEdit, 
  faTrash,
  faBan,
  faCheck,
  faSearch,
  faExclamationTriangle,
  faShieldHalved
} from '@fortawesome/free-solid-svg-icons';

function SuperadminDashboard() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ email: '', password: '', is_banned: false });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
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
      } else {
        const res = await fetch('http://localhost:3001/api/superadmin/stores', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setStores(data);
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
    bannedStores: stores.filter(s => s.is_banned).length
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f6fa'
    }}>
      <header style={{
        backgroundColor: '#1a1a2e',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ 
          color: '#fff', 
          fontSize: '20px',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <FontAwesomeIcon icon={faShieldHalved} style={{ color: '#e94560' }} />
          Panel Superadmin
        </h1>
        <button
          onClick={handleLogout}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #e94560',
            color: '#e94560',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}
        >
          <FontAwesomeIcon icon={faSignOut} />
          Cerrar Sesión
        </button>
      </header>

      <div style={{
        display: 'flex',
        gap: '24px',
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ flex: '0 0 240px' }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <div style={{ marginBottom: '16px', cursor: 'pointer' }}>
              <div 
                onClick={() => setActiveTab('users')}
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: activeTab === 'users' ? '#e94560' : 'transparent',
                  color: activeTab === 'users' ? '#fff' : '#333',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontWeight: '500'
                }}
              >
                <FontAwesomeIcon icon={faUsers} />
                Usuarios ({stats.totalUsers})
              </div>
            </div>
            <div style={{ cursor: 'pointer' }}>
              <div 
                onClick={() => setActiveTab('stores')}
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: activeTab === 'stores' ? '#e94560' : 'transparent',
                  color: activeTab === 'stores' ? '#fff' : '#333',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontWeight: '500'
                }}
              >
                <FontAwesomeIcon icon={faStore} />
                Tiendas ({stats.totalStores})
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '20px',
            marginTop: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>Resumen</h3>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: '#999' }}>Usuarios baneados</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#e94560' }}>{stats.bannedUsers}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#999' }}>Tiendas baneadas</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#e94560' }}>{stats.bannedStores}</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ fontSize: '18px', margin: 0 }}>
                {activeTab === 'users' ? 'Gestión de Usuarios' : 'Gestión de Tiendas'}
              </h2>
              <div style={{ position: 'relative' }}>
                <FontAwesomeIcon 
                  icon={faSearch} 
                  style={{ 
                    position: 'absolute', 
                    left: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: '#999'
                  }} 
                />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '10px 16px',
                    paddingLeft: '40px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    width: '250px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                Cargando...
              </div>
            ) : activeTab === 'users' ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #eee' }}>
                      <th style={{ textAlign: 'left', padding: '12px 8px', color: '#666', fontSize: '12px' }}>Usuario</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', color: '#666', fontSize: '12px' }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', color: '#666', fontSize: '12px' }}>Empresa</th>
                      <th style={{ textAlign: 'center', padding: '12px 8px', color: '#666', fontSize: '12px' }}>Tiendas</th>
                      <th style={{ textAlign: 'center', padding: '12px 8px', color: '#666', fontSize: '12px' }}>Estado</th>
                      <th style={{ textAlign: 'center', padding: '12px 8px', color: '#666', fontSize: '12px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ fontWeight: '500' }}>{user.username}</div>
                          <div style={{ fontSize: '12px', color: '#999' }}>Code: {user.code}</div>
                        </td>
                        <td style={{ padding: '12px 8px', color: '#666' }}>{user.email}</td>
                        <td style={{ padding: '12px 8px', color: '#666' }}>{user.business_name || '-'}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <span style={{
                            backgroundColor: '#e3f2fd',
                            color: '#1976d2',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}>
                            {user.store_count}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          {user.is_banned ? (
                            <span style={{
                              backgroundColor: '#ffebee',
                              color: '#c62828',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}>
                              Baneado
                            </span>
                          ) : (
                            <span style={{
                              backgroundColor: '#e8f5e9',
                              color: '#2e7d32',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}>
                              Activo
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleEditUser(user)}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: '#1976d2',
                              cursor: 'pointer',
                              padding: '6px',
                              marginRight: '4px'
                            }}
                            title="Editar"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            onClick={() => handleToggleBanUser(user)}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: user.is_banned ? '#2e7d32' : '#f57c00',
                              cursor: 'pointer',
                              padding: '6px',
                              marginRight: '4px'
                            }}
                            title={user.is_banned ? 'Desbanear' : 'Banear'}
                          >
                            <FontAwesomeIcon icon={user.is_banned ? faCheck : faBan} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm({ type: 'user', id: user.id, name: user.username })}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: '#c62828',
                              cursor: 'pointer',
                              padding: '6px'
                            }}
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
                  <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    No se encontraron usuarios
                  </div>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #eee' }}>
                      <th style={{ textAlign: 'left', padding: '12px 8px', color: '#666', fontSize: '12px' }}>Tienda</th>
                      <th style={{ textAlign: 'left', padding: '12px 8px', color: '#666', fontSize: '12px' }}>Propietario</th>
                      <th style={{ textAlign: 'center', padding: '12px 8px', color: '#666', fontSize: '12px' }}>Productos</th>
                      <th style={{ textAlign: 'center', padding: '12px 8px', color: '#666', fontSize: '12px' }}>Órdenes</th>
                      <th style={{ textAlign: 'center', padding: '12px 8px', color: '#666', fontSize: '12px' }}>Estado</th>
                      <th style={{ textAlign: 'center', padding: '12px 8px', color: '#666', fontSize: '12px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStores.map(store => (
                      <tr key={store.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ fontWeight: '500' }}>{store.name}</div>
                          <div style={{ fontSize: '12px', color: '#999' }}>Code: {store.code}</div>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ color: '#666' }}>{store.user_email}</div>
                          <div style={{ fontSize: '12px', color: '#999' }}>{store.user_business || '-'}</div>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <span style={{
                            backgroundColor: '#e3f2fd',
                            color: '#1976d2',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}>
                            {store.product_count}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <span style={{
                            backgroundColor: '#fff3e0',
                            color: '#e65100',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500'
                          }}>
                            {store.order_count}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          {store.is_banned ? (
                            <span style={{
                              backgroundColor: '#ffebee',
                              color: '#c62828',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}>
                              Baneada
                            </span>
                          ) : (
                            <span style={{
                              backgroundColor: '#e8f5e9',
                              color: '#2e7d32',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}>
                              Activa
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <button
                            onClick={() => handleToggleBanStore(store)}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: store.is_banned ? '#2e7d32' : '#f57c00',
                              cursor: 'pointer',
                              padding: '6px',
                              marginRight: '4px'
                            }}
                            title={store.is_banned ? 'Desbanear' : 'Banear'}
                          >
                            <FontAwesomeIcon icon={store.is_banned ? faCheck : faBan} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm({ type: 'store', id: store.id, name: store.name })}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: '#c62828',
                              cursor: 'pointer',
                              padding: '6px'
                            }}
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
                  <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    No se encontraron tiendas
                  </div>
                )}
              </div>
            )}
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
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '24px',
            width: '400px',
            maxWidth: '90%'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Editar Usuario</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Nueva Contraseña (dejar vacío para no cambiar)</label>
              <input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editForm.is_banned}
                  onChange={(e) => setEditForm({ ...editForm, is_banned: e.target.checked })}
                />
                Usuario baneado
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowEditModal(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveUser}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#e94560',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px'
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
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '24px',
            width: '400px',
            maxWidth: '90%'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              marginBottom: '16px',
              color: '#c62828'
            }}>
              <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: '24px' }} />
              <h3 style={{ margin: 0 }}>Confirmar Eliminación</h3>
            </div>
            
            <p style={{ marginBottom: '20px', color: '#666' }}>
              ¿Estás seguro de eliminar {showDeleteConfirm.type === 'user' ? 'al usuario' : 'la tienda'}{' '}
              <strong>"{showDeleteConfirm.name}"</strong>?
              Esta acción no se puede deshacer y se eliminarán todos los datos asociados.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px'
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
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#c62828',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px'
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
