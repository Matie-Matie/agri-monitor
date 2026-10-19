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
