import { useMemo } from 'react';

const DAYS = ['S','M','T','W','T','F','S'];
const DEFAULT_WEEKS = 15;      // fallback window when no range is supplied
const MAX_WEEKS = 53;          // cap grid width (~1 year) for arbitrary ranges

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function parseDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// The heatmap mirrors the Reality Check date filter: it renders whole weeks
// (Sun→Sat columns) spanning [startDate, endDate], greying out days that fall
// outside the range or in the future. With no range it falls back to the last
// DEFAULT_WEEKS weeks ending today.
export default function HabitHeatmap({ habits, completions, startDate, endDate }) {
  const grid = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);

    const rangeEnd   = endDate ? parseDate(endDate) : new Date(today);
    const rangeStart = startDate
      ? parseDate(startDate)
      : (() => { const d = new Date(rangeEnd); d.setDate(d.getDate() - 7 * (DEFAULT_WEEKS - 1) - d.getDay()); return d; })();

    // Grid extent: Sunday on/before rangeStart → Saturday on/after rangeEnd.
    const gridEnd = new Date(rangeEnd);
    gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));
    let gridStart = new Date(rangeStart);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());

    // Bound the number of columns so a huge custom range can't explode the DOM;
    // keep the most-recent MAX_WEEKS weeks ending at gridEnd. gridStart is a
    // Sunday and gridEnd a Saturday, so the inclusive day span is a whole number
    // of weeks — the +1 makes it inclusive before dividing.
    let weekCount = Math.round(((gridEnd - gridStart) / 86400000 + 1) / 7);
    if (weekCount > MAX_WEEKS) {
      weekCount = MAX_WEEKS;
      gridStart = new Date(gridEnd);
      gridStart.setDate(gridStart.getDate() - (MAX_WEEKS * 7 - 1));
    }
    if (weekCount < 1) weekCount = 1;

    const completionSet = new Set(completions.map(c => `${c.habit_id}::${c.date}`));

    const weeks = [];
    let cursor = new Date(gridStart);
    for (let w = 0; w < weekCount; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = toDateStr(cursor);
        // A cell holds data only if it's within the selected range AND not in
        // the future; everything else is rendered muted (blank).
        const muted = cursor < rangeStart || cursor > rangeEnd || cursor > today;
        const activeHabits = muted ? [] : habits.filter(h => h.active && (h.target_days ?? [0,1,2,3,4,5,6]).includes(cursor.getDay()));
        const total = activeHabits.length;
        const done  = activeHabits.filter(h => completionSet.has(`${h.id}::${dateStr}`)).length;
        days.push({ dateStr, done, total, muted });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(days);
    }
    return weeks;
  }, [habits, completions, startDate, endDate]);

  function cellColor(done, total, muted) {
    if (muted || total === 0)   return 'bg-gray-100 dark:bg-gray-800';
    if (done === 0)              return 'bg-gray-200 dark:bg-gray-700';
    const pct = done / total;
    if (pct <= 0.25) return 'bg-emerald-100 dark:bg-emerald-900';
    if (pct <= 0.50) return 'bg-emerald-300 dark:bg-emerald-700';
    if (pct <= 0.75) return 'bg-emerald-500 dark:bg-emerald-500';
    return 'bg-emerald-700 dark:bg-emerald-400';
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {/* Day labels */}
        <div className="flex flex-col gap-1 pt-5">
          {DAYS.map((d, i) => (
            <div key={i} className="w-3 h-3 flex items-center justify-center text-[9px] text-gray-400 dark:text-gray-500 leading-none">
              {i % 2 === 0 ? d : ''}
            </div>
          ))}
        </div>
        {/* Week columns */}
        {grid.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {wi === 0 || new Date(week[0].dateStr + 'T00:00:00').getDate() <= 7 ? (
              <div className="h-4 text-[9px] text-gray-400 dark:text-gray-500 leading-none whitespace-nowrap">
                {new Date(week[0].dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
              </div>
            ) : <div className="h-4" />}
            {week.map((cell) => (
              <div
                key={cell.dateStr}
                title={cell.muted ? '' : `${formatLabel(cell.dateStr)} — ${cell.done}/${cell.total} habits`}
                className={`w-3 h-3 rounded-sm cursor-default transition-colors ${cellColor(cell.done, cell.total, cell.muted)}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
