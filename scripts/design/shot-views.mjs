import { chromium } from "@playwright/test";
const b = await chromium.launch();
for (const [path, name, w, h] of [
  ["/app/tasks", "board", 1440, 960],
  ["/app/tasks", "board-phone", 390, 844],
  ["/app/tasks/list", "list", 1440, 960],
]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.goto("http://localhost:3510" + path, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `docs/design/shots/prod-${name}--${w}x${h}.png` });
  await p.close();
}
console.log("shot");
await b.close();
