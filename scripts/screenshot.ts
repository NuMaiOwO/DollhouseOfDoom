/**
 * Opens the built game in headless Edge/Chrome and saves screenshots.
 *   npm run build && npm run screenshot -- [outDir] [seed]
 */
import { chromium } from "playwright-core";
import { createServer } from "vite";

const outDir = process.argv[2] ?? "screenshots";
const seed = process.argv[3] ?? "7";

const server = await createServer({ server: { port: 5199 }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge" });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(`http://localhost:5199/?seed=${seed}`);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}/1-start.png` });

// fast-forward, then click the first sim to open the inspector
await page.keyboard.press("Digit3");
await page.waitForTimeout(Number(process.env.FAST_FORWARD_MS ?? 6000));
await page.keyboard.press("Space");
const canvas = page.locator("#game canvas");
const box = (await canvas.boundingBox())!;
const target = await page.evaluate(() => {
  const w = (window as any).world;
  const s = w.sims.find((x: any) => x.alive);
  return s ? { x: s.x, floor: s.floor } : null;
});
if (target) {
  const scale = box.width / 840;
  await page.mouse.click(box.x + (20 + target.x) * scale, box.y + (56 + (2 - target.floor) * 120 - 12) * scale);
}
await page.waitForTimeout(400);
await page.screenshot({ path: `${outDir}/2-later.png`, fullPage: true });

console.log(errors.length ? `Page errors:\n${errors.join("\n")}` : "No page errors.");
await browser.close();
await server.close();
