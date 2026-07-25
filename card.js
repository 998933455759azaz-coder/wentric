function textCard(member, isUnknown = false) {
  const status = isUnknown
    ? "⚠ Noma'lum / Rezident emas"
    : (member.is_blocked ? "🚫 Bloklangan" : "✅ Faol");
  const resident = member.is_resident ? "🏢 Rezident" : "👤 A'zo";

  const lines = [
    "═══════════════════════════",
    "   🪪 WENTRIC.UZ KARTOCHKA",
    "═══════════════════════════",
    "",
    `👤 Ism: ${member.full_name || "Noma'lum"}`,
    `🎭 Rol: ${member.role || "Lavozim belgilanmagan"}`,
    `🪪 Litsenziya: ${member.license_number || "Berilmagan"}`,
    `📅 Qo'shilgan: ${member.joined_date || "—"}`,
  ];

  if (member.phone) lines.push(`📞 Telefon: ${member.phone}`);
  if (member.age) lines.push(`🎂 Yosh: ${member.age}`);
  if (member.bio) lines.push(`📝 Bio: ${member.bio}`);
  if (member.username) lines.push(`🔗 Username: @${member.username}`);

  lines.push("");
  lines.push(`${resident} | ${status}`);
  lines.push(`🆔 ID: ${member.telegram_id || "—"}`);
  lines.push("═══════════════════════════");

  return lines.join("\n");
}

module.exports = { textCard };
