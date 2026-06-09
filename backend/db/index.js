const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "booking.db");
const db = new sqlite3.Database(dbPath);

db.getAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });

db.allAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });

db.runAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function runCallback(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

async function ensureColumn(tableName, columnName, definition) {
  const columns = await db.allAsync(`PRAGMA table_info(${tableName})`);
  if (!columns.some((column) => column.name === columnName)) {
    await db.runAsync(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  }
}

db.ready = (async () => {
  await db.runAsync("PRAGMA journal_mode = WAL");
  await db.runAsync("PRAGMA foreign_keys = ON");

  await db.runAsync(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await db.runAsync(`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER DEFAULT 0 CHECK(price >= 0),
    duration INTEGER DEFAULT 60 CHECK(duration >= 15),
    active INTEGER DEFAULT 1 CHECK(active IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await db.runAsync(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    booking_date TEXT NOT NULL,
    booking_time TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'cancelled', 'completed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
  )`);

  await db.runAsync(`CREATE TABLE IF NOT EXISTS time_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
    slot_time TEXT NOT NULL,
    max_bookings INTEGER DEFAULT 1 CHECK(max_bookings >= 1),
    is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    UNIQUE(service_id, day_of_week, slot_time)
  )`);

  await ensureColumn("users", "timezone", "timezone TEXT NOT NULL DEFAULT 'Europe/Moscow'");
  await db.runAsync("UPDATE users SET timezone = COALESCE(NULLIF(timezone, ''), 'Europe/Moscow')");

  await db.runAsync("CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id)");
  await db.runAsync("CREATE INDEX IF NOT EXISTS idx_bookings_service ON bookings(service_id)");
  await db.runAsync("CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date)");
  await db.runAsync("CREATE INDEX IF NOT EXISTS idx_time_slots_service_day ON time_slots(service_id, day_of_week)");
})();

module.exports = db;
