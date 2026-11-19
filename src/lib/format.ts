const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const euroShort = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" });
const monthShortFmt = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "Europe/Paris" });

/** 125000 → "1 250,00 €" (espaces insécables normalisés en espaces fines) */
export function formatEuro(cents: number | null | undefined, opts?: { short?: boolean; sign?: boolean }) {
  const v = (cents ?? 0) / 100;
  const s = (opts?.short ? euroShort : euro).format(v).replace(/ | /g, " ");
  return opts?.sign && v > 0 ? `+${s}` : s;
}

/** "1250,5" | "1 250.50" → 125050 ; renvoie NaN si invalide */
export function parseEuroToCents(input: string | number | null | undefined): number {
  if (typeof input === "number") return Math.round(input * 100);
  if (!input) return NaN;
  const cleaned = String(input).replace(/[\s  €]/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{0,2})?$/.test(cleaned)) return NaN;
  const [int, dec = ""] = cleaned.replace("-", "").split(".");
  const cents = Number(int) * 100 + Number((dec + "00").slice(0, 2));
  return cleaned.startsWith("-") ? -cents : cents;
}

export function centsToInput(cents: number | null | undefined) {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** "19 nov. 2026" */
export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return dateFmt.format(new Date(d));
}
export function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  return dateTimeFmt.format(new Date(d)).replace(",", " à");
}
export function formatMonth(d: string | Date) {
  const s = monthFmt.format(new Date(d));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function formatMonthShort(d: string | Date) {
  return monthShortFmt.format(new Date(d)).replace(".", "");
}
export function toDateInput(d: string | Date | null | undefined) {
  if (!d) return "";
  const x = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}
/** "2026-11-19" → ISO midi UTC (évite les décalages de fuseau) */
export function dateInputToIso(s: string) {
  return new Date(`${s}T12:00:00.000Z`).toISOString();
}
export function relativeDays(d: string | Date) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} j`;
}
export function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}
