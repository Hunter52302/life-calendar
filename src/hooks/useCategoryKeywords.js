import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { safeSetJSON } from '../lib/storage.js';

const STORAGE_KEY = 'lc-category-keywords';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

/** Read-only keyword→category map used to auto-suggest categories for parsed events. */
export function useCategoryKeywords(authState) {
  const [keywordMap, setKeywordMap] = useState(load);

  useEffect(() => { safeSetJSON(STORAGE_KEY, keywordMap); }, [keywordMap]);

  useEffect(() => {
    if (authState !== 'ready') return;
    api.sync().then(data => {
      if (data.categoryKeywords) setKeywordMap(data.categoryKeywords);
    }).catch(() => {});
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps

  return { keywordMap };
}
