function fmtDate(d) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (isNaN(date)) return d;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return d; }
}

function pad(str, width) {
  str = String(str || "");
  const len = [...str].length;
  if (len >= width) return str;
  return str + " ".repeat(width - len);
}

function center(str, width) {
  const len = [...str].length;
  if (len >= width) return str;
  const left = Math.floor((width - len) / 2);
  const right = width - len - left;
  return " ".repeat(left) + str + " ".repeat(right);
}

function textCard(member, isUnknown = false) {
  const status = isUnknown
    ? "Tekshirilmagan"
    : member.is_blocked
      ? "Bloklangan"
      : "Faol";
  const access = isUnknown
    ? "Cheklangan"
    : member.is_blocked
      ? "Yo'q"
      : member.is_admin
        ? "To'liq"
        : "Cheklangan";
  const membership = member.is_resident ? "Rezident" : "Standart";
  const name = member.full_name && member.full_name !== "—" ? member.full_name : "Noma'lum";
  const username = member.username ? `@${member.username}` : "—";
  const role = member.role || "Belgilanmagan";
  const license = member.license_number || "Berilmagan";
  const joined = fmtDate(member.joined_date);

  const W = 42;
  const line = "═".repeat(W);
  const padW = W - 4;

  const rows = [
    ["👤 Ism", name],
    ["🔗 Username", username],
    ["🆔 ID raqam", String(member.telegram_id || "—")],
    ["🪪 Litsenziya", license],
    ["💼 Lavozim", role],
    ["🏅 Daraja", membership],
    ["🟢 Holat", status],
    ["🔒 Ruxsat", access],
    ["📅 Qo'shilgan", joined],
    ["⏰ Faollik", "Bugun"],
    ["🌍 Hudud", "O'zbekiston"],
  ];
  if (member.age) rows.push(["🎂 Yosh", String(member.age)]);
  if (member.phone) rows.push(["📞 Telefon", member.phone]);
  if (member.bio) rows.push(["📝 Bio", member.bio]);

  const lines = [];
  lines.push(`╔${line}╗`);
  lines.push(`║${center("🏢 WENTRIC COMPANY", W)}║`);
  lines.push(`║${center("Korporativ ID Karta", W)}║`);
  lines.push(`╠${line}╣`);
  for (const [label, value] of rows) {
    const row = pad(label, padW - [...value].length - 1) + " " + value;
    lines.push(`║  ${pad(row, padW)}  ║`);
  }
  lines.push(`╠${line}╣`);
  lines.push(`║${center("🌐 WENTRIC.UZ • 2026", W)}║`);
  lines.push(`╚${line}╝`);
  lines.push("© 2026 Wentric Company");

  return "```\n" + lines.join("\n") + "\n```";
}

function taskCard(task, member) {
  const statusMap = {
    pending: "⏳ Kutilmoqda",
    in_progress: "🔄 Jarayonda",
    done: "✅ Bajarildi",
    cancelled: "❌ Bekor qilindi",
  };
  const st = statusMap[task.status] || statusMap.pending;

  const rows = [
    `📌 Sarlavha:  ${task.title || "—"}`,
    `👤 Biriktirilgan: ${member?.full_name || "—"}`,
    `📅 Muddat:    ${task.deadline ? fmtDate(task.deadline) : "—"}`,
    `📊 Holat:     ${st}`,
    `🆔 Vazifa ID: #${task.id}`,
  ];

  const W = 42;
  const line = "═".repeat(W);

  const lines = [];
  lines.push(`╔${line}╗`);
  lines.push(`║${center("📋 WENTRIC VAZIFA", W)}║`);
  lines.push(`╠${line}╣`);
  for (const r of rows) {
    lines.push(`║  ${pad(r, W - 4)}  ║`);
  }
  lines.push(`╚${line}╝`);

  return "```\n" + lines.join("\n") + "\n```";
}

module.exports = { textCard, taskCard };
