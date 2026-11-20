import { notFound } from "next/navigation";
import Link from "next/link";
import { Query } from "node-appwrite";
import { requireContext, assertRegional } from "@/server/context";
import { adminClient } from "@/lib/appwrite/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChurchDialog } from "@/components/admin/forms";
import { TeamCard } from "@/components/admin/team-card";
import { ActionButton } from "@/components/action-form";
import { toggleChurchActiveAction } from "@/server/actions/admin";
import { ROLE_LABELS } from "@/lib/status";
import { initials } from "@/lib/format";
import { logoUrl } from "@/lib/logo";
import { churchSetup } from "@/server/setup";
import { ChurchSteps } from "@/components/admin/church-steps";

export default async function ChurchDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  assertRegional(ctx);
  const c = ctx.allChurches.find((x) => x.$id === id);
  if (!c) notFound();
  const { teams } = adminClient();
  const members = (await teams.listMemberships({ teamId: c.teamId, queries: [Query.limit(100)] })).memberships;
  const city = ctx.cities.find((x) => x.$id === c.cityId);
  const [setup] = await churchSetup([c]);
  return (
    <>
      <PageHeader
        back={{ href: "/app/admin/eglises", label: "Villes & églises" }}
        eyebrow={c.isMother ? <Badge tone="progress" dot={false}>Église mère régionale</Badge> : <Badge tone="neutral" dot={false}>Église fille</Badge>}
        title={<span className="flex items-center gap-3">{logoUrl(c) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl(c)!} alt="" className="size-11 rounded-xl border border-border object-cover" />
        )}{c.name}</span>}
        description={[city?.name, c.address].filter(Boolean).join(" · ")}
        actions={
          <>
            <ChurchDialog cities={ctx.cities.map((x) => ({ value: x.$id, label: x.name }))} isSuperAdmin={ctx.isSuperAdmin}
              church={{ id: c.$id, name: c.name, cityId: c.cityId, address: c.address, pastorName: c.pastorName, refPrefix: c.refPrefix, isMother: c.isMother, allowLocalLists: c.allowLocalLists, logoUrl: logoUrl(c) }} />
            {!c.isMother && (
              <ActionButton variant={c.active ? "danger-soft" : "soft"} action={toggleChurchActiveAction} payload={{ id: c.$id }} confirm={c.active ? "Archiver cette église ? Ses données sont conservées." : undefined}>
                {c.active ? "Archiver" : "Réactiver"}
              </ActionButton>
            )}
          </>
        }
      />
      <div className="mb-5"><ChurchSteps s={setup!} canInvite /></div>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <TeamCard ctx={ctx} church={c} />
        <Card>
          <CardHeader title="Raccourcis" />
          <CardBody className="grid gap-2">
            {[
              ["Départements", `/app/admin/departements?church=${c.$id}`],
              ["Comptes bancaires", `/app/admin/comptes?church=${c.$id}`],
              ["Listes locales", `/app/admin/listes?church=${c.$id}`],
              ["Liens publics", `/app/admin/liens?church=${c.$id}`],
              ["Journal d'audit", `/app/admin/audit?church=${c.$id}`],
            ].map(([l, h]) => (
              <Link key={h} href={h!} className="rounded-xl border border-border px-3.5 py-2.5 text-[14px] font-medium hover:border-accent/40 hover:bg-surface">{l} →</Link>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
