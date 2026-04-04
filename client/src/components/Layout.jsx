import { useState, useEffect, createContext, useContext } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHome, 
  faList, 
  faBox, 
  faFlask, 
  faPlus, 
  faShoppingBag,
  faSignOutAlt,
  faPalette,
  faStore,
  faChevronDown,
  faUsers,
  faCreditCard,
  faPercent,
  faCog
} from '@fortawesome/free-solid-svg-icons';

export const StoreContext = createContext();

export const useStore = () => useContext(StoreContext);

function Layout() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);

  useEffect(() => {
    if (token) {
      fetchStores();
    }
  }, [token]);

  const fetchStores = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/stores', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (Array.isArray(data) && data.length === 0) {
        const response2 = await fetch('http://localhost:3001/api/stores', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: user?.business_name || user?.username || 'Mi Tienda',
            primary_color: '#000000',
            secondary_color: '#FFFFFF',
            accent_color: '#D4AF37',
            header_color: '#000000',
            currency_code: 'USD',
            currency_symbol: '$',
            currency_name: 'Dólar Estadounidense'
          })
        });
        
        if (response2.ok) {
          const newStore = await response2.json();
          setStores([newStore]);
          setSelectedStore(newStore);
          localStorage.setItem('selectedStoreId', newStore.id.toString());
        }
      } else {
        setStores(data);
        
        if (data.length > 0 && !selectedStore) {
          const savedStoreId = localStorage.getItem('selectedStoreId');
          const savedStore = data.find(s => s.id === parseInt(savedStoreId));
          setSelectedStore(savedStore || data[0]);
          if (savedStore || data[0]) {
            localStorage.setItem('selectedStoreId', (savedStore || data[0]).id.toString());
          }
        }
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectStore = (store) => {
    setSelectedStore(store);
    localStorage.setItem('selectedStoreId', store.id.toString());
    setStoreDropdownOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const colors = selectedStore ? {
    primary: selectedStore.primary_color || '#000000',
    secondary: selectedStore.secondary_color || '#FFFFFF',
    accent: selectedStore.accent_color || '#D4AF37'
  } : {
    primary: '#000000',
    secondary: '#FFFFFF',
    accent: '#D4AF37'
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: colors.secondary
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <StoreContext.Provider value={{ selectedStore, stores, selectStore, fetchStores, colors }}>
      <div style={{ 
        display: 'flex', 
        minHeight: '100vh',
        width: '100vw'
      }}>
        <nav className="admin-sidebar" style={{
          width: '260px',
          flexShrink: 0,
          backgroundColor: colors.primary
        }}>
          <div className="sidebar-header" style={{
            borderBottom: `1px solid ${colors.secondary}33`
          }}>
            <h1 style={{ color: colors.secondary }}>SRServi</h1>
            <small style={{ color: colors.secondary }}>Panel Admin</small>
          </div>

          <div style={{ padding: '15px' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setStoreDropdownOpen(!storeDropdownOpen)}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: colors.secondary,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.primary
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FontAwesomeIcon icon={faStore} />
                  <span style={{ 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap',
                    maxWidth: '150px'
                  }}>
                    {selectedStore?.name || 'Seleccionar Tienda'}
                  </span>
                </div>
                <FontAwesomeIcon icon={faChevronDown} rotation={storeDropdownOpen ? 180 : 0} />
              </button>

              {storeDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: colors.secondary,
                  borderRadius: '8px',
                  marginTop: '5px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 100,
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {stores.map(store => (
                    <div
                      key={store.id}
                      onClick={() => selectStore(store)}
                      style={{
                        padding: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        backgroundColor: selectedStore?.id === store.id ? colors.accent + '33' : 'transparent',
                        borderBottom: stores.indexOf(store) < stores.length - 1 ? `1px solid ${colors.primary}11` : 'none'
                      }}
                    >
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: colors.accent
                      }} />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: '600', color: colors.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {store.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666' }}>
                          Código: {store.code}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div
                    onClick={() => { setStoreDropdownOpen(false); navigate('/admin/stores'); }}
                    style={{
                      padding: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      color: colors.accent,
                      fontWeight: '600',
                      borderTop: `1px solid ${colors.primary}22`
                    }}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    Gestionar Tiendas
                  </div>
                </div>
              )}
            </div>
          </div>

          <ul className="sidebar-nav">
            <li>
              <NavLink to="/admin" end>
                <FontAwesomeIcon icon={faHome} />
                <span>Inicio</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/stores">
                <FontAwesomeIcon icon={faStore} />
                <span>Tiendas</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/categories">
                <FontAwesomeIcon icon={faList} />
                <span>Categorias</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/products">
                <FontAwesomeIcon icon={faBox} />
                <span>Productos</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/ingredients">
                <FontAwesomeIcon icon={faFlask} />
                <span>Ingredientes</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/extras">
                <FontAwesomeIcon icon={faPlus} />
                <span>Extras</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/orders">
                <FontAwesomeIcon icon={faShoppingBag} />
                <span>Pedidos</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/workers">
                <FontAwesomeIcon icon={faUsers} />
                <span>Trabajadores</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/coupons">
                <FontAwesomeIcon icon={faPercent} />
                <span>Cupones</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/configurations">
                <FontAwesomeIcon icon={faCog} />
                <span>Config. Pago</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/mercado-pago-points">
                <FontAwesomeIcon icon={faCreditCard} />
                <span>Point</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/settings">
                <FontAwesomeIcon icon={faPalette} />
                <span>Colores</span>
              </NavLink>
            </li>
            <li>
              <button 
                onClick={handleLogout}
                className="btn btn-secondary"
                style={{ width: '100%', marginTop: '20px' }}
              >
                <FontAwesomeIcon icon={faSignOutAlt} />
                <span>Cerrar Sesion</span>
              </button>
            </li>
          </ul>
        </nav>
        <main className="admin-content" style={{
          flex: 1,
          width: 'calc(100% - 260px)',
          backgroundColor: selectedStore?.secondary_color || '#f5f5f5'
        }}>
          <Outlet />
        </main>
      </div>
    </StoreContext.Provider>
  );
}

export default Layout;
