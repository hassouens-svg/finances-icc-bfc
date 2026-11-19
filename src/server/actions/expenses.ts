"use server";
import { z } from "zod";
import { requireContext, assertManage, canApproveAs, ForbiddenError, type AppContext } from "../context";
import { run, UserError, formToObject } from "../action";
import { insert, patch, audit, recordStatus, churchReference, assertNotLocked, adminGet, revalidateApp, churchById } from "../data";
import { getLookups } from "../lookups";
import { saveFiles } from "../files";
import { notifyUsers, usersWithRoles, notifyRequester } from "../notify";
import { notifyApprovers } from "../expenses";
import { decide, currentRole } from "@/lib/workflow";
import { zText, zCents, zDate, zId, zOptText, zBool } from "@/lib/zod";
import { EXPENSE_PAY_METHODS } from "@/lib/schema";
import { formatEuro } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/status";
import type { ActionResult } from "@/lib/action-types";
import { submitExpenseInternal, payExpenseInternal } from "../expenses";
import type { Expense, Reimbursement, FundingRequest, Project } from "@/lib/types";

const expenseSchema = z.object({
  id: zId(), churchId: z.string().min(1), title: zText("Le titre", 200), categoryId: z.string().min(1, "Choisissez une catégorie."), supplier: zOptText(160),
  amount: zCents(), date: zDate(), paymentMethod: z.enum(EXPENSE_PAY_METHODS), bankAccountId: zId(), departmentId: zId(), projectId: zId(),
  isRegularization: zBool(), advancedBy: zOptText(160), regularizationReason: zOptText(2000), notes: zOptText(2000), submitNow: zBool(),
});

export async function saveExpenseAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = expenseSchema.parse(formToObject(fd));
    assertManage(ctx, d.churchId);
    await assertNotLocked(ctx, d.churchId, d.date);
    if (d.isRegularization && !d.regularizationReason) throw new UserError("Le motif de la régularisation est obligatoire.");
    if (d.paymentMethod !== "cash" && !d.bankAccountId) throw new UserError("Choisissez le compte bancaire utilisé.");
    const lk = await getLookups(d.churchId);
    const cat = lk.categories.find((c) => c.$id === d.categoryId);
    const data = {
      title: d.title, categoryId: d.categoryId, categoryName: cat?.name ?? null, supplier: d.supplier, amountCents: d.amount, date: d.date, paymentMethod: d.paymentMethod,
      bankAccountId: d.paymentMethod === "cash" ? null : d.bankAccountId, departmentId: d.departmentId, projectId: d.projectId, isRegularization: d.isRegularization,
      advancedBy: d.advancedBy, regularizationReason: d.regularizationReason, notes: d.notes,
    };
    let e: Expense;
    if (d.id) {
      const before = await adminGet<Expense>("expenses", d.id);
      if (!before || before.churchId !== d.churchId) throw new ForbiddenError();
      if (!["draft", "rejected"].includes(before.status) && !(before.status === "in_approval")) throw new UserError("Cette dépense ne peut plus être modifiée.");
      const resetCircuit = before.status !== "draft";
      e = await patch<Expense>("expenses", d.id, { ...data, ...(resetCircuit ? { status: "draft", currentStep: 0 } : {}) });
      await audit(ctx, d.churchId, "update", "expense", d.id, `Dépense ${before.reference} modifiée`, before, data);
      if (resetCircuit) await recordStatus({ id: ctx.user.id, name: ctx.user.name }, d.churchId, "expense", d.id, before.status, "draft", "Modifiée : le circuit de validation recommence.");
    } else {
      const reference = await churchReference(d.churchId, "DEP", new Date(d.date));
      e = await insert<Expense>("expenses", d.churchId, { ...data, reference, status: "draft", currentStep: 0, totalSteps: 0, stepRoles: [], source: "manual", createdBy: ctx.user.id });
      await recordStatus({ id: ctx.user.id, name: ctx.user.name }, d.churchId, "expense", e.$id, null, "draft", d.isRegularization ? `Régularisation : ${d.regularizationReason}` : null);
      await audit(ctx, d.churchId, "create", "expense", e.$id, `Dépense ${reference} : ${d.title} (${formatEuro(d.amount)})`, null, data);
    }
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length) await saveFiles(files, d.churchId, "expense", e.$id, ctx.user.name);
    if (d.submitNow) await submitExpenseInternal(ctx, { ...e, status: "draft" });
    revalidateApp();
    return { ok: true, message: d.submitNow ? "Dépense soumise à validation." : "Dépense enregistrée.", redirect: `/app/depenses/${e.$id}` };
  });
}

