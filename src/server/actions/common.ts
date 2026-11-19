"use server";
import { z } from "zod";
import { requireContext, assertManage, assertRead, canManage, ForbiddenError } from "../context";
import { run, UserError } from "../action";
import { insert, patch, audit, recordStatus, adminGet, revalidateApp } from "../data";
import { canTransition, allowedTransitions } from "@/lib/transitions";
import { statusDef } from "@/lib/status";
import { notifyRequester } from "../notify";
import type { ActionResult } from "@/lib/action-types";
import { ENTITY_TABLE, saveFiles } from "../files";

export async function uploadAttachmentAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const entityType = String(fd.get("entityType"));
    const entityId = String(fd.get("entityId"));
    const table = ENTITY_TABLE[entityType];
    if (!table) throw new ForbiddenError();
    const row = await adminGet<{ $id: string; $createdAt: string; $updatedAt: string; churchId: string }>(table, entityId);
    if (!row) throw new UserError("Élément introuvable.");
    assertManage(ctx, row.churchId);
    const files = fd.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) throw new UserError("Choisissez au moins un fichier.");
    const ids = await saveFiles(files, row.churchId, entityType, entityId, ctx.user.name);
    await audit(ctx, row.churchId, "create", "attachment", entityId, `${ids.length} pièce(s) jointe(s) ajoutée(s)`);
    revalidateApp();
    return { ok: true, message: "Pièce jointe ajoutée." };
  });
}

export async function addCommentAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({ entityType: z.string(), entityId: z.string(), body: z.string().trim().min(1, "Écrivez un commentaire.").max(4000), internal: z.string().optional() }).parse(Object.fromEntries(fd));
    const table = ENTITY_TABLE[d.entityType];
    if (!table) throw new ForbiddenError();
    const row = await adminGet<{ $id: string; $createdAt: string; $updatedAt: string; churchId: string }>(table, d.entityId);
    if (!row) throw new UserError("Élément introuvable.");
    assertRead(ctx, row.churchId);
    await insert("comments", row.churchId, { entityType: d.entityType, entityId: d.entityId, authorId: ctx.user.id, authorName: ctx.user.name, body: d.body, internal: d.internal === "on" });
    revalidateApp();
    return { ok: true, message: "Commentaire ajouté." };
  });
}

/** Changement de statut générique (remboursements, besoins, demandes Cité Royale, dépôts). */
export async function transitionAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({ entityType: z.string(), entityId: z.string(), to: z.string(), comment: z.string().trim().max(2000).optional() }).parse(Object.fromEntries(fd));
    const table = ENTITY_TABLE[d.entityType];
    if (!table) throw new ForbiddenError();
    const row = await adminGet<{ $id: string; $createdAt: string; $updatedAt: string; churchId: string; status: string; reference?: string; requesterEmail?: string | null; trackingToken?: string; title?: string; reason?: string }>(table, d.entityId);
    if (!row) throw new UserError("Élément introuvable.");
    const t = allowedTransitions(d.entityType, row.status).find((x) => x.to === d.to);
    if (!t || !canTransition(d.entityType, row.status, d.to)) throw new UserError("Ce changement de statut n'est pas possible.");
    // La validation « église mère » d'une demande Cité Royale est réservée à l'église mère
    if (d.entityType === "cr_request" && row.status === "mother_review") {
      if (!ctx.isRegional) throw new ForbiddenError("Réservé à l'église mère.");
    } else if (!canManage(ctx, row.churchId)) throw new ForbiddenError();
    if (t.comment === "required" && !d.comment) throw new UserError("Un commentaire est obligatoire pour ce choix.");
    const extra: Record<string, unknown> = { status: d.to };
    if (d.entityType === "cr_request") extra.statusChangedAt = new Date().toISOString();
    if (d.entityType === "reimbursement" && d.to === "rejected") extra.rejectReason = d.comment;
    if (d.entityType === "funding_request" && ["rejected", "partially_approved", "approved"].includes(d.to)) extra.decisionComment = d.comment ?? null;
    if (d.entityType === "deposit" && d.to === "deposited") {
      const { markDeposited } = await import("../deposits");
      await markDeposited(ctx, d.entityId);
    }
    await patch(table, d.entityId, extra);
    await recordStatus({ id: ctx.user.id, name: ctx.user.name }, row.churchId, d.entityType, d.entityId, row.status, d.to, d.comment ?? null);
    await audit(ctx, row.churchId, "status", d.entityType, d.entityId, `${row.reference ?? ""} : ${statusDef(d.entityType, row.status).label} → ${statusDef(d.entityType, d.to).label}`, { status: row.status }, extra);
    if (row.trackingToken) {
      const label = statusDef(d.entityType, d.to).label;
      await notifyRequester(row.requesterEmail, `Votre demande ${row.reference} : ${label}`, label, `Le statut de votre demande « ${row.title ?? row.reason ?? ""} » a changé : <b>${label}</b>.${d.comment ? `<br/>Commentaire : ${d.comment}` : ""}`, row.trackingToken);
    }
    revalidateApp();
    return { ok: true, message: `Statut : ${statusDef(d.entityType, d.to).label}.` };
  });
}

export async function markNotificationsReadAction(): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const { adminList } = await import("../data");
    const { Query } = await import("node-appwrite");
    const rows = await adminList("notifications", [Query.equal("userId", ctx.user.id), Query.isNull("readAt")]);
    const now = new Date().toISOString();
    for (const r of rows) await patch("notifications", r.$id, { readAt: now });
    revalidateApp();
    return { ok: true, message: "Notifications marquées comme lues." };
  });
}
