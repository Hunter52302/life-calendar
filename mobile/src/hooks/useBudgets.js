import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api.js';

const STORAGE_KEY = 'lc-m-budgets';

async function asyncLoad() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function useBudgets(authState) {
  const [budgets, setBudgetsState] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    asyncLoad().then(b => { setBudgetsState(b); setReady(true); });
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(budgets)).catch(() => {});
  }, [budgets, ready]);

  useEffect(() => {
    if (authState !== 'ready' || !ready) return;
    api.sync().then(data => {
      if (data.budgets) setBudgetsState(data.budgets);
    }).catch(() => {});
  }, [authState, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOnline = authState === 'ready';

  function setBudget(categoryId, weeklyHours) {
    setBudgetsState(prev => ({ ...prev, [categoryId]: weeklyHours }));
    if (isOnline) api.budgets.set(categoryId, weeklyHours).catch(console.warn);
  }

  function deleteBudget(categoryId) {
    setBudgetsState(prev => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
    if (isOnline) api.budgets.delete(categoryId).catch(console.warn);
  }

  return { budgets, setBudget, deleteBudget };
}
