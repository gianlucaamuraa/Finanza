import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Plus } from "lucide-react";
import { combine, useAccounts, useBase, usePlanned } from "@/hooks";
import { plannedByMonth, plannedInfo, type PlannedStatus } from "@/lib/calc";
import { monthLabel, type Month } from "@/lib/dates";
import { eur, sum } from "@/lib/money";
import type { Account, Planned } from "@/api";
import { IconBox } from "@/components/Icon";
import { SheetTrigger } from "@/components/Sheet";
import { PlannedForm, type AccountOpt } from "@/components/forms";
import { PlannedDetail } from "@/components/PlannedDetail";
import { LoadError, PageSkeleton } from "@/components/ui";

const FILTERS: [string, string][] = [["tutte", "Tutte"], ["active", "In corso"], ["future", "Future"], ["done", "Concluse"]];
const TAG: Record<PlannedStatus, [string, string]> = { active: ["", "In corso"], future: ["future", "Futura"], done: ["done", "Conclusa"] };

export default function SpesePrevedibili() {
  const [sp] = useSearchParams();
  const [showPast, setShowPast] = useState(false);
  const { settings, current } = useBase();
  const qPlanned = usePlanned();
  const qAcc = useAccounts();
  const st = combine(settings, qPlanned, qAcc);
  if (st.error) return <LoadError error={st.error} onRetry={st.retry} />;
  if (st.loading || !current) return <PageSkeleton />;
  const planned = qPlanned.data!;
  const allAccounts = qAcc.data!;
  const accounts = allAccounts.filter((a) => !a.archived);
  const f = sp.get("filtro");
  const filter = FILTERS.some(([k]) => k === f) ? f! : "tutte";

  const items = planned.map((p) => ({ p, i: plannedInfo(p, current) }));
  const active = items.filter((x) => x.i.status === "active");
  const shown = filter === "tutte" ? items : items.filter((x) => x.i.status === filter);
  // ordine: in corso, future, concluse
  const order: Record<PlannedStatus, number> = { active: 0, future: 1, done: 2 };
  shown.sort((a, b) => order[a.i.status] - order[b.i.status]);

  const months = plannedByMonth(items.map((x) => x.i.rows));

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

      {months.length > 0 && <MonthlyCard months={months} current={current} planned={planned} accounts={allAccounts} showPast={showPast} onTogglePast={() => setShowPast(!showPast)} />}

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
          <SheetTrigger key={p.id} className="card" title={p.name} content={<PlannedDetail planned={p} current={current} accounts={accounts} />}>
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

      <SheetTrigger className="fab" title="Nuova spesa prevedibile" ariaLabel="Nuova spesa prevedibile" content={<PlannedForm defaultStart={current} accounts={accounts} />}>
        <Plus size={28} />
      </SheetTrigger>
    </>
  );
}

