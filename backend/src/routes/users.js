import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../config/db.js';
import { authRequired, roleGuard } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { logActivity } from '../utils/helpers.js';

const router = Router();
router.use(authRequired, roleGuard('admin'));

router.get('/', asyncHandler(async (_req, res) => {
  const rows = await q('SELECT id, name, username, role, is_active, created_at FROM users ORDER BY id');
  res.json(rows);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, username, password, role = 'staff' } = req.body || {};
  if (!name?.trim() || !username?.trim() || !password) throw new ApiError(400, 'Name, username, and password are required');
  const exists = await q('SELECT id FROM users WHERE username = ?', [username.trim()]);
  if (exists[0]) throw new ApiError(400, 'Username already exists');
  const hash = await bcrypt.hash(password, 10);
  const r = await q('INSERT INTO users (name, username, password_hash, role) VALUES (?,?,?,?)',
    [name.trim(), username.trim(), hash, role]);
  await logActivity(req.user.id, 'Create user', { username });
  res.status(201).json({ id: r.insertId, message: 'User created' });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { name, role, is_active, password } = req.body || {};
  const user = await q('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user[0]) throw new ApiError(404, 'User not found');
  let hash = user[0].password_hash;
  if (password) hash = await bcrypt.hash(password, 10);
  await q('UPDATE users SET name=?, role=?, is_active=?, password_hash=? WHERE id=?',
    [name?.trim(), role, is_active ?? 1, hash, req.params.id]);
  await logActivity(req.user.id, 'Update user', { id: req.params.id, username: user[0].username });
  res.json({ message: 'User updated' });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (Number(req.params.id) === Number(req.user.id)) throw new ApiError(400, 'You cannot delete your own account');
  const r = await q('DELETE FROM users WHERE id = ?', [req.params.id]);
  if (r.affectedRows === 0) throw new ApiError(404, 'User not found');
  await logActivity(req.user.id, 'Delete user', { id: req.params.id });
  res.json({ message: 'User deleted' });
}));

export default router;