import { describe, expect, it } from "vitest";
import { eur, parseAmount, toInput } from "../src/lib/money";
import { periodOf, periodRange } from "../src/lib/period";
import { dailyQuota, equalSplit, investmentYear, plannedAmount, plannedInfo } from "../src/lib/calc";

describe("money", () => {
  it("parses Italian and English formats", () => {
    expect(parseAmount("23,40")).toBe(2340);
    expect(parseAmount("23.4")).toBe(2340);
    expect(parseAmount("1.234,56")).toBe(123456);
    expect(parseAmount("1,234.56")).toBe(123456);
    expect(parseAmount("1.500")).toBe(150000);
    expect(parseAmount("€ 2150")).toBe(215000);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("1,234")).toBeNull(); // ambiguo: rifiutato
  });
  it("formats", () => {
    expect(eur(215000)).toBe("€ 2.150");
    expect(eur(62993)).toBe("€ 629,93");
    expect(eur(6000, 2)).toBe("€ 60,00");
    expect(eur(-500)).toBe("−€ 5");
    expect(toInput(2340)).toBe("23,40");
    expect(toInput(2300)).toBe("23");
  });
});

describe("period", () => {
  it("payday 27 funds next month", () => {
    expect(periodRange("2026-11", 27)).toEqual({
      period: "2026-11", start: "2026-10-27", end: "2026-11-26", nextPayday: "2026-11-27",
    });
    expect(periodOf("2026-11-12", 27)).toBe("2026-11");
    expect(periodOf("2026-11-27", 27)).toBe("2026-12");
    expect(periodOf("2026-10-26", 27)).toBe("2026-10");
  });
  it("payday 5 funds same month", () => {
    expect(periodRange("2026-11", 5)).toEqual({
      period: "2026-11", start: "2026-11-05", end: "2026-12-04", nextPayday: "2026-12-05",
    });
    expect(periodOf("2026-11-04", 5)).toBe("2026-10");
  });
  it("clamps payday 31 in short months", () => {
    const r = periodRange("2026-03", 31);
    expect(r.start).toBe("2026-02-28");
    expect(r.nextPayday).toBe("2026-03-31");
    expect(periodOf("2026-02-28", 31)).toBe("2026-03");
    expect(periodOf("2026-01-31", 31)).toBe("2026-02");
  });
  it("crosses year", () => {
    expect(periodRange("2027-01", 27).start).toBe("2026-12-27");
    expect(periodOf("2026-12-30", 27)).toBe("2027-01");
  });
});

describe("planned expenses", () => {
  it("equal installments when none are saved", () => {
    const p = { totalAmount: 72000, startMonth: "2026-01", endMonth: "2026-12" };
    expect(plannedInfo(p, "2026-11")).toMatchObject({ n: 12, rata: 6000, paid: 0, accrued: 0, status: "active", total: 72000 });
    expect(plannedInfo(p, "2025-12")).toMatchObject({ status: "future" });
    expect(plannedInfo(p, "2027-01")).toMatchObject({ status: "done" });
  });
  it("uses the monthly amounts and what was actually paid", () => {
    // Assicurazione auto: 65 da gennaio a novembre, 85 a dicembre; versate gennaio-ottobre
    const inst = new Map<string, { amount: number; paid: number | null }>();
    for (let m = 1; m <= 12; m++) inst.set(`2026-${String(m).padStart(2, "0")}`, { amount: m === 12 ? 8500 : 6500, paid: m <= 10 ? 6500 : null });
    const i = plannedInfo({ totalAmount: 80000, startMonth: "2026-01", endMonth: "2026-12", installments: inst }, "2026-11");
    expect(i).toMatchObject({ n: 12, rata: 6500, paid: 10, accrued: 65000, total: 80000, status: "active", custom: false });
    expect(i.now).toEqual({ amount: 6500, paid: null });
    expect(plannedInfo({ totalAmount: 80000, startMonth: "2026-01", endMonth: "2026-12", installments: inst }, "2026-12").rata).toBe(8500);
  });
  it("splits a total exactly", () => {
    const m = equalSplit(10000, ["2026-01", "2026-02", "2026-03"]);
    expect([...m.values()]).toEqual([3333, 3333, 3334]);
  });
});

describe("daily quota", () => {
  it("matches the mockup example", () => {
    const r = periodRange("2026-11", 27);
    const q = dailyQuota(r, "2026-11-12", 129000, 62993);
    expect(q.daysLeft).toBe(15);
    expect(q.daysPassed).toBe(17);
    expect(Math.round(q.quota)).toBe(4400);
  });
  it("never divides by zero", () => {
    const r = periodRange("2026-11", 27);
    expect(dailyQuota(r, "2026-11-27", 1000, 0).daysLeft).toBe(1);
  });
});

describe("investments", () => {
  it("builds the year cells", () => {
    const inv = { monthlyAmount: 20000, startMonth: "2026-03", endMonth: null };
    const rec = new Map([["2026-03", 20000], ["2026-05", 25000]]);
    const linked = new Map([["2026-06", 20000]]);
    const cells = investmentYear(inv, 2026, rec, linked, "2026-11");
    expect(cells[0].kind).toBe("none");
    expect(cells[2]).toMatchObject({ kind: "recorded", amount: 20000 });
    expect(cells[3].kind).toBe("missing");
    expect(cells[4].amount).toBe(25000);
    expect(cells[5].kind).toBe("linked");
    expect(cells[10].kind).toBe("planned");
  });
});

