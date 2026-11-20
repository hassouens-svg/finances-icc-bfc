import "server-only";
import { Query } from "node-appwrite";
import { listScoped } from "./data";
import { getBalances } from "./treasury";
import { coverCharges, monthlyAmount, runwayMonths } from "@/lib/charges";
import type { AppContext } from "./context";
import type { Expense, OfferingLine, RecurringCharge } from "@/lib/types";

/** Couverture des charges fixes d'une église : entrées du mois, moyenne des 3 derniers mois, autonomie. */
export async function chargesOverview(ctx: AppContext, churchId: string) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const threeAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1));
  const [charges, lines, paid, { balances }] = await Promise.all([
    listScoped<RecurringCharge>(ctx, "recurring_charges", [Query.orderAsc("sortOrder")], [churchId]),
    listScoped<OfferingLine>(ctx, "offering_lines", [Query.greaterThanEqual("date", threeAgo.toISOString()), Query.select(["amountCents", "date"])], [churchId]),
    listScoped<Expense>(ctx, "expenses", [Query.equal("source", "recurring"), Query.greaterThanEqual("date", monthStart.toISOString()), Query.equal("archived", false), Query.select(["$id", "sourceId", "status"])], [churchId]),
    getBalances(ctx, [churchId]),
  ]);
  const active = charges.filter((c) => c.active);
  const thisMonth = lines.filter((l) => new Date(l.date) >= monthStart).reduce((a, l) => a + l.amountCents, 0);
  const avg3 = Math.round(lines.filter((l) => new Date(l.date) < monthStart).reduce((a, l) => a + l.amountCents, 0) / 3);
  const monthlyTotal = active.reduce((a, c) => a + monthlyAmount(c), 0);
  return {
    charges,
    monthlyTotal,
    thisMonth,
    avg3,
    coverageMonth: coverCharges(active, thisMonth),
    coverageAvg: coverCharges(active, avg3),
    available: balances.total,
    runway: runwayMonths(balances.total, monthlyTotal),
    expenseFor: (id: string) => paid.find((e) => e.sourceId === id) ?? null,
  };
}
