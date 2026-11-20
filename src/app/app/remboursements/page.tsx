import { NoAccess } from "@/components/no-access";
import Link from "next/link";
import { RotateCcw, Link2 } from "lucide-react";
import { Query } from "node-appwrite";
import { requireContext, churchName, canManage, canSeeModule } from "@/server/context";
import { listScoped } from "@/server/data";
import { PageHeader } from "@/components/ui/page-header";
import { PublicLinksPanel } from "@/components/public-links-panel";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type Col } from "@/components/data/data-table";
import { ExportButtons } from "@/components/export-buttons";
import { STATUS } from "@/lib/status";
import { formatEuro } from "@/lib/format";
import type { Reimbursement } from "@/lib/types";

export const metadata = { title: "Remboursements" };

export default async function ReimbursementsPage() {
  const ctx = await requireContext();
  if (!canSeeModule(ctx, "remboursements")) return <NoAccess />;
  const items = await listScoped<Reimbursement>(ctx, "reimbursements", [Query.orderDesc("$createdAt")]);
  const s = (st: string[]) => items.filter((i) => st.includes(i.status));
  const columns: Col[] = [
    { key: "date", label: "Reçue le", type: "date", mobileSecondary: true },
    { key: "requester", label: "Demandeur", mobilePrimary: true },
    ...(ctx.view === "all" ? [{ key: "church", label: "Église", type: "muted" as const, mobileSecondary: true }] : []),
    { key: "reason", label: "Motif", type: "muted" },
    { key: "reference", label: "Référence", type: "muted" },
    { key: "status", label: "Statut", type: "status", entity: "reimbursement" },
    { key: "amount", label: "Montant", type: "money" },
  ];
  const rows = items.map((r) => ({ id: r.$id, href: `/app/remboursements/${r.$id}`, date: r.$createdAt, requester: r.requesterName, church: churchName(ctx, r.churchId), reason: (r.reason ?? "").slice(0, 60), reference: r.reference, status: r.status, amount: r.amountCents }));
  const canLinks = ctx.scopeIds.some((id) => canManage(ctx, id, "remboursements"));
  return (
    <>
      <PageHeader module={3} help="remboursements" title="Remboursements" description="Demandes envoyées via le lien public, avec justificatif photo." />
      <PublicLinksPanel ctx={ctx} kind="reimbursement" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="À traiter" value={s(["submitted", "checking"]).length} kind="count" tone="warning" hint={formatEuro(s(["submitted", "checking"]).reduce((a, r) => a + r.amountCents, 0))} />
        <KpiCard label="Validés, à payer" value={s(["approved"]).reduce((a, r) => a + r.amountCents, 0)} />
        <KpiCard label="Remboursés" value={s(["paid"]).reduce((a, r) => a + r.amountCents, 0)} tone="positive" />
        <KpiCard label="Refusés" value={s(["rejected"]).length} kind="count" />
      </div>
      <DataTable columns={columns} rows={rows} toolbar={<ExportButtons entity="reimbursements" sp={{ p: "all" }} />}
        filters={[{ key: "status", label: "Statut", options: Object.entries(STATUS.reimbursement!).map(([value, d]) => ({ value, label: d.label })) }]}
        empty={<EmptyState icon={<RotateCcw />} title="Aucune demande de remboursement" description="Partagez le lien public (WhatsApp, QR code) : les membres y joignent la photo de leur ticket." />} />
    </>
  );
}