import { normalizeUrl } from "../src/supabase";
describe("supabase url", () => {
  it("normalizes common mistakes", () => {
    expect(normalizeUrl(" https://abc.supabase.co/ ").url).toBe("https://abc.supabase.co");
    expect(normalizeUrl("abc.supabase.co").url).toBe("https://abc.supabase.co");
    expect(normalizeUrl("https://abc.supabase.co/rest/v1/").url).toBe("https://abc.supabase.co");
    expect(normalizeUrl("postgresql://u:p@h:6543/postgres").problem).toMatch(/Project URL/);
    expect(normalizeUrl("").problem).toMatch(/Manca/);
  });
});

describe("annual increase", () => {
  it("adds the yearly step to planned months", () => {
    const pac = { monthlyAmount: 25000, annualIncrease: 2500, startMonth: "2027-01", endMonth: "2056-12" };
    expect(plannedAmount(pac, "2027-06")).toBe(25000);
    expect(plannedAmount(pac, "2028-01")).toBe(27500);
    expect(plannedAmount(pac, "2056-12")).toBe(97500);
    let total = 0;
    for (let y = 2027; y <= 2056; y++) total += investmentYear(pac, y, new Map(), new Map(), "2026-11").reduce((a, c) => a + c.amount, 0);
    expect(total).toBe(22050000); // € 220.500 come nel file Excel
  });
});

describe("monthly overview", async () => {
  const { monthEntries, monthsOverview } = await import("../src/lib/monthly");
  const planned = [{
    id: 1, name: "Assicurazione", icon: "car", totalAmount: 30000, startMonth: "2026-10", endMonth: "2026-12", accountId: 2,
    installments: new Map([
      ["2026-10", { amount: 10000, paid: 10000, accountId: 3 }],
      ["2026-11", { amount: 10000, paid: null }],
      ["2026-12", { amount: 10000, paid: null }],
    ]),
  }];
  const pac = {
    id: 7, name: "PAC", monthlyAmount: 20000, annualIncrease: 0, startMonth: "2026-10", endMonth: null, accountId: 5,
    recorded: new Map([["2026-10", 20000]]), linked: new Map<string, number>(),
  };

  it("lists planned installments and long-term contributions of a month", () => {
    const e = monthEntries("2026-10", "2026-11", planned, [pac]);
    expect(e.map((x) => [x.kind, x.rata, x.paid, x.accountId])).toEqual([
      ["investment", 20000, true, 5],
      ["planned", 10000, true, 3],
    ]);
    const nov = monthEntries("2026-11", "2026-11", planned, [pac]);
    expect(nov.find((x) => x.kind === "planned")).toMatchObject({ paid: false, accountId: 2 });
  });

  it("sums both per month and shows open-ended plans for 12 months", () => {
    const m = monthsOverview("2026-11", planned, [pac]);
    expect(m[0]).toMatchObject({ month: "2026-10", amount: 30000, planned: 10000, investment: 20000, paid: 30000 });
    expect(m.find((x) => x.month === "2026-11")).toMatchObject({ amount: 30000, paid: 0, count: 2 });
    expect(m[m.length - 1].month).toBe("2027-10");
  });
});

describe("allocation proposal", async () => {
  const { allocationProposal } = await import("../src/lib/monthly");
  const base = {
    id: 1, name: "Bollo", icon: "receipt", totalAmount: 6000, startMonth: "2026-10", endMonth: "2026-12", accountId: 2,
    installments: new Map([
      ["2026-10", { amount: 2000, paid: null }],
      ["2026-11", { amount: 2000, paid: null }],
      ["2026-12", { amount: 2000, paid: null }],
    ]),
  };
  const pac = {
    id: 7, name: "PAC", monthlyAmount: 20000, annualIncrease: 0, startMonth: "2026-01", endMonth: null, accountId: 5,
    recorded: new Map<string, number>(), linked: new Map<string, number>(),
  };

  it("proposes unpaid installments and long-term contributions", () => {
    const items = allocationProposal("2026-11", "2026-11", [base], [pac]);
    expect(items.map((x) => [x.key, x.amount, x.accountId])).toEqual([["i7", 20000, 5], ["p1", 2000, 2]]);
  });

  it("a linked salary allocation counts as paid installment", () => {
    const linked = { ...base, allocations: new Map([["2026-11", { amount: 2500, accountId: 3 }]]) };
    const row = plannedInfo(linked, "2026-11").rows.find(([m]) => m === "2026-11")![1];
    expect(row).toMatchObject({ paid: 2500, accountId: 3, fromAllocation: true });
    const pacDone = { ...pac, linked: new Map([["2026-12", 20000]]) };
    expect(allocationProposal("2026-11", "2026-11", [linked], [pac]).map((x) => x.key)).toEqual(["i7"]);
    expect(allocationProposal("2026-12", "2026-11", [linked], [pacDone]).map((x) => x.key)).toEqual(["p1"]);
  });
});
