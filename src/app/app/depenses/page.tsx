import Link from "next/link";
import { Receipt, Plus, Clock, CheckCircle2, Banknote } from "lucide-react";
import { Query } from "node-appwrite";
import { requireContext, canManage, churchName } from "@/server/context";
import { listScoped } from "@/server/data";
import { periodFrom, type PeriodParams } from "@/server/period";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type Col } from "@/components/data/data-table";
import { PeriodFilter } from "@/components/period-filter";
import { ExportButtons } from "@/components/export-buttons";
import { STATUS } from "@/lib/status";
import type { Expense } from "@/lib/types";

export const metadata = { title: "Dépenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<PeriodParams> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const period = periodFrom(sp);
  const expenses = await listScoped<Expense>(ctx, "expenses", [Query.greaterThanEqual("date", period.from.toISOString()), Query.lessThan("date", period.to.toISOString()), Query.equal("archived", false), Query.orderDesc("date")]);
  const canWrite = ctx.scopeIds.some((id) => canManage(ctx, id));
  const s = (st: string[]) => expenses.filter((e) => st.includes(e.status)).reduce((a, e) => a + e.amountCents, 0);
  const columns: Col[] = [
    { key: "date", label: "Date", type: "date", mobileSecondary: true },
    { key: "title", label: "Objet", mobilePrimary: true },
    ...(ctx.view === "all" ? [{ key: "church", label: "Église", type: "muted" as const, mobileSecondary: true }] : []),
    { key: "category", label: "Catégorie", type: "muted", mobileSecondary: true },
    { key: "reference", label: "Référence", type: "muted" },
    { key: "status", label: "Statut", type: "status", entity: "expense" },
    { key: "amount", label: "Montant", type: "money" },
  ];
  const rows = expenses.map((e) => ({
    id: e.$id, href: `/app/depenses/${e.$id}`, date: e.date, title: e.title, church: churchName(ctx, e.churchId), category: e.categoryName ?? "—", reference: e.reference,
    status: e.status, statusSuffix: e.status === "in_approval" ? `${e.currentStep}/${e.totalSteps}` : undefined, amount: e.amountCents,
  }));
  return (
    <>
      <PageHeader module={5} help="depenses" title="Dépenses" description="Chaque dépense suit son circuit de validation avant d'être payée."
        actions={<><PeriodFilter value={period.key} from={sp.from} to={sp.to} />{canWrite && <Button asChild><Link href="/app/depenses/nouvelle"><Plus /> Nouvelle dépense</Link></Button>}</>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Argent sorti (payé)" value={s(["paid"])} tone="accent" icon={<Banknote />} hint={period.label} />
        <KpiCard label="Approuvé, à payer" value={s(["approved"])} icon={<CheckCircle2 />} />
        <KpiCard label="En validation" value={s(["submitted", "in_approval"])} icon={<Clock />} href="/app/a-valider" />
        <KpiCard label="Nombre de dépenses" value={expenses.length} kind="count" />
      </div>
      <DataTable columns={columns} rows={rows} totals={{ amount: rows.reduce((a, r) => a + r.amount, 0) }} toolbar={<ExportButtons entity="expenses" sp={sp} />}
        filters={[
          { key: "status", label: "Statut", options: Object.entries(STATUS.expense!).map(([value, d]) => ({ value, label: d.label })) },
          { key: "category", label: "Catégorie", options: [...new Set(rows.map((r) => r.category))].map((c) => ({ value: c, label: c })) },
        ]}
        empty={<EmptyState icon={<Receipt />} title="Aucune dépense sur cette période" action={canWrite ? <Button asChild><Link href="/app/depenses/nouvelle"><Plus /> Ajouter une dépense</Link></Button> : undefined} />} />
    </>
  );
}
