import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { events } from '../db/queries.js';

const router = Router();
router.use(requireAuth);

// GET /api/events — all events for the authenticated user
router.get('/', (req, res) => {
  res.json(events.getAll(req.userId));
});

// POST /api/events — create a single event
router.post('/', (req, res) => {
  const event = events.create(req.userId, req.body);
  res.status(201).json(event);
});

// POST /api/events/batch — bulk import (localStorage migration + iCal imports)
router.post('/batch', (req, res) => {
  const { events: eventsArray } = req.body;
  if (!Array.isArray(eventsArray)) {
    return res.status(400).json({ error: 'Expected { events: [...] }' });
  }
  events.batchCreate(req.userId, eventsArray);
  res.json({ imported: eventsArray.length });
});

// PUT /api/events/:id — update an event
router.put('/:id', (req, res) => {
  const updated = events.update(req.userId, req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Event not found' });
  res.json(updated);
});

// DELETE /api/events/:id — delete an event
router.delete('/:id', (req, res) => {
  events.delete(req.userId, req.params.id);
  res.json({ ok: true });
});

// POST /api/events/replace-by-source — atomic source replacement (birthday events etc.)
router.post('/replace-by-source', (req, res) => {
  const { source, events: eventsArray } = req.body;
  if (!source) return res.status(400).json({ error: 'source is required' });
  events.replaceBySource(req.userId, source, eventsArray ?? []);
  res.json({ ok: true });
});

export default router;
