import { useState, useRef, useEffect } from 'react';
import PopoutWindow from './PopoutWindow';

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
  categoryFilters = [],
  onToggleFilter,
  onClearFilters,
  onManage,
}) {
  const [open, setOpen] = useState(false);
  const [poppedOut, setPoppedOut] = useState(false);
  const [editingColor, setEditingColor] = useState(null);
  const [editingLabel, setEditingLabel] = useState(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [colorConflictPending, setColorConflictPending] = useState(null); // { catId, color }
  const panelRef = useRef(null);

  // Close panel on outside click (only relevant to the in-page dropdown).
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

  const hasFilters = categoryFilters.length > 0;
  // The legend shows pinned categories plus any filtered-on category that isn't
  // pinned — otherwise filtering from the dropdown would leave no visible trace
  // of what's active.
  const legendCats = allCategories.filter(
    c => pinnedCategories.includes(c.id) || categoryFilters.includes(c.id)
  );

  function commitLabel(cat) {
    const trimmed = labelDraft.trim();
    if (trimmed && trimmed !== cat.label) onUpdateCategory?.(cat.id, { label: trimmed });
    setEditingLabel(null);
  }

  // The scrollable list of categories — shared by the dropdown and the pop-out.
  const categoryList = (
    <div className="space-y-0.5">
      {allCategories.map(cat => {
        const isPinned = pinnedCategories.includes(cat.id);
        const isFiltered = categoryFilters.includes(cat.id);
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
                aria-pressed={isFiltered}
                title={
                  isFiltered ? `Stop filtering by ${cat.label}`
                  : hasFilters ? `Add ${cat.label} to filter`
                  : `Only show ${cat.label}`
                }
                onClick={() => onToggleFilter?.(cat.id)}
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
  );

  const manageFooter = onManage && (
    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
      <button
        type="button"
        onClick={() => { setOpen(false); setPoppedOut(false); onManage(); }}
        className="w-full text-left text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 px-1 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        Manage categories →
      </button>
    </div>
  );

  // Header row with the pop-out (or dock-back) control.
  const panelHeader = (isPopped) => (
    <div className="flex items-center justify-between mb-2 px-1">
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
        Categories
      </p>
      <button
        type="button"
        title={isPopped ? 'Dock back into window' : 'Pop out to a separate window'}
        aria-label={isPopped ? 'Dock back into window' : 'Pop out to a separate window'}
        onClick={() => {
          if (isPopped) { setPoppedOut(false); }
          else { setPoppedOut(true); setOpen(false); setEditingColor(null); setColorConflictPending(null); }
        }}
        className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        {isPopped ? (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L4 20m0 0h5m-5 0v-5M20 6a2 2 0 00-2-2H6a2 2 0 00-2 2v6" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 4h6m0 0v6m0-6L10 14M20 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h4" />
          </svg>
        )}
      </button>
    </div>
  );

  return (
    <div className="relative flex items-center gap-1.5" ref={panelRef}>
      {/* Category legend — each entry toggles that category into the filter.
          Hidden on mobile, where the dropdown is the only entry point. */}
      {legendCats.length > 0 && (
        <>
          {legendCats.map(cat => {
            const isFiltered = categoryFilters.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={isFiltered}
                title={
                  isFiltered ? `Stop filtering by ${cat.label}`
                  : hasFilters ? `Add ${cat.label} to filter`
                  : `Only show ${cat.label}`
                }
                onClick={() => onToggleFilter?.(cat.id)}
                className={`hidden lg:flex items-center gap-1.5 text-xs whitespace-nowrap rounded-full px-1.5 py-0.5 border transition-all ${
                  isFiltered
                    ? 'border-gray-300 dark:border-gray-500 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-medium'
                    : `border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-200 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-800 dark:hover:text-gray-200 ${
                        hasFilters ? 'opacity-40 hover:opacity-100' : ''
                      }`
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="max-w-[72px] truncate">{cat.label}</span>
              </button>
            );
          })}

          {/* Clear-all — only meaningful once something is filtered */}
          {hasFilters && (
            <button
              type="button"
              onClick={() => onClearFilters?.()}
              title="Show all categories"
              aria-label="Clear category filter"
              className="hidden lg:flex w-4 h-4 items-center justify-center rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex-shrink-0"
            >×</button>
          )}

          {/* Divider between legend and Categories button — only on wide screens where legend is visible */}
          <span className="hidden lg:block w-px h-4 bg-gray-200 dark:bg-gray-700 flex-shrink-0 mx-0.5" />
        </>
      )}

      {/* Categories button */}
      <button
        type="button"
        onClick={() => { if (poppedOut) setPoppedOut(false); else setOpen(o => !o); }}
        className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors flex-shrink-0 ${
          open || poppedOut
            ? 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white'
            : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        Categories
        {hasFilters && (
          <span className="ml-1 text-[10px] font-semibold text-blue-500 dark:text-blue-400">
            {categoryFilters.length}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && !poppedOut && (
        <div className="absolute right-0 top-9 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 z-50 w-60">
          {panelHeader(false)}
          {categoryList}
          {manageFooter}
        </div>
      )}

      {/* Detached window */}
      {poppedOut && (
        <PopoutWindow title="PLS Calendar — Categories" width={300} height={540} onClose={() => setPoppedOut(false)}>
          <div className="min-h-screen bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3">
            {panelHeader(true)}
            {categoryList}
            {manageFooter}
          </div>
        </PopoutWindow>
      )}
    </div>
  );
}
