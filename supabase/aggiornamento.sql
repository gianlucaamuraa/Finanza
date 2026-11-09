-- Finanza · aggiornamento del database (novembre 2026)
-- Da eseguire una volta in Supabase: SQL Editor -> New query -> incolla tutto -> Run.
-- Si può rieseguire senza danni. Contiene solo le aggiunte degli ultimi giorni;
-- in alternativa si può rieseguire tutto supabase/setup.sql.

-- 1. Conto delle spese prevedibili e delle rate versate
alter table public.planned_expenses add column if not exists account_id integer references public.accounts(id) on delete set null;
alter table public.planned_installments add column if not exists account_id integer references public.accounts(id) on delete set null;

-- 2. "Mostra a parte" (es. rate di un prestito): restano nel totale, ma non in "Accantonato"
alter table public.planned_expenses add column if not exists is_saving boolean not null default true;

-- 3. Ripartizione dello stipendio collegata a una spesa prevedibile (la rata risulta versata)
alter table public.allocations add column if not exists planned_expense_id integer references public.planned_expenses(id) on delete set null;

-- 4. Storico delle modifiche (Impostazioni -> Storico modifiche -> Annulla)
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

-- 5. Permessi (come nello script completo)
revoke all on public.history from anon;
grant select, insert, update, delete on public.history to authenticated;
grant usage, select on sequence public.history_id_seq to authenticated;

-- 6. Le spese mostrate a parte prima di questo aggiornamento restano com'erano.
-- Fine.
