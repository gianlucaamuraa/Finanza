"use client";

import { useState, useTransition } from "react";
import { CircleCheck } from "lucide-react";
import { fillMissingContributions } from "@/app/actions";
import { eur } from "@/lib/money";

export function FillMissingButton({ investmentId, current, count, amount }: { investmentId: number; current: string; count: number; amount: number }) {
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="card">
      <div className="card-title">Mesi da registrare</div>
      <p className="note" style={{ marginTop: 0 }}>
        Ci sono {count} {count === 1 ? "mese passato" : "mesi passati"} del piano senza versamento registrato.
        Puoi segnarli tutti come versati ({eur(amount)} al mese) oppure toccarli uno per uno.
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
            const r = await fillMissingContributions(investmentId, current);
            if (!r?.ok) setError(r?.error ?? "Errore");
          });
        }}
      >
        <CircleCheck size={16} />
        {pending ? "Registrazione…" : armed ? `Conferma: registra ${eur(amount * count)}` : "Segna tutti come versati"}
      </button>
    </div>
  );
}
