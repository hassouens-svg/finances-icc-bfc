import { requireContext } from "@/server/context";
import { periodFrom, type PeriodParams } from "@/server/period";
import { incomeFor } from "@/server/reports";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { PeriodFilter } from "@/components/period-filter";
import { ExportButtons } from "@/components/export-buttons";
import { previousPeriod } from "@/lib/period";
import { formatEuro } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Compte de résultat" };

function Rows({ title, rows, prev, total, prevTotal }: { title: string; rows: { label: string; cents: number }[]; prev: { label: string; cents: number }[]; total: number; prevTotal: number }) {
  return (
    <Card>
      <CardHeader title={title} />
      <table className="w-full border-t border-border text-[14px]">
        <thead><tr className="bg-surface text-[12px] text-muted"><th className="h-9 px-5 text-left font-medium">Poste</th><th className="px-5 text-right font-medium">Période</th><th className="hidden px-5 text-right font-medium sm:table-cell">Précédente</th><th className="px-5 text-right font-medium">Évol.</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={4} className="px-5 py-4 text-muted">Aucun mouvement.</td></tr>}
          {rows.map((r) => {
            const p = prev.find((x) => x.label === r.label)?.cents ?? 0;
            const ev = p ? Math.round(((r.cents - p) / p) * 100) : null;
            return (
              <tr key={r.label} className="border-t border-border">
                <td className="h-11 px-5">{r.label}</td>
                <td className="num px-5 text-right font-medium">{formatEuro(r.cents)}</td>
                <td className="num hidden px-5 text-right text-muted sm:table-cell">{formatEuro(p)}</td>
                <td className={cn("num px-5 text-right text-[13px]", ev == null ? "text-muted" : ev >= 0 ? "text-success" : "text-danger")}>{ev == null ? "—" : `${ev > 0 ? "+" : ""}${ev} %`}</td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-fg/10 bg-surface font-semibold">
            <td className="h-11 px-5">Total {title.toLowerCase()}</td><td className="num px-5 text-right">{formatEuro(total)}</td><td className="num hidden px-5 text-right text-muted sm:table-cell">{formatEuro(prevTotal)}</td><td />
          </tr>
        </tbody>
      </table>
    </Card>
  );
}

export default async function IncomePage({ searchParams }: { searchParams: Promise<PeriodParams> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const period = periodFrom(sp, "year");
  const prevP = previousPeriod(period);
  const [cur, prev] = await Promise.all([incomeFor(ctx, period), incomeFor(ctx, prevP)]);
  return (
    <>
      <PageHeader title="Compte de résultat" description="Produits (dons et offrandes) − charges (dépenses payées) = résultat. Comparaison avec la période précédente."
        actions={<><PeriodFilter value={period.key} from={sp.from} to={sp.to} /><ExportButtons entity="income" sp={{ ...sp, p: period.key }} /></>} />
      <div className="mb-5 rounded-2xl border border-border bg-bg p-5 shadow-card sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div><p className="text-[13px] text-muted">Produits</p><p className="num text-[24px] font-semibold">{formatEuro(cur.totalProducts)}</p></div>
          <div><p className="text-[13px] text-muted">Charges</p><p className="num text-[24px] font-semibold">{formatEuro(cur.totalCharges)}</p></div>
          <div><p className="text-[13px] text-muted">Résultat ({period.label.toLowerCase()})</p><p className={cn("num text-[28px] font-semibold", cur.result >= 0 ? "text-success" : "text-danger")}>{formatEuro(cur.result, { sign: true })}</p><p className="num text-[12px] text-muted">{prevP.label} : {formatEuro(prev.result)}</p></div>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Rows title="Produits" rows={cur.products} prev={prev.products} total={cur.totalProducts} prevTotal={prev.totalProducts} />
        <Rows title="Charges" rows={cur.charges} prev={prev.charges} total={cur.totalCharges} prevTotal={prev.totalCharges} />
      </div>
    </>
  );
}
