import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { pocketbaseHabitCompletions, pocketbaseHabits } from '../lib/pocketbaseHabits.js';

const router = Router();
router.use(requireAuth);
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', asyncHandler(async (req, res) => {
  res.json(await pocketbaseHabits.getAll(req.userId));
}));

router.post('/', asyncHandler(async (req, res) => {
  const habit = await pocketbaseHabits.create(req.userId, { ...req.body, id: req.body.id || randomUUID() });
  res.status(201).json(habit);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const updated = await pocketbaseHabits.update(req.userId, req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Habit not found' });
  res.json(updated);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await pocketbaseHabits.delete(req.userId, req.params.id);
  res.json({ ok: true });
}));

// POST /api/habits/:id/complete — mark a habit done for a date
router.post('/:id/complete', asyncHandler(async (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'date is required' });
  const id = req.body.completionId || randomUUID();
  await pocketbaseHabitCompletions.upsert(req.userId, req.params.id, id, date);
  res.json({ ok: true, id, date });
}));

// DELETE /api/habits/:id/complete/:date — unmark a completion
router.delete('/:id/complete/:date', asyncHandler(async (req, res) => {
  await pocketbaseHabitCompletions.delete(req.userId, req.params.id, req.params.date);
  res.json({ ok: true });
}));

export default router;
