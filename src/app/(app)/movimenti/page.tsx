import Link from "next/link";
import { Suspense } from "react";
import { Briefcase, ChevronRight, CircleCheck, Plus } from "lucide-react";
import { getAccounts, getBalances, getCategories, getPeriod, getPlanned, getSpentInRange } from "@/lib/data";
import { base, clampDay } from "@/lib/view";
import { addDays, addMonths, dayLabel, dayLabelLong, diffDays, isMonth, type Month } from "@/lib/dates";
import { periodRange } from "@/lib/period";
import { plannedInfo } from "@/lib/calc";
import { eur, sum } from "@/lib/money";
import { IconBox } from "@/components/Icon";
import { SheetTrigger } from "@/components/Sheet";
import { AllocationForm, ExpenseForm, IncomeForm } from "@/components/forms";
import { MonthNav, PageSkeleton, pctClass } from "@/components/ui";
import { CopyPreviousButton } from "./CopyPreviousButton";

type SP = Promise<{ mese?: string; tab?: string; conto?: string }>;

export default function MovimentiPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Movimenti searchParams={searchParams} />
    </Suspense>
  );
}

function href(m: Month, tab: string, conto?: number | null) {
  const p = new URLSearchParams({ mese: m });
  if (tab === "uscite") p.set("tab", "uscite");
  if (conto) p.set("conto", String(conto));
  return `/movimenti?${p}`;
}

