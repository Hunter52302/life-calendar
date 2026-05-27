import { storage } from './storage.js';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = storage.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    let msg = `${method} ${path} → ${res.status}`;
    try { const j = await res.json(); msg = j.error ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  auth: {
    status:      ()                    => request('GET',  '/auth/status'),
    setup:       (password)            => request('POST', '/auth/setup',     { password }),
    login:       (password)            => request('POST', '/auth/login',     { password }),
    enableZk:    (kdf_salt, zk_verify) => request('PUT',  '/auth/zk-enable', { kdf_salt, zk_verify }),
    setTimezone: (timezone)            => request('PUT',  '/auth/timezone',  { timezone }),
  },

  /** Full data snapshot — called once on startup */
  sync: () => request('GET', '/sync'),

  events: {
    create:           (event)             => request('POST',   '/events',                   event),
    update:           (id, updates)       => request('PUT',    `/events/${id}`,             updates),
    delete:           (id)                => request('DELETE', `/events/${id}`),
    batch:            (eventsArr)         => request('POST',   '/events/batch',             { events: eventsArr }),
    replaceBySource:  (source, eventsArr) => request('POST',   '/events/replace-by-source', { source, events: eventsArr }),
  },

  categories: {
    create:  (cat)            => request('POST',   '/categories',      cat),
    update:  (id, updates)    => request('PUT',    `/categories/${id}`, updates),
    delete:  (id)             => request('DELETE', `/categories/${id}`),
  },

  linkedCalendars: {
    create:  (cal)         => request('POST',   '/linked-calendars',      cal),
    update:  (id, updates) => request('PUT',    `/linked-calendars/${id}`, updates),
    delete:  (id)          => request('DELETE', `/linked-calendars/${id}`),
  },

  habits: {
    create:         (habit)     => request('POST',   '/habits',                     habit),
    update:         (id, upd)   => request('PUT',    `/habits/${id}`,               upd),
    delete:         (id)        => request('DELETE', `/habits/${id}`),
    complete:       (id, date, completionId) => request('POST', `/habits/${id}/complete`, { date, completionId }),
    uncomplete:     (id, date)  => request('DELETE', `/habits/${id}/complete/${date}`),
  },

  budgets: {
    set:    (categoryId, weeklyHours) => request('PUT',    `/budgets/${categoryId}`, { weeklyHours }),
    delete: (categoryId)              => request('DELETE', `/budgets/${categoryId}`),
  },

  integrations: {
    list:           ()         => request('GET',    '/integrations'),
    create:         (data)     => request('POST',   '/integrations',              data),
    update:         (id, data) => request('PUT',    `/integrations/${id}`,        data),
    delete:         (id)       => request('DELETE', `/integrations/${id}`),
    test:           (id)       => request('POST',   `/integrations/${id}/test`),
    listSchedules:  ()         => request('GET',    '/integrations/schedules'),
    createSchedule: (data)     => request('POST',   '/integrations/schedules',    data),
    updateSchedule: (id, data) => request('PUT',    `/integrations/schedules/${id}`, data),
    deleteSchedule: (id)       => request('DELETE', `/integrations/schedules/${id}`),
  },

  push: {
    getVapidKey: ()           => request('GET',    '/push/vapid-public-key'),
    subscribe:   (sub)        => request('POST',   '/push/subscribe',   { subscription: sub }),
    unsubscribe: (endpoint)   => request('DELETE', '/push/subscribe',   { endpoint }),
    expoToken:   (token)      => request('POST',   '/push/expo-token',  { token }),
  },

};
