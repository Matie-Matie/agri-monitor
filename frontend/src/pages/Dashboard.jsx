import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AreaChart as RechartsAreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Line, ComposedChart } from 'recharts';
import { Wallet, PackageX, AlertTriangle, CircleCheck, CircleOff, ChevronRight } from 'lucide-react';
import api from '../api/client.js';
import { Card, Spinner, Badge, peso, numberFormat, fmtDateTime } from '../components/ui.jsx';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    api.get('/dashboard').then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading dashboard…" />;

  const kpis = [
    { to: '/sales?date=today', label: "Today's Sales", value: peso(data.today_sales), sub: `${data.today_count} transactions`, icon: Wallet, tone: 'text-green-primary bg-green-mint' },
    { to: '/products?filter=low', label: 'Low Stock Items', value: data.low_stock_count, sub: `${data.out_count} out of stock · ≤ ${data.low_stock_threshold} units`, icon: PackageX, tone: 'text-status-warn bg-status-warn/15' },
    { to: '/products?filter=expiring', label: 'Expiring Soon', value: data.expiring_count, sub: `${data.expired_count} already expired`, icon: AlertTriangle, tone: 'text-status-danger bg-status-danger/10' },
    { to: '/products?filter=active', label: 'Active Products', value: data.product_count, sub: `Stock value ${peso(data.stock_value)}`, icon: CircleCheck, tone: 'text-green-dark bg-green-light' },
    { to: '/products?filter=inactive', label: 'Inactive Products', value: data.inactive_count, sub: 'Archived / not for sale', icon: CircleOff, tone: 'text-mid-500 bg-brand-100' },
  ];

  const chartData = (data.week || []).map((r) => ({
    date: String(r.date).slice(0, 10),
    name: new Date(r.date).toLocaleDateString('en-PH', { weekday: 'short' }),
    Sales: Number(r.total),
  }));

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-mid-500">Overview of Mitch Agri Supply operations.</p>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-6">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Link to={k.to} className="block h-full group focus:outline-none focus-visible:ring-2 focus-visible:ring-green-primary/40 rounded-card">
              <Card className="p-5 flex items-center gap-4 h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${k.tone}`}>
                  <k.icon className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-mid-500 font-medium">{k.label}</p>
                  <p className="text-xl font-semibold truncate">{k.value}</p>
                  <p className="text-xs text-mid-500 truncate">{k.sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-mid-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Sales chart */}
        <Card className="p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Sales — last 7 days</h3>
            <Badge tone="neutral">Click a day to see its sales</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} style={{ cursor: 'pointer' }} onClick={(st) => { const d = st?.activePayload?.[0]?.payload?.date; if (d) nav(`/sales?date=${d}`); }}>
                <defs>
                  <linearGradient id="saleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1C6F45" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#1C6F45" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8A8A8A' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8A8A8A' }} width={60} tickFormatter={(v) => `₱${numberFormat(v)}`} />
                <Tooltip formatter={(v) => [peso(v), 'Sales']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="Sales" stroke="#1C6F45" strokeWidth={2.5} fill="url(#saleGrad)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Low stock */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-status-warn" />
            <h3 className="font-semibold">Low stock</h3>
            <Link to="/products?filter=low" className="ml-auto text-xs text-green-dark font-medium hover:underline">View all</Link>
          </div>
          {data.low_stock_items?.length === 0 ? (
            <p className="text-sm text-mid-500 py-8 text-center">All products are well stocked 🎉</p>
          ) : (
            <ul className="space-y-3">
              {(data.low_stock_items || []).map((it) => (
                <li key={it.id + it.sku}>
                  <Link to={`/products?filter=low&search=${encodeURIComponent(it.sku)}`} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 -mx-2 hover:bg-brand-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{it.name}</p>
                      <p className="text-xs text-mid-500">{it.sku}</p>
                    </div>
                    <Badge tone={Number(it.stock_qty) <= 0 ? 'danger' : 'warn'}>{Number(it.stock_qty) <= 0 ? 'Out' : `${it.stock_qty} ${it.unit}`}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="p-6 mt-5">
        <h3 className="font-semibold mb-4">Recent activity</h3>
        <ul className="divide-y divide-brand-100">
          {(data.recent_activity || []).slice(0, 6).map((a, i) => (
            <li key={i} className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-green-mint text-green-dark flex items-center justify-center text-xs font-semibold shrink-0">
                  {(a.user_name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.action}</p>
                  <p className="text-xs text-mid-500">by {a.user_name || 'System'}</p>
                </div>
              </div>
              <span className="text-xs text-mid-500 shrink-0">{fmtDateTime(a.created_at)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

const number = (n) => numberFormat(n);