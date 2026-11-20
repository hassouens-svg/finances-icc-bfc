import type {
  CR_STATUSES, FUNDING_STATUSES, REIMB_STATUSES, EXPENSE_STATUSES, DEPOSIT_STATUSES, SESSION_STATUSES,
  PAYMENT_METHODS, EXPENSE_PAY_METHODS, PRIORITIES, PROJECT_STATUSES, APPROVER_ROLES,
} from "./schema";

export type Row = {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  $permissions?: string[];
};
type ChurchScoped = Row & { churchId: string; createdBy?: string | null; archived?: boolean };

export type Priority = (typeof PRIORITIES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type ExpensePayMethod = (typeof EXPENSE_PAY_METHODS)[number];
export type ApproverRole = (typeof APPROVER_ROLES)[number];
export type ChurchRole = "treasurer" | "pastor" | "reader";

export type City = Row & { name: string; region?: string | null; archived?: boolean };
export type Church = Row & {
  name: string; slug: string; cityId?: string | null; address?: string | null; isMother: boolean; parentChurchId?: string | null;
  pastorName?: string | null; logoFileId?: string | null; teamId: string; refPrefix: string; active: boolean; allowLocalLists: boolean;
};
export type Department = ChurchScoped & { name: string; leaderName?: string | null; leaderEmail?: string | null; annualBudgetCents?: number | null };
export type ListKind = "expense_category" | "donation_type" | "cr_request_type" | "service";
export type ListItem = ChurchScoped & { kind: ListKind; name: string; code?: string | null; sortOrder: number; isTithe: boolean };
export type BankAccount = ChurchScoped & { label: string; bankName?: string | null; ibanMasked?: string | null; openingBalanceCents: number; openingDate?: string | null };
export type PublicLink = ChurchScoped & {
  kind: "funding" | "reimbursement"; departmentId?: string | null; token: string; label?: string | null; active: boolean;
  expiresAt?: string | null; submissionsCount: number;
};

export type CrStatus = (typeof CR_STATUSES)[number];
export type CrRequest = ChurchScoped & {
  reference: string; title: string; typeId?: string | null; reason?: string | null; description?: string | null; quantity?: number | null;
  estimatedCents?: number | null; priority: Priority; wishedDate?: string | null; departmentId?: string | null; contactName?: string | null;
  sendChannel?: string | null; crReference?: string | null; status: CrStatus; viaMother: boolean; receivedCents?: number | null;
  receivedQuantity?: number | null; receivedAt?: string | null; receiptFileId?: string | null; statusChangedAt?: string | null;
  sourceFundingId?: string | null;
};

export type FundingStatus = (typeof FUNDING_STATUSES)[number];
export type FundingRequest = ChurchScoped & {
  reference: string; publicLinkId?: string | null; requesterName: string; requesterEmail?: string | null; requesterPhone?: string | null;
  departmentId?: string | null; title: string; description?: string | null; estimatedCents: number; approvedCents?: number | null;
  wishedDate?: string | null; priority: Priority; status: FundingStatus; trackingToken: string; decisionComment?: string | null;
  convertedToType?: string | null; convertedToId?: string | null;
};

export type ReimbStatus = (typeof REIMB_STATUSES)[number];
export type Reimbursement = ChurchScoped & {
  reference: string; requesterName: string; requesterEmail?: string | null; requesterPhone?: string | null; departmentId?: string | null;
  reason?: string | null; expenseDate?: string | null; amountCents: number; wishedMethod?: string | null; status: ReimbStatus;
  trackingToken: string; rejectReason?: string | null; paidAt?: string | null; paidMethod?: string | null; paidProofFileId?: string | null;
  payeeBankInfo?: string | null; expenseId?: string | null;
};

export type SessionStatus = (typeof SESSION_STATUSES)[number];
export type OfferingSession = ChurchScoped & {
  reference: string; date: string; serviceId?: string | null; serviceName?: string | null; counter1Name?: string | null; counter2Name?: string | null;
  countedCashCents: number; countedChequeCents: number; enteredTotalCents: number; gapCents: number; status: SessionStatus;
  lockedAt?: string | null; lockedBy?: string | null; notes?: string | null; importBatchId?: string | null;
};
export type OfferingLine = ChurchScoped & {
  sessionId: string; date: string; donationTypeId?: string | null; donationTypeName?: string | null; donorId?: string | null; donorName?: string | null;
  anonymous: boolean; amountCents: number; method: PaymentMethod; chequeRef?: string | null; depositId?: string | null; bankAccountId?: string | null;
};
export type Donor = ChurchScoped & { fullName: string; email?: string | null; phone?: string | null; address?: string | null; consentAt?: string | null; anonymizedAt?: string | null };

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];
export type Expense = ChurchScoped & {
  reference: string; title: string; categoryId?: string | null; categoryName?: string | null; supplier?: string | null; amountCents: number;
  date: string; paymentMethod: ExpensePayMethod; bankAccountId?: string | null; departmentId?: string | null; projectId?: string | null;
  status: ExpenseStatus; currentStep: number; totalSteps: number; workflowId?: string | null; stepRoles: string[]; isRegularization: boolean;
  regularizationReason?: string | null; advancedBy?: string | null; paidAt?: string | null; stepStartedAt?: string | null;
  source?: string | null; sourceId?: string | null; notes?: string | null; importBatchId?: string | null;
};
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type Project = ChurchScoped & {
  name: string; description?: string | null; budgetCents: number; startDate?: string | null; endDate?: string | null; ownerName?: string | null;
  status: ProjectStatus; milestonesJson?: string | null;
};
export type ApprovalWorkflow = ChurchScoped & {
  name: string; minCents: number; maxCents?: number | null; categoryIds: string[]; stepRoles: string[]; stepDelaysHours: number[];
  priority: number; active: boolean;
};
export type Approval = ChurchScoped & {
  expenseId: string; stepOrder: number; role: string; decision: "approved" | "rejected" | "info_requested"; userId?: string | null;
  userName?: string | null; comment?: string | null;
};

