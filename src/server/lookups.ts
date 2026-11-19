import "server-only";
import { cache } from "react";
import { Query } from "@/lib/appwrite/server";
import { adminList } from "./data";
import { REGION } from "@/lib/schema";
import type { AppContext } from "./context";
import type { BankAccount, Department, ListItem, ListKind, ApprovalWorkflow } from "@/lib/types";

/** Listes de référence (régionales + locales) pour un ensemble d'églises. */
export const getLookups = cache(async (churchIdsKey: string) => {
  const churchIds = churchIdsKey ? churchIdsKey.split(",") : [];
  const [items, departments, bankAccounts] = await Promise.all([
    adminList<ListItem>("list_items", [Query.equal("churchId", [REGION, ...churchIds]), Query.equal("archived", false), Query.orderAsc("sortOrder")]),
    churchIds.length ? adminList<Department>("departments", [Query.equal("churchId", churchIds), Query.equal("archived", false), Query.orderAsc("name")]) : [],
    churchIds.length ? adminList<BankAccount>("bank_accounts", [Query.equal("churchId", churchIds), Query.equal("archived", false), Query.orderAsc("label")]) : [],
  ]);
  const byKind = (k: ListKind) => items.filter((i) => i.kind === k);
  return {
    items,
    categories: byKind("expense_category"),
    donationTypes: byKind("donation_type"),
    crTypes: byKind("cr_request_type"),
    services: byKind("service"),
    departments,
    bankAccounts,
  };
});

export type Lookups = Awaited<ReturnType<typeof getLookups>>;

export function lookupsFor(ctx: AppContext, churchIds?: string[]) {
  return getLookups((churchIds ?? ctx.scopeIds).join(","));
}

/** Filtre les listes pour une église donnée (régionales + propres à l'église). */
export function forChurch<T extends { churchId: string }>(rows: T[], churchId: string) {
  return rows.filter((r) => r.churchId === REGION || r.churchId === churchId);
}

export const getWorkflows = cache(async () => adminList<ApprovalWorkflow>("approval_workflows", [Query.equal("archived", false)]));

export type Settings = {
  crPendingDays: number;
  cashMaxCents: number;
  cashMaxDays: number;
  noOfferingDays: number;
  fiscalReceipts: boolean;
  donorRetentionYears: number;
};
export const DEFAULT_SETTINGS: Settings = { crPendingDays: 14, cashMaxCents: 150000, cashMaxDays: 10, noOfferingDays: 14, fiscalReceipts: false, donorRetentionYears: 6 };

export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await adminList<{ $id: string; $createdAt: string; $updatedAt: string; scope: string; key: string; valueJson: string }>("settings", [Query.equal("scope", "global")]);
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    try {
      (s as Record<string, unknown>)[r.key] = JSON.parse(r.valueJson);
    } catch {}
  }
  return s;
});
