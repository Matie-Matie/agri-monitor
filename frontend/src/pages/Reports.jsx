import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import api, { API_BASE } from '../api/client.js';
import { Card, Button, Input, Badge, Spinner, peso, fmtDate } from '../components/ui.jsx';

const TABS = [
  { id: 'sales', label: 'Sales Report' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'low-stock', label: 'Low Stock' },
  { id: 'expiry', label: 'Expiration' },
];

export default function Reports() {
  const [tab, setTab] = useState('sales');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => { loadReport(); }, [tab]);

  const loadReport = () => {
    setLoading(true);
    const params = { from: from || undefined, to: to || undefined };
    api.get(`/reports/${tab}`, { params }).then((r) => setData(r.data)).finally(() => setLoading(false));
  };

  const exportCSV = () => {
    const type = tab === 'sales' ? 'sales' : tab;
    const qs = new URLSearchParams(from || to ? { from, to } : {}).toString();
    const token = localStorage.getItem('am_token');
    // Download via authenticated fetch + blob. No window.open — it hits the API
    // without the auth header and only produces a 401 white blank tab.
    fetch(`${API_BASE}/reports/export/${type}${qs ? '?' + qs : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (r) => {
      if (!r.ok) throw new Error(`Export failed (${r.status})`);
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${type}-report.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    }).catch((err) => console.error('CSV export failed:', err));
  };

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-mid-500">Business reports for monitoring and evaluation.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          <Button variant="outline" onClick={loadReport}>Apply</Button>
          <Button onClick={exportCSV}><Download className="w-4 h-4" /> Export CSV</Button>
        </div>
      </header>

      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setData(null); }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${tab === t.id ? 'bg-green-primary text-white' : 'bg-white border border-brand-100 text-mid-500 hover:bg-brand-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading || !data ? <Spinner /> : <TabContent tab={tab} data={data} />}
    </div>
  );
}

function TabContent({ tab, data }) {
  if (tab === 'sales') return <SalesReport data={data} />;
  if (tab === 'inventory') return <GenericTable title="Inventory" columns={['Product', 'SKU', 'Category', 'Price', 'Stock']}
    rows={data.map((r) => [r.name, r.sku, r.category_name, peso(r.selling_price), `${r.stock_qty}`])} />;
  if (tab === 'low-stock') return <GenericTable title="Low stock items" columns={['Product', 'SKU', 'On hand']}
    rows={data.map((r) => [r.name, r.sku, r.stock_qty])} />;
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <Card className="p-5"><Stat label="Expired" value={data.filter((r) => r.status === 'expired').length} tone="danger" /></Card>
        <Card className="p-5"><Stat label="Expiring ≤ 30 days" value={data.filter((r) => r.status === 'expiring').length} tone="warn" /></Card>
        <Card className="p-5"><Stat label="Within range" value={data.filter((r) => r.status === 'ok').length} tone="ok" /></Card>
      </div>
      <GenericTable title="Expiration tracker" columns={['Product', 'Batch', 'Remaining', 'Expiry', 'Days left', 'Status']}
        rows={data.map((r) => [r.product_name, r.batch_no, r.remaining, fmtDate(r.expiry_date), r.days_left,
          r.status === 'expired' ? 'Expired' : r.status === 'expiring' ? 'Expiring' : 'Ok'])}
        tones={data.map((r) => r.status === 'expired' ? 'danger' : r.status === 'expiring' ? 'warn' : 'ok')} />
    </div>
  );
}

function Stat({ label, value, tone }) {
  const tones = { ok: 'text-green-primary', warn: 'text-status-warn', danger: 'text-status-danger' };
  return (
    <div>
      <p className={`text-2xl font-semibold ${tones[tone]}`}>{value}</p>
      <p className="text-sm text-mid-500">{label}</p>
    </div>
  );
}

function SalesReport({ data }) {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <Card className="p-5"><Stat label="Total revenue" value={peso(data.summary?.total_revenue)} /></Card>
        <Card className="p-5"><Stat label="Transactions" value={data.summary?.total_sales} /></Card>
        <Card className="p-5"><Stat label="Days with activity" value={data.daily?.length || 0} /></Card>
      </div>
      <GenericTable title="Daily breakdown" columns={['Date', 'Transactions', 'Total']}
        rows={((data.daily) || []).map((r) => [fmtDate(r.date), r.sales_count, peso(r.total)])} />
      <div className="mt-5">
        <h3 className="font-semibold mb-3">Top products</h3>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-brand-100">
              {((data.top_products) || []).map((p, i) => (
                <tr key={i}>
                  <td className="px-6 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-mid-500">{p.qty} sold</td>
                  <td className="px-6 py-3 text-right font-semibold">{peso(p.revenue)}</td>
                </tr>
              ))}
              {(!data.top_products || data.top_products.length === 0) && <p className="text-center text-mid-500 py-6">No data.</p>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function GenericTable({ title, columns, rows, tones }) {
  return (
    <Card className="overflow-hidden">
      {title && <div className="px-6 py-4 border-b border-brand-100 font-semibold">{title}</div>}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-mid-500 border-b border-brand-100 text-xs uppercase tracking-wide">
            {columns.map((c) => <th key={c} className="px-6 py-3">{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-100">
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-brand-50/50">
              {row.map((cell, ci) => (
                <td key={ci} className={`px-6 py-3 ${tones?.[ri] && ci === row.length - 1 ? (tones[ri] === 'danger' ? 'text-status-danger' : tones[ri] === 'warn' ? 'text-status-warn' : 'text-green-primary') : ''}`}>
                  {ci === row.length - 1 && tones?.[ri] ? <Badge tone={tones[ri]}>{cell}</Badge> : cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="text-center text-mid-500 py-10">No data.</td></tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}