import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Store, Sprout } from 'lucide-react';
import { useAuth } from '../store/auth.js';
import { Button, Input } from '../components/ui.jsx';
import { Toaster, toast } from '../components/Toast.jsx';
import AppFooter from '../components/AppFooter.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      toast.success('Welcome back!');
      nav('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-green-primary">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-lg leading-tight">Mitch Agri Supply</p>
              <p className="text-white/70 text-sm">POS & Inventory System</p>
            </div>
          </div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <h1 className="text-4xl font-semibold leading-tight max-w-md">
              Manage your agri supply store with ease.
            </h1>
            <p className="mt-4 text-white/75 max-w-md">
              Track stock, watch expiry dates, ring up sales — all in one clean dashboard for Mitch Agri Supply.
            </p>
          </motion.div>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Sprout className="w-4 h-4" /> A thesis project by ISU Roxas BSIT
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-green-primary flex items-center justify-center">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-semibold text-lg leading-tight">Mitch Agri Supply</p>
              <p className="text-mid-500 text-sm">POS & Inventory System</p>
            </div>
          </div>
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="text-mid-500 mt-1 mb-8">Use your store account to continue.</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-2xl bg-status-danger/10 text-status-danger text-sm font-medium">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. admin" autoFocus />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          <Button className="w-full mt-8" disabled={loading || !username || !password}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>

          <div className="mt-8 text-xs text-mid-500 bg-brand-100 rounded-2xl p-4">
            <p className="font-medium text-ink-900 mb-1">Demo accounts</p>
            <p>admin / admin123 (full access)</p>
            <p>cashier / cashier123 (POS + view products)</p>
          </div>
          <AppFooter className="mt-6" />
        </motion.form>
      </div>
      <Toaster />
    </div>
  );
}