import { DAYS_SHORT } from '../lib/constants';
import { getMonthDays, getEventsForDate, todayStr, getWeekNumber } from '../lib/utils';

// How many event rows to show before "+N more" based on number of weeks in the month
const MAX_VISIBLE = { 4: 6, 5: 4, 6: 3 };

function formatTime(slot, militaryTime = false) {
  if (slot == null) return '';
  const totalMins = slot * 15;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (militaryTime) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
}

export default function MonthGridView({
  year, month, events, allCategories,
  onDayClick, onWeekClick,
  showWeekNumbers = false,
  militaryTime = false,
  weekStartsOn = 0,
}) {
  const days = getMonthDays(year, month, weekStartsOn);
  const orderedDayNames = [...DAYS_SHORT.slice(weekStartsOn), ...DAYS_SHORT.slice(0, weekStartsOn)];
  const today = todayStr();
  const numWeeks = days.length / 7;
  const maxVisible = MAX_VISIBLE[numWeeks] ?? 3;

  // Chunk flat day array into weeks
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // CSS grid columns: optional narrow week-number column + 7 equal day columns
  const colStyle = {
    gridTemplateColumns: showWeekNumbers
      ? '36px repeat(7, minmax(0, 1fr))'
      : 'repeat(7, minmax(0, 1fr))',
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Day-of-week header */}
      <div
        className="grid border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0"
        style={colStyle}
      >
        {showWeekNumbers && (
          <div className="border-r border-gray-100 dark:border-gray-700" />
        )}
        {orderedDayNames.map(d => (
          <div key={d} className="text-center py-2 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div
        className="grid flex-1"
        style={{
          ...colStyle,
          gridTemplateRows: `repeat(${numWeeks}, minmax(0, 1fr))`,
        }}
      >
        {weeks.flatMap((weekDays, wIdx) => {
          const cells = [];

          // Week-number cell
          if (showWeekNumbers) {
            const weekNum = getWeekNumber(weekDays[0].dateStr);
            const weekStartStr = weekDays[0].dateStr;
            cells.push(
              <button
                key={`wn-${wIdx}`}
                onClick={() => onWeekClick?.(weekStartStr)}
                title={`Go to week ${weekNum}`}
                className="flex items-start justify-center pt-1.5 border-b border-r border-gray-100 dark:border-gray-800 text-[10px] font-semibold text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors cursor-pointer"
              >
                {weekNum}
              </button>
            );
          }

          // Day cells
          weekDays.forEach(({ dateStr, isCurrentMonth }) => {
            const dayEvents = getEventsForDate(dateStr, events)
              // Sort: all-day first, then by start slot
              .sort((a, b) => {
                if (a.is_all_day && !b.is_all_day) return -1;
                if (!a.is_all_day && b.is_all_day) return 1;
                return (a.slot_start ?? 0) - (b.slot_start ?? 0);
              });

            const isToday = dateStr === today;
            const dayNum = parseInt(dateStr.split('-')[2], 10);
            const visible = dayEvents.slice(0, maxVisible);
            const overflow = dayEvents.length - maxVisible;

            cells.push(
              <div
                key={dateStr}
                onClick={() => onDayClick?.(dateStr)}
                className={`flex flex-col border-b border-r border-gray-100 dark:border-gray-800 overflow-hidden ${
                  onDayClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors' : ''
                } ${!isCurrentMonth ? 'bg-gray-50/60 dark:bg-gray-800/30' : 'bg-white dark:bg-gray-900'}`}
              >
                {/* Date number */}
                <div className="flex-shrink-0 px-1.5 pt-1 pb-0.5">
                  <span className={`inline-flex items-center justify-center text-xs font-semibold w-5 h-5 rounded-full ${
                    isToday
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : isCurrentMonth
                        ? 'text-gray-700 dark:text-gray-300'
                        : 'text-gray-300 dark:text-gray-600'
                  }`}>
                    {dayNum}
                  </span>
                </div>

                {/* Event list */}
                <div className="flex-1 overflow-hidden px-0.5 pb-0.5 space-y-px min-h-0">
                  {visible.map(ev => {
                    const cat = allCategories?.find(c => c.id === ev.category);
                    const color = ev.color || cat?.color || '#6B7280';
                    const title = ev.label || ev.title || 'Untitled';
                    const timeStr = ev.is_all_day ? '' : formatTime(ev.slot_start, militaryTime);

                    return (
                      <div
                        key={ev.id}
                        className="flex items-center gap-0.5 px-1 rounded text-white truncate"
                        style={{ backgroundColor: color, minHeight: '1.1rem' }}
                        title={`${timeStr ? timeStr + ' ' : ''}${title}`}
                      >
                        {timeStr && (
                          <span className="text-[9px] font-semibold flex-shrink-0 opacity-90 leading-none">
                            {timeStr}
                          </span>
                        )}
                        <span className="text-[10px] font-medium truncate leading-none py-px">
                          {title}
                        </span>
                      </div>
                    );
                  })}

                  {overflow > 0 && (
                    <div className="text-[9px] text-gray-400 dark:text-gray-500 px-1 leading-none pt-px">
                      +{overflow} more
                    </div>
                  )}
                </div>
              </div>
            );
          });

          return cells;
        })}
      </div>
    </div>
  );
}
