/**
 * Agri Monitor - API QA test suite (run against running server with seeded DB).
 * `node tests/api.test.js`
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const BASE = process.env.API_BASE || 'http://localhost:5000/api';
let passed = 0, failed = 0;
const ok = (name) => { passed++; console.log(`  ✅ ${name}`); };
const bad = (name, detail) => { failed++; console.log(`  ❌ ${name} — ${detail}`); };
const check = (cond, name, detail = '') => (cond ? ok(name) : bad(name, detail));

const req = async (method, path, { token, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const db = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'agri_monitor', dateStrings: true,
});

console.log('▶ Auth');
const adminLogin = await req('POST', '/login', { body: { username: 'admin', password: 'admin123' } });
check(adminLogin.status === 200, 'admin login', `got ${adminLogin.status}`);
let adminTok = adminLogin.data.token;
const staffLogin = await req('POST', '/login', { body: { username: 'cashier', password: 'cashier123' } });
check(staffLogin.status === 200, 'staff login', `got ${staffLogin.status}`);
const staffTok = staffLogin.data.token;
check((await req('POST', '/login', { body: { username: 'admin', password: 'wrong' } })).status === 401, 'reject bad password');
check((await req('GET', '/products')).status === 401, 'reject missing token');

console.log('▶ Role security.');
check((await req('GET', '/users', { token: staffTok })).status === 403, 'staff blocked from /users');
check((await req('GET', '/reports/inventory', { token: staffTok })).status === 403, 'staff blocked from /reports');
check((await req('GET', '/products', { token: staffTok })).status === 200, 'staff can read /products');

console.log('▶ Catalog.');
const prods = await req('GET', '/products', { token: adminTok });
check(prods.status === 200 && prods.data.data.length === 15, '15 products', `got ${prods.data.data?.length}`);
const cats = await req('GET', '/categories', { token: adminTok });
check(cats.data.length >= 5, '>=5 categories');
const created = await req('POST', '/categories', { token: adminTok, body: { name: 'QA TEST CAT' } });
check(created.status === 201, 'create category');
await req('DELETE', `/categories/${created.data.id}`, { token: adminTok });
const dcat = await req('POST', '/products', { token: adminTok, body: { name: 'QA Product', sku: 'SKU-QA-1', category_id: cats.data[0].id, selling_price: 100 } });
check(dcat.status === 201, 'create product');

console.log('▶ Inventory + stock-in.');
const inv = await req('GET', '/inventory', { token: adminTok });
check(inv.data.some((b) => b.expiry_status === 'expired'), 'has expired batch');
check(inv.data.some((b) => b.expiry_status === 'expiring'), 'has expiring batch');
check(inv.data.some((b) => b.stock_status === 'low'), 'has low-stock batch');
check(inv.data.some((b) => b.stock_status === 'out'), 'has out-of-stock batch');
const si = await req('POST', `/products/${prods.data.data[0].id}/batches`, { token: adminTok, body: { quantity: 5, batch_no: 'IGNORED' } });
check(si.status === 201, 'stock-in batch', `got ${si.status} ${si.data.message}`);
check(/^B\d{6}-\d+-\d{2}$/.test(si.data.batch_no || ''), 'batch number auto-generated (client value ignored)', si.data.batch_no);
const si2 = await req('POST', `/products/${prods.data.data[0].id}/batches`, { token: adminTok, body: { quantity: 1 } });
check(si2.data.batch_no !== si.data.batch_no, 'batch numbers are unique per receipt', `${si.data.batch_no} vs ${si2.data.batch_no}`);

console.log('▶ Panel revisions.');
// Add product with initial quantity creates batch + movement atomically
const np = await req('POST', '/products', { token: adminTok, body: { name: 'QA Bagged Feed', sku: 'QA-BAR-1', category_id: cats.data[0].id, unit: 'Sack', selling_price: 250, initial_quantity: 12, expiry_date: '2099-01-01' } });
check(np.status === 201 && np.data.batch_no, 'add product with initial qty creates first batch', JSON.stringify(np.data));
const npd = await req('GET', `/products/${np.data.id}`, { token: adminTok });
check(Number(npd.data.stock_qty) === 12 && npd.data.batches.length === 1, 'initial batch stock counted', `stock ${npd.data.stock_qty}`);
// Barcode lookup
const bysku = await req('GET', '/products/by-sku/QA-BAR-1', { token: staffTok });
check(bysku.status === 200 && bysku.data.id === np.data.id, 'barcode (SKU) lookup finds product');
check((await req('GET', '/products/by-sku/NOPE-000', { token: staffTok })).status === 404, 'unknown barcode -> 404');
// Dashboard click-through filters + global low threshold
const lowList = await req('GET', '/products?filter=low&per_page=100', { token: adminTok });
check(lowList.data.data.length > 0 && lowList.data.data.every((p) => p.stock_qty <= lowList.data.meta.low_stock_threshold), 'filter=low uses global threshold');
const dash0 = await req('GET', '/dashboard', { token: adminTok });
check(dash0.data.low_stock_count === lowList.data.meta.total, 'dashboard low count == products?filter=low', `${dash0.data.low_stock_count} vs ${lowList.data.meta.total}`);
check('inactive_count' in dash0.data && 'out_count' in dash0.data, 'dashboard has active/inactive + out counts');
for (const f of ['out', 'expiring', 'expired', 'inactive', 'active']) {
  check((await req('GET', `/products?filter=${f}`, { token: adminTok })).status === 200, `products?filter=${f}`);
}
// Version 3: admin can use the POS too
const adminSale = await req('POST', '/sales', { token: adminTok, body: { items: [{ product_id: np.data.id, quantity: 1 }] } });
check(adminSale.status === 201, 'admin can check out (POS for admin + staff)', `got ${adminSale.status} ${adminSale.data.message || ''}`);
// Version 3: impossible / inconsistent dates are rejected
const pid = np.data.id;
const badDate = async (body) => (await req('POST', `/products/${pid}/batches`, { token: adminTok, body: { quantity: 1, ...body } })).status;
check(await badDate({ expiry_date: '2027-02-31' }) === 400, 'Feb 31 expiry rejected');
check(await badDate({ expiry_date: '2027-04-31' }) === 400, 'Apr 31 expiry rejected');
check(await badDate({ received_at: '2026-02-30' }) === 400, 'Feb 30 date received rejected');
check(await badDate({ received_at: '2099-01-01' }) === 400, 'future date received rejected');
check(await badDate({ received_at: '2026-01-10', expiry_date: '2026-01-05' }) === 400, 'expiry before received rejected');
check(await badDate({ expiry_date: '2028-02-29' }) === 201, 'leap day Feb 29 2028 accepted');
const badNew = await req('POST', '/products', { token: adminTok, body: { name: 'QA Bad Date', sku: 'QA-BAD-DATE', category_id: cats.data[0].id, initial_quantity: 3, expiry_date: '2027-02-31' } });
check(badNew.status === 400 && !(await req('GET', '/products/by-sku/QA-BAD-DATE', { token: adminTok })).data?.id, 'new product with Feb 31 expiry rejected (nothing saved)');
check((await req('GET', '/sales?from=2026-02-31', { token: adminTok })).status === 400, 'sales filter rejects Feb 31');
check((await req('GET', '/reports/sales?from=2026-02-31', { token: adminTok })).status === 400, 'report filter rejects Feb 31');
// Customers + unpaid -> invoice, paid -> receipt
const cust = await req('POST', '/customers', { token: staffTok, body: { name: 'QA Farmer', phone: '0917' } });
check(cust.status === 201, 'add customer (staff)');
check((await req('GET', '/customers?search=QA Far', { token: staffTok })).data.some((c) => c.id === cust.data.id), 'customer search');
const noCust = await req('POST', '/sales', { token: staffTok, body: { payment_status: 'unpaid', items: [{ product_id: np.data.id, quantity: 1 }] } });
check(noCust.status === 400, 'unpaid sale requires a customer', `got ${noCust.status}`);
const unpaid = await req('POST', '/sales', { token: staffTok, body: { payment_status: 'unpaid', customer_id: cust.data.id, items: [{ product_id: np.data.id, quantity: 2 }] } });
check(unpaid.status === 201 && unpaid.data.payment_status === 'unpaid', 'unpaid (invoice) sale created', JSON.stringify(unpaid.data));
const usale = (await req('GET', '/sales?status=unpaid', { token: adminTok })).data.data.find((x) => x.invoice_no === unpaid.data.invoice_no);
check(usale && usale.customer_name === 'QA Farmer' && usale.payment_status === 'unpaid', 'sales list shows customer + unpaid status');
const pay = await req('PATCH', `/sales/${usale.id}/pay`, { token: adminTok });
check(pay.status === 200, 'mark as paid');
const paid = await req('GET', `/sales/${usale.id}`, { token: adminTok });
check(paid.data.payment_status === 'paid' && Number(paid.data.amount_paid) === Number(paid.data.total_amount) && paid.data.paid_at, 'sale now paid (receipt) with amount_paid + paid_at');
check((await req('PATCH', `/sales/${usale.id}/pay`, { token: adminTok })).status === 404, 'cannot pay twice');
// Supplier usage + per-batch supplier
const sup = await req('GET', '/suppliers', { token: adminTok });
check(sup.data.length > 0 && 'batch_count' in sup.data[0], 'suppliers list has product/batch counts');
const s2 = await req('POST', '/suppliers', { token: adminTok, body: { name: 'QA Supplier B' } });
const si3 = await req('POST', `/products/${np.data.id}/batches`, { token: adminTok, body: { quantity: 3, supplier_id: s2.data.id } });
const npd2 = await req('GET', `/products/${np.data.id}`, { token: adminTok });
check(npd2.data.batches.some((b) => b.supplier_name === 'QA Supplier B'), 'same product, different supplier per batch');
// Supplier page: a product delivered by two suppliers shows under BOTH, with only each one's own stock
const firstSup = sup.data[0];
await req('POST', `/products/${np.data.id}/batches`, { token: adminTok, body: { quantity: 4, supplier_id: firstSup.id } });
const detB = await req('GET', `/suppliers/${s2.data.id}`, { token: adminTok });
const detA = await req('GET', `/suppliers/${firstSup.id}`, { token: adminTok });
const rowB = detB.data.products?.find((p) => p.id === np.data.id);
const rowA = detA.data.products?.find((p) => p.id === np.data.id);
check(detB.status === 200 && !!rowB && !!rowA, 'product appears under both of its suppliers');
check(Number(rowB?.stock_from_supplier) === 3 && Number(rowA?.stock_from_supplier) === 4, 'each supplier shows only its own stock for the shared product', `${rowA?.stock_from_supplier} / ${rowB?.stock_from_supplier}`);
check(rowB?.also_from === firstSup.name, 'shared product lists the other supplier', rowB?.also_from);
check((await req('GET', '/suppliers/999999', { token: adminTok })).status === 404, 'unknown supplier -> 404');

console.log('▶ FIFO + checkout.');
// Product 9 (Herbicide) has expiring HERB-B1 and later HERB-B2
const prod9 = await req('GET', '/products/9', { token: adminTok });
const b1 = prod9.data.batches.find((b) => b.batch_no === 'HERB-B1');
const b2 = prod9.data.batches.find((b) => b.batch_no === 'HERB-B2');
check(b1 && b2, 'found 2 herbicide batches');
const before1 = b1.remaining;
const sale = await req('POST', '/sales', { token: staffTok, body: { items: [{ product_id: 9, quantity: 1 }] } });
check(sale.status === 201, 'checkout succeeds', `${sale.data.message || ''}`);
const prod9After = await req('GET', '/products/9', { token: adminTok });
const b1After = prod9After.data.batches.find((b) => b.batch_no === 'HERB-B1');
const b2After = prod9After.data.batches.find((b) => b.batch_no === 'HERB-B2');
check(b1After.remaining === b1.remaining - 1, 'FIFO: deducted from soonest-expiry batch', `b1 ${b1.remaining}->${b1After.remaining}`);
check(b2After.remaining === b2.remaining, 'FIFO: later batch untouched');

console.log('▶ Oversell + expired blocks.');
const product8 = await req('GET', '/products/8', { token: adminTok });
const canSell = product8.data.batches.find((b) => b.status !== 'expired' && b.remaining > 0);
const sellableRemaining = canSell ? canSell.remaining : 0;
const over = await req('POST', '/sales', { token: staffTok, body: { items: [{ product_id: 8, quantity: 9999 }] } });
check(over.status === 400, 'oversell blocked', `got ${over.status} ${over.data.message}`);
const expiredProd = await req('GET', '/products/10', { token: adminTok }); // Fungicide, has expired batch
const expiredBatch = expiredProd.data.batches.find((b) => b.status === 'expired');
check(!!expiredBatch && expiredBatch.remaining === 4, 'expired batch demo retained stock');
const expiredSale = await req('POST', '/sales', { token: staffTok, body: { items: [{ product_id: 10, quantity: 1 }] } });
const soldExpired = expiredSale.status === 201 && expiredSale.data.items?.some((i) => i.quantity > 0);
check(!soldExpired, 'expired stock not sellable', `${expiredSale.status} ${expiredSale.data.message}`);

console.log('▶ Sales + daily summary route order.');
const ds = await req('GET', '/sales/daily-summary', { token: adminTok });
check(ds.status === 200 && 'today' in ds.data, 'daily-summary not shadowed by /:id');
const salesList = await req('GET', '/sales', { token: adminTok });
check(salesList.data.data.length > 0, 'sales list');

console.log('▶ Reports + CSV.');
const exp = await req('GET', '/reports/expiry', { token: adminTok });
check(exp.data.some((r) => r.status === 'expired'), 'expiry report lists expired');
for (const t of ['inventory', 'low-stock', 'sales']) {
  const r = await req('GET', `/reports/${t}`, { token: adminTok });
  check(r.status === 200, `report ${t}`);
}
const csv = await fetch(`${BASE}/reports/export/low-stock`, { headers: { Authorization: `Bearer ${adminTok}` } });
check(csv.status === 200 && csv.headers.get('content-type')?.includes('text/csv'), 'CSV export');

console.log('▶ Dashboard + users.');
const dash = await req('GET', '/dashboard', { token: adminTok });
check(dash.status === 200 && Array.isArray(dash.data.week), 'dashboard KPIs + chart');
check((await req('GET', '/activity-logs', { token: adminTok })).data.length > 0, 'activity logs');

console.log('▶ Audit exactness check.');
const count = await db.query(`
  SELECT COUNT(*) AS mismatches FROM batches b
  JOIN (SELECT batch_id, COALESCE(SUM(quantity),0) AS total FROM stock_movements GROUP BY batch_id) m ON m.batch_id = b.id
  WHERE b.remaining <> m.total`);
check(Number(count[0][0].mismatches) === 0, 'every batch remaining == sum of movements');

console.log(`\n${passed} passed, ${failed} failed`);
await db.end();
process.exit(failed ? 1 : 0);