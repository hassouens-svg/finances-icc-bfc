"use server";
import { z } from "zod";
import { Query } from "node-appwrite";
import { requireContext, assertManage } from "../context";
import { run, UserError, formToObject } from "../action";
import { insert, patch, audit, recordStatus, churchReference, assertNotLocked, adminGet, adminList, revalidateApp } from "../data";
import { markDeposited, writeAdjustment } from "../deposits";
import { saveFiles } from "../files";
import { zCents, zOptCents, zDate, zOptText, zBool } from "@/lib/zod";
import { formatEuro } from "@/lib/format";
import type { ActionResult } from "@/lib/action-types";
import type { Deposit, OfferingLine } from "@/lib/types";

export async function createDepositAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const raw = formToObject(fd);
    const d = z.object({
      churchId: z.string().min(1), bankAccountId: z.string().min(1, "Choisissez le compte bancaire."), date: zDate(), depositorName: zOptText(160),
      slipNumber: zOptText(60), mode: z.enum(["sessions", "free"]), sessionIds: z.array(z.string()).default([]), excludedCheques: z.array(z.string()).default([]),
      freeCash: zOptCents(), freeCheque: zOptCents(), alreadyDeposited: zBool(),
    }).parse({ ...raw, sessionIds: raw.sessionIds ?? [], excludedCheques: raw.excludedCheques ?? [] });
    assertManage(ctx, d.churchId, "depots");
    await assertNotLocked(ctx, d.churchId, d.date);
    let cashCents = 0, chequeCents = 0;
    let lines: OfferingLine[] = [];
    if (d.mode === "sessions") {
      if (!d.sessionIds.length) throw new UserError("Sélectionnez au moins une séance d'offrandes.");
      lines = (await adminList<OfferingLine>("offering_lines", [Query.equal("sessionId", d.sessionIds), Query.equal("method", ["cash", "cheque"]), Query.isNull("depositId")]))
        .filter((l) => l.churchId === d.churchId && !d.excludedCheques.includes(l.$id));
      cashCents = lines.filter((l) => l.method === "cash").reduce((a, l) => a + l.amountCents, 0);
      chequeCents = lines.filter((l) => l.method === "cheque").reduce((a, l) => a + l.amountCents, 0);
    } else {
      cashCents = d.freeCash ?? 0;
      chequeCents = d.freeCheque ?? 0;
    }
    if (cashCents + chequeCents <= 0) throw new UserError("Le montant du dépôt est nul.");
    const reference = await churchReference(d.churchId, "DPT", new Date(d.date));
    const dep = await insert<Deposit>("deposits", d.churchId, {
      reference, bankAccountId: d.bankAccountId, date: d.date, depositorName: d.depositorName, slipNumber: d.slipNumber, cashCents, chequeCents,
      status: "prepared", gapCents: 0, sessionIds: d.mode === "sessions" ? d.sessionIds : [], createdBy: ctx.user.id,
    });
    for (const l of lines) await patch("offering_lines", l.$id, { depositId: dep.$id });
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length) {
      const ids = await saveFiles(files, d.churchId, "deposit", dep.$id, ctx.user.name);
      await patch("deposits", dep.$id, { slipFileId: ids[0] });
    }
    await recordStatus({ id: ctx.user.id, name: ctx.user.name }, d.churchId, "deposit", dep.$id, null, "prepared");
    if (d.alreadyDeposited) {
      await markDeposited(ctx, dep.$id);
      await patch("deposits", dep.$id, { status: "deposited" });
      await recordStatus({ id: ctx.user.id, name: ctx.user.name }, d.churchId, "deposit", dep.$id, "prepared", "deposited");
    }
    await audit(ctx, d.churchId, "create", "deposit", dep.$id, `Dépôt ${reference} de ${formatEuro(cashCents + chequeCents)}`, null, { cashCents, chequeCents });
    revalidateApp();
    return { ok: true, message: "Dépôt enregistré.", redirect: `/app/depots/${dep.$id}` };
  });
}

export async function confirmDepositAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({ id: z.string(), confirmed: zCents("Le montant confirmé"), valueDate: zDate("La date de valeur"), comment: z.string().trim().max(1000).optional() }).parse(Object.fromEntries(fd));
    const dep = await adminGet<Deposit>("deposits", d.id);
    if (!dep) throw new UserError("Dépôt introuvable.");
    assertManage(ctx, dep.churchId, "depots");
    if (dep.status !== "deposited") throw new UserError("Seul un dépôt « Déposé » peut être confirmé.");
    const gap = d.confirmed - dep.cashCents - dep.chequeCents;
    if (gap !== 0 && !d.comment) throw new UserError(`Écart de ${formatEuro(gap)} : expliquez-le en commentaire.`);
    await writeAdjustment(ctx, dep, d.confirmed);
    await patch("deposits", d.id, { status: "confirmed", confirmedCents: d.confirmed, valueDate: d.valueDate, confirmedAt: new Date().toISOString(), gapCents: gap });
    await recordStatus({ id: ctx.user.id, name: ctx.user.name }, dep.churchId, "deposit", d.id, "deposited", "confirmed", gap ? `Écart ${formatEuro(gap)} — ${d.comment}` : d.comment ?? null);
    await audit(ctx, dep.churchId, "validate", "deposit", d.id, `Dépôt ${dep.reference} confirmé sur le relevé${gap ? ` (écart ${formatEuro(gap)})` : ""}`);
    revalidateApp();
    return { ok: true, message: gap ? "Dépôt confirmé — écart signalé." : "Dépôt confirmé sur le relevé." };
  });
}

export async function cancelDepositAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const dep = await adminGet<Deposit>("deposits", String(fd.get("id")));
    if (!dep) throw new UserError("Dépôt introuvable.");
    assertManage(ctx, dep.churchId, "depots");
    if (dep.status !== "prepared") throw new UserError("Seul un dépôt « Préparé » peut être annulé.");
    const lines = await adminList<OfferingLine>("offering_lines", [Query.equal("depositId", dep.$id)]);
    for (const l of lines) await patch("offering_lines", l.$id, { depositId: null });
    await patch("deposits", dep.$id, { archived: true });
    await audit(ctx, dep.churchId, "delete", "deposit", dep.$id, `Dépôt ${dep.reference} annulé`, dep, null);
    revalidateApp();
    return { ok: true, message: "Dépôt annulé.", redirect: "/app/depots" };
  });
}
