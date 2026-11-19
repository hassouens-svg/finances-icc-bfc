import "server-only";
import { Query } from "node-appwrite";
import { canManage, type AppContext } from "@/server/context";
import { getLookups } from "@/server/lookups";
import { listScoped } from "@/server/data";
import type { Project } from "@/lib/types";

export async function expenseFormData(ctx: AppContext, churchId?: string) {
  const churches = ctx.churches.filter((c) => canManage(ctx, c.$id) && (churchId ? c.$id === churchId : ctx.view === "all" || c.$id === ctx.view));
  const ids = churches.map((c) => c.$id);
  const [lk, projects] = await Promise.all([getLookups(ids.join(",")), listScoped<Project>(ctx, "projects", [Query.equal("archived", false), Query.equal("status", ["planned", "active"])], ids)]);
  return {
    churches: churches.map((c) => ({ id: c.$id, name: c.name })),
    categories: lk.categories.map((c) => ({ id: c.$id, name: c.name, churchId: c.churchId })),
    departments: lk.departments.map((c) => ({ id: c.$id, name: c.name, churchId: c.churchId })),
    accounts: lk.bankAccounts.map((c) => ({ id: c.$id, name: c.label, churchId: c.churchId })),
    projects: projects.map((c) => ({ id: c.$id, name: c.name, churchId: c.churchId })),
  };
}
