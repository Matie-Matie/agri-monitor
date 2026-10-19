/**
 * Agri Monitor - Seed Script
 * Idempotent: safe to re-run.
 * Generates realistic demo data and guarantees an EXACT audit trail:
 * every batch's final `remaining` equals quantity_in minus summed movements.
 * Demo scenarios: expired batch (written off), out-of-stock, low-stock, expiring-soon.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
});

console.log('▶ Applying schema...');
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
await db.query(schema);
await db.query('USE agri_monitor;');

console.log('▶ Seeding data...');

const today = new Date();
const d = (offsetDays, hour = 9) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() + offsetDays);
  return `${dt.toISOString().slice(0, 10)} ${String(hour).padStart(2, '0')}:00:00`;
};
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ── Users ──────────────────────────────────────────────
const adminHash = await bcrypt.hash('admin123', 10);
const cashierHash = await bcrypt.hash('cashier123', 10);
await db.query(
  `INSERT INTO users (name, username, password_hash, role) VALUES (?,?,?,?), (?,?,?,?)
   ON DUPLICATE KEY UPDATE name = VALUES(name)`,
  ['Roan Bermudez', 'admin', adminHash, 'admin', 'Mitch Staff', 'cashier', cashierHash, 'staff']
);
const [[admin]] = await db.query('SELECT id FROM users WHERE username = ?', ['admin']);
const [[cashier]] = await db.query('SELECT id FROM users WHERE username = ?', ['cashier']);

// ── Categories ─────────────────────────────────────────
for (const c of ['Seeds', 'Fertilizers', 'Pesticides', 'Animal Feeds', 'Tools']) {
  await db.query('INSERT IGNORE INTO categories (name) VALUES (?)', [c]);
}
const catId = {};
for (const c of ['Seeds', 'Fertilizers', 'Pesticides', 'Animal Feeds', 'Tools']) {
  const [[r]] = await db.query('SELECT id FROM categories WHERE name = ?', [c]);
  catId[c] = r.id;
}

// ── Suppliers ──────────────────────────────────────────
const supData = [
  ['Isabela Agri Traders', '0917-555-1234'],
  ['North Seeds PH', '0921-555-8876'],
  ['VetFeeds Distributor', '0908-555-3345'],
  ['FarmPro Hardware', '0999-555-2211'],
];
for (const s of supData) await db.query('INSERT IGNORE INTO suppliers (name, contact) VALUES (?,?)', s);
const supId = {};
for (const [name] of supData) {
  const [[r]] = await db.query('SELECT id FROM suppliers WHERE name = ?', [name]);
  supId[name] = r.id;
}

// ── Products ───────────────────────────────────────────
// [name, sku, category, supplier, unit, cost, selling, reorder]
const products = [
  ['Rice Seed NSIC Rc216 (25kg)', 'RICE-216', 'Seeds', 'North Seeds PH', 'sack', 1100, 1350, 5],
  ['Hybrid Corn Seed (5kg)', 'CORN-HYB', 'Seeds', 'North Seeds PH', 'pack', 480, 600, 5],
  ['String Beans Seed (1kg)', 'SB-SEED', 'Seeds', 'North Seeds PH', 'pack', 160, 220, 4],
  ['Eggplant Seed (50g)', 'EGG-SEED', 'Seeds', 'North Seeds PH', 'pack', 90, 130, 4],
  ['Urea Fertilizer (50kg)', 'UREA-50', 'Fertilizers', 'Isabela Agri Traders', 'sack', 1150, 1400, 6],
  ['Complete Fertilizer 14-14-14 (50kg)', 'CF-141414', 'Fertilizers', 'Isabela Agri Traders', 'sack', 1250, 1500, 6],
  ['Ammonium Sulfate (21-0-0, 50kg)', 'AS-2100', 'Fertilizers', 'Isabela Agri Traders', 'sack', 980, 1200, 4],
  ['Liquid Pesticide (1L)', 'PEST-LIQ', 'Pesticides', 'Isabela Agri Traders', 'bottle', 320, 420, 8],
  ['Herbicide Glyphosate (1L)', 'HERB-GLY', 'Pesticides', 'Isabela Agri Traders', 'bottle', 260, 350, 8],
  ['Fungicide Copper (500g)', 'FUNG-CU', 'Pesticides', 'Isabela Agri Traders', 'pack', 210, 280, 5],
  ['Chicken Grower Feed (25kg)', 'FEED-CG', 'Animal Feeds', 'VetFeeds Distributor', 'sack', 980, 1200, 6],
  ['Hog Finisher Feed (25kg)', 'FEED-HF', 'Animal Feeds', 'VetFeeds Distributor', 'sack', 1050, 1280, 6],
  ['Garden Shovel', 'TOOL-SHOV', 'Tools', 'FarmPro Hardware', 'piece', 180, 250, 3],
  ['Pruning Shear', 'TOOL-SHEAR', 'Tools', 'FarmPro Hardware', 'piece', 220, 300, 3],
  ['Knapsack Sprayer (16L)', 'SPRAY-16', 'Tools', 'FarmPro Hardware', 'piece', 850, 1100, 2],
];
const P = [];
for (const [name, sku, cat, sup, unit, cost, selling, reorder] of products) {
  await db.query(
    `INSERT INTO products (name, sku, category_id, supplier_id, unit, cost_price, selling_price, reorder_level)
     VALUES (?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [name, sku, catId[cat], supId[sup], unit, cost, selling, reorder]
  );
  const [[p]] = await db.query('SELECT id FROM products WHERE sku = ?', [sku]);
  P.push(p.id);
}

// ── Batches ────────────────────────────────────────────
// [productIdx, batchNo, qtyIn, expiryOffset (null=none), receivedOffset]
// Designated demo states are guaranteed below via reconciliation movements.
const batches = [
  [0, 'RICE-B1', 25, 150, -160], [0, 'RICE-B2', 20, 190, -95],
  [1, 'CORN-B1', 30, 240, -130], [2, 'SB-B1', 15, 90, -70], [3, 'EGG-B1', 20, 75, -60],
  [4, 'UREA-B1', 40, null, -140], [5, 'CF-B1', 35, null, -120], [6, 'AS-B1', 15, null, -90],
  [7, 'PEST-B1', 12, 10, -110], [7, 'PEST-B2', 10, 240, -40],
  [8, 'HERB-B1', 20, 25, -100], [8, 'HERB-B2', 15, 260, -50],
  [9, 'FUNG-B1', 10, -5, -80], [9, 'FUNG-B2', 12, 180, -45],
  [10, 'CG-B1', 30, 90, -85], [10, 'CG-B2', 25, 140, -35],
  [11, 'HF-B1', 20, 60, -75], [11, 'HF-B2', 22, 130, -30],
  [12, 'SHOV-B1', 10, null, -200], [13, 'SHEAR-B1', 12, null, -180], [14, 'SPRAY-B1', 6, null, -150],
];
const B = [];
for (const [pi, batchNo, qtyIn, expiryOff, recvOff] of batches) {
  const r = await db.query(
    `INSERT INTO batches (product_id, batch_no, quantity_in, remaining, expiry_date, received_at)
     VALUES (?,?,?,?,?,?)`,
    [P[pi], batchNo, qtyIn, qtyIn, expiryOff === null ? null : d(expiryOff, 9).slice(0, 10), d(recvOff, 9)]
  );
  B.push(r[0].insertId);
  await db.query(
    `INSERT INTO stock_movements (product_id, batch_id, type, quantity, reference, user_id, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [P[pi], r[0].insertId, 'stock_in', qtyIn, `Initial stock ${batchNo}`, admin.id, d(recvOff, 9)]
  );
}

// ── Sales history (30 days, Mon–Sat, weekend-heavy) ────
const soldByBatch = new Map(); // batchId -> total sold
const invoiceCounts = new Map(); // date -> seq
const invoiceNo = (dt) => {
  const key = dt.toISOString().slice(0, 10);
  const seq = (invoiceCounts.get(key) || 0) + 1;
  invoiceCounts.set(key, seq);
  return `AM-${key.replaceAll('-', '')}-${String(seq).padStart(4, '0')}`;
};

// Protected demo batches: excluded from random sales so their demo state survives.
// indices into `batches`: UREA-B1(5) low, AS-B1(7) low, PEST-B1(8) expiring+low,
// HERB-B1(10) expiring, FUNG-B1(12) expired, HF-B1(16) out-of-stock, SPRAY-B1(20) low
const PROTECTED = new Set([5, 7, 8, 10, 12, 16, 20]);
const isProtected = (i) => PROTECTED.has(i);

let saleLogs = 0;
for (let dayOff = 30; dayOff >= 0; dayOff--) {
  const day = new Date(today);
  day.setDate(day.getDate() - dayOff);
  const dow = day.getDay();
  if (dow === 0) continue; // closed Sundays
  const saleCount = dow === 6 ? rand(2, 4) : dow === 5 ? rand(1, 3) : rand(0, 2);
  for (let s = 0; s < saleCount; s++) {
    const saleTime = new Date(day); saleTime.setHours(rand(8, 17), rand(0, 59), 0, 0);
    const itemCount = rand(1, 5);
    const items = [];
    const used = new Set();
    for (let it = 0; it < itemCount; it++) {
      const candidates = batches.map((b, i) => ({ batchId: B[i], productIdx: b[0], qtyIn: b[2], expiryOff: b[3], receivedOff: b[4], idx: i }))
        .filter(b => !used.has(b.batchId) && !isProtected(b.idx) && b.qtyIn > 0 && b.expiryOff !== 0 && b.expiryOff !== -5)
        .filter(b => (b.expiryOff === null || b.expiryOff > 0) && (soldByBatch.get(b.batchId) || 0) < b.qtyIn);
      if (candidates.length === 0) break;
      const cand = pick(candidates);
      used.add(cand.batchId);
      const remainingAvail = cand.qtyIn - (soldByBatch.get(cand.batchId) || 0);
      const maxQ = cand.productIdx >= 12 ? 2 : cand.productIdx >= 4 && cand.productIdx <= 8 ? 3 : 5;
      const qty = Math.min(rand(1, maxQ), remainingAvail);
      items.push({ productIdx: cand.productIdx, batchId: cand.batchId, qty });
      soldByBatch.set(cand.batchId, (soldByBatch.get(cand.batchId) || 0) + qty);
    }
    if (items.length === 0) continue;
    const invoice = invoiceNo(saleTime);
    const user = s % 3 === 0 ? cashier.id : admin.id;
    const st = `${saleTime.toISOString().slice(0, 19).replace('T', ' ')}`;
    const [saleRes] = await db.query(
      'INSERT INTO sales (invoice_no, user_id, total_amount, payment_method, created_at) VALUES (?,?,?,?,?)',
      [invoice, user, 0, 'cash', st]
    );
    let saleTotal = 0;
    for (const item of items) {
      const p = products[item.productIdx];
      const subtotal = p[6] * item.qty;
      saleTotal += subtotal;
      await db.query(
        'INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, subtotal) VALUES (?,?,?,?,?,?)',
        [saleRes.insertId, P[item.productIdx], item.batchId, item.qty, p[6], subtotal]
      );
      await db.query(
        `INSERT INTO stock_movements (product_id, batch_id, type, quantity, reference, user_id, created_at)
         VALUES (?,?,?,?,?,?,?)`,
        [P[item.productIdx], item.batchId, 'sale', -item.qty, invoice, user, st]
      );
    }
    await db.query('UPDATE sales SET total_amount = ? WHERE id = ?', [saleTotal, saleRes.insertId]);
    await db.query(
      'INSERT INTO activity_logs (user_id, action, details, created_at) VALUES (?,?,?,?)',
      [user, `Sale ${invoice}`, JSON.stringify({ items: items.length, total: saleTotal }), st]
    );
    saleLogs++;
  }
}

// ── Reconcile exact remaining + force demo states ──────
// 1. Exact remaining = quantity_in - sold (movements already recorded)
for (let i = 0; i < batches.length; i++) {
  const sold = soldByBatch.get(B[i]) || 0;
  const rem = Math.max(0, batches[i][2] - sold);
  await db.query('UPDATE batches SET remaining = ? WHERE id = ?', [rem, B[i]]);
}
// 2. Force demo states with legitimate write-off movements so trail stays exact:
//    - FUNG-B1 (productIdx 9, expired) → expire the remainder
//    - HF-B1 (productIdx 11) → out of stock: adjust remaining to 0
const FUNG = batches.findIndex(b => b[0] === 9 && b[1] === 'FUNG-B1');
const HF = batches.findIndex(b => b[0] === 11 && b[1] === 'HF-B1');
const UREA = batches.findIndex(b => b[0] === 4 && b[1] === 'UREA-B1');
const AS = batches.findIndex(b => b[0] === 6 && b[1] === 'AS-B1');
const PEST = batches.findIndex(b => b[0] === 7 && b[1] === 'PEST-B1');
const SPRAY = batches.findIndex(b => b[0] === 14 && b[1] === 'SPRAY-B1');

const writeOff = async (idx, type, targetRem, note) => {
  const [[b]] = await db.query('SELECT remaining FROM batches WHERE id = ?', [B[idx]]);
  const diff = b.remaining - targetRem;
  if (diff !== 0) {
    await db.query('UPDATE batches SET remaining = ? WHERE id = ?', [targetRem, B[idx]]);
    await db.query(
      `INSERT INTO stock_movements (product_id, batch_id, type, quantity, reference, user_id, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [P[batches[idx][0]], B[idx], type, -diff, note, admin.id, d(-1, 8)]
    );
    await db.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES (?,?,?)',
      [admin.id, type === 'expired' ? 'Wrote off expired stock' : 'Stock adjustment', JSON.stringify({ batch: batches[idx][1], qty: Math.abs(diff), note })]
    );
  }
};
// 4 → low stock (target 4, but keep >0 for low-stock demo)
const lowTarget = (idx, t) => writeOff(idx, 'adjustment', t, 'Manual adjustment to reorder level');
await writeOff(FUNG, 'expired', 4, 'Expired stock remains — flagged and blocked from sale');
await writeOff(HF, 'adjustment', 0, 'Out of stock (sold out)');
// ensure low-stock demo states (only if current remaining > target, i.e. they're above reorder)
const cur = async (idx) => (await db.query('SELECT remaining FROM batches WHERE id = ?', [B[idx]]))[0][0].remaining;
if (await cur(UREA) > 4) await lowTarget(UREA, 4);
if (await cur(AS) > 3) await lowTarget(AS, 3);
if (await cur(PEST) > 2) await lowTarget(PEST, 2);
if (await cur(SPRAY) > 1) await lowTarget(SPRAY, 1);

// ── Backfill revision columns (paid sales, batch suppliers) ──
await db.query("UPDATE sales SET amount_paid = total_amount, paid_at = created_at WHERE payment_status = 'paid'");
await db.query('UPDATE batches b JOIN products p ON p.id = b.product_id SET b.supplier_id = p.supplier_id WHERE b.supplier_id IS NULL');

// ── Final audit log ────────────────────────────────────
const [[stats]] = await db.query(`
  SELECT
    (SELECT COUNT(*) FROM products) AS products,
    (SELECT COUNT(*) FROM batches) AS batches,
    (SELECT COUNT(*) FROM sales) AS sales,
    (SELECT COUNT(*) FROM sale_items) AS sale_items,
    (SELECT COUNT(*) FROM stock_movements) AS movements,
    (SELECT COUNT(*) FROM activity_logs) AS logs
`);
console.log('✅ Seed complete:', JSON.stringify({ ...stats, sales_logs: saleLogs }));
// Verify exactness: remaining == qty_in - sum(movements)
const [[bad]] = await db.query(`
  SELECT COUNT(*) AS mismatches FROM batches b
  JOIN (SELECT batch_id, COALESCE(SUM(quantity),0) AS total FROM stock_movements GROUP BY batch_id) m ON m.batch_id = b.id
  WHERE b.remaining <> m.total
`);
console.log(bad.mismatches === 0 ? '✅ Audit trail exact (0 mismatches)' : `⚠ ${bad.mismatches} batch mismatches`);

await db.end();
