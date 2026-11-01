// Date come stringhe "YYYY-MM-DD", mesi come "YYYY-MM". Calcoli in UTC per evitare problemi di fuso.

export type Month = string;
export type Day = string;

export const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
export const MESI_LUNGHI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

const pad = (n: number) => String(n).padStart(2, "0");

export function isMonth(s: unknown): s is Month {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}
export function isDay(s: unknown): s is Day {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));
}

export function monthIndex(m: Month): number {
  const [y, mm] = m.split("-").map(Number);
  return y * 12 + (mm - 1);
}
export function monthFromIndex(i: number): Month {
  return `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
}
export function addMonths(m: Month, n: number): Month {
  return monthFromIndex(monthIndex(m) + n);
}
/** Numero di mesi da a fino a b inclusi. */
export function monthsInclusive(a: Month, b: Month): number {
  return monthIndex(b) - monthIndex(a) + 1;
}
export function monthLabel(m: Month, long = true): string {
  const [y, mm] = m.split("-").map(Number);
  return `${(long ? MESI_LUNGHI : MESI)[mm - 1]} ${y}`;
}
export function daysInMonth(m: Month): number {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm, 0)).getUTCDate();
}

const toUTC = (d: Day) => Date.parse(d + "T00:00:00Z");
const fromUTC = (t: number): Day => new Date(t).toISOString().slice(0, 10);

export function addDays(d: Day, n: number): Day {
  return fromUTC(toUTC(d) + n * 864e5);
}
export function diffDays(a: Day, b: Day): number {
  return Math.round((toUTC(b) - toUTC(a)) / 864e5);
}
export function dayLabel(d: Day): string {
  const [, m, dd] = d.split("-").map(Number);
  return `${dd} ${MESI[m - 1]}`;
}
export function dayLabelLong(d: Day): string {
  const [, m, dd] = d.split("-").map(Number);
  return `${dd} ${MESI_LUNGHI[m - 1]}`;
}
export function monthOf(d: Day): Month {
  return d.slice(0, 7);
}

/** Data odierna nel fuso Europe/Rome. */
export function today(now: Date = new Date()): Day {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
}
