import { getWeekStart } from './utils';

/** "HH:MM" → half-hour slot index */
export function timeToSlot(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 2 + (m >= 30 ? 1 : 0);
}

/** Half-hour slot → "HH:MM" */
export function slotToTimeStr(s) {
  const mins = s * 30;
  return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/** Add one calendar day to a YYYY-MM-DD string */
export function addDayStr(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

/** Returns { week_start, day_of_week } for a given YYYY-MM-DD */
export function dateToWeekData(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return { week_start: getWeekStart(d), day_of_week: d.getDay() };
}

/**
 * Split a date+time range into per-day slot segments.
 * Each segment: { date: "YYYY-MM-DD", slotStart, slotDuration }
 */
export function buildSegments(startDate, startTime, endDate, endTime) {
  const startDt = new Date(`${startDate}T${startTime}:00`);
  const endDt   = new Date(`${endDate}T${endTime}:00`);

  if (endDt <= startDt) {
    return [{ date: startDate, slotStart: timeToSlot(startTime), slotDuration: 1 }];
  }

  if (startDate === endDate) {
    const s = timeToSlot(startTime);
    const e = timeToSlot(endTime);
    return [{ date: startDate, slotStart: s, slotDuration: Math.max(1, e - s) }];
  }

  const segments = [];

  const s = timeToSlot(startTime);
  if (48 - s > 0) segments.push({ date: startDate, slotStart: s, slotDuration: 48 - s });

  let cur = addDayStr(startDate);
  while (cur < endDate) {
    segments.push({ date: cur, slotStart: 0, slotDuration: 48 });
    cur = addDayStr(cur);
  }

  const e = timeToSlot(endTime);
  if (e > 0) segments.push({ date: endDate, slotStart: 0, slotDuration: e });

  return segments;
}
