import { monthFromIndex, monthIndex, diffDays, type Day, type Month } from "./dates";
import type { PeriodRange } from "./period";

export type PlannedStatus = "future" | "active" | "done";

/** Rata: importo previsto, importo versato (null = non versata) e conto su cui è stata versata. */
export type Installment = { amount: number; paid: number | null; accountId?: number | null };

/** Divide un totale in rate uguali sui mesi indicati (l'ultima assorbe gli arrotondamenti). */
export function equalSplit(total: number, months: Month[]): Map<Month, number> {
  const n = months.length;
  const base = n ? Math.round(total / n) : 0;
  return new Map(months.map((m, i) => [m, i === n - 1 ? total - base * (n - 1) : base]));
}

/**
 * Stato di una spesa prevedibile nel mese corrente.
 * Le rate (installments) hanno un importo per mese e l'importo effettivamente versato.
 * Senza rate salvate il totale è diviso in rate uguali e nulla risulta versato.
 */
export function plannedInfo(
  p: { totalAmount: number; startMonth: Month; endMonth: Month; installments?: Map<Month, Installment> },
  current: Month,
) {
  let rows: [Month, Installment][];
  if (p.installments && p.installments.size > 0) rows = [...p.installments.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  else {
    const months: Month[] = [];
    for (let m = p.startMonth; monthIndex(m) <= monthIndex(p.endMonth); m = monthFromIndex(monthIndex(m) + 1)) months.push(m);
    rows = [...equalSplit(p.totalAmount, months)].map(([m, amount]) => [m, { amount, paid: null }]);
  }
  const first = rows[0]?.[0] ?? p.startMonth, last = rows[rows.length - 1]?.[0] ?? p.endMonth;
  const status: PlannedStatus = current < first ? "future" : current > last ? "done" : "active";
  const byMonth = new Map(rows);
  const now = byMonth.get(current) ?? null;
  const rata = now?.amount ?? byMonth.get(status === "future" ? first : last)?.amount ?? 0;
  const paidRows = rows.filter(([, r]) => r.paid != null);
  return {
    rows,
    n: rows.length,
    rata,
    /** rata del mese corrente (null se questo mese non c'è rata) */
    now,
    paid: paidRows.length,
    accrued: paidRows.reduce((a, [, r]) => a + (r.paid ?? 0), 0),
    total: rows.reduce((a, [, r]) => a + r.amount, 0),
    status,
    custom: new Set(rows.map(([, r]) => r.amount)).size > 2,
  };
}

/** Quota giornaliera: disponibile ÷ giorni che mancano al prossimo stipendio. */
export function dailyQuota(range: PeriodRange, todayDay: Day, budget: number, spent: number) {
  const daysLeft = Math.max(1, diffDays(todayDay, range.nextPayday));
  const totalDays = diffDays(range.start, range.nextPayday);
  const daysPassed = Math.min(totalDays, Math.max(1, diffDays(range.start, todayDay) + 1));
  const available = budget - spent;
  return {
    available,
    daysLeft,
    daysPassed,
    totalDays,
    quota: available / daysLeft,
    avgSpent: spent / daysPassed,
  };
}

export type MonthCell = {
  month: Month;
  amount: number;
  kind: "recorded" | "linked" | "planned" | "missing" | "none";
};

/** Celle mensili di un investimento per un anno. */
type PlanLike = { monthlyAmount: number; startMonth: Month; endMonth: Month | null; annualIncrease?: number };

/** Versamento previsto in un mese: importo iniziale + aumento annuo per ogni anno trascorso dall'inizio. */
export function plannedAmount(inv: PlanLike, month: Month): number {
  const years = Math.max(0, Number(month.slice(0, 4)) - Number(inv.startMonth.slice(0, 4)));
  return inv.monthlyAmount + (inv.annualIncrease ?? 0) * years;
}

export function investmentYear(
  inv: PlanLike,
  year: number,
  recorded: Map<Month, number>,
  linked: Map<Month, number>,
  currentMonth: Month,
): MonthCell[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
    const inPlan =
      monthIndex(month) >= monthIndex(inv.startMonth) &&
      (!inv.endMonth || monthIndex(month) <= monthIndex(inv.endMonth));
    if (recorded.has(month)) return { month, amount: recorded.get(month)!, kind: "recorded" };
    if (linked.has(month) && monthIndex(month) <= monthIndex(currentMonth))
      return { month, amount: linked.get(month)!, kind: "linked" };
    if (!inPlan) return { month, amount: 0, kind: "none" };
    if (monthIndex(month) >= monthIndex(currentMonth))
      return { month, amount: plannedAmount(inv, month), kind: "planned" };
    return { month, amount: 0, kind: "missing" };
  });
}

/** Totale delle rate di tutte le spese prevedibili, mese per mese (previsto e versato). */
export function plannedByMonth(rowsList: [Month, Installment][][]) {
  const map = new Map<Month, { amount: number; paid: number; count: number; paidCount: number }>();
  for (const rows of rowsList)
    for (const [m, r] of rows) {
      const e = map.get(m) ?? { amount: 0, paid: 0, count: 0, paidCount: 0 };
      e.amount += r.amount;
      e.count++;
      if (r.paid != null) {
        e.paid += r.paid;
        e.paidCount++;
      }
      map.set(m, e);
    }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([month, e]) => ({ month, ...e }));
}
