import { Landmark } from "lucide-react";
import { requireContext, canManage, pickChurch } from "@/server/context";
import { getLookups } from "@/server/lookups";
import { undepositedSessions } from "@/server/deposits";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ChurchPicker } from "@/components/church-picker";
import { DepositForm } from "./deposit-form";

export const metadata = { title: "Nouveau dépôt" };

export default async function NewDeposit({ searchParams }: { searchParams: Promise<{ church?: string }> }) {
  const ctx = await requireContext();
  const { church, allowed } = pickChurch(ctx, (await searchParams).church);
  if (!church || !canManage(ctx, church.$id)) return <EmptyState icon={<Landmark />} title="Aucune église gérable" />;
  const [lk, sessions] = await Promise.all([getLookups(church.$id), undepositedSessions(church.$id)]);
  return (
    <>
      <PageHeader back={{ href: "/app/depots", label: "Dépôts bancaires" }} title="Nouveau dépôt" description={church.name} />
      <ChurchPicker churches={allowed.map((c) => ({ id: c.$id, name: c.name }))} current={church.$id} basePath="/app/depots/nouveau" />
      {lk.bankAccounts.length === 0 ? (
        <EmptyState icon={<Landmark />} title="Aucun compte bancaire" description="Ajoutez d'abord un compte bancaire dans l'administration." />
      ) : (
        <DepositForm churchId={church.$id} accounts={lk.bankAccounts.map((a) => ({ id: a.$id, label: a.label }))} sessions={sessions} />
      )}
    </>
  );
}
