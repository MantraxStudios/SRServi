import { BrowserRouter as Router, MemoryRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RoleProvider, PermissionGate } from './context/RoleContext';
import { useStore } from './components/Layout';
import { PluginProvider } from './context/PluginContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import WorkerLogin from './pages/WorkerLogin';
import WorkerPanel from './pages/WorkerPanel';
import Dashboard from './pages/admin/Dashboard';
import Stores from './pages/admin/Stores';
import Categories from './pages/admin/Categories';
import Products from './pages/admin/Products';
import Ingredients from './pages/admin/Ingredients';
import Extras from './pages/admin/Extras';
import Complements from './pages/admin/Complements';
import Orders from './pages/admin/Orders';
import Workers from './pages/admin/Workers';
import Settings from './pages/admin/Settings';
import MercadoPagoPoints from './pages/admin/MercadoPagoPoints';
import Coupons from './pages/admin/Coupons';
import Configurations from './pages/admin/Configurations';
import Market from './pages/admin/Market';
import Plans from './pages/admin/Plans';
import Analytics from './pages/admin/Analytics';
import WorkerConfig from './pages/admin/WorkerConfig';
import StorePin from './pages/admin/StorePin';
import Plugins from './pages/admin/Plugins';
import PluginPage from './pages/admin/PluginPage';
import Workshop from './pages/admin/Workshop';
import Devices from './pages/admin/Devices';
import Tickets from './pages/admin/Tickets';
import Screensaver from './pages/admin/Screensaver';
import Tutoriales from './pages/admin/Tutoriales';
import LeonIA from './pages/admin/LeonIA';
import Tasks from './pages/admin/Tasks';
import Inventory from './pages/admin/Inventory';
import Procedures from './pages/admin/Procedures';
import PeopleCounter from './pages/admin/PeopleCounter';
import TableMap from './pages/admin/TableMap';
import DeliveryLanding from './pages/DeliveryLanding';
import DeliveryStore from './pages/DeliveryStore';
import DeliveryTrack from './pages/DeliveryTrack';
import DeliveryAccount from './pages/DeliveryAccount';
import DeliveryConfig from './pages/admin/DeliveryConfig';
import SubdomainConfig from './pages/admin/SubdomainConfig';
import RolesManager from './pages/admin/RolesManager';
import SubAccounts from './pages/admin/SubAccounts';
import Minimarket from './pages/Minimarket';
import Index from './pages/Index';
import Store from './pages/Store';
import TvDisplay from './pages/TvDisplay';
import Docs from './pages/Docs';
import Rate from './pages/Rate';
import ClientSurvey from './pages/ClientSurvey';
import Ratings from './pages/admin/Ratings';
import SurveyConfig from './pages/admin/SurveyConfig';
import RappiIntegration from './pages/admin/RappiIntegration';
import PedidosYaIntegration from './pages/admin/PedidosYaIntegration';
import UberEatsIntegration from './pages/admin/UberEatsIntegration';
import Novedades from './pages/admin/Novedades';
import InstagramAuto from './pages/admin/InstagramAuto';
import TikTokAuto from './pages/admin/TikTokAuto';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsConditions from './pages/TermsConditions';
import CashRegisters from './pages/admin/CashRegisters';
import CCTV from './pages/admin/CCTV';
import WhatsApp from './pages/admin/WhatsApp';
import AttendanceAdmin from './pages/admin/AttendanceAdmin';
import LoyaltyConfig from './pages/admin/LoyaltyConfig';
import VentasDelMes from './pages/admin/VentasDelMes';
import VentasDelDia from './pages/admin/VentasDelDia';
import Attendance from './pages/Attendance';
import SuperadminLogin from './pages/superadmin/SuperadminLogin';
import SuperadminDashboard from './pages/superadmin/SuperadminDashboard';
import Ticketeria from './pages/admin/Ticketeria';
import TicketeriaPublic from './pages/TicketeriaPublic';
import TicketViewer from './pages/TicketViewer';

const TV_CODE_KEY = 'srservi_tv_code';
const API_HOST = 'srservi2.srautomatic.com';

// Detects if app is running on a store subdomain (e.g. mitienda.srautomatic.com)
function getSubdomainInfo() {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168')) return null;
  const parts = hostname.split('.');
  if (parts.length < 3) return null;
  const apiParts = API_HOST.split('.');
  const baseDomain = apiParts.slice(1).join('.');
  if (!hostname.endsWith('.' + baseDomain)) return null;
  const sub = parts[0];
  if (sub === apiParts[0]) return null; // same as main app
  return sub;
}

