import dotenv from 'dotenv';
dotenv.config();

// One global low-stock rule: stock at or below this many units counts as low.
export const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD) || 10;

// SQL fragment: sellable (non-expired) stock for product alias `p`.
export const STOCK_SQL = (alias = 'p') =>
  `COALESCE((SELECT SUM(CASE WHEN b.expiry_date IS NULL OR b.expiry_date >= CURDATE() THEN b.remaining ELSE 0 END)
             FROM batches b WHERE b.product_id = ${alias}.id), 0)`;
