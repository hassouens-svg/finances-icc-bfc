/**
 * Lecture « intelligente » des fichiers Excel existants : reconnaissance des colonnes, des dates,
 * des montants, des types de dons et des moyens de paiement. Logique pure (testée unitairement).
 */
import { parseEuroToCents } from "./format";

export type Cell = string | number | null;
export const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9€ ]/g, " ").replace(/\s+/g, " ").trim();

const has = (h: string, words: string[]) => words.some((w) => h === w || h.includes(w));

// ---------------- Dates ----------------
const MONTHS: Record<string, number> = { janvier: 1, janv: 1, fevrier: 2, fevr: 2, fev: 2, mars: 3, avril: 4, avr: 4, mai: 5, juin: 6, juillet: 7, juil: 7, aout: 8, septembre: 9, sept: 9, octobre: 10, oct: 10, novembre: 11, nov: 11, decembre: 12, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");
const valid = (y: number, m: number, d: number) => y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;

/** Date d'une cellule : ISO, jj/mm/aaaa, jj-mm-aa, « 12 janvier 2025 », ou numéro de série Excel. */
export function parseDateCell(v: Cell): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) { // numéro de série Excel
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
    return null;
  }
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { const [y, mo, d] = [+m[1]!, +m[2]!, +m[3]!]; return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null; }
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (m) { let y = +m[3]!; if (y < 100) y += 2000; const [d, mo] = [+m[1]!, +m[2]!]; return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null; }
  const n = norm(s);
  m = n.match(/(\d{1,2}) ([a-z]+) (\d{4})/);
  if (m && MONTHS[m[2]!]) { const [d, mo, y] = [+m[1]!, MONTHS[m[2]!]!, +m[3]!]; return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null; }
  return null;
}

/** Montant en centimes : nombre Excel, « 1 250,50 € », « 1250.5 », « -45 ». */
export function parseAmountCell(v: Cell): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) : null;
  let s = v.replace(/[€\s  ]/g, "").replace(/eur$/i, "");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, ""); // 1.250,50
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, ""); // 1,250.50
  const c = parseEuroToCents(s.replace(/(\.\d{2})\d+$/, "$1").replace(/(,\d{2})\d+$/, "$1"));
  return Number.isNaN(c) ? null : c;
}

// ---------------- Moyens de paiement et types ----------------
export function matchMethod(v: Cell): string | null {
  const n = norm(v);
  if (!n) return null;
  if (has(n, ["espece", "cash", "liquide", "billet", "esp"])) return "cash";
  if (has(n, ["cheque", "chq", "chèque"])) return "cheque";
  if (has(n, ["virement", "vir", "transfer", "prelevement", "sepa"])) return "transfer";
  if (has(n, ["carte", "cb", "tpe", "card", "sumup"])) return "card";
  if (has(n, ["mobile", "lydia", "paypal", "wave", "orange money", "momo", "helloasso", "en ligne"])) return "mobile";
  return null;
}

/** Associe un libellé (« Dîmes », « offr. spéciale »…) à un type de don existant. */
export function matchDonationType(v: Cell, types: { id: string; name: string }[]): string | null {
  const n = norm(v);
  if (!n) return null;
  const exact = types.find((t) => norm(t.name) === n || norm(t.name) + "s" === n);
  if (exact) return exact.id;
  const by = (re: RegExp) => types.find((t) => re.test(norm(t.name)))?.id ?? null;
  if (/dime|disme|tithe/.test(n)) return by(/dime/);
  if (/action de grace|actions de grace|adg|reconnaissance/.test(n)) return by(/grace/);
  if (/special|exception|semence|premice/.test(n)) return by(/special/);
  if (/projet|construction|batiment|travaux/.test(n)) return by(/projet/);
  if (/offrande|quete|collecte|offering/.test(n)) return by(/offrande simple/) ?? by(/offrande/);
  if (/don\b|dons\b|gift/.test(n)) return by(/projet/) ?? by(/autre/);
  return types.find((t) => n.includes(norm(t.name)) || norm(t.name).includes(n))?.id ?? null;
}

export function matchByName(v: Cell, list: { id: string; name: string }[]): string | null {
  const n = norm(v);
  if (!n) return null;
  return list.find((x) => norm(x.name) === n)?.id ?? list.find((x) => n.includes(norm(x.name)) || norm(x.name).includes(n))?.id ?? null;
}

