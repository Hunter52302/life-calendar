/**
 * SearchModal
 *
 * Full-screen search overlay. Searches across all plan and live events by label
 * and category name. Clicking a result navigates to that event's week/day.
 *
 * Props
 * -----
 * planEvents      – all plan events
 * actualEvents    – all actual/live events
 * allCategories   – full category list (for color + label lookup)
 * militaryTime    – bool, passed to slotToTime
 * onNavigate(event) – called when a result is clicked; parent handles tab switch + week nav
 * onClose()       – called to close the modal (Escape, backdrop click, or after navigate)
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { addDays, slotToTime } from '../lib/utils';

export default function SearchModal({
  planEvents = [],
  actualEvents = [],
  allCategories = [],
  militaryTime = false,
  onNavigate,
  onClose,
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  // Auto-focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Build category map for fast lookup
  const catMap = useMemo(
    () => Object.fromEntries(allCategories.map(c => [c.id, c])),
    [allCategories]
  );

  // Search results — live filter as user types
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matches = [];

    planEvents.forEach(e => {
      const labelHit = e.label?.toLowerCase().includes(q);
      const catHit   = catMap[e.category]?.label?.toLowerCase().includes(q);
      if (labelHit || catHit) matches.push({ ...e, _calendar: 'plan' });
    });

    actualEvents.forEach(e => {
      const labelHit = e.label?.toLowerCase().includes(q);
      const catHit   = catMap[e.category]?.label?.toLowerCase().includes(q);
      if (labelHit || catHit) matches.push({ ...e, _calendar: 'actual' });
    });

    // Sort chronologically (week_start + day_of_week)
    matches.sort((a, b) => {
      const aDate = addDays(a.week_start, a.day_of_week ?? 0);
      const bDate = addDays(b.week_start, b.day_of_week ?? 0);
      return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
    });

    return matches.slice(0, 60);
  }, [query, planEvents, actualEvents, catMap]);

  // Format date string for display: "Mon, May 19, 2025"
  function formatDate(event) {
    const dateStr = addDays(event.week_start, event.day_of_week ?? 0);
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  // Format time range or "All day"
  function formatTime(event) {
    if (event.is_all_day || event.slot_duration === 0) return 'All day';
    const start = slotToTime(event.slot_start, event.precision, militaryTime);
    const end   = slotToTime(event.slot_start + event.slot_duration, event.precision, militaryTime);
    return `${start} – ${end}`;
  }

  // Highlight matching portion of text
  function Highlight({ text = '', query }) {
    if (!query) return <span>{text}</span>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <span>{text}</span>;
    return (
      <span>
        {text.slice(0, idx)}
        <mark className="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 rounded-sm px-0.5">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </span>
    );
  }

  function handleResultClick(event) {
    onNavigate(event);
    onClose();
  }

  const trimmedQuery = query.trim();

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">

        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search events by name or category…"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-xs p-0.5"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 font-mono">
            Esc
          </kbd>
        </div>

        {/* Results list */}
        {trimmedQuery && (
          <div className="max-h-[58vh] overflow-y-auto overscroll-contain">
            {results.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                No events found for <span className="font-medium text-gray-600 dark:text-gray-300">"{query}"</span>
              </div>
            ) : (
              <>
                <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </div>
                <ul>
                  {results.map((event, i) => {
                    const cat = catMap[event.category];
                    const color = event.color || cat?.color || '#6B7280';
                    const isLastItem = i === results.length - 1;
                    return (
                      <li key={`${event._calendar}-${event.id ?? i}`}>
                        <button
                          type="button"
                          onClick={() => handleResultClick(event)}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left ${
                            isLastItem ? '' : 'border-b border-gray-50 dark:border-gray-700/50'
                          }`}
                        >
                          {/* Category color dot */}
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: color }}
                          />

                          {/* Main content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                <Highlight text={event.label ?? ''} query={trimmedQuery} />
                              </span>
                              {/* Plan / Live badge */}
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0 ${
                                event._calendar === 'plan'
                                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                                  : 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
                              }`}>
                                {event._calendar === 'plan' ? 'Plan' : 'Live'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                              <span>{formatDate(event)}</span>
                              <span>·</span>
                              <span>{formatTime(event)}</span>
                              {cat && (
                                <>
                                  <span>·</span>
                                  <span>
                                    <Highlight text={cat.label} query={trimmedQuery} />
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Arrow */}
                          <svg className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        {/* Empty state before typing */}
        {!trimmedQuery && (
          <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            Type to search across all your events
          </div>
        )}
      </div>
    </div>
  );
}
