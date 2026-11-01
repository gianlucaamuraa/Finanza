"use client";

import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { copyPreviousPeriod } from "@/app/actions";

export function CopyPreviousButton({ period }: { period: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button
        type="button"
        className="btn ghost"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await copyPreviousPeriod(period);
            setError(r?.ok ? null : (r?.error ?? "Errore"));
          })
        }
      >
        <Copy size={16} /> {pending ? "Copia in corso…" : "Copia dal mese precedente"}
      </button>
    </>
  );
}
