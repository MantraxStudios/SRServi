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
  faCog,
  faBars,
  faTimes,
  faBarcode,
  faCrown,
  faChartLine
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [openDropdowns, setOpenDropdowns] = useState({});

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const toggleDropdown = (key) => {
    setOpenDropdowns(prev => ({ ...prev, [key]: !prev[key] }));
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
        {isMobile && menuOpen && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 998
            }}
            onClick={() => setMenuOpen(false)}
          />
        )}
        
        <nav className={`admin-sidebar ${isMobile ? (menuOpen ? 'mobile-open' : 'mobile-closed') : ''}`} style={{
          backgroundColor: colors.primary
        }}>
          <div className="sidebar-header" style={{
            borderBottom: `1px solid ${colors.secondary}33`,
            display: 'flex',
            justifyContent: isMobile ? 'space-between' : 'center',
            alignItems: 'center',
            paddingRight: isMobile ? '16px' : '0',
            paddingLeft: isMobile ? '0' : '0'
          }}>
            <div style={{ textAlign: isMobile ? 'left' : 'center', flex: isMobile ? 1 : 'none', width: isMobile ? 'auto' : '100%' }}>
              <h1 style={{ color: colors.secondary }}>SRServi</h1>
              <small style={{ color: colors.secondary }}>Panel Admin</small>
            </div>
            {isMobile && (
              <button
                onClick={() => setMenuOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.secondary,
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            )}
          </div>

          <div style={{ padding: isMobile ? '8px' : '15px' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setStoreDropdownOpen(!storeDropdownOpen)}
                style={{
                  width: '100%',
                  padding: isMobile ? '10px' : '12px',
                  backgroundColor: colors.secondary,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: isMobile ? '12px' : '14px',
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
                    maxWidth: isMobile ? '120px' : '150px'
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
                        padding: isMobile ? '8px 12px' : '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: selectedStore?.id === store.id ? colors.accent + '33' : 'transparent',
                        borderBottom: stores.indexOf(store) < stores.length - 1 ? `1px solid ${colors.primary}11` : 'none'
                      }}
                    >
                      <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: colors.accent,
                        flexShrink: 0
                      }} />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: '600', color: colors.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: isMobile ? '12px' : '14px' }}>
                          {store.name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#666' }}>
                          Código: {store.code}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div
                    onClick={() => { setStoreDropdownOpen(false); navigate('/admin/stores'); }}
                    style={{
                      padding: isMobile ? '8px 12px' : '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      color: colors.accent,
                      fontWeight: '600',
                      fontSize: isMobile ? '12px' : '14px',
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

          <ul className="sidebar-nav" onClick={(e) => { if (!e.target.closest('.dropdown-item') && !e.target.closest('.dropdown-header') && !e.target.closest('.dropdown-container')) setMenuOpen(false); }}>
            <li>
              <NavLink to="/admin" end className="sidebar-item" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faHome} />
                <span>Inicio</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/market" className="sidebar-item" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faBarcode} />
                <span>Market</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/stores" className="sidebar-item" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faStore} />
                <span>Tiendas</span>
              </NavLink>
            </li>

            <li className="dropdown-container">
              <button className="dropdown-header" onClick={() => toggleDropdown('productos')}>
                <FontAwesomeIcon icon={faBox} />
                <span>Productos</span>
                <FontAwesomeIcon icon={faChevronDown} rotation={openDropdowns['productos'] ? 180 : 0} style={{ marginLeft: 'auto', fontSize: '10px' }} />
              </button>
              {openDropdowns['productos'] && (
                <div className="dropdown-content">
                  <NavLink to="/admin/categories" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faList} />
                    <span>Categorias</span>
                  </NavLink>
                  <NavLink to="/admin/products" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faBox} />
                    <span>Productos</span>
                  </NavLink>
                  <NavLink to="/admin/ingredients" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faFlask} />
                    <span>Complementos</span>
                  </NavLink>
                  <NavLink to="/admin/extras" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faPlus} />
                    <span>Extras</span>
                  </NavLink>
                </div>
              )}
            </li>

            <li className="dropdown-container">
              <button className="dropdown-header" onClick={() => toggleDropdown('gestion')}>
                <FontAwesomeIcon icon={faShoppingBag} />
                <span>Gestion</span>
                <FontAwesomeIcon icon={faChevronDown} rotation={openDropdowns['gestion'] ? 180 : 0} style={{ marginLeft: 'auto', fontSize: '10px' }} />
              </button>
              {openDropdowns['gestion'] && (
                <div className="dropdown-content">
                  <NavLink to="/admin/orders" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faShoppingBag} />
                    <span>Pedidos</span>
                  </NavLink>
                  <NavLink to="/admin/analytics" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faChartLine} />
                    <span>Análisis</span>
                  </NavLink>
                  <NavLink to="/admin/workers" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faUsers} />
                    <span>Trabajadores</span>
                  </NavLink>
                  <NavLink to="/admin/coupons" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faPercent} />
                    <span>Cupones</span>
                  </NavLink>
                </div>
              )}
            </li>

            <li className="dropdown-container">
              <button className="dropdown-header" onClick={() => toggleDropdown('sistema')}>
                <FontAwesomeIcon icon={faCog} />
                <span>Sistema</span>
                <FontAwesomeIcon icon={faChevronDown} rotation={openDropdowns['sistema'] ? 180 : 0} style={{ marginLeft: 'auto', fontSize: '10px' }} />
              </button>
              {openDropdowns['sistema'] && (
                <div className="dropdown-content">
                  <NavLink to="/admin/plans" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faCrown} />
                    <span>Planes</span>
                  </NavLink>
                  <NavLink to="/admin/configurations" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faCog} />
                    <span>Config. Pago</span>
                  </NavLink>
                  <NavLink to="/admin/mercado-pago-points" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faCreditCard} />
                    <span>Point</span>
                  </NavLink>
                  <NavLink to="/admin/settings" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faPalette} />
                    <span>Colores</span>
                  </NavLink>
                </div>
              )}
            </li>

            <li>
              <button 
                onClick={handleLogout}
                className="btn btn-secondary"
                style={{ width: 'calc(100% - 32px)', margin: '12px 16px', padding: '10px 16px' }}
              >
                <FontAwesomeIcon icon={faSignOutAlt} />
                <span>Cerrar Sesion</span>
              </button>
            </li>
          </ul>
        </nav>
        <main className="admin-content" style={{
          flex: 1,
          backgroundColor: selectedStore?.secondary_color || '#f5f5f5'
        }}>
          <div className="mobile-header" style={{
            display: isMobile ? 'flex' : 'none',
            backgroundColor: colors.primary,
            padding: '16px',
            alignItems: 'center',
            gap: '16px'
          }}>
            <button
              onClick={() => setMenuOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: colors.secondary,
                fontSize: '24px',
                cursor: 'pointer',
                padding: '8px'
              }}
            >
              <FontAwesomeIcon icon={faBars} />
            </button>
            <h1 style={{ color: colors.secondary, fontSize: '18px', margin: 0 }}>SRServi</h1>
          </div>
          <Outlet />
        </main>
      </div>
    </StoreContext.Provider>
  );
}

export default Layout;
