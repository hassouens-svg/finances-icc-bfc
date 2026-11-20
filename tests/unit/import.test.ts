import { describe, it, expect } from "vitest";
import { parseDateCell, parseAmountCell, matchMethod, matchDonationType, detectOfferings, detectExpenses, buildOfferingRows, buildExpenseRows } from "@/lib/import-map";

const types = [{ id: "dime", name: "Dîme" }, { id: "simple", name: "Offrande simple" }, { id: "spec", name: "Offrande spéciale" }, { id: "projet", name: "Don pour projet" }, { id: "grace", name: "Action de grâce" }, { id: "autre", name: "Autre" }];

describe("lecture des cellules", () => {
  it("dates françaises, ISO, texte et numéro de série Excel", () => {
    expect(parseDateCell("05/10/2025")).toBe("2025-10-05");
    expect(parseDateCell("5-10-25")).toBe("2025-10-05");
    expect(parseDateCell("2025-10-05")).toBe("2025-10-05");
    expect(parseDateCell("dimanche 12 janvier 2025")).toBe("2025-01-12");
    expect(parseDateCell(45570)).toBe("2024-10-05");
    expect(parseDateCell("total")).toBeNull();
  });
  it("montants", () => {
    expect(parseAmountCell(1250.5)).toBe(125050);
    expect(parseAmountCell("1 250,50 €")).toBe(125050);
    expect(parseAmountCell("1.250,50")).toBe(125050);
    expect(parseAmountCell("1,250.50")).toBe(125050);
    expect(parseAmountCell("abc")).toBeNull();
  });
  it("moyens et types de dons", () => {
    expect(matchMethod("Espèces")).toBe("cash");
    expect(matchMethod("CHQ")).toBe("cheque");
    expect(matchMethod("CB")).toBe("card");
    expect(matchDonationType("Dîmes", types)).toBe("dime");
    expect(matchDonationType("Offrandes", types)).toBe("simple");
    expect(matchDonationType("Offr. spéciales", types)).toBe("spec");
    expect(matchDonationType("Actions de grâce", types)).toBe("grace");
  });
});

describe("fichier d'offrandes", () => {
  it("format « une colonne par type » (une ligne par culte)", () => {
    const headers = ["Date", "Dîmes", "Offrandes", "Offrandes spéciales", "Total"];
    const rows = [["06/10/2025", 450, 320.5, null, 770.5], ["13/10/2025", "300", "280,00", 50, 630], ["TOTAL", 750, 600.5, 50, 1400.5]];
    const m = detectOfferings(headers, rows, types);
    expect(m.amounts.map((a) => a.typeId)).toEqual(["dime", "simple", "spec"]);
    const r = buildOfferingRows(rows, m, { defaultTypeId: "simple", defaultMethod: "cash", types, headerRow: 1 });
    expect(r.rows).toHaveLength(5);
    expect(r.rows.reduce((a, x) => a + x.amountCents, 0)).toBe(140050);
    expect(r.errors).toHaveLength(0);
  });
  it("format « une ligne par don » avec donateur, type et moyen", () => {
    const headers = ["Date", "Nom", "Type", "Mode de paiement", "Montant"];
    const rows = [["06/10/2025", "Marie Diallo", "Dîme", "Chèque", "150"], [null, "Anonyme", "Offrande", "Espèces", "20"], ["xx", "Jean", "Dîme", "Espèces", "10"]];
    const m = detectOfferings(headers, rows, types);
    expect(m).toMatchObject({ date: 0, donor: 1, type: 2, method: 3 });
    const r = buildOfferingRows(rows, m, { defaultTypeId: "simple", defaultMethod: "cash", types, headerRow: 1 });
    expect(r.rows[0]).toMatchObject({ donorName: "Marie Diallo", typeId: "dime", method: "cheque", amountCents: 15000 });
    expect(r.rows[1]).toMatchObject({ date: "2025-10-06", donorName: null, typeId: "simple" }); // date reprise de la ligne au-dessus
    expect(r.errors).toEqual([{ row: 4, message: "Date illisible" }]);
  });
});

describe("fichier de dépenses", () => {
  it("détecte date, libellé, catégorie et montant", () => {
    const headers = ["Date", "Libellé", "Catégorie", "Fournisseur", "Montant"];
    const rows = [["01/10/2025", "Loyer octobre", "Loyer", "SCI", "1 200,00"], ["03/10/2025", "Micros", "Matériel", "Thomann", -89.9], [null, "Total", null, null, 1289.9]];
    const m = detectExpenses(headers, rows);
    expect(m).toMatchObject({ date: 0, title: 1, category: 2, supplier: 3, amount: 4 });
    const r = buildExpenseRows(rows, m, { defaultMethod: "bank_transfer", headerRow: 1 });
    expect(r.rows).toHaveLength(2);
    expect(r.rows[1]).toMatchObject({ amountCents: 8990, categoryName: "Matériel" });
  });
});

import ExcelJS from "exceljs";
import { readXlsx, parseCsv, toSheet } from "@/lib/sheet-read";

describe("lecture d'un vrai fichier Excel", () => {
  it("trouve l'en-tête sous un titre, lit les dates Excel et ignore la ligne TOTAL", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Offrandes 2024");
    ws.addRow(["Registre des offrandes — ICC"]);
    ws.addRow([]);
    ws.addRow(["Date", "Dîmes", "Offrandes", "Offrandes spéciales", "Total"]);
    ws.addRow([new Date(Date.UTC(2024, 0, 7)), 410, 230.5, null, 640.5]);
    ws.addRow([new Date(Date.UTC(2024, 0, 14)), 380, { formula: "200+10", result: 210 }, 75, 665]);
    ws.addRow(["TOTAL", 790, 440.5, 75, 1305.5]);
    const [sheet] = await readXlsx(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(sheet!.headers).toEqual(["Date", "Dîmes", "Offrandes", "Offrandes spéciales", "Total"]);
    expect(sheet!.rows[0]![0]).toBe("2024-01-07");
    const m = detectOfferings(sheet!.headers, sheet!.rows, types);
    const r = buildOfferingRows(sheet!.rows, m, { defaultTypeId: "simple", defaultMethod: "cash", types, headerRow: sheet!.headerRow });
    expect(r.rows).toHaveLength(5);
    expect(r.rows.reduce((a, x) => a + x.amountCents, 0)).toBe(130550);
  });
  it("lit un CSV avec point-virgule et guillemets", () => {
    const s = toSheet("CSV", parseCsv('Date;Libellé;Montant\n03/02/2024;"Loyer; février";"1 200,00"\n'))!;
    expect(s.rows[0]).toEqual(["03/02/2024", "Loyer; février", "1 200,00"]);
  });
});
