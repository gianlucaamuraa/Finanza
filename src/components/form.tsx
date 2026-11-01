import { createContext, useContext, useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import type { ActionState } from "@/api";
import { useSheetClose } from "./Sheet";

const PendingCtx = createContext(false);

/** Form che chiama un'azione: mostra l'errore e chiude il foglio quando va a buon fine. */
export function ActionForm({ action, children, onSuccess }: { action: (fd: FormData) => Promise<ActionState>; children: ReactNode; onSuccess?: () => void }) {
  const close = useSheetClose();
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await action(fd);
      setState(r);
      if (r?.ok) (onSuccess ?? close)();
    });
  };
  return (
    <form onSubmit={onSubmit} noValidate>
      {state && !state.ok && <div className="form-error" role="alert">{state.error}</div>}
      <PendingCtx value={pending}>{children}</PendingCtx>
    </form>
  );
}

export function Submit({ children = "Salva", className = "btn", pendingText = "Salvataggio…" }: { children?: ReactNode; className?: string; pendingText?: string }) {
  const pending = useContext(PendingCtx);
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
