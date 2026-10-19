import { Router } from 'express';
import { pool, q } from '../config/db.js';
import { authRequired, roleGuard } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { logActivity, nextBatchNo } from '../utils/helpers.js';
import { LOW_STOCK_THRESHOLD } from '../config/settings.js';

const router = Router();
router.use(authRequired);

// ── Inventory list (all batches with product + status) ──
router.get('/inventory', asyncHandler(async (req, res) => {
  const { status, search = '', product_id } = req.query;
  const where = ['1=1'];
  const params = [];
  if (search) { where.push('(p.name LIKE ? OR p.sku LIKE ? OR b.batch_no LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (product_id) { where.push('b.product_id = ?'); params.push(product_id); }

  const rows = await q(
    `SELECT b.id, b.batch_no, b.quantity_in, b.remaining, b.expiry_date, b.received_at,
            p.id AS product_id, p.name AS product_name, p.sku, p.unit, p.selling_price,
            c.name AS category_name,
            CASE
              WHEN b.expiry_date IS NULL THEN 'ok'
              WHEN b.expiry_date < CURDATE() THEN 'expired'
              WHEN b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'expiring'
              ELSE 'ok'
            END AS expiry_status,
            CASE WHEN b.remaining <= 0 THEN 'out' WHEN b.remaining <= ${LOW_STOCK_THRESHOLD} THEN 'low' ELSE 'ok' END AS stock_status
     FROM batches b
     JOIN products p ON p.id = b.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE ${where.join(' AND ')}
     ORDER BY b.expiry_date IS NULL ASC, b.expiry_date ASC, p.name`,
    params
  );
  const filtered = status
    ? rows.filter(r => r.expiry_status === status || r.stock_status === status)
    : rows;
  res.json(filtered);
}));

// ── Stock-in: add a batch to a product (batch number is auto-generated) ──
router.post('/products/:id/batches', roleGuard('admin'), asyncHandler(async (req, res) => {
  const { quantity, expiry_date, supplier_id, received_at } = req.body || {};
  const productId = req.params.id;
  const product = await q('SELECT * FROM products WHERE id = ?', [productId]);
  if (!product[0]) throw new ApiError(404, 'Product not found');
  const qty = Number(quantity);
  if (!qty || qty <= 0) throw new ApiError(400, 'A positive quantity is required');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const batchNo = await nextBatchNo(conn, productId);
    const [r] = await conn.query(
      'INSERT INTO batches (product_id, supplier_id, batch_no, quantity_in, remaining, expiry_date, received_at) VALUES (?,?,?,?,?,?,?)',
      [productId, supplier_id || product[0].supplier_id || null, batchNo, qty, qty, expiry_date || null,
        received_at ? `${received_at} 00:00:00` : new Date()]
    );
    await conn.query(
      'INSERT INTO stock_movements (product_id, batch_id, type, quantity, reference, user_id) VALUES (?,?,?,?,?,?)',
      [productId, r.insertId, 'stock_in', qty, `Stock-in ${batchNo}`, req.user.id]
    );
    await conn.commit();
    await logActivity(req.user.id, 'Stock-in', { product: product[0].name, batch: batchNo, qty });
    res.status(201).json({ id: r.insertId, batch_no: batchNo, message: `Stocked in ${qty} ${product[0].unit} (${batchNo})` });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

// ── Stock adjustments (damaged / expired write-off / manual) ──
router.post('/stock/adjustments', roleGuard('admin'), asyncHandler(async (req, res) => {
  const { batch_id, type, quantity, note } = req.body || {};
  const types = ['adjustment', 'damaged', 'expired'];
  if (!types.includes(type)) throw new ApiError(400, 'Invalid adjustment type');
  const qty = Number(quantity);
  if (!batch_id || !qty || qty <= 0) throw new ApiError(400, 'Batch and positive quantity required');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [batches] = await conn.query('SELECT * FROM batches WHERE id = ? FOR UPDATE', [batch_id]);
    const batch = batches[0];
    if (!batch) throw new ApiError(404, 'Batch not found');
    if (batch.remaining < qty) throw new ApiError(400, `Only ${batch.remaining} remaining in batch ${batch.batch_no}`);
    await conn.query('UPDATE batches SET remaining = remaining - ? WHERE id = ?', [qty, batch_id]);
    await conn.query(
      'INSERT INTO stock_movements (product_id, batch_id, type, quantity, reference, user_id) VALUES (?,?,?,?,?,?)',
      [batch.product_id, batch_id, type, -qty, note || `Adjustment (${type})`, req.user.id]
    );
    await conn.commit();
    await logActivity(req.user.id, `Stock ${type}`, { batch: batch.batch_no, qty, note });
    res.json({ message: `Removed ${qty} (${type}) from ${batch.batch_no}` });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

export default router;