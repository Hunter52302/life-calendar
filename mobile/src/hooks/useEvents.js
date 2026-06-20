import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId, DEFAULT_CATEGORIES } from '../lib/utils.js';
import { api } from '../lib/api.js';
import { encryptRecord, decryptRecord } from '../lib/cryptoRecord.js';

const EVENTS_KEY = 'lc-m-events';
const CATS_KEY   = 'lc-m-categories';
const OVRS_KEY   = 'lc-m-overrides';

async function asyncLoad(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function useEvents(authState, masterKey = null, isZkEnabled = false) {
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

  // Local state holds plaintext; the server only sees ciphertext when ZK is on.
  const zkActive = isZkEnabled && masterKey;

  async function encryptEventForApi(event) {
    return zkActive ? encryptRecord(masterKey, event, ['label', 'notes']) : event;
  }

  async function encryptCategoryForApi(cat) {
    return zkActive ? encryptRecord(masterKey, cat, ['label']) : cat;
  }

  async function decryptCategories(serverCats) {
    return zkActive ? Promise.all(serverCats.map(c => decryptRecord(masterKey, c, ['label']))) : serverCats;
  }

  async function decryptOverrides(serverOverrides) {
    if (!zkActive) return serverOverrides;
    const entries = await Promise.all(Object.entries(serverOverrides).map(
      async ([id, ovr]) => [id, await decryptRecord(masterKey, ovr, ['label'])]
    ));
    return Object.fromEntries(entries);
  }

  // Sync from backend when authenticated (and, for ZK accounts, unlocked)
  useEffect(() => {
    if ((authState !== 'ready') || !ready) return;
    if (isZkEnabled && !masterKey) return;
    api.sync()
      .then(async data => {
        const evs = zkActive
          ? await Promise.all(data.events.map(e => decryptRecord(masterKey, e, ['label', 'notes'])))
          : data.events;
        setEvents(evs);
        setCustomCats(await decryptCategories(data.customCategories));
        setOverrides(await decryptOverrides(data.categoryOverrides));
      })
      .catch(() => {});
  }, [authState, ready, isZkEnabled, masterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const allCategories = [
    ...DEFAULT_CATEGORIES.map(dc => ({ ...dc, ...(overrides[dc.id] || {}) })),
    ...customCats,
  ];

  const isOnline = authState === 'ready';

  function addEvent(data) {
    const ev = { ...data, id: generateId() };
    setEvents(p => [...p, ev]);
    if (isOnline) encryptEventForApi(ev).then(p => api.events.create(p)).catch(console.warn);
  }

  function updateEvent(id, updates) {
    setEvents(p => p.map(e => e.id === id ? { ...e, ...updates } : e));
    if (isOnline) encryptEventForApi(updates).then(p => api.events.update(id, p)).catch(console.warn);
  }

  function deleteEvent(id) {
    setEvents(p => p.filter(e => e.id !== id));
    if (isOnline) api.events.delete(id).catch(console.warn);
  }

  function addCategory(cat) {
    const newCat = { ...cat, id: generateId() };
    setCustomCats(p => [...p, newCat]);
    if (isOnline) encryptCategoryForApi(newCat).then(p => api.categories.create(p)).catch(console.warn);
  }

  return { ready, events, allCategories, addEvent, updateEvent, deleteEvent, addCategory };
}
