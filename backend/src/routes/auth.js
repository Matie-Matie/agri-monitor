import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../config/db.js';
import { signToken, authRequired } from '../middleware/auth.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { logActivity } from '../utils/helpers.js';

const router = Router();

router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) throw new ApiError(400, 'Username and password are required');
  const users = await q('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
  const user = users[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new ApiError(401, 'Invalid username or password');
  }
  if (!user.is_active) throw new ApiError(403, 'Account is deactivated');
  await logActivity(user.id, 'Login', { username });
  const token = signToken(user);
  res.json({ token, user: sanitize(user) });
}));

router.get('/me', authRequired, asyncHandler(async (req, res) => {
  const users = await q('SELECT id, name, username, role, is_active, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!users[0]) throw new ApiError(404, 'User not found');
  res.json({ user: users[0] });
}));

const sanitize = (u) => ({
  id: u.id, username: u.username, name: u.name, role: u.role, is_active: u.is_active,
});

export default router;