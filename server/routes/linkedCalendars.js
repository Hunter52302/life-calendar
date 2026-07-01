import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pocketbaseEvents } from '../lib/pocketbaseEvents.js';
import { pbLinkedCalendars } from '../lib/pocketbaseSupport.js';

const router = Router();
router.use(requireAuth);
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/linked-calendars
router.get('/', asyncHandler(async (req, res) => {
  res.json(await pbLinkedCalendars.getAll(req.userId));
}));

// POST /api/linked-calendars
router.post('/', asyncHandler(async (req, res) => {
  const cal = await pbLinkedCalendars.create(req.userId, req.body);
  res.status(201).json(cal);
}));

// PUT /api/linked-calendars/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const updated = await pbLinkedCalendars.update(req.userId, req.params.id, req.body);
  res.json(updated ?? { ok: true });
}));

// DELETE /api/linked-calendars/:id — also removes all its events
router.delete('/:id', asyncHandler(async (req, res) => {
  await pocketbaseEvents.deleteBySourceCalendar(req.userId, req.params.id);
  await pbLinkedCalendars.delete(req.userId, req.params.id);
  res.json({ ok: true });
}));

export default router;