// ---------------- Colonnes ----------------
export type OfferingMapping = {
  date: number | null;
  donor: number | null;
  type: number | null;
  method: number | null;
  cheque: number | null;
  service: number | null;
  /** colonnes de montants : typeId null = type lu dans la colonne « type » (ou type par défaut) */
  amounts: { col: number; typeId: string | null }[];
};
export type ExpenseMapping = { date: number | null; title: number | null; amount: number | null; debit: number | null; category: number | null; supplier: number | null; method: number | null; department: number | null; notes: number | null };

function numericShare(rows: Cell[][], col: number) {
  const sample = rows.slice(0, 50).map((r) => r[col]).filter((c) => c != null && c !== "");
  if (!sample.length) return 0;
  return sample.filter((c) => parseAmountCell(c) != null).length / sample.length;
}
function dateShare(rows: Cell[][], col: number) {
  const sample = rows.slice(0, 50).map((r) => r[col]).filter((c) => c != null && c !== "");
  if (!sample.length) return 0;
  return sample.filter((c) => parseDateCell(c) != null).length / sample.length;
}

/** Détecte les colonnes d'un fichier d'offrandes, au format « une ligne par don » ou « une colonne par type ». */
export function detectOfferings(headers: string[], rows: Cell[][], types: { id: string; name: string }[]): OfferingMapping {
  const H = headers.map(norm);
  const find = (words: string[], exclude: number[] = []) => {
    const i = H.findIndex((h, idx) => !exclude.includes(idx) && has(h, words));
    return i >= 0 ? i : null;
  };
  let date = find(["date", "jour", "dimanche"]);
  if (date == null) { const i = H.findIndex((_, idx) => dateShare(rows, idx) > 0.7); date = i >= 0 ? i : null; }
  const donor = find(["donateur", "nom", "membre", "fidele", "personne", "prenom", "name", "famille"]);
  const method = find(["moyen", "mode", "paiement", "reglement"]);
  const cheque = find(["n cheque", "numero cheque", "no cheque", "num cheque", "n° cheque"]);
  const service = find(["culte", "service", "evenement", "reunion"]);
  // Format large : une colonne par type de don (Dîmes, Offrandes, …)
  const wide = H.map((h, i) => ({ i, typeId: [date, donor, method, cheque, service].includes(i) ? null : matchDonationType(headers[i]!, types) }))
    .filter((x) => x.typeId && numericShare(rows, x.i) > 0.5 && !has(H[x.i]!, ["total"]));
  if (wide.length >= 1 && !H.some((h, i) => has(h, ["montant", "somme"]) && !wide.some((w) => w.i === i))) {
    return { date, donor, type: null, method, cheque, service, amounts: wide.map((w) => ({ col: w.i, typeId: w.typeId })) };
  }
  const type = find(["type", "nature", "categorie", "motif", "objet"], [date ?? -1, donor ?? -1]);
  let amount = find(["montant", "somme", "valeur", "amount", "€", "euros"], [date ?? -1]);
  if (amount == null) { const i = H.findIndex((_, idx) => idx !== date && numericShare(rows, idx) > 0.8); amount = i >= 0 ? i : null; }
  return { date, donor, type, method, cheque, service, amounts: amount == null ? [] : [{ col: amount, typeId: null }] };
}

export function detectExpenses(headers: string[], rows: Cell[][]): ExpenseMapping {
  const H = headers.map(norm);
  const used: number[] = [];
  const find = (words: string[]) => {
    const i = H.findIndex((h, idx) => !used.includes(idx) && has(h, words));
    if (i >= 0) used.push(i);
    return i >= 0 ? i : null;
  };
  let date = find(["date", "jour"]);
  if (date == null) { const i = H.findIndex((_, idx) => dateShare(rows, idx) > 0.7); date = i >= 0 ? i : null; if (date != null) used.push(date); }
  const debit = find(["debit", "depense", "sortie"]);
  let amount = find(["montant", "somme", "total", "valeur", "amount", "€", "euros", "prix", "cout"]);
  if (amount == null && debit == null) { const i = H.findIndex((_, idx) => !used.includes(idx) && numericShare(rows, idx) > 0.8); amount = i >= 0 ? i : null; if (amount != null) used.push(amount); }
  const category = find(["categorie", "poste", "compte", "rubrique", "nature", "type"]);
  const supplier = find(["fournisseur", "beneficiaire", "tiers", "magasin", "payee", "a qui"]);
  const method = find(["moyen", "mode", "paiement", "reglement"]);
  const department = find(["departement", "ministere", "service"]);
  const title = find(["libelle", "objet", "description", "designation", "intitule", "detail", "motif", "achat"]);
  const notes = find(["note", "commentaire", "remarque", "observation"]);
  return { date, title, amount, debit, category, supplier, method, department, notes };
}

