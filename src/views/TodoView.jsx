import { useState, useRef, useEffect } from 'react';
import TaskItem from '../components/TaskItem';
import KanbanBoard from '../components/KanbanBoard';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const PRIORITY_OPTS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
];

const TASK_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#22C55E', '#10B981', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#EC4899',
  '#6B7280',
];

const EMPTY_DRAFT = { title: '', description: '', priority: 'medium', color: null, due_date: null };

/**
 * Full inline add form — all fields visible immediately.
 * Appears in-place where "+Add task" was.
 */
function FullAddForm({ defaultDueDate, onAdd, onCancel }) {
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT, due_date: defaultDueDate ?? todayStr() });
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function handleSubmit() {
    if (!draft.title.trim()) {
      titleRef.current?.focus();
      return;
    }
    onAdd({ ...draft, title: draft.title.trim() });
  }

  return (
    <div
      className="rounded-xl border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800 shadow-sm p-3 space-y-2.5 mt-1"
      onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
    >
      {/* Title — Enter submits, only field that is required */}
      <input
        ref={titleRef}
        type="text"
        value={draft.title}
        onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
        placeholder="Task title…"
        className="w-full text-sm font-medium bg-transparent border-b border-gray-200 dark:border-gray-600 pb-1.5 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
      />

      {/* Description */}
      <textarea
        value={draft.description}
        onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
        rows={2}
        placeholder="Add a description… (optional)"
        className="w-full text-xs bg-gray-50 dark:bg-gray-700/60 rounded-lg px-2.5 py-2 text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 transition-colors"
      />

      {/* Priority + Due date row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Priority */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Priority</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
            {PRIORITY_OPTS.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => setDraft(d => ({ ...d, priority: p.value }))}
                className={`text-xs px-2 py-1 transition-colors ${
                  draft.priority === p.value
                    ? 'bg-blue-500 text-white font-semibold'
                    : 'bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Due date */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Due</span>
          <input
            type="date"
            value={draft.due_date ?? ''}
            onChange={e => setDraft(d => ({ ...d, due_date: e.target.value || null }))}
            className="text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-gray-700 dark:text-gray-300 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Color swatches */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mr-0.5">Color</span>
        {TASK_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setDraft(d => ({ ...d, color: d.color === c ? null : c }))}
            className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-110 ${
              draft.color === c
                ? 'border-gray-400 dark:border-white scale-110'
                : 'border-transparent hover:border-gray-300 dark:hover:border-gray-500'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={handleSubmit}
          className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
        >
          Add task
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs transition-colors"
        >
          Cancel
        </button>
        <span className="ml-auto text-[10px] text-gray-300 dark:text-gray-600 hidden sm:inline">
          Enter to add · Esc to cancel
        </span>
      </div>
    </div>
  );
}

/**
 * TodoView — the "PLS Do It" page.
 *
 * Props:
 *   tasks           – array from useTasks
 *   todoView        – 'list' | 'kanban'
 *   fabOpen         – boolean controlled by parent (App.jsx FAB button)
 *   onFabClose      – () => void
 *   onAddTask       – (fields) => void
 *   onUpdateTask    – (id, fields) => void
 *   onDeleteTask    – (id) => void
 *   onCompleteTask  – (id) => void
 *   onUncompleteTask– (id) => void
 *   onMoveCard      – (id, kanban_column) => void
 *   onReorderTasks  – (updates) => void
 */
export default function TodoView({
  tasks,
  todoView = 'list',
  autoHideCompleted = false,
  kanbanColumns = [],
  kanbanDragDrop = true,
  fabOpen = false,
  onFabClose,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onCompleteTask,
  onUncompleteTask,
  onMoveCard,
  onReorderTasks,
}) {
  const [addingForDate, setAddingForDate] = useState(null);
  // Show completed by default; hide by default only when autoHideCompleted is on
  const [showCompleted, setShowCompleted] = useState(!autoHideCompleted);

  const today = todayStr();

  // FAB opens the Today add form
  useEffect(() => {
    if (fabOpen) {
      setAddingForDate(today);
      onFabClose?.();
    }
  }, [fabOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Partition tasks ──────────────────────────────────────────────────────
  const rolled = tasks.filter(
    t => t.status !== 'completed' && t.original_date && t.original_date !== t.due_date
  ).sort((a, b) => (a.original_date < b.original_date ? -1 : 1));

  const todayTasks = tasks
    .filter(t => t.due_date === today && !(t.original_date && t.original_date !== t.due_date))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at - b.created_at);

  const upcomingTasks = tasks.filter(t => t.due_date && t.due_date > today && t.status !== 'completed');
  const upcomingByDate = upcomingTasks.reduce((acc, t) => {
    (acc[t.due_date] ??= []).push(t);
    return acc;
  }, {});
  const upcomingDates = Object.keys(upcomingByDate).sort();

  const completedTasks = tasks.filter(t => t.status === 'completed')
    .sort((a, b) => (b.completed_at ?? 0) - (a.completed_at ?? 0));

  const noDateTasks = tasks.filter(t => !t.due_date && t.status !== 'completed');

  function handleAdd(fields) {
    onAddTask(fields);
    setAddingForDate(null);
  }

  // Small "+Add task" trigger button (shown when form is closed)
  function AddTrigger({ dateStr }) {
    return (
      <button
        type="button"
        onClick={() => setAddingForDate(dateStr)}
        className="flex items-center gap-2 px-2 py-1.5 w-full text-left text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-lg transition-colors mt-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <span>Add task</span>
      </button>
    );
  }

  function SectionHeader({ title, count, accent }) {
    return (
      <div className={`mb-1 pb-1 border-b ${accent || 'border-gray-100 dark:border-gray-700'}`}>
        {/* Section label row */}
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {title}
          </h3>
          {count > 0 && (
            <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full px-1.5 py-0.5">
              {count}
            </span>
          )}
        </div>
        {/* Column labels — aligned to the task row grid */}
        <div className="grid items-center gap-x-3 px-2" style={{ gridTemplateColumns: '20px 1fr 52px 24px 26px' }}>
          <span />
          <span className="text-[9px] font-semibold text-gray-300 dark:text-gray-600 uppercase tracking-wider">Task</span>
          <span className="text-[9px] font-semibold text-gray-300 dark:text-gray-600 uppercase tracking-wider text-right">Priority</span>
          <span className="text-[9px] font-semibold text-gray-300 dark:text-gray-600 uppercase tracking-wider text-center">Notes</span>
          <span />
        </div>
      </div>
    );
  }

  // ── Kanban view ────────────────────────────────────────────────────────────
  if (todoView === 'kanban') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-hidden p-4">
          <KanbanBoard
            tasks={tasks}
            columns={kanbanColumns.filter(c => c.visible)}
            dragEnabled={kanbanDragDrop}
            onComplete={onCompleteTask}
            onUncomplete={onUncompleteTask}
            onUpdate={onUpdateTask}
            onDelete={onDeleteTask}
            onMoveCard={onMoveCard}
            onReorder={onReorderTasks}
            onAddTask={onAddTask}
          />
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

        {/* ── Rolled over ─────────────────────────────────────────────────── */}
        {rolled.length > 0 && (
          <div>
            <SectionHeader title="Not completed from before" count={rolled.length} accent="border-amber-200 dark:border-amber-800" />
            <div className="space-y-0.5">
              {rolled.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onComplete={() => onCompleteTask(task.id)}
                  onUncomplete={() => onUncompleteTask(task.id)}
                  onUpdate={fields => onUpdateTask(task.id, fields)}
                  onDelete={() => onDeleteTask(task.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Today ───────────────────────────────────────────────────────── */}
        <div>
          <SectionHeader
            title={`Today · ${formatDate(today)}`}
            count={todayTasks.filter(t => t.status !== 'completed').length}
          />

          {addingForDate === today ? (
            <FullAddForm
              defaultDueDate={today}
              onAdd={handleAdd}
              onCancel={() => setAddingForDate(null)}
            />
          ) : (
            <AddTrigger dateStr={today} />
          )}

          <div className="space-y-0.5 mt-1">
            {todayTasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onComplete={() => onCompleteTask(task.id)}
                onUncomplete={() => onUncompleteTask(task.id)}
                onUpdate={fields => onUpdateTask(task.id, fields)}
                onDelete={() => onDeleteTask(task.id)}
              />
            ))}
            {todayTasks.length === 0 && addingForDate !== today && (
              <p className="text-xs text-gray-300 dark:text-gray-600 px-2 py-1">Nothing planned for today yet.</p>
            )}
          </div>
        </div>

        {/* ── No due date ─────────────────────────────────────────────────── */}
        {noDateTasks.length > 0 && (
          <div>
            <SectionHeader title="Someday" count={noDateTasks.length} />
            <div className="space-y-0.5">
              {noDateTasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onComplete={() => onCompleteTask(task.id)}
                  onUncomplete={() => onUncompleteTask(task.id)}
                  onUpdate={fields => onUpdateTask(task.id, fields)}
                  onDelete={() => onDeleteTask(task.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Upcoming ────────────────────────────────────────────────────── */}
        {upcomingDates.length > 0 && (
          <div>
            <SectionHeader title="Upcoming" count={upcomingTasks.length} />
            <div className="space-y-3">
              {upcomingDates.map(dateStr => (
                <div key={dateStr}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{formatDate(dateStr)}</span>
                    <span className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
                  </div>
                  <div className="space-y-0.5">
                    {upcomingByDate[dateStr].map(task => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onComplete={() => onCompleteTask(task.id)}
                        onUncomplete={() => onUncompleteTask(task.id)}
                        onUpdate={fields => onUpdateTask(task.id, fields)}
                        onDelete={() => onDeleteTask(task.id)}
                      />
                    ))}
                  </div>
                  {addingForDate === dateStr ? (
                    <FullAddForm
                      defaultDueDate={dateStr}
                      onAdd={handleAdd}
                      onCancel={() => setAddingForDate(null)}
                    />
                  ) : (
                    <AddTrigger dateStr={dateStr} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Completed (toggle) ──────────────────────────────────────────── */}
        {completedTasks.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowCompleted(v => !v)}
              className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-2"
            >
              <svg
                className={`w-3 h-3 transition-transform ${showCompleted ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {showCompleted ? `Hide ${completedTasks.length} completed` : `Show ${completedTasks.length} completed`}
            </button>
            {showCompleted && (
              <>
                <SectionHeader title="Completed" count={completedTasks.length} />
                <div className="space-y-0.5">
                  {completedTasks.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onComplete={() => onCompleteTask(task.id)}
                      onUncomplete={() => onUncompleteTask(task.id)}
                      onUpdate={fields => onUpdateTask(task.id, fields)}
                      onDelete={() => onDeleteTask(task.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── All empty ───────────────────────────────────────────────────── */}
        {tasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">✓</p>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nothing to do!</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Tap the + button to add your first task.</p>
          </div>
        )}

        {/* Bottom padding so FAB doesn't cover last item */}
        <div className="h-16" />
      </div>
    </div>
  );
}
