"use server";
import { z } from "zod";
import { ID, Query } from "node-appwrite";
import { adminClient, DATABASE_ID } from "@/lib/appwrite/server";
import { requireContext, assertManage } from "../context";
import { run, UserError, formToObject } from "../action";
import { insert, patch, audit, adminList, adminGet, permsFor, revalidateApp } from "../data";
import { getLookups } from "../lookups";
import { zCents } from "@/lib/zod";
import { parseEuroToCents } from "@/lib/format";
import type { ActionResult } from "@/lib/action-types";
import type { BankStatementLine, Budget } from "@/lib/types";

export async function saveBudgetAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const d = z.object({ churchId: z.string().min(1), year: z.coerce.number().int().min(2020).max(2100), scope: z.enum(["category", "department"]), scopeId: z.string().min(1), planned: zCents("Le montant prévu", { allowZero: true }) }).parse(formToObject(fd));
    assertManage(ctx, d.churchId);
    const lk = await getLookups(d.churchId);
    const name = (d.scope === "category" ? lk.categories : lk.departments).find((x) => x.$id === d.scopeId)?.name ?? null;
    const ex = (await adminList<Budget>("budgets", [Query.equal("churchId", d.churchId), Query.equal("year", d.year), Query.equal("scopeId", d.scopeId)]))[0];
    if (ex) await patch("budgets", ex.$id, { plannedCents: d.planned, scopeName: name });
    else await insert("budgets", d.churchId, { year: d.year, scope: d.scope, scopeId: d.scopeId, scopeName: name, plannedCents: d.planned, createdBy: ctx.user.id });
    await audit(ctx, d.churchId, ex ? "update" : "create", "budget", ex?.$id ?? null, `Budget ${d.year} — ${name}`);
    revalidateApp();
    return { ok: true, message: "Budget enregistré." };
  });
}

/** Import d'un relevé CSV (date;libellé;montant) — détection automatique du séparateur et du format. */
export async function importStatementAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const churchId = String(fd.get("churchId"));
    const bankAccountId = String(fd.get("bankAccountId"));
    assertManage(ctx, churchId);
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) throw new UserError("Choisissez un fichier CSV.");
    if (file.size > 2 * 1024 * 1024) throw new UserError("Fichier trop volumineux (2 Mo max).");
    const text = (await file.text()).replace(/^﻿/, "");
    const rows = text.split(/\r?\n/).filter((l) => l.trim());
    const sep = (rows[0]!.match(/;/g)?.length ?? 0) >= (rows[0]!.match(/,/g)?.length ?? 0) ? ";" : ",";
    const parsed: { date: string; label: string; amountCents: number }[] = [];
    for (const line of rows) {
      const cols = line.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
      const dm = cols[0]?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) ?? cols[0]?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!dm) continue;
      const iso = cols[0]!.includes("/") ? `${dm[3]}-${dm[2]}-${dm[1]}` : cols[0]!;
      let amount: number;
      if (cols.length >= 4 && (cols[2] || cols[3])) amount = cols[3] ? parseEuroToCents(cols[3]) - (cols[2] ? Math.abs(parseEuroToCents(cols[2])) : 0) : -Math.abs(parseEuroToCents(cols[2]!));
      else amount = parseEuroToCents(cols[2] ?? "");
      if (isNaN(amount)) continue;
      parsed.push({ date: new Date(`${iso}T12:00:00Z`).toISOString(), label: (cols[1] ?? "").slice(0, 300), amountCents: amount });
    }
    if (!parsed.length) throw new UserError("Aucune ligne reconnue. Format attendu : date ; libellé ; montant (ou débit ; crédit).");
    const batch = ID.unique();
    const perms = await permsFor(churchId);
    await adminClient().db.createRows({ databaseId: DATABASE_ID, tableId: "bank_statement_lines", rows: parsed.map((p) => ({ $id: ID.unique(), $permissions: perms, churchId, bankAccountId, importBatchId: batch, ...p, createdBy: ctx.user.id, archived: false })) });
    await audit(ctx, churchId, "import", "bank_statement", batch, `Relevé importé : ${parsed.length} lignes`);
    revalidateApp();
    return { ok: true, message: `${parsed.length} ligne(s) importée(s).` };
  });
}

export async function matchStatementLineAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireContext();
    const line = await adminGet<BankStatementLine>("bank_statement_lines", String(fd.get("id")));
    if (!line) throw new UserError("Ligne introuvable.");
    assertManage(ctx, line.churchId);
    const matchedType = String(fd.get("matchedType") || "") || null;
    const matchedId = String(fd.get("matchedId") || "") || null;
    await patch("bank_statement_lines", line.$id, { matchedType, matchedId });
    revalidateApp();
    return { ok: true, message: matchedId ? "Ligne pointée." : "Pointage retiré." };
  });
}
