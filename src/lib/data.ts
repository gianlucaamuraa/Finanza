import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { periodRange } from "./period";
import type { Month } from "./dates";

const { accounts, allocations, categories, expenses, incomes, investments, investmentContributions, plannedExpenses, settings } = schema;

export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Income = typeof incomes.$inferSelect;
export type Allocation = typeof allocations.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Planned = typeof plannedExpenses.$inferSelect;
export type Investment = typeof investments.$inferSelect;

export async function getSettings() {
  const [s] = await db.select().from(settings).where(eq(settings.id, 1));
  return s ?? { id: 1, payday: 27 };
}

export async function getAccounts(includeArchived = false) {
  return db
    .select()
    .from(accounts)
    .where(includeArchived ? undefined : eq(accounts.archived, false))
    .orderBy(asc(accounts.sortOrder), asc(accounts.id));
}

export async function getCategories(includeArchived = false) {
  return db
    .select()
    .from(categories)
    .where(includeArchived ? undefined : eq(categories.archived, false))
    .orderBy(asc(categories.sortOrder), asc(categories.id));
}

/** Entrate, ripartizioni e uscite di un periodo. */
export async function getPeriod(period: Month, payday: number) {
  const range = periodRange(period, payday);
  const [inc, alloc, exp] = await Promise.all([
    db.select().from(incomes).where(eq(incomes.period, period)).orderBy(asc(incomes.date), asc(incomes.id)),
    db.select().from(allocations).where(eq(allocations.period, period)).orderBy(desc(allocations.amount), asc(allocations.id)),
    db
      .select()
      .from(expenses)
      .where(and(gte(expenses.date, range.start), lte(expenses.date, range.end)))
      .orderBy(desc(expenses.date), desc(expenses.id)),
  ]);
  return { range, incomes: inc, allocations: alloc, expenses: exp };
}

/** Saldo di ogni conto: saldo iniziale + ripartizioni ricevute − uscite. */
export async function getBalances(): Promise<Map<number, number>> {
  const [a, e, accs] = await Promise.all([
    db.select({ id: allocations.accountId, v: sql<number>`sum(${allocations.amount})::int` }).from(allocations).groupBy(allocations.accountId),
    db.select({ id: expenses.accountId, v: sql<number>`sum(${expenses.amount})::int` }).from(expenses).groupBy(expenses.accountId),
    db.select({ id: accounts.id, v: accounts.initialBalance }).from(accounts),
  ]);
  const m = new Map<number, number>();
  for (const r of accs) m.set(r.id, r.v);
  for (const r of a) m.set(r.id, (m.get(r.id) ?? 0) + r.v);
  for (const r of e) m.set(r.id, (m.get(r.id) ?? 0) - r.v);
  return m;
}

export async function getPlanned() {
  const [list, spent] = await Promise.all([
    db.select().from(plannedExpenses).orderBy(asc(plannedExpenses.endMonth), asc(plannedExpenses.id)),
    db
      .select({ id: expenses.plannedExpenseId, v: sql<number>`sum(${expenses.amount})::int` })
      .from(expenses)
      .where(sql`${expenses.plannedExpenseId} is not null`)
      .groupBy(expenses.plannedExpenseId),
  ]);
  const spentMap = new Map(spent.map((r) => [r.id!, r.v]));
  return list.map((p) => ({ ...p, spent: spentMap.get(p.id) ?? 0 }));
}

/** Investimenti con versamenti registrati e ripartizioni verso il conto collegato (per mese). */
export async function getInvestments() {
  const list = await db.select().from(investments).orderBy(asc(investments.id));
  if (list.length === 0) return [];
  const ids = list.map((i) => i.id);
  const accIds = list.map((i) => i.accountId).filter((x): x is number => x != null);
  const [contribs, linked] = await Promise.all([
    db.select().from(investmentContributions).where(inArray(investmentContributions.investmentId, ids)),
    accIds.length
      ? db
          .select({ accountId: allocations.accountId, period: allocations.period, v: sql<number>`sum(${allocations.amount})::int` })
          .from(allocations)
          .where(inArray(allocations.accountId, accIds))
          .groupBy(allocations.accountId, allocations.period)
      : Promise.resolve([] as { accountId: number; period: string; v: number }[]),
  ]);
  return list.map((inv) => ({
    ...inv,
    recorded: new Map(contribs.filter((c) => c.investmentId === inv.id).map((c) => [c.month, c.amount])),
    linked: new Map(
      inv.accountId == null ? [] : linked.filter((l) => l.accountId === inv.accountId).map((l) => [l.period, l.v]),
    ),
  }));
}
export type InvestmentWithData = Awaited<ReturnType<typeof getInvestments>>[number];

/** Totale uscite di un periodo (per confronto col precedente). */
export async function getSpentInRange(start: string, end: string) {
  const [r] = await db
    .select({ v: sql<number>`coalesce(sum(${expenses.amount}),0)::int` })
    .from(expenses)
    .where(and(gte(expenses.date, start), lte(expenses.date, end)));
  return r.v;
}
