import { useState } from 'react';
import HabitHeatmap from './HabitHeatmap.jsx';

const PRESET_COLORS = [
  '#7C3AED','#3B82F6','#22C55E','#F59E0B','#EF4444',
  '#EC4899','#14B8A6','#F97316','#6B7280','#8B5CF6',
];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const FREQUENCY_PRESETS = [
  { label: 'Daily',    days: [0,1,2,3,4,5,6] },
  { label: 'Weekdays', days: [1,2,3,4,5] },
  { label: 'Weekends', days: [0,6] },
  { label: 'Custom',   days: null },
];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function AddHabitForm({ onSave, onCancel, initial }) {
  const [label,      setLabel]      = useState(initial?.label      ?? '');
  const [color,      setColor]      = useState(initial?.color      ?? PRESET_COLORS[0]);
  const [targetDays, setTargetDays] = useState(initial?.target_days ?? [0,1,2,3,4,5,6]);
  const [freqKey,    setFreqKey]    = useState('Daily');

  function applyPreset(p) {
    setFreqKey(p.label);
    if (p.days) setTargetDays(p.days);
  }

  function toggleDay(d) {
    setFreqKey('Custom');
    setTargetDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a,b)=>a-b));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!label.trim()) return;
    onSave({ label: label.trim(), color, target_days: targetDays });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3 border border-gray-200 dark:border-gray-700">
      <input
        autoFocus
        value={label} onChange={e => setLabel(e.target.value)}
        placeholder="Habit name (e.g. Exercise, Read, Meditate)"
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
      />

      {/* Color picker */}
      <div className="flex gap-1.5 flex-wrap">
        {PRESET_COLORS.map(c => (
          <button key={c} type="button" onClick={() => setColor(c)}
            style={{ backgroundColor: c }}
            className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`}
          />
        ))}
      </div>

      {/* Frequency */}
      <div>
        <div className="flex gap-1.5 mb-2">
          {FREQUENCY_PRESETS.filter(p => p.days).map(p => (
            <button key={p.label} type="button" onClick={() => applyPreset(p)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${freqKey === p.label ? 'bg-violet-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {DAY_LABELS.map((d, i) => (
            <button key={i} type="button" onClick={() => toggleDay(i)}
              className={`flex-1 py-1 rounded text-xs font-semibold transition-colors ${targetDays.includes(i) ? 'text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
              style={targetDays.includes(i) ? { backgroundColor: color } : {}}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
          Cancel
        </button>
        <button type="submit"
          className="flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: color }}>
          {initial ? 'Save' : 'Add Habit'}
        </button>
      </div>
    </form>
  );
}

export default function HabitTracker({ habitsWithStreaks, completions, onToggle, onAdd, onUpdate, onDelete }) {
  const [showAdd,   setShowAdd]   = useState(false);
  const [editingId, setEditingId] = useState(null);
  const todayStr = toDateStr(new Date());

  const today = new Date().getDay();
  const todaysHabits = habitsWithStreaks.filter(h => h.active && (h.target_days ?? [0,1,2,3,4,5,6]).includes(today));
  const otherHabits  = habitsWithStreaks.filter(h => h.active && !(h.target_days ?? [0,1,2,3,4,5,6]).includes(today));

  function handleAdd(data) {
    onAdd(data);
    setShowAdd(false);
  }

  function handleUpdate(id, data) {
    onUpdate(id, data);
    setEditingId(null);
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-700 mt-4 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wider">Habits</h3>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors">
            <span className="text-base leading-none">+</span> Add Habit
          </button>
        )}
      </div>

      {showAdd && <div className="mb-3"><AddHabitForm onSave={handleAdd} onCancel={() => setShowAdd(false)} /></div>}

      {habitsWithStreaks.length === 0 && !showAdd && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
          No habits yet. Add one to start tracking your daily routines.
        </p>
      )}

      {/* Today's habits */}
      {todaysHabits.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {todaysHabits.map(habit => (
            <HabitRow
              key={habit.id}
              habit={habit}
              isEditing={editingId === habit.id}
              onToggle={() => onToggle(habit.id, todayStr)}
              onEdit={() => setEditingId(habit.id)}
              onUpdate={data => handleUpdate(habit.id, data)}
              onCancelEdit={() => setEditingId(null)}
              onDelete={() => onDelete(habit.id)}
            />
          ))}
        </div>
      )}

      {/* Non-today habits */}
      {otherHabits.length > 0 && (
        <div className="space-y-1.5 mb-2 opacity-60">
          <p className="text-xs text-gray-400 dark:text-gray-500 px-1 pt-1">Not scheduled today</p>
          {otherHabits.map(habit => (
            <HabitRow
              key={habit.id}
              habit={habit}
              isEditing={editingId === habit.id}
              onToggle={null}
              onEdit={() => setEditingId(habit.id)}
              onUpdate={data => handleUpdate(habit.id, data)}
              onCancelEdit={() => setEditingId(null)}
              onDelete={() => onDelete(habit.id)}
            />
          ))}
        </div>
      )}

      {/* Heatmap */}
      {habitsWithStreaks.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">Last {15} weeks</p>
          <HabitHeatmap habits={habitsWithStreaks} completions={completions} />
        </div>
      )}
    </div>
  );
}

function HabitRow({ habit, isEditing, onToggle, onEdit, onUpdate, onCancelEdit, onDelete }) {
  if (isEditing) {
    return (
      <AddHabitForm
        initial={habit}
        onSave={data => onUpdate(data)}
        onCancel={onCancelEdit}
      />
    );
  }

  return (
    <div className="flex items-center gap-3 px-1 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
      {/* Check circle */}
      <button
        onClick={onToggle}
        disabled={!onToggle}
        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
          habit.completedToday
            ? 'border-transparent'
            : onToggle
              ? 'border-gray-300 dark:border-gray-600 hover:border-opacity-80'
              : 'border-gray-200 dark:border-gray-700'
        }`}
        style={habit.completedToday ? { backgroundColor: habit.color, borderColor: habit.color } : {}}
        title={habit.completedToday ? 'Mark incomplete' : 'Mark complete'}
      >
        {habit.completedToday && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Color dot + label */}
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${habit.completedToday ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
          {habit.label}
        </span>
      </div>

      {/* Streak */}
      {habit.currentStreak > 0 && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden" style={{ width: Math.min(habit.currentStreak * 4, 48) }}>
            <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: habit.color }} />
          </div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 tabular-nums">{habit.currentStreak}d</span>
          {habit.milestone && <span className="text-sm leading-none">{habit.milestone}</span>}
        </div>
      )}

      {/* Edit / delete — visible on hover */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={onEdit} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500" title="Edit">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" />
          </svg>
        </button>
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-gray-500 hover:text-red-500" title="Delete">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
