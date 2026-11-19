import { notFound, redirect } from "next/navigation";
import { Query } from "node-appwrite";
import { requireContext, canManage } from "@/server/context";
import { getScoped, listScoped } from "@/server/data";
import { PageHeader } from "@/components/ui/page-header";
import { SessionForm } from "@/components/offerings/session-form";
import { sessionFormData } from "../../form-data";
import { toDateInput } from "@/lib/format";
import type { OfferingLine, OfferingSession } from "@/lib/types";

export default async function EditSession({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const s = await getScoped<OfferingSession>(ctx, "offering_sessions", id);
  if (!s) notFound();
  if (s.status !== "draft" || !canManage(ctx, s.churchId)) redirect(`/app/offrandes/${id}`);
  const [data, lines] = await Promise.all([sessionFormData(ctx), listScoped<OfferingLine>(ctx, "offering_lines", [Query.equal("sessionId", id)], [s.churchId])]);
  if (!data.churches.some((c) => c.id === s.churchId)) data.churches.push({ id: s.churchId, name: ctx.allChurches.find((c) => c.$id === s.churchId)?.name ?? "" });
  return (
    <>
      <PageHeader back={{ href: `/app/offrandes/${id}`, label: s.reference }} title="Modifier la séance" />
      <SessionForm {...data} initial={{
        id: s.$id, churchId: s.churchId, date: toDateInput(s.date), serviceId: s.serviceId, counter1Name: s.counter1Name, counter2Name: s.counter2Name,
        countedCashCents: s.countedCashCents, countedChequeCents: s.countedChequeCents, notes: s.notes,
        lines: lines.map((l) => ({ donationTypeId: l.donationTypeId ?? "", amountCents: l.amountCents, method: l.method, anonymous: l.anonymous, donorId: l.donorId, donorName: l.donorName, chequeRef: l.chequeRef })),
      }} />
    </>
  );
}
