import { NoAccess } from "@/components/no-access";
import { Query } from "node-appwrite";
import { PieChart } from "lucide-react";
import { requireContext, canManage, pickChurch, canSeeModule } from "@/server/context";
import { listScoped } from "@/server/data";
import { getLookups, forChurch } from "@/server/lookups";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ChurchPicker } from "@/components/church-picker";
import { BudgetDialog } from "./budget-dialog";
import { formatEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Budget, Expense } from "@/lib/types";

export const metadata = { title: "Budget" };

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ church?: string; year?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  if (!canSeeModule(ctx, "tresorerie")) return <NoAccess />;
  const { church, allowed } = pickChurch(ctx, sp.church, false, "tresorerie");
  if (!church) return <EmptyState icon={<PieChart />} title="Aucune église" />;
  const year = Number(sp.year) || new Date().getUTCFullYear();
  const [budgets, expenses, lk] = await Promise.all([
    listScoped<Budget>(ctx, "budgets", [Query.equal("year", year)], [church.$id]),
    listScoped<Expense>(ctx, "expenses", [Query.equal("status", "paid"), Query.greaterThanEqual("date", `${year}-01-01`), Query.lessThan("date", `${year + 1}-01-01`), Query.select(["categoryId", "departmentId", "amountCents"])], [church.$id]),
    getLookups(church.$id),
  ]);
  const manage = canManage(ctx, church.$id, "tresorerie");
  const elapsed = Math.min(1, (Date.now() - Date.UTC(year, 0, 1)) / (365 * 86400000));
  const lines = budgets.map((b) => {
    const real = expenses.filter((e) => (b.scope === "category" ? e.categoryId : e.departmentId) === b.scopeId).reduce((a, e) => a + e.amountCents, 0);
    return { ...b, real, gap: b.plannedCents - real, pct: b.plannedCents ? real / b.plannedCents : 0 };
  });
  const tP = lines.reduce((a, l) => a + l.plannedCents, 0), tR = lines.reduce((a, l) => a + l.real, 0);
  const opts = { categories: forChurch(lk.categories, church.$id).map((c) => ({ id: c.$id, name: c.name })), departments: lk.departments.filter((d) => d.churchId === church.$id).map((d) => ({ id: d.$id, name: d.name })) };
  return (
    <>
      <PageHeader module={7} title={`Budget ${year}`} description={`${church.name} — prévu vs réalisé (dépenses payées). ${Math.round(elapsed * 100)} % de l'année écoulée.`}
        actions={manage ? <BudgetDialog churchId={church.$id} year={year} {...opts} /> : undefined} />
      <ChurchPicker churches={allowed.map((c) => ({ id: c.$id, name: c.name }))} current={church.$id} basePath="/app/budget" />
      {lines.length === 0 ? <EmptyState icon={<PieChart />} title="Aucun budget défini" description="Ajoutez un montant prévu par catégorie ou par département." action={manage ? <BudgetDialog churchId={church.$id} year={year} {...opts} /> : undefined} /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-[14px]">
            <thead><tr className="bg-surface text-[12px] text-muted">{["Poste", "Prévu", "Réalisé", "Écart", "Consommation"].map((h, i) => <th key={h} className={cn("h-10 px-4 font-medium", i ? "text-right" : "text-left")}>{h}</th>)}</tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.$id} className="border-t border-border">
                  <td className="h-12 px-4"><span className="font-medium">{l.scopeName}</span><span className="ml-2 text-[12px] text-muted">{l.scope === "category" ? "catégorie" : "département"}</span></td>
                  <td className="num px-4 text-right">{formatEuro(l.plannedCents)}</td>
                  <td className="num px-4 text-right font-medium">{formatEuro(l.real)}</td>
                  <td className={cn("num px-4 text-right font-medium", l.gap < 0 ? "text-danger" : "text-success")}>{formatEuro(l.gap, { sign: true })}</td>
                  <td className="w-48 px-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", l.pct > 1 ? "bg-danger" : l.pct > elapsed + 0.1 ? "bg-warning" : "bg-accent")} style={{ width: `${Math.min(100, l.pct * 100)}%` }} /></div>
                      <span className="num w-10 text-right text-[12px] text-muted">{Math.round(l.pct * 100)} %</span>
                    </div>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-fg/10 bg-surface font-semibold"><td className="h-12 px-4">Total</td><td className="num px-4 text-right">{formatEuro(tP)}</td><td className="num px-4 text-right">{formatEuro(tR)}</td><td className={cn("num px-4 text-right", tP - tR < 0 ? "text-danger" : "text-success")}>{formatEuro(tP - tR, { sign: true })}</td><td /></tr>
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
