import { Query } from "node-appwrite";
import { requireContext, pickChurch } from "@/server/context";
import { adminList } from "@/server/data";
import { REGION } from "@/lib/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChurchPicker } from "@/components/church-picker";
import { ListItemDialog, LIST_KINDS } from "@/components/admin/forms";
import { ActionButton } from "@/components/action-form";
import { archiveRowAction } from "@/server/actions/admin";
import type { ListItem } from "@/lib/types";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const metadata = { title: "Listes configurables" };

export default async function ListsPage({ searchParams }: { searchParams: Promise<{ church?: string; scope?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const { church, allowed } = pickChurch(ctx, sp.church);
  const scope = sp.scope === "local" && church ? church.$id : ctx.isRegional ? REGION : church?.$id ?? REGION;
  const canEdit = scope === REGION ? ctx.isRegional : ctx.isRegional || !!church?.allowLocalLists;
  const items = await adminList<ListItem>("list_items", [Query.equal("churchId", scope), Query.orderAsc("sortOrder"), Query.orderAsc("name")]);
  const regionItems = scope === REGION ? [] : await adminList<ListItem>("list_items", [Query.equal("churchId", REGION), Query.equal("archived", false)]);
  return (
    <>
      <PageHeader back={{ href: "/app/admin", label: "Administration" }} title="Listes configurables" description="L'église mère définit les listes par défaut ; chaque église peut ajouter les siennes si elle y est autorisée." />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 rounded-xl bg-surface-2 p-1">
          {ctx.isRegional && (
            <Link href="/app/admin/listes" className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium", scope === REGION ? "bg-bg shadow-card" : "text-muted")}>Listes régionales</Link>
          )}
          {church && <Link href={`/app/admin/listes?scope=local&church=${church.$id}`} className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium", scope !== REGION ? "bg-bg shadow-card" : "text-muted")}>Ajouts de {church.name}</Link>}
        </div>
      </div>
      {scope !== REGION && <ChurchPicker churches={allowed.map((c) => ({ id: c.$id, name: c.name }))} current={church!.$id} basePath="/app/admin/listes" />}
      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(LIST_KINDS).map(([kind, k]) => {
          const rows = items.filter((i) => i.kind === kind);
          const inherited = regionItems.filter((i) => i.kind === kind);
          return (
            <Card key={kind}>
              <CardHeader title={k.title} description={scope === REGION ? "Par défaut pour toutes les églises" : `${inherited.length} élément(s) hérité(s) de la région`} action={canEdit ? <ListItemDialog churchId={scope} kind={kind} /> : undefined} />
              <ul className="divide-y divide-border border-t border-border">
                {rows.length === 0 && <li className="px-5 py-4 text-[13px] text-muted">Aucun élément.</li>}
                {rows.map((i) => (
                  <li key={i.$id} className={cn("flex items-center gap-2 px-5 py-2", i.archived && "opacity-50")}>
                    <span className="flex-1 text-[14px]">{i.name}{i.code && <span className="ml-2 text-[12px] text-muted">{i.code}</span>}</span>
                    {i.isTithe && <Badge tone="progress" dot={false}>Dîme</Badge>}
                    {i.archived && <Badge tone="neutral" dot={false}>Archivé</Badge>}
                    {canEdit && (
                      <>
                        <ListItemDialog churchId={scope} kind={kind} item={{ id: i.$id, name: i.name, code: i.code, isTithe: i.isTithe, sortOrder: i.sortOrder }} />
                        <ActionButton variant="ghost" size="sm" action={archiveRowAction} payload={{ table: "list_items", id: i.$id }}>{i.archived ? "Restaurer" : "Archiver"}</ActionButton>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </>
  );
}
