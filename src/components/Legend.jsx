export default function Legend({ categories }) {
  return (
    <div className="flex flex-wrap gap-3">
      {categories.map(cat => (
        <div key={cat.id} className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-sm flex-shrink-0"
            style={{ backgroundColor: cat.color }}
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">{cat.label}</span>
        </div>
      ))}
    </div>
  );
}
