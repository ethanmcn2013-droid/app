import { launch, open } from "./drive.mjs";

const b = await launch();
const p = await open(b, { state: "tasks.board", width: 1440, height: 960 });
await p.locator(".undated").click();
await p.waitForTimeout(700);
console.log("focus after opening drawer:", await p.evaluate(() => String(document.activeElement.className).split(" ")[0] + " | " + (document.activeElement.getAttribute("aria-label") || document.activeElement.textContent || "").trim().slice(0, 40)));
// tab order with drawer open
const stops = [];
for (let i = 0; i < 45; i++) {
  await p.keyboard.press("Tab");
  const s = await p.evaluate(() => {
    const a = document.activeElement; if (!a || a === document.body) return null;
    const r = a.getBoundingClientRect();
    return String(a.className).split(" ")[0] + " | " + (a.getAttribute("aria-label") || a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 36) + (r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight ? "  OFFSCREEN" : "") + (a.closest(".drawer,[class*=drawer],[class*=plan]") ? "  [drawer]" : "");
  });
  if (!s) { stops.push("-- body --"); break; }
  if (stops.length && stops[0] === s) { stops.push("(cycled)"); break; }
  stops.push(s);
}
console.log(stops.join("\n"));
// escape closes?
await p.keyboard.press("Escape");
await p.waitForTimeout(500);
console.log("after Esc: drawer open?", await p.evaluate(() => !!document.querySelector(".drawer, [class*=drawer]")), "focus:", await p.evaluate(() => String(document.activeElement.className).split(" ")[0] + " | " + (document.activeElement.getAttribute("aria-label") || document.activeElement.textContent || "").trim().slice(0, 40)));
await p.close();
await b.close();
