import { test, expect } from "@playwright/test";
import path from "node:path";
import { login, toast, PASSWORD } from "./helpers";

const logo = path.join(__dirname, "../../public/brand/icc-dijon.jpg");
const stamp = Date.now().toString(36);

test("le logo de l'église mère est servi et affiché", async ({ page }) => {
  const r = await page.request.get("/api/logo/mother");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toMatch(/image\//);
  await page.goto("/");
  await expect(page.getByAltText("Logo de l'église mère").first()).toBeVisible();
});

test("super admin : crée une église avec logo ; église mère : crée un compte avec mot de passe", async ({ page }) => {
  await login(page, "superadmin@example.com");
  await page.goto("/app/admin/eglises");
  await page.getByRole("button", { name: "Nouvelle église" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Nom de l'église").fill(`ICC Test ${stamp}`);
  await dlg.locator("select[name=cityId]").selectOption({ index: 1 });
  await dlg.getByLabel("Préfixe des références").fill("TST");
  await dlg.locator("input[name=logo]").setInputFiles(logo);
  await dlg.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/app\/admin\/eglises\/\w+$/);
  await expect(page.getByRole("heading", { name: new RegExp(`ICC Test ${stamp}`) })).toBeVisible();
  const logoSrc = await page.locator("h1 img").getAttribute("src");
  expect((await page.request.get(logoSrc!)).status()).toBe(200);

  // l'église mère crée le compte du trésorier de la nouvelle église, avec un mot de passe
  await login(page, "mere@example.com");
  await page.goto("/app/admin/utilisateurs");
  await page.getByRole("button", { name: "Créer un compte" }).click();
  const d2 = page.getByRole("dialog");
  await d2.getByLabel("Nom complet").fill("Trésorier Test");
  await d2.getByLabel("Email").fill(`tresorier.${stamp}@example.com`);
  await d2.getByLabel("Mot de passe").fill(PASSWORD);
  await d2.locator("select[name=churchId]").selectOption({ label: `ICC Test ${stamp}` });
  await d2.locator("input[value=treasurer]").check();
  await d2.getByRole("button", { name: "Créer le compte" }).click();
  await toast(page, /Compte créé/);

  // le nouveau trésorier se connecte et ne voit que son église
  await login(page, `tresorier.${stamp}@example.com`);
  await expect(page.getByText(`ICC Test ${stamp}`).filter({ visible: true }).first()).toBeVisible();
  await page.goto("/app/depenses");
  await expect(page.getByText("ICC Dijon")).toHaveCount(0);
});

test("seul un super administrateur voit l'option « Super administrateur »", async ({ page }) => {
  await login(page, "mere@example.com");
  await page.goto("/app/admin/utilisateurs");
  await page.getByRole("button", { name: "Créer un compte" }).click();
  await expect(page.getByRole("dialog").getByText("Super administrateur", { exact: true })).toHaveCount(0);
  await login(page, "superadmin@example.com");
  await page.goto("/app/admin/utilisateurs");
  await page.getByRole("button", { name: "Créer un compte" }).click();
  await expect(page.getByRole("dialog").getByText("Super administrateur", { exact: true })).toBeVisible();
});
