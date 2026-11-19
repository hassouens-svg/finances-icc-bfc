// Captures d'écran : node scripts/dev/shots.mjs <email> <outdir> <path1> [path2...]
import { chromium } from "playwright";
const [email, out, ...paths] = process.argv.slice(2);
const base = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch();
for (const [name, vp] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1440, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: "fr-FR" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  if (email && email !== "-") {
    await page.goto(base + "/");
    await page.fill("#email", email);
    await page.fill("#password", "Demo-ICC-2026!");
    await Promise.all([page.waitForURL("**/app**", { timeout: 60000 }), page.click("button[type=submit]")]);
  }
  for (const p of paths) {
    const res = await page.goto(base + p, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(900);
    const file = `${out}/${name}${p.replace(/[\/?=&]/g, "_") || "_root"}.png`;
    await page.screenshot({ path: file, fullPage: name === "desktop" ? false : false });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    console.log(name, p, res?.status(), overflow ? "⚠ overflow-x" : "", file);
  }
  await ctx.close();
}
await browser.close();
