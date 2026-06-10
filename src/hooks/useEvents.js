import { useState, useEffect, useRef } from 'react';
import { generateId } from '../lib/utils';
import { api } from '../lib/api.js';
import { encryptField, decryptField } from '../lib/crypto.js';
import { useCrypto } from '../context/CryptoContext.jsx';

const EVENTS_KEY       = 'life-calendar-events';
const CATEGORIES_KEY   = 'life-calendar-categories';
const OVERRIDES_KEY    = 'life-calendar-category-overrides';
const LINKED_KEY       = 'life-calendar-linked';
const DELETED_DEFAULTS_KEY = 'lc-deleted-defaults';
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
export function useEvents(authState) {
  const { masterKey, isZkEnabled } = useCrypto();
  const [events, setEvents]                     = useState(() => load(EVENTS_KEY, []));
  const [customCategories, setCustomCategories] = useState(() => load(CATEGORIES_KEY, []));
  const [categoryOverrides, setCategoryOverrides] = useState(() => load(OVERRIDES_KEY, {}));
  const [linkedCalendars, setLinkedCalendars]   = useState(() => load(LINKED_KEY, []));
  const [deletedDefaultIds, setDeletedDefaultIds] = useState(() => load(DELETED_DEFAULTS_KEY, []));
  const [syncing, setSyncing] = useState(false);

  // Keep localStorage in sync (offline cache)
  useEffect(() => { localStorage.setItem(EVENTS_KEY,           JSON.stringify(events));           }, [events]);
  useEffect(() => { localStorage.setItem(CATEGORIES_KEY,       JSON.stringify(customCategories)); }, [customCategories]);
  useEffect(() => { localStorage.setItem(OVERRIDES_KEY,        JSON.stringify(categoryOverrides));}, [categoryOverrides]);
  useEffect(() => { localStorage.setItem(LINKED_KEY,           JSON.stringify(linkedCalendars));  }, [linkedCalendars]);
  useEffect(() => { localStorage.setItem(DELETED_DEFAULTS_KEY, JSON.stringify(deletedDefaultIds));}, [deletedDefaultIds]);

  // ── ZK helpers ───────────────────────────────────────────────────────────
  // Local state + localStorage hold plaintext (user's own device);
  // the server only ever receives/returns ciphertext when ZK is on.
  const zkActive = isZkEnabled && masterKey;

  async function encryptEventForApi(event) {
    if (!zkActive) return event;
    const out = { ...event };
    if ('label' in out && out.label) out.label = await encryptField(masterKey, out.label);
    if ('notes' in out && out.notes) out.notes = await encryptField(masterKey, out.notes);
    return out;
  }

  async function decryptServerEvents(serverEvents) {
    if (!zkActive) return serverEvents;
    return Promise.all(serverEvents.map(async e => ({
      ...e,
      label: e.label ? await decryptField(masterKey, e.label) : e.label,
      notes: e.notes ? await decryptField(masterKey, e.notes) : e.notes,
    })));
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
    setCustomCategories(data.customCategories);
    setCategoryOverrides(data.categoryOverrides);
    setLinkedCalendars(data.linkedCalendars);
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
        await api.categories.create(cat);
      }
      for (const [catId, ovr] of Object.entries(overrides)) {
        if (ovr.label || ovr.color) await api.categories.update(catId, ovr);
      }
      for (const cal of linked) {
        await api.linkedCalendars.create(cal);
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
    setEvents(prev => prev.filter(e => e.id !== id));
    if (isOnline) api.events.delete(id).catch(console.warn);
  }

  function getWeekEvents(weekStart, calendar) {
    return events.filter(e => e.week_start === weekStart && e.calendar === calendar);
  }

  function getEvents(calendar) {
    return events.filter(e => e.calendar === calendar);
  }

  function replaceEventsBySource(source, newEvents) {
    const withIds = newEvents.map(e => ({ ...e, id: generateId() }));
    setEvents(prev => [...prev.filter(e => e.source !== source), ...withIds]);
    if (isOnline) {
      Promise.all(withIds.map(encryptEventForApi))
        .then(p => api.events.replaceBySource(source, p)).catch(console.warn);
    }
  }

  // ── Categories ────────────────────────────────────────────────────────────

  function addCategory(cat) {
    const newCat = { ...cat, id: generateId() };
    setCustomCategories(prev => [...prev, newCat]);
    if (isOnline) api.categories.create(newCat).catch(console.warn);
  }

  function deleteCategory(id) {
    setCustomCategories(prev => prev.filter(c => c.id !== id));
    setDeletedDefaultIds(prev => prev.includes(id) ? prev : [...prev, id]);
    if (isOnline) api.categories.delete(id).catch(console.warn);
  }

  function updateCategory(id, updates) {
    setCategoryOverrides(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...updates } }));
    if (isOnline) api.categories.update(id, updates).catch(console.warn);
  }

  // ── Linked Calendars ──────────────────────────────────────────────────────

  function addLinkedCalendar(cal) {
    const id = generateId();
    const color = cal.color || IMPORT_COLORS[linkedCalendars.length % IMPORT_COLORS.length];
    const newCal = { ...cal, id, color };
    setLinkedCalendars(prev => [...prev, newCal]);
    if (isOnline) api.linkedCalendars.create(newCal).catch(console.warn);
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
    setEvents(prev => prev.filter(e =>
      !(e.calendar === calendar && !e.source_calendar_id && e.source !== 'manual')
    ));
    // Note: orphaned events on the server will be cleaned up on next sync
  }

  return {
    events, syncing,
    customCategories, categoryOverrides,
    addEvent, addEvents, updateEvent, deleteEvent,
    getWeekEvents, getEvents,
    addCategory, deleteCategory, updateCategory,
    deletedDefaultIds, replaceEventsBySource,
    linkedCalendars, addLinkedCalendar, deleteLinkedCalendar,
    updateLinkedCalendarColor, updateLinkedCalendarExclude, clearLegacyEvents,
  };
}
