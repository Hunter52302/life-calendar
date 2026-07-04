import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { pocketbaseEvents as events } from '../lib/pocketbaseEvents.js';
import { pocketbaseUsers } from '../lib/pocketbaseInternal.js';

const router = Router();
router.use(requireAuth);

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const VERIFIER_RE = /^[0-9a-f]{64}$/;

// GET /api/events — all events for the authenticated user
router.get('/', asyncHandler(async (req, res) => {
  res.json(await events.getAll(req.userId));
}));

// POST /api/events — create a single event
router.post('/', asyncHandler(async (req, res) => {
  const event = await events.create(req.userId, req.body);
  res.status(201).json(event);
}));

// POST /api/events/batch — bulk import (localStorage migration + iCal imports)
router.post('/batch', asyncHandler(async (req, res) => {
  const { events: eventsArray } = req.body;
  if (!Array.isArray(eventsArray)) {
    return res.status(400).json({ error: 'Expected { events: [...] }' });
  }
  await events.batchCreate(req.userId, eventsArray);
  res.json({ imported: eventsArray.length });
}));

// DELETE /api/events - clear all calendar events after password proof
router.delete('/', authLimiter, asyncHandler(async (req, res) => {
  const { authVerifier } = req.body ?? {};
  if (!VERIFIER_RE.test(authVerifier ?? '')) {
    return res.status(400).json({ error: 'Password confirmation is required.' });
  }

  const user = await pocketbaseUsers.getById(req.userId);
  const ok = await bcrypt.compare(authVerifier, user?.password_hash ?? '');
  if (!user || !ok) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  await events.deleteAll(req.userId);
  res.json({ ok: true });
}));

// PUT /api/events/:id — update an event
router.put('/:id', asyncHandler(async (req, res) => {
  const updated = await events.update(req.userId, req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Event not found' });
  res.json(updated);
}));

// DELETE /api/events/:id — delete an event
router.delete('/:id', asyncHandler(async (req, res) => {
  await events.delete(req.userId, req.params.id);
  res.json({ ok: true });
}));

// POST /api/events/replace-by-source — atomic source replacement (birthday events etc.)
router.post('/replace-by-source', asyncHandler(async (req, res) => {
  const { source, events: eventsArray } = req.body;
  if (!source) return res.status(400).json({ error: 'source is required' });
  await events.replaceBySource(req.userId, source, eventsArray ?? []);
  res.json({ ok: true });
}));

// POST /api/events/replace-by-source-calendar — atomic re-sync of a subscribed calendar
router.post('/replace-by-source-calendar', asyncHandler(async (req, res) => {
  const { sourceCalendarId, events: eventsArray } = req.body;
  if (!sourceCalendarId) return res.status(400).json({ error: 'sourceCalendarId is required' });
  await events.replaceBySourceCalendar(req.userId, sourceCalendarId, eventsArray ?? []);
  res.json({ ok: true });
}));

export default router;
