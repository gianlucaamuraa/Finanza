// Export in PDF: un resoconto scritto che spiega i numeri dell'app, con tabelle compatte.

import { jsPDF } from "jspdf";
import autoTable, { type RowInput, type Styles } from "jspdf-autotable";
import { MESI_LUNGHI, monthLabel } from "@/lib/dates";
import { eur as eurRaw } from "@/lib/money";
import type { Report } from "./model";

type RGB = [number, number, number];
const ACCENT: RGB = [15, 118, 110];
const ACCENT_SOFT: RGB = [230, 244, 242];
const TEXT: RGB = [20, 23, 31];
const MUTED: RGB = [107, 114, 128];
const ZEBRA: RGB = [246, 247, 249];
const LINE: RGB = [229, 231, 235];

const M = 16; // margine (mm)
const W = 210 - M * 2; // larghezza utile A4

// i font standard del PDF non hanno il segno meno tipografico
const e = (c: number) => eurRaw(c, "auto").replace("−", "-");
const e2 = (c: number) => eurRaw(c, 2).replace("−", "-");
const dateLong = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return `${dd} ${MESI_LUNGHI[m - 1].toLowerCase()} ${y}`;
};
const mese = (m: string) => monthLabel(m).toLowerCase();
const aMese = (m: string) => `${/^[aeiou]/.test(mese(m)) ? "ad" : "a"} ${mese(m)}`;

