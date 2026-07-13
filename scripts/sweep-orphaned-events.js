/**
 * One-time cleanup: tombstone "orphaned" calendar events.
 *
 * Before the deleteLinkedCalendar fix, deleting a connected/subscribed calendar
 * hard-deleted its events on both client and server. A second device that still
 * held those events would see them as "remote-missing" on the next sync and
 * re-push them — resurrecting them as orphans whose source_calendar_id no longer
 * points at any existing linked calendar. This script finds those orphaned live
 * events and TOMBSTONES them (deleted:true with a dominating HLC), so the removal
 * also propagates to every device on the next sync and is garbage-collected
 * server-side by the normal 30-day tombstone purge.
 *
 * Uses the same PocketBase superuser credentials as the server (POCKETBASE_URL /
 * POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD from the environment / .env).
 * Point POCKETBASE_URL at whichever backend holds the data you want to clean.
 *
 * Usage:
 *   node scripts/sweep-orphaned-events.js <email>            # dry run (report only)
 *   node scripts/sweep-orphaned-events.js <email> --apply    # actually tombstone
 */
import 'dotenv/config';
import { pocketbaseEvents } from '../server/lib/pocketbaseEvents.js';
import { pbLinkedCalendars } from '../server/lib/pocketbaseSupport.js';
import { pocketbaseUsers } from '../server/lib/pocketbaseInternal.js';

// HLC helpers inlined (mirrors src/lib/hlc.js pack/unpack) so this script depends
// only on server/lib — which means it runs as-is inside the deployed `server`
// container (the image copies `server/` but not `src/`).
const SWEEP_NODE = 'sweep000';
const pad = (n, w) => String(n).padStart(w, '0');
function unpackHlc(ts) {
  const [millis, counter] = String(ts || '').split(':');
  return { millis: Number(millis) || 0, counter: Number(counter) || 0 };
}

/** An HLC timestamp guaranteed to dominate `prevTs`, so the tombstone wins the
 *  merge against the live copy any device still holds. */
function dominatingHlc(prevTs) {
  const cur = unpackHlc(prevTs);
  const millis = Math.max(cur.millis, Date.now());
  const counter = millis === cur.millis ? cur.counter + 1 : 0;
  return `${pad(millis, 15)}:${pad(counter, 5)}:${SWEEP_NODE}`;
}

async function main() {
  const email = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!email || email.startsWith('--')) {
    console.error('Usage: node scripts/sweep-orphaned-events.js <email> [--apply]');
    process.exit(1);
  }

  const user = await pocketbaseUsers.getByEmail(email);
  if (!user) {
    console.error(`No user found for "${email}" on ${process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090'}`);
    process.exit(1);
  }
  const userId = user.id;

  const [events, cals] = await Promise.all([
    pocketbaseEvents.getAllForSync(userId),
    pbLinkedCalendars.getAll(userId),
  ]);
  const calIds = new Set(cals.map(c => c.id));

  const orphans = events.filter(
    e => !e.deleted && e.source_calendar_id && !calIds.has(e.source_calendar_id)
  );

  const byCal = {};
  for (const e of orphans) (byCal[e.source_calendar_id] ??= []).push(e);

  const live = events.filter(e => !e.deleted).length;
  console.log(`User ${email} (${userId})`);
  console.log(`  events: ${events.length} total — ${live} live, ${events.length - live} tombstones`);
  console.log(`  linked calendars: ${calIds.size} [${[...calIds].join(', ') || 'none'}]`);
  console.log(`  orphaned live events: ${orphans.length}`);
  for (const [cid, list] of Object.entries(byCal)) {
    console.log(`    · source_calendar_id=${cid}: ${list.length} (e.g. "${list[0].label}")`);
  }

  if (!orphans.length) {
    console.log('\nNothing to sweep. ✅');
    return;
  }

  if (!apply) {
    console.log('\nDRY RUN — no changes made. Re-run with --apply to tombstone these.');
    return;
  }

  console.log('\nTombstoning…');
  let done = 0;
  for (const e of orphans) {
    await pocketbaseEvents.update(userId, e.id, { deleted: true, updatedAt: dominatingHlc(e.updatedAt) });
    if (++done % 50 === 0) console.log(`  …${done}/${orphans.length}`);
  }
  console.log(
    `\nDone — tombstoned ${done} orphaned events. They'll drop off your devices on the ` +
    `next sync and be purged server-side after 30 days.`
  );
}

main().catch(err => { console.error(err); process.exit(1); });
