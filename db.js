const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// Using Node's own built-in SQLite (available from Node 22.5+, no native
// compilation needed) instead of better-sqlite3. This was a direct fix for
// a real deploy failure: better-sqlite3 needs to compile a native binding
// via node-gyp at install time, which failed on Hostinger's build
// environment because it has no Python available for that step. Node's
// built-in module needs nothing compiled at all, so this removes the
// problem rather than working around it.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'gstours.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL'); // safe for concurrent reads/writes, and crash-resistant

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  name TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,          -- full record as JSON (name, type, street, ... extraHourRate, extraKmRate, notes)
  name TEXT,                   -- denormalized for search/sort
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  name TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  name TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS queries (
  id TEXT PRIMARY KEY,
  ref TEXT,
  data TEXT NOT NULL,          -- everything, including the log[] array
  company TEXT,
  stage TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  ref TEXT,
  data TEXT NOT NULL,          -- everything, including dates[] and units[]
  company TEXT,
  status TEXT,
  tripDate TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  number TEXT,
  data TEXT NOT NULL,          -- everything, including lines[]
  company TEXT,
  status TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  updatedAt TEXT DEFAULT (datetime('now'))
);

-- every write to any entity is logged here too, append-only, cheap insurance
-- against exactly the kind of scare that started this whole rebuild
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  entityId TEXT,
  action TEXT NOT NULL,        -- 'upsert' | 'delete'
  snapshot TEXT,                -- full JSON of the record at time of write
  at TEXT DEFAULT (datetime('now'))
);
`);

module.exports = db;
