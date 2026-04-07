import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
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
import Minimarket from './pages/Minimarket';
import Index from './pages/Index';
import Store from './pages/Store';
import SuperadminLogin from './pages/superadmin/SuperadminLogin';
import SuperadminDashboard from './pages/superadmin/SuperadminDashboard';

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
          <Route path="/market/:code" element={<Minimarket />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
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
            <Route path="settings" element={<Settings />} />
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
