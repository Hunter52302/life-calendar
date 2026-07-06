// Thin wrapper over the web Contact Picker API (navigator.contacts.select).
// It is a one-shot, user-gestured picker: the user chooses a single contact and
// which fields to share, and the page receives ONLY that — never the address
// book. Available on Android Chrome/Edge only; undefined on iOS Safari and
// desktop, where callers hide the button via contactPickerSupported().
//
// The picked fields are merged into an event's (end-to-end encrypted) people
// entry — nothing is stored anywhere else, keeping the zero-knowledge model.

export function contactPickerSupported() {
  return typeof navigator !== 'undefined'
    && 'contacts' in navigator
    && typeof navigator.contacts?.select === 'function';
}

/** Normalize a raw ContactInfo ({ name:[], tel:[], email:[] }) to our people shape. */
export function normalizeContact(raw) {
  if (!raw) return null;
  const first = (arr) => (Array.isArray(arr) ? arr.find(Boolean) : arr) || '';
  const displayName = first(raw.name).trim();
  const phone = first(raw.tel).trim();
  const email = first(raw.email).trim();
  if (!displayName && !phone && !email) return null;
  return {
    displayName: displayName || phone || email,
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    source: 'picker',
  };
}

/**
 * Open the native contact picker and return one normalized contact, or null if
 * unsupported or cancelled. Only requests properties the platform supports.
 */
export async function pickContact() {
  if (!contactPickerSupported()) return null;
  const wanted = ['name', 'tel', 'email'];
  let props = wanted;
  try {
    if (typeof navigator.contacts.getProperties === 'function') {
      const available = await navigator.contacts.getProperties();
      props = wanted.filter(p => available.includes(p));
    }
  } catch { /* fall back to requesting all */ }
  const selected = await navigator.contacts.select(props.length ? props : ['name'], { multiple: false });
  return Array.isArray(selected) && selected[0] ? normalizeContact(selected[0]) : null;
}
