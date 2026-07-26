require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const cron = require("node-cron");
const fs = require("fs");
const { db, init, DB_PATH, ROLES, getSetting, setSetting } = require("./db");
const { textCard, taskCard } = require("./card");
const { analyzeMessages, testAI } = require("./ai");
const {
  mainMenu, adminPanel, rolesInline, taskStatusInline,
  memberActionInline, dashboardInline, aiSettingsInline, confirmInline,
  approveInline,
} = require("./keyboards");

const TOKEN = process.env.BOT_TOKEN || "";
const ADMIN_ID = Number(process.env.ADMIN_ID || 0);
const START_IMAGE = process.env.START_IMAGE || "";

if (!TOKEN) { console.error("BOT_TOKEN berilmagan!"); process.exit(1); }

const bot = new TelegramBot(TOKEN, {
  polling: { interval: 300, autoStart: true, params: { timeout: 10 } },
});
init();

const dataDir = require("path").join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ---- Session state for multi-step input ----
const sessions = {};

function setSession(userId, data) {
  sessions[userId] = { ...sessions[userId], ...data, ts: Date.now() };
}
function clearSession(userId) { delete sessions[userId]; }
function getSession(userId) { return sessions[userId]; }

// Clean stale sessions every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [uid, s] of Object.entries(sessions)) {
    if (now - s.ts > 10 * 60 * 1000) delete sessions[uid];
  }
}, 600000);

function isAdmin(userId) { return userId === ADMIN_ID; }

// ---- Helper: query member by telegram_id ----
function getMemberByTelegramId(tid) {
  return new Promise((resolve) => {
    db.get("SELECT * FROM members WHERE telegram_id = ?", [tid], (err, row) => resolve(err ? null : row));
  });
}

function getMemberById(id) {
  return new Promise((resolve) => {
    db.get("SELECT * FROM members WHERE id = ?", [id], (err, row) => resolve(err ? null : row));
  });
}

function getAdmins() {
  return new Promise((resolve) => {
    db.all("SELECT telegram_id FROM members WHERE is_admin = 1", (err, rows) => {
      const ids = (rows || []).map((r) => r.telegram_id);
      if (ADMIN_ID && !ids.includes(ADMIN_ID)) ids.push(ADMIN_ID);
      resolve(ids);
    });
  });
}

async function isUserAdmin(userId) {
  if (userId === ADMIN_ID) return true;
  const admins = await getAdmins();
  return admins.includes(userId);
}

function genLicenseNumber() {
  return "W-" + new Date().getFullYear() + "-" + String(Date.now()).slice(-6);
}

// ============================================================
// /start — Batafsil tanishtirish (takroriy javob yo'q)
// ============================================================
bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Auto-register from group: if in DB already, just greet
  const member = await getMemberByTelegramId(userId);

  // Auto-update name & username from Telegram
  if (member) {
    const tgName = (msg.from.first_name + " " + (msg.from.last_name || "")).trim();
    const tgUsername = msg.from.username || null;
    const placeholder = !member.full_name || member.full_name === "—" || member.full_name === "Noma'lum";
    if (tgName && (placeholder || tgName !== member.full_name)) {
      db.run("UPDATE members SET full_name = ? WHERE id = ?", [tgName, member.id]);
      member.full_name = tgName;
    }
    if (tgUsername !== (member.username || null)) {
      db.run("UPDATE members SET username = ? WHERE id = ?", [tgUsername, member.id]);
      member.username = tgUsername;
    }
  }

  const intro = `🏢 *wentric.uz rasmiy boti*

Assalomu alaykum, ${msg.from.first_name || "Foydalanuvchi"}!

Men — wentric.uz kompaniyasining rasmiy jamoa boshqaruv botiman. Quyidagi imkoniyatlarni taqdim etaman:

👤 *Profil* — Sizning shaxsiy profilingizni ko'rish
📊 *Dashboard* — Umumiy ko'rinish va statistika
📋 *Vazifalar* — Sizga biriktirilgan vazifalar
🪪 *Litsenziya* — A'zo kartochkasini ko'rish
🏢 *Jamoa haqida* — Kompaniya ma'lumoti
📜 *Tarix* — Jamoa tarixi

${member ? `\n✅ Siz ro'yxatdasiz: *${member.role || "A'zo"}*` : "\nℹ Siz hali ro'yxatga olinmagansiz. Admin sizni qo'shishi mumkin."}

${isAdmin(userId) ? "\n🔐 Admin panel: /admin" : ""}`;

  const startImage = (await getSetting("start_image")) || START_IMAGE;
  if (startImage) {
    bot.sendPhoto(chatId, startImage, { caption: intro, parse_mode: "Markdown", ...mainMenu() });
  } else {
    bot.sendMessage(chatId, intro, { parse_mode: "Markdown", ...mainMenu() });
  }
});

// ============================================================
// /setstartimage — admin sets start image via forward or file_id
// ============================================================
bot.onText(/^\/setstartimage$/, async (msg) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  if (msg.reply_to_message && msg.reply_to_message.photo) {
    const fileId = msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1].file_id;
    await setSetting("start_image", fileId);
    bot.sendMessage(msg.chat.id, `✅ Start rasmi o'rnatildi.\n\nFile ID:\n\`${fileId}\`\n\nEndi /start bosilganda bu rasm chiqadi.`, { parse_mode: "Markdown" });
  } else {
    bot.sendMessage(msg.chat.id, "Rasmni forward qiling va unga reply berib /setstartimage ni bosing.\nYoki /setstartimage <file_id> ko'rinishida kiriting.");
  }
});

bot.onText(/^\/setstartimage\s+(.+)$/, async (msg, match) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  const fileId = match[1].trim();
  await setSetting("start_image", fileId);
  bot.sendMessage(msg.chat.id, `✅ Start rasmi o'rnatildi.\n\nFile ID: \`${fileId}\``, { parse_mode: "Markdown" });
});

// ============================================================
// /admin — Admin panel
// ============================================================
bot.onText(/^\/admin$/, async (msg) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  bot.sendMessage(msg.chat.id, "🔐 *Admin panel*\n\nQuyidagi funksiyalardan birini tanlang:", {
    parse_mode: "Markdown",
    ...adminPanel(),
  });
});

// ============================================================
// /who — Reply to user in group to show their card
// ============================================================
bot.onText(/^\/who(\s+\d+)?$/, async (msg, match) => {
  let targetId;
  if (msg.reply_to_message) {
    targetId = msg.reply_to_message.from.id;
  } else if (match[1]) {
    targetId = Number(match[1].trim());
  } else {
    return bot.sendMessage(msg.chat.id, "Foydalanuvchiga reply qiling yoki /who <telegram_id> kiriting.");
  }

  const member = await getMemberByTelegramId(targetId);
  if (!member) {
    const tgUser = msg.reply_to_message?.from;
    const unknownMember = {
      full_name: (tgUser?.first_name + " " + (tgUser?.last_name || "")).trim() || "Noma'lum",
      username: tgUser?.username || null,
      role: "Rezident emas / Noma'lum",
      license_number: "Berilmagan",
      joined_date: "—",
      phone: null,
      photo_url: null,
      telegram_id: targetId,
      is_blocked: false,
      is_resident: false,
    };
    bot.sendMessage(msg.chat.id, textCard(unknownMember, true), {
      parse_mode: "Markdown",
      reply_to_message_id: msg.reply_to_message?.message_id,
    });
    return;
  }

  if (member.photo_url) {
    bot.sendPhoto(msg.chat.id, member.photo_url, {
      caption: textCard(member),
      parse_mode: "Markdown",
      reply_to_message_id: msg.reply_to_message?.message_id,
    });
  } else {
    bot.sendMessage(msg.chat.id, textCard(member), {
      parse_mode: "Markdown",
      reply_to_message_id: msg.reply_to_message?.message_id,
    });
  }
});

