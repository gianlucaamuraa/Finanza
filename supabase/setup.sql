-- =====================================================================
-- Finanza: configurazione del database Supabase
--
-- Da eseguire UNA volta in Supabase -> SQL Editor (si può rieseguire senza danni).
-- PRIMA crea il tuo utente in Authentication -> Users -> Add user:
-- tutti i dati già presenti verranno assegnati a quell'utente.
--
-- Cosa fa:
--  1. crea le tabelle se non esistono (sul tuo database esistono già)
--  2. aggiunge a ogni tabella il proprietario (user_id)
--  3. attiva le regole di sicurezza (RLS): ognuno vede solo i propri dati
--  4. crea le viste per saldi e totali
-- =====================================================================

-- 1. Tabelle -----------------------------------------------------------

create table if not exists public.settings (
  id integer primary key default 1,
  payday integer not null default 27
);

create table if not exists public.accounts (
  id serial primary key,
  name text not null,
  kind text not null default 'corrente',
  icon text not null default 'landmark',
  color text not null default '#2563eb',
  initial_balance integer not null default 0,
  include_in_quota boolean not null default false,
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamp not null default now()
);

create table if not exists public.categories (
  id serial primary key,
  name text not null,
  icon text not null default 'tag',
  archived boolean not null default false,
  sort_order integer not null default 0
);

create table if not exists public.incomes (
  id serial primary key,
  period text not null,
  date date not null,
  description text not null default 'Stipendio',
  amount integer not null
);

create table if not exists public.allocations (
  id serial primary key,
  period text not null,
  account_id integer not null references public.accounts(id) on delete cascade,
  amount integer not null,
  note text
);

create table if not exists public.planned_expenses (
  id serial primary key,
  name text not null,
  icon text not null default 'calendar-clock',
  total_amount integer not null,
  start_month text not null,
  end_month text not null,
  note text
);

create table if not exists public.expenses (
  id serial primary key,
  date date not null,
  account_id integer not null references public.accounts(id) on delete cascade,
  category_id integer references public.categories(id) on delete set null,
  planned_expense_id integer references public.planned_expenses(id) on delete set null,
  amount integer not null,
  description text not null default '',
  created_at timestamp not null default now()
);

create table if not exists public.investments (
  id serial primary key,
  name text not null,
  monthly_amount integer not null,
  start_month text not null,
  end_month text,
  account_id integer references public.accounts(id) on delete set null
);

create table if not exists public.investment_contributions (
  id serial primary key,
  investment_id integer not null references public.investments(id) on delete cascade,
  month text not null,
  amount integer not null
);
create unique index if not exists contribution_unique on public.investment_contributions (investment_id, month);

-- 2 + 3. Proprietario e regole di sicurezza ------------------------------

do $$
declare
  t text;
  owner_id uuid := (select id from auth.users order by created_at limit 1);
begin
  if owner_id is null then
    raise exception 'Nessun utente trovato: crea prima il tuo utente in Authentication -> Users -> Add user, poi riesegui lo script.';
  end if;

  foreach t in array array[
    'settings', 'accounts', 'categories', 'incomes', 'allocations',
    'planned_expenses', 'expenses', 'investments', 'investment_contributions'
  ] loop
    execute format('alter table public.%I add column if not exists user_id uuid references auth.users(id) on delete cascade', t);
    execute format('update public.%I set user_id = %L where user_id is null', t, owner_id);
    execute format('alter table public.%I alter column user_id set default auth.uid()', t);
    execute format('alter table public.%I alter column user_id set not null', t);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_id_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo i miei dati" on public.%I', t);
    execute format(
      'create policy "solo i miei dati" on public.%I for all to authenticated '
      'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- settings: una riga per utente (la chiave diventa user_id)
alter table public.settings drop constraint if exists settings_pkey;
alter table public.settings drop column if exists id;
alter table public.settings add primary key (user_id);

-- 4. Viste (rispettano le regole di sicurezza grazie a security_invoker) --

create or replace view public.account_balances with (security_invoker = on) as
select
  a.id as account_id,
  (a.initial_balance
    + coalesce((select sum(x.amount) from public.allocations x where x.account_id = a.id), 0)
    - coalesce((select sum(e.amount) from public.expenses e where e.account_id = a.id), 0))::int as balance
from public.accounts a;

create or replace view public.planned_spent with (security_invoker = on) as
select planned_expense_id, sum(amount)::int as spent
from public.expenses
where planned_expense_id is not null
group by planned_expense_id;

create or replace view public.allocation_totals with (security_invoker = on) as
select account_id, period, sum(amount)::int as total
from public.allocations
group by account_id, period;

-- Permessi: solo gli utenti autenticati, mai gli anonimi -------------------

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Fine. Puoi verificare in Table Editor che ogni tabella mostri "RLS enabled".
