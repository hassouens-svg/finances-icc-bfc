import { NoAccess } from "@/components/no-access";
import Link from "next/link";
import { Lightbulb, Link2 } from "lucide-react";
import { Query } from "node-appwrite";
import { requireContext, churchName, canManage, canSeeModule } from "@/server/context";
import { listScoped } from "@/server/data";
import { lookupsFor } from "@/server/lookups";
import { PageHeader } from "@/components/ui/page-header";
import { PublicLinksPanel } from "@/components/public-links-panel";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Gauge } from "@/components/ui/gauge";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type Col } from "@/components/data/data-table";
import { ExportButtons } from "@/components/export-buttons";
import { STATUS } from "@/lib/status";
import type { Expense, FundingRequest } from "@/lib/types";

export const metadata = { title: "Besoins des départements" };

export default async function FundingPage() {
  const ctx = await requireContext();
  if (!canSeeModule(ctx, "besoins")) return <NoAccess />;
  const year = new Date().getUTCFullYear();
  const [items, lk, spent] = await Promise.all([
    listScoped<FundingRequest>(ctx, "funding_requests", [Query.orderDesc("$createdAt")]),
    lookupsFor(ctx),
    listScoped<Expense>(ctx, "expenses", [Query.equal("status", "paid"), Query.isNotNull("departmentId"), Query.greaterThanEqual("date", `${year}-01-01`), Query.select(["departmentId", "amountCents"])]),
  ]);
  const dep = (id?: string | null) => lk.departments.find((d) => d.$id === id)?.name ?? "—";
  const columns: Col[] = [
    { key: "date", label: "Reçu le", type: "date", mobileSecondary: true },
    { key: "title", label: "Besoin", mobilePrimary: true },
    { key: "department", label: "Département", type: "muted", mobileSecondary: true },
    ...(ctx.view === "all" ? [{ key: "church", label: "Église", type: "muted" as const }] : []),
    { key: "priority", label: "Priorité", type: "priority" },
    { key: "status", label: "Statut", type: "status", entity: "funding_request" },
    { key: "amount", label: "Estimé", type: "money" },
  ];
  const rows = items.map((f) => ({ id: f.$id, href: `/app/besoins/${f.$id}`, date: f.$createdAt, title: f.title, department: dep(f.departmentId), church: churchName(ctx, f.churchId), priority: f.priority, status: f.status, amount: f.estimatedCents }));
  const budgeted = lk.departments.filter((d) => d.annualBudgetCents);
  return (
    <>
      <PageHeader module={2} help="besoins" title="Besoins des départements" description="Les responsables expriment leurs besoins via un lien public ; vous étudiez, approuvez, puis convertissez en dépense ou en demande à la Cité Royale."
      />
      <PublicLinksPanel ctx={ctx} kind="funding" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="En attente" value={items.filter((i) => ["received", "reviewing"].includes(i.status)).length} kind="count" tone="warning" />
        <KpiCard label="Approuvés" value={items.filter((i) => ["approved", "partially_approved"].includes(i.status)).reduce((a, i) => a + (i.approvedCents ?? 0), 0)} />
        <KpiCard label="Financés" value={items.filter((i) => i.status === "funded").reduce((a, i) => a + (i.approvedCents ?? i.estimatedCents), 0)} tone="positive" />
        <KpiCard label="Demandes" value={items.length} kind="count" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <DataTable columns={columns} rows={rows} toolbar={<ExportButtons entity="funding" sp={{ p: "all" }} />}
          filters={[{ key: "status", label: "Statut", options: Object.entries(STATUS.funding_request!).map(([value, d]) => ({ value, label: d.label })) }, { key: "department", label: "Département", options: [...new Set(rows.map((r) => r.department))].map((v) => ({ value: v, label: v })) }]}
          empty={<EmptyState icon={<Lightbulb />} title="Aucun besoin exprimé" description="Partagez le lien public aux responsables de départements." />} />
        {budgeted.length > 0 && (
          <Card className="self-start">
            <CardHeader title={`Budgets ${year} par département`} />
            <CardBody className="space-y-4">
              {budgeted.map((d) => (
                <div key={d.$id}>
                  <p className="mb-1.5 text-[13px] font-medium">{d.name}{ctx.view === "all" ? <span className="text-muted"> · {churchName(ctx, d.churchId)}</span> : null}</p>
                  <Gauge used={spent.filter((e) => e.departmentId === d.$id).reduce((a, e) => a + e.amountCents, 0)} total={d.annualBudgetCents!} />
                </div>
              ))}
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
