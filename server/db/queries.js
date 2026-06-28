/**
 * All database operations in one place.
 * Routes call these functions — never touch `db` directly in a route.
 * To migrate to Postgres later: replace this file's internals;
 * the function signatures stay identical so routes never change.
 */
import { randomUUID } from 'crypto';
import { db } from './index.js';

const LOGIN_LOCK_THRESHOLD = 5;
const LOGIN_LOCK_MINUTES = 15;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** SQLite stores booleans as 0/1. Convert back to JS boolean on read. */
function deserializeEvent(row) {
  if (!row) return null;
  return {
    ...row,
    is_all_day: row.is_all_day === 1,
    updatedAt:  row.updated_hlc ?? null, // HLC timestamp for conflict resolution
    deleted:    row.deleted === 1,       // tombstone flag
  };
}

function deserializeLinkedCal(row) {
  if (!row) return null;
  return {
    ...row,
    excludeFromReality: row.exclude_from_reality === 1,
    syncEnabled:        row.sync_enabled === 1,
    lastSyncedAt:       row.last_synced_at ?? null,
    source:             row.source ?? 'ics',
    connectionId:       row.connection_id ?? null,
    externalCalendarId: row.external_calendar_id ?? null,
  };
}

// ── Users ─────────────────────────────────────────────────────────────────────

