import { investmentCell, plannedAmount, plannedInfo, type Installment } from "./calc";
import { addMonths, monthIndex, type Month } from "./dates";

type PlannedLike = {
  id: number; name: string; icon: string; totalAmount: number; startMonth: Month; endMonth: Month;
  accountId: number | null; isSaving?: boolean; installments?: Map<Month, Installment>;
};
type InvestmentLike = {
  id: number; name: string; monthlyAmount: number; annualIncrease: number; startMonth: Month; endMonth: Month | null;
  accountId: number | null; recorded: Map<Month, number>; linked: Map<Month, number>;
};

/** Un versamento del mese: rata di una spesa prevedibile o versamento di lungo termine. */
export type MonthEntry = {
  key: string;
  kind: "planned" | "investment";
  name: string;
  icon: string;
  /** importo previsto */
  rata: number;
  paid: boolean;
  /** importo effettivamente versato (0 se non versato) */
  paidAmount: number;
  accountId: number | null;
  /** soldi messi da parte (false per es. le rate di un prestito) */
  saving: boolean;
};

/** Versamenti di un mese: tutte le rate delle spese prevedibili e i versamenti di lungo termine. */
export function monthEntries(month: Month, current: Month, planned: PlannedLike[], investments: InvestmentLike[]): MonthEntry[] {
  const out: MonthEntry[] = [];
  for (const p of planned) {
    const r = plannedInfo(p, current).rows.find(([m]) => m === month)?.[1];
    if (!r) continue;
    const paid = r.paid != null;
    out.push({
      key: `p${p.id}`, kind: "planned", name: p.name, icon: p.icon, rata: r.amount, paid, paidAmount: r.paid ?? 0, saving: p.isSaving !== false,
      // versata: conto scelto quando è stata segnata; da versare: conto predefinito della spesa
      accountId: paid ? r.accountId ?? null : r.accountId ?? p.accountId,
    });
  }
  for (const inv of investments) {
    const c = investmentCell(inv, month, inv.recorded, inv.linked, current);
    if (c.kind === "none") continue;
    const paid = c.kind === "recorded" || c.kind === "linked";
    const inPlan = monthIndex(month) >= monthIndex(inv.startMonth) && (!inv.endMonth || monthIndex(month) <= monthIndex(inv.endMonth));
    out.push({
      key: `i${inv.id}`, kind: "investment", name: inv.name, icon: "trending-up",
      rata: inPlan ? plannedAmount(inv, month) : c.amount, paid, paidAmount: paid ? c.amount : 0, accountId: inv.accountId, saving: true,
    });
  }
  return out.sort((a, b) => b.rata - a.rata);
}

/**
 * Riepilogo mese per mese di spese prevedibili e lungo termine.
 * I piani senza fine si mostrano fino a 12 mesi da oggi; i mesi passati al massimo per 24 mesi.
 */
export function monthsOverview(current: Month, planned: PlannedLike[], investments: InvestmentLike[]) {
  const months = new Set<Month>();
  for (const p of planned) for (const [m] of plannedInfo(p, current).rows) months.add(m);
  const lastPlanned = [...months].sort().pop();
  const end = lastPlanned && lastPlanned > addMonths(current, 11) ? lastPlanned : addMonths(current, 11);
  const from = addMonths(current, -24);
  for (const inv of investments) {
    const a = inv.startMonth > from ? inv.startMonth : from;
    const b = inv.endMonth && inv.endMonth < end ? inv.endMonth : end;
    for (let m = a; m <= b; m = addMonths(m, 1)) months.add(m);
    for (const m of inv.recorded.keys()) if (m >= from && m <= end) months.add(m);
  }
  return [...months]
    .filter((m) => m >= from)
    .sort()
    .map((month) => {
      const e = monthEntries(month, current, planned, investments);
      const sumOf = (xs: MonthEntry[], f: (x: MonthEntry) => number) => xs.reduce((a, x) => a + f(x), 0);
      return {
        month,
        amount: sumOf(e, (x) => x.rata),
        planned: sumOf(e.filter((x) => x.kind === "planned"), (x) => x.rata),
        investment: sumOf(e.filter((x) => x.kind === "investment"), (x) => x.rata),
        paid: sumOf(e, (x) => x.paidAmount),
        // solo i soldi messi da parte (escluse per es. le rate di un prestito)
        savingAmount: sumOf(e.filter((x) => x.saving), (x) => x.rata),
        savingPaid: sumOf(e.filter((x) => x.saving), (x) => x.paidAmount),
        count: e.length,
        paidCount: e.filter((x) => x.paid).length,
      };
    })
    .filter((m) => m.count > 0);
}

/** Voce proposta per la ripartizione dello stipendio: una rata o un versamento di lungo termine non ancora coperti. */
export type ProposalItem = {
  key: string;
  kind: "planned" | "investment";
  id: number;
  name: string;
  icon: string;
  amount: number;
  accountId: number | null;
};

/**
 * Proposta di ripartizione per un mese: rate delle spese prevedibili non ancora versate
 * e versamenti di lungo termine non ancora registrati (solo per i piani collegati a un conto).
 */
export function allocationProposal(month: Month, current: Month, planned: PlannedLike[], investments: InvestmentLike[]): ProposalItem[] {
  return monthEntries(month, current, planned, investments)
    .filter((e) => !e.paid && e.rata > 0 && (e.kind === "planned" || e.accountId != null))
    // lungo termine già ripartito sul suo conto (anche per un mese futuro): non va riproposto
    .filter((e) => e.kind === "planned" || !investments.find((i) => `i${i.id}` === e.key)?.linked.has(month))
    .map((e) => {
      const p = e.kind === "planned" ? planned.find((x) => `p${x.id}` === e.key)! : null;
      const id = p ? p.id : Number(e.key.slice(1));
      return { key: e.key, kind: e.kind, id, name: e.name, icon: e.icon, amount: e.rata, accountId: p ? p.accountId : e.accountId };
    });
}
