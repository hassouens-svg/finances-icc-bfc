import { Query } from "node-appwrite";
import { CheckCircle2, SearchX } from "lucide-react";
import { adminList, adminGet } from "@/server/data";
import { getTimeline, getAttachments } from "@/server/entity";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Timeline } from "@/components/ui/timeline";
import { DetailList } from "@/components/detail/blocks";
import { CopyButton } from "@/components/copy-button";
import { PublicShell } from "../../public-shell";
import { formatEuro, formatDate } from "@/lib/format";
import type { Church, FundingRequest, Reimbursement } from "@/lib/types";

export const metadata = { title: "Suivi de ma demande", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TrackingPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ nouveau?: string }> }) {
  const { token } = await params;
  const isNew = (await searchParams).nouveau === "1";
  if (!/^[\w-]{20,64}$/.test(token)) return <PublicShell><EmptyState icon={<SearchX />} title="Demande introuvable" /></PublicShell>;
  const [f] = await adminList<FundingRequest>("funding_requests", [Query.equal("trackingToken", token), Query.limit(1)]);
  const [r] = f ? [] : await adminList<Reimbursement>("reimbursements", [Query.equal("trackingToken", token), Query.limit(1)]);
  const item = f ?? r;
  if (!item) return <PublicShell><EmptyState icon={<SearchX />} title="Demande introuvable" description="Vérifiez le lien reçu par email." /></PublicShell>;
  const entity = f ? "funding_request" : "reimbursement";
  const church = await adminGet<Church>("churches", item.churchId);
  const [timeline, atts] = await Promise.all([getTimeline(entity, item.$id, false), getAttachments(entity, item.$id)]);
  const url = `${process.env.APP_URL ?? ""}/suivi/${token}`;
  return (
    <PublicShell church={church?.name}>
      {isNew && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-success/30 bg-success-soft p-4 text-success">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div className="text-[14px]"><p className="font-semibold">Demande envoyée !</p><p className="mt-0.5 text-fg/80">Gardez ce lien : il vous permet de suivre votre demande à tout moment, sans compte.</p><div className="mt-2"><CopyButton value={url} label="Copier mon lien de suivi" /></div></div>
        </div>
      )}
      <p className="text-[13px] text-muted">{item.reference}</p>
      <h1 className="mt-1 text-[24px] font-semibold tracking-tight">{f ? f.title : `Remboursement — ${formatEuro(r!.amountCents)}`}</h1>
      <div className="mb-5 mt-3"><StatusBadge entity={entity} status={item.status} className="h-7 px-3 text-[13px]" /></div>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Votre demande" />
          <CardBody>
            <DetailList items={f ? [
              ["Montant estimé", <span key="a" className="num">{formatEuro(f.estimatedCents)}</span>],
              ...(f.approvedCents != null ? [["Montant approuvé", <span key="b" className="num font-semibold text-success">{formatEuro(f.approvedCents)}</span>]] as [string, React.ReactNode][] : []),
              ["Envoyée le", formatDate(f.$createdAt)], ["Décision", f.decisionComment],
            ] : [
              ["Montant", <span key="c" className="num">{formatEuro(r!.amountCents)}</span>], ["Motif", r!.reason], ["Date de la dépense", formatDate(r!.expenseDate)],
              ["Envoyée le", formatDate(r!.$createdAt)], ...(r!.rejectReason ? [["Motif du refus", r!.rejectReason]] as [string, string][] : []),
              ...(r!.paidAt ? [["Remboursée le", formatDate(r!.paidAt)]] as [string, string][] : []),
              ["Justificatifs", `${atts.length} fichier(s)`],
            ]} />
          </CardBody>
        </Card>
        <Card><CardHeader title="Étapes" /><CardBody><Timeline items={timeline} /></CardBody></Card>
      </div>
      <p className="mt-6 text-center text-[12px] text-muted">Une question ? Contactez la trésorerie de {church?.name}.</p>
    </PublicShell>
  );
}
