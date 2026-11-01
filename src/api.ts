// Accesso ai dati su Supabase: letture e salvataggi.
// La sicurezza è garantita dalle regole RLS nel database (ognuno vede solo i propri dati).

import { sb } from "./supabase";
import { queryClient } from "./queryClient";
import { periodRange } from "./lib/period";
import { addMonths, daysInMonth, isDay, isMonth, monthIndex, type Month } from "./lib/dates";
import { parseAmount } from "./lib/money";
import { equalSplit, plannedAmount, type Installment } from "./lib/calc";
import { ACCOUNT_COLORS, ACCOUNT_ICONS, CATEGORY_ICONS, PLANNED_ICONS } from "./lib/icon-keys";

// ---------------- Tipi ----------------

export type Account = {
  id: number; name: string; kind: string; icon: string; color: string; initialBalance: number;
  includeInQuota: boolean; excludeFromNetWorth: boolean; archived: boolean; sortOrder: number;
};
export type Category = { id: number; name: string; icon: string; archived: boolean; sortOrder: number };
export type Income = { id: number; period: Month; date: string; description: string; amount: number };
export type Allocation = { id: number; period: Month; accountId: number; amount: number; note: string | null };
export type Expense = {
  id: number; date: string; accountId: number; categoryId: number | null; plannedExpenseId: number | null;
  amount: number; description: string;
};
export type Planned = {
  id: number; name: string; icon: string; totalAmount: number; startMonth: Month; endMonth: Month; note: string | null; spent: number;
  /** rate mese -> importo previsto e importo versato (null = non versata) */
  installments: Map<Month, Installment>;
};
export type Investment = {
  id: number; name: string; monthlyAmount: number; annualIncrease: number; startMonth: Month; endMonth: Month | null; accountId: number | null;
  recorded: Map<Month, number>; linked: Map<Month, number>;
};

type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v);
const s = (v: unknown) => (v == null ? "" : String(v));
const ns = (v: unknown) => (v == null ? null : String(v));
const nn = (v: unknown) => (v == null ? null : Number(v));

const toAccount = (r: Row): Account => ({
  id: n(r.id), name: s(r.name), kind: s(r.kind), icon: s(r.icon), color: s(r.color), initialBalance: n(r.initial_balance),
  includeInQuota: !!r.include_in_quota, excludeFromNetWorth: !!r.exclude_from_net_worth, archived: !!r.archived, sortOrder: n(r.sort_order),
});
const toCategory = (r: Row): Category => ({ id: n(r.id), name: s(r.name), icon: s(r.icon), archived: !!r.archived, sortOrder: n(r.sort_order) });
const toIncome = (r: Row): Income => ({ id: n(r.id), period: s(r.period), date: s(r.date), description: s(r.description), amount: n(r.amount) });
const toAllocation = (r: Row): Allocation => ({ id: n(r.id), period: s(r.period), accountId: n(r.account_id), amount: n(r.amount), note: ns(r.note) });
const toExpense = (r: Row): Expense => ({
  id: n(r.id), date: s(r.date), accountId: n(r.account_id), categoryId: nn(r.category_id), plannedExpenseId: nn(r.planned_expense_id),
  amount: n(r.amount), description: s(r.description),
});

/** Messaggio leggibile per un errore di Supabase o di rete. */
export function friendlyError(e: unknown): string {
  const err = e as { message?: string; code?: string };
  const msg = err?.message ?? String(e);
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return "Connessione assente: controlla internet e riprova.";
  if (err?.code === "42501" || /row-level security/i.test(msg)) return "Permesso negato dal database: esegui lo script supabase/setup.sql.";
  if (err?.code === "PGRST205" || err?.code === "42P01") return "Tabella non trovata: esegui lo script supabase/setup.sql in Supabase.";
  if (/jwt|token/i.test(msg)) return "Sessione scaduta: esci e rientra.";
  return msg;
}

async function q<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

// ---------------- Letture ----------------

const DEFAULT_CATEGORIES: [string, string][] = [
  ["Spesa", "shopping-cart"], ["Casa e bollette", "lightbulb"], ["Trasporti", "fuel"], ["Ristoranti e bar", "utensils"],
  ["Shopping", "shopping-bag"], ["Abbonamenti", "tv"], ["Salute", "pill"], ["Svago", "clapperboard"],
];

