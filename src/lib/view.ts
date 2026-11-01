import type { Investment } from "@/api";
import { monthIndex, type Month } from "./dates";
import { investmentYear, type MonthCell } from "./calc";

/** Importo effettivo versato: registrato, altrimenti da ripartizione sul conto collegato. */
export function investedTotal(inv: Investment, current: Month): number {
  let total = 0;
  for (const v of inv.recorded.values()) total += v;
  for (const [m, v] of inv.linked) if (!inv.recorded.has(m) && monthIndex(m) <= monthIndex(current)) total += v;
  return total;
}

export function yearCells(inv: Investment, year: number, current: Month): MonthCell[] {
  return investmentYear(inv, year, inv.recorded, inv.linked, current);
}

/** Somma delle celle di più investimenti per lo stesso anno. */
export function sumCells(invs: Investment[], year: number, current: Month): MonthCell[] {
  const all = invs.map((i) => yearCells(i, year, current));
  return Array.from({ length: 12 }, (_, k) => {
    const cells = all.map((c) => c[k]);
    const done = cells.filter((c) => c.kind === "recorded" || c.kind === "linked");
    const amount = cells.reduce((a, c) => a + (c.kind === "missing" || c.kind === "none" ? 0 : c.amount), 0);
    const kind = done.length > 0 ? "recorded" : cells.some((c) => c.kind === "planned") ? "planned" : cells.some((c) => c.kind === "missing") ? "missing" : "none";
    return { month: cells[0]?.month ?? "", amount, kind };
  });
}

export const clampDay = (d: string, a: string, b: string) => (d < a ? a : d > b ? b : d);
