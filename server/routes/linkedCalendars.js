import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { linkedCalendars, events } from '../db/queries.js';

const router = Router();
router.use(requireAuth);

// GET /api/linked-calendars
router.get('/', (req, res) => {
  res.json(linkedCalendars.getAll(req.userId));
});

// POST /api/linked-calendars
router.post('/', (req, res) => {
  const cal = linkedCalendars.create(req.userId, req.body);
  res.status(201).json(cal);
});

// PUT /api/linked-calendars/:id
router.put('/:id', (req, res) => {
  const updated = linkedCalendars.update(req.userId, req.params.id, req.body);
  res.json(updated ?? { ok: true });
});

// DELETE /api/linked-calendars/:id — also removes all its events
router.delete('/:id', (req, res) => {
  events.deleteBySourceCalendar(req.userId, req.params.id);
  linkedCalendars.delete(req.userId, req.params.id);
  res.json({ ok: true });
});

export default router;
