/**
 * LWW (Last-Writer-Wins) record-set merge — the heart of conflict resolution.
 *
 * Each record is a plain object keyed by `id` and carries two pieces of sync
 * metadata:
 *   - `updatedAt`: an HLC timestamp string (see hlc.js) stamped on every write.
 *   - `deleted`:   a tombstone flag. Deletes don't drop the record — they keep
 *                  it with `deleted: true` and a fresh `updatedAt`, so the
 *                  deletion can propagate and win/lose against concurrent edits
 *                  by timestamp rather than by whichever request lands last.
 *
 * `mergeRecordSets` is a pure function. Given the same two inputs it always
 * produces the same result, and it is:
 *   - commutative:  merge(a, b) and merge(b, a) yield the same set
 *   - idempotent:   merge(merge(a, b), b) === merge(a, b)
 *   - associative-friendly enough for our use (pairwise peer/server merges)
 * which is exactly what lets devices reconcile in any order without a central
 * authority and without losing data.
 *
 * This is intentionally *record-level* LWW (the whole record is the unit of
 * conflict). That fits calendar records, which are edited as a unit through a
 * form. Field-level merge (two devices editing different fields of the same
 * event) is a future refinement and is noted in the plan.
 */

import { compare, unpack } from './hlc.js';

const UPDATED_AT = 'updatedAt';

/**
 * How long tombstones are retained before they're garbage-collected.
 *
 * A tombstone has to outlive the longest plausible offline window: if a device
 * that still holds the live record syncs after the tombstone is gone, it would
 * resurrect the record. 30 days is the agreed ceiling on both client and server
 * (mirror the value in server/db/queries.js `purgeExpiredTombstones`).
 */
export const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Pick the winning record between two versions of the same id. */
function pickWinner(a, b) {
  // Greater HLC wins. Exact ties (same timestamp incl. node) are identical
  // writes, so either is fine — return `a` for determinism.
  return compare(a?.[UPDATED_AT] ?? '', b?.[UPDATED_AT] ?? '') >= 0 ? a : b;
}

/**
 * Merge two sets of records into one reconciled set (tombstones included).
 *
 * @param {object[]} local  records held on this device
 * @param {object[]} remote records received from a peer/server
 * @returns {object[]} merged records, including tombstones
 */
export function mergeRecordSets(local = [], remote = []) {
  const byId = new Map();
  for (const rec of local) byId.set(rec.id, rec);
  for (const rec of remote) {
    const existing = byId.get(rec.id);
    byId.set(rec.id, existing ? pickWinner(existing, rec) : rec);
  }
  return [...byId.values()];
}

/** Strip tombstones — the live records to actually render/use. */
export function visible(records = []) {
  return records.filter(r => !r.deleted);
}

/**
 * Drop tombstones older than `cutoffMillis` (a wall-clock ms threshold, compared
 * against the tombstone's HLC physical-time component). Bounds the otherwise
 * unbounded growth of the record set in state/localStorage, and — crucially —
 * stops a device from re-pushing tombstones the server has already purged.
 * Live records and recent tombstones (un-synced offline deletes) are untouched.
 *
 * @param {object[]} records      records incl. tombstones
 * @param {number}   cutoffMillis tombstones with HLC millis below this are dropped
 * @returns {object[]} records with expired tombstones removed
 */
export function pruneExpiredTombstones(records = [], cutoffMillis = 0) {
  return records.filter(r => {
    if (!r.deleted) return true;
    const { millis } = unpack(r[UPDATED_AT] ?? '');
    return !(millis < cutoffMillis); // keep NaN/recent tombstones, drop old ones
  });
}

/**
 * Records this device should push upstream: those where our version strictly
 * wins over (or is absent from) the remote set. Lets a device propagate edits
 * it made while the remote was unreachable, without re-sending everything.
 *
 * @param {object[]} local  our records (post-merge)
 * @param {object[]} remote what the remote currently has
 * @returns {object[]} records to send
 */
export function recordsToPush(local = [], remote = []) {
  const remoteById = new Map(remote.map(r => [r.id, r]));
  return local.filter(rec => {
    const theirs = remoteById.get(rec.id);
    if (!theirs) return true;
    return compare(rec[UPDATED_AT] ?? '', theirs[UPDATED_AT] ?? '') > 0;
  });
}
