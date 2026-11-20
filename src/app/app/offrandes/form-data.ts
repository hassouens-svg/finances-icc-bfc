import "server-only";
import { Query } from "node-appwrite";
import { canManage, type AppContext } from "@/server/context";
import { getLookups, forChurch } from "@/server/lookups";
import { listScoped } from "@/server/data";
import type { Donor } from "@/lib/types";

export function manageableChurches(ctx: AppContext) {
  return ctx.churches.filter((c) => canManage(ctx, c.$id, "offrandes") && (ctx.view === "all" || c.$id === ctx.view));
}

export async function entryData(ctx: AppContext, churchId: string) {
  const [lk, donors] = await Promise.all([getLookups(churchId), listScoped<Donor>(ctx, "donors", [Query.isNull("anonymizedAt"), Query.orderAsc("fullName"), Query.select(["$id", "fullName", "churchId"])], [churchId])]);
  return {
    donationTypes: forChurch(lk.donationTypes, churchId).map((t) => ({ id: t.$id, name: t.name })),
    services: forChurch(lk.services, churchId).map((t) => ({ id: t.$id, name: t.name })),
    donors: donors.map((d) => ({ id: d.$id, name: d.fullName })),
  };
}
