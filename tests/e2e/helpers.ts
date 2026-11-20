import { expect, type Page } from "@playwright/test";

export const PASSWORD = process.env.DEMO_PASSWORD ?? "Demo-ICC-2026!";

export async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await Promise.all([page.waitForURL("**/app**"), page.click("button[type=submit]")]);
}

export async function setView(page: Page, label: string) {
  await page.getByRole("button", { name: /Changer d'église/ }).first().click();
  await page.getByRole("menuitem", { name: new RegExp(label) }).click();
  await page.waitForLoadState("networkidle");
}

export async function toast(page: Page, text: RegExp | string) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

export function euros(text: string) {
  return Math.round(Number(text.replace(/[^\d,-]/g, "").replace(",", ".")) * 100);
}

/** Préfixe de références unique pour une église de test (évite « préfixe déjà utilisé » d'un lancement à l'autre). */
export function testPrefix() {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return "X" + Array.from({ length: 3 }, () => a[Math.floor(Math.random() * 26)]).join("");
}

/** Remplit les accès obligatoires du modal « Nouvelle église ». */
export async function fillChurchAccess(dlg: import("@playwright/test").Locator, email: string, name = "Responsable Test") {
  await dlg.getByLabel("Nom du responsable").fill(name);
  await dlg.getByLabel("Email de connexion").fill(email);
  await dlg.getByLabel("Mot de passe").fill(PASSWORD);
}
