import { DAYS_SHORT } from '../lib/constants';
import { getMonthDays, getEventsForDate, todayStr, getWeekNumber } from '../lib/utils';

export default function MonthGridView({
  year, month, events, allCategories,
  onDayClick, onWeekClick,
  showWeekNumbers = false,
}) {
  const days = getMonthDays(year, month);
  const today = todayStr();
  const numWeeks = days.length / 7;

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
        {/* Blank header cell above week-number column */}
        {showWeekNumbers && (
          <div className="border-r border-gray-100 dark:border-gray-700" />
        )}
        {DAYS_SHORT.map(d => (
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
            const weekStartStr = weekDays[0].dateStr; // Sunday = week start
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
            const dayEvents = getEventsForDate(dateStr, events);
            const isToday = dateStr === today;
            const dayNum = parseInt(dateStr.split('-')[2], 10);

            const colorSet = new Set();
            dayEvents.forEach(e => colorSet.add(e.color || '#6B7280'));
            const colors = [...colorSet];

            cells.push(
              <div
                key={dateStr}
                onClick={() => onDayClick?.(dateStr)}
                className={`p-1.5 border-b border-r border-gray-100 dark:border-gray-800 overflow-hidden ${
                  onDayClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors' : ''
                } ${!isCurrentMonth ? 'bg-gray-50 dark:bg-gray-800/40' : 'dark:bg-gray-900'}`}
              >
                <div className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full mb-1 ${
                  isToday
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : isCurrentMonth
                    ? 'text-gray-700 dark:text-gray-300'
                    : 'text-gray-300 dark:text-gray-600'
                }`}>
                  {dayNum}
                </div>
                <div className="space-y-0.5">
                  {colors.slice(0, 4).map(color => (
                    <div key={color} className="h-1.5 rounded-full" style={{ backgroundColor: color }} />
                  ))}
                  {colors.length > 4 && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">+{colors.length - 4}</span>
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
