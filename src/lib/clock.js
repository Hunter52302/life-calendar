/**
 * Process-wide Hybrid Logical Clock for this device (web/desktop).
 *
 * Wraps the pure clock in hlc.js with localStorage persistence so the clock —
 * and this device's stable node id — survive reloads. Every write in the app
 * should stamp its record via `stamp()` (or call `tick()`), and incoming
 * remote timestamps should be folded in via `observe()` so our clock never
 * runs behind anything we've seen.
 */
import { createClock, randomNodeId } from './hlc.js';

const NODE_KEY  = 'lc-hlc-node';
const STATE_KEY = 'lc-hlc-state';

function loadNode() {
  let n = localStorage.getItem(NODE_KEY);
  if (!n) { n = randomNodeId(); localStorage.setItem(NODE_KEY, n); }
  return n;
}

function loadState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY)) ?? undefined; }
  catch { return undefined; }
}

const clock = createClock({ node: loadNode(), state: loadState() });

function persist() {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(clock.state)); } catch { /* quota — ignore */ }
}

/** Advance the clock for a local write and return a fresh HLC timestamp. */
export function tick() {
  const ts = clock.tick();
  persist();
  return ts;
}

/** Fold a remote timestamp into our clock (call when receiving peer/server data). */
export function observe(remoteTs) {
  if (!remoteTs) return;
  clock.update(remoteTs);
  persist();
}

/** Return a copy of `record` stamped with a fresh `updatedAt` HLC timestamp. */
export function stamp(record) {
  return { ...record, updatedAt: tick() };
}

export const nodeId = clock.node;
