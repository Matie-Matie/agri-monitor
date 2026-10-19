import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ShoppingCart, Trash2, ScanLine, CheckCircle2, UserRound, UserPlus, FileText, Search } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Input, Modal, peso, numberFormat, Spinner } from '../components/ui.jsx';
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
  const [threshold, setThreshold] = useState(10);
  const [customer, setCustomer] = useState(null); // null = walk-in
  const [payStatus, setPayStatus] = useState('paid');
  const [custModal, setCustModal] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const [custList, setCustList] = useState([]);
  const [newCust, setNewCust] = useState({ name: '', phone: '' });
  const [scanFlash, setScanFlash] = useState(null); // { ok, text }
  const scanRef = useRef(null);
  const flashTimer = useRef(null);
  const focusBlocked = custModal || !!receipt;

  const loadProducts = () =>
    api.get('/products', { params: { per_page: 200 } }).then((r) => { setProducts(r.data.data); setThreshold(r.data.meta.low_stock_threshold); });

  useEffect(() => {
    Promise.all([
      loadProducts(),
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

  const subtotal = cart.reduce((s, i) => s + i.price * (Number(i.qty) || 0), 0);

  // Returns false when the item could not be added (out of stock / already at max).
  const addToCart = (p) => {
    const stock = Number(p.stock_qty);
    let added = true;
    setCart((prev) => {
      const found = prev.find((i) => i.product_id === p.id);
      if (found) {
        if (Number(found.qty) >= stock) { added = false; return prev; }
        return prev.map((i) => (i.product_id === p.id ? { ...i, qty: Number(i.qty) + 1, max: stock } : i));
      }
      if (stock <= 0) { added = false; return prev; }
      return [...prev, { product_id: p.id, name: p.name, price: Number(p.selling_price), unit: p.unit, qty: 1, max: stock }];
    });
    return added;
  };

  const changeQty = (id, delta) => {
    setCart((prev) => prev
      .map((i) => (i.product_id === id ? { ...i, qty: Math.max(0, Math.min(i.max || Number(i.qty), (Number(i.qty) || 0) + delta)) } : i))
      .filter((i) => i.qty > 0));
  };

  // Typed quantity: allow free typing, clamp to 1..stock when the field loses focus.
  const typeQty = (id, raw) => setCart((prev) => prev.map((i) => (i.product_id === id ? { ...i, qty: raw === '' ? '' : Math.max(0, Math.floor(Number(raw)) || 0) } : i)));
  const commitQty = (id) => setCart((prev) => prev.map((i) => {
    if (i.product_id !== id) return i;
    const n = Number(i.qty) || 1;
    if (n > i.max) toast.error(`Only ${i.max} ${i.unit} in stock for ${i.name}`);
    return { ...i, qty: Math.max(1, Math.min(i.max, n)) };
  }));

  const removeFromCart = (id) => setCart((prev) => prev.filter((i) => i.product_id !== id));

  // ── Barcode scanner (USB wedge: types the code, then Enter) ──
  const flash = (ok, text) => {
    setScanFlash({ ok, text });
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setScanFlash(null), 1800);
  };
  const focusScan = () => { if (!focusBlocked) scanRef.current?.focus(); };
  const onScanKey = async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = e.currentTarget.value.trim();
    e.currentTarget.value = '';
    if (!code) return;
    try {
      const { data: p } = await api.get(`/products/by-sku/${encodeURIComponent(code)}`);
      if (addToCart(p)) flash(true, `Added: ${p.name}`);
      else flash(false, Number(p.stock_qty) <= 0 ? `${p.name} is out of stock` : `No more ${p.name} in stock`);
    } catch (err) {
      flash(false, err.response?.status === 404 ? `Barcode not found: ${code}` : 'Scan failed');
    }
  };
  // Keep the scan field focused unless the cashier moved into another field (customer search, qty).
  const onScanBlur = (e) => {
    const t = e.relatedTarget;
    if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
    setTimeout(focusScan, 0);
  };
  useEffect(() => { focusScan(); }, [loading, focusBlocked]);

  // ── Customers ──
  useEffect(() => {
    if (!custModal) return undefined;
    const t = setTimeout(() => {
      api.get('/customers', { params: { search: custSearch } }).then((r) => setCustList(r.data)).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [custModal, custSearch]);

  const pickCustomer = (c) => { setCustomer(c); setCustModal(false); setCustSearch(''); };
  const addCustomer = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/customers', newCust);
      toast.success(`Customer added: ${data.name}`);
      setNewCust({ name: '', phone: '' });
      pickCustomer(data);
    } catch (err) { toast.error(err.response?.data?.message || 'Could not add customer'); }
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    if (cart.some((i) => !(Number(i.qty) > 0))) { toast.error('Check the item quantities'); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post('/sales', {
        items: cart.map((i) => ({ product_id: i.product_id, quantity: Number(i.qty) })),
        customer_id: customer?.id || null,
        payment_status: payStatus,
      });
      setReceipt({ ...data, customer_name: customer?.name || null });
      setCart([]);
      setCustomer(null);
      setPayStatus('paid');
      toast.success(`${data.payment_status === 'paid' ? 'Sale' : 'Invoice'} ${data.invoice_no} recorded`);
      loadProducts(); // refresh stock
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
        <div className="hidden md:block text-sm text-mid-500">Scan a barcode or tap a product</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100%-4rem)]">
        {/* Product selector */}
        <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">
          {/* Barcode scan (always focused; the USB scanner types the SKU then Enter) */}
          <div className="relative">
            <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-primary" />
            <input
              ref={scanRef}
              onKeyDown={onScanKey}
              onBlur={onScanBlur}
              autoComplete="off"
              aria-label="Scan barcode"
              placeholder="Scan barcode…"
              className="w-full pl-12 pr-4 py-3 rounded-full border-2 border-green-primary/40 bg-white focus:outline-none focus:ring-2 focus:ring-green-primary/30 focus:border-green-primary"
            />
            {scanFlash && (
              <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium px-3 py-1 rounded-full ${scanFlash.ok ? 'bg-green-mint text-green-dark' : 'bg-status-danger/10 text-status-danger'}`}>
                {scanFlash.text}
              </span>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-mid-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or SKU…"
              className="w-full pl-11 pr-4 py-2.5 rounded-full border border-brand-100 bg-white focus:outline-none focus:ring-2 focus:ring-green-primary/30 focus:border-green-primary"
            />
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
                  disabled={Number(p.stock_qty) <= 0}
                  className={`text-left bg-white rounded-2xl border border-brand-100 p-4 transition-shadow hover:shadow-card ${
                    Number(p.stock_qty) <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wide text-mid-500">{p.category_name}</span>
                    <StockBadge qty={Number(p.stock_qty)} threshold={threshold} />
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

          <button
            onClick={() => setCustModal(true)}
            className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-2.5 text-left hover:bg-brand-50 transition-colors"
          >
            <UserRound className="w-5 h-5 text-green-primary shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] uppercase tracking-wide text-mid-500">Customer</span>
              <span className="block text-sm font-medium truncate">{customer ? customer.name : 'Walk-in customer'}</span>
            </span>
            <span className="text-xs text-green-dark font-medium">Change</span>
          </button>

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
                      <input
                        type="number" min="1" max={i.max} value={i.qty}
                        onChange={(e) => typeQty(i.product_id, e.target.value)}
                        onBlur={() => commitQty(i.product_id)}
                        aria-label={`Quantity of ${i.name}`}
                        className="w-14 text-center text-sm font-semibold rounded-full border border-brand-100 bg-white py-1 focus:outline-none focus:ring-2 focus:ring-green-primary/30"
                      />
                      <button
                        onClick={() => changeQty(i.product_id, 1)}
                        disabled={Number(i.qty) >= i.max}
                        className="w-7 h-7 rounded-full bg-green-primary text-white flex items-center justify-center disabled:opacity-40"
                      ><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                    <span className="text-sm font-semibold">{peso(i.price * (Number(i.qty) || 0))}</span>
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
              <span className="text-sm text-mid-500">Items ({cart.reduce((s, i) => s + (Number(i.qty) || 0), 0)})</span>
              <span className="font-medium">{numberFormat(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-semibold text-green-primary">{peso(subtotal)}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-brand-100 mb-3 text-sm font-medium">
              {[['paid', 'Paid now'], ['unpaid', 'Charge (unpaid)']].map(([v, l]) => (
                <button key={v} onClick={() => setPayStatus(v)}
                  className={`py-1.5 rounded-full transition-colors ${payStatus === v ? 'bg-white shadow text-green-dark' : 'text-mid-500'}`}>{l}</button>
              ))}
            </div>
            {payStatus === 'unpaid' && !customer && (
              <p className="text-xs text-status-warn mb-3">Choose a customer to charge this sale to.</p>
            )}
            <Button className="w-full py-3 text-base" disabled={submitting || cart.length === 0 || (payStatus === 'unpaid' && !customer)} onClick={checkout}>
              {submitting ? 'Processing…' : payStatus === 'paid' ? `Charge ${peso(subtotal)}` : `Create invoice ${peso(subtotal)}`}
            </Button>
          </div>
        </Card>
      </div>

      {/* Receipt (paid) / Invoice (unpaid) */}
      <AnimatePresence>
        {receipt && (
          <motion.div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-container shadow-modal w-full max-w-sm p-8 text-center" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}>
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${receipt.payment_status === 'paid' ? 'bg-green-mint' : 'bg-status-warn/15'}`}>
                {receipt.payment_status === 'paid'
                  ? <CheckCircle2 className="w-8 h-8 text-green-primary" />
                  : <FileText className="w-8 h-8 text-status-warn" />}
              </div>
              <h3 className="text-xl font-semibold">{receipt.payment_status === 'paid' ? 'Receipt' : 'Invoice (unpaid)'}</h3>
              <p className="text-mid-500 mt-1">{receipt.invoice_no}</p>
              {receipt.customer_name && <p className="text-sm mt-1">for <span className="font-medium">{receipt.customer_name}</span></p>}
              <p className="text-3xl font-semibold text-green-primary mt-4">{peso(receipt.total_amount)}</p>
              <p className="text-sm text-mid-500 mt-1">
                {receipt.items?.length} item{receipt.items?.length !== 1 && 's'} · {receipt.payment_status === 'paid' ? 'Paid' : 'Balance due'}
              </p>
              <Button className="w-full mt-6" onClick={() => setReceipt(null)}>New sale</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customer picker + add */}
      <Modal open={custModal} onClose={() => setCustModal(false)} title="Customer">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-mid-500" />
            <input autoFocus value={custSearch} onChange={(e) => setCustSearch(e.target.value)} placeholder="Search name or phone…"
              className="w-full pl-11 pr-4 py-2.5 rounded-full border border-brand-100 focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
          </div>
          <ul className="max-h-48 overflow-y-auto divide-y divide-brand-100 rounded-2xl border border-brand-100">
            <li>
              <button onClick={() => pickCustomer(null)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-brand-50">
                <span className="font-medium">Walk-in customer</span> <span className="text-mid-500">· no name</span>
              </button>
            </li>
            {custList.map((c) => (
              <li key={c.id}>
                <button onClick={() => pickCustomer(c)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-brand-50">
                  <span className="font-medium">{c.name}</span>{c.phone && <span className="text-mid-500"> · {c.phone}</span>}
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={addCustomer} className="rounded-2xl bg-brand-50 p-4 space-y-3">
            <p className="text-sm font-medium flex items-center gap-2"><UserPlus className="w-4 h-4 text-green-primary" /> Add new customer</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Name" value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} required />
              <Input label="Phone (optional)" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
            </div>
            <Button type="submit" className="w-full">Add and select</Button>
          </form>
        </div>
      </Modal>
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

function StockBadge({ qty, threshold }) {
  if (qty <= 0) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-status-danger/10 text-status-danger font-medium">Out</span>;
  if (qty <= threshold) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-status-warn/15 text-status-warn font-medium">{qty}</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-mint text-green-dark font-medium">{qty}</span>;
}