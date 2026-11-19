import { requireContext } from "@/server/context";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetailList } from "@/components/detail/blocks";
import { ROLE_LABELS } from "@/lib/status";
import { PasswordChange } from "./password";

export const metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const ctx = await requireContext();
  return (
    <>
      <PageHeader title="Mon compte" />
      <div className="grid max-w-4xl gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profil" />
          <CardBody>
            <DetailList items={[["Nom", ctx.user.name], ["Email", ctx.user.email], ["Statut", ctx.isSuperAdmin ? "Super administrateur" : ctx.isMotherAdmin ? "Administrateur église mère" : "Membre"]]} />
            <div className="mt-4 space-y-2">
              {Object.entries(ctx.roles).map(([id, roles]) => (
                <div key={id} className="flex items-center justify-between gap-2 text-[14px]"><span>{ctx.allChurches.find((c) => c.$id === id)?.name}</span><span className="flex gap-1">{roles.map((r) => <Badge key={r} tone="progress" dot={false}>{ROLE_LABELS[r]}</Badge>)}</span></div>
              ))}
            </div>
          </CardBody>
        </Card>
        <Card><CardHeader title="Changer de mot de passe" /><CardBody><PasswordChange /></CardBody></Card>
      </div>
    </>
  );
}
