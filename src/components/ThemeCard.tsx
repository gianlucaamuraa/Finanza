import { useState } from "react";
import { getTheme, setTheme, type ThemeChoice } from "@/theme";
import { Card } from "./Card";

const OPTIONS: [ThemeChoice, string][] = [["auto", "Automatico"], ["light", "Chiaro"], ["dark", "Scuro"]];

/** Scelta del tema: automatico (come il telefono), chiaro o scuro. */
export function ThemeCard() {
  const [theme, setT] = useState<ThemeChoice>(getTheme);
  return (
    <Card id="impostazioni-tema" title={<>Aspetto</>}>
      <div className="seg" role="radiogroup" aria-label="Tema" style={{ marginBottom: 8 }}>
        {OPTIONS.map(([k, label]) => (
          <button
            key={k} type="button" role="radio" aria-checked={theme === k} className={theme === k ? "on" : ""}
            onClick={() => {
              setT(k);
              setTheme(k);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="note" style={{ margin: 0 }}>Automatico segue il tema del telefono. La scelta vale su questo dispositivo.</p>
    </Card>
  );
}
