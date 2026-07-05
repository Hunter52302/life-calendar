export function getWeekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return toDateStr(d);
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function slotToTime(slot, precision, military = false) {
  const minutes = Math.round(slot * (precision <= 0.5 ? 30 : 60));
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  if (military) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  if (m === 0) return `${displayH} ${period}`;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Flatten an address into a single comma-separated string suitable for
 * geocoding / a maps handoff. Accepts either a plain string or the structured
 * address object used by the profile ({ line1, line2, city, region, ... }).
 */
export function formatAddress(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  const line1 = value.line1 ?? value.primary ?? value.address ?? '';
  const line2 = value.line2 ?? value.secondary ?? '';
  const city = value.city ?? value.locality ?? '';
  const region = value.region ?? value.stateProvince ?? value.state ?? value.province ?? '';
  const postalCode = value.postalCode ?? value.zipCode ?? value.zip ?? '';
  const country = value.country ?? '';
  const cityLine = [city, [region, postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [line1, line2, cityLine, country].map(s => String(s).trim()).filter(Boolean).join(', ');
}

export function hoursToLabel(hours) {
  if (hours === 0) return '0h';
  const sign = hours < 0 ? '-' : '';
  const abs = Math.abs(hours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  if (m === 0) return `${sign}${h}h`;
  if (h === 0) return `${sign}${m}m`;
  return `${sign}${h}h ${m}m`;
}

export function getMonthDays(year, month) {
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push({ dateStr: toDateStr(new Date(year, month, 1 - (firstDayOfMonth - i))), isCurrentMonth: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ dateStr: toDateStr(new Date(year, month, i)), isCurrentMonth: true });
  }
  let pad = 1;
  while (days.length % 7 !== 0) {
    days.push({ dateStr: toDateStr(new Date(year, month + 1, pad++)), isCurrentMonth: false });
  }
  return days;
}

export function getEventsForDate(dateStr, events) {
  const d = new Date(dateStr + 'T00:00:00');
  const ws = getWeekStart(d);
  const dow = d.getDay();
  return events.filter(e => e.week_start === ws && e.day_of_week === dow);
}

export function todayStr() {
  return toDateStr(new Date());
}

/** Returns the 1-based week-of-year number for a given dateStr (Sunday-based weeks). */
export function getWeekNumber(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const elapsed = Math.floor((d - yearStart) / 86400000);
  return Math.ceil((elapsed + yearStart.getDay() + 1) / 7);
}

/** Wall-clock end time of an event (its date + start time + duration). */
export function getEventEndDateTime(event) {
  const dateStr = addDays(event.week_start, event.day_of_week);
  const startHours = event.slot_start * event.precision;
  const durationHours = event.slot_duration * event.precision;
  const d = new Date(dateStr + 'T00:00:00');
  d.setTime(d.getTime() + (startHours + durationHours) * 3600000);
  return d;
}

export function isEventPastDue(event, now = new Date()) {
  return getEventEndDateTime(event) <= now;
}

export function generateRepeatInstances(baseEvent, repeat) {
  const baseDate = new Date(baseEvent.week_start + 'T00:00:00');
  baseDate.setDate(baseDate.getDate() + baseEvent.day_of_week);

  const step = { daily: 1, weekly: 7, biweekly: 14, monthly: 28, yearly: 364 }[repeat];
  const total = { daily: 365, weekly: 52, biweekly: 26, monthly: 12, yearly: 3 }[repeat];

  const { slot_start, slot_duration, precision, calendar, label, category, color, is_all_day, source, series_id } = baseEvent;

  return Array.from({ length: total }, (_, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i * step);
    const ws = getWeekStart(d);
    return {
      label, category, color,
      week_start: ws, day_of_week: d.getDay(),
      slot_start, slot_duration, precision, calendar,
      ...(is_all_day && { is_all_day: true }),
      ...(source && { source }),
      ...(series_id && { series_id }),
    };
  });
}
