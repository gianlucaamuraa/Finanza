import { useState, useTransition } from "react";
import { Check, Pencil } from "lucide-react";
import * as A from "@/api";
import type { Planned } from "@/api";
import { plannedInfo } from "@/lib/calc";
import { monthLabel, type Month } from "@/lib/dates";
import { eur, toInput } from "@/lib/money";
import { ActionForm, AmountInput, Submit } from "./form";
import { AccountSelect, PlannedForm, type AccountOpt } from "./forms";

/** Rate di una spesa prevedibile: per ogni mese si segna se è stata versata e quanto. */
export function PlannedDetail({ planned, current, accounts }: { planned: Planned; current: Month; accounts: AccountOpt[] }) {
  const [editing, setEditing] = useState(false);
  const info = plannedInfo(planned, current);
  const [open, setOpen] = useState<Month | null>(() => (info.now && info.now.paid == null ? current : null));
  if (editing) return <PlannedForm defaultStart={current} initial={planned} accounts={accounts} />;

  return (
    <>
      <div className="calc" style={{ marginTop: 0 }}>
        <div>
          <span>Versato</span>
          <small>{info.paid}/{info.n} rate versate</small>
        </div>
        <b className="num">{eur(info.accrued, "auto")} <small style={{ display: "inline", fontSize: 13 }}>di {eur(info.total, "auto")}</small></b>
      </div>
      <div className="inst-list">
        {info.rows.map(([m, r]) => (
          <div key={m} className={`inst${r.paid != null ? " paid" : ""}${m === current ? " now" : ""}`}>
            <button type="button" className="inst-row" onClick={() => setOpen(open === m ? null : m)} aria-expanded={open === m}>
              <span className="inst-month">
                {monthLabel(m, false)}
                {m === current && <em>questo mese</em>}
              </span>
              <span className="num inst-amount">{eur(r.amount, 2)}</span>
              {r.paid != null ? (
                <span className="tag"><Check size={11} style={{ verticalAlign: -1 }} /> {eur(r.paid, 2)}</span>
              ) : (
                <span className="tag future">Da versare</span>
              )}
            </button>
            {open === m && (
              <PayForm planned={planned} month={m} amount={r.amount} paid={r.paid} accounts={accounts} accountId={r.accountId ?? planned.accountId} onDone={() => setOpen(null)} />
            )}
          </div>
        ))}
      </div>
      <button type="button" className="btn ghost" onClick={() => setEditing(true)}>
        <Pencil size={16} /> Modifica spesa
      </button>
    </>
  );
}

function PayForm({ planned, month, amount, paid, accounts, accountId, onDone }: {
  planned: Planned; month: Month; amount: number; paid: number | null; accounts: AccountOpt[]; accountId: number | null | undefined; onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="inst-pay">
      <ActionForm action={(fd) => A.payInstallment(planned, month, fd)} onSuccess={onDone}>
        <div className="field" style={{ marginBottom: 10 }}>
          <label htmlFor={`paid-${month}`}>Quanto hai versato (€)</label>
          <AmountInput id={`paid-${month}`} name="paid" defaultValue={toInput(paid ?? amount)} />
        </div>
        <AccountSelect accounts={accounts} defaultValue={accountId} label="Su quale conto" id={`acc-${month}`} />
        <Submit className="btn accent" pendingText="Salvataggio…">{paid != null ? "Aggiorna versamento" : "Segna come versata"}</Submit>
      </ActionForm>
      {paid != null && (
        <>
          {error && <div className="form-error">{error}</div>}
          <button
            type="button"
            className="btn ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await A.payInstallment(planned, month, null);
                if (r?.ok) onDone();
                else setError(r?.error ?? "Errore");
              })
            }
          >
            Segna come non versata
          </button>
        </>
      )}
    </div>
  );
}
