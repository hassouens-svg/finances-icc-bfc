"use server";
import { z } from "zod";
import { Query } from "node-appwrite";
import { requireContext, assertManage, ForbiddenError } from "../context";
import { run, UserError } from "../action";
import { insert, remove, audit, adminList, revalidateApp } from "../data";
import type { ActionResult } from "@/lib/action-types";

export async function lockMonthAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({ churchId: z.string(), month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(Object.fromEntries(fd));
    assertManage(ctx, d.churchId, "tresorerie");
    const ex = await adminList("period_locks", [Query.equal("churchId", d.churchId), Query.equal("month", d.month)]);
    if (ex.length) throw new UserError("Ce mois est déjà clôturé.");
    await insert("period_locks", d.churchId, { month: d.month, lockedByName: ctx.user.name, createdBy: ctx.user.id });
    await audit(ctx, d.churchId, "lock", "period", null, `Clôture du mois ${d.month}`);
    revalidateApp();
    return { ok: true, message: `Mois ${d.month} clôturé.` };
  });
}

export async function unlockMonthAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    if (!ctx.isRegional) throw new ForbiddenError("Seul un administrateur peut rouvrir un mois clôturé.");
    const d = z.object({ churchId: z.string(), month: z.string() }).parse(Object.fromEntries(fd));
    const ex = await adminList("period_locks", [Query.equal("churchId", d.churchId), Query.equal("month", d.month)]);
    for (const r of ex) await remove("period_locks", r.$id);
    await audit(ctx, d.churchId, "unlock", "period", null, `Réouverture du mois ${d.month}`);
    revalidateApp();
    return { ok: true, message: `Mois ${d.month} rouvert.` };
  });
}
