import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminClient, listAll, Query } from "@/lib/appwrite/server";
import { getCurrentUser } from "./auth";
import { MOTHER_TEAM_ID } from "@/lib/schema";
import type { Church, ChurchRole, City } from "@/lib/types";
import { computeAccess, type Access, type ModuleKey } from "@/lib/access";

export const VIEW_COOKIE = "icc_view";

export type AppContext = {
  user: { id: string; name: string; email: string };
  isSuperAdmin: boolean;
  isMotherAdmin: boolean;
  /** super admin ou admin de l'église mère : voit toutes les églises */
  isRegional: boolean;
  allChurches: Church[];
  cities: City[];
  /** églises auxquelles l'utilisateur a accès */
  churches: Church[];
  roles: Record<string, ChurchRole[]>;
  /** droits détaillés par église (rôles prêts à l'emploi ou personnalisés) */
  access: Record<string, Access>;
  /** "all" (vue consolidée, régional seulement) ou id d'église */
  view: string;
  /** églises couvertes par la vue courante */
  scopeIds: string[];
  activeChurch: Church | null;
  motherChurch: Church | null;
};

export const getAllChurches = cache(async () => {
  const { db } = adminClient();
  const [churches, cities] = await Promise.all([
    listAll<Church>(db, "churches", [Query.orderAsc("name")]),
    listAll<City>(db, "cities", [Query.orderAsc("name")]),
  ]);
  return { churches, cities };
});

export const getContext = cache(async (): Promise<AppContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const { users } = adminClient();
  const [{ churches: allChurches, cities }, memberships] = await Promise.all([
    getAllChurches(),
    users.listMemberships({ userId: user.$id }),
  ]);
  const isSuperAdmin = user.labels?.includes("superadmin") ?? false;
  const roles: Record<string, ChurchRole[]> = {};
  const access: Record<string, Access> = {};
  let isMotherAdmin = false;
  for (const m of memberships.memberships) {
    if (!m.confirm) continue;
    if (m.teamId === MOTHER_TEAM_ID) {
      if (m.roles.includes("admin") || m.roles.includes("owner")) isMotherAdmin = true;
      continue;
    }
    const church = allChurches.find((c) => c.teamId === m.teamId);
    if (church) {
      access[church.$id] = computeAccess(m.roles);
      roles[church.$id] = m.roles.filter((r): r is ChurchRole => ["treasurer", "pastor", "reader"].includes(r));
      if (!roles[church.$id]!.length) roles[church.$id] = ["reader"]; // tout membre a au moins un accès de base
    }
  }
  const isRegional = isSuperAdmin || isMotherAdmin;
  const active = allChurches.filter((c) => c.active);
  const churches = isRegional ? active : active.filter((c) => roles[c.$id]?.length);
  const motherChurch = allChurches.find((c) => c.isMother) ?? null;

  const store = await cookies();
  let view = store.get(VIEW_COOKIE)?.value ?? "";
  if (view === "all" && !isRegional) view = "";
  if (view !== "all" && !churches.some((c) => c.$id === view)) {
    view = isRegional ? "all" : churches[0]?.$id ?? "";
  }
  const scopeIds = view === "all" ? churches.map((c) => c.$id) : view ? [view] : [];
  return {
    user: { id: user.$id, name: user.name || user.email, email: user.email },
    isSuperAdmin, isMotherAdmin, isRegional, allChurches, cities, churches, roles, access, view, scopeIds,
    activeChurch: view === "all" ? null : churches.find((c) => c.$id === view) ?? null,
    motherChurch,
  };
});

export async function requireContext(): Promise<AppContext> {
  const ctx = await getContext();
  if (!ctx) redirect("/");
  return ctx;
}