/** Quanto versare (e quanto è già stato versato) ogni mese per tutte le spese prevedibili insieme. */
function MonthlyCard({ months, current, planned, accounts, showPast, onTogglePast }: {
  months: ReturnType<typeof plannedByMonth>;
  current: Month;
  planned: Planned[];
  accounts: Account[];
  showPast: boolean;
  onTogglePast: () => void;
}) {
  const past = months.filter((m) => m.month < current);
  const shown = showPast ? months : months.filter((m) => m.month >= current);
  return (
    <div className="card">
      <div className="card-title">
        Versamenti mese per mese
        {past.length > 0 && (
          <button type="button" className="link" style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }} onClick={onTogglePast}>
            {showPast ? "Nascondi passati" : `Mostra passati (${past.length})`}
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="empty">Nessun versamento previsto da questo mese in poi.</p>
      ) : (
        <div className="inst-list" style={{ marginBottom: 0 }}>
          {shown.map((m) => {
            const done = m.paidCount === m.count;
            return (
              <div key={m.month} className={`inst${done ? " paid" : ""}${m.month === current ? " now" : ""}`}>
                <SheetTrigger
                  className="inst-row"
                  title={`Versamenti di ${monthLabel(m.month)}`}
                  content={<MonthDetail month={m.month} current={current} planned={planned} accounts={accounts} />}
                >
                  <span className="inst-month">
                    {monthLabel(m.month, false)}
                    <em style={{ color: "var(--muted)", fontWeight: 500 }}>
                      {m.month === current ? "questo mese · " : ""}{m.count} {m.count === 1 ? "spesa" : "spese"}
                    </em>
                  </span>
                  <span className="num inst-amount">{eur(m.amount, 2)}</span>
                  {done ? (
                    <span className="tag">Versato</span>
                  ) : m.paidCount > 0 ? (
                    <span className="tag future num">{eur(m.paid, "auto")} versati</span>
                  ) : (
                    <span className="tag future">Da versare</span>
                  )}
                </SheetTrigger>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Dettaglio di un mese: su quali conti sono state versate le rate e su quali andranno versate. */
function MonthDetail({ month, current, planned, accounts }: { month: Month; current: Month; planned: Planned[]; accounts: AccountOpt[] }) {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const entries = planned.flatMap((p) => {
    const r = plannedInfo(p, current).rows.find(([m]) => m === month)?.[1];
    if (!r) return [];
    const paid = r.paid != null;
    // versata: conto scelto quando è stata segnata; da versare: conto predefinito della spesa
    const accountId = paid ? r.accountId ?? null : r.accountId ?? p.accountId;
    return [{ p, amount: paid ? r.paid! : r.amount, paid, accountId }];
  });

  const group = (paid: boolean) => {
    const g = new Map<number | null, number>();
    for (const e of entries.filter((x) => x.paid === paid)) g.set(e.accountId, (g.get(e.accountId) ?? 0) + e.amount);
    return [...g].sort((a, b) => b[1] - a[1]);
  };
  const paidGroups = group(true), todoGroups = group(false);
  const accName = (id: number | null) => (id != null ? byId.get(id)?.name ?? "Conto eliminato" : "Conto non indicato");
  const missing = entries.some((e) => e.accountId == null);

  const section = (title: string, rows: [number | null, number][]) => (
    <>
      <div className="card-title" style={{ marginTop: 6 }}>
        {title}
        <span className="num">{eur(sum(rows.map(([, v]) => v)), 2)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="empty" style={{ marginBottom: 12 }}>Niente</p>
      ) : (
        <div className="list" style={{ marginBottom: 16 }}>
          {rows.map(([id, v]) => {
            const a = id != null ? byId.get(id) : undefined;
            return (
              <div className="item" key={id ?? "none"} style={{ cursor: "default" }}>
                <IconBox name={a?.icon ?? "wallet"} color={a?.color} small />
                <div className="main"><b>{accName(id)}</b></div>
                <div className="right num">{eur(v, 2)}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <>
      {section("Già versato", paidGroups)}
      {section(month < current ? "Non versato" : "Da versare", todoGroups)}

      <div className="card-title" style={{ marginTop: 6 }}>Spese del mese</div>
      <div className="list">
        {entries.map((e) => (
          <div className="item" key={e.p.id} style={{ cursor: "default" }}>
            <IconBox name={e.p.icon} small />
            <div className="main">
              <b>{e.p.name}</b>
              <small>{e.paid ? "Versata su" : "Da versare su"} {e.accountId == null ? "conto non indicato" : accName(e.accountId)}</small>
            </div>
            <div className="right num">
              {eur(e.amount, 2)}
              <small>{e.paid ? "versata" : "da versare"}</small>
            </div>
          </div>
        ))}
      </div>
      {missing && (
        <p className="note" style={{ marginTop: 12 }}>
          Per indicare il conto: apri la spesa e scegli il conto dei versamenti, oppure sceglilo quando segni la rata come versata.
        </p>
      )}
    </>
  );
}
