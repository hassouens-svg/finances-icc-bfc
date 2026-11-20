import { notFound, redirect } from "next/navigation";
import { Query } from "node-appwrite";
import { requireContext, canManage, churchName } from "@/server/context";
import { getScoped, listScoped } from "@/server/data";
import { PageHeader } from "@/components/ui/page-header";
import { EnvelopeEntry } from "@/components/offerings/envelope-entry";
import { entryData } from "../../form-data";
import { toDateInput, formatDate } from "@/lib/format";
import type { OfferingLine, OfferingSession } from "@/lib/types";

export const metadata = { title: "Saisie des enveloppes" };

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const s = await getScoped<OfferingSession>(ctx, "offering_sessions", id);
  if (!s) notFound();
  if (s.status !== "draft" || !canManage(ctx, s.churchId, "offrandes")) redirect(`/app/offrandes/${id}`);
  const [data, lines] = await Promise.all([entryData(ctx, s.churchId), listScoped<OfferingLine>(ctx, "offering_lines", [Query.equal("sessionId", id), Query.orderDesc("$createdAt")], [s.churchId])]);
  return (
    <>
      <PageHeader module={4} help="offrandes" back={{ href: "/app/offrandes", label: "Dons & offrandes" }} title={`${s.serviceName ?? "Culte"} du ${formatDate(s.date)}`} description="Saisie au fil de l'eau : chaque enveloppe est enregistrée immédiatement." />
      <EnvelopeEntry
        session={{ id: s.$id, reference: s.reference, churchName: churchName(ctx, s.churchId), date: toDateInput(s.date), serviceId: s.serviceId, counter1Name: s.counter1Name, counter2Name: s.counter2Name, countedCashCents: s.countedCashCents, countedChequeCents: s.countedChequeCents, notes: s.notes }}
        initialLines={lines.map((l) => ({ id: l.$id, donationTypeId: l.donationTypeId ?? "", donationTypeName: l.donationTypeName ?? "", amountCents: l.amountCents, method: l.method, anonymous: l.anonymous, donorId: l.donorId ?? null, donorName: l.donorName ?? null, chequeRef: l.chequeRef ?? null }))}
        donationTypes={data.donationTypes}
        services={data.services}
        initialDonors={data.donors}
      />
    </>
  );
}