function SubdomainDelivery({ subdomain }) {
  const [storeCode, setStoreCode] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`https://${API_HOST}/api/stores/by-subdomain/${subdomain}`)
      .then(r => r.json())
      .then(d => { if (d.code) setStoreCode(d.code); else setNotFound(true); })
      .catch(() => setNotFound(true));
  }, [subdomain]);

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏪</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 8 }}>Tienda no encontrada</div>
        <div style={{ fontSize: 14 }}>El subdominio <strong>{subdomain}</strong> no está registrado.</div>
      </div>
    </div>
  );

  if (!storeCode) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: 16 }}>Cargando tienda...</div>
    </div>
  );

  return (
    <MemoryRouter initialEntries={[`/delivery/${storeCode}`]}>
      <Routes>
        <Route path="/delivery/account" element={<DeliveryAccount />} />
        <Route path="/delivery/track/:orderId" element={<DeliveryTrack />} />
        <Route path="/delivery/:code" element={<DeliveryStore />} />
        <Route path="/delivery" element={<Navigate to={`/delivery/${storeCode}`} replace />} />
      </Routes>
    </MemoryRouter>
  );
}

function TvEntry() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(TV_CODE_KEY);
    if (saved) navigate(`/tv/${saved}`, { replace: true });
  }, [navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('Ingresa el código de tienda'); return; }
    localStorage.setItem(TV_CODE_KEY, trimmed);
    navigate(`/tv/${trimmed}`, { replace: true });
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif'
    }}>
      <div style={{
        background: '#141414', borderRadius: '16px', padding: '48px 40px',
        width: '100%', maxWidth: '380px', border: '1px solid rgba(212,175,55,0.2)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '60px', height: '60px', background: '#D4AF37', borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}><img src="/iconweb.png" alt="SRServi" style={{ width: 44, height: 44, objectFit: 'contain' }} /></div>
          <h1 style={{ color: '#fff', fontSize: '22px', margin: '0 0 6px', fontWeight: '700' }}>Pantalla TV</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>Ingresa el código de tu tienda</p>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={code}
            onChange={e => { setCode(e.target.value); setError(''); }}
            placeholder="Ej: ABC123"
            autoFocus
            style={{
              width: '100%', padding: '14px 16px', fontSize: '18px', letterSpacing: '4px',
              textAlign: 'center', textTransform: 'uppercase', background: '#1a1a1a',
              border: '1px solid rgba(212,175,55,0.3)', borderRadius: '10px', color: '#fff',
              outline: 'none', boxSizing: 'border-box', marginBottom: '8px'
            }}
          />
          {error && <p style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center', margin: '0 0 8px' }}>{error}</p>}
          <button
            type="submit"
            style={{
              width: '100%', padding: '14px', background: 'linear-gradient(135deg,#D4AF37,#b8972e)',
              border: 'none', borderRadius: '10px', color: '#0a0a0a', fontWeight: '700',
              fontSize: '15px', cursor: 'pointer', marginTop: '8px'
            }}
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminEditorRedirect() {
  const { selectedStore, storeLoading } = useStore();
  const { token } = useAuth();
  if (storeLoading) return <div className="loading">Cargando...</div>;
  if (!selectedStore) return <Navigate to="/admin/stores" replace />;
  return <Navigate to={`/admin/editor/${selectedStore.code}?admin_edit=${token}`} replace />;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  if (user) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

function App() {
  const subdomain = getSubdomainInfo();
  if (subdomain) return <SubdomainDelivery subdomain={subdomain} />;

  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsConditions />} />
          <Route path="/store/:code" element={<Store />} />
          <Route path="/rate/:code" element={<Rate />} />
          <Route path="/survey/:code" element={<ClientSurvey />} />
          <Route path="/delivery" element={<DeliveryLanding />} />
          <Route path="/delivery/:code" element={<DeliveryStore />} />
          <Route path="/delivery/track/:orderId" element={<DeliveryTrack />} />
          <Route path="/delivery/account" element={<DeliveryAccount />} />
          <Route path="/tv" element={<TvEntry />} />
          <Route path="/tv/:code" element={<TvDisplay />} />
          <Route path="/market/:code" element={<Minimarket />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin" element={<ProtectedRoute><PluginProvider mode="admin"><RoleProvider><Layout /></RoleProvider></PluginProvider></ProtectedRoute>}>
            <Route index element={<AdminEditorRedirect />} />
            <Route path="dashboard" element={<PermissionGate section="dashboard"><Dashboard /></PermissionGate>} />
            <Route path="stores" element={<Stores />} />
            <Route path="categories" element={<PermissionGate section="categories"><Categories /></PermissionGate>} />
            <Route path="products" element={<PermissionGate section="products"><Products /></PermissionGate>} />
            <Route path="ingredients" element={<PermissionGate section="categories"><Complements /></PermissionGate>} />
            <Route path="extras" element={<PermissionGate section="categories"><Complements /></PermissionGate>} />
            <Route path="complements" element={<PermissionGate section="categories"><Complements /></PermissionGate>} />
            <Route path="orders" element={<PermissionGate section="orders"><Orders /></PermissionGate>} />
            <Route path="workers" element={<PermissionGate section="workers"><Workers /></PermissionGate>} />
            <Route path="mercado-pago-points" element={<MercadoPagoPoints />} />
            <Route path="coupons" element={<PermissionGate section="coupons"><Coupons /></PermissionGate>} />
            <Route path="configurations" element={<PermissionGate section="configurations"><Configurations /></PermissionGate>} />
            <Route path="market" element={<Market />} />
            <Route path="plans" element={<Plans />} />
            <Route path="analytics" element={<PermissionGate section="analytics"><Analytics /></PermissionGate>} />
            <Route path="worker-config" element={<WorkerConfig />} />
            <Route path="store-pin" element={<StorePin />} />
            <Route path="plugins" element={<Plugins />} />
            <Route path="plugins/:pluginId" element={<PluginPage />} />
            <Route path="workshop" element={<Workshop />} />
            <Route path="devices" element={<Devices />} />
            <Route path="screensaver" element={<Screensaver />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="tutoriales" element={<Tutoriales />} />
            <Route path="settings" element={<PermissionGate section="settings"><Settings /></PermissionGate>} />
            <Route path="leon-ia" element={<LeonIA />} />
            <Route path="tasks" element={<PermissionGate section="tasks"><Tasks /></PermissionGate>} />
            <Route path="inventory" element={<PermissionGate section="inventory"><Inventory /></PermissionGate>} />
            <Route path="procedures" element={<PermissionGate section="procedures"><Procedures /></PermissionGate>} />
            <Route path="tables" element={<PermissionGate section="tables"><TableMap /></PermissionGate>} />
            <Route path="delivery" element={<PermissionGate section="delivery"><DeliveryConfig /></PermissionGate>} />
            <Route path="subdomain" element={<SubdomainConfig />} />
            <Route path="roles" element={<RolesManager />} />
            <Route path="sub-accounts" element={<SubAccounts />} />
            <Route path="ratings" element={<PermissionGate section="ratings"><Ratings /></PermissionGate>} />
            <Route path="people-counter" element={<PermissionGate section="people_counter"><PeopleCounter /></PermissionGate>} />
            <Route path="survey-config" element={<SurveyConfig />} />
            <Route path="rappi" element={<PermissionGate section="canales"><RappiIntegration /></PermissionGate>} />
            <Route path="pedidosya" element={<PermissionGate section="canales"><PedidosYaIntegration /></PermissionGate>} />
            <Route path="ubereats" element={<PermissionGate section="canales"><UberEatsIntegration /></PermissionGate>} />
            <Route path="novedades" element={<Novedades />} />
            <Route path="instagram" element={<PermissionGate section="canales"><InstagramAuto /></PermissionGate>} />
            <Route path="tiktok" element={<PermissionGate section="canales"><TikTokAuto /></PermissionGate>} />
            <Route path="cash-registers" element={<PermissionGate section="cash_registers"><CashRegisters /></PermissionGate>} />
            <Route path="cctv" element={<CCTV />} />
            <Route path="whatsapp" element={<PermissionGate section="whatsapp"><WhatsApp /></PermissionGate>} />
            <Route path="attendance" element={<PermissionGate section="attendance"><AttendanceAdmin /></PermissionGate>} />
            <Route path="loyalty" element={<PermissionGate section="loyalty"><LoyaltyConfig /></PermissionGate>} />
            <Route path="ventas-mes" element={<PermissionGate section="ventas_mes"><VentasDelMes /></PermissionGate>} />
            <Route path="ventas-dia" element={<PermissionGate section="analytics"><VentasDelDia /></PermissionGate>} />
            <Route path="ticketeria" element={<Ticketeria />} />
            <Route path="editor/:code" element={<Store />} />
          </Route>
          <Route path="/tickets/:storeCode" element={<TicketeriaPublic />} />
          <Route path="/ticket/:code" element={<TicketViewer />} />
          <Route path="/attendance/:storeCode" element={<Attendance />} />
          <Route path="/worker-login" element={<WorkerLogin />} />
          <Route path="/worker-panel" element={<WorkerPanel />} />
          <Route path="/superadmin/login" element={<SuperadminLogin />} />
          <Route path="/superadmin/dashboard" element={<SuperadminDashboard />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
