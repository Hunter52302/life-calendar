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

// ── Secrets ───────────────────────────────────────────────────────────────────

export const secrets = {
  getAll: () =>
    db.prepare('SELECT * FROM secrets ORDER BY service_name ASC, key_name ASC').all(),

  getByKey: (keyName) =>
    db.prepare('SELECT * FROM secrets WHERE key_name = ?').get(keyName),

  upsert: (keyName, data) => {
    db.prepare(`
      INSERT INTO secrets (key_name, service_name, description, encrypted_previous_value, expires_at, infisical_managed)
      VALUES (@key_name, @service_name, @description, @encrypted_previous_value, @expires_at, @infisical_managed)
      ON CONFLICT(key_name) DO UPDATE SET
        service_name             = excluded.service_name,
        description              = excluded.description,
        encrypted_previous_value = COALESCE(excluded.encrypted_previous_value, secrets.encrypted_previous_value),
        expires_at               = excluded.expires_at,
        infisical_managed        = excluded.infisical_managed,
        updated_at               = unixepoch()
    `).run({
      key_name:                  keyName,
      service_name:              data.serviceName,
      description:               data.description ?? null,
      encrypted_previous_value:  data.encryptedPreviousValue ?? null,
      expires_at:                data.expiresAt ?? null,
      infisical_managed:         data.infisicalManaged ? 1 : 0,
    });
    return db.prepare('SELECT * FROM secrets WHERE key_name = ?').get(keyName);
  },

  patch: (keyName, fields) => {
    const allowed = ['service_name', 'description', 'encrypted_previous_value', 'expires_at', 'infisical_managed'];
    const keys = Object.keys(fields).filter(k => allowed.includes(k));
    if (!keys.length) return;
    const setClause = keys.map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE secrets SET ${setClause}, updated_at = unixepoch() WHERE key_name = @key_name`)
      .run({ ...fields, key_name: keyName });
    return db.prepare('SELECT * FROM secrets WHERE key_name = ?').get(keyName);
  },

  delete: (keyName) =>
    db.prepare('DELETE FROM secrets WHERE key_name = ?').run(keyName),
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

  getById: (userId, id) => {
    const row = db.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?').get(id, userId);
    return row ? { ...row, active: row.active === 1, target_days: JSON.parse(row.target_days) } : null;
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

// ── User Integrations ─────────────────────────────────────────────────────────

export const userIntegrations = {
  getAll: (userId) =>
    db.prepare('SELECT * FROM user_integrations WHERE user_id = ? ORDER BY created_at ASC').all(userId)
      .map(r => ({ ...r, enabled: r.enabled === 1, include_hints: r.include_hints === 1 })),

  create: (userId, integration) => {
    db.prepare(`
      INSERT INTO user_integrations (id, user_id, type, label, endpoint_url, push_token, include_hints, enabled)
      VALUES (@id, @user_id, @type, @label, @endpoint_url, @push_token, @include_hints, @enabled)
    `).run({
      id: integration.id,
      user_id: userId,
      type: integration.type,
      label: integration.label ?? null,
      endpoint_url: integration.endpoint_url ?? null,
      push_token: integration.push_token ?? null,
      include_hints: integration.include_hints ? 1 : 0,
      enabled: integration.enabled !== false ? 1 : 0,
    });
  },

  update: (userId, id, updates) => {
    const fields = [];
    const vals = { id, user_id: userId };
    if (updates.label       !== undefined) { fields.push('label = @label');             vals.label = updates.label; }
    if (updates.endpoint_url !== undefined) { fields.push('endpoint_url = @endpoint_url'); vals.endpoint_url = updates.endpoint_url; }
    if (updates.push_token  !== undefined) { fields.push('push_token = @push_token');   vals.push_token = updates.push_token; }
    if (updates.include_hints !== undefined) { fields.push('include_hints = @include_hints'); vals.include_hints = updates.include_hints ? 1 : 0; }
    if (updates.enabled     !== undefined) { fields.push('enabled = @enabled');         vals.enabled = updates.enabled ? 1 : 0; }
    if (!fields.length) return;
    fields.push('updated_at = unixepoch()');
    db.prepare(`UPDATE user_integrations SET ${fields.join(', ')} WHERE id = @id AND user_id = @user_id`).run(vals);
  },

  delete: (userId, id) =>
    db.prepare('DELETE FROM user_integrations WHERE id = ? AND user_id = ?').run(id, userId),

  getById: (userId, id) =>
    db.prepare('SELECT * FROM user_integrations WHERE id = ? AND user_id = ?').get(id, userId),
};

// ── Notification Schedules ────────────────────────────────────────────────────

export const notificationSchedules = {
  getAll: (userId) =>
    db.prepare('SELECT * FROM notification_schedules WHERE user_id = ? ORDER BY created_at ASC').all(userId)
      .map(r => ({ ...r, enabled: r.enabled === 1, days_of_week: JSON.parse(r.days_of_week) })),

  getAllActive: (userId) =>
    db.prepare('SELECT * FROM notification_schedules WHERE user_id = ? AND enabled = 1').all(userId)
      .map(r => ({ ...r, enabled: true, days_of_week: JSON.parse(r.days_of_week) })),

  create: (userId, sched) => {
    db.prepare(`
      INSERT INTO notification_schedules
        (id, user_id, integration_id, trigger_type, offset_minutes, time_of_day, days_of_week, enabled)
      VALUES (@id, @user_id, @integration_id, @trigger_type, @offset_minutes, @time_of_day, @days_of_week, @enabled)
    `).run({
      id: sched.id,
      user_id: userId,
      integration_id: sched.integration_id ?? null,
      trigger_type: sched.trigger_type,
      offset_minutes: sched.offset_minutes ?? -30,
      time_of_day: sched.time_of_day ?? null,
      days_of_week: JSON.stringify(sched.days_of_week ?? [0,1,2,3,4,5,6]),
      enabled: sched.enabled !== false ? 1 : 0,
    });
  },

  update: (userId, id, updates) => {
    const fields = [];
    const vals = { id, user_id: userId };
    if (updates.trigger_type    !== undefined) { fields.push('trigger_type = @trigger_type');       vals.trigger_type = updates.trigger_type; }
    if (updates.offset_minutes  !== undefined) { fields.push('offset_minutes = @offset_minutes');   vals.offset_minutes = updates.offset_minutes; }
    if (updates.time_of_day     !== undefined) { fields.push('time_of_day = @time_of_day');         vals.time_of_day = updates.time_of_day; }
    if (updates.days_of_week    !== undefined) { fields.push('days_of_week = @days_of_week');       vals.days_of_week = JSON.stringify(updates.days_of_week); }
    if (updates.enabled         !== undefined) { fields.push('enabled = @enabled');                 vals.enabled = updates.enabled ? 1 : 0; }
    if (updates.integration_id  !== undefined) { fields.push('integration_id = @integration_id');   vals.integration_id = updates.integration_id; }
    if (!fields.length) return;
    db.prepare(`UPDATE notification_schedules SET ${fields.join(', ')} WHERE id = @id AND user_id = @user_id`).run(vals);
  },

  delete: (userId, id) =>
    db.prepare('DELETE FROM notification_schedules WHERE id = ? AND user_id = ?').run(id, userId),
};

// ── Notification Log ──────────────────────────────────────────────────────────

export const notificationLog = {
  wasFiredToday: (integrationId, entityId, triggerType) => {
    const today = new Date().toISOString().slice(0, 10);
    const row = db.prepare(`
      SELECT 1 FROM notification_log
      WHERE integration_id = ? AND entity_id = ? AND trigger_type = ?
        AND date(fired_at, 'unixepoch') = ?
    `).get(integrationId, entityId ?? '', triggerType, today);
    return !!row;
  },

  record: (id, userId, integrationId, triggerType, entityId, status = 'sent') => {
    db.prepare(`
      INSERT INTO notification_log (id, user_id, integration_id, trigger_type, entity_id, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, integrationId, triggerType, entityId ?? null, status);
  },
};

