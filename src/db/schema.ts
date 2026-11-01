import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Tutti gli importi sono in centesimi (integer). I mesi sono stringhe "YYYY-MM".

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  payday: integer("payday").notNull().default(27),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("corrente"), // corrente | risparmio | contanti | investimento | altro
  icon: text("icon").notNull().default("landmark"),
  color: text("color").notNull().default("#2563eb"),
  initialBalance: integer("initial_balance").notNull().default(0),
  includeInQuota: boolean("include_in_quota").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("tag"),
  archived: boolean("archived").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Entrate del periodo (es. stipendio)
export const incomes = pgTable("incomes", {
  id: serial("id").primaryKey(),
  period: text("period").notNull(),
  date: date("date").notNull(),
  description: text("description").notNull().default("Stipendio"),
  amount: integer("amount").notNull(),
});

// Ripartizione dello stipendio sui conti
export const allocations = pgTable("allocations", {
  id: serial("id").primaryKey(),
  period: text("period").notNull(),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  note: text("note"),
});

export const plannedExpenses = pgTable("planned_expenses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("calendar-clock"),
  totalAmount: integer("total_amount").notNull(),
  startMonth: text("start_month").notNull(),
  endMonth: text("end_month").notNull(),
  note: text("note"),
});

// Uscite
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  plannedExpenseId: integer("planned_expense_id").references(() => plannedExpenses.id, {
    onDelete: "set null",
  }),
  amount: integer("amount").notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Lungo termine (PAC)
export const investments = pgTable("investments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  monthlyAmount: integer("monthly_amount").notNull(),
  startMonth: text("start_month").notNull(),
  endMonth: text("end_month"),
  // Se impostato, i mesi senza versamento registrato usano la ripartizione verso questo conto
  accountId: integer("account_id").references(() => accounts.id, { onDelete: "set null" }),
});

export const investmentContributions = pgTable(
  "investment_contributions",
  {
    id: serial("id").primaryKey(),
    investmentId: integer("investment_id")
      .notNull()
      .references(() => investments.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    amount: integer("amount").notNull(),
  },
  (t) => [uniqueIndex("contribution_unique").on(t.investmentId, t.month)],
);
