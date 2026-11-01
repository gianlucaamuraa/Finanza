"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db, resetDb, schema } from "@/db";
import { checkPassword, endSession, requireAuth, startSession } from "@/lib/auth";
import { addMonths, daysInMonth, isDay, isMonth, monthIndex } from "@/lib/dates";
import { parseAmount } from "@/lib/money";
import { ACCOUNT_ICONS, CATEGORY_ICONS, PLANNED_ICONS, ACCOUNT_COLORS } from "@/lib/icon-keys";

const { accounts, allocations, categories, expenses, incomes, investments, investmentContributions, plannedExpenses, settings } = schema;

export type ActionState = { ok: boolean; error?: string } | null;

class InputError extends Error {}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optId = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (!v) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new InputError("Valore non valido");
  return n;
};
const reqId = (fd: FormData, k: string, msg: string) => {
  const v = optId(fd, k);
  if (v == null) throw new InputError(msg);
  return v;
};
const amount = (fd: FormData, k: string, { allowZero = false, allowNegative = false } = {}) => {
  const v = parseAmount(str(fd, k));
  if (v == null) throw new InputError("Inserisci un importo valido");
  if (!allowNegative && v < 0) throw new InputError("L'importo non può essere negativo");
  if (!allowZero && v === 0) throw new InputError("L'importo deve essere maggiore di zero");
  return v;
};
const month = (fd: FormData, k: string, msg = "Mese non valido") => {
  const v = str(fd, k);
  if (!isMonth(v)) throw new InputError(msg);
  return v;
};
const day = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (!isDay(v)) throw new InputError("Data non valida");
  return v;
};
const name = (fd: FormData, k = "name") => {
  const v = str(fd, k);
  if (!v) throw new InputError("Inserisci un nome");
  if (v.length > 80) throw new InputError("Nome troppo lungo");
  return v;
};
const oneOf = <T extends string>(v: string, list: readonly T[], fallback: T): T =>
  (list as readonly string[]).includes(v) ? (v as T) : fallback;

async function run(fn: () => Promise<void>): Promise<ActionState> {
  await requireAuth();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "TIMEOUT" })), 8000);
      }),
    ]);
  } catch (e) {
    if (e instanceof InputError) return { ok: false, error: e.message };
    if ((e as { code?: string })?.code === "TIMEOUT") {
      resetDb();
      return { ok: false, error: "Il database non ha risposto. Tocca di nuovo Salva." };
    }
    console.error(e);
    return { ok: false, error: "Si è verificato un errore. Riprova." };
  } finally {
    clearTimeout(timer);
  }
  refresh();
  return { ok: true };
}

// ---------- Accesso ----------

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const password = String(fd.get("password") ?? "");
  if (!process.env.APP_PASSWORD || (process.env.AUTH_SECRET ?? "").length < 32)
    return { ok: false, error: "Configurazione incompleta: controlla APP_PASSWORD e AUTH_SECRET su Vercel (vedi il riquadro sopra)." };
  if (!password || !checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 600)); // rallenta i tentativi
    return { ok: false, error: "Password errata" };
  }
  await startSession();
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

// ---------- Entrate ----------

export async function saveIncome(_: ActionState, fd: FormData) {
  return run(async () => {
    const values = {
      period: month(fd, "period"),
      date: day(fd, "date"),
      description: str(fd, "description") || "Stipendio",
      amount: amount(fd, "amount"),
    };
    const id = optId(fd, "id");
    if (id) await db.update(incomes).set(values).where(eq(incomes.id, id));
    else await db.insert(incomes).values(values);
  });
}

export async function deleteIncome(id: number) {
  return run(async () => {
    await db.delete(incomes).where(eq(incomes.id, id));
  });
}

// ---------- Ripartizione ----------

export async function saveAllocation(_: ActionState, fd: FormData) {
  return run(async () => {
    const values = {
      period: month(fd, "period"),
      accountId: reqId(fd, "accountId", "Scegli un conto"),
      amount: amount(fd, "amount"),
      note: str(fd, "note") || null,
    };
    const id = optId(fd, "id");
    if (id) await db.update(allocations).set(values).where(eq(allocations.id, id));
    else await db.insert(allocations).values(values);
  });
}

export async function deleteAllocation(id: number) {
  return run(async () => {
    await db.delete(allocations).where(eq(allocations.id, id));
  });
}

