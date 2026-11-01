// Periodo di bilancio = da uno stipendio al successivo.
// Il periodo prende il nome del mese che "finanzia":
//  - giorno stipendio >= 15 (es. 27): lo stipendio del 27 ottobre apre il periodo "Novembre" (27 ott – 26 nov)
//  - giorno stipendio < 15 (es. 5): lo stipendio del 5 novembre apre il periodo "Novembre" (5 nov – 4 dic)

import { addDays, addMonths, daysInMonth, monthOf, type Day, type Month } from "./dates";

const pad = (n: number) => String(n).padStart(2, "0");

/** Data dello stipendio in un mese di calendario (limitata all'ultimo giorno del mese). */
export function paydayIn(m: Month, payday: number): Day {
  return `${m}-${pad(Math.min(payday, daysInMonth(m)))}`;
}

export function periodStart(period: Month, payday: number): Day {
  return paydayIn(payday >= 15 ? addMonths(period, -1) : period, payday);
}

export type PeriodRange = { period: Month; start: Day; end: Day; nextPayday: Day };

export function periodRange(period: Month, payday: number): PeriodRange {
  const start = periodStart(period, payday);
  const nextPayday = periodStart(addMonths(period, 1), payday);
  return { period, start, end: addDays(nextPayday, -1), nextPayday };
}

/** Periodo a cui appartiene una data. */
export function periodOf(d: Day, payday: number): Month {
  const m = monthOf(d);
  for (const candidate of [addMonths(m, -1), m, addMonths(m, 1)]) {
    const r = periodRange(candidate, payday);
    if (d >= r.start && d <= r.end) return candidate;
  }
  return m;
}
