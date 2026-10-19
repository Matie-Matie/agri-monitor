import { Router } from 'express';
import { q } from '../config/db.js';
import { authRequired } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { LOW_STOCK_THRESHOLD, STOCK_SQL } from '../config/settings.js';

const router = Router();
router.use(authRequired);

router.get('/', asyncHandler(async (_req, res) => {
  const [todaySales] = await q(`SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count FROM sales WHERE DATE(created_at) = CURDATE()`);
  const [lowStock] = await q(
    `SELECT COUNT(*) AS c,
            COALESCE(SUM(GREATEST(? - t.stock, 0) * t.cost_price), 0) AS restock_value,
            COALESCE(SUM(t.stock <= 0), 0) AS out_count
     FROM (SELECT p.cost_price, ${STOCK_SQL('p')} AS stock FROM products p WHERE p.is_active = 1) t
     WHERE t.stock <= ?`,
    [LOW_STOCK_THRESHOLD, LOW_STOCK_THRESHOLD]
  );
  const [expiring] = await q(
    `SELECT COUNT(*) AS c FROM batches WHERE expiry_date IS NOT NULL AND remaining > 0
       AND expiry_date >= CURDATE() AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`
  );
  const [expired] = await q(
    `SELECT COUNT(*) AS c FROM batches WHERE expiry_date IS NOT NULL AND remaining > 0 AND expiry_date < CURDATE()`
  );
  const [productCount] = await q(`SELECT COALESCE(SUM(is_active = 1),0) AS active, COALESCE(SUM(is_active = 0),0) AS inactive FROM products`);
  const [stockValue] = await q(
    `SELECT COALESCE(SUM(b.remaining * p.selling_price),0) AS value FROM batches b JOIN products p ON p.id=b.product_id`
  );

  const week = await q(
    `SELECT DATE(created_at) AS date, COALESCE(SUM(total_amount),0) AS total
     FROM sales WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
     GROUP BY DATE(created_at) ORDER BY date`
  );
  const recentActivity = await q(
    `SELECT a.action, a.details, a.created_at, u.name AS user_name
     FROM activity_logs a LEFT JOIN users u ON u.id=a.user_id
     ORDER BY a.created_at DESC LIMIT 8`
  );
  const lowStockItems = await q(
    `SELECT t.* FROM (SELECT p.id, p.name, p.sku, p.unit, ${STOCK_SQL('p')} AS stock_qty FROM products p WHERE p.is_active = 1) t
     WHERE t.stock_qty <= ? ORDER BY t.stock_qty ASC LIMIT 6`,
    [LOW_STOCK_THRESHOLD]
  );

  res.json({
    today_sales: Number(todaySales.total), today_count: todaySales.count,
    low_stock_count: lowStock.c || 0, out_count: Number(lowStock.out_count || 0), low_stock_threshold: LOW_STOCK_THRESHOLD, restock_value: Number(lowStock.restock_value || 0),
    expiring_count: expiring.c, expired_count: expired.c,
    product_count: Number(productCount.active), inactive_count: Number(productCount.inactive), stock_value: Number(stockValue.value || 0),
    week: week.map(r => ({ date: r.date, total: Number(r.total) })),
    recent_activity: recentActivity,
    low_stock_items: lowStockItems,
  });
}));

export default router;