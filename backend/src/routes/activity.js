import { Router } from 'express';
import { q } from '../config/db.js';
import { authRequired, roleGuard } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

const router = Router();
router.use(authRequired, roleGuard('admin'));

router.get('/', asyncHandler(async (req, res) => {
  const { limit = 50 } = req.query;
  const rows = await q(
    `SELECT a.id, a.action, a.details, a.created_at, u.name AS user_name
     FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC LIMIT ?`,
    [Number(limit) || 50]
  );
  res.json(rows);
}));

export default router;