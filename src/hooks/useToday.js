import { useSyncExternalStore } from 'react';
import { toDateStr } from '../lib/utils';

/**
 * Today's local date as a YYYY-MM-DD string, re-rendering subscribers when the
 * date rolls over.
 *
 * Every caller that derived "today" during render (`todayStr()` /
 * `new Date().getDay()`) silently went stale in a session left open past
 * midnight: the calendar kept highlighting yesterday, and — worse — the habit
 * tracker logged completions against the previous day's date. This hook is the
 * one place that owns the rollover, so a component only has to call it to stay
 * correct.
 *
 * All subscribers share a single module-level timer rather than each mounting
 * their own interval: the calendar renders many date-aware components at once,
 * and this way a rollover is one wakeup and one consistent value for all of
 * them (no chance of two components disagreeing about the date mid-render).
 */

let current = toDateStr(new Date());
const subscribers = new Set();
let timer = null;

/** ms until the next local midnight, recomputed each time so DST shifts and
 *  manual clock changes are absorbed rather than accumulating drift. */
function msUntilMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

function check() {
  const next = toDateStr(new Date());
  if (next !== current) {
    current = next;
    subscribers.forEach(cb => cb());
  }
  schedule();
}

function schedule() {
  clearTimeout(timer);
  // Fire just after the boundary, and never busy-loop if we wake a hair early —
  // `check` reschedules when the date hasn't actually turned over yet.
  timer = setTimeout(check, Math.max(1000, msUntilMidnight() + 250));
}

// A backgrounded tab has its timers throttled, and a suspended device stops
// them entirely — either way the wakeup can land long after midnight. Re-check
// whenever the page becomes visible again so the date is right by the time
// anyone can see it.
function onVisible() {
  if (document.visibilityState === 'visible') check();
}

function subscribe(cb) {
  subscribers.add(cb);
  if (subscribers.size === 1) {
    schedule();
    document.addEventListener('visibilitychange', onVisible);
  }
  return () => {
    subscribers.delete(cb);
    if (subscribers.size === 0) {
      clearTimeout(timer);
      timer = null;
      document.removeEventListener('visibilitychange', onVisible);
    }
  };
}

// Returns the cached string (not a fresh one) so React sees a stable snapshot
// and doesn't loop re-rendering.
function getSnapshot() {
  return current;
}

export function useToday() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
