import { Wallet } from "lucide-react";
import { useNavigate } from "react-router";
import { signIn } from "@/api";
import { ActionForm, Submit } from "@/components/form";

export default function Login() {
  const navigate = useNavigate();
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, justifyContent: "center" }}>
          <span className="ico" style={{ background: "var(--accent)", color: "#fff", width: 48, height: 48, borderRadius: 14 }}>
            <Wallet size={24} />
          </span>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>Finanza</h1>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <ActionForm
            action={(fd) => signIn(String(fd.get("email") ?? "").trim(), String(fd.get("password") ?? ""))}
            onSuccess={() => navigate("/", { replace: true })}
          >
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" className="input" autoComplete="username" autoFocus required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
            </div>
            <Submit className="btn accent" pendingText="Accesso…">Accedi</Submit>
          </ActionForm>
        </div>
      </div>
    </main>
  );
}
