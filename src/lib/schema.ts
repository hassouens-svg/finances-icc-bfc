/**
 * Schéma unique de la base Appwrite (TablesDB).
 * Source de vérité pour `npm run setup:appwrite` et pour les types de l'application.
 * Montants : toujours en centimes (entiers).
 */

export type ColumnDef =
  | { key: string; type: "varchar"; size: number; required?: boolean; default?: string; array?: boolean }
  | { key: string; type: "text"; required?: boolean; default?: string }
  | { key: string; type: "integer"; required?: boolean; default?: number; array?: boolean; min?: number; max?: number }
  | { key: string; type: "boolean"; required?: boolean; default?: boolean }
  | { key: string; type: "datetime"; required?: boolean }
  | { key: string; type: "enum"; elements: readonly string[]; required?: boolean; default?: string; array?: boolean };

export type IndexDef = { key: string; type: "key" | "unique" | "fulltext"; columns: string[]; orders?: ("ASC" | "DESC")[] };

export type TableDef = {
  id: string;
  name: string;
  /** "users" = lisible par tout utilisateur connecté (listes globales). "none" = permissions par ligne uniquement. */
  tablePermissions: "users" | "none";
  columns: ColumnDef[];
  indexes: IndexDef[];
};

export const DATABASE_ID = "icc_finances";

// ---------- Enums partagés ----------
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const PAYMENT_METHODS = ["cash", "cheque", "transfer", "card", "mobile"] as const;
export const EXPENSE_PAY_METHODS = ["cash", "bank_transfer", "card", "cheque"] as const;
export const APPROVER_ROLES = ["treasurer", "pastor", "mother_admin"] as const;

export const CR_STATUSES = [
  "draft", "mother_review", "initiated", "sent", "pending", "approved", "rejected", "received_full", "received_partial", "closed",
] as const;
export const FUNDING_STATUSES = ["received", "reviewing", "approved", "partially_approved", "rejected", "funded"] as const;
export const REIMB_STATUSES = ["submitted", "checking", "approved", "rejected", "paid"] as const;
export const SESSION_STATUSES = ["draft", "validated"] as const;
export const EXPENSE_STATUSES = ["draft", "submitted", "in_approval", "approved", "rejected", "paid"] as const;
export const DEPOSIT_STATUSES = ["prepared", "deposited", "confirmed"] as const;
export const PROJECT_STATUSES = ["planned", "active", "done", "cancelled"] as const;

// ---------- Helpers ----------
const id = (key: string, required = false): ColumnDef => ({ key, type: "varchar", size: 36, required });
const str = (key: string, size = 255, required = false): ColumnDef => ({ key, type: "varchar", size, required });
const text = (key: string): ColumnDef => ({ key, type: "text" });
const int = (key: string, required = false, def?: number): ColumnDef =>
  required ? { key, type: "integer", required } : { key, type: "integer", default: def };
const bool = (key: string, def = false): ColumnDef => ({ key, type: "boolean", default: def });
const date = (key: string, required = false): ColumnDef => ({ key, type: "datetime", required });
const en = (key: string, elements: readonly string[], def?: string): ColumnDef =>
  def ? { key, type: "enum", elements, default: def } : { key, type: "enum", elements, required: true };

const church = [id("churchId", true), id("createdBy"), bool("archived")];
const idx = (key: string, ...columns: string[]): IndexDef => ({ key, type: "key", columns });
const uniq = (key: string, ...columns: string[]): IndexDef => ({ key, type: "unique", columns });

