import Link from "next/link";
import { Query } from "node-appwrite";
import { CheckCheck, Paperclip } from "lucide-react";
import { requireContext, canApproveAs, churchName } from "@/server/context";
import { listScoped } from "@/server/data";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ApprovalButtons } from "@/components/expenses/approval";
import { currentRole } from "@/lib/workflow";
import { formatEuro, formatDate, relativeDays } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/status";
import type { Attachment, Expense } from "@/lib/types";

export const metadata = { title: "À valider" };

export default async function ToApprovePage() {
  const ctx = await requireContext();
  const pending = await listScoped<Expense>(ctx, "expenses", [Query.equal("status", "in_approval"), Query.equal("archived", false), Query.orderAsc("stepStartedAt")]);
  const mine = pending.filter((e) => { const r = currentRole(e); return r && canApproveAs(ctx, e.churchId, r); });
  const others = pending.filter((e) => !mine.includes(e));
  const atts = mine.length ? await listScoped<Attachment>(ctx, "attachments", [Query.equal("entityType", "expense"), Query.equal("entityId", mine.map((e) => e.$id))]) : [];
  return (
    <>
      <PageHeader title="À valider" description="Les dépenses qui attendent votre décision. Approuvez, refusez ou demandez une précision." />
      {mine.length === 0 ? (
        <EmptyState icon={<CheckCheck />} title="Rien à valider pour le moment 🎉" description="Vous serez notifié dès qu'une dépense attendra votre validation." />
      ) : (
        <div className="space-y-3">
          {mine.map((e) => {
            const role = currentRole(e)!;
            const late = e.stepStartedAt && Date.now() - new Date(e.stepStartedAt).getTime() > 72 * 3600_000;
            const n = atts.filter((a) => a.entityId === e.$id).length;
            return (
              <Card key={e.$id} className="p-4 sm:p-5">
                <Link href={`/app/depenses/${e.$id}`} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[16px] font-semibold">{e.title}</p>
                      <p className="mt-0.5 text-[13px] text-muted">{churchName(ctx, e.churchId)} · {e.categoryName} · {formatDate(e.date)}</p>
                    </div>
                    <p className="num shrink-0 text-[20px] font-semibold text-accent">{formatEuro(e.amountCents)}</p>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Badge tone="progress" dot={false}>Étape {e.currentStep}/{e.totalSteps} · {ROLE_LABELS[role]}</Badge>
                    {e.isRegularization && <Badge tone="waiting" dot={false}>Régularisation</Badge>}
                    {late && <Badge tone="negative">En retard · {relativeDays(e.stepStartedAt!)}</Badge>}
                    {n > 0 && <Badge tone="neutral" dot={false}><Paperclip className="size-3" /> {n} justificatif(s)</Badge>}
                  </div>
                </Link>
                <div className="mt-4"><ApprovalButtons id={e.$id} compact /></div>
              </Card>
            );
          })}
        </div>
      )}
      {others.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-[15px] font-semibold">En attente d&apos;autres valideurs</h2>
          <Card className="divide-y divide-border">
            {others.map((e) => (
              <Link key={e.$id} href={`/app/depenses/${e.$id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface">
                <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-medium">{e.title}</p><p className="text-[12px] text-muted">{churchName(ctx, e.churchId)} · attend : {ROLE_LABELS[currentRole(e) ?? ""]}</p></div>
                <StatusBadge entity="expense" status={e.status} suffix={`${e.currentStep}/${e.totalSteps}`} />
                <span className="num text-[14px] font-medium">{formatEuro(e.amountCents)}</span>
              </Link>
            ))}
          </Card>
        </div>
      )}
    </>
  );
}
