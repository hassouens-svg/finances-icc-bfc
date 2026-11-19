import { chromium } from "playwright";
const [email, ...paths] = process.argv.slice(2);
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.goto("http://localhost:3000/"); await page.fill("#email", email); await page.fill("#password", "Demo-ICC-2026!");
await Promise.all([page.waitForURL("**/app**"), page.click("button[type=submit]")]);
for (const p of paths) {
  await page.goto("http://localhost:3000" + p, { waitUntil: "load" });
  const r = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(e).position !== "fixed").slice(0, 6).map((e) => `${e.tagName}.${(e.className?.baseVal ?? e.className ?? "").toString().slice(0, 90)} r=${Math.round(e.getBoundingClientRect().right)}`));
  console.log(p, r);
}
await b.close();