// ---------- Droits ----------
export function hasRole(ctx: AppContext, churchId: string, ...wanted: ChurchRole[]) {
  if (ctx.isRegional) return true;
  const r = ctx.roles[churchId] ?? [];
  return wanted.some((w) => r.includes(w));
}
/** Niveau d'accès à un module pour une église : « none », « view » ou « edit ». */
export function levelOf(ctx: AppContext, churchId: string, module: ModuleKey) {
  if (ctx.isRegional) return "edit";
  return ctx.access[churchId]?.modules[module] ?? "none";
}
/**
 * Peut saisir / modifier. Avec un module : droit « gérer » sur ce module.
 * Sans module : responsable ou trésorier (gestion générale de l'église).
 */
export function canManage(ctx: AppContext, churchId: string, module?: ModuleKey) {
  if (ctx.isRegional) return true;
  const a = ctx.access[churchId];
  if (!a) return false;
  if (module) return a.modules[module] === "edit";
  return a.admin || a.preset === "treasurer";
}
export function canRead(ctx: AppContext, churchId: string, module?: ModuleKey) {
  if (ctx.isRegional) return true;
  const a = ctx.access[churchId];
  if (!a) return false;
  return module ? a.modules[module] !== "none" : true;
}
/** Responsable de l'église : gère l'équipe et les droits de chacun. */
export function canManageTeam(ctx: AppContext, churchId: string) {
  return ctx.isRegional || !!ctx.access[churchId]?.admin;
}
/** Le module est-il visible dans au moins une église de la vue courante ? */
export function canSeeModule(ctx: AppContext, module: ModuleKey) {
  return ctx.isRegional || ctx.scopeIds.some((id) => canRead(ctx, id, module));
}
export function canApproveAs(ctx: AppContext, churchId: string, role: string) {
  if (ctx.isSuperAdmin) return true;
  if (role === "mother_admin") return ctx.isMotherAdmin;
  if (ctx.isMotherAdmin) return true;
  const a = ctx.access[churchId];
  if (!a) return false;
  return role === "treasurer" ? a.approve.treasurer : role === "pastor" ? a.approve.pastor : false;
}

export class ForbiddenError extends Error {
  constructor(msg = "Vous n'avez pas les droits pour cette action.") {
    super(msg);
  }
}
export function assertManage(ctx: AppContext, churchId: string, module?: ModuleKey) {
  if (!canManage(ctx, churchId, module)) throw new ForbiddenError();
}
export function assertRead(ctx: AppContext, churchId: string, module?: ModuleKey) {
  if (!canRead(ctx, churchId, module)) throw new ForbiddenError();
}
export function assertTeam(ctx: AppContext, churchId: string) {
  if (!canManageTeam(ctx, churchId)) throw new ForbiddenError("Seul le responsable de l'église peut gérer son équipe.");
}
export function assertRegional(ctx: AppContext) {
  if (!ctx.isRegional) throw new ForbiddenError("Réservé à l'église mère.");
}

/** Église cible pour une création : celle de la vue, sinon la première gérable. */
export function targetChurchId(ctx: AppContext, requested?: string | null) {
  const id = requested || (ctx.view !== "all" ? ctx.view : "") || ctx.churches.find((c) => canManage(ctx, c.$id))?.$id;
  if (!id) throw new ForbiddenError("Aucune église sélectionnée.");
  assertManage(ctx, id);
  return id;
}

export function churchName(ctx: AppContext, id: string) {
  return ctx.allChurches.find((c) => c.$id === id)?.name ?? "—";
}

/** Église ciblée par un écran propre à une église (paramètre ?church=, sinon vue, sinon première gérable). */
export function pickChurch(ctx: AppContext, requested?: string, needManage = true, module?: ModuleKey) {
  const allowed = ctx.churches.filter((c) => (needManage ? canManage(ctx, c.$id, module) : canRead(ctx, c.$id, module)));
  const id = requested && allowed.some((c) => c.$id === requested) ? requested : ctx.view !== "all" && allowed.some((c) => c.$id === ctx.view) ? ctx.view : allowed[0]?.$id;
  return { church: allowed.find((c) => c.$id === id) ?? null, allowed };
}
