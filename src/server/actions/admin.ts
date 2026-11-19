"use server";
import { z } from "zod";
import { ID, Query, AppwriteException } from "node-appwrite";
import { adminClient, DATABASE_ID } from "@/lib/appwrite/server";
import { requireContext, assertRegional, assertManage, ForbiddenError } from "../context";
import { run, UserError, formToObject } from "../action";
import { insert, patch, audit, permsFor, adminGet, adminList, regionPermissions, revalidateApp } from "../data";
import { issuePasswordToken, randomToken } from "../tokens";
import { sendEmail, emailLayout } from "../notify";
import { saveLogo } from "../logo";
import { zText, zOptText, zBool, zId, zEmail, zOptCents, zDate, zCents } from "@/lib/zod";
import { MOTHER_TEAM_ID, REGION } from "@/lib/schema";
import type { ActionResult } from "@/lib/action-types";
import type { Church } from "@/lib/types";

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// ---------------- Villes ----------------
export async function saveCityAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    assertRegional(ctx);
    const d = z.object({ id: zId(), name: zText("Le nom de la ville", 120), region: zOptText(120) }).parse(formToObject(fd));
    const { db } = adminClient();
    if (d.id) {
      await db.updateRow({ databaseId: DATABASE_ID, tableId: "cities", rowId: d.id, data: { name: d.name, region: d.region } });
    } else {
      const row = await db.createRow({ databaseId: DATABASE_ID, tableId: "cities", rowId: ID.unique(), data: { name: d.name, region: d.region ?? "Bourgogne-Franche-Comté" }, permissions: regionPermissions() });
      await audit(ctx, REGION, "create", "city", row.$id, `Ville créée : ${d.name}`, null, d);
    }
    revalidateApp();
    return { ok: true, message: d.id ? "Ville modifiée." : "Ville créée." };
  });
}

// ---------------- Églises ----------------
const churchSchema = z.object({
  id: zId(),
  name: zText("Le nom de l'église", 160),
  cityId: zId(),
  address: zOptText(400),
  pastorName: zOptText(160),
  refPrefix: z.string().trim().toUpperCase().regex(/^[A-Z]{2,5}$/, "Le préfixe doit faire 2 à 5 lettres (ex. BES)."),
  isMother: zBool(),
  allowLocalLists: zBool(),
});

export async function saveChurchAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    assertRegional(ctx);
    const d = churchSchema.parse(formToObject(fd));
    if (d.isMother && !ctx.isSuperAdmin) throw new ForbiddenError("Seul le super administrateur peut désigner l'église mère.");
    const { db, teams } = adminClient();
    const mother = ctx.allChurches.find((c) => c.isMother);

    if (d.id) {
      const before = await adminGet<Church>("churches", d.id);
      if (!before) throw new UserError("Église introuvable.");
      const isMother = ctx.isSuperAdmin ? d.isMother : before.isMother;
      await db.updateRow({
        databaseId: DATABASE_ID, tableId: "churches", rowId: d.id,
        data: { name: d.name, cityId: d.cityId, address: d.address, pastorName: d.pastorName, refPrefix: d.refPrefix, isMother, allowLocalLists: d.allowLocalLists, parentChurchId: isMother ? null : mother && mother.$id !== d.id ? mother.$id : before.parentChurchId },
      });
      if (isMother && !before.isMother) await setMotherFlags(d.id);
      const logo = fd.get("logo");
      if (logo instanceof File && logo.size > 0) await patch("churches", d.id, { logoFileId: await saveLogo(logo, before.logoFileId) });
      try { await teams.updateName({ teamId: before.teamId, name: d.name }); } catch {}
      await audit(ctx, d.id, "update", "church", d.id, `Église modifiée : ${d.name}`, before, d);
      revalidateApp();
      return { ok: true, message: "Église modifiée." };
    }

    let slug = slugify(d.name) || "eglise";
    if (ctx.allChurches.some((c) => c.slug === slug)) slug = `${slug}-${randomToken(3).toLowerCase()}`;
    const teamId = `church-${slug}`.slice(0, 36);
    await teams.create({ teamId, name: d.name, roles: ["treasurer", "pastor", "reader"] });
    const id = ID.unique();
    await db.createRow({
      databaseId: DATABASE_ID, tableId: "churches", rowId: id,
      data: {
        name: d.name, slug, cityId: d.cityId, address: d.address, pastorName: d.pastorName, refPrefix: d.refPrefix, isMother: d.isMother,
        parentChurchId: d.isMother ? null : mother?.$id ?? null, teamId, active: true, allowLocalLists: d.allowLocalLists,
      },
      permissions: regionPermissions(),
    });
    if (d.isMother) await setMotherFlags(id);
    const logo = fd.get("logo");
    if (logo instanceof File && logo.size > 0) await patch("churches", id, { logoFileId: await saveLogo(logo) });
    await audit(ctx, id, "create", "church", id, `Église créée : ${d.name}`, null, d);
    revalidateApp();
    return { ok: true, message: `Église « ${d.name} » créée.`, redirect: `/app/admin/eglises/${id}` };
  });
}

