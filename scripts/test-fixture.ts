/**
 * Jeu de données de TEST isolé (pour les tests de bout en bout sur la base réelle) :
 * églises et villes suffixées « (TEST) », préfixes TDI/TBE/TCH/TAU, comptes @example.com, aucune église mère.
 * Réutilise les listes et circuits de validation existants. Suppression : npm run test:fixture:down
 */
import "dotenv/config";
import { Client, TablesDB, Users, Teams, Storage, ID, Query, AppwriteException } from "node-appwrite";
import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { DATABASE_ID, TABLES, MOTHER_TEAM_ID, REGION, FILES_BUCKET } from "../src/lib/schema";
import { churchPermissions, regionPermissions } from "../src/lib/perms";
import { movementsForOfferingLine, movementsForDeposit, movementsForPaidExpense, depositAdjustment, type Movement } from "../src/lib/finance";
import { selectWorkflow, type WorkflowRule } from "../src/lib/workflow";

if (process.env.ALLOW_SEED !== "true") {
  console.error("❌ Seed désactivé (ALLOW_SEED != true).");
  process.exit(1);
}
const RESET = process.argv.includes("--reset");
const PASSWORD = process.env.DEMO_PASSWORD ?? "Demo-ICC-2026!";

const client = new Client().setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!).setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!).setKey(process.env.APPWRITE_API_KEY!);
const db = new TablesDB(client);
const users = new Users(client);
const teams = new Teams(client);
const storage = new Storage(client);

// ---------- utilitaires ----------
let seed = 20261119;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)]!;
const between = (min: number, max: number) => Math.round(min + rand() * (max - min));
const euros = (min: number, max: number, step = 5) => Math.round(between(min, max) / step) * step * 100;
const day = (s: string) => new Date(`${s}T12:00:00.000Z`).toISOString();
const addDays = (iso: string, n: number) => new Date(new Date(iso).getTime() + n * 86400000).toISOString();
const token = () => randomBytes(18).toString("base64url");
const TODAY = new Date();

type Data = Record<string, unknown>;
const queue: Record<string, Data[]> = {};
function row(table: string, data: Data, perms: string[], id = ID.unique()) {
  (queue[table] ??= []).push({ $id: id, ...data, $permissions: perms });
  return id;
}
async function flush() {
  for (const [table, rows] of Object.entries(queue)) {
    for (let i = 0; i < rows.length; i += 100) {
      await db.createRows({ databaseId: DATABASE_ID, tableId: table, rows: rows.slice(i, i + 100) });
    }
    console.log(`  ✓ ${table} : ${rows.length}`);
  }
  for (const k of Object.keys(queue)) delete queue[k];
}

const counters: Record<string, number> = {};
function ref(prefix: string, kind: string, date: string) {
  const y = new Date(date).getUTCFullYear();
  const key = `${prefix}-${kind}-${y}`;
  counters[key] = (counters[key] ?? 0) + 1;
  return `${kind}-${prefix}-${y}-${String(counters[key]).padStart(4, "0")}`;
}

async function reset() {
  console.log("🧹 Réinitialisation…");
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
  }
  const tl = await teams.list({ queries: [Query.limit(100)] });
  for (const t of tl.teams) if (t.$id.startsWith("church-")) await teams.delete({ teamId: t.$id });
  try {
    const m = await teams.listMemberships({ teamId: MOTHER_TEAM_ID, queries: [Query.limit(100)] });
    for (const x of m.memberships) await teams.deleteMembership({ teamId: MOTHER_TEAM_ID, membershipId: x.$id });
  } catch {}
  const ul = await users.list({ queries: [Query.endsWith("email", "@example.com"), Query.limit(100)] });
  for (const u of ul.users) await users.delete({ userId: u.$id });
}

