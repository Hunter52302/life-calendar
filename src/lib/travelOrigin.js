import { formatAddress } from './utils.js';

/**
 * Best-guess origin ("From") address for a trip that begins at a given moment:
 * the location of the most recent event that ends at or before that moment on
 * the same day, falling back to the saved home address.
 *
 * @param {Array}  events        Events to consider (caller pre-filters by calendar).
 * @param {Object} target        { week_start, day_of_week, startMinutes }
 * @param {*}      homeAddress   String or structured address object (fallback).
 * @param {Object} [opts]        { excludeId } to skip the event being edited.
 * @returns {string} A geocodable address string (may be '' if nothing is known).
 */
export function suggestOriginFromEvents(events, target, homeAddress, opts = {}) {
  const home = formatAddress(homeAddress);
  const { week_start, day_of_week, startMinutes } = target ?? {};
  const { excludeId } = opts;
  try {
    let best = null; // { endMin, location }
    for (const e of events ?? []) {
      if (!e || e.is_all_day) continue;
      if (excludeId && e.id === excludeId) continue;
      if (e.week_start !== week_start || e.day_of_week !== day_of_week) continue;
      const loc = (e.location || '').trim();
      if (!loc) continue;
      const prec = e.precision || 0.5;
      const endMin = (e.slot_start + e.slot_duration) * prec * 60;
      if (endMin > startMinutes) continue;
      if (!best || endMin > best.endMin) best = { endMin, location: loc };
    }
    return best?.location ?? home;
  } catch {
    return home;
  }
}
