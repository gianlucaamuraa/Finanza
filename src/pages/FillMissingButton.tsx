import { useState, useTransition } from "react";
import { CircleCheck } from "lucide-react";
import { fillMissingContributions, type Investment } from "@/api";
import { eur } from "@/lib/money";
import { plannedAmount } from "@/lib/calc";
import { addMonths, monthIndex } from "@/lib/dates";
import { Card } from "@/components/Card";

function missingTotal(inv: Investment, current: string) {
  const last = inv.endMonth && monthIndex(inv.endMonth) < monthIndex(current) ? inv.endMonth : addMonths(current, -1);
  let t = 0;
  for (let m = inv.startMonth; monthIndex(m) <= monthIndex(last); m = addMonths(m, 1))
    if (!inv.recorded.has(m) && !inv.linked.has(m)) t += plannedAmount(inv, m);
  return t;
}

export function FillMissingButton({ inv, current, count }: { inv: Investment; current: string; count: number }) {
  const amount = inv.monthlyAmount;
  const total = missingTotal(inv, current);
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card id="fillmissingbutton-1" title={<>Mesi da registrare</>}>
      <p className="note" style={{ marginTop: 0 }}>
        Ci sono {count} {count === 1 ? "mese passato" : "mesi passati"} del piano senza versamento registrato.
        Puoi segnarli tutti come versati{inv.annualIncrease ? "" : ` (${eur(amount)} al mese)`} oppure toccarli uno per uno.
      </p>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button
        type="button"
        className="btn ghost"
        style={{ marginBottom: 0 }}
        disabled={pending}
        onClick={() => {
          if (!armed) {
            setArmed(true);
            setTimeout(() => setArmed(false), 3000);
            return;
          }
          start(async () => {
            const r = await fillMissingContributions(inv, current);
            if (!r?.ok) setError(r?.error ?? "Errore");
          });
        }}
      >
        <CircleCheck size={16} />
        {pending ? "Registrazione…" : armed ? `Conferma: registra ${eur(total)}` : "Segna tutti come versati"}
      </button>
    </Card>
  );
}
