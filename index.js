require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const { db, init, DB_PATH } = require("./db");
const { generateCard } = require("./card");
const { analyzeMessages } = require("./ai");

const TOKEN = process.env.BOT_TOKEN || "";
const ADMIN_ID = Number(process.env.ADMIN_ID || 0);

if (!TOKEN) {
  console.error("BOT_TOKEN muhit o'zgaruvchisida berilmagan!");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: { timeout: 10 },
  },
});
init();

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function isAdmin(msg) {
  return msg.from.id === ADMIN_ID;
}

function sendAdmin(text) {
  if (ADMIN_ID) bot.sendMessage(ADMIN_ID, text);
}

// ---- /start ----
bot.onText(/^\/start$/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `Assalomu alaykum! 🏢 *wentric.uz rasmiy boti*

Mavjud buyruqlar:
/litsenziy <ism> — a'zo kartochkasi
/list — a'zolar ro'yxati
/about — jamoa haqida
/history — jamoa tarixi
/add — a'zo qo'shish (admin)
/addresident — rezident qo'shish (admin)
/analyze — AI tahlil (admin)
/backup — db backup (admin)`,
    { parse_mode: "Markdown" }
  );
});

// ---- /add (admin) ----
bot.onText(/^\/add$/, (msg) => {
  if (!isAdmin(msg)) return;
  bot.sendMessage(
    msg.chat.id,
    `Yangi a'zo qo'shish uchun quyidagi formatda yuboring:

\`Ism | Lavozim | Litsenziya | Telefon | Qo'shilgan sana | Rasm URL | Bio\`

Misol:
\`Ali Valiyev | Bosh dasturchi | W-2024-001 | +998901234567 | 2024-01-15 | https://... | 5 yil tajriba\``,
    { parse_mode: "Markdown" }
  );
});

bot.on(/^Ism \| .+/, async (msg) => {
  if (!isAdmin(msg)) return;
  const parts = msg.text.split("|").map((s) => s.trim());
  if (parts.length < 4) {
    return bot.sendMessage(msg.chat.id, "Kamida 4 ta maydon kerak: Ism | Lavozim | Litsenziya | Telefon");
  }
  const [full_name, position, license_number, phone, joined_date, photo_url, bio] = parts;
  db.run(
    `INSERT INTO members (full_name, position, license_number, phone, joined_date, photo_url, bio) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [full_name, position, license_number, phone, joined_date || new Date().toISOString().slice(0, 10), photo_url || null, bio || null],
    function (err) {
      if (err) {
        return bot.sendMessage(msg.chat.id, `Xato: ${err.message}`);
      }
      bot.sendMessage(msg.chat.id, `✅ A'zo qo'shildi: ${full_name} (${license_number})`);
    }
  );
});

// ---- /litsenziy <ism> ----
bot.onText(/^\/litsenziy\s+(.+)$/, async (msg, match) => {
  const query = match[1].trim();
  db.get(
    `SELECT * FROM members WHERE full_name LIKE ? OR license_number LIKE ? ORDER BY id LIMIT 1`,
    [`%${query}%`, `%${query}%`],
    async (err, member) => {
      if (err || !member) {
        return bot.sendMessage(msg.chat.id, `❌ "${query}" bo'yicha a'zo topilmadi.`);
      }
      try {
        await bot.sendChatAction(msg.chat.id, "upload_photo");
        const cardBuffer = await generateCard(member);
        bot.sendPhoto(msg.chat.id, cardBuffer, {
          caption: `🏢 *${member.full_name}*
📌 ${member.position}
🪪 Litsenziya: ${member.license_number}
📅 Qo'shilgan: ${member.joined_date}
${member.phone ? "📞 " + member.phone + "\n" : ""}${member.bio ? "📝 " + member.bio : ""}`,
          parse_mode: "Markdown",
        });
      } catch (e) {
        bot.sendMessage(msg.chat.id, `Kartochka yaratishda xato: ${e.message}`);
      }
    }
  );
});

// ---- /list ----
bot.onText(/^\/list$/, (msg) => {
  db.all(`SELECT * FROM members ORDER BY id`, (err, rows) => {
    if (err || !rows.length) {
      return bot.sendMessage(msg.chat.id, "Hozircha a'zolar yo'q.");
    }
    const list = rows
      .map((m, i) => `${i + 1}. ${m.full_name} — ${m.position} (${m.license_number})`)
      .join("\n");
    bot.sendMessage(msg.chat.id, `📋 *Jamoa a'zolari:*\n\n${list}`, {
      parse_mode: "Markdown",
    });
  });
});

