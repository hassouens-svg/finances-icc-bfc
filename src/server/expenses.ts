import "server-only";
import { patch, recordStatus, churchById } from "./data";
import { getLookups, getWorkflows } from "./lookups";
import { writeMovements } from "./deposits";
import { notifyUsers, usersWithRoles, emailUsers, emailLayout, appUrl } from "./notify";
import { selectWorkflow, submit, canBePaid, currentRole } from "@/lib/workflow";
import { movementsForPaidExpense } from "@/lib/finance";
import { formatEuro } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/status";
import { UserError } from "./action";
import type { AppContext } from "./context";
import type { Expense } from "@/lib/types";

/** Notifie les valideurs de l'étape en cours. */
export async function notifyApprovers(e: { $id: string; churchId: string; reference: string; title: string; amountCents: number; stepRoles: string[]; currentStep: number; totalSteps: number; status: string }) {
  const role = currentRole(e);
  if (!role) return;
  const church = await churchById(e.churchId);
  const ids = role === "mother_admin" ? await usersWithRoles("eglise-mere", ["admin"]) : await usersWithRoles(church.teamId, [role]);
  const title = `Dépense à valider : ${e.title} (${formatEuro(e.amountCents)})`;
  await notifyUsers(ids, e.churchId, { kind: "approval", title, body: `${church.name} · étape ${e.currentStep}/${e.stepRoles.length} (${ROLE_LABELS[role]})`, link: `/app/depenses/${e.$id}` });
  await emailUsers(ids, title, emailLayout("Une dépense attend votre validation", `<p><b>${e.title}</b> — ${formatEuro(e.amountCents)}<br/>${church.name} · ${e.reference}</p>`, { label: "Voir et valider", url: appUrl(`/app/depenses/${e.$id}`) }, `Étape ${e.currentStep}/${e.stepRoles.length}`));
}

/** Engage le circuit de validation d'une dépense. */
export async function submitExpenseInternal(ctx: Pick<AppContext, "user">, e: Expense) {
  const wfs = await getWorkflows();
  const wf = selectWorkflow(wfs, { churchId: e.churchId, amountCents: e.amountCents, categoryId: e.categoryId });
  const steps = wf?.stepRoles ?? ["treasurer"];
  const st = submit(steps);
  const data = { status: st.status, currentStep: st.currentStep, totalSteps: st.totalSteps, stepRoles: st.stepRoles, workflowId: wf?.$id ?? null, stepStartedAt: new Date().toISOString() };
  await patch("expenses", e.$id, data);
  await recordStatus({ id: ctx.user.id, name: ctx.user.name }, e.churchId, "expense", e.$id, e.status, st.status, wf ? `Circuit : ${wf.name}` : "Circuit par défaut (trésorier)");
  await notifyApprovers({ ...e, ...data } as Expense);
  return data;
}

/** Règle d'or : impossible de payer avant la fin du circuit. */
export async function payExpenseInternal(ctx: Pick<AppContext, "user">, e: Expense, paidAt: string, bankAccountId?: string | null) {
  if (!canBePaid(e)) throw new UserError("Cette dépense n'a pas terminé son circuit de validation : elle ne peut pas être payée.");
  const bank = e.paymentMethod === "cash" ? null : bankAccountId ?? e.bankAccountId;
  const lk = await getLookups(e.churchId);
  await writeMovements(e.churchId, movementsForPaidExpense({ ...e, paidAt, bankAccountId: bank }, lk.bankAccounts[0]?.$id), ctx.user.id);
  await patch("expenses", e.$id, { status: "paid", paidAt, bankAccountId: bank });
  await recordStatus({ id: ctx.user.id, name: ctx.user.name }, e.churchId, "expense", e.$id, "approved", "paid");
}

