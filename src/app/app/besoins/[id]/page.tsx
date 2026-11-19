import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContext, canManage, churchName } from "@/server/context";
import { getScoped } from "@/server/data";
import { getTimeline, getAttachments } from "@/server/entity";
import { getLookups, forChurch } from "@/server/lookups";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { DetailList, AttachmentsCard, HistoryCard } from "@/components/detail/blocks";
import { TransitionButton } from "@/components/detail/client";
import { ApproveFundingDialog, ConvertFundingDialog } from "./dialogs";
import { allowedTransitions } from "@/lib/transitions";
import { formatEuro, formatDate } from "@/lib/format";
import type { FundingRequest } from "@/lib/types";

export default async function FundingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const f = await getScoped<FundingRequest>(ctx, "funding_requests", id);
  if (!f) notFound();
  const [lk, timeline, atts] = await Promise.all([getLookups(f.churchId), getTimeline("funding_request", id), getAttachments("funding_request", id)]);
  const manage = canManage(ctx, f.churchId);
  const transitions = allowedTransitions("funding_request", f.status).filter((t) => !["approved", "partially_approved"].includes(t.to));
  const approved = ["approved", "partially_approved"].includes(f.status);
  return (
    <>
      <PageHeader back={{ href: "/app/besoins", label: "Besoins des départements" }}
        eyebrow={<div className="flex gap-2"><StatusBadge entity="funding_request" status={f.status} /><PriorityBadge priority={f.priority} /></div>}
        title={f.title} description={`${f.reference} · ${churchName(ctx, f.churchId)} · ${lk.departments.find((d) => d.$id === f.departmentId)?.name ?? "Sans département"}`}
        actions={manage ? (
          <>
            {f.status === "reviewing" && <ApproveFundingDialog id={id} estimated={f.estimatedCents} />}
            {transitions.map((t) => <TransitionButton key={t.to} entityType="funding_request" entityId={id} {...t} />)}
            {approved && !f.convertedToId && <ConvertFundingDialog id={id} categories={forChurch(lk.categories, f.churchId).map((c) => ({ id: c.$id, name: c.name }))} />}
          </>
        ) : undefined}
      />
      {f.convertedToId && (
        <p className="mb-5 rounded-xl bg-accent-soft px-4 py-3 text-[14px] text-accent-strong">
          Converti en {f.convertedToType === "expense" ? "dépense" : "demande à la Cité Royale"} : <Link className="font-semibold underline" href={f.convertedToType === "expense" ? `/app/depenses/${f.convertedToId}` : `/app/cite-royale/${f.convertedToId}`}>voir</Link>
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          {f.description && <Card><CardHeader title="Description" /><CardBody className="whitespace-pre-wrap text-[14px]">{f.description}</CardBody></Card>}
          <AttachmentsCard items={atts} entityType="funding_request" entityId={id} canUpload={manage} />
          <HistoryCard items={timeline} entityType="funding_request" entityId={id} canComment={manage} />
        </div>
        <Card>
          <CardHeader title="Détail" />
          <CardBody>
            <DetailList items={[
              ["Montant estimé", <span key="e" className="num">{formatEuro(f.estimatedCents)}</span>],
              ["Montant approuvé", f.approvedCents != null ? <span key="a" className="num text-success">{formatEuro(f.approvedCents)}</span> : "—"],
              ["Date souhaitée", formatDate(f.wishedDate)], ["Demandeur", f.requesterName], ["Email", f.requesterEmail], ["Téléphone", f.requesterPhone],
              ["Reçu le", formatDate(f.$createdAt)], ["Décision", f.decisionComment],
            ]} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
