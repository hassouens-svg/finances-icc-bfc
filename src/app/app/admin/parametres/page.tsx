import { requireContext, assertRegional } from "@/server/context";
import { getSettings } from "@/server/lookups";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Alertes & paramètres" };

export default async function SettingsPage() {
  const ctx = await requireContext();
  assertRegional(ctx);
  const s = await getSettings();
  return (
    <>
      <PageHeader back={{ href: "/app/admin", label: "Administration" }} title="Alertes & paramètres" description="Seuils utilisés pour les alertes des tableaux de bord et les rappels." />
      <Card className="max-w-2xl">
        <CardHeader title="Paramètres régionaux" description="S'appliquent à toutes les églises." />
        <CardBody><SettingsForm s={s} /></CardBody>
      </Card>
    </>
  );
}
