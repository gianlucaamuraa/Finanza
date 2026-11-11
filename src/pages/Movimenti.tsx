import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Briefcase, ChevronRight, CircleCheck, Plus, X } from "lucide-react";
import * as A from "@/api";
import type { Account, Category, Investment, PeriodData, Planned } from "@/api";
import { combine, useAccounts, useBalances, useBase, useCategories, useInvestments, usePeriod, usePlanned, useSpent } from "@/hooks";
import { clampDay } from "@/lib/view";
import { addDays, addMonths, dayLabelLong, diffDays, isMonth, monthLabel, type Month } from "@/lib/dates";
import { periodRange } from "@/lib/period";
import { plannedInfo } from "@/lib/calc";
import { allocationProposal } from "@/lib/monthly";
import { eur, parseAmount, sum, toInput } from "@/lib/money";
import { IconBox } from "@/components/Icon";
import { Sheet, SheetTrigger, useSheetClose } from "@/components/Sheet";
import { AllocationForm, ExpenseForm, IncomeForm, type PlannedLinkOpt } from "@/components/forms";
import { ActionForm, Submit } from "@/components/form";
import { LoadError, MonthNav, PageSkeleton, pctClass } from "@/components/ui";
import { CopyPreviousButton } from "./CopyPreviousButton";
import { Card } from "@/components/Card";

function href(m: Month, tab: string, conto?: number | null) {
  const p = new URLSearchParams({ mese: m });
  if (tab === "uscite") p.set("tab", "uscite");
  if (conto) p.set("conto", String(conto));
  return `/movimenti?${p}`;
}

export default function Movimenti() {
  const [sp] = useSearchParams();
  const { settings, today, payday, current } = useBase();
  const mese = sp.get("mese");
  const period = isMonth(mese) ? mese : current;
  const tab = sp.get("tab") === "uscite" ? "uscite" : "stipendio";

  const qData = usePeriod(period, payday);
  const qAccounts = useAccounts();
  const qCategories = useCategories();
  const qPlanned = usePlanned();
  const qInv = useInvestments();
  const st = combine(settings, qData, qAccounts, qCategories, qPlanned, qInv);
  if (st.error) return <LoadError error={st.error} onRetry={st.retry} />;
  if (st.loading || !period || !payday) return <PageSkeleton />;
  const data = qData.data!, accounts = qAccounts.data!, categories = qCategories.data!, planned = qPlanned.data!;

  const active = accounts.filter((a) => !a.archived);
  const accById = new Map(accounts.map((a) => [a.id, a]));
  const opts = active.map((a) => ({ id: a.id, name: a.name, icon: a.icon, color: a.color }));
  const defaultDate = clampDay(today, data.range.start, data.range.end);

  return (
    <>
      <MonthNav period={period} payday={payday} hrefFor={(m) => href(m, tab)} />
      <div className="seg" role="tablist">
        <Link to={href(period, "stipendio")} className={tab === "stipendio" ? "on" : ""} role="tab" aria-selected={tab === "stipendio"}>Stipendio</Link>
        <Link to={href(period, "uscite")} className={tab === "uscite" ? "on" : ""} role="tab" aria-selected={tab === "uscite"}>Uscite</Link>
      </div>
      {active.length === 0 ? (
        <div className="card">
          <p className="empty">Crea almeno un conto per iniziare.</p>
          <Link to="/impostazioni" className="btn accent">Vai alle impostazioni</Link>
        </div>
      ) : tab === "stipendio" ? (
        <Stipendio period={period} payday={payday} current={current ?? period} data={data} accounts={accounts} opts={opts} planned={planned} investments={qInv.data!} />
      ) : (
        <Uscite
          period={period}
          payday={payday}
          today={today}
          data={data}
          accById={accById}
          contoParam={sp.get("conto") ?? undefined}
          opts={opts}
          categories={categories}
          planned={planned.filter((p) => plannedInfo(p, period).status !== "done" || p.spent > 0)}
          defaultDate={defaultDate}
        />
      )}
    </>
  );
}

type Acc = Account;
type Opt = { id: number; name: string; icon: string; color: string };