// ============================================================
// /litsenziy <ism> — card by name
// ============================================================
bot.onText(/^\/litsenziy\s+(.+)$/, async (msg, match) => {
  const query = match[1].trim();
  db.get(
    "SELECT * FROM members WHERE full_name LIKE ? OR license_number LIKE ? ORDER BY id LIMIT 1",
    [`%${query}%`, `%${query}%`],
    async (err, member) => {
      if (err || !member) return bot.sendMessage(msg.chat.id, `❌ "${query}" bo'yicha a'zo topilmadi.`);
      if (member.photo_url) {
        bot.sendPhoto(msg.chat.id, member.photo_url, { caption: textCard(member), parse_mode: "Markdown" });
      } else {
        bot.sendMessage(msg.chat.id, textCard(member), { parse_mode: "Markdown" });
      }
    }
  );
});

// ============================================================
// /profile — user's own profile
// ============================================================
bot.onText(/^\/profile$/, async (msg) => {
  const member = await getMemberByTelegramId(msg.from.id);
  if (!member) return bot.sendMessage(msg.chat.id, "Siz hali ro'yxatga olinmagansiz.");
  const cardText = textCard(member) + "\n\nProfilni yangilash: /editprofile\nProfil rasmi: /setphoto";
  if (member.photo_url) {
    bot.sendPhoto(msg.chat.id, member.photo_url, { caption: cardText, parse_mode: "Markdown" });
  } else {
    bot.sendMessage(msg.chat.id, cardText, { parse_mode: "Markdown" });
  }
});

// ============================================================
// /editprofile — user edits own profile (age, bio, phone)
// ============================================================
bot.onText(/^\/editprofile$/, async (msg) => {
  const member = await getMemberByTelegramId(msg.from.id);
  if (!member) return bot.sendMessage(msg.chat.id, "Siz hali ro'yxatga olinmagansiz.");
  setSession(msg.from.id, { action: "editprofile" });
  bot.sendMessage(
    msg.chat.id,
    `Profilingizni yangilash uchun quyidagi formatda yuboring:\n\n\`Yosh | Telefon | Bio\`\n\nMisol:\n\`25 | +998901234567 | Dasturchi, 5 yil tajriba\``,
    { parse_mode: "Markdown" }
  );
});

// ============================================================
// /dashboard — user dashboard
// ============================================================
bot.onText(/^\/dashboard$/, async (msg) => {
  const member = await getMemberByTelegramId(msg.from.id);
  if (!member) return bot.sendMessage(msg.chat.id, "Siz hali ro'yxatga olinmagansiz.");

  db.all("SELECT * FROM tasks WHERE member_id = ? ORDER BY id DESC", [member.id], (err, tasks) => {
    const pending = (tasks || []).filter((t) => t.status === "pending").length;
    const inProgress = (tasks || []).filter((t) => t.status === "in_progress").length;
    const done = (tasks || []).filter((t) => t.status === "done").length;

    bot.sendMessage(
      msg.chat.id,
      `📊 *Dashboard — ${member.full_name}*\n\n🎭 Rol: ${member.role || "—"}\n🪪 Litsenziya: ${member.license_number || "Berilmagan"}\n🏢 Rezident: ${member.is_resident ? "Ha" : "Yo'q"}\n\n📋 *Vazifalar:*\n⏳ Boshlanmagan: ${pending}\n🔄 Jarayonda: ${inProgress}\n✅ Tugatilgan: ${done}\n📋 Jami: ${tasks?.length || 0}`,
      { parse_mode: "Markdown", ...dashboardInline() }
    );
  });
});

// ============================================================
// /mytasks — user's tasks
// ============================================================
bot.onText(/^\/mytasks$/, async (msg) => {
  const member = await getMemberByTelegramId(msg.from.id);
  if (!member) return bot.sendMessage(msg.chat.id, "Siz hali ro'yxatga olinmagansiz.");
  db.all("SELECT * FROM tasks WHERE member_id = ? ORDER BY id DESC", [member.id], (err, tasks) => {
    if (err || !tasks?.length) return bot.sendMessage(msg.chat.id, "Sizga vazifa biriktirilmagan.");
    const list = tasks.map((t) => taskCard(t, member)).join("\n\n");
    bot.sendMessage(msg.chat.id, list + "\n\nStatus o'zgartirish: /taskstatus <id>", { parse_mode: "Markdown" });
  });
});

// ============================================================
// /taskstatus <id> — change task status
// ============================================================
bot.onText(/^\/taskstatus\s+(\d+)$/, async (msg, match) => {
  const taskId = Number(match[1]);
  const member = await getMemberByTelegramId(msg.from.id);
  if (!member) return bot.sendMessage(msg.chat.id, "Siz ro'yxatda emassiz.");
  db.get("SELECT * FROM tasks WHERE id = ? AND member_id = ?", [taskId, member.id], (err, task) => {
    if (err || !task) return bot.sendMessage(msg.chat.id, "Vazifa topilmadi.");
    bot.sendMessage(msg.chat.id, `Vazifa: *${task.title}*\nHolatni tanlang:`, {
      parse_mode: "Markdown",
      reply_markup: taskStatusInline(taskId),
    });
  });
});

// ============================================================
// /about and /history
// ============================================================
bot.onText(/^\/about$/, (msg) => {
  db.get("SELECT about FROM team_info WHERE id = 1", (err, row) => {
    bot.sendMessage(msg.chat.id, `ℹ️ *Jamoa haqida*\n\n${row?.about || "Ma'lumot yo'q."}`, { parse_mode: "Markdown" });
  });
});

bot.onText(/^\/history$/, (msg) => {
  db.get("SELECT history FROM team_info WHERE id = 1", (err, row) => {
    bot.sendMessage(msg.chat.id, `📜 *Jamoa tarixi*\n\n${row?.history || "Ma'lumot yo'q."}`, { parse_mode: "Markdown" });
  });
});

// ============================================================
// /list — all members
// ============================================================
bot.onText(/^\/list$/, (msg) => {
  db.all("SELECT * FROM members ORDER BY id", (err, rows) => {
    if (err || !rows?.length) return bot.sendMessage(msg.chat.id, "Hozircha a'zolar yo'q.");
    const list = rows.map((m, i) => `${i + 1}. ${m.full_name} — ${m.role || "—"} (${m.license_number || "—"})${m.is_blocked ? " 🚫" : ""}`).join("\n");
    bot.sendMessage(msg.chat.id, `📋 *Jamoa a'zolari (${rows.length}):*\n\n${list}`, { parse_mode: "Markdown" });
  });
});

// ============================================================
// /add — Admin adds member (auto telegram_id, name from Telegram)
// ============================================================
bot.onText(/^\/add$/, async (msg) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  if (!msg.reply_to_message) {
    return bot.sendMessage(msg.chat.id, "Foydalanuvchiga reply qiling va /add ni bosing. Yoki /add <telegram_id> kiriting.");
  }
  const target = msg.reply_to_message.from;
  setSession(msg.from.id, {
    action: "add_member",
    target_id: target.id,
    target_name: (target.first_name + " " + (target.last_name || "")).trim(),
    target_username: target.username,
  });
  bot.sendMessage(
    msg.chat.id,
    `Yangi a'zo: *${target.first_name}*\nTelegram ID: \`${target.id}\`\n\nYoshini kiriting (yoki - o'tkazib o'tish uchun):`,
    { parse_mode: "Markdown" }
  );
});

