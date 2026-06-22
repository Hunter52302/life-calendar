import { useEffect, useRef, useState } from 'react';
import { SLOT_HEIGHT, DAYS_SHORT } from '../lib/constants';
import { slotToTime, addDays, formatShortDate } from '../lib/utils';
import EventBlock from './EventBlock';

const TIME_COL_WIDTH = 48;
const TOP_PAD = 12;
const DRAG_THRESH = 5;

export default function CalendarGrid({
  events, weekStart, precision, view = 'week', activeDay = 0,
  onSlotClick, onEventClick, onAllDayClick, onDayHeaderClick, militaryTime = false,
  onUpdateEvent,
}) {
  const slotCount = precision === 1 ? 24 : 48;
  const totalHeight = slotCount * SLOT_HEIGHT;
  const dayIndices = view === 'week' ? [0, 1, 2, 3, 4, 5, 6] : [activeDay];

  const dayColRefs = useRef({});
  const dragRef = useRef(null); // { event, pointerId, startX, startY, hasDragged, dayOfWeek, slotStart }
  const justDraggedIdRef = useRef(null);
  const [drag, setDrag] = useState(null); // render snapshot: { id, dayOfWeek, slotStart }

  function handleDragStart(event, pointerId, clientX, clientY) {
    dragRef.current = {
      event, pointerId, startX: clientX, startY: clientY, hasDragged: false,
      dayOfWeek: event.day_of_week, slotStart: event.slot_start,
    };
  }

  function handleEventClick(event) {
    if (justDraggedIdRef.current === event.id) {
      justDraggedIdRef.current = null;
      return;
    }
    onEventClick?.(event);
  }

  // Window-level listeners (not bound to the dragged block itself) so a cross-day drag —
  // which re-parents the EventBlock into a different day column and remounts it — never
  // loses the rest of the gesture.
  useEffect(() => {
    function resolveDayAndSlot(clientX, clientY, fallbackDay) {
      let targetDay = fallbackDay;
      for (const key of Object.keys(dayColRefs.current)) {
        const el = dayColRefs.current[key];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left && clientX < rect.right) {
          targetDay = Number(key);
          break;
        }
      }
      const colEl = dayColRefs.current[targetDay];
      let slot = 0;
      if (colEl) {
        const rect = colEl.getBoundingClientRect();
        slot = Math.max(0, Math.min(slotCount - 1, Math.floor((clientY - rect.top) / SLOT_HEIGHT)));
      }
      return { dayOfWeek: targetDay, slot };
    }
    function handlePointerMove(e) {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.hasDragged && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) <= DRAG_THRESH) return;
      d.hasDragged = true;
      const { dayOfWeek, slot } = resolveDayAndSlot(e.clientX, e.clientY, d.dayOfWeek);
      // Convert from the grid's display precision back to the event's own slot units, and
      // clamp to that day's last valid slot — display/event precision can differ (e.g. a
      // 1hr-precision event dragged on a 30min grid), and an unclamped round() can land on
      // slotCount itself, which actually belongs to the next day.
      const eventSlotCount = d.event.precision <= 0.5 ? 48 : 24;
      const slotStart = Math.min(eventSlotCount - 1, Math.round((slot * precision) / d.event.precision));
      if (dayOfWeek === d.dayOfWeek && slotStart === d.slotStart) return;
      d.dayOfWeek = dayOfWeek;
      d.slotStart = slotStart;
      setDrag({ id: d.event.id, dayOfWeek, slotStart });
    }
    function handlePointerEnd(e) {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (d.hasDragged && (d.dayOfWeek !== d.event.day_of_week || d.slotStart !== d.event.slot_start)) {
        justDraggedIdRef.current = d.event.id;
        onUpdateEvent?.(d.event.id, { day_of_week: d.dayOfWeek, slot_start: d.slotStart });
      }
      dragRef.current = null;
      setDrag(null);
    }
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [precision, slotCount, onUpdateEvent]);

  // Separate all-day events from timed events
  const allDayByDay = {};
  const rawTimedEvents = [];
  events.forEach(e => {
    if (e.is_all_day) {
      const d = e.day_of_week;
      if (!allDayByDay[d]) allDayByDay[d] = [];
      allDayByDay[d].push(e);
    } else if (drag && e.id === drag.id) {
      rawTimedEvents.push({ ...e, day_of_week: drag.dayOfWeek, slot_start: drag.slotStart, _isDragPreview: true });
    } else {
      rawTimedEvents.push(e);
    }
  });

  // Expand overnight events: split at midnight into a main block + continuation on the next day
  const timedEvents = [];
  rawTimedEvents.forEach(event => {
    const eventSlotCount = event.precision <= 0.5 ? 48 : 24;
    const endSlot = event.slot_start + event.slot_duration;
    const overflowSlots = endSlot - eventSlotCount;
    if (overflowSlots > 0) {
      const totalHours = event.slot_duration * event.precision;
      // Main block: runs from slot_start to midnight
      timedEvents.push({
        ...event,
        slot_duration: eventSlotCount - event.slot_start,
        _overflowContinues: true,
        _totalHours: totalHours,
      });
      // Continuation block: runs from midnight on the next day
      const nextDay = event.day_of_week + 1;
      if (nextDay <= 6 && dayIndices.includes(nextDay)) {
        timedEvents.push({
          ...event,
          id: String(event.id ?? event.label) + '_cont',
          slot_start: 0,
          slot_duration: overflowSlots,
          day_of_week: nextDay,
          _isContinuation: true,
          _totalHours: totalHours,
        });
      }
    } else {
      timedEvents.push({ ...event }); // spread so we can safely add _col/_colCount below
    }
  });

  // Assign horizontal column indices so overlapping events render side-by-side instead of stacking
  const eventsByDayMap = new Map();
  timedEvents.forEach(event => {
    const d = event.day_of_week;
    if (!eventsByDayMap.has(d)) eventsByDayMap.set(d, []);
    eventsByDayMap.get(d).push(event);
  });
  eventsByDayMap.forEach(dayEvts => {
    dayEvts.sort((a, b) => a.slot_start - b.slot_start);
    // Greedy column assignment: place each event in the first column where it fits
    const colEnds = [];
    dayEvts.forEach(event => {
      const end = event.slot_start + event.slot_duration;
      let col = 0;
      while (col < colEnds.length && colEnds[col] > event.slot_start) col++;
      colEnds[col] = end;
      event._col = col;
    });
    // _colCount = highest column index among all events that overlap this one, + 1
    dayEvts.forEach(event => {
      const end = event.slot_start + event.slot_duration;
      let maxCol = event._col;
      dayEvts.forEach(other => {
        if (other === event) return;
        const otherEnd = other.slot_start + other.slot_duration;
        if (event.slot_start < otherEnd && end > other.slot_start) {
          maxCol = Math.max(maxCol, other._col ?? 0);
        }
      });
      event._colCount = maxCol + 1;
    });
  });

  const hasAnyAllDay = Object.keys(allDayByDay).length > 0;

  function handleColumnClick(e, dayIndex) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const slot = Math.max(0, Math.min(slotCount - 1, Math.floor(y / SLOT_HEIGHT)));
    onSlotClick?.(dayIndex, slot);
  }

  return (
    <div className="flex flex-col h-full select-none dark:bg-gray-900">
      <div className="overflow-y-auto flex-1">
        {/* Sticky header (day names + all-day row) */}
        <div className="sticky top-0 z-20 bg-white dark:bg-gray-900">
          {/* Day-name row */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <div style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH }} className="flex-shrink-0" />
            {dayIndices.map(dayIndex => (
              <div
                key={dayIndex}
                className={`flex-1 text-center py-2 border-l border-gray-100 dark:border-gray-700 min-w-0 ${
                  view === 'week' && onDayHeaderClick
                    ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-sm'
                    : ''
                }`}
                onClick={view === 'week' && onDayHeaderClick ? () => onDayHeaderClick(dayIndex) : undefined}
              >
                <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium leading-tight">
                  {DAYS_SHORT[dayIndex]}
                </div>
                <div className={`font-semibold text-gray-800 dark:text-gray-200 leading-tight ${view === 'week' ? 'text-xs' : 'text-sm'}`}>
                  {view === 'week'
                    ? parseInt(addDays(weekStart, dayIndex).slice(-2), 10)
                    : formatShortDate(addDays(weekStart, dayIndex))}
                </div>
              </div>
            ))}
          </div>

          {/* All-day row — always visible so it's clickable even when empty */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <div
              style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH }}
              className="flex-shrink-0 flex items-start justify-end pr-2 pt-1"
            >
              <span className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wide leading-none">all‑day</span>
            </div>
            {dayIndices.map(dayIndex => {
              const dayAllDay = allDayByDay[dayIndex] || [];
              return (
                <div
                  key={dayIndex}
                  className={`flex-1 border-l border-gray-100 dark:border-gray-700 min-h-[26px] py-0.5 px-0.5 ${
                    onAllDayClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40' : ''
                  }`}
                  onClick={() => onAllDayClick?.(dayIndex)}
                >
                  {dayAllDay.map(event => (
                    <div
                      key={event.id ?? event._planEventId ?? event.label}
                      className={`text-[10px] leading-tight px-1.5 py-0.5 rounded truncate mb-0.5 cursor-pointer ${
                        event._isGhost ? 'border border-dashed opacity-50' : ''
                      }`}
                      style={{
                        backgroundColor: event._isGhost ? 'transparent' : event.color + '28',
                        borderColor: event.color,
                        borderLeft: event._isGhost ? undefined : `2px solid ${event.color}`,
                        color: event.color,
                      }}
                      onClick={e => { e.stopPropagation(); onEventClick?.(event); }}
                    >
                      {event.label}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Grid body */}
        <div className="flex" style={{ height: totalHeight + TOP_PAD }}>
          {/* Time labels */}
          <div style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH }} className="relative flex-shrink-0">
            {Array.from({ length: slotCount }, (_, i) => {
              if (precision === 0.5 && i % 2 !== 0) return null;
              return (
                <div
                  key={i}
                  className="absolute right-1.5 text-[10px] text-gray-400 dark:text-gray-500 leading-none"
                  style={{ top: TOP_PAD + i * SLOT_HEIGHT - 7 }}
                >
                  {slotToTime(i, precision, militaryTime)}
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          {dayIndices.map(dayIndex => {
            const dayEvents = timedEvents.filter(e => e.day_of_week === dayIndex);
            return (
              <div
                key={dayIndex}
                ref={el => { dayColRefs.current[dayIndex] = el; }}
                className={`flex-1 relative border-l border-gray-100 dark:border-gray-700 min-w-0 ${onSlotClick ? 'cursor-pointer' : 'cursor-default'}`}
                style={{ height: totalHeight, marginTop: TOP_PAD }}
                onClick={e => onSlotClick && handleColumnClick(e, dayIndex)}
              >
                {Array.from({ length: slotCount }, (_, i) => (
                  <div
                    key={i}
                    className={`absolute left-0 right-0 border-t ${
                      precision === 0.5 && i % 2 !== 0
                        ? 'border-gray-50 dark:border-gray-800 border-dashed'
                        : 'border-gray-100 dark:border-gray-800'
                    }`}
                    style={{ top: i * SLOT_HEIGHT, pointerEvents: 'none' }}
                  />
                ))}
                {dayEvents.map(event => (
                  <EventBlock
                    key={event.id}
                    event={event}
                    gridPrecision={precision}
                    onClick={handleEventClick}
                    onDragStart={onUpdateEvent ? handleDragStart : undefined}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
