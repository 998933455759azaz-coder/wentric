function fmtDate(d) {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (isNaN(date)) return d;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return d; }
}

function esc(str) {
  return String(str || "").replace(/[*_`\[\]]/g, "");
}

function textCard(member, isUnknown = false) {
  const status = isUnknown
    ? "⚠️ UNVERIFIED"
    : member.is_blocked
      ? "🚫 BLOCKED"
      : "🟢 ACTIVE";
  const membership = member.is_resident ? "🏢 Resident" : "👤 Standard";
  const name = member.full_name && member.full_name !== "—" ? member.full_name : "Unknown";
  const username = member.username ? ` *@${esc(member.username)}*` : "";

  const rows = [
    `👤 *Name:* ${esc(name)}${username}`,
    `💼 *Role:* ${esc(member.role) || "—"}`,
    `🪪 *License:* ${esc(member.license_number) || "Not Issued"}`,
    `🆔 *ID:* \`${esc(member.telegram_id) || "—"}\``,
    `🏅 *Type:* ${membership}`,
    `🟢 *Status:* ${status}`,
    `📅 *Joined:* ${fmtDate(member.joined_date)}`,
  ];
  if (member.age) rows.push(`🎂 *Age:* ${esc(member.age)}`);
  if (member.phone) rows.push(`📞 *Phone:* ${esc(member.phone)}`);
  if (member.bio) rows.push(`📝 *Bio:* ${esc(member.bio)}`);

  return (
    "┌──────────────────────────────┐\n" +
    "│  🏢 *WENTRIC COMPANY*        │\n" +
    "│  *Digital Identity Card*     │\n" +
    "└──────────────────────────────┘\n\n" +
    rows.join("\n") +
    "\n\n© 2026 Wentric Company"
  );
}

function taskCard(task, member) {
  const statusMap = {
    pending: "⏳ Pending",
    in_progress: "🔄 In Progress",
    done: "✅ Completed",
    cancelled: "❌ Cancelled",
  };
  const st = statusMap[task.status] || statusMap.pending;

  const rows = [
    `📌 *Title:* ${esc(task.title) || "—"}`,
    `👤 *Assigned:* ${esc(member?.full_name) || "—"}`,
    `📅 *Deadline:* ${task.deadline ? fmtDate(task.deadline) : "—"}`,
    `📊 *Status:* ${st}`,
    `🆔 *Task ID:* #${esc(task.id)}`,
  ];

  return (
    "┌──────────────────────────────┐\n" +
    "│  📋 *WENTRIC TASK*            │\n" +
    "└──────────────────────────────┘\n\n" +
    rows.join("\n")
  );
}

module.exports = { textCard, taskCard };
