const B = "═";

function line(ch, len) { return ch.repeat(len); }
function center(str, width) {
  str = String(str || "");
  const total = Math.max(0, width - str.length);
  const left = Math.floor(total / 2);
  return " ".repeat(left) + str + " ".repeat(total - left);
}
function fmtDate(d) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (isNaN(date)) return d;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return d; }
}

function textCard(member, isUnknown = false) {
  const W = 44;
  const status = isUnknown ? "⚠ UNVERIFIED" : (member.is_blocked ? "🚫 BLOCKED" : "🟢 ACTIVE");
  const membership = member.is_resident ? "🏢 Resident" : "👤 Standard";
  const name = member.full_name || "—";
  const username = member.username ? " @" + member.username : "";

  const rows = [
    ["👤 Name", name + username],
    ["💼 Role", member.role || "—"],
    ["🪪 License", member.license_number || "Not Issued"],
    ["🆔 ID", String(member.telegram_id || "—")],
    ["🏅 Type", membership],
    ["🟢 Status", status],
    ["📅 Joined", fmtDate(member.joined_date)],
  ];
  if (member.age) rows.push(["🎂 Age", String(member.age)]);

  const out = [];
  out.push("╔" + line(B, W) + "╗");
  out.push("║" + center("🏢 WENTRIC COMPANY", W) + "║");
  out.push("║" + center("Digital Identity Card", W) + "║");
  out.push("╠" + line(B, W) + "╣");
  for (const [label, val] of rows) {
    out.push("║ " + label.padEnd(13) + " " + String(val).slice(0, W - 16) + " ║");
  }
  out.push("╚" + line(B, W) + "╝");
  out.push(center("© 2026 Wentric Company", W));
  return out.join("\n");
}

function taskCard(task, member) {
  const W = 44;
  const statusMap = {
    pending: "⏳ Pending",
    in_progress: "🔄 In Progress",
    done: "✅ Completed",
    cancelled: "❌ Cancelled",
  };
  const st = statusMap[task.status] || statusMap.pending;

  const rows = [
    ["📌 Title", task.title || "—"],
    ["👤 Assigned", member?.full_name || "—"],
    ["📅 Deadline", task.deadline ? fmtDate(task.deadline) : "—"],
    ["📊 Status", st],
    ["🆔 Task ID", "#" + task.id],
  ];

  const out = [];
  out.push("╔" + line(B, W) + "╗");
  out.push("║" + center("📋 WENTRIC TASK", W) + "║");
  out.push("╠" + line(B, W) + "╣");
  for (const [label, val] of rows) {
    out.push("║ " + label.padEnd(13) + " " + String(val).slice(0, W - 16) + " ║");
  }
  out.push("╚" + line(B, W) + "╝");
  return out.join("\n");
}

module.exports = { textCard, taskCard };