/** Impostazioni dell'utente; al primo accesso crea impostazioni, categorie e conti di partenza. */
export async function getSettings(): Promise<{ payday: number }> {
  const rows = await q<Row[]>(sb().from("settings").select("payday").limit(1));
  if (rows.length) return { payday: n(rows[0].payday) };
  // primo accesso
  await q(sb().from("settings").insert({ payday: 27 }));
  const cats = await q<Row[]>(sb().from("categories").select("id").limit(1));
  if (!cats.length) await q(sb().from("categories").insert(DEFAULT_CATEGORIES.map(([name, icon], i) => ({ name, icon, sort_order: i }))));
  const accs = await q<Row[]>(sb().from("accounts").select("id").limit(1));
  if (!accs.length)
    await q(sb().from("accounts").insert([
      { name: "Conto corrente", kind: "corrente", icon: "landmark", color: "#2563eb", include_in_quota: true, sort_order: 0 },
      { name: "Contanti", kind: "contanti", icon: "banknote", color: "#db2777", include_in_quota: true, sort_order: 1 },
    ]));
  // le altre letture potrebbero essere partite prima della creazione dei dati iniziali
  void queryClient.invalidateQueries({ predicate: (x) => x.queryKey[0] !== "settings" });
  return { payday: 27 };
}

export async function getAccounts(): Promise<Account[]> {
  const rows = await q<Row[]>(sb().from("accounts").select("*").order("sort_order").order("id"));
  return rows.map(toAccount);
}

export async function getCategories(): Promise<Category[]> {
  const rows = await q<Row[]>(sb().from("categories").select("*").order("sort_order").order("id"));
  return rows.map(toCategory);
}

export async function getPeriod(period: Month, payday: number) {
  const range = periodRange(period, payday);
  const [inc, alloc, exp] = await Promise.all([
    q<Row[]>(sb().from("incomes").select("*").eq("period", period).order("date").order("id")),
    q<Row[]>(sb().from("allocations").select("*").eq("period", period).order("amount", { ascending: false }).order("id")),
    q<Row[]>(sb().from("expenses").select("*").gte("date", range.start).lte("date", range.end).order("date", { ascending: false }).order("id", { ascending: false })),
  ]);
  return { range, incomes: inc.map(toIncome), allocations: alloc.map(toAllocation), expenses: exp.map(toExpense) };
}
export type PeriodData = Awaited<ReturnType<typeof getPeriod>>;

export async function getBalances(): Promise<Map<number, number>> {
  const rows = await q<Row[]>(sb().from("account_balances").select("account_id,balance"));
  return new Map(rows.map((r) => [n(r.account_id), n(r.balance)]));
}

export async function getPlanned(): Promise<Planned[]> {
  const [list, spent, inst] = await Promise.all([
    q<Row[]>(sb().from("planned_expenses").select("*").order("end_month").order("id")),
    q<Row[]>(sb().from("planned_spent").select("planned_expense_id,spent")),
    q<Row[]>(sb().from("planned_installments").select("planned_expense_id,month,amount,paid_amount").order("month")),
  ]);
  const sp = new Map(spent.map((r) => [n(r.planned_expense_id), n(r.spent)]));
  return list.map((r) => ({
    id: n(r.id), name: s(r.name), icon: s(r.icon), totalAmount: n(r.total_amount), startMonth: s(r.start_month), endMonth: s(r.end_month),
    note: ns(r.note), spent: sp.get(n(r.id)) ?? 0,
    installments: new Map(
      inst.filter((x) => n(x.planned_expense_id) === n(r.id)).map((x) => [s(x.month), { amount: n(x.amount), paid: nn(x.paid_amount) }]),
    ),
  }));
}

export async function getInvestments(): Promise<Investment[]> {
  const list = await q<Row[]>(sb().from("investments").select("*").order("id"));
  if (!list.length) return [];
  const accIds = list.map((r) => nn(r.account_id)).filter((x): x is number => x != null);
  const [contribs, linked] = await Promise.all([
    q<Row[]>(sb().from("investment_contributions").select("investment_id,month,amount")),
    accIds.length ? q<Row[]>(sb().from("allocation_totals").select("account_id,period,total").in("account_id", accIds)) : Promise.resolve([] as Row[]),
  ]);
  return list.map((r) => ({
    id: n(r.id), name: s(r.name), monthlyAmount: n(r.monthly_amount), annualIncrease: n(r.annual_increase ?? 0), startMonth: s(r.start_month), endMonth: ns(r.end_month), accountId: nn(r.account_id),
    recorded: new Map(contribs.filter((c) => n(c.investment_id) === n(r.id)).map((c) => [s(c.month), n(c.amount)])),
    linked: new Map(r.account_id == null ? [] : linked.filter((l) => n(l.account_id) === n(r.account_id)).map((l) => [s(l.period), n(l.total)])),
  }));
}

