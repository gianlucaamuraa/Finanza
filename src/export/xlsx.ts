// Export in Excel: un foglio per ogni sezione dell'app.

import ExcelJS from "exceljs";
import { monthLabel } from "@/lib/dates";
import type { Report } from "./model";

const EUR = '#,##0.00 "€";-#,##0.00 "€"';
const ACCENT = "FF0F766E";

type Col = { header: string; width: number; type?: "eur" | "date" | "text" | "int" | "pct" };

const eurOf = (cents: number | null | undefined) => (cents == null ? null : cents / 100);
const month = (m: string) => (m ? monthLabel(m, false) : "");
const date = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
};

function sheet(wb: ExcelJS.Workbook, name: string, cols: Col[], rows: (string | number | Date | null)[][]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, width: c.width }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };
  head.alignment = { vertical: "middle" };
  head.height = 20;
  rows.forEach((r) => ws.addRow(r));
  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (c.type === "eur") col.numFmt = EUR;
    if (c.type === "date") col.numFmt = "dd/mm/yyyy";
    if (c.type === "pct") col.numFmt = "0%";
  });
  if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return ws;
}

/** Foglio di riepilogo (i numeri della Dashboard) con sezioni etichetta/valore. */
function summary(wb: ExcelJS.Workbook, r: Report) {
  const ws = wb.addWorksheet("Riepilogo");
  ws.columns = [{ width: 38 }, { width: 18 }, { width: 40 }];
  const title = ws.addRow(["Finanza · riepilogo"]);
  title.font = { bold: true, size: 16, color: { argb: ACCENT } };
  ws.addRow([`Esportato il ${r.today.split("-").reverse().join("/")} · mese in corso: ${monthLabel(r.current)} (dal ${r.range.start.split("-").reverse().join("/")})`]).font = { color: { argb: "FF6B7280" } };
  const section = (t: string) => {
    ws.addRow([]);
    const row = ws.addRow([t]);
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };
    ws.mergeCells(row.number, 1, row.number, 3);
  };
  const line = (label: string, cents: number | null, note = "") => {
    const row = ws.addRow([label, eurOf(cents), note]);
    row.getCell(2).numFmt = EUR;
    row.getCell(3).font = { color: { argb: "FF6B7280" } };
  };
  const m = r.month;
  section("Patrimonio");
  line("Patrimonio totale", r.netWorth);
  line("Liquidità", r.liquidity, "conti e contanti, esclusi quelli segnati come esclusi");
  line("Investito", r.invested, "versamenti di lungo termine e conti di investimento");
  section(`Ultimo stipendio · ${monthLabel(r.current)}`);
  line("Entrate", m.income);
  line("Ripartito sui conti", m.allocated);
  line("Da ripartire", m.income - m.allocated);
  line("Uscite del mese", m.spent);
  line("Quota giornaliera", Math.max(0, Math.round(m.quota.quota)), `${m.quota.daysLeft} giorni al prossimo stipendio`);
  section("Accantonamenti");
  line("Da accantonare questo mese", m.setAside?.amount ?? 0, "spese prevedibili + lungo termine");
  line("  di cui spese prevedibili", m.setAside?.planned ?? 0);
  line("  di cui lungo termine", m.setAside?.investment ?? 0);
  line("Già accantonato", m.setAside?.paid ?? 0);
  line("Al prossimo stipendio", m.nextSetAside?.amount ?? 0, `${r.range.nextPayday.split("-").reverse().join("/")} · per ${monthLabel(r.nextMonth)}`);
  if (m.byCategory.length) {
    section("Uscite del mese per categoria");
    m.byCategory.forEach(([c, v]) => line(c, v));
  }
  if (m.byAccount.length) {
    section("Ripartizione dello stipendio per conto");
    m.byAccount.forEach(([c, v]) => line(c, v));
  }
}

