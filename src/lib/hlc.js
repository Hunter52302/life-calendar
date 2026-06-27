/**
 * Hybrid Logical Clock (HLC) — Kulkarni et al.
 *
 * Conflict resolution needs a way to order writes that came from different
 * devices. Wall-clock time alone is unreliable: device clocks drift, and two
 * edits can land in the same millisecond. An HLC combines physical time with a
 * logical counter so that:
 *   - timestamps stay close to real wall-clock time (human-meaningful), and
 *   - they are strictly monotonic on each device, and
 *   - they give a *total order* across devices (ties broken by node id),
 * even when clocks are skewed.
 *
 * A timestamp is `{ millis, counter, node }`, encoded as a sortable string:
 *   "000001700000000000:00000:ab12cd34"
 *    └ millis (15)      └counter(5) └ node id
 *
 * This module is pure and has no I/O — persistence (saving the clock state
 * across reloads) is the caller's job. That keeps it trivially unit-testable
 * and identical on web, mobile, and server.
 */

const MILLIS_WIDTH = 15;
const COUNTER_WIDTH = 5;

/** Generate a short, stable-per-install node id. */
export function randomNodeId() {
  const g = globalThis.crypto;
  if (g?.getRandomValues) {
    const buf = new Uint8Array(4);
    g.getRandomValues(buf);
    return [...buf].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
}

/** Encode an HLC timestamp object to its sortable string form. */
export function pack({ millis, counter, node }) {
  return (
    String(millis).padStart(MILLIS_WIDTH, '0') + ':' +
    String(counter).padStart(COUNTER_WIDTH, '0') + ':' +
    node
  );
}

/** Decode a packed HLC string back to `{ millis, counter, node }`. */
export function unpack(ts) {
  const [millis, counter, node] = ts.split(':');
  return { millis: Number(millis), counter: Number(counter), node: node ?? '' };
}

/**
 * Total order over packed HLC strings. Returns <0, 0, or >0.
 * Parses fields rather than comparing strings directly, so it stays correct
 * regardless of padding. A missing/empty timestamp sorts before everything.
 */
export function compare(a, b) {
  if (a === b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const x = unpack(a);
  const y = unpack(b);
  return (
    x.millis - y.millis ||
    x.counter - y.counter ||
    (x.node < y.node ? -1 : x.node > y.node ? 1 : 0)
  );
}

/**
 * Create a clock instance.
 *
 * @param {object} opts
 * @param {string}   opts.node    this device's node id
 * @param {() => number} [opts.now] physical-time source (ms); injectable for tests
 * @param {{millis:number, counter:number}} [opts.state] restored clock state
 * @returns a clock with `tick()`, `update(remoteTs)`, and `state`
 */
export function createClock({ node, now = Date.now, state } = {}) {
  const id = node ?? randomNodeId();
  let last = { millis: state?.millis ?? 0, counter: state?.counter ?? 0 };

  /** Local event: advance the clock and return a fresh timestamp. */
  function tick() {
    const wall = now();
    if (wall > last.millis) last = { millis: wall, counter: 0 };
    else last = { millis: last.millis, counter: last.counter + 1 };
    return pack({ ...last, node: id });
  }

  /**
   * Receiving a remote timestamp: merge it in so our clock never goes
   * backwards relative to anything we've seen, then return a fresh local
   * timestamp that dominates both.
   */
  function update(remoteTs) {
    const wall = now();
    const remote = unpack(remoteTs);
    const millis = Math.max(last.millis, remote.millis, wall);
    let counter;
    if (millis === last.millis && millis === remote.millis) {
      counter = Math.max(last.counter, remote.counter) + 1;
    } else if (millis === last.millis) {
      counter = last.counter + 1;
    } else if (millis === remote.millis) {
      counter = remote.counter + 1;
    } else {
      counter = 0;
    }
    last = { millis, counter };
    return pack({ ...last, node: id });
  }

  return {
    node: id,
    tick,
    update,
    get state() { return { ...last }; },
  };
}