async function setMotherFlags(motherId: string) {
  const { db } = adminClient();
  const all = await adminList<Church>("churches", []);
  for (const c of all) {
    if (c.$id === motherId) continue;
    await db.updateRow({ databaseId: DATABASE_ID, tableId: "churches", rowId: c.$id, data: { isMother: false, parentChurchId: motherId } });
  }
}

export async function toggleChurchActiveAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    assertRegional(ctx);
    const id = String(fd.get("id"));
    const c = await adminGet<Church>("churches", id);
    if (!c) throw new UserError("Église introuvable.");
    if (c.isMother && c.active) throw new UserError("L'église mère ne peut pas être archivée.");
    await patch("churches", id, { active: !c.active });
    await audit(ctx, id, c.active ? "archive" : "restore", "church", id, `${c.active ? "Archivage" : "Réactivation"} : ${c.name}`);
    revalidateApp();
    return { ok: true, message: c.active ? "Église archivée." : "Église réactivée." };
  });
}

// ---------------- Utilisateurs ----------------
const inviteSchema = z.object({
  email: zEmail().transform((v) => v.toLowerCase()),
  name: zText("Le nom", 160),
  churchId: z.string().min(1, "Choisissez une église."),
  roles: z.array(z.enum(["treasurer", "pastor", "reader", "mother_admin", "superadmin"])).min(1, "Choisissez au moins un rôle."),
  password: z.union([z.literal(""), z.string().min(10, "Le mot de passe doit faire 10 caractères minimum.")]).optional(),
});

export async function inviteUserAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const raw = formToObject(fd);
    const d = inviteSchema.parse({ ...raw, roles: raw.roles ?? [], churchId: raw.churchId || (Array.isArray(raw.roles) && (raw.roles as string[]).some((r) => r === "superadmin" || r === "mother_admin") ? "-" : "") });
    const wantsMother = d.roles.includes("mother_admin");
    const wantsSuper = d.roles.includes("superadmin");
    if (wantsSuper && !ctx.isSuperAdmin) throw new ForbiddenError("Seul un super administrateur peut en créer un autre.");
    if (wantsMother) assertRegional(ctx);
    if (!ctx.isRegional) throw new ForbiddenError("Seule l'église mère peut inviter des utilisateurs.");
    const church = ctx.allChurches.find((c) => c.$id === d.churchId);
    if (!church && !wantsMother && !wantsSuper) throw new UserError("Église introuvable.");

    const { users, teams } = adminClient();
    const existing = (await users.list({ queries: [Query.equal("email", d.email), Query.limit(1)] })).users[0];
    let userId = existing?.$id;
    let isNew = false;
    if (!userId) {
      const u = await users.create({ userId: ID.unique(), email: d.email, password: d.password || randomToken(24) + "aA1!", name: d.name });
      userId = u.$id;
      isNew = true;
    } else if (d.password) {
      await users.updatePassword({ userId, password: d.password });
    }
    if (d.password) await users.updateEmailVerification({ userId, emailVerification: true });
    if (wantsSuper) {
      const u = await users.get({ userId });
      await users.updateLabels({ userId, labels: [...new Set([...(u.labels ?? []), "superadmin"])] });
    }
    const churchRoles = d.roles.filter((r) => r !== "mother_admin" && r !== "superadmin");
    if (church && churchRoles.length) await upsertMembership(church.teamId, userId, churchRoles);
    if (wantsMother) await upsertMembership(MOTHER_TEAM_ID, userId, ["admin"]);

    let link: string | null = null;
    if (isNew && !d.password) {
      link = await issuePasswordToken(userId, "invite");
      await sendEmail({
        to: d.email,
        subject: "Votre accès à ICC BFC Finances",
        html: emailLayout(
          "Vous êtes invité(e) sur ICC BFC Finances",
          `<p>Bonjour ${d.name},</p><p>Un accès a été créé pour vous${church ? ` pour l'église <b>${church.name}</b>` : ""}. Cliquez sur le bouton pour choisir votre mot de passe (lien valable 7 jours).</p>`,
          { label: "Activer mon compte", url: link },
        ),
      });
    }
    await audit(ctx, church?.$id ?? REGION, "invite", "user", userId, `Invitation de ${d.email} (${d.roles.join(", ")})`, null, { email: d.email, roles: d.roles });
    revalidateApp();
    return {
      ok: true,
      message: d.password ? "Compte créé : la personne peut se connecter avec ce mot de passe." : isNew ? "Invitation créée." : "Rôles ajoutés à l'utilisateur existant.",
      data: link ? { link } : undefined,
    };
  });
}

