// Aggiornamento automatico: quando l'app torna in primo piano controlla se è stata pubblicata
// una versione nuova e, se sì, la ricarica (anche dall'icona sulla schermata Home).

const KEY = "finanza-last-update-reload";

/** Script principale della versione in uso (solo nella build pubblicata). */
function currentScript(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/"]');
  return el?.getAttribute("src") ?? null;
}

async function check() {
  const cur = currentScript();
  if (!cur || !navigator.onLine) return;
  try {
    // il parametro ?v= evita le copie in cache del browser e di GitHub Pages
    const res = await fetch(`./?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const html = await res.text();
    if (!html.includes('type="module"') || html.includes(cur)) return;
    // al massimo un ricaricamento al minuto, per non entrare mai in un ciclo
    let last = 0;
    try { last = Number(sessionStorage.getItem(KEY) ?? 0); } catch { /* storage non disponibile */ }
    if (Date.now() - last < 60_000) return;
    try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* storage non disponibile */ }
    location.replace(`${location.pathname}?v=${Date.now()}${location.hash}`);
  } catch {
    // offline o errore di rete: si riprova la prossima volta
  }
}

export function startUpdateCheck() {
  setTimeout(check, 2000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
}
