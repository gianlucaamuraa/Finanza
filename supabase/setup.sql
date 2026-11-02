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

-- rate personalizzate delle spese prevedibili (un importo per mese)
create table if not exists public.planned_installments (
  id serial primary key,
  planned_expense_id integer not null references public.planned_expenses(id) on delete cascade,
  month text not null,
  amount integer not null,
  paid_amount integer
);
alter table public.planned_installments add column if not exists paid_amount integer;
create unique index if not exists installment_unique on public.planned_installments (planned_expense_id, month);

-- aumento annuo del versamento PAC (aggiunto dopo la prima versione)
alter table public.investments add column if not exists annual_increase integer not null default 0;

-- conto delle spese prevedibili: predefinito per la spesa e conto effettivo di ogni rata versata
alter table public.planned_expenses add column if not exists account_id integer references public.accounts(id) on delete set null;
alter table public.planned_installments add column if not exists account_id integer references public.accounts(id) on delete set null;

-- ripartizione dello stipendio collegata a una spesa prevedibile (la rata del mese risulta versata)
alter table public.allocations add column if not exists planned_expense_id integer references public.planned_expenses(id) on delete set null;

-- conti da non contare nel patrimonio (es. soldi già destinati a una rata)
alter table public.accounts add column if not exists exclude_from_net_worth boolean not null default false;

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
    'planned_expenses', 'expenses', 'investments', 'investment_contributions', 'planned_installments'
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

-- 5. Storico delle modifiche (per il pulsante "Annulla") ------------------
-- Ogni inserimento, modifica o cancellazione salva una copia del dato prima e dopo.

create table if not exists public.history (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  table_name text not null,
  row_id integer,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now(),
  undone boolean not null default false
);
create index if not exists history_user_created_idx on public.history (user_id, created_at desc);
alter table public.history enable row level security;
drop policy if exists "solo i miei dati" on public.history;
create policy "solo i miei dati" on public.history for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.log_history() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  -- un salvataggio che non cambia niente non va nello storico
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then return null; end if;
  insert into public.history (user_id, table_name, row_id, action, old_data, new_data)
  values (
    coalesce((r->>'user_id')::uuid, auth.uid()), tg_table_name, (r->>'id')::int, lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'incomes', 'allocations', 'planned_expenses', 'expenses',
    'investments', 'investment_contributions', 'planned_installments'
  ] loop
    execute format('drop trigger if exists history_log on public.%I', t);
    execute format('create trigger history_log after insert or update or delete on public.%I for each row execute function public.log_history()', t);
  end loop;
end $$;

-- Permessi: solo gli utenti autenticati, mai gli anonimi -------------------

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Fine. Puoi verificare in Table Editor che ogni tabella mostri "RLS enabled".
