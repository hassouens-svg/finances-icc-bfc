// Vérifie toutes les pages pour un utilisateur : statut HTTP, erreurs, débordement horizontal.
import { chromium } from "playwright";
const [email, ...paths] = process.argv.slice(2);
const base = process.env.BASE ?? "http://localhost:3000";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(base + "/");
await page.fill("#email", email);
await page.fill("#password", "Demo-ICC-2026!");
await Promise.all([page.waitForURL("**/app**", { timeout: 60000 }), page.click("button[type=submit]")]);
for (const p of paths) {
  errs.length = 0;
  const t = Date.now();
  const r = await page.goto(base + p, { waitUntil: "load", timeout: 120000 });
  const text = await page.locator("main").innerText().catch(() => "");
  const bad = /Un problème est survenu|Page introuvable/.test(text);
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(`${r?.status()} ${Date.now() - t}ms ${p}${bad ? " ❌ ERREUR AFFICHÉE" : ""}${over ? " ⚠ overflow" : ""}${errs.length ? " JS:" + errs.join("|") : ""}`);
}
await b.close();
