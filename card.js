const sharp = require("sharp");

function escapeXml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function generateCardSVG(member, isUnknown = false) {
  const initials = (member.full_name || "?").charAt(0).toUpperCase();
  const photoBlock = member.photo_url
    ? `<image href="${escapeXml(member.photo_url)}" x="48" y="48" width="160" height="160" preserveAspectRatio="xMidYMid slice" clip-path="url(#circle)"/>`
    : `<circle cx="128" cy="128" r="80" fill="#1e293b"/><text x="128" y="138" font-size="48" fill="#64748b" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif">${escapeXml(initials)}</text>`;

  const accentColor = isUnknown ? "#f59e0b" : "#3b82f6";
  const accentColor2 = isUnknown ? "#ef4444" : "#06b6d4";
  const statusBadge = isUnknown
    ? `<rect x="240" y="250" width="320" height="40" fill="#7f1d1d" rx="8"/><text x="400" y="276" font-size="16" font-weight="700" fill="#fca5a5" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif">⚠ Noma'lum / Rezident emas</text>`
    : `<rect x="240" y="240" width="320" height="50" fill="#0f172a" rx="10" stroke="#1e3a5f" stroke-width="1"/><text x="400" y="272" font-size="20" font-weight="700" fill="#38bdf8" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif">wentric.uz</text>`;

  return `<svg width="600" height="340" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accentColor}"/>
      <stop offset="100%" stop-color="${accentColor2}"/>
    </linearGradient>
    <clipPath id="circle"><circle cx="128" cy="128" r="80"/></clipPath>
  </defs>

  <rect width="600" height="340" fill="url(#bg)" rx="20"/>
  <rect x="0" y="0" width="600" height="6" fill="url(#accent)"/>

  ${photoBlock}

  <text x="240" y="80" font-size="26" font-weight="700" fill="#f1f5f9" font-family="DejaVu Sans, Arial, sans-serif">${escapeXml(truncate(member.full_name, 28))}</text>
  <text x="240" y="115" font-size="18" fill="${isUnknown ? "#fca5a5" : "#38bdf8"}" font-family="DejaVu Sans, Arial, sans-serif">${escapeXml(truncate(member.role || member.position || "Lavozim belgilanmagan", 30))}</text>
  <text x="240" y="150" font-size="15" fill="#94a3b8" font-family="DejaVu Sans, Arial, sans-serif">🪪 Litsenziya: ${escapeXml(member.license_number || "Berilmagan")}</text>
  <text x="240" y="180" font-size="15" fill="#94a3b8" font-family="DejaVu Sans, Arial, sans-serif">📅 Qo'shilgan: ${escapeXml(member.joined_date || "—")}</text>
  ${member.phone ? `<text x="240" y="210" font-size="15" fill="#94a3b8" font-family="DejaVu Sans, Arial, sans-serif">📞 ${escapeXml(member.phone)}</text>` : ""}

  ${statusBadge}
</svg>`;
}

async function generateCard(member, isUnknown = false) {
  const svg = generateCardSVG(member, isUnknown);
  return await sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { generateCard };
