import { NoAccess } from "@/components/no-access";
import { Crown } from "lucide-react";
import { requireContext, canSeeModule } from "@/server/context";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CrForm } from "../cr-form";
import { crFormData } from "../form-data";

export const metadata = { title: "Nouvelle demande à la Cité Royale" };

export default async function NewCr() {
  const ctx = await requireContext();
  if (!canSeeModule(ctx, "citeroyale")) return <NoAccess />;
  const data = await crFormData(ctx);
  if (!data.churches.length) return <EmptyState icon={<Crown />} title="Vous n'avez pas les droits de saisie" />;
  return (<><PageHeader module={1} back={{ href: "/app/cite-royale", label: "Demandes Cité Royale" }} title="Nouvelle demande à la Cité Royale" /><CrForm {...data} /></>);
}
