import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "timeline.owner-flight" });
await p.evaluate(() => {
  window.__ann = [];
  const targets = document.querySelectorAll("[aria-live],[role=status],[role=alert],[role=log]");
  for (const t of targets) {
    new MutationObserver(() => {
      const txt = (t.textContent||"").trim();
      window.__ann.push({ sel: t.tagName.toLowerCase()+"."+String(t.className).split(" ")[0], txt });
    }).observe(t, { childList: true, subtree: true, characterData: true });
  }
});
const dump = async (tag) => { const a = await p.evaluate(()=>{const x=window.__ann; window.__ann=[]; return x;}); console.log(tag, JSON.stringify(a)); };
await p.locator(".b-grab").first().click(); await p.waitForTimeout(400); await dump("open");
await p.locator("#b-edit .b-step").first().click(); await p.waitForTimeout(500); await dump("step");
await p.keyboard.press("Control+z"); await p.waitForTimeout(500); await dump("undo");
console.log("undo el", JSON.stringify(await p.evaluate(()=>{const u=document.querySelector(".b-undo"); const cs=getComputedStyle(u); const r=u.getBoundingClientRect(); return {display:cs.display,opacity:cs.opacity,rect:[r.x|0,r.y|0,r.width|0,r.height|0],txt:(u.textContent||"").trim(),parent:u.parentElement.className};})));
await p.close(); await b.close();
