import "server-only";
import { Query } from "node-appwrite";
import { listScoped } from "./data";
import { churchName, type AppContext } from "./context";
import { resolvePeriod, previousPeriod, type Period } from "@/lib/period";
import { incomeStatement, computeBalances } from "@/lib/finance";
import { getLookups } from "./lookups";
import { movementsFor } from "./treasury";
import { statusDef, METHOD_LABELS, PRIORITY_LABELS } from "@/lib/status";
import type { CrRequest, Deposit, Expense, FundingRequest, OfferingLine, OfferingSession, Reimbursement } from "@/lib/types";

export type ReportCol = { key: string; label: string; type?: "money" | "date" | "text"; width?: number };
export type Report = { title: string; subtitle: string; columns: ReportCol[]; rows: Record<string, string | number | null>[]; totals?: Record<string, number>; sheets?: Report[] };

export const REPORTS: Record<string, string> = {
  offerings: "Rapport des offrandes",
  offering_lines: "Détail des dons",
  expenses: "Dépenses",
  deposits: "État des dépôts",
  reimbursements: "Remboursements",
  funding: "Besoins des départements",
  cr: "Demandes à la Cité Royale",
  income: "Compte de résultat",
  treasury: "État de trésorerie",
  projects: "Dépenses par projet",
  regional: "Rapport consolidé régional",
  full: "Export complet",
};

const range = (p: Period, field = "date") => [Query.greaterThanEqual(field, p.from.toISOString()), Query.lessThan(field, p.to.toISOString())];
const sum = (rows: Record<string, unknown>[], k: string) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);

