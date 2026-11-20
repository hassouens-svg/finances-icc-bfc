import Link from "next/link";
import { HandCoins, Plus, Wallet, Banknote, ScrollText } from "lucide-react";
import { Query } from "node-appwrite";
import { requireContext, canManage, churchName } from "@/server/context";
import { listScoped } from "@/server/data";
import { periodFrom, type PeriodParams } from "@/server/period";
import { getCashInHand } from "@/server/treasury";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type Col } from "@/components/data/data-table";
import { PeriodFilter } from "@/components/period-filter";
import { ExportButtons } from "@/components/export-buttons";
import { FileUp } from "lucide-react";
import type { OfferingLine, OfferingSession } from "@/lib/types";

export const metadata = { title: "Dons & offrandes" };

export default async function OfferingsPage({ searchParams }: { searchParams: Promise<PeriodParams> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const period = periodFrom(sp);
  const range = [Query.greaterThanEqual("date", period.from.toISOString()), Query.lessThan("date", period.to.toISOString())];
  const [sessions, lines, cash] = await Promise.all([
    listScoped<OfferingSession>(ctx, "offering_sessions", [...range, Query.orderDesc("date")]),
    listScoped<OfferingLine>(ctx, "offering_lines", [...range, Query.select(["$id", "amountCents", "method", "sessionId", "donationTypeName"])]),
    getCashInHand(ctx),
  ]);
  const total = lines.reduce((a, l) => a + l.amountCents, 0);
  const cashLike = lines.filter((l) => l.method === "cash" || l.method === "cheque").reduce((a, l) => a + l.amountCents, 0);
  const tithes = lines.filter((l) => /d[iî]me/i.test(l.donationTypeName ?? "")).reduce((a, l) => a + l.amountCents, 0);
  const canWrite = ctx.scopeIds.some((id) => canManage(ctx, id));
  const columns: Col[] = [
    { key: "date", label: "Date", type: "date", mobileSecondary: true },
    { key: "service", label: "Culte", mobilePrimary: true },
    ...(ctx.view === "all" ? [{ key: "church", label: "Église", type: "muted" as const, mobileSecondary: true }] : []),
    { key: "reference", label: "Référence", type: "muted" },
    { key: "counters", label: "Compteurs", type: "muted" },
    { key: "status", label: "Statut", type: "status", entity: "offering_session" },
    { key: "gap", label: "Écart", type: "money" as const, align: "right" },
    { key: "total", label: "Total", type: "money" },
  ];
  const rows = sessions.map((s) => ({
    id: s.$id, href: s.status === "draft" ? `/app/offrandes/${s.$id}/saisie` : `/app/offrandes/${s.$id}`, date: s.date, service: s.serviceName ?? "Culte", church: churchName(ctx, s.churchId), reference: s.reference,
    counters: [s.counter1Name, s.counter2Name].filter(Boolean).join(" & ") || "—", status: s.status, gap: s.gapCents || null, total: s.enteredTotalCents,
  }));
  return (
    <>
      <PageHeader module={4} help="offrandes"
        title="Dons & offrandes"
        description="Saisie par culte, comptage à deux, verrouillage après validation."
        actions={
          <>
            <PeriodFilter value={period.key} from={sp.from} to={sp.to} />{canWrite && <Button asChild variant="secondary"><Link href="/app/import"><FileUp /> Importer Excel</Link></Button>}
            {canWrite && <Button asChild><Link href="/app/offrandes/nouvelle"><Plus /> Saisir des offrandes</Link></Button>}
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Argent entré" value={total} tone="accent" icon={<HandCoins />} hint={period.label} />
        <KpiCard label="Dont dîmes" value={tithes} icon={<ScrollText />} hint={total ? `${Math.round((tithes / total) * 100)} % des dons` : "—"} />
        <KpiCard label="Espèces & chèques" value={cashLike} icon={<Banknote />} hint="à déposer en banque" />
        <KpiCard label="En caisse aujourd'hui" value={cash} tone={cash > 0 ? "warning" : "default"} icon={<Wallet />} href="/app/depots/nouveau" hint="Faire un dépôt →" />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        totals={{ total: rows.reduce((a, r) => a + r.total, 0) }}
        filters={[{ key: "status", label: "Statut", options: [{ value: "draft", label: "En cours de saisie" }, { value: "validated", label: "Validée" }] }]}
        toolbar={<ExportButtons entity="offerings" sp={sp} />}
        empty={<EmptyState icon={<HandCoins />} title="Aucune offrande sur cette période" description="Saisissez la première séance : cela prend moins de 2 minutes." action={canWrite ? <Button asChild><Link href="/app/offrandes/nouvelle"><Plus /> Ajouter la première</Link></Button> : undefined} />}
      />
    </>
  );
}
