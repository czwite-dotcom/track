
import * as cheerio from "cheerio";

// ===== CONFIGURAÇÕES =====
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
// Mundo padrão ajustado para "Solarian" conforme pedido
const WORLD = process.env.WORLD || "Solarian";
const INTERVAL_MS = Number(process.env.INTERVAL_MS || 30000);
// ==========================

if (!DISCORD_WEBHOOK_URL) {
  console.error("❌ ERRO: variável DISCORD_WEBHOOK_URL não definida!");
  process.exit(1);
}

const BASE = "https://rubinot.com.br";
const seen = new Set();

function norm(s = "") { return s.trim().replace(/\s+/g, " "); }
function toInt(s = "") { const n = Number(s.replace(/\D+/g, "")); return Number.isFinite(n) ? n : 0; }

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 RubinotWatcher/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function fetchLatestDeaths(world) {
  const url = `${BASE}/?subtopic=latestdeaths${world ? `&world=${encodeURIComponent(world)}` : ""}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const list = [];
  $("table").first().find("tr").each((i, tr) => {
    if (i === 0) return;
    const tds = $(tr).find("td");
    if (tds.length >= 4) {
      list.push({
        time: norm($(tds[0]).text()),
        character: norm($(tds[1]).text()),
        level: toInt($(tds[2]).text()),
        cause: norm($(tds[3]).text()),
      });
    }
  });
  return list;
}

async function postToDiscord({ character, level, cause, time }) {
  const payload = {
    username: "Rubinot Watcher",
    embeds: [{
      title: `💀 Morte — ${character}`,
      description: `${character} (Lvl ${level}) morreu para **${cause}**`,
      fields: [
        { name: "Quando", value: time, inline: true },
        { name: "Mundo", value: WORLD, inline: true }
      ],
      timestamp: new Date().toISOString()
    }]
  };
  const res = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) console.error("Erro ao enviar pro Discord:", res.status);
}

async function tick() {
  try {
    const deaths = await fetchLatestDeaths(WORLD);
    for (const d of deaths.reverse()) {
      const id = `${WORLD}|${d.time}|${d.character}|${d.level}|${d.cause}`;
      if (seen.has(id)) continue;
      await postToDiscord(d);
      seen.add(id);
    }
  } catch (e) {
    console.error("Erro no tick:", e.message);
  }
}

console.log(`✅ Watcher iniciado. Mundo: ${WORLD} | Intervalo: ${INTERVAL_MS / 1000}s`);
await tick();
setInterval(tick, INTERVAL_MS);
