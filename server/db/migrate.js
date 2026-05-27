/**
 * Runs all CREATE TABLE IF NOT EXISTS statements.
 * Safe to call on every server start — it's a no-op if tables already exist.
 * To add a column later: add an ALTER TABLE below the initial CREATE.
 */
export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS events (
      id                  TEXT PRIMARY KEY,
      user_id             TEXT NOT NULL,
      label               TEXT NOT NULL DEFAULT '',
      category            TEXT,
      color               TEXT,
      calendar            TEXT NOT NULL,
      week_start          TEXT NOT NULL,
      day_of_week         INTEGER NOT NULL DEFAULT 0,
      slot_start          INTEGER NOT NULL DEFAULT 0,
      slot_duration       INTEGER NOT NULL DEFAULT 4,
      precision           INTEGER NOT NULL DEFAULT 1,
      is_all_day          INTEGER NOT NULL DEFAULT 0,
      source              TEXT,
      source_calendar_id  TEXT,
      plan_event_id       TEXT,
      notes               TEXT,
      created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at          INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS custom_categories (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      label      TEXT NOT NULL,
      color      TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS category_overrides (
      user_id     TEXT NOT NULL,
      category_id TEXT NOT NULL,
      label       TEXT,
      color       TEXT,
      PRIMARY KEY (user_id, category_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS deleted_defaults (
      user_id     TEXT NOT NULL,
      category_id TEXT NOT NULL,
      PRIMARY KEY (user_id, category_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS linked_calendars (
      id                   TEXT PRIMARY KEY,
      user_id              TEXT NOT NULL,
      name                 TEXT NOT NULL,
      filename             TEXT,
      calendar             TEXT NOT NULL,
      imported_at          TEXT,
      color                TEXT,
      exclude_from_reality INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS habits (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      label       TEXT NOT NULL,
      color       TEXT NOT NULL DEFAULT '#7C3AED',
      target_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
      active      INTEGER NOT NULL DEFAULT 1,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS habit_completions (
      id         TEXT PRIMARY KEY,
      habit_id   TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      date       TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(habit_id, date),
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS time_budgets (
      user_id      TEXT NOT NULL,
      category_id  TEXT NOT NULL,
      weekly_hours REAL NOT NULL,
      updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, category_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}
