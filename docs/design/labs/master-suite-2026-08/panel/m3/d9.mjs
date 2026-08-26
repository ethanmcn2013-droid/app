import { launch, open } from "./drive.mjs";

const b = await launch();
const p = await open(b, { state: "timeline.owner-flight", width: 1440, height: 960 });
await p.evaluate(() => { window.__a = []; for (const t of document.querySelectorAll("[aria-live],[role=status]")) new MutationObserver(() => window.__a.push((t.textContent || "").trim().slice(0, 200))).observe(t, { childList: true, subtree: true, characterData: true }); });
const dump = async (t) => console.log(t, "ANN", JSON.stringify(await p.evaluate(() => { const x = window.__a; window.__a = []; return x; })));
const snap = async (t) => console.log(t, JSON.stringify(await p.evaluate(() => ({
  bar: [...document.querySelectorAll(".b-act, .b-inert")].map((e) => (e.textContent || "").trim()),
  focus: String(document.activeElement.className).split(" ")[0] + "|" + (document.activeElement.getAttribute("aria-label") || document.activeElement.textContent || "").trim().slice(0, 40),
  grabs: document.querySelectorAll(".b-grab").length,
  scrollTop: document.querySelector(".app")?.scrollTop,
  head: (document.querySelector(".b-bar")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90),
}))));
await snap("owner");
await p.locator('.b-act:has-text("Preview")').first().click();
await p.waitForTimeout(800);
await dump("preview"); await snap("after preview");
await p.screenshot({ path: "panel/m3/preview.png" });
// how do we get back?
console.log("all buttons now:", await p.evaluate(() => [...document.querySelectorAll("button")].filter((e) => e.getBoundingClientRect().width > 0 && !e.closest("[inert]")).map((e) => (e.getAttribute("aria-label") || e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40))));
await p.keyboard.press("Escape"); await p.waitForTimeout(600);
await dump("esc"); await snap("after esc");
await p.close();
await b.close();
