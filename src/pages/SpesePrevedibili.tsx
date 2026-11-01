import { Link, useSearchParams } from "react-router";
import { Plus } from "lucide-react";
import { combine, useBase, usePlanned } from "@/hooks";
import { plannedInfo, type PlannedStatus } from "@/lib/calc";
import { monthLabel } from "@/lib/dates";
import { eur, sum } from "@/lib/money";
import { IconBox } from "@/components/Icon";
import { SheetTrigger } from "@/components/Sheet";
import { PlannedForm } from "@/components/forms";
import { PlannedDetail } from "@/components/PlannedDetail";
import { LoadError, PageSkeleton } from "@/components/ui";

const FILTERS: [string, string][] = [["tutte", "Tutte"], ["active", "In corso"], ["future", "Future"], ["done", "Concluse"]];
const TAG: Record<PlannedStatus, [string, string]> = { active: ["", "In corso"], future: ["future", "Futura"], done: ["done", "Conclusa"] };

export default function SpesePrevedibili() {
  const [sp] = useSearchParams();
  const { settings, current } = useBase();
  const qPlanned = usePlanned();
  const st = combine(settings, qPlanned);
  if (st.error) return <LoadError error={st.error} onRetry={st.retry} />;
  if (st.loading || !current) return <PageSkeleton />;
  const planned = qPlanned.data!;
  const f = sp.get("filtro");
  const filter = FILTERS.some(([k]) => k === f) ? f! : "tutte";

  const items = planned.map((p) => ({ p, i: plannedInfo(p, current) }));
  const active = items.filter((x) => x.i.status === "active");
  const shown = filter === "tutte" ? items : items.filter((x) => x.i.status === filter);
  // ordine: in corso, future, concluse
  const order: Record<PlannedStatus, number> = { active: 0, future: 1, done: 2 };
  shown.sort((a, b) => order[a.i.status] - order[b.i.status]);

  return (
    <>
      <div className="card hero">
        <div className="label">Accantonamento mensile · {monthLabel(current)}</div>
        <div className="big num">{eur(Math.round(sum(active.map((x) => x.i.rata))), 2)}</div>
        <div className="pills">
          <div className="pill"><span>Spese in corso</span><b>{active.length}</b></div>
          <div className="pill"><span>Già versato</span><b className="num">{eur(sum(active.map((x) => x.i.accrued)))}</b></div>
        </div>
      </div>

      <div className="chips">
        {FILTERS.map(([k, l]) => (
          <Link key={k} to={k === "tutte" ? "/spese-prevedibili" : `/spese-prevedibili?filtro=${k}`} className={`chip${filter === k ? " on" : ""}`}>{l}</Link>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="card">
          <p className="empty">{items.length === 0 ? "Nessuna spesa prevedibile. Aggiungi la prima con il pulsante +." : "Nessuna spesa in questa categoria."}</p>
        </div>
      ) : (
        shown.map(({ p, i }) => (
          <SheetTrigger key={p.id} className="card" title={p.name} content={<PlannedDetail planned={p} current={current} />}>
            <span style={{ display: "flex", gap: 12, alignItems: "center", textAlign: "left", width: "100%" }}>
              <IconBox name={p.icon} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 16, display: "block" }}>
                  {p.name} <span className={`tag ${TAG[i.status][0]}`}>{TAG[i.status][1]}</span>
                </b>
                <small className="muted" style={{ fontSize: 12 }}>
                  {monthLabel(p.startMonth, false)} → {monthLabel(p.endMonth, false)} · {i.n} {i.n === 1 ? "rata" : "rate"}
                </small>
              </span>
              <span style={{ textAlign: "right" }}>
                <b className="num" style={{ fontSize: 18, display: "block" }}>{eur(i.rata, 2)}</b>
                <small className="muted" style={{ fontSize: 11 }}>
                  {i.status === "active" ? (i.now ? (i.now.paid != null ? "versata" : "da versare") : "nessuna rata") : "al mese"}
                </small>
              </span>
            </span>
            <span className="progress" style={{ display: "block" }}><i style={{ width: `${i.total ? (i.accrued / i.total) * 100 : 0}%` }} /></span>
            <span className="meta">
              <span className="num">Versato {eur(i.accrued, "auto")} di {eur(i.total, "auto")}</span>
              <span>{p.spent > 0 ? `Speso ${eur(p.spent, "auto")} · ` : ""}{i.paid}/{i.n} rate</span>
            </span>
          </SheetTrigger>
        ))
      )}

      <SheetTrigger className="fab" title="Nuova spesa prevedibile" ariaLabel="Nuova spesa prevedibile" content={<PlannedForm defaultStart={current} />}>
        <Plus size={28} />
      </SheetTrigger>
    </>
  );
}
