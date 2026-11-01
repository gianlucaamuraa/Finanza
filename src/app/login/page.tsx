import { Wallet } from "lucide-react";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Accedi · Finanza" };

export default function LoginPage() {
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
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
