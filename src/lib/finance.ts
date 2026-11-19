/**
 * Noyau comptable pur (sans I/O) — utilisé par les Server Actions, le seed et les tests unitaires.
 * Règles :
 *  - Caisse = entrées espèces/chèques − dépôts − dépenses payées en espèces
 *  - Banque (compte k) = ouverture + dépôts sur k + virements/cartes reçus sur k − dépenses payées sur k (± ajustements)
 *  - Résultat = produits (offrandes + autres recettes) − charges (dépenses payées)
 */
export const CASH_ACCOUNT = "cash";
export const bankKey = (id: string) => `bank:${id}`;

export type Movement = {
  date: string;
  account: string;
  direction: "in" | "out";
  amountCents: number;
  sourceType: "offering_line" | "deposit" | "expense" | "opening" | "adjustment" | "other_income";
  sourceId?: string | null;
  label?: string;
  category?: string | null;
};

export type LineLike = { $id?: string; date: string; amountCents: number; method: string; bankAccountId?: string | null; donationTypeName?: string | null };
export type DepositLike = { $id?: string; date: string; cashCents: number; chequeCents: number; bankAccountId: string; reference?: string };
export type ExpenseLike = { $id?: string; date: string; paidAt?: string | null; amountCents: number; paymentMethod: string; bankAccountId?: string | null; title?: string; categoryName?: string | null };

export const isCashLike = (method: string) => method === "cash" || method === "cheque";

export function movementsForOfferingLine(l: LineLike, defaultBankId?: string | null): Movement[] {
  if (l.amountCents <= 0) return [];
  if (isCashLike(l.method)) {
    return [{ date: l.date, account: CASH_ACCOUNT, direction: "in", amountCents: l.amountCents, sourceType: "offering_line", sourceId: l.$id, label: l.donationTypeName ?? "Offrande", category: l.donationTypeName ?? null }];
  }
  const bank = l.bankAccountId ?? defaultBankId;
  if (!bank) throw new Error("Aucun compte bancaire pour un don par virement/carte.");
  return [{ date: l.date, account: bankKey(bank), direction: "in", amountCents: l.amountCents, sourceType: "offering_line", sourceId: l.$id, label: l.donationTypeName ?? "Don", category: l.donationTypeName ?? null }];
}

export function movementsForDeposit(d: DepositLike): Movement[] {
  const total = d.cashCents + d.chequeCents;
  if (total <= 0) return [];
  return [
    { date: d.date, account: CASH_ACCOUNT, direction: "out", amountCents: total, sourceType: "deposit", sourceId: d.$id, label: `Dépôt ${d.reference ?? ""}`.trim() },
    { date: d.date, account: bankKey(d.bankAccountId), direction: "in", amountCents: total, sourceType: "deposit", sourceId: d.$id, label: `Dépôt ${d.reference ?? ""}`.trim() },
  ];
}

/** Écart constaté au relevé : confirmé − déposé (positif = plus reçu que prévu). */
export function depositAdjustment(d: DepositLike, confirmedCents: number): Movement | null {
  const gap = confirmedCents - (d.cashCents + d.chequeCents);
  if (gap === 0) return null;
  return { date: d.date, account: bankKey(d.bankAccountId), direction: gap > 0 ? "in" : "out", amountCents: Math.abs(gap), sourceType: "adjustment", sourceId: d.$id, label: `Écart sur dépôt ${d.reference ?? ""}`.trim() };
}

export function movementsForPaidExpense(e: ExpenseLike, defaultBankId?: string | null): Movement[] {
  const date = e.paidAt ?? e.date;
  if (e.paymentMethod === "cash") {
    return [{ date, account: CASH_ACCOUNT, direction: "out", amountCents: e.amountCents, sourceType: "expense", sourceId: e.$id, label: e.title ?? "Dépense", category: e.categoryName ?? null }];
  }
  const bank = e.bankAccountId ?? defaultBankId;
  if (!bank) throw new Error("Choisissez le compte bancaire utilisé pour payer.");
  return [{ date, account: bankKey(bank), direction: "out", amountCents: e.amountCents, sourceType: "expense", sourceId: e.$id, label: e.title ?? "Dépense", category: e.categoryName ?? null }];
}

