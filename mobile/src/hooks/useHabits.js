import { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId } from '../lib/utils.js';
import { api } from '../lib/api.js';
import { encryptRecord, decryptRecord } from '../lib/cryptoRecord.js';

const HABITS_KEY      = 'lc-m-habits';
const COMPLETIONS_KEY = 'lc-m-habit-completions';

async function asyncLoad(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/** Same streak algorithm as the web's useHabits. */
function computeStreak(completionDates, targetDays) {
  if (!completionDates.length) return { current: 0, longest: 0 };
  const set = new Set(completionDates);
  const today = new Date(); today.setHours(0,0,0,0);
  let current = 0, longest = 0, streak = 0;
  let cursor = new Date(today);

  for (let i = 0; i < 730; i++) {
    const dayOfWeek = cursor.getDay();
    if (targetDays.includes(dayOfWeek)) {
      if (set.has(toDateStr(cursor))) {
        streak++;
        longest = Math.max(longest, streak);
        if (i < 2 || current > 0) current = streak;
      } else if (i !== 0) {
        if (current === 0) current = streak;
        streak = 0;
      }
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  if (current === 0) current = streak;
  return { current, longest };
}

function getMilestone(streak) {
  if (streak >= 365) return '👑';
  if (streak >= 100) return '💎';
  if (streak >= 30)  return '⭐';
  if (streak >= 7)   return '🔥';
  return null;
}

export function useHabits(authState, masterKey = null, isZkEnabled = false) {
  const [ready, setReady]             = useState(false);
  const [habits, setHabits]           = useState([]);
  const [completions, setCompletions] = useState([]);

  useEffect(() => {
    Promise.all([asyncLoad(HABITS_KEY, []), asyncLoad(COMPLETIONS_KEY, [])])
      .then(([h, c]) => { setHabits(h); setCompletions(c); setReady(true); });
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits)).catch(() => {});
  }, [habits, ready]);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(COMPLETIONS_KEY, JSON.stringify(completions)).catch(() => {});
  }, [completions, ready]);

  const zkActive = isZkEnabled && masterKey;

  async function encryptHabitForApi(habit) {
    return zkActive ? encryptRecord(masterKey, habit, ['label']) : habit;
  }

  useEffect(() => {
    if (authState !== 'ready' || !ready) return;
    if (isZkEnabled && !masterKey) return;
    api.sync().then(async data => {
      if (data.habits) {
        const decrypted = zkActive
          ? await Promise.all(data.habits.map(h => decryptRecord(masterKey, h, ['label'])))
          : data.habits;
        setHabits(decrypted);
      }
      if (data.habitCompletions) setCompletions(data.habitCompletions);
    }).catch(() => {});
  }, [authState, ready, isZkEnabled, masterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOnline = authState === 'ready';
  const todayStr = toDateStr(new Date());

  const habitsWithStreaks = useMemo(() => {
    return habits.map(habit => {
      const habitDates = completions.filter(c => c.habit_id === habit.id).map(c => c.date);
      const { current, longest } = computeStreak(habitDates, habit.target_days ?? [0,1,2,3,4,5,6]);
      return {
        ...habit,
        currentStreak:  current,
        longestStreak:  longest,
        completedToday: completions.some(c => c.habit_id === habit.id && c.date === todayStr),
        milestone:      getMilestone(current),
      };
    });
  }, [habits, completions, todayStr]);

  function addHabit(data) {
    const habit = { ...data, id: generateId(), active: true, target_days: data.target_days ?? [0,1,2,3,4,5,6] };
    setHabits(prev => [...prev, habit]);
    if (isOnline) encryptHabitForApi(habit).then(p => api.habits.create(p)).catch(console.warn);
  }

  function deleteHabit(id) {
    setHabits(prev => prev.filter(h => h.id !== id));
    setCompletions(prev => prev.filter(c => c.habit_id !== id));
    if (isOnline) api.habits.delete(id).catch(console.warn);
  }

  function toggleCompletion(habitId, dateStr = todayStr) {
    const existing = completions.find(c => c.habit_id === habitId && c.date === dateStr);
    if (existing) {
      setCompletions(prev => prev.filter(c => !(c.habit_id === habitId && c.date === dateStr)));
      if (isOnline) api.habits.uncomplete(habitId, dateStr).catch(console.warn);
    } else {
      const id = generateId();
      setCompletions(prev => [...prev, { id, habit_id: habitId, date: dateStr }]);
      if (isOnline) api.habits.complete(habitId, dateStr, id).catch(console.warn);
    }
  }

  return { habits, habitsWithStreaks, completions, addHabit, deleteHabit, toggleCompletion };
}