function Stipendio({ period, payday, current, data, accounts, opts, planned, investments }: {
  period: Month; payday: number; current: Month; data: PeriodData; accounts: Acc[]; opts: Opt[]; planned: Planned[]; investments: Investment[];
}) {
  const plannedById = new Map(planned.map((p) => [p.id, p]));
  // spese collegabili: quelle con una rata in questo mese, più quelle già collegate
  const linkedIds = new Set(data.allocations.map((a) => a.plannedExpenseId).filter((x) => x != null));
  const planOpts: PlannedLinkOpt[] = planned
    .map((p) => ({ p, rata: plannedInfo(p, current).rows.find(([m]) => m === period)?.[1].amount ?? null }))
    .filter(({ p, rata }) => rata != null || linkedIds.has(p.id))
    .map(({ p, rata }) => ({ id: p.id, name: p.name, rata, accountId: p.accountId }));
  const proposal = allocationProposal(period, current, planned, investments);
  // dopo aver inserito uno stipendio la proposta si apre da sola
  const [sp, setSp] = useSearchParams();
  const autoOpen = sp.get("proponi") === "1";
  const closeAuto = () => {
    const n = new URLSearchParams(sp);
    n.delete("proponi");
    setSp(n, { replace: true });
  };
  const qBalances = useBalances();
  const balances = qBalances.data ?? new Map<number, number>();
  const accById = new Map(accounts.map((a) => [a.id, a]));
  const income = sum(data.incomes.map((i) => i.amount));
  const allocated = sum(data.allocations.map((a) => a.amount));
  const remaining = income - allocated;
  const base = Math.max(income, 1);
  const showProposal = proposal.length > 0 || (income > 0 && remaining > 0);
  // avviso dopo "Accetta": quanto resta da ripartire
  const [saved, setSaved] = useState(false);
  const onAccepted = () => {
    setSaved(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      {saved && (
        <div className={`remaining${remaining === 0 ? " ok" : remaining < 0 ? " over" : ""}`} role="status" style={{ marginTop: 0, marginBottom: 12 }}>
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flex: 1 }}>
            <CircleCheck size={16} />
            {remaining === 0 ? "Ripartizione salvata: stipendio ripartito tutto" : remaining > 0 ? "Ripartizione salvata · restano da ripartire" : "Ripartizione salvata · oltre lo stipendio di"}
          </span>
          {remaining !== 0 && <span className="num">{eur(Math.abs(remaining), 2)}</span>}
          <button type="button" aria-label="Chiudi avviso" onClick={() => setSaved(false)} style={{ background: "none", border: "none", color: "inherit", padding: 0, cursor: "pointer", display: "inline-flex" }}>
            <X size={16} />
          </button>
        </div>
      )}
      <Card id="movimenti-1" title={<>
          Entrate
          <SheetTrigger className="link" title="Nuova entrata" content={<IncomeForm period={period} payday={payday} defaultDate={data.range.start} />}>
            <Plus size={14} /> Aggiungi
          </SheetTrigger>
      </>}>
        {data.incomes.length === 0 ? (
          <SheetTrigger className="income-box" title="Nuova entrata" content={<IncomeForm period={period} payday={payday} defaultDate={data.range.start} />}>
            <span className="ico"><Briefcase size={18} /></span>
            <span className="main"><b>Inserisci lo stipendio</b><small>Tocca per aggiungere l&apos;entrata del mese</small></span>
            <Plus size={20} />
          </SheetTrigger>
        ) : (
          data.incomes.map((i) => (
            <SheetTrigger key={i.id} className="income-box" title="Modifica entrata" content={<IncomeForm period={period} payday={payday} defaultDate={data.range.start} initial={i} />}>
              <span className="ico"><Briefcase size={18} /></span>
              <span className="main"><b>{i.description}</b><small>accreditato il {dayLabelLong(i.date)}</small></span>
              <span className="right num">+{eur(i.amount, "auto")}</span>
            </SheetTrigger>
          ))
        )}
        {income > 0 && (
          <>
            <span className="progress" style={{ display: "block", marginTop: 10 }}>
              <i className={remaining < 0 ? "over" : ""} style={{ width: `${Math.min(100, Math.max(0, (allocated / income) * 100))}%` }} />
            </span>
            <div className={`remaining${remaining === 0 ? " ok" : remaining < 0 ? " over" : ""}`} style={{ marginTop: 10 }}>
              {remaining === 0 ? (
                <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><CircleCheck size={16} /> Stipendio ripartito completamente</span>
              ) : remaining > 0 ? (
                <span>Da ripartire <small style={{ fontWeight: 500, opacity: 0.8 }}>· ripartiti {eur(allocated, "auto")} di {eur(income, "auto")}</small></span>
              ) : (
                <span>Ripartito più dell&apos;entrata</span>
              )}
              {remaining !== 0 && <span className="num">{eur(Math.abs(remaining), 2)}</span>}
            </div>
          </>
        )}

        <div className="card-title" style={{ marginTop: 16 }}>
          Ripartizione
          <SheetTrigger className="link" title="Aggiungi alla ripartizione" content={<AllocationForm period={period} accounts={opts} planned={planOpts} suggested={remaining} />}>
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
                <SheetTrigger key={a.id} className="item" title="Modifica ripartizione" content={<AllocationForm period={period} accounts={opts} planned={planOpts} initial={a} />}>
                  <IconBox name={acc?.icon} color={acc?.color} />
                  <span className="main">
                    <b>{acc?.name}</b>
                    <small>{a.plannedExpenseId != null ? `per ${plannedById.get(a.plannedExpenseId)?.name ?? "spesa eliminata"}` : a.note ?? "trasferimento"}</small>
                  </span>
                  <span className="right num">{eur(a.amount, "auto")}<small>{income > 0 ? `${Math.round((a.amount / base) * 100)}%` : ""}</small></span>
                </SheetTrigger>
              );
            })}
          </div>
        )}
      </Card>

      {showProposal && <ProposalCard key={`${period}-${proposal.map((x) => x.key).join()}`} period={period} items={proposal} accounts={opts} remaining={income > 0 ? remaining : null} income={income} onAccepted={onAccepted} />}
      {showProposal && autoOpen && (
        <Sheet title={`Ripartisci lo stipendio di ${monthLabel(period)}`} onClose={closeAuto}>
          <ProposalCard inSheet period={period} items={proposal} accounts={opts} remaining={income > 0 ? remaining : null} income={income} onAccepted={onAccepted} />
        </Sheet>
      )}

      <Card id="movimenti-2" title={<>
          Conti e contanti
          <Link to="/impostazioni" className="link">Gestisci <ChevronRight size={14} /></Link>
      </>}>
        <div className="list">
          {accounts.filter((a) => !a.archived).map((a) => (
            <div className="item" key={a.id} style={{ cursor: "default" }}>
              <IconBox name={a.icon} color={a.color} />
              <span className="main"><b>{a.name}</b><small>{KIND_LABEL[a.kind] ?? a.kind}</small></span>
              <span className={`right num${(balances.get(a.id) ?? 0) < 0 ? " neg" : ""}`}>{eur(balances.get(a.id) ?? 0, "auto")}</span>
            </div>
          ))}
        </div>
      </Card>

      <SheetTrigger className="fab" title="Aggiungi alla ripartizione" ariaLabel="Aggiungi alla ripartizione" content={<AllocationForm period={period} accounts={opts} planned={planOpts} suggested={remaining} />}>
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

