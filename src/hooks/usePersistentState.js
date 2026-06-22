import { useState, useEffect } from 'react';

/**
 * useState backed by localStorage. Reads are JSON-parsed; if parsing fails
 * (e.g. a legacy raw string written before this hook existed), the raw
 * string is used as-is. Writing `null`/`undefined` removes the key instead
 * of persisting it, so callers can "unset" a value the same way the old
 * per-field effects did for things like a cleared custom font.
 */
export function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key);
    if (stored === null) return typeof initialValue === 'function' ? initialValue() : initialValue;
    try { return JSON.parse(stored); } catch { return stored; }
  });

  useEffect(() => {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}
