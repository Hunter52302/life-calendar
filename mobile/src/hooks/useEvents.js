import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId, DEFAULT_CATEGORIES, getEventEndDateTime, eventAbsMs } from '../lib/utils.js';
import { api } from '../lib/api.js';
import { encryptRecord, decryptRecord, encryptJsonField, decryptJsonField } from '../lib/cryptoRecord.js';

const EVENTS_KEY  = 'lc-m-events';
const CATS_KEY    = 'lc-m-categories';
const OVRS_KEY    = 'lc-m-overrides';
const DISMISSED_AUTO_KEY = 'lc-m-dismissed-auto-complete';
const LINKED_KEY  = 'lc-m-linked';
const EVENT_TEXT_FIELDS = ['label', 'notes', 'location', 'meeting_url'];
const EVENT_JSON_FIELDS = ['people', 'actions'];

// Trailing window for auto-completing past-due plan events, so turning the
// setting on doesn't retroactively backfill someone's entire plan history.
const AUTO_COMPLETE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const AUTO_COMPLETE_INTERVAL_MS = 5 * 60 * 1000;

async function asyncLoad(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function useEvents(authState, masterKey = null, isZkEnabled = false, assumeCompleted = true) {
  const [ready, setReady]       = useState(false);
  const [events, setEvents]     = useState([]);
  const [customCats, setCustomCats] = useState([]);
  const [overrides, setOverrides]   = useState({});
  // Plan events whose auto-completed actual the user explicitly deleted —
  // excluded from re-materialization so a delete isn't silently undone.
  const [dismissedAutoIds, setDismissedAutoIds] = useState([]);
  const [linkedCalendars, setLinkedCals] = useState([]);

  useEffect(() => {
    Promise.all([
      asyncLoad(EVENTS_KEY, []),
      asyncLoad(CATS_KEY, []),
      asyncLoad(OVRS_KEY, {}),
      asyncLoad(DISMISSED_AUTO_KEY, []),
      asyncLoad(LINKED_KEY, []),
    ]).then(([e, c, o, d, l]) => {
      setEvents(e);
      setCustomCats(c);
      setOverrides(o);
      setDismissedAutoIds(d);
      setLinkedCals(l);
      setReady(true);
    });
  }, []);

  useEffect(() => { if (ready) AsyncStorage.setItem(EVENTS_KEY,  JSON.stringify(events)).catch(() => {}); },        [events, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(CATS_KEY,    JSON.stringify(customCats)).catch(() => {}); },   [customCats, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(OVRS_KEY,    JSON.stringify(overrides)).catch(() => {}); },    [overrides, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(LINKED_KEY,  JSON.stringify(linkedCalendars)).catch(() => {}); }, [linkedCalendars, ready]);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(DISMISSED_AUTO_KEY, JSON.stringify(dismissedAutoIds)).catch(() => {});
  }, [dismissedAutoIds, ready]);

  // Local state holds plaintext; the server only sees ciphertext when ZK is on.
  const zkActive = isZkEnabled && masterKey;

  async function encryptEventForApi(event) {
    if (!zkActive) return event;
    const out = await encryptRecord(masterKey, event, EVENT_TEXT_FIELDS);
    for (const field of EVENT_JSON_FIELDS) {
      out[field] = await encryptJsonField(masterKey, event[field] ?? []);
    }
    return out;
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

  // Sync from backend when authenticated (and, for ZK accounts, unlocked)
  useEffect(() => {
    if ((authState !== 'ready') || !ready) return;
    if (isZkEnabled && !masterKey) return;
    api.sync()
      .then(async data => {
        const evs = zkActive
          ? await Promise.all(data.events.map(decryptEventFromApi))
          : data.events;
        setEvents(evs);
        setCustomCats(await decryptCategories(data.customCategories));
        setOverrides(await decryptOverrides(data.categoryOverrides));
        setLinkedCals(await decryptLinkedCalendars(data.linkedCalendars));
      })
      .catch(() => {});
  }, [authState, ready, isZkEnabled, masterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const allCategories = [
    ...DEFAULT_CATEGORIES.map(dc => ({ ...dc, ...(overrides[dc.id] || {}) })),
    ...customCats,
  ];

  const isOnline = authState === 'ready';

  // ── Events ─────────────────────────────────────────────────────────────────
  function addEvent(data) {
    const ev = { ...data, id: generateId() };
    setEvents(p => [...p, ev]);
    if (isOnline) encryptEventForApi(ev).then(p => api.events.create(p)).catch(console.warn);
  }

  function addEvents(dataArray) {
    const withIds = dataArray.map(d => ({ ...d, id: generateId() }));
    setEvents(p => [...p, ...withIds]);
    if (isOnline) {
      Promise.all(withIds.map(encryptEventForApi))
        .then(p => api.events.batch(p)).catch(console.warn);
    }
  }

  // ── Auto-complete past-due plan events ──────────────────────────────────
  // Unless the user has turned this off, a planned event that nobody logged
  // or edited by the time it ends is assumed to have happened as planned —
  // it gets a real "actual" row (source: 'auto-completed') so Reality stats
  // reflect it. Editing or deleting that row later (which sets source back
  // to 'manual') is how the user corrects anything that didn't go to plan.
  useEffect(() => {
    if (!ready || !assumeCompleted) return;
    // Calendars the user excluded from See Your Life. We never "assume completed"
    // their events — an imported feed (e.g. a gym's open hours) isn't a personal
    // plan, so fabricating live time from it would just pollute that category.
    const excludedCalIds = new Set(
      linkedCalendars.filter(c => c.excludeFromReality).map(c => c.id)
    );
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
          // Skip imported calendars the user excluded from See Your Life.
          if (e.source_calendar_id && excludedCalIds.has(e.source_calendar_id)) return false;
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
          // Carry the source-calendar lineage so the live copy stays attributable
          // to its imported calendar (Skip SYL can then exclude it).
          ...(pe.source_calendar_id ? { source_calendar_id: pe.source_calendar_id } : {}),
          ...(pe.series_id ? { series_id: pe.series_id } : {}),
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
  }, [ready, assumeCompleted, dismissedAutoIds, linkedCalendars]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateEvent(id, updates) {
    setEvents(p => p.map(e => e.id === id ? { ...e, ...updates } : e));
    if (isOnline) encryptEventForApi(updates).then(p => api.events.update(id, p)).catch(console.warn);
  }

  function deleteEvent(id) {
    const target = events.find(e => e.id === id);
    if (target?.source === 'auto-completed' && target.plan_event_id) {
      setDismissedAutoIds(p => p.includes(target.plan_event_id) ? p : [...p, target.plan_event_id]);
    }
    setEvents(p => p.filter(e => e.id !== id));
    if (isOnline) api.events.delete(id).catch(console.warn);
  }

  // ── Recurring-series scoped edits (mirrors the web app) ────────────────────
  // Resolve which occurrences a scoped action applies to, relative to the
  // clicked (anchor) occurrence: 'this' / 'future' / 'previous' / 'all'.
  async function clearAllEvents(authVerifier) {
    if (!isOnline) throw new Error('Sign in before clearing calendar events.');
    await api.events.clearAll(authVerifier);
    setEvents([]);
    setDismissedAutoIds([]);
  }

  function seriesTargets(anchor, scope) {
    const sid = anchor?.series_id;
    if (!sid) return anchor ? [anchor] : [];
    const anchorMs = eventAbsMs(anchor);
    return events.filter(e =>
      e.series_id === sid && (
        scope === 'all' ||
        (scope === 'future'   && eventAbsMs(e) >= anchorMs) ||
        (scope === 'previous' && eventAbsMs(e) <= anchorMs)
      )
    );
  }

  // Multi-occurrence edits change shared content/time-of-day but never each
  // occurrence's own date, so the series stays spread across the calendar.
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

  // ── Categories ─────────────────────────────────────────────────────────────
  function addCategory(cat) {
    const newCat = { ...cat, id: generateId() };
    setCustomCats(p => [...p, newCat]);
    if (isOnline) encryptCategoryForApi(newCat).then(p => api.categories.create(p)).catch(console.warn);
  }

  function updateCategory(id, updates) {
    // Could be a default (override) or custom
    const isDefault = DEFAULT_CATEGORIES.some(dc => dc.id === id);
    if (isDefault) {
      setOverrides(p => ({ ...p, [id]: { ...(p[id] || {}), ...updates } }));
      if (isOnline) encryptOverrideForApi(updates).then(p => api.categories.update(id, p)).catch(console.warn);
    } else {
      setCustomCats(p => p.map(c => c.id === id ? { ...c, ...updates } : c));
      if (isOnline) encryptCategoryForApi(updates).then(p => api.categories.update(id, p)).catch(console.warn);
    }
  }

  function deleteCategory(id) {
    setCustomCats(p => p.filter(c => c.id !== id));
    if (isOnline) api.categories.delete(id).catch(console.warn);
  }

  // ── Linked Calendars ───────────────────────────────────────────────────────
  function addLinkedCalendar(cal) {
    const newCal = { ...cal, id: generateId(), importedAt: new Date().toLocaleDateString() };
    setLinkedCals(p => [...p, newCal]);
    if (isOnline) encryptLinkedCalForApi(newCal).then(p => api.linkedCalendars.create(p)).catch(console.warn);
  }

  function deleteLinkedCalendar(id) {
    setLinkedCals(p => p.filter(c => c.id !== id));
    // Also remove events from that source
    setEvents(p => p.filter(e => e.source_calendar_id !== id));
    if (isOnline) api.linkedCalendars.delete(id).catch(console.warn);
  }

  return {
    ready, events, allCategories, linkedCalendars,
    addEvent, addEvents, updateEvent, deleteEvent, clearAllEvents,
    updateSeries, deleteSeries,
    addCategory, updateCategory, deleteCategory,
    addLinkedCalendar, deleteLinkedCalendar,
  };
}
