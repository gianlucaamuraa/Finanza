import "server-only";
import type { ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { dbMessage } from "@/lib/health";

/**
 * Esegue il caricamento di una pagina: se fallisce mostra l'errore reale
 * (codice e messaggio) invece della schermata generica.
 */
const TIMEOUT_MS = 15000;

export async function safe(render: () => Promise<ReactNode>): Promise<ReactNode> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("Il database non ha risposto entro 15 secondi"), { code: "TIMEOUT" })), TIMEOUT_MS);
  });
  try {
    return await Promise.race([render(), timeout]);
  } catch (e) {
    unstable_rethrow(e);
    console.error("[finanza] errore di caricamento", e);
    return <LoadError error={e} />;
  } finally {
    clearTimeout(timer);
  }
}

function LoadError({ error }: { error: unknown }) {
  const err = error as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const inner = err?.cause ?? err;
  const detail = [inner?.code, inner?.message].filter(Boolean).join(" · ").slice(0, 400);
  const outer = err?.cause && err.message ? err.message.split("\n")[0].slice(0, 200) : null;
  return (
    <div className="card" style={{ borderColor: "#fecaca", background: "#fef2f2" }}>
      <div className="card-title" style={{ color: "var(--neg)" }}>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><CircleAlert size={16} /> Impossibile caricare i dati</span>
      </div>
      <p style={{ fontSize: 14, marginBottom: 10 }}>{dbMessage(inner)}</p>
      <p className="note" style={{ marginBottom: 4 }}>Dettaglio tecnico (da inviare se chiedi aiuto):</p>
      <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#fff", padding: 10, borderRadius: 8, margin: 0 }}>
        {detail || "nessun dettaglio"}
        {outer ? `\n${outer}` : ""}
      </pre>
    </div>
  );
}
