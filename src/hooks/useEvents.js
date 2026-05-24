import { useState, useEffect } from 'react';
import { generateId } from '../lib/utils';

const EVENTS_KEY = 'life-calendar-events';
const CATEGORIES_KEY = 'life-calendar-categories';
const OVERRIDES_KEY = 'life-calendar-category-overrides';
const LINKED_KEY = 'life-calendar-linked';
const DELETED_DEFAULTS_KEY = 'lc-deleted-defaults';

/** Colors auto-assigned to imported calendars in order. */
export const IMPORT_COLORS = [
  '#3B82F6', // blue
  '#22C55E', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#A855F7', // purple
  '#14B8A6', // teal
  '#F97316', // orange
  '#EC4899', // pink
];

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function useEvents() {
  const [events, setEvents] = useState(() => load(EVENTS_KEY, []));
  const [customCategories, setCustomCategories] = useState(() => load(CATEGORIES_KEY, []));
  const [categoryOverrides, setCategoryOverrides] = useState(() => load(OVERRIDES_KEY, {}));
  const [linkedCalendars, setLinkedCalendars] = useState(() => load(LINKED_KEY, []));
  const [deletedDefaultIds, setDeletedDefaultIds] = useState(() => load(DELETED_DEFAULTS_KEY, []));

  useEffect(() => { localStorage.setItem(EVENTS_KEY, JSON.stringify(events)); }, [events]);
  useEffect(() => { localStorage.setItem(CATEGORIES_KEY, JSON.stringify(customCategories)); }, [customCategories]);
  useEffect(() => { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(categoryOverrides)); }, [categoryOverrides]);
  useEffect(() => { localStorage.setItem(LINKED_KEY, JSON.stringify(linkedCalendars)); }, [linkedCalendars]);
  useEffect(() => { localStorage.setItem(DELETED_DEFAULTS_KEY, JSON.stringify(deletedDefaultIds)); }, [deletedDefaultIds]);

  function addEvent(eventData) {
    setEvents(prev => [...prev, { ...eventData, id: generateId() }]);
  }
  function addEvents(eventsArray) {
    setEvents(prev => [...prev, ...eventsArray.map(e => ({ ...e, id: generateId() }))]);
  }
  function updateEvent(id, updates) {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }
  function deleteEvent(id) {
    setEvents(prev => prev.filter(e => e.id !== id));
  }
  function getWeekEvents(weekStart, calendar) {
    return events.filter(e => e.week_start === weekStart && e.calendar === calendar);
  }
  function getEvents(calendar) {
    return events.filter(e => e.calendar === calendar);
  }
  function addCategory(cat) {
    setCustomCategories(prev => [...prev, { ...cat, id: generateId() }]);
  }
  function deleteCategory(id) {
    // Remove from custom categories (no-op if it's a built-in default)
    setCustomCategories(prev => prev.filter(c => c.id !== id));
    // Track removed defaults so they're hidden from allCategories
    setDeletedDefaultIds(prev => prev.includes(id) ? prev : [...prev, id]);
  }

  /**
   * Atomically replace all events that have a given `source` value.
   * Used for auto-managed events like birthday reminders.
   */
  function replaceEventsBySource(source, newEvents) {
    setEvents(prev => [
      ...prev.filter(e => e.source !== source),
      ...newEvents.map(e => ({ ...e, id: generateId() })),
    ]);
  }
  function updateCategory(id, updates) {
    setCategoryOverrides(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...updates } }));
  }

  /**
   * Register a new linked calendar source.
   * Auto-assigns a color from the palette if none provided.
   * Returns { id, color } synchronously.
   */
  function addLinkedCalendar(cal) {
    const id = generateId();
    const color = cal.color || IMPORT_COLORS[linkedCalendars.length % IMPORT_COLORS.length];
    setLinkedCalendars(prev => [...prev, { ...cal, id, color }]);
    return { id, color };
  }

  /** Remove a linked calendar AND all events imported from it. */
  function deleteLinkedCalendar(id) {
    setLinkedCalendars(prev => prev.filter(c => c.id !== id));
    setEvents(prev => prev.filter(e => e.source_calendar_id !== id));
  }

  /**
   * Change the color of a linked calendar and recolor all its events.
   */
  function updateLinkedCalendarColor(id, newColor) {
    setLinkedCalendars(prev => prev.map(c => c.id === id ? { ...c, color: newColor } : c));
    setEvents(prev => prev.map(e => e.source_calendar_id === id ? { ...e, color: newColor } : e));
  }

  /**
   * Toggle whether a linked calendar's events are excluded from Reality Check.
   */
  function updateLinkedCalendarExclude(id, exclude) {
    setLinkedCalendars(prev => prev.map(c => c.id === id ? { ...c, excludeFromReality: exclude } : c));
  }

  /**
   * Remove events that have no source_calendar_id and no source='manual'.
   * These are legacy imports from before calendar tracking was added.
   */
  function clearLegacyEvents(calendar) {
    setEvents(prev => prev.filter(e =>
      !(e.calendar === calendar && !e.source_calendar_id && e.source !== 'manual')
    ));
  }

  return {
    events,
    customCategories, categoryOverrides,
    addEvent, addEvents, updateEvent, deleteEvent,
    getWeekEvents, getEvents,
    addCategory, deleteCategory, updateCategory,
    deletedDefaultIds, replaceEventsBySource,
    linkedCalendars, addLinkedCalendar, deleteLinkedCalendar, updateLinkedCalendarColor, updateLinkedCalendarExclude, clearLegacyEvents,
  };
}
