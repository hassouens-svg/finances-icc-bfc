import { Users } from "lucide-react";
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
  const [setup] = await churchSetup([church]);
  return (
    <>
      <PageHeader title="Mon équipe" description={`${church.name} — créez les comptes de votre équipe et choisissez ce que chacun peut voir ou faire.`} />
      <ChurchPicker churches={allowed.map((c) => ({ id: c.$id, name: c.name }))} current={church.$id} basePath="/app/equipe" />
      <div className="space-y-5">
        {canManage(ctx, church.$id, "parametres") && setup!.done < setup!.total && <ChurchSteps s={setup!} canInvite />}
        <TeamCard ctx={ctx} church={church} />
      </div>
    </>
  );
}
