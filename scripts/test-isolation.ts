/**
 * Vérifie le cloisonnement côté Appwrite (sans passer par l'application) :
 * un trésorier de Besançon tente de lire directement une donnée de Chalon avec SA session.
 * Usage : npm run test:isolation   (à lancer depuis un poste ou une CI SANS proxy injectant la clé API)
 */
import "dotenv/config";
import { Client, Account, TablesDB, Query } from "appwrite";
import { Client as AdminClient, TablesDB as AdminDB } from "node-appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const PASSWORD = process.env.DEMO_PASSWORD ?? "Demo-ICC-2026!";

async function main() {
  const admin = new AdminDB(new AdminClient().setEndpoint(endpoint).setProject(project).setKey(process.env.APPWRITE_API_KEY!));
  const churches = await admin.listRows({ databaseId: "icc_finances", tableId: "churches", queries: [Query.equal("slug", ["besancon", "chalon"])] });
  const chalon = churches.rows.find((c) => c.slug === "chalon")!;
  const besancon = churches.rows.find((c) => c.slug === "besancon")!;
  const target = (await admin.listRows({ databaseId: "icc_finances", tableId: "expenses", queries: [Query.equal("churchId", chalon.$id), Query.limit(1)] })).rows[0]!;

  const client = new Client().setEndpoint(endpoint).setProject(project);
  await new Account(client).createEmailPasswordSession({ email: "tresorier.besancon@example.com", password: PASSWORD });
  const db = new TablesDB(client);
  let ok = true;
  try {
    await db.getRow({ databaseId: "icc_finances", tableId: "expenses", rowId: target.$id });
    console.error("❌ Le trésorier de Besançon a pu lire une dépense de Chalon !");
    ok = false;
  } catch (e) {
    console.log(`✅ Lecture directe refusée par Appwrite (${(e as { code?: number }).code}).`);
  }
  const list = await db.listRows({ databaseId: "icc_finances", tableId: "expenses", queries: [Query.limit(500)] });
  const foreign = list.rows.filter((r) => r.churchId !== besancon.$id);
  if (foreign.length) { console.error(`❌ ${foreign.length} ligne(s) d'autres églises visibles.`); ok = false; }
  else console.log(`✅ La liste ne contient que Besançon (${list.rows.length} lignes).`);
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
