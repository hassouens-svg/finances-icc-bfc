"use server";
import { requireContext } from "../context";
import { run, UserError } from "../action";

import { readXlsx, toSheet, parseCsv, type ParsedSheet } from "@/lib/sheet-read";
export type { ParsedSheet };
export type ParseResult = { ok: true; sheets: ParsedSheet[]; fileName: string } | { ok: false; error: string };

/** Lit un fichier Excel (.xlsx) ou CSV et renvoie chaque feuille avec ses en-têtes détectés. */
export async function parseSpreadsheetAction(fd: FormData): Promise<ParseResult> {
  const r = await run(async () => {
    await requireContext();
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) throw new UserError("Choisissez un fichier.");
    if (file.size > 15 * 1024 * 1024) throw new UserError("Fichier trop volumineux (15 Mo max).");
    const name = file.name.toLowerCase();
    const sheets: ParsedSheet[] = [];
    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      const s = toSheet("CSV", parseCsv((await file.text()).replace(/^﻿/, "")));
      if (s) sheets.push(s);
    } else if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
      try {
        sheets.push(...(await readXlsx(Buffer.from(await file.arrayBuffer()))));
      } catch {
        throw new UserError("Ce fichier Excel n'a pas pu être lu. Ouvrez-le dans Excel et enregistrez-le au format .xlsx.");
      }
    } else if (name.endsWith(".xls") || name.endsWith(".ods")) {
      throw new UserError("Ancien format Excel (.xls/.ods) : ouvrez le fichier dans Excel ou LibreOffice puis « Enregistrer sous » au format .xlsx.");
    } else throw new UserError("Format non reconnu : utilisez un fichier .xlsx ou .csv.");
    if (!sheets.length) throw new UserError("Aucune donnée trouvée dans ce fichier.");
    return { ok: true, data: { sheets, fileName: file.name } };
  });
  return r.ok ? { ok: true, ...(r.data as { sheets: ParsedSheet[]; fileName: string }) } : r;
}

// ======================================================================
// Enregistrement des imports (par lots de quelques centaines de lignes)
// ======================================================================
import { z } from "zod";
import { ID, Query } from "node-appwrite";
import { adminClient, DATABASE_ID } from "@/lib/appwrite/server";
import { assertManage, ForbiddenError } from "../context";
import { insert, patch, remove, audit, adminList, permsFor, churchReference, reserveReferences, revalidateApp, churchById } from "../data";
import { getLookups } from "../lookups";
import { movementsForOfferingLine, movementsForPaidExpense, sessionTotals, type Movement } from "@/lib/finance";
import { norm, type OfferingImportRow, type ExpenseImportRow } from "@/lib/import-map";
import { formatEuro } from "@/lib/format";
import { REGION } from "@/lib/schema";
import type { ActionResult } from "@/lib/action-types";
import type { Donor, Expense, OfferingLine, OfferingSession } from "@/lib/types";

const offeringRow = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), donorName: z.string().max(160).nullable(), typeId: z.string().min(1), method: z.enum(["cash", "cheque", "transfer", "card", "mobile"]),
  amountCents: z.number().int().positive().max(10_000_000_00), chequeRef: z.string().max(60).nullable(), serviceName: z.string().max(120).nullable(),
});
const expenseRow = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), title: z.string().min(1).max(200), amountCents: z.number().int().positive().max(10_000_000_00),
  categoryName: z.string().max(120).nullable(), supplier: z.string().max(160).nullable(), method: z.enum(["cash", "bank_transfer", "card", "cheque"]),
  departmentName: z.string().max(120).nullable(), notes: z.string().max(2000).nullable(),
});

async function bulk(table: string, rows: Record<string, unknown>[]) {
  const { db } = adminClient();
  for (let i = 0; i < rows.length; i += 100) await db.createRows({ databaseId: DATABASE_ID, tableId: table, rows: rows.slice(i, i + 100) });
}

