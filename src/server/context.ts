import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminClient, listAll, Query } from "@/lib/appwrite/server";
import { getCurrentUser } from "./auth";
import { MOTHER_TEAM_ID } from "@/lib/schema";
import type { Church, ChurchRole, City } from "@/lib/types";

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
  let isMotherAdmin = false;
  for (const m of memberships.memberships) {
    if (!m.confirm) continue;
    if (m.teamId === MOTHER_TEAM_ID) {
      if (m.roles.includes("admin") || m.roles.includes("owner")) isMotherAdmin = true;
      continue;
    }
    const church = allChurches.find((c) => c.teamId === m.teamId);
    if (church) roles[church.$id] = m.roles.filter((r): r is ChurchRole => ["treasurer", "pastor", "reader"].includes(r));
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
    isSuperAdmin, isMotherAdmin, isRegional, allChurches, cities, churches, roles, view, scopeIds,
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
/** Peut saisir / modifier les finances de l'église. */
export function canManage(ctx: AppContext, churchId: string) {
  return hasRole(ctx, churchId, "treasurer");
}
export function canRead(ctx: AppContext, churchId: string) {
  return ctx.isRegional || (ctx.roles[churchId]?.length ?? 0) > 0;
}
export function canApproveAs(ctx: AppContext, churchId: string, role: string) {
  if (ctx.isSuperAdmin) return true;
  if (role === "mother_admin") return ctx.isMotherAdmin;
  if (ctx.isMotherAdmin) return true;
  return (ctx.roles[churchId] ?? []).includes(role as ChurchRole);
}

export class ForbiddenError extends Error {
  constructor(msg = "Vous n'avez pas les droits pour cette action.") {
    super(msg);
  }
}
export function assertManage(ctx: AppContext, churchId: string) {
  if (!canManage(ctx, churchId)) throw new ForbiddenError();
}
export function assertRead(ctx: AppContext, churchId: string) {
  if (!canRead(ctx, churchId)) throw new ForbiddenError();
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
