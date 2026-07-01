import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pbTimeBudgets } from '../lib/pocketbaseSupport.js';

const router = Router();
router.use(requireAuth);
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', asyncHandler(async (req, res) => {
  res.json(await pbTimeBudgets.getAll(req.userId));
}));

// PUT /api/budgets/:categoryId — upsert a weekly hour target
router.put('/:categoryId', asyncHandler(async (req, res) => {
  const hours = parseFloat(req.body.weeklyHours);
  if (isNaN(hours) || hours < 0) return res.status(400).json({ error: 'weeklyHours must be a non-negative number' });
  await pbTimeBudgets.set(req.userId, req.params.categoryId, hours);
  res.json({ ok: true, categoryId: req.params.categoryId, weeklyHours: hours });
}));

router.delete('/:categoryId', asyncHandler(async (req, res) => {
  await pbTimeBudgets.delete(req.userId, req.params.categoryId);
  res.json({ ok: true });
}));

export default router;
