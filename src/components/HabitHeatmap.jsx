import { useMemo } from 'react';

const DAYS = ['S','M','T','W','T','F','S'];
const WEEKS = 15;

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function HabitHeatmap({ habits, completions }) {
  const grid = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    // Find the Sunday of the week containing today
    const endSunday = new Date(today);
    endSunday.setDate(endSunday.getDate() + (6 - today.getDay())); // end on Saturday? no — let's end on today's Saturday
    // Actually build WEEKS columns starting from (WEEKS-1) weeks ago on Sunday
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - today.getDay() - 7 * (WEEKS - 1));

    // Map: dateStr → { completions, total }
    const completionSet = new Set(completions.map(c => `${c.habit_id}::${c.date}`));

    const weeks = [];
    let cursor = new Date(startDate);
    for (let w = 0; w < WEEKS; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = toDateStr(cursor);
        const isFuture = cursor > today;
        const activeHabits = habits.filter(h => h.active && (h.target_days ?? [0,1,2,3,4,5,6]).includes(cursor.getDay()));
        const total = activeHabits.length;
        const done  = isFuture ? 0 : activeHabits.filter(h => completionSet.has(`${h.id}::${dateStr}`)).length;
        days.push({ dateStr, done, total, isFuture });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(days);
    }
    return weeks;
  }, [habits, completions]);

  function cellColor(done, total, isFuture) {
    if (isFuture || total === 0) return 'bg-gray-100 dark:bg-gray-800';
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
                title={cell.isFuture ? '' : `${formatLabel(cell.dateStr)} — ${cell.done}/${cell.total} habits`}
                className={`w-3 h-3 rounded-sm cursor-default transition-colors ${cellColor(cell.done, cell.total, cell.isFuture)}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