export async function submitExpenseAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const e = await adminGet<Expense>("expenses", String(fd.get("id")));
    if (!e) throw new UserError("Dépense introuvable.");
    assertManage(ctx, e.churchId);
    if (!["draft", "rejected"].includes(e.status)) throw new UserError("Cette dépense est déjà soumise.");
    await submitExpenseInternal(ctx, e);
    await audit(ctx, e.churchId, "status", "expense", e.$id, `Dépense ${e.reference} soumise à validation`);
    revalidateApp();
    return { ok: true, message: "Dépense soumise à validation." };
  });
}

export async function decideExpenseAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({ id: z.string(), decision: z.enum(["approved", "rejected", "info_requested"]), comment: z.string().trim().max(2000).optional() }).parse(Object.fromEntries(fd));
    const e = await adminGet<Expense>("expenses", d.id);
    if (!e) throw new UserError("Dépense introuvable.");
    const role = currentRole(e);
    if (!role) throw new UserError("Cette dépense n'attend pas de validation.");
    if (!canApproveAs(ctx, e.churchId, role)) throw new ForbiddenError(`Cette étape doit être validée par : ${ROLE_LABELS[role]}.`);
    if (d.decision !== "approved" && !d.comment) throw new UserError("Un commentaire est obligatoire pour refuser ou demander une précision.");
    const next = decide(e, d.decision);
    await insert("approvals", e.churchId, { expenseId: e.$id, stepOrder: e.currentStep, role, decision: d.decision, userId: ctx.user.id, userName: ctx.user.name, comment: d.comment ?? null });
    await patch("expenses", e.$id, { status: next.status, currentStep: next.currentStep, stepStartedAt: new Date().toISOString() });
    const label = d.decision === "approved" ? (next.status === "approved" ? "approved" : "in_approval") : d.decision === "rejected" ? "rejected" : "in_approval";
    await recordStatus({ id: ctx.user.id, name: ctx.user.name }, e.churchId, "expense", e.$id, e.status, label,
      `${ROLE_LABELS[role]} — ${d.decision === "approved" ? `étape ${e.currentStep}/${e.totalSteps} approuvée` : d.decision === "rejected" ? "refus" : "demande de précision"}${d.comment ? ` : ${d.comment}` : ""}`);
    await audit(ctx, e.churchId, d.decision === "approved" ? "approve" : d.decision === "rejected" ? "reject" : "update", "expense", e.$id, `Dépense ${e.reference} : ${d.decision} (étape ${e.currentStep}, ${ROLE_LABELS[role]})`);
    const church = await churchById(e.churchId);
    if (next.status === "in_approval" && d.decision === "approved") await notifyApprovers({ ...e, ...next });
    else {
      const owners = await usersWithRoles(church.teamId, ["treasurer"]);
      const msg = next.status === "approved" ? "approuvée — elle peut être payée" : d.decision === "rejected" ? "refusée" : "en attente d'une précision";
      await notifyUsers(owners, e.churchId, { kind: "expense", title: `Dépense ${e.reference} ${msg}`, body: d.comment, link: `/app/depenses/${e.$id}` });
    }
    // Remboursement lié : la validation de la dépense valide le remboursement
    if (e.source === "reimbursement" && e.sourceId && next.status === "rejected") {
      await patch("reimbursements", e.sourceId, { status: "rejected", rejectReason: d.comment });
    }
    revalidateApp();
    return { ok: true, message: d.decision === "approved" ? (next.status === "approved" ? "Dépense approuvée : circuit terminé." : "Étape approuvée.") : d.decision === "rejected" ? "Dépense refusée." : "Précision demandée." };
  });
}