async function upsertMembership(teamId: string, userId: string, roles: string[]) {
  const { teams } = adminClient();
  const list = await teams.listMemberships({ teamId, queries: [Query.equal("userId", userId), Query.limit(1)] });
  const m = list.memberships[0];
  if (m) await teams.updateMembership({ teamId, membershipId: m.$id, roles: [...new Set([...m.roles, ...roles])] });
  else await teams.createMembership({ teamId, roles, userId });
}

export async function updateMemberRolesAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    assertRegional(ctx);
    const raw = formToObject(fd);
    const d = z.object({ teamId: z.string(), membershipId: z.string(), roles: z.array(z.string()).default([]) }).parse({ ...raw, roles: raw.roles ?? [] });
    const { teams } = adminClient();
    if (!d.roles.length) {
      await teams.deleteMembership({ teamId: d.teamId, membershipId: d.membershipId });
      await audit(ctx, REGION, "update", "membership", d.membershipId, `Accès retiré (${d.teamId})`);
      revalidateApp();
      return { ok: true, message: "Accès retiré." };
    }
    await teams.updateMembership({ teamId: d.teamId, membershipId: d.membershipId, roles: d.roles });
    await audit(ctx, REGION, "update", "membership", d.membershipId, `Rôles modifiés (${d.teamId}) : ${d.roles.join(", ")}`);
    revalidateApp();
    return { ok: true, message: "Rôles mis à jour." };
  });
}

export async function toggleUserAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    assertRegional(ctx);
    const userId = String(fd.get("userId"));
    if (userId === ctx.user.id) throw new UserError("Vous ne pouvez pas désactiver votre propre compte.");
    const { users } = adminClient();
    const u = await users.get({ userId });
    if (u.labels?.includes("superadmin") && !ctx.isSuperAdmin) throw new ForbiddenError();
    await users.updateStatus({ userId, status: !u.status });
    if (u.status) await users.deleteSessions({ userId });
    await audit(ctx, REGION, u.status ? "disable" : "enable", "user", userId, `${u.status ? "Désactivation" : "Réactivation"} de ${u.email}`);
    revalidateApp();
    return { ok: true, message: u.status ? "Utilisateur désactivé." : "Utilisateur réactivé." };
  });
}

export async function resendInviteAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    assertRegional(ctx);
    const userId = String(fd.get("userId"));
    const { users } = adminClient();
    const u = await users.get({ userId });
    const link = await issuePasswordToken(userId, "invite");
    await sendEmail({ to: u.email, subject: "Votre accès à ICC BFC Finances", html: emailLayout("Activez votre compte", `<p>Bonjour ${u.name},</p><p>Voici un nouveau lien pour choisir votre mot de passe.</p>`, { label: "Choisir mon mot de passe", url: link }) });
    return { ok: true, message: "Nouveau lien généré.", data: { link } };
  });
}

// ---------------- Départements ----------------
export async function saveDepartmentAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({
      id: zId(), churchId: z.string().min(1), name: zText("Le nom", 120), leaderName: zOptText(160),
      leaderEmail: z.union([z.literal(""), zEmail()]).optional().transform((v) => v || null), annualBudget: zOptCents(),
    }).parse(formToObject(fd));
    assertManage(ctx, d.churchId);
    const data = { name: d.name, leaderName: d.leaderName, leaderEmail: d.leaderEmail, annualBudgetCents: d.annualBudget };
    if (d.id) {
      const before = await adminGet<{ $id: string; $createdAt: string; $updatedAt: string; churchId: string }>("departments", d.id);
      if (!before || before.churchId !== d.churchId) throw new ForbiddenError();
      await patch("departments", d.id, data);
      await audit(ctx, d.churchId, "update", "department", d.id, `Département modifié : ${d.name}`, before, data);
    } else {
      const row = await insert("departments", d.churchId, { ...data, createdBy: ctx.user.id });
      await audit(ctx, d.churchId, "create", "department", row.$id, `Département créé : ${d.name}`, null, data);
    }
    revalidateApp();
    return { ok: true, message: "Département enregistré." };
  });
}

