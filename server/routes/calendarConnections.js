/**
 * CRUD + read endpoints for stored OAuth calendar connections.
 *
 *   GET    /                       → list connections (metadata only)
 *   DELETE /:id                    → remove a connection
 *   GET    /:id/calendars          → list the provider-side calendars
 *   GET    /:id/events?externalCalendarId=…  → fetch + normalize events
 *
 * Tokens never leave the server: the client asks us to fetch, and we return
 * already-normalized event JSON which the client converts + (when ZK is on)
 * encrypts before persisting — same zero-trust shape as the ICS relay.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pocketbaseCalendarConnections } from '../lib/pocketbaseOperational.js';
import { getProvider, getValidAccessToken } from '../lib/oauth/tokenManager.js';

const router = Router();
router.use(requireAuth);

// How far around "now" to pull events — the app is a weekly planner, so a
// rolling window keeps payloads bounded. ~8 weeks back, ~16 weeks forward.
const WINDOW_BACK_MS    = 56  * 24 * 60 * 60 * 1000;
const WINDOW_FORWARD_MS = 112 * 24 * 60 * 60 * 1000;

router.get('/', (req, res) => {
  pocketbaseCalendarConnections.getAll(req.userId).then(rows => res.json(rows)).catch(err => {
    console.error('listConnections failed:', err.message);
    res.status(500).json({ error: 'Could not load calendar connections.' });
  });
});

router.delete('/:id', (req, res) => {
  pocketbaseCalendarConnections.delete(req.userId, req.params.id).then(() => {
    res.json({ ok: true });
  }).catch(err => {
    console.error('deleteConnection failed:', err.message);
    res.status(500).json({ error: 'Could not delete calendar connection.' });
  });
});

router.get('/:id/calendars', async (req, res) => {
  const conn = await pocketbaseCalendarConnections.getById(req.userId, req.params.id);
  if (!conn) return res.status(404).json({ error: 'Connection not found.' });
  try {
    const provider = getProvider(conn.provider);
    const accessToken = await getValidAccessToken(conn);
    res.json(await provider.listCalendars(accessToken));
  } catch (err) {
    console.error('listCalendars failed:', err.message);
    res.status(502).json({ error: 'Could not load calendars from the provider.' });
  }
});

router.get('/:id/events', async (req, res) => {
  const conn = await pocketbaseCalendarConnections.getById(req.userId, req.params.id);
  if (!conn) return res.status(404).json({ error: 'Connection not found.' });

  const externalCalendarId = req.query.externalCalendarId;
  if (!externalCalendarId) return res.status(400).json({ error: 'externalCalendarId is required.' });

  const now = Date.now();
  const timeMin = new Date(now - WINDOW_BACK_MS).toISOString();
  const timeMax = new Date(now + WINDOW_FORWARD_MS).toISOString();

  try {
    const provider = getProvider(conn.provider);
    const accessToken = await getValidAccessToken(conn);
    const events = await provider.listEvents(accessToken, String(externalCalendarId), timeMin, timeMax);
    res.json(events);
  } catch (err) {
    console.error('listEvents failed:', err.message);
    res.status(502).json({ error: 'Could not load events from the provider.' });
  }
});

export default router;
