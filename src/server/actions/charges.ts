"use server";
import { z } from "zod";
import { Query } from "node-appwrite";
import { requireContext, assertManage } from "../context";
import { run, UserError, formToObject } from "../action";
import { insert, patch, remove, audit, adminGet, adminList, churchReference, recordStatus, revalidateApp } from "../data";
import { getLookups } from "../lookups";
import { submitExpenseInternal } from "../expenses";
import { zText, zCents, zId, zOptText } from "@/lib/zod";
import { EXPENSE_PAY_METHODS } from "@/lib/schema";
import { formatEuro, formatMonth } from "@/lib/format";
import type { ActionResult } from "@/lib/action-types";
import type { Expense, RecurringCharge } from "@/lib/types";

export async function saveChargeAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({
      id: zId(), churchId: z.string().min(1), name: zText("Le nom", 160), categoryId: zId(), amount: zCents(),
      frequency: z.enum(["monthly", "quarterly", "yearly"]), dueDay: z.coerce.number().int().min(1).max(31).default(5),
      sortOrder: z.coerce.number().int().default(0), paymentMethod: z.enum(EXPENSE_PAY_METHODS).default("bank_transfer"), supplier: zOptText(160),
    }).parse(formToObject(fd));
    assertManage(ctx, d.churchId);
    const lk = await getLookups(d.churchId);
    const data = {
      name: d.name, categoryId: d.categoryId, categoryName: lk.categories.find((c) => c.$id === d.categoryId)?.name ?? null, amountCents: d.amount,
      frequency: d.frequency, dueDay: d.dueDay, sortOrder: d.sortOrder, paymentMethod: d.paymentMethod, supplier: d.supplier, active: true,
    };
    if (d.id) await patch("recurring_charges", d.id, data);
    else await insert("recurring_charges", d.churchId, { ...data, createdBy: ctx.user.id });
    await audit(ctx, d.churchId, d.id ? "update" : "create", "recurring_charge", d.id ?? null, `Charge fixe : ${d.name} (${formatEuro(d.amount)})`);
    revalidateApp();
    return { ok: true, message: "Charge enregistrée." };
  });
}

export async function deleteChargeAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const c = await adminGet<RecurringCharge>("recurring_charges", String(fd.get("id")));
    if (!c) throw new UserError("Charge introuvable.");
    assertManage(ctx, c.churchId);
    await remove("recurring_charges", c.$id);
    await audit(ctx, c.churchId, "delete", "recurring_charge", c.$id, `Charge fixe supprimée : ${c.name}`, c, null);
    revalidateApp();
    return { ok: true, message: "Charge supprimée." };
  });
}

/** Crée la dépense du mois pour une charge fixe et l'envoie dans son circuit de validation. */
export async function generateChargeExpenseAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const c = await adminGet<RecurringCharge>("recurring_charges", String(fd.get("id")));
    if (!c) throw new UserError("Charge introuvable.");
    assertManage(ctx, c.churchId);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const existing = await adminList<Expense>("expenses", [Query.equal("churchId", c.churchId), Query.equal("source", "recurring"), Query.equal("sourceId", c.$id), Query.greaterThanEqual("date", monthStart.toISOString()), Query.equal("archived", false)]);
    if (existing.length) throw new UserError(`La dépense « ${c.name} » de ce mois existe déjà.`);
    const lk = await getLookups(c.churchId);
    const day = Math.min(c.dueDay || 5, 28);
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, 12)).toISOString();
    const reference = await churchReference(c.churchId, "DEP", new Date(date));
    const e = await insert<Expense>("expenses", c.churchId, {
      reference, title: `${c.name} — ${formatMonth(date)}`, categoryId: c.categoryId, categoryName: c.categoryName, supplier: c.supplier, amountCents: c.amountCents, date,
      paymentMethod: c.paymentMethod, bankAccountId: c.paymentMethod === "cash" ? null : lk.bankAccounts[0]?.$id ?? null, status: "draft", currentStep: 0, totalSteps: 0, stepRoles: [],
      isRegularization: false, source: "recurring", sourceId: c.$id, createdBy: ctx.user.id,
    });
    await recordStatus({ id: ctx.user.id, name: ctx.user.name }, c.churchId, "expense", e.$id, null, "draft", "Créée depuis les charges fixes");
    await submitExpenseInternal(ctx, e);
    await audit(ctx, c.churchId, "create", "expense", e.$id, `Dépense ${reference} générée depuis la charge fixe « ${c.name} »`);
    revalidateApp();
    return { ok: true, message: `Dépense « ${c.name} » créée et envoyée en validation.` };
  });
}
