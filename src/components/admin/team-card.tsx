import { Query } from "node-appwrite";
import { adminClient } from "@/lib/appwrite/server";
import { canManageTeam, type AppContext } from "@/server/context";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateAccountDialog, EditAccessDialog } from "@/components/admin/access";
import { accessSummary } from "@/lib/access";
import { ResendInviteButton } from "@/app/app/admin/utilisateurs/resend";
import { initials } from "@/lib/format";
import type { Church } from "@/lib/types";

/** Équipe d'une église : qui a accès, avec quels droits ; création de comptes et réglage des droits. */
export async function TeamCard({ ctx, church }: { ctx: AppContext; church: Church }) {
  const { teams, users } = adminClient();
  const members = (await teams.listMemberships({ teamId: church.teamId, queries: [Query.limit(200)] })).memberships;
  const infos = members.length ? (await users.list({ queries: [Query.equal("$id", members.map((m) => m.userId)), Query.limit(200)] })).users : [];
  const manage = canManageTeam(ctx, church.$id);
  return (
    <Card>
      <CardHeader
        title={`Équipe (${members.length})`}
        description="Chaque personne ne voit que les modules autorisés. Le responsable crée l'équipe et règle les droits."
        action={manage ? <CreateAccountDialog churches={[{ value: church.$id, label: church.name }]} defaultChurchId={church.$id} /> : undefined}
      />
      <ul className="divide-y divide-border border-t border-border">
        {members.length === 0 && <li className="px-5 py-6 text-[14px] text-muted">Aucun membre. Créez au moins l&apos;accès du responsable ou du trésorier.</li>}
        {members.map((m) => {
          const u = infos.find((x) => x.$id === m.userId);
          const pending = u && !u.emailVerification;
          return (
            <li key={m.$id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] font-semibold">{initials(m.userName || m.userEmail)}</span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5 text-[14px] font-medium">{m.userName || m.userEmail}{m.userId === ctx.user.id && <Badge tone="neutral" dot={false}>vous</Badge>}{pending && <Badge tone="waiting">Invitation en attente</Badge>}{u && !u.status && <Badge tone="negative">Désactivé</Badge>}</span>
                  <span className="block truncate text-[13px] text-muted">{m.userEmail}</span>
                  <span className="mt-0.5 block text-[12px] text-accent-strong">{accessSummary(m.roles)}</span>
                </span>
              </div>
              {manage && (
                <div className="flex gap-1.5 pl-12 sm:pl-0">
                  {pending && <ResendInviteButton userId={m.userId} />}
                  {(m.userId !== ctx.user.id || ctx.isRegional) && <EditAccessDialog teamId={church.teamId} userId={m.userId} roles={m.roles} userName={m.userName || m.userEmail} churchName={church.name} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
