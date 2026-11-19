"use server";
import { z } from "zod";
import { ID, Query } from "node-appwrite";
import { adminClient, DATABASE_ID } from "@/lib/appwrite/server";
import { requireContext, assertManage, ForbiddenError } from "../context";
import { run, UserError } from "../action";
import {
  insert, patch, remove, audit, recordStatus, churchReference, assertNotLocked, permsFor, adminGet, adminList, revalidateApp,
} from "../data";
import { getLookups } from "../lookups";
import { movementsForOfferingLine, sessionTotals } from "@/lib/finance";
import { PAYMENT_METHODS } from "@/lib/schema";
import { dateInputToIso } from "@/lib/format";
import type { ActionResult } from "@/lib/action-types";
import type { OfferingLine, OfferingSession, Donor } from "@/lib/types";

const lineSchema = z.object({
  donationTypeId: z.string().min(1, "Choisissez un type de don."),
  amountCents: z.number().int().positive("Montant invalide."),
  method: z.enum(PAYMENT_METHODS),
  anonymous: z.boolean(),
  donorId: z.string().nullable().optional(),
  donorName: z.string().trim().max(160).nullable().optional(),
  chequeRef: z.string().trim().max(60).nullable().optional(),
  bankAccountId: z.string().nullable().optional(),
});

const sessionSchema = z.object({
  id: z.string().nullable().optional(),
  churchId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  serviceId: z.string().nullable().optional(),
  counter1Name: z.string().trim().max(120).nullable().optional(),
  counter2Name: z.string().trim().max(120).nullable().optional(),
  countedCashCents: z.number().int().min(0),
  countedChequeCents: z.number().int().min(0),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(lineSchema).min(1, "Ajoutez au moins une ligne."),
  validate: z.boolean(),
});

export type SessionPayload = z.input<typeof sessionSchema>;

