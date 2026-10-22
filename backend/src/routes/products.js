import { Router } from 'express';
import { pool, q } from '../config/db.js';
import { authRequired, roleGuard } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { logActivity, nextBatchNo, batchDateError } from '../utils/helpers.js';
import { LOW_STOCK_THRESHOLD } from '../config/settings.js';

const router = Router();
router.use(authRequired);

// Base query: one row per product with stock / expiry aggregates. Filters are applied on the outer query.
const BASE_SQL = `
  SELECT p.*, c.name AS category_name, s.name AS supplier_name,
         COALESCE(SUM(CASE WHEN b.expiry_date IS NULL OR b.expiry_date >= CURDATE() THEN b.remaining ELSE 0 END), 0) AS stock_qty,
         COALESCE(SUM(CASE WHEN b.expiry_date IS NOT NULL AND b.expiry_date < CURDATE() THEN b.remaining ELSE 0 END), 0) AS expired_qty,
         COALESCE(SUM(CASE WHEN b.expiry_date >= CURDATE() AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN b.remaining ELSE 0 END), 0) AS expiring_qty,
         MIN(CASE WHEN b.remaining > 0 AND b.expiry_date >= CURDATE() THEN b.expiry_date END) AS next_expiry,
         GROUP_CONCAT(DISTINCT CASE WHEN b.remaining > 0 THEN bs.name END ORDER BY bs.name SEPARATOR ', ') AS batch_suppliers
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN suppliers s ON s.id = p.supplier_id
  LEFT JOIN batches b ON b.product_id = p.id
  LEFT JOIN suppliers bs ON bs.id = b.supplier_id
  GROUP BY p.id`;

