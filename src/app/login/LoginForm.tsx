"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";
import { Submit } from "@/components/form";

export function LoginForm() {
  const [state, action] = useActionState(login, null);
  return (
    <form action={action}>
      {state && !state.ok && <div className="form-error" role="alert">{state.error}</div>}
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" autoFocus required />
      </div>
      <Submit className="btn accent" pendingText="Accesso…">Accedi</Submit>
    </form>
  );
}