export async function archiveRowAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const table = String(fd.get("table"));
    if (!["departments", "list_items", "bank_accounts", "approval_workflows", "projects"].includes(table)) throw new ForbiddenError();
    const id = String(fd.get("id"));
    const row = await adminGet<{ $id: string; $createdAt: string; $updatedAt: string; churchId: string; archived: boolean; name?: string; label?: string }>(table, id);
    if (!row) throw new UserError("Élément introuvable.");
    if (row.churchId === REGION) assertRegional(ctx);
    else assertManage(ctx, row.churchId);
    await patch(table, id, { archived: !row.archived });
    await audit(ctx, row.churchId, row.archived ? "restore" : "archive", table, id, `${row.archived ? "Restauration" : "Archivage"} : ${row.name ?? row.label ?? id}`);
    revalidateApp();
    return { ok: true, message: row.archived ? "Élément restauré." : "Élément archivé." };
  });
}

// ---------------- Listes configurables ----------------
export async function saveListItemAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({
      id: zId(), churchId: z.string().min(1), kind: z.enum(["expense_category", "donation_type", "cr_request_type", "service"]),
      name: zText("Le nom", 120), code: zOptText(30), isTithe: zBool(), sortOrder: z.coerce.number().int().default(0),
    }).parse(formToObject(fd));
    if (d.churchId === REGION) assertRegional(ctx);
    else {
      assertManage(ctx, d.churchId);
      const church = ctx.allChurches.find((c) => c.$id === d.churchId);
      if (!ctx.isRegional && !church?.allowLocalLists) throw new ForbiddenError("L'église mère n'autorise pas les listes locales pour cette église.");
    }
    const data = { kind: d.kind, name: d.name, code: d.code, isTithe: d.isTithe, sortOrder: d.sortOrder };
    if (d.id) await patch("list_items", d.id, data);
    else await insert("list_items", d.churchId, { ...data, createdBy: ctx.user.id }, { permissions: d.churchId === REGION ? regionPermissions() : await permsFor(d.churchId) });
    await audit(ctx, d.churchId, d.id ? "update" : "create", "list_item", d.id, `Liste ${d.kind} : ${d.name}`, null, data);
    revalidateApp();
    return { ok: true, message: "Élément enregistré." };
  });
}

// ---------------- Comptes bancaires ----------------
export async function saveBankAccountAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({
      id: zId(), churchId: z.string().min(1), label: zText("Le libellé", 120), bankName: zOptText(120),
      ibanLast4: z.string().trim().regex(/^(\d{4})?$/, "Indiquez seulement les 4 derniers chiffres.").optional(),
      openingBalance: zOptCents(), openingDate: zDate("La date d'ouverture"),
    }).parse(formToObject(fd));
    assertManage(ctx, d.churchId);
    const data = { label: d.label, bankName: d.bankName, ibanMasked: d.ibanLast4 ? `•••• ${d.ibanLast4}` : null, openingBalanceCents: d.openingBalance ?? 0, openingDate: d.openingDate };
    if (d.id) await patch("bank_accounts", d.id, data);
    else await insert("bank_accounts", d.churchId, { ...data, createdBy: ctx.user.id });
    await audit(ctx, d.churchId, d.id ? "update" : "create", "bank_account", d.id, `Compte bancaire : ${d.label}`, null, data);
    revalidateApp();
    return { ok: true, message: "Compte enregistré." };
  });
}

// ---------------- Workflows de validation ----------------
export async function saveWorkflowAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    assertRegional(ctx);
    const raw = formToObject(fd);
    const d = z.object({
      id: zId(), churchId: z.string().min(1), name: zText("Le nom", 120), min: zOptCents(), max: zOptCents(),
      stepRoles: z.array(z.enum(["treasurer", "pastor", "mother_admin"])).min(1, "Ajoutez au moins une étape."),
      stepDelays: z.array(z.coerce.number().int().min(1).max(720)).default([]),
      categoryIds: z.array(z.string()).default([]), priority: z.coerce.number().int().default(0),
    }).parse({ ...raw, stepRoles: raw.stepRoles ?? [], stepDelays: raw.stepDelays ?? [], categoryIds: raw.categoryIds ?? [] });
    if (d.max != null && d.min != null && d.max <= d.min) throw new UserError("Le montant maximum doit être supérieur au minimum.");
    const data = {
      name: d.name, minCents: d.min ?? 0, maxCents: d.max, stepRoles: d.stepRoles, stepDelaysHours: d.stepRoles.map((_, i) => d.stepDelays[i] ?? 72),
      categoryIds: d.categoryIds.filter(Boolean), priority: d.priority, active: true,
    };
    const perms = d.churchId === REGION ? regionPermissions() : await permsFor(d.churchId);
    if (d.id) await patch("approval_workflows", d.id, data);
    else await insert("approval_workflows", d.churchId, { ...data, createdBy: ctx.user.id }, { permissions: perms });
    await audit(ctx, d.churchId, d.id ? "update" : "create", "workflow", d.id, `Workflow : ${d.name}`, null, data);
    revalidateApp();
    return { ok: true, message: "Règle de validation enregistrée." };
  });
}