async function ensureUser(email: string, name: string, labels: string[] = []) {
  const ex = (await users.list({ queries: [Query.equal("email", email), Query.limit(1)] })).users[0];
  const u = ex ?? (await users.create({ userId: ID.unique(), email, password: PASSWORD, name }));
  if (ex) await users.updatePassword({ userId: u.$id, password: PASSWORD });
  await users.updateEmailVerification({ userId: u.$id, emailVerification: true });
  if (labels.length) await users.updateLabels({ userId: u.$id, labels });
  return u.$id;
}
async function addMember(teamId: string, userId: string, roles: string[]) {
  try {
    await teams.createMembership({ teamId, roles, userId });
  } catch (e) {
    if (!(e instanceof AppwriteException && e.code === 409)) throw e;
  }
}

async function main() {
  void RESET; void reset;
  const existing = await db.listRows({ databaseId: DATABASE_ID, tableId: "churches", queries: [Query.startsWith("slug", "test-"), Query.limit(1)] });
  if (existing.total > 0) {
    console.log("ℹ️  Le jeu de test existe déjà (npm run test:fixture:down pour le supprimer).");
    return;
  }
  const RP = regionPermissions();

  // ---------- Villes & églises ----------
  console.log("🏛  Villes et églises");
  const cityDefs = [["Dijon (TEST)"], ["Besançon (TEST)"], ["Chalon-sur-Saône (TEST)"], ["Auxerre (TEST)"]];
  const cityIds = cityDefs.map(([name]) => row("cities", { name, region: "Bourgogne-Franche-Comté", archived: false }, RP));
  const churchDefs = [
    { name: "ICC Dijon (TEST)", slug: "test-dijon", prefix: "TDI", mother: false, pastor: "Pasteur Samuel K.", address: "12 rue de la Liberté, 21000 Dijon", size: 1.6 },
    { name: "ICC Besançon (TEST)", slug: "test-besancon", prefix: "TBE", mother: false, pastor: "Pasteur Daniel M.", address: "4 avenue Carnot, 25000 Besançon", size: 1.0 },
    { name: "ICC Chalon-sur-Saône (TEST)", slug: "test-chalon", prefix: "TCH", mother: false, pastor: "Pasteure Esther L.", address: "8 quai Gambetta, 71100 Chalon-sur-Saône", size: 0.7 },
    { name: "ICC Auxerre (TEST)", slug: "test-auxerre", prefix: "TAU", mother: false, pastor: "Pasteur Joël B.", address: "2 place des Cordeliers, 89000 Auxerre", size: 0.5 },
  ];
  const churches: { id: string; teamId: string; prefix: string; name: string; perms: string[]; size: number }[] = [];
  const motherId = ID.unique();
  for (const [i, c] of churchDefs.entries()) {
    const teamId = `church-${c.slug}`;
    try { await teams.create({ teamId, name: c.name, roles: ["treasurer", "pastor", "reader"] }); } catch (e) { if (!(e instanceof AppwriteException && e.code === 409)) throw e; }
    const id = c.mother ? motherId : ID.unique();
    // Logo : public/brand/icc-<slug>.jpg|png s'il existe
    let logoFileId: string | null = null;
    for (const ext of ["jpg", "png", "webp"]) {
      const f = `public/brand/icc-${c.slug}.${ext}`;
      if (!existsSync(f)) continue;
      const file = await storage.createFile({ bucketId: FILES_BUCKET, fileId: ID.unique(), file: new File([readFileSync(f)], `logo.${ext}`, { type: `image/${ext === "jpg" ? "jpeg" : ext}` }), permissions: RP });
      logoFileId = file.$id;
      break;
    }
    row("churches", { logoFileId, name: c.name, slug: c.slug, cityId: cityIds[i], address: c.address, isMother: c.mother, parentChurchId: null, pastorName: c.pastor, teamId, refPrefix: c.prefix, active: true, allowLocalLists: true }, RP, id);
    churches.push({ id, teamId, prefix: c.prefix, name: c.name, perms: churchPermissions({ teamId }), size: c.size });
  }
  try { await teams.get({ teamId: MOTHER_TEAM_ID }); } catch { await teams.create({ teamId: MOTHER_TEAM_ID, name: "Église mère — administration", roles: ["admin"] }); }

  // ---------- Listes et circuits existants (réglages de l'utilisateur) ----------
  const items = (await db.listRows({ databaseId: DATABASE_ID, tableId: "list_items", queries: [Query.equal("churchId", REGION), Query.limit(500)] })).rows as unknown as { $id: string; kind: string; name: string }[];
  const byKind = (k: string) => Object.fromEntries(items.filter((i) => i.kind === k).map((i) => [i.name, i.$id])) as Record<string, string>;
  const cats = byKind("expense_category");
  const dtypes = byKind("donation_type");
  const crTypes = byKind("cr_request_type");
  const services = byKind("service");
  for (const [k, names] of [["catégories", ["Achats", "Loyer", "Énergie", "Transport", "Matériel", "Social", "Communication", "Événements"]], ["types de dons", ["Offrande simple", "Dîme", "Offrande spéciale", "Action de grâce"]]] as const) {
    const map = k === "catégories" ? cats : dtypes;
    for (const n of names) if (!map[n]) throw new Error(`Réglage manquant (${k}) : ${n}`);
  }
  const workflows = (await db.listRows({ databaseId: DATABASE_ID, tableId: "approval_workflows", queries: [Query.equal("churchId", REGION), Query.limit(50)] })).rows as unknown as WorkflowRule[];

  // ---------- Utilisateurs ----------
  console.log("👤 Comptes de démonstration");
  const superId = await ensureUser("superadmin@example.com", "Super Administrateur (TEST)", ["superadmin"]);
  const mereId = await ensureUser("mere@example.com", "Ruth Mbala (Église mère)");
  await addMember(MOTHER_TEAM_ID, mereId, ["admin"]);
  const userIds: Record<string, string> = { superadmin: superId, mere: mereId };
  const demoUsers = [
    ["tresorier.dijon@example.com", "Paul Kabeya", "dijon", ["treasurer"]],
    ["pasteur.dijon@example.com", "Samuel Kouadio", "dijon", ["pastor"]],
    ["tresorier.besancon@example.com", "Grace Ndiaye", "besancon", ["treasurer"]],
    ["pasteur.besancon@example.com", "Daniel Moreau", "besancon", ["pastor"]],
    ["tresorier.chalon@example.com", "Marc Lefèvre", "chalon", ["treasurer"]],
    ["lecteur.chalon@example.com", "Agnès Martin", "chalon", ["reader"]],
    ["tresorier.auxerre@example.com", "Josué Ilunga", "auxerre", ["treasurer", "pastor"]],
  ] as const;
  for (const [email, name, slug, roles] of demoUsers) {
    const id = await ensureUser(email, name);
    await addMember(`church-test-${slug}`, id, [...roles]);
    userIds[email] = id;
  }
  await flush();

  // ---------- Données par église ----------
  console.log("💶 Données financières (3 mois)");
  const depNames = ["Louange", "Accueil", "Jeunesse", "Enfants", "Médias", "Intercession", "Évangélisation"];
  const sundays: string[] = [];
  for (let d = new Date("2026-09-06T12:00:00Z"); d <= TODAY; d = new Date(d.getTime() + 7 * 86400000)) sundays.push(d.toISOString());
  const firstNames = ["Marie", "Jean", "Esther", "David", "Ruth", "Moïse", "Sarah", "Élie", "Anne", "Caleb", "Débora", "Josué", "Lydie", "Timothée"];
  const lastNames = ["Mukendi", "Diallo", "Bernard", "Kasongo", "N'Guessan", "Petit", "Tshibanda", "Mensah", "Durand", "Koffi"];
  const person = () => `${pick(firstNames)} ${pick(lastNames)}`;

  for (const ch of churches) {
    const P = ch.perms;
    const s = ch.size;
    const deps = Object.fromEntries(
      depNames.map((n, i) => [n, row("departments", { churchId: ch.id, name: n, leaderName: person(), annualBudgetCents: i < 4 ? Math.round(euros(800, 3000, 50) * s) : null, archived: false }, P)]),
    );
    const bank1 = row("bank_accounts", { churchId: ch.id, label: "Compte courant", bankName: pick(["Crédit Mutuel", "La Banque Postale", "Crédit Agricole"]), ibanMasked: `•••• ${between(1000, 9999)}`, openingBalanceCents: Math.round(euros(4000, 12000, 100) * s), openingDate: day("2026-09-01"), archived: false }, P);
    const banks = [bank1];
    if (ch.prefix === "DIJ") banks.push(row("bank_accounts", { churchId: ch.id, label: "Livret projets", bankName: "Crédit Mutuel", ibanMasked: "•••• 4410", openingBalanceCents: 1500000, openingDate: day("2026-09-01"), archived: false }, P));

    // donateurs
    const donors = Array.from({ length: 6 }, () => {
      const fullName = person();
      return { id: row("donors", { churchId: ch.id, fullName, email: null, consentAt: day("2026-09-01"), archived: false }, P), fullName };
    });

    const movs: (Movement & { churchId: string })[] = [];
    const pushMovs = (ms: Movement[]) => ms.forEach((m) => movs.push({ ...m, churchId: ch.id }));
    const status = (entityType: string, entityId: string, steps: [string | null, string, string, string?][]) => {
      for (const [from, to, at, comment] of steps) {
        row("status_history", { churchId: ch.id, entityType, entityId, fromStatus: from, toStatus: to, actorName: ch.prefix === "DIJ" ? "Paul Kabeya" : "Trésorier", comment: comment ?? null, archived: false }, P);
        void at;
      }
    };

    // séances d'offrandes
    const sessionsCash: { id: string; date: string; cash: number; cheque: number; lineIds: string[] }[] = [];
    for (const date of sundays) {
      if (ch.prefix === "AUX" && date > day("2026-11-01")) continue; // Auxerre : pas de saisie récente → alerte
      const sid = ID.unique();
      const lines: { id: string; amount: number; method: string }[] = [];
      const add = (typeName: string, amount: number, method: string, donor?: { id: string; fullName: string }) => {
        const id = ID.unique();
        const bankAccountId = method === "cash" || method === "cheque" ? null : bank1;
        row("offering_lines", { churchId: ch.id, sessionId: sid, date, donationTypeId: dtypes[typeName], donationTypeName: typeName, donorId: donor?.id ?? null, donorName: donor?.fullName ?? null, anonymous: !donor, amountCents: amount, method, chequeRef: method === "cheque" ? String(between(1000000, 9999999)) : null, bankAccountId, archived: false }, P, id);
        pushMovs(movementsForOfferingLine({ $id: id, date, amountCents: amount, method, bankAccountId, donationTypeName: typeName }));
        lines.push({ id, amount, method });
      };
      add("Offrande simple", Math.round(euros(250, 650) * s), "cash");
      add("Offrande simple", Math.round(euros(40, 160) * s), "card");
      add("Dîme", Math.round(euros(150, 400) * s), "cash", pick(donors));
      add("Dîme", Math.round(euros(80, 250) * s), "cheque", pick(donors));
      add("Dîme", Math.round(euros(100, 300) * s), "transfer", pick(donors));
      if (rand() > 0.5) add("Action de grâce", Math.round(euros(20, 120) * s), "cash");
      if (rand() > 0.7) add("Offrande spéciale", Math.round(euros(50, 300) * s), "mobile");
      const cash = lines.filter((l) => l.method === "cash").reduce((a, l) => a + l.amount, 0);
      const cheque = lines.filter((l) => l.method === "cheque").reduce((a, l) => a + l.amount, 0);
      const gap = rand() > 0.85 ? -500 : 0;
      const entered = lines.reduce((a, l) => a + l.amount, 0);
      const reference = ref(ch.prefix, "OFF", date);
      row("offering_sessions", {
        churchId: ch.id, reference, date, serviceId: services["Culte du dimanche"], serviceName: "Culte du dimanche", counter1Name: person(), counter2Name: person(),
        countedCashCents: cash + gap, countedChequeCents: cheque, enteredTotalCents: entered, gapCents: gap, status: "validated", lockedAt: addDays(date, 0), lockedBy: null, archived: false,
        notes: gap ? "Écart de 5 € constaté au recomptage." : null,
      }, P, sid);
      status("offering_session", sid, [[null, "draft", date], ["draft", "validated", date]]);
      sessionsCash.push({ id: sid, date, cash, cheque, lineIds: lines.filter((l) => l.method === "cash" || l.method === "cheque").map((l) => l.id) });
    }

    // dépôts : toutes les 2 séances ; les dernières restent en caisse
    const toDeposit = sessionsCash.slice(0, Math.max(0, sessionsCash.length - (ch.prefix === "CHA" ? 4 : 1)));
    for (let i = 0; i < toDeposit.length; i += 2) {
      const group = toDeposit.slice(i, i + 2);
      const date = addDays(group[group.length - 1]!.date, 2);
      const cashCents = group.reduce((a, g) => a + g.cash, 0);
      const chequeCents = group.reduce((a, g) => a + g.cheque, 0);
      const id = ID.unique();
      const recent = new Date(date) > new Date(TODAY.getTime() - 10 * 86400000);
      const st = recent ? "deposited" : "confirmed";
      const confirmedCents = st === "confirmed" ? cashCents + chequeCents - (rand() > 0.9 ? 1000 : 0) : null;
      const reference = ref(ch.prefix, "DPT", date);
      row("deposits", {
        churchId: ch.id, reference, bankAccountId: bank1, date, depositorName: person(), cashCents, chequeCents, slipNumber: String(between(100000, 999999)), status: st,
        confirmedAt: st === "confirmed" ? addDays(date, 3) : null, confirmedCents, valueDate: st === "confirmed" ? addDays(date, 2) : null,
        gapCents: confirmedCents != null ? confirmedCents - cashCents - chequeCents : 0, sessionIds: group.map((g) => g.id), archived: false,
      }, P, id);
      for (const g of group) for (const lid of g.lineIds) (queue.offering_lines!.find((l) => l.$id === lid) as Data).depositId = id;
      const dep = { $id: id, date, cashCents, chequeCents, bankAccountId: bank1, reference };
      pushMovs(movementsForDeposit(dep));
      if (confirmedCents != null) { const adj = depositAdjustment(dep, confirmedCents); if (adj) pushMovs([adj]); }
      status("deposit", id, [[null, "prepared", date], ["prepared", "deposited", date], ...(st === "confirmed" ? [["deposited", "confirmed", addDays(date, 3)] as [string, string, string]] : [])]);
    }

    // projet (Dijon)
    let projectId: string | null = null;
    if (ch.prefix === "DIJ") {
      projectId = row("projects", { churchId: ch.id, name: "Conférence régionale 2026", description: "Conférence annuelle des églises de Bourgogne-Franche-Comté.", budgetCents: 500000, startDate: day("2026-10-01"), endDate: day("2026-12-12"), ownerName: "Samuel Kouadio", status: "active", archived: false, milestonesJson: JSON.stringify([{ label: "Réservation de la salle", done: true }, { label: "Sonorisation", done: true }, { label: "Communication", done: false }]) }, P);
    }

    // dépenses
    const expenseDefs: [string, string, number, number, string, string?][] = [
      ["Loyer de la salle", "Loyer", 900, 1400, "bank_transfer"],
      ["Électricité", "Énergie", 80, 220, "bank_transfer"],
      ["Fournitures accueil", "Achats", 20, 90, "cash"],
      ["Transport des intervenants", "Transport", 40, 160, "card"],
      ["Câbles et micros", "Matériel", 60, 380, "card", "Médias"],
      ["Goûter des enfants", "Achats", 15, 60, "cash", "Enfants"],
      ["Aide à une famille", "Social", 50, 200, "bank_transfer"],
      ["Impression de flyers", "Communication", 30, 140, "card", "Évangélisation"],
    ];
    const months = ["2026-09", "2026-10", "2026-11"];
    let expenseIndex = 0;
    const createExpense = (title: string, cat: string, amount: number, method: string, date: string, st: string, dep?: string | null, extra: Data = {}) => {
      const id = ID.unique();
      const wf = selectWorkflow(workflows, { churchId: ch.id, amountCents: amount, categoryId: cats[cat] });
      const roles = wf?.stepRoles ?? ["treasurer"];
      const currentStep = st === "in_approval" ? Math.min(roles.length, 1 + (expenseIndex++ % roles.length)) : st === "draft" ? 0 : roles.length;
      const reference = ref(ch.prefix, "DEP", date);
      const bankAccountId = method === "cash" ? null : bank1;
      row("expenses", {
        churchId: ch.id, reference, title, categoryId: cats[cat], categoryName: cat, supplier: pick(["Leroy Merlin", "EDF", "SNCF", "Thomann", "Carrefour", "Imprimerie du Centre", "Bailleur", "—"]),
        amountCents: amount, date, paymentMethod: method, bankAccountId, departmentId: dep ? deps[dep] : null, projectId: null, status: st, currentStep, totalSteps: roles.length,
        workflowId: wf?.$id ?? null, stepRoles: roles, isRegularization: false, paidAt: st === "paid" ? addDays(date, 2) : null, stepStartedAt: date, source: "manual", archived: false, ...extra,
      }, P, id);
      const approvedSteps = st === "paid" || st === "approved" ? roles.length : st === "rejected" ? 1 : currentStep - 1;
      for (let k = 0; k < approvedSteps; k++) {
        const decision = st === "rejected" && k === approvedSteps - 1 ? "rejected" : "approved";
        row("approvals", { churchId: ch.id, expenseId: id, stepOrder: k + 1, role: roles[k], decision, userName: roles[k] === "mother_admin" ? "Ruth Mbala" : roles[k] === "pastor" ? "Pasteur" : "Trésorier", comment: decision === "rejected" ? "Devis trop élevé, merci de comparer." : null, archived: false }, P);
      }
      const hist: [string | null, string, string, string?][] = [[null, "draft", date], ["draft", "in_approval", date]];
      if (["approved", "paid"].includes(st)) hist.push(["in_approval", "approved", addDays(date, 1)]);
      if (st === "paid") hist.push(["approved", "paid", addDays(date, 2)]);
      if (st === "rejected") hist.push(["in_approval", "rejected", addDays(date, 1), "Devis trop élevé, merci de comparer."]);
      status("expense", id, st === "draft" ? [[null, "draft", date]] : hist);
      if (st === "paid") pushMovs(movementsForPaidExpense({ $id: id, date, paidAt: addDays(date, 2), amountCents: amount, paymentMethod: method, bankAccountId, title, categoryName: cat }));
      return id;
    };
    for (const m of months) {
      for (const [i, [title, cat, min, max, method, dep]] of expenseDefs.entries()) {
        if (cat === "Social" && rand() > 0.5) continue;
        const dd = String(Math.min(28, 3 + i * 3)).padStart(2, "0");
        const date = day(`${m}-${dd}`);
        if (new Date(date) > TODAY) continue;
        const amount = Math.round(euros(min, max) * (cat === "Loyer" ? s : Math.max(0.6, s)));
        const recent = m === "2026-11" && new Date(date) > new Date(TODAY.getTime() - 9 * 86400000);
        const st = recent ? (i % 3 === 0 ? "in_approval" : i % 3 === 1 ? "approved" : "paid") : "paid";
        createExpense(title, cat, amount, method, date, st, dep);
      }
    }
    if (ch.prefix === "DIJ") {
      createExpense("Location sonorisation conférence", "Événements", 85000, "bank_transfer", day("2026-10-20"), "paid", "Médias", { projectId });
      createExpense("Réservation salle conférence", "Événements", 120000, "bank_transfer", day("2026-10-08"), "paid", null, { projectId });
      createExpense("Affiches et kakémonos", "Communication", 32000, "card", day("2026-11-12"), "in_approval", "Évangélisation", { projectId });
      createExpense("Nouvelle table de mixage", "Matériel", 168000, "bank_transfer", day("2026-11-16"), "in_approval", "Médias");
      createExpense("Repas des bénévoles", "Événements", 26000, "cash", day("2026-11-14"), "rejected", "Accueil");
    }
    if (ch.prefix === "BES") createExpense("Remplacement du vidéoprojecteur", "Matériel", 74000, "bank_transfer", day("2026-11-15"), "in_approval", "Médias");

    // liens publics
    const linkF = row("public_links", { churchId: ch.id, kind: "funding", departmentId: null, token: token(), label: "Besoins des départements", active: true, submissionsCount: 5, archived: false }, P);
    row("public_links", { churchId: ch.id, kind: "reimbursement", departmentId: null, token: token(), label: "Remboursements", active: true, submissionsCount: 5, archived: false }, P);

    // remboursements (5) — sur Dijon et Besançon
    if (ch.prefix === "DIJ" || ch.prefix === "BES") {
      const rdefs: [string, string, number, string][] = [
        ["Achat de cordes de guitare", "Louange", 4590, "submitted"],
        ["Courses pour l'accueil", "Accueil", 6235, "checking"],
        ["Essence — tournée d'évangélisation", "Évangélisation", 5800, "approved"],
        ["Repas personnel", "Jeunesse", 3200, "rejected"],
        ["Fournitures école du dimanche", "Enfants", 7850, "paid"],
      ];
      for (const [i, [reason, dep, amount, st]] of rdefs.entries()) {
        if (ch.prefix === "BES" && i > 2) continue;
        const date = day(`2026-11-${String(2 + i * 3).padStart(2, "0")}`);
        const id = ID.unique();
        let expenseId: string | null = null;
        if (st === "paid") expenseId = createExpense(`Remboursement — ${reason}`, "Achats", amount, "bank_transfer", date, "paid", dep, { source: "reimbursement", sourceId: id });
        const reference = ref(ch.prefix, "RMB", date);
        row("reimbursements", {
          churchId: ch.id, reference, requesterName: person(), requesterEmail: null, requesterPhone: "06 12 34 56 78", departmentId: deps[dep], reason, expenseDate: addDays(date, -2), amountCents: amount,
          wishedMethod: i % 2 ? "cash" : "transfer", status: st, trackingToken: token(), rejectReason: st === "rejected" ? "Dépense personnelle, non prise en charge par l'église." : null,
          paidAt: st === "paid" ? addDays(date, 4) : null, paidMethod: st === "paid" ? "transfer" : null, expenseId, archived: false,
        }, P, id);
        const order = ["submitted", "checking", "approved", "paid"];
        const hist: [string | null, string, string, string?][] = [[null, "submitted", date]];
        if (st === "rejected") hist.push(["submitted", "checking", addDays(date, 1)], ["checking", "rejected", addDays(date, 2), "Dépense personnelle, non prise en charge par l'église."]);
        else for (let k = 1; k <= order.indexOf(st); k++) hist.push([order[k - 1]!, order[k]!, addDays(date, k)]);
        status("reimbursement", id, hist);
      }

      // besoins (5)
      const fdefs: [string, string, number, string, string][] = [
        ["Nouveaux pupitres", "Louange", 24000, "received", "normal"],
        ["Camp de jeunes de Noël", "Jeunesse", 150000, "reviewing", "high"],
        ["Kits d'accueil des nouveaux", "Accueil", 18000, "approved", "normal"],
        ["Caméra 4K pour le direct", "Médias", 220000, "rejected", "low"],
        ["Bibles pour enfants", "Enfants", 9500, "funded", "urgent"],
      ];
      for (const [i, [title, dep, amount, st, prio]] of fdefs.entries()) {
        if (ch.prefix === "BES" && i > 2) continue;
        const date = day(`2026-11-${String(1 + i * 3).padStart(2, "0")}`);
        const id = ID.unique();
        const reference = ref(ch.prefix, "BES", date);
        row("funding_requests", {
          churchId: ch.id, reference, publicLinkId: linkF, requesterName: person(), requesterEmail: null, requesterPhone: "07 65 43 21 09", departmentId: deps[dep], title,
          description: "Besoin exprimé lors de la réunion des responsables.", estimatedCents: amount, approvedCents: ["approved", "funded"].includes(st) ? amount : null,
          wishedDate: day("2026-12-15"), priority: prio, status: st, trackingToken: token(), decisionComment: st === "rejected" ? "Budget médias déjà consommé cette année ; à reproposer en 2027." : null, archived: false,
        }, P, id);
        const order = ["received", "reviewing", "approved", "funded"];
        const hist: [string | null, string, string, string?][] = [[null, "received", date]];
        if (st === "rejected") hist.push(["received", "reviewing", addDays(date, 1)], ["reviewing", "rejected", addDays(date, 3), "Budget médias déjà consommé cette année ; à reproposer en 2027."]);
        else for (let k = 1; k <= order.indexOf(st); k++) hist.push([order[k - 1]!, order[k]!, addDays(date, k)]);
        status("funding_request", id, hist);
      }
    }

    // demandes Cité Royale (4 au total : Dijon x2, Besançon x1, Chalon x1)
    const crDefs: Record<string, [string, string, number, string, string, number][]> = {
      DIJ: [["Ordinateurs pour la régie", "Équipement", 320000, "pending", "high", 25], ["Financement de la conférence régionale", "Financement", 200000, "approved", "normal", 6]],
      BES: [["Chaises pour la nouvelle salle", "Matériel", 180000, "sent", "normal", 4]],
      CHA: [["Sonorisation portative", "Équipement", 95000, "received_partial", "urgent", 10]],
    };
    for (const [title, type, amount, st, prio, ago] of crDefs[ch.prefix] ?? []) {
      const date = addDays(TODAY.toISOString(), -ago - 5);
      const id = ID.unique();
      const reference = ref(ch.prefix, "CR", date);
      row("cr_requests", {
        churchId: ch.id, reference, title, typeId: crTypes[type], reason: "Croissance de l'assemblée et besoins du culte.", description: null, quantity: type === "Matériel" ? 60 : 1,
        estimatedCents: amount, priority: prio, wishedDate: addDays(TODAY.toISOString(), 30), departmentId: deps["Médias"], contactName: "Trésorier", sendChannel: "Email", crReference: st !== "sent" ? `CR-${between(1000, 9999)}` : null,
        status: st, viaMother: ch.prefix !== "DIJ", receivedCents: st === "received_partial" ? Math.round(amount * 0.6) : null, receivedQuantity: null,
        receivedAt: st === "received_partial" ? addDays(TODAY.toISOString(), -2) : null, statusChangedAt: addDays(TODAY.toISOString(), -ago), archived: false,
      }, P, id);
      const flow = ["draft", ...(ch.prefix !== "DIJ" ? ["mother_review"] : []), "initiated", "sent", "pending", "approved", "received_partial"];
      const endIdx = flow.indexOf(st);
      const hist: [string | null, string, string, string?][] = [];
      for (let k = 0; k <= endIdx; k++) hist.push([k ? flow[k - 1]! : null, flow[k]!, date]);
      status("cr_request", id, hist);
    }

    // budget annuel (catégories)
    for (const [cat, planned] of [["Loyer", 14400], ["Énergie", 2200], ["Matériel", 3000], ["Achats", 1500], ["Événements", 6000], ["Communication", 1200], ["Social", 2000]] as [string, number][]) {
      row("budgets", { churchId: ch.id, year: 2026, scope: "category", scopeId: cats[cat], scopeName: cat, plannedCents: Math.round(planned * 100 * (cat === "Événements" && ch.prefix !== "DIJ" ? 0.3 : ch.size)), archived: false }, P);
    }

    for (const m of movs) row("cash_movements", { ...m, archived: false, sourceId: m.sourceId ?? null, category: m.category ?? null, label: m.label ?? null }, P);
    await flush();
    console.log(`  → ${ch.name} terminée`);
  }

  // compteurs
  for (const [key, value] of Object.entries(counters)) row("counters", { key, value }, [], key.replace(/[^A-Za-z0-9_-]/g, "_"));
  await flush();

  console.log("\n🎉 Jeu de TEST prêt. Comptes (mot de passe : " + PASSWORD + ") :");
  console.log("  • superadmin@example.com (super administrateur)");
  console.log("  • mere@example.com (administrateur église mère)");
  for (const [email, , slug, roles] of demoUsers) console.log(`  • ${email} (${roles.join(" + ")} — ${slug})`);
}

main().catch((e) => {
  console.error("❌", e?.message ?? e);
  process.exit(1);
});