export type Balances = { cash: number; banks: Record<string, number>; bankTotal: number; total: number };

export function computeBalances(movs: Pick<Movement, "account" | "direction" | "amountCents" | "date">[], accounts: { $id: string; openingBalanceCents?: number }[] = [], until?: Date): Balances {
  const banks: Record<string, number> = {};
  for (const a of accounts) banks[a.$id] = a.openingBalanceCents ?? 0;
  let cash = 0;
  for (const m of movs) {
    if (until && new Date(m.date) >= until) continue;
    const v = m.direction === "in" ? m.amountCents : -m.amountCents;
    if (m.account === CASH_ACCOUNT) cash += v;
    else if (m.account.startsWith("bank:")) {
      const id = m.account.slice(5);
      banks[id] = (banks[id] ?? 0) + v;
    }
  }
  const bankTotal = Object.values(banks).reduce((a, b) => a + b, 0);
  return { cash, banks, bankTotal, total: cash + bankTotal };
}

export type IncomeStatement = {
  products: { label: string; cents: number }[];
  charges: { label: string; cents: number }[];
  totalProducts: number;
  totalCharges: number;
  result: number;
};

export function incomeStatement(
  lines: { amountCents: number; donationTypeName?: string | null; date: string }[],
  expenses: { amountCents: number; categoryName?: string | null; status: string; date: string; paidAt?: string | null }[],
  from: Date,
  to: Date,
  otherIncome: { amountCents: number; label?: string | null; date: string }[] = [],
): IncomeStatement {
  const inRange = (d: string) => { const x = new Date(d); return x >= from && x < to; };
  const p = new Map<string, number>();
  for (const l of lines) if (inRange(l.date)) p.set(l.donationTypeName || "Autres dons", (p.get(l.donationTypeName || "Autres dons") ?? 0) + l.amountCents);
  for (const o of otherIncome) if (inRange(o.date)) p.set(o.label || "Autres recettes", (p.get(o.label || "Autres recettes") ?? 0) + o.amountCents);
  const c = new Map<string, number>();
  for (const e of expenses) {
    if (e.status !== "paid") continue;
    if (!inRange(e.date)) continue;
    const k = e.categoryName || "Non classé";
    c.set(k, (c.get(k) ?? 0) + e.amountCents);
  }
  const sort = (m: Map<string, number>) => [...m.entries()].map(([label, cents]) => ({ label, cents })).sort((a, b) => b.cents - a.cents);
  const products = sort(p);
  const charges = sort(c);
  const totalProducts = products.reduce((a, b) => a + b.cents, 0);
  const totalCharges = charges.reduce((a, b) => a + b.cents, 0);
  return { products, charges, totalProducts, totalCharges, result: totalProducts - totalCharges };
}

/** Totaux d'une séance d'offrandes et écart de comptage. */
export function sessionTotals(lines: { amountCents: number; method: string }[], countedCashCents: number, countedChequeCents: number) {
  let cash = 0, cheque = 0, other = 0;
  for (const l of lines) {
    if (l.method === "cash") cash += l.amountCents;
    else if (l.method === "cheque") cheque += l.amountCents;
    else other += l.amountCents;
  }
  const entered = cash + cheque + other;
  const gap = countedCashCents + countedChequeCents - (cash + cheque);
  return { cash, cheque, other, entered, gap };
}

export function monthlyFlows(movs: Pick<Movement, "date" | "direction" | "amountCents" | "sourceType">[], months: string[]) {
  const map = new Map(months.map((m) => [m, { month: m, in: 0, out: 0 }]));
  for (const m of movs) {
    // Les dépôts sont des transferts internes caisse → banque : ni entrée ni sortie.
    if (m.sourceType === "deposit" || m.sourceType === "opening") continue;
    const d = new Date(m.date);
    const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const row = map.get(k);
    if (!row) continue;
    if (m.direction === "in") row.in += m.amountCents;
    else row.out += m.amountCents;
  }
  return [...map.values()];
}
