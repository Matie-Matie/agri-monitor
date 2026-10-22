import { q } from '../config/db.js';

export async function logActivity(userId, action, details = null) {
  try {
    await q(
      'INSERT INTO activity_logs (user_id, action, details) VALUES (?,?,?)',
      [userId, action, details ? JSON.stringify(details) : null]
    );
  } catch (e) {
    console.error('Failed to log activity:', e.message);
  }
}

export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Auto batch number: B{YYMMDD}-{productId}-{nn}. Run inside the same transaction as the batch insert.
export async function nextBatchNo(conn, productId) {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const prefix = `B${ymd}-${productId}-`;
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS c FROM batches WHERE product_id = ? AND batch_no LIKE ?',
    [productId, `${prefix}%`]
  );
  return `${prefix}${String(rows[0].c + 1).padStart(2, '0')}`;
}

// Strict YYYY-MM-DD that is a real calendar day (rejects Feb 31, Apr 31, 2026-13-01 ...).
export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Validates the dates of a stock-in batch. Empty values are allowed (both are optional).
// Throws-free: returns an error message, or null when everything is fine.
export function batchDateError({ received_at, expiry_date }) {
  if (received_at && !isValidDate(received_at)) return `Date received "${received_at}" is not a real date`;
  if (expiry_date && !isValidDate(expiry_date)) return `Expiry date "${expiry_date}" is not a real date`;
  if (received_at && received_at > todayLocal()) return 'Date received cannot be in the future';
  if (received_at && expiry_date && expiry_date < received_at) return 'Expiry date cannot be before the date received';
  return null;
}

// Validates optional ?from=&to= report/sales filters.
export function rangeDateError({ from, to }) {
  if (from && !isValidDate(from)) return `"From" date "${from}" is not a real date`;
  if (to && !isValidDate(to)) return `"To" date "${to}" is not a real date`;
  if (from && to && from > to) return '"From" date must be on or before the "To" date';
  return null;
}