function Uscite({
  period, payday, today, data, accById, contoParam, opts, categories, planned, defaultDate,
}: {
  period: Month; payday: number; today: string; data: PeriodData; accById: Map<number, Acc>; contoParam?: string; opts: Opt[];
  categories: Category[]; planned: { id: number; name: string }[]; defaultDate: string;
}) {
  // Se il mese è in corso, confronto con lo stesso numero di giorni del mese precedente
  const prev = periodRange(addMonths(period, -1), payday);
  const inCourse = today >= data.range.start && today <= data.range.end;
  const prevEnd = inCourse ? addDays(prev.start, diffDays(data.range.start, today)) : prev.end;
  const prevSpent = useSpent(prev.start, prevEnd).data ?? 0;
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
          <Link to={href(period, "uscite")} className={`chip${!filter ? " on" : ""}`}>Tutti</Link>
          {spendIds.map((id) => (
            <Link key={id} to={href(period, "uscite", id)} className={`chip${filter === id ? " on" : ""}`}>{accById.get(id)?.name}</Link>
          ))}
        </div>
      )}

      {ids.length > 0 && (
        <Card id="movimenti-3" title={<>Per conto</>}>
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
        </Card>
      )}

      <Card id="movimenti-4" title={<>Per categoria</>}>
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
      </Card>

      <Card id="movimenti-5" title={<>
          Elenco uscite
          <SheetTrigger className="link" title="Nuova uscita" content={newExpense}><Plus size={14} /> Aggiungi</SheetTrigger>
      </>}>
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
      </Card>

      <SheetTrigger className="fab" title="Nuova uscita" ariaLabel="Nuova uscita" content={newExpense}>
        <Plus size={28} />
      </SheetTrigger>
    </>
  );
}

