import { Router } from 'express';
import { q } from '../config/db.js';
import { authRequired, roleGuard } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { LOW_STOCK_THRESHOLD } from '../config/settings.js';

const router = Router();
router.use(authRequired, roleGuard('admin'));

// ── Inventory report (per product) ──
router.get('/inventory', asyncHandler(async (_req, res) => {
  const rows = await q(
    `SELECT p.id, p.name, p.sku, p.unit, p.cost_price, p.selling_price,
            COALESCE(SUM(CASE WHEN b.expiry_date IS NULL OR b.expiry_date >= CURDATE() THEN b.remaining ELSE 0 END),0) AS stock_qty,
            CASE
              WHEN COALESCE(SUM(CASE WHEN b.expiry_date IS NULL OR b.expiry_date >= CURDATE() THEN b.remaining ELSE 0 END),0) <= 0 THEN 'out'
              WHEN COALESCE(SUM(CASE WHEN b.expiry_date IS NULL OR b.expiry_date >= CURDATE() THEN b.remaining ELSE 0 END),0) <= ${LOW_STOCK_THRESHOLD} THEN 'low'
              ELSE 'ok' END AS status,
            c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN batches b ON b.product_id = p.id
     GROUP BY p.id ORDER BY p.name`
  );
  res.json(rows.map(r => ({ ...r, cost_price: Number(r.cost_price), selling_price: Number(r.selling_price) })));
}));

// ── Low stock report ──
router.get('/low-stock', asyncHandler(async (_req, res) => {
  const rows = await q(
    `SELECT p.id, p.name, p.sku, p.unit, p.selling_price,
            COALESCE(SUM(CASE WHEN b.expiry_date IS NULL OR b.expiry_date >= CURDATE() THEN b.remaining ELSE 0 END),0) AS stock_qty,
            (SELECT COUNT(*) FROM batches x WHERE x.product_id = p.id AND x.remaining > 0) AS active_batches
     FROM products p LEFT JOIN batches b ON b.product_id = p.id
     GROUP BY p.id
     HAVING stock_qty <= ${LOW_STOCK_THRESHOLD}
     ORDER BY stock_qty ASC, p.name`
  );
  res.json(rows.map(r => ({ ...r, selling_price: Number(r.selling_price) })));
}));

// ── Expiry report ──
router.get('/expiry', asyncHandler(async (req, res) => {
  const days_ahead = Number(req.query.days_ahead) || 30;
  const rows = await q(
    `SELECT b.id, b.batch_no, b.quantity_in, b.remaining, b.expiry_date,
            p.id AS product_id, p.name AS product_name, p.sku, p.unit,
            DATEDIFF(b.expiry_date, CURDATE()) AS days_left,
            CASE WHEN b.expiry_date < CURDATE() THEN 'expired'
                 WHEN b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY) THEN 'expiring'
                 ELSE 'ok' END AS status
     FROM batches b JOIN products p ON p.id = b.product_id
     WHERE b.expiry_date IS NOT NULL AND b.remaining > 0
     ORDER BY b.expiry_date ASC`,
    [days_ahead]
  );
  res.json(rows);
}));

// ── Sales report ──
router.get('/sales', asyncHandler(async (req, res) => {
  const { from, to, group_by = 'day' } = req.query;
  const where = ['1=1'];
  const params = [];
  if (from) { where.push('s.created_at >= ?'); params.push(`${from} 00:00:00`); }
  if (to) { where.push('s.created_at <= ?'); params.push(`${to} 23:59:59`); }

  const detail = await q(
    `SELECT DATE(s.created_at) AS date, COUNT(*) AS sales_count, COALESCE(SUM(s.total_amount),0) AS total
     FROM sales s WHERE ${where.join(' AND ')} GROUP BY DATE(s.created_at) ORDER BY date`,
    params
  );
  const topProducts = await q(
    `SELECT p.name, SUM(si.quantity) AS qty, SUM(si.subtotal) AS revenue
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     JOIN products p ON p.id = si.product_id
     WHERE ${where.join(' AND ').replace('s.created_at', 's.created_at')}
     GROUP BY si.product_id ORDER BY revenue DESC LIMIT 5`,
    params
  );
  const summary = await q(
    `SELECT COUNT(*) AS total_sales, COALESCE(SUM(total_amount),0) AS total_revenue, COUNT(DISTINCT s.id) AS invoice_count
     FROM sales s WHERE ${where.join(' AND ')}`,
    params
  );
  res.json({
    summary: summary[0],
    daily: detail.map(r => ({ ...r, total: Number(r.total) })),
    top_products: topProducts.map(r => ({ ...r, revenue: Number(r.revenue) })),
  });
}));

function csvEscape(v) { const s = String(v ?? ''); return `"${s.replace(/"/g, '""')}"`; }

// ── CSV export ──
router.get('/export/:type', asyncHandler(async (req, res) => {
  const type = req.params.type;
  let rows, filename, header;
  if (type === 'inventory') {
    rows = await q(`SELECT p.name, p.sku, c.name AS category, p.unit, p.selling_price, COALESCE(SUM(CASE WHEN b.expiry_date IS NULL OR b.expiry_date >= CURDATE() THEN b.remaining ELSE 0 END),0) AS qty
      FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN batches b ON b.product_id=p.id
      GROUP BY p.id ORDER BY p.name`);
    header = ['Product', 'SKU', 'Category', 'Unit', 'Price', 'Stock Qty'];
    filename = 'inventory.csv';
  } else if (type === 'low-stock') {
    rows = await q(`SELECT p.name, p.sku, p.unit, COALESCE(SUM(CASE WHEN b.expiry_date IS NULL OR b.expiry_date >= CURDATE() THEN b.remaining ELSE 0 END),0) AS qty
      FROM products p LEFT JOIN batches b ON b.product_id=p.id GROUP BY p.id HAVING qty <= ${LOW_STOCK_THRESHOLD} ORDER BY qty`);
    header = ['Product', 'SKU', 'Unit', 'Stock Qty'];
    filename = 'low-stock.csv';
  } else if (type === 'expiry') {
    rows = await q(`SELECT b.batch_no, p.name, b.remaining AS qty, b.expiry_date
      FROM batches b JOIN products p ON p.id=b.product_id WHERE b.expiry_date IS NOT NULL AND b.remaining>0 ORDER BY b.expiry_date`);
    header = ['Batch', 'Product', 'Stock Qty', 'Expiry Date'];
    filename = 'expiry.csv';
  } else if (type === 'sales') {
    rows = await q(`SELECT s.invoice_no, u.name AS cashier, s.total_amount, s.created_at
      FROM sales s JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC`);
    header = ['Invoice', 'Cashier', 'Total', 'Date'];
    filename = 'sales.csv';
  } else {
    return res.status(400).json({ message: 'Invalid export type' });
  }
  const csv = [header.join(','), ...rows.map(r => Object.values(r).map(csvEscape).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csv);
}));

export default router;