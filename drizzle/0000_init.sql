CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'corrente' NOT NULL,
	"icon" text DEFAULT 'landmark' NOT NULL,
	"color" text DEFAULT '#2563eb' NOT NULL,
	"initial_balance" integer DEFAULT 0 NOT NULL,
	"include_in_quota" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"period" text NOT NULL,
	"account_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'tag' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"account_id" integer NOT NULL,
	"category_id" integer,
	"planned_expense_id" integer,
	"amount" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incomes" (
	"id" serial PRIMARY KEY NOT NULL,
	"period" text NOT NULL,
	"date" date NOT NULL,
	"description" text DEFAULT 'Stipendio' NOT NULL,
	"amount" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investment_contributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"investment_id" integer NOT NULL,
	"month" text NOT NULL,
	"amount" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"monthly_amount" integer NOT NULL,
	"start_month" text NOT NULL,
	"end_month" text,
	"account_id" integer
);
--> statement-breakpoint
CREATE TABLE "planned_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'calendar-clock' NOT NULL,
	"total_amount" integer NOT NULL,
	"start_month" text NOT NULL,
	"end_month" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"payday" integer DEFAULT 27 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_planned_expense_id_planned_expenses_id_fk" FOREIGN KEY ("planned_expense_id") REFERENCES "public"."planned_expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_contributions" ADD CONSTRAINT "investment_contributions_investment_id_investments_id_fk" FOREIGN KEY ("investment_id") REFERENCES "public"."investments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contribution_unique" ON "investment_contributions" USING btree ("investment_id","month");