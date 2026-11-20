import Link from "next/link";
import { Query } from "node-appwrite";
import { FileUp, HandCoins, Receipt } from "lucide-react";
import { requireContext, canManage } from "@/server/context";
import { getLookups } from "@/server/lookups";
import { listScoped } from "@/server/data";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionButton } from "@/components/action-form";
import { ImportWizard } from "@/components/import/import-wizard";
import { undoImportAction } from "@/server/actions/import";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AuditLog } from "@/lib/types";

export const metadata = { title: "Importer des fichiers Excel" };
export const maxDuration = 60;

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const kind = (await searchParams).type === "depenses" ? "expenses" : "offerings";
  const ctx = await requireContext();
  const churches = ctx.churches.filter((c) => canManage(ctx, c.$id) && (ctx.view === "all" || c.$id === ctx.view));
  if (!churches.length) return <EmptyState icon={<FileUp />} title="Vous n'avez pas les droits d'import" description="Seuls les trésoriers peuvent importer des fichiers." />;
  const ids = churches.map((c) => c.$id);
  const [lk, history] = await Promise.all([
    getLookups(ids.join(",")),
    listScoped<AuditLog>(ctx, "audit_logs", [Query.equal("action", "import"), Query.orderDesc("$createdAt"), Query.limit(30)], ids),
  ]);
  const undone = new Set((await listScoped<AuditLog>(ctx, "audit_logs", [Query.equal("entityType", "import"), Query.limit(200)], ids)).map((a) => a.entityId));
  const batches = [...new Map(history.filter((h) => !undone.has(h.entityId)).map((h) => [h.entityId, h])).values()];
  const forChurch = (list: { $id: string; name: string; churchId: string }[]) => list.filter((x) => x.churchId === "region" || ids.includes(x.churchId)).map((x) => ({ id: x.$id, name: x.name }));
  return (
    <>
      <PageHeader module={kind === "offerings" ? 4 : 5} help="import" title="Importer des fichiers Excel" description="Reprenez vos anciens tableaux : l'outil lit le fichier, reconnaît les colonnes et crée une base propre." />
      <div className="mb-5 flex gap-1.5 rounded-xl bg-surface-2 p-1 sm:w-max">
        <Link href="/app/import" className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-[14px] font-medium", kind === "offerings" ? "bg-bg shadow-card" : "text-muted")}><HandCoins className="size-4" /> Dons & offrandes</Link>
        <Link href="/app/import?type=depenses" className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-[14px] font-medium", kind === "expenses" ? "bg-bg shadow-card" : "text-muted")}><Receipt className="size-4" /> Dépenses</Link>
      </div>
      <ImportWizard key={kind} kind={kind} churches={churches.map((c) => ({ id: c.$id, name: c.name }))} donationTypes={forChurch(lk.donationTypes)} categories={forChurch(lk.categories)} />
      {batches.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Imports récents" description="Une erreur ? Annulez l'import : tout ce qu'il a créé est supprimé." />
          <ul className="divide-y divide-border border-t border-border">
            {batches.map((b) => (
              <li key={b.$id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1"><p className="text-[14px] font-medium">{b.summary}</p><p className="text-[12px] text-muted">{formatDateTime(b.$createdAt)} · {b.actorName}</p></div>
                <ActionButton size="sm" variant="danger-soft" action={undoImportAction} payload={{ batchId: b.entityId ?? "", churchId: b.churchId }} confirm="Annuler cet import et supprimer tout ce qu'il a créé ?">Annuler cet import</ActionButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
