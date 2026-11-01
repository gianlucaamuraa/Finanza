"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import type { ActionState } from "@/app/actions";
import { useSheetClose } from "./Sheet";

type FormAction = (state: ActionState, fd: FormData) => Promise<ActionState>;

/** Form collegato a una Server Action: mostra l'errore e chiude il foglio quando va a buon fine. */
export function ActionForm({ action, children, onSuccess }: { action: FormAction; children: ReactNode; onSuccess?: () => void }) {
  const close = useSheetClose();
  const [state, formAction] = useActionState(action, null);
  useEffect(() => {
    if (state?.ok) (onSuccess ?? close)();
  }, [state, close, onSuccess]);
  return (
    <form action={formAction}>
      {state && !state.ok && <div className="form-error" role="alert">{state.error}</div>}
      {children}
    </form>
  );
}

export function Submit({ children = "Salva", className = "btn", pendingText = "Salvataggio…" }: { children?: ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Pulsante che esegue un'azione (es. elimina) con conferma a due tocchi. */
export function ConfirmButton({
  run,
  label = "Elimina",
  confirmLabel = "Tocca di nuovo per confermare",
  className = "btn danger",
  icon = true,
}: {
  run: () => Promise<ActionState>;
  label?: string;
  confirmLabel?: string;
  className?: string;
  icon?: boolean;
}) {
  const close = useSheetClose();
  const [pending, start] = useTransition();
  const [armed, setArmed] = useArmed();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          if (!armed) return setArmed(true);
          start(async () => {
            const r = await run();
            if (r?.ok) close();
            else setError(r?.error ?? "Errore");
          });
        }}
      >
        {icon && <Trash2 size={16} />}
        {pending ? "Attendi…" : armed ? confirmLabel : label}
      </button>
    </>
  );
}

/** Stato "armato" che si disattiva da solo dopo 3 secondi. */
function useArmed(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  const set = (nv: boolean) => {
    setV(nv);
    clearTimeout(t.current);
    if (nv) t.current = setTimeout(() => setV(false), 3000);
  };
  return [v, set];
}

export function Field({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span className="label">{label}</span>}
      {children}
    </div>
  );
}

export function AmountInput({ name, defaultValue, big, id, onValue }: { name: string; defaultValue?: string; big?: boolean; id?: string; onValue?: (v: string) => void }) {
  return (
    <input
      id={id ?? name}
      name={name}
      className={`input num${big ? " big" : ""}`}
      inputMode="decimal"
      autoComplete="off"
      placeholder="0,00"
      defaultValue={defaultValue}
      onChange={onValue ? (e) => onValue(e.target.value) : undefined}
      required
    />
  );
}
