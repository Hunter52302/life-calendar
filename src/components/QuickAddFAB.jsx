/**
 * QuickAddFAB - Floating Action Button
 *
 * Quick-add actions:
 * - Add Event -> Plan
 * - Add Event -> Live
 * - Travel Buffer -> Live
 *
 * Supports multi-day events stored as day segments.
 * Respects militaryTime prop for consistent time display.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { todayStr } from '../lib/utils';
import { timeToSlot, slotToTimeStr, dateToWeekData, buildSegments } from '../lib/calendarUtils.js';
import { suggestOriginFromEvents } from '../lib/travelOrigin.js';
import { applyTrafficPadding } from '../lib/trafficPadding.js';
import { api } from '../lib/api.js';
import { safeSetJSON } from '../lib/storage.js';
import RouteAttribution from './RouteAttribution.jsx';
import ParseEventsModal from './ParseEventsModal.jsx';
import EventTitleSuggestInput from './EventTitleSuggestInput.jsx';
import { buildEventTitleSuggestions } from '../lib/eventTitleSuggestions.js';
import { buildPeopleSuggestions } from '../../shared/peopleSuggestions.js';

// Ã¢â€â‚¬Ã¢â€â‚¬ Constants Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const FAB_SIZE    = 56;
const DRAG_THRESH = 5;
const LS_POS_KEY  = 'lc-fab-pos';

// Ã¢â€â‚¬Ã¢â€â‚¬ Time helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function nextHourStr() {
  const h = (new Date().getHours() + 1) % 24;
  return `${String(h).padStart(2, '0')}:00`;
}
function addOneHour(t) {
  const [h, m] = t.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
/** Format "HH:MM" as 12h or 24h string */
function fmtTime(hhmm, military) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (military) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const ap  = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

/** Human-readable duration string between two date+time pairs */
function calcDurLabel(sd, st, ed, et) {
  const start = new Date(`${sd}T${st}:00`);
  const end   = new Date(`${ed}T${et}:00`);
  const ms = end - start;
  if (ms <= 0) return '-';
  const totalMins = Math.round(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Shared UI primitives Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const inputCls =
  'w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 ' +
  'dark:placeholder-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none ' +
  'focus:ring-2 focus:ring-blue-500 focus:border-transparent';

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      {children}
    </div>
  );
}

function FormShell({ title, accent, onClose, children }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-end sm:items-center justify-center z-[150] p-4 pb-safe-4 sm:pb-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700"
          style={{ borderTopWidth: 3, borderTopColor: accent, borderTopStyle: 'solid' }}
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button
            type="button" onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
          >x</button>
        </div>
        <div className="px-5 py-4 space-y-4 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function SaveRow({ onClose, onSave, disabled, label, color }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button
        type="button" onClick={onClose}
        className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >Cancel</button>
      <button
        type="button" onClick={onSave} disabled={disabled}
        className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:opacity-90"
        style={{ backgroundColor: color }}
      >{label}</button>
    </div>
  );
}

