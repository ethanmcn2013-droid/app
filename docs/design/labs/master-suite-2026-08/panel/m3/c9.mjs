import { launch, open } from "./drive.mjs";

const b = await launch();
const p = await open(b, { state: "tasks.board", width: 1440, height: 960 });
await p.locator(".undated").click();
await p.waitForTimeout(700);
console.log(JSON.stringify(await p.evaluate(() => {
  const d = document.querySelector(".drawer");
  const dock = document.querySelector(".dock");
  const cs = dock ? getComputedStyle(dock) : null;
  const r = dock ? dock.getBoundingClientRect() : null;
  const inertHost = dock ? dock.closest("[inert]") : null;
  return {
    dialogName: d.getAttribute("aria-label") || d.getAttribute("aria-labelledby") || null,
    labelledbyResolves: d.getAttribute("aria-labelledby") ? !!document.getElementById(d.getAttribute("aria-labelledby")) : null,
    dockOpacity: cs?.opacity, dockDisplay: cs?.display, dockPE: cs?.pointerEvents, dockBox: r ? [r.x | 0, r.y | 0, r.width | 0, r.height | 0] : null,
    inertHost: inertHost ? String(inertHost.className).split(" ")[0] : null,
    inertHostOpacity: inertHost ? getComputedStyle(inertHost).opacity : null,
    dockButtons: [...(dock?.querySelectorAll("button") || [])].map((x) => ({ n: (x.getAttribute("aria-label") || x.textContent).trim().slice(0, 24), ti: x.tabIndex })),
    hitTest: r ? String(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.className) : null,
  };
}), null, 1));
const clicked = await p.evaluate(() => {
  const btn = document.querySelector(".dockPrimary");
  if (!btn) return "no dockPrimary";
  const r = btn.getBoundingClientRect();
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return "elementFromPoint over Add task: " + (hit ? hit.tagName + "." + String(hit.className).split(" ")[0] : "null");
});
console.log(clicked);
const before = await p.evaluate(() => document.querySelectorAll("article.card").length);
await p.locator(".dockPrimary").click({ force: true, timeout: 4000 }).catch((e) => console.log("  click threw:", String(e).split("\n")[0].slice(0, 90)));
await p.waitForTimeout(600);
console.log("cards before/after:", before, await p.evaluate(() => document.querySelectorAll("article.card").length));
await p.screenshot({ path: "panel/m3/drawer-dock.png", clip: { x: 100, y: 820, width: 940, height: 130 } });
await p.close();
await b.close();
