// Web implementation — backed by localStorage.
// React Native uses mobile/src/lib/storage.js (SecureStore).

const TOKEN_KEY = 'lc-auth-token';

export const storage = {
  getToken:    ()      => localStorage.getItem(TOKEN_KEY),
  setToken:    (token) => localStorage.setItem(TOKEN_KEY, token),
  removeToken: ()      => localStorage.removeItem(TOKEN_KEY),
};

/**
 * Guarded localStorage writers. A full store throws QuotaExceededError on every
 * `setItem` — and many of these writes happen inside React effects (the commit
 * phase), where an uncaught throw tears down the render and crashes the app. The
 * data still lives in React state, so we log and continue, degrading to a stale
 * offline cache rather than a crash. Prefer these over raw localStorage.setItem.
 */
export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`Failed to persist "${key}" to localStorage (continuing):`, err);
  }
}

/** As safeSetItem, but JSON-encodes the value first. */
export function safeSetJSON(key, value) {
  safeSetItem(key, JSON.stringify(value));
}
