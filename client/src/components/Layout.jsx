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
  faRobot,
  faCopy,
  faClipboardList,
  faWarehouse,
  faStar,
  faMotorcycle,
  faBell,
  faVideo,
  faDownload,
  faLaptop,
} from '@fortawesome/free-solid-svg-icons';

export const StoreContext = createContext();

export const useStore = () => useContext(StoreContext);

function AppDownloadCard({ icon, title, description, loading, buildState, disabled, onDownload, fileType }) {
  const isBuilding = buildState?.status === 'building' || loading;
  const hasError = buildState?.status === 'error';
  const progress = buildState?.progress;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', borderRadius: '10px',
      padding: '10px 12px', border: '1px solid rgba(255,255,255,0.07)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <span style={{ fontWeight: '700', color: '#fff', fontSize: '13px' }}>{title}</span>
      </div>
      <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#888', lineHeight: '1.4' }}>{description}</p>
      {hasError && (
        <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#f87171', lineHeight: '1.4' }}>
          Error: {progress}
        </p>
      )}
      {isBuilding && progress && (
        <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#D4AF37', lineHeight: '1.4' }}>{progress}</p>
      )}
      <button
        onClick={onDownload}
        disabled={isBuilding || disabled}
        style={{
          width: '100%', padding: '7px 10px',
          background: isBuilding ? 'rgba(212,175,55,0.25)' : hasError ? 'rgba(239,68,68,0.15)' : '#D4AF37',
          border: hasError ? '1px solid rgba(239,68,68,0.4)' : 'none',
          borderRadius: '7px', color: isBuilding ? '#D4AF37' : hasError ? '#f87171' : '#000',
          fontWeight: '700', fontSize: '12px',
          cursor: isBuilding || disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          transition: 'all 0.15s'
        }}
      >
        {isBuilding ? (
          <>
            <div style={{ width: '10px', height: '10px', border: '2px solid rgba(212,175,55,0.3)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            Compilando...
          </>
        ) : (
          <>
            <FontAwesomeIcon icon={faDownload} />
            {hasError ? 'Reintentar' : `Descargar ${fileType}`}
          </>
        )}
      </button>
    </div>
  );
}

function Layout() {
  const { user, token, logout } = useAuth();
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isEditorMode = location.pathname.startsWith('/admin/editor');
  const isLeonIA = location.pathname.startsWith('/admin/leon-ia');
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [serverDown, setServerDown] = useState(false);
  const [unreadUpdates, setUnreadUpdates] = useState(0);
  const [duplicateModal, setDuplicateModal] = useState(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  const [appDownloading, setAppDownloading] = useState(false);
  const [androidBuilds, setAndroidBuilds] = useState({}); // { launcher: {status,jobId,progress}, ... }

  useEffect(() => {
    if (isEditorMode) setMenuOpen(prev => prev === false ? true : prev);
  }, []);  // Solo al montar — no re-abrir si el usuario lo cerró manualmente

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
    if (!token) return;
    fetch(API + '/api/updates', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => setUnreadUpdates(d.unread || 0))
      .catch(() => {});
  }, [token]);

  // Clear badge when user navigates to /admin/novedades
  useEffect(() => {
    if (location.pathname === '/admin/novedades') setUnreadUpdates(0);
  }, [location.pathname]);

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

      if (response.status === 401 || response.status === 403) {
        logout();
        navigate('/login');
        return;
      }

      const data = await response.json();

      if (!Array.isArray(data)) return;

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
    if (isEditorMode) {
      window.location.href = `/admin/editor/${store.code}?admin_edit=${token}`;
    }
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

  const handleAndroidBuild = async (appName, label, explicitStoreCode) => {
    if (androidBuilds[appName]?.status === 'building') return;
    const storeCode = explicitStoreCode !== undefined ? explicitStoreCode : selectedStore?.code;

    setAndroidBuilds(prev => ({ ...prev, [appName]: { status: 'building', progress: 'Iniciando...', jobId: null } }));

    try {
      const res = await fetch(`${API}/api/apps/android/build`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName, storeCode })
      });
      const data = await res.json();
      if (!res.ok) {
        setAndroidBuilds(prev => ({ ...prev, [appName]: { status: 'error', progress: data.error } }));
        return;
      }

      if (data.cached || data.status === 'done') {
        // APK already ready, download immediately
        triggerAndroidDownload(appName, storeCode, null);
        setAndroidBuilds(prev => ({ ...prev, [appName]: { status: 'idle' } }));
        return;
      }

      // Poll until done
      const jobId = data.jobId;
      setAndroidBuilds(prev => ({ ...prev, [appName]: { status: 'building', progress: 'Compilando...', jobId } }));

      const poll = async () => {
        try {
          const sr = await fetch(`${API}/api/apps/android/status/${jobId}`, {
            headers: { Authorization: 'Bearer ' + token }
          });
          const st = await sr.json();
          if (st.status === 'done') {
            triggerAndroidDownload(appName, storeCode, jobId);
            setAndroidBuilds(prev => ({ ...prev, [appName]: { status: 'idle' } }));
          } else if (st.status === 'error') {
            setAndroidBuilds(prev => ({ ...prev, [appName]: { status: 'error', progress: st.error } }));
          } else {
            setAndroidBuilds(prev => ({ ...prev, [appName]: { status: 'building', progress: st.progress, jobId } }));
            setTimeout(poll, 4000);
          }
        } catch {
          setTimeout(poll, 6000);
        }
      };
      setTimeout(poll, 4000);
    } catch {
      setAndroidBuilds(prev => ({ ...prev, [appName]: { status: 'error', progress: 'Error de conexión' } }));
    }
  };

  const triggerAndroidDownload = (appName, storeCode, jobId) => {
    const params = new URLSearchParams({ appName });
    if (storeCode) params.set('storeCode', storeCode);
    if (jobId) params.set('jobId', jobId);
    const a = document.createElement('a');
    a.href = `${API}/api/apps/android/download?${params}`;
    // Attach token via fetch + blob since this endpoint requires auth
    fetch(a.href, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = storeCode ? `${appName}-${storeCode}.apk` : `${appName}.apk`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(() => alert('Error al descargar el APK'));
  };

  const handleDownloadWindowsApp = async (explicitStoreCode) => {
    const code = explicitStoreCode || selectedStore?.code;
    if (!code || appDownloading) return;
    setAppDownloading(true);
    try {
      const res = await fetch(`${API}/api/apps/windows?storeCode=${code}`, {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Error al descargar la app');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SRServi-Totem-${code}.exe`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('Error de conexión al descargar la app');
    } finally {
      setAppDownloading(false);
    }
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
      {menuOpen && (
        <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />
      )}
      {serverDown && (
        <div style={{
          position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 99999,
          background: '#1a1a1a',
          border: '1px solid #D4AF3766',
          borderRadius: '14px',
          padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
          animation: 'slideUp 0.25s ease',
          maxWidth: 'calc(100vw - 40px)',
          whiteSpace: 'nowrap',
        }}>
          <div style={{
            width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
            border: '2.5px solid transparent',
            borderTopColor: '#D4AF37',
            animation: 'spin 0.9s linear infinite',
          }} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff', fontFamily: 'sans-serif' }}>
            Sin conexión con el servidor
          </span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', fontFamily: 'sans-serif' }}>
            · Reconectando...
          </span>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
          `}</style>
        </div>
      )}
      <div className="layout-wrapper" style={{
        '--store-primary': colors.primary,
        '--store-secondary': colors.secondary,
        '--store-accent': colors.accent,
        '--sidebar-w': (isEditorMode && menuOpen && !isMobile) ? '270px' : '0px'
      }}>
        <nav className={`admin-sidebar ${(isEditorMode || isLeonIA) ? (menuOpen ? 'editor-sidebar-open' : 'editor-hidden') : (menuOpen ? 'mobile-open' : 'mobile-closed')}${(!isEditorMode && !isLeonIA) && menuOpen && !isMobile ? ' desktop-sidebar-open' : ''}`}>
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

          <div className="store-selector-row">
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
            <button onClick={handleLogout} className="sidebar-logout-top" title="Cerrar Sesión">
              <FontAwesomeIcon icon={faSignOutAlt} />
            </button>
          </div>

          <ul className="sidebar-nav" onClick={(e) => { if (!e.target.closest('.dropdown-item') && !e.target.closest('.dropdown-header') && !e.target.closest('.dropdown-container')) setMenuOpen(false); }}>

            {/* ── León IA ── */}
            <li>
              <NavLink to="/admin/leon-ia" className="leon-ia-nav-link" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faRobot} />
                <span>León IA</span>
                <span className="leon-ia-nav-badge">IA</span>
              </NavLink>
            </li>

            {/* ── OPERACIONES ── */}
            <li className="sidebar-section-label">Operaciones</li>
            <li>
              <NavLink to="/admin/orders" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faShoppingBag} />
                <span>Pedidos</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/products" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faBox} />
                <span>Productos</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/analytics" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faChartLine} />
                <span>Análisis</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/cash-registers" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faCashRegister} />
                <span>Historial de Caja</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/ratings" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faStar} />
                <span>Calificaciones</span>
              </NavLink>
            </li>

            {/* ── GESTIÓN ── */}
            <li className="sidebar-section-label">Gestión</li>
            <li>
              <NavLink to="/admin/workers" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faUsers} />
                <span>Vendedores</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/tasks" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faClipboardList} />
                <span>Tareas</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/inventory" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faWarehouse} />
                <span>Inventario</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/procedures" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faList} />
                <span>Procedimientos</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/coupons" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faPercent} />
                <span>Cupones</span>
              </NavLink>
            </li>

            {/* ── CANALES ── */}
            <li className="sidebar-section-label">Canales</li>
            <li>
              <NavLink to="/admin/whatsapp" onClick={() => setMenuOpen(false)}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="#25D366" style={{ flexShrink: 0 }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <span>WhatsApp</span>
              </NavLink>
            </li>
            <li className="dropdown-container">
              <button className={`dropdown-header${openDropdowns['delivery'] ? ' open' : ''}`} onClick={() => toggleDropdown('delivery')}>
                <FontAwesomeIcon icon={faMotorcycle} />
                <span>Delivery</span>
                <FontAwesomeIcon icon={faChevronDown} className="dropdown-chevron" rotation={openDropdowns['delivery'] ? 180 : 0} />
              </button>
              {openDropdowns['delivery'] && (
                <div className="dropdown-content">
                  <NavLink to="/admin/rappi" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faMotorcycle} />
                    <span>Rappi</span>
                  </NavLink>
                  <NavLink to="/admin/pedidosya" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faMotorcycle} />
                    <span>PedidosYa</span>
                  </NavLink>
                  <NavLink to="/admin/ubereats" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faMotorcycle} />
                    <span>Uber Eats</span>
                  </NavLink>
                </div>
              )}
            </li>
            <li>
              <NavLink to="/admin/instagram" onClick={() => setMenuOpen(false)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                <span>Autopublicación IG</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/tiktok" onClick={() => setMenuOpen(false)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.05a8.16 8.16 0 0 0 4.77 1.53V7.15a4.85 4.85 0 0 1-1-.46z"/></svg>
                <span>Autopublicación TikTok</span>
              </NavLink>
            </li>

            {/* ── MI TIENDA ── */}
            <li className="sidebar-section-label">Mi Tienda</li>
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
                  <FontAwesomeIcon icon={faTabletAlt} />
                  <span>Editor Tótem</span>
                </NavLink>
              </li>
            )}
            <li>
              <NavLink to="/admin/mercado-pago-points" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faCreditCard} />
                <span>Terminales POS</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/market" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faBarcode} />
                <span>Market</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/workshop" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faGlobe} />
                <span>Workshop</span>
              </NavLink>
            </li>

            {/* ── AJUSTES ── */}
            <li className="sidebar-section-label">Ajustes</li>
            <li className="dropdown-container">
              <button className={`dropdown-header${openDropdowns['config'] ? ' open' : ''}`} onClick={() => toggleDropdown('config')}>
                <FontAwesomeIcon icon={faCog} />
                <span>Configuración</span>
                <FontAwesomeIcon icon={faChevronDown} className="dropdown-chevron" rotation={openDropdowns['config'] ? 180 : 0} />
              </button>
              {openDropdowns['config'] && (
                <div className="dropdown-content">
                  <NavLink to="/admin/settings" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faPalette} />
                    <span>Colores y QR</span>
                  </NavLink>
                  <NavLink to="/admin/configurations" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faTabletAlt} />
                    <span>Tótems y Pagos</span>
                  </NavLink>
                  <NavLink to="/admin/worker-config" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faCreditCard} />
                    <span>Pago Manual</span>
                  </NavLink>
                  <NavLink to="/admin/store-pin" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faLock} />
                    <span>PIN Tienda</span>
                  </NavLink>
                  <NavLink to="/admin/screensaver" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faTv} />
                    <span>Salva Pantallas</span>
                  </NavLink>
                  <NavLink to="/admin/cctv" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                    <FontAwesomeIcon icon={faVideo} />
                    <span>Cartelería Digital</span>
                  </NavLink>
                </div>
              )}
            </li>
            <li className="dropdown-container">
              <button className={`dropdown-header${openDropdowns['misapps'] ? ' open' : ''}`} onClick={() => toggleDropdown('misapps')}>
                <FontAwesomeIcon icon={faLaptop} />
                <span>Mis Apps</span>
                <FontAwesomeIcon icon={faChevronDown} className="dropdown-chevron" rotation={openDropdowns['misapps'] ? 180 : 0} />
              </button>
              {openDropdowns['misapps'] && (
                <div className="dropdown-content" style={{ padding: '8px' }}>
                  <AppDownloadCard
                    icon="📱"
                    title="Totem Android"
                    description={<>Punto de venta Android · <strong style={{ color: '#D4AF37' }}>{selectedStore?.code}</strong></>}
                    buildState={androidBuilds['launcher']}
                    disabled={!selectedStore}
                    onDownload={() => handleAndroidBuild('launcher', 'Totem Android')}
                    fileType=".apk"
                  />
                  <div style={{ height: '8px' }} />
                  <AppDownloadCard
                    icon="💻"
                    title="Tótem Windows"
                    description={<>App kiosk para PC · <strong style={{ color: '#D4AF37' }}>{selectedStore?.code}</strong></>}
                    loading={appDownloading}
                    disabled={!selectedStore}
                    onDownload={() => handleDownloadWindowsApp()}
                    fileType=".exe"
                  />
                  <div style={{ height: '8px' }} />
                  <AppDownloadCard
                    icon="📺"
                    title="TV Órdenes"
                    description={<>Pantalla de cocina · <strong style={{ color: '#D4AF37' }}>{selectedStore?.code}</strong></>}
                    buildState={androidBuilds['tvordenes']}
                    disabled={!selectedStore}
                    onDownload={() => handleAndroidBuild('tvordenes', 'TV Órdenes')}
                    fileType=".apk"
                  />
                  <div style={{ height: '8px' }} />
                  <AppDownloadCard
                    icon="🎬"
                    title="Cartelería Digital"
                    description={<>Pantalla digital para TV · <strong style={{ color: '#D4AF37' }}>{selectedStore?.code}</strong></>}
                    buildState={androidBuilds['cctv']}
                    disabled={!selectedStore}
                    onDownload={() => handleAndroidBuild('cctv', 'CCTV')}
                    fileType=".apk"
                  />
                </div>
              )}
            </li>

            {/* ── CUENTA ── */}
            <li className="sidebar-section-label">Cuenta</li>
            <li>
              <NavLink to="/admin/plans" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faCrown} />
                <span>Planes</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/plugins" end onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faPuzzlePiece} />
                <span>Plugins</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/tickets" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faTicketAlt} />
                <span>Soporte</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/novedades" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faBell} />
                <span>Novedades</span>
                {unreadUpdates > 0 && (
                  <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 9, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', flexShrink: 0 }}>
                    {unreadUpdates}
                  </span>
                )}
              </NavLink>
            </li>
            <li>
              <NavLink to="/admin/tutoriales" onClick={() => setMenuOpen(false)}>
                <FontAwesomeIcon icon={faBookOpen} />
                <span>Tutoriales</span>
              </NavLink>
            </li>

          </ul>

        </nav>

        <main className={isEditorMode ? 'admin-content admin-content--editor-desktop' : 'admin-content admin-content--no-sidebar'}>
          {isEditorMode && !menuOpen && (
            <div style={{ position: 'fixed', top: '12px', right: '12px', zIndex: 99999 }}>
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
          <div className="mobile-header" style={(isEditorMode || isLeonIA) ? { display: 'none' } : {}}>
            {isMobile && <h1>SRServi</h1>}
            {user?.support_pin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0f0f0', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', color: '#666' }}>
                <FontAwesomeIcon icon={faLock} style={{ color: '#9b59b6' }} />
                <span>PIN: <strong style={{ letterSpacing: '2px', color: '#333' }}>{user.support_pin}</strong></span>
              </div>
            )}
            <button className="mobile-header-btn" onClick={() => setMenuOpen(true)} style={{ marginLeft: 'auto' }}>
              <FontAwesomeIcon icon={faBars} />
            </button>
          </div>
          <Outlet />
        </main>
      </div>

      {/* WhatsApp floating button */}
      {!isLeonIA && <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999 }}>
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
      </div>}

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
