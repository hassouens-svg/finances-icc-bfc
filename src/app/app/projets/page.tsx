import Link from "next/link";
import { Query } from "node-appwrite";
import { FolderKanban } from "lucide-react";
import { requireContext, canManage, churchName, pickChurch } from "@/server/context";
import { listScoped } from "@/server/data";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Gauge } from "@/components/ui/gauge";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButtons } from "@/components/export-buttons";
import { ProjectDialog } from "./project-dialog";
import { formatDate, formatEuro } from "@/lib/format";
import type { Expense, Project } from "@/lib/types";

export const metadata = { title: "Projets & événements" };

export default async function ProjectsPage() {
  const ctx = await requireContext();
  const [projects, expenses] = await Promise.all([
    listScoped<Project>(ctx, "projects", [Query.equal("archived", false), Query.orderDesc("$createdAt")]),
    listScoped<Expense>(ctx, "expenses", [Query.isNotNull("projectId"), Query.equal("archived", false), Query.select(["projectId", "amountCents", "status"])]),
  ]);
  const { church } = pickChurch(ctx);
  const dialog = church && canManage(ctx, church.$id) ? <ProjectDialog churchId={church.$id} /> : undefined;
  return (
    <>
      <PageHeader title="Projets & événements" description="Budget prévu vs réalisé, dépenses rattachées, jalons." actions={<><ExportButtons entity="projects" />{dialog}</>} />
      {projects.length === 0 ? <EmptyState icon={<FolderKanban />} title="Aucun projet" description="Créez une conférence, un camp, des travaux… pour suivre leur budget." action={dialog} /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((p) => {
            const paid = expenses.filter((e) => e.projectId === p.$id && e.status === "paid").reduce((a, e) => a + e.amountCents, 0);
            return (
              <Link key={p.$id} href={`/app/projets/${p.$id}`}>
                <Card className="h-full p-5 transition-colors hover:border-accent/40">
                  <div className="flex items-start justify-between gap-2"><p className="text-[16px] font-semibold">{p.name}</p><StatusBadge entity="project" status={p.status} /></div>
                  <p className="mt-0.5 text-[13px] text-muted">{ctx.view === "all" ? `${churchName(ctx, p.churchId)} · ` : ""}{p.startDate ? `${formatDate(p.startDate)} → ${formatDate(p.endDate)}` : "Dates non définies"}</p>
                  <p className="num mt-3 text-[13px]">Budget <b>{formatEuro(p.budgetCents)}</b></p>
                  <Gauge className="mt-2" used={paid} total={p.budgetCents} />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
