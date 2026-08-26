import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "timeline.owner-flight" });
const u = async(t)=>console.log(t, JSON.stringify(await p.evaluate(()=>{
  const s=document.querySelector(".b-undo"); if(!s) return null; const cs=getComputedStyle(s); const r=s.getBoundingClientRect();
  const btn=s.querySelector("button,[role=button]");
  return {display:cs.display,op:cs.opacity,h:r.height|0,txt:(s.textContent||"").trim(),
    btn: btn?{tag:btn.tagName,cls:String(btn.className).split(" ")[0],label:(btn.getAttribute("aria-label")||btn.textContent||"").trim(),dis:btn.disabled,ad:btn.getAttribute("aria-disabled"),ti:btn.tabIndex,rect:(()=>{const q=btn.getBoundingClientRect();return [q.width|0,q.height|0]})()}:null,
    sentence: (s.querySelector(".b-undo-say,.b-undoTxt,p,span")?.textContent||"").trim()};
})));
await p.locator(".b-grab").first().click(); await p.waitForTimeout(400); await u("just-opened");
await p.locator("#b-edit .b-step").first().click(); await p.waitForTimeout(500); await u("after-step");
await p.keyboard.press("Control+z"); await p.waitForTimeout(500); await u("after-undo");
// press the undo button now
const before = await p.evaluate(()=>document.querySelector("#b-edit")?.getAttribute("aria-label"));
const bx = await p.locator(".b-undo button").first().boundingBox().catch(()=>null);
console.log("undo btn box", JSON.stringify(bx));
if (bx) { await p.locator(".b-undo button").first().click(); await p.waitForTimeout(400); await u("after-pressing-undo-again"); }
await p.close(); await b.close();