export async function buildReport(ctx: AppContext, kind: string, sp: { p?: string; from?: string; to?: string }): Promise<Report> {
  const period = resolvePeriod(sp.p ?? "month", sp.from, sp.to);
  const scope = ctx.view === "all" ? "Toutes les églises" : ctx.activeChurch?.name ?? "";
  const subtitle = `${scope} · ${period.label} (${period.from.toLocaleDateString("fr-FR", { timeZone: "UTC" })} → ${new Date(period.to.getTime() - 1).toLocaleDateString("fr-FR", { timeZone: "UTC" })})`;
  const church = (id: string) => churchName(ctx, id);
  const multi = ctx.view === "all";
  const chCol: ReportCol[] = multi ? [{ key: "church", label: "Église", width: 22 }] : [];

  switch (kind) {
    case "offerings": {
      const s = await listScoped<OfferingSession>(ctx, "offering_sessions", [...range(period), Query.orderAsc("date")]);
      const rows = s.map((x) => ({ date: x.date, church: church(x.churchId), reference: x.reference, service: x.serviceName ?? "", counters: [x.counter1Name, x.counter2Name].filter(Boolean).join(" & "), status: statusDef("offering_session", x.status).label, gap: x.gapCents, total: x.enteredTotalCents }));
      return { title: REPORTS.offerings!, subtitle, columns: [{ key: "date", label: "Date", type: "date" }, ...chCol, { key: "reference", label: "Référence" }, { key: "service", label: "Culte" }, { key: "counters", label: "Compteurs", width: 26 }, { key: "status", label: "Statut" }, { key: "gap", label: "Écart", type: "money" }, { key: "total", label: "Total", type: "money" }], rows, totals: { total: sum(rows, "total"), gap: sum(rows, "gap") } };
    }
    case "offering_lines": {
      const l = await listScoped<OfferingLine>(ctx, "offering_lines", [...range(period), Query.orderAsc("date")]);
      const rows = l.map((x) => ({ date: x.date, church: church(x.churchId), type: x.donationTypeName ?? "", donor: x.anonymous ? "Anonyme" : x.donorName ?? "", method: METHOD_LABELS[x.method] ?? x.method, cheque: x.chequeRef ?? "", amount: x.amountCents }));
      return { title: REPORTS.offering_lines!, subtitle, columns: [{ key: "date", label: "Date", type: "date" }, ...chCol, { key: "type", label: "Type" }, { key: "donor", label: "Donateur" }, { key: "method", label: "Moyen" }, { key: "cheque", label: "N° chèque" }, { key: "amount", label: "Montant", type: "money" }], rows, totals: { amount: sum(rows, "amount") } };
    }
    case "expenses": {
      const e = await listScoped<Expense>(ctx, "expenses", [...range(period), Query.equal("archived", false), Query.orderAsc("date")]);
      const rows = e.map((x) => ({ date: x.date, church: church(x.churchId), reference: x.reference, title: x.title, category: x.categoryName ?? "", supplier: x.supplier ?? "", method: METHOD_LABELS[x.paymentMethod] ?? "", status: statusDef("expense", x.status).label, amount: x.amountCents }));
      return { title: REPORTS.expenses!, subtitle, columns: [{ key: "date", label: "Date", type: "date" }, ...chCol, { key: "reference", label: "Référence" }, { key: "title", label: "Objet", width: 32 }, { key: "category", label: "Catégorie" }, { key: "supplier", label: "Fournisseur" }, { key: "method", label: "Paiement" }, { key: "status", label: "Statut" }, { key: "amount", label: "Montant", type: "money" }], rows, totals: { amount: sum(rows, "amount") } };
    }
    case "deposits": {
      const d = await listScoped<Deposit>(ctx, "deposits", [...range(period), Query.equal("archived", false), Query.orderAsc("date")]);
      const lk = await getLookups(ctx.scopeIds.join(","));
      const rows = d.map((x) => ({ date: x.date, church: church(x.churchId), reference: x.reference, account: lk.bankAccounts.find((b) => b.$id === x.bankAccountId)?.label ?? "", slip: x.slipNumber ?? "", status: statusDef("deposit", x.status).label, cash: x.cashCents, cheque: x.chequeCents, total: x.cashCents + x.chequeCents, gap: x.gapCents }));
      return { title: REPORTS.deposits!, subtitle, columns: [{ key: "date", label: "Date", type: "date" }, ...chCol, { key: "reference", label: "Référence" }, { key: "account", label: "Compte" }, { key: "slip", label: "Bordereau" }, { key: "status", label: "Statut" }, { key: "cash", label: "Espèces", type: "money" }, { key: "cheque", label: "Chèques", type: "money" }, { key: "gap", label: "Écart", type: "money" }, { key: "total", label: "Total", type: "money" }], rows, totals: { cash: sum(rows, "cash"), cheque: sum(rows, "cheque"), total: sum(rows, "total"), gap: sum(rows, "gap") } };
    }
    case "reimbursements": {
      const r = await listScoped<Reimbursement>(ctx, "reimbursements", [...range(period, "$createdAt"), Query.orderAsc("$createdAt")]);
      const rows = r.map((x) => ({ date: x.$createdAt, church: church(x.churchId), reference: x.reference, requester: x.requesterName, reason: x.reason ?? "", status: statusDef("reimbursement", x.status).label, paidAt: x.paidAt ?? null, amount: x.amountCents }));
      return { title: REPORTS.reimbursements!, subtitle, columns: [{ key: "date", label: "Reçue le", type: "date" }, ...chCol, { key: "reference", label: "Référence" }, { key: "requester", label: "Demandeur" }, { key: "reason", label: "Motif", width: 30 }, { key: "status", label: "Statut" }, { key: "paidAt", label: "Payée le", type: "date" }, { key: "amount", label: "Montant", type: "money" }], rows, totals: { amount: sum(rows, "amount") } };
    }
    case "funding": {
      const f = await listScoped<FundingRequest>(ctx, "funding_requests", [...range(period, "$createdAt"), Query.orderAsc("$createdAt")]);
      const lk = await getLookups(ctx.scopeIds.join(","));
      const rows = f.map((x) => ({ date: x.$createdAt, church: church(x.churchId), reference: x.reference, department: lk.departments.find((d) => d.$id === x.departmentId)?.name ?? "", title: x.title, priority: PRIORITY_LABELS[x.priority]?.label ?? "", status: statusDef("funding_request", x.status).label, estimated: x.estimatedCents, approved: x.approvedCents ?? 0 }));
      return { title: REPORTS.funding!, subtitle, columns: [{ key: "date", label: "Reçu le", type: "date" }, ...chCol, { key: "reference", label: "Référence" }, { key: "department", label: "Département" }, { key: "title", label: "Besoin", width: 30 }, { key: "priority", label: "Priorité" }, { key: "status", label: "Statut" }, { key: "estimated", label: "Estimé", type: "money" }, { key: "approved", label: "Approuvé", type: "money" }], rows, totals: { estimated: sum(rows, "estimated"), approved: sum(rows, "approved") } };
    }
    case "cr": {
      const c = await listScoped<CrRequest>(ctx, "cr_requests", [Query.equal("archived", false), Query.orderAsc("$createdAt")]);
      const rows = c.map((x) => ({ date: x.$createdAt, church: church(x.churchId), reference: x.reference, title: x.title, priority: PRIORITY_LABELS[x.priority]?.label ?? "", status: statusDef("cr_request", x.status).label, crRef: x.crReference ?? "", estimated: x.estimatedCents ?? 0, received: x.receivedCents ?? 0 }));
      return { title: REPORTS.cr!, subtitle: `${scope} · toutes les demandes`, columns: [{ key: "date", label: "Créée le", type: "date" }, ...chCol, { key: "reference", label: "Référence" }, { key: "title", label: "Objet", width: 30 }, { key: "priority", label: "Priorité" }, { key: "status", label: "Statut", width: 24 }, { key: "crRef", label: "Réf. Cité Royale" }, { key: "estimated", label: "Estimé", type: "money" }, { key: "received", label: "Reçu", type: "money" }], rows, totals: { estimated: sum(rows, "estimated"), received: sum(rows, "received") } };
    }
    case "income": {
      const inc = await incomeFor(ctx, period);
      const prev = await incomeFor(ctx, previousPeriod(period));
      const pv = (list: { label: string; cents: number }[], l: string) => list.find((x) => x.label === l)?.cents ?? 0;
      const rows = [
        ...inc.products.map((p) => ({ section: "Produits", label: p.label, amount: p.cents, previous: pv(prev.products, p.label) })),
        { section: "Produits", label: "TOTAL PRODUITS", amount: inc.totalProducts, previous: prev.totalProducts },
        ...inc.charges.map((p) => ({ section: "Charges", label: p.label, amount: p.cents, previous: pv(prev.charges, p.label) })),
        { section: "Charges", label: "TOTAL CHARGES", amount: inc.totalCharges, previous: prev.totalCharges },
        { section: "Résultat", label: "RÉSULTAT", amount: inc.result, previous: prev.result },
      ];
      return { title: REPORTS.income!, subtitle, columns: [{ key: "section", label: "Section" }, { key: "label", label: "Poste", width: 34 }, { key: "amount", label: "Période", type: "money" }, { key: "previous", label: "Période précédente", type: "money" }], rows };
    }
    case "treasury": {
      const ids = ctx.scopeIds;
      const [movs, lk] = await Promise.all([movementsFor(ctx, ids), getLookups(ids.join(","))]);
      const rows: Record<string, string | number | null>[] = [];
      for (const id of ids) {
        const b = computeBalances(movs.filter((m) => m.churchId === id), lk.bankAccounts.filter((a) => a.churchId === id));
        rows.push({ church: church(id), account: "En caisse", amount: b.cash });
        for (const a of lk.bankAccounts.filter((x) => x.churchId === id)) rows.push({ church: church(id), account: `${a.label}${a.bankName ? ` (${a.bankName})` : ""}`, amount: b.banks[a.$id] ?? 0 });
      }
      return { title: REPORTS.treasury!, subtitle: `${scope} · au ${new Date().toLocaleDateString("fr-FR")}`, columns: [{ key: "church", label: "Église", width: 26 }, { key: "account", label: "Compte", width: 30 }, { key: "amount", label: "Solde", type: "money" }], rows, totals: { amount: sum(rows, "amount") } };
    }
    case "projects": {
      const [projects, expenses] = await Promise.all([
        listScoped<{ $id: string; $createdAt: string; $updatedAt: string; churchId: string; name: string; budgetCents: number }>(ctx, "projects", [Query.equal("archived", false)]),
        listScoped<Expense>(ctx, "expenses", [Query.isNotNull("projectId"), Query.equal("archived", false)]),
      ]);
      const rows = projects.map((p) => {
        const spent = expenses.filter((e) => e.projectId === p.$id && e.status === "paid").reduce((a, e) => a + e.amountCents, 0);
        const committed = expenses.filter((e) => e.projectId === p.$id && ["approved", "in_approval"].includes(e.status)).reduce((a, e) => a + e.amountCents, 0);
        return { church: church(p.churchId), name: p.name, budget: p.budgetCents, spent, committed, remaining: p.budgetCents - spent - committed };
      });
      return { title: REPORTS.projects!, subtitle: scope, columns: [...chCol, { key: "name", label: "Projet", width: 30 }, { key: "budget", label: "Budget", type: "money" }, { key: "spent", label: "Payé", type: "money" }, { key: "committed", label: "Engagé", type: "money" }, { key: "remaining", label: "Reste", type: "money" }], rows, totals: { budget: sum(rows, "budget"), spent: sum(rows, "spent"), committed: sum(rows, "committed"), remaining: sum(rows, "remaining") } };
    }
    case "regional": {
      const ids = ctx.scopeIds;
      const [movs, lk] = await Promise.all([movementsFor(ctx, ids), getLookups(ids.join(","))]);
      const lines = await listScoped<OfferingLine>(ctx, "offering_lines", [...range(period), Query.select(["churchId", "amountCents", "donationTypeName", "date"])]);
      const exps = await listScoped<Expense>(ctx, "expenses", [...range(period), Query.equal("status", "paid"), Query.select(["churchId", "amountCents", "categoryName", "status", "date"])]);
      const rows = ids.map((id) => {
        const inc = incomeStatement(lines.filter((l) => l.churchId === id), exps.filter((e) => e.churchId === id), period.from, period.to);
        const b = computeBalances(movs.filter((m) => m.churchId === id), lk.bankAccounts.filter((a) => a.churchId === id));
        return { church: church(id), in: inc.totalProducts, out: inc.totalCharges, result: inc.result, cash: b.cash, bank: b.bankTotal, total: b.total };
      });
      return { title: REPORTS.regional!, subtitle, columns: [{ key: "church", label: "Église", width: 26 }, { key: "in", label: "Entrées", type: "money" }, { key: "out", label: "Sorties", type: "money" }, { key: "result", label: "Résultat", type: "money" }, { key: "cash", label: "En caisse", type: "money" }, { key: "bank", label: "Banque", type: "money" }, { key: "total", label: "Trésorerie", type: "money" }], rows, totals: { in: sum(rows, "in"), out: sum(rows, "out"), result: sum(rows, "result"), cash: sum(rows, "cash"), bank: sum(rows, "bank"), total: sum(rows, "total") } };
    }
    case "full": {
      const all = { p: "all" };
      const parts = await Promise.all(["offerings", "offering_lines", "expenses", "deposits", "reimbursements", "funding", "cr", "treasury", "projects"].map((k) => buildReport(ctx, k, all)));
      return { title: REPORTS.full!, subtitle: `${scope} · toutes périodes`, columns: [], rows: [], sheets: parts };
    }
  }
  throw new Error("Rapport inconnu");
}

export async function incomeFor(ctx: AppContext, period: Period, churchIds?: string[]) {
  const ids = churchIds ?? ctx.scopeIds;
  const [lines, exps] = await Promise.all([
    listScoped<OfferingLine>(ctx, "offering_lines", [...range(period), Query.select(["$id", "amountCents", "donationTypeName", "date", "churchId"])], ids),
    listScoped<Expense>(ctx, "expenses", [...range(period), Query.equal("status", "paid"), Query.select(["$id", "amountCents", "categoryName", "status", "date", "paidAt", "churchId"])], ids),
  ]);
  return incomeStatement(lines, exps, period.from, period.to);
}
