import { FileSpreadsheet, FileText, FileBarChart } from "lucide-react";
import { requireContext } from "@/server/context";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PeriodFilter } from "@/components/period-filter";
import type { PeriodParams } from "@/server/period";

export const metadata = { title: "Rapports & exports" };

const LIST = [
  ["offerings", "Rapport des offrandes", "Séances, compteurs, écarts et totaux"],
  ["offering_lines", "Détail des dons", "Toutes les lignes par type et moyen de paiement"],
  ["income", "Compte de résultat", "Produits, charges, résultat, comparaison"],
  ["treasury", "État de trésorerie", "Soldes caisse et comptes bancaires"],
  ["deposits", "État des dépôts", "Dépôts, bordereaux, écarts"],
  ["expenses", "Dépenses", "Toutes les dépenses et leur statut"],
  ["reimbursements", "Remboursements", "Demandes et paiements"],
  ["funding", "Besoins des départements", "Demandes, décisions, montants"],
  ["projects", "Dépenses par projet", "Budget, payé, engagé, reste"],
  ["cr", "Demandes Cité Royale", "Suivi de toutes les demandes"],
] as const;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<PeriodParams> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const q = (r: string, f: string) => `/api/export?report=${r}&format=${f}&p=${sp.p ?? "month"}${sp.from ? `&from=${sp.from}&to=${sp.to}` : ""}`;
  const items = [...LIST, ...(ctx.isRegional ? [["regional", "Rapport consolidé régional", "Toutes les églises : entrées, sorties, trésorerie"] as const] : []), ["full", "Export complet (sauvegarde)", "Toutes les données de la vue courante, toutes périodes (Excel)"] as const];
  return (
    <>
      <PageHeader module={7} title="Rapports & exports" description={`Vue : ${ctx.view === "all" ? "toutes les églises" : ctx.activeChurch?.name}. PDF avec en-tête, pagination, totaux et signatures.`} actions={<PeriodFilter value={sp.p ?? "month"} from={sp.from} to={sp.to} />} />
      <div className="grid gap-3 md:grid-cols-2">
        {items.map(([k, t, d]) => (
          <Card key={k} className="flex items-center gap-4 p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><FileBarChart className="size-5" /></span>
            <div className="min-w-0 flex-1"><p className="text-[15px] font-medium">{t}</p><p className="text-[13px] text-muted">{d}</p></div>
            <div className="flex gap-1.5">
              <Button asChild size="sm" variant="secondary"><a href={q(k, "xlsx")} aria-label={`${t} en Excel`}><FileSpreadsheet /></a></Button>
              {k !== "full" && <Button asChild size="sm" variant="secondary"><a href={q(k, "pdf")} aria-label={`${t} en PDF`}><FileText /></a></Button>}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
