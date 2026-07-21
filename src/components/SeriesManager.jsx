import { useMemo, useState } from 'react';
import { getEventDate, slotToTime, hoursToLabel } from '../lib/utils';

// Weekday short names, indexed by day_of_week (0 = Sunday).
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Pretty "Jul 21, 2026" from a YYYY-MM-DD string, in local time. */
function prettyDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Group the user's authored recurring events into series.
 *
 * Only plan-calendar events the user created (no `source_calendar_id`) are
 * considered: imported-calendar recurrences are owned by their subscription and
 * would be reset on the next sync, and auto-completed "actual" copies just
 * mirror their plan parent — including either would double-count occurrences.
 */
function groupSeries(events) {
  const map = new Map();
  for (const e of events) {
    if (!e.series_id || e.deleted) continue;
    if (e.calendar !== 'plan' || e.source_calendar_id) continue;
    if (!map.has(e.series_id)) map.set(e.series_id, []);
    map.get(e.series_id).push(e);
  }
  const out = [];
  for (const [id, occ] of map) {
    if (occ.length < 2) continue; // a lone occurrence isn't really a series
    occ.sort((a, b) =>
      getEventDate(a).localeCompare(getEventDate(b)) || (a.slot_start ?? 0) - (b.slot_start ?? 0));
    const anchor = occ[0];
    const days = [...new Set(occ.map(e => e.day_of_week))].sort((a, b) => a - b);
    out.push({
      id, anchor, occ,
      count: occ.length,
      first: getEventDate(occ[0]),
      last: getEventDate(occ[occ.length - 1]),
      days,
    });
  }
  out.sort((a, b) => (a.anchor.label || '').localeCompare(b.anchor.label || ''));
  return out;
}

function SeriesRow({ series, allCategories, militaryTime, isOpen, onToggle, onUpdateSeries, onDeleteSeries }) {
  const { anchor, occ, count, first, last, days } = series;
  const [name, setName] = useState(anchor.label ?? '');
  const [category, setCategory] = useState(anchor.category ?? null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showOccurrences, setShowOccurrences] = useState(false);

  const cat = allCategories.find(c => c.id === anchor.category);
  const dotColor = anchor.color || cat?.color || '#6B7280';
  const timeLabel = anchor.is_all_day
    ? 'All day'
    : `${slotToTime(anchor.slot_start ?? 0, anchor.precision ?? 0.5, militaryTime)} · ${hoursToLabel((anchor.slot_duration ?? 0) * (anchor.precision ?? 0.5))}`;
  const dayLabel = days.length === 7 ? 'Every day' : days.map(d => DOW_SHORT[d]).join(', ');

  const dirty = name.trim() !== (anchor.label ?? '') || (category ?? null) !== (anchor.category ?? null);

  function handleSave() {
    if (!name.trim()) return;
    const chosen = allCategories.find(c => c.id === category);
    const updates = { label: name.trim(), category: category ?? null };
    if (chosen) updates.color = chosen.color;
    onUpdateSeries(anchor, updates, 'all');
    onToggle(); // collapse after saving
  }

  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-2.5 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{anchor.label || 'Untitled series'}</span>
          <span className="block text-[11px] text-gray-400 dark:text-gray-500 truncate">
            {count} events · {dayLabel} · {timeLabel}
          </span>
        </span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="px-2.5 pb-2.5 pt-1 space-y-3 border-t border-gray-100 dark:border-gray-700">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-medium text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">Series name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-[10px] font-medium text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wider">Category</label>
            <select
              value={category ?? ''}
              onChange={e => setCategory(e.target.value || null)}
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No category</option>
              {allCategories.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
            Changes apply to all {count} occurrences ({prettyDate(first)} → {prettyDate(last)}).
            To move or retime a single occurrence, edit it on the calendar.
          </p>

          {/* Occurrence list (collapsible) */}
          <button
            type="button"
            onClick={() => setShowOccurrences(v => !v)}
            className="text-[11px] text-indigo-500 dark:text-indigo-400 hover:underline"
          >
            {showOccurrences ? 'Hide' : 'Show'} {count} occurrences
          </button>
          {showOccurrences && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60">
              {occ.map(item => (
                <div key={item.id} className="flex items-center gap-2 px-2 py-1">
                  <span className="flex-1 text-[11px] text-gray-600 dark:text-gray-300">{prettyDate(getEventDate(item))}</span>
                  <button
                    type="button"
                    onClick={() => onDeleteSeries(item, 'this')}
                    title="Delete this occurrence"
                    className="p-0.5 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-1">
            {confirmingDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onDeleteSeries(anchor, 'all')}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                >
                  Delete all {count}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="text-xs px-2 py-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
              >
                Delete series
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim() || !dirty}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium hover:bg-gray-700 dark:hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Save changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Settings panel listing every recurring event series the user has created, with
 * inline editing (rename / recategorise the whole series) and deletion (one
 * occurrence or the entire series). Built on the same updateSeries/deleteSeries
 * scoped-edit helpers the on-calendar event editor uses.
 */
export default function SeriesManager({ events, allCategories, militaryTime = false, onUpdateSeries, onDeleteSeries }) {
  const series = useMemo(() => groupSeries(events), [events]);
  const [openId, setOpenId] = useState(null);

  if (series.length === 0) {
    return (
      <p className="text-[13px] text-gray-400 dark:text-gray-500 leading-snug px-1 py-1">
        No recurring series yet. When you add an event with a repeat option (Daily, Weekly, Monthly…) or across multiple days, it shows up here so you can rename, recategorise, or delete the whole set at once.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {series.map(s => (
        <SeriesRow
          key={s.id}
          series={s}
          allCategories={allCategories}
          militaryTime={militaryTime}
          isOpen={openId === s.id}
          onToggle={() => setOpenId(id => (id === s.id ? null : s.id))}
          onUpdateSeries={onUpdateSeries}
          onDeleteSeries={onDeleteSeries}
        />
      ))}
    </div>
  );
}
