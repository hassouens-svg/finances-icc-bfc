import { NoAccess } from "@/components/no-access";
import { Query } from "node-appwrite";
import { BookCheck } from "lucide-react";
import { requireContext, canManage, pickChurch, canSeeModule } from "@/server/context";
import { listScoped } from "@/server/data";
import { getLookups } from "@/server/lookups";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ChurchPicker } from "@/components/church-picker";
import { ImportForm, MatchControl } from "./client";
import { formatEuro, formatDate } from "@/lib/format";
import type { BankStatementLine, CashMovement, Deposit, Expense } from "@/lib/types";

export const metadata = { title: "Rapprochement bancaire" };

export default async function ReconciliationPage({ searchParams }: { searchParams: Promise<{ church?: string; account?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  if (!canSeeModule(ctx, "tresorerie")) return <NoAccess />;
  const { church, allowed } = pickChurch(ctx, sp.church, true, "tresorerie");
  if (!church) return <EmptyState icon={<BookCheck />} title="Aucune église gérable" />;
  const lk = await getLookups(church.$id);
  const account = lk.bankAccounts.find((a) => a.$id === sp.account) ?? lk.bankAccounts[0];
  if (!account) return <EmptyState icon={<BookCheck />} title="Aucun compte bancaire" />;
  const [lines, movs, deposits, expenses] = await Promise.all([
    listScoped<BankStatementLine>(ctx, "bank_statement_lines", [Query.equal("bankAccountId", account.$id), Query.orderDesc("date")], [church.$id]),
    listScoped<CashMovement>(ctx, "cash_movements", [Query.equal("account", `bank:${account.$id}`), Query.orderDesc("date")], [church.$id]),
    listScoped<Deposit>(ctx, "deposits", [Query.equal("bankAccountId", account.$id), Query.select(["$id", "reference"])], [church.$id]),
    listScoped<Expense>(ctx, "expenses", [Query.equal("status", "paid"), Query.equal("bankAccountId", account.$id), Query.select(["$id", "reference", "title"])], [church.$id]),
  ]);
  const used = new Set(lines.map((l) => l.matchedId).filter(Boolean));
  const label = (m: CashMovement) => m.sourceType === "deposit" ? `Dépôt ${deposits.find((d) => d.$id === m.sourceId)?.reference ?? ""}` : m.sourceType === "expense" ? `Dépense ${expenses.find((e) => e.$id === m.sourceId)?.reference ?? ""} — ${m.label}` : m.label ?? m.sourceType;
  const candidates = movs.map((m) => ({ id: m.$id, label: `${formatDate(m.date)} · ${label(m)} · ${formatEuro(m.direction === "in" ? m.amountCents : -m.amountCents)}`, amount: m.direction === "in" ? m.amountCents : -m.amountCents, date: m.date }));
  const matched = lines.filter((l) => l.matchedId).length;
  const manage = canManage(ctx, church.$id, "tresorerie");
  return (
    <>
      <PageHeader module={7} title="Rapprochement bancaire" description="Importez le relevé (CSV) puis pointez chaque ligne avec un dépôt, une dépense ou un don." />
      <ChurchPicker churches={allowed.map((c) => ({ id: c.$id, name: c.name }))} current={church.$id} basePath="/app/rapprochement" />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title={`${account.label} — ${lines.length} ligne(s)`} description={lines.length ? `${matched} pointée(s), ${lines.length - matched} à pointer` : "Aucun relevé importé"} />
          {lines.length === 0 ? <CardBody><p className="text-[14px] text-muted">Importez un relevé pour commencer.</p></CardBody> : (
            <ul className="divide-y divide-border border-t border-border">
              {lines.map((l) => {
                const suggestion = !l.matchedId ? candidates.find((c) => !used.has(c.id) && c.amount === l.amountCents && Math.abs(new Date(c.date).getTime() - new Date(l.date).getTime()) < 7 * 86400000) : undefined;
                return (
                  <li key={l.$id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium">{l.label || "—"}</p>
                      <p className="text-[12px] text-muted">{formatDate(l.date)}</p>
                    </div>
                    <span className={`num w-28 text-right font-semibold ${l.amountCents < 0 ? "text-danger" : "text-success"}`}>{formatEuro(l.amountCents)}</span>
                    {l.matchedId ? <Badge tone="positive">Pointée</Badge> : <Badge tone="waiting">À pointer</Badge>}
                    {manage && <MatchControl id={l.$id} matchedId={l.matchedId ?? ""} suggestion={suggestion?.id} candidates={candidates.filter((c) => !used.has(c.id) || c.id === l.matchedId)} />}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <div className="space-y-5">
          {lk.bankAccounts.length > 1 && (
            <Card><CardHeader title="Compte" /><CardBody className="flex flex-wrap gap-2">{lk.bankAccounts.map((a) => <a key={a.$id} href={`?church=${church.$id}&account=${a.$id}`} className={`rounded-lg border px-3 py-1.5 text-[13px] ${a.$id === account.$id ? "border-accent bg-accent-soft text-accent-strong" : "border-border"}`}>{a.label}</a>)}</CardBody></Card>
          )}
          {manage && <Card><CardHeader title="Importer un relevé" description="CSV : date ; libellé ; montant — ou date ; libellé ; débit ; crédit" /><CardBody><ImportForm churchId={church.$id} bankAccountId={account.$id} /></CardBody></Card>}
        </div>
      </div>
    </>
  );
}
