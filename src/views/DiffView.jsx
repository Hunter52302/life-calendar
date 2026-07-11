import { useState, useMemo, useEffect } from 'react';
import { computeDiff } from '../lib/diffEngine';
import DiffSummary from '../components/DiffSummary';
import DiffDayBars from '../components/DiffDayBars';
import HabitTracker from '../components/HabitTracker';
import { addDays, todayStr, getWeekStart } from '../lib/utils';

// Named presets — id is what gets stored in activePreset
const NAMED_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'This Week' },
];
// Past-range presets shown inside the dropdown
const PAST_PRESETS = [
  { id: 30,  label: 'Past 30 days' },
  { id: 60,  label: 'Past 60 days' },
  { id: 90,  label: 'Past 90 days' },
  { id: 120, label: 'Past 120 days' },
  { id: 180, label: 'Past 6 months' },
  { id: 365, label: 'Past 1 year' },
];

function presetDates(id) {
  const today = todayStr();
  if (id === 'today') return { start: today, end: today };
  if (id === 'week')  return { start: getWeekStart(), end: today };
  // numeric: past N days
  return { start: addDays(today, -(id - 1)), end: today };
}

export default function DiffView({ planEvents, actualEvents, allCategories, linkedCalendars = [], onDiffChange, budgets = {}, habitsWithStreaks = [], completions = [], onToggleHabit, onAddHabit, onUpdateHabit, onDeleteHabit }) {
  const init = presetDates(30);
  const [startDate, setStartDate] = useState(init.start);
  const [endDate, setEndDate] = useState(init.end);
  const [activePreset, setActivePreset] = useState(30);
  const [showPastMenu, setShowPastMenu] = useState(false);

  function applyPreset(id) {
    const { start, end } = presetDates(id);
    setStartDate(start);
    setEndDate(end);
    setActivePreset(id);
  }

  // IDs of linked calendars the user has opted out of Reality Check
  const excludedCalIds = useMemo(
    () => new Set(linkedCalendars.filter(c => c.excludeFromReality).map(c => c.id)),
    [linkedCalendars]
  );

  const filteredPlan = useMemo(() =>
    planEvents.filter(e => {
      if (excludedCalIds.has(e.source_calendar_id)) return false;
      const d = addDays(e.week_start, e.day_of_week);
      return d >= startDate && d <= endDate;
    }),
    [planEvents, startDate, endDate, excludedCalIds]
  );

  const filteredActual = useMemo(() =>
    actualEvents.filter(e => {
      if (excludedCalIds.has(e.source_calendar_id)) return false;
      const d = addDays(e.week_start, e.day_of_week);
      return d >= startDate && d <= endDate;
    }),
    [actualEvents, startDate, endDate, excludedCalIds]
  );

  const diff = useMemo(
    () => computeDiff(filteredPlan, filteredActual, allCategories),
    [filteredPlan, filteredActual, allCategories]
  );

  useEffect(() => {
    onDiffChange?.({ diff, startDate, endDate });
  }, [diff, startDate, endDate]);

  return (
    <div className="lc-surface overflow-y-auto h-full dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6 space-y-8">

        {/* Date range controls */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Today / This Week — always visible */}
            {NAMED_PRESETS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => applyPreset(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activePreset === id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}

            {/* Divider */}
            <span className="self-center w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />

            {/* Past-range dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPastMenu(s => !s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  PAST_PRESETS.some(p => p.id === activePreset)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {PAST_PRESETS.find(p => p.id === activePreset)?.label ?? 'Past…'}
                <svg
                  className={`w-3 h-3 transition-transform flex-shrink-0 ${showPastMenu ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showPastMenu && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setShowPastMenu(false)} />
                  <div className="absolute left-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-[70]">
                    {PAST_PRESETS.map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { applyPreset(id); setShowPastMenu(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          activePreset === id
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Custom date range pickers */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setActivePreset(null); }}
              className="border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400 dark:text-gray-500 text-sm">→</span>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setActivePreset(null); }}
              className="border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <section>
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Summary
          </h2>
          <DiffSummary diff={diff} budgets={budgets} />
        </section>

        {Object.keys(diff.byDay).length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Day-by-Day Breakdown
            </h2>
            <DiffDayBars diff={diff} />
          </section>
        )}

        <section>
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Habit Tracker
          </h2>
          <HabitTracker
            habitsWithStreaks={habitsWithStreaks}
            completions={completions}
            onToggle={onToggleHabit}
            onAdd={onAddHabit}
            onUpdate={onUpdateHabit}
            onDelete={onDeleteHabit}
          />
        </section>
      </div>
    </div>
  );
}
