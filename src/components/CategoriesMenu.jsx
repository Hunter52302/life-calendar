import { useState, useRef, useEffect } from 'react';

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#22C55E', '#10B981', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#EC4899',
  '#6B7280', '#374151',
];

export default function CategoriesMenu({
  allCategories = [],
  pinnedCategories = [],
  onTogglePin,
  onUpdateCategory,
  categoryFilter = null,
  onSetFilter,
  onManage,
}) {
  const [open, setOpen] = useState(false);
  const [editingColor, setEditingColor] = useState(null);
  const [editingLabel, setEditingLabel] = useState(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [colorConflictPending, setColorConflictPending] = useState(null); // { catId, color }
  const panelRef = useRef(null);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
        setEditingColor(null);
        setEditingLabel(null);
        setColorConflictPending(null);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const pinnedCats = allCategories.filter(c => pinnedCategories.includes(c.id));
  const activeFilterCat = categoryFilter ? allCategories.find(c => c.id === categoryFilter) : null;

  function commitLabel(cat) {
    const trimmed = labelDraft.trim();
    if (trimmed && trimmed !== cat.label) onUpdateCategory?.(cat.id, { label: trimmed });
    setEditingLabel(null);
  }

  return (
    <div className="relative flex items-center gap-1.5" ref={panelRef}>
      {/* Pinned category legend — dot + name, hidden when a filter chip is active */}
      {!activeFilterCat && pinnedCats.length > 0 && (
        <>
          {pinnedCats.map(cat => (
            <span
              key={cat.id}
              className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap"
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="max-w-[72px] truncate">{cat.label}</span>
            </span>
          ))}
          {/* Divider between legend and Categories button */}
          <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 flex-shrink-0 mx-0.5" />
        </>
      )}

      {/* Active filter chip */}
      {activeFilterCat && (
        <div className="flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-full pl-1.5 pr-1 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: activeFilterCat.color }} />
          <span className="max-w-[80px] truncate">{activeFilterCat.label}</span>
          <button
            type="button"
            onClick={() => onSetFilter?.(null)}
            className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex-shrink-0"
            aria-label="Clear filter"
          >×</button>
        </div>
      )}

      {/* Categories button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors flex-shrink-0 ${
          open
            ? 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white'
            : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        Categories
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-9 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 z-50 w-60">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-1">
            Categories
          </p>
          <div className="space-y-0.5">
            {allCategories.map(cat => {
              const isPinned = pinnedCategories.includes(cat.id);
              const isFiltered = categoryFilter === cat.id;
              const isPickingColor = editingColor === cat.id;
              const isEditingLabel = editingLabel === cat.id;

              return (
                <div key={cat.id}>
                  <div className={`flex items-center gap-2 px-1.5 py-1 rounded-lg transition-colors ${
                    isFiltered ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}>
                    {/* Color swatch */}
                    <button
                      type="button"
                      title="Change color"
                      onClick={() => { setEditingColor(isPickingColor ? null : cat.id); setColorConflictPending(null); }}
                      className="flex-shrink-0 w-4 h-4 rounded-full border-2 hover:scale-110 transition-transform"
                      style={{
                        backgroundColor: cat.color,
                        borderColor: isPickingColor ? '#9CA3AF' : 'transparent',
                      }}
                    />

                    {/* Label — click to edit */}
                    {isEditingLabel ? (
                      <input
                        autoFocus
                        value={labelDraft}
                        onChange={e => setLabelDraft(e.target.value)}
                        onBlur={() => commitLabel(cat)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') e.target.blur();
                          if (e.key === 'Escape') setEditingLabel(null);
                        }}
                        className="flex-1 min-w-0 text-sm bg-gray-100 dark:bg-gray-700 rounded px-1.5 py-0.5 text-gray-900 dark:text-white outline-none border border-blue-400 dark:border-blue-500"
                      />
                    ) : (
                      <button
                        type="button"
                        title="Edit label"
                        onClick={() => { setEditingLabel(cat.id); setLabelDraft(cat.label); }}
                        className="flex-1 min-w-0 text-sm text-left text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white truncate"
                      >
                        {cat.label}
                      </button>
                    )}

                    {/* Pin toggle */}
                    <button
                      type="button"
                      title={isPinned ? 'Unpin from legend' : 'Pin to legend'}
                      onClick={() => onTogglePin?.(cat.id)}
                      className={`flex-shrink-0 text-base leading-none transition-colors ${
                        isPinned
                          ? 'text-yellow-400'
                          : 'text-gray-200 dark:text-gray-600 hover:text-yellow-300'
                      }`}
                    >★</button>

                    {/* Only-show filter */}
                    <button
                      type="button"
                      title={isFiltered ? 'Show all categories' : 'Only show this category'}
                      onClick={() => onSetFilter?.(isFiltered ? null : cat.id)}
                      className={`flex-shrink-0 text-base leading-none transition-colors ${
                        isFiltered
                          ? 'text-blue-500'
                          : 'text-gray-200 dark:text-gray-600 hover:text-blue-400'
                      }`}
                    >◉</button>
                  </div>

                  {/* Inline color picker */}
                  {isPickingColor && (
                    <div className="px-1.5 pb-2 pt-1">
                      {colorConflictPending?.catId === cat.id ? (
                        <div className="space-y-2">
                          <p className="text-xs text-amber-500 dark:text-amber-400 leading-snug">You already have another category with this color. Would you like to continue?</p>
                          <div className="flex gap-1.5">
                            <button type="button"
                              onClick={() => { onUpdateCategory?.(cat.id, { color: colorConflictPending.color }); setEditingColor(null); setColorConflictPending(null); }}
                              className="flex-1 text-xs py-1 rounded bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors">Yes</button>
                            <button type="button"
                              onClick={() => setColorConflictPending(null)}
                              className="flex-1 text-xs py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">No</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {PRESET_COLORS.map(c => {
                            const inUse = allCategories.some(other => other.color === c && other.id !== cat.id);
                            return (
                              <button key={c} type="button"
                                onClick={() => {
                                  if (inUse) { setColorConflictPending({ catId: cat.id, color: c }); }
                                  else { onUpdateCategory?.(cat.id, { color: c }); setEditingColor(null); }
                                }}
                                className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-110 ${
                                  c === cat.color
                                    ? 'border-gray-400 dark:border-white scale-110'
                                    : 'border-transparent hover:border-gray-300 dark:hover:border-gray-500'
                                }`}
                                style={{ backgroundColor: c }}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer: link to Manage Categories in settings */}
          {onManage && (
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => { setOpen(false); onManage(); }}
                className="w-full text-left text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 px-1 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Manage categories →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
