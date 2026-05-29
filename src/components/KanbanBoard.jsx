import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TaskItem from './TaskItem';

// Built-in column colors — full class strings kept in source for Tailwind purge safety
const COLUMN_COLORS = {
  'todo':        { border: 'border-gray-300 dark:border-gray-600',   header: 'text-gray-600 dark:text-gray-400' },
  'in-progress': { border: 'border-blue-300 dark:border-blue-700',   header: 'text-blue-600 dark:text-blue-400' },
  'done':        { border: 'border-green-300 dark:border-green-700', header: 'text-green-600 dark:text-green-400' },
};
// Palette for custom columns — cycled by order of appearance among custom cols
const CUSTOM_PALETTE = [
  { border: 'border-purple-300 dark:border-purple-700', header: 'text-purple-600 dark:text-purple-400' },
  { border: 'border-amber-300 dark:border-amber-700',   header: 'text-amber-600 dark:text-amber-400' },
  { border: 'border-pink-300 dark:border-pink-700',     header: 'text-pink-600 dark:text-pink-400' },
  { border: 'border-cyan-300 dark:border-cyan-700',     header: 'text-cyan-600 dark:text-cyan-400' },
];

function SortableCard({ task, onComplete, onUncomplete, onUpdate, onDelete, dragEnabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskItem
        task={task}
        onComplete={onComplete}
        onUncomplete={onUncomplete}
        onUpdate={onUpdate}
        onDelete={onDelete}
        compact
        dragHandle={dragEnabled ? { ...attributes, ...listeners } : null}
      />
    </div>
  );
}

/**
 * KanbanBoard
 *
 * Props:
 *   tasks       – full task array from useTasks
 *   columns     – array of visible column config objects: { id, label, custom? }
 *                 Pre-filtered to visible-only by the parent.
 *   dragEnabled – boolean (default true); when false, sensors are empty and
 *                 drag handles are hidden on cards
 *   onComplete, onUncomplete, onUpdate, onDelete, onMoveCard, onReorder, onAddTask
 */
export default function KanbanBoard({
  tasks,
  columns,
  dragEnabled = true,
  onComplete,
  onUncomplete,
  onUpdate,
  onDelete,
  onMoveCard,
  onReorder,
  onAddTask,
}) {
  const [activeTask, setActiveTask] = useState(null);
  const [addingIn, setAddingIn] = useState(null);
  const [newTitle, setNewTitle] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } })
  );
  // Empty sensors = drag completely disabled (DndContext still mounts, just inert)
  const noSensors = useSensors();

  function getColumnTasks(colId) {
    return tasks
      .filter(t => t.kanban_column === colId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at - b.created_at);
  }

  function findTaskById(id) {
    return tasks.find(t => t.id === id);
  }

  function findColumnForTask(id) {
    return tasks.find(t => t.id === id)?.kanban_column ?? columns[0]?.id ?? 'todo';
  }

  function handleDragStart({ active }) {
    setActiveTask(findTaskById(active.id));
  }

  function handleDragEnd({ active, over }) {
    setActiveTask(null);
    if (!over || active.id === over.id) return;

    const activeCol = findColumnForTask(active.id);
    const overCol   = findColumnForTask(over.id);

    if (activeCol === overCol) {
      const colTasks = getColumnTasks(activeCol);
      const oldIdx = colTasks.findIndex(t => t.id === active.id);
      const newIdx = colTasks.findIndex(t => t.id === over.id);
      const reordered = arrayMove(colTasks, oldIdx, newIdx);
      onReorder(reordered.map((t, i) => ({ id: t.id, sort_order: i })));
    } else {
      onMoveCard(active.id, overCol);
    }
  }

  function handleDragOver({ active, over }) {
    if (!over) return;
    // Cross-column moves are finalized in handleDragEnd
  }

  function handleAddInColumn(colId) {
    if (!newTitle.trim()) { setAddingIn(null); return; }
    const status = colId === 'done' ? 'completed' : 'pending';
    onAddTask({ title: newTitle.trim(), kanban_column: colId, status });
    setNewTitle('');
    setAddingIn(null);
  }

  // Assign custom palette colors by iterating only custom columns
  let customPaletteIdx = 0;
  const colorsMap = columns.reduce((acc, col) => {
    if (COLUMN_COLORS[col.id]) {
      acc[col.id] = COLUMN_COLORS[col.id];
    } else {
      acc[col.id] = CUSTOM_PALETTE[customPaletteIdx++ % CUSTOM_PALETTE.length];
    }
    return acc;
  }, {});

  return (
    <DndContext
      sensors={dragEnabled ? sensors : noSensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* Responsive: stack vertically on mobile, horizontal scroll on sm+ */}
      <div className="flex flex-col gap-3 h-full overflow-y-auto sm:flex-row sm:overflow-x-auto sm:overflow-y-hidden pb-2">
        {columns.map(col => {
          const colors = colorsMap[col.id] ?? CUSTOM_PALETTE[0];
          const colTasks = getColumnTasks(col.id);
          const isAdding = addingIn === col.id;

          return (
            <div
              key={col.id}
              className={`flex flex-col w-full sm:flex-shrink-0 sm:w-72 rounded-xl border-2 ${colors.border} bg-gray-50 dark:bg-gray-800/50`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${colors.header}`}>{col.label}</span>
                  <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full px-1.5 py-0.5 font-medium">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => { setAddingIn(col.id); setNewTitle(''); }}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-lg leading-none"
                  title={`Add task to ${col.label}`}
                >+</button>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[80px]">
                <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {colTasks.map(task => (
                    <SortableCard
                      key={task.id}
                      task={task}
                      dragEnabled={dragEnabled}
                      onComplete={() => onComplete(task.id)}
                      onUncomplete={() => onUncomplete(task.id)}
                      onUpdate={fields => onUpdate(task.id, fields)}
                      onDelete={() => onDelete(task.id)}
                    />
                  ))}
                </SortableContext>

                {/* Inline add form */}
                {isAdding && (
                  <div className="rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800 p-2 space-y-1.5">
                    <input
                      autoFocus
                      type="text"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddInColumn(col.id);
                        if (e.key === 'Escape') { setAddingIn(null); setNewTitle(''); }
                      }}
                      placeholder="Task title…"
                      className="w-full text-sm bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
                    />
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => handleAddInColumn(col.id)}
                        className="text-xs px-2 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors">
                        Add
                      </button>
                      <button type="button" onClick={() => { setAddingIn(null); setNewTitle(''); }}
                        className="text-xs px-2 py-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {colTasks.length === 0 && !isAdding && (
                  <div className="text-center text-xs text-gray-300 dark:text-gray-600 py-4">
                    {dragEnabled ? 'Drop tasks here' : 'No tasks yet'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drag overlay ghost card */}
      {dragEnabled && (
        <DragOverlay>
          {activeTask ? (
            <div className="rotate-1 shadow-xl">
              <TaskItem
                task={activeTask}
                onComplete={() => {}}
                onUncomplete={() => {}}
                onUpdate={() => {}}
                onDelete={() => {}}
                compact
              />
            </div>
          ) : null}
        </DragOverlay>
      )}
    </DndContext>
  );
}
