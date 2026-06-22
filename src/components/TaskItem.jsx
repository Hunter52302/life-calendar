import { useState, useEffect } from 'react';

const PRIORITY_OPTS = [
  { value: 'low',    label: 'Low',    color: 'text-gray-400' },
  { value: 'medium', label: 'Medium', color: 'text-amber-500' },
  { value: 'high',   label: 'High',   color: 'text-red-500' },
];

const TASK_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#22C55E', '#10B981', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#EC4899',
  '#6B7280',
];

/**
 * TaskItem — single task row for list view and Kanban card.
 *
 * Props:
 *   task          – task object from useTasks
 *   onComplete    – () => void
 *   onUncomplete  – () => void
 *   onUpdate      – (fields) => void
 *   onDelete      – () => void
 *   compact       – boolean (Kanban card mode: no drag handle, condensed)
 *   dragHandle    – optional ref / props spread from dnd-kit useSortable
 */
export default function TaskItem({ task, onComplete, onUncomplete, onUpdate, onDelete, compact = false, dragHandle = null }) {
  const [expanded, setExpanded] = useState(false);
  const [descOpen, setDescOpen] = useState(false);   // inline description viewer
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [descDraft, setDescDraft] = useState(task.description || '');
  const [saved, setSaved] = useState(false);

  // Sync drafts from task when panel opens (so edits on a re-render are fresh)
  useEffect(() => {
    if (expanded) {
      setTitleDraft(task.title);
      setDescDraft(task.description || '');
    }
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = task.status === 'completed';

  function handleToggle() {
    if (done) onUncomplete();
    else onComplete();
  }

  function handleTitleBlur() {
    // no-op: saving handled by Save button
  }

  function handleDescBlur() {
    // no-op: saving handled by Save button
  }

  function handleSave() {
    const updates = {};
    const trimmedTitle = titleDraft.trim();
    if (trimmedTitle !== task.title) updates.title = trimmedTitle || task.title;
    if (descDraft !== (task.description || '')) updates.description = descDraft || null;
    if (Object.keys(updates).length > 0) onUpdate(updates);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    setExpanded(false);
  }

  function handleDueDateChange(e) {
    onUpdate({ due_date: e.target.value || null });
  }

  function handlePriorityChange(value) {
    onUpdate({ priority: value });
  }

  function handleColorChange(color) {
    onUpdate({ color: color === task.color ? null : color });
  }

  const priorityOpt = PRIORITY_OPTS.find(p => p.value === task.priority) ?? PRIORITY_OPTS[1];

  if (compact) {
    // ── Kanban card ────────────────────────────────────────────────────────
    return (
      <div
        className={`rounded-lg border p-3 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm select-none ${done ? 'opacity-60' : ''}`}
        style={task.color ? { borderLeftColor: task.color, borderLeftWidth: 3 } : {}}
      >
        <div className="flex items-start gap-2">
          {/* Drag handle */}
          {dragHandle && (
            <span {...dragHandle} className="mt-0.5 flex-shrink-0 cursor-grab text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500 touch-none">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 4a1 1 0 000 2h.01a1 1 0 000-2H7zm6 0a1 1 0 000 2h.01a1 1 0 000-2H13zM7 9a1 1 0 000 2h.01a1 1 0 000-2H7zm6 0a1 1 0 000 2h.01a1 1 0 000-2H13zM7 14a1 1 0 000 2h.01a1 1 0 000-2H7zm6 0a1 1 0 000 2h.01a1 1 0 000-2H13z" />
              </svg>
            </span>
          )}
          {/* Checkbox */}
          <button
            type="button"
            onClick={handleToggle}
            className={`flex-shrink-0 w-4 h-4 mt-0.5 rounded border-2 transition-colors flex items-center justify-center ${
              done
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-gray-300 dark:border-gray-500 hover:border-green-400 dark:hover:border-green-500'
            }`}
          >
            {done && (
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          {/* Title */}
          <span className={`text-sm flex-1 min-w-0 break-words leading-snug ${done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
            {task.title || <span className="text-gray-400 italic">Untitled</span>}
          </span>
          {/* Delete */}
          <button
            type="button"
            onClick={onDelete}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm leading-none"
          >×</button>
        </div>
        {task.due_date && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 pl-6">
            {task.due_date}
          </p>
        )}
        {task.priority !== 'medium' && (
          <span className={`text-[10px] font-medium pl-6 ${priorityOpt.color}`}>{priorityOpt.label} priority</span>
        )}
      </div>
    );
  }

  // ── List row — 5-column grid: [checkbox][title][priority][notes][delete] ────
  return (
    <div className={`group rounded-lg transition-colors ${expanded || descOpen ? 'bg-gray-50 dark:bg-gray-800/60' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
      {/* checkbox(20px) | title(1fr) | priority(52px) | notes(24px) | delete(26px) */}
      <div className="grid items-center gap-x-3 px-2 py-1.5" style={{ gridTemplateColumns: '20px 1fr 52px 24px 26px' }}>

        {/* Col 1 — Checkbox */}
        <button
          type="button"
          onClick={handleToggle}
          className={`w-5 h-5 rounded border-2 transition-colors flex items-center justify-center flex-shrink-0 ${
            done
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 dark:border-gray-500 hover:border-green-400 dark:hover:border-green-500'
          }`}
        >
          {done && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Col 2 — Title + optional color bar + due date sub-text */}
        <button
          type="button"
          onClick={() => { setExpanded(v => !v); setDescOpen(false); }}
          className="text-left min-w-0 flex items-center gap-1.5 py-0.5"
        >
          {task.color && (
            <span className="flex-shrink-0 w-1 h-4 rounded-full" style={{ backgroundColor: task.color }} />
          )}
          <span className="min-w-0">
            <span className={`block text-sm leading-snug truncate ${done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
              {task.title || <span className="italic text-gray-400">Untitled</span>}
            </span>
            {task.due_date && (
              <span className="block text-[10px] text-gray-400 dark:text-gray-500 leading-none mt-0.5">
                {task.due_date}
              </span>
            )}
          </span>
        </button>

        {/* Col 3 — Priority text */}
        <span className={`text-[10px] font-semibold text-right ${priorityOpt.color}`}>
          {task.priority !== 'medium' ? priorityOpt.label : ''}
        </span>

        {/* Col 4 — Notes icon (only when description exists) */}
        <div className="flex items-center justify-center">
          {task.description ? (
            <button
              type="button"
              onClick={() => { setDescOpen(v => !v); setExpanded(false); }}
              title="View description"
              className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                descOpen
                  ? 'text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                  : 'text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {/* Notecard / document icon */}
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          ) : (
            <span /> /* empty placeholder keeps grid stable */
          )}
        </div>

        {/* Col 5 — Delete */}
        <button
          type="button"
          onClick={onDelete}
          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 dark:text-gray-500 hover:text-red-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-base leading-none"
        >×</button>
      </div>

      {/* Inline description viewer — click notecard icon to open */}
      {descOpen && task.description && (
        <div className="mx-2 mb-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2" style={{ marginLeft: '2.25rem' }}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed flex-1">
              {task.description}
            </p>
            <button
              type="button"
              onClick={() => { setDescOpen(false); setExpanded(true); }}
              className="flex-shrink-0 text-[10px] text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors whitespace-nowrap"
            >
              Edit ›
            </button>
          </div>
        </div>
      )}

      {/* Expanded detail panel — indented to align with title column */}
      {expanded && (
        <div className="pb-3 space-y-2" style={{ paddingLeft: '2.5rem', paddingRight: '0.5rem' }}>
          {/* Editable title */}
          <input
            type="text"
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={handleTitleBlur}
            className="w-full text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
            placeholder="Task title"
          />

          {/* Description */}
          <textarea
            value={descDraft}
            onChange={e => setDescDraft(e.target.value)}
            onBlur={handleDescBlur}
            rows={2}
            placeholder="Add a description…"
            className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
          />

          <div className="flex flex-wrap items-center gap-3">
            {/* Priority */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Priority</span>
              <div className="flex gap-0.5">
                {PRIORITY_OPTS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => handlePriorityChange(p.value)}
                    className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                      task.priority === p.value
                        ? 'bg-gray-200 dark:bg-gray-600 font-semibold ' + p.color
                        : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Due date */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Due</span>
              <input
                type="date"
                value={task.due_date || ''}
                onChange={handleDueDateChange}
                className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Color swatches */}
          <div className="flex flex-wrap gap-1 items-center">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mr-1">Color</span>
            {TASK_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => handleColorChange(c)}
                className={`w-4 h-4 rounded-full border-2 transition-all hover:scale-110 ${
                  task.color === c ? 'border-gray-400 dark:border-white scale-110' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-500'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            {task.color && (
              <button
                type="button"
                onClick={() => onUpdate({ color: null })}
                className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 ml-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Save button */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              className="text-xs px-3 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
            >
              {saved ? '✓ Saved' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setTitleDraft(task.title);
                setDescDraft(task.description || '');
                setExpanded(false);
              }}
              className="text-xs px-3 py-1 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* ── Test: simulate rollover ── */}
          {task.status !== 'completed' && (
            <div className="pt-1 border-t border-dashed border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  const yd = yesterday.toISOString().slice(0, 10);
                  const today = new Date().toISOString().slice(0, 10);
                  // Simulate what the rollover hook produces:
                  // original_date = yesterday, due_date = today, status = pending
                  onUpdate({ due_date: today, original_date: yd, status: 'pending', completed_at: null });
                }}
                className="flex items-center gap-1.5 text-[10px] text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
                title="Simulate: mark this task as not completed from yesterday so it appears in the rollover section"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Test: simulate "not completed from yesterday"
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