export async function buildXlsx(r: Report): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Finanza";
  wb.created = new Date();
  summary(wb, r);

  sheet(wb, "Conti", [
    { header: "Conto", width: 26 }, { header: "Tipo", width: 14 }, { header: "Saldo iniziale", width: 16, type: "eur" },
    { header: "Saldo attuale", width: 16, type: "eur" }, { header: "Nella quota", width: 12 }, { header: "Escluso dal patrimonio", width: 22 }, { header: "Archiviato", width: 12 },
  ], r.accounts.map((a) => [a.name, a.kind, eurOf(a.initial), eurOf(a.balance), a.inQuota ? "sì" : "", a.excluded ? "sì" : "", a.archived ? "sì" : ""]));

  sheet(wb, "Mese per mese", [
    { header: "Mese", width: 14 }, { header: "Totale da accantonare", width: 22, type: "eur" }, { header: "Spese prevedibili", width: 18, type: "eur" },
    { header: "Lungo termine", width: 16, type: "eur" }, { header: "Versato", width: 14, type: "eur" }, { header: "Voci", width: 8 }, { header: "Voci versate", width: 13 },
  ], r.overview.map((o) => [month(o.month), eurOf(o.amount), eurOf(o.planned), eurOf(o.investment), eurOf(o.paid), o.count, o.paidCount]));

  sheet(wb, "Entrate", [
    { header: "Mese", width: 14 }, { header: "Data", width: 12, type: "date" }, { header: "Descrizione", width: 30 }, { header: "Importo", width: 14, type: "eur" },
  ], r.incomes.map((i) => [month(i.period), date(i.date), i.description, eurOf(i.amount)]));

  sheet(wb, "Ripartizioni", [
    { header: "Mese", width: 14 }, { header: "Conto", width: 24 }, { header: "Importo", width: 14, type: "eur" },
    { header: "Per la spesa prevedibile", width: 26 }, { header: "Nota", width: 30 },
  ], r.allocations.map((a) => [month(a.period), a.account, eurOf(a.amount), a.planned, a.note]));

  sheet(wb, "Uscite", [
    { header: "Data", width: 12, type: "date" }, { header: "Mese", width: 14 }, { header: "Conto", width: 22 }, { header: "Categoria", width: 20 },
    { header: "Descrizione", width: 30 }, { header: "Importo", width: 14, type: "eur" }, { header: "Spesa prevedibile", width: 24 },
  ], r.expenses.map((e) => [date(e.date), month(e.period), e.account, e.category, e.description, eurOf(e.amount), e.planned]));

  sheet(wb, "Spese prevedibili", [
    { header: "Spesa", width: 26 }, { header: "Stato", width: 11 }, { header: "Dal", width: 11 }, { header: "Al", width: 11 },
    { header: "Totale", width: 14, type: "eur" }, { header: "Versato", width: 14, type: "eur" }, { header: "Rate versate", width: 13 },
    { header: "Rata del mese", width: 14, type: "eur" }, { header: "Speso", width: 14, type: "eur" }, { header: "Conto", width: 22 }, { header: "Nota", width: 26 },
  ], r.planned.map((p) => [p.name, p.status, month(p.start), month(p.end), eurOf(p.total), eurOf(p.paid), `${p.paidCount}/${p.n}`, eurOf(p.rata), eurOf(p.spent), p.account, p.note]));

  sheet(wb, "Rate", [
    { header: "Spesa", width: 26 }, { header: "Mese", width: 12 }, { header: "Rata", width: 14, type: "eur" },
    { header: "Versato", width: 14, type: "eur" }, { header: "Conto", width: 22 }, { header: "Come", width: 22 },
  ], r.installments.map((i) => [i.name, month(i.month), eurOf(i.amount), eurOf(i.paid), i.account, i.source]));

  sheet(wb, "Lungo termine", [
    { header: "Piano", width: 24 }, { header: "Versamento mensile", width: 18, type: "eur" }, { header: "Aumento annuo", width: 15, type: "eur" },
    { header: "Dal", width: 11 }, { header: "Al", width: 11 }, { header: "Conto", width: 22 }, { header: "Totale versato", width: 16, type: "eur" },
  ], r.investments.map((i) => [i.name, eurOf(i.monthly), eurOf(i.increase), month(i.start), i.end ? month(i.end) : "senza fine", i.account, eurOf(i.total)]));

  sheet(wb, "Versamenti PAC", [
    { header: "Piano", width: 24 }, { header: "Mese", width: 12 }, { header: "Previsto", width: 14, type: "eur" },
    { header: "Versato", width: 14, type: "eur" }, { header: "Stato", width: 18 },
  ], r.contributions.map((c) => [c.name, month(c.month), eurOf(c.planned), eurOf(c.paid), c.status]));

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
