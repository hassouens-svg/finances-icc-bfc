import Link from "next/link";
import { Users, Building2, ChevronRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChurchDialog } from "@/components/admin/forms";
import { requireContext, canManageTeam, canManage } from "@/server/context";
import { churchSetup } from "@/server/setup";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ChurchPicker } from "@/components/church-picker";
import { TeamCard } from "@/components/admin/team-card";
import { ChurchSteps } from "@/components/admin/church-steps";

export const metadata = { title: "Mon équipe" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ church?: string }> }) {
  const ctx = await requireContext();
  const allowed = ctx.churches.filter((c) => canManageTeam(ctx, c.$id));
  const req = (await searchParams).church;
  const church = allowed.find((c) => c.$id === req) ?? allowed.find((c) => c.$id === ctx.view) ?? allowed[0];
  if (!church) return <EmptyState icon={<Users />} title="Réservé au responsable de l'église" description="Demandez au responsable de votre église de modifier vos accès." />;
  const daughters = ctx.isRegional ? ctx.allChurches.filter((c) => !c.isMother) : [];
  const [setup, ...setups] = await churchSetup([church, ...daughters]);
  return (
    <>
      <PageHeader title="Mon équipe" description={`${church.name} — créez les comptes de votre équipe et choisissez ce que chacun peut voir ou faire.`} />
      <ChurchPicker churches={allowed.map((c) => ({ id: c.$id, name: c.name }))} current={church.$id} basePath="/app/equipe" />
      <div className="space-y-5">
        {canManage(ctx, church.$id, "parametres") && setup!.done < setup!.total && <ChurchSteps s={setup!} canInvite />}
        <TeamCard ctx={ctx} church={church} />
        {ctx.isRegional && (
          // Église mère : elle crée et pilote ses églises rattachées depuis son propre compte
          <Card>
            <CardHeader title="Églises rattachées" description="Créez une église avec ses accès, puis suivez sa mise en place."
              action={<ChurchDialog cities={ctx.cities.map((x) => ({ value: x.$id, label: x.name }))} isSuperAdmin={ctx.isSuperAdmin} />} />
            {daughters.length === 0 ? (
              <p className="px-4 pb-4 text-[14px] text-muted">Aucune église rattachée pour l&apos;instant.</p>
            ) : (
              <div className="divide-y divide-border border-t border-border">
                {daughters.map((c) => {
                  const st = setups.find((x) => x.church.$id === c.$id);
                  return (
                    <Link key={c.$id} href={`/app/admin/eglises/${c.$id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Building2 className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{c.name}</span>
                        <span className="block text-[12px] text-muted">{ctx.cities.find((x) => x.$id === c.cityId)?.name ?? ""}</span>
                      </span>
                      {!c.active ? <Badge tone="neutral" dot={false}>Archivée</Badge> : st && st.done < st.total ? <Badge tone="waiting" dot={false}>Mise en place {st.done}/{st.total}</Badge> : <Badge tone="positive" dot={false}>Prête</Badge>}
                      <ChevronRight className="size-4 text-muted" />
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
