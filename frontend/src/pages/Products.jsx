import { Fragment, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Pencil, Archive, ChevronRight, ChevronDown, PackagePlus, Barcode as BarcodeIcon, RotateCcw, X } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Input, Modal, Badge, Spinner, EmptyState, peso, fmtDate } from '../components/ui.jsx';
import LabelModal from '../components/LabelModal.jsx';
import { toast } from '../components/Toast.jsx';
import { isAdmin } from '../store/auth.js';

const UNITS = [
  ['sack', 'Sack'], ['kilo', 'Kilo'], ['gram', 'Gram'], ['piece', 'Piece'], ['pack', 'Pack'],
  ['box', 'Box'], ['bag', 'Bag'], ['bottle', 'Bottle'], ['liter', 'Liter'],
];

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({
  name: '', sku: '', category_id: '', supplier_id: '', unit: 'sack', cost_price: '', selling_price: '',
  initial_quantity: '', received_at: today(), expiry_date: '', is_active: 1,
});

const FILTERS = [
  ['all', 'All products'], ['active', 'Active only'], ['inactive', 'Inactive only'],
  ['low', 'Low stock'], ['out', 'Out of stock'], ['expiring', 'Expiring soon'], ['expired', 'Has expired stock'],
];

export default function Products() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') || '';
  const filter = params.get('filter') || 'all';
  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v && v !== 'all') next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [threshold, setThreshold] = useState(10);
  const [catFilter, setCatFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState({}); // product id -> batches[] | 'loading'
  const [stockModal, setStockModal] = useState(null);
  const [stockForm, setStockForm] = useState({ quantity: '', supplier_id: '', received_at: today(), expiry_date: '' });
  const [selected, setSelected] = useState(new Set());
  const [labelFor, setLabelFor] = useState(null);
  const admin = isAdmin();

  const load = () => {
    setLoading(true);
    const q = { search, category_id: catFilter || undefined, per_page: 200 };
    if (filter === 'all') q.is_active = 'all'; else q.filter = filter;
    Promise.all([
      api.get('/products', { params: q }).then((r) => { setProducts(r.data.data); setThreshold(r.data.meta.low_stock_threshold); }),
      api.get('/categories').then((r) => setCategories(r.data)),
      api.get('/suppliers').then((r) => setSuppliers(r.data)),
    ]).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); setExpanded({}); setSelected(new Set()); }, [search, catFilter, filter]);

  const loadBatches = (id) =>
    api.get(`/products/${id}`).then((r) => setExpanded((e) => ({ ...e, [id]: r.data.batches })));

  const toggle = (p) => {
    if (expanded[p.id]) {
      setExpanded((e) => { const n = { ...e }; delete n[p.id]; return n; });
    } else {
      setExpanded((e) => ({ ...e, [p.id]: 'loading' }));
      loadBatches(p.id);
    }
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      ...emptyForm(), name: p.name, sku: p.sku, category_id: p.category_id, supplier_id: p.supplier_id || '',
      unit: p.unit, cost_price: p.cost_price, selling_price: p.selling_price, is_active: p.is_active,
    });
    setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, form);
        toast.success('Product updated');
      } else {
        const { data } = await api.post('/products', form);
        toast.success(data.batch_no ? `Product created · batch ${data.batch_no}` : 'Product created');
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const archive = async (p) => {
    if (!confirm(`Archive "${p.name}"? It becomes inactive and is hidden from POS.`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      toast.success('Product archived');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const restore = async (p) => {
    try {
      await api.post(`/products/${p.id}/restore`);
      toast.success('Product is active again');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const openStock = (p) => {
    setStockModal(p);
    setStockForm({ quantity: '', supplier_id: p.supplier_id || '', received_at: today(), expiry_date: '' });
  };
  const submitStock = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post(`/products/${stockModal.id}/batches`, stockForm);
      toast.success(data.message);
      const id = stockModal.id;
      setStockModal(null);
      load();
      if (expanded[id]) loadBatches(id);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const toggleSel = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = products.length > 0 && products.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)));

  const unitOptions = UNITS.some(([v]) => v === form.unit) ? UNITS : [...UNITS, [form.unit, form.unit]];

  return (
    <div>
      <header className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-mid-500">Catalog and stock by batch for Mitch Agri Supply.</p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button variant="outline" onClick={() => setLabelFor(products.filter((p) => selected.has(p.id)))}>
              <BarcodeIcon className="w-4 h-4" /> Print labels ({selected.size})
            </Button>
          )}
          {admin && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add product</Button>}
        </div>
      </header>

      <Card className="p-5 mb-5 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-mid-500" />
          <input value={search} onChange={(e) => setParam('search', e.target.value)} placeholder="Search name or SKU…"
            className="w-full pl-11 pr-4 py-2.5 rounded-full border border-brand-100 focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          className="px-4 py-2.5 rounded-full border border-brand-100 bg-white focus:outline-none">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filter} onChange={(e) => setParam('filter', e.target.value)}
          className="px-4 py-2.5 rounded-full border border-brand-100 bg-white focus:outline-none">
          {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {(filter !== 'all' || search) && (
          <button onClick={() => setParams({}, { replace: true })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-mint text-green-dark text-xs font-medium">
            {FILTERS.find(([v]) => v === filter)?.[1]}{search && ` · "${search}"`} <X className="w-3.5 h-3.5" />
          </button>
        )}
      </Card>

      {loading ? <Spinner /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-mid-500 border-b border-brand-100 text-xs uppercase tracking-wide">
                <th className="pl-5 py-3 w-8"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" /></th>
                <th className="px-2 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-center">Stock</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Date added</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {products.map((p) => (
                <Fragment key={p.id}>
                  <tr className="hover:bg-brand-50/50">
                    <td className="pl-5 py-3"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSel(p.id)} aria-label={`Select ${p.name}`} /></td>
                    <td className="px-2 py-3">
                      <button onClick={() => toggle(p)} className="flex items-center gap-2 text-left" aria-expanded={!!expanded[p.id]}>
                        {expanded[p.id] ? <ChevronDown className="w-4 h-4 text-mid-500" /> : <ChevronRight className="w-4 h-4 text-mid-500" />}
                        <span>
                          <span className="font-medium block">{p.name}</span>
                          <span className="text-mid-500 font-mono text-xs">{p.sku}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-mid-500">{p.category_name}</td>
                    <td className="px-4 py-3 text-mid-500 capitalize">{p.unit}</td>
                    <td className="px-4 py-3 text-right font-medium">{peso(p.selling_price)}</td>
                    <td className="px-4 py-3 text-center"><StockPill qty={Number(p.stock_qty)} threshold={threshold} /></td>
                    <td className="px-4 py-3 text-mid-500">{p.batch_suppliers || p.supplier_name || '—'}</td>
                    <td className="px-4 py-3 text-mid-500 whitespace-nowrap">{fmtDate(p.created_at)}</td>
                    <td className="px-4 py-3">{p.is_active ? <Badge tone="ok">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setLabelFor([p])} className="p-2 rounded-full hover:bg-brand-100 text-mid-500" title="Barcode label"><BarcodeIcon className="w-4 h-4" /></button>
                        {admin && (
                          <>
                            {p.is_active ? (
                              <button onClick={() => openStock(p)} className="p-2 rounded-full hover:bg-brand-100 text-mid-500" title="Stock in"><PackagePlus className="w-4 h-4" /></button>
                            ) : null}
                            <button onClick={() => openEdit(p)} className="p-2 rounded-full hover:bg-brand-100 text-mid-500" title="Edit"><Pencil className="w-4 h-4" /></button>
                            {p.is_active ? (
                              <button onClick={() => archive(p)} className="p-2 rounded-full hover:bg-status-danger/10 text-mid-500 hover:text-status-danger" title="Archive"><Archive className="w-4 h-4" /></button>
                            ) : (
                              <button onClick={() => restore(p)} className="p-2 rounded-full hover:bg-green-mint text-mid-500 hover:text-green-dark" title="Restore"><RotateCcw className="w-4 h-4" /></button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded[p.id] && (
                    <tr className="bg-brand-50/60">
                      <td colSpan={10} className="px-6 py-4">
                        {expanded[p.id] === 'loading' ? <p className="text-sm text-mid-500">Loading batches…</p> : (
                          <BatchTable batches={expanded[p.id]} unit={p.unit} />
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {products.length === 0 && <EmptyState title="No products" subtitle="Try a different search or filter." />}
        </Card>
      )}

      {/* Add / edit product */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit product' : 'Add product'}>
        <form onSubmit={save} className="space-y-4">
          <Input label="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="SKU (barcode)" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Unit</span>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full px-4 py-2.5 rounded-full border border-brand-100 bg-white focus:outline-none">
                {unitOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Category</span>
              <select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-full border border-brand-100 bg-white focus:outline-none">
                <option value="">Select…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Supplier</span>
              <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-full border border-brand-100 bg-white focus:outline-none">
                <option value="">None</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cost ₱" type="number" step="0.01" min="0" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} required />
            <Input label="Selling ₱" type="number" step="0.01" min="0" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} required />
          </div>
          {!editing && (
            <div className="rounded-2xl bg-brand-50 p-4 space-y-3">
              <p className="text-sm font-medium">First stock <span className="text-mid-500 font-normal">· batch number is generated automatically</span></p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Quantity" type="number" min="0" value={form.initial_quantity} onChange={(e) => setForm({ ...form, initial_quantity: e.target.value })} placeholder="0" />
                <Input label="Date received" type="date" value={form.received_at} onChange={(e) => setForm({ ...form, received_at: e.target.value })} />
                <div className="col-span-2"><Input label="Expiry date (optional)" type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
              </div>
            </div>
          )}
          {editing && (
            <label className="flex items-center gap-3 text-sm font-medium">
              <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })} />
              Active (sellable in POS)
            </label>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">{editing ? 'Save changes' : 'Create product'}</Button>
            <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Stock-in */}
      <Modal open={!!stockModal} onClose={() => setStockModal(null)} title={stockModal ? `Stock in · ${stockModal.name}` : ''}>
        {stockModal && (
          <form onSubmit={submitStock} className="space-y-4">
            <p className="text-sm text-mid-500">A batch number is generated automatically when you save.</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label={`Quantity (${stockModal.unit})`} type="number" min="1" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })} required />
              <Input label="Date received" type="date" value={stockForm.received_at} onChange={(e) => setStockForm({ ...stockForm, received_at: e.target.value })} />
            </div>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Supplier</span>
              <select value={stockForm.supplier_id} onChange={(e) => setStockForm({ ...stockForm, supplier_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-full border border-brand-100 bg-white focus:outline-none">
                <option value="">None</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <Input label="Expiry date (optional)" type="date" value={stockForm.expiry_date} onChange={(e) => setStockForm({ ...stockForm, expiry_date: e.target.value })} />
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1">Add stock</Button>
              <Button type="button" variant="outline" onClick={() => setStockModal(null)}>Cancel</Button>
            </div>
          </form>
        )}
      </Modal>

      <LabelModal open={!!labelFor} onClose={() => setLabelFor(null)} products={labelFor || []} />
    </div>
  );
}

function BatchTable({ batches, unit }) {
  if (batches.length === 0) return <p className="text-sm text-mid-500">No batches yet. Use “Stock in” to receive stock.</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-mid-500 uppercase tracking-wide">
          <th className="py-2 pr-4">Batch</th><th className="pr-4">Supplier</th><th className="pr-4 text-center">Qty in</th>
          <th className="pr-4 text-center">Remaining</th><th className="pr-4">Date received</th><th className="pr-4">Expiry</th><th>Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-brand-100">
        {batches.map((b) => (
          <tr key={b.id}>
            <td className="py-2 pr-4 font-mono">{b.batch_no}</td>
            <td className="pr-4 text-mid-500">{b.supplier_name || '—'}</td>
            <td className="pr-4 text-center text-mid-500">{b.quantity_in} {unit}</td>
            <td className={`pr-4 text-center font-semibold ${b.remaining === 0 ? 'text-status-danger' : ''}`}>{b.remaining}</td>
            <td className="pr-4 text-mid-500">{fmtDate(b.received_at)}</td>
            <td className="pr-4 text-mid-500">{b.expiry_date ? fmtDate(b.expiry_date) : '—'}</td>
            <td>
              {b.status === 'expired' ? <Badge tone="danger">Expired</Badge>
                : b.status === 'expiring' ? <Badge tone="warn">Expiring</Badge>
                : b.remaining === 0 ? <Badge tone="neutral">Sold out</Badge> : <Badge tone="ok">OK</Badge>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StockPill({ qty, threshold }) {
  if (qty <= 0) return <Badge tone="danger">Out</Badge>;
  if (qty <= threshold) return <Badge tone="warn">{Number(qty).toLocaleString('en-PH')} low</Badge>;
  return <span className="text-green-dark text-xs font-medium">{Number(qty).toLocaleString('en-PH')}</span>;
}
