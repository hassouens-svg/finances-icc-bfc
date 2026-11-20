import Link from "next/link";
import { notFound } from "next/navigation";
import { Query } from "node-appwrite";
import { Pencil, Send, ShieldCheck, Lock, Check, X, Circle } from "lucide-react";
import { requireContext, canManage, canApproveAs, churchName } from "@/server/context";
import { getScoped, listScoped } from "@/server/data";
import { getTimeline, getAttachments } from "@/server/entity";
import { getLookups } from "@/server/lookups";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailList, AttachmentsCard, HistoryCard } from "@/components/detail/blocks";
import { ActionButton } from "@/components/action-form";
import { ApprovalButtons, PayDialog } from "@/components/expenses/approval";
import { submitExpenseAction, deleteExpenseAction } from "@/server/actions/expenses";
import { currentRole } from "@/lib/workflow";
import { formatEuro, formatDate } from "@/lib/format";
import { METHOD_LABELS, ROLE_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Approval, Expense, Project } from "@/lib/types";

export default async function ExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const e = await getScoped<Expense>(ctx, "expenses", id);
  if (!e) notFound();
  const [lk, timeline, atts, approvals, project] = await Promise.all([
    getLookups(e.churchId), getTimeline("expense", id), getAttachments("expense", id),
    listScoped<Approval>(ctx, "approvals", [Query.equal("expenseId", id), Query.orderAsc("$createdAt")], [e.churchId]),
    e.projectId ? getScoped<Project>(ctx, "projects", e.projectId) : Promise.resolve(null),
  ]);
  const manage = canManage(ctx, e.churchId, "depenses");
  const role = currentRole(e);
  const mayApprove = role ? canApproveAs(ctx, e.churchId, role) : false;
  const accounts = lk.bankAccounts.map((a) => ({ id: a.$id, name: a.label }));
  return (
    <>
      <PageHeader back={{ href: "/app/depenses", label: "Dépenses" }}
        eyebrow={<div className="flex flex-wrap gap-2"><StatusBadge entity="expense" status={e.status} suffix={e.status === "in_approval" ? `· étape ${e.currentStep}/${e.totalSteps}` : undefined} />{e.isRegularization && <Badge tone="waiting" dot={false}>Régularisation</Badge>}</div>}
        title={e.title} description={`${e.reference} · ${churchName(ctx, e.churchId)}`}
        actions={manage ? (
          <>
            {["draft", "rejected"].includes(e.status) && <ActionButton action={submitExpenseAction} payload={{ id }}><Send /> Soumettre à validation</ActionButton>}
            {["draft", "rejected", "in_approval"].includes(e.status) && <Button asChild variant="secondary"><Link href={`/app/depenses/${id}/modifier`}><Pencil /> Modifier</Link></Button>}
            {e.status === "approved" && <PayDialog id={id} method={e.paymentMethod} accounts={accounts} bankAccountId={e.bankAccountId} />}
            {e.status === "draft" && <ActionButton variant="danger-soft" action={deleteExpenseAction} payload={{ id }} confirm="Supprimer ce brouillon ?">Supprimer</ActionButton>}
          </>
        ) : undefined}
      />
      <div className="mb-5 rounded-2xl border border-border bg-bg p-5 shadow-card">
        <p className="text-[13px] text-muted">Montant</p>
        <p className="num text-[32px] font-semibold tracking-tight text-accent">{formatEuro(e.amountCents)}</p>
      </div>
      {role && (
        <Card className={cn("mb-5", mayApprove && "border-accent/40 ring-4 ring-accent-soft")}>
          <CardHeader title={mayApprove ? "Votre validation est attendue" : "En attente de validation"} description={`Étape ${e.currentStep}/${e.totalSteps} : ${ROLE_LABELS[role]}`} />
          {mayApprove && <CardBody><ApprovalButtons id={id} /></CardBody>}
        </Card>
      )}
      {e.status === "approved" && !manage && <p className="mb-5 rounded-xl bg-success-soft px-4 py-3 text-[14px] text-success">Circuit terminé : le trésorier peut maintenant payer cette dépense.</p>}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Circuit de validation" description={e.totalSteps ? undefined : "Pas encore soumise."} />
            {e.stepRoles.length > 0 && (
              <ol className="space-y-0 border-t border-border">
                {e.stepRoles.map((r, i) => {
                  const step = i + 1;
                  const decision = [...approvals].reverse().find((a) => a.stepOrder === step && a.decision !== "info_requested");
                  const done = e.status === "paid" || e.status === "approved" || step < e.currentStep || decision?.decision === "approved";
                  const rejected = decision?.decision === "rejected";
                  const current = e.status === "in_approval" && step === e.currentStep;
                  return (
                    <li key={i} className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-0">
                      <span className={cn("grid size-8 place-items-center rounded-full", rejected ? "bg-danger-soft text-danger" : done ? "bg-success text-white" : current ? "bg-accent text-white" : "bg-surface-2 text-muted")}>
                        {rejected ? <X className="size-4" /> : done ? <Check className="size-4" /> : r === "mother_admin" ? <ShieldCheck className="size-4" /> : <Circle className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1 text-[14px]">
                        <span className="font-medium">{step}. {ROLE_LABELS[r]}</span>
                        <span className="block text-[12px] text-muted">{decision ? `${decision.userName} · ${formatDate(decision.$createdAt)}${decision.comment ? ` — ${decision.comment}` : ""}` : current ? "En attente" : "—"}</span>
                      </span>
                    </li>
                  );
                })}
                <li className="flex items-center gap-3 px-5 py-3">
                  <span className={cn("grid size-8 place-items-center rounded-full", e.status === "paid" ? "bg-success text-white" : "bg-surface-2 text-muted")}>{e.status === "paid" ? <Check className="size-4" /> : <Lock className="size-3.5" />}</span>
                  <span className="text-[14px]"><span className="font-medium">Paiement</span><span className="block text-[12px] text-muted">{e.status === "paid" ? `Payée le ${formatDate(e.paidAt)}` : "Possible uniquement après la dernière validation"}</span></span>
                </li>
              </ol>
            )}
          </Card>
          <HistoryCard items={timeline} entityType="expense" entityId={id} canComment={manage || mayApprove} />
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Détail" />
            <CardBody>
              <DetailList items={[
                ["Date", formatDate(e.date)], ["Catégorie", e.categoryName], ["Fournisseur", e.supplier],
                ["Paiement", METHOD_LABELS[e.paymentMethod]], ["Compte", lk.bankAccounts.find((a) => a.$id === e.bankAccountId)?.label ?? (e.paymentMethod === "cash" ? "Caisse" : "—")],
                ["Département", lk.departments.find((d) => d.$id === e.departmentId)?.name],
                ["Projet", project ? <Link key="p" className="text-accent" href={`/app/projets/${project.$id}`}>{project.name}</Link> : "—"],
                ...(e.isRegularization ? [["Avancée par", e.advancedBy], ["Motif", e.regularizationReason]] as [string, string | null | undefined][] : []),
                ...(e.source === "reimbursement" && e.sourceId ? [["Origine", <Link key="r" className="text-accent" href={`/app/remboursements/${e.sourceId}`}>Remboursement</Link>]] as [string, React.ReactNode][] : []),
                ...(e.source === "funding" && e.sourceId ? [["Origine", <Link key="f" className="text-accent" href={`/app/besoins/${e.sourceId}`}>Besoin de département</Link>]] as [string, React.ReactNode][] : []),
                ["Notes", e.notes],
              ]} />
            </CardBody>
          </Card>
          <AttachmentsCard items={atts} entityType="expense" entityId={id} canUpload={manage} />
        </div>
      </div>
    </>
  );
}
