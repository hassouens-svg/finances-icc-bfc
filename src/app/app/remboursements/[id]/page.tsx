import { NoAccess } from "@/components/no-access";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContext, canManage, churchName, canSeeModule } from "@/server/context";
import { getScoped } from "@/server/data";
import { getTimeline, getAttachments } from "@/server/entity";
import { getLookups, forChurch } from "@/server/lookups";
import { decrypt, mask } from "@/server/crypto";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { DetailList, AttachmentsCard, HistoryCard } from "@/components/detail/blocks";
import { TransitionButton } from "@/components/detail/client";
import { ApproveReimbursementDialog, PayReimbursementDialog } from "./dialogs";
import { allowedTransitions } from "@/lib/transitions";
import { formatEuro, formatDate } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/status";
import type { Expense, Reimbursement } from "@/lib/types";

export default async function ReimbursementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  if (!canSeeModule(ctx, "remboursements")) return <NoAccess />;
  const r = await getScoped<Reimbursement>(ctx, "reimbursements", id);
  if (!r) notFound();
  const [lk, timeline, atts, expense] = await Promise.all([
    getLookups(r.churchId), getTimeline("reimbursement", id), getAttachments("reimbursement", id),
    r.expenseId ? getScoped<Expense>(ctx, "expenses", r.expenseId) : Promise.resolve(null),
  ]);
  const manage = canManage(ctx, r.churchId, "remboursements");
  let bank: string | null = null;
  try { bank = r.payeeBankInfo ? mask(decrypt(r.payeeBankInfo)) : null; } catch { bank = "••••"; }
  const transitions = allowedTransitions("reimbursement", r.status).filter((t) => t.to !== "approved");
  return (
    <>
      <PageHeader back={{ href: "/app/remboursements", label: "Remboursements" }} eyebrow={<StatusBadge entity="reimbursement" status={r.status} />}
        title={`${r.requesterName} — ${formatEuro(r.amountCents)}`} description={`${r.reference} · ${churchName(ctx, r.churchId)}`}
        actions={manage ? (
          <>
            {transitions.map((t) => <TransitionButton key={t.to} entityType="reimbursement" entityId={id} {...t} />)}
            {["submitted", "checking"].includes(r.status) && <ApproveReimbursementDialog id={id} categories={forChurch(lk.categories, r.churchId).map((c) => ({ id: c.$id, name: c.name }))} />}
            {r.status === "approved" && expense?.status === "approved" && <PayReimbursementDialog id={id} wished={r.wishedMethod ?? "transfer"} />}
          </>
        ) : undefined}
      />
      {r.status === "approved" && expense && expense.status !== "approved" && expense.status !== "paid" && (
        <p className="mb-5 rounded-xl bg-accent-soft px-4 py-3 text-[14px] text-accent-strong">
          La dépense liée <Link className="font-semibold underline" href={`/app/depenses/${expense.$id}`}>{expense.reference}</Link> suit son circuit de validation (étape {expense.currentStep}/{expense.totalSteps}). Le remboursement sera possible dès sa validation complète.
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <AttachmentsCard items={atts} entityType="reimbursement" entityId={id} canUpload={manage} />
          <HistoryCard items={timeline} entityType="reimbursement" entityId={id} canComment={manage} />
        </div>
        <Card>
          <CardHeader title="Demande" />
          <CardBody>
            <DetailList items={[
              ["Demandeur", r.requesterName], ["Email", r.requesterEmail], ["Téléphone", r.requesterPhone],
              ["Département", lk.departments.find((d) => d.$id === r.departmentId)?.name], ["Motif", r.reason],
              ["Date de la dépense", formatDate(r.expenseDate)], ["Montant", <span key="m" className="num">{formatEuro(r.amountCents)}</span>],
              ["Mode souhaité", METHOD_LABELS[r.wishedMethod ?? ""] ?? r.wishedMethod], ["Motif du refus", r.rejectReason ?? undefined],
              ["Dépense liée", expense ? <Link key="e" href={`/app/depenses/${expense.$id}`} className="text-accent">{expense.reference}</Link> : "—"],
              ["Remboursée le", r.paidAt ? formatDate(r.paidAt) : "—"], ["Coordonnées (protégées)", bank ?? "—"],
            ]} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
