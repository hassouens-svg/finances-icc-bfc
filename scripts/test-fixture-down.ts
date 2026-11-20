/**
 * Supprime UNIQUEMENT le jeu de TEST : églises « (TEST) » ou « ICC Test … », leurs données, fichiers, équipes,
 * villes « (TEST) »/« Testville », comptes @example.com et journaux régionaux qui les concernent.
 * Les données réelles ne sont jamais touchées.
 */
import "dotenv/config";
import { Client, TablesDB, Users, Teams, Storage, Query } from "node-appwrite";
import { DATABASE_ID, TABLES, FILES_BUCKET, REGION } from "../src/lib/schema";

const client = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!).setKey(process.env.APPWRITE_API_KEY!);
const db = new TablesDB(client);
const users = new Users(client);
const teams = new Teams(client);
const storage = new Storage(client);
type R = { $id: string; [k: string]: unknown };
const isTestChurch = (c: R) => String(c.slug).startsWith("test-") || String(c.name).endsWith("(TEST)") || String(c.name).startsWith("ICC Test ");

async function all(table: string, queries: string[] = []) {
  const out: R[] = [];
  let cursor: string | undefined;
  for (;;) {
    const r = await db.listRows({ databaseId: DATABASE_ID, tableId: table, queries: [...queries, Query.limit(500), ...(cursor ? [Query.cursorAfter(cursor)] : [])] });
    out.push(...(r.rows as unknown as R[]));
    if (r.rows.length < 500) return out;
    cursor = r.rows[r.rows.length - 1]!.$id;
  }
}
async function del(table: string, rows: R[]) {
  for (let i = 0; i < rows.length; i += 25) await Promise.all(rows.slice(i, i + 25).map((r) => db.deleteRow({ databaseId: DATABASE_ID, tableId: table, rowId: r.$id }).catch(() => {})));
  if (rows.length) console.log(`  − ${table} : ${rows.length}`);
}

(async () => {
  const churches = (await all("churches")).filter(isTestChurch);
  const real = (await all("churches")).filter((c) => !isTestChurch(c));
  const ids = churches.map((c) => c.$id);
  console.log(`🧹 Suppression du jeu de test : ${churches.length} église(s) de test (${real.length} église(s) réelle(s) conservée(s))`);
  if (ids.length) {
    // fichiers liés aux églises de test
    const atts = (await Promise.all(Array.from({ length: Math.ceil(ids.length / 50) }, (_, i) => all("attachments", [Query.equal("churchId", ids.slice(i * 50, i * 50 + 50))])))).flat();
    const fileIds = new Set([...atts.map((a) => String(a.fileId)), ...churches.map((c) => c.logoFileId).filter(Boolean).map(String)]);
    for (const f of fileIds) await storage.deleteFile({ bucketId: FILES_BUCKET, fileId: f }).catch(() => {});
    if (fileIds.size) console.log(`  − fichiers : ${fileIds.size}`);
    for (const t of TABLES) {
      if (t.id === "churches" || !t.columns.some((c) => c.key === "churchId")) continue;
      const rows = (await Promise.all(Array.from({ length: Math.ceil(ids.length / 50) }, (_, i) => all(t.id, [Query.equal("churchId", ids.slice(i * 50, i * 50 + 50))])))).flat();
      await del(t.id, rows);
    }
    const prefixes = churches.map((c) => `${c.refPrefix}-`).filter((p) => !real.some((r) => `${r.refPrefix}-` === p));
    await del("counters", (await all("counters")).filter((c) => prefixes.some((p) => String(c.key).startsWith(p))));
    for (const c of churches) await teams.delete({ teamId: String(c.teamId) }).catch(() => {});
    await del("churches", churches);
  }
  const usedCities = new Set(real.map((c) => c.cityId));
  await del("cities", (await all("cities")).filter((c) => !usedCities.has(c.$id) && (String(c.name).endsWith("(TEST)") || String(c.name).startsWith("Testville"))));
  const testUserIds = new Set((await users.list({ queries: [Query.endsWith("email", "@example.com"), Query.limit(100)] })).users.map((u) => u.$id));
  await del("audit_logs", (await all("audit_logs", [Query.equal("churchId", REGION)])).filter((a) => testUserIds.has(String(a.actorId)) || /\(TEST\)|Testville|ICC Test |@example\.com|fresh\./.test(String(a.summary))));
  let n = 0;
  for (;;) {
    const ul = await users.list({ queries: [Query.endsWith("email", "@example.com"), Query.limit(100)] });
    if (!ul.users.length) break;
    for (const u of ul.users) { await users.delete({ userId: u.$id }); n++; }
  }
  if (n) console.log(`  − comptes de test : ${n}`);
  console.log("✅ Jeu de test supprimé.");
})().catch((e) => { console.error("❌", e?.message ?? e); process.exit(1); });
