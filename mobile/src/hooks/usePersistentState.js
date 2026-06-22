import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** useState backed by AsyncStorage, mirroring the web app's usePersistentState. */
export function usePersistentState(key, initialValue) {
  const [ready, setReady] = useState(false);
  const [value, setValue] = useState(() => typeof initialValue === 'function' ? initialValue() : initialValue);

  useEffect(() => {
    AsyncStorage.getItem(key).then(raw => {
      if (raw !== null) {
        try { setValue(JSON.parse(raw)); } catch { setValue(raw); }
      }
      setReady(true);
    });
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
  }, [key, value, ready]);

  return [value, setValue];
}