bot.onText(/^\/add\s+(\d+)$/, async (msg, match) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  const targetId = Number(match[1]);
  let targetName = "—";
  let targetUsername = null;
  try {
    const chat = await bot.getChat(targetId);
    if (chat) {
      targetName = (chat.first_name + " " + (chat.last_name || "")).trim() || (chat.title || "—");
      targetUsername = chat.username || null;
    }
  } catch {}
  setSession(msg.from.id, { action: "add_member", target_id: targetId, target_name: targetName, target_username: targetUsername });
  bot.sendMessage(msg.chat.id, `Yangi a'zo: *${targetName}*${targetUsername ? "\n🔗 @" + targetUsername : ""}\nTelegram ID: \`${targetId}\`\n\nYoshni kiriting (yoki -):`, { parse_mode: "Markdown" });
});

// ============================================================
// /addresident — add resident
// ============================================================
bot.onText(/^\/addresident$/, async (msg) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  if (!msg.reply_to_message) return bot.sendMessage(msg.chat.id, "Foydalanuvchiga reply qiling va /addresident ni bosing.");
  const target = msg.reply_to_message.from;
  const member = await getMemberByTelegramId(target.id);
  if (!member) return bot.sendMessage(msg.chat.id, "Bu foydalanuvchi avval /add bilan a'zo sifatida qo'shilishi kerak.");
  db.run("UPDATE members SET is_resident = 1 WHERE id = ?", [member.id]);
  bot.sendMessage(msg.chat.id, `✅ ${member.full_name} rezident qilindi.`);
});

// ============================================================
// /backup — manual backup
// ============================================================
bot.onText(/^\/backup$/, async (msg) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  if (!fs.existsSync(DB_PATH)) return bot.sendMessage(msg.chat.id, "DB fayl topilmadi.");
  bot.sendDocument(msg.chat.id, DB_PATH, { caption: `📦 Backup: ${new Date().toLocaleString("uz-UZ")}` });
});

// ============================================================
// /analyze — AI analysis
// ============================================================
bot.onText(/^\/analyze$/, async (msg) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  bot.sendMessage(msg.chat.id, "🔍 Tahlil boshlandi...");
  await bot.sendChatAction(msg.chat.id, "typing");
  db.all("SELECT * FROM chat_logs ORDER BY id DESC LIMIT 500", async (err, rows) => {
    if (err || !rows?.length) return bot.sendMessage(msg.chat.id, "Hozircha tahlil uchun yozuvlar yo'q.");
    const report = await analyzeMessages(rows);
    bot.sendMessage(msg.chat.id, report);
  });
});

// ============================================================
// /broadcast <message> — broadcast to all members
// ============================================================
bot.onText(/^\/broadcast\s+(.+)$/, async (msg, match) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  const text = match[1];
  db.all("SELECT telegram_id FROM members WHERE is_blocked = 0 AND telegram_id IS NOT NULL", async (err, rows) => {
    if (err || !rows?.length) return bot.sendMessage(msg.chat.id, "A'zolar yo'q.");
    let sent = 0;
    for (const r of rows) {
      try { await bot.sendMessage(r.telegram_id, `📢 ${text}`); sent++; } catch {}
    }
    bot.sendMessage(msg.chat.id, `✅ ${sent} ta a'zoga yuborildi.`);
  });
});

// ============================================================
// /search <query> — search members
// ============================================================
bot.onText(/^\/search\s+(.+)$/, async (msg, match) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  const q = match[1];
  db.all("SELECT * FROM members WHERE full_name LIKE ? OR license_number LIKE ? OR phone LIKE ? OR role LIKE ?",
    [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`], (err, rows) => {
      if (err || !rows?.length) return bot.sendMessage(msg.chat.id, "Topilmadi.");
      const list = rows.map((m, i) => `${i + 1}. ${m.full_name} — ${m.role || "—"} | ${m.license_number || "—"} | ID: ${m.telegram_id}`).join("\n");
      bot.sendMessage(msg.chat.id, `🔍 Natija (${rows.length}):\n\n${list}`);
    });
});

// ============================================================
// /block <id> / /unblock <id>
// ============================================================
bot.onText(/^\/block\s+(\d+)$/, async (msg, match) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  const tid = Number(match[1]);
  db.run("UPDATE members SET is_blocked = 1 WHERE telegram_id = ?", [tid], function () {
    bot.sendMessage(msg.chat.id, this.changes ? "🚫 Bloklandi." : "Topilmadi.");
  });
});

bot.onText(/^\/unblock\s+(\d+)$/, async (msg, match) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  const tid = Number(match[1]);
  db.run("UPDATE members SET is_blocked = 0 WHERE telegram_id = ?", [tid], function () {
    bot.sendMessage(msg.chat.id, this.changes ? "✅ Blokdan chiqdi." : "Topilmadi.");
  });
});

// ============================================================
// /makeadmin <id> / /removeadmin <id>
// ============================================================
bot.onText(/^\/makeadmin\s+(\d+)$/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const tid = Number(match[1]);
  db.run("UPDATE members SET is_admin = 1 WHERE telegram_id = ?", [tid], function () {
    bot.sendMessage(msg.chat.id, this.changes ? "✅ Admin qilindi." : "Topilmadi.");
  });
});

bot.onText(/^\/removeadmin\s+(\d+)$/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const tid = Number(match[1]);
  if (tid === ADMIN_ID) return bot.sendMessage(msg.chat.id, "Asosiy admindan adminlikni olib bo'lmaydi.");
  db.run("UPDATE members SET is_admin = 0 WHERE telegram_id = ?", [tid], function () {
    bot.sendMessage(msg.chat.id, this.changes ? "❌ Adminlik olindi." : "Topilmadi.");
  });
});

// ============================================================
// /stats — statistics
// ============================================================
bot.onText(/^\/stats$/, async (msg) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  db.get("SELECT COUNT(*) as total, SUM(is_blocked) as blocked, SUM(is_resident) as residents, SUM(is_admin) as admins FROM members", (err, s) => {
    db.get("SELECT COUNT(*) as tasks, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done FROM tasks", (err2, t) => {
      bot.sendMessage(
        msg.chat.id,
        `📊 *Statistika*\n\n👥 A'zolar: ${s?.total || 0}\n🚫 Bloklangan: ${s?.blocked || 0}\n🏢 Rezidentlar: ${s?.residents || 0}\n🔐 Adminlar: ${s?.admins || 0}\n\n📋 Vazifalar: ${t?.tasks || 0}\n✅ Tugatilgan: ${t?.done || 0}`,
        { parse_mode: "Markdown" }
      );
    });
  });
});

// ============================================================
// /assigntask — assign task to member (reply-based)
// ============================================================
bot.onText(/^\/assigntask$/, async (msg) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  if (!msg.reply_to_message) return bot.sendMessage(msg.chat.id, "Vazifa biriktirish uchun foydalanuvchiga reply qiling va /assigntask ni bosing.\nYoki: /assigntask <telegram_id>");
  const target = msg.reply_to_message.from;
  const member = await getMemberByTelegramId(target.id);
  if (!member) return bot.sendMessage(msg.chat.id, "Bu foydalanuvchi ro'yxatda yo'q. Avval /add qiling.");
  setSession(msg.from.id, { action: "assign_task", member_id: member.id, member_name: member.full_name });
  bot.sendMessage(msg.chat.id, `📋 Vazifa biriktirish: *${member.full_name}*\n\nVazifa sarlavhasini kiriting:`, { parse_mode: "Markdown" });
});

bot.onText(/^\/assigntask\s+(\d+)$/, async (msg, match) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  const tid = Number(match[1]);
  const member = await getMemberByTelegramId(tid);
  if (!member) return bot.sendMessage(msg.chat.id, `❌ ID ${tid} bo'yicha a'zo topilmadi.\nAvval /add <id> bilan qo'shing.`);
  setSession(msg.from.id, { action: "assign_task", member_id: member.id, member_name: member.full_name });
  bot.sendMessage(msg.chat.id, `📋 Vazifa biriktirish: *${member.full_name}* (ID: ${tid})\n\nVazifa sarlavhasini kiriting:`, { parse_mode: "Markdown" });
});

