import { requireContext, canManage } from "@/server/context";
import { getShellCounts } from "@/server/counts";
import { Shell } from "@/components/shell/shell";
import { RealtimeRefresher } from "@/components/realtime";
import { ROLE_LABELS } from "@/lib/status";
import { logoUrl } from "@/lib/logo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const counts = await getShellCounts(ctx);
  const firstRole = ctx.activeChurch ? ctx.roles[ctx.activeChurch.$id]?.[0] : undefined;
  const roleLabel = ctx.isSuperAdmin ? ROLE_LABELS.superadmin! : ctx.isMotherAdmin ? ROLE_LABELS.admin! : firstRole ? ROLE_LABELS[firstRole]! : "Membre";
  const canAdmin = ctx.isRegional || ctx.churches.some((c) => canManage(ctx, c.$id));
  return (
    <Shell
      user={{ name: ctx.user.name, email: ctx.user.email, roleLabel }}
      churches={ctx.churches.map((c) => ({ id: c.$id, name: c.name, isMother: c.isMother, city: ctx.cities.find((x) => x.$id === c.cityId)?.name, logo: logoUrl(c) }))}
      brandLogo={logoUrl(ctx.motherChurch)}
      view={ctx.view}
      isRegional={ctx.isRegional}
      canAdmin={canAdmin}
      canWrite={ctx.scopeIds.some((id) => canManage(ctx, id))}
      unread={counts.unread}
      badges={counts.badges}
    >
      <RealtimeRefresher />
      {children}
    </Shell>
  );
}
