import { useEffect, useState } from 'react';
import { Search, Eye, Printer, CalendarDays } from 'lucide-react';
import api from '../api/client.js';
import { Card, Button, Input, Modal, Spinner, Badge, peso, fmtDateTime } from '../components/ui.jsx';

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [invoice, setInvoice] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/sales', { params: { from: from || undefined, to: to || undefined, per_page: 100 } })
      .then((r) => setSales(r.data.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openInvoice = async (id) => {
    const { data } = await api.get(`/sales/${id}`);
    setInvoice(data);
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <p className="text-mid-500">Transaction history and invoices.</p>
      </header>

      <Card className="p-5 mb-5 flex flex-wrap gap-3 items-end">
        <div className="w-44">
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="w-44">
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button variant="outline" onClick={load}><CalendarDays className="w-4 h-4" /> Filter</Button>
      </Card>

      {loading ? <Spinner /> : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-mid-500 border-b border-brand-100 text-xs uppercase tracking-wide">
                <th className="px-6 py-3">Invoice</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Cashier</th>
                <th className="px-4 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-6 py-3 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-brand-50/50">
                  <td className="px-6 py-3 font-mono text-xs font-medium">{s.invoice_no}</td>
                  <td className="px-4 py-3 text-mid-500">{fmtDateTime(s.created_at)}</td>
                  <td className="px-4 py-3">{s.cashier}</td>
                  <td className="px-4 py-3 text-center">{s.items}</td>
                  <td className="px-4 py-3 text-right font-semibold">{peso(s.total_amount)}</td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => openInvoice(s.id)} className="p-2 rounded-full hover:bg-brand-100 text-mid-500"><Eye className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.length === 0 && <p className="text-center text-mid-500 py-10">No sales in range.</p>}
        </Card>
      )}

      {/* Invoice modal */}
      <Modal open={!!invoice} onClose={() => setInvoice(null)} title={invoice ? `Invoice ${invoice.invoice_no}` : ''}>
        {invoice && (
          <div>
            <div className="flex items-center justify-between mb-4 text-sm">
              <div>
                <p className="font-semibold">Mitch Agri Supply</p>
                <p className="text-mid-500">Roxas, Isabela</p>
              </div>
              <div className="text-right text-mid-500">
                <p>{fmtDateTime(invoice.created_at)}</p>
                <p>Cashier: <span className="text-ink-900">{invoice.cashier}</span></p>
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
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-semibold text-green-primary">{peso(invoice.total_amount)}</span>
            </div>
            <Button className="w-full mt-5" variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4" /> Print
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}