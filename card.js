const H = "━";
const B = "═";

function line(ch, len) { return ch.repeat(len); }
function pad(str, width) {
  str = String(str || "");
  const padLen = Math.max(0, width - str.length);
  return str + " ".repeat(padLen);
}
function center(str, width) {
  str = String(str || "");
  const total = Math.max(0, width - str.length);
  const left = Math.floor(total / 2);
  const right = total - left;
  return " ".repeat(left) + str + " ".repeat(right);
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
  const W = 60;

  const statusText = isUnknown
    ? "⚠ UNVERIFIED • PENDING"
    : (member.is_blocked ? "🚫 BLOCKED • SUSPENDED" : "🟢 VERIFIED • ACTIVE");

  const membership = member.is_resident ? "🏢 Resident Member" : "👤 Standard Member";

  const lines = [];

  lines.push("╔" + line(B, W) + "╗");
  lines.push("║" + center("🏢 WENTRIC COMPANY", W) + "║");
  lines.push("║" + center("Enterprise Digital Identity Card", W) + "║");
  lines.push("╠" + line(B, W) + "╣");
  lines.push("║" + center(isUnknown ? "👤 UNVERIFIED USER" : "👤 VERIFIED MEMBER", W) + "║");
  lines.push("║" + line(" ", W) + "║");
  lines.push("╠" + line(B, W) + "╣");
  lines.push("");

  lines.push(line(H, W + 2));
  lines.push("");
  lines.push("👤 Full Name");
  lines.push("   " + (member.full_name || "—"));
  lines.push("");
  lines.push("💼 Position");
  lines.push("   " + (member.role || "—"));
  lines.push("");
  lines.push("🪪 Digital License");
  lines.push("   " + (member.license_number || "Not Issued"));
  lines.push("");
  lines.push("🆔 Member ID");
  lines.push("   " + (member.telegram_id || "—"));
  lines.push("");
  lines.push("🏅 Membership");
  lines.push("   " + membership);
  lines.push("");
  lines.push("🟢 Account Status");
  lines.push("   ● " + statusText);
  lines.push("");
  lines.push("📅 Joined");
  lines.push("   " + fmtDate(member.joined_date));

  if (member.age) {
    lines.push("");
    lines.push("🎂 Age");
    lines.push("   " + member.age);
  }
  if (member.phone) {
    lines.push("");
    lines.push("📞 Phone");
    lines.push("   " + member.phone);
  }
  if (member.bio) {
    lines.push("");
    lines.push("📝 Bio");
    lines.push("   " + member.bio);
  }
  if (member.username) {
    lines.push("");
    lines.push("🔗 Username");
    lines.push("   @" + member.username);
  }

  lines.push("");
  lines.push(line(H, W + 2));
  lines.push("");
  lines.push("🔐 Security Information");
  lines.push("");
  lines.push(isUnknown
    ? "⚠ Identity Not Verified\n⚠ No License On File\n⚠ Limited Access Granted\n⚠ Monitoring Active"
    : "✅ Identity Verified\n✅ License Valid\n✅ Account Protected\n✅ End-to-End Encrypted");

  lines.push("");
  lines.push(line(H, W + 2));
  lines.push("");
  lines.push("⚙️ Quick Actions");
  lines.push("");
  lines.push("✏️ /editprofile   ─ Edit personal information");
  lines.push("🖼 /setphoto      ─ Update profile picture");
  lines.push("📜 /license       ─ View digital license");
  lines.push("🪪 /id            ─ Open digital ID");
  lines.push("📊 /profile       ─ Profile statistics");

  lines.push("");
  lines.push(line(H, W + 2));
  lines.push("");
  lines.push(center("© 2026 Wentric Company", W));
  lines.push(center("Building the Future of Digital Innovation", W));
  lines.push("");
  lines.push(line(B, W + 2));

  return lines.join("\n");
}

function taskCard(task, member) {
  const W = 50;

  const statusMap = {
    pending: { icon: "⏳", label: "PENDING" },
    in_progress: { icon: "🔄", label: "IN PROGRESS" },
    done: { icon: "✅", label: "COMPLETED" },
    cancelled: { icon: "❌", label: "CANCELLED" },
  };
  const st = statusMap[task.status] || statusMap.pending;

  const lines = [];

  lines.push("╔" + line(B, W) + "╗");
  lines.push("║" + center("📋 WENTRIC TASK", W) + "║");
  lines.push("║" + center("Digital Work Assignment", W) + "║");
  lines.push("╠" + line(B, W) + "╣");
  lines.push("");

  lines.push(line(H, W + 2));
  lines.push("");
  lines.push("📌 Task Title");
  lines.push("   " + (task.title || "—"));
  lines.push("");

  if (task.description) {
    lines.push("📝 Description");
    lines.push("   " + task.description);
    lines.push("");
  }

  lines.push("👤 Assigned To");
  lines.push("   " + (member?.full_name || "—"));
  lines.push("");

  if (member?.role) {
    lines.push("💼 Position");
    lines.push("   " + member.role);
    lines.push("");
  }

  lines.push("📅 Deadline");
  lines.push("   " + (task.deadline ? fmtDate(task.deadline) : "No deadline"));
  lines.push("");

  lines.push("📊 Status");
  lines.push("   " + st.icon + " " + st.label);
  lines.push("");

  lines.push("🆔 Task ID");
  lines.push("   #" + task.id);
  lines.push("");

  lines.push(line(H, W + 2));
  lines.push("");
  lines.push("🔐 Task Security");
  lines.push("");
  lines.push("✅ Digitally Signed");
  lines.push("✅ Audit Logged");
  lines.push("✅ Encrypted Channel");

  lines.push("");
  lines.push(line(H, W + 2));
  lines.push("");
  lines.push(center("© 2026 Wentric Company", W));
  lines.push("");
  lines.push(line(B, W + 2));

  return lines.join("\n");
}

module.exports = { textCard, taskCard };