/**
 * Proposta di ripartizione: rate del mese e versamenti di lungo termine non ancora coperti,
 * con importo e conto già compilati. Accettando si creano le ripartizioni (collegate alle spese).
 */
const SALARY_ACC_KEY = "finanza-conto-stipendio-personale";

function ProposalCard({ period, items, accounts, remaining, inSheet, income, onAccepted }: {
  period: Month; items: ReturnType<typeof allocationProposal>; accounts: Opt[]; remaining: number | null; inSheet?: boolean;
  income: number; onAccepted: () => void;
}) {
  const close = useSheetClose();
  const [on, setOn] = useState(() => new Set(items.map((x) => x.key)));
  const [amts, setAmts] = useState<Record<string, string>>(() => Object.fromEntries(items.map((x) => [x.key, toInput(x.amount)])));
  // importo extra da aggiungere a una voce: il totale della voce è importo + extra
  const [extras, setExtras] = useState<Record<string, string>>({});
  const itemAmount = (k: string) => (parseAmount(amts[k]) ?? 0) + (parseAmount(extras[k] ?? "") ?? 0);
  const itemsTotal = sum(items.filter((x) => on.has(x.key)).map((x) => itemAmount(x.key)));
  // Stipendio personale: la rimanenza dello stipendio, sul conto scelto (ricordato su questo dispositivo)
  const [salaryOn, setSalaryOn] = useState(remaining != null);
  const [salaryAcc, setSalaryAcc] = useState(() => {
    let saved = "";
    try { saved = localStorage.getItem(SALARY_ACC_KEY) ?? ""; } catch { /* storage non disponibile */ }
    if (accounts.some((a) => String(a.id) === saved)) return saved;
    const ing = accounts.find((a) => /\bing\b/i.test(a.name));
    return ing ? String(ing.id) : "";
  });
  const [salaryEdit, setSalaryEdit] = useState<string | null>(null);
  const salaryAuto = remaining != null ? Math.max(0, remaining - itemsTotal) : 0;
  const salaryAmt = salaryEdit ?? toInput(salaryAuto);
  const showSalary = remaining != null;
  const total = itemsTotal + (showSalary && salaryOn ? parseAmount(salaryAmt) ?? 0 : 0);
  const count = on.size + (showSalary && salaryOn ? 1 : 0);
  const toggle = (k: string) => setOn((prev) => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    return n;
  });
  return (
    <ProposalFrame inSheet={inSheet}>
      <p className="note" style={{ marginTop: 0 }}>
        Rate e versamenti di {monthLabel(period)} non ancora coperti{showSalary ? " e, in fondo, il resto dello stipendio" : ""}. Controlla importi e conti, poi accetta: le rate risulteranno versate.
      </p>
      <ActionForm
        action={(fd) => A.acceptProposal(period, fd)}
        onSuccess={() => {
          close();
          onAccepted();
        }}
      >
        <div className="list" style={{ marginBottom: 12 }}>
          {items.map((x) => (
            <div key={x.key} className="item" style={{ cursor: "default", flexWrap: "wrap", opacity: on.has(x.key) ? 1 : 0.5 }}>
              <input type="checkbox" name="item" value={x.key} checked={on.has(x.key)} onChange={() => toggle(x.key)} aria-label={`Includi ${x.name}`} style={{ width: 20, height: 20, accentColor: "var(--accent)" }} />
              <IconBox name={x.icon} small />
              <span className="main">
                <b>{x.name}</b>
                <small>{x.kind === "investment" ? "Lungo termine" : "Spesa prevedibile"}</small>
              </span>
              <input type="hidden" name={`name_${x.key}`} value={x.name} />
              <div className="field-row" style={{ width: "100%", marginTop: 8 }}>
                <select name={`acc_${x.key}`} className="input" defaultValue={x.accountId != null && accounts.some((a) => a.id === x.accountId) ? x.accountId : ""} aria-label={`Conto per ${x.name}`}>
                  <option value="" disabled>Scegli il conto</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <input
                  name={`amt_${x.key}`} className="input num" inputMode="decimal" autoComplete="off" style={{ maxWidth: 110 }}
                  value={amts[x.key]} onChange={(e) => setAmts({ ...amts, [x.key]: e.target.value })} aria-label={`Importo per ${x.name}`}
                />
              </div>
              <div className="field-row" style={{ width: "100%", marginTop: 8, alignItems: "center" }}>
                <span className="muted" style={{ fontSize: 13, whiteSpace: "nowrap" }}>+ Aggiungi</span>
                <input
                  name={`extra_${x.key}`} className="input num" inputMode="decimal" autoComplete="off" placeholder="0" style={{ maxWidth: 110 }}
                  value={extras[x.key] ?? ""} onChange={(e) => setExtras({ ...extras, [x.key]: e.target.value })} aria-label={`Importo da aggiungere a ${x.name}`}
                />
                <span style={{ flex: 1, textAlign: "right", fontSize: 13, whiteSpace: "nowrap" }}>
                  = <b className="num">{eur(itemAmount(x.key), 2)}</b>
                </span>
              </div>
            </div>
          ))}
          {showSalary && (
            <div className="calc" style={{ margin: "12px 0 4px" }}>
              <div>
                <span>Dopo queste voci restano</span>
                <small>
                  {remaining !== income ? `da ripartire ${eur(remaining ?? 0, "auto")}` : `stipendio ${eur(income, "auto")}`} − voci spuntate {eur(itemsTotal, "auto")}
                </small>
              </div>
              <b className="num">{eur((remaining ?? 0) - itemsTotal, 2)}</b>
            </div>
          )}
          {showSalary && (
            <div className="item" style={{ cursor: "default", flexWrap: "wrap", opacity: salaryOn ? 1 : 0.5 }}>
              <input type="checkbox" name="item" value="s0" checked={salaryOn} onChange={() => setSalaryOn(!salaryOn)} aria-label="Includi Stipendio personale" style={{ width: 20, height: 20, accentColor: "var(--accent)" }} />
              <IconBox name="wallet" small />
              <span className="main">
                <b>Stipendio personale</b>
                <small>{salaryEdit == null ? "il resto dello stipendio, calcolato in automatico" : "importo modificato a mano"}</small>
              </span>
              <input type="hidden" name="name_s0" value="Stipendio personale" />
              <div className="field-row" style={{ width: "100%", marginTop: 8 }}>
                <select
                  name="acc_s0" className="input" value={salaryAcc} aria-label="Conto per Stipendio personale"
                  onChange={(e) => {
                    setSalaryAcc(e.target.value);
                    try { localStorage.setItem(SALARY_ACC_KEY, e.target.value); } catch { /* storage non disponibile */ }
                  }}
                >
                  <option value="" disabled>Scegli il conto</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <input
                  name="amt_s0" className="input num" inputMode="decimal" autoComplete="off" style={{ maxWidth: 120 }}
                  value={salaryAmt} onChange={(e) => setSalaryEdit(e.target.value)} aria-label="Importo per Stipendio personale"
                />
              </div>
            </div>
          )}
        </div>
        <div className="calc">
          <div>
            <span>Totale proposto</span>
            {remaining != null && <small>{remaining >= total ? `restano da ripartire ${eur(remaining - total, "auto")}` : `supera lo stipendio da ripartire di ${eur(total - remaining, "auto")}`}</small>}
          </div>
          <b className="num">{eur(total, 2)}</b>
        </div>
        <Submit className="btn accent" pendingText="Creazione…">Accetta e crea {count} {count === 1 ? "ripartizione" : "ripartizioni"}</Submit>
      </ActionForm>
    </ProposalFrame>
  );
}

/** La proposta è sempre aperta: nella pagina come card (senza freccia), oppure dentro il foglio che si apre da solo. */
function ProposalFrame({ inSheet, children }: { inSheet?: boolean; children: ReactNode }) {
  if (inSheet) return <>{children}</>;
  return (
    <div className="card" style={{ borderColor: "var(--accent)" }}>
      <div className="card-title">Proposta di ripartizione</div>
      {children}
    </div>
  );
}
