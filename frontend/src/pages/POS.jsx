import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Minus, ShoppingCart, Trash2, ScanLine, CheckCircle2 } from 'lucide-react';
import api from '../api/client.js';
import { Card, Badge, Button, peso, numberFormat, Spinner } from '../components/ui.jsx';
import { toast } from '../components/Toast.jsx';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]); // {product_id, name, price, unit, qty}
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/products', { params: { per_page: 100 } }).then((r) => setProducts(r.data.data)),
      api.get('/categories').then((r) => setCategories(r.data)),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase();
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchC = activeCat === 'all' || p.category_id === Number(activeCat);
      return matchQ && matchC;
    });
  }, [products, search, activeCat]);

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const addToCart = (p) => {
    setCart((prev) => {
      const found = prev.find((i) => i.product_id === p.id);
      if (found) {
        if (found.qty >= p.stock_qty) return prev;
        return prev.map((i) => (i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i));
      }
      if (p.stock_qty <= 0) return prev;
      return [...prev, { product_id: p.id, name: p.name, price: Number(p.selling_price), unit: p.unit, qty: 1, max: p.stock_qty }];
    });
  };

  const changeQty = (id, delta) => {
    setCart((prev) => prev
      .map((i) => (i.product_id === id ? { ...i, qty: Math.max(0, Math.min(i.max || i.qty, i.qty + delta)) } : i))
      .filter((i) => i.qty > 0));
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((i) => i.product_id !== id));

  const checkout = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/sales', {
        items: cart.map((i) => ({ product_id: i.product_id, quantity: i.qty })),
      });
      setReceipt(data);
      setCart([]);
      toast.success(`Sale ${data.invoice_no} completed`);
      // refresh stock
      api.get('/products', { params: { per_page: 100 } }).then((r) => setProducts(r.data.data));
    } catch (e) {
      toast.error(e.response?.data?.message || 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner label="Loading products…" />;

  return (
    <div className="h-[calc(100vh-4rem)]">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Point of Sale</h1>
          <p className="text-mid-500">Search products, build a cart, and ring up the sale.</p>
        </div>
        <div className="hidden md:block text-sm text-mid-500">Tap a product to add to cart</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100%-4rem)]">
        {/* Product selector */}
        <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-mid-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or SKU…"
                className="w-full pl-11 pr-4 py-2.5 rounded-full border border-brand-100 bg-white focus:outline-none focus:ring-2 focus:ring-green-primary/30 focus:border-green-primary"
              />
            </div>
          </div>

          {/* Category chips */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Chip active={activeCat === 'all'} onClick={() => setActiveCat('all')}>All</Chip>
            {categories.map((c) => (
              <Chip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>{c.name}</Chip>
            ))}
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filtered.map((p) => (
                <motion.button
                  key={p.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => addToCart(p)}
                  disabled={p.stock_qty <= 0}
                  className={`text-left bg-white rounded-2xl border border-brand-100 p-4 transition-shadow hover:shadow-card ${
                    p.stock_qty <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wide text-mid-500">{p.category_name}</span>
                    <StockBadge qty={p.stock_qty} reorder={p.reorder_level} />
                  </div>
                  <p className="font-medium text-sm leading-snug line-clamp-2">{p.name}</p>
                  <div className="mt-2 flex items-end justify-between">
                    <span className="font-semibold text-green-primary">{peso(p.selling_price)}</span>
                    <span className="text-xs text-mid-500">{p.stock_qty} {p.unit}</span>
                  </div>
                </motion.button>
              ))}
              {filtered.length === 0 && (
                <p className="col-span-full text-center text-mid-500 py-10">No products found.</p>
              )}
            </div>
          </div>
        </div>

        {/* Cart panel */}
        <Card className="flex flex-col min-h-0 overflow-hidden">
          <div className="p-5 border-b border-brand-100 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Cart</h3>
            <span className="text-sm text-mid-500">{cart.length} item{cart.length !== 1 && 's'}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <AnimatePresence>
              {cart.map((i) => (
                <motion.div
                  key={i.product_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20, height: 0 }}
                  className="bg-brand-50 rounded-2xl p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium line-clamp-2">{i.name}</p>
                    <button onClick={() => removeFromCart(i.product_id)} className="p-1 text-mid-500 hover:text-status-danger">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => changeQty(i.product_id, -1)} className="w-7 h-7 rounded-full bg-white border border-brand-100 flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                      <span className="w-8 text-center text-sm font-semibold">{i.qty}</span>
                      <button
                        onClick={() => changeQty(i.product_id, 1)}
                        disabled={i.qty >= i.max}
                        className="w-7 h-7 rounded-full bg-green-primary text-white flex items-center justify-center disabled:opacity-40"
                      ><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                    <span className="text-sm font-semibold">{peso(i.price * i.qty)}</span>
                  </div>
                </motion.div>
              ))}
              {cart.length === 0 && (
                <div className="text-center text-mid-500 text-sm py-10">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  Your cart is empty
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-5 border-t border-brand-100 bg-white">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-mid-500">Items ({cart.reduce((s, i) => s + i.qty, 0)})</span>
              <span className="font-medium">{numberFormat(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-semibold text-green-primary">{peso(subtotal)}</span>
            </div>
            <Button className="w-full py-3 text-base" disabled={submitting || cart.length === 0} onClick={checkout}>
              {submitting ? 'Processing…' : `Charge ${peso(subtotal)}`}
            </Button>
          </div>
        </Card>
      </div>

      {/* Receipt modal */}
      <AnimatePresence>
        {receipt && (
          <motion.div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-container shadow-modal w-full max-w-sm p-8 text-center" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}>
              <div className="mx-auto w-16 h-16 rounded-full bg-green-mint flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-primary" />
              </div>
              <h3 className="text-xl font-semibold">Sale complete!</h3>
              <p className="text-mid-500 mt-1">Invoice <span className="font-medium text-ink-900">{receipt.invoice_no}</span></p>
              <p className="text-3xl font-semibold text-green-primary mt-4">{peso(receipt.total_amount)}</p>
              <p className="text-sm text-mid-500 mt-1">{receipt.items?.length} item{receipt.items?.length !== 1 && 's'}</p>
              <Button className="w-full mt-6" onClick={() => setReceipt(null)}>New sale</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
        active ? 'bg-green-primary text-white' : 'bg-white text-mid-500 border border-brand-100 hover:bg-brand-100'
      }`}
    >
      {children}
    </button>
  );
}

function StockBadge({ qty, reorder }) {
  if (qty <= 0) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-status-danger/10 text-status-danger font-medium">Out</span>;
  if (qty <= reorder) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-status-warn/15 text-status-warn font-medium">{qty}</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-mint text-green-dark font-medium">{qty}</span>;
}