export const users = {
  count: () => db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
  getFirst: () => db.prepare('SELECT * FROM users LIMIT 1').get(),
  getById: (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id),
  getByEmail: (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email),

  /** Legacy single-user deployments: the one account created before emails existed. */
  getLegacyUsers: () => db.prepare('SELECT * FROM users WHERE email IS NULL').all(),

  /**
   * Create an account under the envelope ZK model. `verifierHash` is
   * bcrypt(authVerifier) — the server never sees the password. `env` carries the
   * client-built envelope (salts + wrapped DEK blobs + bcrypt(recoveryVerifier)).
   */
  create: (id, verifierHash, opts = {}) => {
    const { email = null, role = 'user', signupIp = null, env = {} } = opts;
    db.prepare(`
      INSERT INTO users (
        id, password_hash, email, role, signup_ip, zk_enabled,
        auth_salt, kdf_salt, recovery_salt, recovery_auth_salt, recovery_verifier,
        wrapped_dek_password, wrapped_dek_recovery
      )
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, verifierHash, email, role, signupIp,
      env.authSalt ?? null, env.kdfSalt ?? null, env.recoverySalt ?? null,
      env.recoveryAuthSalt ?? null, env.recoveryVerifierHash ?? null,
      env.wrappedDekPassword ?? null, env.wrappedDekRecovery ?? null,
    );
  },

  /** Salts the client needs to derive the auth verifier + unlock (prelogin). */
  getLoginSalts: (id) =>
    db.prepare('SELECT auth_salt, kdf_salt, wrapped_dek_password FROM users WHERE id = ?').get(id),

  /** Recovery-side material for a password reset. */
  getRecoveryEnvelope: (id) =>
    db.prepare('SELECT recovery_salt, recovery_auth_salt, recovery_verifier, wrapped_dek_recovery FROM users WHERE id = ?').get(id),

  /** Apply a recovery-based password reset: new verifier + re-wrapped DEK. */
  setPasswordEnvelope: (id, { verifierHash, authSalt, kdfSalt, wrappedDekPassword }) =>
    db.prepare(`
      UPDATE users
      SET password_hash = ?, auth_salt = ?, kdf_salt = ?, wrapped_dek_password = ?,
          failed_login_attempts = 0, locked_until = NULL
      WHERE id = ?
    `).run(verifierHash, authSalt, kdfSalt, wrappedDekPassword, id),

  /** Admin view — deliberately excludes password_hash and ZK secrets. */
  listAll: () =>
    db.prepare(`
      SELECT id, email, role, is_blocked, zk_enabled, created_at
      FROM users ORDER BY created_at ASC
    `).all().map(r => ({ ...r, is_blocked: r.is_blocked === 1, zk_enabled: r.zk_enabled === 1 })),

  /** Scheduler-only view — every non-blocked user's id/timezone, nothing sensitive. */
  getAllForScheduler: () =>
    db.prepare('SELECT id, user_timezone FROM users WHERE is_blocked = 0').all(),

  setBlocked: (id, blocked) =>
    db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?').run(blocked ? 1 : 0, id),

  setEmail: (id, email) =>
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, id),

  deleteUser: (id) =>
    db.prepare('DELETE FROM users WHERE id = ?').run(id),

  /** Bumps the failed-attempt counter and locks the account once it crosses the threshold. */
  recordFailedLogin: (id) => {
    const row = db.prepare('SELECT failed_login_attempts FROM users WHERE id = ?').get(id);
    const attempts = (row?.failed_login_attempts ?? 0) + 1;
    const lockedUntil = attempts >= LOGIN_LOCK_THRESHOLD
      ? Math.floor(Date.now() / 1000) + LOGIN_LOCK_MINUTES * 60
      : null;
    db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?')
      .run(attempts, lockedUntil, id);
    return { attempts, lockedUntil };
  },

  resetLoginAttempts: (id) =>
    db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(id),

  /** Bot-farm signal for the admin panel: IPs that registered more than one account. */
  getSignupIpClusters: () =>
    db.prepare(`
      SELECT signup_ip, COUNT(*) AS count, GROUP_CONCAT(email, ', ') AS emails
      FROM users
      WHERE signup_ip IS NOT NULL
      GROUP BY signup_ip
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `).all(),

  setFeedToken: (id, token) =>
    db.prepare('UPDATE users SET ics_feed_token = ? WHERE id = ?').run(token, id),

  getByFeedToken: (token) =>
    db.prepare('SELECT * FROM users WHERE ics_feed_token = ?').get(token),
};

// ── Events ────────────────────────────────────────────────────────────────────

export const events = {
  // Live events only — tombstones are hidden from feeds, the scheduler, and
  // any non-sync reader so deleted events never resurface in output.
  getAll: (userId) =>
    db.prepare('SELECT * FROM events WHERE user_id = ? AND deleted = 0').all(userId).map(deserializeEvent),

  // Full set incl. tombstones — only the /api/sync path needs these so clients
  // can merge deletions. (See server/index.js.)
  getAllForSync: (userId) =>
    db.prepare('SELECT * FROM events WHERE user_id = ?').all(userId).map(deserializeEvent),

  /**
   * Garbage-collect tombstones older than `retentionDays`, so the table and the
   * /api/sync payload don't grow without bound. The window must comfortably
   * exceed the longest plausible offline period (a device that still holds the
   * live record and syncs after its tombstone is gone would resurrect it);
   * clients prune on the same window (see src/lib/syncMerge.js) so they stop
   * re-pushing tombstones once they age out. `updated_at` is the row's last write
   * time in epoch seconds.
   */
  purgeExpiredTombstones: (userId, retentionDays = 30) =>
    db.prepare(
      'DELETE FROM events WHERE user_id = ? AND deleted = 1 AND updated_at < unixepoch() - ?'
    ).run(userId, retentionDays * 24 * 60 * 60),

  create: (userId, event) => {
    db.prepare(`
      INSERT INTO events
        (id, user_id, label, category, color, calendar, week_start,
         day_of_week, slot_start, slot_duration, precision, is_all_day,
         source, source_calendar_id, plan_event_id, notes, updated_hlc, deleted)
      VALUES
        (@id, @user_id, @label, @category, @color, @calendar, @week_start,
         @day_of_week, @slot_start, @slot_duration, @precision, @is_all_day,
         @source, @source_calendar_id, @plan_event_id, @notes, @updated_hlc, @deleted)
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
      updated_hlc: event.updatedAt ?? null,
      deleted: event.deleted ? 1 : 0,
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
    const params = { id, user_id: userId };
    const setParts = [];
    for (const f of Object.keys(updates).filter(k => allowed.includes(k))) {
      params[f] = f === 'is_all_day' ? (updates[f] ? 1 : 0) : updates[f];
      setParts.push(`${f} = @${f}`);
    }
    // Sync metadata: the HLC stamp and the delete tombstone. A delete arrives as
    // an update of only these two fields, so they're handled outside `allowed`.
    let hlcGuard = '';
    if (updates.updatedAt !== undefined) {
      params.updated_hlc = updates.updatedAt;
      setParts.push('updated_hlc = @updated_hlc');
      // Enforce Last-Writer-Wins at the write layer: ignore a stale edit/delete
      // whose HLC isn't newer than the version we already hold, so a late-landing
      // request can't clobber a newer concurrent write. `updated_hlc` in the WHERE
      // is the pre-update value. (Packed HLC strings sort lexicographically.)
      hlcGuard = ' AND (updated_hlc IS NULL OR @updated_hlc > updated_hlc)';
    }
    if (updates.deleted !== undefined) {
      params.deleted = updates.deleted ? 1 : 0;
      setParts.push('deleted = @deleted');
    }
    if (!setParts.length) return;
    db.prepare(`
      UPDATE events SET ${setParts.join(', ')}, updated_at = unixepoch()
      WHERE id = @id AND user_id = @user_id${hlcGuard}
    `).run(params);
    return deserializeEvent(db.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?').get(id, userId));
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
         day_of_week, slot_start, slot_duration, precision, is_all_day, source, updated_hlc)
      VALUES
        (@id, @user_id, @label, @category, @color, @calendar, @week_start,
         @day_of_week, @slot_start, @slot_duration, @precision, @is_all_day, @source, @updated_hlc)
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
          // Stamp so the rows have an HLC; otherwise the originating device would
          // see them as remote-NULL and re-push the whole set on every sync.
          updated_hlc: e.updatedAt ?? null,
        });
      }
    });
    run();
  },

  /** Atomically replace all events from a subscribed calendar (re-sync). */
  replaceBySourceCalendar: (userId, sourceCalendarId, newEvents) => {
    const deleteStmt = db.prepare('DELETE FROM events WHERE user_id = ? AND source_calendar_id = ?');
    const insertStmt = db.prepare(`
      INSERT INTO events
        (id, user_id, label, category, color, calendar, week_start,
         day_of_week, slot_start, slot_duration, precision, is_all_day,
         source, source_calendar_id, notes, updated_hlc)
      VALUES
        (@id, @user_id, @label, @category, @color, @calendar, @week_start,
         @day_of_week, @slot_start, @slot_duration, @precision, @is_all_day,
         @source, @source_calendar_id, @notes, @updated_hlc)
    `);
    const run = db.transaction(() => {
      deleteStmt.run(userId, sourceCalendarId);
      for (const e of newEvents) {
        insertStmt.run({
          id: e.id, user_id: userId, label: e.label ?? '',
          category: e.category ?? null, color: e.color ?? null,
          calendar: e.calendar, week_start: e.week_start,
          day_of_week: e.day_of_week ?? 0, slot_start: e.slot_start ?? 0,
          slot_duration: e.slot_duration ?? 4, precision: e.precision ?? 1,
          is_all_day: e.is_all_day ? 1 : 0,
          source: e.source ?? 'ical-subscription',
          source_calendar_id: sourceCalendarId,
          notes: e.notes ?? null,
          // Stamp so the rows have an HLC; otherwise the originating device would
          // see them as remote-NULL and re-push the whole set on every sync.
          updated_hlc: e.updatedAt ?? null,
        });
      }
    });
    run();
  },

  /**
   * Bulk upsert — used for the one-time localStorage migration, iCal imports,
   * and the client's sync-push of records it holds newer versions of (offline
   * edits and tombstones). ON CONFLICT keeps the existing created_at and just
   * overwrites the mutable columns, so re-pushing a record is idempotent.
   */
  batchCreate: (userId, eventsArray) => {
    const stmt = db.prepare(`
      INSERT INTO events
        (id, user_id, label, category, color, calendar, week_start,
         day_of_week, slot_start, slot_duration, precision, is_all_day,
         source, source_calendar_id, plan_event_id, notes, updated_hlc, deleted)
      VALUES
        (@id, @user_id, @label, @category, @color, @calendar, @week_start,
         @day_of_week, @slot_start, @slot_duration, @precision, @is_all_day,
         @source, @source_calendar_id, @plan_event_id, @notes, @updated_hlc, @deleted)
      ON CONFLICT(id) DO UPDATE SET
        label = excluded.label, category = excluded.category, color = excluded.color,
        calendar = excluded.calendar, week_start = excluded.week_start,
        day_of_week = excluded.day_of_week, slot_start = excluded.slot_start,
        slot_duration = excluded.slot_duration, precision = excluded.precision,
        is_all_day = excluded.is_all_day, source = excluded.source,
        source_calendar_id = excluded.source_calendar_id,
        plan_event_id = excluded.plan_event_id, notes = excluded.notes,
        updated_hlc = excluded.updated_hlc, deleted = excluded.deleted,
        updated_at = unixepoch()
      -- Enforce Last-Writer-Wins at the write layer: a pushed record only wins
      -- if its HLC is strictly newer than what we already hold. Without this, a
      -- stale push (computed against an older /api/sync snapshot) would clobber a
      -- newer concurrent write until some later read-merge happened to correct
      -- it. Packed HLC strings are fixed-width, so lexicographic > matches HLC
      -- order. A row with no HLC yet (legacy / un-stamped) always loses to one
      -- that has a stamp, and is overwritten by anything.
      WHERE events.updated_hlc IS NULL OR excluded.updated_hlc > events.updated_hlc
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
          updated_hlc: e.updatedAt ?? null,
          deleted: e.deleted ? 1 : 0,
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
      INSERT INTO linked_calendars
        (id, user_id, name, filename, calendar, imported_at, color, exclude_from_reality,
         url, sync_enabled, last_synced_at, source, connection_id, external_calendar_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(cal.id, userId, cal.name, cal.filename ?? null, cal.calendar,
           cal.importedAt ?? null, cal.color ?? null, cal.excludeFromReality ? 1 : 0,
           cal.url ?? null, cal.syncEnabled ? 1 : 0, cal.lastSyncedAt ?? null,
           cal.source ?? 'ics', cal.connectionId ?? null, cal.externalCalendarId ?? null);
    return deserializeLinkedCal(
      db.prepare('SELECT * FROM linked_calendars WHERE id = ?').get(cal.id)
    );
  },

  update: (userId, id, updates) => {
    const allowed = ['name','filename','calendar','imported_at','color','exclude_from_reality','url','sync_enabled','last_synced_at','source','connection_id','external_calendar_id'];
    // Map camelCase to snake_case for DB
    const mapped = {};
    if (updates.name !== undefined)                mapped.name = updates.name;
    if (updates.filename !== undefined)             mapped.filename = updates.filename;
    if (updates.calendar !== undefined)             mapped.calendar = updates.calendar;
    if (updates.importedAt !== undefined)           mapped.imported_at = updates.importedAt;
    if (updates.color !== undefined)               mapped.color = updates.color;
    if (updates.excludeFromReality !== undefined)   mapped.exclude_from_reality = updates.excludeFromReality ? 1 : 0;
    if (updates.url !== undefined)                  mapped.url = updates.url;
    if (updates.syncEnabled !== undefined)          mapped.sync_enabled = updates.syncEnabled ? 1 : 0;
    if (updates.lastSyncedAt !== undefined)         mapped.last_synced_at = updates.lastSyncedAt;
    if (updates.source !== undefined)               mapped.source = updates.source;
    if (updates.connectionId !== undefined)         mapped.connection_id = updates.connectionId;
    if (updates.externalCalendarId !== undefined)   mapped.external_calendar_id = updates.externalCalendarId;

    const fields = Object.keys(mapped).filter(k => allowed.includes(k));
    if (!fields.length) return;
    const setClause = fields.map(f => `${f} = @${f}`).join(', ');
    db.prepare(`UPDATE linked_calendars SET ${setClause} WHERE id = @id AND user_id = @user_id`)
      .run({ ...mapped, id, user_id: userId });
    return deserializeLinkedCal(
      db.prepare('SELECT * FROM linked_calendars WHERE id = ? AND user_id = ?').get(id, userId)
    );
  },

  delete: (userId, id) => {
    db.prepare('DELETE FROM linked_calendars WHERE id = ? AND user_id = ?').run(id, userId);
  },
};

// ── Calendar Connections (OAuth) ──────────────────────────────────────────────
// Tokens are stored pre-encrypted (see server/lib/tokenCrypto.js) — this module
// never encrypts/decrypts, it just persists whatever string it's given. Never
// return access_token/refresh_token to a client.

export const calendarConnections = {
  /** Metadata only — safe to return to the client. */
  getAll: (userId) =>
    db.prepare(
      'SELECT id, provider, account_email, created_at FROM calendar_connections WHERE user_id = ?'
    ).all(userId).map(r => ({
      id: r.id, provider: r.provider, accountEmail: r.account_email, createdAt: r.created_at,
    })),

  /** Full row incl. encrypted tokens — server-internal use only. Scoped to the owner. */
  getById: (userId, id) =>
    db.prepare('SELECT * FROM calendar_connections WHERE id = ? AND user_id = ?').get(id, userId),

  create: (userId, conn) => {
    const id = conn.id ?? randomUUID();
    db.prepare(`
      INSERT INTO calendar_connections
        (id, user_id, provider, account_email, access_token, refresh_token, token_expires_at, scope)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, conn.provider, conn.accountEmail ?? null,
           conn.accessToken, conn.refreshToken, conn.tokenExpiresAt, conn.scope ?? null);
    return calendarConnections.getById(userId, id);
  },

  /** Persist refreshed tokens. id alone (no userId) — caller already holds an owned row. */
  updateTokens: (id, { accessToken, tokenExpiresAt, refreshToken }) => {
    if (refreshToken !== undefined) {
      db.prepare(`
        UPDATE calendar_connections
        SET access_token = ?, token_expires_at = ?, refresh_token = ?, updated_at = unixepoch()
        WHERE id = ?
      `).run(accessToken, tokenExpiresAt, refreshToken, id);
    } else {
      db.prepare(`
        UPDATE calendar_connections
        SET access_token = ?, token_expires_at = ?, updated_at = unixepoch()
        WHERE id = ?
      `).run(accessToken, tokenExpiresAt, id);
    }
  },

  delete: (userId, id) => {
    db.prepare('DELETE FROM calendar_connections WHERE id = ? AND user_id = ?').run(id, userId);
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
    const row = db.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?').get(id, userId);
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
  /** Envelope material the client needs to re-derive its key after a reload. */
  getUnlockEnvelope: (userId) =>
    db.prepare('SELECT kdf_salt, wrapped_dek_password, user_timezone FROM users WHERE id = ?').get(userId),

  setTimezone: (userId, tz) => {
    db.prepare('UPDATE users SET user_timezone = ? WHERE id = ?').run(tz, userId);
  },
};

