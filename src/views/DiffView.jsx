import { useState, useMemo, useEffect } from 'react';
import { computeDiff } from '../lib/diffEngine';
import DiffSummary from '../components/DiffSummary';
import DiffDayBars from '../components/DiffDayBars';
import { addDays, todayStr, getWeekStart } from '../lib/utils';

// Named presets — id is what gets stored in activePreset
const NAMED_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'week',  label: 'This Week' },
];
const DAY_PRESETS = [30, 60, 90, 120];

function presetDates(id) {
  const today = todayStr();
  if (id === 'today') return { start: today, end: today };
  if (id === 'week')  return { start: getWeekStart(), end: today };
  // numeric: past N days
  return { start: addDays(today, -(id - 1)), end: today };
}

export default function DiffView({ planEvents, actualEvents, allCategories, linkedCalendars = [], onDiffChange }) {
  const init = presetDates(30);
  const [startDate, setStartDate] = useState(init.start);
  const [endDate, setEndDate] = useState(init.end);
  const [activePreset, setActivePreset] = useState(30);

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
    <div className="overflow-y-auto h-full dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-6 space-y-8">

        {/* Date range controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5 flex-wrap">
            {/* Today / This Week */}
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
            <span className="self-center w-px h-4 bg-gray-200 dark:bg-gray-700" />
            {/* Past N days */}
            {DAY_PRESETS.map(days => (
              <button
                key={days}
                type="button"
                onClick={() => applyPreset(days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activePreset === days
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Past {days} days
              </button>
            ))}
          </div>
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
          <DiffSummary diff={diff} />
        </section>

        {Object.keys(diff.byDay).length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              Day-by-Day Breakdown
            </h2>
            <DiffDayBars diff={diff} />
          </section>
        )}
      </div>
    </div>
  );
}
