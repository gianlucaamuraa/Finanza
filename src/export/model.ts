// Raccoglie tutti i dati e calcola i riepiloghi per l'export in Excel e PDF.

import * as A from "@/api";
import { dailyQuota, investmentCell, plannedAmount, plannedInfo, type PlannedStatus } from "@/lib/calc";
import { addMonths, today as todayFn, type Month } from "@/lib/dates";
import { periodOf, periodRange } from "@/lib/period";
import { monthsOverview } from "@/lib/monthly";
import { investedTotal, netWorth } from "@/lib/view";

const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
const STATUS: Record<PlannedStatus, string> = { active: "In corso", future: "Futura", done: "Conclusa" };

export async function buildReport() {
  const [settings, accounts, categories, balances, planned, investments, mov] = await Promise.all([
    A.getSettings(), A.getAccounts(), A.getCategories(), A.getBalances(), A.getPlanned(), A.getInvestments(), A.getAllMovements(),
  ]);
  const payday = settings.payday;
  const today = todayFn();
  const current = periodOf(today, payday);
  const range = periodRange(current, payday);
  const accName = (id: number | null) => (id == null ? "" : accounts.find((a) => a.id === id)?.name ?? "conto eliminato");
  const catName = (id: number | null) => (id == null ? "Senza categoria" : categories.find((c) => c.id === id)?.name ?? "categoria eliminata");
  const plannedName = (id: number | null) => (id == null ? "" : planned.find((p) => p.id === id)?.name ?? "spesa eliminata");

  // conti e patrimonio (come in Dashboard)
  const accountRows = accounts.map((a) => ({
    name: a.name, kind: a.kind, initial: a.initialBalance, balance: balances.get(a.id) ?? 0,
    archived: a.archived, excluded: a.excludeFromNetWorth, inQuota: a.includeInQuota,
  }));
  const { banks, cash, liquidity, invested } = netWorth(accounts, balances, investments, current);

  // mese in corso
  const incomes = mov.incomes.filter((i) => i.period === current);
  const allocations = mov.allocations.filter((a) => a.period === current);
  const expenses = mov.expenses.filter((e) => e.date >= range.start && e.date <= range.end);
  const income = sum(incomes.map((i) => i.amount));
  const allocated = sum(allocations.map((a) => a.amount));
  const spent = sum(expenses.map((e) => e.amount));
  const quotaIds = new Set(accounts.filter((a) => a.includeInQuota).map((a) => a.id));
  const quota = dailyQuota(
    range, today,
    sum(allocations.filter((a) => quotaIds.has(a.accountId)).map((a) => a.amount)),
    sum(expenses.filter((e) => quotaIds.has(e.accountId)).map((e) => e.amount)),
  );
  const byCat = new Map<string, number>();
  for (const e of expenses) byCat.set(catName(e.categoryId), (byCat.get(catName(e.categoryId)) ?? 0) + e.amount);
  const byAcc = new Map<string, number>();
  for (const a of allocations) byAcc.set(accName(a.accountId), (byAcc.get(accName(a.accountId)) ?? 0) + a.amount);

  const overview = monthsOverview(current, planned, investments);
  const setAside = overview.find((m) => m.month === current);
  const nextSetAside = overview.find((m) => m.month === addMonths(current, 1));

  // spese prevedibili e rate
  const plannedRows = planned.map((p) => {
    const i = plannedInfo(p, current);
    return {
      name: p.name, start: p.startMonth, end: p.endMonth, total: i.total, paid: i.accrued, spent: p.spent,
      n: i.n, paidCount: i.paid, rata: i.rata, status: STATUS[i.status], account: accName(p.accountId), note: p.note ?? "",
    };
  });
  const installmentRows = planned.flatMap((p) =>
    plannedInfo(p, current).rows.map(([month, r]) => ({
      name: p.name, month, amount: r.amount, paid: r.paid, account: accName(r.accountId ?? (r.paid == null ? p.accountId : null)),
      source: r.fromAllocation ? "Ripartizione stipendio" : r.paid != null ? "Segnata a mano" : "",
    })),
  );

  // lungo termine: dall'inizio del piano a 12 mesi da oggi
  const investmentRows = investments.map((inv) => ({
    name: inv.name, monthly: inv.monthlyAmount, increase: inv.annualIncrease, start: inv.startMonth, end: inv.endMonth ?? "",
    account: accName(inv.accountId), total: investedTotal(inv, current), nextAmount: plannedAmount(inv, current),
  }));
  const contributionRows = investments.flatMap((inv) => {
    const out: { name: string; month: Month; planned: number; paid: number; status: string }[] = [];
    const last = inv.endMonth && inv.endMonth < addMonths(current, 11) ? inv.endMonth : addMonths(current, 11);
    for (let m = inv.startMonth; m <= last; m = addMonths(m, 1)) {
      const c = investmentCell(inv, m, inv.recorded, inv.linked, current);
      if (c.kind === "none") continue;
      out.push({
        name: inv.name, month: m, planned: plannedAmount(inv, m),
        paid: c.kind === "recorded" || c.kind === "linked" ? c.amount : 0,
        status: { recorded: "Versato", linked: "Da ripartizione", planned: "Pianificato", missing: "Da registrare", none: "" }[c.kind],
      });
    }
    return out;
  });

  return {
    today, payday, current, range, nextMonth: addMonths(current, 1),
    accounts: accountRows, banks, cash, liquidity, invested, netWorth: liquidity + invested,
    month: {
      income, allocated, spent, quota,
      byCategory: [...byCat].sort((a, b) => b[1] - a[1]),
      byAccount: [...byAcc].sort((a, b) => b[1] - a[1]),
      setAside, nextSetAside,
    },
    incomes: mov.incomes.map((i) => ({ ...i })),
    allocations: mov.allocations.map((a) => ({ period: a.period, account: accName(a.accountId), amount: a.amount, planned: plannedName(a.plannedExpenseId), note: a.note ?? "" })),
    expenses: mov.expenses.map((e) => ({
      date: e.date, period: periodOf(e.date, payday), account: accName(e.accountId), category: catName(e.categoryId),
      description: e.description, amount: e.amount, planned: plannedName(e.plannedExpenseId),
    })),
    planned: plannedRows, installments: installmentRows,
    investments: investmentRows, contributions: contributionRows,
    overview,
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;

/** Nomi delle spese mostrate a parte che compaiono nei mesi indicati (una colonna ciascuna nelle tabelle). */
export function separateNames(rows: { separate: { name: string }[] }[]): string[] {
  return [...new Set(rows.flatMap((o) => o.separate.map((x) => x.name)))];
}
export const separateOf = (o: { separate: { name: string; amount: number }[] }, name: string) =>
  o.separate.filter((x) => x.name === name).reduce((a, x) => a + x.amount, 0);

/** Scarica un file generato nel browser. */
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