// ── List products (search, filter, pagination) ──
router.get('/products', asyncHandler(async (req, res) => {
  const { search = '', category_id, is_active = '1', filter = '', page = 1, per_page = 20 } = req.query;
  const where = ['1=1'];
  const params = [];
  if (search) { where.push('(t.name LIKE ? OR t.sku LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (category_id) { where.push('t.category_id = ?'); params.push(category_id); }

  // Dashboard click-through filters
  let active = String(is_active);
  if (filter === 'inactive') active = '0';
  if (filter === 'active') active = '1';
  if (active === '1') where.push('t.is_active = 1');
  if (active === '0') where.push('t.is_active = 0');
  if (filter === 'low') { where.push('t.stock_qty <= ?'); params.push(LOW_STOCK_THRESHOLD); }
  if (filter === 'out') where.push('t.stock_qty <= 0');
  if (filter === 'expiring') where.push('t.expiring_qty > 0');
  if (filter === 'expired') where.push('t.expired_qty > 0');

  const total = await q(`SELECT COUNT(*) AS c FROM (${BASE_SQL}) t WHERE ${where.join(' AND ')}`, params);
  const offset = (Math.max(1, Number(page)) - 1) * Number(per_page);
  const rows = await q(
    `SELECT t.* FROM (${BASE_SQL}) t WHERE ${where.join(' AND ')} ORDER BY t.name LIMIT ? OFFSET ?`,
    [...params, Number(per_page), offset]
  );
  res.json({
    data: rows,
    meta: {
      page: Number(page), per_page: Number(per_page), total: total[0].c,
      total_pages: Math.ceil(total[0].c / Number(per_page)), low_stock_threshold: LOW_STOCK_THRESHOLD,
    },
  });
}));

// ── Barcode lookup (USB scanner types the SKU + Enter). MUST be before /products/:id ──
router.get('/products/by-sku/:sku', asyncHandler(async (req, res) => {
  const sku = String(req.params.sku || '').trim();
  const rows = await q(`SELECT t.* FROM (${BASE_SQL}) t WHERE t.sku = ? AND t.is_active = 1`, [sku]);
  if (!rows[0]) throw new ApiError(404, `Barcode not found: ${sku}`);
  res.json(rows[0]);
}));

// ── Product detail with batches ──
router.get('/products/:id', asyncHandler(async (req, res) => {
  const rows = await q(`SELECT t.* FROM (${BASE_SQL}) t WHERE t.id = ?`, [req.params.id]);
  if (!rows[0]) throw new ApiError(404, 'Product not found');
  const batches = await q(
    `SELECT b.*, sp.name AS supplier_name, CASE
        WHEN b.expiry_date IS NULL THEN 'ok'
        WHEN b.expiry_date < CURDATE() THEN 'expired'
        WHEN b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'expiring'
        ELSE 'ok' END AS status
     FROM batches b LEFT JOIN suppliers sp ON sp.id = b.supplier_id
     WHERE b.product_id = ? ORDER BY b.received_at DESC, b.id DESC`,
    [req.params.id]
  );
  res.json({ ...rows[0], batches });
}));

// ── Create product (optionally with its first batch in the same transaction) ──
router.post('/products', roleGuard('admin'), asyncHandler(async (req, res) => {
  const { name, sku, category_id, supplier_id, unit, cost_price, selling_price,
    initial_quantity, expiry_date, received_at } = req.body || {};
  if (!name?.trim() || !sku?.trim() || !category_id) throw new ApiError(400, 'Name, sku, and category are required');
  const qty = Number(initial_quantity) || 0;
  if (qty < 0) throw new ApiError(400, 'Initial quantity cannot be negative');
  const dateErr = batchDateError({ received_at, expiry_date });
  if (dateErr) throw new ApiError(400, dateErr);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [dup] = await conn.query('SELECT id FROM products WHERE sku = ?', [sku.trim()]);
    if (dup[0]) throw new ApiError(400, 'SKU already exists');
    const [r] = await conn.query(
      'INSERT INTO products (name, sku, category_id, supplier_id, unit, cost_price, selling_price) VALUES (?,?,?,?,?,?,?)',
      [name.trim(), sku.trim(), category_id, supplier_id || null, unit || 'piece',
        Number(cost_price) || 0, Number(selling_price) || 0]
    );
    let batchNo = null;
    if (qty > 0) {
      batchNo = await nextBatchNo(conn, r.insertId);
      const [b] = await conn.query(
        'INSERT INTO batches (product_id, supplier_id, batch_no, quantity_in, remaining, expiry_date, received_at) VALUES (?,?,?,?,?,?,?)',
        [r.insertId, supplier_id || null, batchNo, qty, qty, expiry_date || null,
          received_at ? `${received_at} 00:00:00` : new Date()]
      );
      await conn.query(
        'INSERT INTO stock_movements (product_id, batch_id, type, quantity, reference, user_id) VALUES (?,?,?,?,?,?)',
        [r.insertId, b.insertId, 'stock_in', qty, `Stock-in ${batchNo}`, req.user.id]
      );
    }
    await conn.commit();
    await logActivity(req.user.id, 'Create product', { name, sku, initial_quantity: qty, batch: batchNo });
    res.status(201).json({ id: r.insertId, batch_no: batchNo, message: 'Product created' });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

// ── Update product ──
router.put('/products/:id', roleGuard('admin'), asyncHandler(async (req, res) => {
  const { name, sku, category_id, supplier_id, unit, cost_price, selling_price, is_active } = req.body || {};
  const r = await q(
    `UPDATE products SET name=?, sku=?, category_id=?, supplier_id=?, unit=?, cost_price=?, selling_price=?, is_active=?
     WHERE id=?`,
    [name?.trim(), sku?.trim(), category_id, supplier_id || null, unit, Number(cost_price) || 0,
      Number(selling_price) || 0, is_active ?? 1, req.params.id]
  );
  if (r.affectedRows === 0) throw new ApiError(404, 'Product not found');
  await logActivity(req.user.id, 'Update product', { id: req.params.id, name });
  res.json({ message: 'Product updated' });
}));

// ── Archive (soft delete) ──
router.delete('/products/:id', roleGuard('admin'), asyncHandler(async (req, res) => {
  const r = await q('UPDATE products SET is_active = 0 WHERE id = ? AND is_active = 1', [req.params.id]);
  if (r.affectedRows === 0) throw new ApiError(404, 'Product not found or already archived');
  await logActivity(req.user.id, 'Archive product', { id: req.params.id });
  res.json({ message: 'Product archived' });
}));

// ── Re-enable ──
router.post('/products/:id/restore', roleGuard('admin'), asyncHandler(async (req, res) => {
  const r = await q('UPDATE products SET is_active = 1 WHERE id = ?', [req.params.id]);
  if (r.affectedRows === 0) throw new ApiError(404, 'Product not found');
  await logActivity(req.user.id, 'Restore product', { id: req.params.id });
  res.json({ message: 'Product restored' });
}));

export default router;
