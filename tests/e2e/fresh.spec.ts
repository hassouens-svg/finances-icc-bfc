/**
 * Parcours « base toute neuve » (lancé seulement avec FRESH_EMAIL / FRESH_PASSWORD, sur une base remise à zéro).
 * Le super administrateur met tout en place lui-même, puis le trésorier créé partage un lien.
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { toast, fillChurchAccess } from "./helpers";

const email = process.env.FRESH_EMAIL;
const password = process.env.FRESH_PASSWORD;
const logo = path.join(__dirname, "../../public/brand/icc-dijon.jpg");
test.skip(!email || !password, "FRESH_EMAIL / FRESH_PASSWORD non définis");

test("mise en place complète depuis une base vide", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.fill("#email", email!);
  await page.fill("#password", password!);
  await Promise.all([page.waitForURL("**/app**"), page.click("button[type=submit]")]);
  await expect(page.getByText("Mise en place")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Bienvenue/ })).toBeVisible();

  // 1. Église mère, ville tapée librement, logo
  await page.goto("/app/admin/eglises");
  await expect(page.getByText("Créez votre première église")).toBeVisible();
  await page.getByRole("button", { name: "Nouvelle église" }).first().click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Nom de l'église").fill("ICC Dijon");
  await dlg.getByLabel("Ville").fill("Dijon");
  await expect(dlg.getByLabel("Préfixe des références")).toHaveValue("DIJ");
  await dlg.locator("input[name=logo]").setInputFiles(logo);
  await dlg.locator("input[name=isMother]").check();
  await fillChurchAccess(dlg, "fresh.responsable@example.com", "Responsable Dijon");
  await dlg.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/app\/admin\/eglises\/\w+$/);

  // 2. Prochaines étapes, en un clic chacune
  await page.getByRole("button", { name: "Créer un compte" }).first().click();
  const inv = page.getByRole("dialog");
  await inv.getByLabel("Nom complet").fill("Trésorier Dijon");
  await inv.getByLabel("Email").fill("fresh.tresorier@example.com");
  await inv.getByLabel("Mot de passe").fill("Fresh-Test-2026!");
  await inv.locator("input[value=treasurer]").check();
  await inv.getByRole("button", { name: "Créer le compte" }).click();
  await toast(page, /Compte créé/);
  await page.getByRole("button", { name: "Compte bancaire" }).click();
  const bank = page.getByRole("dialog");
  await bank.getByLabel("Libellé").fill("Compte courant");
  await bank.getByLabel("Solde de départ").fill("1500");
  await bank.getByRole("button", { name: "Enregistrer" }).click();
  await toast(page, /Compte enregistré/);
  await page.getByRole("button", { name: "Ajouter les départements courants" }).click();
  await toast(page, /départements ajoutés/);
  await page.getByRole("button", { name: "Lien besoins" }).click();
  await toast(page, /Lien prêt/);
  await page.getByRole("button", { name: "Lien remboursements" }).click();
  await toast(page, /Lien prêt/);
  await expect(page.getByText("Église prête ✓")).toBeVisible();

  // 3. Le trésorier se connecte et copie le lien des remboursements
  await page.context().clearCookies();
  await page.goto("/");
  await page.fill("#email", "fresh.tresorier@example.com");
  await page.fill("#password", "Fresh-Test-2026!");
  await Promise.all([page.waitForURL("**/app**"), page.click("button[type=submit]")]);
  await page.goto("/app/remboursements");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Copier le lien" }).first().click();
  await expect(page.getByRole("button", { name: "Copié" }).first()).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/p\//);
});
