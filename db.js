const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "wentric.db");

const db = new sqlite3.Database(DB_PATH);

function init() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        position TEXT NOT NULL,
        license_number TEXT UNIQUE NOT NULL,
        photo_url TEXT,
        phone TEXT,
        joined_date TEXT NOT NULL,
        bio TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS residents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        project_name TEXT,
        status TEXT DEFAULT 'active',
        joined_date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS team_info (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        about TEXT,
        history TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS chat_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER,
        user_id INTEGER,
        username TEXT,
        full_name TEXT,
        message TEXT,
        is_mira BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_members_license ON members(license_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_members_name ON members(full_name)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_chat_logs_chat ON chat_logs(chat_id, created_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_chat_logs_mira ON chat_logs(is_mira)`);

    db.run(`
      INSERT OR IGNORE INTO team_info (id, about, history)
      VALUES (1,
        'wentric.uz — innovatsion texnologiyalar va raqamli yechimlar kompaniyasi. Bizning jamoa tajribali mutaxassisirlardan tashkil topgan.',
        'wentric.uz 2024-yilda tashkil etilgan. Kompaniya raqamli transformatsiya, AI yechimlar va dasturiy ta''minot ishlab chiqish sohasida faoliyat yuritadi.'
      )
    `);
  });
}

module.exports = { db, init, DB_PATH };
