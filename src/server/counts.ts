import "server-only";
import { cache } from "react";
import { adminClient, Query, DATABASE_ID } from "@/lib/appwrite/server";
import type { AppContext } from "./context";

async function count(table: string, queries: string[]) {
  const { db } = adminClient();
  try {
    const r = await db.listRows({ databaseId: DATABASE_ID, tableId: table, queries: [...queries, Query.limit(1)] });
    return r.total;
  } catch {
    return 0;
  }
}

export const getShellCounts = cache(async (ctx: AppContext) => {
  const ids = ctx.scopeIds;
  if (!ids.length) return { unread: await count("notifications", [Query.equal("userId", ctx.user.id), Query.isNull("readAt")]), badges: {} };
  const [unread, reimbursements, funding, approvals] = await Promise.all([
    count("notifications", [Query.equal("userId", ctx.user.id), Query.isNull("readAt")]),
    count("reimbursements", [Query.equal("churchId", ids), Query.equal("status", ["submitted", "checking"])]),
    count("funding_requests", [Query.equal("churchId", ids), Query.equal("status", ["received", "reviewing"])]),
    count("expenses", [Query.equal("churchId", ids), Query.equal("status", ["submitted", "in_approval"])]),
  ]);
  return { unread, badges: { reimbursements, funding, approvals } };
});