// ============================================================
// /roles — show all roles
// ============================================================
bot.onText(/^\/roles$/, (msg) => {
  const list = ROLES.map((r, i) => `${i + 1}. ${r}`).join("\n");
  bot.sendMessage(msg.chat.id, `🎭 *Mavjud rollar (${ROLES.length}):*\n\n${list}`, { parse_mode: "Markdown" });
});

// ============================================================
// /setrole — set own role (inline)
// ============================================================
bot.onText(/^\/setrole$/, async (msg) => {
  const member = await getMemberByTelegramId(msg.from.id);
  if (!member) return bot.sendMessage(msg.chat.id, "Siz hali ro'yxatga olinmagansiz.");
  bot.sendMessage(msg.chat.id, "🎭 Rolingizni tanlang:", { reply_markup: rolesInline() });
});

// ============================================================
// /setrole <id> — admin sets role for member
// ============================================================
bot.onText(/^\/setrole\s+(\d+)$/, async (msg, match) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  const tid = Number(match[1]);
  setSession(msg.from.id, { action: "set_role_admin", target_id: tid });
  bot.sendMessage(msg.chat.id, "🎭 Rolni tanlang:", { reply_markup: rolesInline() });
});

// ============================================================
// /ai — AI settings
// ============================================================
bot.onText(/^\/ai$/, async (msg) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  const provider = (await getSetting("ai_provider")) || "local";
  const hasKey = await getSetting("ai_api_key");
  bot.sendMessage(
    msg.chat.id,
    `🤖 *AI sozlamalari*\n\nProvider: *${provider}*\nAPI kalit: ${hasKey ? "✅ O'rnatilgan" : "❌ Yo'q"}`,
    { parse_mode: "Markdown", ...aiSettingsInline() }
  );
});

// ============================================================
// /setkey <key> — set AI API key
// ============================================================
bot.onText(/^\/setkey\s+(.+)$/, async (msg, match) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  await setSetting("ai_api_key", match[1].trim());
  bot.sendMessage(msg.chat.id, "✅ API kalit saqlandi.");
});

// ============================================================
// /setprovider <gemini|openai|local>
// ============================================================
bot.onText(/^\/setprovider\s+(\w+)$/, async (msg, match) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  const p = match[1].trim();
  if (!["gemini", "openai", "local"].includes(p)) return bot.sendMessage(msg.chat.id, "Provider: gemini, openai yoki local.");
  await setSetting("ai_provider", p);
  bot.sendMessage(msg.chat.id, `✅ Provider: ${p}`);
});

// ============================================================
// /testai — test AI
// ============================================================
bot.onText(/^\/testai$/, async (msg) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  const result = await testAI();
  bot.sendMessage(msg.chat.id, result);
});

// ============================================================
// /deletemember <id> — delete member (admin)
// ============================================================
bot.onText(/^\/deletemember\s+(\d+)$/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const tid = Number(match[1]);
  db.run("DELETE FROM members WHERE telegram_id = ?", [tid], function () {
    bot.sendMessage(msg.chat.id, this.changes ? "🗑 O'chirildi." : "Topilmadi.");
  });
});

// ============================================================
// /givelicense <id> — give license (admin)
// ============================================================
bot.onText(/^\/givelicense\s+(\d+)$/, async (msg, match) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  const tid = Number(match[1]);
  const lic = genLicenseNumber();
  db.run("UPDATE members SET license_number = ? WHERE telegram_id = ? AND license_number IS NULL", [lic, tid], function () {
    bot.sendMessage(msg.chat.id, this.changes ? `🪪 Litsenziya berildi: ${lic}` : "Topilmadi yoki allaqachon bor.");
  });
});

// ============================================================
// /setabout <text> / /sethistory <text>
// ============================================================
bot.onText(/^\/setabout\s+(.+)$/, async (msg, match) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  db.run("UPDATE team_info SET about = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1", [match[1]]);
  bot.sendMessage(msg.chat.id, "✅ Jamoa haqida yangilandi.");
});

bot.onText(/^\/sethistory\s+(.+)$/, async (msg, match) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  db.run("UPDATE team_info SET history = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1", [match[1]]);
  bot.sendMessage(msg.chat.id, "✅ Tarix yangilandi.");
});

// ============================================================
// /help — full command list
// ============================================================
// ============================================================
// /setphoto — set own profile photo (reply to a photo)
// ============================================================
bot.onText(/^\/setphoto$/, async (msg) => {
  const member = await getMemberByTelegramId(msg.from.id);
  if (!member) return bot.sendMessage(msg.chat.id, "Siz hali ro'yxatga olinmagansiz.");
  if (!msg.reply_to_message || !msg.reply_to_message.photo) {
    return bot.sendMessage(msg.chat.id, "Rasmga reply qiling va /setphoto ni bosing.\nYoki shunchaki rasm yuboring — avtomatik profilingizga biriktiriladi.");
  }
  const fileId = msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1].file_id;
  db.run("UPDATE members SET photo_url = ? WHERE telegram_id = ?", [fileId, msg.from.id], function () {
    bot.sendMessage(msg.chat.id, this.changes ? "✅ Profil rasmi yangilandi." : "❌ Profil topilmadi.");
  });
});

// ============================================================
// /setphoto <id> — admin sets photo for member (reply to photo)
// ============================================================
bot.onText(/^\/setphoto\s+(\d+)$/, async (msg, match) => {
  if (!(await isUserAdmin(msg.from.id))) return;
  if (!msg.reply_to_message || !msg.reply_to_message.photo) return bot.sendMessage(msg.chat.id, "Rasmga reply qiling va /setphoto <id> ni bosing.");
  const tid = Number(match[1]);
  const fileId = msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1].file_id;
  db.run("UPDATE members SET photo_url = ? WHERE telegram_id = ?", [fileId, tid], function () {
    bot.sendMessage(msg.chat.id, this.changes ? "✅ Profil rasmi yangilandi." : "Topilmadi.");
  });
});

// ============================================================
// Photo message handler — auto-set as profile photo
// ============================================================
bot.on("photo", async (msg) => {
  if (msg.chat.type !== "private") return;
  const member = await getMemberByTelegramId(msg.from.id);
  if (!member) return;
  const fileId = msg.photo[msg.photo.length - 1].file_id;
  setSession(msg.from.id, { action: "set_photo_confirm", file_id: fileId });
  bot.sendMessage(msg.chat.id, "📷 Bu rasmni profilingiz rasmi qilasizmi?", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Ha, profil rasmi qilish", callback_data: "confirm_set_photo" },
          { text: "❌ Yo'q", callback_data: "cancel_action" },
        ],
      ],
    },
  });
});

// ============================================================
// Group join approval flow
// ============================================================
bot.on("new_chat_members", async (msg) => {
  const chatId = msg.chat.id;
  for (const newUser of msg.new_chat_members) {
    if (newUser.is_bot) continue;
    const member = await getMemberByTelegramId(newUser.id);
    if (member && !member.is_blocked) {
      bot.sendMessage(chatId, `✅ *${newUser.first_name}* — wentric.uz a'zosi. Xush kelibsiz!`, { parse_mode: "Markdown" });
    } else {
      db.run(
        "INSERT OR IGNORE INTO pending_members (chat_id, telegram_id, full_name, username, joined_at) VALUES (?, ?, ?, ?, ?)",
        [chatId, newUser.id, (newUser.first_name + " " + (newUser.last_name || "")).trim(), newUser.username, new Date().toISOString()]
      );
      const fullName = (newUser.first_name + " " + (newUser.last_name || "")).trim();
      bot.sendMessage(
        chatId,
        `⚠ *Yangi foydalanuvchi!*\n\n👤 ${fullName}\n🆔 \`${newUser.id}\`\n🔗 @${newUser.username || "—"}\n\nBu shaxs wentric.uz ro'yxatida topilmadi. Tasdiqlang:`,
        { parse_mode: "Markdown", reply_markup: approveInline(newUser.id) }
      );
    }
  }
});

