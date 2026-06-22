import { storage } from './storage.js';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

const ADMIN_TOKEN_KEY = 'lc-admin-token';

async function adminRequest(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401 || res.status === 403) {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    const err = new Error('Admin session expired');
    err.adminExpired = true;
    throw err;
  }
  if (!res.ok) {
    let msg = `${method} ${path} → ${res.status}`;
    try { const j = await res.json(); msg = j.error ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

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
    register:    (email, password, kdf_salt, zk_verify, turnstile_token) =>
                   request('POST', '/auth/register', { email, password, kdf_salt, zk_verify, turnstile_token }),
    login:       (email, password)     => request('POST', '/auth/login',     { email, password }),
    setEmail:    (email)               => request('PUT',  '/auth/email',     { email }),
    enableZk:    (kdf_salt, zk_verify) => request('PUT',  '/auth/zk-enable', { kdf_salt, zk_verify }),
    setTimezone: (timezone)            => request('PUT',  '/auth/timezone',  { timezone }),
  },

  admin: {
    listUsers:      ()                => request('GET',    '/admin/users'),
    resetPassword:  (id, newPassword) => request('POST',   `/admin/users/${id}/reset-password`, { newPassword }),
    setBlocked:     (id, blocked)     => request('PUT',    `/admin/users/${id}/block`, { blocked }),
    deleteUser:     (id)              => request('DELETE', `/admin/users/${id}`),
    auditLog:       ()                => request('GET',    '/admin/audit-log'),
    signupClusters: ()                => request('GET',    '/admin/signup-clusters'),

    auth:            (password)        => request('POST',   '/admin/auth',             { password }),
    infisicalStatus: ()                => adminRequest('GET',    '/admin/infisical/status'),
    listSecrets:     ()                => adminRequest('GET',    '/admin/secrets'),
    createSecret:    (data)            => adminRequest('POST',   '/admin/secrets',          data),
    updateSecret:    (key, data)       => adminRequest('PUT',    `/admin/secrets/${key}`,    data),
    rotateSecret:    (key, data)       => adminRequest('POST',   `/admin/secrets/${key}/rotate`, data),
    restoreSecret:   (key)             => adminRequest('POST',   `/admin/secrets/${key}/restore`),
    deleteSecret:    (key)             => adminRequest('DELETE', `/admin/secrets/${key}`),
    storeAdminToken: (token)           => sessionStorage.setItem(ADMIN_TOKEN_KEY, token),
    clearAdminToken: ()                => sessionStorage.removeItem(ADMIN_TOKEN_KEY),
    hasAdminToken:   ()                => !!sessionStorage.getItem(ADMIN_TOKEN_KEY),
  },

  driveTime: {
    calc: (origin, destination) => request('POST', '/drive-time', { origin, destination }),
  },

  /** Full data snapshot — called once on startup */
  sync: () => request('GET', '/sync'),

  events: {
    create:           (event)             => request('POST',   '/events',                   event),
    update:           (id, updates)       => request('PUT',    `/events/${id}`,             updates),
    delete:           (id)                => request('DELETE', `/events/${id}`),
    batch:            (eventsArr)         => request('POST',   '/events/batch',             { events: eventsArr }),
    replaceBySource:  (source, eventsArr) => request('POST',   '/events/replace-by-source', { source, events: eventsArr }),
    replaceBySourceCalendar: (sourceCalendarId, eventsArr) =>
      request('POST', '/events/replace-by-source-calendar', { sourceCalendarId, events: eventsArr }),
  },

  ical: {
    fetch: (url) => request('POST', '/ical-fetch', { url }),
  },

  feed: {
    status:  () => request('GET',    '/feed/status'),
    enable:  () => request('POST',   '/feed/enable'),
    disable: () => request('DELETE', '/feed'),
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

  profile: {
    get: ()     => request('GET', '/profile'),
    set: (data) => request('PUT', '/profile', data),
  },

  categoryKeywords: {
    get: () => request('GET', '/category-keywords'),
  },

  llmSettings: {
    get: ()     => request('GET', '/llm-settings'),
    set: (data) => request('PUT', '/llm-settings', data),
  },

};
