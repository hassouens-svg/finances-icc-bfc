import Link from "next/link";
import { Query } from "node-appwrite";
import {
  ArrowDownLeft, ArrowUpRight, Scale, PiggyBank, Wallet, RotateCcw, CheckCheck, Lightbulb, Crown, AlertTriangle, ChevronRight, Building2, Settings,
} from "lucide-react";
import { requireContext, churchName, canManage, canApproveAs, canSeeModule } from "@/server/context";
import { listScoped } from "@/server/data";
import { getBalances } from "@/server/treasury";
import { periodFrom, type PeriodParams } from "@/server/period";
import { computeAlerts } from "@/server/alerts";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FlowChart, Donut } from "@/components/charts";
import { PeriodFilter } from "@/components/period-filter";
import { incomeStatement, monthlyFlows, computeBalances } from "@/lib/finance";
import { last12Months, previousPeriod } from "@/lib/period";
import { currentRole } from "@/lib/workflow";
import { formatEuro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MODULES } from "@/lib/guide";
import { churchSetup } from "@/server/setup";
import { chargesOverview } from "@/server/charges";
import { CoverageCard } from "@/components/charges/coverage-card";
import { SetupChecklist } from "@/components/admin/church-steps";
import { BookOpen } from "lucide-react";
import type { CrRequest, Expense, FundingRequest, OfferingLine, Reimbursement } from "@/lib/types";

