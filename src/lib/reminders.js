// Reminder lead-time presets and helpers, shared by the desktop-tray reminder
// (useDesktopTray) and the server-push event-reminder schedules. `minutes` is
// how long BEFORE an event the reminder fires.
//
// The list is deliberately curated to the lead times calendar apps actually
// use: sub-hour, a couple of hour steps, then day/week steps up to two weeks.
// Anything in between (e.g. 5 or 10 hours) is reachable via the Custom option,
// so the dropdown stays short without limiting anyone.

export const LEAD_TIME_PRESETS = [
  { minutes: 5,     label: '5 minutes before' },
  { minutes: 10,    label: '10 minutes before' },
  { minutes: 15,    label: '15 minutes before' },
  { minutes: 30,    label: '30 minutes before' },
  { minutes: 60,    label: '1 hour before' },
  { minutes: 120,   label: '2 hours before' },
  { minutes: 1440,  label: '1 day before' },
  { minutes: 2880,  label: '2 days before' },
  { minutes: 4320,  label: '3 days before' },
  { minutes: 10080, label: '1 week before' },
  { minutes: 20160, label: '2 weeks before' },
];

// Units offered by the Custom lead-time input, in minutes.
export const LEAD_TIME_UNITS = { minutes: 1, hours: 60, days: 1440, weeks: 10080 };

// The largest whole unit that divides a minute count evenly — used to seed the
// Custom input from an existing value (e.g. 300 → { value: 5, unit: 'hours' }).
export function splitMinutes(minutes) {
  const m = Math.max(1, Math.round(minutes || 0));
  for (const unit of ['weeks', 'days', 'hours']) {
    if (m % LEAD_TIME_UNITS[unit] === 0) return { value: m / LEAD_TIME_UNITS[unit], unit };
  }
  return { value: m, unit: 'minutes' };
}

// Rounded, approximate duration for a live countdown (the actual minutes left
// may not be a round number): 4318 → "3 days", 15 → "15 min".
export function formatApproxDuration(minutes) {
  const m = Math.max(0, Math.round(minutes || 0));
  if (m < 60) return `${m} min`;
  if (m < 1440) { const h = Math.round(m / 60); return `${h} hour${h === 1 ? '' : 's'}`; }
  if (m < 10080) { const d = Math.round(m / 1440); return `${d} day${d === 1 ? '' : 's'}`; }
  const w = Math.round(m / 10080);
  return `${w} week${w === 1 ? '' : 's'}`;
}

// Human-readable lead time: 20160 → "2 weeks", 60 → "1 hour", 0 → "at start".
export function formatLeadTime(minutes) {
  const m = Math.round(minutes || 0);
  if (m <= 0) return 'at start';
  for (const unit of ['weeks', 'days', 'hours', 'minutes']) {
    const size = LEAD_TIME_UNITS[unit];
    if (m % size === 0) {
      const n = m / size;
      return `${n} ${unit.slice(0, -1)}${n === 1 ? '' : 's'}`;
    }
  }
  return `${m} minutes`;
}
