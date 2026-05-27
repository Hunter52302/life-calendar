/**
 * All database operations in one place.
 * Routes call these functions — never touch `db` directly in a route.
 * To migrate to Postgres later: replace this file's internals;
 * the function signatures stay identical so routes never change.
 */
import { db } from './index.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** SQLite stores booleans as 0/1. Convert back to JS boolean on read. */
function deserializeEvent(row) {
  if (!row) return null;
  return { ...row, is_all_day: row.is_all_day === 1 };
}

function deserializeLinkedCal(row) {
  if (!row) return null;
  return { ...row, excludeFromReality: row.exclude_from_reality === 1 };
}

// ── Users ─────────────────────────────────────────────────────────────────────

export const users = {
  count: () => db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
  getFirst: () => db.prepare('SELECT * FROM users LIMIT 1').get(),
  getById: (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id),
  create: (id, passwordHash) => {
    db.prepare('INSERT INTO users (id, password_hash) VALUES (?, ?)').run(id, passwordHash);
  },
};

// ── Events ────────────────────────────────────────────────────────────────────

export const events = {
  getAll: (userId) =>
    db.prepare('SELECT * FROM events WHERE user_id = ?').all(userId).map(deserializeEvent),

  create: (userId, event) => {
    db.prepare(`
      INSERT INTO events
        (id, user_id, label, category, color, calendar, week_start,
         day_of_week, slot_start, slot_duration, precision, is_all_day,
         source, source_calendar_id, plan_event_id, notes)
      VALUES
        (@id, @user_id, @label, @category, @color, @calendar, @week_start,
         @day_of_week, @slot_start, @slot_duration, @precision, @is_all_day,
         @source, @source_calendar_id, @plan_event_id, @notes)
    `).run({
      id: event.id,
      user_id: userId,
      label: event.label ?? '',
      category: event.category ?? null,
      color: event.color ?? null,
      calendar: event.calendar,
      week_start: event.week_start,
      day_of_week: event.day_of_week ?? 0,
      slot_start: event.slot_start ?? 0,
      slot_duration: event.slot_duration ?? 4,
      precision: event.precision ?? 1,
      is_all_day: event.is_all_day ? 1 : 0,
      source: event.source ?? null,
      source_calendar_id: event.source_calendar_id ?? null,
      plan_event_id: event.plan_event_id ?? null,
      notes: event.notes ?? null,
    });
    return deserializeEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(event.id));
  },

  update: (userId, id, updates) => {
    // Build SET clause dynamically from provided fields
    const allowed = [
      'label','category','color','calendar','week_start','day_of_week',
      'slot_start','slot_duration','precision','is_all_day',
      'source','source_calendar_id','plan_event_id','notes',
    ];
    const fields = Object.keys(updates).filter(k => allowed.includes(k));
    if (!fields.length) return;
    const setClause = fields.map(f => `${f} = @${f}`).join(', ');
    const params = { id, user_id: userId };
    for (const f of fields) {
      params[f] = f === 'is_all_day' ? (updates[f] ? 1 : 0) : updates[f];
    }
    db.prepare(`
      UPDATE events SET ${setClause}, updated_at = unixepoch()
      WHERE id = @id AND user_id = @user_id
    `).run(params);
    return deserializeEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(id));
  },

  delete: (userId, id) => {
    db.prepare('DELETE FROM events WHERE id = ? AND user_id = ?').run(id, userId);
  },

  deleteBySource: (userId, source) => {
    db.prepare('DELETE FROM events WHERE user_id = ? AND source = ?').run(userId, source);
  },

  deleteBySourceCalendar: (userId, sourceCalendarId) => {
    db.prepare('DELETE FROM events WHERE user_id = ? AND source_calendar_id = ?').run(userId, sourceCalendarId);
  },

  /** Atomically replace all events with a given source (e.g. birthday). */
  replaceBySource: (userId, source, newEvents) => {
    const deleteStmt = db.prepare('DELETE FROM events WHERE user_id = ? AND source = ?');
    const insertStmt = db.prepare(`
      INSERT INTO events
        (id, user_id, label, category, color, calendar, week_start,
         day_of_week, slot_start, slot_duration, precision, is_all_day, source)
      VALUES
        (@id, @user_id, @label, @category, @color, @calendar, @week_start,
         @day_of_week, @slot_start, @slot_duration, @precision, @is_all_day, @source)
    `);
    const run = db.transaction(() => {
      deleteStmt.run(userId, source);
      for (const e of newEvents) {
        insertStmt.run({
          id: e.id, user_id: userId, label: e.label ?? '',
          category: e.category ?? null, color: e.color ?? null,
          calendar: e.calendar, week_start: e.week_start,
          day_of_week: e.day_of_week ?? 0, slot_start: e.slot_start ?? 0,
          slot_duration: e.slot_duration ?? 4, precision: e.precision ?? 1,
          is_all_day: e.is_all_day ? 1 : 0, source,
        });
      }
    });
    run();
  },

  /** Bulk insert — used for the one-time localStorage migration. */
  batchCreate: (userId, eventsArray) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO events
        (id, user_id, label, category, color, calendar, week_start,
         day_of_week, slot_start, slot_duration, precision, is_all_day,
         source, source_calendar_id, plan_event_id, notes)
      VALUES
        (@id, @user_id, @label, @category, @color, @calendar, @week_start,
         @day_of_week, @slot_start, @slot_duration, @precision, @is_all_day,
         @source, @source_calendar_id, @plan_event_id, @notes)
    `);
    const run = db.transaction(() => {
      for (const e of eventsArray) {
        stmt.run({
          id: e.id, user_id: userId, label: e.label ?? '',
          category: e.category ?? null, color: e.color ?? null,
          calendar: e.calendar, week_start: e.week_start,
          day_of_week: e.day_of_week ?? 0, slot_start: e.slot_start ?? 0,
          slot_duration: e.slot_duration ?? 4, precision: e.precision ?? 1,
          is_all_day: e.is_all_day ? 1 : 0,
          source: e.source ?? null,
          source_calendar_id: e.source_calendar_id ?? null,
          plan_event_id: e.plan_event_id ?? null,
          notes: e.notes ?? null,
        });
      }
    });
    run();
  },
};

// ── Custom Categories ─────────────────────────────────────────────────────────

export const customCategories = {
  getAll: (userId) =>
    db.prepare('SELECT id, label, color FROM custom_categories WHERE user_id = ?').all(userId),

  create: (userId, cat) => {
    db.prepare('INSERT INTO custom_categories (id, user_id, label, color) VALUES (?, ?, ?, ?)')
      .run(cat.id, userId, cat.label, cat.color);
    return cat;
  },

  delete: (userId, id) => {
    db.prepare('DELETE FROM custom_categories WHERE id = ? AND user_id = ?').run(id, userId);
  },
};

// ── Category Overrides ────────────────────────────────────────────────────────

export const categoryOverrides = {
  /** Returns { [categoryId]: { label?, color? } } */
  getAll: (userId) => {
    const rows = db.prepare('SELECT * FROM category_overrides WHERE user_id = ?').all(userId);
    return Object.fromEntries(rows.map(r => [r.category_id, { label: r.label, color: r.color }]));
  },

  set: (userId, categoryId, updates) => {
    const existing = db.prepare(
      'SELECT * FROM category_overrides WHERE user_id = ? AND category_id = ?'
    ).get(userId, categoryId);

    if (existing) {
      const label = updates.label !== undefined ? updates.label : existing.label;
      const color = updates.color !== undefined ? updates.color : existing.color;
      db.prepare(
        'UPDATE category_overrides SET label = ?, color = ? WHERE user_id = ? AND category_id = ?'
      ).run(label, color, userId, categoryId);
    } else {
      db.prepare(
        'INSERT INTO category_overrides (user_id, category_id, label, color) VALUES (?, ?, ?, ?)'
      ).run(userId, categoryId, updates.label ?? null, updates.color ?? null);
    }
  },
};

// ── Deleted Default IDs ───────────────────────────────────────────────────────

export const deletedDefaults = {
  getAll: (userId) =>
    db.prepare('SELECT category_id FROM deleted_defaults WHERE user_id = ?')
      .all(userId).map(r => r.category_id),

  add: (userId, categoryId) => {
    db.prepare(
      'INSERT OR IGNORE INTO deleted_defaults (user_id, category_id) VALUES (?, ?)'
    ).run(userId, categoryId);
  },
};

// ── Linked Calendars ──────────────────────────────────────────────────────────

export const linkedCalendars = {
  getAll: (userId) =>
    db.prepare('SELECT * FROM linked_calendars WHERE user_id = ?')
      .all(userId).map(deserializeLinkedCal),

  create: (userId, cal) => {
    db.prepare(`
      INSERT INTO linked_calendars (id, user_id, name, filename, calendar, imported_at, color, exclude_from_reality)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(cal.id, userId, cal.name, cal.filename ?? null, cal.calendar,
           cal.importedAt ?? null, cal.color ?? null, cal.excludeFromReality ? 1 : 0);
    return deserializeLinkedCal(
      db.prepare('SELECT * FROM linked_calendars WHERE id = ?').get(cal.id)
    );
  },

  update: (userId, id, updates) => {
    const allowed = ['name','filename','calendar','imported_at','color','exclude_from_reality'];
    // Map camelCase to snake_case for DB
    const mapped = {};
    if (updates.name !== undefined)                mapped.name = updates.name;
    if (updates.filename !== undefined)             mapped.filename = updates.filename;
    if (updates.calendar !== undefined)             mapped.calendar = updates.calendar;
    if (updates.importedAt !== undefined)           mapped.imported_at = updates.importedAt;
    if (updates.color !== undefined)               mapped.color = updates.color;
    if (updates.excludeFromReality !== undefined)   mapped.exclude_from_reality = updates.excludeFromReality ? 1 : 0;

    const fields = Object.keys(mapped).filter(k => allowed.includes(k));
    if (!fields.length) return;
    const setClause = fields.map(f => `${f} = @${f}`).join(', ');
    db.prepare(`UPDATE linked_calendars SET ${setClause} WHERE id = @id AND user_id = @user_id`)
      .run({ ...mapped, id, user_id: userId });
    return deserializeLinkedCal(
      db.prepare('SELECT * FROM linked_calendars WHERE id = ?').get(id)
    );
  },

  delete: (userId, id) => {
    db.prepare('DELETE FROM linked_calendars WHERE id = ? AND user_id = ?').run(id, userId);
  },
};

