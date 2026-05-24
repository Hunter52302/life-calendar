import { hoursToLabel } from '../lib/utils';

export default function DiffSummary({ diff }) {
  const entries = Object.values(diff.byCategory);

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500">
        <p className="text-base mb-1">No data yet</p>
        <p className="text-sm">Add events to the Plan and Live calendars to see how you compare.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {entries.map(({ category, planned, actual, delta }) => {
        const status = Math.abs(delta) < 0.25 ? 'good' : delta < 0 ? 'under' : 'over';
        const s = {
          good:  { card: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',  delta: 'text-green-600 dark:text-green-400',  badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',  text: 'on track' },
          under: { card: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20',  delta: 'text-amber-600 dark:text-amber-400',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',  text: 'under' },
          over:  { card: 'border-red-200   bg-red-50   dark:border-red-800   dark:bg-red-900/20',    delta: 'text-red-600   dark:text-red-400',    badge: 'bg-red-100   text-red-700   dark:bg-red-900/40   dark:text-red-400',    text: 'over' },
        }[status];

        return (
          <div key={category.id} className={`rounded-xl border p-4 ${s.card}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                <span className="font-semibold text-gray-900 dark:text-gray-100">{category.label}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.badge}`}>{s.text}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Planned</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{hoursToLabel(planned)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Live</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{hoursToLabel(actual)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Delta</div>
                <div className={`text-sm font-semibold ${s.delta}`}>
                  {delta >= 0 ? '+' : ''}{hoursToLabel(delta)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
