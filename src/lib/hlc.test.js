import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock, compare, pack, unpack, randomNodeId } from './hlc.js';

test('tick is strictly monotonic even within the same millisecond', () => {
  const clock = createClock({ node: 'aaaa', now: () => 1000 }); // frozen wall clock
  const a = clock.tick();
  const b = clock.tick();
  const c = clock.tick();
  assert.ok(compare(a, b) < 0);
  assert.ok(compare(b, c) < 0);
  // counter advanced because wall time didn't move
  assert.equal(unpack(a).counter, 0);
  assert.equal(unpack(b).counter, 1);
  assert.equal(unpack(c).counter, 2);
});

test('tick resets counter when wall clock advances', () => {
  let t = 1000;
  const clock = createClock({ node: 'aaaa', now: () => t });
  const a = clock.tick();
  t = 2000;
  const b = clock.tick();
  assert.equal(unpack(a).counter, 0);
  assert.equal(unpack(b).counter, 0);
  assert.equal(unpack(b).millis, 2000);
  assert.ok(compare(a, b) < 0);
});

test('update dominates a remote timestamp from the future (clock skew)', () => {
  // Our wall clock is behind; a peer sends a timestamp from "the future".
  const clock = createClock({ node: 'aaaa', now: () => 1000 });
  const remote = pack({ millis: 5000, counter: 7, node: 'bbbb' });
  const merged = clock.update(remote);
  // We must not go backwards: result strictly dominates the remote ts.
  assert.ok(compare(merged, remote) > 0);
  assert.equal(unpack(merged).millis, 5000);
  assert.equal(unpack(merged).counter, 8);
});

test('compare gives a total order with node-id tiebreak', () => {
  const x = pack({ millis: 100, counter: 0, node: 'aaaa' });
  const y = pack({ millis: 100, counter: 0, node: 'bbbb' });
  assert.ok(compare(x, y) < 0);            // same time → node breaks the tie
  assert.equal(compare(x, x), 0);
  assert.ok(compare('', x) < 0);           // missing sorts first
  assert.ok(compare(x, '') > 0);
});

test('packed timestamps survive a round-trip', () => {
  const ts = pack({ millis: 1700000000000, counter: 42, node: 'deadbeef' });
  assert.deepEqual(unpack(ts), { millis: 1700000000000, counter: 42, node: 'deadbeef' });
});

test('restoring clock state preserves monotonicity', () => {
  const clock1 = createClock({ node: 'aaaa', now: () => 1000 });
  clock1.tick();
  const saved = clock1.state;
  // Simulate reload: new clock from saved state, same frozen wall time.
  const clock2 = createClock({ node: 'aaaa', now: () => 1000, state: saved });
  const next = clock2.tick();
  assert.ok(compare(pack({ ...saved, node: 'aaaa' }), next) < 0);
});

test('randomNodeId returns an 8-char hex string', () => {
  const id = randomNodeId();
  assert.match(id, /^[0-9a-f]{8}$/);
});
