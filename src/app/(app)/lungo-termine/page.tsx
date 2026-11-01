import Link from "next/link";
import { Suspense } from "react";
import { safe } from "@/components/safe";
import { Pencil, Plus, TrendingUp } from "lucide-react";
import { getAccounts, getInvestments } from "@/lib/data";
import { base, investedTotal, yearCells } from "@/lib/view";
import { MESI_LUNGHI, addMonths, monthIndex, monthLabel } from "@/lib/dates";
import { FillMissingButton } from "./FillMissingButton";
import { eur, sum } from "@/lib/money";
import { SheetTrigger } from "@/components/Sheet";
import { ContributionForm, InvestmentForm } from "@/components/forms";
import { MonthBars, PageSkeleton } from "@/components/ui";

type SP = Promise<{ inv?: string; anno?: string }>;

export default function LungoTerminePage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LungoTermine searchParams={searchParams} />
    </Suspense>
  );
}

const KIND_NOTE: Record<string, string> = {
  recorded: "",
  linked: "da movimenti",
  planned: "pianificato",
  missing: "da registrare",
  none: "",
};

async function LungoTermine({ searchParams }: { searchParams: SP }) {
  return safe(() => LungoTermineContent({ searchParams }));
}

async function LungoTermineContent({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { current } = await base();
  const [investments, accounts] = await Promise.all([getInvestments(), getAccounts()]);
  const opts = accounts.map((a) => ({ id: a.id, name: a.name, icon: a.icon, color: a.color }));

  if (investments.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 28 }}>
        <span className="ico" style={{ margin: "0 auto 12px", width: 52, height: 52, background: "var(--accent-soft)", color: "var(--accent)" }}>
          <TrendingUp size={24} />
        </span>
        <b style={{ fontSize: 17 }}>Imposta il tuo PAC</b>
        <p className="note" style={{ margin: "6px 0 16px" }}>
          Indica il versamento mensile e il mese di inizio: vedrai mese per mese e anno per anno quanto hai versato.
        </p>
        <SheetTrigger className="btn accent" title="Nuovo piano" content={<InvestmentForm accounts={opts} defaultStart={current} />}>
          <Plus size={18} /> Crea piano
        </SheetTrigger>
      </div>
    );
  }

  const inv = investments.find((i) => String(i.id) === sp.inv) ?? investments[0];
  const curYear = Number(current.slice(0, 4));
  const firstYear = Math.min(
    Number(inv.startMonth.slice(0, 4)),
    ...[...inv.recorded.keys()].map((m) => Number(m.slice(0, 4))),
  );
  const lastYear = Math.max(curYear + 1, inv.endMonth ? Number(inv.endMonth.slice(0, 4)) : 0);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);
  const year = years.includes(Number(sp.anno)) ? Number(sp.anno) : Math.min(Math.max(curYear, firstYear), lastYear);

  const cells = yearCells(inv, year, current);
  const done = sum(cells.filter((c) => c.kind === "recorded" || c.kind === "linked").map((c) => c.amount));
  const plan = sum(cells.filter((c) => c.kind === "planned").map((c) => c.amount));
  const total = investedTotal(inv, current);
  const allTotal = sum(investments.map((i) => investedTotal(i, current)));

  const summary = years.map((y) => {
    const c = yearCells(inv, y, current);
    return {
      y,
      done: sum(c.filter((x) => x.kind === "recorded" || x.kind === "linked").map((x) => x.amount)),
      plan: sum(c.filter((x) => x.kind === "planned").map((x) => x.amount)),
    };
  });
  const maxY = Math.max(1, ...summary.map((s) => s.done + s.plan));
  // mesi passati del piano senza versamento
  const lastPast = inv.endMonth && monthIndex(inv.endMonth) < monthIndex(current) ? inv.endMonth : addMonths(current, -1);
  let missing = 0;
  for (let m = inv.startMonth; monthIndex(m) <= monthIndex(lastPast); m = addMonths(m, 1))
    if (!inv.recorded.has(m) && !inv.linked.has(m)) missing++;
  const qs = (i: number, y: number) => `/lungo-termine?inv=${i}&anno=${y}`;

  return (
    <>
      <div className="card hero">
        <div className="label">{inv.name} · Totale versato</div>
        <div className="big num">{eur(total)}</div>
        <div className="pills">
          <div className="pill"><span>Versamento mensile</span><b className="num">{eur(inv.monthlyAmount)}/mese</b></div>
          <div className="pill">
            <span>{investments.length > 1 ? "Tutti i piani" : "Dal"}</span>
            <b className="num">{investments.length > 1 ? eur(allTotal) : monthLabel(inv.startMonth, false)}</b>
          </div>
        </div>
      </div>

      {investments.length > 1 && (
        <div className="chips">
          {investments.map((i) => (
            <Link key={i.id} href={qs(i.id, year)} className={`chip${i.id === inv.id ? " on" : ""}`}>{i.name}</Link>
          ))}
        </div>
      )}
      <div className="chips">
        {years.map((y) => (
          <Link key={y} href={qs(inv.id, y)} className={`chip${y === year ? " on" : ""}`}>{y}</Link>
        ))}
      </div>

      <div className="card">
        <div className="card-title">
          Versamenti {year}
          <span className="num" style={{ color: "var(--text)", textTransform: "none", letterSpacing: 0 }}>
            {eur(done)}{plan > 0 ? ` + ${eur(plan)} pian.` : ""}
          </span>
        </div>
        <MonthBars cells={cells} />
        <div className="meta">
          <span>Versato</span>
          <span style={{ color: "#5fb3a8" }}>Tratteggiato: pianificato</span>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Mese per mese</div>
        <div className="months">
          {cells.map((c, i) => (
            <SheetTrigger
              key={c.month}
              className={c.kind}
              title={`${inv.name} · ${monthLabel(c.month)}`}
              content={<ContributionForm investmentId={inv.id} month={c.month} amount={c.amount || inv.monthlyAmount} recorded={c.kind === "recorded"} />}
            >
              <span>{MESI_LUNGHI[i]}</span>
              <b className="num">{c.kind === "none" || c.kind === "missing" ? "—" : eur(c.amount)}</b>
              {KIND_NOTE[c.kind] && <em>{KIND_NOTE[c.kind]}</em>}
            </SheetTrigger>
          ))}
        </div>
        <p className="note" style={{ marginTop: 12, marginBottom: 0 }}>Tocca un mese per registrare o correggere il versamento.</p>
      </div>

      {missing > 0 && <FillMissingButton investmentId={inv.id} current={current} count={missing} amount={inv.monthlyAmount} />}

      <div className="card">
        <div className="card-title">Riepilogo per anno</div>
        {summary.map((s) => (
          <div className="yearrow" key={s.y}>
            <b>{s.y}</b>
            <div className="bar"><i style={{ width: `${(s.done / maxY) * 100}%` }} /></div>
            <span className="num">
              {eur(s.done)}
              {s.plan > 0 && <small className="muted"> (+{eur(s.plan)})</small>}
            </span>
          </div>
        ))}
      </div>

      <div className="btn-row">
        <SheetTrigger className="btn ghost" title="Modifica piano" content={<InvestmentForm accounts={opts} defaultStart={current} initial={inv} />}>
          <Pencil size={16} /> Modifica piano
        </SheetTrigger>
        <SheetTrigger className="btn ghost" title="Nuovo piano" content={<InvestmentForm accounts={opts} defaultStart={current} />}>
          <Plus size={16} /> Nuovo piano
        </SheetTrigger>
      </div>
    </>
  );
}
