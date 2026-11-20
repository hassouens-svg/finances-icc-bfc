import { describe, it, expect } from "vitest";
import { coverCharges, monthlyAmount, runwayMonths } from "@/lib/charges";

const charges = [
  { name: "Loyer", amountCents: 120000, frequency: "monthly" as const, sortOrder: 0 },
  { name: "Électricité", amountCents: 18000, frequency: "monthly" as const, sortOrder: 1 },
  { name: "Assurance", amountCents: 120000, frequency: "yearly" as const, sortOrder: 2 },
];

describe("charges fixes", () => {
  it("convertit en montant mensuel", () => {
    expect(monthlyAmount({ amountCents: 30000, frequency: "quarterly" })).toBe(10000);
    expect(monthlyAmount({ amountCents: 120000, frequency: "yearly" })).toBe(10000);
  });
  it("couvre dans l'ordre de priorité (loyer d'abord)", () => {
    const c = coverCharges(charges, 130000);
    expect(c.total).toBe(148000);
    expect(c.items.map((i) => i.state)).toEqual(["covered", "partial", "uncovered"]);
    expect(c.missing).toBe(18000);
    expect(c.status).toBe("short");
  });
  it("signale un équilibre juste puis confortable", () => {
    expect(coverCharges(charges, 150000).status).toBe("tight");
    expect(coverCharges(charges, 200000).status).toBe("ok");
  });
  it("ignore les charges désactivées", () => {
    expect(coverCharges([{ ...charges[0]!, active: false }], 0).total).toBe(0);
  });
  it("calcule l'autonomie en mois", () => {
    expect(runwayMonths(296000, 148000)).toBe(2);
  });
});
