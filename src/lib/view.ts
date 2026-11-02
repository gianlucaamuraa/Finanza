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

type AccountLike = { id: number; kind: string; excludeFromNetWorth: boolean };
type InvestmentLike = { accountId: number | null; recorded: Map<Month, number>; linked: Map<Month, number> };

/**
 * Patrimonio: ogni conto conta una volta sola, con il suo saldo.
 * - Liquidità: conti normali (non di investimento, non collegati a un piano, non esclusi),
 *   divisa in banche (tutti i conti tranne i contanti) e contanti.
 * - Investito: conti di investimento e conti collegati a un piano di lungo termine (saldo del conto),
 *   più i versamenti registrati a mano che non sono passati da un conto
 *   (piani senza conto, o mesi in cui sul conto collegato non c'è una ripartizione).
 */
export function netWorth(accounts: AccountLike[], balances: Map<number, number>, investments: InvestmentLike[], current: Month) {
  const linkedIds = new Set(investments.map((i) => i.accountId).filter((x): x is number => x != null));
  const bal = (id: number) => balances.get(id) ?? 0;
  const isInvest = (a: AccountLike) => a.kind === "investimento" || linkedIds.has(a.id);
  // "escluso dal patrimonio" vale per i conti di liquidità; i conti di investimento contano sempre
  const liquid = accounts.filter((a) => !isInvest(a) && !a.excludeFromNetWorth);
  const cash = liquid.filter((a) => a.kind === "contanti").reduce((s, a) => s + bal(a.id), 0);
  const banks = liquid.filter((a) => a.kind !== "contanti").reduce((s, a) => s + bal(a.id), 0);
  const liquidity = banks + cash;
  let invested = accounts.filter(isInvest).reduce((s, a) => s + bal(a.id), 0);
  for (const inv of investments)
    for (const [m, v] of inv.recorded)
      if (monthIndex(m) <= monthIndex(current) && (inv.accountId == null || !inv.linked.has(m))) invested += v;
  return { banks, cash, liquidity, invested, total: liquidity + invested };
}
