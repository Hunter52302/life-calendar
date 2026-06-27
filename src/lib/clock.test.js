import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare, unpack } from './hlc.js';

// clock.js reads localStorage at import time, so install a shim first, then
// import the module dynamically.
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};

const { tick, observe, stamp, nodeId } = await import('./clock.js');

test('node id is generated and persisted', () => {
  assert.match(nodeId, /^[0-9a-f]{8}$/);
  assert.equal(store.get('lc-hlc-node'), nodeId);
});

test('successive ticks are strictly increasing and persist clock state', () => {
  const a = tick();
  const b = tick();
  assert.ok(compare(a, b) < 0);
  assert.ok(store.has('lc-hlc-state')); // state was written
  assert.equal(unpack(a).node, nodeId);
});

test('stamp attaches a fresh updatedAt without mutating the input', () => {
  const input = { id: 'e1', label: 'x' };
  const out = stamp(input);
  assert.equal(input.updatedAt, undefined);     // original untouched
  assert.equal(out.label, 'x');
  assert.ok(out.updatedAt);
});

test('observe keeps our clock ahead of a far-future remote timestamp', () => {
  const future = '999999999999999:00000:ffffffff';
  observe(future);
  const next = tick();
  assert.ok(compare(next, future) > 0); // we now dominate the remote ts
});

test('observe ignores empty/falsy timestamps', () => {
  const before = tick();
  observe(undefined);
  observe('');
  const after = tick();
  assert.ok(compare(before, after) < 0); // still advances normally, no throw
});
