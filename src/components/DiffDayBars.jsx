import { hoursToLabel } from '../lib/utils';

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function DiffDayBars({ diff }) {
  const dates = Object.keys(diff.byDay).sort();
  if (dates.length === 0) return null;

  return (
    <div className="space-y-6">
      {dates.map(dateStr => {
        const entries = Object.values(diff.byDay[dateStr]);
        if (entries.length === 0) return null;
        const maxHours = Math.max(...entries.flatMap(e => [e.planned, e.actual]), 0.1);

        return (
          <div key={dateStr}>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              {formatDateLabel(dateStr)}
            </h3>
            <div className="space-y-3">
              {entries.map(({ category, planned, actual, delta }) => (
                <div key={category.id} className="flex items-center gap-3">
                  <div className="w-20 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 truncate">
                    {category.label}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full opacity-35 transition-all"
                          style={{ width: `${(planned / maxHours) * 100}%`, backgroundColor: category.color }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500 w-8 text-right tabular-nums">
                        {hoursToLabel(planned)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${(actual / maxHours) * 100}%`, backgroundColor: category.color }}
                        />
                      </div>
                      <span className={`text-xs w-8 text-right font-semibold tabular-nums ${
                        Math.abs(delta) < 0.25 ? 'text-green-600 dark:text-green-400' : delta < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
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
      })}
    </div>
  );
}
