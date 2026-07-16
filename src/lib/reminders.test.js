import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLeadTime, formatApproxDuration, splitMinutes, LEAD_TIME_PRESETS } from './reminders.js';

test('formatLeadTime renders exact preset values', () => {
  assert.equal(formatLeadTime(5), '5 minutes');
  assert.equal(formatLeadTime(60), '1 hour');
  assert.equal(formatLeadTime(120), '2 hours');
  assert.equal(formatLeadTime(1440), '1 day');
  assert.equal(formatLeadTime(2880), '2 days');
  assert.equal(formatLeadTime(10080), '1 week');
  assert.equal(formatLeadTime(20160), '2 weeks');
});

test('formatLeadTime handles custom / edge values', () => {
  assert.equal(formatLeadTime(300), '5 hours');   // the "5 hours" the presets omit
  assert.equal(formatLeadTime(90), '90 minutes'); // not a whole hour
  assert.equal(formatLeadTime(0), 'at start');
});

test('splitMinutes seeds the custom input with the largest whole unit', () => {
  assert.deepEqual(splitMinutes(300), { value: 5, unit: 'hours' });
  assert.deepEqual(splitMinutes(20160), { value: 2, unit: 'weeks' });
  assert.deepEqual(splitMinutes(1440), { value: 1, unit: 'days' });
  assert.deepEqual(splitMinutes(45), { value: 45, unit: 'minutes' });
});

test('formatApproxDuration rounds a live countdown to one unit', () => {
  assert.equal(formatApproxDuration(15), '15 min');
  assert.equal(formatApproxDuration(120), '2 hours');
  assert.equal(formatApproxDuration(4318), '3 days');
  assert.equal(formatApproxDuration(20160), '2 weeks');
});

test('presets span 5 minutes to 2 weeks and stay sorted', () => {
  assert.equal(LEAD_TIME_PRESETS[0].minutes, 5);
  assert.equal(LEAD_TIME_PRESETS.at(-1).minutes, 20160);
  const mins = LEAD_TIME_PRESETS.map((p) => p.minutes);
  assert.deepEqual(mins, [...mins].sort((a, b) => a - b));
});
