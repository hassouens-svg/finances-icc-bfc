export type PeriodKey = "month" | "last_month" | "quarter" | "year" | "last_year" | "custom" | "all";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  month: "Ce mois",
  last_month: "Mois dernier",
  quarter: "Ce trimestre",
  year: "Cette année",
  last_year: "Année dernière",
  custom: "Personnalisé",
  all: "Tout",
};

export type Period = { key: PeriodKey; from: Date; to: Date; label: string };

/** Bornes [from, to[ en UTC (dates métier stockées à midi UTC). */
export function resolvePeriod(key: string | undefined, from?: string, to?: string, now = new Date()): Period {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const k = (key as PeriodKey) || "month";
  const U = (yy: number, mm: number, dd = 1) => new Date(Date.UTC(yy, mm, dd));
  switch (k) {
    case "last_month":
      return { key: k, from: U(y, m - 1), to: U(y, m), label: PERIOD_LABELS[k] };
    case "quarter": {
      const q = Math.floor(m / 3) * 3;
      return { key: k, from: U(y, q), to: U(y, q + 3), label: PERIOD_LABELS[k] };
    }
    case "year":
      return { key: k, from: U(y, 0), to: U(y + 1, 0), label: PERIOD_LABELS[k] };
    case "last_year":
      return { key: k, from: U(y - 1, 0), to: U(y, 0), label: PERIOD_LABELS[k] };
    case "all":
      return { key: k, from: U(2000, 0), to: U(y + 5, 0), label: PERIOD_LABELS[k] };
    case "custom": {
      if (from && to) {
        const f = new Date(`${from}T00:00:00Z`);
        const t = new Date(`${to}T00:00:00Z`);
        t.setUTCDate(t.getUTCDate() + 1);
        if (!isNaN(+f) && !isNaN(+t)) return { key: k, from: f, to: t, label: `${from} → ${to}` };
      }
      return { key: "month", from: U(y, m), to: U(y, m + 1), label: PERIOD_LABELS.month };
    }
    default:
      return { key: "month", from: U(y, m), to: U(y, m + 1), label: PERIOD_LABELS.month };
  }
}

/** Période précédente de même durée (pour comparaison N-1 / vs période précédente). */
export function previousPeriod(p: Period): Period {
  if (p.key === "year" || p.key === "last_year") {
    const f = new Date(p.from); f.setUTCFullYear(f.getUTCFullYear() - 1);
    const t = new Date(p.to); t.setUTCFullYear(t.getUTCFullYear() - 1);
    return { ...p, from: f, to: t, label: "Année précédente" };
  }
  const months = (p.to.getUTCFullYear() - p.from.getUTCFullYear()) * 12 + p.to.getUTCMonth() - p.from.getUTCMonth();
  if (months > 0 && p.from.getUTCDate() === 1 && p.to.getUTCDate() === 1) {
    const f = new Date(p.from); f.setUTCMonth(f.getUTCMonth() - months);
    return { ...p, from: f, to: new Date(p.from), label: "Période précédente" };
  }
  const len = p.to.getTime() - p.from.getTime();
  return { ...p, from: new Date(p.from.getTime() - len), to: new Date(p.from), label: "Période précédente" };
}

export function monthKey(d: string | Date) {
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function last12Months(now = new Date()) {
  const out: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(monthKey(d));
  }
  return out;
}
