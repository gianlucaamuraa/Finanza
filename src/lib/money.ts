// Importi in centesimi.

const fmt0 = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: "always" });
const fmt2 = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" });

/** Formatta centesimi in euro. decimals: "auto" mostra i decimali solo se presenti. */
export function eur(cents: number, decimals: 0 | 2 | "auto" = "auto"): string {
  const v = cents / 100;
  const d = decimals === "auto" ? (Math.round(cents) % 100 === 0 ? 0 : 2) : decimals;
  const s = (d === 0 ? fmt0 : fmt2).format(Math.abs(d === 0 ? Math.round(v) : v));
  return (cents < 0 ? "−" : "") + "€ " + s;
}

/** Converte "1.234,56", "1234.56", "23,4" in centesimi. Ritorna null se non valido. */
export function parseAmount(input: unknown): number | null {
  if (typeof input !== "string") return null;
  let s = input.trim().replace(/€|\s/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // il separatore decimale è l'ultimo dei due
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    s = s.replace(",", ".");
  } else if (lastDot > -1 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ""); // "1.234" = migliaia
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

/** Centesimi -> stringa per input ("23,40"). */
export function toInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",").replace(/,00$/, "");
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