// ── Category Keywords ─────────────────────────────────────────────────────────

const DEFAULT_CATEGORY_KEYWORDS = {
  sleep:        ['sleep', 'bed', 'nap'],
  work:         ['meeting', 'shift', 'work', 'standup', 'call'],
  school:       ['class', 'lecture', 'homework', 'study', 'exam'],
  'free-time':  ['free', 'hangout', 'relax', 'gym', 'workout'],
};

export const categoryKeywords = {
  /** Returns { [categoryId]: string[] }. Seeds sensible defaults the first time a user has none. */
  getAll: (userId) => {
    let rows = db.prepare('SELECT category_id, keyword FROM category_keywords WHERE user_id = ?').all(userId);
    if (!rows.length) {
      const insert = db.prepare(
        'INSERT INTO category_keywords (id, user_id, category_id, keyword) VALUES (?, ?, ?, ?)'
      );
      const run = db.transaction(() => {
        for (const [categoryId, keywords] of Object.entries(DEFAULT_CATEGORY_KEYWORDS)) {
          for (const keyword of keywords) insert.run(randomUUID(), userId, categoryId, keyword);
        }
      });
      run();
      rows = db.prepare('SELECT category_id, keyword FROM category_keywords WHERE user_id = ?').all(userId);
    }
    const out = {};
    for (const r of rows) (out[r.category_id] ??= []).push(r.keyword);
    return out;
  },
};

