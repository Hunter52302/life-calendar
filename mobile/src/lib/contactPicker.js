// Native contact picker for mobile, via expo-contacts.
//
// Contacts.presentContactPickerAsync() shows the OS contact picker and returns
// ONLY the single contact the user taps. Because the OS mediates the selection
// (iOS CNContactPickerViewController), it does NOT require full-contacts read
// permission — the app never sees the address book, just the one pick. The
// picked fields are merged into the event's end-to-end-encrypted people entry,
// so nothing is stored elsewhere and the zero-knowledge model is preserved.
import * as Contacts from 'expo-contacts';

export function contactPickerSupported() {
  return typeof Contacts?.presentContactPickerAsync === 'function';
}

/** Normalize an expo-contacts Contact to our people shape. */
export function normalizeContact(c) {
  if (!c) return null;
  const displayName = (c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || '').trim();
  const phone = c.phoneNumbers?.find(p => p?.number)?.number?.trim() || '';
  const email = c.emails?.find(e => e?.email)?.email?.trim() || '';
  if (!displayName && !phone && !email) return null;
  return {
    displayName: displayName || phone || email,
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    source: 'picker',
  };
}

/** Open the native picker and return one normalized contact, or null if cancelled. */
export async function pickContact() {
  if (!contactPickerSupported()) return null;
  const contact = await Contacts.presentContactPickerAsync();
  return normalizeContact(contact);
}
