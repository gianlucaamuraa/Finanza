import { Link } from "react-router";
import { ChevronRight, CircleAlert, CircleCheck, Pencil } from "lucide-react";
import { combine, useAccounts, useBalances, useBase, useCategories, useInvestments, usePeriod, usePlanned, useSpent } from "@/hooks";
import { investedTotal, sumCells } from "@/lib/view";
import { dailyQuota, plannedInfo } from "@/lib/calc";
import { addDays, addMonths, dayLabel, diffDays, monthLabel } from "@/lib/dates";
import { periodRange } from "@/lib/period";
import { eur, sum } from "@/lib/money";
import { IconBox } from "@/components/Icon";
import { SheetTrigger } from "@/components/Sheet";
import { PaydayForm } from "@/components/forms";
import { LoadError, MonthBars, PageSkeleton } from "@/components/ui";

export default function Dashboard() {
  const { settings, today, payday, current } = useBase();
  // Confronto con il mese precedente allo stesso numero di giorni dallo stipendio
  let prevStart: string | undefined, prevEndClamped: string | undefined;
  if (current && payday) {
    const range = periodRange(current, payday);
    const passed = Math.min(diffDays(range.start, range.nextPayday), Math.max(1, diffDays(range.start, today) + 1));
    const prevRange = periodRange(addMonths(current, -1), payday);
    const prevEnd = addDays(prevRange.start, passed - 1);
    prevStart = prevRange.start;
    prevEndClamped = prevEnd < prevRange.end ? prevEnd : prevRange.end;
  }
  const qPeriod = usePeriod(current, payday);
  const qAccounts = useAccounts();
  const qBalances = useBalances();
  const qPlanned = usePlanned();
  const qInvestments = useInvestments();
  const qCategories = useCategories();
  const qPrev = useSpent(prevStart, prevEndClamped);
  const st = combine(settings, qPeriod, qAccounts, qBalances, qPlanned, qInvestments, qCategories, qPrev);
  if (st.error) return <LoadError error={st.error} onRetry={st.retry} />;
  if (st.loading || !current || !payday) return <PageSkeleton />;
  const period = qPeriod.data!, accounts = qAccounts.data!, balances = qBalances.data!, planned = qPlanned.data!;
  const investments = qInvestments.data!, categories = qCategories.data!, prevSpent = qPrev.data!;

  const accById = new Map(accounts.map((a) => [a.id, a]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const activeAccounts = accounts.filter((a) => !a.archived);

  // Quota giornaliera
  const quotaIds = new Set(accounts.filter((a) => a.includeInQuota).map((a) => a.id));
  const budget = sum(period.allocations.filter((a) => quotaIds.has(a.accountId)).map((a) => a.amount));
  const spentQuota = sum(period.expenses.filter((e) => quotaIds.has(e.accountId)).map((e) => e.amount));
  const q = dailyQuota(period.range, today, budget, spentQuota);
  const underQuota = q.avgSpent <= q.quota;

  // Patrimonio
  const linkedAccIds = new Set(investments.map((i) => i.accountId).filter((x) => x != null));
  const liquidity = sum(accounts.filter((a) => a.kind !== "investimento" && !a.excludeFromNetWorth).map((a) => balances.get(a.id) ?? 0));
  const excluded = accounts.filter((a) => a.excludeFromNetWorth && !a.archived);
  const invested =
    sum(investments.map((i) => investedTotal(i, current))) +
    sum(accounts.filter((a) => a.kind === "investimento" && !linkedAccIds.has(a.id)).map((a) => balances.get(a.id) ?? 0));

  // Entrate e ripartizione
  const income = sum(period.incomes.map((i) => i.amount));
  const allocated = sum(period.allocations.map((a) => a.amount));
  const byAcc = new Map<number, number>();
  for (const a of period.allocations) byAcc.set(a.accountId, (byAcc.get(a.accountId) ?? 0) + a.amount);
  const split = [...byAcc.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const splitBase = Math.max(income, sum(split.map(([, v]) => v)), 1);

  // Spese prevedibili
  const plannedInfos = planned.map((p) => ({ p, i: plannedInfo(p, current) }));
  const toSetAside = sum(plannedInfos.filter((x) => x.i.status === "active").map((x) => x.i.rata));
  const activeCount = plannedInfos.filter((x) => x.i.status === "active").length;
  const upcoming = plannedInfos.filter((x) => x.i.status !== "done").slice(0, 3);

  // Uscite
  const spent = sum(period.expenses.map((e) => e.amount));
  const byCat = new Map<number | null, number>();
  for (const e of period.expenses) byCat.set(e.categoryId, (byCat.get(e.categoryId) ?? 0) + e.amount);
  const topCats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const delta = spent - prevSpent;

  // PAC anno corrente
  const year = Number(current.slice(0, 4));
  const pacCells = investments.length ? sumCells(investments, year, current) : [];
  const pacYear = sum(pacCells.filter((c) => c.kind === "recorded" || c.kind === "linked").map((c) => c.amount));
  const pacPlanned = sum(pacCells.filter((c) => c.kind === "planned").map((c) => c.amount));

  const ticks = Array.from({ length: q.totalDays }, (_, i) =>
    i < q.daysPassed - 1 ? "past" : i === q.daysPassed - 1 ? "today" : "",
  );

  return (
    <div className="dash-grid">
      <div>
        <div className="card">
          <div className="card-title">
            Quota giornaliera
            <SheetTrigger
              className="link"
              title="Stipendio e quota"
              content={<PaydayForm payday={payday} accounts={activeAccounts.map((a) => ({ id: a.id, name: a.name, icon: a.icon, color: a.color, includeInQuota: a.includeInQuota }))} />}
            >
              Stipendio il {payday} <Pencil size={13} />
            </SheetTrigger>
          </div>
          <div className="daily">
            <div style={{ minWidth: 0 }}>
              <div className="big num">
                {eur(Math.max(0, q.quota), 2)} <small>/giorno</small>
              </div>
              <div className="kpi-s num" style={{ marginTop: 6 }}>
                {eur(q.available, 2)} disponibili ÷ {q.daysLeft} {q.daysLeft === 1 ? "giorno" : "giorni"}
              </div>
            </div>
            <div className="days">
              <b className="num">{q.daysLeft}</b>
              <span>{q.daysLeft === 1 ? "giorno allo" : "giorni allo"}<br />stipendio</span>
            </div>
          </div>
          <div className="ticks" aria-hidden>{ticks.map((c, i) => <i key={i} className={c} />)}</div>
          <div className="meta">
            <span>Stipendio {dayLabel(period.range.start)}</span>
            <span>Prossimo {dayLabel(period.range.nextPayday)}</span>
          </div>
          {quotaIds.size === 0 ? (
            <div className="hint"><CircleAlert size={16} />Scegli i conti da considerare toccando “Stipendio il {payday}”.</div>
          ) : budget === 0 ? (
            <div className="hint"><CircleAlert size={16} />Inserisci la ripartizione dello stipendio in Movimenti per calcolare la quota.</div>
          ) : q.available < 0 ? (
            <div className="hint"><CircleAlert size={16} />Hai speso {eur(-q.available, 2)} più di quanto avevi assegnato.</div>
          ) : (
            <div className={`hint${underQuota ? " ok" : ""}`}>
              {underQuota ? <CircleCheck size={16} /> : <CircleAlert size={16} />}
              {underQuota
                ? `Finora spendi in media ${eur(q.avgSpent, 2)}/giorno: sei sotto la quota.`
                : `Finora spendi in media ${eur(q.avgSpent, 2)}/giorno, più della quota.`}
            </div>
          )}
        </div>

        <div className="card hero">
          <div className="label">Patrimonio totale</div>
          <div className="big num">{eur(liquidity + invested)}</div>
          <div className="pills">
            <div className="pill"><span>Liquidità</span><b className="num">{eur(liquidity)}</b></div>
            <div className="pill"><span>Investito</span><b className="num">{eur(invested)}</b></div>
          </div>
          {excluded.length > 0 && (
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 10 }}>
              Escluso: {excluded.map((a) => `${a.name} ${eur(balances.get(a.id) ?? 0, "auto")}`).join(", ")}
            </div>
          )}
        </div>

        <div className="grid2">
          <Link to="/movimenti" className="card">
            <div className="kpi-t">Entrate {monthLabel(current).split(" ")[0].toLowerCase()}</div>
            <div className="kpi-v num pos">{eur(income)}</div>
            <div className="kpi-s">
              {income === 0 ? "non ancora inserite" : allocated >= income ? "ripartite al 100%" : `${eur(income - allocated)} da ripartire`}
            </div>
          </Link>
          <Link to="/spese-prevedibili" className="card">
            <div className="kpi-t">Da accantonare</div>
            <div className="kpi-v num">{eur(Math.round(toSetAside))}</div>
            <div className="kpi-s">{activeCount} {activeCount === 1 ? "spesa prevedibile" : "spese prevedibili"}</div>
          </Link>
        </div>

        <div className="card">
          <div className="card-title">
            Uscite di {monthLabel(current).split(" ")[0].toLowerCase()}
            <Link to="/movimenti?tab=uscite" className="link">Dettagli <ChevronRight size={14} /></Link>
          </div>
          <div className="kpi-v num" style={{ fontSize: 24 }}>{eur(spent, 2)}</div>
          <div className="kpi-s">
            {prevSpent > 0 || spent > 0
              ? `${delta <= 0 ? "↓" : "↑"} ${eur(Math.abs(delta))} rispetto allo stesso punto di ${monthLabel(addMonths(current, -1)).split(" ")[0].toLowerCase()}`
              : "Nessuna uscita registrata"}
          </div>
          {topCats.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {topCats.map(([cid, v]) => {
                const c = cid != null ? catById.get(cid) : undefined;
                return (
                  <div className="catrow" key={String(cid)}>
                    <IconBox name={c?.icon ?? "tag"} small />
                    <div className="mid">
                      {c?.name ?? "Senza categoria"}
                      <div className="progress"><i style={{ width: `${(v / topCats[0][1]) * 100}%` }} /></div>
                    </div>
                    <div className="amt num">{eur(v, 2)}<small>{Math.round((v / spent) * 100)}%</small></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="card">
          <div className="card-title">
            Ripartizione stipendio
            <Link to="/movimenti" className="link">Dettagli <ChevronRight size={14} /></Link>
          </div>
          {split.length === 0 ? (
            <p className="empty">Nessuna ripartizione per questo mese.</p>
          ) : (
            <>
              <div className="stack">
                {split.map(([id, v]) => (
                  <i key={id} style={{ width: `${(v / splitBase) * 100}%`, background: accById.get(id)?.color }} />
                ))}
              </div>
              <div className="legend">
                {split.map(([id, v]) => (
                  <div key={id}>
                    <span className="dot" style={{ background: accById.get(id)?.color }} />
                    {accById.get(id)?.name}
                    <span className="amt num">{eur(v)}</span>
                    <span className="pct num">{Math.round((v / splitBase) * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-title">
            Prossime scadenze
            <Link to="/spese-prevedibili" className="link">Tutte <ChevronRight size={14} /></Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="empty">Nessuna spesa prevedibile in corso.</p>
          ) : (
            <div className="list">
              {upcoming.map(({ p, i }) => (
                <div className="item" key={p.id} style={{ cursor: "default" }}>
                  <IconBox name={p.icon} />
                  <div className="main">
                    <b>{p.name}</b>
                    <small>scade {monthLabel(p.endMonth, false)} · {i.paid}/{i.n} rate</small>
                  </div>
                  <div className="right num">{eur(p.totalAmount)}<small>{eur(i.rata, 2)}/mese</small></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">
            Lungo termine {year}
            <Link to="/lungo-termine" className="link">Apri <ChevronRight size={14} /></Link>
          </div>
          {investments.length === 0 ? (
            <p className="empty">Nessun PAC impostato.</p>
          ) : (
            <>
              <MonthBars cells={pacCells} />
              <div className="meta">
                <span>Versato: <b className="num">{eur(pacYear)}</b></span>
                {pacPlanned > 0 && <span>Pianificato entro dicembre: {eur(pacPlanned)}</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
