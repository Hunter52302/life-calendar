import assert from 'node:assert/strict';
import test from 'node:test';
import { suggestOriginFromEvents } from './travelOrigin.js';

const day = { week_start: '2026-07-05', day_of_week: 0 };
const home = '1 Home St, Springfield';

function evt(overrides) {
  return {
    id: overrides.id ?? 'e',
    week_start: day.week_start,
    day_of_week: day.day_of_week,
    slot_start: 16, // 08:00 at 0.5h precision
    slot_duration: 2, // 1h → ends 09:00
    precision: 0.5,
    location: 'Somewhere',
    ...overrides,
  };
}

test('falls back to home when no candidate events', () => {
  const origin = suggestOriginFromEvents([], { ...day, startMinutes: 600 }, home);
  assert.equal(origin, home);
});

test('uses the most recent preceding event location', () => {
  const events = [
    evt({ id: 'a', slot_start: 12, slot_duration: 2, location: 'Gym' }),      // ends 07:00
    evt({ id: 'b', slot_start: 16, slot_duration: 2, location: 'Office' }),   // ends 09:00
  ];
  // Trip starts at 10:00 (600 min): both precede, pick the later-ending one.
  const origin = suggestOriginFromEvents(events, { ...day, startMinutes: 600 }, home);
  assert.equal(origin, 'Office');
});

test('ignores events that end after the trip start', () => {
  const events = [evt({ id: 'a', slot_start: 20, slot_duration: 2, location: 'Later' })]; // ends 11:00
  const origin = suggestOriginFromEvents(events, { ...day, startMinutes: 600 }, home); // 10:00
  assert.equal(origin, home);
});

test('skips events without a location, all-day events, and the excluded id', () => {
  const events = [
    evt({ id: 'a', slot_start: 12, slot_duration: 2, location: '' }),
    evt({ id: 'b', slot_start: 12, slot_duration: 2, is_all_day: true, location: 'AllDay' }),
    evt({ id: 'self', slot_start: 14, slot_duration: 2, location: 'Self' }),
  ];
  const origin = suggestOriginFromEvents(events, { ...day, startMinutes: 600 }, home, { excludeId: 'self' });
  assert.equal(origin, home);
});

test('ignores events on a different day', () => {
  const events = [evt({ id: 'a', day_of_week: 1, location: 'OtherDay' })];
  const origin = suggestOriginFromEvents(events, { ...day, startMinutes: 600 }, home);
  assert.equal(origin, home);
});

test('formats a structured home address object', () => {
  const origin = suggestOriginFromEvents([], { ...day, startMinutes: 600 }, {
    line1: '5 Oak Ave', city: 'Portland', region: 'OR', postalCode: '97201',
  });
  assert.equal(origin, '5 Oak Ave, Portland, OR 97201');
});
