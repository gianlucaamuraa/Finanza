import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const KEY = "finanza-card-chiuse";

function readClosed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveClosed(id: string, closed: boolean) {
  try {
    const s = readClosed();
    if (closed) s.add(id);
    else s.delete(id);
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    // storage non disponibile: lo stato vale solo per questa visita
  }
}

/**
 * Card con titolo che si chiude e si riapre con la freccia (o toccando il titolo).
 * Lo stato aperta/chiusa viene ricordato su questo dispositivo.
 */
export function Card({ id, title, children }: { id: string; title: ReactNode; children: ReactNode }) {
  const [closed, setClosed] = useState(() => readClosed().has(id));
  const toggle = () => {
    setClosed(!closed);
    saveClosed(id, !closed);
  };
  return (
    <div className={`card${closed ? " closed" : ""}`}>
      <div
        className="card-title card-head"
        onClick={(e) => {
          // i link e i pulsanti nel titolo (es. "Aggiungi") funzionano come prima
          if ((e.target as HTMLElement).closest("a, button:not(.card-toggle)")) return;
          toggle();
        }}
      >
        <span className="card-head-main">{title}</span>
        <button type="button" className="card-toggle" aria-expanded={!closed} aria-label={closed ? "Espandi" : "Comprimi"}>
          <ChevronDown size={18} />
        </button>
      </div>
      {!closed && children}
    </div>
  );
}
