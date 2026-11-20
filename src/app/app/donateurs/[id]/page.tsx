import { notFound } from "next/navigation";
import { Query } from "node-appwrite";
import { FileText } from "lucide-react";
import { requireContext, canManage, churchName } from "@/server/context";
import { getScoped, listScoped } from "@/server/data";
import { getSettings } from "@/server/lookups";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Col } from "@/components/data/data-table";
import { DetailList } from "@/components/detail/blocks";
import { ActionButton } from "@/components/action-form";
import { anonymizeDonorAction } from "@/server/actions/offerings";
import { DonorDialog } from "../donor-dialog";
import { formatEuro } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/status";
import type { Donor, OfferingLine } from "@/lib/types";

export default async function DonorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const d = await getScoped<Donor>(ctx, "donors", id);
  if (!d) notFound();
  const [lines, settings] = await Promise.all([listScoped<OfferingLine>(ctx, "offering_lines", [Query.equal("donorId", id), Query.orderDesc("date")], [d.churchId]), getSettings()]);
  const manage = canManage(ctx, d.churchId, "offrandes");
  const years = [...new Set(lines.map((l) => new Date(l.date).getUTCFullYear()))];
  const columns: Col[] = [{ key: "date", label: "Date", type: "date", mobileSecondary: true }, { key: "type", label: "Type", mobilePrimary: true }, { key: "method", label: "Moyen", type: "muted", mobileSecondary: true }, { key: "amount", label: "Montant", type: "money" }];
  return (
    <>
      <PageHeader back={{ href: "/app/donateurs", label: "Donateurs" }} title={d.fullName} description={churchName(ctx, d.churchId)}
        actions={manage && !d.anonymizedAt ? (
          <>
            <DonorDialog churchId={d.churchId} donor={{ id: d.$id, fullName: d.fullName, email: d.email, phone: d.phone, address: d.address }} />
            <ActionButton variant="danger-soft" action={anonymizeDonorAction} payload={{ id }} confirm="Anonymiser définitivement ce donateur ? Son nom sera effacé ; les montants restent dans la comptabilité.">Anonymiser (RGPD)</ActionButton>
          </>
        ) : undefined}
      />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <DataTable columns={columns} rows={lines.map((l) => ({ id: l.$id, href: `/app/offrandes/${l.sessionId}`, date: l.date, type: l.donationTypeName ?? "", method: METHOD_LABELS[l.method], amount: l.amountCents }))} totals={{ amount: lines.reduce((a, l) => a + l.amountCents, 0) }} />
        <div className="space-y-5">
          <Card><CardHeader title="Fiche" /><CardBody><DetailList items={[["Email", d.email], ["Téléphone", d.phone], ["Adresse", d.address], ["Consentement", d.consentAt ? new Date(d.consentAt).toLocaleDateString("fr-FR") : "—"]]} /></CardBody></Card>
          <Card>
            <CardHeader title="Total par année" />
            <CardBody>
              <DetailList items={years.map((y) => [String(y), <span key={y} className="num">{formatEuro(lines.filter((l) => new Date(l.date).getUTCFullYear() === y).reduce((a, l) => a + l.amountCents, 0))}</span>])} />
              {settings.fiscalReceipts ? (
                <div className="mt-3 flex flex-wrap gap-2">{years.map((y) => <Button key={y} asChild variant="secondary" size="sm"><a href={`/api/receipt/${d.$id}?year=${y}`}><FileText /> Reçu fiscal {y}</a></Button>)}</div>
              ) : <p className="mt-3 text-[12px] text-muted">Reçus fiscaux désactivés (Administration › Alertes & paramètres).</p>}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
