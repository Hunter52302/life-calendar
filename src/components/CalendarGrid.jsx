import { useEffect, useRef, useState } from 'react';
import { SLOT_HEIGHT, DAYS_SHORT } from '../lib/constants';
import { slotToTime, addDays, formatShortDate, getWeekStart } from '../lib/utils';
import { formatTimeZoneSlot, shortTimeZoneName } from '../lib/timeZones';
import { useToday } from '../hooks/useToday';
import EventBlock from './EventBlock';

const TIME_COL_WIDTH = 48;
const TOP_PAD = 12;
const DRAG_THRESH = 5;
const MIN_WEEK_DAY_WIDTH = 92;

export default function CalendarGrid({
  events, weekStart, precision, view = 'week', activeDay = 0,
  onSlotClick, onEventClick, onAllDayClick, onDayHeaderClick, militaryTime = false,
  stackOverlap = false,
  onUpdateEvent,
  allowDrag = true,
  timezones = [],
  showTimeZoneColumns = false,
}) {
  const dragEnabled = allowDrag && !!onUpdateEvent;
  const slotCount = precision === 1 ? 24 : 48;
  const totalHeight = slotCount * SLOT_HEIGHT;
  // Column order follows the display anchor: weekStart is a Sunday (start-of-week
  // = Sunday) or a Monday (= Monday). Columns are still keyed by absolute
  // day_of_week (each weekday is unique within the 7 shown), only the order and
  // the date each column maps to change.
  const startDow = new Date(weekStart + 'T00:00:00').getDay();
  const orderedWeek = Array.from({ length: 7 }, (_, p) => (startDow + p) % 7);
  const dayIndices = view === 'week' ? orderedWeek : [activeDay];
  // Calendar date shown in the column for a given day_of_week. For a Monday
  // anchor the trailing Sunday resolves to the *next* Sunday-week's date.
  const colDate = (dow) => addDays(weekStart, (dow - startDow + 7) % 7);
  const today = useToday();
  const isTodayCol = (dow) => colDate(dow) === today;
  const validTimezones = [...new Set(timezones.filter(Boolean))];
  const primaryTimeZone = validTimezones[0] || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  // The primary zone stays closest to the calendar. Secondary zones grow left.
  const axisTimezones = showTimeZoneColumns && validTimezones.length > 1
    ? [...validTimezones].reverse()
    : [primaryTimeZone];
  const timeAxesWidth = axisTimezones.length * TIME_COL_WIDTH;
  const minGridWidth = timeAxesWidth + dayIndices.length * (view === 'week' ? MIN_WEEK_DAY_WIDTH : 180);

  const dayColRefs = useRef({});
  const allDayRowRef = useRef(null);        // bounds of the all-day drop zone
  const dragRef = useRef(null); // { event, pointerId, startX, startY, hasDragged, dayOfWeek, slotStart, allDay }
  const justDraggedIdRef = useRef(null);
  const suppressClickRef = useRef(false);   // eat the click a drag-release synthesises
  const [drag, setDrag] = useState(null); // render snapshot: { id, dayOfWeek, slotStart, allDay }

  function handleDragStart(event, pointerId, clientX, clientY) {
    suppressClickRef.current = false;
    dragRef.current = {
      event, pointerId, startX: clientX, startY: clientY, hasDragged: false,
      dayOfWeek: event.day_of_week, slotStart: event.slot_start,
      allDay: !!event.is_all_day,
    };
  }

  // A drag-release fires a synthetic click on whatever is under the pointer; this
  // lets the grid/all-day cells ignore that one click so a drop never also opens
  // the add-event form.
  function eatSuppressedClick() {
    if (suppressClickRef.current) { suppressClickRef.current = false; return true; }
    return false;
  }

  function handleEventClick(event) {
    if (justDraggedIdRef.current === event.id) {
      justDraggedIdRef.current = null;
      suppressClickRef.current = false;
      return;
    }
    onEventClick?.(event);
  }

  // Window-level listeners (not bound to the dragged block itself) so a cross-day drag —
  // which re-parents the EventBlock into a different day column and remounts it — never
  // loses the rest of the gesture.
  useEffect(() => {
    function resolveTarget(clientX, clientY, fallbackDay) {
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
      // Over the all-day drop zone? Its cells span the same columns as the grid,
      // so day resolution by X still holds; only the vertical band differs.
      const adRect = allDayRowRef.current?.getBoundingClientRect();
      const overAllDay = !!adRect && clientY >= adRect.top && clientY < adRect.bottom;
      const colEl = dayColRefs.current[targetDay];
      let slot = 0;
      if (!overAllDay && colEl) {
        const rect = colEl.getBoundingClientRect();
        slot = Math.max(0, Math.min(slotCount - 1, Math.floor((clientY - rect.top) / SLOT_HEIGHT)));
      }
      return { dayOfWeek: targetDay, allDay: overAllDay, slot };
    }
    function handlePointerMove(e) {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.hasDragged && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) <= DRAG_THRESH) return;
      d.hasDragged = true;
      const { dayOfWeek, allDay, slot } = resolveTarget(e.clientX, e.clientY, d.dayOfWeek);
      // In the all-day zone the slot is irrelevant — keep the event's own slot so a
      // drag back out lands where the pointer is, with its stored length intact.
      // Over the grid, convert from display precision to the event's own slot units,
      // clamping to that day's last valid slot (display/event precision can differ,
      // and an unclamped round() can land on slotCount — really the next day).
      let slotStart = d.slotStart;
      if (!allDay) {
        const eventSlotCount = d.event.precision <= 0.5 ? 48 : 24;
        slotStart = Math.min(eventSlotCount - 1, Math.round((slot * precision) / d.event.precision));
      }
      if (dayOfWeek === d.dayOfWeek && slotStart === d.slotStart && allDay === d.allDay) return;
      d.dayOfWeek = dayOfWeek;
      d.slotStart = slotStart;
      d.allDay = allDay;
      setDrag({ id: d.event.id, dayOfWeek, slotStart, allDay });
    }
    function handlePointerEnd(e) {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const wasAllDay = !!d.event.is_all_day;
      const moved = d.hasDragged && (
        d.dayOfWeek !== d.event.day_of_week ||
        d.slotStart !== d.event.slot_start ||
        d.allDay !== wasAllDay
      );
      if (moved) {
        justDraggedIdRef.current = d.event.id;
        suppressClickRef.current = true;
        // Persist the Sunday-anchored week_start for the drop target's date — a
        // Monday-start week can move an event into a different storage week.
        const targetDate = addDays(weekStart, (d.dayOfWeek - startDow + 7) % 7);
        const newWeekStart = getWeekStart(new Date(targetDate + 'T00:00:00'));
        const patch = { day_of_week: d.dayOfWeek };
        if (newWeekStart !== d.event.week_start) patch.week_start = newWeekStart;
        if (d.allDay && !wasAllDay) {
          // Timed → all-day. Leave slot_start / slot_duration untouched so dragging
          // it back out restores the original time and length.
          patch.is_all_day = true;
        } else if (!d.allDay && wasAllDay) {
          // All-day → timed. Land at the drop slot, keeping the stored duration.
          patch.is_all_day = false;
          patch.slot_start = d.slotStart;
        } else if (!d.allDay) {
          patch.slot_start = d.slotStart;
        }
        onUpdateEvent?.(d.event.id, patch);
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
  }, [precision, slotCount, onUpdateEvent, weekStart, startDow]);

  // Separate all-day events from timed events. While a drag is in flight the
  // dragged event follows the pointer between the two zones, so its *effective*
  // all-day state comes from the drag snapshot, not its stored flag.
  const allDayByDay = {};
  const rawTimedEvents = [];
  events.forEach(e => {
    const isDragged = drag && e.id === drag.id;
    const effectiveAllDay = isDragged ? drag.allDay : e.is_all_day;
    if (effectiveAllDay) {
      const d = isDragged ? drag.dayOfWeek : e.day_of_week;
      if (!allDayByDay[d]) allDayByDay[d] = [];
      allDayByDay[d].push(isDragged ? { ...e, day_of_week: d, is_all_day: true, _isDragPreview: true } : e);
    } else if (isDragged) {
      rawTimedEvents.push({ ...e, day_of_week: drag.dayOfWeek, slot_start: drag.slotStart, is_all_day: false, _isDragPreview: true });
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
      // The after-midnight tail belongs to the next day's column. When that day
      // is the last column (the tail would land in the following display week)
      // or isn't shown (single-day view), it can't be drawn — flag the main
      // block so it still signals "runs past midnight" instead of ending at 00:00.
      const nextDow = (event.day_of_week + 1) % 7;
      const tailVisible = dayIndices.indexOf(nextDow) === dayIndices.indexOf(event.day_of_week) + 1;
      // Main block: runs from slot_start to midnight
      timedEvents.push({
        ...event,
        slot_duration: eventSlotCount - event.slot_start,
        _overflowContinues: true,
        _overflowClipped: !tailVisible,
        _totalHours: totalHours,
      });
      // Continuation block: runs from midnight on the next day
      if (tailVisible) {
        timedEvents.push({
          ...event,
          id: String(event.id ?? event.label) + '_cont',
          slot_start: 0,
          slot_duration: overflowSlots,
          day_of_week: nextDow,
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


  function handleColumnClick(e, dayIndex) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const slot = Math.max(0, Math.min(slotCount - 1, Math.floor(y / SLOT_HEIGHT)));
    onSlotClick?.(dayIndex, slot);
  }

  return (
    <div
      className="lc-surface flex flex-col h-full select-none dark:bg-gray-900"
      style={{ minWidth: minGridWidth }}
    >
      <div className="overflow-y-auto flex-1">
        {/* Sticky header (day names + all-day row) */}
        <div className="lc-surface sticky top-0 z-20 bg-white dark:bg-gray-900">
          {/* Day-name row */}
          <div data-calendar-row="day-header" className="flex border-b border-gray-200 dark:border-gray-700">
            {axisTimezones.map((timeZone, index) => (
              <div
                key={timeZone}
                data-time-zone={timeZone}
                title={timeZone}
                style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH }}
                className="flex-shrink-0 flex flex-col items-center justify-center border-r border-gray-100 dark:border-gray-700 px-0.5"
              >
                <span className={`max-w-full truncate text-[9px] font-semibold leading-tight ${
                  index === axisTimezones.length - 1 && axisTimezones.length > 1
                    ? 'text-blue-500 dark:text-blue-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`}>
                  {shortTimeZoneName(timeZone, weekStart)}
                </span>
                {index === axisTimezones.length - 1 && axisTimezones.length > 1 && (
                  <span className="text-[7px] uppercase tracking-wide text-gray-400 dark:text-gray-500">primary</span>
                )}
              </div>
            ))}
            {dayIndices.map(dayIndex => {
              const isToday = isTodayCol(dayIndex);
              return (
                <div
                  key={dayIndex}
                  data-calendar-day={dayIndex}
                  className={`flex-1 text-center py-2 border-l border-gray-100 dark:border-gray-700 min-w-0 ${
                    isToday ? 'bg-gray-100/60 dark:bg-gray-800/60' : ''
                  } ${
                    view === 'week' && onDayHeaderClick
                      ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-sm'
                      : ''
                  }`}
                  onClick={view === 'week' && onDayHeaderClick ? () => onDayHeaderClick(dayIndex) : undefined}
                >
                  <div className={`text-[10px] uppercase tracking-wide font-medium leading-tight ${
                    isToday ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {DAYS_SHORT[dayIndex]}
                  </div>
                  <div className={`font-semibold leading-tight ${view === 'week' ? 'text-xs' : 'text-sm'}`}>
                    <span className={`inline-flex items-center justify-center rounded-full ${
                      view === 'week' ? 'w-5 h-5' : 'px-2 py-0.5'
                    } ${
                      isToday
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'text-gray-800 dark:text-gray-200'
                    }`}>
                      {view === 'week'
                        ? parseInt(colDate(dayIndex).slice(-2), 10)
                        : formatShortDate(colDate(dayIndex))}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* All-day row — always visible so it's clickable even when empty, and a
              drop target: drag a timed event up here to make it all-day. */}
          <div
            ref={allDayRowRef}
            data-calendar-row="all-day"
            className={`flex border-b transition-colors ${
              drag?.allDay
                ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div
              style={{ width: timeAxesWidth, minWidth: timeAxesWidth }}
              className="flex-shrink-0 flex items-start justify-end pr-2 pt-1"
            >
              <span className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wide leading-none">all‑day</span>
            </div>
            {dayIndices.map(dayIndex => {
              const dayAllDay = allDayByDay[dayIndex] || [];
              return (
                <div
                  key={dayIndex}
                  data-calendar-day={dayIndex}
                  className={`flex-1 min-w-0 border-l border-gray-100 dark:border-gray-700 min-h-[26px] py-0.5 px-0.5 ${
                    isTodayCol(dayIndex) ? 'bg-gray-100/60 dark:bg-gray-800/60' : ''
                  } ${
                    onAllDayClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40' : ''
                  }`}
                  onClick={() => { if (eatSuppressedClick()) return; onAllDayClick?.(dayIndex); }}
                >
                  {dayAllDay.map(event => {
                    const chipDraggable = dragEnabled && !event._isGhost;
                    return (
                      <div
                        key={event.id ?? event._planEventId ?? event.label}
                        className={`text-[10px] leading-tight px-1.5 py-0.5 rounded truncate mb-0.5 ${
                          event._isGhost ? 'border border-dashed opacity-50' : ''
                        }`}
                        style={{
                          backgroundColor: event._isGhost ? 'transparent' : event.color + '28',
                          borderColor: event.color,
                          borderLeft: event._isGhost ? undefined : `2px solid ${event.color}`,
                          color: event.color,
                          cursor: chipDraggable ? 'grab' : 'pointer',
                          touchAction: chipDraggable ? 'none' : undefined,
                          opacity: event._isDragPreview ? 0.65 : undefined,
                        }}
                        onPointerDown={chipDraggable ? (e => {
                          if (e.button !== undefined && e.button !== 0) return;
                          e.stopPropagation();
                          handleDragStart(event, e.pointerId, e.clientX, e.clientY);
                        }) : undefined}
                        onClick={e => { e.stopPropagation(); handleEventClick(event); }}
                      >
                        {event.label}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Grid body */}
        <div data-calendar-row="time-grid" className="flex" style={{ height: totalHeight + TOP_PAD }}>
          {/* Time labels */}
          {axisTimezones.map((timeZone, axisIndex) => (
            <div
              key={timeZone}
              data-time-zone={timeZone}
              style={{ width: TIME_COL_WIDTH, minWidth: TIME_COL_WIDTH }}
              className="relative flex-shrink-0 border-r border-gray-100 dark:border-gray-700"
            >
              {Array.from({ length: slotCount }, (_, i) => {
                if (precision === 0.5 && i % 2 !== 0) return null;
                return (
                  <div
                    key={i}
                    className={`absolute right-1.5 text-[10px] leading-none ${
                      axisIndex === axisTimezones.length - 1
                        ? 'text-gray-500 dark:text-gray-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                    style={{ top: TOP_PAD + i * SLOT_HEIGHT - 7 }}
                  >
                    {axisTimezones.length === 1
                      ? slotToTime(i, precision, militaryTime)
                      : formatTimeZoneSlot(i, precision, timeZone, primaryTimeZone, weekStart, militaryTime)}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Day columns */}
          {dayIndices.map(dayIndex => {
            const dayEvents = timedEvents.filter(e => e.day_of_week === dayIndex);
            return (
              <div
                key={dayIndex}
                data-calendar-day={dayIndex}
                ref={el => { dayColRefs.current[dayIndex] = el; }}
                className={`flex-1 relative border-l border-gray-100 dark:border-gray-700 min-w-0 ${
                  isTodayCol(dayIndex) ? 'bg-gray-100/40 dark:bg-gray-800/40' : ''
                } ${onSlotClick ? 'cursor-pointer' : 'cursor-default'}`}
                style={{ height: totalHeight, marginTop: TOP_PAD }}
                onClick={e => { if (eatSuppressedClick()) return; onSlotClick && handleColumnClick(e, dayIndex); }}
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
                    stackOverlap={stackOverlap}
                    onClick={handleEventClick}
                    onDragStart={dragEnabled ? handleDragStart : undefined}
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
