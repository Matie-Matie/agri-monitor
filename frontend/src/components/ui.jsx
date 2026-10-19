import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Box } from 'lucide-react';

export function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-card shadow-card ${className}`}>{children}</div>;
}

export function Badge({ tone = 'ok', children }) {
  const tones = {
    ok: 'bg-green-mint text-green-dark',
    warn: 'bg-status-warn/15 text-status-warn',
    danger: 'bg-status-danger/15 text-status-danger',
    neutral: 'bg-brand-100 text-mid-500',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-mid-500">
      <div className="w-8 h-8 border-4 border-green-primary/20 border-t-green-primary rounded-full animate-spin" />
      {label && <p className="mt-4 text-sm">{label}</p>}
    </div>
  );
}

export function EmptyState({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-mid-500">
      <div className="w-16 h-16 rounded-3xl bg-brand-100 flex items-center justify-center mb-4">
        <Box className="w-8 h-8 text-mid-300" />
      </div>
      <p className="font-medium text-ink-900">{title}</p>
      {subtitle && <p className="text-sm mt-1">{subtitle}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, hideClose = false, wide = false }) {
  // Esc always closes, so a modal without the corner X is never a trap.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`bg-white rounded-container shadow-modal w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-100 sticky top-0 bg-white z-10 rounded-t-container">
              <h3 className="font-semibold text-lg">{title}</h3>
              {!hideClose && (
                <button onClick={onClose} className="p-1.5 rounded-full hover:bg-brand-100 text-mid-500">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Button({ children, variant = 'primary', className = '', disabled, ...props }) {
  const variants = {
    primary: 'bg-green-primary text-white hover:bg-green-dark shadow-md shadow-green-primary/20',
    outline: 'border border-brand-200 text-ink-900 hover:bg-brand-100',
    ghost: 'text-mid-500 hover:bg-brand-100',
    danger: 'bg-status-danger/10 text-status-danger hover:bg-status-danger/20',
  };
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ label, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium mb-1.5 text-ink-900">{label}</span>}
      <input
        className={`w-full px-4 py-2.5 rounded-full border border-brand-100 bg-white focus:outline-none focus:ring-2 focus:ring-green-primary/30 focus:border-green-primary transition-all ${className}`}
        {...props}
      />
    </label>
  );
}

export function Select({ label, children, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium mb-1.5 text-ink-900">{label}</span>}
      <select
        className={`w-full px-4 py-2.5 rounded-full border border-brand-100 bg-white focus:outline-none focus:ring-2 focus:ring-green-primary/30 focus:border-green-primary transition-all ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function numberFormat(n) {
  return new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));
}

export function peso(n) {
  return `₱${numberFormat(n)}`;
}

export const fmtDate = (s) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const fmtDateTime = (s) => {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};