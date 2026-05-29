import { useState, useEffect, useMemo } from 'react';
import { generateId } from '../lib/utils.js';
import { api } from '../lib/api.js';

const HABITS_KEY      = 'lc-habits';
const COMPLETIONS_KEY = 'lc-habit-completions';

function load(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function computeStreak(completionDates, targetDays) {
  if (!completionDates.length) return { current: 0, longest: 0 };
  const set = new Set(completionDates);
  const today = new Date(); today.setHours(0,0,0,0);
  let current = 0, longest = 0, streak = 0;
  let cursor = new Date(today);

  // Walk back up to 2 years
  for (let i = 0; i < 730; i++) {
    const dayOfWeek = cursor.getDay();
    if (targetDays.includes(dayOfWeek)) {
      if (set.has(toDateStr(cursor))) {
        streak++;
        longest = Math.max(longest, streak);
        if (i < 2 || current > 0) current = streak; // still active streak
      } else {
        if (i === 0) {
          // today not done yet — streak still alive if yesterday was done
        } else {
          if (current === 0) current = streak; // first miss ends current streak
          streak = 0;
        }
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

export function useHabits(authState) {
  const [habits,      setHabits]      = useState(() => load(HABITS_KEY, []));
  const [completions, setCompletions] = useState(() => load(COMPLETIONS_KEY, []));

  useEffect(() => { localStorage.setItem(HABITS_KEY,      JSON.stringify(habits));      }, [habits]);
  useEffect(() => { localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(completions)); }, [completions]);

  useEffect(() => {
    if (authState !== 'ready') return;
    api.sync().then(data => {
      if (data.habits)           setHabits(data.habits);
      if (data.habitCompletions) setCompletions(data.habitCompletions);
    }).catch(() => {});
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOnline = authState === 'ready';
  const todayStr = toDateStr(new Date());

  const habitsWithStreaks = useMemo(() => {
    return habits.map(habit => {
      const habitDates = completions
        .filter(c => c.habit_id === habit.id)
        .map(c => c.date);
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
    if (isOnline) api.habits.create(habit).catch(console.warn);
  }

  function updateHabit(id, updates) {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
    if (isOnline) api.habits.update(id, updates).catch(console.warn);
  }

  function deleteHabit(id) {
    setHabits(prev => prev.filter(h => h.id !== id));
    setCompletions(prev => prev.filter(c => c.habit_id !== id));
    if (isOnline) api.habits.delete(id).catch(console.warn);
  }

  function toggleCompletion(habitId, dateStr) {
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

  return { habits, habitsWithStreaks, completions, addHabit, updateHabit, deleteHabit, toggleCompletion };
}
