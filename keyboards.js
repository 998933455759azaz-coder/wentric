const TelegramBot = require("node-telegram-bot-api");
const { ROLES } = require("./db");

// ---- Asosiy menu ----
function mainMenu() {
  return {
    reply_markup: {
      keyboard: [
        ["👤 Mening profilim", "📊 Dashboard"],
        ["📋 Mening vazifalarim", "🏢 Jamoa haqida"],
        ["📜 Tarix", "🪪 Litsenziya"],
      ],
      resize_keyboard: true,
    },
  };
}

// ---- Admin panel klavaturasi ----
function adminPanel() {
  return {
    reply_markup: {
      keyboard: [
        ["📊 Statistika", "👥 A'zolar ro'yxati"],
        ["➕ A'zo qo'shish", "➕ Rezident qo'shish"],
        ["🚫 Bloklash", "✅ Blokdan chiqarish"],
        ["🔑 Admin berish", "❌ Admin olish"],
        ["📋 Vazifa biriktirish", "📋 Vazifalar ro'yxati"],
        ["🪪 Litsenziya berish", "🎭 Rollar"],
        ["🤖 AI sozlash", "⚙️ Sozlamalar"],
        ["📤 Backup", "📢 Xabar yuborish"],
        ["🔍 A'zo qidirish", "📈 AI tahlil"],
        ["🏠 Bosh menyu"],
      ],
      resize_keyboard: true,
    },
  };
}

// ---- 30 ta rol inline tugmalar ----
function rolesInline(extraRole) {
  const roles = [...ROLES];
  if (extraRole && !roles.includes(extraRole)) roles.push(extraRole);

  const buttons = [];
  for (let i = 0; i < roles.length; i += 2) {
    const row = [];
    for (let j = i; j < Math.min(i + 2, roles.length); j++) {
      row.push({ text: roles[j], callback_data: "role_" + j });
    }
    buttons.push(row);
  }
  buttons.push([{ text: "➕ Yangi rol qo'shish", callback_data: "role_new" }]);
  return { inline_keyboard: buttons };
}

// ---- Vazifa status inline ----
function taskStatusInline(taskId) {
  return {
    inline_keyboard: [
      [
        { text: "⏳ Boshlanmagan", callback_data: "task_status_" + taskId + "_pending" },
        { text: "🔄 Jarayonda", callback_data: "task_status_" + taskId + "_in_progress" },
      ],
      [
        { text: "✅ Tugatildi", callback_data: "task_status_" + taskId + "_done" },
        { text: "❌ Bekor qilindi", callback_data: "task_status_" + taskId + "_cancelled" },
      ],
    ],
  };
}

// ---- A'zo kartochkasi inline (admin) ----
function memberActionInline(memberId) {
  return {
    inline_keyboard: [
      [
        { text: "🚫 Bloklash", callback_data: "block_" + memberId },
        { text: "✅ Blokdan chiqarish", callback_data: "unblock_" + memberId },
      ],
      [
        { text: "🔑 Admin berish", callback_data: "makeadmin_" + memberId },
        { text: "❌ Admin olish", callback_data: "removeadmin_" + memberId },
      ],
      [
        { text: "📋 Vazifa biriktirish", callback_data: "assigntask_" + memberId },
        { text: "🪪 Litsenziya berish", callback_data: "givelicense_" + memberId },
      ],
      [
        { text: "👤 Rezident qilish", callback_data: "makeresident_" + memberId },
        { text: "🗑 O'chirish", callback_data: "delete_" + memberId },
      ],
    ],
  };
}

// ---- Dashboard inline ----
function dashboardInline() {
  return {
    inline_keyboard: [
      [
        { text: "📋 Vazifalarim", callback_data: "dash_tasks" },
        { text: "👤 Profil", callback_data: "dash_profile" },
      ],
      [{ text: "🏢 Jamoa haqida", callback_data: "dash_about" }],
    ],
  };
}

// ---- AI sozlash inline ----
function aiSettingsInline(currentProvider) {
  return {
    inline_keyboard: [
      [
        { text: "🤖 Gemini", callback_data: "ai_provider_gemini" },
        { text: "🧠 OpenAI", callback_data: "ai_provider_openai" },
      ],
      [
        { text: "🔑 API kalit o'rnatish", callback_data: "ai_set_key" },
        { text: "🧪 Test qilish", callback_data: "ai_test" },
      ],
      [{ text: "📊 Tahlil qilish", callback_data: "ai_analyze" }],
    ],
  };
}

// ---- Tasdiqlash inline ----
function confirmInline(action, id) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Ha", callback_data: `confirm_${action}_${id}` },
        { text: "❌ Yo'q", callback_data: "cancel_action" },
      ],
    ],
  };
}

// ---- Group join approval inline ----
function approveInline(telegramId) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Tasdiqlash", callback_data: "approve_" + telegramId },
        { text: "🚫 Chiqarib yuborish", callback_data: "kick_" + telegramId },
      ],
    ],
  };
}

module.exports = {
  mainMenu,
  adminPanel,
  rolesInline,
  taskStatusInline,
  memberActionInline,
  dashboardInline,
  aiSettingsInline,
  confirmInline,
  approveInline,
};
