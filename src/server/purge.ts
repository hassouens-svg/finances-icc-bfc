import "server-only";
import { Query } from "node-appwrite";
import { adminClient } from "@/lib/appwrite/server";
import { DATABASE_ID, TABLES, FILES_BUCKET, MOTHER_TEAM_ID } from "@/lib/schema";

type R = { $id: string; [k: string]: unknown };

async function all(table: string, queries: string[] = []) {
  const { db } = adminClient();
  const out: R[] = [];
  let cursor: string | undefined;
  for (;;) {
    const r = await db.listRows({ databaseId: DATABASE_ID, tableId: table, queries: [...queries, Query.limit(500), ...(cursor ? [Query.cursorAfter(cursor)] : [])] });
    out.push(...(r.rows as unknown as R[]));
    if (r.rows.length < 500) return out;
    cursor = r.rows[r.rows.length - 1]!.$id;
  }
}

async function delRows(table: string, rows: R[]) {
  const { db } = adminClient();
  for (let i = 0; i < rows.length; i += 25) {
    await Promise.all(rows.slice(i, i + 25).map((r) => db.deleteRow({ databaseId: DATABASE_ID, tableId: table, rowId: r.$id }).catch(() => {})));
  }
  return rows.length;
}

/**
 * Supprime définitivement une église : toutes ses données, ses fichiers, son équipe, ses compteurs de références,
 * et les comptes qui n'avaient accès qu'à elle (jamais un super admin, un admin église mère, ni la personne qui supprime).
 */
export async function purgeChurch(church: { $id: string; teamId: string; refPrefix: string; logoFileId?: string | null }, keepUserId: string) {
  const { storage, teams, users } = adminClient();
  // comptes rattachés à cette seule église (calculé avant de supprimer l'équipe)
  const members = (await teams.listMemberships({ teamId: church.teamId, queries: [Query.limit(500)] }).catch(() => ({ memberships: [] as { userId: string }[] }))).memberships;
  const toDelete: string[] = [];
  for (const m of members) {
    if (m.userId === keepUserId) continue;
    const u = await users.get({ userId: m.userId }).catch(() => null);
    if (!u || u.labels?.includes("superadmin")) continue;
    const ms = (await users.listMemberships({ userId: m.userId })).memberships;
    if (ms.some((x) => x.teamId !== church.teamId || x.teamId === MOTHER_TEAM_ID)) continue;
    toDelete.push(m.userId);
  }

  const atts = await all("attachments", [Query.equal("churchId", church.$id)]);
  const fileIds = new Set([...atts.map((a) => String(a.fileId)), ...(church.logoFileId ? [church.logoFileId] : [])]);
  for (const f of fileIds) await storage.deleteFile({ bucketId: FILES_BUCKET, fileId: f }).catch(() => {});
  let rows = 0;
  for (const t of TABLES) {
    if (t.id === "churches" || !t.columns.some((c) => c.key === "churchId")) continue;
    rows += await delRows(t.id, await all(t.id, [Query.equal("churchId", church.$id)]));
  }
  const others = (await all("churches")).filter((c) => c.$id !== church.$id);
  if (!others.some((c) => c.refPrefix === church.refPrefix)) {
    rows += await delRows("counters", (await all("counters")).filter((c) => String(c.key).startsWith(`${church.refPrefix}-`)));
  }
  await teams.delete({ teamId: church.teamId }).catch(() => {});
  await delRows("churches", [{ $id: church.$id }]);
  for (const id of toDelete) await users.delete({ userId: id }).catch(() => {});
  return { rows, files: fileIds.size, users: toDelete.length };
}
