// Tema dell'app: automatico (segue il telefono), chiaro o scuro. La scelta resta su questo dispositivo.

export type ThemeChoice = "auto" | "light" | "dark";
const KEY = "finanza-tema";
const media = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null);

export function getTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "auto" && !!media()?.matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0f1115" : "#f4f5f7");
}

export function setTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // storage non disponibile: il tema vale solo per questa visita
  }
  apply(choice);
}

/** All'avvio: applica il tema e, in automatico, segue i cambi del telefono (es. passaggio a modalità scura la sera). */
export function startTheme() {
  apply(getTheme());
  media()?.addEventListener("change", () => {
    if (getTheme() === "auto") apply("auto");
  });
}
