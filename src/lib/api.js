/**
 * Thin HTTP client for the PLS Calendar API.
 * All requests automatically include the stored auth token.
 * Throws on non-2xx responses so callers can catch network/auth errors.
 */

const BASE = '/api';

function getToken() {
  return localStorage.getItem('lc-auth-token');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
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
    status:  ()         => request('GET',  '/auth/status'),
    setup:   (password) => request('POST', '/auth/setup',  { password }),
    login:   (password) => request('POST', '/auth/login',  { password }),
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
};
