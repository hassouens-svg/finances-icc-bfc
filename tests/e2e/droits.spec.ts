import { test, expect } from "@playwright/test";
import { login, toast, PASSWORD } from "./helpers";

const stamp = Date.now().toString(36);
const respEmail = `resp.${stamp}@example.com`;
const memberEmail = `membre.${stamp}@example.com`;

test.describe.serial("droits par module", () => {
  test("le super admin crée une église avec son accès (responsable)", async ({ page }) => {
    await login(page, "superadmin@example.com");
    await page.goto("/app/admin/eglises");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Nouvelle église" }).first().click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Nom de l'église").fill(`ICC Test Droits ${stamp}`);
    await dlg.getByLabel("Ville").fill(`Testville ${stamp}`);
    await dlg.getByLabel("Nom du responsable").fill("Responsable Test");
    await dlg.getByLabel("Email de connexion").fill(respEmail);
    await dlg.getByLabel("Mot de passe").fill(PASSWORD);
    await dlg.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/app\/admin\/eglises\/\w+$/);
    await expect(page.getByText("Responsable de l'église").first()).toBeVisible();
    await expect(page.getByText(respEmail).first()).toBeVisible();
  });

  test("le responsable crée un membre qui peut seulement VOIR les offrandes", async ({ page }) => {
    await login(page, respEmail);
    await expect(page.getByRole("link", { name: "Mon équipe", includeHidden: true }).first()).toBeAttached();
    await page.goto("/app/equipe");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Créer un compte" }).first().click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Nom complet").fill("Compteur Offrandes");
    await dlg.getByLabel("Email").fill(memberEmail);
    await dlg.getByLabel("Mot de passe").fill(PASSWORD);
    await expect(dlg.getByText(/Administrateur église mère —/)).toHaveCount(0);
    await dlg.getByRole("button", { name: /Personnalisé/ }).click();
    await dlg.getByLabel("Dons & offrandes : Voir").check();
    await dlg.getByRole("button", { name: "Créer le compte" }).click();
    await toast(page, /Compte créé/);
    await expect(page.getByText(/Personnalisé : Dons \(voir\)/)).toBeVisible();
  });

  test("le membre ne voit que les offrandes", async ({ page }) => {
    await login(page, memberEmail);
    await page.goto("/app/offrandes");
    await expect(page.getByRole("heading", { name: "Dons & offrandes" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Importer Excel/ })).toHaveCount(0); // voir seulement : pas de saisie
    await page.goto("/app/offrandes/nouvelle");
    await expect(page.getByText("Vous n'avez pas les droits de saisie")).toBeVisible();
    await page.goto("/app/depenses");
    await expect(page.getByText("Vous n'avez pas accès à ce module")).toBeVisible();
    await page.goto("/app/tresorerie");
    await expect(page.getByText("Vous n'avez pas accès à ce module")).toBeVisible();
    await page.goto("/app/equipe");
    await expect(page.getByText("Réservé au responsable de l'église")).toBeVisible();
  });

  test("le responsable modifie les droits : le membre peut maintenant gérer les dépenses", async ({ page }) => {
    await login(page, respEmail);
    await page.goto("/app/equipe");
    await page.waitForLoadState("networkidle");
    const row = page.locator("li").filter({ hasText: memberEmail });
    await row.getByRole("button", { name: "Droits" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Dépenses, projets, charges : Gérer").check();
    await dlg.getByRole("button", { name: "Enregistrer" }).click();
    await toast(page, /Droits mis à jour/);
    await login(page, memberEmail);
    await page.goto("/app/depenses");
    await expect(page.getByRole("heading", { name: "Dépenses" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Nouvelle dépense/ }).first()).toBeVisible();
  });
});