export async function payExpenseAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({ id: z.string(), paidAt: zDate("La date de paiement"), bankAccountId: zId() }).parse(Object.fromEntries(fd));
    const e = await adminGet<Expense>("expenses", d.id);
    if (!e) throw new UserError("Dépense introuvable.");
    assertManage(ctx, e.churchId);
    await assertNotLocked(ctx, e.churchId, d.paidAt);
    await payExpenseInternal(ctx, e, d.paidAt, d.bankAccountId);
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length) await saveFiles(files, e.churchId, "expense", e.$id, ctx.user.name);
    await audit(ctx, e.churchId, "pay", "expense", e.$id, `Dépense ${e.reference} payée (${formatEuro(e.amountCents)})`);
    revalidateApp();
    return { ok: true, message: "Dépense marquée payée." };
  });
}

export async function deleteExpenseAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const e = await adminGet<Expense>("expenses", String(fd.get("id")));
    if (!e) throw new UserError("Dépense introuvable.");
    assertManage(ctx, e.churchId);
    if (e.status !== "draft") throw new UserError("Seul un brouillon peut être supprimé.");
    await patch("expenses", e.$id, { archived: true });
    await audit(ctx, e.churchId, "delete", "expense", e.$id, `Brouillon ${e.reference} supprimé`, e, null);
    revalidateApp();
    return { ok: true, message: "Brouillon supprimé.", redirect: "/app/depenses" };
  });
}

// ---------------- Remboursements ----------------
/** Validation d'un remboursement : crée la dépense liée et l'engage dans le circuit. */
export async function approveReimbursementAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({ id: z.string(), categoryId: z.string().min(1, "Choisissez une catégorie."), comment: z.string().trim().max(2000).optional() }).parse(Object.fromEntries(fd));
    const r = await adminGet<Reimbursement>("reimbursements", d.id);
    if (!r) throw new UserError("Demande introuvable.");
    assertManage(ctx, r.churchId);
    if (!["submitted", "checking"].includes(r.status)) throw new UserError("Cette demande a déjà été traitée.");
    const lk = await getLookups(r.churchId);
    const cat = lk.categories.find((c) => c.$id === d.categoryId);
    const date = r.expenseDate ?? new Date().toISOString();
    const reference = await churchReference(r.churchId, "DEP", new Date(date));
    const e = await insert<Expense>("expenses", r.churchId, {
      reference, title: `Remboursement — ${r.reason ?? r.requesterName}`.slice(0, 200), categoryId: d.categoryId, categoryName: cat?.name ?? null, supplier: r.requesterName,
      amountCents: r.amountCents, date, paymentMethod: r.wishedMethod === "cash" ? "cash" : "bank_transfer", bankAccountId: r.wishedMethod === "cash" ? null : lk.bankAccounts[0]?.$id ?? null,
      departmentId: r.departmentId, status: "draft", currentStep: 0, totalSteps: 0, stepRoles: [], isRegularization: true, advancedBy: r.requesterName,
      regularizationReason: `Avance remboursée à ${r.requesterName} (${r.reference})`, source: "reimbursement", sourceId: r.$id, createdBy: ctx.user.id,
    });
    await recordStatus({ id: ctx.user.id, name: ctx.user.name }, r.churchId, "expense", e.$id, null, "draft", `Créée depuis le remboursement ${r.reference}`);
    // Les justificatifs du remboursement sont rattachés aussi à la dépense
    const { getAttachments } = await import("../entity");
    for (const a of await getAttachments("reimbursement", r.$id)) {
      await insert("attachments", r.churchId, { entityType: "expense", entityId: e.$id, fileId: a.fileId, bucket: a.bucket, name: a.name, mime: a.mime, size: a.size, uploadedBy: a.uploadedBy });
    }
    await submitExpenseInternal(ctx, e);
    await patch("reimbursements", r.$id, { status: "approved", expenseId: e.$id });
    await recordStatus({ id: ctx.user.id, name: ctx.user.name }, r.churchId, "reimbursement", r.$id, r.status, "approved", d.comment ?? null);
    await audit(ctx, r.churchId, "approve", "reimbursement", r.$id, `Remboursement ${r.reference} validé → dépense ${reference}`);
    await notifyRequester(r.requesterEmail, `Votre demande ${r.reference} est validée`, "Validée", "Votre demande de remboursement a été validée. Le paiement sera effectué prochainement.", r.trackingToken);
    revalidateApp();
    return { ok: true, message: "Remboursement validé : la dépense liée suit son circuit." };
  });
}

