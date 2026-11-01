import { useState } from "react";
import * as A from "@/api";
import { ACCOUNT_COLORS, ACCOUNT_ICONS, CATEGORY_ICONS, PLANNED_ICONS } from "@/lib/icon-keys";
import { MESI_LUNGHI, monthLabel, monthsInclusive, type Month } from "@/lib/dates";
import { eur, parseAmount, toInput } from "@/lib/money";
import { ActionForm, AmountInput, ConfirmButton, Field, Submit } from "./form";
import { Icon } from "./Icon";

export type AccountOpt = { id: number; name: string; icon: string; color: string };
export type CategoryOpt = { id: number; name: string; icon: string };
export type PlannedOpt = { id: number; name: string };

const Hidden = ({ name, value }: { name: string; value: string | number | null | undefined }) =>
  value == null ? null : <input type="hidden" name={name} value={value} />;

/** Selettore mese/anno (funziona su tutti i browser, a differenza di input type=month). */
export function MonthPicker({ name, defaultValue, label, optional, onChange }: { name: string; defaultValue?: Month | null; label: string; optional?: boolean; onChange?: (v: Month) => void }) {
  const now = new Date().getFullYear();
  const [y, setY] = useState(defaultValue ? defaultValue.slice(0, 4) : optional ? "" : String(now));
  const [m, setM] = useState(defaultValue ? defaultValue.slice(5, 7) : optional ? "" : "01");
  const years = Array.from({ length: 16 }, (_, i) => String(now - 5 + i));
  if (y && !years.includes(y)) years.unshift(y);
  const value = y && m ? `${y}-${m}` : "";
  const update = (ny: string, nm: string) => {
    setY(ny);
    setM(nm);
    if (ny && nm) onChange?.(`${ny}-${nm}`);
  };
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="field-row">
        <select className="input" value={m} onChange={(e) => update(y, e.target.value)} aria-label={`${label}: mese`}>
          {optional && <option value="">—</option>}
          {MESI_LUNGHI.map((n, i) => (
            <option key={n} value={String(i + 1).padStart(2, "0")}>{n}</option>
          ))}
        </select>
        <select className="input" value={y} onChange={(e) => update(e.target.value, m)} aria-label={`${label}: anno`} style={{ maxWidth: 120 }}>
          {optional && <option value="">—</option>}
          {years.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

function IconPicker({ name, icons, defaultValue, labels }: { name: string; icons: readonly string[]; defaultValue?: string; labels?: Record<string, string> }) {
  return (
    <div className="iconpick">
      {icons.map((k, i) => (
        <label key={k} title={labels?.[k] ?? k}>
          <input type="radio" name={name} value={k} defaultChecked={defaultValue ? defaultValue === k : i === 0} />
          <Icon name={k} size={20} />
          {labels?.[k]}
        </label>
      ))}
    </div>
  );
}

// ---------- Entrata ----------

export function IncomeForm({ period, defaultDate, initial }: { period: Month; defaultDate: string; initial?: { id: number; date: string; description: string; amount: number } }) {
  return (
    <ActionForm action={A.saveIncome}>
      <Hidden name="id" value={initial?.id} />
      <Hidden name="period" value={period} />
      <Field label="Importo (€)" htmlFor="amount"><AmountInput name="amount" big defaultValue={initial ? toInput(initial.amount) : ""} /></Field>
      <div className="field-row">
        <Field label="Descrizione" htmlFor="description">
          <input id="description" name="description" className="input" defaultValue={initial?.description ?? "Stipendio"} />
        </Field>
        <Field label="Data accredito" htmlFor="date">
          <input id="date" name="date" type="date" className="input" defaultValue={initial?.date ?? defaultDate} required />
        </Field>
      </div>
      <p className="note">Registrata nel mese di {monthLabel(period)}.</p>
      <Submit />
      {initial && <ConfirmButton run={() => A.deleteIncome(initial.id)} />}
    </ActionForm>
  );
}

// ---------- Ripartizione ----------

export function AllocationForm({ period, accounts, initial, suggested }: { period: Month; accounts: AccountOpt[]; initial?: { id: number; accountId: number; amount: number; note: string | null }; suggested?: number }) {
  return (
    <ActionForm action={A.saveAllocation}>
      <Hidden name="id" value={initial?.id} />
      <Hidden name="period" value={period} />
      <Field label="Conto di destinazione" htmlFor="accountId">
        <select id="accountId" name="accountId" className="input" defaultValue={initial?.accountId ?? accounts[0]?.id} required>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Importo (€)" htmlFor="amount">
        <AmountInput name="amount" big defaultValue={initial ? toInput(initial.amount) : suggested && suggested > 0 ? toInput(suggested) : ""} />
      </Field>
      <Field label="Nota (opzionale)" htmlFor="note">
        <input id="note" name="note" className="input" defaultValue={initial?.note ?? ""} placeholder="es. extra per regali" />
      </Field>
      <p className="note" style={{ marginTop: -6 }}>Per registrare soldi spostati fuori da un conto usa un importo negativo (es. -100).</p>
      <Submit />
      {initial && <ConfirmButton run={() => A.deleteAllocation(initial.id)} />}
    </ActionForm>
  );
}

// ---------- Uscita ----------

export function ExpenseForm({
  accounts, categories, planned, defaultDate, defaultAccountId, initial,
}: {
  accounts: AccountOpt[]; categories: CategoryOpt[]; planned: PlannedOpt[]; defaultDate: string; defaultAccountId?: number;
  initial?: { id: number; date: string; accountId: number; categoryId: number | null; plannedExpenseId: number | null; amount: number; description: string };
}) {
  const defCat = initial ? initial.categoryId : categories[0]?.id;
  return (
    <ActionForm action={A.saveExpense}>
      <Hidden name="id" value={initial?.id} />
      <Field label="Importo (€)" htmlFor="amount"><AmountInput name="amount" big defaultValue={initial ? toInput(initial.amount) : ""} /></Field>
      <div className="field">
        <span className="label">Categoria</span>
        <div className="iconpick">
          {categories.map((c) => (
            <label key={c.id}>
              <input type="radio" name="categoryId" value={c.id} defaultChecked={defCat === c.id} />
              <Icon name={c.icon} size={20} />
              {c.name.split(" ")[0]}
            </label>
          ))}
        </div>
      </div>
      <div className="field-row">
        <Field label="Conto" htmlFor="accountId">
          <select id="accountId" name="accountId" className="input" defaultValue={initial?.accountId ?? defaultAccountId ?? accounts[0]?.id} required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Data" htmlFor="date">
          <input id="date" name="date" type="date" className="input" defaultValue={initial?.date ?? defaultDate} required />
        </Field>
      </div>
      <Field label="Descrizione" htmlFor="description">
        <input id="description" name="description" className="input" defaultValue={initial?.description ?? ""} placeholder="es. Esselunga" maxLength={120} />
      </Field>
      {planned.length > 0 && (
        <Field label="Collega a spesa prevedibile (opzionale)" htmlFor="plannedExpenseId">
          <select id="plannedExpenseId" name="plannedExpenseId" className="input" defaultValue={initial?.plannedExpenseId ?? ""}>
            <option value="">Nessuna</option>
            {planned.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
      )}
      <Submit />
      {initial && <ConfirmButton run={() => A.deleteExpense(initial.id)} />}
    </ActionForm>
  );
}

// ---------- Spesa prevedibile ----------

export function PlannedForm({ defaultStart, initial }: { defaultStart: Month; initial?: { id: number; name: string; icon: string; totalAmount: number; startMonth: Month; endMonth: Month; note: string | null } }) {
  const [amount, setAmount] = useState(initial ? toInput(initial.totalAmount) : "");
  return (
    <ActionForm action={A.savePlanned}>
      <Hidden name="id" value={initial?.id} />
      <Field label="Nome" htmlFor="name">
        <input id="name" name="name" className="input" defaultValue={initial?.name} placeholder="es. Assicurazione auto" required maxLength={80} />
      </Field>
      <Field label="Importo totale (€)" htmlFor="totalAmount">
        <AmountInput name="totalAmount" defaultValue={amount} onValue={setAmount} />
      </Field>
      <PlannedRange amount={amount} initial={initial} defaultStart={defaultStart} />
      <div className="field">
        <span className="label">Icona</span>
        <IconPicker name="icon" icons={PLANNED_ICONS} defaultValue={initial?.icon} />
      </div>
      <Field label="Nota (opzionale)" htmlFor="note">
        <input id="note" name="note" className="input" defaultValue={initial?.note ?? ""} />
      </Field>
      <Submit>Salva spesa</Submit>
      {initial && <ConfirmButton run={() => A.deletePlanned(initial.id)} />}
    </ActionForm>
  );
}

/** Mesi di inizio/fine con calcolo della rata in tempo reale. */
function PlannedRange({ amount, initial, defaultStart }: { amount: string; initial?: { startMonth: Month; endMonth: Month }; defaultStart: Month }) {
  const [start, setStart] = useState(initial?.startMonth ?? defaultStart);
  const [end, setEnd] = useState(initial?.endMonth ?? `${defaultStart.slice(0, 4)}-12`);
  const cents = parseAmount(amount);
  const n = start && end ? monthsInclusive(start, end) : 0;
  return (
    <>
      <MonthPicker name="startMonth" label="Mese di inizio" defaultValue={start} onChange={setStart} />
      <MonthPicker name="endMonth" label="Mese di fine" defaultValue={end} onChange={setEnd} />
      <div className="calc">
        <div>
          <span>Rata mensile</span>
          <small>{n > 0 ? `${n} ${n === 1 ? "rata" : "rate mensili"}` : "Date non valide"}</small>
        </div>
        <b className="num">{n > 0 && cents != null ? eur(Math.round(cents / n), 2) : "—"}</b>
      </div>
    </>
  );
}

// ---------- Investimento (PAC) ----------

export function InvestmentForm({ accounts, defaultStart, initial }: { accounts: AccountOpt[]; defaultStart: Month; initial?: { id: number; name: string; monthlyAmount: number; annualIncrease: number; startMonth: Month; endMonth: Month | null; accountId: number | null } }) {
  return (
    <ActionForm action={A.saveInvestment}>
      <Hidden name="id" value={initial?.id} />
      <Field label="Nome" htmlFor="name">
        <input id="name" name="name" className="input" defaultValue={initial?.name ?? "PAC"} required maxLength={80} />
      </Field>
      <Field label="Versamento mensile (€)" htmlFor="monthlyAmount">
        <AmountInput name="monthlyAmount" defaultValue={initial ? toInput(initial.monthlyAmount) : ""} />
      </Field>
      <Field label="Aumento ogni anno (€, opzionale)" htmlFor="annualIncrease">
        <input id="annualIncrease" name="annualIncrease" className="input num" inputMode="decimal" placeholder="0" defaultValue={initial?.annualIncrease ? toInput(initial.annualIncrease) : ""} />
      </Field>
      <MonthPicker name="startMonth" label="Dal" defaultValue={initial?.startMonth ?? defaultStart} />
      <MonthPicker name="endMonth" label="Al (opzionale)" defaultValue={initial?.endMonth} optional />
      <Field label="Conto collegato (opzionale)" htmlFor="accountId">
        <select id="accountId" name="accountId" className="input" defaultValue={initial?.accountId ?? ""}>
          <option value="">Nessuno</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </Field>
      <p className="note">
        Se colleghi un conto, i mesi senza versamento registrato useranno quanto hai spostato su quel conto nella pagina Movimenti.
        I mesi futuri vengono mostrati come pianificati con il versamento mensile.
      </p>
      <Submit>Salva piano</Submit>
      {initial && <ConfirmButton run={() => A.deleteInvestment(initial.id)} label="Elimina investimento" />}
    </ActionForm>
  );
}

export function ContributionForm({ investmentId, month, amount, recorded }: { investmentId: number; month: Month; amount: number; recorded: boolean }) {
  return (
    <ActionForm action={A.saveContribution}>
      <Hidden name="investmentId" value={investmentId} />
      <Hidden name="month" value={month} />
      <Field label={`Versato a ${monthLabel(month)} (€)`} htmlFor="amount">
        <AmountInput name="amount" big defaultValue={amount ? toInput(amount) : "0"} />
      </Field>
      <Submit>Registra versamento</Submit>
      {recorded && (
        <ConfirmButton
          run={() => A.deleteContribution(investmentId, month)}
          label="Rimuovi registrazione"
          className="btn ghost"
        />
      )}
    </ActionForm>
  );
}

// ---------- Conto ----------

const KINDS = [
  ["corrente", "Conto corrente"],
  ["risparmio", "Conto risparmio"],
  ["contanti", "Contanti"],
  ["investimento", "Investimenti"],
  ["altro", "Altro"],
] as const;

export function AccountForm({ initial, defaultColor, balance }: {
  defaultColor?: string;
  balance?: number;
  initial?: { id: number; name: string; kind: string; icon: string; color: string; initialBalance: number; includeInQuota: boolean; excludeFromNetWorth: boolean; archived: boolean };
}) {
  const current = initial ? (balance ?? initial.initialBalance) : 0;
  // effetto dei movimenti registrati (ripartizioni − uscite): resta fisso, cambia solo il saldo iniziale
  const movementsNet = initial ? current - initial.initialBalance : 0;
  return (
    <ActionForm action={A.saveAccount}>
      <Hidden name="id" value={initial?.id} />
      <Field label="Nome" htmlFor="name">
        <input id="name" name="name" className="input" defaultValue={initial?.name} placeholder="es. Conto Intesa" required maxLength={80} />
      </Field>
      <Field label="Tipo" htmlFor="kind">
        <select id="kind" name="kind" className="input" defaultValue={initial?.kind ?? "corrente"}>
          {KINDS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </Field>
      <Field label="Saldo attuale (€)" htmlFor="currentBalance">
        <input id="currentBalance" name="currentBalance" className="input num" inputMode="decimal" defaultValue={toInput(current)} />
      </Field>
      <Hidden name="movementsNet" value={movementsNet} />
      <p className="note" style={{ marginTop: -6 }}>Scrivi quanto c&apos;è davvero sul conto: l&apos;app si allinea senza registrare spese.</p>
      <div className="field">
        <span className="label">Icona</span>
        <IconPicker name="icon" icons={ACCOUNT_ICONS} defaultValue={initial?.icon} />
      </div>
      <div className="field">
        <span className="label">Colore</span>
        <div className="colorpick">
          {ACCOUNT_COLORS.map((c, i) => (
            <label key={c} style={{ background: c }} title={c}>
              <input type="radio" name="color" value={c} defaultChecked={initial ? initial.color === c : defaultColor ? defaultColor === c : i === 0} />
            </label>
          ))}
        </div>
      </div>
      <div className="field">
        <label className="toggle">
          Conta per la quota giornaliera
          <input type="checkbox" name="includeInQuota" defaultChecked={initial?.includeInQuota ?? false} />
        </label>
      </div>
      <div className="field">
        <label className="toggle">
          Escludi dal patrimonio
          <input type="checkbox" name="excludeFromNetWorth" defaultChecked={initial?.excludeFromNetWorth ?? false} />
        </label>
      </div>
      <Submit />
      {initial && (
        <div className="btn-row">
          <ConfirmButton
            run={() => A.setAccountArchived(initial.id, !initial.archived)}
            label={initial.archived ? "Ripristina" : "Archivia"}
            confirmLabel="Conferma"
            className="btn ghost"
            icon={false}
          />
          <ConfirmButton run={() => A.deleteAccount(initial.id)} confirmLabel="Conferma" />
        </div>
      )}
    </ActionForm>
  );
}

// ---------- Categoria ----------

export function CategoryForm({ initial }: { initial?: { id: number; name: string; icon: string } }) {
  return (
    <ActionForm action={A.saveCategory}>
      <Hidden name="id" value={initial?.id} />
      <Field label="Nome" htmlFor="name">
        <input id="name" name="name" className="input" defaultValue={initial?.name} placeholder="es. Animali" required maxLength={80} />
      </Field>
      <div className="field">
        <span className="label">Icona</span>
        <IconPicker name="icon" icons={CATEGORY_ICONS} defaultValue={initial?.icon} />
      </div>
      <Submit />
      {initial && <ConfirmButton run={() => A.deleteCategory(initial.id)} />}
    </ActionForm>
  );
}

// ---------- Impostazioni stipendio/quota ----------

export function PaydayForm({ payday, accounts }: { payday: number; accounts: (AccountOpt & { includeInQuota: boolean })[] }) {
  return (
    <ActionForm action={A.saveSettings}>
      <Hidden name="quotaForm" value="1" />
      <Field label="Lo stipendio arriva il giorno" htmlFor="payday">
        <input id="payday" name="payday" type="number" min={1} max={31} inputMode="numeric" className="input" defaultValue={payday} required />
      </Field>
      <div className="field">
        <span className="label">Conti da considerare per la quota giornaliera</span>
        <div className="check-list">
          {accounts.map((a) => (
            <label key={a.id}>
              <span className="ico sm" style={{ background: a.color + "1a", color: a.color }}><Icon name={a.icon} size={16} /></span>
              <span className="main">{a.name}</span>
              <input type="checkbox" name="quotaAccount" value={a.id} defaultChecked={a.includeInQuota} />
            </label>
          ))}
        </div>
      </div>
      <p className="note">
        Quota giornaliera = quanto resta da spendere sui conti selezionati (ripartito nel mese meno le uscite) ÷ giorni che mancano al prossimo stipendio.
        Con lo stipendio dal giorno 15 in poi, l&apos;accredito apre il mese successivo (es. 27 ottobre → Novembre).
      </p>
      <Submit />
    </ActionForm>
  );
}
