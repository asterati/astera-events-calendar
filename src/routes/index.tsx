import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties } from "react";
import data from "@/data.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Calendário Geral de Iniciativas — ASTERA Academy" },
      { name: "description", content: "Aulas, workshops, mentorias e eventos da Astera, por semana." },
      { property: "og:title", content: "Calendário Geral de Iniciativas — ASTERA" },
      { property: "og:description", content: "Agenda ao vivo da Astera Academy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Tipo = { id: string; nome: string; cor: string };
type Evento = { id: string; data: string; inicio: string; fim: string; nome: string; tipo: string; link: string | null };

const PAL = {
  bg: "#f5efe4", // creme (marca)
  panel: "#fcf9f2", // célula
  we: "#f0e9db", // fim de semana
  ink: "#40352f", // café (marca)
  muted: "#8a7f72",
  faint: "#ab9f90",
  line: "#e4dccd",
  brand: "#b39255", // dourado (marca)
};

const COR_PADRAO = "#7a7f7c";
const WEEKDAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const MESES_ABR = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

// Tinta de contraste (texto sobre a cor do tipo).
function inkFor(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.62 ? "#1a1a1a" : "#ffffff";
}
const tint = (hex: string) => `color-mix(in srgb, ${hex} 14%, #fff)`;

const parse = (d: string) => new Date(d + "T12:00");
const ymd = (dt: Date) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
const addDays = (dt: Date, n: number) => {
  const x = new Date(dt);
  x.setDate(x.getDate() + n);
  x.setHours(12, 0, 0, 0);
  return x;
};
const mondayOf = (dt: Date) => addDays(dt, -((dt.getDay() + 6) % 7));
const fmtDM = (dt: Date) => `${dt.getDate()} ${(MESES_ABR[dt.getMonth()] ?? "").toLowerCase()}`;

function Index() {
  const tipos = data.tipos as Tipo[];
  const corById = useMemo(() => Object.fromEntries(tipos.map((t) => [t.id, t.cor])), [tipos]);
  const nomeById = useMemo(() => Object.fromEntries(tipos.map((t) => [t.id, t.nome])), [tipos]);
  const cor = (tipo: string) => corById[tipo] ?? COR_PADRAO;

  const [view, setView] = useState<"weeks" | "month">("weeks");
  const [anchor, setAnchor] = useState<Date>(() => {
    const t = new Date();
    t.setHours(12, 0, 0, 0);
    return t;
  });
  const [filtro, setFiltro] = useState<Set<string>>(new Set());

  const hojeStr = ymd(new Date());

  // Dias visíveis na grade.
  const { dias, inicio, fim, mesAtivo } = useMemo(() => {
    if (view === "weeks") {
      const start = mondayOf(anchor);
      const dias = Array.from({ length: 28 }, (_, i) => addDays(start, i));
      return { dias, inicio: start, fim: addDays(start, 27), mesAtivo: -1 };
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
    const start = mondayOf(first);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 12);
    const total = Math.ceil((Math.round((+last - +start) / 86400000) + 1) / 7) * 7;
    const dias = Array.from({ length: total }, (_, i) => addDays(start, i));
    return { dias, inicio: start, fim: addDays(start, total - 1), mesAtivo: anchor.getMonth() };
  }, [view, anchor]);

  // Eventos por dia (aplicando o filtro).
  const eventosPorDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    const ativos = filtro.size > 0;
    for (const e of data.eventos as Evento[]) {
      if (ativos && !filtro.has(e.tipo)) continue;
      const arr = m.get(e.data) ?? [];
      arr.push(e);
      m.set(e.data, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.inicio || "").localeCompare(b.inicio || ""));
    return m;
  }, [filtro]);

  const mesLongo = anchor.toLocaleDateString("pt-BR", { month: "long" });
  const periodo =
    view === "weeks"
      ? `${fmtDM(inicio)} – ${fmtDM(fim)} ${fim.getFullYear()}`
      : `${mesLongo.charAt(0).toUpperCase()}${mesLongo.slice(1)} ${anchor.getFullYear()}`;

  const irHoje = () => {
    const t = new Date();
    t.setHours(12, 0, 0, 0);
    setAnchor(t);
  };
  const passo = (dir: number) =>
    setAnchor((a) =>
      view === "weeks" ? addDays(a, 28 * dir) : new Date(a.getFullYear(), a.getMonth() + dir, 1, 12)
    );

  const toggleFiltro = (id: string) =>
    setFiltro((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const segBtn = (active: boolean): CSSProperties => ({
    fontFamily: "var(--font-sans)",
    fontWeight: 500,
    fontSize: 13,
    padding: "8px 16px",
    borderRadius: 8,
    border: 0,
    cursor: "pointer",
    transition: "all .15s",
    color: active ? PAL.ink : PAL.muted,
    background: active ? PAL.ink : "transparent",
    ...(active ? { color: "#fff" } : {}),
  });
  const navBtn: CSSProperties = {
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: 13,
    background: "#fff",
    border: `1px solid ${PAL.line}`,
    borderRadius: 9,
    padding: "8px 12px",
    cursor: "pointer",
    color: PAL.ink,
  };

  function Chip({ e }: { e: Evento }) {
    const c = cor(e.tipo);
    const inner = (
      <>
        {e.inicio && (
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 10,
              lineHeight: 1,
              background: c,
              color: inkFor(c),
              padding: "3px 5px",
              borderRadius: 4,
              whiteSpace: "nowrap",
              alignSelf: "flex-start",
            }}
          >
            {e.inicio}
          </span>
        )}
        <span style={{ fontSize: 11.5, lineHeight: 1.2, color: PAL.ink, fontWeight: 500 }}>{e.nome}</span>
      </>
    );
    const base: CSSProperties = {
      borderLeft: `4px solid ${c}`,
      background: tint(c),
      borderRadius: 7,
      padding: "4px 6px",
      display: "flex",
      flexDirection: "column",
      gap: 2,
      textDecoration: "none",
    };
    const title = `${e.inicio}–${e.fim} · ${e.nome}${e.link ? " · Entrar na aula" : ""}`;
    return e.link ? (
      <a href={e.link} target="_blank" rel="noopener noreferrer" title={title} style={{ ...base, cursor: "pointer" }}>
        {inner}
      </a>
    ) : (
      <div title={title} style={base}>
        {inner}
      </div>
    );
  }

  function Cell({ d }: { d: Date }) {
    const key = ymd(d);
    const evs = eventosPorDia.get(key) ?? [];
    const wknd = d.getDay() === 0 || d.getDay() === 6;
    const fora = view === "month" && d.getMonth() !== mesAtivo;
    const hoje = key === hojeStr;
    const primeiroDoMes = d.getDate() === 1;
    return (
      <div
        style={{
          background: wknd ? PAL.we : PAL.panel,
          border: `1px solid ${hoje ? PAL.brand : PAL.line}`,
          boxShadow: hoje ? `0 0 0 3px rgba(179,146,85,.30)` : undefined,
          borderRadius: 10,
          minHeight: 116,
          padding: "8px 8px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 5,
          opacity: fora ? 0.45 : 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: PAL.ink }}>
            {d.getDate()}
          </span>
          {primeiroDoMes && (
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 9.5,
                textTransform: "uppercase",
                letterSpacing: ".1em",
                color: PAL.brand,
                fontWeight: 700,
                background: PAL.ink,
                padding: "2px 6px",
                borderRadius: 5,
              }}
            >
              {MESES_ABR[d.getMonth()]}
            </span>
          )}
        </div>
        {evs.map((e) => (
          <Chip key={e.id} e={e} />
        ))}
      </div>
    );
  }

  return (
    <main style={{ fontFamily: "var(--font-sans)", color: PAL.ink, maxWidth: 1240, margin: "0 auto", padding: "28px 20px 48px" }}>
      {/* Cabeçalho */}
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="36" height="36" viewBox="0 0 256 256" aria-hidden="true">
            <g fill={PAL.brand} fillRule="evenodd">
              <path transform="matrix(110,0,0,-110,128,128)" d="M.045 .94 .25 .76C.26 .48 .37602 .39559 .64554 .47198L.88008 .33325C.33287 .10816 0 .35 .045 .94Z" />
              <path transform="matrix(33.99187,104.61627,104.61627,-33.99187,128,128)" d="M.045 .94 .25 .76C.26 .48 .37602 .39559 .64554 .47198L.88008 .33325C.33287 .10816 0 .35 .045 .94Z" />
              <path transform="matrix(-88.99187,64.65635,64.65635,88.99187,128,128)" d="M.045 .94 .25 .76C.26 .48 .37602 .39559 .64554 .47198L.88008 .33325C.33287 .10816 0 .35 .045 .94Z" />
              <path transform="matrix(-88.99187,-64.65635,-64.65635,88.99187,128,128)" d="M.045 .94 .25 .76C.26 .48 .37602 .39559 .64554 .47198L.88008 .33325C.33287 .10816 0 .35 .045 .94Z" />
              <path transform="matrix(33.99187,-104.61627,-104.61627,-33.99187,128,128)" d="M.045 .94 .25 .76C.26 .48 .37602 .39559 .64554 .47198L.88008 .33325C.33287 .10816 0 .35 .045 .94Z" />
            </g>
          </svg>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 23, letterSpacing: ".14em", color: PAL.ink }}>ASTERA</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: ".22em", fontSize: 10.5, color: PAL.muted, fontWeight: 600, margin: "0 0 3px" }}>
            Calendário Geral de Iniciativas
          </p>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: ".04em", fontSize: 26, lineHeight: 1, margin: 0, display: "inline-flex", alignItems: "center", gap: 11 }}>
            <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: PAL.brand, boxShadow: "0 0 0 4px rgba(179,146,85,.22)" }} />
            ASTERA Academy
          </h1>
        </div>
      </header>

      {/* Controles */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "inline-flex", background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 10, padding: 3 }}>
          <button style={segBtn(view === "weeks")} onClick={() => setView("weeks")}>Próximas 4 semanas</button>
          <button style={segBtn(view === "month")} onClick={() => setView("month")}>Mês</button>
        </div>
        <div style={{ display: "inline-flex", gap: 6 }}>
          <button style={navBtn} onClick={() => passo(-1)} aria-label="Anterior">‹</button>
          <button style={navBtn} onClick={irHoje}>Hoje</button>
          <button style={navBtn} onClick={() => passo(1)} aria-label="Próximo">›</button>
        </div>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, letterSpacing: ".02em" }}>{periodo}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 240px", gap: 22, alignItems: "start" }} className="cal-layout">
        {/* Calendário */}
        <section>
          {/* Grade (desktop) */}
          <div className="cal-grid-wrap">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 7, marginBottom: 6 }}>
              {WEEKDAYS.map((w) => (
                <span key={w} style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", letterSpacing: ".12em", fontSize: 11, fontWeight: 600, color: PAL.muted, padding: "0 4px 2px" }}>{w}</span>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 7 }}>
              {dias.map((d) => (
                <Cell key={ymd(d)} d={d} />
              ))}
            </div>
          </div>

          {/* Agenda (mobile) */}
          <div className="cal-agenda" style={{ display: "none", flexDirection: "column", gap: 10 }}>
            {dias
              .filter((d) => (eventosPorDia.get(ymd(d)) ?? []).length > 0)
              .map((d) => (
                <div key={ymd(d)}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, padding: "8px 12px", background: PAL.panel, borderRadius: 10, border: `1px solid ${PAL.line}`, textTransform: "capitalize", marginBottom: 6 }}>
                    {d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(".", "")}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {(eventosPorDia.get(ymd(d)) ?? []).map((e) => (
                      <Chip key={e.id} e={e} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </section>

        {/* Legenda / filtro */}
        <aside style={{ position: "sticky", top: 16 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".16em", fontSize: 11, color: PAL.muted, margin: "0 0 2px" }}>Tipos de evento</h2>
          <p style={{ fontSize: 11.5, color: PAL.faint, margin: "0 0 10px" }}>
            {filtro.size > 0 ? (
              <button onClick={() => setFiltro(new Set())} style={{ border: 0, background: "transparent", color: PAL.muted, cursor: "pointer", padding: 0, fontSize: 11.5, textDecoration: "underline" }}>
                Limpar filtro
              </button>
            ) : (
              "Clique para filtrar"
            )}
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {tipos.map((t) => {
              const ativo = filtro.size === 0 || filtro.has(t.id);
              return (
                <li key={t.id}>
                  <button
                    onClick={() => toggleFiltro(t.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      width: "100%",
                      textAlign: "left",
                      border: 0,
                      background: filtro.has(t.id) ? PAL.panel : "transparent",
                      borderRadius: 7,
                      padding: "5px 7px",
                      cursor: "pointer",
                      fontSize: 12.5,
                      color: PAL.ink,
                      opacity: ativo ? 1 : 0.4,
                      transition: "opacity .12s",
                    }}
                  >
                    <span style={{ width: 11, height: 11, borderRadius: "50%", background: t.cor, flexShrink: 0, boxShadow: `inset 0 0 0 1px rgba(0,0,0,.12)` }} />
                    {t.nome}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </main>
  );
}
