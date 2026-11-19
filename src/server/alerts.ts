import "server-only";
import { Query } from "node-appwrite";
import { listScoped } from "./data";
import { getSettings } from "./lookups";
import { computeBalances } from "@/lib/finance";
import type { AppContext } from "./context";
import type { BankAccount, CashMovement, CrRequest, Expense, OfferingSession } from "@/lib/types";

export type Alert = { churchId: string; tone: "warning" | "negative"; text: string; href: string };

export async function computeAlerts(ctx: AppContext, movs: CashMovement[], accounts: BankAccount[]): Promise<Alert[]> {
  const s = await getSettings();
  const ids = ctx.scopeIds;
  const [lastSessions, staleCr, lateExpenses] = await Promise.all([
    listScoped<OfferingSession>(ctx, "offering_sessions", [Query.orderDesc("date"), Query.limit(400), Query.select(["churchId", "date"])]),
    listScoped<CrRequest>(ctx, "cr_requests", [Query.equal("status", "pending"), Query.lessThan("statusChangedAt", new Date(Date.now() - s.crPendingDays * 86400000).toISOString())]),
    listScoped<Expense>(ctx, "expenses", [Query.equal("status", "in_approval"), Query.lessThan("stepStartedAt", new Date(Date.now() - 72 * 3600000).toISOString()), Query.equal("archived", false)]),
  ]);
  const out: Alert[] = [];
  for (const id of ids) {
    const last = lastSessions.find((x) => x.churchId === id);
    const days = last ? Math.floor((Date.now() - new Date(last.date).getTime()) / 86400000) : Infinity;
    if (days > s.noOfferingDays) out.push({ churchId: id, tone: "warning", text: last ? `Aucune offrande saisie depuis ${days} jours` : "Aucune offrande saisie", href: "/app/offrandes" });
    const cm = movs.filter((m) => m.churchId === id);
    const b = computeBalances(cm, accounts.filter((a) => a.churchId === id));
    if (b.cash > s.cashMaxCents) out.push({ churchId: id, tone: "negative", text: `Caisse trop élevée : ${(b.cash / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`, href: "/app/depots/nouveau" });
    const lastCashOut = cm.filter((m) => m.account === "cash" && m.sourceType === "deposit").sort((a, c) => c.date.localeCompare(a.date))[0];
    const lastCashIn = cm.filter((m) => m.account === "cash" && m.direction === "in").sort((a, c) => a.date.localeCompare(c.date)).find((m) => !lastCashOut || m.date > lastCashOut.date);
    if (b.cash > 0 && lastCashIn && Date.now() - new Date(lastCashIn.date).getTime() > s.cashMaxDays * 86400000) out.push({ churchId: id, tone: "warning", text: `Argent en caisse depuis plus de ${s.cashMaxDays} jours`, href: "/app/depots/nouveau" });
    const crs = staleCr.filter((c) => c.churchId === id);
    if (crs.length) out.push({ churchId: id, tone: "warning", text: `${crs.length} demande(s) Cité Royale en attente depuis plus de ${s.crPendingDays} jours`, href: "/app/cite-royale" });
    const le = lateExpenses.filter((e) => e.churchId === id);
    if (le.length) out.push({ churchId: id, tone: "negative", text: `${le.length} validation(s) de dépense en retard`, href: "/app/a-valider" });
  }
  return out;
}
