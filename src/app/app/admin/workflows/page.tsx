import { GitBranch, ArrowRight } from "lucide-react";
import { requireContext, assertRegional } from "@/server/context";
import { getWorkflows, getLookups } from "@/server/lookups";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkflowDialog } from "@/components/admin/forms";
import { ActionButton } from "@/components/action-form";
import { archiveRowAction } from "@/server/actions/admin";
import { formatEuro } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/status";

export const metadata = { title: "Circuits de validation" };

export default async function WorkflowsPage() {
  const ctx = await requireContext();
  assertRegional(ctx);
  const [wfs, lk] = await Promise.all([getWorkflows(), getLookups("")]);
  const churches = ctx.allChurches.map((c) => ({ value: c.$id, label: c.name }));
  const categories = lk.categories.map((c) => ({ value: c.$id, label: c.name }));
  const sorted = [...wfs].sort((a, b) => (a.churchId === "region" ? -1 : 1) - (b.churchId === "region" ? -1 : 1) || a.minCents - b.minCents);
  return (
    <>
      <PageHeader
        back={{ href: "/app/admin", label: "Administration" }}
        title="Circuits de validation"
        description="Aucune dépense ne peut être payée avant la fin de son circuit — même avancée par quelqu'un (régularisation)."
        actions={<WorkflowDialog churches={churches} categories={categories} />}
      />
      {sorted.length === 0 ? (
        <EmptyState icon={<GitBranch />} title="Aucune règle" description="Sans règle, chaque dépense est validée par le trésorier seul." action={<WorkflowDialog churches={churches} categories={categories} />} />
      ) : (
        <div className="space-y-3">
          {sorted.map((w) => (
            <Card key={w.$id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
                  {w.name}
                  <Badge tone="neutral" dot={false}>{w.churchId === "region" ? "Toutes les églises" : ctx.allChurches.find((c) => c.$id === w.churchId)?.name}</Badge>
                </p>
                <p className="num mt-0.5 text-[13px] text-muted">
                  {w.maxCents ? `De ${formatEuro(w.minCents)} à ${formatEuro(w.maxCents)} (exclu)` : `À partir de ${formatEuro(w.minCents)}`}
                  {w.categoryIds.length ? ` · ${w.categoryIds.map((id) => lk.categories.find((c) => c.$id === id)?.name).filter(Boolean).join(", ")}` : " · toutes catégories"}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {w.stepRoles.map((r, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      {i > 0 && <ArrowRight className="size-3.5 text-muted" />}
                      <Badge tone={r === "mother_admin" ? "done" : "progress"} dot={false}>{i + 1}. {ROLE_LABELS[r]} · {w.stepDelaysHours[i] ?? 72} h</Badge>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex">
                <WorkflowDialog churches={churches} categories={categories} wf={{ id: w.$id, churchId: w.churchId, name: w.name, minCents: w.minCents, maxCents: w.maxCents, stepRoles: w.stepRoles, stepDelaysHours: w.stepDelaysHours, categoryIds: w.categoryIds, priority: w.priority }} />
                <ActionButton variant="ghost" size="sm" action={archiveRowAction} payload={{ table: "approval_workflows", id: w.$id }} confirm="Supprimer cette règle ?">Supprimer</ActionButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
