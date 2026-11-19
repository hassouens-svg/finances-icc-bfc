import Link from "next/link";
import { Query } from "node-appwrite";
import { Crown, Plus, List, KanbanSquare, AlertTriangle } from "lucide-react";
import { requireContext, canManage, churchName } from "@/server/context";
import { listScoped } from "@/server/data";
import { getSettings } from "@/server/lookups";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PriorityBadge, Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTable, type Col } from "@/components/data/data-table";
import { ExportButtons } from "@/components/export-buttons";
import { STATUS, statusDef } from "@/lib/status";
import { formatEuro, relativeDays } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CrRequest } from "@/lib/types";

export const metadata = { title: "Demandes Cité Royale" };

const COLUMNS: [string, string[]][] = [
  ["À lancer", ["draft", "mother_review", "initiated"]],
  ["Envoyées", ["sent"]],
  ["En attente", ["pending"]],
  ["Validées", ["approved"]],
  ["Reçues", ["received_partial", "received_full"]],
  ["Terminées", ["closed", "rejected"]],
];

export default async function CrPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const vue = (await searchParams).vue === "liste" ? "liste" : "kanban";
  const ctx = await requireContext();
  const [items, settings] = await Promise.all([listScoped<CrRequest>(ctx, "cr_requests", [Query.equal("archived", false), Query.orderDesc("$updatedAt")]), getSettings()]);
  const stale = (c: CrRequest) => c.status === "pending" && c.statusChangedAt && Date.now() - new Date(c.statusChangedAt).getTime() > settings.crPendingDays * 86400000;
  const canWrite = ctx.scopeIds.some((id) => canManage(ctx, id));
  const late = items.filter(stale);
  const columns: Col[] = [
    { key: "title", label: "Objet", mobilePrimary: true },
    ...(ctx.view === "all" ? [{ key: "church", label: "Église", type: "muted" as const, mobileSecondary: true }] : []),
    { key: "reference", label: "Référence", type: "muted", mobileSecondary: true },
    { key: "priority", label: "Priorité", type: "priority" },
    { key: "status", label: "Statut", type: "status", entity: "cr_request" },
    { key: "amount", label: "Estimé", type: "money" },
  ];
  return (
    <>
      <PageHeader title="Demandes à la Cité Royale" description="Matériel, financement, équipement… suivez chaque demande jusqu'à sa réception."
        actions={
          <>
            <div className="flex rounded-xl bg-surface-2 p-1">
              <Link href="?vue=kanban" className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium", vue === "kanban" ? "bg-bg shadow-card" : "text-muted")}><KanbanSquare className="size-4" /> Tableau</Link>
              <Link href="?vue=liste" className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium", vue === "liste" ? "bg-bg shadow-card" : "text-muted")}><List className="size-4" /> Liste</Link>
            </div>
            <ExportButtons entity="cr" />
            {canWrite && <Button asChild><Link href="/app/cite-royale/nouvelle"><Plus /> Nouvelle demande</Link></Button>}
          </>
        } />
      {late.length > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-[14px] text-warning">
          <AlertTriangle className="size-5 shrink-0" /> {late.length} demande(s) « En attente » depuis plus de {settings.crPendingDays} jours : relancez la Cité Royale.
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState icon={<Crown />} title="Aucune demande" description="Créez votre première demande à la Cité Royale." action={canWrite ? <Button asChild><Link href="/app/cite-royale/nouvelle"><Plus /> Nouvelle demande</Link></Button> : undefined} />
      ) : vue === "liste" ? (
        <DataTable columns={columns} rows={items.map((c) => ({ id: c.$id, href: `/app/cite-royale/${c.$id}`, title: c.title, church: churchName(ctx, c.churchId), reference: c.reference, priority: c.priority, status: c.status, amount: c.estimatedCents ?? null }))}
          filters={[{ key: "status", label: "Statut", options: Object.entries(STATUS.cr_request!).map(([value, d]) => ({ value, label: d.label })) }]} />
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          <div className="grid w-max grid-flow-col gap-3 [grid-auto-columns:minmax(260px,1fr)] xl:w-full xl:grid-flow-row xl:grid-cols-6">
            {COLUMNS.map(([label, statuses]) => {
              const col = items.filter((c) => statuses.includes(c.status));
              return (
                <div key={label} className="flex flex-col rounded-2xl bg-surface-2 p-2">
                  <p className="flex items-center justify-between px-2 pb-2 pt-1 text-[13px] font-semibold">{label}<span className="num rounded-full bg-bg px-2 text-[12px] text-muted">{col.length}</span></p>
                  <div className="space-y-2">
                    {col.map((c) => (
                      <Link key={c.$id} href={`/app/cite-royale/${c.$id}`}>
                        <Card className={cn("p-3 transition-colors hover:border-accent/40", stale(c) && "border-warning/50")}>
                          <p className="text-[14px] font-medium leading-snug">{c.title}</p>
                          <p className="mt-1 text-[12px] text-muted">{ctx.view === "all" ? `${churchName(ctx, c.churchId)} · ` : ""}{c.reference}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge tone={statusDef("cr_request", c.status).tone} dot={false}>{statusDef("cr_request", c.status).label}</Badge>
                            <PriorityBadge priority={c.priority} />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[12px]">
                            <span className="num font-semibold">{c.estimatedCents ? formatEuro(c.estimatedCents) : "—"}</span>
                            {c.statusChangedAt && <span className={cn("text-muted", stale(c) && "font-medium text-warning")}>{relativeDays(c.statusChangedAt)}</span>}
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
