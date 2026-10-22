import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, ShoppingCart, Package, Truck, Receipt, BarChart3, Users as UsersIcon,
  ScrollText, LogOut, Store,
} from 'lucide-react';
import { useAuth, isAdmin } from '../store/auth.js';
import { APP_VERSION, APP_UPDATED } from '../version.js';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pos', label: 'Point of Sale', icon: ShoppingCart },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, admin: true },
  { to: '/sales', label: 'Sales', icon: Receipt },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/users', label: 'Users', icon: UsersIcon, admin: true },
  { to: '/activity', label: 'Activity Log', icon: ScrollText, admin: true },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="flex min-h-screen bg-brand-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-brand-100 flex flex-col z-20">
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-green-primary flex items-center justify-center shadow-lg shadow-green-primary/20">
              <Store className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-mid-500">Agri Monitor</p>
          </div>
          <p className="mt-3 text-[1.7rem] font-extrabold leading-[1.05] tracking-tight text-green-dark">
            Mitch Agri Supply
          </p>
          <span
            className="inline-flex mt-2.5 px-2.5 py-0.5 rounded-full bg-green-light text-green-dark text-xs font-semibold"
            title={`Updated ${APP_UPDATED}`}
          >
            Version {APP_VERSION} · Revision {APP_VERSION - 1}
          </span>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems
            .filter((item) => !item.admin || isAdmin())
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-green-primary text-white shadow-md shadow-green-primary/20'
                      : 'text-ink-900 hover:bg-green-mint/60'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            ))}
        </nav>

        <div className="p-4 border-t border-brand-100">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-green-light text-green-dark flex items-center justify-center font-semibold">
              {user?.name?.[0] || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-mid-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); nav('/login'); }}
            className="flex items-center gap-2 w-full px-4 py-2 rounded-full text-sm text-mid-500 hover:bg-brand-100 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64 p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}