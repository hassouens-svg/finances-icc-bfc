import "server-only";
import { ID, Query } from "node-appwrite";
import { adminClient, DATABASE_ID } from "@/lib/appwrite/server";
import { adminGet, adminList, permsFor } from "./data";
import { movementsForDeposit, depositAdjustment, type Movement } from "@/lib/finance";
import type { AppContext } from "./context";
import type { Deposit, OfferingLine, OfferingSession } from "@/lib/types";

export async function writeMovements(churchId: string, movs: Movement[], createdBy: string) {
  if (!movs.length) return;
  const perms = await permsFor(churchId, "tresorerie");
  await adminClient().db.createRows({
    databaseId: DATABASE_ID, tableId: "cash_movements",
    rows: movs.map((m) => ({ $id: ID.unique(), $permissions: perms, churchId, ...m, sourceId: m.sourceId ?? null, category: m.category ?? null, label: m.label ?? null, createdBy, archived: false })),
  });
}

/** Passage à « Déposé » : la caisse diminue, la banque augmente. */
export async function markDeposited(ctx: AppContext, depositId: string) {
  const d = await adminGet<Deposit>("deposits", depositId);
  if (!d) throw new Error("Dépôt introuvable");
  const existing = await adminList("cash_movements", [Query.equal("sourceType", "deposit"), Query.equal("sourceId", depositId), Query.limit(1)]);
  if (existing.length) return;
  await writeMovements(d.churchId, movementsForDeposit(d), ctx.user.id);
}

export async function writeAdjustment(ctx: AppContext, d: Deposit, confirmedCents: number) {
  const adj = depositAdjustment(d, confirmedCents);
  if (adj) await writeMovements(d.churchId, [adj], ctx.user.id);
}

/** Séances validées dont une partie des espèces/chèques n'est pas encore déposée. */
export async function undepositedSessions(churchId: string) {
  const [sessions, lines] = await Promise.all([
    adminList<OfferingSession>("offering_sessions", [Query.equal("churchId", churchId), Query.equal("status", "validated"), Query.orderDesc("date"), Query.limit(200)]),
    adminList<OfferingLine>("offering_lines", [Query.equal("churchId", churchId), Query.equal("method", ["cash", "cheque"]), Query.isNull("depositId"), Query.limit(5000)]),
  ]);
  return sessions
    .map((s) => {
      const ls = lines.filter((l) => l.sessionId === s.$id);
      return {
        id: s.$id, reference: s.reference, date: s.date, serviceName: s.serviceName,
        cashCents: ls.filter((l) => l.method === "cash").reduce((a, l) => a + l.amountCents, 0),
        cheques: ls.filter((l) => l.method === "cheque").map((l) => ({ id: l.$id, amountCents: l.amountCents, ref: l.chequeRef, donor: l.donorName })),
        countedCashCents: s.countedCashCents,
      };
    })
    .filter((s) => s.cashCents > 0 || s.cheques.length > 0);
}