export async function saveOfferingSessionAction(payload: SessionPayload): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = sessionSchema.parse(payload);
    assertManage(ctx, d.churchId);
    const date = dateInputToIso(d.date);
    await assertNotLocked(ctx, d.churchId, date);
    if (d.validate) {
      if (!d.counter1Name || !d.counter2Name) throw new UserError("Le comptage sécurisé exige le nom des deux compteurs.");
      if (d.counter1Name.trim().toLowerCase() === d.counter2Name.trim().toLowerCase()) throw new UserError("Les deux compteurs doivent être deux personnes différentes.");
    }
    const lk = await getLookups(d.churchId);
    const types = new Map(lk.donationTypes.map((t) => [t.$id, t.name]));
    const service = lk.services.find((s) => s.$id === d.serviceId);
    const defaultBank = lk.bankAccounts.find((b) => b.churchId === d.churchId)?.$id ?? null;
    for (const l of d.lines) {
      if (!types.has(l.donationTypeId)) throw new UserError("Type de don inconnu.");
      if (!["cash", "cheque"].includes(l.method) && !(l.bankAccountId || defaultBank)) throw new UserError("Ajoutez un compte bancaire (Administration) pour enregistrer des dons par virement ou carte.");
      if (!l.anonymous && !l.donorId && !l.donorName) throw new UserError("Indiquez le nom du donateur ou cochez « anonyme ».");
    }

    let before: OfferingSession | null = null;
    if (d.id) {
      before = await adminGet<OfferingSession>("offering_sessions", d.id);
      if (!before || before.churchId !== d.churchId) throw new ForbiddenError();
      if (before.status === "validated") throw new UserError("Cette séance est verrouillée. Un administrateur doit la déverrouiller pour la modifier.");
    }

    // Donateurs nominatifs créés à la volée
    const donorIds = new Map<string, string>();
    for (const l of d.lines) {
      if (!l.anonymous && !l.donorId && l.donorName) {
        const key = l.donorName.toLowerCase();
        if (!donorIds.has(key)) {
          const donor = await insert<Donor>("donors", d.churchId, { fullName: l.donorName, consentAt: new Date().toISOString(), createdBy: ctx.user.id });
          donorIds.set(key, donor.$id);
        }
      }
    }

    const totals = sessionTotals(d.lines, d.countedCashCents, d.countedChequeCents);
    const sessionData = {
      date, serviceId: service?.$id ?? null, serviceName: service?.name ?? null, counter1Name: d.counter1Name ?? null, counter2Name: d.counter2Name ?? null,
      countedCashCents: d.countedCashCents, countedChequeCents: d.countedChequeCents, enteredTotalCents: totals.entered, gapCents: totals.gap, notes: d.notes ?? null,
      status: d.validate ? "validated" : "draft", lockedAt: d.validate ? new Date().toISOString() : null, lockedBy: d.validate ? ctx.user.id : null,
    };

    let sessionId = d.id ?? null;
    if (sessionId) {
      await patch("offering_sessions", sessionId, sessionData);
      const old = await adminList<OfferingLine>("offering_lines", [Query.equal("sessionId", sessionId)]);
      for (const o of old) await remove("offering_lines", o.$id);
    } else {
      const reference = await churchReference(d.churchId, "OFF", new Date(date));
      const s = await insert<OfferingSession>("offering_sessions", d.churchId, { ...sessionData, reference, createdBy: ctx.user.id });
      sessionId = s.$id;
      await recordStatus({ id: ctx.user.id, name: ctx.user.name }, d.churchId, "offering_session", sessionId, null, "draft");
    }

    const perms = await permsFor(d.churchId);
    const lineRows = d.lines.map((l) => ({
      $id: ID.unique(), $permissions: perms, churchId: d.churchId, sessionId, date, donationTypeId: l.donationTypeId, donationTypeName: types.get(l.donationTypeId),
      donorId: l.anonymous ? null : l.donorId ?? donorIds.get((l.donorName ?? "").toLowerCase()) ?? null, donorName: l.anonymous ? null : l.donorName ?? null,
      anonymous: l.anonymous, amountCents: l.amountCents, method: l.method, chequeRef: l.method === "cheque" ? l.chequeRef ?? null : null,
      bankAccountId: ["cash", "cheque"].includes(l.method) ? null : l.bankAccountId ?? defaultBank, createdBy: ctx.user.id, archived: false,
    }));
    const { db } = adminClient();
    await db.createRows({ databaseId: DATABASE_ID, tableId: "offering_lines", rows: lineRows });

    if (d.validate) {
      const movements = lineRows.flatMap((l) =>
        movementsForOfferingLine({ $id: l.$id, date, amountCents: l.amountCents, method: l.method, bankAccountId: l.bankAccountId, donationTypeName: l.donationTypeName }, defaultBank),
      );
      if (movements.length) {
        await db.createRows({
          databaseId: DATABASE_ID, tableId: "cash_movements",
          rows: movements.map((m) => ({ $id: ID.unique(), $permissions: perms, churchId: d.churchId, ...m, sourceId: m.sourceId ?? null, category: m.category ?? null, createdBy: ctx.user.id, archived: false })),
        });
      }
      await recordStatus({ id: ctx.user.id, name: ctx.user.name }, d.churchId, "offering_session", sessionId, "draft", "validated", totals.gap ? `Écart de comptage : ${(totals.gap / 100).toFixed(2)} €` : null);
    }
    await audit(ctx, d.churchId, d.validate ? "validate" : d.id ? "update" : "create", "offering_session", sessionId, `Séance d'offrandes ${d.validate ? "validée" : "enregistrée"} (${(totals.entered / 100).toFixed(2)} €)`, before, { ...sessionData, lines: d.lines.length });
    revalidateApp();
    return { ok: true, message: d.validate ? "Séance validée et verrouillée." : "Brouillon enregistré.", redirect: `/app/offrandes/${sessionId}` };
  });
}

