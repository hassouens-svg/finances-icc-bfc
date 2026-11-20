import { Query } from "node-appwrite";
import { requireContext, assertRegional } from "@/server/context";
import { adminClient } from "@/lib/appwrite/server";
import { MOTHER_TEAM_ID } from "@/lib/schema";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteDialog } from "@/components/admin/delete-dialog";
import { CreateAccountDialog, EditAccessDialog } from "@/components/admin/access";
import { accessSummary } from "@/lib/access";
import { ActionButton } from "@/components/action-form";
import { toggleUserAction, deleteUserAction, toggleSuperAdminAction } from "@/server/actions/admin";
import { ResendInviteButton } from "./resend";
import { ROLE_LABELS } from "@/lib/status";
import { initials, formatDate } from "@/lib/format";

export const metadata = { title: "Utilisateurs" };

export default async function UsersPage() {
  const ctx = await requireContext();
  assertRegional(ctx);
  const { users, teams } = adminClient();
  const list = (await users.list({ queries: [Query.limit(500), Query.orderAsc("name")] })).users;
  const teamDefs = [{ teamId: MOTHER_TEAM_ID, name: "Église mère (admin)" }, ...ctx.allChurches.map((c) => ({ teamId: c.teamId, name: c.name }))];
  const memberships = (
    await Promise.all(teamDefs.map(async (t) => (await teams.listMemberships({ teamId: t.teamId, queries: [Query.limit(200)] }).catch(() => ({ memberships: [] }))).memberships.map((m) => ({ ...m, teamName: t.name }))))
  ).flat();
  return (
    <>
      <PageHeader
        back={{ href: "/app/admin", label: "Administration" }}
        title="Utilisateurs"
        description="Un utilisateur peut avoir des rôles différents dans plusieurs églises."
        actions={<CreateAccountDialog churches={ctx.allChurches.map((c) => ({ value: c.$id, label: c.name }))} canMother={ctx.isRegional} canSuper={ctx.isSuperAdmin} />}
      />
      <Card className="divide-y divide-border">
        {list.map((u) => {
          const ms = memberships.filter((m) => m.userId === u.$id);
          const pending = !u.emailVerification && !u.labels?.includes("superadmin");
          return (
            <div key={u.$id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:px-5">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-fg text-[13px] font-semibold text-bg">{initials(u.name || u.email)}</span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
                    {u.name || u.email}
                    {u.labels?.includes("superadmin") && <Badge tone="done" dot={false}>Super admin</Badge>}
                    {!u.status && <Badge tone="negative">Désactivé</Badge>}
                    {pending && <Badge tone="waiting">Invitation en attente</Badge>}
                  </p>
                  <p className="truncate text-[13px] text-muted">{u.email} · créé le {formatDate(u.$createdAt)}</p>
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {ms.length === 0 && <span className="text-[13px] text-muted">Aucun accès</span>}
                {ms.map((m) => (
                  <div key={m.$id} className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate font-medium">{m.teamName}</span>
                    <Badge tone="progress" dot={false} className="h-auto min-h-6 max-w-full whitespace-normal py-0.5">{m.teamId === "eglise-mere" ? "Administrateur église mère" : accessSummary(m.roles)}</Badge>
                    <EditAccessDialog teamId={m.teamId} userId={m.userId} roles={m.roles} userName={u.name} churchName={m.teamName} />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 sm:flex-col">
                {pending && <ResendInviteButton userId={u.$id} />}
                {ctx.isSuperAdmin && u.$id !== ctx.user.id && (
                  <ActionButton size="sm" variant="ghost" action={toggleSuperAdminAction} payload={{ userId: u.$id }} confirm={u.labels?.includes("superadmin") ? "Retirer les droits de super administrateur ?" : `Donner TOUS les droits à ${u.email} ?`}>
                    {u.labels?.includes("superadmin") ? "Retirer super admin" : "Rendre super admin"}
                  </ActionButton>
                )}
                {u.$id !== ctx.user.id && (
                  <ActionButton size="sm" variant={u.status ? "danger-soft" : "soft"} action={toggleUserAction} payload={{ userId: u.$id }} confirm={u.status ? `Désactiver ${u.email} ? Ses sessions seront fermées.` : undefined}>
                    {u.status ? "Désactiver" : "Réactiver"}
                  </ActionButton>
                )}
                {u.$id !== ctx.user.id && (ctx.isSuperAdmin || !u.labels?.includes("superadmin")) && (
                  <DeleteDialog action={deleteUserAction} fields={{ userId: u.$id }} confirmText={u.email} title={`Supprimer le compte de ${u.name || u.email}`}
                    warning="Le compte est effacé du système : la personne ne pourra plus se connecter. Ce qu'elle a saisi reste dans les données des églises." />
                )}
              </div>
            </div>
          );
        })}
      </Card>
    </>
  );
}