export async function getSpentInRange(start: string, end: string): Promise<number> {
  const rows = await q<Row[]>(sb().from("expenses").select("amount").gte("date", start).lte("date", end));
  return rows.reduce((a, r) => a + n(r.amount), 0);
}

// ---------------- Salvataggi ----------------

export type ActionState = { ok: boolean; error?: string } | null;
class InputError extends Error {}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optId = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (!v) return null;
  const x = Number(v);
  if (!Number.isInteger(x) || x <= 0) throw new InputError("Valore non valido");
  return x;
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
const oneOf = <T extends string>(v: string, list: readonly T[], fallback: T): T => ((list as readonly string[]).includes(v) ? (v as T) : fallback);

async function run(fn: () => Promise<void>): Promise<ActionState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof InputError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: friendlyError(e) };
  }
  await queryClient.invalidateQueries();
  return { ok: true };
}

/** Inserisce o aggiorna una riga (id presente = modifica). */
async function save(table: string, id: number | null, values: Row) {
  if (id) await q(sb().from(table).update(values).eq("id", id));
  else await q(sb().from(table).insert(values));
}
const remove = (table: string, id: number) => run(async () => { await q(sb().from(table).delete().eq("id", id)); });

// Entrate
export const saveIncome = (fd: FormData) => run(() =>
  save("incomes", optId(fd, "id"), {
    period: month(fd, "period"), date: day(fd, "date"), description: str(fd, "description") || "Stipendio", amount: amount(fd, "amount"),
  }));
export const deleteIncome = (id: number) => remove("incomes", id);

// Ripartizione
export const saveAllocation = (fd: FormData) => run(() =>
  save("allocations", optId(fd, "id"), {
    period: month(fd, "period"), account_id: reqId(fd, "accountId", "Scegli un conto"),
    amount: amount(fd, "amount", { allowNegative: true }), note: str(fd, "note") || null,
  }));
export const deleteAllocation = (id: number) => remove("allocations", id);

export const copyPreviousPeriod = (period: string) => run(async () => {
  if (!isMonth(period)) throw new InputError("Mese non valido");
  const prev = addMonths(period, -1);
  const [prevAlloc, prevInc, curAlloc, curInc] = await Promise.all([
    q<Row[]>(sb().from("allocations").select("*").eq("period", prev)),
    q<Row[]>(sb().from("incomes").select("*").eq("period", prev)),
    q<Row[]>(sb().from("allocations").select("id").eq("period", period).limit(1)),
    q<Row[]>(sb().from("incomes").select("id").eq("period", period).limit(1)),
  ]);
  if (!prevAlloc.length && !prevInc.length) throw new InputError("Il mese precedente è vuoto");
  if (curAlloc.length) throw new InputError("Questo mese ha già una ripartizione");
  if (!curInc.length && prevInc.length)
    await q(sb().from("incomes").insert(prevInc.map((i) => {
      const nm = addMonths(s(i.date).slice(0, 7), 1);
      const dd = Math.min(Number(s(i.date).slice(8)), daysInMonth(nm));
      return { period, date: `${nm}-${String(dd).padStart(2, "0")}`, description: i.description, amount: i.amount };
    })));
  if (prevAlloc.length)
    await q(sb().from("allocations").insert(prevAlloc.map((a) => ({ period, account_id: a.account_id, amount: a.amount, note: a.note }))));
});

// Uscite
export const saveExpense = (fd: FormData) => run(() =>
  save("expenses", optId(fd, "id"), {
    date: day(fd, "date"), account_id: reqId(fd, "accountId", "Scegli un conto"), category_id: optId(fd, "categoryId"),
    planned_expense_id: optId(fd, "plannedExpenseId"), amount: amount(fd, "amount"), description: str(fd, "description").slice(0, 120),
  }));
export const deleteExpense = (id: number) => remove("expenses", id);

// Spese prevedibili
const monthsFrom = (a: Month, b: Month) => {
  const out: Month[] = [];
  for (let m = a; monthIndex(m) <= monthIndex(b) && out.length < 600; m = addMonths(m, 1)) out.push(m);
  return out;
};

