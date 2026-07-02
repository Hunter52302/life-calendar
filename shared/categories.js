// Canonical list of built-in categories.
// These ids are stored in PocketBase and localStorage â€”
// changing them is a breaking migration.
export const DEFAULT_CATEGORIES = [
  { id: 'sleep',      label: 'Sleep',      color: '#3B82F6' },
  { id: 'work',       label: 'Work',       color: '#F59E0B' },
  { id: 'school',     label: 'School',     color: '#22C55E' },
  { id: 'personal',   label: 'Personal',   color: '#A855F7' },
  { id: 'free-time',  label: 'Free Time',  color: '#6B7280' },
  { id: 'drive-time', label: 'Travel Buffer', color: '#F97316' },
];

// Calendar identifiers â€” used as the `calendar` field on events.
export const CALENDARS = ['plan', 'actual'];

// Auth token storage key â€” used by web localStorage and RN SecureStore.
export const AUTH_TOKEN_KEY = 'lc-auth-token';

