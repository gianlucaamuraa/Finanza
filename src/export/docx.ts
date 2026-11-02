// Export in Word: un resoconto scritto che spiega i numeri dell'app.

import {
  AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import { MESI_LUNGHI, monthLabel } from "@/lib/dates";
import { eur } from "@/lib/money";
import type { Report } from "./model";

const ACCENT = "0F766E";
const MUTED = "6B7280";

const dateLong = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return `${dd} ${MESI_LUNGHI[m - 1].toLowerCase()} ${y}`;
};
const mese = (m: string) => monthLabel(m).toLowerCase();
const e = (c: number) => eur(c, "auto");
/** "a" davanti a consonante, "ad" davanti a vocale (es. "ad aprile"). */
const aMese = (m: string) => `${/^[aeiou]/.test(mese(m)) ? "ad" : "a"} ${mese(m)}`;

const h1 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 120 }, children: [new TextRun({ text: t, color: ACCENT })] });
const h2 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 }, children: [new TextRun(t)] });
const p = (...parts: (string | TextRun)[]) =>
  new Paragraph({ spacing: { after: 120 }, children: parts.map((x) => (typeof x === "string" ? new TextRun(x) : x)) });
const b = (t: string) => new TextRun({ text: t, bold: true });
const note = (t: string) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: t, italics: true, color: MUTED, size: 20 })] });
const bullet = (...parts: (string | TextRun)[]) =>
  new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: parts.map((x) => (typeof x === "string" ? new TextRun(x) : x)) });

const border = { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" };
function table(head: string[], rows: string[][], numeric: number[] = []) {
  const cell = (t: string, i: number, header: boolean) =>
    new TableCell({
      shading: header ? { type: ShadingType.CLEAR, fill: ACCENT, color: "auto" } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({
        alignment: numeric.includes(i) ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [new TextRun({ text: t, bold: header, color: header ? "FFFFFF" : undefined, size: 20 })],
      })],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({ tableHeader: true, children: head.map((t, i) => cell(t, i, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((t, i) => cell(t, i, false)) })),
    ],
  });
}
const gap = () => new Paragraph({ spacing: { after: 120 }, children: [] });

