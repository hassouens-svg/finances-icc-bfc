import { test, expect } from "@playwright/test";
import path from "node:path";
import { login, toast, euros } from "./helpers";

const ticket = path.join(__dirname, "../fixtures/ticket.png");

test("la racine est la page de connexion (pas de landing page)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  await expect(page.getByText("Mot de passe oublié ?")).toBeVisible();
});

test("cloisonnement : un trésorier ne voit que son église", async ({ page }) => {
  await login(page, "tresorier.besancon@example.com");
  await expect(page.getByText("ICC Besançon").filter({ visible: true }).first()).toBeVisible();
  await page.goto("/app/depenses");
  await expect(page.getByText("Chalon")).toHaveCount(0);
  // l'église mère, elle, bascule entre les vues
  await login(page, "mere@example.com");
  await expect(page.getByText("Comparatif des églises").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("ICC Chalon-sur-Saône").filter({ visible: true }).first()).toBeVisible();
});

test("séance d'offrandes du dimanche saisie sur téléphone", async ({ page }) => {
  await login(page, "tresorier.auxerre@example.com");
  const start = Date.now();
  await page.goto("/app/offrandes/nouvelle");
  await page.getByRole("radio", { name: "Offrande simple" }).click();
  await page.getByLabel("Montant").fill("320,50");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await page.getByRole("radio", { name: "Dîme" }).click();
  await page.getByRole("radio", { name: "Chèque" }).click();
  await page.getByLabel("Montant").fill("150");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await page.fill("#c1", "Marie Diallo");
  await page.fill("#c2", "Jean Petit");
  await page.fill("#cc", "320,50");
  await page.fill("#cq", "150");
  await page.getByRole("button", { name: /^Valider$/ }).click();
  await page.waitForURL(/\/app\/offrandes\/[\w]+$/);
  await expect(page.getByText("Comptage conforme").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Verrouillée", { exact: true })).toBeVisible();
  expect(Date.now() - start).toBeLessThan(120_000);
});

test("un dépôt diminue la caisse et augmente la banque", async ({ page }) => {
  await login(page, "tresorier.auxerre@example.com");
  await page.goto("/app/tresorerie");
  await page.waitForTimeout(1500); // fin de l'animation des compteurs
  const cashBefore = euros(await page.getByText("En caisse").first().locator("xpath=../..").locator("p.num").first().innerText());
  const bankBefore = euros(await page.getByText("À la banque").first().locator("xpath=../..").locator("p.num").first().innerText());
  await page.goto("/app/depots/nouveau");
  await page.getByRole("button", { name: "Montant libre" }).click();
  await page.locator("input[name=freeCash]").fill("10");
  await page.locator("input[name=files]").setInputFiles(ticket);
  const total = euros(await page.getByText("Total déposé").locator("xpath=..").locator(".num").innerText());
  expect(total).toBe(1000);
  await page.getByRole("button", { name: "Enregistrer le dépôt" }).click();
  await page.waitForURL(/\/app\/depots\/[\w]+$/);
  await expect(page.getByText("Déposé").filter({ visible: true }).first()).toBeVisible();
  // relit jusqu'à ce que la nouvelle écriture soit visible (listes Appwrite)
  const read = async () => {
    await page.goto("/app/tresorerie");
    await page.waitForTimeout(1500);
    return {
      cash: euros(await page.getByText("En caisse").first().locator("xpath=../..").locator("p.num").first().innerText()),
      bank: euros(await page.getByText("À la banque").first().locator("xpath=../..").locator("p.num").first().innerText()),
    };
  };
  await expect.poll(read, { timeout: 60_000, intervals: [2000] }).toEqual({ cash: cashBefore - total, bank: bankBefore + total });
});

test("une dépense au-dessus du seuil exige l'église mère avant paiement", async ({ page }) => {
  await login(page, "tresorier.besancon@example.com");
  await page.goto("/app/depenses/nouvelle");
  await page.getByLabel("Objet").fill("Table de mixage e2e");
  await page.locator("input[name=amount]").fill("850");
  await page.locator("select[name=categoryId]").selectOption({ label: "Matériel" });
  await page.getByRole("button", { name: "Soumettre à validation" }).click();
  await page.waitForURL(/\/app\/depenses\/[\w]+$/);
  const url = page.url();
  await expect(page.getByText("étape 1/3").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Marquer payée" })).toHaveCount(0);
  // étape 1 : trésorier
  await page.getByRole("button", { name: "Approuver" }).click();
  await toast(page, /Étape approuvée/);
  // étape 2 : pasteur
  await login(page, "pasteur.besancon@example.com");
  await page.goto(url);
  await page.getByRole("button", { name: "Approuver" }).click();
  await toast(page, /Étape approuvée/);
  // le trésorier ne peut toujours pas payer
  await login(page, "tresorier.besancon@example.com");
  await page.goto(url);
  await expect(page.getByText("En attente de validation", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marquer payée" })).toHaveCount(0);
  // étape 3 : église mère
  await login(page, "mere@example.com");
  await page.goto(url);
  await page.getByRole("button", { name: "Approuver" }).click();
  await toast(page, /circuit terminé/);
  // paiement possible
  await login(page, "tresorier.besancon@example.com");
  await page.goto(url);
  await page.getByRole("button", { name: "Marquer payée" }).click();
  await page.getByRole("button", { name: "Confirmer le paiement" }).click();
  await toast(page, /payée/);
  await expect(page.getByText("Payée").filter({ visible: true }).first()).toBeVisible();
});

test("remboursement public avec photo → validé → remboursé → dépense créée", async ({ page }) => {
  await login(page, "tresorier.dijon@example.com");
  await page.goto("/app/admin/liens");
  const link = (await page.locator("p.font-mono").filter({ hasText: "/p/" }).allInnerTexts());
  await page.goto("/app/admin/liens");
  const cards = page.locator("div.rounded-2xl").filter({ hasText: "Remboursements" }).filter({ hasText: "/p/" });
  const url = (await cards.first().locator("p.font-mono").innerText()).trim();
  expect(link.length).toBeGreaterThan(0);
  const pub = await page.context().browser()!.newPage();
  await pub.goto(new URL(url).pathname);
  await pub.fill("#requesterName", "Lydie E2E");
  await pub.fill("#requesterPhone", "0600000000");
  await pub.fill("#reason", "Achat de gobelets pour l'accueil");
  await pub.fill("#amount", "45,90");
  await pub.fill("#expenseDate", new Date().toISOString().slice(0, 10));
  await pub.locator("input[name=files]").setInputFiles(ticket);
  await pub.locator("input[name=consent]").check();
  await pub.waitForTimeout(3200);
  await pub.getByRole("button", { name: "Envoyer ma demande" }).click();
  await pub.waitForURL(/\/suivi\//);
  await expect(pub.getByText("Demande envoyée !")).toBeVisible();
  await expect(pub.getByText("Soumise").filter({ visible: true }).first()).toBeVisible();
  const tracking = pub.url().split("?")[0]!;

  await page.goto("/app/remboursements");
  await page.getByText("Lydie E2E").filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Valider" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Valider" }).click();
  await toast(page, /validé/);
  // la dépense liée (< 100 €) : validation trésorier puis remboursement
  await page.getByRole("link", { name: /DEP-/ }).first().click();
  await page.getByRole("button", { name: "Approuver" }).click();
  await toast(page, /circuit terminé/);
  await page.getByRole("link", { name: "Remboursement" }).click();
  await page.getByRole("button", { name: "Rembourser" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
  await toast(page, /effectué/);
  await expect(page.getByText("Remboursée").filter({ visible: true }).first()).toBeVisible();
  await page.getByRole("link", { name: /DEP-/ }).first().click();
  await expect(page.getByText("Payée").filter({ visible: true }).first()).toBeVisible();

  await pub.goto(tracking);
  await expect(pub.getByText("Remboursée").filter({ visible: true }).first()).toBeVisible();
  await pub.close();
});

test("besoin public → suivi qui change de statut", async ({ page }) => {
  await login(page, "tresorier.dijon@example.com");
  await page.goto("/app/admin/liens");
  const url = (await page.locator("div.rounded-2xl").filter({ hasText: "Besoins" }).filter({ hasText: "/p/" }).first().locator("p.font-mono").innerText()).trim();
  const pub = await page.context().browser()!.newPage();
  await pub.goto(new URL(url).pathname);
  await pub.fill("#requesterName", "Caleb E2E");
  await pub.fill("#requesterEmail", "caleb@example.com");
  await pub.locator("#departmentId").selectOption({ label: "Jeunesse" });
  await pub.fill("#title", "Ballons pour la sortie jeunesse");
  await pub.fill("#estimated", "60");
  await pub.locator("input[name=consent]").check();
  await pub.waitForTimeout(3200);
  await pub.getByRole("button", { name: "Envoyer ma demande" }).click();
  await pub.waitForURL(/\/suivi\//);
  await expect(pub.getByText("Reçu").filter({ visible: true }).first()).toBeVisible();
  const tracking = pub.url().split("?")[0]!;
  await page.goto("/app/besoins");
  await page.getByText("Ballons pour la sortie jeunesse").filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Mettre à l'étude" }).click();
  await toast(page, /En étude/);
  await pub.goto(tracking);
  await expect(pub.getByText("En étude").filter({ visible: true }).first()).toBeVisible();
  await pub.close();
});

test("exports Excel et PDF téléchargeables", async ({ page }) => {
  await login(page, "mere@example.com");
  for (const f of ["xlsx", "pdf"]) {
    const r = await page.request.get(`/api/export?report=regional&format=${f}&p=quarter`);
    expect(r.status()).toBe(200);
    const body = await r.body();
    expect(body.subarray(0, 4).toString()).toBe(f === "pdf" ? "%PDF" : "PK\u0003\u0004");
  }
});
