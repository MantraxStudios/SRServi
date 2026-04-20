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
  faUserCog,
  faRobot,
  faCopy
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
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [serverDown, setServerDown] = useState(false);
  const [duplicateModal, setDuplicateModal] = useState(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');

  useEffect(() => {
    if (isEditorMode) setMenuOpen(true);
  }, [isEditorMode]);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(API + '/api/health', { cache: 'no-store' });
        setServerDown(!res.ok);
      } catch {
        setServerDown(true);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);
  const [openDropdowns, setOpenDropdowns] = useState({});

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!token) return;
    const sendHeartbeat = () => {
      fetch(API + '/api/auth/heartbeat', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } }).catch(() => {});
    };
    sendHeartbeat();
    const hbInterval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(hbInterval);
  }, [token]);

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

  const openDuplicateModal = (e, store) => {
    e.stopPropagation();
    setStoreDropdownOpen(false);
    setDuplicateModal(store);
    setDuplicateName(`${store.name} (copia)`);
    setDuplicateError('');
  };

  const handleDuplicate = async () => {
    if (!duplicateName.trim()) { setDuplicateError('El nombre es requerido'); return; }
    setDuplicateLoading(true);
    setDuplicateError('');
    try {
      const res = await fetch(`${API}/api/stores/${duplicateModal.id}/duplicate`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: duplicateName.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al duplicar');
      setDuplicateModal(null);
      await fetchStores();
      selectStore(data);
    } catch (err) {
      setDuplicateError(err.message);
    } finally {
      setDuplicateLoading(false);
    }
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
    <StoreContext.Provider value={{ selectedStore, stores, selectStore, fetchStores, colors, menuOpen, setMenuOpen, storeLoading: loading }}>
      {serverDown && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: '#000',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '28px'
        }}>
          <div style={{ position: 'relative', width: '90px', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '4px solid transparent',
              borderTopColor: '#D4AF37',
              animation: 'spin 1s linear infinite'
            }} />
            <div style={{
              position: 'absolute', inset: '10px', borderRadius: '50%',
              border: '3px solid transparent',
              borderTopColor: 'rgba(212,175,55,0.4)',
              animation: 'spin 1.6s linear infinite reverse'
            }} />
            <span style={{ fontSize: '28px' }}>⚙️</span>
          </div>
          <div style={{ textAlign: 'center', maxWidth: '360px', padding: '0 24px' }}>
            <h2 style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: '800', color: '#fff', fontFamily: 'sans-serif', letterSpacing: '0.3px' }}>
              Servidor en Mantenimiento
            </h2>
            <p style={{ margin: '0 0 6px', fontSize: '15px', color: 'rgba(255,255,255,0.6)', fontFamily: 'sans-serif', lineHeight: 1.5 }}>
              Esto desaparecerá automáticamente al reconectar comunicación con el servidor.
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: '#D4AF37', fontFamily: 'sans-serif', fontWeight: '600', letterSpacing: '0.5px' }}>
              Por favor espere...
            </p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
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
                      <button
                        className="store-dropdown-duplicate-btn"
                        title="Duplicar tienda"
                        onClick={(e) => openDuplicateModal(e, store)}
                      >
                        <FontAwesomeIcon icon={faCopy} />
                      </button>
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
                  onClick={(e) => {
                    if (isEditorMode) {
                      e.preventDefault();
                      e.stopPropagation();
                      window.location.href = `/admin/editor/${selectedStore.code}?admin_edit=${token}`;
                    } else {
                      setMenuOpen(false);
                    }
                  }}
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
            <li className="sidebar-section-label">Más</li>
            <li>
              <NavLink to="/admin/leon-ia" className="leon-ia-nav-link" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faRobot} />
                <span>León IA</span>
                <span className="leon-ia-nav-badge">IA</span>
              </NavLink>
            </li>
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

                  {/* Tutoriales */}
                  <NavLink to="/admin/tutoriales" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faBookOpen} />
                    <span>Tutoriales</span>
                  </NavLink>

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

      {/* WhatsApp floating button */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999 }}>
        {whatsappOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0 }} onClick={() => setWhatsappOpen(false)} />
            <div style={{ position: 'absolute', bottom: '64px', right: 0, background: '#fff', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', padding: '8px', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ padding: '6px 10px 8px', fontSize: '11px', fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contactar por WhatsApp</div>
              <a
                href={`https://wa.me/56996876043?text=${encodeURIComponent('Hola, me contacto desde SRServi 👋')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setWhatsappOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', textDecoration: 'none', background: '#f0fdf4', color: '#166534', fontWeight: '600', fontSize: '14px', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#dcfce7'}
                onMouseLeave={e => e.currentTarget.style.background = '#f0fdf4'}
              >
                <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', fill: '#25d366', flexShrink: 0 }}>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700' }}>Ventas</div>
                  <div style={{ fontSize: '11px', color: '#555', fontWeight: '400' }}>+56 9 9687 6043</div>
                </div>
              </a>
              <a
                href={`https://wa.me/56953509018?text=${encodeURIComponent('Hola, necesito soporte técnico de SRServi 👋')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setWhatsappOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', textDecoration: 'none', background: '#f0fdf4', color: '#166534', fontWeight: '600', fontSize: '14px', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#dcfce7'}
                onMouseLeave={e => e.currentTarget.style.background = '#f0fdf4'}
              >
                <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px', fill: '#25d366', flexShrink: 0 }}>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700' }}>Soporte</div>
                  <div style={{ fontSize: '11px', color: '#555', fontWeight: '400' }}>+56 9 5350 9018</div>
                </div>
              </a>
            </div>
          </>
        )}
        <button
          onClick={() => setWhatsappOpen(prev => !prev)}
          style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#25d366', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(37,211,102,0.45)', transition: 'transform 0.15s', position: 'relative' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          title="Contactar por WhatsApp"
        >
          <svg viewBox="0 0 24 24" style={{ width: '30px', height: '30px', fill: '#fff' }}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <span style={{ position: 'absolute', top: '-2px', right: '-2px', background: '#D4AF37', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', color: '#000', border: '2px solid #fff' }}>2</span>
        </button>
      </div>

      {/* Duplicate store modal */}
      {duplicateModal && (
        <div
          onClick={() => !duplicateLoading && setDuplicateModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99000,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#111', border: '1px solid rgba(212,175,55,0.3)',
              borderRadius: '16px', width: '100%', maxWidth: '420px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid rgba(212,175,55,0.15)',
              display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'rgba(212,175,55,0.12)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: '#D4AF37', fontSize: '15px', flexShrink: 0
              }}>
                <FontAwesomeIcon icon={faCopy} />
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: '700' }}>Duplicar Tienda</h3>
                <p style={{ margin: 0, color: '#888', fontSize: '12px' }}>"{duplicateModal.name}"</p>
              </div>
              {!duplicateLoading && (
                <button
                  onClick={() => setDuplicateModal(null)}
                  style={{
                    marginLeft: 'auto', background: 'none', border: 'none',
                    color: '#666', cursor: 'pointer', fontSize: '18px',
                    padding: '4px 8px', borderRadius: '6px', lineHeight: 1
                  }}
                >×</button>
              )}
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              <p style={{ margin: '0 0 16px', color: '#aaa', fontSize: '13px', lineHeight: '1.5' }}>
                Se copiarán todos los productos, categorías, ingredientes, extras, complementos y configuraciones.
              </p>
              <label style={{ display: 'block', color: '#ccc', fontSize: '12px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Nombre de la nueva tienda
              </label>
              <input
                type="text"
                value={duplicateName}
                onChange={e => { setDuplicateName(e.target.value); setDuplicateError(''); }}
                placeholder="Ej: Mi Tienda (copia)"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && !duplicateLoading && handleDuplicate()}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: '#1a1a1a', border: '1px solid rgba(212,175,55,0.25)',
                  borderRadius: '8px', color: '#fff', fontSize: '14px',
                  outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = '#D4AF37'}
                onBlur={e => e.target.style.borderColor = 'rgba(212,175,55,0.25)'}
              />
              {duplicateError && (
                <p style={{ margin: '8px 0 0', color: '#f87171', fontSize: '12px' }}>{duplicateError}</p>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', gap: '10px', justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setDuplicateModal(null)}
                disabled={duplicateLoading}
                style={{
                  padding: '9px 18px', borderRadius: '8px', fontSize: '13px',
                  fontWeight: '600', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.12)',
                  background: 'transparent', color: '#aaa',
                  transition: 'all 0.15s', opacity: duplicateLoading ? 0.5 : 1
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDuplicate}
                disabled={duplicateLoading || !duplicateName.trim()}
                style={{
                  padding: '9px 20px', borderRadius: '8px', fontSize: '13px',
                  fontWeight: '700', cursor: duplicateLoading || !duplicateName.trim() ? 'not-allowed' : 'pointer',
                  border: 'none', background: duplicateLoading || !duplicateName.trim() ? 'rgba(212,175,55,0.3)' : '#D4AF37',
                  color: '#000', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                {duplicateLoading ? (
                  <>
                    <div style={{
                      width: '13px', height: '13px', border: '2px solid rgba(0,0,0,0.3)',
                      borderTopColor: '#000', borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite'
                    }} />
                    Duplicando...
                  </>
                ) : (
                  <><FontAwesomeIcon icon={faCopy} />Duplicar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </StoreContext.Provider>
  );
}

export default Layout;
