import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
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

// DELETE /api/linked-calendars/:id
// Only the calendar record is removed here. Its events are NOT hard-deleted:
// the client tombstones them (deleted:true + fresh HLC) and pushes those
// tombstones, so the removal propagates to other devices by timestamp. A
// server-side hard delete would drop those tombstones and let a device that
// still holds the live events re-push and resurrect them as orphans. The
// tombstones are garbage-collected later by the normal 30-day tombstone purge.
router.delete('/:id', asyncHandler(async (req, res) => {
  await pbLinkedCalendars.delete(req.userId, req.params.id);
  res.json({ ok: true });
}));

export default router;