export const TABLES: TableDef[] = [
  // ---------------- Structure & configuration ----------------
  {
    id: "cities", name: "Villes", tablePermissions: "users",
    columns: [str("name", 120, true), str("region", 120), bool("archived")],
    indexes: [idx("name", "name")],
  },
  {
    id: "churches", name: "Églises", tablePermissions: "users",
    columns: [
      str("name", 160, true), str("slug", 60, true), id("cityId"), str("address", 400), bool("isMother"),
      id("parentChurchId"), str("pastorName", 160), id("logoFileId"), str("teamId", 36, true), str("refPrefix", 6, true),
      bool("active", true), bool("allowLocalLists", true),
    ],
    indexes: [uniq("slug", "slug"), idx("cityId", "cityId"), idx("isMother", "isMother")],
  },
  {
    id: "departments", name: "Départements", tablePermissions: "none",
    columns: [...church, str("name", 120, true), str("leaderName", 160), str("leaderEmail", 200), int("annualBudgetCents")],
    indexes: [idx("churchId", "churchId")],
  },
  {
    // churchId = "region" pour les listes par défaut définies par l'église mère
    id: "list_items", name: "Listes configurables", tablePermissions: "users",
    columns: [
      ...church,
      en("kind", ["expense_category", "donation_type", "cr_request_type", "service"]),
      str("name", 120, true), str("code", 30), int("sortOrder", false, 0), bool("isTithe"),
    ],
    indexes: [idx("churchKind", "churchId", "kind")],
  },
  {
    id: "bank_accounts", name: "Comptes bancaires", tablePermissions: "none",
    columns: [...church, str("label", 120, true), str("bankName", 120), str("ibanMasked", 12), int("openingBalanceCents", false, 0), date("openingDate")],
    indexes: [idx("churchId", "churchId")],
  },
  {
    id: "settings", name: "Paramètres", tablePermissions: "users",
    columns: [str("scope", 40, true), str("key", 80, true), { key: "valueJson", type: "text" }],
    indexes: [uniq("scopeKey", "scope", "key")],
  },
  {
    id: "counters", name: "Compteurs", tablePermissions: "none",
    columns: [str("key", 60, true), int("value", false, 0)],
    indexes: [uniq("key", "key")],
  },
  {
    id: "user_profiles", name: "Profils utilisateurs", tablePermissions: "none",
    columns: [id("userId", true), str("displayName", 160), str("phone", 40), text("notifPrefsJson"), bool("disabled")],
    indexes: [uniq("userId", "userId")],
  },
  {
    id: "public_links", name: "Liens publics", tablePermissions: "none",
    columns: [
      ...church, en("kind", ["funding", "reimbursement"]), id("departmentId"), str("token", 64, true), str("label", 160),
      bool("active", true), date("expiresAt"), int("submissionsCount", false, 0),
    ],
    indexes: [uniq("token", "token"), idx("churchId", "churchId")],
  },

  // ---------------- Module 1 : Cité Royale ----------------
  {
    id: "cr_requests", name: "Demandes Cité Royale", tablePermissions: "none",
    columns: [
      ...church, str("reference", 30, true), str("title", 200, true), id("typeId"), text("reason"), text("description"),
      int("quantity"), int("estimatedCents"), en("priority", PRIORITIES, "normal"), date("wishedDate"), id("departmentId"),
      str("contactName", 160), str("sendChannel", 80), str("crReference", 80), en("status", CR_STATUSES, "draft"), bool("viaMother"),
      int("receivedCents"), int("receivedQuantity"), date("receivedAt"), id("receiptFileId"), date("statusChangedAt"), id("sourceFundingId"),
    ],
    indexes: [idx("churchStatus", "churchId", "status"), idx("statusChangedAt", "statusChangedAt")],
  },

  // ---------------- Module 2 : Besoins ----------------
  {
    id: "funding_requests", name: "Besoins des départements", tablePermissions: "none",
    columns: [
      ...church, str("reference", 30, true), id("publicLinkId"), str("requesterName", 160, true), str("requesterEmail", 200),
      str("requesterPhone", 40), id("departmentId"), str("title", 200, true), text("description"), int("estimatedCents", true),
      int("approvedCents"), date("wishedDate"), en("priority", PRIORITIES, "normal"), en("status", FUNDING_STATUSES, "received"),
      str("trackingToken", 64, true), text("decisionComment"), str("convertedToType", 20), id("convertedToId"),
    ],
    indexes: [idx("churchStatus", "churchId", "status"), uniq("trackingToken", "trackingToken"), idx("departmentId", "departmentId")],
  },

  // ---------------- Module 3 : Remboursements ----------------
  {
    id: "reimbursements", name: "Remboursements", tablePermissions: "none",
    columns: [
      ...church, str("reference", 30, true), str("requesterName", 160, true), str("requesterEmail", 200), str("requesterPhone", 40),
      id("departmentId"), text("reason"), date("expenseDate"), int("amountCents", true), str("wishedMethod", 20),
      en("status", REIMB_STATUSES, "submitted"), str("trackingToken", 64, true), text("rejectReason"), date("paidAt"),
      str("paidMethod", 20), id("paidProofFileId"), { key: "payeeBankInfo", type: "text" }, id("expenseId"),
    ],
    indexes: [idx("churchStatus", "churchId", "status"), uniq("trackingToken", "trackingToken")],
  },

  // ---------------- Module 4 : Offrandes ----------------
  {
    id: "offering_sessions", name: "Séances d'offrandes", tablePermissions: "none",
    columns: [
      ...church, str("reference", 30, true), date("date", true), id("serviceId"), str("serviceName", 120), str("counter1Name", 120),
      str("counter2Name", 120), int("countedCashCents", false, 0), int("countedChequeCents", false, 0), int("enteredTotalCents", false, 0),
      int("gapCents", false, 0), en("status", SESSION_STATUSES, "draft"), date("lockedAt"), id("lockedBy"), text("notes"),
    ],
    indexes: [idx("churchDate", "churchId", "date"), idx("status", "status")],
  },
  {
    id: "offering_lines", name: "Lignes d'offrandes", tablePermissions: "none",
    columns: [
      ...church, id("sessionId", true), date("date", true), id("donationTypeId"), str("donationTypeName", 120), id("donorId"),
      str("donorName", 160), bool("anonymous", true), int("amountCents", true), en("method", PAYMENT_METHODS, "cash"), str("chequeRef", 60),
      id("depositId"), id("bankAccountId"),
    ],
    indexes: [idx("session", "sessionId"), idx("churchDate", "churchId", "date"), idx("donor", "donorId")],
  },
  {
    id: "donors", name: "Donateurs", tablePermissions: "none",
    columns: [...church, str("fullName", 160, true), str("email", 200), str("phone", 40), str("address", 400), date("consentAt"), date("anonymizedAt")],
    indexes: [idx("churchId", "churchId")],
  },

  // ---------------- Module 5 : Dépenses / projets / workflow ----------------
  {
    id: "expenses", name: "Dépenses", tablePermissions: "none",
    columns: [
      ...church, str("reference", 30, true), str("title", 200, true), id("categoryId"), str("categoryName", 120), str("supplier", 160),
      int("amountCents", true), date("date", true), en("paymentMethod", EXPENSE_PAY_METHODS, "bank_transfer"), id("bankAccountId"),
      id("departmentId"), id("projectId"), en("status", EXPENSE_STATUSES, "draft"), int("currentStep", false, 0), int("totalSteps", false, 0),
      id("workflowId"), { key: "stepRoles", type: "varchar", size: 20, array: true }, bool("isRegularization"), text("regularizationReason"),
      str("advancedBy", 160), date("paidAt"), date("stepStartedAt"), str("source", 20, false), id("sourceId"), text("notes"),
    ],
    indexes: [idx("churchStatus", "churchId", "status"), idx("churchDate", "churchId", "date"), idx("project", "projectId")],
  },
  {
    id: "projects", name: "Projets & événements", tablePermissions: "none",
    columns: [
      ...church, str("name", 160, true), text("description"), int("budgetCents", false, 0), date("startDate"), date("endDate"),
      str("ownerName", 160), en("status", PROJECT_STATUSES, "active"), text("milestonesJson"),
    ],
    indexes: [idx("churchId", "churchId")],
  },
  {
    // churchId = "region" pour une règle valable pour toutes les églises
    id: "approval_workflows", name: "Workflows de validation", tablePermissions: "users",
    columns: [
      ...church, str("name", 120, true), int("minCents", false, 0), int("maxCents"), { key: "categoryIds", type: "varchar", size: 36, array: true },
      { key: "stepRoles", type: "varchar", size: 20, array: true }, { key: "stepDelaysHours", type: "integer", array: true },
      int("priority", false, 0), bool("active", true),
    ],
    indexes: [idx("churchId", "churchId")],
  },
  {
    id: "approvals", name: "Décisions de validation", tablePermissions: "none",
    columns: [
      ...church, id("expenseId", true), int("stepOrder", true), str("role", 20, true), en("decision", ["approved", "rejected", "info_requested"]),
      id("userId"), str("userName", 160), text("comment"),
    ],
    indexes: [idx("expense", "expenseId")],
  },

  // ---------------- Module 6 : Dépôts ----------------
  {
    id: "deposits", name: "Dépôts bancaires", tablePermissions: "none",
    columns: [
      ...church, str("reference", 30, true), id("bankAccountId", true), date("date", true), str("depositorName", 160),
      int("cashCents", false, 0), int("chequeCents", false, 0), str("slipNumber", 60), id("slipFileId"),
      en("status", DEPOSIT_STATUSES, "prepared"), date("confirmedAt"), int("confirmedCents"), date("valueDate"), int("gapCents", false, 0),
      { key: "sessionIds", type: "varchar", size: 36, array: true },
    ],
    indexes: [idx("churchStatus", "churchId", "status"), idx("churchDate", "churchId", "date")],
  },

  // ---------------- Module 7 : Trésorerie ----------------
  {
    id: "cash_movements", name: "Grand livre (mouvements)", tablePermissions: "none",
    columns: [
      ...church, date("date", true), str("account", 60, true), en("direction", ["in", "out"]), int("amountCents", true),
      en("sourceType", ["offering_line", "deposit", "expense", "opening", "adjustment", "other_income"]), id("sourceId"), str("label", 200),
      str("category", 120),
    ],
    indexes: [idx("churchAccountDate", "churchId", "account", "date"), idx("source", "sourceType", "sourceId")],
  },
  {
    id: "budgets", name: "Budgets", tablePermissions: "none",
    columns: [...church, int("year", true), en("scope", ["category", "department"]), id("scopeId", true), str("scopeName", 120), int("plannedCents", true)],
    indexes: [idx("churchYear", "churchId", "year")],
  },
  {
    id: "bank_statement_lines", name: "Lignes de relevé", tablePermissions: "none",
    columns: [
      ...church, id("bankAccountId", true), id("importBatchId"), date("date", true), str("label", 300), int("amountCents", true),
      str("matchedType", 20), id("matchedId"),
    ],
    indexes: [idx("churchAccount", "churchId", "bankAccountId", "date")],
  },
  {
    id: "period_locks", name: "Clôtures mensuelles", tablePermissions: "none",
    columns: [...church, str("month", 7, true), str("lockedByName", 160)],
    indexes: [uniq("churchMonth", "churchId", "month")],
  },

  // ---------------- Transverses ----------------
  {
    id: "attachments", name: "Pièces jointes", tablePermissions: "none",
    columns: [
      ...church, str("entityType", 40, true), id("entityId", true), id("fileId", true), str("bucket", 36, true), str("name", 255),
      str("mime", 80), int("size"), str("uploadedBy", 160),
    ],
    indexes: [idx("entity", "entityType", "entityId")],
  },
  {
    id: "comments", name: "Commentaires", tablePermissions: "none",
    columns: [...church, str("entityType", 40, true), id("entityId", true), id("authorId"), str("authorName", 160), text("body"), bool("internal", true)],
    indexes: [idx("entity", "entityType", "entityId")],
  },
  {
    id: "status_history", name: "Historique des statuts", tablePermissions: "none",
    columns: [
      ...church, str("entityType", 40, true), id("entityId", true), str("fromStatus", 40), str("toStatus", 40, true), id("actorId"),
      str("actorName", 160), text("comment"),
    ],
    indexes: [idx("entity", "entityType", "entityId")],
  },
  {
    id: "notifications", name: "Notifications", tablePermissions: "none",
    columns: [...church, id("userId", true), str("kind", 40), str("title", 200, true), text("body"), str("link", 300), date("readAt")],
    indexes: [idx("user", "userId")],
  },
  {
    id: "audit_logs", name: "Journal d'audit", tablePermissions: "none",
    columns: [
      ...church, id("actorId"), str("actorName", 160), str("action", 40, true), str("entityType", 40, true), id("entityId"),
      { key: "beforeJson", type: "text" }, { key: "afterJson", type: "text" }, str("summary", 300),
    ],
    indexes: [idx("church", "churchId"), idx("entity", "entityType", "entityId")],
  },
  {
    id: "rate_limits", name: "Limitation de débit", tablePermissions: "none",
    columns: [str("key", 120, true), date("windowStart", true), int("count", false, 0)],
    indexes: [uniq("key", "key")],
  },
];

export const BUCKETS = [
  { id: "justificatifs", name: "Justificatifs", maxSize: 10 * 1024 * 1024, extensions: ["jpg", "jpeg", "png", "webp", "heic", "pdf"], public: false },
] as const;

/** Le forfait gratuit Appwrite limite à 1 bucket : bordereaux et justificatifs partagent le même. */
export const FILES_BUCKET = "justificatifs";

export const MOTHER_TEAM_ID = "eglise-mere";
export const REGION = "region";

export type TableId = (typeof TABLES)[number]["id"];
