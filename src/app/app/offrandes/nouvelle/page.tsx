import { HandCoins } from "lucide-react";
import { requireContext } from "@/server/context";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionForm } from "@/components/offerings/session-form";
import { sessionFormData } from "../form-data";

export const metadata = { title: "Nouvelle séance d'offrandes" };

export default async function NewSession() {
  const ctx = await requireContext();
  const data = await sessionFormData(ctx);
  if (!data.churches.length) return <EmptyState icon={<HandCoins />} title="Vous n'avez pas les droits de saisie" description="Seuls les trésoriers peuvent saisir des offrandes." />;
  return (
    <>
      <PageHeader back={{ href: "/app/offrandes", label: "Dons & offrandes" }} title="Nouvelle séance d'offrandes" description="Date du culte, lignes de dons, puis comptage à deux." />
      <SessionForm {...data} />
    </>
  );
}