export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];
export type Deposit = ChurchScoped & {
  reference: string; bankAccountId: string; date: string; depositorName?: string | null; cashCents: number; chequeCents: number;
  slipNumber?: string | null; slipFileId?: string | null; status: DepositStatus; confirmedAt?: string | null; confirmedCents?: number | null;
  valueDate?: string | null; gapCents: number; sessionIds: string[];
};

export type CashMovement = ChurchScoped & {
  date: string; account: string; direction: "in" | "out"; amountCents: number;
  sourceType: "offering_line" | "deposit" | "expense" | "opening" | "adjustment" | "other_income";
  sourceId?: string | null; label?: string | null; category?: string | null;
};
export type Budget = ChurchScoped & { year: number; scope: "category" | "department"; scopeId: string; scopeName?: string | null; plannedCents: number };
export type BankStatementLine = ChurchScoped & {
  bankAccountId: string; importBatchId?: string | null; date: string; label?: string | null; amountCents: number;
  matchedType?: string | null; matchedId?: string | null;
};
export type PeriodLock = ChurchScoped & { month: string; lockedByName?: string | null };
export type Attachment = ChurchScoped & { entityType: string; entityId: string; fileId: string; bucket: string; name?: string | null; mime?: string | null; size?: number | null; uploadedBy?: string | null };
export type Comment = ChurchScoped & { entityType: string; entityId: string; authorId?: string | null; authorName?: string | null; body?: string | null; internal: boolean };
export type StatusHistory = ChurchScoped & { entityType: string; entityId: string; fromStatus?: string | null; toStatus: string; actorId?: string | null; actorName?: string | null; comment?: string | null };
export type AppNotification = ChurchScoped & { userId: string; kind?: string | null; title: string; body?: string | null; link?: string | null; readAt?: string | null };
export type AuditLog = ChurchScoped & {
  actorId?: string | null; actorName?: string | null; action: string; entityType: string; entityId?: string | null;
  beforeJson?: string | null; afterJson?: string | null; summary?: string | null;
};
export type UserProfile = Row & { userId: string; displayName?: string | null; phone?: string | null; notifPrefsJson?: string | null; disabled: boolean };

export type EntityType = "cr_request" | "funding_request" | "reimbursement" | "offering_session" | "expense" | "deposit" | "project" | "donor";

export type RecurringCharge = ChurchScoped & {
  name: string; categoryId?: string | null; categoryName?: string | null; amountCents: number; frequency: "monthly" | "quarterly" | "yearly";
  dueDay: number; sortOrder: number; active: boolean; paymentMethod: ExpensePayMethod; supplier?: string | null;
};
