import { Query } from "node-appwrite";
import { Wallet, Landmark, PiggyBank, Lock, Unlock, TrendingDown } from "lucide-react";
import { requireContext, canManage, churchName, pickChurch } from "@/server/context";
import { listScoped, adminList } from "@/server/data";
import { getBalances } from "@/server/treasury";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { BalanceChart, FlowChart } from "@/components/charts";
import { ActionButton } from "@/components/action-form";
import { ExportButtons } from "@/components/export-buttons";
import { lockMonthAction, unlockMonthAction } from "@/server/actions/closing";
import { computeBalances, monthlyFlows } from "@/lib/finance";
import { last12Months, monthKey } from "@/lib/period";
import { formatEuro, formatMonth } from "@/lib/format";
import type { CrRequest, Expense, FundingRequest, PeriodLock, Reimbursement } from "@/lib/types";

export const metadata = { title: "Trésorerie" };

export default async function TreasuryPage() {
  const ctx = await requireContext();
  const { balances, accounts, movements } = await getBalances(ctx);
  const months = last12Months();
  const flows = monthlyFlows(movements, months);
  const curve = months.map((m) => {
    const [y, mo] = m.split("-").map(Number);
    const end = new Date(Date.UTC(y!, mo!, 1));
    return { month: m, total: computeBalances(movements, accounts.filter((a) => !a.openingDate || new Date(a.openingDate) < end), end).total };
  });
  const [approvedUnpaid, reimb, funding, cr, locks] = await Promise.all([
    listScoped<Expense>(ctx, "expenses", [Query.equal("status", ["approved", "in_approval"]), Query.equal("archived", false), Query.select(["$id", "amountCents", "status"])]),
    listScoped<Reimbursement>(ctx, "reimbursements", [Query.equal("status", ["submitted", "checking"]), Query.select(["$id", "amountCents"])]),
    listScoped<FundingRequest>(ctx, "funding_requests", [Query.equal("status", ["approved", "partially_approved"]), Query.isNull("convertedToId"), Query.select(["$id", "approvedCents", "estimatedCents"])]),
    listScoped<CrRequest>(ctx, "cr_requests", [Query.equal("status", ["approved", "received_partial"]), Query.select(["$id", "estimatedCents", "receivedCents"])]),
    adminList<PeriodLock>("period_locks", [Query.equal("churchId", ctx.scopeIds.length ? ctx.scopeIds : ["-"]), Query.orderDesc("month")]),
  ]);
  const committed = approvedUnpaid.reduce((a, e) => a + e.amountCents, 0);
  const pendingReimb = reimb.reduce((a, r) => a + r.amountCents, 0);
  const fundingDue = funding.reduce((a, f) => a + (f.approvedCents ?? f.estimatedCents), 0);
  const crIncoming = cr.reduce((a, c) => a + Math.max(0, (c.estimatedCents ?? 0) - (c.receivedCents ?? 0)), 0);
  const forecast = balances.total - committed - pendingReimb - fundingDue;
  const thisMonth = flows[flows.length - 1]!;
  const { church } = pickChurch(ctx);
  const closeMonths = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1 - i); return monthKey(d); });
  return (
    <>
      <PageHeader title="Trésorerie" description="Soldes calculés en temps réel à partir de chaque offrande, dépôt et dépense payée." actions={<ExportButtons entity="treasury" />} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total disponible" value={balances.total} tone="accent" icon={<PiggyBank />} />
        <KpiCard label="En caisse" value={balances.cash} icon={<Wallet />} href="/app/depots/nouveau" hint="à déposer" />
        <KpiCard label="À la banque" value={balances.bankTotal} icon={<Landmark />} hint={`${accounts.length} compte(s)`} />
        <KpiCard label="Prévisionnel" value={forecast} tone={forecast < 0 ? "negative" : "default"} icon={<TrendingDown />} hint="après engagements connus" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card><CardHeader title="Trésorerie sur 12 mois" /><CardBody><BalanceChart data={curve} /></CardBody></Card>
          <Card>
            <CardHeader title="Flux mensuels" description={`Ce mois : +${formatEuro(thisMonth.in)} / −${formatEuro(thisMonth.out)}`} />
            <CardBody><FlowChart data={flows} /></CardBody>
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Soldes par compte" />
            <ul className="divide-y divide-border border-t border-border text-[14px]">
              <li className="flex justify-between px-5 py-3"><span className="flex items-center gap-2"><Wallet className="size-4 text-muted" />En caisse</span><span className="num font-semibold">{formatEuro(balances.cash)}</span></li>
              {accounts.map((a) => (
                <li key={a.$id} className="flex justify-between gap-3 px-5 py-3">
                  <span className="min-w-0"><span className="flex items-center gap-2"><Landmark className="size-4 text-muted" />{a.label}</span>{ctx.view === "all" && <span className="block pl-6 text-[12px] text-muted">{churchName(ctx, a.churchId)}</span>}</span>
                  <span className="num font-semibold">{formatEuro(balances.banks[a.$id] ?? 0)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Prévisionnel simple" description="Engagements connus, non encore payés" />
            <CardBody>
              <ul className="space-y-2 text-[14px]">
                <li className="flex justify-between"><span className="text-muted">Dépenses approuvées ou en validation</span><span className="num">−{formatEuro(committed)}</span></li>
                <li className="flex justify-between"><span className="text-muted">Remboursements en attente</span><span className="num">−{formatEuro(pendingReimb)}</span></li>
                <li className="flex justify-between"><span className="text-muted">Besoins approuvés non financés</span><span className="num">−{formatEuro(fundingDue)}</span></li>
                <li className="flex justify-between"><span className="text-muted">Attendu de la Cité Royale</span><span className="num">+{formatEuro(crIncoming)}</span></li>
                <li className="flex justify-between border-t border-border pt-2 font-semibold"><span>Disponible après engagements</span><span className={`num ${forecast < 0 ? "text-danger" : "text-accent"}`}>{formatEuro(forecast)}</span></li>
              </ul>
            </CardBody>
          </Card>
          {church && (
            <Card>
              <CardHeader title="Clôture mensuelle" description={`${church.name} — un mois clôturé ne peut plus être modifié (sauf admin, tracé).`} />
              <ul className="divide-y divide-border border-t border-border">
                {closeMonths.map((m) => {
                  const lock = locks.find((l) => l.churchId === church.$id && l.month === m);
                  return (
                    <li key={m} className="flex items-center justify-between gap-2 px-5 py-2.5 text-[14px]">
                      <span>{formatMonth(`${m}-15T12:00:00Z`)}{lock && <span className="block text-[12px] text-muted">Clôturé par {lock.lockedByName}</span>}</span>
                      {lock ? (ctx.isRegional ? <ActionButton size="sm" variant="ghost" action={unlockMonthAction} payload={{ churchId: church.$id, month: m }} confirm="Rouvrir ce mois ?"><Unlock /> Rouvrir</ActionButton> : <Lock className="size-4 text-muted" />)
                        : canManage(ctx, church.$id) ? <ActionButton size="sm" variant="secondary" action={lockMonthAction} payload={{ churchId: church.$id, month: m }} confirm={`Clôturer ${m} ? Les saisies de ce mois seront verrouillées.`}><Lock /> Clôturer</ActionButton> : null}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
