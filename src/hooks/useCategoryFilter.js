import { useState, useMemo, useCallback } from 'react';

// Ids are joined with NUL, which can't occur in a category id, so the key is
// unambiguous.
const SEP = '\u0000';

/**
 * Multi-select category filter shared by the Plan and Actual views.
 *
 * `filters` is clamped to categories that still exist. Without that, deleting a
 * category while it was filtered left its id stranded in state: the filter kept
 * hiding every other event, while the legend and the dropdown — both built from
 * `allCategories` — had no row left to toggle it back off. With nothing pinned
 * that was unrecoverable short of a reload.
 *
 * An empty selection means "no filter" rather than "hide everything".
 */
export function useCategoryFilter(allCategories = []) {
  const [selected, setSelected] = useState([]);

  // App rebuilds `allCategories` on every render, so memoizing on its identity
  // would recompute `apply` — and with it every event filter downstream — on
  // each render. Key on the id contents instead, which only change when a
  // category is actually added or removed.
  const idKey = allCategories.map(c => c.id).join(SEP);
  const liveIds = useMemo(() => new Set(idKey ? idKey.split(SEP) : []), [idKey]);

  const filters = useMemo(
    () => selected.filter(id => liveIds.has(id)),
    [selected, liveIds]
  );

  const toggle = useCallback(id => {
    setSelected(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  }, []);

  const clear = useCallback(() => setSelected([]), []);

  // Closes over the clamped `filters`, so a dangling id can never filter events
  // out even before the next render prunes it from state.
  const apply = useCallback(
    events => filters.length ? events.filter(e => filters.includes(e.category)) : events,
    [filters]
  );

  return { filters, toggle, clear, apply };
}
