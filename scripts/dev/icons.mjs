import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const svg = readFileSync("public/icon.svg", "utf8");
const b = await chromium.launch();
const p = await b.newPage();
for (const [name, size, pad] of [["icon-192", 192, 0], ["icon-512", 512, 0], ["icon-maskable-512", 512, 0.12], ["apple-touch-icon", 180, 0]]) {
  await p.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - pad * 2));
  await p.setContent(`<html><body style="margin:0;background:${pad ? "#5B21B6" : "transparent"};display:grid;place-items:center;width:${size}px;height:${size}px">${svg.replace("<svg", `<svg width="${inner}" height="${inner}"`).replace(pad ? 'rx="11"' : "x", pad ? 'rx="0"' : "x")}</body></html>`);
  await p.screenshot({ path: `public/icons/${name}.png`, omitBackground: !pad });
}
await b.close();