// ── Push Subscriptions ────────────────────────────────────────────────────────

export const pushSubscriptions = {
  getAll: (userId) =>
    db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId)
      .map(r => ({ ...r, subscription: JSON.parse(r.subscription) })),

  upsert: (userId, id, subscription) => {
    const endpoint = subscription.endpoint;
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND json_extract(subscription, \'$.endpoint\') = ?')
      .run(userId, endpoint);
    db.prepare('INSERT INTO push_subscriptions (id, user_id, subscription) VALUES (?, ?, ?)')
      .run(id, userId, JSON.stringify(subscription));
  },

  deleteByEndpoint: (userId, endpoint) => {
    db.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND json_extract(subscription, \'$.endpoint\') = ?')
      .run(userId, endpoint);
  },
};

// ── User Profile ─────────────────────────────────────────────────────────────

export const userProfile = {
  get: (userId) => {
    db.prepare('INSERT OR IGNORE INTO user_profile (user_id) VALUES (?)').run(userId);
    const row = db.prepare(
      'SELECT username, display_name, email, phone_numbers, birthday, home_address, other_addresses FROM user_profile WHERE user_id = ?'
    ).get(userId);
    if (!row) return { username: null, displayName: null, email: null, phones: [], birthday: null, homeAddress: null, otherAddresses: [] };
    return {
      username:       row.username        ?? null,
      displayName:    row.display_name    ?? null,
      email:          row.email           ?? null,
      phones:         row.phone_numbers   ? JSON.parse(row.phone_numbers)   : [],
      birthday:       row.birthday        ?? null,
      homeAddress:    row.home_address    ?? null,
      otherAddresses: row.other_addresses ? JSON.parse(row.other_addresses) : [],
    };
  },

  set: (userId, data) => {
    db.prepare(`
      INSERT INTO user_profile (user_id, username, display_name, email, phone_numbers, birthday, home_address, other_addresses, updated_at)
      VALUES (@user_id, @username, @display_name, @email, @phone_numbers, @birthday, @home_address, @other_addresses, unixepoch())
      ON CONFLICT(user_id) DO UPDATE SET
        username        = excluded.username,
        display_name    = excluded.display_name,
        email           = excluded.email,
        phone_numbers   = excluded.phone_numbers,
        birthday        = excluded.birthday,
        home_address    = excluded.home_address,
        other_addresses = excluded.other_addresses,
        updated_at      = unixepoch()
    `).run({
      user_id:         userId,
      username:        data.username       ?? null,
      display_name:    data.displayName    ?? null,
      email:           data.email          ?? null,
      phone_numbers:   data.phones         != null ? JSON.stringify(data.phones)         : null,
      birthday:        data.birthday       ?? null,
      home_address:    data.homeAddress    ?? null,
      other_addresses: data.otherAddresses != null ? JSON.stringify(data.otherAddresses) : null,
    });
  },
};

// ── Users (ZK extension) ──────────────────────────────────────────────────────

export const userZk = {
  getStatus: (userId) =>
    db.prepare('SELECT kdf_salt, zk_enabled, zk_verify, user_timezone FROM users WHERE id = ?').get(userId),

  enableZk: (userId, kdfSalt, zkVerify) => {
    db.prepare('UPDATE users SET kdf_salt = ?, zk_enabled = 1, zk_verify = ? WHERE id = ?')
      .run(kdfSalt, zkVerify, userId);
  },

  setTimezone: (userId, tz) => {
    db.prepare('UPDATE users SET user_timezone = ? WHERE id = ?').run(tz, userId);
  },
};