/** Déverrouillage (admin uniquement, tracé) : retire les écritures de caisse/banque de la séance. */
export async function unlockOfferingSessionAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    if (!ctx.isRegional) throw new ForbiddenError("Seul un administrateur peut déverrouiller une séance validée.");
    const id = String(fd.get("id"));
    const reason = z.string().trim().min(3, "Indiquez le motif du déverrouillage.").parse(fd.get("reason"));
    const s = await adminGet<OfferingSession>("offering_sessions", id);
    if (!s) throw new UserError("Séance introuvable.");
    const lines = await adminList<OfferingLine>("offering_lines", [Query.equal("sessionId", id)]);
    if (lines.some((l) => l.depositId)) throw new UserError("Une partie de cette séance a déjà été déposée en banque : annulez d'abord le dépôt.");
    for (const l of lines) {
      const ms = await adminList("cash_movements", [Query.equal("sourceType", "offering_line"), Query.equal("sourceId", l.$id)]);
      for (const m of ms) await remove("cash_movements", m.$id);
    }
    await patch("offering_sessions", id, { status: "draft", lockedAt: null, lockedBy: null });
    await recordStatus({ id: ctx.user.id, name: ctx.user.name }, s.churchId, "offering_session", id, "validated", "draft", `Déverrouillée : ${reason}`);
    await audit(ctx, s.churchId, "unlock", "offering_session", id, `Séance ${s.reference} déverrouillée — ${reason}`, s, null);
    revalidateApp();
    return { ok: true, message: "Séance déverrouillée." };
  });
}

export async function deleteOfferingSessionAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const id = String(fd.get("id"));
    const s = await adminGet<OfferingSession>("offering_sessions", id);
    if (!s) throw new UserError("Séance introuvable.");
    assertManage(ctx, s.churchId);
    if (s.status === "validated") throw new UserError("Une séance validée ne peut pas être supprimée.");
    const lines = await adminList<OfferingLine>("offering_lines", [Query.equal("sessionId", id)]);
    for (const l of lines) await remove("offering_lines", l.$id);
    await remove("offering_sessions", id);
    await audit(ctx, s.churchId, "delete", "offering_session", id, `Brouillon ${s.reference} supprimé`, s, null);
    revalidateApp();
    return { ok: true, message: "Brouillon supprimé.", redirect: "/app/offrandes" };
  });
}

// ---------------- Donateurs ----------------
export async function saveDonorAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({
      id: z.string().optional(), churchId: z.string().min(1), fullName: z.string().trim().min(2, "Nom requis.").max(160),
      email: z.union([z.literal(""), z.string().trim().email("Email invalide.")]).optional(), phone: z.string().trim().max(40).optional(), address: z.string().trim().max(400).optional(),
    }).parse(Object.fromEntries(fd));
    assertManage(ctx, d.churchId);
    const data = { fullName: d.fullName, email: d.email || null, phone: d.phone || null, address: d.address || null };
    if (d.id) await patch("donors", d.id, data);
    else await insert("donors", d.churchId, { ...data, consentAt: new Date().toISOString(), createdBy: ctx.user.id });
    await audit(ctx, d.churchId, d.id ? "update" : "create", "donor", d.id ?? null, `Fiche donateur : ${d.fullName}`);
    revalidateApp();
    return { ok: true, message: "Fiche enregistrée." };
  });
}

/** RGPD : anonymisation — le nom est effacé, les montants restent pour la comptabilité. */
export async function anonymizeDonorAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const id = String(fd.get("id"));
    const donor = await adminGet<Donor>("donors", id);
    if (!donor) throw new UserError("Donateur introuvable.");
    assertManage(ctx, donor.churchId);
    await patch("donors", id, { fullName: "Donateur anonymisé", email: null, phone: null, address: null, anonymizedAt: new Date().toISOString() });
    const lines = await adminList<OfferingLine>("offering_lines", [Query.equal("donorId", id)]);
    for (const l of lines) await patch("offering_lines", l.$id, { donorName: null, anonymous: true, donorId: null });
    await audit(ctx, donor.churchId, "anonymize", "donor", id, "Donateur anonymisé (RGPD)");
    revalidateApp();
    return { ok: true, message: "Donateur anonymisé.", redirect: "/app/donateurs" };
  });
}
