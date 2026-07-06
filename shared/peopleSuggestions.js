// Builds a lightweight "contacts from your own history" list by scanning the
// people already attached to past events, and enriches freshly-parsed attendees
// with the phone/email you entered for that same name before. No contacts store,
// no address-book access — it only reads events you already have (which are
// end-to-end encrypted), so it stays zero-knowledge.
//
// This is the cross-platform layer: it works everywhere, including iOS Safari
// where the native Contact Picker API doesn't exist.

function normalizeName(s) {
  return String(s ?? '').trim().replace(/\s+/g, ' ');
}

function sortStamp(e) {
  if (typeof e.updatedAt === 'number') return e.updatedAt;
  if (typeof e.updatedAt === 'string') return Date.parse(e.updatedAt) || 0;
  return 0;
}

/**
 * Collapse the people across all past events into one suggestion per distinct
 * name (case-insensitive), keeping the most recently-seen display casing and
 * the best-known phone/email (most recent non-empty value wins).
 *
 * @param {Array} events - decrypted events, each optionally carrying people[]
 * @returns {{ displayName, phone, email }[]}
 */
export function buildPeopleSuggestions(events = []) {
  const usable = events
    .filter(e => e && !e.deleted && !e._isGhost && Array.isArray(e.people) && e.people.length)
    .sort((a, b) => sortStamp(b) - sortStamp(a)); // most recent first

  const byKey = new Map();
  for (const event of usable) {
    for (const p of event.people) {
      const displayName = normalizeName(p?.displayName);
      if (!displayName) continue;
      const key = displayName.toLowerCase();
      const entry = byKey.get(key) ?? { displayName, phone: '', email: '' };
      // Most recent event is seen first, so only fill a field still missing.
      if (!entry.phone && p.phone) entry.phone = String(p.phone).trim();
      if (!entry.email && p.email) entry.email = String(p.email).trim();
      byKey.set(key, entry);
    }
  }

  return [...byKey.values()];
}

/**
 * Fill in phone/email on parsed attendees from matching history suggestions.
 * Only fields the attendee is missing are filled; an explicit value on the
 * attendee always wins. Returns a new array; inputs are not mutated.
 *
 * @param {Array} people - parsed attendees ([{ displayName, source }])
 * @param {Array} suggestions - output of buildPeopleSuggestions
 */
/**
 * Merge a picked (or manually-shaped) contact into a people[] list: update the
 * matching name in place (contact fields win), else append. Returns a new array.
 * Shared by the web and mobile contact pickers.
 */
export function mergeContactIntoPeople(people = [], contact) {
  if (!contact) return people;
  const list = [...people];
  const idx = list.findIndex(p => p.displayName?.toLowerCase() === contact.displayName.toLowerCase());
  if (idx >= 0) list[idx] = { ...list[idx], ...contact };
  else list.push(contact);
  return list;
}

export function enrichPeople(people = [], suggestions = []) {
  if (!people.length || !suggestions.length) return people;
  const byKey = new Map(suggestions.map(s => [s.displayName.toLowerCase(), s]));

  return people.map(p => {
    const match = byKey.get(normalizeName(p?.displayName).toLowerCase());
    if (!match) return p;
    const phone = p.phone || match.phone || undefined;
    const email = p.email || match.email || undefined;
    if (!phone && !email) return p;
    return {
      ...p,
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
      // Flag only when the contact info came purely from history (the attendee
      // had none of its own), so the UI can show it was auto-linked.
      ...(!p.phone && !p.email ? { linkedFromHistory: true } : {}),
    };
  });
}
