import Link from "next/link";
import { notFound } from "next/navigation";
import { Query } from "node-appwrite";
import { Pencil, Lock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { requireContext, canManage, churchName } from "@/server/context";
import { getScoped, listScoped } from "@/server/data";
import { getTimeline } from "@/server/entity";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailList, HistoryCard } from "@/components/detail/blocks";
import { ActionButton } from "@/components/action-form";
import { deleteOfferingSessionAction } from "@/server/actions/offerings";
import { UnlockDialog } from "./unlock";
import { formatEuro, formatDate, formatDateTime } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/status";
import { sessionTotals } from "@/lib/finance";
import type { OfferingLine, OfferingSession } from "@/lib/types";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const s = await getScoped<OfferingSession>(ctx, "offering_sessions", id);
  if (!s) notFound();
  const [lines, timeline] = await Promise.all([listScoped<OfferingLine>(ctx, "offering_lines", [Query.equal("sessionId", id)], [s.churchId]), getTimeline("offering_session", id)]);
  const t = sessionTotals(lines, s.countedCashCents, s.countedChequeCents);
  const manage = canManage(ctx, s.churchId);
  const byType = new Map<string, number>();
  for (const l of lines) byType.set(l.donationTypeName ?? "—", (byType.get(l.donationTypeName ?? "—") ?? 0) + l.amountCents);
  const deposited = lines.filter((l) => l.depositId).reduce((a, l) => a + l.amountCents, 0);
  return (
    <>
      <PageHeader
        back={{ href: "/app/offrandes", label: "Dons & offrandes" }}
        eyebrow={<div className="flex gap-2"><StatusBadge entity="offering_session" status={s.status} />{s.status === "validated" && <Badge tone="neutral" dot={false}><Lock className="size-3" /> Verrouillée</Badge>}</div>}
        title={`${s.serviceName ?? "Culte"} du ${formatDate(s.date)}`}
        description={`${s.reference} · ${churchName(ctx, s.churchId)}`}
        actions={
          <>
            {s.status === "draft" && manage && <Button asChild variant="secondary"><Link href={`/app/offrandes/${id}/saisie`}><Pencil /> Continuer la saisie</Link></Button>}
            {s.status === "draft" && manage && <ActionButton variant="danger-soft" action={deleteOfferingSessionAction} payload={{ id }} confirm="Supprimer ce brouillon ?">Supprimer</ActionButton>}
            {s.status === "validated" && ctx.isRegional && <UnlockDialog id={id} />}
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Total", t.entered, "text-accent"], ["Espèces", t.cash, ""], ["Chèques", t.cheque, ""], ["Virement / carte / mobile", t.other, ""]].map(([l, v, c]) => (
          <Card key={l as string} className="p-4"><p className="text-[13px] text-muted">{l}</p><p className={`num mt-1 text-[22px] font-semibold ${c}`}>{formatEuro(v as number)}</p></Card>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title={`Lignes (${lines.length})`} />
            <ul className="divide-y divide-border border-t border-border">
              {lines.map((l) => (
                <li key={l.$id} className="flex items-center gap-3 px-5 py-3 text-[14px]">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{l.donationTypeName}</p>
                    <p className="text-[12px] text-muted">{METHOD_LABELS[l.method]}{l.anonymous ? " · anonyme" : l.donorId ? <> · <Link className="text-accent" href={`/app/donateurs/${l.donorId}`}>{l.donorName}</Link></> : ` · ${l.donorName}`}{l.chequeRef ? ` · chèque n° ${l.chequeRef}` : ""}</p>
                  </div>
                  {l.depositId && <Link href={`/app/depots/${l.depositId}`}><Badge tone="positive" dot={false}>Déposé</Badge></Link>}
                  <span className="num font-semibold">{formatEuro(l.amountCents)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <HistoryCard items={timeline} entityType="offering_session" entityId={id} canComment={manage} />
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Comptage sécurisé" />
            <CardBody>
              <DetailList items={[
                ["Compteur 1", s.counter1Name], ["Compteur 2", s.counter2Name],
                ["Espèces comptées", <span key="a" className="num">{formatEuro(s.countedCashCents)}</span>],
                ["Chèques comptés", <span key="b" className="num">{formatEuro(s.countedChequeCents)}</span>],
                ["Verrouillée le", s.lockedAt ? formatDateTime(s.lockedAt) : "—"],
              ]} />
              <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium ${s.gapCents ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}>
                {s.gapCents ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
                {s.gapCents ? `Écart de comptage : ${formatEuro(s.gapCents, { sign: true })}` : "Comptage conforme"}
              </div>
              {s.notes && <p className="mt-3 rounded-xl bg-surface p-3 text-[13px]">{s.notes}</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Par type de don" />
            <CardBody><DetailList items={[...byType.entries()].map(([k, v]) => [k, <span key={k} className="num">{formatEuro(v)}</span>])} /></CardBody>
          </Card>
          <Card>
            <CardHeader title="Dépôt en banque" />
            <CardBody className="text-[14px]">
              <p><span className="num font-semibold">{formatEuro(deposited)}</span> déposés sur <span className="num">{formatEuro(t.cash + t.cheque)}</span> d&apos;espèces et chèques.</p>
              {manage && s.status === "validated" && deposited < t.cash + t.cheque && <Button asChild className="mt-3" variant="soft"><Link href="/app/depots/nouveau">Préparer un dépôt</Link></Button>}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
