import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "timeline.owner-flight" });
const snap = async (tag) => console.log(tag, JSON.stringify(await p.evaluate(() => ({
  active: document.activeElement ? document.activeElement.tagName+"."+String(document.activeElement.className).split(" ")[0]+" :: "+(document.activeElement.getAttribute("aria-label")||document.activeElement.textContent||"").trim().slice(0,60) : null,
  live: (document.querySelector(".b-live")?.textContent||"").trim(),
  sr: (document.querySelector("p.sr")?.textContent||"").trim(),
  undoVisible: (()=>{const u=document.querySelector(".b-undo"); if(!u) return null; const cs=getComputedStyle(u); return cs.display+"/"+cs.opacity;})(),
  editLabel: document.getElementById("b-edit")?.getAttribute("aria-label")||null,
  scrollY: window.scrollY, deckScroll: document.querySelector(".b-measure,.b-scroll,#tl")?.scrollTop ?? null,
}))));
await p.locator(".b-grab").first().click();
await p.waitForTimeout(300);
await snap("opened");
await p.locator("#b-edit .b-step").first().click();
await p.waitForTimeout(400);
await snap("stepped");
await p.keyboard.press("Control+z");
await p.waitForTimeout(400);
await snap("undone");
await p.close();
await b.close();
