import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { timeBudgets } from '../db/queries.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(timeBudgets.getAll(req.userId));
});

// PUT /api/budgets/:categoryId — upsert a weekly hour target
router.put('/:categoryId', (req, res) => {
  const hours = parseFloat(req.body.weeklyHours);
  if (isNaN(hours) || hours < 0) return res.status(400).json({ error: 'weeklyHours must be a non-negative number' });
  timeBudgets.set(req.userId, req.params.categoryId, hours);
  res.json({ ok: true, categoryId: req.params.categoryId, weeklyHours: hours });
});

router.delete('/:categoryId', (req, res) => {
  timeBudgets.delete(req.userId, req.params.categoryId);
  res.json({ ok: true });
});

export default router;
