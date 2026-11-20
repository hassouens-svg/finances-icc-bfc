import "server-only";
import { canManage, type AppContext } from "@/server/context";
import { getLookups } from "@/server/lookups";

export async function crFormData(ctx: AppContext, churchId?: string) {
  const churches = ctx.churches.filter((c) => canManage(ctx, c.$id, "citeroyale") && (churchId ? c.$id === churchId : ctx.view === "all" || c.$id === ctx.view));
  const lk = await getLookups(churches.map((c) => c.$id).join(","));
  return {
    churches: churches.map((c) => ({ id: c.$id, name: c.name, isMother: c.isMother })),
    types: lk.crTypes.map((c) => ({ id: c.$id, name: c.name, churchId: c.churchId })),
    departments: lk.departments.map((c) => ({ id: c.$id, name: c.name, churchId: c.churchId })),
  };
}
