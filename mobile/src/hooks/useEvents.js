import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId, DEFAULT_CATEGORIES } from '../lib/utils.js';
import { api } from '../lib/api.js';

const EVENTS_KEY = 'lc-m-events';
const CATS_KEY   = 'lc-m-categories';
const OVRS_KEY   = 'lc-m-overrides';

async function asyncLoad(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function useEvents(authState) {
  const [ready, setReady]       = useState(false);
  const [events, setEvents]     = useState([]);
  const [customCats, setCustomCats] = useState([]);
  const [overrides, setOverrides]   = useState({});

  useEffect(() => {
    Promise.all([
      asyncLoad(EVENTS_KEY, []),
      asyncLoad(CATS_KEY, []),
      asyncLoad(OVRS_KEY, {}),
    ]).then(([e, c, o]) => {
      setEvents(e);
      setCustomCats(c);
      setOverrides(o);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events)).catch(() => {});
  }, [events, ready]);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(CATS_KEY, JSON.stringify(customCats)).catch(() => {});
  }, [customCats, ready]);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(OVRS_KEY, JSON.stringify(overrides)).catch(() => {});
  }, [overrides, ready]);

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

  function addCategory(cat) {
    const newCat = { ...cat, id: generateId() };
    setCustomCats(p => [...p, newCat]);
    if (isOnline) api.categories.create(newCat).catch(console.warn);
  }

  return { ready, events, allCategories, addEvent, updateEvent, deleteEvent, addCategory };
}