/** Salva le rate di una spesa: aggiorna gli importi, mantiene i versamenti già segnati, toglie i mesi rimossi. */
async function writeInstallments(plannedId: number, amounts: Map<Month, number>) {
  const existing = await q<Row[]>(sb().from("planned_installments").select("month").eq("planned_expense_id", plannedId));
  for (const r of existing)
    if (!amounts.has(s(r.month))) await q(sb().from("planned_installments").delete().eq("planned_expense_id", plannedId).eq("month", s(r.month)));
  if (amounts.size)
    await q(sb().from("planned_installments").upsert(
      [...amounts].map(([month, amount]) => ({ planned_expense_id: plannedId, month, amount })),
      { onConflict: "planned_expense_id,month" },
    ));
}

export const savePlanned = (fd: FormData) => run(async () => {
  const start = month(fd, "startMonth", "Mese di inizio non valido");
  const end = month(fd, "endMonth", "Mese di fine non valido");
  if (monthIndex(end) < monthIndex(start)) throw new InputError("Il mese di fine deve essere uguale o successivo a quello di inizio");
  const months = monthsFrom(start, end);
  let amounts: Map<Month, number>;
  if (fd.get("custom") === "1") {
    // rate personalizzate: un importo per mese (i mesi a zero non hanno rata)
    amounts = new Map();
    for (const m of months) {
      const v = parseAmount(str(fd, `rata_${m}`) || "0");
      if (v == null || v < 0) throw new InputError(`Importo non valido per ${m}`);
      if (v > 0) amounts.set(m, v);
    }
    if (!amounts.size) throw new InputError("Inserisci almeno una rata");
  } else amounts = equalSplit(amount(fd, "totalAmount"), months);
  const v = {
    name: name(fd), icon: oneOf(str(fd, "icon"), PLANNED_ICONS, "calendar-clock"),
    total_amount: [...amounts.values()].reduce((a, x) => a + x, 0),
    start_month: start, end_month: end, note: str(fd, "note") || null,
  };
  let id = optId(fd, "id");
  if (id) await q(sb().from("planned_expenses").update(v).eq("id", id));
  else id = n((await q<Row[]>(sb().from("planned_expenses").insert(v).select("id")))[0].id);
  await writeInstallments(id, amounts);
});

/** Segna una rata come versata (con l'importo versato) o, con paid = null, come non versata. */
export const payInstallment = (p: Planned, m: Month, fd: FormData | null) => run(async () => {
  const paid = fd ? amount(fd, "paid") : null;
  if (p.installments.size === 0) {
    // spesa senza rate salvate: prima si creano le rate uguali
    await writeInstallments(p.id, equalSplit(p.totalAmount, monthsFrom(p.startMonth, p.endMonth)));
  }
  await q(sb().from("planned_installments").update({ paid_amount: paid }).eq("planned_expense_id", p.id).eq("month", m));
});

export const deletePlanned = (id: number) => remove("planned_expenses", id);

// Lungo termine
export const saveInvestment = (fd: FormData) => run(async () => {
  const end = str(fd, "endMonth");
  const v = {
    name: name(fd), monthly_amount: amount(fd, "monthlyAmount"),
    annual_increase: str(fd, "annualIncrease") ? amount(fd, "annualIncrease", { allowZero: true }) : 0,
    start_month: month(fd, "startMonth", "Mese di inizio non valido"),
    end_month: end ? month(fd, "endMonth", "Mese di fine non valido") : null, account_id: optId(fd, "accountId"),
  };
  if (v.end_month && monthIndex(v.end_month) < monthIndex(v.start_month)) throw new InputError("Il mese di fine deve essere successivo a quello di inizio");
  await save("investments", optId(fd, "id"), v);
});
export const deleteInvestment = (id: number) => remove("investments", id);

export const saveContribution = (fd: FormData) => run(async () => {
  const investment_id = reqId(fd, "investmentId", "Investimento mancante");
  await q(sb().from("investment_contributions").upsert(
    { investment_id, month: month(fd, "month"), amount: amount(fd, "amount", { allowZero: true }) },
    { onConflict: "investment_id,month" },
  ));
});
export const deleteContribution = (investmentId: number, m: string) => run(async () => {
  if (!isMonth(m)) throw new InputError("Mese non valido");
  await q(sb().from("investment_contributions").delete().eq("investment_id", investmentId).eq("month", m));
});

