/** Sélection et progression du circuit de validation des dépenses (logique pure). */
export type WorkflowRule = {
  $id: string; churchId: string; name: string; minCents: number; maxCents?: number | null; categoryIds: string[];
  stepRoles: string[]; stepDelaysHours: number[]; priority: number; active: boolean;
};

export const DEFAULT_WORKFLOW: Omit<WorkflowRule, "$id" | "churchId"> = {
  name: "Par défaut — trésorier", minCents: 0, maxCents: null, categoryIds: [], stepRoles: ["treasurer"], stepDelaysHours: [72], priority: -1, active: true,
};

/**
 * Règle la plus spécifique : église > régionale, puis catégorie ciblée, puis priorité, puis seuil minimum le plus haut.
 */
export function selectWorkflow(rules: WorkflowRule[], e: { churchId: string; amountCents: number; categoryId?: string | null }) {
  const candidates = rules.filter(
    (r) =>
      r.active &&
      (r.churchId === e.churchId || r.churchId === "region") &&
      e.amountCents >= (r.minCents ?? 0) &&
      (r.maxCents == null || e.amountCents < r.maxCents) &&
      (!r.categoryIds?.length || (e.categoryId != null && r.categoryIds.includes(e.categoryId))) &&
      r.stepRoles.length > 0,
  );
  candidates.sort((a, b) => {
    const s = (r: WorkflowRule) => (r.churchId === e.churchId ? 4 : 0) + (r.categoryIds?.length ? 2 : 0);
    return s(b) - s(a) || b.priority - a.priority || b.minCents - a.minCents;
  });
  return candidates[0] ?? null;
}

export type ExpenseState = { status: string; currentStep: number; totalSteps: number; stepRoles: string[] };

export function submit(steps: string[]): ExpenseState {
  if (!steps.length) return { status: "approved", currentStep: 0, totalSteps: 0, stepRoles: [] };
  return { status: "in_approval", currentStep: 1, totalSteps: steps.length, stepRoles: steps };
}

export function decide(s: ExpenseState, decision: "approved" | "rejected" | "info_requested"): ExpenseState {
  if (s.status !== "in_approval") throw new Error("Cette dépense n'est pas en cours de validation.");
  if (decision === "rejected") return { ...s, status: "rejected" };
  if (decision === "info_requested") return { ...s };
  if (s.currentStep >= s.totalSteps) return { ...s, status: "approved", currentStep: s.totalSteps };
  return { ...s, currentStep: s.currentStep + 1 };
}

export function currentRole(s: ExpenseState) {
  return s.status === "in_approval" ? s.stepRoles[s.currentStep - 1] ?? null : null;
}

/** Règle d'or : une dépense ne peut être payée que si son circuit est terminé. */
export function canBePaid(s: { status: string }) {
  return s.status === "approved";
}
