import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId, DEFAULT_CATEGORIES } from '../lib/utils.js';
import { api } from '../lib/api.js';
import { encryptField, decryptField, DECRYPT_FAILURE_PLACEHOLDER } from '../lib/crypto.js';

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
    if (!zkActive) return event;
    const out = { ...event };
    if ('label' in out && out.label) out.label = await encryptField(masterKey, out.label);
    if ('notes' in out && out.notes) out.notes = await encryptField(masterKey, out.notes);
    return out;
  }

  // Sync from backend when authenticated (and, for ZK accounts, unlocked)
  useEffect(() => {
    if ((authState !== 'ready') || !ready) return;
    if (isZkEnabled && !masterKey) return;
    api.sync()
      .then(async data => {
        const evs = zkActive
          ? await Promise.all(data.events.map(async e => ({
              ...e,
              label: e.label ? (await decryptField(masterKey, e.label)) ?? DECRYPT_FAILURE_PLACEHOLDER : e.label,
              notes: e.notes ? (await decryptField(masterKey, e.notes)) ?? DECRYPT_FAILURE_PLACEHOLDER : e.notes,
            })))
          : data.events;
        setEvents(evs);
        setCustomCats(data.customCategories);
        setOverrides(data.categoryOverrides);
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
    if (isOnline) api.categories.create(newCat).catch(console.warn);
  }

  return { ready, events, allCategories, addEvent, updateEvent, deleteEvent, addCategory };
}
