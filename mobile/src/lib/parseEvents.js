// The local ("Tier 1") parser lives in the shared workspace so the web and
// mobile apps stay byte-for-byte identical. See shared/parseEvents.js.
export { parseEvents } from '@pls-calendar/shared/parseEvents';
