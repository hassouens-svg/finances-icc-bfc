/** Couverture des charges fixes par les entrées (logique pure, testée). */
export type ChargeLike = { $id?: string; name: string; amountCents: number; frequency: "monthly" | "quarterly" | "yearly"; sortOrder?: number; active?: boolean };

/** Montant mensuel équivalent (une charge trimestrielle de 300 € = 100 €/mois à mettre de côté). */
export function monthlyAmount(c: Pick<ChargeLike, "amountCents" | "frequency">) {
  return c.frequency === "quarterly" ? Math.round(c.amountCents / 3) : c.frequency === "yearly" ? Math.round(c.amountCents / 12) : c.amountCents;
}

export type ChargeCoverage = {
  total: number;
  covered: number;
  missing: number;
  ratio: number;
  status: "ok" | "tight" | "short";
  items: { name: string; monthly: number; coveredCents: number; state: "covered" | "partial" | "uncovered" }[];
};

/**
 * Répartit les entrées sur les charges dans l'ordre de priorité.
 * « ok » : tout est couvert avec au moins 10 % de marge ; « tight » : couvert mais juste ; « short » : il manque de l'argent.
 */
export function coverCharges(charges: ChargeLike[], incomeCents: number): ChargeCoverage {
  const list = charges.filter((c) => c.active !== false).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  let left = Math.max(0, incomeCents);
  const items = list.map((c) => {
    const monthly = monthlyAmount(c);
    const coveredCents = Math.min(left, monthly);
    left -= coveredCents;
    return { name: c.name, monthly, coveredCents, state: coveredCents >= monthly ? ("covered" as const) : coveredCents > 0 ? ("partial" as const) : ("uncovered" as const) };
  });
  const total = items.reduce((a, i) => a + i.monthly, 0);
  const covered = items.reduce((a, i) => a + i.coveredCents, 0);
  const missing = total - covered;
  const ratio = total ? incomeCents / total : 1;
  const status = missing > 0 ? "short" : ratio < 1.1 ? "tight" : "ok";
  return { total, covered, missing, ratio, status, items };
}

/** Nombre de mois de charges fixes couverts par la trésorerie disponible. */
export function runwayMonths(availableCents: number, monthlyChargesCents: number) {
  if (monthlyChargesCents <= 0) return Infinity;
  return Math.max(0, availableCents) / monthlyChargesCents;
}
