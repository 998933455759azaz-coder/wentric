const axios = require("axios");
const { getSetting } = require("./db");

async function analyzeMessages(messages) {
  const provider = (await getSetting("ai_provider")) || "local";
  const apiKey = await getSetting("ai_api_key");

  if (!apiKey) return localAnalysis(messages);

  if (provider === "gemini") return await geminiAnalyze(messages, apiKey);
  if (provider === "openai") return await openaiAnalyze(messages, apiKey);
  return localAnalysis(messages);
}

async function geminiAnalyze(messages, apiKey) {
  const sample = messages
    .slice(-100)
    .map((m) => `[${m.created_at}] ${m.is_mira ? "@mira" : m.username || m.full_name}: ${m.message}`)
    .join("\n");

  const prompt = `Quyida wentric.uz guruhidagi yozuvlar va @mira bot javoblari keltirilgan.
Tahlil qil va o'zbek tilida qisqa hisobot ber:
1. Umumiy faollik (nechta xabar, eng faol ishtirokchilar)
2. @mira bot ishlashi sifati
3. Asosiy mavzular
4. Tavsiyalar

Yozuvlar:
${sample}`;

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
      },
      { headers: { "Content-Type": "application/json" }, timeout: 30000 }
    );
    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || localAnalysis(messages);
  } catch (err) {
    console.error("Gemini error:", err.message);
    return `Gemini API xatosi: ${err.message}\n\n${localAnalysis(messages)}`;
  }
}

async function openaiAnalyze(messages, apiKey) {
  const sample = messages
    .slice(-100)
    .map((m) => `[${m.created_at}] ${m.is_mira ? "@mira" : m.username || m.full_name}: ${m.message}`)
    .join("\n");

  const prompt = `Quyida wentric.uz guruhidagi yozuvlar va @mira bot javoblari keltirilgan.
Tahlil qil va o'zbek tilida qisqa hisobot ber:
1. Umumiy faollik
2. @mira bot ishlashi sifati
3. Asosiy mavzular
4. Tavsiyalar

Yozuvlar:
${sample}`;

  try {
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.7,
      },
      { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, timeout: 30000 }
    );
    return res.data.choices[0].message.content;
  } catch (err) {
    console.error("OpenAI error:", err.message);
    return `OpenAI API xatosi: ${err.message}\n\n${localAnalysis(messages)}`;
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
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([u, c]) => `   • ${u}: ${c} ta xabar`).join("\n");
  const topTopics = Object.entries(topics)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([t, c]) => `   • ${t} (${c})`).join("\n");

  return `📊 AI Tahlil Hisoboti (Local)

👥 Umumiy xabarlar: ${messages.length}
🤖 @mira javoblari: ${miraCount}

🏆 Eng faol ishtirokchilar:
${topUsers}

📝 Asosiy mavzular:
${topTopics}

💡 Tavsiya: @mira bot javoblarini kuzatib boring.`;
}

async function testAI() {
  const provider = (await getSetting("ai_provider")) || "local";
  const apiKey = await getSetting("ai_api_key");
  if (!apiKey) return "❌ API kalit o'rnatilmagan. /admin → 🤖 AI sozlash → 🔑 API kalit o'rnatish";

  const testMsg = [{ username: "test", message: "salom", is_mira: 0, created_at: "2024-01-01" }];
  if (provider === "gemini") {
    try {
      await geminiAnalyze(testMsg, apiKey);
      return `✅ Gemini API ishlamoqda (provider: ${provider})`;
    } catch (e) { return `❌ Gemini xatosi: ${e.message}`; }
  }
  if (provider === "openai") {
    try {
      await openaiAnalyze(testMsg, apiKey);
      return `✅ OpenAI API ishlamoqda (provider: ${provider})`;
    } catch (e) { return `❌ OpenAI xatosi: ${e.message}`; }
  }
  return `Provider: ${provider}, kalit: ${apiKey ? "o'rnatilgan" : "yo'q"}`;
}

module.exports = { analyzeMessages, testAI };
