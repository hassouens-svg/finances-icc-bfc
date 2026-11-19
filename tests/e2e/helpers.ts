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