// ---- /about ----
bot.onText(/^\/about$/, (msg) => {
  db.get(`SELECT about FROM team_info WHERE id = 1`, (err, row) => {
    bot.sendMessage(msg.chat.id, `ℹ️ *Jamoa haqida*\n\n${row?.about || "Ma'lumot yo'q."}`, {
      parse_mode: "Markdown",
    });
  });
});

// ---- /history ----
bot.onText(/^\/history$/, (msg) => {
  db.get(`SELECT history FROM team_info WHERE id = 1`, (err, row) => {
    bot.sendMessage(msg.chat.id, `📜 *Jamoa tarixi*\n\n${row?.history || "Ma'lumot yo'q."}`, {
      parse_mode: "Markdown",
    });
  });
});

// ---- /addresident (admin) ----
bot.onText(/^\/addresident$/, (msg) => {
  if (!isAdmin(msg) && msg.chat.type !== "private") return;
  bot.sendMessage(
    msg.chat.id,
    `Rezident qo'shish uchun quyidagi formatda yuboring:

\`Ism | Loyiha nomi | Qo'shilgan sana | Izoh\`

Misol:
\`John Doe | AI Platform | 2024-03-01 | TechStars rezidenti\``,
    { parse_mode: "Markdown" }
  );
});

bot.on(/^Ism \| .+/, (msg) => {
  if (!isAdmin(msg)) return;
  const parts = msg.text.split("|").map((s) => s.trim());
  const [full_name, project_name, joined_date, notes] = parts;
  db.run(
    `INSERT INTO residents (full_name, project_name, joined_date, notes) VALUES (?, ?, ?, ?)`,
    [full_name, project_name || null, joined_date || new Date().toISOString().slice(0, 10), notes || null],
    function (err) {
      if (err) return bot.sendMessage(msg.chat.id, `Xato: ${err.message}`);
      bot.sendMessage(msg.chat.id, `✅ Rezident qo'shildi: ${full_name}`);
    }
  );
});

// ---- /analyze (admin) ----
bot.onText(/^\/analyze$/, async (msg) => {
  if (!isAdmin(msg)) return;
  bot.sendMessage(msg.chat.id, "🔍 Tahlil boshlandi, biroz kuting...");
  await bot.sendChatAction(msg.chat.id, "typing");
  db.all(`SELECT * FROM chat_logs ORDER BY id DESC LIMIT 500`, async (err, rows) => {
    if (err || !rows.length) {
      return bot.sendMessage(msg.chat.id, "Hozircha tahlil qilish uchun yozuvlar yo'q.");
    }
    const report = await analyzeMessages(rows);
    bot.sendMessage(msg.chat.id, report);
  });
});

// ---- /backup (admin) ----
bot.onText(/^\/backup$/, (msg) => {
  if (!isAdmin(msg)) return;
  if (!fs.existsSync(DB_PATH)) {
    return bot.sendMessage(msg.chat.id, "DB fayl topilmadi.");
  }
  bot.sendDocument(msg.chat.id, DB_PATH, {
    caption: `📦 Backup: ${new Date().toLocaleString("uz-UZ")}`,
  });
});

// ---- Chat log yozish (guruhdagi barcha xabarlar) ----
bot.on("message", (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;
  const isMira = msg.from?.username === "mira" || msg.from?.first_name?.toLowerCase().includes("mira");
  db.run(
    `INSERT INTO chat_logs (chat_id, user_id, username, full_name, message, is_mira) VALUES (?, ?, ?, ?, ?, ?)`,
    [msg.chat.id, msg.from?.id, msg.from?.username, msg.from?.first_name, msg.text, isMira ? 1 : 0]
  );
});

// ---- Kunlik db backup adminga (har kuni 23:59) ----
cron.schedule("59 23 * * *", () => {
  if (!ADMIN_ID) return;
  if (!fs.existsSync(DB_PATH)) return;
  bot.sendDocument(ADMIN_ID, DB_PATH, {
    caption: `📦 Kunlik avtomatik backup: ${new Date().toLocaleString("uz-UZ")}`,
  });
  sendAdmin("📦 Kunlik backup yuborildi.");
});

console.log("wentric.uz bot ishga tushdi ✅");