/** Copia entrate (se mancanti) e ripartizione dal periodo precedente. */
export async function copyPreviousPeriod(period: string) {
  return run(async () => {
    if (!isMonth(period)) throw new InputError("Mese non valido");
    const prev = addMonths(period, -1);
    const [prevAlloc, prevInc, curAlloc, curInc] = await Promise.all([
      db.select().from(allocations).where(eq(allocations.period, prev)),
      db.select().from(incomes).where(eq(incomes.period, prev)),
      db.select({ id: allocations.id }).from(allocations).where(eq(allocations.period, period)),
      db.select({ id: incomes.id }).from(incomes).where(eq(incomes.period, period)),
    ]);
    if (prevAlloc.length === 0 && prevInc.length === 0) throw new InputError("Il mese precedente è vuoto");
    if (curAlloc.length > 0) throw new InputError("Questo mese ha già una ripartizione");
    await db.transaction(async (tx) => {
      if (curInc.length === 0 && prevInc.length > 0) {
        await tx.insert(incomes).values(
          prevInc.map((i) => {
            // stessa data, spostata di un mese
            const nm = addMonths(i.date.slice(0, 7), 1);
            const dd = Math.min(Number(i.date.slice(8)), daysInMonth(nm));
            return { period, date: `${nm}-${String(dd).padStart(2, "0")}`, description: i.description, amount: i.amount };
          }),
        );
      }
      if (prevAlloc.length > 0)
        await tx.insert(allocations).values(prevAlloc.map((a) => ({ period, accountId: a.accountId, amount: a.amount, note: a.note })));
    });
  });
}

// ---------- Uscite ----------

export async function saveExpense(_: ActionState, fd: FormData) {
  return run(async () => {
    const values = {
      date: day(fd, "date"),
      accountId: reqId(fd, "accountId", "Scegli un conto"),
      categoryId: optId(fd, "categoryId"),
      plannedExpenseId: optId(fd, "plannedExpenseId"),
      amount: amount(fd, "amount"),
      description: str(fd, "description").slice(0, 120),
    };
    const id = optId(fd, "id");
    if (id) await db.update(expenses).set(values).where(eq(expenses.id, id));
    else await db.insert(expenses).values(values);
  });
}

export async function deleteExpense(id: number) {
  return run(async () => {
    await db.delete(expenses).where(eq(expenses.id, id));
  });
}

// ---------- Spese prevedibili ----------

export async function savePlanned(_: ActionState, fd: FormData) {
  return run(async () => {
    const values = {
      name: name(fd),
      icon: oneOf(str(fd, "icon"), PLANNED_ICONS, "calendar-clock"),
      totalAmount: amount(fd, "totalAmount"),
      startMonth: month(fd, "startMonth", "Mese di inizio non valido"),
      endMonth: month(fd, "endMonth", "Mese di fine non valido"),
      note: str(fd, "note") || null,
    };
    if (monthIndex(values.endMonth) < monthIndex(values.startMonth))
      throw new InputError("Il mese di fine deve essere uguale o successivo a quello di inizio");
    const id = optId(fd, "id");
    if (id) await db.update(plannedExpenses).set(values).where(eq(plannedExpenses.id, id));
    else await db.insert(plannedExpenses).values(values);
  });
}

export async function deletePlanned(id: number) {
  return run(async () => {
    await db.delete(plannedExpenses).where(eq(plannedExpenses.id, id));
  });
}

// ---------- Lungo termine ----------

export async function saveInvestment(_: ActionState, fd: FormData) {
  return run(async () => {
    const end = str(fd, "endMonth");
    const values = {
      name: name(fd),
      monthlyAmount: amount(fd, "monthlyAmount"),
      startMonth: month(fd, "startMonth", "Mese di inizio non valido"),
      endMonth: end ? month(fd, "endMonth", "Mese di fine non valido") : null,
      accountId: optId(fd, "accountId"),
    };
    if (values.endMonth && monthIndex(values.endMonth) < monthIndex(values.startMonth))
      throw new InputError("Il mese di fine deve essere successivo a quello di inizio");
    const id = optId(fd, "id");
    if (id) await db.update(investments).set(values).where(eq(investments.id, id));
    else await db.insert(investments).values(values);
  });
}

export async function deleteInvestment(id: number) {
  return run(async () => {
    await db.delete(investments).where(eq(investments.id, id));
  });
}

export async function saveContribution(_: ActionState, fd: FormData) {
  return run(async () => {
    const investmentId = reqId(fd, "investmentId", "Investimento mancante");
    const m = month(fd, "month");
    const v = amount(fd, "amount", { allowZero: true });
    await db
      .insert(investmentContributions)
      .values({ investmentId, month: m, amount: v })
      .onConflictDoUpdate({ target: [investmentContributions.investmentId, investmentContributions.month], set: { amount: v } });
  });
}

