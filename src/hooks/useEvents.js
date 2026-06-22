import { useState, useEffect, useRef } from 'react';
import { generateId, getEventEndDateTime } from '../lib/utils';
import { api } from '../lib/api.js';
import { encryptRecord, decryptRecord } from '../lib/cryptoRecord.js';
import { useCrypto } from '../context/CryptoContext.jsx';

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

/**
 * useEvents — manages all calendar data.
 *
 * Startup behaviour:
 *   1. Immediately load from localStorage (zero-latency render).
 *   2. If authenticated, call GET /api/sync to get the authoritative
 *      server state and replace local state with it.
 *   3. First-time migration: if the server has no events but localStorage
 *      does, push all local data to the server automatically.
 *
 * Mutation behaviour (optimistic + background sync):
 *   - State and localStorage update immediately (app feels instant).
 *   - API call fires in the background; errors are logged but don't
 *     block the UI. A future phase will add a retry / dirty queue.
 *
 * Offline behaviour:
 *   - If the server is unreachable, localStorage data is used as-is.
 *   - The app is fully functional; data just won't sync across devices.
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

  // Keep localStorage in sync (offline cache)
  useEffect(() => { localStorage.setItem(EVENTS_KEY,           JSON.stringify(events));           }, [events]);
  useEffect(() => { localStorage.setItem(CATEGORIES_KEY,       JSON.stringify(customCategories)); }, [customCategories]);
  useEffect(() => { localStorage.setItem(OVERRIDES_KEY,        JSON.stringify(categoryOverrides));}, [categoryOverrides]);
  useEffect(() => { localStorage.setItem(LINKED_KEY,           JSON.stringify(linkedCalendars));  }, [linkedCalendars]);
  useEffect(() => { localStorage.setItem(DELETED_DEFAULTS_KEY, JSON.stringify(deletedDefaultIds));}, [deletedDefaultIds]);
  useEffect(() => { localStorage.setItem(DISMISSED_AUTO_KEY,   JSON.stringify(dismissedAutoIds)); }, [dismissedAutoIds]);

  // ── ZK helpers ───────────────────────────────────────────────────────────
  // Local state + localStorage hold plaintext (user's own device);
  // the server only ever receives/returns ciphertext when ZK is on.
  const zkActive = isZkEnabled && masterKey;

  async function encryptEventForApi(event) {
    return zkActive ? encryptRecord(masterKey, event, ['label', 'notes']) : event;
  }

  async function decryptServerEvents(serverEvents) {
    return zkActive
      ? Promise.all(serverEvents.map(e => decryptRecord(masterKey, e, ['label', 'notes'])))
      : serverEvents;
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
    setEvents(await decryptServerEvents(data.events));
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
    const event = { ...eventData, id: generateId() };
    setEvents(prev => [...prev, event]);
    if (isOnline) encryptEventForApi(event).then(p => api.events.create(p)).catch(console.warn);
    return event;
  }

  function addEvents(eventsArray) {
    const withIds = eventsArray.map(e => ({ ...e, id: generateId() }));
    setEvents(prev => [...prev, ...withIds]);
    if (isOnline) {
      Promise.all(withIds.map(encryptEventForApi))
        .then(p => api.events.batch(p)).catch(console.warn);
    }
  }

  function updateEvent(id, updates) {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    if (isOnline) encryptEventForApi(updates).then(p => api.events.update(id, p)).catch(console.warn);
  }

  function deleteEvent(id) {
    const target = events.find(e => e.id === id);
    if (target?.source === 'auto-completed' && target.plan_event_id) {
      setDismissedAutoIds(prev => prev.includes(target.plan_event_id) ? prev : [...prev, target.plan_event_id]);
    }
    setEvents(prev => prev.filter(e => e.id !== id));
    if (isOnline) api.events.delete(id).catch(console.warn);
  }

  function getWeekEvents(weekStart, calendar) {
    return events.filter(e => e.week_start === weekStart && e.calendar === calendar);
  }

  function getEvents(calendar) {
    return events.filter(e => e.calendar === calendar);
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
          prev.filter(e => e.calendar === 'actual' && e.plan_event_id).map(e => e.plan_event_id)
        );
        const due = prev.filter(e => {
          if (e.calendar !== 'plan' || e.is_all_day) return false;
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

  function replaceEventsBySource(source, newEvents) {
    const withIds = newEvents.map(e => ({ ...e, id: generateId() }));
    setEvents(prev => [...prev.filter(e => e.source !== source), ...withIds]);
    if (isOnline) {
      Promise.all(withIds.map(encryptEventForApi))
        .then(p => api.events.replaceBySource(source, p)).catch(console.warn);
    }
  }

  /** Re-sync a subscribed calendar: swap out all its events atomically. */
  function replaceEventsBySourceCalendar(sourceCalendarId, newEvents) {
    const withIds = newEvents.map(e => ({ ...e, id: generateId(), source_calendar_id: sourceCalendarId }));
    setEvents(prev => [...prev.filter(e => e.source_calendar_id !== sourceCalendarId), ...withIds]);
    if (isOnline) {
      Promise.all(withIds.map(encryptEventForApi))
        .then(p => api.events.replaceBySourceCalendar(sourceCalendarId, p)).catch(console.warn);
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
    setEvents(prev => prev.filter(e => e.source_calendar_id !== id));
    if (isOnline) api.linkedCalendars.delete(id).catch(console.warn);
  }

  function updateLinkedCalendarColor(id, newColor) {
    setLinkedCalendars(prev => prev.map(c => c.id === id ? { ...c, color: newColor } : c));
    setEvents(prev => prev.map(e => e.source_calendar_id === id ? { ...e, color: newColor } : e));
    if (isOnline) api.linkedCalendars.update(id, { color: newColor }).catch(console.warn);
  }

  function updateLinkedCalendarExclude(id, exclude) {
    setLinkedCalendars(prev => prev.map(c => c.id === id ? { ...c, excludeFromReality: exclude } : c));
    if (isOnline) api.linkedCalendars.update(id, { excludeFromReality: exclude }).catch(console.warn);
  }

  function clearLegacyEvents(calendar) {
    const isLegacy = e => e.calendar === calendar && !e.source_calendar_id && e.source !== 'manual';
    const removedIds = events.filter(isLegacy).map(e => e.id);
    setEvents(prev => prev.filter(e => !isLegacy(e)));
    if (isOnline) {
      Promise.all(removedIds.map(id => api.events.delete(id))).catch(console.warn);
    }
  }

  return {
    events, syncing,
    customCategories, categoryOverrides,
    addEvent, addEvents, updateEvent, deleteEvent,
    getWeekEvents, getEvents,
    addCategory, deleteCategory, updateCategory,
    deletedDefaultIds, replaceEventsBySource, replaceEventsBySourceCalendar,
    linkedCalendars, addLinkedCalendar, deleteLinkedCalendar, updateLinkedCalendar,
    updateLinkedCalendarColor, updateLinkedCalendarExclude, clearLegacyEvents,
  };
}
