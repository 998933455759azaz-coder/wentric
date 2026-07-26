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

const GROUPS = [
  { name: "CEO Office", lead: "Javohirbek Nasrullayev", desc: "Boshqaruv va strategiya" },
  { name: "Technology", lead: "Sardor Tuyg'inov", desc: "Texnik bo'lim (CISO, Backend, Frontend, QA)" },
  { name: "Marketing", lead: "Eldor Mirzajonov", desc: "Marketing, PR, Brand, SMM" },
  { name: "Operations", lead: "Uchqunbek Farxodov", desc: "Product, HR, Finance, Client Success" },
  { name: "AI Solutions", lead: "Jackson", desc: "Intellekt AI va AI integratsiya" },
];

const PROJECTS = [
  { name: "CodeUsta.uz", slogan: "Quality First", desc: "Crowdtesting & bug bounty platformasi", status: "active" },
  { name: "Vibogram", slogan: "Global Digital OS", desc: "Raqamli ekosistema va kommunikatsiya OS", status: "active" },
  { name: "Makerpay.uz", slogan: "", desc: "To'lov yechimi", status: "active" },
  { name: "Rastoo.uz", slogan: "", desc: "Beta bosqichda (1-avgust)", status: "beta" },
  { name: "Intellekt AI", slogan: "", desc: "AI yechimlar, backend Jackson qo'lida", status: "active" },
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
      group_id INTEGER,
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

    db.run(`CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      lead TEXT,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slogan TEXT,
      description TEXT,
      status TEXT DEFAULT 'active',
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
      score INTEGER DEFAULT 0,
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

    db.run(`CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER,
      amount REAL NOT NULL,
      reason TEXT,
      period TEXT,
      granted_by INTEGER,
      granted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rating_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER,
      task_id INTEGER,
      points INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_members_telegram ON members(telegram_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_members_license ON members(license_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_members_name ON members(full_name)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_member ON tasks(member_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_chat_logs_chat ON chat_logs(chat_id, created_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_rating_member ON rating_log(member_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_rewards_member ON rewards(member_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_rewards_member ON rewards(member_id)`);

    // Migrations for existing DBs (must run before indexes that reference new columns)
    db.run("ALTER TABLE members ADD COLUMN group_id INTEGER", () => {
      db.run("CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_id)");
    });
    db.run("ALTER TABLE tasks ADD COLUMN score INTEGER DEFAULT 0", () => {});

    const stmt = db.prepare("INSERT OR IGNORE INTO roles (name) VALUES (?)");
    for (const r of ROLES) stmt.run(r);
    stmt.finalize();

    const gstmt = db.prepare("INSERT OR IGNORE INTO groups (name, lead, description) VALUES (?, ?, ?)");
    for (const g of GROUPS) gstmt.run(g.name, g.lead, g.desc);
    gstmt.finalize();

    const pstmt = db.prepare("INSERT OR IGNORE INTO projects (name, slogan, description, status) VALUES (?, ?, ?, ?)");
    for (const p of PROJECTS) pstmt.run(p.name, p.slogan, p.desc, p.status);
    pstmt.finalize();

    db.run(`INSERT OR IGNORE INTO team_info (id, about, history) VALUES (1,
      '🏢 Wentric.uz — innovatsion texnologiyalar va raqamli yechimlar kompaniyasi.\n\nJamoa tajribali mutaxassislardan tashkil topgan.\nAsos: 2024, Toshkent, O''zbekiston.\n\n🎯 3 ta asosiy yo''nalish:\n1️⃣ Raqamli mahsulotlar ishlab chiqish\n   • CodeUsta.uz — crowdtesting & bug bounty (Quality First)\n   • Vibogram — raqamli ekosistema va kommunikatsiya OS\n   • Makerpay.uz — to''lov yechimi\n   • Rastoo.uz — beta bosqichda (1-avgust)\n2️⃣ AI yechimlar\n   • Intellekt AI — backend Jackson qo''lida\n   • Mijozlar uchun AI integratsiya\n3️⃣ Biznes-transformatsiya\n   • Mijozlar uchun telegram bot, web sayt, platforma yaratish\n   • Kompaniyalarga raqamli ko''rinish berish\n\n👥 Jamoa strukturasi:\n• CEO — Javohirbek Nasrullayev\n• CTO — Sardor Tuyg''inov\n• CMO — Eldor Mirzajonov, Firdavs\n• COO — Uchqunbek Farxodov\n• CISO — Kamron\n• Backend — Sino, Jackson\n• Frontend — Abdulhay, Husanboy, Shoxa\n• QA — Shuxrat\n• Operations — Product/HR/Finance/Client Success',
      'Wentric.uz 2024-yilda Toshkentda tashkil etilgan. Kompaniya raqamli transformatsiya, AI yechimlar va dasturiy ta''minot ishlab chiqish sohasida faoliyat yuritadi.'
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

function getMemberRating(memberId, period) {
  return new Promise((resolve) => {
    let query = "SELECT COALESCE(SUM(points), 0) as total FROM rating_log WHERE member_id = ?";
    let params = [memberId];
    if (period === "week") {
      query += " AND created_at >= datetime('now','-7 days')";
    } else if (period === "month") {
      query += " AND created_at >= datetime('now','-30 days')";
    }
    db.get(query, params, (err, row) => {
      resolve(err || !row ? 0 : row.total);
    });
  });
}

function getGroupRating(groupId, period) {
  return new Promise((resolve) => {
    let query = `SELECT COALESCE(SUM(r.points), 0) as total, COUNT(r.id) as count
      FROM rating_log r JOIN members m ON r.member_id = m.id
      WHERE m.group_id = ?`;
    let params = [groupId];
    if (period === "week") {
      query += " AND r.created_at >= datetime('now','-7 days')";
    } else if (period === "month") {
      query += " AND r.created_at >= datetime('now','-30 days')";
    }
    db.get(query, params, (err, row) => {
      resolve(err || !row ? { total: 0, count: 0 } : row);
    });
  });
}

function addRatingPoints(memberId, taskId, points, reason) {
  return new Promise((resolve) => {
    db.run(
      "INSERT INTO rating_log (member_id, task_id, points, reason) VALUES (?, ?, ?, ?)",
      [memberId, taskId, points, reason],
      function () { resolve(this.lastID); }
    );
  });
}

module.exports = {
  db, init, DB_PATH, ROLES, GROUPS, PROJECTS,
  getSetting, setSetting,
  getMemberRating, getGroupRating, addRatingPoints,
};
