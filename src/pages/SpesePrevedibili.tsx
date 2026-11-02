import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ChevronRight, Plus } from "lucide-react";
import { combine, useAccounts, useBase, useInvestments, usePlanned } from "@/hooks";
import { plannedInfo, type PlannedStatus } from "@/lib/calc";
import { monthEntries, monthsOverview } from "@/lib/monthly";
import { monthLabel, type Month } from "@/lib/dates";
import { eur, sum } from "@/lib/money";
import type { Account, Investment, Planned } from "@/api";
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
  const qInv = useInvestments();
  const st = combine(settings, qPlanned, qAcc, qInv);
  if (st.error) return <LoadError error={st.error} onRetry={st.retry} />;
  if (st.loading || !current) return <PageSkeleton />;
  const planned = qPlanned.data!;
  const investments = qInv.data!;
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

  // quadro generale: spese prevedibili + versamenti di lungo termine
  const months = monthsOverview(current, planned, investments);
  const now = months.find((m) => m.month === current);

  return (
    <>
      <div className="card hero">
        <div className="label">Da accantonare · {monthLabel(current)}</div>
        <div className="big num">{eur(now?.amount ?? 0, 2)}</div>
        <div className="pills">
          <div className="pill"><span>Prevedibili ({active.length})</span><b className="num">{eur(now?.planned ?? 0, "auto")}</b></div>
          <div className="pill"><span>Lungo termine</span><b className="num">{eur(now?.investment ?? 0, "auto")}</b></div>
          <div className="pill"><span>Versato</span><b className="num">{eur(now?.paid ?? 0, "auto")}</b></div>
        </div>
      </div>

      {months.length > 0 && <MonthlyCard months={months} current={current} planned={planned} investments={investments} accounts={allAccounts} showPast={showPast} onTogglePast={() => setShowPast(!showPast)} />}

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
function MonthlyCard({ months, current, planned, investments, accounts, showPast, onTogglePast }: {
  months: ReturnType<typeof monthsOverview>;
  current: Month;
  planned: Planned[];
  investments: Investment[];
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
                  content={<MonthDetail month={m.month} current={current} planned={planned} investments={investments} accounts={accounts} />}
                >
                  <span className="inst-month">
                    {monthLabel(m.month, false)}
                    <em style={{ color: "var(--muted)", fontWeight: 500 }}>
                      {m.month === current ? "questo mese · " : ""}{m.count} {m.count === 1 ? "voce" : "voci"}
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
                  <ChevronRight size={16} className="muted" aria-hidden />
                </SheetTrigger>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Dettaglio di un mese: dove vanno i soldi (spese prevedibili e lungo termine), quanto, e su quali conti. */
function MonthDetail({ month, current, planned, investments, accounts }: {
  month: Month; current: Month; planned: Planned[]; investments: Investment[]; accounts: AccountOpt[];
}) {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const entries = monthEntries(month, current, planned, investments).map((e) => ({ ...e, amount: e.paid ? e.paidAmount : e.rata }));

  const total = sum(entries.map((e) => e.rata));
  const versato = sum(entries.map((e) => e.paidAmount));
  const accName = (id: number | null) => (id != null ? byId.get(id)?.name ?? "conto eliminato" : null);

  // totali per conto
  const groups = new Map<number | null, { paid: number; todo: number }>();
  for (const e of entries) {
    const g = groups.get(e.accountId) ?? { paid: 0, todo: 0 };
    if (e.paid) g.paid += e.amount;
    else g.todo += e.amount;
    groups.set(e.accountId, g);
  }
  const accRows = [...groups].sort((a, b) => b[1].paid + b[1].todo - (a[1].paid + a[1].todo));
  const missing = entries.some((e) => e.accountId == null);
  const todoLabel = month < current ? "non versato" : "da versare";

  return (
    <>
      <div className="calc" style={{ marginTop: 0 }}>
        <div>
          <span>Totale del mese</span>
          <small>{entries.length} {entries.length === 1 ? "voce" : "voci"} · versato {eur(versato, 2)}</small>
        </div>
        <b className="num">{eur(total, 2)}</b>
      </div>

      <div className="card-title">Dove vanno i soldi</div>
      <div className="list" style={{ marginBottom: 18 }}>
        {entries.map((e) => {
          const acc = accName(e.accountId);
          return (
            <div className="item" key={e.key} style={{ cursor: "default" }}>
              <IconBox name={e.icon} small />
              <div className="main">
                <b>{e.name}</b>
                <small>
                  {[
                    e.kind === "investment" ? "Lungo termine" : null,
                    `${total ? Math.round((e.rata / total) * 100) : 0}%`,
                    acc ? `${e.paid ? "su" : "andrà su"} ${acc}` : null,
                  ].filter(Boolean).join(" · ")}
                </small>
              </div>
              <div className="right num">
                {eur(e.paid ? e.paidAmount : e.rata, 2)}
                <small>{e.paid ? (e.paidAmount !== e.rata ? `versati (rata ${eur(e.rata, "auto")})` : "versata") : todoLabel}</small>
              </div>
            </div>
          );
        })}
      </div>

      {accRows.length > 0 && !(accRows.length === 1 && accRows[0][0] == null) && (
        <>
          <div className="card-title">Per conto</div>
          <div className="list">
            {accRows.map(([id, g]) => {
              const a = id != null ? byId.get(id) : undefined;
              return (
                <div className="item" key={id ?? "none"} style={{ cursor: "default" }}>
                  <IconBox name={a?.icon ?? "wallet"} color={a?.color} small />
                  <div className="main">
                    <b>{id == null ? "Conto non indicato" : accName(id)}</b>
                    <small>
                      {[g.paid ? `versato ${eur(g.paid, "auto")}` : "", g.todo ? `${todoLabel} ${eur(g.todo, "auto")}` : ""].filter(Boolean).join(" · ")}
                    </small>
                  </div>
                  <div className="right num">{eur(g.paid + g.todo, 2)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {missing && (
        <p className="note" style={{ marginTop: 12 }}>
          Per indicare il conto: apri la spesa e scegli il conto dei versamenti, oppure sceglilo quando segni la rata come versata.
        </p>
      )}
    </>
  );
}
