/**
 * Crée (ou promeut) un super administrateur.
 * Usage : npm run create-superadmin -- email@exemple.fr "Prénom Nom" [motDePasse]
 * Sans mot de passe, un mot de passe provisoire est généré et affiché une seule fois.
 */
import "dotenv/config";
import { Client, Users, ID, Query } from "node-appwrite";
import { randomBytes } from "node:crypto";

const [email, name = "Super administrateur", given] = process.argv.slice(2);
if (!email) { console.error("Usage : npm run create-superadmin -- email \"Nom\" [motDePasse]"); process.exit(1); }
const users = new Users(new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!).setKey(process.env.APPWRITE_API_KEY!));
const password = given ?? `ICC-${randomBytes(6).toString("base64url")}-${new Date().getFullYear()}!`;

(async () => {
  const existing = (await users.list({ queries: [Query.equal("email", email.toLowerCase()), Query.limit(1)] })).users[0];
  const u = existing ?? (await users.create({ userId: ID.unique(), email: email.toLowerCase(), password, name }));
  if (existing) { await users.updatePassword({ userId: u.$id, password }); if (name) await users.updateName({ userId: u.$id, name }); }
  await users.updateEmailVerification({ userId: u.$id, emailVerification: true });
  await users.updateStatus({ userId: u.$id, status: true });
  await users.updateLabels({ userId: u.$id, labels: [...new Set([...(u.labels ?? []), "superadmin"])] });
  console.log(`✅ Super administrateur prêt : ${email}`);
  console.log(`   Mot de passe : ${password}  (à changer dans « Mon compte » après la première connexion)`);
})().catch((e) => { console.error("❌", e?.message ?? e); process.exit(1); });
