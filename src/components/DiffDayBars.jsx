import { hoursToLabel } from '../lib/utils';

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function DayCard({ dateStr, entries }) {
  const maxHours = Math.max(...entries.flatMap(e => [e.planned, e.actual]), 0.1);

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700/60 bg-white dark:bg-gray-800/40 p-3">
      <h3 className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2.5">
        {formatDateLabel(dateStr)}
      </h3>
      <div className="space-y-2.5">
        {entries.map(({ category, planned, actual, delta }) => (
          <div key={category.id} className="flex items-center gap-2.5">
            {/* Category label */}
            <div className="w-16 flex-shrink-0 text-[11px] text-gray-500 dark:text-gray-400 truncate" title={category.label}>
              {category.label}
            </div>
            {/* Bars */}
            <div className="flex-1 space-y-0.5 min-w-0">
              {/* Planned bar */}
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full opacity-35 transition-all"
                    style={{ width: `${(planned / maxHours) * 100}%`, backgroundColor: category.color }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 w-7 text-right tabular-nums flex-shrink-0">
                  {hoursToLabel(planned)}
                </span>
              </div>
              {/* Actual bar */}
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(actual / maxHours) * 100}%`, backgroundColor: category.color }}
                  />
                </div>
                <span className={`text-[10px] w-7 text-right font-semibold tabular-nums flex-shrink-0 ${
                  Math.abs(delta) < 0.25
                    ? 'text-green-600 dark:text-green-400'
                    : delta < 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400'
                }`}>
                  {delta >= 0 ? '+' : ''}{hoursToLabel(delta)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DiffDayBars({ diff }) {
  const dates = Object.keys(diff.byDay).sort();
  if (dates.length === 0) return null;

  const dayCount = dates.length;

  // Pick column count based on how many days we're showing
  // 1–3 days → 1 col, 4–6 → 2 cols, 7–13 → 3 cols, 14–27 → 4 cols, 28+ → 5 cols
  const cols =
    dayCount <= 3  ? 1 :
    dayCount <= 6  ? 2 :
    dayCount <= 13 ? 3 :
    dayCount <= 27 ? 4 : 5;

  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 lg:grid-cols-5',
  }[cols];

  return (
    <div className={`grid gap-3 ${gridClass}`}>
      {dates.map(dateStr => {
        const entries = Object.values(diff.byDay[dateStr]);
        if (entries.length === 0) return null;
        return <DayCard key={dateStr} dateStr={dateStr} entries={entries} />;
      })}
    </div>
  );
}