/** Registra il versamento previsto per tutti i mesi passati senza versamento. */
export const fillMissingContributions = (inv: Investment, current: Month) => run(async () => {
  const last = inv.endMonth && monthIndex(inv.endMonth) < monthIndex(current) ? inv.endMonth : addMonths(current, -1);
  const rows: Row[] = [];
  for (let m = inv.startMonth; monthIndex(m) <= monthIndex(last); m = addMonths(m, 1))
    if (!inv.recorded.has(m) && !inv.linked.has(m)) rows.push({ investment_id: inv.id, month: m, amount: plannedAmount(inv, m) });
  if (rows.length) await q(sb().from("investment_contributions").upsert(rows, { onConflict: "investment_id,month", ignoreDuplicates: true }));
});

// Conti
export const saveAccount = (fd: FormData) => run(async () => {
  const v: Row = {
    name: name(fd),
    kind: oneOf(str(fd, "kind"), ["corrente", "risparmio", "contanti", "investimento", "altro"] as const, "corrente"),
    icon: oneOf(str(fd, "icon"), ACCOUNT_ICONS, "landmark"),
    color: oneOf(str(fd, "color"), ACCOUNT_COLORS, ACCOUNT_COLORS[0]),
    // "Saldo attuale": il saldo iniziale si ricava togliendo l'effetto dei movimenti già registrati
    initial_balance:
      (str(fd, "currentBalance") ? amount(fd, "currentBalance", { allowZero: true, allowNegative: true }) : 0) -
      Number(str(fd, "movementsNet") || 0),
    include_in_quota: fd.get("includeInQuota") === "on",
    exclude_from_net_worth: fd.get("excludeFromNetWorth") === "on",
  };
  const id = optId(fd, "id");
  if (!id) {
    const last = await q<Row[]>(sb().from("accounts").select("sort_order").order("sort_order", { ascending: false }).limit(1));
    v.sort_order = (last.length ? n(last[0].sort_order) : 0) + 1;
  }
  await save("accounts", id, v);
});
export const setAccountArchived = (id: number, archived: boolean) => run(async () => {
  await q(sb().from("accounts").update({ archived }).eq("id", id));
});
export const deleteAccount = (id: number) => run(async () => {
  const [a, e] = await Promise.all([
    q<Row[]>(sb().from("allocations").select("id").eq("account_id", id).limit(1)),
    q<Row[]>(sb().from("expenses").select("id").eq("account_id", id).limit(1)),
  ]);
  if (a.length || e.length) throw new InputError("Il conto ha dei movimenti: puoi solo archiviarlo");
  await q(sb().from("accounts").delete().eq("id", id));
});

// Categorie
export const saveCategory = (fd: FormData) => run(async () => {
  const v: Row = { name: name(fd), icon: oneOf(str(fd, "icon"), CATEGORY_ICONS, "tag") };
  const id = optId(fd, "id");
  if (!id) {
    const last = await q<Row[]>(sb().from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1));
    v.sort_order = (last.length ? n(last[0].sort_order) : 0) + 1;
  }
  await save("categories", id, v);
});
export const deleteCategory = (id: number) => remove("categories", id);

// Impostazioni
export const saveSettings = (fd: FormData) => run(async () => {
  const payday = Number(str(fd, "payday"));
  if (!Number.isInteger(payday) || payday < 1 || payday > 31) throw new InputError("Giorno non valido (1–31)");
  const { data: u } = await sb().auth.getUser();
  if (!u.user) throw new InputError("Sessione scaduta: esci e rientra");
  await q(sb().from("settings").upsert({ user_id: u.user.id, payday }, { onConflict: "user_id" }));
  if (fd.get("quotaForm") === "1") {
    const ids = fd.getAll("quotaAccount").map(Number).filter(Number.isInteger);
    const all = await q<Row[]>(sb().from("accounts").select("id"));
    await Promise.all(all.map((r) => q(sb().from("accounts").update({ include_in_quota: ids.includes(n(r.id)) }).eq("id", n(r.id)))));
  }
});

// Accesso
export async function signIn(email: string, password: string): Promise<ActionState> {
  const { error } = await sb().auth.signInWithPassword({ email, password });
  if (!error) return { ok: true };
  if (/invalid login credentials/i.test(error.message)) return { ok: false, error: "Email o password errate" };
  if (/email not confirmed/i.test(error.message)) return { ok: false, error: "Email non confermata: conferma l'utente in Supabase (Authentication -> Users)" };
  return { ok: false, error: friendlyError(error) };
}
export async function signOut() {
  await sb().auth.signOut();
  queryClient.clear();
}
