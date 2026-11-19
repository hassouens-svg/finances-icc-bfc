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

// ======================================================================
// Saisie « enveloppe par enveloppe » : chaque ligne est enregistrée immédiatement.
// ======================================================================

async function draftSession(ctx: Awaited<ReturnType<typeof requireContext>>, sessionId: string) {
  const s = await adminGet<OfferingSession>("offering_sessions", sessionId);
  if (!s) throw new UserError("Séance introuvable.");
  assertManage(ctx, s.churchId);
  if (s.status !== "draft") throw new UserError("Cette séance est validée et verrouillée.");
  await assertNotLocked(ctx, s.churchId, s.date);
  return s;
}

/** Retrouve ou crée la fiche donateur (base des donateurs alimentée au fil de la saisie). */
async function resolveDonor(churchId: string, userId: string, donorId?: string | null, donorName?: string | null) {
  if (donorId) {
    const d = await adminGet<Donor>("donors", donorId);
    if (d && d.churchId === churchId && !d.anonymizedAt) return { id: d.$id, name: d.fullName, created: false };
  }
  const name = (donorName ?? "").trim().replace(/\s+/g, " ");
  if (!name) throw new UserError("Indiquez le nom du donateur ou choisissez « Anonyme ».");
  const existing = (await adminList<Donor>("donors", [Query.equal("churchId", churchId), Query.equal("fullName", name), Query.limit(1)]))[0];
  if (existing) return { id: existing.$id, name: existing.fullName, created: false };
  const d = await insert<Donor>("donors", churchId, { fullName: name, consentAt: new Date().toISOString(), createdBy: userId });
  return { id: d.$id, name: d.fullName, created: true };
}

export async function startSessionAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({ churchId: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."), serviceId: z.string().optional() }).parse(Object.fromEntries(fd));
    assertManage(ctx, d.churchId);
    const date = dateInputToIso(d.date);
    await assertNotLocked(ctx, d.churchId, date);
    const lk = await getLookups(d.churchId);
    const service = lk.services.find((x) => x.$id === d.serviceId);
    // Reprend le brouillon existant pour le même culte, au lieu d'en créer un doublon
    const existing = (await adminList<OfferingSession>("offering_sessions", [Query.equal("churchId", d.churchId), Query.equal("date", date), Query.equal("status", "draft")]))
      .find((x) => (x.serviceId ?? "") === (service?.$id ?? ""));
    if (existing) return { ok: true, message: "Reprise de la saisie en cours.", redirect: `/app/offrandes/${existing.$id}/saisie` };
    const reference = await churchReference(d.churchId, "OFF", new Date(date));
    const s = await insert<OfferingSession>("offering_sessions", d.churchId, {
      reference, date, serviceId: service?.$id ?? null, serviceName: service?.name ?? "Culte", status: "draft", enteredTotalCents: 0, countedCashCents: 0, countedChequeCents: 0, gapCents: 0, createdBy: ctx.user.id,
    });
    await recordStatus({ id: ctx.user.id, name: ctx.user.name }, d.churchId, "offering_session", s.$id, null, "draft");
    await audit(ctx, d.churchId, "create", "offering_session", s.$id, `Séance ${reference} ouverte`);
    revalidateApp();
    return { ok: true, redirect: `/app/offrandes/${s.$id}/saisie` };
  });
}

const entrySchema = z.object({
  donationTypeId: z.string().min(1, "Choisissez un type de don."),
  amountCents: z.number().int().positive("Montant invalide.").max(10_000_000_00),
  method: z.enum(PAYMENT_METHODS),
  anonymous: z.boolean(),
  donorId: z.string().nullable().optional(),
  donorName: z.string().trim().max(160).nullable().optional(),
  chequeRef: z.string().trim().max(60).nullable().optional(),
});
export type EntryInput = z.input<typeof entrySchema>;
export type SavedLine = { id: string; donationTypeId: string; donationTypeName: string; amountCents: number; method: string; anonymous: boolean; donorId: string | null; donorName: string | null; chequeRef: string | null };
type LineResult = { ok: true; line: SavedLine; newDonor?: { id: string; name: string } } | { ok: false; error: string };

