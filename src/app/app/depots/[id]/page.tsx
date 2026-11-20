import Link from "next/link";
import { notFound } from "next/navigation";
import { Query } from "node-appwrite";
import { requireContext, canManage, churchName } from "@/server/context";
import { getScoped, listScoped } from "@/server/data";
import { getTimeline, getAttachments } from "@/server/entity";
import { getLookups } from "@/server/lookups";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { DetailList, AttachmentsCard, HistoryCard } from "@/components/detail/blocks";
import { TransitionButton } from "@/components/detail/client";
import { ActionButton } from "@/components/action-form";
import { cancelDepositAction } from "@/server/actions/deposits";
import { ConfirmDepositDialog } from "./confirm";
import { formatEuro, formatDate } from "@/lib/format";
import type { Deposit, OfferingLine, OfferingSession } from "@/lib/types";

export default async function DepositPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const d = await getScoped<Deposit>(ctx, "deposits", id);
  if (!d) notFound();
  const [lk, timeline, atts, lines, sessions] = await Promise.all([
    getLookups(d.churchId), getTimeline("deposit", id), getAttachments("deposit", id),
    listScoped<OfferingLine>(ctx, "offering_lines", [Query.equal("depositId", id)], [d.churchId]),
    d.sessionIds?.length ? listScoped<OfferingSession>(ctx, "offering_sessions", [Query.equal("$id", d.sessionIds)], [d.churchId]) : Promise.resolve([]),
  ]);
  const manage = canManage(ctx, d.churchId, "depots");
  const cheques = lines.filter((l) => l.method === "cheque");
  return (
    <>
      <PageHeader back={{ href: "/app/depots", label: "Dépôts bancaires" }} eyebrow={<StatusBadge entity="deposit" status={d.status} />}
        title={`Dépôt de ${formatEuro(d.cashCents + d.chequeCents)}`} description={`${d.reference} · ${churchName(ctx, d.churchId)} · ${formatDate(d.date)}`}
        actions={manage ? (
          <>
            {d.status === "prepared" && <TransitionButton entityType="deposit" entityId={id} to="deposited" label="Marquer déposé à la banque" />}
            {d.status === "prepared" && <ActionButton variant="danger-soft" action={cancelDepositAction} payload={{ id }} confirm="Annuler ce dépôt ? Les séances redeviennent « en caisse ».">Annuler</ActionButton>}
            {d.status === "deposited" && <ConfirmDepositDialog id={id} expected={d.cashCents + d.chequeCents} />}
          </>
        ) : undefined}
      />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Détail" />
            <CardBody>
              <DetailList items={[
                ["Compte", lk.bankAccounts.find((a) => a.$id === d.bankAccountId)?.label],
                ["Espèces", <span key="c" className="num">{formatEuro(d.cashCents)}</span>],
                ["Chèques", <span key="q" className="num">{formatEuro(d.chequeCents)} ({cheques.length})</span>],
                ["Déposant", d.depositorName], ["N° de bordereau", d.slipNumber],
                ["Montant confirmé", d.confirmedCents != null ? <span key="k" className="num">{formatEuro(d.confirmedCents)}</span> : "—"],
                ["Date de valeur", d.valueDate ? formatDate(d.valueDate) : "—"],
                ["Écart", d.gapCents ? <span key="g" className="num text-danger">{formatEuro(d.gapCents, { sign: true })}</span> : "Aucun"],
              ]} />
            </CardBody>
          </Card>
          {sessions.length > 0 && (
            <Card>
              <CardHeader title="Séances concernées" />
              <ul className="divide-y divide-border border-t border-border">
                {sessions.map((s) => <li key={s.$id}><Link href={`/app/offrandes/${s.$id}`} className="flex justify-between px-5 py-3 text-[14px] hover:bg-surface"><span>{s.serviceName} du {formatDate(s.date)}</span><span className="text-muted">{s.reference}</span></Link></li>)}
              </ul>
            </Card>
          )}
          {cheques.length > 0 && (
            <Card>
              <CardHeader title="Chèques remis" />
              <ul className="divide-y divide-border border-t border-border">
                {cheques.map((c) => <li key={c.$id} className="flex justify-between px-5 py-2.5 text-[14px]"><span>{c.chequeRef ? `N° ${c.chequeRef}` : "Chèque"}{c.donorName ? ` — ${c.donorName}` : ""}</span><span className="num font-medium">{formatEuro(c.amountCents)}</span></li>)}
              </ul>
            </Card>
          )}
        </div>
        <div className="space-y-5">
          <AttachmentsCard items={atts} entityType="deposit" entityId={id} canUpload={manage} />
          <HistoryCard items={timeline} entityType="deposit" entityId={id} canComment={manage} />
        </div>
      </div>
    </>
  );
}
