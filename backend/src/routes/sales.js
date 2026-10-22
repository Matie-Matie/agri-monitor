import { Router } from 'express';
import { pool, q } from '../config/db.js';
import { authRequired, roleGuard } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { logActivity, todayLocal, rangeDateError } from '../utils/helpers.js';

const router = Router();
router.use(authRequired);

// ── Checkout (transactional, FIFO by expiry) ──
// POS is staff-only (panel decision: admin has no cart).
router.post('/sales', roleGuard('staff', 'admin'), asyncHandler(async (req, res) => {
  const { items, payment_method = 'cash', customer_id = null, payment_status = 'paid' } = req.body || {};
  if (!['paid', 'unpaid'].includes(payment_status)) throw new ApiError(400, 'Invalid payment status');
  if (payment_status === 'unpaid' && !customer_id) throw new ApiError(400, 'Select a customer for an unpaid (charge) sale');
  if (customer_id) {
    const [c] = await q('SELECT id FROM customers WHERE id = ?', [customer_id]);
    if (!c) throw new ApiError(400, 'Customer not found');
  }
  if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, 'Cart is empty');
  // Aggregate duplicate product rows
  const agg = new Map();
  for (const it of items) {
    const qty = Number(it.quantity);
    if (!it.product_id || !qty || qty <= 0) throw new ApiError(400, 'Invalid item');
    agg.set(it.product_id, (agg.get(it.product_id) || 0) + qty);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Generate invoice no
    const dateStr = todayLocal().replaceAll('-', '');
    const prefix = `${dateStr}-`;
    const invQuery = await conn.query(
      `SELECT invoice_no FROM sales WHERE invoice_no LIKE ? ORDER BY invoice_no DESC LIMIT 1`, [`AM-${dateStr}-%`]
    );
    let seq = 1;
    if (invQuery[0][0]) seq = Number(invQuery[0][0].invoice_no.split('-').pop()) + 1;
    const invoiceNo = `AM-${dateStr}-${String(seq).padStart(4, '0')}`;

    const [saleIns] = await conn.query(
      'INSERT INTO sales (invoice_no, user_id, customer_id, total_amount, payment_method, payment_status) VALUES (?,?,?,?,?,?)',
      [invoiceNo, req.user.id, customer_id || null, 0, payment_method, payment_status]
    );
    const saleId = saleIns.insertId;
    let total = 0;
    const saleItems = [];

    for (const [productId, qtyNeeded] of agg) {
      const [products] = await conn.query('SELECT * FROM products WHERE id = ? AND is_active = 1', [productId]);
      const product = products[0];
      if (!product) throw new ApiError(400, 'Product not found or inactive');

      // FIFO: sell soonest-expiry batch first (expired/null-quantity excluded, unexpired only)
      // Note: expired batches have expiry_date < today => excluded by expiry check
      const [batchRows] = await conn.query(
        `SELECT * FROM batches
         WHERE product_id = ? AND remaining > 0
           AND (expiry_date IS NULL OR expiry_date >= CURDATE())
         ORDER BY expiry_date IS NULL ASC, expiry_date ASC
         FOR UPDATE`,
        [productId]
      );
      let toSell = qtyNeeded;
      for (const batch of batchRows) {
        if (toSell <= 0) break;
        const take = Math.min(toSell, batch.remaining);
        await conn.query('UPDATE batches SET remaining = remaining - ? WHERE id = ?', [take, batch.id]);
        await conn.query(
          'INSERT INTO stock_movements (product_id, batch_id, type, quantity, reference, user_id) VALUES (?,?,?,?,?,?)',
          [productId, batch.id, 'sale', -take, invoiceNo, req.user.id]
        );
        const subtotal = Number(product.selling_price) * take;
        total += subtotal;
        await conn.query(
          'INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, subtotal) VALUES (?,?,?,?,?,?)',
          [saleId, productId, batch.id, take, product.selling_price, subtotal]
        );
        saleItems.push({ product_id: productId, batch_id: batch.id, quantity: take, unit_price: product.selling_price, subtotal });
        toSell -= take;
      }
      if (toSell > 0) {
        throw new ApiError(400, `Insufficient stock for ${product.name}. Available: ${qtyNeeded - toSell}, Requested: ${qtyNeeded}`);
      }
    }

    if (payment_status === 'paid') {
      await conn.query('UPDATE sales SET total_amount = ?, amount_paid = ?, paid_at = NOW() WHERE id = ?', [total, total, saleId]);
    } else {
      await conn.query('UPDATE sales SET total_amount = ? WHERE id = ?', [total, saleId]);
    }
    await conn.commit();

    await logActivity(req.user.id, `Sale ${invoiceNo}`, { items: saleItems.length, total });
    res.status(201).json({
      invoice_no: invoiceNo, total_amount: total, payment_status,
      items: saleItems.map(i => ({ ...i, unit_price: Number(i.unit_price), subtotal: Number(i.subtotal) })),
    });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ── Sales list ──
router.get('/sales', asyncHandler(async (req, res) => {
  const { from, to, status, page = 1, per_page = 20 } = req.query;
  const dateErr = rangeDateError({ from, to });
  if (dateErr) throw new ApiError(400, dateErr);
  const where = ['1=1'];
  const params = [];
  if (from) { where.push('s.created_at >= ?'); params.push(`${from} 00:00:00`); }
  if (to) { where.push('s.created_at <= ?'); params.push(`${to} 23:59:59`); }
  if (status === 'paid' || status === 'unpaid') { where.push('s.payment_status = ?'); params.push(status); }

  const total = await q(`SELECT COUNT(*) AS c FROM sales s WHERE ${where.join(' AND ')}`, params);
  const offset = (Math.max(1, Number(page)) - 1) * Number(per_page);
  const rows = await q(
    `SELECT s.id, s.invoice_no, s.total_amount, s.payment_method, s.payment_status, s.created_at,
            u.name AS cashier, cu.name AS customer_name,
            (SELECT SUM(quantity) FROM sale_items si WHERE si.sale_id = s.id) AS items
     FROM sales s JOIN users u ON u.id = s.user_id
     LEFT JOIN customers cu ON cu.id = s.customer_id
     WHERE ${where.join(' AND ')}
     ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(per_page), offset]
  );
  res.json({ data: rows, meta: { page: Number(page), total: total[0].c, total_pages: Math.ceil(total[0].c / Number(per_page)) } });
}));

// ── Daily summary (MUST be before /:id) ──
router.get('/sales/daily-summary', asyncHandler(async (_req, res) => {
  const today = todayLocal();
  const rows = await q(
    `SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count
     FROM sales WHERE DATE(created_at) = ?
     UNION ALL
     SELECT COALESCE(SUM(total_amount),0), COUNT(*) FROM sales WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`,
    [today]
  );
  res.json({
    today: { total: rows[0].total, count: rows[0].count },
    yesterday: { total: rows[1].total, count: rows[1].count },
  });
}));

// ── Sale detail (invoice) ──
router.get('/sales/:id', asyncHandler(async (req, res) => {
  const sale = await q(
    `SELECT s.*, u.name AS cashier, cu.name AS customer_name, cu.phone AS customer_phone
     FROM sales s JOIN users u ON u.id = s.user_id LEFT JOIN customers cu ON cu.id = s.customer_id WHERE s.id = ?`,
    [req.params.id]
  );
  if (!sale[0]) throw new ApiError(404, 'Sale not found');
  const items = await q(
    `SELECT si.*, p.name AS product_name, p.unit, b.batch_no
     FROM sale_items si
     JOIN products p ON p.id = si.product_id
     LEFT JOIN batches b ON b.id = si.batch_id
     WHERE si.sale_id = ?`,
    [req.params.id]
  );
  res.json({ ...sale[0], items: items.map(i => ({ ...i, unit_price: Number(i.unit_price), subtotal: Number(i.subtotal) })) });
}));

// ── Mark an unpaid sale as paid (admin or staff) ──
router.patch('/sales/:id/pay', asyncHandler(async (req, res) => {
  const r = await q(
    "UPDATE sales SET payment_status = 'paid', amount_paid = total_amount, paid_at = NOW() WHERE id = ? AND payment_status = 'unpaid'",
    [req.params.id]
  );
  if (r.affectedRows === 0) throw new ApiError(404, 'Sale not found or already paid');
  const [sale] = await q('SELECT invoice_no, total_amount FROM sales WHERE id = ?', [req.params.id]);
  await logActivity(req.user.id, `Payment received ${sale.invoice_no}`, { total: Number(sale.total_amount) });
  res.json({ message: `${sale.invoice_no} marked as paid` });
}));

export default router;