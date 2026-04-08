import { useState, useEffect, createContext, useContext } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlugins } from '../context/PluginContext';
import PluginSlot from './PluginSlot';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const API = 'https://srservi2.srautomatic.com';

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
  faChartLine,
  faLock,
  faPuzzlePiece,
  faGlobe
} from '@fortawesome/free-solid-svg-icons';

export const StoreContext = createContext();

export const useStore = () => useContext(StoreContext);

function Layout() {
  const { user, token, logout } = useAuth();
  const { getSidebarItems } = usePlugins();
  const [isPremiumUser, setIsPremiumUser] = useState(false);
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
      fetch(API + '/api/my-plan', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(data => {
          const planName = data?.plan?.plan_name || data?.plan?.name || '';
          setIsPremiumUser(!!planName && planName !== 'Gratis');
        })
        .catch(() => {});
    }
  }, [token]);

  const fetchStores = async () => {
    try {
      const response = await fetch(API + '/api/stores', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await response.json();

      if (Array.isArray(data) && data.length === 0) {
        const response2 = await fetch(API + '/api/stores', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
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
      <div className="loading-center" style={{
        '--store-primary': colors.primary,
        '--store-secondary': colors.secondary,
        '--store-accent': colors.accent
      }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <StoreContext.Provider value={{ selectedStore, stores, selectStore, fetchStores, colors }}>
      <div className="layout-wrapper" style={{
        '--store-primary': colors.primary,
        '--store-secondary': colors.secondary,
        '--store-accent': colors.accent
      }}>
        {isMobile && menuOpen && (
          <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />
        )}

        <nav className={`admin-sidebar ${isMobile ? (menuOpen ? 'mobile-open' : 'mobile-closed') : ''}`}>
          <div className="sidebar-header">
            <div>
              <h1>SRServi</h1>
              <small>Panel Admin</small>
            </div>
            {isMobile && (
              <button className="sidebar-close-btn" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            )}
          </div>

          <div className="store-selector">
            <div className="relative">
              <button
                className="store-selector-btn"
                onClick={() => setStoreDropdownOpen(!storeDropdownOpen)}
              >
                <span className="store-selector-label">
                  <FontAwesomeIcon icon={faStore} />
                  <span className="store-selector-name">
                    {selectedStore?.name || 'Seleccionar Tienda'}
                  </span>
                </span>
                <FontAwesomeIcon icon={faChevronDown} rotation={storeDropdownOpen ? 180 : 0} />
              </button>

              {storeDropdownOpen && (
                <div className="store-dropdown">
                  {stores.map(store => (
                    <div
                      key={store.id}
                      className={`store-dropdown-item ${selectedStore?.id === store.id ? 'active' : ''}`}
                      onClick={() => selectStore(store)}
                    >
                      <div className="store-dropdown-dot" />
                      <div className="store-dropdown-info">
                        <div className="store-dropdown-name">{store.name}</div>
                        <div className="store-dropdown-code">Código: {store.code}</div>
                      </div>
                    </div>
                  ))}
                  <div
                    className="store-dropdown-manage"
                    onClick={() => { setStoreDropdownOpen(false); navigate('/admin/stores'); }}
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
              <NavLink to="/admin" end onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faHome} />
                <span>Inicio</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/market" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faBarcode} />
                <span>Market</span>
              </NavLink>
            </li>
            <li className="dropdown-container">
              <button className="dropdown-header" onClick={() => toggleDropdown('productos')}>
                <FontAwesomeIcon icon={faBox} />
                <span>Productos</span>
                <FontAwesomeIcon icon={faChevronDown} rotation={openDropdowns['productos'] ? 180 : 0} />
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
                  <NavLink to="/admin/complements" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faFlask} />
                    <span>Complementos</span>
                  </NavLink>
                </div>
              )}
            </li>

            <li className="dropdown-container">
              <button className="dropdown-header" onClick={() => toggleDropdown('gestion')}>
                <FontAwesomeIcon icon={faShoppingBag} />
                <span>Gestion</span>
                <FontAwesomeIcon icon={faChevronDown} rotation={openDropdowns['gestion'] ? 180 : 0} />
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
                <FontAwesomeIcon icon={faChevronDown} rotation={openDropdowns['sistema'] ? 180 : 0} />
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
                  <NavLink to="/admin/worker-config" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faUsers} />
                    <span>Config. Worker</span>
                  </NavLink>
                  <NavLink to="/admin/store-pin" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faLock} />
                    <span>PIN Tienda</span>
                  </NavLink>
                </div>
              )}
            </li>

            {isPremiumUser && (
              <>
                <li>
                  <NavLink to="/admin/plugins" end onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faPuzzlePiece} />
                    <span>Plugins</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/admin/workshop" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faGlobe} />
                    <span>Workshop</span>
                  </NavLink>
                </li>

                {getSidebarItems().map(item => (
                  <li key={item.pluginId}>
                    <NavLink to={item.path || `/admin/plugins/${item.pluginId}`} onClick={() => setMenuOpen(false)}>
                      <FontAwesomeIcon icon={faPuzzlePiece} />
                      <span>{item.label || item.pluginId}</span>
                    </NavLink>
                  </li>
                ))}

                <PluginSlot name="sidebar" context={{ storeId: selectedStore?.id }} />
              </>
            )}

            <li>
              <button onClick={handleLogout} className="btn btn-secondary btn-full">
                <FontAwesomeIcon icon={faSignOutAlt} />
                <span>Cerrar Sesion</span>
              </button>
            </li>
          </ul>
        </nav>
        <main className="admin-content">
          <div className="mobile-header">
            <button className="mobile-header-btn" onClick={() => setMenuOpen(true)}>
              <FontAwesomeIcon icon={faBars} />
            </button>
            <h1>SRServi</h1>
          </div>
          <Outlet />
        </main>
      </div>
    </StoreContext.Provider>
  );
}

export default Layout;
