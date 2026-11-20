import { NoAccess } from "@/components/no-access";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Send } from "lucide-react";
import { requireContext, canManage, churchName, canSeeModule } from "@/server/context";
import { getScoped } from "@/server/data";
import { getTimeline, getAttachments } from "@/server/entity";
import { getLookups } from "@/server/lookups";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge, PriorityBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailList, AttachmentsCard, HistoryCard } from "@/components/detail/blocks";
import { TransitionButton } from "@/components/detail/client";
import { ActionButton } from "@/components/action-form";
import { submitCrAction } from "@/server/actions/cr";
import { ReceiveDialog } from "./receive";
import { allowedTransitions } from "@/lib/transitions";
import { formatEuro, formatDate } from "@/lib/format";
import type { CrRequest } from "@/lib/types";

export default async function CrDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  if (!canSeeModule(ctx, "citeroyale")) return <NoAccess />;
  const c = await getScoped<CrRequest>(ctx, "cr_requests", id);
  if (!c) notFound();
  const [lk, timeline, atts] = await Promise.all([getLookups(c.churchId), getTimeline("cr_request", id), getAttachments("cr_request", id)]);
  const manage = canManage(ctx, c.churchId, "citeroyale");
  const transitions = allowedTransitions("cr_request", c.status).filter((t) => c.status !== "draft");
  const canAct = c.status === "mother_review" ? ctx.isRegional : manage;
  const gap = c.receivedCents != null && c.estimatedCents ? c.receivedCents - c.estimatedCents : null;
  return (
    <>
      <PageHeader back={{ href: "/app/cite-royale", label: "Demandes Cité Royale" }}
        eyebrow={<div className="flex flex-wrap gap-2"><StatusBadge entity="cr_request" status={c.status} /><PriorityBadge priority={c.priority} />{c.viaMother && <Badge tone="neutral" dot={false}>Via l&apos;église mère</Badge>}</div>}
        title={c.title} description={`${c.reference} · ${churchName(ctx, c.churchId)}`}
        actions={
          <>
            {manage && c.status === "draft" && <ActionButton action={submitCrAction} payload={{ id }}><Send /> Lancer la demande</ActionButton>}
            {canAct && transitions.map((t) => <TransitionButton key={t.to} entityType="cr_request" entityId={id} {...t} />)}
            {manage && ["approved", "received_partial"].includes(c.status) && <ReceiveDialog id={id} />}
            {manage && c.status !== "closed" && <Button asChild variant="secondary"><Link href={`/app/cite-royale/${id}/modifier`}><Pencil /> Modifier</Link></Button>}
          </>
        } />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          {(c.reason || c.description) && <Card><CardHeader title="Motif & description" /><CardBody className="space-y-2 whitespace-pre-wrap text-[14px]"><p>{c.reason}</p>{c.description && <p className="text-muted">{c.description}</p>}</CardBody></Card>}
          <AttachmentsCard items={atts} entityType="cr_request" entityId={id} canUpload={manage} />
          <HistoryCard items={timeline} entityType="cr_request" entityId={id} canComment={manage || ctx.isRegional} />
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Détail" />
            <CardBody>
              <DetailList items={[
                ["Type", lk.crTypes.find((t) => t.$id === c.typeId)?.name], ["Quantité", c.quantity ?? "—"],
                ["Montant estimé", c.estimatedCents != null ? <span key="e" className="num">{formatEuro(c.estimatedCents)}</span> : "—"],
                ["Date souhaitée", formatDate(c.wishedDate)], ["Département", lk.departments.find((d) => d.$id === c.departmentId)?.name],
                ["Contact interne", c.contactName], ["Canal d'envoi", c.sendChannel], ["Réf. Cité Royale", c.crReference],
              ]} />
            </CardBody>
          </Card>
          {(c.receivedAt || c.receivedCents != null) && (
            <Card>
              <CardHeader title="Réception" />
              <CardBody>
                <DetailList items={[
                  ["Reçu le", formatDate(c.receivedAt)], ["Montant reçu", c.receivedCents != null ? <span key="r" className="num">{formatEuro(c.receivedCents)}</span> : "—"],
                  ["Quantité reçue", c.receivedQuantity ?? "—"], ["Écart avec la demande", gap ? <span key="g" className="num text-warning">{formatEuro(gap, { sign: true })}</span> : "Aucun"],
                ]} />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
