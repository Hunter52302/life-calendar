import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { safeSetJSON } from '../lib/storage.js';

const INTEGRATIONS_KEY = 'lc-integrations';
const SCHEDULES_KEY    = 'lc-notification-schedules';

function load(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}

export function useIntegrations(authState) {
  const [integrations, setIntegrations] = useState(() => load(INTEGRATIONS_KEY, []));
  const [schedules,    setSchedules]    = useState(() => load(SCHEDULES_KEY, []));

  useEffect(() => { safeSetJSON(INTEGRATIONS_KEY, integrations); }, [integrations]);
  useEffect(() => { safeSetJSON(SCHEDULES_KEY,    schedules);    }, [schedules]);

  useEffect(() => {
    if (authState !== 'ready') return;
    api.sync().then(data => {
      if (data.integrations) setIntegrations(data.integrations);
      if (data.schedules)    setSchedules(data.schedules);
    }).catch(() => {});
  }, [authState]);

  const isOnline = authState === 'ready';

  async function addIntegration(data) {
    if (!isOnline) return;
    const created = await api.integrations.create(data);
    setIntegrations(prev => [...prev, created]);
    return created;
  }

  function updateIntegration(id, updates) {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    if (isOnline) api.integrations.update(id, updates).catch(console.warn);
  }

  function deleteIntegration(id) {
    setIntegrations(prev => prev.filter(i => i.id !== id));
    if (isOnline) api.integrations.delete(id).catch(console.warn);
  }

  async function testIntegration(id) {
    return api.integrations.test(id);
  }

  async function addSchedule(data) {
    if (!isOnline) return;
    const created = await api.integrations.createSchedule(data);
    setSchedules(prev => [...prev, created]);
    return created;
  }

  function updateSchedule(id, updates) {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    if (isOnline) api.integrations.updateSchedule(id, updates).catch(console.warn);
  }

  function deleteSchedule(id) {
    setSchedules(prev => prev.filter(s => s.id !== id));
    if (isOnline) api.integrations.deleteSchedule(id).catch(console.warn);
  }

  // Register or refresh the browser push subscription
  async function subscribePush() {
    const vapidRes = await api.push.getVapidKey();
    const { publicKey } = await vapidRes;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await api.push.subscribe(sub.toJSON());
  }

  async function unsubscribePush() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api.push.unsubscribe(sub.endpoint);
      await sub.unsubscribe();
    }
  }

  return {
    integrations, schedules,
    addIntegration, updateIntegration, deleteIntegration, testIntegration,
    addSchedule, updateSchedule, deleteSchedule,
    subscribePush, unsubscribePush,
  };
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
