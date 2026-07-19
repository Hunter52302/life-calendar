import test from 'node:test';
import assert from 'node:assert/strict';
import { draftOccurrenceCount, draftsToEvents } from './parsedEventDrafts.js';

const draft = overrides => ({
  id: 1,
  enabled: true,
  label: 'Gym hours',
  catId: null,
  startDate: '2026-07-20',
  endDate: '2026-07-20',
  startTime: '05:00',
  endTime: '23:59',
  allDay: false,
  calendar: 'plan',
  ...overrides,
});

test('bulk grouping gives every selected recurring seed one shared series id', () => {
  const events = draftsToEvents([
    draft({ id: 1, recurrence: 'weekly' }),
    draft({ id: 2, startDate: '2026-07-21', endDate: '2026-07-21', allDay: true, startTime: '00:00', recurrence: 'weekly' }),
    draft({ id: 3, enabled: false, recurrence: 'weekly' }),
  ], [], { groupAsSeries: true });

  assert.equal(events.length, 104);
  assert.equal(new Set(events.map(event => event.series_id)).size, 1);
  assert.ok(events.every(event => event.category === null));
  assert.equal(events.filter(event => event.is_all_day).length, 52);
});

test('a time range ending at midnight remains recurrence-compatible', () => {
  const monday = draft({ endDate: '2026-07-21', endTime: '00:00', recurrence: 'weekly' });
  const events = draftsToEvents([monday]);

  assert.equal(draftOccurrenceCount(monday), 52);
  assert.equal(events.length, 52);
  assert.equal(events[0].slot_start, 10);
  assert.equal(events[0].slot_duration, 38);
});