export async function buildPdf(r: Report): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = M;

  const space = (h: number) => {
    if (y + h > 297 - M - 8) {
      doc.addPage();
      y = M;
    }
  };
  const h1 = (t: string) => {
    // un titolo non resta da solo in fondo alla pagina: serve spazio anche per testo e inizio tabella
    space(48);
    y += 4;
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...ACCENT).text(t, M, y);
    y += 2;
    doc.setDrawColor(...ACCENT).setLineWidth(0.4).line(M, y, M + W, y);
    y += 5;
  };
  const para = (t: string, opts: { muted?: boolean; size?: number } = {}) => {
    const size = opts.size ?? 10;
    doc.setFont("helvetica", "normal").setFontSize(size).setTextColor(...(opts.muted ? MUTED : TEXT));
    const lines = doc.splitTextToSize(t, W) as string[];
    const lh = size * 0.42;
    space(lines.length * lh + 2);
    doc.text(lines, M, y);
    y += lines.length * lh + 2.5;
  };
  /** Tabella compatta: larghezza adatta al contenuto (al massimo la pagina), numeri allineati a destra. */
  const table = (head: string[], body: RowInput[], numeric: number[] = [], opts: { width?: number; foot?: RowInput } = {}) => {
    const columnStyles: Record<number, Partial<Styles>> = {};
    numeric.forEach((i) => (columnStyles[i] = { halign: "right" }));
    // una tabella corta non si spezza tra due pagine: se non ci sta, va alla pagina dopo
    space(Math.min((body.length + (opts.foot ? 2 : 1)) * 7.5 + 4, 110));
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: M + 8 },
      head: [head],
      body,
      foot: opts.foot ? [opts.foot] : undefined,
      showFoot: "lastPage",
      tableWidth: opts.width ?? "wrap",
      theme: "plain",
      styles: { font: "helvetica", fontSize: 9, textColor: TEXT, cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 2.5 }, lineColor: LINE, overflow: "linebreak" },
      headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: "bold" },
      footStyles: { fillColor: ACCENT_SOFT, textColor: ACCENT, fontStyle: "bold" },
      alternateRowStyles: { fillColor: ZEBRA },
      columnStyles,
      didParseCell: (d) => {
        if (numeric.includes(d.column.index)) d.cell.styles.halign = "right";
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  };
  /** Riquadri con un numero in evidenza. */
  const tiles = (items: [string, string, string?][]) => {
    const gap = 3, h = 19, w = (W - gap * (items.length - 1)) / items.length;
    space(h + 4);
    items.forEach(([label, value, sub], i) => {
      const x = M + i * (w + gap);
      doc.setFillColor(...ACCENT_SOFT).roundedRect(x, y, w, h, 2.5, 2.5, "F");
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED).text(label, x + 3, y + 5);
      doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...ACCENT).text(value, x + 3, y + 11.5);
      if (sub) doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED).text(sub, x + 3, y + 16);
    });
    y += h + 5;
  };

  const m = r.month, sa = m.setAside, next = m.nextSetAside;
  const daRipartire = m.income - m.allocated;

  // Intestazione
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...ACCENT).text("Finanza", M, y + 6);
  const titleW = doc.getTextWidth("Finanza");
  doc.setFont("helvetica", "normal").setFontSize(20).setTextColor(...TEXT).text(" · resoconto", M + titleW, y + 6);
  y += 12;
  para(
    `Generato il ${dateLong(r.today)}. Mese in corso: ${mese(r.current)}, dallo stipendio del ${dateLong(r.range.start)} al prossimo del ${dateLong(r.range.nextPayday)}.`,
    { muted: true, size: 9 },
  );
  y += 1;
  tiles([
    ["Patrimonio", e2(r.netWorth), `banche ${e(r.banks)} · contanti ${e(r.cash)}`],
    ["Entrate del mese", e(m.income), m.income ? (daRipartire > 0 ? `${e(daRipartire)} da ripartire` : "tutto ripartito") : "non inserite"],
    ["Uscite del mese", e(m.spent), `quota ${e2(Math.max(0, Math.round(m.quota.quota)))}/giorno`],
    ["Da accantonare", e(sa?.amount ?? 0), `accantonati ${e(sa?.savingPaid ?? 0)}`],
  ]);

  // In breve
  h1("In breve");
  para(`Il patrimonio è di ${e2(r.netWorth)}: ${e2(r.banks)} sui conti in banca e ${e2(r.cash)} in contanti` + (r.invested ? `, più ${e2(r.invested)} investiti nel lungo termine.` : "."));
  para(m.income > 0
    ? `Nel mese di ${mese(r.current)} sono entrati ${e(m.income)} e ne hai ripartiti ${e(m.allocated)} sui conti` +
      (daRipartire > 0 ? `; restano da ripartire ${e(daRipartire)}.` : daRipartire < 0 ? `, cioè ${e(-daRipartire)} più dello stipendio.` : ": lo stipendio è ripartito per intero.")
    : `Lo stipendio di ${mese(r.current)} non è ancora stato inserito.`);
  para(`Finora hai speso ${e(m.spent)}. La quota giornaliera, cioè quanto puoi spendere ogni giorno fino al prossimo stipendio, è di ${e2(Math.max(0, Math.round(m.quota.quota)))} per i prossimi ${m.quota.daysLeft} giorni.`);
  para(
    `Questo mese vanno accantonati ${e(sa?.amount ?? 0)} (${e(sa?.planned ?? 0)} per le spese prevedibili e ${e(sa?.investment ?? 0)} per il lungo termine); finora ne hai versati ${e(sa?.paid ?? 0)}, di cui ${e(sa?.savingPaid ?? 0)} messi da parte. ` +
    `Con il prossimo stipendio, il ${dateLong(r.range.nextPayday)}, dovrai accantonare ${e(next?.amount ?? 0)}.`,
  );

  // Conti
  h1("Conti e patrimonio");
  para("Il saldo di ogni conto parte dal saldo iniziale, aggiunge le ripartizioni dello stipendio e toglie le uscite registrate su quel conto.");
  const visible = r.accounts.filter((a) => !a.archived);
  table(["Conto", "Tipo", "Saldo"], visible.map((a) => [a.name + (a.excluded ? " (escluso dal patrimonio)" : ""), a.kind, e(a.balance)]), [2], {
    foot: ["Patrimonio", "", e(r.netWorth)],
  });

  // Stipendio e ripartizione
  h1(`Stipendio di ${mese(r.current)}`);
  if (m.byAccount.length) {
    para("La ripartizione indica su quali conti hai spostato lo stipendio. Le voci collegate a una spesa prevedibile contano come versamento della sua rata.");
    table(["Conto", "Importo", "Quota"], m.byAccount.map(([a, v]) => [a, e(v), m.income ? `${Math.round((v / m.income) * 100)}%` : ""]), [1, 2], {
      foot: ["Totale ripartito", e(m.allocated), m.income ? `${Math.round((m.allocated / m.income) * 100)}%` : ""],
    });
  } else para("Non c'è ancora una ripartizione per questo mese.");

  // Uscite
  h1("Uscite del mese");
  if (m.byCategory.length) {
    para(`In ${mese(r.current)} hai speso ${e(m.spent)}. Ecco come si dividono per categoria:`);
    table(["Categoria", "Speso", "Quota"], m.byCategory.map(([c, v]) => [c, e2(v), m.spent ? `${Math.round((v / m.spent) * 100)}%` : ""]), [1, 2], {
      foot: ["Totale", e2(m.spent), "100%"],
    });
  } else para("Nessuna uscita registrata in questo mese.");

  // Spese prevedibili
  h1("Spese prevedibili");
  para("Le spese prevedibili sono spese note in anticipo (assicurazioni, bolli, regali). Il totale viene diviso in rate mensili da accantonare, così quando arriva la spesa i soldi ci sono già.");
  if (!r.planned.length) para("Non hai spese prevedibili.");
  else {
    table(
      ["Spesa", "Stato", "Periodo", "Totale", "Versato", "Rate", "Rata del mese", "Conto"],
      r.planned.map((s) => [
        s.name, s.status, `${monthLabel(s.start, false)} - ${monthLabel(s.end, false)}`, e(s.total), e(s.paid),
        `${s.paidCount}/${s.n}`, s.status === "In corso" ? e(s.rata) : "", s.account,
      ]),
      [3, 4, 5, 6],
    );
    const spent = r.planned.filter((s) => s.spent > 0);
    if (spent.length) para(`Già spesi: ${spent.map((s) => `${s.name} ${e(s.spent)}`).join(", ")}.`, { muted: true, size: 9 });
  }

  // Lungo termine
  h1("Lungo termine");
  para("Il lungo termine raccoglie i piani di accumulo (PAC): un versamento fisso ogni mese, che può aumentare ogni anno. Un mese risulta versato se hai registrato il versamento oppure se hai ripartito lo stipendio sul conto collegato al piano.");
  if (!r.investments.length) para("Non hai piani di lungo termine.");
  for (const i of r.investments) {
    const missing = r.contributions.filter((c) => c.name === i.name && c.status === "Da registrare").length;
    para(
      `${i.name}: ${e(i.monthly)} al mese da ${mese(i.start)}${i.end ? ` ${aMese(i.end)}` : ", senza data di fine"}` +
      (i.increase ? `, con un aumento di ${e(i.increase)} ogni anno` : "") +
      `. Versato finora ${e(i.total)}; versamento di questo mese ${e(i.nextAmount)}${i.account ? ` sul conto ${i.account}` : ""}.` +
      (missing ? ` ${missing === 1 ? "C'è 1 mese passato" : `Ci sono ${missing} mesi passati`} senza versamento registrato.` : ""),
    );
  }

  // Prossimi mesi
  const upcoming = r.overview.filter((o) => o.month >= r.current).slice(0, 12);
  if (upcoming.length) {
    h1("Accantonamenti dei prossimi mesi");
    para("Quanto andrà accantonato ogni mese, sommando le rate delle spese prevedibili e i versamenti di lungo termine.");
    table(
      ["Mese", "Prevedibili", "Lungo termine", "Totale", "Versato"],
      upcoming.map((o) => [monthLabel(o.month), e(o.planned), e(o.investment), e(o.amount), o.paid ? e(o.paid) : ""]),
      [1, 2, 3, 4],
    );
  }

  // Glossario
  h1("Come leggere i dati");
  para(`Nell'app il mese va da uno stipendio al successivo, non dal primo all'ultimo giorno del calendario. Il tuo stipendio arriva il giorno ${r.payday}.`);
  table(["Termine", "Significato"], [
    ["Ripartizione", "Come dividi lo stipendio tra i conti appena arriva."],
    ["Quota giornaliera", "Soldi ancora disponibili sui conti di spesa, divisi per i giorni che mancano al prossimo stipendio."],
    ["Accantonare", "Mettere da parte ogni mese la rata delle spese prevedibili e il versamento del lungo termine."],
    ["Rata versata", "Segnata a mano nella spesa prevedibile, oppure coperta da una ripartizione collegata alla spesa."],
    ["Patrimonio", "Soldi sui conti in banca, più i contanti, più quanto hai investito nel lungo termine. I conti segnati come esclusi (per esempio quello del prestito) non contano."],
  ], [], { width: W });
  para("I dati completi, movimento per movimento, sono nell'export Excel.", { muted: true, size: 9 });

  // piè di pagina
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    doc.text(`Finanza · ${dateLong(r.today)}`, M, 297 - M + 4);
    doc.text(`Pagina ${i} di ${pages}`, M + W, 297 - M + 4, { align: "right" });
  }
  return doc.output("blob");
}
