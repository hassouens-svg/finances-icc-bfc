/**
 * Mise à niveau des permissions (droits par module) : recalcule les permissions de toutes les lignes et fichiers des églises.
 * Sans effet sur le contenu. Usage : npm run fix:permissions
 */
import "dotenv/config";
import { Client, TablesDB, Storage, Query } from "node-appwrite";
import { DATABASE_ID, TABLES, FILES_BUCKET } from "../src/lib/schema";
import { churchPermissions } from "../src/lib/perms";
import { TABLE_MODULE, ENTITY_MODULE } from "../src/lib/access";

const client = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!).setKey(process.env.APPWRITE_API_KEY!);
const db = new TablesDB(client);
const storage = new Storage(client);
type R = { $id: string; $permissions: string[]; [k: string]: unknown };

async function all(table: string, queries: string[]) {
  const out: R[] = [];
  let cursor: string | undefined;
  for (;;) {
    const r = await db.listRows({ databaseId: DATABASE_ID, tableId: table, queries: [...queries, Query.limit(500), ...(cursor ? [Query.cursorAfter(cursor)] : [])] });
    out.push(...(r.rows as unknown as R[]));
    if (r.rows.length < 500) return out;
    cursor = r.rows[r.rows.length - 1]!.$id;
  }
}
const same = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

(async () => {
  const churches = await all("churches", []);
  let updated = 0;
  for (const c of churches) {
    const team = { teamId: String(c.teamId) };
    for (const t of TABLES) {
      if (t.id === "churches" || t.id === "notifications" || !t.columns.some((x) => x.key === "churchId")) continue;
      const rows = await all(t.id, [Query.equal("churchId", c.$id)]);
      for (const r of rows) {
        const mod = ["attachments", "status_history", "comments"].includes(t.id) ? ENTITY_MODULE[String(r.entityType)] ?? "base" : TABLE_MODULE[t.id] ?? "base";
        const perms = churchPermissions(team, mod);
        if (same(r.$permissions ?? [], perms)) continue;
        await db.updateRow({ databaseId: DATABASE_ID, tableId: t.id, rowId: r.$id, data: {}, permissions: perms });
        updated++;
        if (t.id === "attachments" && r.fileId) await storage.updateFile({ bucketId: FILES_BUCKET, fileId: String(r.fileId), permissions: perms }).catch(() => {});
      }
    }
  }
  console.log(`✅ Permissions à jour (${updated} ligne(s) modifiée(s), ${churches.length} église(s)).`);
})().catch((e) => { console.error("❌", e?.message ?? e); process.exit(1); });