// ── User LLM Settings ─────────────────────────────────────────────────────────

export const userLlmSettings = {
  get: (userId) => {
    const row = db.prepare(
      'SELECT provider, api_key, endpoint, model FROM user_llm_settings WHERE user_id = ?'
    ).get(userId);
    if (!row) return { provider: 'none', apiKey: null, endpoint: null, model: null };
    return {
      provider: row.provider ?? 'none',
      apiKey:   row.api_key  ?? null,
      endpoint: row.endpoint ?? null,
      model:    row.model    ?? null,
    };
  },

  set: (userId, data) => {
    db.prepare(`
      INSERT INTO user_llm_settings (user_id, provider, api_key, endpoint, model, updated_at)
      VALUES (@user_id, @provider, @api_key, @endpoint, @model, unixepoch())
      ON CONFLICT(user_id) DO UPDATE SET
        provider   = excluded.provider,
        api_key    = excluded.api_key,
        endpoint   = excluded.endpoint,
        model      = excluded.model,
        updated_at = unixepoch()
    `).run({
      user_id:  userId,
      provider: data.provider ?? 'none',
      api_key:  data.apiKey   ?? null,
      endpoint: data.endpoint ?? null,
      model:    data.model    ?? null,
    });
  },
};

// ── Admin Audit Log ───────────────────────────────────────────────────────────

export const adminAuditLog = {
  record: (adminUserId, action, targetUserId = null) => {
    db.prepare(`
      INSERT INTO admin_audit_log (id, admin_user_id, action, target_user_id)
      VALUES (?, ?, ?, ?)
    `).run(randomUUID(), adminUserId, action, targetUserId);
  },

  listRecent: (limit = 200) =>
    db.prepare(`
      SELECT a.id, a.action, a.created_at,
             admin.email  AS admin_email,
             target.email AS target_email
      FROM admin_audit_log a
      JOIN users admin ON admin.id = a.admin_user_id
      LEFT JOIN users target ON target.id = a.target_user_id
      ORDER BY a.created_at DESC
      LIMIT ?
    `).all(limit),
};