async function writeMovs(churchId: string, perms: string[], movs: Movement[], userId: string) {
  await bulk("cash_movements", movs.map((m) => ({ $id: ID.unique(), $permissions: perms, churchId, ...m, sourceId: m.sourceId ?? null, category: m.category ?? null, label: m.label ?? null, createdBy: userId, archived: false })));
}

const iso = (d: string) => new Date(`${d}T12:00:00.000Z`).toISOString();

/** Importe des dons : une séance (validée) par date et par culte, fiches donateurs créées automatiquement. */
export async function importOfferingsAction(input: { churchId: string; batchId: string; fileName: string; rows: OfferingImportRow[]; updateTreasury: boolean }): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({ churchId: z.string().min(1), batchId: z.string().min(8).max(36), fileName: z.string().max(200), rows: z.array(offeringRow).min(1).max(1000), updateTreasury: z.boolean() }).parse(input);
    assertManage(ctx, d.churchId, "offrandes");
    const lk = await getLookups(d.churchId);
    const types = new Map(lk.donationTypes.filter((t) => t.churchId === REGION || t.churchId === d.churchId).map((t) => [t.$id, t.name]));
    if (d.rows.some((r) => !types.has(r.typeId))) throw new UserError("Type de don inconnu dans le fichier.");
    const defaultBank = lk.bankAccounts.find((b) => b.churchId === d.churchId)?.$id ?? null;
    if (d.updateTreasury && !defaultBank && d.rows.some((r) => !["cash", "cheque"].includes(r.method))) throw new UserError("Ajoutez un compte bancaire avant d'importer des dons par virement/carte dans la trésorerie.");
    const perms = await permsFor(d.churchId, "offrandes");
    const movPerms = await permsFor(d.churchId, "tresorerie");

    // Donateurs : retrouvés par leur nom, sinon créés
    const donors = await adminList<Donor>("donors", [Query.equal("churchId", d.churchId), Query.select(["$id", "fullName"])]);
    const byName = new Map(donors.map((x) => [norm(x.fullName), x.$id]));
    const newDonors: Record<string, unknown>[] = [];
    for (const r of d.rows) {
      if (!r.donorName) continue;
      const k = norm(r.donorName);
      if (!k || byName.has(k)) continue;
      const id = ID.unique();
      byName.set(k, id);
      newDonors.push({ $id: id, $permissions: perms, churchId: d.churchId, fullName: r.donorName.trim().replace(/\s+/g, " "), consentAt: new Date().toISOString(), createdBy: ctx.user.id, archived: false });
    }
    await bulk("donors", newDonors);

    // Une séance par date (et par culte)
    const groups = new Map<string, OfferingImportRow[]>();
    for (const r of d.rows) { const k = `${r.date}|${r.serviceName ?? ""}`; groups.set(k, [...(groups.get(k) ?? []), r]); }
    const existing = await adminList<OfferingSession>("offering_sessions", [Query.equal("importBatchId", d.batchId)]);
    let lineCount = 0, total = 0;
    for (const [k, rows] of groups) {
      const [date, serviceName] = k.split("|") as [string, string];
      const service = lk.services.find((s) => norm(s.name) === norm(serviceName || "Culte du dimanche")) ?? lk.services[0];
      const t = sessionTotals(rows, 0, 0);
      let session = existing.find((s) => s.date.slice(0, 10) === date && (s.serviceName ?? "") === (serviceName || service?.name || "Culte"));
      if (session) {
        await patch("offering_sessions", session.$id, { enteredTotalCents: session.enteredTotalCents + t.entered, countedCashCents: session.countedCashCents + t.cash, countedChequeCents: session.countedChequeCents + t.cheque });
      } else {
        const reference = await churchReference(d.churchId, "OFF", new Date(iso(date)));
        session = await insert<OfferingSession>("offering_sessions", d.churchId, {
          reference, date: iso(date), serviceId: service?.$id ?? null, serviceName: serviceName || service?.name || "Culte", counter1Name: "Import Excel", counter2Name: d.fileName.slice(0, 120),
          countedCashCents: t.cash, countedChequeCents: t.cheque, enteredTotalCents: t.entered, gapCents: 0, status: "validated", lockedAt: new Date().toISOString(), lockedBy: ctx.user.id,
          notes: `Importé depuis « ${d.fileName} »`, importBatchId: d.batchId, createdBy: ctx.user.id,
        });
        existing.push(session);
      }
      const lines = rows.map((r) => {
        const donorId = r.donorName ? byName.get(norm(r.donorName)) ?? null : null;
        return {
          $id: ID.unique(), $permissions: perms, churchId: d.churchId, sessionId: session!.$id, date: iso(date), donationTypeId: r.typeId, donationTypeName: types.get(r.typeId),
          donorId, donorName: donorId ? r.donorName!.trim().replace(/\s+/g, " ") : null, anonymous: !donorId, amountCents: r.amountCents, method: r.method,
          chequeRef: r.method === "cheque" ? r.chequeRef : null, bankAccountId: ["cash", "cheque"].includes(r.method) ? null : defaultBank, createdBy: ctx.user.id, archived: false,
          // Historique hors trésorerie : déjà déposé, ne doit pas apparaître « à déposer »
          depositId: d.updateTreasury ? null : "historique",
        };
      });
      await bulk("offering_lines", lines);
      if (d.updateTreasury) {
        await writeMovs(d.churchId, movPerms, lines.flatMap((l) => movementsForOfferingLine({ $id: l.$id, date: l.date, amountCents: l.amountCents, method: l.method, bankAccountId: l.bankAccountId, donationTypeName: l.donationTypeName }, defaultBank)), ctx.user.id);
      }
      lineCount += lines.length;
      total += t.entered;
    }
    await audit(ctx, d.churchId, "import", "import_offerings", d.batchId, `Import Excel « ${d.fileName} » : ${lineCount} dons, ${formatEuro(total)}, ${newDonors.length} nouveau(x) donateur(s)`);
    revalidateApp();
    return { ok: true, data: { lines: lineCount, total, donors: newDonors.length, sessions: groups.size } };
  });
}

