import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "timeline.owner-flight" });
const info = async (tag) => console.log(tag, JSON.stringify(await p.evaluate(() => ({
  bedit: (()=>{const e=document.getElementById("b-edit"); return e? {tag:e.tagName, role:e.getAttribute("role"), label:e.getAttribute("aria-label")||"", modal:e.getAttribute("aria-modal")} : null})(),
  grabs: [...document.querySelectorAll(".b-grab")].map(g=>({label:(g.getAttribute("aria-label")||g.textContent).trim().slice(0,50), exp:g.getAttribute("aria-expanded"), ctrl:g.getAttribute("aria-controls")})).slice(0,3),
  active: document.activeElement ? document.activeElement.tagName+"."+String(document.activeElement.className).split(" ")[0]+" :: "+(document.activeElement.getAttribute("aria-label")||document.activeElement.textContent||"").trim().slice(0,50) : null,
  live: (document.querySelector(".b-live")?.textContent||"").trim(),
  sr: (document.querySelector("p.sr")?.textContent||"").trim(),
}))));
await info("before");
await p.locator(".b-grab").first().click();
await p.waitForTimeout(400);
await info("after-open");
// tab through editor
for (let i=0;i<3;i++){ await p.keyboard.press("Tab"); }
await info("after-3tab");
await p.keyboard.press("Escape");
await p.waitForTimeout(300);
await info("after-esc");
await p.close();
await b.close();
