// sync-zoom.mjs — gera src/data.json a partir das reuniões recorrentes do Zoom
// (Server-to-Server OAuth) + um seed histórico (eventos-historico.json).
// Requer Node 18+ (fetch nativo). Variáveis de ambiente:
//   ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET  -> credenciais do app
//   ZOOM_HOST (opcional)  -> e-mail do host (default: suporte@asteraplanejamento.com.br)
//   TZ_DISPLAY (opcional) -> fuso de exibição (default: America/Sao_Paulo)

import { writeFileSync, readFileSync, existsSync, appendFileSync } from "node:fs";

const ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID;
const CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;
const HOST = process.env.ZOOM_HOST || "suporte@asteraplanejamento.com.br";
const TZ = process.env.TZ_DISPLAY || "America/Sao_Paulo";
const JANELA_DIAS = Number(process.env.JANELA_DIAS || 90); // só ocorrências dos próximos N dias

if (!ACCOUNT_ID || !CLIENT_ID || !CLIENT_SECRET) {
  console.error("Faltam variáveis: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET.");
  process.exit(1);
}

// ===== Taxonomia (tipos + cores). Fonte da verdade do projeto. =====
const TIPOS = [
  { id: "lab", nome: "Astera LAB – Case de Clientes", cor: "#f5e900" },
  { id: "lck", nome: "LCK LAB", cor: "#c92a2a" },
  { id: "up", nome: "Astera UP – Clube do Livro", cor: "#2d6cdf" },
  { id: "flow", nome: "Astera FLOW – Educação Continuada", cor: "#e5407a" },
  { id: "seguros", nome: "Call SEGUROS", cor: "#5c6360" },
  { id: "marketing", nome: "Oficina de Marketing", cor: "#e8821e" },
  { id: "kosmo", nome: "APP Kosmo", cor: "#7a3ff2" },
  { id: "mentoria", nome: "Mentoria RPF (Rota do Planejador)", cor: "#b08900" },
  { id: "imersao", nome: "Imersão RPF", cor: "#c9962b" },
  { id: "clinica", nome: "Encontro/Clínica (Roda do Planejador)", cor: "#9b2d5b" },
  { id: "mesa", nome: "Mesa Redonda", cor: "#c75b12" },
  { id: "acel", nome: "Aceleradora", cor: "#15938c" },
  { id: "updates", nome: "Update de Investimentos", cor: "#0f8bbf" },
  { id: "feriado", nome: "Feriado", cor: "#c2c6c3" },
  { id: "aviso", nome: "Avisos", cor: "#9aa0a6" },
  { id: "outros", nome: "Outros", cor: "#7a7f7c" },
];

// Mapeia o título (topic) da reunião do Zoom -> id do tipo.
// A ordem importa: regras mais específicas primeiro.
function mapTipo(topic) {
  const t = (topic || "").toLowerCase();
  if (/update|investimento/.test(t)) return "updates";
  if (/kosmo/.test(t)) return "kosmo";
  if (/seguro/.test(t)) return "seguros";
  if (/marketing|oficina/.test(t)) return "marketing";
  if (/cl[ií]nica|roda do planejador|encontro/.test(t)) return "clinica";
  if (/mentoria|rota do planejador|\brpf\b/.test(t)) return "mentoria";
  if (/imers/.test(t)) return "imersao";
  if (/mesa/.test(t)) return "mesa";
  if (/acel/.test(t)) return "acel";
  if (/lck/.test(t)) return "lck"; // antes de "lab": "LCK LAB" contém as duas palavras
  if (/lab/.test(t)) return "lab";
  if (/clube do livro|astera up|\bup\b/.test(t)) return "up";
  if (/flow|educa/.test(t)) return "flow";
  return "outros";
}

// Links das salas ao vivo no Atlas, por iniciativa (o botão aponta pro Atlas).
const links = JSON.parse(readFileSync(new URL("./links.json", import.meta.url), "utf8"));
const linkFor = (tipo) => (links.recorrentes && links.recorrentes[tipo]) || null;

