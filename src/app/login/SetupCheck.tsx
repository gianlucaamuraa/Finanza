import { connection } from "next/server";
import { CircleAlert } from "lucide-react";
import { setupProblems } from "@/lib/health";

/** Mostra i problemi di configurazione, se ce ne sono. */
export async function SetupCheck() {
  await connection();
  const problems = await setupProblems();
  if (problems.length === 0) return null;
  return (
    <div className="card" style={{ borderColor: "#fecaca", background: "#fef2f2" }}>
      <div className="card-title" style={{ color: "var(--neg)" }}>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><CircleAlert size={16} /> Configurazione da completare</span>
      </div>
      <ul style={{ paddingLeft: 18, fontSize: 14, lineHeight: 1.5, color: "var(--text)" }}>
        {problems.map((p) => (
          <li key={p} style={{ marginBottom: 6 }}>{p}</li>
        ))}
      </ul>
      <p className="note" style={{ marginBottom: 0 }}>
        Su Vercel: Settings → Environment Variables, correggi i valori e poi Deployments → Redeploy.
      </p>
    </div>
  );
}
