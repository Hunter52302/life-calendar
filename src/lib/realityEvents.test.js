import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRealityEvents } from './realityEvents.js';

const importedPlan = {
  id: 'plan-gym',
  label: 'Planet Fitness open',
  category: 'gym',
  week_start: '2026-07-19',
  day_of_week: 1,
  slot_start: 5,
  slot_duration: 20,
  precision: 1,
  source_calendar_id: 'gym-calendar',
};

const skippedCalendar = [{ id: 'gym-calendar', excludeFromReality: true }];

test('Skip SYL removes imported Plan and directly-linked Live events', () => {
  const actual = { ...importedPlan, id: 'live-gym', source_calendar_id: 'gym-calendar' };
  const result = filterRealityEvents([importedPlan], [actual], skippedCalendar);
  assert.deepEqual(result, { planEvents: [], actualEvents: [] });
});
test('Skip SYL follows plan_event_id for legacy Live copies without a source id', () => {
  const actual = {
    ...importedPlan,
    id: 'live-gym',
    source_calendar_id: undefined,
    source: 'auto-completed',
    plan_event_id: importedPlan.id,
  };
  assert.equal(filterRealityEvents([importedPlan], [actual], skippedCalendar).actualEvents.length, 0);
});

test('Skip SYL catches old auto-completed copies that lost all lineage', () => {
  const actual = {
    ...importedPlan,
    id: 'live-gym',
    source_calendar_id: undefined,
    source: 'auto-completed',
    plan_event_id: undefined,
  };
  assert.equal(filterRealityEvents([importedPlan], [actual], skippedCalendar).actualEvents.length, 0);
});

test('Skip SYL never removes a matching manual Live entry', () => {
  const actual = {
    ...importedPlan,
    id: 'manual-gym',
    source_calendar_id: undefined,
    source: 'manual',
    plan_event_id: undefined,
  };
  assert.deepEqual(filterRealityEvents([importedPlan], [actual], skippedCalendar).actualEvents, [actual]);
});

test('server snake_case exclusion flags remain compatible', () => {
  const result = filterRealityEvents([importedPlan], [], [
    { calendar_id: 'gym-calendar', exclude_from_reality: true },
  ]);
  assert.deepEqual(result.planEvents, []);
});
