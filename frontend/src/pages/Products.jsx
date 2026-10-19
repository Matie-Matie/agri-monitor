import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Archive, Package } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Input, Modal, Badge, Spinner, EmptyState, peso, numberFormat } from '../components/ui.jsx';
import { toast } from '../components/Toast.jsx';
import { isAdmin } from '../store/auth.js';

const emptyForm = { name: '', sku: '', category_id: '', supplier_id: '', unit: 'piece', cost_price: '', selling_price: '', reorder_level: '5' };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const admin = isAdmin();

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/products', { params: { search, category_id: catFilter || undefined, per_page: 100 } }).then((r) => setProducts(r.data.data)),
      api.get('/categories').then((r) => setCategories(r.data)),
      api.get('/suppliers').then((r) => setSuppliers(r.data)),
    ]).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, catFilter]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku, category_id: p.category_id, supplier_id: p.supplier_id || '',
      unit: p.unit, cost_price: p.cost_price, selling_price: p.selling_price, reorder_level: p.reorder_level,
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
        await api.post('/products', form);
        toast.success('Product created');
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const archive = async (p) => {
    if (!confirm(`Archive "${p.name}"? It will be hidden from POS.`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      toast.success('Product archived');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-mid-500">Catalog of items sold at Mitch Agri Supply.</p>
        </div>
        {admin && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add product</Button>}
      </header>

      <Card className="p-5 mb-5 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-mid-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or SKU…"
            className="w-full pl-11 pr-4 py-2.5 rounded-full border border-brand-100 focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          className="px-4 py-2.5 rounded-full border border-brand-100 bg-white focus:outline-none">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Card>

      {loading ? <Spinner /> : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-mid-500 border-b border-brand-100 text-xs uppercase tracking-wide">
                <th className="px-6 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-center">Stock</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-brand-50/50">
                  <td className="px-6 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-mid-500">{p.category_name}</td>
                  <td className="px-4 py-3 text-mid-500 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-3 text-right font-medium">{peso(p.selling_price)}</td>
                  <td className="px-4 py-3 text-center">
                    <StockPill qty={p.stock_qty} reorder={p.reorder_level} />
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {admin && (
                        <>
                          <button onClick={() => openEdit(p)} className="p-2 rounded-full hover:bg-brand-100 text-mid-500" title="Edit"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => archive(p)} className="p-2 rounded-full hover:bg-status-danger/10 text-mid-500 hover:text-status-danger" title="Archive"><Archive className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && <EmptyState title="No products" subtitle="Try a different search." />}
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit product' : 'Add product'}>
        <form onSubmit={save} className="space-y-4">
          <Input label="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
            <Input label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg, sack, piece" required />
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
          <div className="grid grid-cols-3 gap-3">
            <Input label="Cost ₱" type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} required />
            <Input label="Selling ₱" type="number" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} required />
            <Input label="Reorder level" type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} required />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">{editing ? 'Save changes' : 'Create product'}</Button>
            <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function StockPill({ qty, reorder }) {
  if (qty <= 0) return <Badge tone="danger">Out</Badge>;
  if (qty <= reorder) return <Badge tone="warn">{qty} low</Badge>;
  return <span className="text-green-dark text-xs font-medium">{numberFormat(qty)}</span>;
}