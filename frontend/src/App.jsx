import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/auth.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import POS from './pages/POS.jsx';
import Products from './pages/Products.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Sales from './pages/Sales.jsx';
import Reports from './pages/Reports.jsx';
import Users from './pages/Users.jsx';
import Activity from './pages/Activity.jsx';
import Layout from './components/Layout.jsx';

function Protected({ children, adminOnly = false }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/products" element={<Products />} />
        <Route path="/inventory" element={<Navigate to="/products" replace />} />
        <Route path="/suppliers" element={<Protected adminOnly><Suppliers /></Protected>} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/users" element={<Protected adminOnly><Users /></Protected>} />
        <Route path="/activity" element={<Protected adminOnly><Activity /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}