export async function buildDocx(r: Report): Promise<Blob> {
  const m = r.month;
  const sa = m.setAside, next = m.nextSetAside;
  const daRipartire = m.income - m.allocated;
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: "Finanza · resoconto", color: ACCENT })] }),
    note(`Generato il ${dateLong(r.today)}. Mese in corso: ${mese(r.current)}, dallo stipendio del ${dateLong(r.range.start)} al prossimo del ${dateLong(r.range.nextPayday)}.`),
  );

  // In breve
  children.push(h1("In breve"));
  children.push(p(
    "Il tuo patrimonio è di ", b(e(r.netWorth)), `: ${e(r.liquidity)} di liquidità sui conti e ${e(r.invested)} investiti nel lungo termine.`,
  ));
  children.push(m.income > 0
    ? p(
      `Nel mese di ${mese(r.current)} sono entrati `, b(e(m.income)), ` e ne hai ripartiti ${e(m.allocated)} sui conti`,
      daRipartire > 0 ? `; restano da ripartire ${e(daRipartire)}.` : daRipartire < 0 ? `, cioè ${e(-daRipartire)} più dello stipendio.` : ": lo stipendio è ripartito per intero.",
    )
    : p(`Lo stipendio di ${mese(r.current)} non è ancora stato inserito.`));
  children.push(p(
    "Finora hai speso ", b(e(m.spent)),
    `. La quota giornaliera, cioè quanto puoi spendere ogni giorno fino al prossimo stipendio, è di ${eur(Math.max(0, Math.round(m.quota.quota)), 2)} per i prossimi ${m.quota.daysLeft} giorni.`,
  ));
  children.push(p(
    "Questo mese vanno accantonati ", b(e(sa?.amount ?? 0)),
    ` (${e(sa?.planned ?? 0)} per le spese prevedibili e ${e(sa?.investment ?? 0)} per il lungo termine); finora ne hai accantonati ${e(sa?.paid ?? 0)}. `,
    `Con il prossimo stipendio, il ${dateLong(r.range.nextPayday)}, dovrai accantonare `, b(e(next?.amount ?? 0)), ".",
  ));

  // Conti
  children.push(h1("Conti e patrimonio"));
  children.push(p("Il saldo di ogni conto parte dal saldo iniziale, aggiunge le ripartizioni dello stipendio e toglie le uscite registrate su quel conto."));
  const visible = r.accounts.filter((a) => !a.archived);
  children.push(table(["Conto", "Tipo", "Saldo"], visible.map((a) => [a.name + (a.excluded ? " (escluso dal patrimonio)" : ""), a.kind, e(a.balance)]), [2]));
  children.push(gap());

  // Stipendio e ripartizione
  children.push(h1(`Stipendio di ${mese(r.current)}`));
  if (m.byAccount.length) {
    children.push(p("La ripartizione indica su quali conti hai spostato lo stipendio. Le voci collegate a una spesa prevedibile contano come versamento della sua rata."));
    children.push(table(["Conto", "Importo", "Quota"], m.byAccount.map(([a, v]) => [a, e(v), m.income ? `${Math.round((v / m.income) * 100)}%` : ""]), [1, 2]));
    children.push(gap());
  } else children.push(p("Non c'è ancora una ripartizione per questo mese."));

  // Uscite
  children.push(h1("Uscite del mese"));
  if (m.byCategory.length) {
    children.push(p(`In ${mese(r.current)} hai speso ${e(m.spent)}. Ecco come si dividono per categoria:`));
    children.push(table(["Categoria", "Speso", "Quota"], m.byCategory.map(([c, v]) => [c, e(v), m.spent ? `${Math.round((v / m.spent) * 100)}%` : ""]), [1, 2]));
    children.push(gap());
  } else children.push(p("Nessuna uscita registrata in questo mese."));

  // Spese prevedibili
  children.push(h1("Spese prevedibili"));
  children.push(p("Le spese prevedibili sono spese note in anticipo (assicurazioni, bolli, regali…). Il totale viene diviso in rate mensili da accantonare, così quando arriva la spesa i soldi ci sono già."));
  if (!r.planned.length) children.push(p("Non hai spese prevedibili."));
  for (const s of r.planned) {
    children.push(bullet(
      b(s.name), ` (${s.status.toLowerCase()}): ${e(s.total)} da ${mese(s.start)} ${aMese(s.end)} in ${s.n} ${s.n === 1 ? "rata" : "rate"}. `,
      `Versato ${e(s.paid)}, ${s.paidCount} ${s.paidCount === 1 ? "rata" : "rate"} su ${s.n}.`,
      s.status === "In corso" ? ` Rata di questo mese: ${e(s.rata)}.` : "",
      s.account ? ` Conto dei versamenti: ${s.account}.` : "",
      s.spent > 0 ? ` Già speso: ${e(s.spent)}.` : "",
    ));
  }

  // Lungo termine
  children.push(h1("Lungo termine"));
  children.push(p("Il lungo termine raccoglie i piani di accumulo (PAC): un versamento fisso ogni mese, che può aumentare ogni anno. Un mese risulta versato se hai registrato il versamento oppure se hai ripartito lo stipendio sul conto collegato al piano."));
  if (!r.investments.length) children.push(p("Non hai piani di lungo termine."));
  for (const i of r.investments) {
    const missing = r.contributions.filter((c) => c.name === i.name && c.status === "Da registrare").length;
    children.push(bullet(
      b(i.name), `: ${e(i.monthly)} al mese da ${mese(i.start)}${i.end ? ` ${aMese(i.end)}` : ", senza data di fine"}`,
      i.increase ? `, con un aumento di ${e(i.increase)} ogni anno` : "",
      `. Versato finora: ${e(i.total)}. Versamento di questo mese: ${e(i.nextAmount)}`,
      i.account ? ` sul conto ${i.account}.` : ".",
      missing ? ` ${missing === 1 ? "C'è 1 mese passato" : `Ci sono ${missing} mesi passati`} senza versamento registrato.` : "",
    ));
  }

  // Prossimi mesi
  const upcoming = r.overview.filter((o) => o.month >= r.current).slice(0, 12);
  if (upcoming.length) {
    children.push(h1("Accantonamenti dei prossimi mesi"));
    children.push(p("Quanto andrà accantonato ogni mese, sommando le rate delle spese prevedibili e i versamenti di lungo termine."));
    children.push(table(
      ["Mese", "Prevedibili", "Lungo termine", "Totale", "Versato"],
      upcoming.map((o) => [monthLabel(o.month), e(o.planned), e(o.investment), e(o.amount), o.paid ? e(o.paid) : ""]),
      [1, 2, 3, 4],
    ));
    children.push(gap());
  }

  // Glossario
  children.push(h1("Come leggere i dati"));
  children.push(h2("Il mese"));
  children.push(p(`Nell'app il mese va da uno stipendio al successivo, non dal primo all'ultimo giorno del calendario. Il tuo stipendio arriva il giorno ${r.payday}.`));
  children.push(h2("Termini usati"));
  children.push(
    bullet(b("Ripartizione"), ": come dividi lo stipendio tra i conti appena arriva."),
    bullet(b("Quota giornaliera"), ": soldi ancora disponibili sui conti di spesa, divisi per i giorni che mancano al prossimo stipendio."),
    bullet(b("Accantonare"), ": mettere da parte ogni mese la rata delle spese prevedibili e il versamento del lungo termine."),
    bullet(b("Rata versata"), ": segnata a mano nella spesa prevedibile oppure coperta da una ripartizione collegata alla spesa."),
    bullet(b("Patrimonio"), ": liquidità sui conti più quanto hai investito nel lungo termine."),
  );
  children.push(note("I dati completi, movimento per movimento, sono nell'export Excel."));

  const doc = new Document({
    creator: "Finanza",
    title: "Finanza · resoconto",
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ children }],
  });
  return Packer.toBlob(doc);
}
