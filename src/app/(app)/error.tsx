"use client";

import Link from "next/link";
import { CircleAlert, RotateCw } from "lucide-react";

export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 28, maxWidth: 480, margin: "24px auto" }}>
      <span className="ico" style={{ margin: "0 auto 12px", width: 52, height: 52, background: "#fef2f2", color: "var(--neg)" }}>
        <CircleAlert size={24} />
      </span>
      <b style={{ fontSize: 17 }}>Impossibile caricare i dati</b>
      <p className="note" style={{ margin: "6px 0 16px" }}>
        Di solito dipende dal database (DATABASE_URL) o da una variabile mancante su Vercel. La pagina di accesso mostra un controllo della configurazione.
      </p>
      <button type="button" className="btn" onClick={() => retry()}><RotateCw size={16} /> Riprova</button>
      <Link href="/login?verifica=1" className="btn ghost">Controlla la configurazione</Link>
    </div>
  );
}
