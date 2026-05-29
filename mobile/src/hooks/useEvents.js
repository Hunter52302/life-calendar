import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId, DEFAULT_CATEGORIES } from '../lib/utils.js';
import { api } from '../lib/api.js';

const EVENTS_KEY  = 'lc-m-events';
const CATS_KEY    = 'lc-m-categories';
const OVRS_KEY    = 'lc-m-overrides';
const HABITS_KEY  = 'lc-m-habits';
const LINKED_KEY  = 'lc-m-linked';
const TASKS_KEY   = 'lc-m-tasks';

async function asyncLoad(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function useEvents(authState) {
  const [ready, setReady]                   = useState(false);
  const [events, setEvents]                 = useState([]);
  const [customCats, setCustomCats]         = useState([]);
  const [overrides, setOverrides]           = useState({});
  const [habits, setHabits]                 = useState([]);
  const [linkedCalendars, setLinkedCals]    = useState([]);
  const [tasks, setTasks]                   = useState([]);

  useEffect(() => {
    Promise.all([
      asyncLoad(EVENTS_KEY,  []),
      asyncLoad(CATS_KEY,    []),
      asyncLoad(OVRS_KEY,    {}),
      asyncLoad(HABITS_KEY,  []),
      asyncLoad(LINKED_KEY,  []),
      asyncLoad(TASKS_KEY,   []),
    ]).then(([e, c, o, h, l, t]) => {
      setEvents(e);
      setCustomCats(c);
      setOverrides(o);
      setHabits(h);
      setLinkedCals(l);
      setTasks(t);
      setReady(true);
    });
  }, []);

  useEffect(() => { if (ready) AsyncStorage.setItem(EVENTS_KEY,  JSON.stringify(events)).catch(() => {}); },        [events, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(CATS_KEY,    JSON.stringify(customCats)).catch(() => {}); },   [customCats, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(OVRS_KEY,    JSON.stringify(overrides)).catch(() => {}); },    [overrides, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(HABITS_KEY,  JSON.stringify(habits)).catch(() => {}); },       [habits, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(LINKED_KEY,  JSON.stringify(linkedCalendars)).catch(() => {}); }, [linkedCalendars, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(TASKS_KEY,   JSON.stringify(tasks)).catch(() => {}); },        [tasks, ready]);

  // Sync from backend when authenticated
  useEffect(() => {
    if ((authState !== 'ready') || !ready) return;
    api.sync()
      .then(data => {
        setEvents(data.events);
        setCustomCats(data.customCategories);
        setOverrides(data.categoryOverrides);
      })
      .catch(() => {});
  }, [authState, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const allCategories = [
    ...DEFAULT_CATEGORIES.map(dc => ({ ...dc, ...(overrides[dc.id] || {}) })),
    ...customCats,
  ];

  const isOnline = authState === 'ready';

  // ── Events ─────────────────────────────────────────────────────────────────
  function addEvent(data) {
    const ev = { ...data, id: generateId() };
    setEvents(p => [...p, ev]);
    if (isOnline) api.events.create(ev).catch(console.warn);
  }

  function updateEvent(id, updates) {
    setEvents(p => p.map(e => e.id === id ? { ...e, ...updates } : e));
    if (isOnline) api.events.update(id, updates).catch(console.warn);
  }

  function deleteEvent(id) {
    setEvents(p => p.filter(e => e.id !== id));
    if (isOnline) api.events.delete(id).catch(console.warn);
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  function addCategory(cat) {
    const newCat = { ...cat, id: generateId() };
    setCustomCats(p => [...p, newCat]);
    if (isOnline) api.categories.create(newCat).catch(console.warn);
  }

  function updateCategory(id, updates) {
    // Could be a default (override) or custom
    const isDefault = DEFAULT_CATEGORIES.some(dc => dc.id === id);
    if (isDefault) {
      setOverrides(p => ({ ...p, [id]: { ...(p[id] || {}), ...updates } }));
    } else {
      setCustomCats(p => p.map(c => c.id === id ? { ...c, ...updates } : c));
    }
    if (isOnline) api.categories.update(id, updates).catch(console.warn);
  }

  function deleteCategory(id) {
    setCustomCats(p => p.filter(c => c.id !== id));
    if (isOnline) api.categories.delete(id).catch(console.warn);
  }

  // ── Habits ─────────────────────────────────────────────────────────────────
  function addHabit(data) {
    setHabits(p => [...p, { ...data, id: generateId() }]);
  }

  function deleteHabit(id) {
    setHabits(p => p.filter(h => h.id !== id));
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────
  function addTask(data) {
    const today = new Date().toISOString().slice(0, 10);
    const task = { id: generateId(), title: '', status: 'pending', priority: 'medium', due_date: today, kanban_column: 'todo', sort_order: Date.now(), ...data };
    setTasks(p => [...p, task]);
  }

  function updateTask(id, updates) {
    setTasks(p => p.map(t => t.id === id ? { ...t, ...updates } : t));
  }

  function deleteTask(id) {
    setTasks(p => p.filter(t => t.id !== id));
  }

  function completeTask(id) {
    setTasks(p => p.map(t => t.id === id ? { ...t, status: 'completed', completed_at: Date.now(), kanban_column: 'done' } : t));
  }

  function uncompleteTask(id) {
    setTasks(p => p.map(t => t.id === id ? { ...t, status: 'pending', completed_at: null, kanban_column: 'todo' } : t));
  }

  // ── Linked Calendars ───────────────────────────────────────────────────────
  function addLinkedCalendar(cal) {
    const newCal = { ...cal, id: generateId(), importedAt: new Date().toLocaleDateString() };
    setLinkedCals(p => [...p, newCal]);
    if (isOnline) api.linkedCalendars.create(newCal).catch(console.warn);
  }

  function deleteLinkedCalendar(id) {
    setLinkedCals(p => p.filter(c => c.id !== id));
    // Also remove events from that source
    setEvents(p => p.filter(e => e.source_calendar_id !== id));
    if (isOnline) api.linkedCalendars.delete(id).catch(console.warn);
  }

  return {
    ready, events, allCategories, habits, linkedCalendars, tasks,
    addEvent, updateEvent, deleteEvent,
    addCategory, updateCategory, deleteCategory,
    addHabit, deleteHabit,
    addLinkedCalendar, deleteLinkedCalendar,
    addTask, updateTask, deleteTask, completeTask, uncompleteTask,
  };
}
