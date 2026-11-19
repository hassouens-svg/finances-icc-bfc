import { describe, it, expect } from "vitest";
import {
  movementsForOfferingLine, movementsForDeposit, movementsForPaidExpense, computeBalances, incomeStatement, sessionTotals, depositAdjustment, monthlyFlows,
} from "@/lib/finance";
import { parseEuroToCents, formatEuro } from "@/lib/format";

const D = "2026-10-05T12:00:00.000Z";

describe("montants", () => {
  it("parse les saisies françaises en centimes", () => {
    expect(parseEuroToCents("1 250,50")).toBe(125050);
    expect(parseEuroToCents("12,5")).toBe(1250);
    expect(parseEuroToCents("0,1")).toBe(10);
    expect(parseEuroToCents("abc")).toBeNaN();
    expect(parseEuroToCents("1,234")).toBeNaN();
  });
  it("formate en euros français", () => {
    expect(formatEuro(125000)).toBe("1 250,00 €");
  });
});

describe("caisse et banque", () => {
  const accounts = [{ $id: "b1", openingBalanceCents: 100000 }];
  const movs = [
    ...movementsForOfferingLine({ $id: "l1", date: D, amountCents: 30000, method: "cash" }),
    ...movementsForOfferingLine({ $id: "l2", date: D, amountCents: 5000, method: "cheque" }),
    ...movementsForOfferingLine({ $id: "l3", date: D, amountCents: 20000, method: "transfer", bankAccountId: "b1" }),
    ...movementsForDeposit({ $id: "d1", date: D, cashCents: 25000, chequeCents: 5000, bankAccountId: "b1" }),
    ...movementsForPaidExpense({ $id: "e1", date: D, amountCents: 2000, paymentMethod: "cash" }),
    ...movementsForPaidExpense({ $id: "e2", date: D, amountCents: 15000, paymentMethod: "bank_transfer", bankAccountId: "b1" }),
  ];
  const b = computeBalances(movs, accounts);
  it("Caisse = espèces/chèques − dépôts − dépenses en espèces", () => {
    expect(b.cash).toBe(30000 + 5000 - 30000 - 2000);
  });
  it("Banque = ouverture + dépôts + virements − dépenses bancaires", () => {
    expect(b.banks.b1).toBe(100000 + 30000 + 20000 - 15000);
  });
  it("Total disponible = caisse + banques", () => {
    expect(b.total).toBe(b.cash + b.bankTotal);
  });
  it("un dépôt ne change pas le total disponible", () => {
    const before = computeBalances(movs.filter((m) => m.sourceType !== "deposit"), accounts);
    expect(before.total).toBe(b.total);
  });
  it("écart de dépôt confirmé → ajustement bancaire", () => {
    const adj = depositAdjustment({ date: D, cashCents: 10000, chequeCents: 0, bankAccountId: "b1" }, 9500);
    expect(adj).toMatchObject({ direction: "out", amountCents: 500, account: "bank:b1" });
    expect(depositAdjustment({ date: D, cashCents: 10000, chequeCents: 0, bankAccountId: "b1" }, 10000)).toBeNull();
  });
  it("refuse un don par virement sans compte bancaire", () => {
    expect(() => movementsForOfferingLine({ date: D, amountCents: 100, method: "transfer" })).toThrow();
  });
  it("les flux mensuels ignorent les dépôts (transfert interne)", () => {
    const f = monthlyFlows(movs, ["2026-10"]);
    expect(f[0]).toEqual({ month: "2026-10", in: 55000, out: 17000 });
  });
});

describe("compte de résultat", () => {
  const from = new Date("2026-10-01T00:00:00Z");
  const to = new Date("2026-11-01T00:00:00Z");
  const r = incomeStatement(
    [
      { amountCents: 10000, donationTypeName: "Dîme", date: D },
      { amountCents: 5000, donationTypeName: "Offrande", date: D },
      { amountCents: 99999, donationTypeName: "Offrande", date: "2026-11-02T12:00:00Z" },
    ],
    [
      { amountCents: 3000, categoryName: "Loyer", status: "paid", date: D },
      { amountCents: 7000, categoryName: "Loyer", status: "approved", date: D },
    ],
    from, to,
  );
  it("produits − charges payées de la période", () => {
    expect(r.totalProducts).toBe(15000);
    expect(r.totalCharges).toBe(3000);
    expect(r.result).toBe(12000);
  });
});

describe("séance d'offrandes", () => {
  it("calcule l'écart de comptage sur espèces + chèques", () => {
    const t = sessionTotals([{ amountCents: 10000, method: "cash" }, { amountCents: 2000, method: "cheque" }, { amountCents: 5000, method: "card" }], 9800, 2000);
    expect(t).toEqual({ cash: 10000, cheque: 2000, other: 5000, entered: 17000, gap: -200 });
  });
});
