/** Lecture brute des fichiers Excel / CSV (partagée par l'import et les tests). */
import ExcelJS from "exceljs";

export type Cell = string | number | null;
export type ParsedSheet = { name: string; headerRow: number; headers: string[]; rows: Cell[][]; total: number };

const MAX_ROWS = 5000;
const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

function cellValue(v: ExcelJS.CellValue): Cell {
  if (v == null) return null;
  if (v instanceof Date) return isoDay(v);
  if (typeof v === "number" || typeof v === "string") return typeof v === "string" ? v.trim() || null : v;
  if (typeof v === "boolean") return v ? "oui" : "non";
  if (typeof v === "object") {
    if ("result" in v) return cellValue((v as { result: ExcelJS.CellValue }).result);
    if ("richText" in v) return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("").trim() || null;
    if ("text" in v) return String((v as { text: string }).text).trim() || null;
  }
  return String(v);
}

/** Trouve la ligne d'en-tête : la première (parmi les 15 premières) qui contient au moins 2 textes. */
function headerIndex(rows: Cell[][]) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const texts = rows[i]!.filter((c) => typeof c === "string" && !/^\d+([.,]\d+)?$/.test(c));
    if (texts.length >= 2) return i;
  }
  return 0;
}

export function toSheet(name: string, raw: Cell[][]): ParsedSheet | null {
  const rows = raw.filter((r) => r.some((c) => c !== null && c !== ""));
  if (rows.length < 2) return null;
  const h = headerIndex(rows);
  const width = Math.max(...rows.slice(h, h + 200).map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => String(rows[h]![i] ?? "").trim() || `Colonne ${i + 1}`);
  const body = rows.slice(h + 1).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? null));
  return { name, headerRow: h + 1, headers, rows: body.slice(0, MAX_ROWS), total: body.length };
}

export function parseCsv(text: string): Cell[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ";" : (first.includes("\t") ? "\t" : ",");
  const out: Cell[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); out.push(row.map((c) => c.trim() || null)); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); out.push(row.map((c) => c.trim() || null)); }
  return out;
}


export async function readXlsx(buf: Buffer): Promise<ParsedSheet[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const sheets: ParsedSheet[] = [];
  wb.eachSheet((ws) => {
    const raw: Cell[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => { raw.push((row.values as ExcelJS.CellValue[]).slice(1).map(cellValue)); });
    const s = toSheet(ws.name, raw);
    if (s) sheets.push(s);
  });
  return sheets;
}