async function Movimenti({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { payday, today, current } = await base();
  const period = isMonth(sp.mese) ? sp.mese : current;
  const tab = sp.tab === "uscite" ? "uscite" : "stipendio";

  const [data, accounts, categories, planned] = await Promise.all([
    getPeriod(period, payday),
    getAccounts(true),
    getCategories(true),
    getPlanned(),
  ]);
  const active = accounts.filter((a) => !a.archived);
  const accById = new Map(accounts.map((a) => [a.id, a]));
  const opts = active.map((a) => ({ id: a.id, name: a.name, icon: a.icon, color: a.color }));
  const defaultDate = clampDay(today, data.range.start, data.range.end);

  return (
    <>
      <MonthNav period={period} payday={payday} hrefFor={(m) => href(m, tab)} />
      <div className="seg" role="tablist">
        <Link href={href(period, "stipendio")} className={tab === "stipendio" ? "on" : ""} role="tab" aria-selected={tab === "stipendio"}>Stipendio</Link>
        <Link href={href(period, "uscite")} className={tab === "uscite" ? "on" : ""} role="tab" aria-selected={tab === "uscite"}>Uscite</Link>
      </div>
      {active.length === 0 ? (
        <div className="card">
          <p className="empty">Crea almeno un conto per iniziare.</p>
          <Link href="/impostazioni" className="btn accent">Vai alle impostazioni</Link>
        </div>
      ) : tab === "stipendio" ? (
        <Stipendio period={period} data={data} accounts={accounts} opts={opts} />
      ) : (
        <Uscite
          period={period}
          payday={payday}
          today={today}
          data={data}
          accById={accById}
          contoParam={sp.conto}
          opts={opts}
          categories={categories}
          planned={planned.filter((p) => plannedInfo(p, period).status !== "done" || p.spent > 0)}
          defaultDate={defaultDate}
        />
      )}
    </>
  );
}

type PeriodData = Awaited<ReturnType<typeof getPeriod>>;
type Acc = Awaited<ReturnType<typeof getAccounts>>[number];
type Opt = { id: number; name: string; icon: string; color: string };

async function Stipendio({ period, data, accounts, opts }: { period: Month; data: PeriodData; accounts: Acc[]; opts: Opt[] }) {
  const balances = await getBalances();
  const accById = new Map(accounts.map((a) => [a.id, a]));
  const income = sum(data.incomes.map((i) => i.amount));
  const allocated = sum(data.allocations.map((a) => a.amount));
  const remaining = income - allocated;
  const base = Math.max(income, 1);

  return (
    <>
      <div className="card">
        <div className="card-title">
          Entrate
          <SheetTrigger className="link" title="Nuova entrata" content={<IncomeForm period={period} defaultDate={data.range.start} />}>
            <Plus size={14} /> Aggiungi
          </SheetTrigger>
        </div>
        {data.incomes.length === 0 ? (
          <SheetTrigger className="income-box" title="Nuova entrata" content={<IncomeForm period={period} defaultDate={data.range.start} />}>
            <span className="ico"><Briefcase size={18} /></span>
            <span className="main"><b>Inserisci lo stipendio</b><small>Tocca per aggiungere l&apos;entrata del mese</small></span>
            <Plus size={20} />
          </SheetTrigger>
        ) : (
          data.incomes.map((i) => (
            <SheetTrigger key={i.id} className="income-box" title="Modifica entrata" content={<IncomeForm period={period} defaultDate={data.range.start} initial={i} />}>
              <span className="ico"><Briefcase size={18} /></span>
              <span className="main"><b>{i.description}</b><small>accreditato il {dayLabelLong(i.date)}</small></span>
              <span className="right num">+{eur(i.amount, "auto")}</span>
            </SheetTrigger>
          ))
        )}

        <div className="card-title" style={{ marginTop: 16 }}>
          Ripartizione
          <SheetTrigger className="link" title="Aggiungi alla ripartizione" content={<AllocationForm period={period} accounts={opts} suggested={remaining} />}>
            <Plus size={14} /> Aggiungi
          </SheetTrigger>
        </div>
        {data.allocations.length === 0 ? (
          <>
            <p className="empty">Nessuna ripartizione per questo mese.</p>
            <CopyPreviousButton period={period} />
          </>
        ) : (
          <div className="list">
            {data.allocations.map((a) => {
              const acc = accById.get(a.accountId);
              return (
                <SheetTrigger key={a.id} className="item" title="Modifica ripartizione" content={<AllocationForm period={period} accounts={opts} initial={a} />}>
                  <IconBox name={acc?.icon} color={acc?.color} />
                  <span className="main"><b>{acc?.name}</b><small>{a.note ?? "trasferimento"}</small></span>
                  <span className="right num">{eur(a.amount, "auto")}<small>{income > 0 ? `${Math.round((a.amount / base) * 100)}%` : ""}</small></span>
                </SheetTrigger>
              );
            })}
          </div>
        )}
        {income > 0 && (
          <div className={`remaining${remaining === 0 ? " ok" : remaining < 0 ? " over" : ""}`}>
            {remaining === 0 ? (
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><CircleCheck size={16} /> Stipendio ripartito completamente</span>
            ) : remaining > 0 ? (
              <span>Da ripartire</span>
            ) : (
              <span>Ripartito più dell&apos;entrata</span>
            )}
            <span className="num">{eur(Math.abs(remaining), "auto")}</span>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          Conti e contanti
          <Link href="/impostazioni" className="link">Gestisci <ChevronRight size={14} /></Link>
        </div>
        <div className="list">
          {accounts.filter((a) => !a.archived).map((a) => (
            <div className="item" key={a.id} style={{ cursor: "default" }}>
              <IconBox name={a.icon} color={a.color} />
              <span className="main"><b>{a.name}</b><small>{KIND_LABEL[a.kind] ?? a.kind}</small></span>
              <span className={`right num${(balances.get(a.id) ?? 0) < 0 ? " neg" : ""}`}>{eur(balances.get(a.id) ?? 0, "auto")}</span>
            </div>
          ))}
        </div>
      </div>

      <SheetTrigger className="fab" title="Aggiungi alla ripartizione" ariaLabel="Aggiungi alla ripartizione" content={<AllocationForm period={period} accounts={opts} suggested={remaining} />}>
        <Plus size={28} />
      </SheetTrigger>
    </>
  );
}

const KIND_LABEL: Record<string, string> = {
  corrente: "Conto corrente",
  risparmio: "Conto risparmio",
  contanti: "Contanti",
  investimento: "Investimenti",
  altro: "Altro",
};

async function Uscite({
  period, payday, today, data, accById, contoParam, opts, categories, planned, defaultDate,
}: {
  period: Month; payday: number; today: string; data: PeriodData; accById: Map<number, Acc>; contoParam?: string; opts: Opt[];
  categories: Awaited<ReturnType<typeof getCategories>>; planned: { id: number; name: string }[]; defaultDate: string;
}) {
  // Se il mese è in corso, confronto con lo stesso numero di giorni del mese precedente
  const prev = periodRange(addMonths(period, -1), payday);
  const inCourse = today >= data.range.start && today <= data.range.end;
  const prevEnd = inCourse ? addDays(prev.start, diffDays(data.range.start, today)) : prev.end;
  const prevSpent = await getSpentInRange(prev.start, prevEnd);
  const catById = new Map(categories.map((c) => [c.id, c]));

  // conti "di spesa": quelli per la quota + quelli con uscite nel mese
  const spendIds = [...new Set([
    ...[...accById.values()].filter((a) => a.includeInQuota && !a.archived).map((a) => a.id),
    ...data.expenses.map((e) => e.accountId),
  ])];
  const conto = Number(contoParam);
  const filter = spendIds.includes(conto) ? conto : null;
  const ids = filter ? [filter] : spendIds;
  const rows = filter ? data.expenses.filter((e) => e.accountId === filter) : data.expenses;
  const total = sum(rows.map((e) => e.amount));
  const allocTo = (id: number) => sum(data.allocations.filter((a) => a.accountId === id).map((a) => a.amount));
  const assigned = sum(ids.map(allocTo));

  const byCat = new Map<number | null, number>();
  for (const e of rows) byCat.set(e.categoryId, (byCat.get(e.categoryId) ?? 0) + e.amount);
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);

  const days: [string, typeof rows][] = [];
  for (const e of rows) {
    const last = days[days.length - 1];
    if (last && last[0] === e.date) last[1].push(e);
    else days.push([e.date, [e]]);
  }
  const catOpts = categories.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name, icon: c.icon }));
  const newExpense = <ExpenseForm accounts={opts} categories={catOpts} planned={planned} defaultDate={defaultDate} defaultAccountId={filter ?? undefined} />;

  return (
    <>
      <div className="card hero">
        <div className="label">Speso nel mese{filter ? ` · ${accById.get(filter)?.name}` : ""}</div>
        <div className="big num">
          {eur(total, 2)}
          {!filter && prevSpent > 0 && (
            <span className="delta">{total <= prevSpent ? "↓" : "↑"} {eur(Math.abs(total - prevSpent))} vs mese prec.</span>
          )}
        </div>
        <div className="pills">
          <div className="pill"><span>Assegnato per le spese</span><b className="num">{eur(assigned, "auto")}</b></div>
          <div className="pill"><span>Disponibile</span><b className="num">{eur(assigned - total, 2)}</b></div>
        </div>
      </div>

      {spendIds.length > 1 && (
        <div className="chips">
          <Link href={href(period, "uscite")} className={`chip${!filter ? " on" : ""}`}>Tutti</Link>
          {spendIds.map((id) => (
            <Link key={id} href={href(period, "uscite", id)} className={`chip${filter === id ? " on" : ""}`}>{accById.get(id)?.name}</Link>
          ))}
        </div>
      )}

      {ids.length > 0 && (
        <div className="card">
          <div className="card-title">Per conto</div>
          {ids.map((id) => {
            const a = accById.get(id);
            const s = sum(data.expenses.filter((e) => e.accountId === id).map((e) => e.amount));
            const b = allocTo(id);
            const p = b > 0 ? s / b : s > 0 ? 2 : 0;
            return (
              <div className="budget" key={id}>
                <div className="top">
                  <b><IconBox name={a?.icon} color={a?.color} small /> {a?.name}</b>
                  <span className="num">{eur(s, 2)} / {eur(b, "auto")}</span>
                </div>
                <div className="progress"><i className={pctClass(p)} style={{ width: `${Math.min(p, 1) * 100}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <div className="card-title">Per categoria</div>
        {cats.length === 0 ? (
          <p className="empty">Nessuna uscita.</p>
        ) : (
          cats.map(([cid, v]) => {
            const c = cid != null ? catById.get(cid) : undefined;
            return (
              <div className="catrow" key={String(cid)}>
                <IconBox name={c?.icon ?? "tag"} small />
                <div className="mid">
                  {c?.name ?? "Senza categoria"}
                  <div className="progress"><i style={{ width: `${(v / cats[0][1]) * 100}%` }} /></div>
                </div>
                <div className="amt num">{eur(v, 2)}<small>{Math.round((v / total) * 100)}%</small></div>
              </div>
            );
          })
        )}
      </div>

      <div className="card">
        <div className="card-title">
          Elenco uscite
          <SheetTrigger className="link" title="Nuova uscita" content={newExpense}><Plus size={14} /> Aggiungi</SheetTrigger>
        </div>
        {days.length === 0 ? (
          <p className="empty">Nessuna uscita inserita per questo mese.</p>
        ) : (
          days.map(([d, list]) => (
            <div key={d}>
              <div className="day">{dayLabelLong(d)}</div>
              <div className="list">
                {list.map((e) => {
                  const c = e.categoryId != null ? catById.get(e.categoryId) : undefined;
                  const a = accById.get(e.accountId);
                  const pl = planned.find((p) => p.id === e.plannedExpenseId);
                  return (
                    <SheetTrigger
                      key={e.id}
                      className="item"
                      title="Modifica uscita"
                      content={<ExpenseForm accounts={opts} categories={catOpts} planned={planned} defaultDate={defaultDate} initial={e} />}
                    >
                      <IconBox name={c?.icon ?? "tag"} />
                      <span className="main">
                        <b>{e.description || c?.name || "Uscita"}</b>
                        <small>{[c?.name, a?.name, pl ? `da ${pl.name}` : null].filter(Boolean).join(" · ")}</small>
                      </span>
                      <span className="right num neg">−{eur(e.amount, 2)}</span>
                    </SheetTrigger>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <SheetTrigger className="fab" title="Nuova uscita" ariaLabel="Nuova uscita" content={newExpense}>
        <Plus size={28} />
      </SheetTrigger>
      <p className="note" style={{ textAlign: "center" }}>Periodo: {dayLabel(data.range.start)} – {dayLabel(data.range.end)}</p>
    </>
  );
}