async function lineData(ctx: Awaited<ReturnType<typeof requireContext>>, s: OfferingSession, e: z.infer<typeof entrySchema>) {
  const lk = await getLookups(s.churchId);
  const type = lk.donationTypes.find((t) => t.$id === e.donationTypeId);
  if (!type) throw new UserError("Type de don inconnu.");
  const defaultBank = lk.bankAccounts.find((b) => b.churchId === s.churchId)?.$id ?? null;
  if (!["cash", "cheque"].includes(e.method) && !defaultBank) throw new UserError("Ajoutez un compte bancaire (Administration) pour enregistrer des dons par virement ou carte.");
  const donor = e.anonymous ? null : await resolveDonor(s.churchId, ctx.user.id, e.donorId, e.donorName);
  return {
    donor,
    data: {
      sessionId: s.$id, date: s.date, donationTypeId: type.$id, donationTypeName: type.name, donorId: donor?.id ?? null, donorName: donor?.name ?? null, anonymous: e.anonymous,
      amountCents: e.amountCents, method: e.method, chequeRef: e.method === "cheque" ? e.chequeRef || null : null, bankAccountId: ["cash", "cheque"].includes(e.method) ? null : defaultBank,
    },
  };
}

const toSaved = (r: OfferingLine): SavedLine => ({ id: r.$id, donationTypeId: r.donationTypeId ?? "", donationTypeName: r.donationTypeName ?? "", amountCents: r.amountCents, method: r.method, anonymous: r.anonymous, donorId: r.donorId ?? null, donorName: r.donorName ?? null, chequeRef: r.chequeRef ?? null });

async function bumpTotal(sessionId: string, delta: number) {
  if (!delta) return;
  const { db } = adminClient();
  if (delta > 0) await db.incrementRowColumn({ databaseId: DATABASE_ID, tableId: "offering_sessions", rowId: sessionId, column: "enteredTotalCents", value: delta });
  else await db.decrementRowColumn({ databaseId: DATABASE_ID, tableId: "offering_sessions", rowId: sessionId, column: "enteredTotalCents", value: -delta });
}

/** Ajoute une enveloppe : enregistrée tout de suite, sans bouton « Enregistrer ». */
export async function addLineAction(sessionId: string, input: EntryInput): Promise<LineResult> {
  const r = await run(async () => {
    const ctx = await requireContext();
    const s = await draftSession(ctx, sessionId);
    const e = entrySchema.parse(input);
    const { donor, data } = await lineData(ctx, s, e);
    const row = await insert<OfferingLine>("offering_lines", s.churchId, { ...data, createdBy: ctx.user.id });
    await bumpTotal(s.$id, e.amountCents);
    return { ok: true, data: { line: toSaved(row), newDonor: donor?.created ? { id: donor.id, name: donor.name } : undefined } };
  });
  return r.ok ? ({ ok: true, ...(r.data as object) } as LineResult) : r;
}

/**
 * Ajout groupé : les enveloppes saisies pendant qu'un envoi est en cours partent ensemble (une seule écriture en masse).
 * Chaque enveloppe a son propre résultat (une erreur n'empêche pas les autres d'être enregistrées).
 */
