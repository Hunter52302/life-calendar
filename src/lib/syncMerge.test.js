import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock, pack } from './hlc.js';
import { mergeRecordSets, visible, recordsToPush, pruneExpiredTombstones } from './syncMerge.js';

// Helper: deterministic sort for set comparison (order-independent).
const sortById = recs => [...recs].sort((a, b) => a.id.localeCompare(b.id));
const sameSet = (a, b) => assert.deepEqual(sortById(a), sortById(b));

test('newer write wins regardless of side', () => {
  const older = { id: 'e1', label: 'old', updatedAt: '000000000001000:00000:aaaa' };
  const newer = { id: 'e1', label: 'new', updatedAt: '000000000002000:00000:bbbb' };
  assert.equal(mergeRecordSets([older], [newer])[0].label, 'new');
  assert.equal(mergeRecordSets([newer], [older])[0].label, 'new');
});

test('merge is commutative', () => {
  const a = [
    { id: 'e1', label: 'A1', updatedAt: '000000000003000:00000:aaaa' },
    { id: 'e2', label: 'A2', updatedAt: '000000000001000:00000:aaaa' },
  ];
  const b = [
    { id: 'e1', label: 'B1', updatedAt: '000000000002000:00000:bbbb' },
    { id: 'e3', label: 'B3', updatedAt: '000000000001000:00000:bbbb' },
  ];
  sameSet(mergeRecordSets(a, b), mergeRecordSets(b, a));
});

test('merge is idempotent', () => {
  const a = [{ id: 'e1', label: 'A', updatedAt: '000000000002000:00000:aaaa' }];
  const b = [{ id: 'e1', label: 'B', updatedAt: '000000000001000:00000:bbbb' }];
  const once = mergeRecordSets(a, b);
  const twice = mergeRecordSets(once, b);
  sameSet(once, twice);
});

test('a delete (tombstone) that is newer wins over a concurrent edit', () => {
  // Device A edits the event; Device B deletes it slightly later.
  const edit = { id: 'e1', label: 'edited', updatedAt: '000000000001000:00000:aaaa' };
  const tombstone = { id: 'e1', deleted: true, updatedAt: '000000000002000:00000:bbbb' };
  const merged = mergeRecordSets([edit], [tombstone]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].deleted, true);
  assert.equal(visible(merged).length, 0);
});

test('an edit that is newer than a delete resurrects the record', () => {
  const tombstone = { id: 'e1', deleted: true, updatedAt: '000000000001000:00000:bbbb' };
  const edit = { id: 'e1', label: 'back', deleted: false, updatedAt: '000000000002000:00000:aaaa' };
  const merged = mergeRecordSets([tombstone], [edit]);
  assert.equal(visible(merged).length, 1);
  assert.equal(visible(merged)[0].label, 'back');
});

test('records present on only one side are kept', () => {
  const local = [{ id: 'e1', updatedAt: '000000000001000:00000:aaaa' }];
  const remote = [{ id: 'e2', updatedAt: '000000000001000:00000:bbbb' }];
  sameSet(mergeRecordSets(local, remote).map(r => ({ id: r.id })), [{ id: 'e1' }, { id: 'e2' }]);
});

test('recordsToPush surfaces only locally-newer or remote-missing records', () => {
  const local = [
    { id: 'e1', updatedAt: '000000000003000:00000:aaaa' }, // newer than remote → push
    { id: 'e2', updatedAt: '000000000001000:00000:aaaa' }, // older than remote → skip
    { id: 'e3', updatedAt: '000000000001000:00000:aaaa' }, // remote missing      → push
  ];
  const remote = [
    { id: 'e1', updatedAt: '000000000002000:00000:bbbb' },
    { id: 'e2', updatedAt: '000000000002000:00000:bbbb' },
  ];
  const ids = recordsToPush(local, remote).map(r => r.id).sort();
  assert.deepEqual(ids, ['e1', 'e3']);
});

test('end-to-end: two devices reconcile to the same state in any order', () => {
  // Device A and Device B start from a shared event, edit offline, then sync.
  const clockA = createClock({ node: 'aaaa', now: () => 1000 });
  const clockB = createClock({ node: 'bbbb', now: () => 1000 });

  const base = { id: 'e1', label: 'meeting', updatedAt: clockA.tick() };
  const aEdit = { ...base, label: 'A edit', updatedAt: clockA.tick() };       // A edits
  const bEdit = { ...base, label: 'B edit', updatedAt: clockB.update(base.updatedAt) }; // B edits later

  const onA = mergeRecordSets([aEdit], [bEdit]);
  const onB = mergeRecordSets([bEdit], [aEdit]);
  sameSet(onA, onB);                       // convergence
  assert.equal(visible(onA)[0].label, 'B edit'); // B's later write wins deterministically
});

test('pruneExpiredTombstones drops old tombstones but keeps live + recent ones', () => {
  const live    = { id: 'e1', updatedAt: pack({ millis: 1000, counter: 0, node: 'aaaa' }) };
  const oldTomb  = { id: 'e2', deleted: true, updatedAt: pack({ millis: 1000, counter: 0, node: 'aaaa' }) };
  const newTomb  = { id: 'e3', deleted: true, updatedAt: pack({ millis: 9000, counter: 0, node: 'aaaa' }) };
  const cutoff = 5000;
  const kept = pruneExpiredTombstones([live, oldTomb, newTomb], cutoff).map(r => r.id).sort();
  assert.deepEqual(kept, ['e1', 'e3']); // live kept regardless of age; only the old tombstone is GC'd
});

test('pruneExpiredTombstones discards a tombstone with no timestamp', () => {
  const orphan = { id: 'e1', deleted: true }; // never stamped — can't win a merge, so don't carry it
  assert.deepEqual(pruneExpiredTombstones([orphan], 1), []);
});
