/**
 * Outbound ICS feed — lets Google/Outlook/Apple Calendar subscribe to the
 * user's PLS calendar via a secret URL.
 *
 *   POST   /api/feed/enable        → (auth) generate/rotate the secret token
 *   GET    /api/feed/status        → (auth) { enabled, path }
 *   DELETE /api/feed               → (auth) disable the feed
 *   GET    /api/feed/:token        → (public; token IS the auth) the .ics file
 *
 * Zero-trust note: for ZK-enabled accounts the server only holds encrypted
 * labels, so feed events are titled "Busy" — times are visible, content is
 * not. Non-ZK accounts get full labels.
 */
import { Router } from 'express';
import { randomBytes } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { pocketbaseUsers } from '../lib/pocketbaseInternal.js';
import { pocketbaseEvents } from '../lib/pocketbaseEvents.js';

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function icsEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** week_start (YYYY-MM-DD) + day offset + half-hour slot → "YYYYMMDDTHHMMSS" (floating local time) */
function slotToIcsDateTime(weekStart, dayOfWeek, slot) {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + dayOfWeek);
  d.setMinutes(d.getMinutes() + slot * 30);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

function dateOnly(weekStart, dayOfWeek, extraDays = 0) {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + dayOfWeek + extraDays);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function buildIcs(userEvents, zkEnabled, calendarName) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PLS Calendar//EN',
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
  ];
  for (const e of userEvents) {
    const label = zkEnabled ? 'Busy' : (e.label || 'Untitled');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.id}@pls-calendar`);
    lines.push(`SUMMARY:${icsEscape(label)}`);
    if (e.is_all_day) {
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(e.week_start, e.day_of_week)}`);
      lines.push(`DTEND;VALUE=DATE:${dateOnly(e.week_start, e.day_of_week, 1)}`);
    } else {
      lines.push(`DTSTART:${slotToIcsDateTime(e.week_start, e.day_of_week, e.slot_start)}`);
      lines.push(`DTEND:${slotToIcsDateTime(e.week_start, e.day_of_week, e.slot_start + e.slot_duration)}`);
    }
    if (!zkEnabled && e.notes) lines.push(`DESCRIPTION:${icsEscape(e.notes)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

router.post('/enable', requireAuth, asyncHandler(async (req, res) => {
  const token = randomBytes(24).toString('base64url');
  await pocketbaseUsers.setFeedToken(req.userId, token);
  res.json({ enabled: true, path: `/api/feed/${token}` });
}));

router.get('/status', requireAuth, asyncHandler(async (req, res) => {
  const user = await pocketbaseUsers.getById(req.userId);
  const token = user?.ics_feed_token;
  res.json(token ? { enabled: true, path: `/api/feed/${token}` } : { enabled: false });
}));

router.delete('/', requireAuth, asyncHandler(async (req, res) => {
  await pocketbaseUsers.setFeedToken(req.userId, null);
  res.json({ ok: true });
}));

// Public — the unguessable token is the credential (same model as Google's
// "secret address"). Keep last so /enable and /status match first.
router.get('/:token', asyncHandler(async (req, res) => {
  const token = req.params.token.replace(/\.ics$/i, '');
  const user = await pocketbaseUsers.getByFeedToken(token);
  if (!user || user.is_blocked) return res.status(404).send('Not found');

  const calendar = req.query.calendar === 'actual' ? 'actual' : 'plan';
  const userEvents = (await pocketbaseEvents.getAll(user.id)).filter(e => e.calendar === calendar);
  const name = calendar === 'plan' ? 'PLS Calendar — Plan' : 'PLS Calendar — Live';

  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Cache-Control', 'private, max-age=300');
  res.send(buildIcs(userEvents, !!user.zk_enabled, name));
}));

export default router;