export async function addLinesAction(sessionId: string, inputs: EntryInput[]): Promise<{ ok: true; results: ({ ok: true; line: SavedLine } | { ok: false; error: string })[]; newDonors: { id: string; name: string }[] } | { ok: false; error: string }> {
  const r = await run(async () => {
    const ctx = await requireContext();
    if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > 200) throw new UserError("Lot d'enveloppes invalide.");
    const s = await draftSession(ctx, sessionId);
    const lk = await getLookups(s.churchId);
    const defaultBank = lk.bankAccounts.find((b) => b.churchId === s.churchId)?.$id ?? null;
    const donorCache = new Map<string, { id: string; name: string; created: boolean }>();
    const newDonors: { id: string; name: string }[] = [];
    const perms = await permsFor(s.churchId);
    const results: ({ ok: true; line: SavedLine } | { ok: false; error: string })[] = [];
    const rows: Record<string, unknown>[] = [];
    for (const raw of inputs) {
      const parsed = entrySchema.safeParse(raw);
      if (!parsed.success) { results.push({ ok: false, error: parsed.error.issues[0]?.message ?? "Enveloppe invalide." }); continue; }
      const e = parsed.data;
      const type = lk.donationTypes.find((t) => t.$id === e.donationTypeId);
      if (!type) { results.push({ ok: false, error: "Type de don inconnu." }); continue; }
      if (!["cash", "cheque"].includes(e.method) && !defaultBank) { results.push({ ok: false, error: "Aucun compte bancaire pour les virements/cartes." }); continue; }
      let donor: { id: string; name: string; created: boolean } | null = null;
      if (!e.anonymous) {
        const key = e.donorId || (e.donorName ?? "").trim().toLowerCase();
        try {
          donor = donorCache.get(key) ?? (await resolveDonor(s.churchId, ctx.user.id, e.donorId, e.donorName));
        } catch (err) { results.push({ ok: false, error: (err as Error).message }); continue; }
        donorCache.set(key, donor);
        if (donor.created && !newDonors.some((d) => d.id === donor!.id)) newDonors.push({ id: donor.id, name: donor.name });
      }
      const id = ID.unique();
      const data = {
        sessionId: s.$id, date: s.date, donationTypeId: type.$id, donationTypeName: type.name, donorId: donor?.id ?? null, donorName: donor?.name ?? null, anonymous: e.anonymous,
        amountCents: e.amountCents, method: e.method, chequeRef: e.method === "cheque" ? e.chequeRef || null : null, bankAccountId: ["cash", "cheque"].includes(e.method) ? null : defaultBank,
      };
      rows.push({ $id: id, $permissions: perms, churchId: s.churchId, ...data, createdBy: ctx.user.id, archived: false });
      results.push({ ok: true, line: { id, donationTypeId: data.donationTypeId, donationTypeName: data.donationTypeName, amountCents: data.amountCents, method: data.method, anonymous: data.anonymous, donorId: data.donorId, donorName: data.donorName, chequeRef: data.chequeRef } });
    }
    if (rows.length) {
      await adminClient().db.createRows({ databaseId: DATABASE_ID, tableId: "offering_lines", rows });
      await bumpTotal(s.$id, rows.reduce((a, x) => a + Number(x.amountCents), 0));
    }
    return { ok: true, data: { results, newDonors } };
  });
  return r.ok ? { ok: true, ...(r.data as { results: never[]; newDonors: never[] }) } : r;
}

export async function updateLineAction(lineId: string, input: EntryInput): Promise<LineResult> {
  const r = await run(async () => {
    const ctx = await requireContext();
    const before = await adminGet<OfferingLine>("offering_lines", lineId);
    if (!before) throw new UserError("Ligne introuvable.");
    const s = await draftSession(ctx, before.sessionId);
    const e = entrySchema.parse(input);
    const { donor, data } = await lineData(ctx, s, e);
    const row = await patch<OfferingLine>("offering_lines", lineId, data);
    await bumpTotal(s.$id, e.amountCents - before.amountCents);
    await audit(ctx, s.churchId, "update", "offering_line", lineId, `Enveloppe modifiée (${s.reference})`, before, data);
    return { ok: true, data: { line: toSaved(row), newDonor: donor?.created ? { id: donor.id, name: donor.name } : undefined } };
  });
  return r.ok ? ({ ok: true, ...(r.data as object) } as LineResult) : r;
}

export async function deleteLineAction(lineId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const before = await adminGet<OfferingLine>("offering_lines", lineId);
    if (!before) return { ok: true };
    const s = await draftSession(ctx, before.sessionId);
    await remove("offering_lines", lineId);
    await bumpTotal(s.$id, -before.amountCents);
    await audit(ctx, s.churchId, "delete", "offering_line", lineId, `Enveloppe supprimée (${s.reference})`, before, null);
    return { ok: true };
  });
}

const metaSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  serviceId: z.string().nullable().optional(),
  counter1Name: z.string().trim().max(120).nullable().optional(),
  counter2Name: z.string().trim().max(120).nullable().optional(),
  countedCashCents: z.number().int().min(0).optional(),
  countedChequeCents: z.number().int().min(0).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type SessionMeta = z.input<typeof metaSchema>;

/** Enregistrement automatique de l'en-tête et du comptage. */
export async function saveSessionMetaAction(sessionId: string, input: SessionMeta): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const s = await draftSession(ctx, sessionId);
    const m = metaSchema.parse(input);
    const data: Record<string, unknown> = {};
    if (m.date) {
      data.date = dateInputToIso(m.date);
      await assertNotLocked(ctx, s.churchId, data.date as string);
      const lines = await adminList<OfferingLine>("offering_lines", [Query.equal("sessionId", s.$id)]);
      for (const l of lines) await patch("offering_lines", l.$id, { date: data.date });
    }
    if (m.serviceId !== undefined) {
      const lk = await getLookups(s.churchId);
      const sv = lk.services.find((x) => x.$id === m.serviceId);
      data.serviceId = sv?.$id ?? null;
      data.serviceName = sv?.name ?? "Culte";
    }
    for (const k of ["counter1Name", "counter2Name", "countedCashCents", "countedChequeCents", "notes"] as const) if (m[k] !== undefined) data[k] = m[k];
    if (Object.keys(data).length) await patch("offering_sessions", s.$id, data);
    return { ok: true };
  });
}

/** Clôture de la saisie : contrôle du comptage, écritures de caisse/banque, verrouillage. */
export async function validateSessionAction(sessionId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const s = await draftSession(ctx, sessionId);
    const lines = await adminList<OfferingLine>("offering_lines", [Query.equal("sessionId", s.$id)]);
    if (!lines.length) throw new UserError("Ajoutez au moins une enveloppe avant de valider.");
    if (!s.counter1Name || !s.counter2Name) throw new UserError("Le comptage sécurisé exige le nom des deux compteurs.");
    if (s.counter1Name.trim().toLowerCase() === s.counter2Name.trim().toLowerCase()) throw new UserError("Les deux compteurs doivent être deux personnes différentes.");
    const totals = sessionTotals(lines, s.countedCashCents, s.countedChequeCents);
    if (totals.cash + totals.cheque > 0 && s.countedCashCents + s.countedChequeCents === 0) throw new UserError("Renseignez le montant compté (espèces et chèques).");
    const lk = await getLookups(s.churchId);
    const defaultBank = lk.bankAccounts.find((b) => b.churchId === s.churchId)?.$id ?? null;
    const perms = await permsFor(s.churchId);
    const movements = lines.flatMap((l) => movementsForOfferingLine({ $id: l.$id, date: s.date, amountCents: l.amountCents, method: l.method, bankAccountId: l.bankAccountId, donationTypeName: l.donationTypeName }, defaultBank));
    if (movements.length) {
      await adminClient().db.createRows({
        databaseId: DATABASE_ID, tableId: "cash_movements",
        rows: movements.map((m) => ({ $id: ID.unique(), $permissions: perms, churchId: s.churchId, ...m, sourceId: m.sourceId ?? null, category: m.category ?? null, createdBy: ctx.user.id, archived: false })),
      });
    }
    await patch("offering_sessions", s.$id, { status: "validated", enteredTotalCents: totals.entered, gapCents: totals.gap, lockedAt: new Date().toISOString(), lockedBy: ctx.user.id });
    await recordStatus({ id: ctx.user.id, name: ctx.user.name }, s.churchId, "offering_session", s.$id, "draft", "validated", totals.gap ? `Écart de comptage : ${(totals.gap / 100).toFixed(2)} €` : null);
    await audit(ctx, s.churchId, "validate", "offering_session", s.$id, `Séance ${s.reference} validée : ${lines.length} enveloppe(s), ${(totals.entered / 100).toFixed(2)} €`);
    revalidateApp();
    return { ok: true, message: "Séance validée et verrouillée.", redirect: `/app/offrandes/${s.$id}` };
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
