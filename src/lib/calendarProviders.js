/**
 * Client-side helpers for OAuth-connected calendars (Google / Microsoft).
 *
 * The server fetches provider events and returns them in a normalized shape:
 *   { id, title, start, end, allDay, notes }
 * where `start`/`end` are ISO datetime strings for timed events, or
 * 'YYYY-MM-DD' for all-day events.
 *
 * providerEventToAppEvent converts one of those into the app's event shape —
 * the same target shape as ical.js's icalToAppEvent, so connected calendars
 * render identically to imported .ics files.
 */
import { getWeekStart, shortHash } from './utils';

export const PROVIDERS = {
  google:    { id: 'google',    label: 'Google Calendar',  short: 'Google'  },
  microsoft: { id: 'microsoft', label: 'Outlook Calendar', short: 'Outlook' },
};

export function providerLabel(source) {
  return PROVIDERS[source]?.short ?? source;
}

/** Parse a 'YYYY-MM-DD' date string into a local Date (no timezone shift). */
function parseDateOnly(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function providerEventToAppEvent(ev, calendar, precision = 1) {
  if (!ev?.start) return null;

  // Recurring events arrive pre-expanded into individual occurrences that all
  // share the master's id (`seriesId`). Hash it into a stable series_id so the
  // occurrences group into one editable series — same this/future/all editing
  // as events created in-app.
  const seriesId = ev.seriesId ? shortHash(ev.seriesId) : null;

  // ── All-day ────────────────────────────────────────────────────────────────
  if (ev.allDay) {
    const startDate = parseDateOnly(String(ev.start).slice(0, 10));
    if (isNaN(startDate)) return null;
    return {
      label: ev.title || 'Untitled',
      category: 'free-time',
      color: '#6B7280',
      week_start: getWeekStart(startDate),
      day_of_week: startDate.getDay(),
      is_all_day: true,
      slot_start: 0,
      slot_duration: 1,
      precision,
      calendar,
      notes: ev.notes ?? null,
      ...(seriesId && { series_id: seriesId }),
    };
  }

  // ── Timed ────────────────────────────────────────────────────────────────────
  const startDate = new Date(ev.start);
  if (isNaN(startDate)) return null;
  const endDate = ev.end ? new Date(ev.end) : null;

  const startH = startDate.getHours();
  const startM = startDate.getMinutes();
  let endH = startH + 1, endM = 0;
  if (endDate && !isNaN(endDate)) {
    endH = endDate.getHours();
    endM = endDate.getMinutes();
  }

  const slotMins = precision <= 0.5 ? 30 : 60;
  const startTotalMins = startH * 60 + startM;
  const endTotalMins = endH * 60 + endM + (endH < startH ? 1440 : 0);
  const slotStart = Math.max(0, Math.round(startTotalMins / slotMins));
  const slotDuration = Math.max(1, Math.round((endTotalMins - startTotalMins) / slotMins));
  const maxSlot = precision <= 0.5 ? 48 : 24;

  return {
    label: ev.title || 'Untitled',
    category: 'free-time',
    color: '#6B7280',
    week_start: getWeekStart(startDate),
    day_of_week: startDate.getDay(),
    slot_start: Math.min(slotStart, maxSlot - 1),
    slot_duration: slotDuration,
    precision,
    calendar,
    notes: ev.notes ?? null,
    ...(seriesId && { series_id: seriesId }),
  };
}
