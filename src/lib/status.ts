export type Tone = "neutral" | "progress" | "waiting" | "positive" | "done" | "negative";

type StatusDef = { label: string; tone: Tone };

export const STATUS: Record<string, Record<string, StatusDef>> = {
  cr_request: {
    draft: { label: "Brouillon", tone: "neutral" },
    mother_review: { label: "À valider par l'église mère", tone: "waiting" },
    initiated: { label: "Initiée", tone: "progress" },
    sent: { label: "Envoyée à la Cité Royale", tone: "progress" },
    pending: { label: "En attente", tone: "waiting" },
    approved: { label: "Validée", tone: "positive" },
    rejected: { label: "Refusée", tone: "negative" },
    received_full: { label: "Reçue", tone: "positive" },
    received_partial: { label: "Reçue partiellement", tone: "waiting" },
    closed: { label: "Clôturée", tone: "done" },
  },
  funding_request: {
    received: { label: "Reçu", tone: "progress" },
    reviewing: { label: "En étude", tone: "progress" },
    approved: { label: "Approuvé", tone: "positive" },
    partially_approved: { label: "Approuvé partiellement", tone: "positive" },
    rejected: { label: "Refusé", tone: "negative" },
    funded: { label: "Financé", tone: "done" },
  },
  reimbursement: {
    submitted: { label: "Soumise", tone: "progress" },
    checking: { label: "En vérification", tone: "progress" },
    approved: { label: "Validée", tone: "positive" },
    rejected: { label: "Refusée", tone: "negative" },
    paid: { label: "Remboursée", tone: "done" },
  },
  offering_session: {
    draft: { label: "En cours de saisie", tone: "neutral" },
    validated: { label: "Validée", tone: "done" },
  },
  expense: {
    draft: { label: "Brouillon", tone: "neutral" },
    submitted: { label: "Soumise", tone: "progress" },
    in_approval: { label: "En validation", tone: "progress" },
    approved: { label: "Approuvée", tone: "positive" },
    rejected: { label: "Refusée", tone: "negative" },
    paid: { label: "Payée", tone: "done" },
  },
  deposit: {
    prepared: { label: "Préparé", tone: "neutral" },
    deposited: { label: "Déposé", tone: "progress" },
    confirmed: { label: "Confirmé", tone: "done" },
  },
  project: {
    planned: { label: "Prévu", tone: "neutral" },
    active: { label: "En cours", tone: "progress" },
    done: { label: "Terminé", tone: "done" },
    cancelled: { label: "Annulé", tone: "negative" },
  },
};

export function statusDef(entity: string, status: string): StatusDef {
  return STATUS[entity]?.[status] ?? { label: status, tone: "neutral" };
}

export const PRIORITY_LABELS: Record<string, { label: string; tone: Tone }> = {
  low: { label: "Basse", tone: "neutral" },
  normal: { label: "Normale", tone: "progress" },
  high: { label: "Haute", tone: "waiting" },
  urgent: { label: "Urgente", tone: "negative" },
};

export const METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  cheque: "Chèque",
  transfer: "Virement",
  card: "Carte / TPE",
  mobile: "Paiement mobile",
  bank_transfer: "Virement",
};

export const ROLE_LABELS: Record<string, string> = {
  treasurer: "Trésorier",
  pastor: "Pasteur / Responsable",
  reader: "Lecteur",
  mother_admin: "Église mère",
  admin: "Administrateur église mère",
  superadmin: "Super administrateur",
};
