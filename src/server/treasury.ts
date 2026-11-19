import "server-only";
import { cache } from "react";
import { Query } from "node-appwrite";
import { listScoped } from "./data";
import { getLookups } from "./lookups";
import { computeBalances } from "@/lib/finance";
import type { AppContext } from "./context";
import type { CashMovement } from "@/lib/types";

export const getMovements = cache(async (ctx: AppContext, key: string) => {
  const ids = key ? key.split(",") : [];
  return listScoped<CashMovement>(ctx, "cash_movements", [Query.orderAsc("date"), Query.select(["$id", "churchId", "date", "account", "direction", "amountCents", "sourceType", "sourceId", "label", "category"])], ids, );
});

export async function movementsFor(ctx: AppContext, churchIds?: string[]) {
  return getMovements(ctx, (churchIds ?? ctx.scopeIds).join(","));
}

export async function getBalances(ctx: AppContext, churchIds?: string[]) {
  const ids = churchIds ?? ctx.scopeIds;
  const [movs, lk] = await Promise.all([movementsFor(ctx, ids), getLookups(ids.join(","))]);
  return { balances: computeBalances(movs, lk.bankAccounts), accounts: lk.bankAccounts, movements: movs };
}

export async function getCashInHand(ctx: AppContext, churchIds?: string[]) {
  return (await getBalances(ctx, churchIds)).balances.cash;
}
