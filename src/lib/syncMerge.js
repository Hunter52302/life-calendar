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

import { compare } from './hlc.js';

const UPDATED_AT = 'updatedAt';

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