/** Importe des dépenses déjà payées (historique) : catégories inconnues créées pour l'église. */
export async function importExpensesAction(input: { churchId: string; batchId: string; fileName: string; rows: ExpenseImportRow[]; updateTreasury: boolean }): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({ churchId: z.string().min(1), batchId: z.string().min(8).max(36), fileName: z.string().max(200), rows: z.array(expenseRow).min(1).max(1000), updateTreasury: z.boolean() }).parse(input);
    assertManage(ctx, d.churchId, "depenses");
    const church = await churchById(d.churchId);
    const lk = await getLookups(d.churchId);
    const perms = await permsFor(d.churchId, "depenses");
    const movPerms = await permsFor(d.churchId, "tresorerie");
    const cats = new Map(lk.categories.filter((c) => c.churchId === REGION || c.churchId === d.churchId).map((c) => [norm(c.name), { id: c.$id, name: c.name }]));
    const fallback = cats.get("autres") ?? cats.get("achats") ?? [...cats.values()][0];
    let created = 0;
    for (const r of d.rows) {
      const k = norm(r.categoryName);
      if (!k || cats.has(k)) continue;
      if (!(ctx.isRegional || church.allowLocalLists)) continue;
      const row = await insert<{ $id: string; $createdAt: string; $updatedAt: string }>("list_items", d.churchId, { kind: "expense_category", name: r.categoryName!.trim().slice(0, 120), sortOrder: 50, isTithe: false, createdBy: ctx.user.id });
      cats.set(k, { id: row.$id, name: r.categoryName!.trim() });
      created++;
    }
    const deps = new Map(lk.departments.filter((x) => x.churchId === d.churchId).map((x) => [norm(x.name), x.$id]));
    const bank = lk.bankAccounts.find((b) => b.churchId === d.churchId)?.$id ?? null;
    const byYear = new Map<number, number>();
    for (const r of d.rows) byYear.set(+r.date.slice(0, 4), (byYear.get(+r.date.slice(0, 4)) ?? 0) + 1);
    const refs = new Map<number, () => string>();
    for (const [y, n] of byYear) refs.set(y, await reserveReferences(d.churchId, "DEP", y, n));
    const rows = d.rows.map((r) => {
      const cat = (r.categoryName ? cats.get(norm(r.categoryName)) : undefined) ?? fallback;
      return {
        $id: ID.unique(), $permissions: perms, churchId: d.churchId, reference: refs.get(+r.date.slice(0, 4))!(), title: r.title.slice(0, 200), categoryId: cat?.id ?? null, categoryName: cat?.name ?? null,
        supplier: r.supplier, amountCents: r.amountCents, date: iso(r.date), paymentMethod: r.method, bankAccountId: r.method === "cash" ? null : bank,
        departmentId: r.departmentName ? deps.get(norm(r.departmentName)) ?? null : null, projectId: null, status: "paid", currentStep: 0, totalSteps: 0, workflowId: null, stepRoles: [],
        isRegularization: false, paidAt: iso(r.date), source: "import", sourceId: null, notes: [r.notes, r.categoryName && !cats.has(norm(r.categoryName)) ? `Catégorie d'origine : ${r.categoryName}` : null, `Importé depuis « ${d.fileName} »`].filter(Boolean).join(" · "),
        importBatchId: d.batchId, createdBy: ctx.user.id, archived: false,
      };
    });
    await bulk("expenses", rows);
    if (d.updateTreasury) {
      if (!bank && rows.some((r) => r.paymentMethod !== "cash")) throw new UserError("Ajoutez un compte bancaire avant d'importer des dépenses dans la trésorerie.");
      await writeMovs(d.churchId, movPerms, rows.flatMap((e) => movementsForPaidExpense({ $id: e.$id, date: e.date, paidAt: e.paidAt, amountCents: e.amountCents, paymentMethod: e.paymentMethod, bankAccountId: e.bankAccountId, title: e.title, categoryName: e.categoryName }, bank)), ctx.user.id);
    }
    const total = rows.reduce((a, r) => a + r.amountCents, 0);
    await audit(ctx, d.churchId, "import", "import_expenses", d.batchId, `Import Excel « ${d.fileName} » : ${rows.length} dépenses, ${formatEuro(total)}${created ? `, ${created} catégorie(s) créée(s)` : ""}`);
    revalidateApp();
    return { ok: true, data: { lines: rows.length, total, categories: created } };
  });
}

