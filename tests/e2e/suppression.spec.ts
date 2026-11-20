import { test, expect } from "@playwright/test";
import { login, toast, PASSWORD, testPrefix, fillChurchAccess } from "./helpers";

const stamp = Date.now().toString(36);
const churchName = `ICC Test Rattachée ${stamp}`;
const respEmail = `resp.ratt.${stamp}@example.com`;

test.describe.serial("église mère, suppression et journal", () => {
  test("l'église mère ne voit pas le journal d'audit (réservé au super admin)", async ({ page }) => {
    await login(page, "mere@example.com");
    await page.goto("/app/admin");
    await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
    await expect(page.getByText("Journal d'audit")).toHaveCount(0);
    await page.goto("/app/admin/audit");
    await expect(page.getByText("Vous n'avez pas accès à ce module")).toBeVisible();
    // le super admin, lui, le voit
    await login(page, "superadmin@example.com");
    await page.goto("/app/admin/audit");
    await expect(page.getByRole("heading", { name: "Journal d'audit" })).toBeVisible();
  });

  test("l'église mère crée une église rattachée avec ses accès, depuis son propre compte", async ({ page }) => {
    await login(page, "mere@example.com");
    await page.goto("/app/equipe");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Églises rattachées")).toBeVisible();
    await page.getByRole("button", { name: "Nouvelle église" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Nom de l'église").fill(churchName);
    await dlg.getByLabel("Ville").fill(`Testville ${stamp}`);
    await dlg.getByLabel("Préfixe des références").fill(testPrefix());
    // accès obligatoires : sans eux, rien n'est créé
    await expect(dlg.getByLabel("Email de connexion")).toHaveAttribute("required", "");
    await fillChurchAccess(dlg, respEmail);
    await expect(dlg.locator("input[name=isMother]")).toHaveCount(0); // seul le super admin désigne l'église mère
    await dlg.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/app\/admin\/eglises\/\w+$/);
    await expect(page.getByText(respEmail).first()).toBeVisible();
    await expect(page.getByText("Responsable de l'église").first()).toBeVisible();
  });

  test("le responsable de l'église rattachée se connecte tout de suite", async ({ page }) => {
    await login(page, respEmail);
    await page.goto("/app/equipe");
    await expect(page.getByRole("heading", { name: "Mon équipe" })).toBeVisible();
    await expect(page.getByText("Églises rattachées")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Créer un compte" }).first()).toBeVisible();
  });

  test("l'église mère supprime définitivement l'église rattachée (et son compte)", async ({ page }) => {
    await login(page, "mere@example.com");
    await page.goto("/app/equipe");
    await page.waitForLoadState("networkidle");
    await page.locator(`a[href^="/app/admin/eglises/"]`).filter({ hasText: churchName }).click();
    await page.waitForURL(/\/app\/admin\/eglises\/\w+$/);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Supprimer" }).click();
    const dlg = page.getByRole("dialog");
    const confirm = dlg.getByRole("button", { name: "Supprimer définitivement" });
    await expect(confirm).toBeDisabled();
    await dlg.getByLabel("Confirmation de suppression").fill(churchName);
    await confirm.click();
    await toast(page, /supprimée définitivement/);
    await page.waitForURL(/\/app\/admin\/eglises$/);
    await expect(page.getByText(churchName)).toHaveCount(0);
    // son compte a disparu du système
    await page.context().clearCookies();
    await page.goto("/");
    await page.fill("#email", respEmail);
    await page.fill("#password", PASSWORD);
    await page.click("button[type=submit]");
    await expect(page).not.toHaveURL(/\/app/);
  });

  test("le super admin supprime définitivement un compte", async ({ page }) => {
    const email = `a.supprimer.${stamp}@example.com`;
    await login(page, "superadmin@example.com");
    await page.goto("/app/admin/utilisateurs");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Créer un compte" }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Nom complet").fill("Compte À Supprimer");
    await d.getByLabel("Email").fill(email);
    await d.getByLabel("Mot de passe").fill(PASSWORD);
    await d.getByRole("button", { name: "Créer le compte" }).click();
    await toast(page, /Compte créé/);
    const row = page.locator("div").filter({ hasText: email }).filter({ has: page.getByRole("button", { name: "Supprimer" }) }).last();
    await row.getByRole("button", { name: "Supprimer" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Confirmation de suppression").fill(email);
    await dlg.getByRole("button", { name: "Supprimer définitivement" }).click();
    await toast(page, /supprimé/);
    await expect(page.getByText(email)).toHaveCount(0);
  });
});