export const metadata = { title: "Tableau de bord" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<PeriodParams> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const setups = ctx.isRegional ? await churchSetup(ctx.allChurches.filter((c) => c.active)) : [];
  const checklist = ctx.isRegional ? <SetupChecklist hasMother={!!ctx.motherChurch} setups={setups} /> : null;
  if (!ctx.scopeIds.length) {
    if (ctx.isRegional) return (<><PageHeader title={`Bienvenue, ${ctx.user.name.split(" ")[0]}`} description="Votre espace est prêt. Mettons en place les églises : quelques minutes suffisent." />{checklist}</>);
    return (
      <EmptyState className="mt-10" icon={<Building2 />} title={ctx.isRegional ? "Bienvenue ! Créez votre première église" : "Aucune église associée à votre compte"}
        description={ctx.isRegional ? "Commencez par la ville et l'église mère (Dijon), puis les églises filles." : "Demandez à l'église mère de vous donner un accès."}
        action={ctx.isRegional ? <Button asChild><Link href="/app/admin/eglises"><Settings /> Configurer</Link></Button> : undefined} />
    );
  }
  const period = periodFrom(sp);
  const prev = previousPeriod(period);
  const yearAgo = new Date(Date.UTC(new Date().getUTCFullYear() - 1, new Date().getUTCMonth(), 1)).toISOString();
  const [{ balances, accounts, movements }, lines, expenses, reimb, funding, cr] = await Promise.all([
    getBalances(ctx),
    listScoped<OfferingLine>(ctx, "offering_lines", [Query.greaterThanEqual("date", prev.from.toISOString()), Query.select(["$id", "churchId", "amountCents", "donationTypeName", "date"])]),
    listScoped<Expense>(ctx, "expenses", [Query.greaterThanEqual("date", yearAgo), Query.equal("archived", false), Query.select(["$id", "churchId", "amountCents", "categoryName", "status", "date", "paidAt", "currentStep", "totalSteps", "stepRoles", "title"])]),
    listScoped<Reimbursement>(ctx, "reimbursements", [Query.equal("status", ["submitted", "checking", "approved"]), Query.select(["$id", "churchId", "amountCents", "status", "requesterName"])]),
    listScoped<FundingRequest>(ctx, "funding_requests", [Query.equal("status", ["received", "reviewing"]), Query.select(["$id", "churchId", "title", "estimatedCents", "status"])]),
    listScoped<CrRequest>(ctx, "cr_requests", [Query.equal("status", ["draft", "mother_review", "initiated", "sent", "pending", "approved", "received_partial"]), Query.equal("archived", false), Query.select(["$id", "churchId", "status"])]),
  ]);
  const inc = incomeStatement(lines, expenses, period.from, period.to);
  const incPrev = incomeStatement(lines, expenses, prev.from, prev.to);
  const flows = monthlyFlows(movements, last12Months());
  const toApprove = expenses.filter((e) => { const r = currentRole(e); return r && canApproveAs(ctx, ((e as unknown) as { churchId: string }).churchId, r); });
  const pendingReimb = reimb.filter((r) => r.status !== "approved");
  const alerts = await computeAlerts(ctx, movements, accounts);
  const delta = (a: number, b: number) => (b ? `${a >= b ? "+" : ""}${Math.round(((a - b) / Math.abs(b)) * 100)} % vs ${prev.label.toLowerCase()}` : prev.label);
  const isAll = ctx.view === "all";
  const see = (m: Parameters<typeof canSeeModule>[1]) => canSeeModule(ctx, m);
  const charges = !isAll && ctx.activeChurch ? await chargesOverview(ctx, ctx.activeChurch.$id) : null;
  const title = isAll ? "Vue régionale" : ctx.activeChurch?.name ?? "Tableau de bord";
  const todo = [
    ...toApprove.slice(0, 5).map((e) => ({ href: `/app/depenses/${e.$id}`, icon: CheckCheck, text: `Valider « ${e.title} »`, meta: formatEuro(e.amountCents) })),
    ...pendingReimb.slice(0, 3).map((r) => ({ href: `/app/remboursements/${r.$id}`, icon: RotateCcw, text: `Traiter le remboursement de ${r.requesterName}`, meta: formatEuro(r.amountCents) })),
    ...funding.slice(0, 3).map((f) => ({ href: `/app/besoins/${f.$id}`, icon: Lightbulb, text: `Étudier le besoin « ${f.title} »`, meta: formatEuro(f.estimatedCents) })),
    ...(balances.cash > 0 && ctx.scopeIds.some((id) => canManage(ctx, id)) ? [{ href: "/app/depots/nouveau", icon: Wallet, text: "Déposer l'argent en caisse", meta: formatEuro(balances.cash) }] : []),
  ];
  const ranking = isAll ? ctx.scopeIds.map((id) => {
    const i = incomeStatement(lines.filter((l) => l.churchId === id), expenses.filter((e) => e.churchId === id), period.from, period.to);
    const b = computeBalances(movements.filter((m) => m.churchId === id), accounts.filter((a) => a.churchId === id));
    return { id, name: churchName(ctx, id), in: i.totalProducts, out: i.totalCharges, result: i.result, total: b.total, cash: b.cash, alerts: alerts.filter((a) => a.churchId === id).length };
  }).sort((a, b) => b.in - a.in) : [];
  return (
    <>
      <PageHeader eyebrow={<span className="text-[13px] font-medium text-accent">{isAll ? `${ctx.scopeIds.length} églises · Bourgogne-Franche-Comté` : "Tableau de bord"}</span>} title={title} actions={<PeriodFilter value={period.key} from={sp.from} to={sp.to} />} />
      {checklist}
      <nav aria-label="Modules" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 xl:grid xl:w-full xl:grid-cols-8">
          {MODULES.filter((m) => m.num).map((m) => (
            <Link key={m.id} href={m.href} className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-[13px] font-medium shadow-card transition-colors hover:border-accent/40">
              <span className="num grid size-6 shrink-0 place-items-center rounded-lg bg-accent-soft text-[12px] font-semibold text-accent-strong">{m.num}</span>
              <span className="whitespace-nowrap xl:truncate">{m.short}</span>
            </Link>
          ))}
          <Link href="/app/guide" className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2 text-[13px] font-medium text-accent-strong"><BookOpen className="size-4" /> Guide</Link>
        </div>
      </nav>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {see("offrandes") && <KpiCard label="Argent entré" value={inc.totalProducts} tone="accent" icon={<ArrowDownLeft />} hint={delta(inc.totalProducts, incPrev.totalProducts)} href="/app/offrandes" />}
        {see("depenses") && <KpiCard label="Argent sorti" value={inc.totalCharges} icon={<ArrowUpRight />} hint={delta(inc.totalCharges, incPrev.totalCharges)} href="/app/depenses" />}
        {see("tresorerie") && <KpiCard label="Résultat" value={inc.result} tone={inc.result >= 0 ? "positive" : "negative"} icon={<Scale />} hint={period.label} href="/app/compte-de-resultat" />}
        {see("tresorerie") && <KpiCard label="Trésorerie disponible" value={balances.total} icon={<PiggyBank />} hint={`Banque ${formatEuro(balances.bankTotal)}`} href="/app/tresorerie" />}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {see("depots") || see("tresorerie") && <KpiCard label="En caisse (à déposer)" value={balances.cash} tone={balances.cash > 0 ? "warning" : "default"} icon={<Wallet />} href="/app/depots" />}
        {see("remboursements") && <KpiCard label="Remboursements en attente" value={pendingReimb.length} kind="count" icon={<RotateCcw />} href="/app/remboursements" />}
        {see("depenses") && <KpiCard label="Dépenses à valider" value={toApprove.length} kind="count" icon={<CheckCheck />} href="/app/a-valider" />}
        {see("besoins") && <KpiCard label="Besoins en attente" value={funding.length} kind="count" icon={<Lightbulb />} href="/app/besoins" />}
        {see("citeroyale") && <KpiCard label="Demandes Cité Royale" value={cr.length} kind="count" icon={<Crown />} href="/app/cite-royale" hint="en cours" />}
      </div>

      {isAll && (
        <Card className="mt-5">
          <CardHeader title="Comparatif des églises" description={period.label} action={<Button asChild variant="secondary" size="sm"><a href={`/api/export?report=regional&format=pdf&p=${period.key}`}>Rapport consolidé PDF</a></Button>} />
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full min-w-[640px] text-[14px]">
              <thead><tr className="bg-surface text-[12px] text-muted">{["Église", "Entrées", "Sorties", "Résultat", "En caisse", "Trésorerie", "Alertes"].map((h, i) => <th key={h} className={cn("h-10 px-4 font-medium", i === 0 ? "text-left" : "text-right")}>{h}</th>)}</tr></thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="h-12 px-4 font-medium"><span className="num mr-2 text-muted">{i + 1}.</span>{r.name}</td>
                    <td className="num px-4 text-right">{formatEuro(r.in)}</td>
                    <td className="num px-4 text-right">{formatEuro(r.out)}</td>
                    <td className={cn("num px-4 text-right font-medium", r.result < 0 ? "text-danger" : "text-success")}>{formatEuro(r.result)}</td>
                    <td className="num px-4 text-right">{formatEuro(r.cash)}</td>
                    <td className="num px-4 text-right font-semibold">{formatEuro(r.total)}</td>
                    <td className="px-4 text-right">{r.alerts ? <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[12px] font-medium text-warning"><AlertTriangle className="size-3" />{r.alerts}</span> : <span className="text-[12px] text-success">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {charges && charges.charges.length > 0 && (
        <div className="mt-5"><CoverageCard coverage={charges.coverageMonth} income={charges.thisMonth} avg3={charges.avg3} runway={charges.runway} available={charges.available} compact href="/app/charges" /></div>
      )}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title="Entrées et sorties sur 12 mois" description="Les dépôts (caisse → banque) ne sont pas comptés." />
          <CardBody><FlowChart data={flows} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="À faire maintenant" description={todo.length ? `${todo.length} action(s) vous attendent` : undefined} />
          {todo.length === 0 ? <CardBody><p className="text-[14px] text-muted">Tout est à jour. 🙌</p></CardBody> : (
            <ul className="divide-y divide-border border-t border-border">
              {todo.slice(0, 8).map((t, i) => (
                <li key={i}><Link href={t.href} className="flex items-center gap-3 px-5 py-3 hover:bg-surface">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><t.icon className="size-4" /></span>
                  <span className="min-w-0 flex-1 truncate text-[14px]">{t.text}</span>
                  <span className="num text-[13px] text-muted">{t.meta}</span>
                  <ChevronRight className="size-4 text-muted" />
                </Link></li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {see("depenses") && <Card><CardHeader title="Dépenses par catégorie" description={period.label} /><CardBody><Donut data={inc.charges} empty="Aucune dépense payée sur la période" /></CardBody></Card>}
        {see("offrandes") && <Card><CardHeader title="Dons par type" description={period.label} /><CardBody><Donut data={inc.products} empty="Aucun don sur la période" /></CardBody></Card>}
        <Card>
          <CardHeader title="Alertes" description={alerts.length ? undefined : "Aucune alerte"} />
          <ul className="space-y-2 px-5 pb-5">
            {alerts.length === 0 && <li className="text-[14px] text-muted">Tout va bien. Les seuils se règlent dans Administration › Alertes.</li>}
            {alerts.map((a, i) => (
              <li key={i}><Link href={a.href} className={cn("flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-[13px]", a.tone === "negative" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")}>
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span><span className="font-medium">{isAll ? `${churchName(ctx, a.churchId)} : ` : ""}</span>{a.text}</span>
              </Link></li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
