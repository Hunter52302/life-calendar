import { addDays, getWeekStart } from './utils';

const PRODID = '-//Life Calendar//Life Calendar//EN';

// ─── Export ───────────────────────────────────────────────────────────────────

export function eventsToIcal(events, calendarName = 'Life Calendar') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendarName}`,
  ];

  for (const event of events) {
    const dateStr = addDays(event.week_start, event.day_of_week);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id || Math.random().toString(36).slice(2)}@life-calendar`);

    if (event.is_all_day) {
      // All-day: use DATE value type
      lines.push(`DTSTART;VALUE=DATE:${dateStr.replace(/-/g, '')}`);
      lines.push(`DTEND;VALUE=DATE:${addDays(dateStr, 1).replace(/-/g, '')}`);
    } else {
      const slotMins = event.precision <= 0.5 ? 30 : 60;
      const startMins = event.slot_start * slotMins;
      const endMins = startMins + event.slot_duration * slotMins;
      lines.push(`DTSTART:${minsToIcalDT(dateStr, startMins)}`);
      lines.push(`DTEND:${minsToIcalDT(dateStr, endMins)}`);
    }

    lines.push(`SUMMARY:${escIcal(event.label)}`);
    if (event.category) lines.push(`CATEGORIES:${escIcal(event.category)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function minsToIcalDT(dateStr, totalMins) {
  const extraDays = Math.floor(totalMins / 1440);
  const minsInDay = totalMins % 1440;
  const date = extraDays > 0 ? addDays(dateStr, extraDays) : dateStr;
  const h = String(Math.floor(minsInDay / 60)).padStart(2, '0');
  const m = String(minsInDay % 60).padStart(2, '0');
  return date.replace(/-/g, '') + 'T' + h + m + '00';
}

function escIcal(str) {
  return String(str).replace(/[\\;,]/g, '\\$&').replace(/\n/g, '\\n');
}

// ─── Import ───────────────────────────────────────────────────────────────────

export function parseIcal(content) {
  // Unfold continuation lines (CRLF/LF + space/tab = continuation)
  const text = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '');

  const events = [];
  let cur = null;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === 'BEGIN:VEVENT') {
      cur = {};
    } else if (line === 'END:VEVENT' && cur) {
      if (cur.dtstart) events.push(cur);
      cur = null;
    } else if (cur) {
      const ci = line.indexOf(':');
      if (ci === -1) continue;
      const propPart = line.substring(0, ci);
      const val = line.substring(ci + 1);
      const key = propPart.split(';')[0].toUpperCase();

      if (key === 'UID') {
        cur.uid = val;
      } else if (key === 'DTSTART') {
        cur.dtstart = val;
        cur.dtstart_isUtc = val.endsWith('Z');
      } else if (key === 'DTEND') {
        cur.dtend = val;
        cur.dtend_isUtc = val.endsWith('Z');
      } else if (key === 'SUMMARY') {
        cur.summary = unescIcal(val);
      } else if (key === 'CATEGORIES') {
        cur.categories = val;
      } else if (key === 'RRULE') {
        cur.rrule = val;
      }
    }
  }

  return events;
}

function unescIcal(str) {
  return str.replace(/\\([\\;,nN])/g, (_, c) => (c === 'n' || c === 'N') ? '\n' : c);
}

/** Parse an iCal datetime string to a local JS Date.
 *  Handles:  20260521T090000        (floating / local)
 *            20260521T140000Z       (UTC → converted to local)
 *  Returns null for date-only (all-day) strings.
 */
function parseIcalDate(raw, isUtc) {
  const clean = raw.replace(/Z$/, '');
  if (!clean.includes('T')) return null;

  const yr = parseInt(clean.substring(0, 4));
  const mo = parseInt(clean.substring(4, 6)) - 1;
  const dy = parseInt(clean.substring(6, 8));
  const hh = parseInt(clean.substring(9, 11));
  const mm = parseInt(clean.substring(11, 13));

  if (isUtc) {
    return new Date(Date.UTC(yr, mo, dy, hh, mm, 0));
  }
  return new Date(yr, mo, dy, hh, mm, 0);
}

export function icalToAppEvent(parsed, calendar, precision = 1) {
  const raw = parsed.dtstart.replace(/Z$/, '');

  // ── All-day event (VALUE=DATE, no T) ──────────────────────────────────────
  if (!raw.includes('T')) {
    const yr = parseInt(raw.substring(0, 4));
    const mo = parseInt(raw.substring(4, 6)) - 1;
    const dy = parseInt(raw.substring(6, 8));
    const startDate = new Date(yr, mo, dy);
    const ws = getWeekStart(startDate);
    const dow = startDate.getDay();
    return {
      label: parsed.summary || 'Imported Event',
      category: 'free-time',
      color: '#6B7280',
      week_start: ws,
      day_of_week: dow,
      is_all_day: true,
      slot_start: 0,
      slot_duration: 1,
      precision,
      calendar,
    };
  }

  // ── Timed event ────────────────────────────────────────────────────────────
  const startDate = parseIcalDate(raw, parsed.dtstart_isUtc);
  if (!startDate) return null;

  const startH = startDate.getHours();
  const startM = startDate.getMinutes();

  let endH = startH + 1, endM = 0;
  if (parsed.dtend) {
    const endDate = parseIcalDate(parsed.dtend, parsed.dtend_isUtc);
    if (endDate) {
      endH = endDate.getHours();
      endM = endDate.getMinutes();
    }
  }

  const ws = getWeekStart(startDate);
  const dow = startDate.getDay();

  const slotMins = precision <= 0.5 ? 30 : 60;
  const startTotalMins = startH * 60 + startM;
  const endTotalMins = endH * 60 + endM + (endH < startH ? 1440 : 0);
  const slotStart = Math.max(0, Math.round(startTotalMins / slotMins));
  const slotDuration = Math.max(1, Math.round((endTotalMins - startTotalMins) / slotMins));
  const maxSlot = precision <= 0.5 ? 48 : 24;

  return {
    label: parsed.summary || 'Imported Event',
    category: 'free-time',
    color: '#6B7280',
    week_start: ws,
    day_of_week: dow,
    slot_start: Math.min(slotStart, maxSlot - 1),
    slot_duration: slotDuration,
    precision,
    calendar,
  };
}

/** Extract the calendar display name (X-WR-CALNAME) from the VCALENDAR header. */
export function parseIcalCalName(content) {
  const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === 'BEGIN:VEVENT') break; // stop before events
    const ci = line.indexOf(':');
    if (ci === -1) continue;
    const key = line.substring(0, ci).split(';')[0].toUpperCase();
    if (key === 'X-WR-CALNAME') return unescIcal(line.substring(ci + 1));
  }
  return null;
}

// ─── RRULE parser ────────────────────────────────────────────────────────────

/**
 * Parse an iCal RRULE value string into { repeat, untilDate, count }.
 * `repeat` maps to the values accepted by generateRepeatInstances.
 * Returns null for unsupported / missing rules.
 *
 * Examples handled:
 *   FREQ=WEEKLY
 *   FREQ=WEEKLY;UNTIL=20271231T000000Z
 *   FREQ=WEEKLY;COUNT=52;BYDAY=MO
 *   FREQ=DAILY
 *   FREQ=MONTHLY
 *   FREQ=YEARLY
 */
export function parseRrule(rruleStr) {
  if (!rruleStr) return null;

  const parts = {};
  rruleStr.split(';').forEach(seg => {
    const eq = seg.indexOf('=');
    if (eq !== -1) parts[seg.substring(0, eq).toUpperCase()] = seg.substring(eq + 1);
  });

  const freqMap = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' };
  const repeat = freqMap[parts.FREQ?.toUpperCase()];
  if (!repeat) return null;

  // Parse UNTIL (date or datetime, UTC or floating)
  let untilDate = null;
  if (parts.UNTIL) {
    const u = parts.UNTIL.replace(/Z$/, '').replace(/T.*$/, ''); // keep just date part
    if (u.length >= 8) {
      const yr = parseInt(u.substring(0, 4));
      const mo = parseInt(u.substring(4, 6)) - 1;
      const dy = parseInt(u.substring(6, 8));
      untilDate = new Date(yr, mo, dy, 23, 59, 59);
    }
  }

  const count = parts.COUNT ? parseInt(parts.COUNT) : null;

  return { repeat, untilDate, count };
}

// ─── Download helper ──────────────────────────────────────────────────────────

export function downloadIcal(icsContent, filename) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
