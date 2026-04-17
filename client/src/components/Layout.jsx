import { useState, useEffect, createContext, useContext } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const API = 'https://srservi2.srautomatic.com';

import {
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
  faGlobe,
  faTabletAlt,
  faTv,
  faTicketAlt,
  faBookOpen,
  faCashRegister,
  faChevronLeft,
  faChevronRight,
  faUserCog
} from '@fortawesome/free-solid-svg-icons';

export const StoreContext = createContext();

export const useStore = () => useContext(StoreContext);

function Layout() {
  const { user, token, logout } = useAuth();
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isEditorMode = location.pathname.startsWith('/admin/editor');
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    if (isEditorMode) setMenuOpen(true);
  }, [isEditorMode]);
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
        '--store-accent': colors.accent,
        '--sidebar-w': (isEditorMode && menuOpen && !isMobile) ? '270px' : '0px'
      }}>
        {menuOpen && (!isEditorMode || isMobile) && (
          <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />
        )}

        <nav className={`admin-sidebar ${isEditorMode ? (menuOpen ? 'editor-sidebar-open' : 'editor-hidden') : (menuOpen ? 'mobile-open' : 'mobile-closed')}`}>
          <div className="sidebar-header">
            <div className="sidebar-brand">
              <div className="sidebar-brand-logo">
                <FontAwesomeIcon icon={faStore} />
              </div>
              <div className="sidebar-brand-text">
                <h1>SRServi</h1>
                <small>Panel de Administración</small>
              </div>
            </div>
            <button className="sidebar-close-btn" onClick={() => setMenuOpen(false)}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          {user?.support_pin && (
            <div className="sidebar-pin-badge">
              <FontAwesomeIcon icon={faLock} />
              <span>PIN Soporte</span>
              <strong>{user.support_pin}</strong>
            </div>
          )}

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
            <li className="sidebar-section-label">Principal</li>
            {selectedStore && (
              <li>
                <NavLink
                  to={`/admin/editor/${selectedStore.code}?admin_edit=${token}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <FontAwesomeIcon icon={faBox} />
                  <span>Editor Totem</span>
                </NavLink>
              </li>
            )}
            <li>
              <NavLink to="/admin/mercado-pago-points" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faCashRegister} />
                <span>Vincular POS</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/workers" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faUsers} />
                <span>Vendedores</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/tutoriales" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faBookOpen} />
                <span>Tutoriales</span>
              </NavLink>
            </li>

            <li className="sidebar-section-label">Más</li>
            <li className="dropdown-container">
              <button className={`dropdown-header${openDropdowns['admin'] ? ' open' : ''}`} onClick={() => toggleDropdown('admin')}>
                <FontAwesomeIcon icon={faCog} />
                <span>Administración</span>
                <FontAwesomeIcon icon={faChevronDown} className="dropdown-chevron" rotation={openDropdowns['admin'] ? 180 : 0} />
              </button>
              {openDropdowns['admin'] && (
                <div className="dropdown-content">

                  {/* Sub-dropdown: Operaciones */}
                  <div className="subdropdown-container">
                    <button className={`subdropdown-header${openDropdowns['operaciones'] ? ' open' : ''}`} onClick={() => toggleDropdown('operaciones')}>
                      <FontAwesomeIcon icon={faShoppingBag} />
                      <span>Operaciones</span>
                      <FontAwesomeIcon icon={faChevronDown} className="dropdown-chevron" rotation={openDropdowns['operaciones'] ? 180 : 0} />
                    </button>
                    {openDropdowns['operaciones'] && (
                      <div className="subdropdown-content">
                        <NavLink to="/admin/orders" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                          <FontAwesomeIcon icon={faShoppingBag} />
                          <span>Pedidos</span>
                        </NavLink>
                        <NavLink to="/admin/analytics" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                          <FontAwesomeIcon icon={faChartLine} />
                          <span>Análisis</span>
                        </NavLink>
                        <NavLink to="/admin/coupons" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                          <FontAwesomeIcon icon={faPercent} />
                          <span>Cupones</span>
                        </NavLink>
                      </div>
                    )}
                  </div>

                  {/* Sub-dropdown: Catálogo */}
                  <div className="subdropdown-container">
                    <button className={`subdropdown-header${openDropdowns['catalogo'] ? ' open' : ''}`} onClick={() => toggleDropdown('catalogo')}>
                      <FontAwesomeIcon icon={faBarcode} />
                      <span>Catálogo</span>
                      <FontAwesomeIcon icon={faChevronDown} className="dropdown-chevron" rotation={openDropdowns['catalogo'] ? 180 : 0} />
                    </button>
                    {openDropdowns['catalogo'] && (
                      <div className="subdropdown-content">
                        <NavLink to="/admin/market" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                          <FontAwesomeIcon icon={faBarcode} />
                          <span>Market</span>
                        </NavLink>
                        <NavLink to="/admin/workshop" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                          <FontAwesomeIcon icon={faGlobe} />
                          <span>Workshop</span>
                        </NavLink>
                      </div>
                    )}
                  </div>

                  {/* Sub-dropdown: Configuración */}
                  <div className="subdropdown-container">
                    <button className={`subdropdown-header${openDropdowns['config'] ? ' open' : ''}`} onClick={() => toggleDropdown('config')}>
                      <FontAwesomeIcon icon={faPalette} />
                      <span>Configuración</span>
                      <FontAwesomeIcon icon={faChevronDown} className="dropdown-chevron" rotation={openDropdowns['config'] ? 180 : 0} />
                    </button>
                    {openDropdowns['config'] && (
                      <div className="subdropdown-content">
                        <NavLink to="/admin/settings" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                          <FontAwesomeIcon icon={faPalette} />
                          <span>Colores y QR</span>
                        </NavLink>
                        <NavLink to="/admin/configurations" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                          <FontAwesomeIcon icon={faCreditCard} />
                          <span>Pagos</span>
                        </NavLink>
                        <NavLink to="/admin/worker-config" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                          <FontAwesomeIcon icon={faCreditCard} />
                          <span>Pago manual</span>
                        </NavLink>
                        <NavLink to="/admin/store-pin" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                          <FontAwesomeIcon icon={faLock} />
                          <span>PIN Tienda</span>
                        </NavLink>
                        <NavLink to="/admin/devices" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                          <FontAwesomeIcon icon={faTabletAlt} />
                          <span>Dispositivos</span>
                        </NavLink>
                        <NavLink to="/admin/screensaver" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                          <FontAwesomeIcon icon={faTv} />
                          <span>Salva Pantallas</span>
                        </NavLink>
                      </div>
                    )}
                  </div>

                  {/* Sub-dropdown: Cuenta */}
                  <div className="subdropdown-container">
                    <button className={`subdropdown-header${openDropdowns['cuenta'] ? ' open' : ''}`} onClick={() => toggleDropdown('cuenta')}>
                      <FontAwesomeIcon icon={faCrown} />
                      <span>Cuenta</span>
                      <FontAwesomeIcon icon={faChevronDown} className="dropdown-chevron" rotation={openDropdowns['cuenta'] ? 180 : 0} />
                    </button>
                    {openDropdowns['cuenta'] && (
                      <div className="subdropdown-content">
                        <NavLink to="/admin/plans" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                          <FontAwesomeIcon icon={faCrown} />
                          <span>Planes</span>
                        </NavLink>
                        <NavLink to="/admin/plugins" end className="dropdown-item" onClick={() => setMenuOpen(false)}>
                          <FontAwesomeIcon icon={faPuzzlePiece} />
                          <span>Plugins</span>
                        </NavLink>
                        <NavLink to="/admin/tickets" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                          <FontAwesomeIcon icon={faTicketAlt} />
                          <span>Soporte</span>
                        </NavLink>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </li>
          </ul>

          <div className="sidebar-footer">
            <a href="https://srservi2.srautomatic.com/worker-login" target="_blank" rel="noopener noreferrer" className="sidebar-logout-btn" style={{ color: '#D4AF37', textDecoration: 'none' }}>
              <FontAwesomeIcon icon={faUserCog} />
              <span>Panel Vendedor</span>
            </a>
            <button onClick={handleLogout} className="sidebar-logout-btn">
              <FontAwesomeIcon icon={faSignOutAlt} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </nav>

        <main className={isEditorMode ? 'admin-content admin-content--editor-desktop' : 'admin-content admin-content--no-sidebar'}>
          {isEditorMode && !menuOpen && (
            <div style={{ position: 'fixed', top: '12px', left: '12px', zIndex: 99999 }}>
              <button
                onClick={() => setMenuOpen(true)}
                title="Abrir menú"
                style={{
                  background: 'rgba(0,0,0,0.75)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  backdropFilter: 'blur(4px)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                  lineHeight: 1
                }}
              >
                ☰
              </button>
            </div>
          )}
          <div className="mobile-header" style={isEditorMode ? { display: 'none' } : {}}>
            <button className="mobile-header-btn" onClick={() => setMenuOpen(true)}>
              <FontAwesomeIcon icon={faBars} />
            </button>
            {isMobile && <h1>SRServi</h1>}
            <a
              href="https://srservi2.srautomatic.com/worker-login"
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', textDecoration: 'none' }}
            >
              <FontAwesomeIcon icon={faUserCog} />
              <span>Panel Vendedor</span>
            </a>
            {user?.support_pin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0f0f0', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', color: '#666' }}>
                <FontAwesomeIcon icon={faLock} style={{ color: '#9b59b6' }} />
                <span>PIN: <strong style={{ letterSpacing: '2px', color: '#333' }}>{user.support_pin}</strong></span>
              </div>
            )}
          </div>
          <Outlet />
        </main>
      </div>
    </StoreContext.Provider>
  );
}

export default Layout;
