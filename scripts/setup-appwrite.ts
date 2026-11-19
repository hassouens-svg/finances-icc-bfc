/**
 * Crée (de façon idempotente) la base, les tables, colonnes, index, buckets et la team église mère.
 * Usage : npm run setup:appwrite
 * Ne supprime jamais rien : relancer le script ajoute seulement ce qui manque.
 */
import "dotenv/config";
import { Client, TablesDB, Storage, Teams, Permission, Role, Query, AppwriteException } from "node-appwrite";
import { DATABASE_ID, TABLES, BUCKETS, MOTHER_TEAM_ID, type ColumnDef, type TableDef } from "../src/lib/schema";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const key = process.env.APPWRITE_API_KEY!;
if (!endpoint || !project || !key) {
  console.error("❌ Variables manquantes : NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, APPWRITE_API_KEY");
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(project).setKey(key);
const db = new TablesDB(client);
const storage = new Storage(client);
const teams = new Teams(client);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isNotFound = (e: unknown) => e instanceof AppwriteException && e.code === 404;

function toInlineColumn(c: ColumnDef): Record<string, unknown> {
  const base: Record<string, unknown> = { key: c.key, type: c.type, required: c.required ?? false };
  if ("array" in c && c.array) base.array = true;
  if (c.type === "varchar") base.size = c.size;
  if (c.type === "enum") base.elements = c.elements;
  if ("default" in c && c.default !== undefined && !c.required) base.default = c.default;
  return base;
}

async function createColumn(tableId: string, c: ColumnDef) {
  const common = { databaseId: DATABASE_ID, tableId, key: c.key, required: c.required ?? false };
  const def = "default" in c && !c.required ? c.default : undefined;
  switch (c.type) {
    case "varchar":
      return db.createVarcharColumn({ ...common, size: c.size, xdefault: def as string | undefined, array: c.array });
    case "text":
      return db.createTextColumn({ ...common, xdefault: def as string | undefined });
    case "integer":
      return db.createIntegerColumn({ ...common, xdefault: def as number | undefined, array: c.array, min: c.min, max: c.max });
    case "boolean":
      return db.createBooleanColumn({ ...common, xdefault: def as boolean | undefined });
    case "datetime":
      return db.createDatetimeColumn({ ...common });
    case "enum":
      return db.createEnumColumn({ ...common, elements: [...c.elements], xdefault: def as string | undefined, array: c.array });
  }
}

function tablePerms(t: TableDef) {
  return t.tablePermissions === "users" ? [Permission.read(Role.users())] : [];
}

async function waitColumns(tableId: string) {
  for (let i = 0; i < 60; i++) {
    const { columns } = await db.listColumns({ databaseId: DATABASE_ID, tableId, queries: [Query.limit(200)] });
    const pending = (columns as { status: string }[]).filter((c) => c.status !== "available");
    if (pending.some((c) => c.status === "failed")) throw new Error(`Colonne en échec sur ${tableId}`);
    if (pending.length === 0) return;
    await sleep(1000);
  }
}

async function ensureTable(t: TableDef) {
  try {
    await db.getTable({ databaseId: DATABASE_ID, tableId: t.id });
  } catch (e) {
    if (!isNotFound(e)) throw e;
    await db.createTable({
      databaseId: DATABASE_ID, tableId: t.id, name: t.name, permissions: tablePerms(t), rowSecurity: true,
      columns: t.columns.map(toInlineColumn), indexes: t.indexes.map((i) => ({ key: i.key, type: i.type, attributes: i.columns, columns: i.columns })),
    });
    console.log(`  ✅ table ${t.id} créée`);
    await waitColumns(t.id);
    // L'API inline peut ignorer les index : on vérifie juste après.
  }
  // Colonnes manquantes
  const { columns } = await db.listColumns({ databaseId: DATABASE_ID, tableId: t.id, queries: [Query.limit(200)] });
  const existing = new Set((columns as { key: string }[]).map((c) => c.key));
  for (const c of t.columns) {
    if (!existing.has(c.key)) {
      await createColumn(t.id, c);
      console.log(`  ➕ colonne ${t.id}.${c.key}`);
    }
  }
  await waitColumns(t.id);
  // Index manquants
  const { indexes } = await db.listIndexes({ databaseId: DATABASE_ID, tableId: t.id, queries: [Query.limit(200)] });
  const existingIdx = new Set((indexes as { key: string }[]).map((i) => i.key));
  for (const i of t.indexes) {
    if (!existingIdx.has(i.key)) {
      await db.createIndex({ databaseId: DATABASE_ID, tableId: t.id, key: i.key, type: i.type as never, columns: i.columns });
      console.log(`  ➕ index ${t.id}.${i.key}`);
    }
  }
}

async function main() {
  console.log(`→ Projet ${project} (${endpoint})`);
  try {
    await db.get({ databaseId: DATABASE_ID });
    console.log("✓ base existante");
  } catch (e) {
    if (!isNotFound(e)) throw e;
    await db.create({ databaseId: DATABASE_ID, name: "ICC BFC Finances" });
    console.log("✅ base créée");
  }

  for (const t of TABLES) {
    console.log(`• ${t.id}`);
    await ensureTable(t);
  }

  for (const b of BUCKETS) {
    try {
      await storage.getBucket({ bucketId: b.id });
      console.log(`✓ bucket ${b.id}`);
    } catch (e) {
      if (!isNotFound(e)) throw e;
      await storage.createBucket({
        bucketId: b.id, name: b.name, permissions: [], fileSecurity: true, enabled: true,
        maximumFileSize: b.maxSize, allowedFileExtensions: [...b.extensions], antivirus: true, encryption: true,
      });
      console.log(`✅ bucket ${b.id} créé`);
    }
  }

  try {
    await teams.get({ teamId: MOTHER_TEAM_ID });
    console.log("✓ team église mère");
  } catch (e) {
    if (!isNotFound(e)) throw e;
    await teams.create({ teamId: MOTHER_TEAM_ID, name: "Église mère — administration", roles: ["admin"] });
    console.log("✅ team église mère créée");
  }
  console.log("🎉 Schéma Appwrite à jour.");
}

main().catch((e) => {
  console.error("❌", e?.message ?? e);
  process.exit(1);
});
