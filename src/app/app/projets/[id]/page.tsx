import Link from "next/link";
import { notFound } from "next/navigation";
import { Query } from "node-appwrite";
import { Plus, CheckCircle2, Circle } from "lucide-react";
import { requireContext, canManage, churchName } from "@/server/context";
import { getScoped, listScoped } from "@/server/data";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Gauge } from "@/components/ui/gauge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable, type Col } from "@/components/data/data-table";
import { ProjectDialog } from "../project-dialog";
import { formatDate } from "@/lib/format";
import type { Expense, Project } from "@/lib/types";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const p = await getScoped<Project>(ctx, "projects", id);
  if (!p) notFound();
  const expenses = await listScoped<Expense>(ctx, "expenses", [Query.equal("projectId", id), Query.equal("archived", false), Query.orderDesc("date")], [p.churchId]);
  const paid = expenses.filter((e) => e.status === "paid").reduce((a, e) => a + e.amountCents, 0);
  const committed = expenses.filter((e) => ["approved", "in_approval", "submitted"].includes(e.status)).reduce((a, e) => a + e.amountCents, 0);
  const ms: { label: string; done: boolean }[] = (() => { try { return JSON.parse(p.milestonesJson ?? "[]"); } catch { return []; } })();
  const manage = canManage(ctx, p.churchId, "depenses");
  const columns: Col[] = [{ key: "date", label: "Date", type: "date", mobileSecondary: true }, { key: "title", label: "Dépense", mobilePrimary: true }, { key: "category", label: "Catégorie", type: "muted" }, { key: "status", label: "Statut", type: "status", entity: "expense" }, { key: "amount", label: "Montant", type: "money" }];
  return (
    <>
      <PageHeader back={{ href: "/app/projets", label: "Projets & événements" }} eyebrow={<StatusBadge entity="project" status={p.status} />} title={p.name}
        description={`${churchName(ctx, p.churchId)}${p.startDate ? ` · ${formatDate(p.startDate)} → ${formatDate(p.endDate)}` : ""}${p.ownerName ? ` · ${p.ownerName}` : ""}`}
        actions={manage ? <><ProjectDialog churchId={p.churchId} project={{ id: p.$id, name: p.name, description: p.description, budgetCents: p.budgetCents, startDate: p.startDate, endDate: p.endDate, ownerName: p.ownerName, status: p.status, milestones: ms }} /><Button asChild><Link href={`/app/depenses/nouvelle?project=${p.$id}`}><Plus /> Dépense</Link></Button></> : undefined} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Budget prévu" value={p.budgetCents} />
        <KpiCard label="Réalisé (payé)" value={paid} tone="accent" />
        <KpiCard label="Engagé" value={committed} hint="approuvé ou en validation" />
        <KpiCard label="Reste" value={p.budgetCents - paid - committed} tone={p.budgetCents - paid - committed < 0 ? "negative" : "positive"} />
      </div>
      <Card className="mb-5 p-5"><Gauge used={paid + committed} total={p.budgetCents} /></Card>
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <DataTable columns={columns} rows={expenses.map((e) => ({ id: e.$id, href: `/app/depenses/${e.$id}`, date: e.date, title: e.title, category: e.categoryName ?? "", status: e.status, amount: e.amountCents }))} totals={{ amount: expenses.reduce((a, e) => a + e.amountCents, 0) }} />
        <div className="space-y-5">
          {p.description && <Card><CardHeader title="Description" /><CardBody className="text-[14px]">{p.description}</CardBody></Card>}
          <Card>
            <CardHeader title="Jalons" />
            <CardBody>
              {ms.length === 0 ? <p className="text-[13px] text-muted">Aucun jalon.</p> : (
                <ul className="space-y-2 text-[14px]">{ms.map((m, i) => <li key={i} className="flex items-center gap-2">{m.done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted" />}<span className={m.done ? "text-muted line-through" : ""}>{m.label}</span></li>)}</ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