/** Annule un import : supprime tout ce qu'il a créé (séances, dons, dépenses, écritures de caisse/banque). */
export async function undoImportAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const batchId = String(fd.get("batchId"));
    const churchId = String(fd.get("churchId"));
    assertManage(ctx, churchId);
    const sessions = await adminList<OfferingSession>("offering_sessions", [Query.equal("importBatchId", batchId)]);
    const expenses = await adminList<Expense>("expenses", [Query.equal("importBatchId", batchId)]);
    if ([...sessions, ...expenses].some((x) => x.churchId !== churchId)) throw new ForbiddenError();
    let n = 0;
    for (const s of sessions) {
      const lines = await adminList<OfferingLine>("offering_lines", [Query.equal("sessionId", s.$id)]);
      if (lines.some((l) => l.depositId && l.depositId !== "historique")) throw new UserError("Des dons de cet import ont déjà été déposés en banque : annulez d'abord le dépôt.");
      for (const l of lines) {
        for (const m of await adminList("cash_movements", [Query.equal("sourceType", "offering_line"), Query.equal("sourceId", l.$id)])) await remove("cash_movements", m.$id);
        await remove("offering_lines", l.$id);
        n++;
      }
      await remove("offering_sessions", s.$id);
    }
    for (const e of expenses) {
      for (const m of await adminList("cash_movements", [Query.equal("sourceType", "expense"), Query.equal("sourceId", e.$id)])) await remove("cash_movements", m.$id);
      await remove("expenses", e.$id);
      n++;
    }
    await audit(ctx, churchId, "delete", "import", batchId, `Import annulé : ${n} ligne(s) supprimée(s)`);
    revalidateApp();
    return { ok: true, message: `Import annulé : ${n} ligne(s) supprimée(s).` };
  });
}
