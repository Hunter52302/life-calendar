import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTimeZoneSlot, shortTimeZoneName } from './timeZones.js';

test('secondary zones are shifted from the primary calendar clock', () => {
  assert.equal(
    formatTimeZoneSlot(0, 1, 'America/Los_Angeles', 'America/Chicago', '2026-07-20', true),
    '22:00'
  );
  assert.equal(
    formatTimeZoneSlot(12, 1, 'Europe/London', 'America/Chicago', '2026-01-12', false),
    '6 PM'
  );
});

test('zone comparison follows daylight-saving changes for the displayed week', () => {
  assert.equal(
    formatTimeZoneSlot(12, 1, 'America/Phoenix', 'America/Chicago', '2026-01-12', true),
    '11:00'
  );
  assert.equal(
    formatTimeZoneSlot(12, 1, 'America/Phoenix', 'America/Chicago', '2026-07-20', true),
    '10:00'
  );
});

test('zone headers have a compact label', () => {
  assert.ok(shortTimeZoneName('America/Chicago', '2026-07-20').length > 0);
});
