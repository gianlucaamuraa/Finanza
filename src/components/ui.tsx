import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MESI, addMonths, dayLabel, monthLabel, type Month } from "@/lib/dates";
import { periodRange } from "@/lib/period";
import { eur } from "@/lib/money";

export type BarCell = { amount: number; kind: "recorded" | "linked" | "planned" | "missing" | "none" };

/** Grafico a barre dei 12 mesi. */
export function MonthBars({ cells }: { cells: BarCell[] }) {
  const max = Math.max(1, ...cells.map((c) => c.amount));
  return (
    <div className="bars" role="img" aria-label="Versamenti mensili">
      {cells.map((c, i) => (
        <div
          key={i}
          className={`b ${c.kind === "planned" ? "plan" : c.kind === "linked" ? "linked" : c.amount === 0 ? "zero" : ""}`}
          title={`${MESI[i]}: ${eur(c.amount)}`}
        >
          <i style={{ height: `${(c.amount / max) * 100}%` }} />
          <span>{MESI[i][0]}</span>
        </div>
      ))}
    </div>
  );
}

export function MonthNav({ period, payday, hrefFor }: { period: Month; payday: number; hrefFor: (m: Month) => string }) {
  const r = periodRange(period, payday);
  return (
    <div className="monthbar">
      <Link href={hrefFor(addMonths(period, -1))} aria-label="Mese precedente"><ChevronLeft size={18} /></Link>
      <div>
        <b>{monthLabel(period)}</b>
        <small>{dayLabel(r.start)} – {dayLabel(r.end)}</small>
      </div>
      <Link href={hrefFor(addMonths(period, 1))} aria-label="Mese successivo"><ChevronRight size={18} /></Link>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Caricamento">
      <div className="skeleton" style={{ height: 150 }} />
      <div className="skeleton" style={{ height: 90 }} />
      <div className="skeleton" style={{ height: 220 }} />
    </div>
  );
}

export const pctClass = (p: number) => (p > 1 ? "over" : p > 0.85 ? "warn" : "");
