import { create } from 'zustand';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const useToastStore = create((set) => ({
  toasts: [],
  add: (toast) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, ...toast }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), toast.duration || 3500);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (message) => useToastStore.getState().add({ type: 'success', message }),
  error: (message) => useToastStore.getState().add({ type: 'error', message }),
};

export function Toaster() {
  const { toasts, remove } = useToastStore();
  return (
    <div className="fixed top-5 right-5 z-[100] space-y-3">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            className={`flex items-center gap-3 pl-4 pr-3 py-3 rounded-2xl bg-white shadow-modal text-sm font-medium min-w-[260px] max-w-sm ${
              t.type === 'success' ? 'border-l-4 border-green-primary' : 'border-l-4 border-status-danger'
            }`}
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-green-primary shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-status-danger shrink-0" />
            )}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="p-1 rounded-full hover:bg-brand-100 text-mid-500">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}