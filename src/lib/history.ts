import { monthLabel } from "./dates";
import { eur } from "./money";

type Row = Record<string, unknown>;
export type HistoryLike = {
  id: number; table: string; action: "insert" | "update" | "delete";
  oldData: Row | null; newData: Row | null; createdAt: string; undone: boolean;
};

const LABEL: Record<string, [string, "m" | "f"]> = {
  incomes: ["Entrata", "f"], allocations: ["Ripartizione", "f"], expenses: ["Uscita", "f"],
  planned_expenses: ["Spesa prevedibile", "f"], planned_installments: ["Rata", "f"],
  investments: ["Piano di lungo termine", "m"], investment_contributions: ["Versamento PAC", "m"],
  accounts: ["Conto", "m"], categories: ["Categoria", "f"],
};
const VERB: Record<HistoryLike["action"], [string, string]> = {
  insert: ["aggiunto", "aggiunta"], update: ["modificato", "modificata"], delete: ["eliminato", "eliminata"],
};

const money = (v: unknown) => (typeof v === "number" ? eur(v, "auto") : null);
const monthOf = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}$/.test(v) ? monthLabel(v) : null);

/** Descrizione leggibile di una modifica, es. "Ripartizione modificata · Ottobre 2026 · € 50 → € 80". */
export function describe(x: HistoryLike, names: { accounts?: Map<number, string>; planned?: Map<number, string> } = {}): string {
  const [label, g] = LABEL[x.table] ?? [x.table, "m"];
  const d = (x.newData ?? x.oldData ?? {}) as Row;
  const parts: string[] = [`${label} ${VERB[x.action][g === "f" ? 1 : 0]}`];
  const name = (d.name ?? d.description ?? d.note) as string | undefined;
  const acc = typeof d.account_id === "number" ? names.accounts?.get(d.account_id) : undefined;
  const pl = typeof d.planned_expense_id === "number" ? names.planned?.get(d.planned_expense_id) : undefined;
  if (name) parts.push(String(name));
  else if (acc) parts.push(acc);
  if (pl && pl !== name) parts.push(`per ${pl}`);
  const when = monthOf(d.period) ?? monthOf(d.month) ?? (typeof d.date === "string" ? d.date.split("-").reverse().join("/") : null);
  if (when) parts.push(when);
  if (x.action === "update" && x.oldData && x.newData) {
    const changes: string[] = [];
    for (const k of ["amount", "paid_amount", "total_amount", "monthly_amount", "initial_balance"]) {
      if (k in x.newData && x.oldData[k] !== x.newData[k]) changes.push(`${money(x.oldData[k]) ?? "—"} → ${money(x.newData[k]) ?? "—"}`);
    }
    for (const k of ["period", "month"]) {
      if (k in x.newData && x.oldData[k] !== x.newData[k]) changes.push(`${monthOf(x.oldData[k]) ?? "—"} → ${monthOf(x.newData[k]) ?? "—"}`);
    }
    if (changes.length) parts.push(changes.join(", "));
  } else {
    const amt = money(d.amount ?? d.total_amount ?? d.monthly_amount);
    if (amt) parts.push(amt);
  }
  return parts.join(" · ");
}

/** Raggruppa le modifiche fatte insieme (a pochi secondi l'una dall'altra) in un'unica operazione. */
export function groupHistory<T extends HistoryLike>(entries: T[], gapMs = 4000): T[][] {
  const sorted = [...entries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id));
  const groups: T[][] = [];
  for (const x of sorted) {
    const g = groups[groups.length - 1];
    const prev = g?.[g.length - 1];
    if (prev && Math.abs(Date.parse(prev.createdAt) - Date.parse(x.createdAt)) <= gapMs && prev.undone === x.undone) g.push(x);
    else groups.push([x]);
  }
  return groups;
}
