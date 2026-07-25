const axios = require("axios");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

async function analyzeMessages(messages) {
  if (!OPENAI_API_KEY) {
    return localAnalysis(messages);
  }

  const sample = messages
    .slice(-100)
    .map((m) => `[${m.created_at}] ${m.is_mira ? "@mira" : m.username || m.full_name}: ${m.message}`)
    .join("\n");

  const prompt = `Quyida wentric.uz guruhidagi yozuvlar va @mira bot javoblari keltirilgan.
Tahlil qil va o'zbek tilida qisqa hisobot ber:
1. Umumiy faollik (nechta xabar, eng faol ishtirokchilar)
2. @mira bot ishlashi sifati (javoblar tegishlimi, foydalimi)
3. Asosiy mavzular
4. Tavsiyalar

Yozuvlar:
${sample}`;

  try {
    const res = await axios.post(
      OPENAI_API_URL,
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );
    return res.data.choices[0].message.content;
  } catch (err) {
    console.error("AI analyze error:", err.message);
    return localAnalysis(messages);
  }
}

function localAnalysis(messages) {
  if (!messages.length) return "Hozircha tahlil qilish uchun ma'lumot yo'q.";

  const userCount = {};
  let miraCount = 0;
  const topics = {};

  for (const m of messages) {
    const key = m.is_mira ? "@mira" : m.username || m.full_name || "Noma'lum";
    userCount[key] = (userCount[key] || 0) + 1;
    if (m.is_mira) miraCount++;

    const words = (m.message || "").toLowerCase().match(/\p{L}+/gu) || [];
    for (const w of words) {
      if (w.length > 3) topics[w] = (topics[w] || 0) + 1;
    }
  }

  const topUsers = Object.entries(userCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([u, c]) => `   • ${u}: ${c} ta xabar`)
    .join("\n");

  const topTopics = Object.entries(topics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t, c]) => `   • ${t} (${c})`)
    .join("\n");

  return `📊 AI Tahlil Hisoboti

👥 Umumiy xabarlar: ${messages.length}
🤖 @mira javoblari: ${miraCount}

🏆 Eng faol ishtirokchilar:
${topUsers}

📝 Asosiy mavzular:
${topTopics}

💡 Tavsiya: @mira bot javoblarini ko'proq kuzatib boring, foydalanuvchilar savollariga aniqroq javob berishni sozlang.`;
}

module.exports = { analyzeMessages };
