import "server-only";
import { ID, Permission, Role, AppwriteException } from "node-appwrite";
import { revalidatePath } from "next/cache";
import { adminClient, userClient, listAll, getRow, Query, DATABASE_ID } from "@/lib/appwrite/server";
import { MOTHER_TEAM_ID, REGION } from "@/lib/schema";
import { getAllChurches, type AppContext, ForbiddenError } from "./context";
import { monthKey } from "@/lib/period";
import type { Church, Row } from "@/lib/types";

// ---------------- Permissions de ligne ----------------
export function churchPermissions(church: Pick<Church, "teamId">) {
  return [
    Permission.read(Role.team(church.teamId)),
    Permission.read(Role.team(MOTHER_TEAM_ID)),
    Permission.read(Role.label("superadmin")),
    Permission.update(Role.team(church.teamId, "treasurer")),
    Permission.update(Role.team(MOTHER_TEAM_ID, "admin")),
    Permission.update(Role.label("superadmin")),
  ];
}
export function regionPermissions() {
  return [Permission.read(Role.users()), Permission.update(Role.team(MOTHER_TEAM_ID, "admin")), Permission.update(Role.label("superadmin"))];
}
export function userOnlyPermissions(userId: string) {
  return [Permission.read(Role.user(userId)), Permission.update(Role.user(userId))];
}

export async function churchById(id: string) {
  const { churches } = await getAllChurches();
  const c = churches.find((x) => x.$id === id);
  if (!c) throw new ForbiddenError("Église introuvable.");
  return c;
}

export async function permsFor(churchId: string) {
  if (churchId === REGION) return regionPermissions();
  return churchPermissions(await churchById(churchId));
}

// ---------------- Lectures (permissions Appwrite appliquées) ----------------
export async function readDb() {
  return (await userClient()).db;
}

/** Liste les lignes des églises de la vue courante (ou d'églises précises). */
export async function listScoped<T extends Row>(ctx: AppContext, table: string, queries: string[] = [], churchIds?: string[]): Promise<T[]> {
  const ids = churchIds ?? ctx.scopeIds;
  if (!ids.length) return [];
  const db = await readDb();
  return listAll<T>(db, table, [Query.equal("churchId", ids), ...queries]);
}

export async function getScoped<T extends Row & { churchId: string }>(ctx: AppContext, table: string, id: string): Promise<T | null> {
  const db = await readDb();
  const row = await getRow<T>(db, table, id);
  if (!row) return null;
  if (!ctx.isRegional && !ctx.roles[row.churchId]?.length) return null;
  return row;
}

// ---------------- Écritures (après contrôle des droits) ----------------
type Data = Record<string, unknown>;

export async function insert<T extends Row>(table: string, churchId: string, data: Data, opts?: { id?: string; permissions?: string[]; transactionId?: string }) {
  const { db } = adminClient();
  const permissions = opts?.permissions ?? (await permsFor(churchId));
  return (await db.createRow({
    databaseId: DATABASE_ID, tableId: table, rowId: opts?.id ?? ID.unique(), data: { churchId, ...data }, permissions,
    transactionId: opts?.transactionId,
  })) as unknown as T;
}

export async function patch<T extends Row>(table: string, id: string, data: Data, transactionId?: string) {
  const { db } = adminClient();
  return (await db.updateRow({ databaseId: DATABASE_ID, tableId: table, rowId: id, data, transactionId })) as unknown as T;
}

export async function remove(table: string, id: string) {
  const { db } = adminClient();
  await db.deleteRow({ databaseId: DATABASE_ID, tableId: table, rowId: id });
}

export async function adminGet<T extends Row>(table: string, id: string) {
  return getRow<T>(adminClient().db, table, id);
}
export async function adminList<T extends Row>(table: string, queries: string[] = []) {
  return listAll<T>(adminClient().db, table, queries);
}

// ---------------- Numéros de référence ----------------
/** Ex. nextReference("DIJ", "DEP") → "DIJ-DEP-2026-0012" (compteur atomique Appwrite). */
export async function nextReference(prefix: string, kind: string, date = new Date()) {
  const { db } = adminClient();
  const year = date.getUTCFullYear();
  const key = `${prefix}-${kind}-${year}`.toUpperCase();
  const rowId = key.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 36);
  try {
    await db.createRow({ databaseId: DATABASE_ID, tableId: "counters", rowId, data: { key, value: 0 }, permissions: [] });
  } catch (e) {
    if (!(e instanceof AppwriteException) || e.code !== 409) throw e;
  }
  const row = (await db.incrementRowColumn({ databaseId: DATABASE_ID, tableId: "counters", rowId, column: "value", value: 1 })) as unknown as { value: number };
  return `${kind}-${prefix}-${year}-${String(row.value).padStart(4, "0")}`.toUpperCase();
}

export async function churchReference(churchId: string, kind: string, date?: Date) {
  const church = await churchById(churchId);
  return nextReference(church.refPrefix, kind, date);
}

// ---------------- Audit & historique ----------------
export async function audit(
  ctx: Pick<AppContext, "user"> | null,
  churchId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  summary: string,
  before?: unknown,
  after?: unknown,
) {
  const strip = (v: unknown) => (v == null ? null : JSON.stringify(v, (k, x) => (k.startsWith("$") && k !== "$id" ? undefined : x)).slice(0, 60000));
  try {
    await insert("audit_logs", churchId, {
      actorId: ctx?.user.id ?? null, actorName: ctx?.user.name ?? "Public", action, entityType, entityId, summary: summary.slice(0, 300),
      beforeJson: strip(before), afterJson: strip(after),
    });
  } catch (e) {
    console.error("audit failed", e);
  }
}

export async function recordStatus(
  actor: { id?: string | null; name: string },
  churchId: string,
  entityType: string,
  entityId: string,
  fromStatus: string | null,
  toStatus: string,
  comment?: string | null,
) {
  await insert("status_history", churchId, {
    entityType, entityId, fromStatus, toStatus, actorId: actor.id ?? null, actorName: actor.name, comment: comment ?? null,
  });
}

// ---------------- Clôtures ----------------
export async function isMonthLocked(churchId: string, date: string | Date) {
  const rows = await adminList("period_locks", [Query.equal("churchId", churchId), Query.equal("month", monthKey(date)), Query.limit(1)]);
  return rows.length > 0;
}
export async function assertNotLocked(ctx: AppContext, churchId: string, date: string | Date) {
  if (ctx.isRegional) return; // admin : autorisé, mais tracé par l'audit
  if (await isMonthLocked(churchId, date)) throw new ForbiddenError(`Le mois ${monthKey(date)} est clôturé. Seul un administrateur peut le modifier.`);
}

// ---------------- Ledger ----------------
export const CASH = "cash";
export const bankAccountKey = (id: string) => `bank:${id}`;

export async function addMovement(
  churchId: string,
  m: { date: string; account: string; direction: "in" | "out"; amountCents: number; sourceType: string; sourceId?: string | null; label?: string; category?: string | null },
  createdBy?: string,
) {
  if (!m.amountCents) return null;
  return insert("cash_movements", churchId, { ...m, createdBy: createdBy ?? null });
}

export async function removeMovementsFor(sourceType: string, sourceId: string) {
  const rows = await adminList("cash_movements", [Query.equal("sourceType", sourceType), Query.equal("sourceId", sourceId)]);
  for (const r of rows) await remove("cash_movements", r.$id);
}

export function revalidateApp() {
  revalidatePath("/app", "layout");
}