// ---------------- Liens publics ----------------
export async function createPublicLinkAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({
      churchId: z.string().min(1), kind: z.enum(["funding", "reimbursement"]), departmentId: zId(), label: zOptText(160),
      expiresAt: z.string().optional().transform((v) => (v ? new Date(`${v}T23:59:59Z`).toISOString() : null)),
    }).parse(formToObject(fd));
    assertManage(ctx, d.churchId);
    const row = await insert("public_links", d.churchId, { ...d, token: randomToken(18), active: true, createdBy: ctx.user.id });
    await audit(ctx, d.churchId, "create", "public_link", row.$id, `Lien public créé (${d.kind})`);
    revalidateApp();
    return { ok: true, message: "Lien créé." };
  });
}

export async function togglePublicLinkAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const id = String(fd.get("id"));
    const row = await adminGet<{ $id: string; $createdAt: string; $updatedAt: string; churchId: string; active: boolean }>("public_links", id);
    if (!row) throw new UserError("Lien introuvable.");
    assertManage(ctx, row.churchId);
    await patch("public_links", id, { active: !row.active });
    await audit(ctx, row.churchId, "update", "public_link", id, row.active ? "Lien désactivé" : "Lien activé");
    revalidateApp();
    return { ok: true, message: row.active ? "Lien désactivé." : "Lien activé." };
  });
}

// ---------------- Paramètres ----------------
export async function saveSettingsAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    assertRegional(ctx);
    const d = z.object({
      crPendingDays: z.coerce.number().int().min(1).max(365),
      cashMax: zCents("Le plafond de caisse"),
      cashMaxDays: z.coerce.number().int().min(1).max(90),
      noOfferingDays: z.coerce.number().int().min(1).max(90),
      fiscalReceipts: zBool(),
      donorRetentionYears: z.coerce.number().int().min(1).max(30),
    }).parse(formToObject(fd));
    const values: Record<string, unknown> = {
      crPendingDays: d.crPendingDays, cashMaxCents: d.cashMax, cashMaxDays: d.cashMaxDays, noOfferingDays: d.noOfferingDays,
      fiscalReceipts: d.fiscalReceipts, donorRetentionYears: d.donorRetentionYears,
    };
    const { db } = adminClient();
    for (const [key, value] of Object.entries(values)) {
      const rowId = `global_${key}`.slice(0, 36);
      try {
        await db.upsertRow({ databaseId: DATABASE_ID, tableId: "settings", rowId, data: { scope: "global", key, valueJson: JSON.stringify(value) }, permissions: regionPermissions() });
      } catch (e) {
        if (e instanceof AppwriteException) throw e;
      }
    }
    await audit(ctx, REGION, "update", "settings", null, "Paramètres d'alerte modifiés", null, values);
    revalidateApp();
    return { ok: true, message: "Paramètres enregistrés." };
  });
}

export async function toggleSuperAdminAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    if (!ctx.isSuperAdmin) throw new ForbiddenError("Réservé au super administrateur.");
    const userId = String(fd.get("userId"));
    if (userId === ctx.user.id) throw new UserError("Vous ne pouvez pas retirer vos propres droits.");
    const { users } = adminClient();
    const u = await users.get({ userId });
    const has = u.labels?.includes("superadmin");
    await users.updateLabels({ userId, labels: has ? (u.labels ?? []).filter((l) => l !== "superadmin") : [...(u.labels ?? []), "superadmin"] });
    await audit(ctx, REGION, "update", "user", userId, `${has ? "Retrait" : "Attribution"} du rôle super administrateur : ${u.email}`);
    revalidateApp();
    return { ok: true, message: has ? "Droits super administrateur retirés." : "Droits super administrateur accordés." };
  });
}
