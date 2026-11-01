import { monthIndex, monthsInclusive, diffDays, type Day, type Month } from "./dates";
import type { PeriodRange } from "./period";

export type PlannedStatus = "future" | "active" | "done";

export function plannedInfo(
  p: { totalAmount: number; startMonth: Month; endMonth: Month },
  current: Month,
) {
  const n = Math.max(1, monthsInclusive(p.startMonth, p.endMonth));
  const rata = p.totalAmount / n;
  const paid = Math.max(0, Math.min(n, monthIndex(current) - monthIndex(p.startMonth) + 1));
  const status: PlannedStatus =
    monthIndex(current) < monthIndex(p.startMonth)
      ? "future"
      : monthIndex(current) > monthIndex(p.endMonth)
        ? "done"
        : "active";
  return { n, rata, paid, accrued: Math.round(rata * paid), status };
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
