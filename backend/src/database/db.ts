import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const result = await pool.query(sql, params);
  return (result.rows[0] as T) ?? null;
}

export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

export async function execute(sql: string, params: any[] = []): Promise<void> {
  await pool.query(sql, params);
}

export async function initializeDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      locale TEXT DEFAULT 'he',
      timezone TEXT DEFAULT 'Asia/Jerusalem',
      notification_prefs TEXT DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      home_name TEXT NOT NULL,
      vendor_account_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
      vendor TEXT NOT NULL,
      model TEXT NOT NULL,
      capabilities TEXT DEFAULT '[]',
      battery_level INTEGER DEFAULT 100,
      firmware_version TEXT,
      map_data TEXT DEFAULT '{}',
      status TEXT DEFAULT 'idle',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS children (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      age INTEGER,
      room_name TEXT,
      wake_point_x REAL DEFAULT 0,
      wake_point_y REAL DEFAULT 0,
      safety_radius REAL DEFAULT 50,
      active INTEGER DEFAULT 1,
      avatar_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wake_messages (
      id TEXT PRIMARY KEY,
      child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      duration REAL DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      volume REAL DEFAULT 0.8,
      is_active INTEGER DEFAULT 1,
      label TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      time_of_day TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      exceptions TEXT DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wake_sessions (
      id TEXT PRIMARY KEY,
      child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      scheduled_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      result_status TEXT DEFAULT 'pending',
      attempts_count INTEGER DEFAULT 0,
      wake_confidence REAL DEFAULT 0,
      parent_notified INTEGER DEFAULT 0,
      log_entries TEXT DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      child_id TEXT,
      session_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log('Database initialized successfully');
}
