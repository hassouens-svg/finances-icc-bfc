import { CalendarClock } from "lucide-react";
import { requireContext, canManage, pickChurch } from "@/server/context";
import { getLookups, forChurch } from "@/server/lookups";
import { chargesOverview } from "@/server/charges";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ChurchPicker } from "@/components/church-picker";
import { ActionButton } from "@/components/action-form";
import { CoverageCard } from "@/components/charges/coverage-card";
import { ChargeDialog } from "./charge-dialog";
import { deleteChargeAction, generateChargeExpenseAction } from "@/server/actions/charges";
import { monthlyAmount } from "@/lib/charges";
import { formatEuro } from "@/lib/format";
import Link from "next/link";

export const metadata = { title: "Charges fixes" };
const FREQ: Record<string, string> = { monthly: "par mois", quarterly: "par trimestre", yearly: "par an" };

export default async function ChargesPage({ searchParams }: { searchParams: Promise<{ church?: string }> }) {
  const ctx = await requireContext();
  const { church, allowed } = pickChurch(ctx, (await searchParams).church, false);
  if (!church) return <EmptyState icon={<CalendarClock />} title="Aucune église" />;
  const [lk, o] = await Promise.all([getLookups(church.$id), chargesOverview(ctx, church.$id)]);
  const manage = canManage(ctx, church.$id);
  const cats = forChurch(lk.categories, church.$id).map((c) => ({ id: c.$id, name: c.name }));
  return (
    <>
      <PageHeader module={5} help="charges" title="Charges fixes" description={`${church.name} — loyer, énergie, assurance… et si les entrées suffisent pour les payer.`}
        actions={manage ? <ChargeDialog churchId={church.$id} categories={cats} nextOrder={o.charges.length} /> : undefined} />
      <ChurchPicker churches={allowed.map((c) => ({ id: c.$id, name: c.name }))} current={church.$id} basePath="/app/charges" />
      {o.charges.length === 0 ? (
        <EmptyState icon={<CalendarClock />} title="Aucune charge fixe" description="Commencez par le loyer : l'application vous dira chaque mois si les entrées suffisent pour le payer." action={manage ? <ChargeDialog churchId={church.$id} categories={cats} /> : undefined} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
          <CoverageCard coverage={o.coverageMonth} income={o.thisMonth} avg3={o.avg3} runway={o.runway} available={o.available} />
          <Card>
            <CardHeader title={`${o.charges.length} charge(s) — ${formatEuro(o.monthlyTotal)} par mois`} description="Dans l'ordre de priorité. « Créer la dépense du mois » l'envoie dans le circuit de validation." />
            <ul className="divide-y divide-border border-t border-border">
              {o.charges.map((c, i) => {
                const e = o.expenseFor(c.$id);
                return (
                  <li key={c.$id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent-strong">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-medium">{c.name}</p>
                        <p className="num text-[13px] text-muted">{formatEuro(c.amountCents)} {FREQ[c.frequency]}{c.frequency !== "monthly" ? ` (≈ ${formatEuro(monthlyAmount(c))}/mois)` : ""} · le {c.dueDay} · {c.categoryName ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pl-10 sm:pl-0">
                      {e ? <Link href={`/app/depenses/${e.$id}`}><StatusBadge entity="expense" status={e.status} /></Link> : <Badge tone="neutral" dot={false}>Pas encore saisie ce mois</Badge>}
                      {manage && !e && <ActionButton size="sm" variant="soft" action={generateChargeExpenseAction} payload={{ id: c.$id }}>Créer la dépense du mois</ActionButton>}
                      {manage && <ChargeDialog churchId={church.$id} categories={cats} charge={{ id: c.$id, name: c.name, categoryId: c.categoryId, amountCents: c.amountCents, frequency: c.frequency, dueDay: c.dueDay, sortOrder: c.sortOrder, paymentMethod: c.paymentMethod, supplier: c.supplier }} />}
                      {manage && <ActionButton size="sm" variant="ghost" action={deleteChargeAction} payload={{ id: c.$id }} confirm={`Supprimer la charge « ${c.name} » ?`}>Supprimer</ActionButton>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
