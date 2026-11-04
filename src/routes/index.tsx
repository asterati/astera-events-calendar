import { createFileRoute } from "@tanstack/react-router";
import data from "@/data.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Calendário Institucional — Astera" },
      { name: "description", content: "Aulas, workshops, mentorias e eventos da Astera, organizados por mês." },
      { property: "og:title", content: "Calendário Institucional — Astera" },
      { property: "og:description", content: "Aulas, workshops, mentorias e eventos da Astera." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Evento = { id: string; data: string; inicio: string; fim: string; nome: string; tipo: string; link: string | null };

const corVar: Record<string, string> = {
  aula: "var(--tipo-aula)",
  workshop: "var(--tipo-workshop)",
  mentoria: "var(--tipo-mentoria)",
  evento: "var(--tipo-evento)",
};

function Index() {
  const eventos = [...(data.eventos as Evento[])].sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
  const grupos = new Map<string, Evento[]>();
  for (const e of eventos) {
    const k = e.data.slice(0, 7);
    grupos.set(k, [...(grupos.get(k) ?? []), e]);
  }
  const tipoNome = Object.fromEntries(data.tipos.map((t) => [t.id, t.nome]));

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <header className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Astera</p>
        <h1 className="mt-2 font-display text-4xl font-bold text-foreground sm:text-5xl">Calendário institucional</h1>
        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
          {data.tipos.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-3 w-3 rounded-full" style={{ background: corVar[t.id] }} />
              {t.nome}
            </li>
          ))}
        </ul>
      </header>

      <div className="space-y-12">
        {[...grupos].map(([mes, lista]) => {
          const titulo = new Date(mes + "-01T12:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
          return (
            <section key={mes}>
              <h2 className="mb-4 border-b border-border pb-2 font-display text-2xl font-semibold capitalize text-foreground">{titulo}</h2>
              <ul className="space-y-3">
                {lista.map((e) => {
                  const d = new Date(e.data + "T12:00");
                  return (
                    <li
                      key={e.id}
                      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center"
                      style={{ borderLeft: `5px solid ${corVar[e.tipo]}` }}
                    >
                      <div className="w-16 shrink-0 text-center">
                        <div className="font-display text-3xl font-bold leading-none text-foreground">{d.getDate()}</div>
                        <div className="mt-1 text-xs uppercase text-muted-foreground">
                          {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                        </div>
                      </div>
                      <div className="flex-1">
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: corVar[e.tipo] }}>
                          {tipoNome[e.tipo]}
                        </span>
                        <h3 className="text-lg font-semibold text-card-foreground">{e.nome}</h3>
                        <p className="text-sm text-muted-foreground">{e.inicio} – {e.fim}</p>
                      </div>
                      {e.link && (
                        <a
                          href={e.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                        >
                          Entrar na aula
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
