import "server-only";
import ExcelJS from "exceljs";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Report } from "./reports";
import { formatEuro, formatDate } from "@/lib/format";

const fmt = (v: unknown, type?: string) => (v == null || v === "" ? "" : type === "money" ? formatEuro(Number(v)) : type === "date" ? formatDate(String(v)) : String(v));

function addSheet(wb: ExcelJS.Workbook, r: Report, churchLabel: string) {
  const ws = wb.addWorksheet(r.title.slice(0, 31), { views: [{ state: "frozen", ySplit: 4 }] });
  ws.mergeCells(1, 1, 1, Math.max(2, r.columns.length));
  ws.getCell(1, 1).value = r.title;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF4C1D95" } };
  ws.getCell(2, 1).value = r.subtitle || churchLabel;
  ws.getCell(2, 1).font = { color: { argb: "FF6B6B76" } };
  const header = ws.getRow(4);
  r.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6D28D9" } };
    cell.alignment = { vertical: "middle", horizontal: c.type === "money" ? "right" : "left" };
    ws.getColumn(i + 1).width = c.width ?? (c.type === "money" ? 15 : c.type === "date" ? 13 : 18);
  });
  header.height = 22;
  r.rows.forEach((row, ri) => {
    const xr = ws.getRow(5 + ri);
    r.columns.forEach((c, i) => {
      const cell = xr.getCell(i + 1);
      const v = row[c.key];
      if (c.type === "money") { cell.value = v == null ? null : Number(v) / 100; cell.numFmt = '#,##0.00 "€";[Red]-#,##0.00 "€"'; }
      else if (c.type === "date") { cell.value = v ? new Date(String(v)) : null; cell.numFmt = "dd/mm/yyyy"; }
      else cell.value = v == null ? "" : String(v);
      if (String(row.label ?? "").startsWith("TOTAL") || row.label === "RÉSULTAT") cell.font = { bold: true };
    });
    if (ri % 2) xr.eachCell((cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } }));
  });
  if (r.totals) {
    const tr = ws.getRow(5 + r.rows.length);
    tr.getCell(1).value = "Total";
    r.columns.forEach((c, i) => {
      if (r.totals![c.key] != null) { tr.getCell(i + 1).value = r.totals![c.key]! / 100; tr.getCell(i + 1).numFmt = '#,##0.00 "€"'; }
    });
    tr.font = { bold: true };
    tr.eachCell((cell) => (cell.border = { top: { style: "thin", color: { argb: "FF6D28D9" } } }));
  }
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: r.columns.length } };
}

export async function toXlsx(r: Report, churchLabel: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ICC BFC Finances";
  wb.created = new Date();
  if (r.sheets) r.sheets.forEach((s) => addSheet(wb, s, churchLabel));
  else addSheet(wb, r, churchLabel);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const s = StyleSheet.create({
  page: { padding: 32, paddingBottom: 56, fontSize: 8.5, fontFamily: "Helvetica", color: "#0A0A0A" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, borderBottom: "2pt solid #6D28D9", paddingBottom: 10 },
  brand: { backgroundColor: "#6D28D9", color: "#fff", paddingVertical: 4, paddingHorizontal: 7, borderRadius: 4, fontSize: 9, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 8 },
  sub: { color: "#6B6B76", marginTop: 3 },
  tr: { flexDirection: "row", borderBottom: "0.5pt solid #EAEAEE", paddingVertical: 4 },
  th: { flexDirection: "row", backgroundColor: "#F3EEFF", paddingVertical: 5, color: "#4C1D95", fontFamily: "Helvetica-Bold" },
  total: { flexDirection: "row", paddingVertical: 6, borderTop: "1pt solid #6D28D9", fontFamily: "Helvetica-Bold" },
  sign: { flexDirection: "row", justifyContent: "space-between", marginTop: 36 },
  signBox: { width: "45%", borderTop: "0.5pt solid #6B6B76", paddingTop: 5, color: "#6B6B76" },
  footer: { position: "absolute", bottom: 22, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", color: "#6B6B76", fontSize: 7.5 },
});

function Table({ r }: { r: Report }) {
  const total = r.columns.reduce((a, c) => a + (c.width ?? (c.type === "money" ? 14 : 16)), 0);
  const w = (c: Report["columns"][number]) => `${((c.width ?? (c.type === "money" ? 14 : 16)) / total) * 100}%`;
  return (
    <View>
      <View style={s.th} fixed>
        {r.columns.map((c) => <Text key={c.key} style={{ width: w(c), paddingHorizontal: 3, textAlign: c.type === "money" ? "right" : "left" }}>{c.label}</Text>)}
      </View>
      {r.rows.map((row, i) => (
        <View key={i} style={[s.tr, String(row.label ?? "").match(/^(TOTAL|RÉSULTAT)/) ? { fontFamily: "Helvetica-Bold" } : {}]} wrap={false}>
          {r.columns.map((c) => <Text key={c.key} style={{ width: w(c), paddingHorizontal: 3, textAlign: c.type === "money" ? "right" : "left" }}>{fmt(row[c.key], c.type)}</Text>)}
        </View>
      ))}
      {r.totals && (
        <View style={s.total} wrap={false}>
          {r.columns.map((c, i) => <Text key={c.key} style={{ width: w(c), paddingHorizontal: 3, textAlign: c.type === "money" ? "right" : "left" }}>{i === 0 ? "Total" : r.totals![c.key] != null ? formatEuro(r.totals![c.key]!) : ""}</Text>)}
        </View>
      )}
      {r.rows.length === 0 && <Text style={{ color: "#6B6B76", marginTop: 10 }}>Aucune donnée sur la période.</Text>}
    </View>
  );
}

export async function toPdf(r: Report, churchLabel: string) {
  const reports = r.sheets ?? [r];
  const landscape = reports.some((x) => x.columns.length > 6);
  const doc = (
    <Document title={r.title} author="ICC BFC Finances">
      {reports.map((rep, i) => (
        <Page key={i} size="A4" orientation={landscape ? "landscape" : "portrait"} style={s.page}>
          <View style={s.head}>
            <View>
              <Text style={s.brand}>ICC BFC Finances</Text>
              <Text style={s.title}>{rep.title}</Text>
              <Text style={s.sub}>{rep.subtitle || churchLabel}</Text>
            </View>
            <Text style={s.sub}>Généré le {new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</Text>
          </View>
          <Table r={rep} />
          <View style={s.sign} wrap={false}>
            <Text style={s.signBox}>Le trésorier — date et signature</Text>
            <Text style={s.signBox}>Le pasteur / responsable — date et signature</Text>
          </View>
          <View style={s.footer} fixed>
            <Text>Impact Centre Chrétien — Bourgogne-Franche-Comté</Text>
            <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      ))}
    </Document>
  );
  return renderToBuffer(doc);
}
