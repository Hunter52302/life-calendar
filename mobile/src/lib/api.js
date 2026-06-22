// Async-first API client for the mobile app.
// Uses expo-secure-store for token retrieval (async, unlike web localStorage).

import { storage } from './storage.js';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = await storage.getToken();
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
  health: () => request('GET', '/health'),

  auth: {
    status:   ()         => request('GET',  '/auth/status'),
    setup:    (password) => request('POST', '/auth/setup', { password }),
    login:    (email, password) => request('POST', '/auth/login', { email, password }),
    register: (email, password, kdf_salt, zk_verify) =>
                request('POST', '/auth/register', { email, password, kdf_salt, zk_verify }),
  },

  sync: () => request('GET', '/sync'),

  events: {
    create:          (event)             => request('POST',   '/events',                   event),
    update:          (id, updates)       => request('PUT',    `/events/${id}`,             updates),
    delete:          (id)                => request('DELETE', `/events/${id}`),
    batch:           (eventsArr)         => request('POST',   '/events/batch',             { events: eventsArr }),
    replaceBySource: (source, eventsArr) => request('POST',   '/events/replace-by-source', { source, events: eventsArr }),
  },

  categories: {
    create:  (cat)         => request('POST',   '/categories',       cat),
    update:  (id, updates) => request('PUT',    `/categories/${id}`, updates),
    delete:  (id)          => request('DELETE', `/categories/${id}`),
  },

  linkedCalendars: {
    create:  (cal)         => request('POST',   '/linked-calendars',       cal),
    update:  (id, updates) => request('PUT',    `/linked-calendars/${id}`, updates),
    delete:  (id)          => request('DELETE', `/linked-calendars/${id}`),
  },

  habits: {
    create:     (habit)    => request('POST',   '/habits',       habit),
    update:     (id, upd)  => request('PUT',    `/habits/${id}`, upd),
    delete:     (id)       => request('DELETE', `/habits/${id}`),
    complete:   (id, date, completionId) => request('POST', `/habits/${id}/complete`, { date, completionId }),
    uncomplete: (id, date) => request('DELETE', `/habits/${id}/complete/${date}`),
  },

  profile: {
    get: ()     => request('GET', '/profile'),
    set: (data) => request('PUT', '/profile', data),
  },

  budgets: {
    set:    (categoryId, weeklyHours) => request('PUT',    `/budgets/${categoryId}`, { weeklyHours }),
    delete: (categoryId)              => request('DELETE', `/budgets/${categoryId}`),
  },

  categoryKeywords: {
    get: () => request('GET', '/category-keywords'),
  },

  llmSettings: {
    get: ()     => request('GET', '/llm-settings'),
    set: (data) => request('PUT', '/llm-settings', data),
  },
};
