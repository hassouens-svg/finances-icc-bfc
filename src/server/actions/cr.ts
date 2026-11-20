"use server";
import { z } from "zod";
import { requireContext, assertManage, ForbiddenError } from "../context";
import { run, UserError, formToObject } from "../action";
import { insert, patch, audit, recordStatus, churchReference, adminGet, revalidateApp, churchById } from "../data";
import { saveFiles } from "../files";
import { notifyUsers, usersWithRoles } from "../notify";
import { zText, zOptText, zOptCents, zOptDate, zId, zBool } from "@/lib/zod";
import { PRIORITIES } from "@/lib/schema";
import { formatEuro } from "@/lib/format";
import type { ActionResult } from "@/lib/action-types";
import type { CrRequest } from "@/lib/types";

export async function saveCrAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({
      id: zId(), churchId: z.string().min(1), title: zText("L'objet", 200), typeId: zId(), reason: zOptText(4000), description: zOptText(4000),
      quantity: z.coerce.number().int().min(0).optional(), estimated: zOptCents(), priority: z.enum(PRIORITIES).default("normal"), wishedDate: zOptDate(),
      departmentId: zId(), contactName: zOptText(160), sendChannel: zOptText(80), crReference: zOptText(80), viaMother: zBool(), submitNow: zBool(),
    }).parse(formToObject(fd));
    assertManage(ctx, d.churchId, "citeroyale");
    const church = await churchById(d.churchId);
    const data = {
      title: d.title, typeId: d.typeId, reason: d.reason, description: d.description, quantity: d.quantity ?? null, estimatedCents: d.estimated, priority: d.priority,
      wishedDate: d.wishedDate, departmentId: d.departmentId, contactName: d.contactName ?? ctx.user.name, sendChannel: d.sendChannel, crReference: d.crReference,
      viaMother: church.isMother ? false : d.viaMother,
    };
    let row: CrRequest;
    if (d.id) {
      const before = await adminGet<CrRequest>("cr_requests", d.id);
      if (!before || before.churchId !== d.churchId) throw new ForbiddenError();
      row = await patch<CrRequest>("cr_requests", d.id, data);
      await audit(ctx, d.churchId, "update", "cr_request", d.id, `Demande ${before.reference} modifiée`, before, data);
    } else {
      const reference = await churchReference(d.churchId, "CR");
      row = await insert<CrRequest>("cr_requests", d.churchId, { ...data, reference, status: "draft", statusChangedAt: new Date().toISOString(), createdBy: ctx.user.id });
      await recordStatus({ id: ctx.user.id, name: ctx.user.name }, d.churchId, "cr_request", row.$id, null, "draft");
      await audit(ctx, d.churchId, "create", "cr_request", row.$id, `Demande Cité Royale ${reference} : ${d.title}`);
    }
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length) await saveFiles(files, d.churchId, "cr_request", row.$id, ctx.user.name);
    if (d.submitNow && row.status === "draft") await submitCr(ctx, row);
    revalidateApp();
    return { ok: true, message: "Demande enregistrée.", redirect: `/app/cite-royale/${row.$id}` };
  });
}

async function submitCr(ctx: Awaited<ReturnType<typeof requireContext>>, cr: CrRequest) {
  const to = cr.viaMother ? "mother_review" : "initiated";
  await patch("cr_requests", cr.$id, { status: to, statusChangedAt: new Date().toISOString() });
  await recordStatus({ id: ctx.user.id, name: ctx.user.name }, cr.churchId, "cr_request", cr.$id, cr.status, to, cr.viaMother ? "Transmise à l'église mère pour validation avant envoi." : null);
  if (to === "mother_review") {
    const ids = await usersWithRoles("eglise-mere", ["admin"]);
    const church = await churchById(cr.churchId);
    await notifyUsers(ids, cr.churchId, { kind: "cr", title: `Demande Cité Royale à valider : ${cr.title}`, body: church.name, link: `/app/cite-royale/${cr.$id}` });
  }
}

export async function submitCrAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const cr = await adminGet<CrRequest>("cr_requests", String(fd.get("id")));
    if (!cr) throw new UserError("Demande introuvable.");
    assertManage(ctx, cr.churchId, "citeroyale");
    if (cr.status !== "draft") throw new UserError("Cette demande est déjà lancée.");
    await submitCr(ctx, cr);
    await audit(ctx, cr.churchId, "status", "cr_request", cr.$id, `Demande ${cr.reference} lancée`);
    revalidateApp();
    return { ok: true, message: cr.viaMother ? "Transmise à l'église mère." : "Demande initiée." };
  });
}

export async function receiveCrAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({ id: z.string(), received: zOptCents(), receivedQuantity: z.coerce.number().int().min(0).optional(), receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), full: zBool(), comment: z.string().trim().max(2000).optional() }).parse(formToObject(fd));
    const cr = await adminGet<CrRequest>("cr_requests", d.id);
    if (!cr) throw new UserError("Demande introuvable.");
    assertManage(ctx, cr.churchId, "citeroyale");
    if (!["approved", "received_partial"].includes(cr.status)) throw new UserError("La réception n'est possible qu'après validation par la Cité Royale.");
    const to = d.full ? "received_full" : "received_partial";
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    const ids = files.length ? await saveFiles(files, cr.churchId, "cr_request", cr.$id, ctx.user.name) : [];
    await patch("cr_requests", cr.$id, {
      status: to, receivedCents: (cr.status === "received_partial" ? cr.receivedCents ?? 0 : 0) + (d.received ?? 0), receivedQuantity: (cr.status === "received_partial" ? cr.receivedQuantity ?? 0 : 0) + (d.receivedQuantity ?? 0),
      receivedAt: new Date(`${d.receivedAt}T12:00:00Z`).toISOString(), receiptFileId: ids[0] ?? cr.receiptFileId ?? null, statusChangedAt: new Date().toISOString(),
    });
    const gap = cr.estimatedCents && d.received != null ? d.received - cr.estimatedCents : null;
    await recordStatus({ id: ctx.user.id, name: ctx.user.name }, cr.churchId, "cr_request", cr.$id, cr.status, to, [d.received != null ? `Reçu ${formatEuro(d.received)}` : null, gap ? `écart ${formatEuro(gap)}` : null, d.comment].filter(Boolean).join(" — ") || null);
    await audit(ctx, cr.churchId, "status", "cr_request", cr.$id, `Réception ${to === "received_full" ? "totale" : "partielle"} de ${cr.reference}`);
    revalidateApp();
    return { ok: true, message: "Réception enregistrée." };
  });
}
