import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './migrate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve the data directory: env override → project-root/data
const DATA_DIR = process.env.DATA_DIR
  ? process.env.DATA_DIR
  : join(__dirname, '../../data');

const DB_PATH = process.env.DATABASE_PATH
  ? process.env.DATABASE_PATH
  : join(DATA_DIR, 'calendar.db');

// Make sure the directory exists before opening the file
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);

// WAL mode → much better concurrent read performance
db.pragma('journal_mode = WAL');
// Enforce foreign-key constraints
db.pragma('foreign_keys = ON');

// Create tables on first run (no-op afterwards)
runMigrations(db);

console.log(`SQLite database  →  ${DB_PATH}`);
