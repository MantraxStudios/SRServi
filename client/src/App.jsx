import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import Minimarket from './pages/Minimarket';
import Index from './pages/Index';
import Store from './pages/Store';
import TvDisplay from './pages/TvDisplay';
import Docs from './pages/Docs';
import SuperadminLogin from './pages/superadmin/SuperadminLogin';
import SuperadminDashboard from './pages/superadmin/SuperadminDashboard';

const TV_CODE_KEY = 'srservi_tv_code';

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
            margin: '0 auto 16px', fontSize: '22px', fontWeight: '900', color: '#0a0a0a'
          }}>SR</div>
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
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/store/:code" element={<Store />} />
          <Route path="/tv" element={<TvEntry />} />
          <Route path="/tv/:code" element={<TvDisplay />} />
          <Route path="/market/:code" element={<Minimarket />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin" element={<ProtectedRoute><PluginProvider mode="admin"><Layout /></PluginProvider></ProtectedRoute>}>
            <Route index element={<AdminEditorRedirect />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="stores" element={<Stores />} />
            <Route path="categories" element={<Categories />} />
            <Route path="products" element={<Products />} />
            <Route path="ingredients" element={<Complements />} />
            <Route path="extras" element={<Complements />} />
            <Route path="complements" element={<Complements />} />
            <Route path="orders" element={<Orders />} />
            <Route path="workers" element={<Workers />} />
            <Route path="mercado-pago-points" element={<MercadoPagoPoints />} />
            <Route path="coupons" element={<Coupons />} />
            <Route path="configurations" element={<Configurations />} />
            <Route path="market" element={<Market />} />
            <Route path="plans" element={<Plans />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="worker-config" element={<WorkerConfig />} />
            <Route path="store-pin" element={<StorePin />} />
            <Route path="plugins" element={<Plugins />} />
            <Route path="plugins/:pluginId" element={<PluginPage />} />
            <Route path="workshop" element={<Workshop />} />
            <Route path="devices" element={<Devices />} />
            <Route path="screensaver" element={<Screensaver />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="tutoriales" element={<Tutoriales />} />
            <Route path="settings" element={<Settings />} />
            <Route path="leon-ia" element={<LeonIA />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="editor/:code" element={<Store />} />
          </Route>
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
