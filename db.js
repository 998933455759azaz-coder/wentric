const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "wentric.db");
const db = new sqlite3.Database(DB_PATH);

const ROLES = [
  "SMM mutaxassisi", "Dasturchi (Frontend)", "Dasturchi (Backend)",
  "Dasturchi (Mobile)", "Dizayner (UI/UX)", "Dizayner (Grafik)",
  "Marketing mutaxassisi", "Project menejer", "Content menejer",
  "SEO mutaxassisi", "Video montaj", "Motion dizayner",
  "Copywriter", "Sotuv menejeri", "HR mutaxassisi",
  "Buxgalter", "Yurist", "Analitik",
  "DevOps muhandisi", "QA muhandisi", "AI muhandisi",
  "Data scientist", "Product menejer", "Texnik yordam",
  "Administrator", "Tarjimon", "SMM menejer",
  "PR mutaxassisi", "Brand menejer", "Operatsion menejer",
];

function init() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER UNIQUE,
      full_name TEXT NOT NULL,
      username TEXT,
      age INTEGER,
      role TEXT,
      license_number TEXT UNIQUE,
      photo_url TEXT,
      phone TEXT,
      bio TEXT,
      joined_date TEXT NOT NULL,
      is_resident BOOLEAN DEFAULT 0,
      is_blocked BOOLEAN DEFAULT 0,
      is_admin BOOLEAN DEFAULT 0,
      added_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS residents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER,
      project_name TEXT,
      status TEXT DEFAULT 'active',
      joined_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      deadline TEXT,
      assigned_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      FOREIGN KEY (member_id) REFERENCES members(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS chat_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER,
      user_id INTEGER,
      username TEXT,
      full_name TEXT,
      message TEXT,
      is_mira BOOLEAN DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS team_info (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      about TEXT,
      history TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pending_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER,
      telegram_id INTEGER,
      full_name TEXT,
      username TEXT,
      joined_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_members_telegram ON members(telegram_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_members_license ON members(license_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_members_name ON members(full_name)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_member ON tasks(member_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_chat_logs_chat ON chat_logs(chat_id, created_at)`);

    const stmt = db.prepare("INSERT OR IGNORE INTO roles (name) VALUES (?)");
    for (const r of ROLES) stmt.run(r);
    stmt.finalize();

    db.run(`INSERT OR IGNORE INTO team_info (id, about, history) VALUES (1,
      'wentric.uz — innovatsion texnologiyalar va raqamli yechimlar kompaniyasi. Bizning jamoa tajribali mutaxassislardan tashkil topgan bo''lib, raqamli mahsulotlar ishlab chiqish, AI yechimlar va biznes-transformatsiya sohasida faoliyat yuritamiz.',
      'wentric.uz 2024-yilda tashkil etilgan. Kompaniya raqamli transformatsiya, AI yechimlar va dasturiy ta''minot ishlab chiqish sohasida faoliyat yuritadi. Qisqa vaqt ichida jamoa 50+ mutaxassis bilan to''ldi va 20+ muvaffaqiyatli loyiha amalga oshirildi.'
    )`);
  });
}

function getSetting(key) {
  return new Promise((resolve) => {
    db.get("SELECT value FROM settings WHERE key = ?", [key], (err, row) => {
      resolve(err || !row ? null : row.value);
    });
  });
}

function setSetting(key, value) {
  return new Promise((resolve) => {
    db.run(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
      [key, value, value],
      function () { resolve(this.changes > 0); }
    );
  });
}

module.exports = { db, init, DB_PATH, ROLES, getSetting, setSetting };
