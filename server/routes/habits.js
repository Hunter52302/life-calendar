import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { habits, habitCompletions } from '../db/queries.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(habits.getAll(req.userId));
});

router.post('/', (req, res) => {
  const habit = habits.create(req.userId, { ...req.body, id: req.body.id || randomUUID() });
  res.status(201).json(habit);
});

router.put('/:id', (req, res) => {
  const updated = habits.update(req.userId, req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Habit not found' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  habits.delete(req.userId, req.params.id);
  res.json({ ok: true });
});

// POST /api/habits/:id/complete — mark a habit done for a date
router.post('/:id/complete', (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'date is required' });
  const id = req.body.completionId || randomUUID();
  habitCompletions.upsert(req.userId, req.params.id, id, date);
  res.json({ ok: true, id, date });
});

// DELETE /api/habits/:id/complete/:date — unmark a completion
router.delete('/:id/complete/:date', (req, res) => {
  habitCompletions.delete(req.userId, req.params.id, req.params.date);
  res.json({ ok: true });
});

export default router;