// ============================================================
// /help — full command list
// ============================================================
bot.onText(/^\/help$/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `📖 *Buyruqlar ro'yxati*\n\n*Foydalanuvchi:*\n/start — Boshlash\n/profile — Profilim\n/editprofile — Profilni yangilash\n/setphoto — Profil rasmi (reply)\n/dashboard — Dashboard\n/mytasks — Vazifalarim\n/taskstatus <id> — Vazifa holati\n/setrole — Rol tanlash\n/litsenziy <ism> — Kartochka\n/about — Jamoa haqida\n/history — Tarix\n/list — A'zolar\n/who — Kim bu (reply)\n\n*Admin:*\n/admin — Admin panel\n/add — A'zo qo'shish (reply)\n/addresident — Rezident (reply)\n/assigntask — Vazifa (reply)\n/block <id> — Bloklash\n/unblock <id> — Blokdan chiqarish\n/makeadmin <id> — Admin berish\n/removeadmin <id> — Admin olish\n/deletemember <id> — O'chirish\n/givelicense <id> — Litsenziya\n/search <q> — Qidirish\n/stats — Statistika\n/broadcast <text> — Xabar yuborish\n/roles — Rollar\n/setrole <id> — Rol berish\n/ai — AI sozlash\n/setkey <key> — AI kalit\n/setprovider <p> — AI provider\n/testai — AI test\n/analyze — Tahlil\n/backup — Backup\n/setstartimage — Start rasmi (reply)\n/setphoto <id> — A'zo rasmi (reply)\n/setabout <text> — Jamoa haqida\n/sethistory <text> — Tarix\n/help — Yordam`,
    { parse_mode: "Markdown" }
  );
});