export async function payReimbursementAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({ id: z.string(), paidAt: zDate("La date"), paidMethod: z.enum(["transfer", "cash", "cheque"]), payeeBankInfo: z.string().trim().max(200).optional() }).parse(Object.fromEntries(fd));
    const r = await adminGet<Reimbursement>("reimbursements", d.id);
    if (!r || !r.expenseId) throw new UserError("Demande introuvable ou non validée.");
    assertManage(ctx, r.churchId);
    const e = await adminGet<Expense>("expenses", r.expenseId);
    if (!e) throw new UserError("Dépense liée introuvable.");
    if (e.status !== "approved") throw new UserError("La dépense liée n'a pas terminé son circuit de validation : remboursement impossible pour l'instant.");
    if (d.paidMethod === "cash" && e.paymentMethod !== "cash") await patch("expenses", e.$id, { paymentMethod: "cash", bankAccountId: null });
    await payExpenseInternal(ctx, { ...e, paymentMethod: d.paidMethod === "cash" ? "cash" : e.paymentMethod }, d.paidAt);
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    const proof = files.length ? await saveFiles(files, r.churchId, "reimbursement", r.$id, ctx.user.name) : [];
    const { encrypt } = await import("../crypto");
    await patch("reimbursements", r.$id, { status: "paid", paidAt: d.paidAt, paidMethod: d.paidMethod, paidProofFileId: proof[0] ?? null, payeeBankInfo: d.payeeBankInfo ? encrypt(d.payeeBankInfo) : null });
    await recordStatus({ id: ctx.user.id, name: ctx.user.name }, r.churchId, "reimbursement", r.$id, r.status, "paid");
    await audit(ctx, r.churchId, "pay", "reimbursement", r.$id, `Remboursement ${r.reference} payé (${formatEuro(r.amountCents)})`);
    await notifyRequester(r.requesterEmail, `Votre remboursement ${r.reference} a été effectué`, "Remboursée", `Le remboursement de ${formatEuro(r.amountCents)} a été effectué.`, r.trackingToken);
    revalidateApp();
    return { ok: true, message: "Remboursement effectué : la dépense est payée." };
  });
}

// ---------------- Besoins : approbation et conversion ----------------
export async function decideFundingAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({ id: z.string(), decision: z.enum(["approved", "partially_approved"]), approved: zCents("Le montant approuvé"), comment: z.string().trim().max(2000).optional() }).parse(Object.fromEntries(fd));
    const f = await adminGet<FundingRequest>("funding_requests", d.id);
    if (!f) throw new UserError("Besoin introuvable.");
    assertManage(ctx, f.churchId);
    if (!["received", "reviewing"].includes(f.status)) throw new UserError("Ce besoin a déjà été traité.");
    const decision = d.approved < f.estimatedCents ? "partially_approved" : d.decision;
    if (decision === "partially_approved" && !d.comment) throw new UserError("Expliquez l'approbation partielle en commentaire.");
    await patch("funding_requests", f.$id, { status: decision, approvedCents: d.approved, decisionComment: d.comment ?? null });
    await recordStatus({ id: ctx.user.id, name: ctx.user.name }, f.churchId, "funding_request", f.$id, f.status, decision, `${formatEuro(d.approved)} approuvés${d.comment ? ` — ${d.comment}` : ""}`);
    await audit(ctx, f.churchId, "approve", "funding_request", f.$id, `Besoin ${f.reference} approuvé (${formatEuro(d.approved)})`);
    await notifyRequester(f.requesterEmail, `Votre besoin ${f.reference} est approuvé`, decision === "approved" ? "Approuvé" : "Approuvé partiellement", `Montant approuvé : <b>${formatEuro(d.approved)}</b>.${d.comment ? `<br/>${d.comment}` : ""}`, f.trackingToken);
    revalidateApp();
    return { ok: true, message: "Besoin approuvé." };
  });
}

