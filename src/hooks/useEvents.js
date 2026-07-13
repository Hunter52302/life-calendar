import { useState, useEffect, useRef, useMemo } from 'react';
import { generateId, getEventEndDateTime, stableId } from '../lib/utils';
import { api } from '../lib/api.js';
import { encryptRecord, decryptRecord, encryptJsonField, decryptJsonField } from '../lib/cryptoRecord.js';
import { useCrypto } from '../context/CryptoContext.jsx';
import { tick, observe } from '../lib/clock.js';
import { mergeRecordSets, visible, recordsToPush, pruneExpiredTombstones, TOMBSTONE_RETENTION_MS } from '../lib/syncMerge.js';

// Trailing window for auto-completing past-due plan events, so turning the
// setting on doesn't retroactively backfill someone's entire plan history.
const AUTO_COMPLETE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const AUTO_COMPLETE_INTERVAL_MS = 5 * 60 * 1000;

const EVENTS_KEY       = 'life-calendar-events';
const CATEGORIES_KEY   = 'life-calendar-categories';
const OVERRIDES_KEY    = 'life-calendar-category-overrides';
const LINKED_KEY       = 'life-calendar-linked';
const DELETED_DEFAULTS_KEY = 'lc-deleted-defaults';
const DISMISSED_AUTO_KEY = 'lc-dismissed-auto-complete';
const MIGRATED_KEY     = 'lc-migrated-to-backend';
const EVENT_TEXT_FIELDS = ['label', 'notes', 'location', 'meeting_url'];
const EVENT_JSON_FIELDS = ['people', 'actions'];

/** Absolute calendar date (ms) an occurrence falls on, from its week + weekday. */
function eventAbsMs(e) {
  const d = new Date(e.week_start + 'T00:00:00');
  d.setDate(d.getDate() + (e.day_of_week ?? 0));
  return d.getTime();
}

/** Colors auto-assigned to imported calendars in order. */
export const IMPORT_COLORS = [
  '#3B82F6', '#22C55E', '#F59E0B', '#EF4444',
  '#A855F7', '#14B8A6', '#F97316', '#EC4899',
];

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

