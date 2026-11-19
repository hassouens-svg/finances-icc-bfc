import "server-only";
import { headers } from "next/headers";
import { adminClient, DATABASE_ID } from "@/lib/appwrite/server";
import { sha256 } from "./tokens";

/** Limite simple par fenêtre fixe, stockée dans Appwrite (fonctionne en serverless). */
export async function rateLimit(scope: string, max = 5, windowMs = 10 * 60_000) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const key = `${scope}:${ip}`;
  const rowId = sha256(key).slice(0, 32);
  const { db } = adminClient();
  const now = Date.now();
  try {
    const row = (await db.getRow({ databaseId: DATABASE_ID, tableId: "rate_limits", rowId })) as unknown as { windowStart: string; count: number };
    if (now - new Date(row.windowStart).getTime() > windowMs) {
      await db.updateRow({ databaseId: DATABASE_ID, tableId: "rate_limits", rowId, data: { windowStart: new Date(now).toISOString(), count: 1 } });
      return true;
    }
    if (row.count >= max) return false;
    await db.incrementRowColumn({ databaseId: DATABASE_ID, tableId: "rate_limits", rowId, column: "count", value: 1 });
    return true;
  } catch {
    try {
      await db.createRow({ databaseId: DATABASE_ID, tableId: "rate_limits", rowId, data: { key: key.slice(0, 120), windowStart: new Date(now).toISOString(), count: 1 }, permissions: [] });
    } catch {}
    return true;
  }
}