// ============================================================
// Text message handler (sessions + chat log)
// ============================================================
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;

  // Log all group messages
  if (msg.chat.type !== "private") {
    const isMira = msg.from?.username === "mira" || msg.from?.first_name?.toLowerCase().includes("mira");
    db.run(
      "INSERT INTO chat_logs (chat_id, user_id, username, full_name, message, is_mira) VALUES (?, ?, ?, ?, ?, ?)",
      [msg.chat.id, msg.from?.id, msg.from?.username, msg.from?.first_name, msg.text, isMira ? 1 : 0]
    );
  }

  // ---- Keyboard button handlers ----
  const text = msg.text.trim();
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  // User menu buttons
  if (text === "👤 Mening profilim") {
    const member = await getMemberByTelegramId(userId);
    if (!member) return bot.sendMessage(chatId, "Siz hali ro'yxatga olinmagansiz.");
    const cardText = textCard(member) + "\n\n/editprofile — yangilash\n/setphoto — profil rasmi";
    if (member.photo_url) {
      bot.sendPhoto(chatId, member.photo_url, { caption: cardText, parse_mode: "Markdown" });
    } else {
      bot.sendMessage(chatId, cardText, { parse_mode: "Markdown" });
    }
    return;
  }

  if (text === "📊 Dashboard") {
    const member = await getMemberByTelegramId(userId);
    if (!member) return bot.sendMessage(chatId, "Siz hali ro'yxatga olinmagansiz.");
    db.all("SELECT * FROM tasks WHERE member_id = ? ORDER BY id DESC", [member.id], (err, tasks) => {
      const pending = (tasks || []).filter((t) => t.status === "pending").length;
      const inProgress = (tasks || []).filter((t) => t.status === "in_progress").length;
      const done = (tasks || []).filter((t) => t.status === "done").length;
      bot.sendMessage(
        chatId,
        `📊 *Dashboard — ${member.full_name}*\n\n🎭 Rol: ${member.role || "—"}\n🪪 Litsenziya: ${member.license_number || "Berilmagan"}\n🏢 Rezident: ${member.is_resident ? "Ha" : "Yo'q"}\n\n📋 *Vazifalar:*\n⏳ Boshlanmagan: ${pending}\n🔄 Jarayonda: ${inProgress}\n✅ Tugatilgan: ${done}\n📋 Jami: ${tasks?.length || 0}`,
        { parse_mode: "Markdown", ...dashboardInline() }
      );
    });
    return;
  }

  if (text === "📋 Mening vazifalarim") {
    const member = await getMemberByTelegramId(userId);
    if (!member) return bot.sendMessage(chatId, "Siz hali ro'yxatga olinmagansiz.");
    db.all("SELECT * FROM tasks WHERE member_id = ? ORDER BY id DESC", [member.id], (err, tasks) => {
      if (err || !tasks?.length) return bot.sendMessage(chatId, "Sizga vazifa biriktirilmagan.");
      const list = tasks.map((t) => taskCard(t, member)).join("\n\n");
      bot.sendMessage(chatId, list + "\n\nStatus o'zgartirish: /taskstatus <id>");
    });
    return;
  }

  if (text === "🏢 Jamoa haqida") {
    db.get("SELECT about FROM team_info WHERE id = 1", (err, row) => {
      bot.sendMessage(chatId, `ℹ️ *Jamoa haqida*\n\n${row?.about || "Ma'lumot yo'q."}`, { parse_mode: "Markdown" });
    });
    return;
  }

  if (text === "📜 Tarix") {
    db.get("SELECT history FROM team_info WHERE id = 1", (err, row) => {
      bot.sendMessage(chatId, `📜 *Jamoa tarixi*\n\n${row?.history || "Ma'lumot yo'q."}`, { parse_mode: "Markdown" });
    });
    return;
  }

  if (text === "🪪 Litsenziya") {
    const member = await getMemberByTelegramId(userId);
    if (!member) return bot.sendMessage(chatId, "Siz hali ro'yxatga olinmagansiz.");
    if (member.photo_url) {
      bot.sendPhoto(chatId, member.photo_url, { caption: textCard(member), parse_mode: "Markdown" });
    } else {
      bot.sendMessage(chatId, textCard(member), { parse_mode: "Markdown" });
    }
    return;
  }

  // ---- Admin panel buttons ----
  if (text === "📊 Statistika") {
    if (!(await isUserAdmin(userId))) return;
    db.get("SELECT COUNT(*) as total, SUM(is_blocked) as blocked, SUM(is_resident) as residents, SUM(is_admin) as admins FROM members", (err, s) => {
      db.get("SELECT COUNT(*) as tasks, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done FROM tasks", (err2, t) => {
        bot.sendMessage(chatId, `📊 *Statistika*\n\n👥 A'zolar: ${s?.total || 0}\n🚫 Bloklangan: ${s?.blocked || 0}\n🏢 Rezidentlar: ${s?.residents || 0}\n🔐 Adminlar: ${s?.admins || 0}\n\n📋 Vazifalar: ${t?.tasks || 0}\n✅ Tugatilgan: ${t?.done || 0}`, { parse_mode: "Markdown" });
      });
    });
    return;
  }

  if (text === "👥 A'zolar ro'yxati") {
    if (!(await isUserAdmin(userId))) return;
    db.all("SELECT * FROM members ORDER BY id", (err, rows) => {
      if (err || !rows?.length) return bot.sendMessage(chatId, "Hozircha a'zolar yo'q.");
      const list = rows.map((m, i) => `${i + 1}. ${m.full_name} — ${m.role || "—"} (${m.license_number || "—"})${m.is_blocked ? " 🚫" : ""}${m.is_admin ? " 🔑" : ""}`).join("\n");
      bot.sendMessage(chatId, `📋 *Jamoa a'zolari (${rows.length}):*\n\n${list}`, { parse_mode: "Markdown" });
    });
    return;
  }

  if (text === "➕ A'zo qo'shish") {
    if (!(await isUserAdmin(userId))) return;
    bot.sendMessage(chatId, "Foydalanuvchiga reply qiling va /add ni bosing.\nYoki: /add <telegram_id>");
    return;
  }

  if (text === "➕ Rezident qo'shish") {
    if (!(await isUserAdmin(userId))) return;
    bot.sendMessage(chatId, "Foydalanuvchiga reply qiling va /addresident ni bosing.");
    return;
  }

  if (text === "🚫 Bloklash") {
    if (!(await isUserAdmin(userId))) return;
    bot.sendMessage(chatId, "Format: /block <telegram_id>");
    return;
  }

  if (text === "✅ Blokdan chiqarish") {
    if (!(await isUserAdmin(userId))) return;
    bot.sendMessage(chatId, "Format: /unblock <telegram_id>");
    return;
  }

  if (text === "🔑 Admin berish") {
    if (!(await isUserAdmin(userId))) return;
    bot.sendMessage(chatId, "Format: /makeadmin <telegram_id>");
    return;
  }

  if (text === "❌ Admin olish") {
    if (!(await isUserAdmin(userId))) return;
    bot.sendMessage(chatId, "Format: /removeadmin <telegram_id>");
    return;
  }

  if (text === "📋 Vazifa biriktirish") {
    if (!(await isUserAdmin(userId))) return;
    setSession(userId, { action: "assign_task_search" });
    bot.sendMessage(chatId, "📋 Vazifa biriktirish\n\nA'zoning ismi yoki Telegram ID'sini kiriting:\n\nMisol: \`Spider-man\` yoki \`8708233476\`", { parse_mode: "Markdown" });
    return;
  }

  if (text === "📋 Vazifalar ro'yxati") {
    if (!(await isUserAdmin(userId))) return;
    db.all("SELECT t.*, m.full_name, m.role FROM tasks t LEFT JOIN members m ON t.member_id = m.id ORDER BY t.id DESC", (err, rows) => {
      if (err || !rows?.length) return bot.sendMessage(chatId, "Vazifalar yo'q.");
      const list = rows.map((t) => taskCard(t, { full_name: t.full_name, role: t.role })).join("\n\n");
      bot.sendMessage(chatId, list);
    });
    return;
  }

  if (text === "🪪 Litsenziya berish") {
    if (!(await isUserAdmin(userId))) return;
    bot.sendMessage(chatId, "Format: /givelicense <telegram_id>");
    return;
  }

  if (text === "🎭 Rollar") {
    if (!(await isUserAdmin(userId))) return;
    const list = ROLES.map((r, i) => `${i + 1}. ${r}`).join("\n");
    bot.sendMessage(chatId, `🎭 *Mavjud rollar (${ROLES.length}):*\n\n${list}`, { parse_mode: "Markdown" });
    return;
  }

  if (text === "🤖 AI sozlash") {
    if (!(await isUserAdmin(userId))) return;
    const provider = (await getSetting("ai_provider")) || "local";
    const hasKey = await getSetting("ai_api_key");
    bot.sendMessage(chatId, `🤖 *AI sozlamalari*\n\nProvider: *${provider}*\nAPI kalit: ${hasKey ? "✅ O'rnatilgan" : "❌ Yo'q"}`, { parse_mode: "Markdown", ...aiSettingsInline() });
    return;
  }

  if (text === "⚙️ Sozlamalar") {
    if (!(await isUserAdmin(userId))) return;
    bot.sendMessage(chatId, "⚙️ *Sozlamalar*\n\n/setabout <matn> — Jamoa haqida\n/sethistory <matn> — Tarix\n/setkey <kalit> — AI API kalit\n/setprovider <gemini|openai|local> — AI provider", { parse_mode: "Markdown" });
    return;
  }

  if (text === "🖼 Start rasmi") {
    if (!(await isUserAdmin(userId))) return;
    const current = await getSetting("start_image");
    bot.sendMessage(
      chatId,
      `🖼 *Start rasmi sozlamasi*\n\nJoriy holat: ${current ? "✅ O'rnatilgan" : "❌ Yo'q"}\n\nRasmni forward qiling va unga reply berib /setstartimage ni bosing.\nYoki /setstartimage <file_id> ko'rinishida kiriting.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (text === "📤 Backup") {
    if (!(await isUserAdmin(userId))) return;
    if (!fs.existsSync(DB_PATH)) return bot.sendMessage(chatId, "DB fayl topilmadi.");
    bot.sendDocument(chatId, DB_PATH, { caption: `📦 Backup: ${new Date().toLocaleString("uz-UZ")}` });
    return;
  }

  if (text === "📢 Xabar yuborish") {
    if (!(await isUserAdmin(userId))) return;
    bot.sendMessage(chatId, "Format: /broadcast <matn>\n\nBarcha faol a'zolarga xabar yuboriladi.");
    return;
  }

  if (text === "🔍 A'zo qidirish") {
    if (!(await isUserAdmin(userId))) return;
    bot.sendMessage(chatId, "Format: /search <ism yoki ID yoki telefon>");
    return;
  }

  if (text === "📈 AI tahlil") {
    if (!(await isUserAdmin(userId))) return;
    bot.sendMessage(chatId, "🔍 Tahlil boshlandi...");
    await bot.sendChatAction(chatId, "typing");
    db.all("SELECT * FROM chat_logs ORDER BY id DESC LIMIT 500", async (err, rows) => {
      if (err || !rows?.length) return bot.sendMessage(chatId, "Hozircha tahlil uchun yozuvlar yo'q.");
      const report = await analyzeMessages(rows);
      bot.sendMessage(chatId, report);
    });
    return;
  }

  if (text === "🏠 Bosh menyu") {
    bot.sendMessage(chatId, "🏠 Bosh menyu", mainMenu());
    return;
  }

  const sess = getSession(msg.from.id);
  if (!sess) return;

  // ---- Edit profile ----
  if (sess.action === "editprofile") {
    const parts = msg.text.split("|").map((s) => s.trim());
    const age = parts[0] && parts[0] !== "-" ? Number(parts[0]) : null;
    const phone = parts[1] && parts[1] !== "-" ? parts[1] : null;
    const bio = parts[2] && parts[2] !== "-" ? parts[2] : null;
    db.run(
      "UPDATE members SET age = ?, phone = ?, bio = ? WHERE telegram_id = ?",
      [age, phone, bio, msg.from.id],
      function () {
        clearSession(msg.from.id);
        bot.sendMessage(msg.chat.id, this.changes ? "✅ Profil yangilandi." : "❌ Xato: profil topilmadi.");
      }
    );
    return;
  }

  // ---- Add member: step 1 = age, step 2 = role ----
  if (sess.action === "add_member") {
    if (!sess.age_set) {
      const age = msg.text === "-" ? null : Number(msg.text);
      setSession(msg.from.id, { age_set: true, age });
      bot.sendMessage(msg.chat.id, "🎭 Rolni tanlang:", { reply_markup: rolesInline() });
      return;
    }
    return;
  }

  // ---- Assign task: search member by name/ID ----
  if (sess.action === "assign_task_search") {
    const q = msg.text.trim();
    const isNumeric = /^\d+$/.test(q);
    const query = isNumeric ? Number(q) : q;
    const member = await getMemberByTelegramId(query);
    if (!member && isNumeric) {
      bot.sendMessage(msg.chat.id, `❌ ID ${q} bo'yicha a'zo topilmadi.`);
      clearSession(msg.from.id);
      return;
    }
    if (!member && !isNumeric) {
      db.all("SELECT * FROM members WHERE full_name LIKE ? ORDER BY id LIMIT 5", [`%${q}%`], (err, rows) => {
        if (err || !rows?.length) {
          bot.sendMessage(msg.chat.id, `❌ "${q}" bo'yicha a'zo topilmadi.`);
          clearSession(msg.from.id);
          return;
        }
        const buttons = rows.map((m) => [{
          text: `${m.full_name} — ${m.role || "—"} (ID: ${m.telegram_id})`,
          callback_data: `task_pick_${m.id}`,
        }]);
        bot.sendMessage(msg.chat.id, "Quyidagi a'zoni tanlang:", { reply_markup: { inline_keyboard: buttons } });
        clearSession(msg.from.id);
      });
      return;
    }
    setSession(msg.from.id, { action: "assign_task", member_id: member.id, member_name: member.full_name });
    bot.sendMessage(msg.chat.id, `📋 Vazifa biriktirish: *${member.full_name}*\n\nVazifa sarlavhasini kiriting:`, { parse_mode: "Markdown" });
    return;
  }

  // ---- Assign task: step 1 = title, step 2 = description, step 3 = deadline ----
  if (sess.action === "assign_task") {
    if (!sess.title) {
      setSession(msg.from.id, { ...sess, title: msg.text });
      return bot.sendMessage(msg.chat.id, "📝 Vazifa tavsifini kiriting (yoki - belgisini yuboring):", { parse_mode: "Markdown" });
    }
    if (!sess.description) {
      setSession(msg.from.id, { ...sess, description: msg.text === "-" ? null : msg.text });
      return bot.sendMessage(msg.chat.id, "📅 Muddatni kiriting (YYYY-MM-DD formatida yoki - belgisi):", { parse_mode: "Markdown" });
    }
    if (!sess.deadline) {
      const deadline = msg.text === "-" ? null : msg.text;
      const taskTitle = sess.title;
      const taskDesc = sess.description;
      const memberId = sess.member_id;
      const memberName = sess.member_name;
      db.run(
        "INSERT INTO tasks (member_id, title, description, deadline, assigned_by) VALUES (?, ?, ?, ?, ?)",
        [memberId, taskTitle, taskDesc, deadline, msg.from.id],
        function () {
          clearSession(msg.from.id);
          bot.sendMessage(msg.chat.id, `✅ *Vazifa biriktirildi*\n\n📌 Sarlavha: ${taskTitle}\n👤 A'zo: ${memberName}${deadline ? "\n📅 Muddat: " + deadline : ""}`, { parse_mode: "Markdown" });
          db.get("SELECT telegram_id FROM members WHERE id = ?", [memberId], (e, m) => {
            if (m?.telegram_id) {
              bot.sendMessage(m.telegram_id, `📋 *Sizga yangi vazifa biriktirildi*\n\n📌 ${taskTitle}\n${taskDesc ? "📝 " + taskDesc + "\n" : ""}${deadline ? "📅 Muddat: " + deadline + "\n" : ""}\n/mytasks — vazifalaringiz`, { parse_mode: "Markdown" });
            }
          });
        }
      );
      return;
    }
  }

  // ---- New role creation ----
  if (sess.action === "new_role") {
    const newRole = msg.text.trim();
    db.run("INSERT OR IGNORE INTO roles (name) VALUES (?)", [newRole], function () {
      clearSession(msg.from.id);
      bot.sendMessage(msg.chat.id, `✅ Yangi rol qo'shildi: ${newRole}`);
    });
    return;
  }

  // ---- AI API key input ----
  if (sess.action === "ai_set_key") {
    await setSetting("ai_api_key", msg.text.trim());
    clearSession(msg.from.id);
    bot.sendMessage(msg.chat.id, "✅ API kalit saqlandi.");
    return;
  }
});