// ── Habits ────────────────────────────────────────────────────────────────────

export const habits = {
  getAll: (userId) =>
    db.prepare('SELECT * FROM habits WHERE user_id = ? ORDER BY sort_order, created_at').all(userId)
      .map(r => ({ ...r, active: r.active === 1, target_days: JSON.parse(r.target_days) })),

  create: (userId, habit) => {
    db.prepare(`
      INSERT INTO habits (id, user_id, label, color, target_days, active, sort_order)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(habit.id, userId, habit.label, habit.color ?? '#7C3AED',
           JSON.stringify(habit.target_days ?? [0,1,2,3,4,5,6]), habit.sort_order ?? 0);
    const row = db.prepare('SELECT * FROM habits WHERE id = ?').get(habit.id);
    return { ...row, active: row.active === 1, target_days: JSON.parse(row.target_days) };
  },

  update: (userId, id, updates) => {
    const allowed = ['label', 'color', 'target_days', 'active', 'sort_order'];
    const fields = Object.keys(updates).filter(k => allowed.includes(k));
    if (!fields.length) return;
    const params = { id, user_id: userId };
    for (const f of fields) {
      params[f] = f === 'active' ? (updates[f] ? 1 : 0)
                : f === 'target_days' ? JSON.stringify(updates[f])
                : updates[f];
    }
    const setClause = fields.map(f => `${f} = @${f}`).join(', ');
    db.prepare(`UPDATE habits SET ${setClause} WHERE id = @id AND user_id = @user_id`).run(params);
    const row = db.prepare('SELECT * FROM habits WHERE id = ?').get(id);
    return row ? { ...row, active: row.active === 1, target_days: JSON.parse(row.target_days) } : null;
  },

  delete: (userId, id) => {
    db.prepare('DELETE FROM habits WHERE id = ? AND user_id = ?').run(id, userId);
  },
};

// ── Habit Completions ─────────────────────────────────────────────────────────

export const habitCompletions = {
  getAll: (userId) =>
    db.prepare('SELECT id, habit_id, date FROM habit_completions WHERE user_id = ?').all(userId),

  upsert: (userId, habitId, completionId, date) => {
    db.prepare(`
      INSERT OR IGNORE INTO habit_completions (id, habit_id, user_id, date)
      VALUES (?, ?, ?, ?)
    `).run(completionId, habitId, userId, date);
  },

  delete: (userId, habitId, date) => {
    db.prepare('DELETE FROM habit_completions WHERE habit_id = ? AND user_id = ? AND date = ?')
      .run(habitId, userId, date);
  },
};

// ── Time Budgets ──────────────────────────────────────────────────────────────

export const timeBudgets = {
  getAll: (userId) => {
    const rows = db.prepare('SELECT category_id, weekly_hours FROM time_budgets WHERE user_id = ?').all(userId);
    return Object.fromEntries(rows.map(r => [r.category_id, r.weekly_hours]));
  },

  set: (userId, categoryId, weeklyHours) => {
    db.prepare(`
      INSERT INTO time_budgets (user_id, category_id, weekly_hours)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, category_id) DO UPDATE SET weekly_hours = excluded.weekly_hours, updated_at = unixepoch()
    `).run(userId, categoryId, weeklyHours);
  },

  delete: (userId, categoryId) => {
    db.prepare('DELETE FROM time_budgets WHERE user_id = ? AND category_id = ?').run(userId, categoryId);
  },
};