/** Registra il versamento mensile previsto per tutti i mesi passati senza versamento. */
export async function fillMissingContributions(investmentId: number, current: string) {
  return run(async () => {
    if (!isMonth(current)) throw new InputError("Mese non valido");
    const [inv] = await db.select().from(investments).where(eq(investments.id, investmentId));
    if (!inv) throw new InputError("Investimento non trovato");
    const recorded = new Set(
      (await db.select({ m: investmentContributions.month }).from(investmentContributions).where(eq(investmentContributions.investmentId, investmentId))).map((r) => r.m),
    );
    const linked = new Set(
      inv.accountId == null
        ? []
        : (await db.selectDistinct({ m: allocations.period }).from(allocations).where(eq(allocations.accountId, inv.accountId))).map((r) => r.m),
    );
    const last = inv.endMonth && monthIndex(inv.endMonth) < monthIndex(current) ? inv.endMonth : addMonths(current, -1);
    const rows: { investmentId: number; month: string; amount: number }[] = [];
    for (let m = inv.startMonth; monthIndex(m) <= monthIndex(last); m = addMonths(m, 1))
      if (!recorded.has(m) && !linked.has(m)) rows.push({ investmentId, month: m, amount: inv.monthlyAmount });
    if (rows.length) await db.insert(investmentContributions).values(rows).onConflictDoNothing();
  });
}

/** Rimuove il versamento registrato: il mese torna "pianificato" o "da movimenti". */
export async function deleteContribution(investmentId: number, m: string) {
  return run(async () => {
    if (!isMonth(m)) throw new InputError("Mese non valido");
    await db
      .delete(investmentContributions)
      .where(and(eq(investmentContributions.investmentId, investmentId), eq(investmentContributions.month, m)));
  });
}

// ---------- Conti ----------

export async function saveAccount(_: ActionState, fd: FormData) {
  return run(async () => {
    const values = {
      name: name(fd),
      kind: oneOf(str(fd, "kind"), ["corrente", "risparmio", "contanti", "investimento", "altro"] as const, "corrente"),
      icon: oneOf(str(fd, "icon"), ACCOUNT_ICONS, "landmark"),
      color: oneOf(str(fd, "color"), ACCOUNT_COLORS, ACCOUNT_COLORS[0]),
      initialBalance: str(fd, "initialBalance") ? amount(fd, "initialBalance", { allowZero: true, allowNegative: true }) : 0,
      includeInQuota: fd.get("includeInQuota") === "on",
    };
    const id = optId(fd, "id");
    if (id) await db.update(accounts).set(values).where(eq(accounts.id, id));
    else {
      const [{ n }] = await db.select({ n: sql<number>`coalesce(max(${accounts.sortOrder}),0)::int` }).from(accounts);
      await db.insert(accounts).values({ ...values, sortOrder: n + 1 });
    }
  });
}

export async function setAccountArchived(id: number, archived: boolean) {
  return run(async () => {
    await db.update(accounts).set({ archived }).where(eq(accounts.id, id));
  });
}

export async function deleteAccount(id: number) {
  return run(async () => {
    const [[a], [e]] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(allocations).where(eq(allocations.accountId, id)),
      db.select({ n: sql<number>`count(*)::int` }).from(expenses).where(eq(expenses.accountId, id)),
    ]);
    if (a.n + e.n > 0) throw new InputError("Il conto ha dei movimenti: puoi solo archiviarlo");
    await db.delete(accounts).where(eq(accounts.id, id));
  });
}

// ---------- Categorie ----------

export async function saveCategory(_: ActionState, fd: FormData) {
  return run(async () => {
    const values = { name: name(fd), icon: oneOf(str(fd, "icon"), CATEGORY_ICONS, "tag") };
    const id = optId(fd, "id");
    if (id) await db.update(categories).set(values).where(eq(categories.id, id));
    else {
      const [{ n }] = await db.select({ n: sql<number>`coalesce(max(${categories.sortOrder}),0)::int` }).from(categories);
      await db.insert(categories).values({ ...values, sortOrder: n + 1 });
    }
  });
}

export async function deleteCategory(id: number) {
  return run(async () => {
    await db.delete(categories).where(eq(categories.id, id));
  });
}

// ---------- Impostazioni ----------

export async function saveSettings(_: ActionState, fd: FormData) {
  return run(async () => {
    const payday = Number(str(fd, "payday"));
    if (!Number.isInteger(payday) || payday < 1 || payday > 31) throw new InputError("Giorno non valido (1–31)");
    await db.insert(settings).values({ id: 1, payday }).onConflictDoUpdate({ target: settings.id, set: { payday } });
    const quotaIds = fd.getAll("quotaAccount").map(Number).filter(Number.isInteger);
    if (fd.get("quotaForm") === "1") {
      await db.update(accounts).set({ includeInQuota: false });
      if (quotaIds.length)
        await db.update(accounts).set({ includeInQuota: true }).where(inArray(accounts.id, quotaIds));
    }
  });
}
