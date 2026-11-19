import { Users } from "lucide-react";
import { Query } from "node-appwrite";
import { requireContext, churchName, canManage, pickChurch } from "@/server/context";
import { listScoped } from "@/server/data";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Col } from "@/components/data/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { DonorDialog } from "./donor-dialog";
import type { Donor, OfferingLine } from "@/lib/types";

export const metadata = { title: "Donateurs" };

export default async function DonorsPage() {
  const ctx = await requireContext();
  const year = new Date().getUTCFullYear();
  const [donors, lines] = await Promise.all([
    listScoped<Donor>(ctx, "donors", [Query.orderAsc("fullName")]),
    listScoped<OfferingLine>(ctx, "offering_lines", [Query.isNotNull("donorId"), Query.greaterThanEqual("date", `${year}-01-01`), Query.select(["donorId", "amountCents", "date"])]),
  ]);
  const totals = new Map<string, { sum: number; last: string }>();
  for (const l of lines) {
    const t = totals.get(l.donorId!) ?? { sum: 0, last: "" };
    t.sum += l.amountCents;
    if (l.date > t.last) t.last = l.date;
    totals.set(l.donorId!, t);
  }
  const { church } = pickChurch(ctx);
  const columns: Col[] = [
    { key: "name", label: "Donateur", mobilePrimary: true },
    ...(ctx.view === "all" ? [{ key: "church", label: "Église", type: "muted" as const, mobileSecondary: true }] : []),
    { key: "contact", label: "Contact", type: "muted" },
    { key: "last", label: "Dernier don", type: "date", mobileSecondary: true },
    { key: "total", label: `Dons ${year}`, type: "money" },
  ];
  const rows = donors.map((d) => ({ id: d.$id, href: `/app/donateurs/${d.$id}`, name: d.fullName, church: churchName(ctx, d.churchId), contact: [d.email, d.phone].filter(Boolean).join(" · ") || "—", last: totals.get(d.$id)?.last ?? null, total: totals.get(d.$id)?.sum ?? 0 }));
  return (
    <>
      <PageHeader title="Donateurs" description="Seuls les dons nominatifs ont une fiche. Données limitées au nécessaire (RGPD)." actions={church && canManage(ctx, church.$id) ? <DonorDialog churchId={church.$id} /> : undefined} />
      <DataTable columns={columns} rows={rows} totals={{ total: rows.reduce((a, r) => a + r.total, 0) }} empty={<EmptyState icon={<Users />} title="Aucun donateur" description="Les fiches sont créées automatiquement lors de la saisie d'un don nominatif." />} />
    </>
  );
}