function CategoryPills({ allCategories, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button" onClick={() => onChange(null)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
          value == null
            ? 'border-gray-500 bg-gray-500 text-white'
            : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
        }`}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-400" />
        No category
      </button>
      {allCategories.map(cat => (
        <button
          key={cat.id} type="button" onClick={() => onChange(cat.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            value === cat.id
              ? 'text-white border-transparent'
              : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
          }`}
          style={value === cat.id ? { backgroundColor: cat.color } : {}}
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
          {cat.label}
        </button>
      ))}
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Time row: time picker + formatted hint Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function TimeRow({ startDate, startTime, endDate, endTime, onStartChange, onEndChange, militaryTime }) {
  const durLabel = calcDurLabel(startDate, startTime, endDate, endTime);
  return (
    <div className="flex gap-2">
      <Field label="Start" className="flex-1">
        <input type="time" value={startTime} onChange={e => onStartChange(e.target.value)} className={inputCls} />
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 px-0.5 tabular-nums">
          {fmtTime(startTime, militaryTime)}
        </p>
      </Field>
      <Field label="End" className="flex-1">
        <input type="time" value={endTime} onChange={e => onEndChange(e.target.value)} className={inputCls} />
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 px-0.5 tabular-nums">
          {fmtTime(endTime, militaryTime)}
        </p>
      </Field>
      <Field label="Duration" className="flex-shrink-0">
        <div className={`${inputCls} bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 whitespace-nowrap cursor-default`}>
          {durLabel}
        </div>
      </Field>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Multi-day date row Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function DateRow({ startDate, endDate, onStartChange, onEndChange }) {
  const isMultiDay = endDate > startDate;
  const segCount   = isMultiDay ? buildSegments(startDate, '00:00', endDate, '01:00').length : 1;

  return (
    <>
      <div className="flex gap-2">
        <Field label="Start date" className="flex-1">
          <input type="date" value={startDate} onChange={e => onStartChange(e.target.value)} className={inputCls} />
        </Field>
        <Field label="End date" className="flex-1">
          <input
            type="date" value={endDate} min={startDate}
            onChange={e => onEndChange(e.target.value)}
            className={`${inputCls}${isMultiDay ? ' ring-2 ring-amber-400/40 dark:ring-amber-500/40' : ''}`}
          />
        </Field>
      </div>
      {isMultiDay && (
        <p className="text-[11px] text-amber-500 dark:text-amber-400 -mt-1 px-0.5">
          Spans {segCount} day{segCount !== 1 ? 's' : ''}; saved as {segCount} calendar segment{segCount !== 1 ? 's' : ''}
        </p>
      )}
    </>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Event form (Plan or Live) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const EVENT_CONFIG = {
  plan:   { title: 'Quick Add Event - Plan', accent: '#3B82F6', btnLabel: 'Add to Plan' },
  actual: { title: 'Quick Add Event - Live', accent: '#10B981', btnLabel: 'Add to Live' },
};

function EventForm({ allCategories, allEvents = [], calendar = 'plan', militaryTime = false, onSave, onClose }) {
  const cfg   = EVENT_CONFIG[calendar] ?? EVENT_CONFIG.plan;
  const start = nextHourStr();

  const [label,     setLabel]     = useState('');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate,   setEndDate]   = useState(todayStr());
  const [startTime, setStartTime] = useState(start);
  const [endTime,   setEndTime]   = useState(addOneHour(start));
  const [allDay,    setAllDay]    = useState(false);
  const [catId,     setCatId]     = useState(allCategories[0]?.id ?? 'personal');
  const eventTitleSuggestions = useMemo(
    () => buildEventTitleSuggestions(allEvents, calendar),
    [allEvents, calendar]
  );

  function handleStartDateChange(val) {
    setStartDate(val);
    if (endDate < val) setEndDate(val);
  }
  function handleStartTimeChange(val) {
    setAllDay(false);
    setStartTime(val);
    // Only force end-time forward when on the same day
    if (endDate === startDate && timeToSlot(endTime) <= timeToSlot(val)) {
      setEndTime(slotToTimeStr(timeToSlot(val) + 2));
    }
  }
  function handleEndTimeChange(val) { setAllDay(false); setEndTime(val); }
  function toggleAllDay(checked) {
    setAllDay(checked);
    if (checked) { setStartTime('00:00'); setEndTime('23:59'); }
  }

  function handleSave() {
    if (!label.trim()) return;
    const segments = buildSegments(startDate, startTime, endDate, endTime);
    const cat = allCategories.find(c => c.id === catId);
    for (const seg of segments) {
      const { week_start, day_of_week } = dateToWeekData(seg.date);
      onSave({
        label: label.trim(), category: catId, color: cat?.color ?? '#6B7280',
        week_start, day_of_week,
        slot_start: seg.slotStart, slot_duration: seg.slotDuration,
        precision: 0.5, calendar, source: 'manual', is_all_day: allDay,
      });
    }
    onClose();
  }

  return (
    <FormShell title={cfg.title} accent={cfg.accent} onClose={onClose}>
      <Field label="Event name">
        <EventTitleSuggestInput
          value={label}
          onChange={setLabel}
          suggestions={eventTitleSuggestions}
          onEnter={() => handleSave()}
          placeholder="e.g. Team meeting, Dentist..."
          autoFocus
          className={inputCls}
        />
      </Field>
      <DateRow
        startDate={startDate} endDate={endDate}
        onStartChange={handleStartDateChange}
        onEndChange={setEndDate}
      />
      {!allDay && (
        <TimeRow
          startDate={startDate} startTime={startTime}
          endDate={endDate}    endTime={endTime}
          onStartChange={handleStartTimeChange}
          onEndChange={handleEndTimeChange}
          militaryTime={militaryTime}
        />
      )}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={allDay} onChange={e => toggleAllDay(e.target.checked)}
          className="w-4 h-4 rounded accent-blue-500" />
        <span className="text-sm text-gray-600 dark:text-gray-300">All day</span>
      </label>
      <Field label="Category">
        <CategoryPills allCategories={allCategories} value={catId}
          onChange={setCatId} />
      </Field>
      <SaveRow
        onClose={onClose} onSave={handleSave}
        disabled={!label.trim()} label={cfg.btnLabel} color={cfg.accent}
      />
    </FormShell>
  );
}

// Travel Buffer form
const BUFFER_CAT_ID = 'drive-time';
const BUFFER_CAT_COLOR = '#F97316';
const BUFFER_OPTIONS = [15, 30, 45, 60];

/**
 * Best-guess "From" address for a buffer starting at startDate/startTime:
 * the location of the most recent Live event ending at or before that moment
 * on the same day, falling back to the saved home address.
 */
function suggestOrigin(allEvents, startDate, startTime, homeAddress) {
  const { week_start, day_of_week } = dateToWeekData(startDate);
  return suggestOriginFromEvents(
    allEvents.filter(e => e.calendar === 'actual'),
    { week_start, day_of_week, startMinutes: timeToSlot(startTime) * 30 },
    homeAddress
  );
}

function TravelBufferForm({ militaryTime = false, homeAddress = '', allEvents = [], onSave, onClose }) {
  const start = nextHourStr();

  const [label, setLabel] = useState('Travel Buffer');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [startTime, setStartTime] = useState(start);
  const [minutes, setMinutes] = useState(30);
  const [customMinutes, setCustomMinutes] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Automatic start/end points. "From" is seeded from the preceding event (or
  // home) but stays editable; once the user types in it we stop auto-updating.
  const suggestedOrigin = useMemo(
    () => suggestOrigin(allEvents, startDate, startTime, homeAddress),
    [allEvents, startDate, startTime, homeAddress]
  );
  const [fromAddr, setFromAddr] = useState(suggestedOrigin);
  const [toAddr, setToAddr] = useState('');
  const fromTouched = useRef(false);
  useEffect(() => {
    if (!fromTouched.current) setFromAddr(suggestedOrigin);
  }, [suggestedOrigin]);

  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState('');
  const [estimateInfo, setEstimateInfo] = useState('');

  const effectiveMinutes = customMinutes === '' ? minutes : Math.max(1, Number(customMinutes) || 1);
  const endTime = slotToTimeStr(timeToSlot(startTime) + Math.max(1, Math.ceil(effectiveMinutes / 30)));

  function handleStartDateChange(val) {
    setStartDate(val);
    if (endDate < val) setEndDate(val);
  }

  async function handleEstimate() {
    const from = fromAddr.trim();
    const to = toAddr.trim();
    if (!from || !to || estimating) return;
    setEstimating(true);
    setEstimateError('');
    setEstimateInfo('');
    try {
      const { minutes: mins, meters } = await api.travelTime.estimate(from, to);
      const dow = new Date(startDate + 'T00:00:00').getDay();
      const hour = Number(startTime.split(':')[0]) || 0;
      const { minutes: padded, pct } = applyTrafficPadding(mins, dow, hour);
      setCustomMinutes(String(padded));
      const miles = meters ? ` · ${(meters / 1609.34).toFixed(1)} mi` : '';
      const pad = pct > 0 ? ` (incl. ~${pct}% traffic)` : '';
      setEstimateInfo(`Estimated ${padded} min drive${miles}${pad}`);
    } catch (err) {
      setEstimateError(err.message || 'Could not estimate drive time.');
    } finally {
      setEstimating(false);
    }
  }

  function handleSave() {
    if (!label.trim()) return;
    const segments = buildSegments(startDate, startTime, endDate, endTime);
    const destination = toAddr.trim();
    for (const seg of segments) {
      const { week_start, day_of_week } = dateToWeekData(seg.date);
      onSave({
        label: label.trim(),
        category: BUFFER_CAT_ID, color: BUFFER_CAT_COLOR,
        week_start, day_of_week,
        slot_start: seg.slotStart, slot_duration: seg.slotDuration,
        precision: 0.5, calendar: 'actual', source: 'manual', is_all_day: false,
        travel_buffer_minutes: effectiveMinutes,
        ...(destination ? { location: destination } : {}),
      });
    }
    onClose();
  }

  const canEstimate = !!fromAddr.trim() && !!toAddr.trim() && !estimating;

  return (
    <FormShell title="Quick Add Travel Buffer" accent={BUFFER_CAT_COLOR} onClose={onClose}>
      <Field label="Event label">
        <input ref={inputRef} type="text" value={label} onChange={e => setLabel(e.target.value)}
          placeholder="Travel Buffer" className={inputCls} />
      </Field>

      {/* Automatic drive-time: enter a start + destination, estimate the buffer */}
      <div className="space-y-2 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
        <Field label="From (start)">
          <input
            type="text" value={fromAddr}
            onChange={e => { fromTouched.current = true; setFromAddr(e.target.value); setEstimateInfo(''); }}
            placeholder="Starting address"
            className={inputCls}
          />
        </Field>
        <Field label="To (destination)">
          <input
            type="text" value={toAddr}
            onChange={e => { setToAddr(e.target.value); setEstimateInfo(''); }}
            placeholder="Destination address"
            className={inputCls}
          />
        </Field>
        <button
          type="button" onClick={handleEstimate} disabled={!canEstimate}
          className="w-full py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
          style={{ backgroundColor: BUFFER_CAT_COLOR }}
        >
          {estimating ? 'Estimating…' : 'Estimate drive time'}
        </button>
        {estimateInfo && (
          <p className="text-[11px] text-green-600 dark:text-green-400">{estimateInfo}</p>
        )}
        {estimateError && (
          <p className="text-[11px] text-red-500 dark:text-red-400">{estimateError}</p>
        )}
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Approximate rush-hour padding, not live traffic. Estimating sends these addresses to the routing service.
        </p>
        <RouteAttribution />
      </div>

      <Field label="Duration">
        <div className="flex flex-wrap gap-1.5">
          {BUFFER_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { setMinutes(opt); setCustomMinutes(''); setEstimateInfo(''); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${customMinutes === '' && minutes === opt ? 'text-white border-transparent' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}
              style={customMinutes === '' && minutes === opt ? { backgroundColor: BUFFER_CAT_COLOR } : {}}
            >
              {opt === 60 ? '1h' : `${opt}m`}
            </button>
          ))}
          <input
            type="number"
            min="1"
            value={customMinutes}
            onChange={e => setCustomMinutes(e.target.value)}
            placeholder="Custom"
            className="w-24 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Set manually, or fill it automatically with an estimate above.</p>
      </Field>
      <DateRow
        startDate={startDate} endDate={endDate}
        onStartChange={handleStartDateChange}
        onEndChange={setEndDate}
      />
      <TimeRow
        startDate={startDate} startTime={startTime}
        endDate={endDate}    endTime={endTime}
        onStartChange={setStartTime}
        onEndChange={() => {}}
        militaryTime={militaryTime}
      />
      <SaveRow
        onClose={onClose} onSave={handleSave}
        disabled={!label.trim()} label="Add to Live" color={BUFFER_CAT_COLOR}
      />
    </FormShell>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Icons Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function CalIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
    </svg>
  );
}
function CarIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 17H16M6 10l1.5-4.5A1 1 0 0 1 8.447 5h7.106a1 1 0 0 1 .947.672L18 10M6 10H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h1m14-5h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1M6.5 17a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0zm8 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0z" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm6-3a6 6 0 0 1-12 0M12 17v4" />
    </svg>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Quick-add option row (centered popup menu) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function OptionRow({ icon, label, sublabel, color, onClick }) {
  return (
    <button
      type="button" onClick={onClick}
      className="group w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60 active:bg-gray-100 dark:active:bg-gray-700 focus:outline-none"
    >
      <span
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm"
        style={{ backgroundColor: color }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{label}</span>
        <span className="block text-xs text-gray-400 dark:text-gray-500 leading-tight mt-0.5">{sublabel}</span>
      </span>
      <svg className="ml-auto w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Centered quick-add menu (action sheet) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function QuickAddMenu({ onClose, onSelect }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/60 p-4 pb-safe-4 sm:pb-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Quick Add</h2>
          <button
            type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
            aria-label="Close"
          >x</button>
        </div>
        <div className="p-2 sm:p-2.5">
          <OptionRow icon={<CalIcon />}       color="#3B82F6" label="Add Event"   sublabel="to your Plan"        onClick={() => onSelect('event-plan')} />
          <OptionRow icon={<CalIcon />}       color="#10B981" label="Add Event"   sublabel="to your Live log"    onClick={() => onSelect('event-live')} />
          <OptionRow icon={<CarIcon />}       color="#F97316" label="Travel Buffer"  sublabel="manual time before event" onClick={() => onSelect('buffer')} />
          <OptionRow icon={<ClipboardIcon />} color="#8B5CF6" label="From Text"   sublabel="paste & parse events" onClick={() => onSelect('text')} />
          <OptionRow icon={<MicIcon />}       color="#EF4444" label="Record Voice" sublabel="speak to add events" onClick={() => onSelect('voice')} />
        </div>
      </div>
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Clamp helper Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function clampToViewport(p) {
  if (!p) return null;
  return {
    x: Math.max(0, Math.min(window.innerWidth  - FAB_SIZE, p.x)),
    y: Math.max(0, Math.min(window.innerHeight - FAB_SIZE, p.y)),
  };
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Main FAB Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export default function QuickAddFAB({
  allCategories    = [],
  allEvents         = [],
  homeAddress      = '',
  militaryTime     = false,
  draggable        = false,
  posResetKey      = 0,
  initialParseText = null,
  keywordMap       = {},
  llmSettings      = null,
  onAddEvent,
  onAddActual,
  onSwitchTab,
  onClearParseText,
}) {
  const [pos,  setPos]  = useState(() => {
    try {
      const s = localStorage.getItem(LS_POS_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (typeof p.x === 'number' && typeof p.y === 'number') return clampToViewport(p);
      }
    } catch { /* ignore */ }
    return null;
  });
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(null); // null | 'event-plan' | 'event-live' | 'buffer' | 'parse'
  const [parseAutoVoice, setParseAutoVoice] = useState(false);

  // "Contacts from history" — phone/email you entered for a name on a past
  // event, used to auto-link the same name when it's parsed again.
  const peopleSuggestions = useMemo(() => buildPeopleSuggestions(allEvents), [allEvents]);

  const isDragging   = useRef(false);
  const hasDragged   = useRef(false);
  const dragOrigin   = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const posRef       = useRef(pos);
  const containerRef = useRef(null);

  useEffect(() => {
    if (posResetKey === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos(null); posRef.current = null;
    localStorage.removeItem(LS_POS_KEY);
  }, [posResetKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialParseText) { setMode('parse'); setOpen(false); }
  }, [initialParseText]);

  useEffect(() => {
    function getClient(e) {
      return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                       : { x: e.clientX, y: e.clientY };
    }
    function onMove(e) {
      if (!isDragging.current) return;
      if (e.cancelable) e.preventDefault();
      const { x, y } = getClient(e);
      const dx = x - dragOrigin.current.mx;
      const dy = y - dragOrigin.current.my;
      if (Math.hypot(dx, dy) > DRAG_THRESH) hasDragged.current = true;
      if (!hasDragged.current) return;
      const newX = Math.max(0, Math.min(window.innerWidth  - FAB_SIZE, dragOrigin.current.px + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - FAB_SIZE, dragOrigin.current.py + dy));
      const next = { x: newX, y: newY };
      posRef.current = next; setPos(next); setOpen(false);
    }
    function onUp() {
      if (!isDragging.current) return;
      isDragging.current = false;
      if (posRef.current) safeSetJSON(LS_POS_KEY, posRef.current);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend',  onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend',  onUp);
    };
  }, []);

  useEffect(() => {
    function handleResize() {
      setPos(prev => {
        if (!prev) return null;
        const clamped = clampToViewport(prev);
        if (clamped.x === prev.x && clamped.y === prev.y) return prev;
        safeSetJSON(LS_POS_KEY, clamped);
        posRef.current = clamped;
        return clamped;
      });
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function handlePointerDown(e) {
    if (!draggable) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const { x, y } = e.touches
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };
    const currentPos = posRef.current ?? {
      x: window.innerWidth  - FAB_SIZE - 24,
      y: window.innerHeight - FAB_SIZE - 24,
    };
    if (!posRef.current) { posRef.current = currentPos; setPos(currentPos); }
    isDragging.current = true;
    hasDragged.current = false;
    dragOrigin.current = { mx: x, my: y, px: currentPos.x, py: currentPos.y };
  }

  function handleFABClick() {
    if (hasDragged.current) { hasDragged.current = false; return; }
    setOpen(v => !v);
  }

  function openMode(m) { setMode(m); setOpen(false); }
  function openVoiceMode() { setParseAutoVoice(true); openMode('parse'); }
  function openTextMode()  { setParseAutoVoice(false); openMode('parse'); }

  function handleAddPlanEvent(event)  { onAddEvent(event);  onSwitchTab('plan');   }
  function handleAddLiveEvent(event)  { onAddActual(event); onSwitchTab('actual'); }
  function handleAddBuffer(event)      { onAddActual(event); onSwitchTab('actual'); }

  const wrapperStyle = pos
    ? { position: 'fixed', left: pos.x, top: pos.y, bottom: 'auto', right: 'auto' }
    : {};
  const wrapperStyle2 = pos ? {} : { bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))', right: 'max(1.5rem, env(safe-area-inset-right, 0px))' };
  const wrapperCls = pos ? 'z-[120]' : 'fixed z-[120]';
  const cursorCls  = draggable ? 'cursor-grab' : '';

  function handleMenuSelect(choice) {
    if (choice === 'voice') openVoiceMode();
    else if (choice === 'text') openTextMode();
    else openMode(choice);
  }

  return (
    <>
      <div ref={containerRef} className={wrapperCls} style={{ ...wrapperStyle, ...wrapperStyle2 }}>

        {/* FAB button */}
        <button
          type="button"
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
          onClick={handleFABClick}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 select-none ${cursorCls}`}
          style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
          aria-label="Quick add"
          title={draggable ? 'Drag to move - Click to open' : 'Quick add'}
        >
          <svg className={`w-6 h-6 transition-transform duration-200 ${open ? 'rotate-45' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {draggable && (
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-white/40 pointer-events-none" />
        )}
      </div>

      {/* Centered quick-add menu */}
      {open && (
        <QuickAddMenu onClose={() => setOpen(false)} onSelect={handleMenuSelect} />
      )}

      {/* Forms */}
      {mode === 'event-plan' && (
        <EventForm allCategories={allCategories} allEvents={allEvents} calendar="plan" militaryTime={militaryTime}
          onSave={handleAddPlanEvent} onClose={() => setMode(null)} />
      )}
      {mode === 'event-live' && (
        <EventForm allCategories={allCategories} allEvents={allEvents} calendar="actual" militaryTime={militaryTime}
          onSave={handleAddLiveEvent} onClose={() => setMode(null)} />
      )}
      {mode === 'buffer' && (
        <TravelBufferForm militaryTime={militaryTime}
          homeAddress={homeAddress} allEvents={allEvents}
          onSave={handleAddBuffer} onClose={() => setMode(null)} />
      )}
      {mode === 'parse' && (
        <ParseEventsModal
          allCategories={allCategories}
          initialText={initialParseText ?? ''}
          militaryTime={militaryTime}
          keywordMap={keywordMap}
          llmSettings={llmSettings}
          peopleSuggestions={peopleSuggestions}
          autoStartVoice={parseAutoVoice}
          onAddEvents={evts => {
            evts.filter(e => e.calendar === 'plan').forEach(handleAddPlanEvent);
            evts.filter(e => e.calendar === 'actual').forEach(handleAddLiveEvent);
          }}
          onClose={() => { setMode(null); setParseAutoVoice(false); onClearParseText?.(); }}
        />
      )}
    </>
  );
}

