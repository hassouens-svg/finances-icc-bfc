/**
 * Remise à zéro complète (base « toute neuve ») :
 *  - efface toutes les données, tous les fichiers et toutes les équipes d'église ;
 *  - supprime tous les comptes SAUF les super administrateurs (hors comptes de démo @example.com) ;
 *  - recrée seulement les réglages par défaut (listes, circuits de validation, alertes), modifiables ensuite.
 * Usage : npm run reset -- --confirm
 */
import "dotenv/config";
import { Client, TablesDB, Users, Teams, Storage, ID, Query } from "node-appwrite";
import { DATABASE_ID, TABLES, MOTHER_TEAM_ID, REGION, FILES_BUCKET } from "../src/lib/schema";
import { regionPermissions } from "../src/lib/perms";

if (!process.argv.includes("--confirm")) {
  console.error("⚠️  Cette commande efface TOUTES les données. Relancez avec : npm run reset -- --confirm");
  process.exit(1);
}
const client = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!).setKey(process.env.APPWRITE_API_KEY!);
const db = new TablesDB(client);
const users = new Users(client);
const teams = new Teams(client);
const storage = new Storage(client);

async function wipe() {
  for (const t of TABLES) {
    let n = 0;
    for (;;) {
      const r = await db.listRows({ databaseId: DATABASE_ID, tableId: t.id, queries: [Query.limit(100), Query.select(["$id"])] });
      if (!r.rows.length) break;
      await Promise.all(r.rows.map((x) => db.deleteRow({ databaseId: DATABASE_ID, tableId: t.id, rowId: x.$id })));
      n += r.rows.length;
    }
    if (n) console.log(`  − ${t.id} : ${n}`);
  }
  for (;;) {
    const fl = await storage.listFiles({ bucketId: FILES_BUCKET, queries: [Query.limit(100)] });
    if (!fl.files.length) break;
    await Promise.all(fl.files.map((f) => storage.deleteFile({ bucketId: FILES_BUCKET, fileId: f.$id })));
    console.log(`  − fichiers : ${fl.files.length}`);
  }
  const tl = await teams.list({ queries: [Query.limit(100)] });
  for (const t of tl.teams) if (t.$id.startsWith("church-")) await teams.delete({ teamId: t.$id });
  try {
    const m = await teams.listMemberships({ teamId: MOTHER_TEAM_ID, queries: [Query.limit(100)] });
    for (const x of m.memberships) await teams.deleteMembership({ teamId: MOTHER_TEAM_ID, membershipId: x.$id });
  } catch {
    await teams.create({ teamId: MOTHER_TEAM_ID, name: "Église mère — administration", roles: ["admin"] });
  }
  const kept: string[] = [];
  for (;;) {
    const ul = await users.list({ queries: [Query.limit(100)] });
    const toDelete = ul.users.filter((u) => !(u.labels?.includes("superadmin") && !u.email.endsWith("@example.com")));
    for (const u of ul.users) if (!toDelete.includes(u) && !kept.includes(u.email)) kept.push(u.email);
    if (!toDelete.length) break;
    for (const u of toDelete) await users.delete({ userId: u.$id });
    console.log(`  − comptes : ${toDelete.length}`);
  }
  return kept;
}

async function defaults() {
  const RP = regionPermissions();
  const rows: Record<string, unknown>[] = [];
  const L = (kind: string, name: string, i: number, extra: Record<string, unknown> = {}) =>
    rows.push({ $id: ID.unique(), $permissions: RP, churchId: REGION, kind, name, sortOrder: i, isTithe: false, archived: false, ...extra });
  ["Achats", "Événements", "Loyer", "Énergie", "Transport", "Matériel", "Social", "Missions", "Cité Royale", "Communication", "Entretien", "Autres"].forEach((n, i) => L("expense_category", n, i));
  [["Dîme", true], ["Offrande simple"], ["Offrande spéciale"], ["Don pour projet"], ["Action de grâce"], ["Autre"]].forEach(([n, t], i) => L("donation_type", n as string, i, { isTithe: !!t }));
  ["Matériel", "Financement", "Équipement", "Logistique", "Autre"].forEach((n, i) => L("cr_request_type", n, i));
  ["Culte du dimanche", "Culte de mi-semaine", "Veillée de prière", "Événement spécial"].forEach((n, i) => L("service", n, i));
  await db.createRows({ databaseId: DATABASE_ID, tableId: "list_items", rows });
  const wf = [
    { name: "Moins de 100 €", minCents: 0, maxCents: 10000, stepRoles: ["treasurer"], stepDelaysHours: [48] },
    { name: "De 100 à 500 €", minCents: 10000, maxCents: 50000, stepRoles: ["treasurer", "pastor"], stepDelaysHours: [48, 72] },
    { name: "500 € et plus", minCents: 50000, maxCents: null, stepRoles: ["treasurer", "pastor", "mother_admin"], stepDelaysHours: [48, 72, 96] },
  ];
  await db.createRows({ databaseId: DATABASE_ID, tableId: "approval_workflows", rows: wf.map((w) => ({ $id: ID.unique(), $permissions: RP, churchId: REGION, ...w, categoryIds: [], priority: 0, active: true, archived: false })) });
  const settings = { crPendingDays: 14, cashMaxCents: 150000, cashMaxDays: 10, noOfferingDays: 14, fiscalReceipts: false, donorRetentionYears: 6 };
  await db.createRows({ databaseId: DATABASE_ID, tableId: "settings", rows: Object.entries(settings).map(([k, v]) => ({ $id: `global_${k}`, $permissions: RP, scope: "global", key: k, valueJson: JSON.stringify(v) })) });
  console.log(`  + réglages par défaut : ${rows.length} éléments de listes, ${wf.length} circuits de validation, seuils d'alerte`);
}

(async () => {
  console.log("🧹 Remise à zéro…");
  const kept = await wipe();
  await defaults();
  console.log(`🎉 Base toute neuve. Comptes conservés (super administrateurs) : ${kept.length}`);
})().catch((e) => { console.error("❌", e?.message ?? e); process.exit(1); });
