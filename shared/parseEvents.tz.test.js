import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';

// Pin an extreme eastern timezone (UTC+14) before anything creates a Date.
// addDayStr used to round-trip through UTC (toISOString), which lands on the
// wrong calendar day here — noon local is the previous day in UTC. The parser
// must still roll the end date forward correctly. node --test runs each test
// file in its own process, so this TZ only applies here.
process.env.TZ = 'Pacific/Kiritimati';

const { parseEvents } = await import('./parseEvents.js');

const REF = new Date('2026-06-01T12:00:00');

test('midnight-crossing shift rolls the end date forward at UTC+14', () => {
  const e = parseEvents('Thursday June 18: Night 2300 – 0700', REF)[0];
  assert.equal(e.startDate, '2026-06-18');
  assert.equal(e.endDate, '2026-06-19');
});

test('a duration past midnight rolls the end date at UTC+14', () => {
  const e = parseEvents('shift June 20 at 11pm for 3 hours', REF)[0];
  assert.equal(e.startDate, '2026-06-20');
  assert.equal(e.endDate, '2026-06-21');
  assert.equal(e.endTime, '02:00');
});

test('a multi-day all-day range keeps correct end date at UTC+14', () => {
  const e = parseEvents('vacation June 22 to June 26', REF)[0];
  assert.equal(e.allDay, true);
  assert.equal(e.startDate, '2026-06-22');
  assert.equal(e.endDate, '2026-06-26');
});