// ============================================================
// Callback query handler
// ============================================================
bot.on("callback_query", async (cq) => {
  const data = cq.data;
  const userId = cq.from.id;
  const chatId = cq.message.chat.id;
  const msgId = cq.message.message_id;

  // ---- Role selection ----
  if (data.startsWith("role_")) {
    if (data === "role_new") {
      setSession(userId, { action: "new_role" });
      return bot.answerCallbackQuery(cq.id, { text: "Yangi rol nomini kiriting:" });
    }
    const idx = Number(data.replace("role_", ""));
    const role = ROLES[idx];
    if (!role) return bot.answerCallbackQuery(cq.id, { text: "Rol topilmadi" });

    const sess = getSession(userId);
    if (sess?.action === "add_member") {
      const fullName = sess.target_name || "Noma'lum";
      db.run(
        "INSERT INTO members (telegram_id, full_name, username, age, role, joined_date, added_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [sess.target_id, fullName, sess.target_username, sess.age, role, new Date().toISOString().slice(0, 10), userId],
        function (err) {
          if (err) {
            bot.sendMessage(chatId, `❌ Xato: ${err.message}`);
          } else {
            bot.sendMessage(chatId, `✅ A'zo qo'shildi: ${fullName}\n🎭 Rol: ${role}\n🪪 Litsenziya: /givelicense ${sess.target_id}`);
          }
          clearSession(userId);
        }
      );
    } else if (sess?.action === "set_role_admin") {
      db.run("UPDATE members SET role = ? WHERE telegram_id = ?", [role, sess.target_id], function () {
        bot.sendMessage(chatId, this.changes ? `✅ Rol berildi: ${role}` : "Topilmadi.");
        clearSession(userId);
      });
    } else {
      // Self role set
      db.run("UPDATE members SET role = ? WHERE telegram_id = ?", [role, userId], function () {
        bot.sendMessage(chatId, this.changes ? `✅ Rolingiz: ${role}` : "Avval ro'yxatga oling.");
        clearSession(userId);
      });
    }
    return bot.answerCallbackQuery(cq.id);
  }

  // ---- Task status ----
  if (data.startsWith("task_status_")) {
    const parts = data.replace("task_status_", "").split("_");
    const taskId = parts[0];
    const status = parts[1];
    const member = await getMemberByTelegramId(userId);
    if (!member) return bot.answerCallbackQuery(cq.id, { text: "Ro'yxatda emassiz" });
    db.run("UPDATE tasks SET status = ? WHERE id = ? AND member_id = ?", [status, taskId, member.id], function () {
      if (this.changes) {
        bot.editMessageText(`✅ Vazifa #${taskId} holati: ${status}`, { chat_id: chatId, message_id: msgId });
        bot.answerCallbackQuery(cq.id, { text: "Yangilandi" });
      } else {
        bot.answerCallbackQuery(cq.id, { text: "Vazifa topilmadi" });
      }
    });
    return;
  }

  // ---- Member actions (admin) ----
  if (data.startsWith("block_") || data.startsWith("unblock_") || data.startsWith("makeadmin_") || data.startsWith("removeadmin_") || data.startsWith("delete_") || data.startsWith("makeresident_") || data.startsWith("givelicense_") || data.startsWith("assigntask_")) {
    if (!(await isUserAdmin(userId))) return bot.answerCallbackQuery(cq.id, { text: "Ruxsat yo'q" });
    const [action, idStr] = data.split("_");
    const memberId = Number(idStr);
    const member = await getMemberById(memberId);
    if (!member) return bot.answerCallbackQuery(cq.id, { text: "Topilmadi" });

    if (action === "block") {
      db.run("UPDATE members SET is_blocked = 1 WHERE id = ?", [memberId]);
      bot.answerCallbackQuery(cq.id, { text: "Bloklandi" });
    } else if (action === "unblock") {
      db.run("UPDATE members SET is_blocked = 0 WHERE id = ?", [memberId]);
      bot.answerCallbackQuery(cq.id, { text: "Blokdan chiqdi" });
    } else if (action === "makeadmin") {
      db.run("UPDATE members SET is_admin = 1 WHERE id = ?", [memberId]);
      bot.answerCallbackQuery(cq.id, { text: "Admin qilindi" });
    } else if (action === "removeadmin") {
      db.run("UPDATE members SET is_admin = 0 WHERE id = ?", [memberId]);
      bot.answerCallbackQuery(cq.id, { text: "Adminlik olindi" });
    } else if (action === "makeresident") {
      db.run("UPDATE members SET is_resident = 1 WHERE id = ?", [memberId]);
      bot.answerCallbackQuery(cq.id, { text: "Rezident qilindi" });
    } else if (action === "givelicense") {
      const lic = genLicenseNumber();
      db.run("UPDATE members SET license_number = ? WHERE id = ? AND license_number IS NULL", [lic, memberId]);
      bot.answerCallbackQuery(cq.id, { text: "Litsenziya: " + lic });
    } else if (action === "assigntask") {
      setSession(userId, { action: "assign_task", member_id: memberId, member_name: member.full_name });
      bot.sendMessage(chatId, `📋 Vazifa biriktirish: *${member.full_name}*\n\nVazifa sarlavhasini kiriting:`, { parse_mode: "Markdown" });
      bot.answerCallbackQuery(cq.id);
    } else if (action === "delete") {
      db.run("DELETE FROM members WHERE id = ?", [memberId]);
      bot.answerCallbackQuery(cq.id, { text: "O'chirildi" });
    }
    return;
  }

  // ---- AI settings ----
  if (data.startsWith("ai_")) {
    if (!(await isUserAdmin(userId))) return bot.answerCallbackQuery(cq.id, { text: "Ruxsat yo'q" });
    if (data === "ai_provider_gemini") {
      await setSetting("ai_provider", "gemini");
      bot.answerCallbackQuery(cq.id, { text: "Gemini tanlandi" });
    } else if (data === "ai_provider_openai") {
      await setSetting("ai_provider", "openai");
      bot.answerCallbackQuery(cq.id, { text: "OpenAI tanlandi" });
    } else if (data === "ai_set_key") {
      setSession(userId, { action: "ai_set_key" });
      bot.sendMessage(chatId, "🔑 API kalitni kiriting:");
      bot.answerCallbackQuery(cq.id);
    } else if (data === "ai_test") {
      const result = await testAI();
      bot.sendMessage(chatId, result);
      bot.answerCallbackQuery(cq.id);
    } else if (data === "ai_analyze") {
      bot.sendMessage(chatId, "🔍 Tahlil boshlandi...");
      db.all("SELECT * FROM chat_logs ORDER BY id DESC LIMIT 500", async (err, rows) => {
        if (err || !rows?.length) return bot.sendMessage(chatId, "Yozuvlar yo'q.");
        const report = await analyzeMessages(rows);
        bot.sendMessage(chatId, report);
      });
      bot.answerCallbackQuery(cq.id);
    }
    return;
  }

  // ---- Dashboard callbacks ----
  if (data.startsWith("dash_")) {
    if (data === "dash_tasks") {
      const member = await getMemberByTelegramId(userId);
      if (!member) return bot.answerCallbackQuery(cq.id, { text: "Ro'yxatda emassiz" });
      db.all("SELECT * FROM tasks WHERE member_id = ? ORDER BY id DESC", [member.id], (err, tasks) => {
        const list = (tasks || []).map((t, i) => `${i + 1}. ${t.title} [${t.status}]`).join("\n") || "Vazifa yo'q";
        bot.sendMessage(chatId, `📋 Vazifalaringiz:\n\n${list}`);
      });
    } else if (data === "dash_profile") {
      const member = await getMemberByTelegramId(userId);
      if (!member) return bot.answerCallbackQuery(cq.id, { text: "Ro'yxatda emassiz" });
      const cardText = textCard(member);
      if (member.photo_url) {
        bot.sendPhoto(chatId, member.photo_url, { caption: cardText, parse_mode: "Markdown" });
      } else {
        bot.sendMessage(chatId, cardText, { parse_mode: "Markdown" });
      }
    } else if (data === "dash_about") {
      db.get("SELECT about FROM team_info WHERE id = 1", (e, row) => {
        bot.sendMessage(chatId, `ℹ️ ${row?.about || "—"}`);
      });
    }
    return bot.answerCallbackQuery(cq.id);
  }

  if (data === "cancel_action") {
    clearSession(userId);
    return bot.answerCallbackQuery(cq.id, { text: "Bekor qilindi" });
  }

  // ---- Pick member for task assignment ----
  if (data.startsWith("task_pick_")) {
    if (!(await isUserAdmin(userId))) return bot.answerCallbackQuery(cq.id, { text: "Faqat admin" });
    const memberId = Number(data.replace("task_pick_", ""));
    const member = await getMemberById(memberId);
    if (!member) return bot.answerCallbackQuery(cq.id, { text: "Topilmadi" });
    setSession(userId, { action: "assign_task", member_id: member.id, member_name: member.full_name });
    bot.answerCallbackQuery(cq.id);
    bot.sendMessage(chatId, `📋 Vazifa biriktirish: *${member.full_name}* (ID: ${member.telegram_id})\n\nVazifa sarlavhasini kiriting:`, { parse_mode: "Markdown" });
    return;
  }

  // ---- Photo confirmation ----
  if (data === "confirm_set_photo") {
    const sess = getSession(userId);
    if (!sess || !sess.file_id) return bot.answerCallbackQuery(cq.id, { text: "Rasm topilmadi" });
    const fileId = sess.file_id;
    db.run("UPDATE members SET photo_url = ? WHERE telegram_id = ?", [fileId, userId], function () {
      if (this.changes) {
        bot.answerCallbackQuery(cq.id, { text: "✅ Profil rasmi saqlandi" });
        bot.sendMessage(chatId, "✅ Profil rasmi yangilandi.");
      } else {
        bot.answerCallbackQuery(cq.id, { text: "Profil topilmadi" });
      }
    });
    clearSession(userId);
    return;
  }

  // ---- Group join approval ----
  if (data.startsWith("approve_")) {
    if (!(await isUserAdmin(userId))) return bot.answerCallbackQuery(cq.id, { text: "Faqat admin" });
    const tid = Number(data.replace("approve_", ""));
    db.run("DELETE FROM pending_members WHERE telegram_id = ?", [tid]);
    bot.answerCallbackQuery(cq.id, { text: "✅ Tasdiqlandi" });
    bot.sendMessage(chatId, `✅ Foydalanuvchi tasdiqlandi. Endi ro'yxatga olish uchun /add ${tid} ni bosing.`);
    return;
  }

  if (data.startsWith("kick_")) {
    if (!(await isUserAdmin(userId))) return bot.answerCallbackQuery(cq.id, { text: "Faqat admin" });
    const tid = Number(data.replace("kick_", ""));
    db.run("DELETE FROM pending_members WHERE telegram_id = ?", [tid]);
    try {
      await bot.kickChatMember(chatId, tid);
      bot.answerCallbackQuery(cq.id, { text: "🚫 Guruhdan chiqarildi" });
      bot.sendMessage(chatId, `🚫 Foydalanuvchi (ID: ${tid}) guruhdan chiqarildi.`);
    } catch (e) {
      bot.answerCallbackQuery(cq.id, { text: "Xato: " + e.message });
    }
    return;
  }
});

// ============================================================
// Daily DB backup to admin
// ============================================================
cron.schedule("59 23 * * *", () => {
  if (!ADMIN_ID) return;
  if (!fs.existsSync(DB_PATH)) return;
  bot.sendDocument(ADMIN_ID, DB_PATH, { caption: `📦 Kunlik avtomatik backup: ${new Date().toLocaleString("uz-UZ")}` });
});

console.log("wentric.uz bot ishga tushdi ✅");
