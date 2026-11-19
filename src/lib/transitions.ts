/** Machines d'états déclaratives : transitions autorisées et commentaire obligatoire. */
type T = { to: string; label: string; comment?: "required" | "optional"; tone?: "primary" | "secondary" | "danger" | "success" };

export const TRANSITIONS: Record<string, Record<string, T[]>> = {
  reimbursement: {
    submitted: [{ to: "checking", label: "Commencer la vérification", tone: "primary" }, { to: "rejected", label: "Refuser", comment: "required", tone: "danger" }],
    checking: [{ to: "approved", label: "Valider", tone: "success", comment: "optional" }, { to: "rejected", label: "Refuser", comment: "required", tone: "danger" }],
    approved: [],
    rejected: [],
    paid: [],
  },
  funding_request: {
    received: [{ to: "reviewing", label: "Mettre à l'étude", tone: "primary" }, { to: "rejected", label: "Refuser", comment: "required", tone: "danger" }],
    reviewing: [
      { to: "approved", label: "Approuver", tone: "success", comment: "optional" },
      { to: "partially_approved", label: "Approuver partiellement", comment: "required", tone: "secondary" },
      { to: "rejected", label: "Refuser", comment: "required", tone: "danger" },
    ],
    approved: [{ to: "funded", label: "Marquer comme financé", tone: "success", comment: "optional" }],
    partially_approved: [{ to: "funded", label: "Marquer comme financé", tone: "success", comment: "optional" }],
    rejected: [],
    funded: [],
  },
  cr_request: {
    draft: [{ to: "initiated", label: "Initier la demande", tone: "primary" }],
    mother_review: [{ to: "initiated", label: "Valider (église mère)", tone: "success", comment: "optional" }, { to: "rejected", label: "Refuser", comment: "required", tone: "danger" }],
    initiated: [{ to: "sent", label: "Marquer envoyée à la Cité Royale", tone: "primary", comment: "optional" }],
    sent: [{ to: "pending", label: "En attente de réponse", tone: "secondary" }, { to: "approved", label: "Validée par la Cité Royale", tone: "success", comment: "optional" }, { to: "rejected", label: "Refusée par la Cité Royale", comment: "required", tone: "danger" }],
    pending: [{ to: "approved", label: "Validée par la Cité Royale", tone: "success", comment: "optional" }, { to: "rejected", label: "Refusée par la Cité Royale", comment: "required", tone: "danger" }],
    approved: [],
    rejected: [{ to: "closed", label: "Clôturer", tone: "secondary" }],
    received_full: [{ to: "closed", label: "Clôturer", tone: "secondary" }],
    received_partial: [{ to: "closed", label: "Clôturer", tone: "secondary", comment: "optional" }],
    closed: [],
  },
  deposit: {
    prepared: [{ to: "deposited", label: "Marquer déposé à la banque", tone: "primary" }],
    deposited: [],
    confirmed: [],
  },
};

export function allowedTransitions(entity: string, from: string) {
  return TRANSITIONS[entity]?.[from] ?? [];
}
export function canTransition(entity: string, from: string, to: string) {
  return allowedTransitions(entity, from).some((t) => t.to === to);
}