// ---------------- Construction des lignes ----------------
export type OfferingImportRow = { date: string; donorName: string | null; typeId: string; method: string; amountCents: number; chequeRef: string | null; serviceName: string | null };
export type ExpenseImportRow = { date: string; title: string; amountCents: number; categoryName: string | null; supplier: string | null; method: string; departmentName: string | null; notes: string | null };
export type RowError = { row: number; message: string };

const text = (v: Cell) => (v == null ? null : String(v).trim() || null);

export function buildOfferingRows(rows: Cell[][], m: OfferingMapping, opts: { defaultTypeId: string; defaultMethod: string; types: { id: string; name: string }[]; headerRow: number }) {
  const out: OfferingImportRow[] = [];
  const errors: RowError[] = [];
  let lastDate: string | null = null;
  rows.forEach((r, i) => {
    const line = opts.headerRow + 1 + i;
    const rawDate = m.date != null ? r[m.date] ?? null : null;
    const date = parseDateCell(rawDate) ?? (rawDate == null ? lastDate : null); // cellules de date fusionnées
    const amounts = m.amounts.map((a) => ({ a, cents: parseAmountCell(r[a.col] ?? null) })).filter((x) => x.cents != null && x.cents !== 0);
    const donor = m.donor != null ? text(r[m.donor] ?? null) : null;
    if (!amounts.length) return; // ligne vide, sous-total ou commentaire
    if (donor && /^(total|sous total|totaux)/i.test(norm(donor))) return;
    if (m.date != null && rawDate != null && !parseDateCell(rawDate) && /total/i.test(String(rawDate))) return;
    if (!date) { errors.push({ row: line, message: "Date illisible" }); return; }
    lastDate = date;
    for (const { a, cents } of amounts) {
      if (cents! < 0) { errors.push({ row: line, message: "Montant négatif ignoré" }); continue; }
      const typeId = a.typeId ?? (m.type != null ? matchDonationType(r[m.type] ?? null, opts.types) : null) ?? opts.defaultTypeId;
      const method = (m.method != null ? matchMethod(r[m.method] ?? null) : null) ?? opts.defaultMethod;
      out.push({ date, donorName: donor && !/^(anonyme|anon|x|-)$/i.test(donor) ? donor : null, typeId, method, amountCents: cents!, chequeRef: m.cheque != null ? text(r[m.cheque] ?? null) : null, serviceName: m.service != null ? text(r[m.service] ?? null) : null });
    }
  });
  return { rows: out, errors };
}

export function buildExpenseRows(rows: Cell[][], m: ExpenseMapping, opts: { defaultMethod: string; headerRow: number }) {
  const out: ExpenseImportRow[] = [];
  const errors: RowError[] = [];
  rows.forEach((r, i) => {
    const line = opts.headerRow + 1 + i;
    let cents = m.amount != null ? parseAmountCell(r[m.amount] ?? null) : null;
    if ((cents == null || cents === 0) && m.debit != null) cents = parseAmountCell(r[m.debit] ?? null);
    const title = (m.title != null ? text(r[m.title] ?? null) : null) ?? (m.category != null ? text(r[m.category] ?? null) : null) ?? (m.supplier != null ? text(r[m.supplier] ?? null) : null);
    if (cents == null || cents === 0) return;
    if (title && /^(total|sous total|solde)/i.test(norm(title))) return;
    const date = m.date != null ? parseDateCell(r[m.date] ?? null) : null;
    if (!date) { errors.push({ row: line, message: "Date illisible" }); return; }
    out.push({
      date, title: title ?? "Dépense importée", amountCents: Math.abs(cents),
      categoryName: m.category != null ? text(r[m.category] ?? null) : null, supplier: m.supplier != null ? text(r[m.supplier] ?? null) : null,
      method: (m.method != null ? matchMethod(r[m.method] ?? null) : null)?.replace("transfer", "bank_transfer").replace("mobile", "bank_transfer") ?? opts.defaultMethod,
      departmentName: m.department != null ? text(r[m.department] ?? null) : null, notes: m.notes != null ? text(r[m.notes] ?? null) : null,
    });
  });
  return { rows: out, errors };
}
