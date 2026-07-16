import { DAYS_SHORT } from '../lib/constants';
import { getMonthDays, getEventsForDate, todayStr } from '../lib/utils';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function MiniMonth({ year, month, events, allCategories, onMonthClick, weekStartsOn = 0 }) {
  const days = getMonthDays(year, month, weekStartsOn);
  const today = todayStr();
  const numWeeks = days.length / 7;
  const weekdayInitials = Array.from({ length: 7 }, (_, i) => DAYS_SHORT[(weekStartsOn + i) % 7]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Month name — clickable */}
      <div
        onClick={() => onMonthClick?.(year, month)}
        className={`text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 text-center uppercase tracking-wide flex-shrink-0 ${
          onMonthClick ? 'cursor-pointer hover:text-blue-500 dark:hover:text-blue-400 transition-colors' : ''
        }`}
      >
        {MONTH_NAMES[month]} {year}
      </div>

      {/* Day-of-week initials */}
      <div className="grid grid-cols-7 flex-shrink-0 mb-0.5">
        {weekdayInitials.map((d, i) => (
          <div key={i} className="text-center text-[10px] text-gray-400 dark:text-gray-500">
            {d[0]}
          </div>
        ))}
      </div>

      {/* Day cells — stretch to fill remaining height */}
      <div
        className="grid grid-cols-7 flex-1 min-h-0"
        style={{ gridTemplateRows: `repeat(${numWeeks}, minmax(0, 1fr))` }}
      >
        {days.map(({ dateStr, isCurrentMonth }) => {
          const dayEvents = getEventsForDate(dateStr, events);
          const isToday = dateStr === today;
          const dayNum = parseInt(dateStr.split('-')[2], 10);

          // Use each event's stored color (set from category or linked calendar).
          const colors = [...new Set(dayEvents.map(e => e.color).filter(Boolean))];

          return (
            <div
              key={dateStr}
              className={`flex flex-col items-center justify-start pt-0.5 rounded-sm ${!isCurrentMonth ? 'opacity-20' : ''}`}
            >
              <div className={`text-[11px] leading-none mb-0.5 ${
                isToday
                  ? 'w-4 h-4 flex items-center justify-center rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-[10px]'
                  : isCurrentMonth
                  ? 'text-gray-700 dark:text-gray-300'
                  : 'text-gray-400 dark:text-gray-600'
              }`}>
                {dayNum}
              </div>
              {colors.length > 0 && (
                <div className="flex gap-px flex-wrap justify-center">
                  {colors.slice(0, 3).map((color, i) => (
                    <div key={i} className="w-1 h-1 rounded-full" style={{ backgroundColor: color }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MultiMonthView({ startYear, startMonth, monthCount, events, allCategories, onMonthClick, weekStartsOn = 0 }) {
  const months = [];
  for (let i = 0; i < monthCount; i++) {
    let y = startYear;
    let m = startMonth + i;
    while (m > 11) { m -= 12; y++; }
    months.push({ year: y, month: m });
  }

  const cols = monthCount <= 3 ? 1 : monthCount === 6 ? 2 : 4;
  const rows = Math.ceil(months.length / cols);

  return (
    <div className="lc-surface h-full flex flex-col overflow-hidden dark:bg-gray-900 p-4">
      <div
        className="grid gap-4 flex-1 min-h-0"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {months.map(({ year, month }) => (
          <MiniMonth
            key={`${year}-${month}`}
            year={year}
            month={month}
            events={events}
            allCategories={allCategories}
            onMonthClick={onMonthClick}
            weekStartsOn={weekStartsOn}
          />
        ))}
      </div>
    </div>
  );
}
