import { useState, useEffect } from 'react';
import { generateId } from '../lib/utils';
import { api } from '../lib/api.js';

const TASKS_KEY = 'lc-tasks';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

/**
 * useTasks — manages the PLS Do It task list.
 *
 * Mirrors the optimistic-update pattern from useEvents:
 *  - State + localStorage update immediately for zero-latency UI.
 *  - API call fires in the background; errors are logged but don't block the UI.
 *
 * Rollover: on first load after auth, any pending tasks with due_date < today
 * are silently advanced to today. original_date is preserved for history.
 */
export function useTasks(authState) {
  const [tasks, setTasks] = useState(() => load(TASKS_KEY, []));
  const [loading, setLoading] = useState(false);

  // Keep localStorage in sync
  useEffect(() => {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }, [tasks]);

  // ── Server sync on auth ─────────────────────────────────────────────────
  // Tasks are local-only unless the server exposes a /tasks API. Guard every
  // call so a missing api.tasks (current master) degrades to localStorage
  // instead of crashing the app.
  useEffect(() => {
    if (authState !== 'ready' || !api.tasks) return;
    setLoading(true);
    api.tasks.list()
      .then(serverTasks => {
        setTasks(serverTasks);
        // Rollover: advance overdue pending tasks to today
        const today = todayStr();
        const overdue = serverTasks.filter(
          t => t.status === 'pending' && t.due_date && t.due_date < today
        );
        for (const t of overdue) {
          // Optimistic update already in state, fire API silently
          setTasks(prev => prev.map(x =>
            x.id === t.id ? { ...x, due_date: today } : x
          ));
          api.tasks?.update?.(t.id, { due_date: today })?.catch(console.warn);
        }
      })
      .catch(() => { /* offline — keep localStorage */ })
      .finally(() => setLoading(false));
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutations ────────────────────────────────────────────────────────────

  function addTask(fields) {
    const today = todayStr();
    const task = {
      id:            generateId(),
      title:         fields.title ?? '',
      description:   fields.description ?? null,
      category:      fields.category ?? null,
      color:         fields.color ?? null,
      priority:      fields.priority ?? 'medium',
      status:        'pending',
      due_date:      fields.due_date ?? today,
      original_date: fields.due_date ?? today,
      completed_at:  null,
      kanban_column: fields.kanban_column ?? 'todo',
      sort_order:    fields.sort_order ?? 0,
      created_at:    Math.floor(Date.now() / 1000),
      updated_at:    Math.floor(Date.now() / 1000),
    };
    setTasks(prev => [...prev, task]);
    api.tasks?.create?.(task)?.catch(console.warn);
    return task;
  }

  function updateTask(id, fields) {
    // Auto-manage completed_at locally
    const updated = { ...fields };
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      if (updated.status === 'completed' && t.status !== 'completed') {
        updated.completed_at = Math.floor(Date.now() / 1000);
      } else if (updated.status === 'pending' && t.status === 'completed') {
        updated.completed_at = null;
      }
      return { ...t, ...updated };
    }));
    api.tasks?.update?.(id, fields)?.catch(console.warn);
  }

  function deleteTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id));
    api.tasks?.remove?.(id)?.catch(console.warn);
  }

  function completeTask(id) {
    // Also move to Done column so kanban stays in sync
    updateTask(id, { status: 'completed', kanban_column: 'done' });
  }

  function uncompleteTask(id) {
    // Move back to To Do column when unchecked
    updateTask(id, { status: 'pending', kanban_column: 'todo' });
  }

  /** Move a task to a different Kanban column */
  function moveKanbanCard(id, kanban_column) {
    const statusMap = { done: 'completed', 'in-progress': 'pending', todo: 'pending' };
    const fields = { kanban_column, status: statusMap[kanban_column] ?? 'pending' };
    if (kanban_column === 'done') fields.completed_at = Math.floor(Date.now() / 1000);
    else fields.completed_at = null;
    updateTask(id, fields);
  }

  /**
   * Reorder tasks within a Kanban column.
   * @param {Array<{id: string, sort_order: number}>} updates
   */
  function reorderTasks(updates) {
    setTasks(prev => prev.map(t => {
      const u = updates.find(x => x.id === t.id);
      return u ? { ...t, sort_order: u.sort_order } : t;
    }));
    api.tasks?.batchUpdate?.(updates)?.catch(console.warn);
  }

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask,
    moveKanbanCard,
    reorderTasks,
  };
}
