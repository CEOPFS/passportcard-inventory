import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/wakebot.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      locale TEXT DEFAULT 'he',
      timezone TEXT DEFAULT 'Asia/Jerusalem',
      notification_prefs TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      home_name TEXT NOT NULL,
      vendor_account_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      vendor TEXT NOT NULL,
      model TEXT NOT NULL,
      capabilities TEXT DEFAULT '[]',
      battery_level INTEGER DEFAULT 100,
      firmware_version TEXT,
      map_data TEXT DEFAULT '{}',
      status TEXT DEFAULT 'idle',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS children (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      name TEXT NOT NULL,
      age INTEGER,
      room_name TEXT,
      wake_point_x REAL DEFAULT 0,
      wake_point_y REAL DEFAULT 0,
      safety_radius REAL DEFAULT 50,
      active INTEGER DEFAULT 1,
      avatar_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wake_messages (
      id TEXT PRIMARY KEY,
      child_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      duration REAL DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      volume REAL DEFAULT 0.8,
      is_active INTEGER DEFAULT 1,
      label TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      child_id TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      time_of_day TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      exceptions TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wake_sessions (
      id TEXT PRIMARY KEY,
      child_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      scheduled_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      result_status TEXT DEFAULT 'pending',
      attempts_count INTEGER DEFAULT 0,
      wake_confidence REAL DEFAULT 0,
      parent_notified INTEGER DEFAULT 0,
      log_entries TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      child_id TEXT,
      session_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  console.log('Database initialized successfully');
}

export default getDb;
