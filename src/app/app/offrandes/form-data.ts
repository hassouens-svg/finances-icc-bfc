import "server-only";
import { Query } from "node-appwrite";
import { canManage, type AppContext } from "@/server/context";
import { getLookups } from "@/server/lookups";
import { listScoped } from "@/server/data";
import type { Donor } from "@/lib/types";

export async function sessionFormData(ctx: AppContext) {
  const churches = ctx.churches.filter((c) => canManage(ctx, c.$id) && (ctx.view === "all" || c.$id === ctx.view));
  const ids = churches.map((c) => c.$id);
  const [lk, donors] = await Promise.all([getLookups(ids.join(",")), listScoped<Donor>(ctx, "donors", [Query.isNull("anonymizedAt"), Query.orderAsc("fullName")], ids)]);
  const opt = (x: { $id: string; name: string; churchId: string }) => ({ id: x.$id, name: x.name, churchId: x.churchId });
  return {
    churches: churches.map((c) => ({ id: c.$id, name: c.name })),
    donationTypes: lk.donationTypes.map(opt),
    services: lk.services.map(opt),
    donors: donors.map((d) => ({ id: d.$id, name: d.fullName, churchId: d.churchId })),
  };
}
