import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { today } from "@/lib/dates";
import { Card } from "./Card";

/** Export di tutti i dati: Excel (un foglio per sezione) e Word (resoconto scritto). */
export function ExportCard() {
  const [busy, setBusy] = useState<"xlsx" | "docx" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "xlsx" | "docx") => {
    setBusy(kind);
    setError(null);
    try {
      // le librerie si caricano solo quando servono
      const { buildReport, download } = await import("@/export/model");
      const report = await buildReport();
      const blob = kind === "xlsx"
        ? await (await import("@/export/xlsx")).buildXlsx(report)
        : await (await import("@/export/docx")).buildDocx(report);
      download(blob, `Finanza ${today()}.${kind}`);
    } catch (e) {
      console.error(e);
      setError("Export non riuscito. Controlla la connessione e riprova.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card id="dashboard-export" title={<>Esporta i dati</>}>
      <p className="note" style={{ marginTop: 0 }}>
        Excel: tutti i dati, un foglio per sezione (riepilogo, conti, entrate, ripartizioni, uscite, spese prevedibili, rate, PAC).
        Word: un resoconto scritto che spiega la situazione.
      </p>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="field-row">
        <button type="button" className="btn ghost" disabled={busy != null} onClick={() => run("xlsx")}>
          <FileSpreadsheet size={18} /> {busy === "xlsx" ? "Preparazione…" : "Excel"}
        </button>
        <button type="button" className="btn ghost" disabled={busy != null} onClick={() => run("docx")}>
          <FileText size={18} /> {busy === "docx" ? "Preparazione…" : "Word"}
        </button>
      </div>
    </Card>
  );
}
