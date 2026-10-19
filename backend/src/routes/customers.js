import { Router } from 'express';
import { q } from '../config/db.js';
import { authRequired } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { logActivity } from '../utils/helpers.js';

const router = Router();
router.use(authRequired);

router.get('/customers', asyncHandler(async (req, res) => {
  const { search = '' } = req.query;
  const rows = search
    ? await q('SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name LIMIT 30', [`%${search}%`, `%${search}%`])
    : await q('SELECT * FROM customers ORDER BY name LIMIT 100');
  res.json(rows);
}));

router.post('/customers', asyncHandler(async (req, res) => {
  const { name, phone } = req.body || {};
  if (!name?.trim()) throw new ApiError(400, 'Customer name is required');
  const r = await q('INSERT INTO customers (name, phone) VALUES (?,?)', [name.trim(), phone?.trim() || null]);
  await logActivity(req.user.id, 'Add customer', { name: name.trim() });
  const rows = await q('SELECT * FROM customers WHERE id = ?', [r.insertId]);
  res.status(201).json(rows[0]);
}));

export default router;
