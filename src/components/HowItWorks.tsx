import type { ReactNode } from "react";
import { Card } from "./Card";

const Step = ({ n, title, children }: { n: number; title: string; children: ReactNode }) => (
  <li style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
    <span
      aria-hidden
      style={{
        flex: "none", width: 26, height: 26, borderRadius: 13, background: "var(--accent-soft)", color: "var(--accent)",
        display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13,
      }}
    >
      {n}
    </span>
    <span style={{ minWidth: 0 }}>
      <b style={{ display: "block", fontSize: 15 }}>{title}</b>
      <small className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>{children}</small>
    </span>
  </li>
);

/** Il giro del mese in cinque passi. */
export function HowItWorks({ payday }: { payday: number }) {
  return (
    <Card id="impostazioni-guida" title={<>Come funziona</>}>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        <Step n={1} title="Arriva lo stipendio">
          In Movimenti aggiungi l'entrata con la data di accredito. Il mese va da uno stipendio al successivo: il tuo arriva il {payday}.
        </Step>
        <Step n={2} title="Accetti la proposta">
          Si apre da sola: rate delle spese prevedibili, PAC e Stipendio personale, con conti e importi già pronti. Correggi se serve
          (anche con "+ Aggiungi") e premi Accetta: le rate risultano versate.
        </Step>
        <Step n={3} title="Segni le uscite">
          In Movimenti → Uscite, con il pulsante +. Ogni uscita scala dal conto scelto.
        </Step>
        <Step n={4} title="Guardi la quota">
          In Dashboard: quanto puoi spendere al giorno fino al prossimo stipendio, contando solo i conti spuntati per la quota.
        </Step>
        <Step n={5} title="Controlli gli accantonamenti">
          In Prevedibili, mese per mese: quanto va nelle spese prevedibili, nelle spese mostrate a parte (es. un prestito) e nel lungo termine.
        </Step>
      </ol>
      <p className="note" style={{ marginBottom: 0 }}>
        Hai sbagliato qualcosa? In Storico modifiche, qui sotto, "Annulla" rimette i dati com'erano. Un saldo non torna con la banca?
        Tocca il conto e correggi il "Saldo attuale".
      </p>
    </Card>
  );
}
