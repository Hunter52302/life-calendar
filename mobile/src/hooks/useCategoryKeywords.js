import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api.js';

const STORAGE_KEY = 'lc-m-category-keywords';

async function asyncLoad() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/** Read-only keyword→category map used to auto-suggest categories for parsed events. */
export function useCategoryKeywords(authState) {
  const [keywordMap, setKeywordMap] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    asyncLoad().then(m => { setKeywordMap(m); setReady(true); });
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(keywordMap)).catch(() => {});
  }, [keywordMap, ready]);

  useEffect(() => {
    if (authState !== 'ready' || !ready) return;
    api.sync().then(data => {
      if (data.categoryKeywords) setKeywordMap(data.categoryKeywords);
    }).catch(() => {});
  }, [authState, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return { keywordMap };
}
