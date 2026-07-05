import assert from 'node:assert/strict';
import test from 'node:test';
import { trafficPaddingFactor, applyTrafficPadding } from './trafficPadding.js';

test('weekends get no padding even at rush hour', () => {
  assert.equal(trafficPaddingFactor(0, 8), 0);  // Sunday 8am
  assert.equal(trafficPaddingFactor(6, 17), 0); // Saturday 5pm
});

test('weekday rush hours get heavy padding', () => {
  assert.equal(trafficPaddingFactor(1, 8), 0.35);  // Mon 8am
  assert.equal(trafficPaddingFactor(3, 17), 0.35); // Wed 5pm
});

test('weekday midday and shoulders get light padding', () => {
  assert.equal(trafficPaddingFactor(2, 12), 0.10); // Tue noon
  assert.equal(trafficPaddingFactor(4, 6), 0.10);  // Thu 6am shoulder
  assert.equal(trafficPaddingFactor(5, 20), 0.10); // Fri 8pm shoulder
});

test('weekday nights get no padding', () => {
  assert.equal(trafficPaddingFactor(1, 3), 0);  // Mon 3am
  assert.equal(trafficPaddingFactor(1, 23), 0); // Mon 11pm
});

test('applyTrafficPadding rounds and reports percent', () => {
  assert.deepEqual(applyTrafficPadding(20, 1, 8), { minutes: 27, factor: 0.35, pct: 35 });
  assert.deepEqual(applyTrafficPadding(20, 1, 12), { minutes: 22, factor: 0.10, pct: 10 });
  assert.deepEqual(applyTrafficPadding(20, 0, 8), { minutes: 20, factor: 0, pct: 0 });
});
