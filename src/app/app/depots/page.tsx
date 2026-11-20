import { NoAccess } from "@/components/no-access";
import Link from "next/link";
import { Landmark, Plus, Wallet, AlertTriangle } from "lucide-react";
import { Query } from "node-appwrite";
import { requireContext, canManage, churchName, canSeeModule } from "@/server/context";
import { listScoped } from "@/server/data";
import { periodFrom, type PeriodParams } from "@/server/period";
import { getBalances } from "@/server/treasury";
import { getSettings } from "@/server/lookups";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type Col } from "@/components/data/data-table";
import { PeriodFilter } from "@/components/period-filter";
import { ExportButtons } from "@/components/export-buttons";
import { formatEuro } from "@/lib/format";
import type { Deposit } from "@/lib/types";

export const metadata = { title: "Dépôts bancaires" };

export default async function DepositsPage({ searchParams }: { searchParams: Promise<PeriodParams> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  if (!canSeeModule(ctx, "depots")) return <NoAccess />;
  const period = periodFrom(sp, "quarter");
  const [deposits, { balances, accounts }, settings] = await Promise.all([
    listScoped<Deposit>(ctx, "deposits", [Query.greaterThanEqual("date", period.from.toISOString()), Query.lessThan("date", period.to.toISOString()), Query.equal("archived", false), Query.orderDesc("date")]),
    getBalances(ctx),
    getSettings(),
  ]);
  const canWrite = ctx.scopeIds.some((id) => canManage(ctx, id, "depots"));
  const pending = deposits.filter((d) => d.status !== "confirmed");
  const columns: Col[] = [
    { key: "date", label: "Date", type: "date", mobileSecondary: true },
    { key: "reference", label: "Référence", mobilePrimary: true },
    ...(ctx.view === "all" ? [{ key: "church", label: "Église", type: "muted" as const, mobileSecondary: true }] : []),
    { key: "account", label: "Compte", type: "muted" },
    { key: "slip", label: "Bordereau", type: "muted" },
    { key: "status", label: "Statut", type: "status", entity: "deposit" },
    { key: "gap", label: "Écart", type: "money" },
    { key: "total", label: "Montant", type: "money" },
  ];
  const rows = deposits.map((d) => ({ id: d.$id, href: `/app/depots/${d.$id}`, date: d.date, reference: d.reference, church: churchName(ctx, d.churchId), account: accounts.find((a) => a.$id === d.bankAccountId)?.label ?? "—", slip: d.slipNumber ?? "—", status: d.status, gap: d.gapCents || null, total: d.cashCents + d.chequeCents }));
  return (
    <>
      <PageHeader module={6} help="depots" title="Dépôts bancaires" description="L'argent « En caisse » part à la banque : préparé → déposé → confirmé sur le relevé."
        actions={<><PeriodFilter value={period.key} from={sp.from} to={sp.to} />{canWrite && <Button asChild><Link href="/app/depots/nouveau"><Plus /> Nouveau dépôt</Link></Button>}</>} />
      {balances.cash > settings.cashMaxCents && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-[14px] text-warning">
          <AlertTriangle className="size-5 shrink-0" /> <span>La caisse dépasse le plafond de {formatEuro(settings.cashMaxCents)} : pensez à faire un dépôt.</span>
        </div>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="En caisse (à déposer)" value={balances.cash} tone={balances.cash > settings.cashMaxCents ? "warning" : "accent"} icon={<Wallet />} />
        <KpiCard label="À la banque" value={balances.bankTotal} icon={<Landmark />} hint={`${accounts.length} compte(s)`} />
        <KpiCard label="Dépôts non confirmés" value={pending.length} kind="count" hint={formatEuro(pending.reduce((a, d) => a + d.cashCents + d.chequeCents, 0))} />
      </div>
      <DataTable columns={columns} rows={rows} totals={{ total: rows.reduce((a, r) => a + r.total, 0) }} toolbar={<ExportButtons entity="deposits" sp={sp} />}
        filters={[{ key: "status", label: "Statut", options: [{ value: "prepared", label: "Préparé" }, { value: "deposited", label: "Déposé" }, { value: "confirmed", label: "Confirmé" }] }]}
        empty={<EmptyState icon={<Landmark />} title="Aucun dépôt sur la période" description="Créez un dépôt à partir des séances d'offrandes en caisse." action={canWrite ? <Button asChild><Link href="/app/depots/nouveau"><Plus /> Nouveau dépôt</Link></Button> : undefined} />} />
    </>
  );
}
