import test from 'node:test';
import assert from 'node:assert/strict';
import { countImportedCalendarEvents, getRealityWeekEvents } from './realityEvents.js';

const WEEK = '2026-07-12';

test('excludes linked calendars marked Skip SYL', () => {
  const linkedCalendars = [
    { id: 'included', excludeFromReality: false },
    { id: 'excluded', excludeFromReality: true },
  ];
  const events = [
    { id: 'manual', calendar: 'plan', week_start: WEEK },
    { id: 'included', calendar: 'plan', week_start: WEEK, source_calendar_id: 'included' },
    { id: 'excluded', calendar: 'plan', week_start: WEEK, source_calendar_id: 'excluded' },
  ];

  assert.deepEqual(
    getRealityWeekEvents(events, linkedCalendars, WEEK, 'plan').map(event => event.id),
    ['manual', 'included']
  );
});

test('filters by week and calendar while excluding derived live copies', () => {
  const linkedCalendars = [{ id: 'excluded', excludeFromReality: true }];
  const events = [
    { id: 'plan', calendar: 'plan', week_start: WEEK },
    { id: 'actual', calendar: 'actual', week_start: WEEK },
    { id: 'derived', calendar: 'actual', week_start: WEEK, source_calendar_id: 'excluded' },
    { id: 'other-week', calendar: 'actual', week_start: '2026-07-05' },
  ];

  assert.deepEqual(
    getRealityWeekEvents(events, linkedCalendars, WEEK, 'actual').map(event => event.id),
    ['actual']
  );
});

test('linked calendar count excludes auto-completed live copies', () => {
  const events = [
    { source_calendar_id: 'calendar' },
    { source_calendar_id: 'calendar', source: 'auto-completed' },
    { source_calendar_id: 'other' },
  ];

  assert.equal(countImportedCalendarEvents(events, 'calendar'), 1);
});
