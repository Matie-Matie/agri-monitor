import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, CalendarDays, BadgeCheck } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Input, Modal, Spinner, Badge, peso, fmtDateTime } from '../components/ui.jsx';
import { toast } from '../components/Toast.jsx';

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Sales() {
  const [params] = useSearchParams();
  // ?date=today|YYYY-MM-DD (dashboard click-through) and ?status=paid|unpaid
  const dateParam = params.get('date');
  const initialDay = dateParam === 'today' ? localDate() : (dateParam || '');

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(initialDay);
  const [to, setTo] = useState(initialDay);
  const [status, setStatus] = useState(params.get('status') || '');
  const [invoice, setInvoice] = useState(null);

  const load = (f = from, t = to, st = status) => {
    setLoading(true);
    api.get('/sales', { params: { from: f || undefined, to: t || undefined, status: st || undefined, per_page: 100 } })
      .then((r) => setSales(r.data.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openInvoice = async (id) => {
    const { data } = await api.get(`/sales/${id}`);
    setInvoice(data);
  };

  const markPaid = async (id) => {
    try {
      const { data } = await api.patch(`/sales/${id}/pay`);
      toast.success(data.message);
      setInvoice(null);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Could not mark as paid'); }
  };

  const clear = () => { setFrom(''); setTo(''); setStatus(''); load('', '', ''); };
  const isPaid = invoice?.payment_status === 'paid';

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <p className="text-mid-500">Transaction history. Unpaid sales are invoices; paid sales are receipts.</p>
      </header>

      <Card className="p-5 mb-5 flex flex-wrap gap-3 items-end">
        <div className="w-44">
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="w-44">
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <label className="block w-44">
          <span className="block text-sm font-medium mb-1.5">Payment</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="w-full px-4 py-2.5 rounded-full border border-brand-100 bg-white focus:outline-none">
            <option value="">All</option>
            <option value="paid">Paid (receipts)</option>
            <option value="unpaid">Unpaid (invoices)</option>
          </select>
        </label>
        <Button variant="outline" onClick={() => load()}><CalendarDays className="w-4 h-4" /> Filter</Button>
        {(from || to || status) && <Button variant="ghost" onClick={clear}>Clear</Button>}
      </Card>

      {loading ? <Spinner /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-mid-500 border-b border-brand-100 text-xs uppercase tracking-wide">
                <th className="px-6 py-3">No.</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Cashier</th>
                <th className="px-4 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-6 py-3 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-brand-50/50">
                  <td className="px-6 py-3 font-mono text-xs font-medium">{s.invoice_no}</td>
                  <td className="px-4 py-3 text-mid-500">{fmtDateTime(s.created_at)}</td>
                  <td className="px-4 py-3">{s.customer_name || <span className="text-mid-500">Walk-in</span>}</td>
                  <td className="px-4 py-3">{s.cashier}</td>
                  <td className="px-4 py-3 text-center">{s.items}</td>
                  <td className="px-4 py-3 text-right font-semibold">{peso(s.total_amount)}</td>
                  <td className="px-4 py-3">
                    {s.payment_status === 'paid' ? <Badge tone="ok">Paid</Badge> : <Badge tone="warn">Unpaid</Badge>}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => openInvoice(s.id)} className="p-2 rounded-full hover:bg-brand-100 text-mid-500" aria-label="View"><Eye className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.length === 0 && <p className="text-center text-mid-500 py-10">No sales found.</p>}
        </Card>
      )}

      {/* Receipt (paid) / Invoice (unpaid). No Print, no corner X: Done / Esc / backdrop close it. */}
      <Modal hideClose open={!!invoice} onClose={() => setInvoice(null)}
        title={invoice ? `${isPaid ? 'Receipt' : 'Invoice'} ${invoice.invoice_no}` : ''}>
        {invoice && (
          <div>
            <div className="flex items-center justify-between mb-4 text-sm">
              <div>
                <p className="font-semibold">Mitch Agri Supply</p>
                <p className="text-mid-500">Roxas, Isabela</p>
                <p className="mt-2">Customer: <span className="font-medium">{invoice.customer_name || 'Walk-in'}</span></p>
              </div>
              <div className="text-right text-mid-500">
                <p>{fmtDateTime(invoice.created_at)}</p>
                <p>Cashier: <span className="text-ink-900">{invoice.cashier}</span></p>
                <div className="mt-2">{isPaid ? <Badge tone="ok">Paid</Badge> : <Badge tone="warn">Unpaid</Badge>}</div>
              </div>
            </div>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-left text-mid-500 border-b border-brand-100 text-xs uppercase">
                  <th className="py-2">Item</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Price</th>
                  <th className="py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-100">
                {invoice.items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2.5">{it.product_name}</td>
                    <td className="py-2.5 text-center">{it.quantity} {it.unit}</td>
                    <td className="py-2.5 text-right">{peso(it.unit_price)}</td>
                    <td className="py-2.5 text-right font-medium">{peso(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between pt-3 border-t border-brand-100">
              <span className="font-semibold">{isPaid ? 'Total paid' : 'Balance due'}</span>
              <span className="text-2xl font-semibold text-green-primary">{peso(invoice.total_amount)}</span>
            </div>
            {isPaid && invoice.paid_at && <p className="text-xs text-mid-500 mt-1 text-right">Paid {fmtDateTime(invoice.paid_at)}</p>}
            <div className="flex gap-3 mt-5">
              {!isPaid && (
                <Button className="flex-1" onClick={() => markPaid(invoice.id)}><BadgeCheck className="w-4 h-4" /> Mark as paid</Button>
              )}
              <Button variant="outline" className={isPaid ? 'w-full' : ''} onClick={() => setInvoice(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
