import { Router } from 'express';
import { q } from '../config/db.js';
import { authRequired, roleGuard } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { logActivity } from '../utils/helpers.js';

const router = Router();
router.use(authRequired);

// ── Categories ──
router.get('/categories', asyncHandler(async (_req, res) => {
  const rows = await q(
    `SELECT c.*, COUNT(p.id) AS product_count
     FROM categories c LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.id ORDER BY c.name`
  );
  res.json(rows);
}));

router.post('/categories', roleGuard('admin'), asyncHandler(async (req, res) => {
  const { name, description } = req.body || {};
  if (!name?.trim()) throw new ApiError(400, 'Category name is required');
  const r = await q('INSERT INTO categories (name, description) VALUES (?,?)', [name.trim(), description || null]);
  await logActivity(req.user.id, 'Create category', { name });
  const rows = await q('SELECT * FROM categories WHERE id = ?', [r.insertId]);
  res.status(201).json(rows[0]);
}));

router.put('/categories/:id', roleGuard('admin'), asyncHandler(async (req, res) => {
  const { name, description } = req.body || {};
  const r = await q('UPDATE categories SET name = ?, description = ? WHERE id = ?', [name?.trim(), description ?? '', req.params.id]);
  if (r.affectedRows === 0) throw new ApiError(404, 'Category not found');
  await logActivity(req.user.id, 'Update category', { id: req.params.id, name });
  const rows = await q('SELECT * FROM categories WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
}));

router.delete('/categories/:id', roleGuard('admin'), asyncHandler(async (req, res) => {
  const used = await q('SELECT COUNT(*) AS c FROM products WHERE category_id = ?', [req.params.id]);
  if (used[0].c > 0) throw new ApiError(400, 'Cannot delete category with products');
  const r = await q('DELETE FROM categories WHERE id = ?', [req.params.id]);
  if (r.affectedRows === 0) throw new ApiError(404, 'Category not found');
  await logActivity(req.user.id, 'Delete category', { id: req.params.id });
  res.json({ message: 'Category deleted' });
}));

// ── Suppliers ──
router.get('/suppliers', asyncHandler(async (_req, res) => {
  const rows = await q(
    `SELECT s.*,
            (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id) AS product_count,
            (SELECT COUNT(*) FROM batches b WHERE b.supplier_id = s.id) AS batch_count
     FROM suppliers s ORDER BY s.name`
  );
  res.json(rows);
}));

router.post('/suppliers', roleGuard('admin'), asyncHandler(async (req, res) => {
  const { name, contact } = req.body || {};
  if (!name?.trim()) throw new ApiError(400, 'Supplier name is required');
  const r = await q('INSERT INTO suppliers (name, contact) VALUES (?,?)', [name.trim(), contact || null]);
  await logActivity(req.user.id, 'Create supplier', { name });
  const rows = await q('SELECT * FROM suppliers WHERE id = ?', [r.insertId]);
  res.status(201).json(rows[0]);
}));

router.put('/suppliers/:id', roleGuard('admin'), asyncHandler(async (req, res) => {
  const { name, contact } = req.body || {};
  const r = await q('UPDATE suppliers SET name = ?, contact = ? WHERE id = ?', [name?.trim(), contact ?? '', req.params.id]);
  if (r.affectedRows === 0) throw new ApiError(404, 'Supplier not found');
  await logActivity(req.user.id, 'Update supplier', { name });
  const rows = await q('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
}));

router.delete('/suppliers/:id', roleGuard('admin'), asyncHandler(async (req, res) => {
  const used = await q(
    'SELECT (SELECT COUNT(*) FROM products WHERE supplier_id = ?) + (SELECT COUNT(*) FROM batches WHERE supplier_id = ?) AS c',
    [req.params.id, req.params.id]
  );
  if (used[0].c > 0) throw new ApiError(400, 'Cannot delete a supplier that has products or stock batches');
  await q('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
  await logActivity(req.user.id, 'Delete supplier', { id: req.params.id });
  res.json({ message: 'Supplier deleted' });
}));

export default router;