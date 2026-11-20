import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import ExcelJS from "exceljs";
import { login, toast } from "./helpers";

const uniqueDate = () => new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1) + Math.floor(Math.random() * 280) * 86400000).toISOString().slice(0, 10);

test.describe("tableur sur ordinateur", () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  test("saisie des enveloppes en tableur, avec complétion des noms", async ({ page }) => {
    const who = `T${Date.now().toString(36)} Esther`;
    await login(page, "tresorier.besancon@example.com");
    await page.goto("/app/offrandes/nouvelle");
    await page.locator("input[name=date]").fill(uniqueDate());
    await page.getByRole("button", { name: /Commencer la saisie/ }).click();
    await page.waitForURL(/\/saisie$/);
    await expect(page.getByRole("tab", { name: "Tableur" })).toHaveAttribute("aria-selected", "true");
    const donor = () => page.getByLabel("Donateur (vide = anonyme)").last();
    const amount = () => page.getByLabel("Montant").last();
    await donor().fill(who);
    await donor().press("Enter");
    await expect(amount()).toBeFocused();
    await amount().fill("120");
    await amount().press("Enter");
    await expect(donor()).toBeFocused();
    await amount().fill("35,50");
    await amount().press("Enter");
    await donor().fill(who.slice(0, 10));
    await expect(page.getByRole("option", { name: who })).toBeVisible();
    await donor().press("Enter");
    await amount().fill("80");
    await amount().press("Enter");
    await expect(page.getByText("Tout est enregistré").first()).toBeVisible();
    await expect(page.getByText("3 enveloppe(s)")).toBeVisible();
    await page.reload();
    await expect(page.getByText("3 enveloppe(s)")).toBeVisible();
    await expect(page.getByLabel("Donateur (vide = anonyme)").nth(2)).toHaveValue(who);
  });
});

test("charges fixes : le loyer et l'indicateur de couverture", async ({ page }) => {
  await login(page, "tresorier.auxerre@example.com");
  await page.goto("/app/charges");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Charge fixe" }).first().click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Nom").fill("Loyer de la salle");
  await dlg.getByLabel("Montant").fill("950");
  await dlg.getByRole("button", { name: "Enregistrer" }).click();
  await toast(page, /Charge enregistrée/);
  await expect(page.getByText("Charges fixes du mois")).toBeVisible();
  await page.getByRole("button", { name: "Créer la dépense du mois" }).first().click();
  await toast(page, /envoyée en validation/);
});

test("import Excel « une ligne par culte » puis annulation", async ({ page }) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "icc-")), "offrandes-2024.xlsx");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Offrandes 2024");
  ws.addRow(["Registre des offrandes"]);
  ws.addRow([]);
  ws.addRow(["Date", "Dîmes", "Offrandes", "Offrandes spéciales", "Total"]);
  ws.addRow([new Date(Date.UTC(2024, 0, 7)), 410, 230.5, null, 640.5]);
  ws.addRow([new Date(Date.UTC(2024, 0, 14)), 380, 210, 75, 665]);
  ws.addRow(["TOTAL", 790, 440.5, 75, 1305.5]);
  await wb.xlsx.writeFile(file);
  await login(page, "tresorier.chalon@example.com");
  await page.goto("/app/import");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type=file]").setInputFiles(file);
  await expect(page.getByText(/5 dons · 1\s305,50\s€/)).toBeVisible();
  await page.getByRole("button", { name: /Importer 5 ligne/ }).click();
  await expect(page.getByText("Import terminé", { exact: true })).toBeVisible({ timeout: 60_000 });
  await page.goto("/app/import");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Annuler cet import" }).first().click();
  await toast(page, /Import annulé : 5 ligne/);
});

test("import CSV de dépenses avec nouvelle catégorie", async ({ page }) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "icc-")), "depenses.csv");
  fs.writeFileSync(file, "Date;Libellé;Catégorie;Fournisseur;Montant\n03/02/2024;Loyer février;Loyer;SCI du Parc;1 200,00\n10/02/2024;Fleurs autel;Décoration florale;Fleuriste;45,90\n");
  await login(page, "tresorier.chalon@example.com");
  await page.goto("/app/import?type=depenses");
  await page.waitForLoadState("networkidle");
  await page.locator("input[type=file]").setInputFiles(file);
  await expect(page.getByText(/2 dépenses · 1\s245,90\s€/)).toBeVisible();
  await expect(page.getByText(/Décoration florale/).first()).toBeVisible();
  await page.getByRole("button", { name: /Importer 2 ligne/ }).click();
  await expect(page.getByText("Import terminé", { exact: true })).toBeVisible({ timeout: 60_000 });
  await page.goto("/app/import?type=depenses");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Annuler cet import" }).first().click();
  await toast(page, /Import annulé : 2 ligne/);
});