export async function convertFundingAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({ id: z.string(), target: z.enum(["expense", "cr"]), categoryId: z.string().optional() }).parse(Object.fromEntries(fd));
    const f = await adminGet<FundingRequest>("funding_requests", d.id);
    if (!f) throw new UserError("Besoin introuvable.");
    assertManage(ctx, f.churchId);
    if (!["approved", "partially_approved"].includes(f.status)) throw new UserError("Seul un besoin approuvé peut être converti.");
    if (f.convertedToId) throw new UserError("Ce besoin a déjà été converti.");
    const amount = f.approvedCents ?? f.estimatedCents;
    let target: string;
    if (d.target === "expense") {
      const lk = await getLookups(f.churchId);
      const cat = lk.categories.find((c) => c.$id === d.categoryId) ?? lk.categories[0];
      const reference = await churchReference(f.churchId, "DEP");
      const e = await insert<Expense>("expenses", f.churchId, {
        reference, title: f.title, categoryId: cat?.$id ?? null, categoryName: cat?.name ?? null, amountCents: amount, date: new Date().toISOString(), paymentMethod: "bank_transfer",
        bankAccountId: lk.bankAccounts[0]?.$id ?? null, departmentId: f.departmentId, status: "draft", currentStep: 0, totalSteps: 0, stepRoles: [], isRegularization: false,
        source: "funding", sourceId: f.$id, notes: f.description, createdBy: ctx.user.id,
      });
      await recordStatus({ id: ctx.user.id, name: ctx.user.name }, f.churchId, "expense", e.$id, null, "draft", `Créée depuis le besoin ${f.reference}`);
      target = `/app/depenses/${e.$id}`;
      await patch("funding_requests", f.$id, { convertedToType: "expense", convertedToId: e.$id });
    } else {
      const church = await churchById(f.churchId);
      const reference = await churchReference(f.churchId, "CR");
      const status = church.isMother ? "draft" : "mother_review";
      const cr = await insert("cr_requests", f.churchId, {
        reference, title: f.title, description: f.description, estimatedCents: amount, priority: f.priority, wishedDate: f.wishedDate, departmentId: f.departmentId,
        contactName: ctx.user.name, status, viaMother: !church.isMother, statusChangedAt: new Date().toISOString(), sourceFundingId: f.$id, createdBy: ctx.user.id,
      });
      await recordStatus({ id: ctx.user.id, name: ctx.user.name }, f.churchId, "cr_request", cr.$id, null, status, `Créée depuis le besoin ${f.reference}`);
      target = `/app/cite-royale/${cr.$id}`;
      await patch("funding_requests", f.$id, { convertedToType: "cr", convertedToId: cr.$id });
    }
    await audit(ctx, f.churchId, "create", "funding_request", f.$id, `Besoin ${f.reference} converti en ${d.target === "expense" ? "dépense" : "demande Cité Royale"}`);
    revalidateApp();
    return { ok: true, message: "Conversion effectuée.", redirect: target };
  });
}

// ---------------- Projets ----------------
export async function saveProjectAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({
      id: zId(), churchId: z.string().min(1), name: zText("Le nom", 160), description: zOptText(2000), budget: zCents("Le budget", { allowZero: true }),
      startDate: z.string().optional(), endDate: z.string().optional(), ownerName: zOptText(160), status: z.enum(["planned", "active", "done", "cancelled"]).default("active"),
      milestones: z.string().optional(),
    }).parse(formToObject(fd));
    assertManage(ctx, d.churchId);
    const ms = (d.milestones ?? "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => ({ label: l.replace(/^\[x\]\s*/i, ""), done: /^\[x\]/i.test(l) }));
    const data = {
      name: d.name, description: d.description, budgetCents: d.budget, startDate: d.startDate ? new Date(`${d.startDate}T12:00:00Z`).toISOString() : null,
      endDate: d.endDate ? new Date(`${d.endDate}T12:00:00Z`).toISOString() : null, ownerName: d.ownerName, status: d.status, milestonesJson: JSON.stringify(ms),
    };
    let id = d.id;
    if (id) await patch<Project>("projects", id, data);
    else id = (await insert<Project>("projects", d.churchId, { ...data, createdBy: ctx.user.id })).$id;
    await audit(ctx, d.churchId, d.id ? "update" : "create", "project", id, `Projet : ${d.name}`, null, data);
    revalidateApp();
    return { ok: true, message: "Projet enregistré.", redirect: `/app/projets/${id}` };
  });
}

