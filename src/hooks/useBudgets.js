import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { safeSetJSON } from '../lib/storage.js';

const STORAGE_KEY = 'lc-budgets';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

export function useBudgets(authState) {
  const [budgets, setBudgetsState] = useState(load);

  useEffect(() => { safeSetJSON(STORAGE_KEY, budgets); }, [budgets]);

  useEffect(() => {
    if (authState !== 'ready') return;
    api.sync().then(data => {
      if (data.budgets) setBudgetsState(data.budgets);
    }).catch(() => {});
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOnline = authState === 'ready';

  function setBudget(categoryId, weeklyHours) {
    setBudgetsState(prev => ({ ...prev, [categoryId]: weeklyHours }));
    if (isOnline) api.budgets.set(categoryId, weeklyHours).catch(console.warn);
  }

  function deleteBudget(categoryId) {
    setBudgetsState(prev => { const next = { ...prev }; delete next[categoryId]; return next; });
    if (isOnline) api.budgets.delete(categoryId).catch(console.warn);
  }

  return { budgets, setBudget, deleteBudget };
}
