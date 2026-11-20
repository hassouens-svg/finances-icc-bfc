import "server-only";
import { ID, Query } from "node-appwrite";
import { adminClient } from "@/lib/appwrite/server";
import { MOTHER_TEAM_ID } from "@/lib/schema";
import { MODULES, rolesFor, ALLOWED_ROLE, type Level, type ModuleKey, type Preset } from "@/lib/access";
import { issuePasswordToken, randomToken } from "./tokens";
import { sendEmail, emailLayout } from "./notify";
import { UserError } from "./action";
import type { Church } from "@/lib/types";

/** Lit le formulaire de droits (rôle prêt à l'emploi ou droits personnalisés module par module). */
export function rolesFromForm(raw: Record<string, unknown>): string[] {
  const preset = String(raw.preset ?? "reader") as Preset | "none";
  if (preset === "none") return [];
  const modules: Partial<Record<ModuleKey, Level>> = {};
  for (const m of MODULES) {
    const v = String(raw[`mod_${m.key}`] ?? "none");
    modules[m.key] = v === "edit" || v === "view" ? v : "none";
  }
  const roles = rolesFor(preset, modules, { treasurer: raw.ap_treasurer === "on", pastor: raw.ap_pastor === "on" });
  if (!roles.every((r) => ALLOWED_ROLE.test(r))) throw new UserError("Droits invalides.");
  return roles;
}

/** Remplace les rôles d'une personne dans une équipe (ou l'y ajoute). */
export async function setMembership(teamId: string, userId: string, roles: string[]) {
  const { teams } = adminClient();
  const m = (await teams.listMemberships({ teamId, queries: [Query.equal("userId", userId), Query.limit(1)] })).memberships[0];
  if (!roles.length) {
    if (m) await teams.deleteMembership({ teamId, membershipId: m.$id });
    return;
  }
  if (m) await teams.updateMembership({ teamId, membershipId: m.$id, roles });
  else await teams.createMembership({ teamId, roles, userId });
}

/**
 * Crée le compte (ou retrouve la personne) et lui donne ses accès.
 * Sans mot de passe, un lien d'invitation (7 jours) est créé et renvoyé.
 */
export async function grantAccount(opts: {
  email: string; name: string; password?: string | null; church?: Church | null; churchRoles?: string[]; motherAdmin?: boolean; superAdmin?: boolean;
}) {
  const { users } = adminClient();
  const existing = (await users.list({ queries: [Query.equal("email", opts.email), Query.limit(1)] })).users[0];
  let userId = existing?.$id;
  let isNew = false;
  if (!userId) {
    userId = (await users.create({ userId: ID.unique(), email: opts.email, password: opts.password || randomToken(24) + "aA1!", name: opts.name })).$id;
    isNew = true;
  } else if (opts.password) await users.updatePassword({ userId, password: opts.password });
  if (opts.password) await users.updateEmailVerification({ userId, emailVerification: true });
  if (opts.superAdmin) {
    const u = await users.get({ userId });
    await users.updateLabels({ userId, labels: [...new Set([...(u.labels ?? []), "superadmin"])] });
  }
  if (opts.church && opts.churchRoles?.length) await setMembership(opts.church.teamId, userId, opts.churchRoles);
  if (opts.motherAdmin) await setMembership(MOTHER_TEAM_ID, userId, ["admin"]);
  let link: string | null = null;
  if (isNew && !opts.password) {
    link = await issuePasswordToken(userId, "invite");
    await sendEmail({
      to: opts.email,
      subject: "Votre accès à ICC BFC Finances",
      html: emailLayout("Vous êtes invité(e) sur ICC BFC Finances", `<p>Bonjour ${opts.name},</p><p>Un accès a été créé pour vous${opts.church ? ` pour l'église <b>${opts.church.name}</b>` : ""}. Cliquez sur le bouton pour choisir votre mot de passe (lien valable 7 jours).</p>`, { label: "Activer mon compte", url: link }),
    });
  }
  return { userId, isNew, link };
}