async function getToken() {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ACCOUNT_ID}`,
    { method: "POST", headers: { Authorization: `Basic ${basic}` } }
  );
  if (!res.ok) throw new Error(`OAuth ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function api(path, token) {
  const res = await fetch(`https://api.zoom.us/v2${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Zoom ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// Formata um instante (ISO, normalmente UTC) no fuso de exibição.
function fmt(iso, tz) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (type) => parts.find((p) => p.type === type).value;
  return { data: `${g("year")}-${g("month")}-${g("day")}`, hora: `${g("hour")}:${g("minute")}` };
}
const addMin = (iso, min) => new Date(new Date(iso).getTime() + (min || 0) * 60000).toISOString();

async function listMeetings(token) {
  let meetings = [], next = "";
  do {
    const data = await api(
      `/users/${encodeURIComponent(HOST)}/meetings?type=upcoming&page_size=300${next ? `&next_page_token=${next}` : ""}`,
      token
    );
    meetings = meetings.concat(data.meetings || []);
    next = data.next_page_token || "";
  } while (next);
  return meetings;
}

function pushEvent(out, { id, topic, startIso, duration }) {
  const tipo = mapTipo(topic);
  const { data, hora } = fmt(startIso, TZ);
  const { hora: fim } = fmt(addMin(startIso, duration || 60), TZ);
  out.push({ id, data, inicio: hora, fim, nome: topic || "(sem título)", tipo, link: linkFor(tipo) });
}

async function build() {
  const token = await getToken();
  const meetings = await listMeetings(token);
  // A listagem (type=upcoming) repete a mesma reunião recorrente uma vez por
  // ocorrência; deduplica por id antes de expandir as ocorrências (evita N²).
  const unicas = [...new Map(meetings.map((m) => [m.id, m])).values()];
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()); // YYYY-MM-DD
  const limite = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(
    new Date(Date.now() + JANELA_DIAS * 86400000)
  );
  const dentroDaJanela = (iso) => {
    const d = fmt(iso, TZ).data;
    return d >= hoje && d <= limite;
  };
  const out = [];

  for (const m of unicas) {
    // Recorrentes (type 3 = sem horário fixo, 8 = com horário fixo): buscar ocorrências.
    if (m.type === 3 || m.type === 8) {
      try {
        const detail = await api(`/meetings/${m.id}`, token);
        for (const o of detail.occurrences || []) {
          if (o.status === "deleted" || !o.start_time || !dentroDaJanela(o.start_time)) continue;
          pushEvent(out, {
            id: `z-${m.id}-${o.occurrence_id}`,
            topic: m.topic,
            startIso: o.start_time,
            duration: o.duration || m.duration,
          });
        }
      } catch (e) {
        console.warn(`Falha ao detalhar reunião ${m.id}: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 200)); // respeita rate limit
    } else if (m.start_time && dentroDaJanela(m.start_time)) {
      pushEvent(out, { id: `z-${m.id}`, topic: m.topic, startIso: m.start_time, duration: m.duration });
    }
  }

  // Seed histórico (eventos passados, registrados uma vez).
  let historico = [];
  if (existsSync("eventos-historico.json")) {
    try {
      historico = JSON.parse(readFileSync("eventos-historico.json", "utf8")).eventos || [];
    } catch (e) {
      console.warn(`Falha ao ler eventos-historico.json: ${e.message}`);
    }
  }

  // Remove duplicatas por id (a mesma ocorrência pode aparecer mais de uma vez).
  const unicos = [...new Map(out.map((e) => [e.id, e])).values()];
  // Mantém só as iniciativas conhecidas (descarta reuniões avulsas/não mapeadas da conta).
  const eventosZoom = unicos.filter((e) => e.tipo !== "outros");
  const descartados = [...new Set(unicos.filter((e) => e.tipo === "outros").map((e) => e.nome))];

  const eventos = [...historico, ...eventosZoom].sort((a, b) =>
    (a.data + (a.inicio || "")).localeCompare(b.data + (b.inicio || ""))
  );

  writeFileSync("src/data.json", JSON.stringify({ tipos: TIPOS, eventos }, null, 2) + "\n");
  console.log(
    `OK: ${eventosZoom.length} eventos de iniciativas (janela de ${JANELA_DIAS} dias) + ${historico.length} do histórico -> src/data.json`
  );
  console.log(`Ocorrências únicas no período: ${unicos.length}; descartadas (não mapeadas): ${unicos.length - eventosZoom.length}`);
  if (descartados.length) console.log(`Títulos descartados (${descartados.length}): ${descartados.slice(0, 50).join(" | ")}`);

  // Resumo na página do run (Summary), para revisão fácil do que foi descartado.
  if (process.env.GITHUB_STEP_SUMMARY) {
    const porTipo = {};
    for (const e of eventosZoom) porTipo[e.tipo] = (porTipo[e.tipo] || 0) + 1;
    const resumo = [
      "### Sync do Zoom",
      "",
      `- Eventos de iniciativas: **${eventosZoom.length}** (janela de ${JANELA_DIAS} dias)`,
      `- Ocorrências únicas no período: ${unicos.length} · descartadas (não mapeadas): ${unicos.length - eventosZoom.length}`,
      `- Por tipo: ${Object.entries(porTipo).map(([k, v]) => `${k}=${v}`).join(", ")}`,
      "",
      `**Títulos descartados (${descartados.length}):**`,
      ...descartados.map((t) => `- ${t}`),
    ].join("\n");
    try {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, resumo + "\n");
    } catch (e) {
      console.warn(`Falha ao escrever o resumo: ${e.message}`);
    }
  }
}

build().catch((e) => {
  console.error("Falha ao sincronizar:", e.message);
  process.exit(1);
});