// Persist to the offline cache without ever throwing into React's commit phase.
// A QuotaExceededError here (large synced calendars can push the record set past
// the ~5MB localStorage limit) must not crash the app mid-sync — the data still
// lives in React state; we just skip caching it this write.
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to cache "${key}" to localStorage (continuing):`, err);
  }
}

/**
 * useEvents — manages all calendar data.
 *
 * Startup behaviour:
 *   1. Immediately load from localStorage (zero-latency render).
 *   2. If authenticated, call GET /api/sync and MERGE the server state with
 *      local state by per-record HLC timestamp (see lib/syncMerge.js), rather
 *      than overwriting — so edits made while offline are never clobbered.
 *      Records we hold newer versions of are pushed back up.
 *   3. First-time migration: if the server has no events but localStorage
 *      does, push all local data to the server automatically.
 *
 * Mutation behaviour (optimistic + background sync):
 *   - Every write stamps the record with a fresh HLC `updatedAt` (lib/clock.js)
 *     so concurrent edits across devices resolve deterministically.
 *   - Deletes are tombstones: the record is kept with `deleted: true` and a
 *     fresh stamp so the deletion propagates and competes by timestamp. The
 *     rendered list (`events`) filters tombstones out via `visible()`.
 *   - State and localStorage update immediately (app feels instant).
 *   - API call fires in the background; errors are logged but don't block the
 *     UI — the next sync's merge/push reconciles anything that didn't land.
 *
 * Offline behaviour:
 *   - If the server is unreachable, localStorage data (incl. tombstones) is
 *     used as-is and reconciled on the next successful sync.
 */
export function useEvents(authState, assumeCompleted = true) {
  const { masterKey, isZkEnabled } = useCrypto();
  const [events, setEvents]                     = useState(() => load(EVENTS_KEY, []));
  const [customCategories, setCustomCategories] = useState(() => load(CATEGORIES_KEY, []));
  const [categoryOverrides, setCategoryOverrides] = useState(() => load(OVERRIDES_KEY, {}));
  const [linkedCalendars, setLinkedCalendars]   = useState(() => load(LINKED_KEY, []));
  const [deletedDefaultIds, setDeletedDefaultIds] = useState(() => load(DELETED_DEFAULTS_KEY, []));
  // Plan events whose auto-completed actual the user explicitly deleted —
  // excluded from re-materialization so a delete isn't silently undone.
  const [dismissedAutoIds, setDismissedAutoIds] = useState(() => load(DISMISSED_AUTO_KEY, []));
  const [syncing, setSyncing] = useState(false);

  // `events` holds the full record set incl. tombstones (needed for merge/push);
  // consumers and internal logic use the tombstone-free `liveEvents`.
  const liveEvents = useMemo(() => visible(events), [events]);

  // Latest committed events, readable synchronously outside React's render/commit
  // cycle. Used by the sync-merge and bulk-replace paths so they can compute the
  // next state (and what to push) without doing side effects inside a setState
  // updater — which React may invoke more than once.
  const eventsRef = useRef(events);

  // Keep localStorage in sync (offline cache). Writes are guarded (see save) so a
  // quota overflow degrades to a stale cache rather than crashing during sync.
  useEffect(() => { save(EVENTS_KEY,           events);            eventsRef.current = events; }, [events]);
  useEffect(() => { save(CATEGORIES_KEY,       customCategories);  }, [customCategories]);
  useEffect(() => { save(OVERRIDES_KEY,        categoryOverrides); }, [categoryOverrides]);
  useEffect(() => { save(LINKED_KEY,           linkedCalendars);   }, [linkedCalendars]);
  useEffect(() => { save(DELETED_DEFAULTS_KEY, deletedDefaultIds); }, [deletedDefaultIds]);
  useEffect(() => { save(DISMISSED_AUTO_KEY,   dismissedAutoIds);  }, [dismissedAutoIds]);

  // ── ZK helpers ───────────────────────────────────────────────────────────
  // Local state + localStorage hold plaintext (user's own device);
  // the server only ever receives/returns ciphertext when ZK is on.
  const zkActive = isZkEnabled && masterKey;

  async function encryptEventForApi(event) {
    if (!zkActive) return event;
    const out = await encryptRecord(masterKey, event, EVENT_TEXT_FIELDS);
    for (const field of EVENT_JSON_FIELDS) {
      out[field] = await encryptJsonField(masterKey, event[field] ?? []);
    }
    return out;
  }

  async function decryptServerEvents(serverEvents) {
    if (!zkActive) return serverEvents;
    return Promise.all(serverEvents.map(decryptEventFromApi));
  }

  async function decryptEventFromApi(event) {
    const out = await decryptRecord(masterKey, event, EVENT_TEXT_FIELDS);
    for (const field of EVENT_JSON_FIELDS) {
      out[field] = await decryptJsonField(masterKey, event[field]);
      if (!Array.isArray(out[field])) out[field] = [];
    }
    return out;
  }

  async function encryptCategoryForApi(cat) {
    return zkActive ? encryptRecord(masterKey, cat, ['label']) : cat;
  }

  async function decryptCategories(serverCats) {
    return zkActive ? Promise.all(serverCats.map(c => decryptRecord(masterKey, c, ['label']))) : serverCats;
  }

  async function encryptOverrideForApi(ovr) {
    return zkActive ? encryptRecord(masterKey, ovr, ['label']) : ovr;
  }

  async function decryptOverrides(serverOverrides) {
    if (!zkActive) return serverOverrides;
    const entries = await Promise.all(Object.entries(serverOverrides).map(
      async ([id, ovr]) => [id, await decryptRecord(masterKey, ovr, ['label'])]
    ));
    return Object.fromEntries(entries);
  }

  async function encryptLinkedCalForApi(cal) {
    return zkActive ? encryptRecord(masterKey, cal, ['name']) : cal;
  }

  async function decryptLinkedCalendars(serverLinked) {
    return zkActive ? Promise.all(serverLinked.map(c => decryptRecord(masterKey, c, ['name']))) : serverLinked;
  }

  // ── Server sync on mount / auth state change ────────────────────────────
  useEffect(() => {
    if (authState !== 'ready') return;
    // ZK accounts: wait until the master key is derived before syncing,
    // otherwise we'd render (and cache) ciphertext.
    if (isZkEnabled && !masterKey) return;

    setSyncing(true);
    api.sync()
      .then(async data => {
        // First-time migration: server is empty but localStorage has data
        const alreadyMigrated = localStorage.getItem(MIGRATED_KEY) === 'true';
        if (!alreadyMigrated && data.events.length === 0 && events.length > 0) {
          await migrateLocalStorageToServer(events, customCategories, categoryOverrides, linkedCalendars, deletedDefaultIds);
          localStorage.setItem(MIGRATED_KEY, 'true');
          // Re-fetch after migration
          const fresh = await api.sync();
          await applyServerData(fresh);
        } else {
          await applyServerData(data);
          if (!alreadyMigrated) localStorage.setItem(MIGRATED_KEY, 'true');
        }
      })
      .catch(() => { /* server unreachable — keep localStorage data */ })
      .finally(() => setSyncing(false));
  }, [authState, isZkEnabled, masterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function applyServerData(data) {
    const serverEvents = await decryptServerEvents(data.events);
    // Fold remote clocks in so our HLC never trails anything we've seen.
    serverEvents.forEach(e => observe(e.updatedAt));
    // Merge by timestamp instead of overwriting (so offline edits aren't
    // clobbered), against the freshest committed state. We compute the merge and
    // the push set here rather than inside a setState updater: the push is a side
    // effect, and React may invoke an updater more than once.
    const merged = mergeRecordSets(eventsRef.current, serverEvents);
    // Push anything we hold a newer version of (offline edits / tombstones the
    // server hasn't seen) before pruning, so a freshly-merged record we still own
    // still propagates.
    const toPush = recordsToPush(merged, serverEvents);
    if (toPush.length) {
      Promise.all(toPush.map(encryptEventForApi))
        .then(p => api.events.batch(p)).catch(console.warn);
    }
    // Garbage-collect tombstones past the retention window so the record set
    // (and localStorage) doesn't grow without bound, and so we stop re-pushing
    // tombstones the server has already purged.
    const next = pruneExpiredTombstones(merged, Date.now() - TOMBSTONE_RETENTION_MS);
    eventsRef.current = next;
    setEvents(next);
    // Categories / overrides / linked calendars don't carry tombstones yet —
    // they still replace wholesale (a later slice extends the merge to them).
    setCustomCategories(await decryptCategories(data.customCategories));
    setCategoryOverrides(await decryptOverrides(data.categoryOverrides));
    setLinkedCalendars(await decryptLinkedCalendars(data.linkedCalendars));
    setDeletedDefaultIds(data.deletedDefaultIds);
  }

  // ── localStorage → server migration (runs once) ─────────────────────────
  async function migrateLocalStorageToServer(evts, cats, overrides, linked, deletedIds) {
    try {
      if (evts.length > 0) {
        const payload = await Promise.all(evts.map(encryptEventForApi));
        await api.events.batch(payload);
      }

      for (const cat of cats) {
        await api.categories.create(await encryptCategoryForApi(cat));
      }
      for (const [catId, ovr] of Object.entries(overrides)) {
        if (ovr.label || ovr.color) await api.categories.update(catId, await encryptOverrideForApi(ovr));
      }
      for (const cal of linked) {
        await api.linkedCalendars.create(await encryptLinkedCalForApi(cal));
      }
      // deletedDefaultIds — re-delete each one on the server
      for (const id of deletedIds) {
        await api.categories.delete(id);
      }
    } catch (err) {
      console.warn('Migration to backend partially failed:', err);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const isOnline = authState === 'ready';

  // ── Events ───────────────────────────────────────────────────────────────

  function addEvent(eventData) {
    const event = { ...eventData, id: generateId(), updatedAt: tick() };
    setEvents(prev => [...prev, event]);
    if (isOnline) encryptEventForApi(event).then(p => api.events.create(p)).catch(console.warn);
    return event;
  }

  function addEvents(eventsArray) {
    const withIds = eventsArray.map(e => ({ ...e, id: generateId(), updatedAt: tick() }));
    setEvents(prev => [...prev, ...withIds]);
    if (isOnline) {
      Promise.all(withIds.map(encryptEventForApi))
        .then(p => api.events.batch(p)).catch(console.warn);
    }
  }

  function updateEvent(id, updates) {
    const stamped = { ...updates, updatedAt: tick() };
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...stamped } : e));
    if (isOnline) encryptEventForApi(stamped).then(p => api.events.update(id, p)).catch(console.warn);
  }

  function deleteEvent(id) {
    const target = liveEvents.find(e => e.id === id);
    if (target?.source === 'auto-completed' && target.plan_event_id) {
      setDismissedAutoIds(prev => prev.includes(target.plan_event_id) ? prev : [...prev, target.plan_event_id]);
    }
    // Tombstone rather than drop, so the deletion can propagate and win/lose by
    // timestamp on the next merge instead of being silently resurrected.
    const ts = tick();
    setEvents(prev => prev.map(e => e.id === id ? { ...e, deleted: true, updatedAt: ts } : e));
    if (isOnline) api.events.update(id, { deleted: true, updatedAt: ts }).catch(console.warn);
  }

  // ── Recurring-series scoped edits ──────────────────────────────────────────
  // Resolve which occurrences a scoped action applies to, relative to the
  // clicked (anchor) occurrence. Scopes: 'this' (anchor only), 'future'
  // (anchor + later), 'previous' (anchor + earlier), 'all' (whole series).
  async function clearAllEvents(authVerifier) {
    if (!isOnline) throw new Error('Sign in before clearing calendar events.');
    await api.events.clearAll(authVerifier);
    eventsRef.current = [];
    setEvents([]);
    setDismissedAutoIds([]);
  }

  function seriesTargets(anchor, scope) {
    const sid = anchor?.series_id;
    if (!sid) return anchor ? [anchor] : [];
    const anchorMs = eventAbsMs(anchor);
    return liveEvents.filter(e =>
      e.series_id === sid && !e.deleted && (
        scope === 'all' ||
        (scope === 'future'   && eventAbsMs(e) >= anchorMs) ||
        (scope === 'previous' && eventAbsMs(e) <= anchorMs)
      )
    );
  }

  // Apply an edit across a series. 'this' edits only the anchor (including its
  // own date). Multi-occurrence scopes change shared content and time-of-day
  // but never each occurrence's own date (week_start / day_of_week), so the
  // series stays spread across the calendar instead of collapsing onto one day.
  function updateSeries(anchor, updates, scope) {
    if (!anchor?.series_id || scope === 'this') {
      updateEvent(anchor.id, updates);
      return;
    }
    const shared = { ...updates };
    delete shared.id;
    delete shared.week_start;
    delete shared.day_of_week;
    delete shared.series_id;
    seriesTargets(anchor, scope).forEach(e => updateEvent(e.id, shared));
  }

  function deleteSeries(anchor, scope) {
    if (!anchor?.series_id || scope === 'this') {
      deleteEvent(anchor.id);
      return;
    }
    seriesTargets(anchor, scope).forEach(e => deleteEvent(e.id));
  }

  function getWeekEvents(weekStart, calendar) {
    return liveEvents.filter(e => e.week_start === weekStart && e.calendar === calendar);
  }

  function getEvents(calendar) {
    return liveEvents.filter(e => e.calendar === calendar);
  }

  // ── Auto-complete past-due plan events ──────────────────────────────────
  // Unless the user has turned this off, a planned event that nobody logged
  // or edited by the time it ends is assumed to have happened as planned —
  // it gets a real "actual" row (source: 'auto-completed') so Reality stats
  // reflect it. Editing or deleting that row later (which sets source back
  // to 'manual') is how the user corrects anything that didn't go to plan.
  useEffect(() => {
    if (!assumeCompleted) return;
    // Computes "due" against the updater's `prev`, not the outer `events` closure,
    // so two calls in quick succession (e.g. React StrictMode's double-invoke on
    // mount) can't both see the plan event as unlogged and double-materialize it.
    function materializePastDue() {
      const now = Date.now();
      const cutoff = now - AUTO_COMPLETE_WINDOW_MS;
      setEvents(prev => {
        const loggedPlanIds = new Set(
          prev.filter(e => e.calendar === 'actual' && e.plan_event_id && !e.deleted).map(e => e.plan_event_id)
        );
        const due = prev.filter(e => {
          if (e.calendar !== 'plan' || e.is_all_day || e.deleted) return false;
          if (loggedPlanIds.has(e.id) || dismissedAutoIds.includes(e.id)) return false;
          const endMs = getEventEndDateTime(e).getTime();
          return endMs <= now && endMs >= cutoff;
        });
        if (due.length === 0) return prev;
        const materialized = due.map(pe => ({
          id: generateId(),
          label: pe.label, category: pe.category, color: pe.color,
          week_start: pe.week_start, day_of_week: pe.day_of_week,
          slot_start: pe.slot_start, slot_duration: pe.slot_duration, precision: pe.precision,
          calendar: 'actual', source: 'auto-completed', plan_event_id: pe.id,
          updatedAt: tick(),
        }));
        if (isOnline) {
          Promise.all(materialized.map(encryptEventForApi))
            .then(p => api.events.batch(p)).catch(console.warn);
        }
        return [...prev, ...materialized];
      });
    }
    materializePastDue();
    const id = setInterval(materializePastDue, AUTO_COMPLETE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [assumeCompleted, dismissedAutoIds]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Replace every event matching `predicate` with `additions`, tombstoning the
   * old records instead of hard-deleting them. Removals must be tombstones: a
   * hard delete would be seen as "remote-missing" by another device that still
   * holds the record, which would then keep and re-push it — silently
   * resurrecting it (and any new records) on the next merge. Old tombstones and
   * the new records are pushed together through the batch upsert, which carries
   * the HLC stamp and tombstone flag.
   */
  function replaceMatching(predicate, additions = []) {
    const ts = tick();
    const tombstoned = [];
    const carried = eventsRef.current.map(e => {
      if (!e.deleted && predicate(e)) {
        const t = { ...e, deleted: true, updatedAt: ts };
        tombstoned.push(t);
        return t;
      }
      return e;
    });
    const next = [...carried, ...additions];
    eventsRef.current = next;
    setEvents(next);
    const toPush = [...tombstoned, ...additions];
    if (isOnline && toPush.length) {
      Promise.all(toPush.map(encryptEventForApi))
        .then(p => api.events.batch(p)).catch(console.warn);
    }
  }

  function replaceEventsBySource(source, newEvents) {
    const withIds = newEvents.map(e => ({ ...e, id: generateId(), updatedAt: tick() }));
    replaceMatching(e => e.source === source, withIds);
  }

  /** Re-sync a subscribed calendar: reconcile its events against the fresh feed.
   *
   * Each occurrence gets a deterministic id (stableId, keyed by the provider's
   * natural `_syncKey`) so re-syncing the *same* occurrence reuses the *same*
   * record — an update in place — instead of tombstoning the whole calendar and
   * recreating it every refresh. That churn (a full copy of tombstones per sync,
   * retained 30 days) was what eventually overran localStorage's quota. Now only
   * genuine changes move: new occurrences are added, vanished ones tombstoned,
   * and unchanged ones left completely untouched (no restamp, no re-push).
   *
   * The provider owns each event's time / label / existence, but its *category*
   * is chosen here in the app. So we snapshot any category the user set that
   * differs from the calendar's import default and re-apply it to the matching
   * freshly-synced occurrence — otherwise every sync would reset a hand-
   * categorized event (or series) back to the default. Matches are keyed by
   * occurrence first, then by series_id so a new occurrence of an overridden
   * series inherits the same category. */
  function replaceEventsBySourceCalendar(sourceCalendarId, newEvents) {
    const cal = linkedCalendars.find(c => c.id === sourceCalendarId);
    const importDefault = cal?.defaultCategory || 'free-time';
    const occKey = e => `${e.series_id || ''}|${e.label}|${e.week_start}|${e.day_of_week}|${e.slot_start}`;
    const occOverride = new Map();
    const seriesOverride = new Map();
    for (const e of eventsRef.current) {
      if (e.deleted || e.source_calendar_id !== sourceCalendarId) continue;
      if (e.category && e.category !== importDefault) {
        occOverride.set(occKey(e), e.category);
        if (e.series_id) seriesOverride.set(e.series_id, e.category);
      }
    }
    const stamped = newEvents.map(e => {
      const { _syncKey, ...rest } = e;
      const carried = occOverride.get(occKey(e))
        ?? (e.series_id ? seriesOverride.get(e.series_id) : undefined);
      return {
        ...rest,
        ...(carried ? { category: carried } : {}),
        id: stableId('sub', `${sourceCalendarId}|${_syncKey || occKey(e)}`),
        source_calendar_id: sourceCalendarId,
      };
    });
    upsertSourceCalendar(sourceCalendarId, stamped);
  }

  // Fields a subscription owns — used to decide whether a re-synced occurrence
  // actually changed. If none differ we leave the existing record untouched so
  // steady-state re-syncs neither restamp nor re-push anything.
  const SYNCED_FIELDS = [
    'label', 'category', 'color', 'calendar', 'series_id', 'week_start',
    'day_of_week', 'slot_start', 'slot_duration', 'precision', 'notes',
    'location', 'meeting_url',
  ];
  function sameSyncedContent(a, b) {
    if (!!a.is_all_day !== !!b.is_all_day) return false;
    return SYNCED_FIELDS.every(f => (a[f] ?? null) === (b[f] ?? null));
  }

  /** Reconcile a calendar's existing records against the freshly-synced set,
   *  keyed by stable id: update changed occurrences, resurrect ones that
   *  reappeared, tombstone ones that vanished, add brand-new ones, and push only
   *  what actually moved. */
  function upsertSourceCalendar(sourceCalendarId, incoming) {
    const incomingById = new Map(incoming.map(e => [e.id, e]));
    const toPush = [];
    const seen = new Set();
    const next = eventsRef.current.map(e => {
      if (e.source_calendar_id !== sourceCalendarId) return e;
      const match = incomingById.get(e.id);
      if (!match) {
        // No longer in the feed → tombstone so the removal propagates by HLC.
        if (e.deleted) return e;
        const tomb = { ...e, deleted: true, updatedAt: tick() };
        toPush.push(tomb);
        return tomb;
      }
      seen.add(e.id);
      // Live record whose content is identical to the feed: leave it as-is.
      if (!e.deleted && sameSyncedContent(e, match)) return e;
      // Changed, or a tombstone that reappeared — update/resurrect in place.
      const merged = { ...e, ...match, deleted: false, updatedAt: tick() };
      toPush.push(merged);
      return merged;
    });
    for (const e of incoming) {
      if (seen.has(e.id)) continue;
      const created = { ...e, updatedAt: tick() };
      next.push(created);
      toPush.push(created);
    }
    eventsRef.current = next;
    setEvents(next);
    if (isOnline && toPush.length) {
      Promise.all(toPush.map(encryptEventForApi))
        .then(p => api.events.batch(p)).catch(console.warn);
    }
  }

  /** Update sync metadata (url, lastSyncedAt, …) on a linked calendar. */
  function updateLinkedCalendar(id, updates) {
    setLinkedCalendars(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    if (isOnline) encryptLinkedCalForApi(updates).then(p => api.linkedCalendars.update(id, p)).catch(console.warn);
  }

  // ── Categories ────────────────────────────────────────────────────────────

  function addCategory(cat) {
    const newCat = { ...cat, id: generateId() };
    setCustomCategories(prev => [...prev, newCat]);
    if (isOnline) encryptCategoryForApi(newCat).then(p => api.categories.create(p)).catch(console.warn);
  }

  function deleteCategory(id) {
    setCustomCategories(prev => prev.filter(c => c.id !== id));
    setDeletedDefaultIds(prev => prev.includes(id) ? prev : [...prev, id]);
    if (isOnline) api.categories.delete(id).catch(console.warn);
  }

  function updateCategory(id, updates) {
    const isCustom = customCategories.some(c => c.id === id);
    if (isCustom) {
      setCustomCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      if (isOnline) encryptCategoryForApi(updates).then(p => api.categories.update(id, p)).catch(console.warn);
      return;
    }
    setCategoryOverrides(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...updates } }));
    if (isOnline) encryptOverrideForApi(updates).then(p => api.categories.update(id, p)).catch(console.warn);
  }

  // ── Linked Calendars ──────────────────────────────────────────────────────

  function addLinkedCalendar(cal) {
    const id = generateId();
    const color = cal.color || IMPORT_COLORS[linkedCalendars.length % IMPORT_COLORS.length];
    const newCal = { ...cal, id, color };
    setLinkedCalendars(prev => [...prev, newCal]);
    if (isOnline) encryptLinkedCalForApi(newCal).then(p => api.linkedCalendars.create(p)).catch(console.warn);
    return { id, color };
  }

  function deleteLinkedCalendar(id) {
    setLinkedCalendars(prev => prev.filter(c => c.id !== id));
    // Tombstone the calendar's events (don't hard-delete) so the removal
    // propagates by HLC. A hard delete looks "remote-missing" to another device
    // that still holds these events — it would keep and re-push them, silently
    // resurrecting them as orphans (their calendar is now gone). replaceMatching
    // tombstones the matches and pushes the tombstones up.
    replaceMatching(e => e.source_calendar_id === id);
    if (isOnline) api.linkedCalendars.delete(id).catch(console.warn);
  }

  function updateLinkedCalendarColor(id, newColor) {
    setLinkedCalendars(prev => prev.map(c => c.id === id ? { ...c, color: newColor } : c));
    setEvents(prev => prev.map(e => e.source_calendar_id === id ? { ...e, color: newColor } : e));
    if (isOnline) api.linkedCalendars.update(id, { color: newColor }).catch(console.warn);
  }

  // Set (or clear, with null) the default category for a linked calendar. Every
  // event imported from it is tagged with this category — applied at sync time
  // (in syncSubscribedCalendar) so it survives the destructive re-sync, and
  // re-applied to the calendar's existing events here so the change is immediate.
  function updateLinkedCalendarCategory(id, category) {
    const cat = category || null;
    setLinkedCalendars(prev => prev.map(c => c.id === id ? { ...c, defaultCategory: cat } : c));
    if (isOnline) api.linkedCalendars.update(id, { defaultCategory: cat }).catch(console.warn);
    if (!cat) return;
    const ts = tick();
    const touched = [];
    const next = eventsRef.current.map(e => {
      if (e.source_calendar_id === id && !e.deleted && e.category !== cat) {
        const u = { ...e, category: cat, updatedAt: ts };
        touched.push(u);
        return u;
      }
      return e;
    });
    eventsRef.current = next;
    setEvents(next);
    if (isOnline && touched.length) {
      Promise.all(touched.map(encryptEventForApi))
        .then(p => api.events.batch(p)).catch(console.warn);
    }
  }

  function updateLinkedCalendarExclude(id, exclude) {
    setLinkedCalendars(prev => prev.map(c => c.id === id ? { ...c, excludeFromReality: exclude } : c));
    if (isOnline) api.linkedCalendars.update(id, { excludeFromReality: exclude }).catch(console.warn);
  }

  function clearLegacyEvents(calendar) {
    const isLegacy = e => e.calendar === calendar && !e.source_calendar_id && e.source !== 'manual';
    // Tombstone rather than hard-delete so the removal propagates by HLC instead
    // of being resurrected by a device that still holds these events.
    replaceMatching(isLegacy);
  }

  return {
    events: liveEvents, syncing,
    customCategories, categoryOverrides,
    addEvent, addEvents, updateEvent, deleteEvent, clearAllEvents,
    updateSeries, deleteSeries,
    getWeekEvents, getEvents,
    addCategory, deleteCategory, updateCategory,
    deletedDefaultIds, replaceEventsBySource, replaceEventsBySourceCalendar,
    linkedCalendars, addLinkedCalendar, deleteLinkedCalendar, updateLinkedCalendar,
    updateLinkedCalendarColor, updateLinkedCalendarCategory, updateLinkedCalendarExclude, clearLegacyEvents,
  };
}
