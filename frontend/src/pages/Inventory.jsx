import { useEffect, useState } from 'react';
import { Search, PackagePlus, MoveRight } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Input, Modal, Badge, Spinner, peso, fmtDate } from '../components/ui.jsx';
import { toast } from '../components/Toast.jsx';
import { isAdmin } from '../store/auth.js';

export default function Inventory() {
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [stockIn, setStockIn] = useState({ product_id: '', batch_no: '', quantity: '', expiry_date: '', cost_price: '' });
  const admin = isAdmin();

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/inventory', { params: { search } }).then((r) => setBatches(r.data)),
      api.get('/products', { params: { per_page: 100 } }).then((r) => setProducts(r.data.data)),
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [search]);

  const filtered = filter === 'all' ? batches : batches.filter((b) => b.expiry_status === filter || b.stock_status === filter);

  const stockInSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/products/${stockIn.product_id}/batches`, stockIn);
      toast.success('Stock-in recorded');
      setModal(false);
      setStockIn({ product_id: '', batch_no: '', quantity: '', expiry_date: '', cost_price: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-mid-500">Stock levels by batch, with expiry and low-stock status.</p>
        </div>
        {admin && <Button onClick={() => setModal(true)}><PackagePlus className="w-4 h-4" /> Stock-in</Button>}
      </header>

      <Card className="p-5 mb-5 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-mid-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, SKU, or batch…"
            className="w-full pl-11 pr-4 py-2.5 rounded-full border border-brand-100 focus:outline-none focus:ring-2 focus:ring-green-primary/30" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2.5 rounded-full border border-brand-100 bg-white focus:outline-none">
          <option value="all">All batches</option>
          <option value="expiring">Expiring soon</option>
          <option value="expired">Expired</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
      </Card>

      {loading ? <Spinner /> : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-mid-500 border-b border-brand-100 text-xs uppercase tracking-wide">
                <th className="px-6 py-3">Product</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3 text-center">Qty in</th>
                <th className="px-4 py-3 text-center">Remaining</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3">Received</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-brand-50/50">
                  <td className="px-6 py-3">
                    <p className="font-medium">{b.product_name}</p>
                    <p className="text-xs text-mid-500">{b.category_name}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-mid-500">{b.batch_no}</td>
                  <td className="px-4 py-3 text-center text-mid-500">{b.quantity_in}</td>
                  <td className={`px-4 py-3 text-center font-semibold ${b.remaining === 0 ? 'text-status-danger' : ''}`}>{b.remaining}</td>
                  <td className="px-4 py-3 text-mid-500">{b.expiry_date ? fmtDate(b.expiry_date) : '—'}</td>
                  <td className="px-4 py-3 text-mid-500">{fmtDate(b.received_at)}</td>
                  <td className="px-6 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {b.expiry_status === 'expired' && <Badge tone="danger">Expired</Badge>}
                      {b.expiry_status === 'expiring' && <Badge tone="warn">Expiring</Badge>}
                      {b.stock_status === 'low' && <Badge tone="warn">Low</Badge>}
                      {b.stock_status === 'out' && <Badge tone="danger">Out</Badge>}
                      {b.expiry_status === 'ok' && b.stock_status === 'ok' && <Badge tone="ok">In stock</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-mid-500 py-10">No batches match.</p>}
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Stock-in a batch">
        <form onSubmit={stockInSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Product</span>
            <select required value={stockIn.product_id} onChange={(e) => setStockIn({ ...stockIn, product_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-full border border-brand-100 bg-white focus:outline-none">
              <option value="">Select product…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </label>
          <Input label="Batch number" value={stockIn.batch_no} onChange={(e) => setStockIn({ ...stockIn, batch_no: e.target.value })} placeholder="e.g. SUPPLY-001" required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Quantity" type="number" min="1" value={stockIn.quantity} onChange={(e) => setStockIn({ ...stockIn, quantity: e.target.value })} required />
            <Input label="Cost (₱/unit)" type="number" step="0.01" value={stockIn.cost_price} onChange={(e) => setStockIn({ ...stockIn, cost_price: e.target.value })} />
          </div>
          <Input label="Expiry date (optional)" type="date" value={stockIn.expiry_date} onChange={(e) => setStockIn({ ...stockIn, expiry_date: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">Add stock</Button>
            <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}