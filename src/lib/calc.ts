import { monthFromIndex, monthIndex, diffDays, type Day, type Month } from "./dates";
import type { PeriodRange } from "./period";

export type PlannedStatus = "future" | "active" | "done";

/** Rata: importo previsto, importo versato (null = non versata) e conto su cui è stata versata. */
export type Installment = { amount: number; paid: number | null; accountId?: number | null; fromAllocation?: boolean };

/** Ripartizioni dello stipendio collegate a una spesa prevedibile, per mese: importo totale e conto. */
export type LinkedAllocations = Map<Month, { amount: number; accountId: number }>;

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
  p: { totalAmount: number; startMonth: Month; endMonth: Month; installments?: Map<Month, Installment>; allocations?: LinkedAllocations },
  current: Month,
) {
  let rows: [Month, Installment][];
  if (p.installments && p.installments.size > 0) rows = [...p.installments.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  else {
    const months: Month[] = [];
    for (let m = p.startMonth; monthIndex(m) <= monthIndex(p.endMonth); m = monthFromIndex(monthIndex(m) + 1)) months.push(m);
    rows = [...equalSplit(p.totalAmount, months)].map(([m, amount]) => [m, { amount, paid: null }]);
  }
  // una ripartizione dello stipendio collegata alla spesa vale come versamento della rata di quel mese
  if (p.allocations?.size)
    rows = rows.map(([m, r]) => {
      const a = p.allocations!.get(m);
      return a ? [m, { ...r, paid: a.amount, accountId: a.accountId, fromAllocation: true }] : [m, r];
    });
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

/** Cella di un investimento in un mese: versato (registrato o da movimenti), pianificato, mancante o fuori piano. */
export function investmentCell(
  inv: PlanLike,
  month: Month,
  recorded: Map<Month, number>,
  linked: Map<Month, number>,
  currentMonth: Month,
): MonthCell {
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
}

export function investmentYear(
  inv: PlanLike,
  year: number,
  recorded: Map<Month, number>,
  linked: Map<Month, number>,
  currentMonth: Month,
): MonthCell[] {
  return Array.from({ length: 12 }, (_, i) =>
    investmentCell(inv, `${year}-${String(i + 1).padStart(2, "0")}`, recorded, linked, currentMonth),
  );
}
